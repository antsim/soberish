import { Injectable, computed, inject, signal } from '@angular/core';
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
import {
  MIN_SPAN_MS,
  SpanChoice,
  TimeWindow,
  autoWindow,
  clampWindow,
  panWindow,
  resolveSpan,
  spanOf,
  zoomWindow,
} from './chart-viewport';
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

  /**
   * When the session ended, or `null` while it is still running.
   *
   * The session is over the moment BAC returns to 0.00 ‰ — not when the
   * history is wiped 24 hours later. The two were conflated, so the session
   * clock kept counting through a day of sobriety.
   */
  readonly endedAt = computed(() => sessionEnd(this.sessionSoberAt(), this.#clock.now()));

  /** How long the session ran; frozen once it has ended. */
  readonly elapsedMs = computed(() =>
    sessionElapsed(this.startedAt(), this.endedAt(), this.#clock.now()),
  );

  // --- Chart viewport ------------------------------------------------------
  //
  // The full session can run to sixteen hours or more, which squeezes the part
  // anyone cares about — the last few hours — into a few pixels. The chart
  // therefore draws a window onto the session rather than all of it, and the
  // timeline is rebuilt for that window so zooming in buys real resolution
  // instead of stretching the same samples.

  readonly #viewport = signal<
    | { readonly mode: 'auto'; readonly span: SpanChoice }
    | { readonly mode: 'manual'; readonly window: TimeWindow }
  >({ mode: 'auto', span: 'auto' });

  /** The whole session, plus a little margin either side. */
  readonly chartBounds = computed<TimeWindow>(() => {
    const now = this.#clock.now();
    const started = this.startedAt();
    const sober = this.sessionSoberAt();
    const from = (started ?? now - HOUR) - 10 * MINUTE;
    // Once the session has ended the chart stops following the clock, so a
    // finished night does not shrink into the corner over the next 24 hours.
    const ended = sessionEnd(sober, now);
    const to = (ended ?? Math.max(now, sober ?? now)) + 30 * MINUTE;
    return { from, to: Math.max(to, from + MIN_SPAN_MS) };
  });

  /** The slice currently on screen. */
  readonly chartWindow = computed<TimeWindow>(() => {
    const bounds = this.chartBounds();
    const viewport = this.#viewport();
    return viewport.mode === 'manual'
      ? clampWindow(viewport.window, bounds)
      : autoWindow(resolveSpan(viewport.span, bounds), this.#clock.now(), bounds);
  });

  /** Timeline for the visible window only — full resolution at any zoom. */
  readonly chartTimeline = computed(() => {
    const window = this.chartWindow();
    return buildTimeline(this.#drinks.drinks(), this.#profiles.profile(), this.#clock.now(), {
      samples: CHART_SAMPLES,
      from: window.from,
      to: window.to,
    });
  });

  /** True while the window tracks "now" on its own. */
  readonly following = computed(() => this.#viewport().mode === 'auto');

  /** True when the session is long enough that zooming is worth offering. */
  readonly zoomable = computed(() => spanOf(this.chartBounds()) > 3 * HOUR);

  /** Whole session visible, so "Session" is the active range. */
  readonly showingWholeSession = computed(
    () => spanOf(this.chartWindow()) >= spanOf(this.chartBounds()) - MINUTE,
  );

  setChartSpan(span: SpanChoice): void {
    this.#viewport.set({ mode: 'auto', span });
  }

  /** Snaps back to tracking "now" without changing the zoom level. */
  followNow(): void {
    this.#viewport.set({ mode: 'auto', span: spanOf(this.chartWindow()) });
  }

  panChart(deltaMs: number): void {
    this.#viewport.set({
      mode: 'manual',
      window: panWindow(this.chartWindow(), deltaMs, this.chartBounds()),
    });
  }

  zoomChart(factor: number, focusRatio: number): void {
    this.#viewport.set({
      mode: 'manual',
      window: zoomWindow(this.chartWindow(), factor, focusRatio, this.chartBounds()),
    });
  }

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

/**
 * The instant the session ended, or `null` while it is still running.
 *
 * `soberAt` is a projection: it is a future timestamp while there is still
 * alcohol on board, and only becomes an end once the clock reaches it.
 */
export function sessionEnd(soberAt: number | null, now: number): number | null {
  return soberAt !== null && now >= soberAt ? soberAt : null;
}

/** Session duration, measured to its end once it has one. */
export function sessionElapsed(
  startedAt: number | null,
  endedAt: number | null,
  now: number,
): number {
  if (startedAt === null) return 0;
  return Math.max(0, (endedAt ?? now) - startedAt);
}
