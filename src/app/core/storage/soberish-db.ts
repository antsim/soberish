import { Injectable } from '@angular/core';
import { Drink } from '../models/drink.model';
import { Profile } from '../models/profile.model';
import { IdbDatabase, isIdbAvailable } from './idb';

export const STORES = { drinks: 'drinks', meta: 'meta' } as const;

/** Keys used in the single-row `meta` store. */
export const META_KEYS = {
  profile: 'profile',
  lastPulledAt: 'lastPulledAt',
  sessionClearedAt: 'sessionClearedAt',
  recentDrinks: 'recentDrinks',
  drinkLimit: 'drinkLimit',
} as const;

/**
 * The offline store of record.
 *
 * Everything the app shows is read from here first; Supabase is a replica that
 * gets reconciled when a connection happens to be available. Falls back to an
 * in-memory store when IndexedDB is missing (private browsing on old iOS).
 */
@Injectable({ providedIn: 'root' })
export class SoberishDb {
  readonly available = isIdbAvailable();

  readonly #memory = { drinks: new Map<string, Drink>(), meta: new Map<string, unknown>() };

  readonly #db = this.available
    ? new IdbDatabase({
        name: 'soberish',
        version: 1,
        upgrade: (db) => {
          if (!db.objectStoreNames.contains(STORES.drinks)) {
            const drinks = db.createObjectStore(STORES.drinks, { keyPath: 'id' });
            drinks.createIndex('consumedAt', 'consumedAt');
            drinks.createIndex('synced', 'synced');
          }
          if (!db.objectStoreNames.contains(STORES.meta)) {
            db.createObjectStore(STORES.meta);
          }
        },
      })
    : null;

  async allDrinks(): Promise<Drink[]> {
    const rows = this.#db
      ? await this.#db.getAll<Drink>(STORES.drinks)
      : [...this.#memory.drinks.values()];
    return rows.map(hydrate).sort((a, b) => a.consumedAt - b.consumedAt);
  }

  async saveDrinks(drinks: readonly Drink[]): Promise<void> {
    if (!drinks.length) return;
    if (this.#db) return this.#db.putAll(STORES.drinks, drinks);
    for (const drink of drinks) this.#memory.drinks.set(drink.id, drink);
  }

  saveDrink(drink: Drink): Promise<void> {
    return this.saveDrinks([drink]);
  }

  async removeDrinks(ids: readonly string[]): Promise<void> {
    if (this.#db) {
      await Promise.all(ids.map((id) => this.#db!.delete(STORES.drinks, id)));
      return;
    }
    for (const id of ids) this.#memory.drinks.delete(id);
  }

  async clearDrinks(): Promise<void> {
    if (this.#db) return this.#db.clear(STORES.drinks);
    this.#memory.drinks.clear();
  }

  async readProfile(): Promise<Profile | undefined> {
    return this.#meta<Profile>(META_KEYS.profile);
  }

  writeProfile(profile: Profile): Promise<void> {
    return this.#writeMeta(META_KEYS.profile, profile);
  }

  async readMeta<T>(key: string): Promise<T | undefined> {
    return this.#meta<T>(key);
  }

  writeMeta<T>(key: string, value: T): Promise<void> {
    return this.#writeMeta(key, value);
  }

  async #meta<T>(key: string): Promise<T | undefined> {
    if (this.#db) return this.#db.get<T>(STORES.meta, key);
    return this.#memory.meta.get(key) as T | undefined;
  }

  async #writeMeta<T>(key: string, value: T): Promise<void> {
    if (this.#db) return this.#db.put(STORES.meta, value, key);
    this.#memory.meta.set(key, value);
  }
}

/**
 * Fills in fields added after a row was written.
 *
 * A drink logged before durations existed was drunk in one go as far as the
 * engine is concerned — reading it as anything else would silently redraw
 * history the user already saw.
 */
function hydrate(row: Drink): Drink {
  return { ...row, durationMinutes: row.durationMinutes ?? 0 };
}
