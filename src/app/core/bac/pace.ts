import { Drink } from '../models/drink.model';
import { Profile } from '../models/profile.model';
import {
  ETHANOL_DENSITY,
  HOUR,
  MINUTE,
  SoberStatus,
  alcoholGrams,
  buildTimeline,
  statusFor,
} from './bac';

/** How far back "your current pace" looks. */
export const PACE_WINDOW_MS = 90 * MINUTE;

/** How far ahead the projection runs. */
export const PACE_HORIZON_MS = 2 * HOUR;

/**
 * Floor on the period the rate is measured over.
 *
 * Two drinks twenty minutes apart is arithmetically six an hour, which would
 * have the app opening every night by predicting catastrophe. Dividing by at
 * least this long damps that smoothly, rather than hiding the whole feature
 * behind an arbitrary "not yet".
 */
const MIN_MEASURE_MS = 45 * MINUTE;

/** One drink is an event. Two is a pattern. */
const MIN_DRINKS = 2;

/** Under this much extra there is no story worth telling — 0.10 ‰. */
const MIN_RISE = 0.01;

/** Bounds the synthesised set; nobody needs a forty-drink projection. */
const MAX_PROJECTED_DRINKS = 20;

/** Crossing-time resolution: two minutes across the horizon. */
const SAMPLES = 61;

/** The rate someone is drinking at right now. */
export interface Pace {
  /** Grams of ethanol per hour. */
  readonly gramsPerHour: number;
  /** Drinks counted in the window — the evidence behind the number. */
  readonly drinks: number;
  readonly windowMs: number;
  /** The serving the projection repeats: their own recent average. */
  readonly averageGrams: number;
  readonly averageAbv: number;
  readonly averageSpreadMs: number;
}

/** Where tonight ends up if nothing changes. */
export interface PaceProjection {
  readonly pace: Pace;
  /** BAC at the horizon, as a percentage, if this pace holds. */
  readonly bac: number;
  readonly at: number;
  readonly status: SoberStatus;
  /** How many more drinks that trajectory assumes. */
  readonly moreDrinks: number;
  /** When a ceiling is crossed on the way, if it is crossed at all. */
  readonly crossesAt: number | null;
}

function countable(drinks: readonly Drink[]): readonly Drink[] {
  return drinks.filter((d) => !d.deleted && d.abv > 0 && d.volumeMl > 0);
}

/**
 * How fast they are drinking, judged from a trailing window.
 *
 * The window is what lets the answer fall as someone slows down: drinks age
 * out of it on their own, so "I stopped an hour ago" needs no special case.
 * `null` when there is not enough to go on.
 */
export function measurePace(
  drinks: readonly Drink[],
  now: number,
  windowMs: number = PACE_WINDOW_MS,
): Pace | null {
  // Inclusive at the far edge: a drink exactly 90 minutes old is still "in the
  // last 90 minutes", and an off-by-one here silently drops a whole serving.
  const recent = countable(drinks).filter(
    (d) => d.consumedAt >= now - windowMs && d.consumedAt <= now,
  );
  if (recent.length < MIN_DRINKS) return null;

  const grams = recent.reduce((sum, d) => sum + alcoholGrams(d.volumeMl, d.abv), 0);
  if (grams <= 0) return null;

  const first = Math.min(...recent.map((d) => d.consumedAt));
  const measured = Math.max(now - first, MIN_MEASURE_MS);

  return {
    gramsPerHour: (grams / measured) * HOUR,
    drinks: recent.length,
    windowMs,
    averageGrams: grams / recent.length,
    averageAbv: recent.reduce((sum, d) => sum + d.abv, 0) / recent.length,
    averageSpreadMs:
      (recent.reduce((sum, d) => sum + Math.max(0, d.durationMinutes), 0) / recent.length) * MINUTE,
  };
}

/**
 * The drinks they have not had yet, spaced at the rate they are keeping.
 *
 * Expressed as real `Drink`s so the projection runs through the same engine as
 * everything else — absorption, sipping windows and tonight's stomach state
 * all apply to the imagined half of the night exactly as they do to the real
 * half.
 */
function futureDrinks(pace: Pace, from: number, horizonMs: number): Drink[] {
  const perHour = pace.gramsPerHour / pace.averageGrams;
  if (!Number.isFinite(perHour) || perHour <= 0) return [];

  const intervalMs = HOUR / perHour;
  const abv = Math.max(0.1, pace.averageAbv);
  const volumeMl = pace.averageGrams / ((abv / 100) * ETHANOL_DENSITY);

  const drinks: Drink[] = [];
  for (let at = from + intervalMs; at <= from + horizonMs; at += intervalMs) {
    if (drinks.length >= MAX_PROJECTED_DRINKS) break;
    drinks.push({
      id: `projected-${drinks.length}`,
      consumedAt: at,
      volumeMl,
      abv,
      durationMinutes: Math.round(pace.averageSpreadMs / MINUTE),
      label: '',
      icon: '',
      createdAt: at,
      updatedAt: at,
      deleted: false,
      synced: true,
    });
  }
  return drinks;
}

/**
 * "Keep this up and you are at X by Y."
 *
 * Deliberately not `bacIn()`, which answers the opposite question — where the
 * night lands if you stop right now. `null` whenever there is nothing worth
 * saying: too little evidence, or a trajectory that goes nowhere.
 */
export function projectAtPace(
  drinks: readonly Drink[],
  profile: Profile,
  now: number,
  options: { readonly horizonMs?: number; readonly limit?: number | null } = {},
): PaceProjection | null {
  const pace = measurePace(drinks, now);
  if (!pace) return null;

  const horizonMs = options.horizonMs ?? PACE_HORIZON_MS;
  const future = futureDrinks(pace, now, horizonMs);
  if (!future.length) return null;

  const at = now + horizonMs;
  const timeline = buildTimeline([...countable(drinks), ...future], profile, now, {
    samples: SAMPLES,
    from: now,
    to: at,
  });

  const bac = timeline.points.at(-1)?.bac ?? 0;
  if (bac < timeline.current + MIN_RISE) return null;

  const status = statusFor(bac);
  if (status === 'sober') return null;

  const limit = options.limit ?? null;
  const crossesAt = limit === null ? null : (timeline.points.find((p) => p.bac > limit)?.t ?? null);

  return {
    pace,
    bac,
    at,
    status,
    moreDrinks: future.length,
    // A ceiling already behind you is not something this can warn about.
    crossesAt: crossesAt !== null && crossesAt > now ? crossesAt : null,
  };
}
