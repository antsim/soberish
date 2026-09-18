import { Injectable, inject, signal } from '@angular/core';
import { DEFAULT_STOMACH, StomachState, isStomachState } from '../models/profile.model';
import { META_KEYS, SoberishDb } from '../storage/soberish-db';

/**
 * How much the drinker has eaten tonight.
 *
 * Deliberately not part of `Profile`, for two reasons. It belongs to the
 * night rather than to the body — you eat differently on a Tuesday than at a
 * wedding — so it resets with the session. And writing it through
 * `ProfileStore.patch` would stamp `updatedAt`, which is what marks the body
 * profile as confirmed: picking "full meal" would silently dismiss the "set
 * your weight" onboarding card.
 */
@Injectable({ providedIn: 'root' })
export class StomachStore {
  readonly #db = inject(SoberishDb);
  readonly #state = signal<StomachState>(DEFAULT_STOMACH);

  readonly state = this.#state.asReadonly();

  async load(): Promise<void> {
    const stored = await this.#db.readMeta<unknown>(META_KEYS.stomach);
    this.#state.set(isStomachState(stored) ? stored : DEFAULT_STOMACH);
  }

  async set(state: StomachState): Promise<void> {
    this.#state.set(state);
    await this.#db.writeMeta(META_KEYS.stomach, state);
  }

  /** Back to the default — the night this described is over. */
  reset(): Promise<void> {
    return this.set(DEFAULT_STOMACH);
  }
}
