import { Injectable, Injector, effect, inject, signal, untracked } from '@angular/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Drink } from '../models/drink.model';
import { Connectivity } from '../platform/connectivity';
import { DrinksStore } from '../state/drinks-store';
import { META_KEYS, SoberishDb } from '../storage/soberish-db';
import { AuthStore } from '../supabase/auth-store';
import { SupabaseService } from '../supabase/supabase.service';
import { DrinkRow, TABLES, fromDrinkRow, toDrinkRow } from '../supabase/tables';

export type SyncState = 'off' | 'idle' | 'syncing' | 'error';

const RETRY_MS = 60_000;
const DEBOUNCE_MS = 1_500;

/**
 * Offline-first replication of the drink log.
 *
 * IndexedDB is authoritative locally; this pushes dirty and tombstoned rows up,
 * pulls anything newer down, and resolves conflicts by last write. It is a
 * no-op when signed out, offline, or when no Supabase config was deployed.
 */
@Injectable({ providedIn: 'root' })
export class DrinkSyncService {
  readonly #supabase = inject(SupabaseService);
  readonly #auth = inject(AuthStore);
  readonly #drinks = inject(DrinksStore);
  readonly #db = inject(SoberishDb);
  readonly #network = inject(Connectivity);
  readonly #injector = inject(Injector);

  readonly #state = signal<SyncState>(this.#supabase.enabled ? 'idle' : 'off');
  readonly #lastSyncedAt = signal<number | null>(null);
  readonly state = this.#state.asReadonly();
  readonly lastSyncedAt = this.#lastSyncedAt.asReadonly();

  #timer: ReturnType<typeof setTimeout> | null = null;
  #inFlight: Promise<void> | null = null;

  /** Called once during bootstrap. */
  start(): void {
    if (!this.#supabase.enabled) return;

    // Sign-in state, connectivity, and the pending queue all re-arm a sync.
    effect(
      () => {
        const signedIn = this.#auth.signedIn();
        const online = this.#network.online();
        const pending = this.#drinks.pending().length;
        untracked(() => {
          if (signedIn && online) this.schedule(pending ? DEBOUNCE_MS : 0);
        });
      },
      { injector: this.#injector },
    );

    setInterval(() => this.schedule(0), RETRY_MS);
  }

  schedule(delay: number): void {
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = setTimeout(() => void this.sync(), delay);
  }

  /** Runs a push/pull cycle. Concurrent callers share the in-flight run. */
  sync(): Promise<void> {
    this.#inFlight ??= this.#run().finally(() => {
      this.#inFlight = null;
    });
    return this.#inFlight;
  }

  async #run(): Promise<void> {
    const userId = this.#auth.user()?.id;
    const client = await this.#supabase.client();
    if (!client || !userId || !this.#network.online()) return;

    this.#state.set('syncing');
    try {
      await this.#push(client, userId);
      await this.#pull(client, userId);
      this.#lastSyncedAt.set(Date.now());
      this.#state.set('idle');
    } catch (error) {
      console.warn('Drink sync failed; will retry', error);
      this.#state.set('error');
    }
  }

  async #push(client: SupabaseClient, userId: string): Promise<void> {
    const pending = this.#drinks.pending();
    if (!pending.length) return;
    const rows = pending.map((drink) => toDrinkRow(drink, userId));
    const { error } = await client.from(TABLES.drinks).upsert(rows, { onConflict: 'id' });
    if (error) throw new Error(error.message);
    await this.#drinks.markSynced(pending.map((drink) => drink.id));
  }

  async #pull(client: SupabaseClient, userId: string): Promise<void> {
    const since = (await this.#db.readMeta<number>(META_KEYS.lastPulledAt)) ?? 0;
    const { data, error } = await client
      .from(TABLES.drinks)
      .select('*')
      .eq('user_id', userId)
      .gt('updated_at', new Date(since).toISOString())
      .order('updated_at', { ascending: true });
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as DrinkRow[];
    if (rows.length) {
      const remote = rows.map(fromDrinkRow);
      await this.#drinks.replaceAll(merge(this.#drinks.all(), remote, this.#drinks.pending()));
      const newest = remote.reduce((max, drink) => Math.max(max, drink.updatedAt), since);
      await this.#db.writeMeta(META_KEYS.lastPulledAt, newest);
    }
    await this.#drinks.purgeTombstones();
  }
}

/**
 * Last-write-wins merge. Rows still waiting to be pushed always win, so a
 * pull can never resurrect a drink the user just deleted offline.
 */
export function merge(
  local: readonly Drink[],
  remote: readonly Drink[],
  pending: readonly Drink[],
): Drink[] {
  const byId = new Map(local.map((drink) => [drink.id, drink]));
  for (const row of remote) {
    const current = byId.get(row.id);
    if (!current || row.updatedAt >= current.updatedAt) byId.set(row.id, row);
  }
  const pendingIds = new Set(pending.map((drink) => drink.id));
  for (const row of pending) byId.set(row.id, row);
  return [...byId.values()].filter((drink) => !drink.deleted || pendingIds.has(drink.id));
}
