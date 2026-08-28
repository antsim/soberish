import { Injectable, inject, signal } from '@angular/core';
import { META_KEYS, SoberishDb } from '../storage/soberish-db';

/** Highest ceiling worth offering, as a BAC percentage — 2.00 ‰. */
export const MAX_DRINK_LIMIT = 0.2;

/**
 * The ceiling the drink planner aims for, as a BAC percentage, or `null` when
 * planning is switched off.
 *
 * Deliberately not part of `Profile`: writing it through `ProfileStore.patch`
 * would stamp `updatedAt`, which is what marks the body profile as confirmed —
 * picking a limit would silently dismiss the "set your weight" onboarding card.
 */
@Injectable({ providedIn: 'root' })
export class DrinkLimitStore {
  readonly #db = inject(SoberishDb);
  readonly #limit = signal<number | null>(null);

  readonly limit = this.#limit.asReadonly();

  async load(): Promise<void> {
    this.#limit.set(sanitize(await this.#db.readMeta<unknown>(META_KEYS.drinkLimit)));
  }

  async set(limit: number | null): Promise<void> {
    const next = sanitize(limit);
    this.#limit.set(next);
    await this.#db.writeMeta(META_KEYS.drinkLimit, next);
  }
}

/**
 * Stored values survive app updates, so nothing about their shape is assumed.
 *
 * Only a non-number reads as "no limit". Zero is a limit like any other, and
 * clamping it to `null` would switch the planner off mid-keystroke for anyone
 * typing "0.45" one character at a time.
 */
function sanitize(stored: unknown): number | null {
  if (typeof stored !== 'number' || !Number.isFinite(stored)) return null;
  return Math.min(Math.max(stored, 0), MAX_DRINK_LIMIT);
}
