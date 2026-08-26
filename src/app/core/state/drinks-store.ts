import { Injectable, computed, inject, signal } from '@angular/core';
import { Drink, DrinkDraft } from '../models/drink.model';
import { SoberishDb } from '../storage/soberish-db';

function newId(): string {
  return crypto.randomUUID();
}

/**
 * The single writer for drink data.
 *
 * Writes land in IndexedDB synchronously with the signal update so the UI never
 * waits on storage, and deletions are tombstoned rather than dropped so the
 * change can still be pushed to Supabase later.
 */
@Injectable({ providedIn: 'root' })
export class DrinksStore {
  readonly #db = inject(SoberishDb);
  readonly #all = signal<readonly Drink[]>([]);
  readonly #loaded = signal(false);

  /** Live drinks, oldest first. Tombstones are filtered out. */
  readonly drinks = computed(() =>
    this.#all()
      .filter((drink) => !drink.deleted)
      .sort((a, b) => a.consumedAt - b.consumedAt),
  );
  /** Every row, tombstones included — the sync layer needs the full picture. */
  readonly all = this.#all.asReadonly();
  readonly loaded = this.#loaded.asReadonly();
  readonly count = computed(() => this.drinks().length);
  readonly lastDrink = computed(() => this.drinks().at(-1) ?? null);
  /** Rows with local changes the server has not acknowledged. */
  readonly pending = computed(() => this.#all().filter((drink) => !drink.synced));

  async load(): Promise<void> {
    this.#all.set(await this.#db.allDrinks());
    this.#loaded.set(true);
  }

  async add(draft: DrinkDraft): Promise<Drink> {
    const now = Date.now();
    const drink: Drink = {
      ...draft,
      id: newId(),
      createdAt: now,
      updatedAt: now,
      deleted: false,
      synced: false,
    };
    await this.#commit([...this.#all(), drink]);
    return drink;
  }

  async update(id: string, changes: Partial<DrinkDraft>): Promise<void> {
    await this.#mutate(id, (drink) => ({
      ...drink,
      ...changes,
      updatedAt: Date.now(),
      synced: false,
    }));
  }

  /** Soft delete. The row survives as a tombstone until the sync confirms it. */
  async remove(id: string): Promise<void> {
    await this.#mutate(id, (drink) => ({
      ...drink,
      deleted: true,
      updatedAt: Date.now(),
      synced: false,
    }));
  }

  /** Reverses a `remove()` while the undo toast is still on screen. */
  async restore(id: string): Promise<void> {
    await this.#mutate(id, (drink) => ({
      ...drink,
      deleted: false,
      updatedAt: Date.now(),
      synced: false,
    }));
  }

  /** Wipes the session — used by the 24h retention rule and the manual reset. */
  async clear(): Promise<void> {
    const now = Date.now();
    const tombstones = this.#all()
      .filter((drink) => !drink.deleted)
      .map((drink) => ({ ...drink, deleted: true, updatedAt: now, synced: false }));
    await this.#commit(
      this.#all().map((drink) => tombstones.find((t) => t.id === drink.id) ?? drink),
    );
  }

  /** Replaces local state with rows merged from the server. */
  async replaceAll(drinks: readonly Drink[]): Promise<void> {
    this.#all.set(drinks);
    await this.#db.clearDrinks();
    await this.#db.saveDrinks(drinks);
  }

  /** Marks rows as acknowledged by the server; fully-deleted rows are dropped. */
  async markSynced(ids: readonly string[]): Promise<void> {
    const idSet = new Set(ids);
    const kept: Drink[] = [];
    const dropped: string[] = [];
    for (const drink of this.#all()) {
      if (!idSet.has(drink.id)) {
        kept.push(drink);
      } else if (drink.deleted) {
        dropped.push(drink.id);
      } else {
        kept.push({ ...drink, synced: true });
      }
    }
    this.#all.set(kept);
    await this.#db.saveDrinks(kept.filter((drink) => idSet.has(drink.id)));
    await this.#db.removeDrinks(dropped);
  }

  /** Purges tombstones once there is no server that could still want them. */
  async purgeTombstones(): Promise<void> {
    const dropped = this.#all()
      .filter((drink) => drink.deleted)
      .map((drink) => drink.id);
    if (!dropped.length) return;
    this.#all.set(this.#all().filter((drink) => !drink.deleted));
    await this.#db.removeDrinks(dropped);
  }

  async #mutate(id: string, change: (drink: Drink) => Drink): Promise<void> {
    const current = this.#all();
    if (!current.some((drink) => drink.id === id)) return;
    await this.#commit(current.map((drink) => (drink.id === id ? change(drink) : drink)));
  }

  async #commit(next: readonly Drink[]): Promise<void> {
    const previous = new Map(this.#all().map((drink) => [drink.id, drink]));
    this.#all.set(next);
    const changed = next.filter((drink) => previous.get(drink.id) !== drink);
    await this.#db.saveDrinks(changed);
  }
}
