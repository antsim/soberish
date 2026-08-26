import { Injectable, computed, inject, signal } from '@angular/core';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { LeaderboardEntry, RankedEntry } from '../models/leaderboard.model';
import { Clock } from '../platform/clock';
import { Connectivity } from '../platform/connectivity';
import { AuthStore } from './auth-store';
import { SupabaseService } from './supabase.service';
import { BacStatusRow, TABLES, fromStatusRow } from './tables';

const REFRESH_MS = 30_000;
const MAX_ROWS = 50;

/**
 * The live "currently above 0.00%" board.
 *
 * Published rows are a snapshot (`bac` at `measuredAt`, dropping to zero at
 * `soberAt`), so every client extrapolates the value forward against its own
 * clock. That keeps the board ticking down smoothly between refreshes instead
 * of showing stale numbers.
 */
@Injectable({ providedIn: 'root' })
export class LeaderboardService {
  readonly #supabase = inject(SupabaseService);
  readonly #auth = inject(AuthStore);
  readonly #network = inject(Connectivity);
  readonly #clock = inject(Clock);

  readonly #entries = signal<readonly LeaderboardEntry[]>([]);
  readonly #loading = signal(false);
  readonly #error = signal<string | null>(null);
  readonly #fetchedAt = signal<number | null>(null);

  readonly available = this.#supabase.enabled;
  readonly loading = this.#loading.asReadonly();
  readonly error = this.#error.asReadonly();
  readonly fetchedAt = this.#fetchedAt.asReadonly();

  /** Entries with BAC extrapolated to now, still-drunk only, ranked. */
  readonly ranked = computed<readonly RankedEntry[]>(() => {
    const now = this.#clock.now();
    const selfId = this.#auth.user()?.id ?? null;
    return this.#entries()
      .map((entry) => ({ entry, liveBac: projectBac(entry, now) }))
      .filter(({ liveBac }) => liveBac > 0)
      .sort((a, b) => b.liveBac - a.liveBac)
      .map(({ entry, liveBac }, index) => ({
        ...entry,
        liveBac,
        rank: index + 1,
        isSelf: entry.userId === selfId,
      }));
  });

  readonly selfRank = computed(() => this.ranked().find((entry) => entry.isSelf)?.rank ?? null);

  #channel: RealtimeChannel | null = null;
  #timer: ReturnType<typeof setInterval> | null = null;

  /** Starts polling plus a realtime subscription; safe to call repeatedly. */
  async connect(): Promise<void> {
    if (!this.available) return;
    await this.refresh();
    this.#timer ??= setInterval(() => void this.refresh(), REFRESH_MS);

    const client = await this.#supabase.client();
    if (!client || this.#channel) return;
    this.#channel = client
      .channel('soberish-leaderboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.status }, () => {
        void this.refresh();
      })
      .subscribe();
  }

  async disconnect(): Promise<void> {
    if (this.#timer) clearInterval(this.#timer);
    this.#timer = null;
    if (this.#channel) {
      const client = await this.#supabase.client();
      await client?.removeChannel(this.#channel);
      this.#channel = null;
    }
  }

  async refresh(): Promise<void> {
    if (!this.available || !this.#network.online()) return;
    const client = await this.#supabase.client();
    if (!client) return;

    this.#loading.set(true);
    try {
      const { data, error } = await client
        .from(TABLES.status)
        .select('*')
        .gt('sober_at', new Date().toISOString())
        .order('bac', { ascending: false })
        .limit(MAX_ROWS);
      if (error) throw new Error(error.message);
      this.#entries.set(((data ?? []) as BacStatusRow[]).map(fromStatusRow));
      this.#error.set(null);
      this.#fetchedAt.set(Date.now());
    } catch (error) {
      this.#error.set(error instanceof Error ? error.message : 'Could not reach the leaderboard.');
    } finally {
      this.#loading.set(false);
    }
  }
}

/**
 * Straight-line decay from the published BAC to 0.00% at `soberAt`, which is
 * exactly how the Widmark tail behaves once absorption has finished.
 */
export function projectBac(entry: LeaderboardEntry, now: number): number {
  if (entry.soberAt === null || now >= entry.soberAt) return 0;
  if (now <= entry.measuredAt) return entry.bac;
  const span = entry.soberAt - entry.measuredAt;
  if (span <= 0) return 0;
  const remaining = (entry.soberAt - now) / span;
  return Math.max(0, Math.round(entry.bac * remaining * 1000) / 1000);
}
