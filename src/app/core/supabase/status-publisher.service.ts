import { Injectable, Injector, effect, inject, untracked } from '@angular/core';
import { Connectivity } from '../platform/connectivity';
import { ProfileStore } from '../state/profile-store';
import { SessionStore } from '../state/session-store';
import { AuthStore } from './auth-store';
import { SupabaseService } from './supabase.service';
import { BacStatusRow, TABLES } from './tables';

/** Don't spam the table: republish at most this often. */
const MIN_INTERVAL_MS = 20_000;
/** …unless BAC has moved by more than this since the last publish. */
const BAC_EPSILON = 0.002;

/**
 * Publishes this drinker's BAC to the shared board while they are above 0.00%.
 *
 * Sobering up (or opting out, or signing out) removes the row, so the board
 * only ever contains people who are actually still drunk.
 */
@Injectable({ providedIn: 'root' })
export class StatusPublisherService {
  readonly #supabase = inject(SupabaseService);
  readonly #auth = inject(AuthStore);
  readonly #session = inject(SessionStore);
  readonly #profiles = inject(ProfileStore);
  readonly #network = inject(Connectivity);
  readonly #injector = inject(Injector);

  #lastPublishedAt = 0;
  #lastBac = -1;
  #hasRow = false;
  #inFlight = false;

  /** Called once during bootstrap. */
  start(): void {
    if (!this.#supabase.enabled) return;
    effect(
      () => {
        const signedIn = this.#auth.signedIn();
        const online = this.#network.online();
        const sharing = this.#profiles.profile().shareToLeaderboard;
        const bac = this.#session.bac();
        untracked(() => void this.#reconcile({ signedIn, online, sharing, bac }));
      },
      { injector: this.#injector },
    );
  }

  async #reconcile(state: {
    signedIn: boolean;
    online: boolean;
    sharing: boolean;
    bac: number;
  }): Promise<void> {
    if (this.#inFlight || !state.online) return;
    const shouldPublish = state.signedIn && state.sharing && state.bac > 0;

    if (!shouldPublish) {
      if (this.#hasRow) await this.#withdraw();
      return;
    }

    const now = Date.now();
    const moved = Math.abs(state.bac - this.#lastBac) >= BAC_EPSILON;
    if (!moved && now - this.#lastPublishedAt < MIN_INTERVAL_MS) return;
    await this.#publish(state.bac);
  }

  async #publish(bac: number): Promise<void> {
    const client = await this.#supabase.client();
    const user = this.#auth.user();
    if (!client || !user) return;

    const profile = this.#profiles.profile();
    const row: BacStatusRow = {
      user_id: user.id,
      display_name: profile.displayName || user.email.split('@')[0] || 'Anonymous',
      bac,
      peak_bac: this.#session.peak(),
      drinks: Math.round(this.#session.totalStandardDrinks() * 10) / 10,
      measured_at: new Date().toISOString(),
      sober_at: this.#session.soberAt() ? new Date(this.#session.soberAt()!).toISOString() : null,
    };

    this.#inFlight = true;
    try {
      const { error } = await client.from(TABLES.status).upsert(row, { onConflict: 'user_id' });
      if (error) throw new Error(error.message);
      this.#lastPublishedAt = Date.now();
      this.#lastBac = bac;
      this.#hasRow = true;
    } catch (error) {
      console.warn('Could not publish BAC status', error);
    } finally {
      this.#inFlight = false;
    }
  }

  async #withdraw(): Promise<void> {
    const client = await this.#supabase.client();
    const user = this.#auth.user();
    if (!client || !user) {
      this.#hasRow = false;
      return;
    }
    this.#inFlight = true;
    try {
      await client.from(TABLES.status).delete().eq('user_id', user.id);
      this.#hasRow = false;
      this.#lastBac = -1;
    } catch (error) {
      console.warn('Could not withdraw BAC status', error);
    } finally {
      this.#inFlight = false;
    }
  }
}
