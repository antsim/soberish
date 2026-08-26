import { Injectable, computed, inject } from '@angular/core';
import {
  HOUR,
  MINUTE,
  STATUS_COPY,
  buildTimeline,
  soberAt,
  standardDrinks,
  statusFor,
} from '../bac/bac';
import { Clock } from '../platform/clock';
import { DrinksStore } from './drinks-store';
import { ProfileStore } from './profile-store';

/** Sample count for the chart. Constant, so two curves can morph point-for-point. */
export const CHART_SAMPLES = 160;

/** Grace period after sobering up before the session is wiped. */
export const RETENTION_MS = 24 * HOUR;

/**
 * Read-only projection of "the current drinking session".
 *
 * Everything here is derived from `drinks × profile × now`, which means a
 * single `Clock` tick decays the whole UI and any edit re-renders the chart.
 */
@Injectable({ providedIn: 'root' })
export class SessionStore {
  readonly #drinks = inject(DrinksStore);
  readonly #profiles = inject(ProfileStore);
  readonly #clock = inject(Clock);

  readonly ready = computed(() => this.#drinks.loaded() && this.#profiles.loaded());

  readonly timeline = computed(() =>
    buildTimeline(this.#drinks.drinks(), this.#profiles.profile(), this.#clock.now(), {
      samples: CHART_SAMPLES,
    }),
  );

  readonly bac = computed(() => this.timeline().current);
  readonly peak = computed(() => this.timeline().peak);
  readonly rising = computed(() => this.timeline().rising);
  readonly status = computed(() => statusFor(this.bac()));
  /**
   * Copy for the current band, with one special case: alcohol that has been
   * drunk but not yet absorbed reads as 0.00 ‰, and calling that "sober" would
   * be actively misleading.
   */
  readonly statusCopy = computed(() =>
    this.bac() <= 0 && this.rising()
      ? { title: 'Kicking in', blurb: 'Drinks logged — absorption has just started.' }
      : STATUS_COPY[this.status()],
  );

  /** Projected moment of returning to 0.00 ‰, or `null` when already sober. */
  readonly soberAt = computed(() => this.timeline().soberAt);

  /** Milliseconds until sober, floored at zero. */
  readonly msUntilSober = computed(() => {
    const target = this.soberAt();
    return target ? Math.max(0, target - this.#clock.now()) : 0;
  });

  readonly totalStandardDrinks = computed(() =>
    this.#drinks.drinks().reduce((sum, d) => sum + standardDrinks(d.volumeMl, d.abv), 0),
  );

  readonly totalVolumeMl = computed(() =>
    this.#drinks.drinks().reduce((sum, d) => sum + d.volumeMl, 0),
  );

  /** When the session ended (or will end); `null` with no drinks logged. */
  readonly sessionSoberAt = computed(() =>
    soberAt(this.#drinks.drinks(), this.#profiles.profile()),
  );

  /** Deadline at which an already-finished session is auto-cleared. */
  readonly retentionDeadline = computed(() => {
    const sober = this.sessionSoberAt();
    return sober === null ? null : sober + RETENTION_MS;
  });

  /** Time left before the finished session is wiped, or `null` while drinking. */
  readonly msUntilWipe = computed(() => {
    const deadline = this.retentionDeadline();
    if (deadline === null || this.bac() > 0 || this.rising()) return null;
    return Math.max(0, deadline - this.#clock.now());
  });

  readonly startedAt = computed(() => this.#drinks.drinks().at(0)?.consumedAt ?? null);

  /** Elapsed session time in ms, used for the "3h 20m in" caption. */
  readonly elapsedMs = computed(() => {
    const started = this.startedAt();
    return started === null ? 0 : Math.max(0, this.#clock.now() - started);
  });

  /** BAC in `n` minutes — powers the "where this is heading" hint. */
  bacIn(minutes: number): number {
    return buildTimeline(
      this.#drinks.drinks(),
      this.#profiles.profile(),
      this.#clock.now() + minutes * MINUTE,
      {
        samples: 2,
      },
    ).current;
  }
}
