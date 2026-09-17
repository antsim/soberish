import { Drink } from '../models/drink.model';
import { Profile, WIDMARK_R } from '../models/profile.model';

/** Density of ethanol in g/ml. */
export const ETHANOL_DENSITY = 0.789;
/** Grams of pure alcohol in one "standard drink" (WHO / most of the EU). */
export const STANDARD_DRINK_GRAMS = 10;

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;

/** Simulation granularity. One minute is well inside the model's own error bars. */
const STEP_MS = MINUTE;
/** Nobody stays drunk for three days; this bounds the "when am I sober" search. */
const MAX_PROJECTION_MS = 72 * HOUR;
/**
 * Multiples of `absorptionMinutes` after which a dose is absorbed to the last
 * drop — `absorbedFraction` is within 1e-8 of 1 by then, so the curve past this
 * point can only fall.
 */
const ABSORPTION_TAIL = 6;

export interface BacPoint {
  readonly t: number;
  readonly bac: number;
}

export interface BacTimeline {
  /** Evenly spaced samples covering [from, to]. */
  readonly points: readonly BacPoint[];
  readonly from: number;
  readonly to: number;
  /** BAC at the requested `now`. */
  readonly current: number;
  /** Highest BAC reached across the whole session, past or projected. */
  readonly peak: number;
  readonly peakAt: number;
  /** When BAC returns to 0, or `null` if already sober / no drinks. */
  readonly soberAt: number | null;
  /** True while absorption is still outpacing elimination. */
  readonly rising: boolean;
}

/** Grams of pure alcohol in a serving. */
export function alcoholGrams(volumeMl: number, abv: number): number {
  return volumeMl * (abv / 100) * ETHANOL_DENSITY;
}

export function standardDrinks(volumeMl: number, abv: number): number {
  return alcoholGrams(volumeMl, abv) / STANDARD_DRINK_GRAMS;
}

/** Body water volume available to dilute alcohol, in grams. */
function distributionMass(profile: Profile): number {
  return Math.max(1, profile.weightKg) * 1000 * WIDMARK_R[profile.bodyType];
}

/** BAC (% by volume) that `grams` of alcohol would produce once fully absorbed. */
function bacPerGram(profile: Profile): number {
  return 100 / distributionMass(profile);
}

/**
 * Fraction of a drink that has reached the bloodstream after `elapsedMs`.
 *
 * First-order absorption: `absorptionMinutes` is the time to ~95% absorbed,
 * which puts the time constant at a third of it.
 *
 * A drink with a `durationMs` is not one dose but a steady trickle over that
 * window, so the answer is that trickle convolved with the same first-order
 * kernel. Both branches below are the closed form of that integral — they meet
 * exactly at `elapsedMs === durationMs`, and as the duration goes to zero the
 * second collapses back to the plain exponential, which is why a drink taken
 * in one go needs no special case anywhere else.
 */
function absorbedFraction(
  elapsedMs: number,
  absorptionMinutes: number,
  durationMs: number,
): number {
  if (elapsedMs <= 0) return 0;
  const tau = Math.max(1, absorptionMinutes / 3) * MINUTE;
  if (durationMs <= 0) return 1 - Math.exp(-elapsedMs / tau);

  if (elapsedMs < durationMs) {
    return (elapsedMs - tau * (1 - Math.exp(-elapsedMs / tau))) / durationMs;
  }
  const since = elapsedMs - durationMs;
  return 1 - (tau / durationMs) * (Math.exp(-since / tau) - Math.exp(-elapsedMs / tau));
}

interface Dose {
  readonly at: number;
  readonly grams: number;
  /** How long the drink took; zero for one swallow. */
  readonly spread: number;
}

function toDoses(drinks: readonly Drink[]): Dose[] {
  return drinks
    .filter((d) => !d.deleted && d.abv > 0 && d.volumeMl > 0)
    .map((d) => ({
      at: d.consumedAt,
      grams: alcoholGrams(d.volumeMl, d.abv),
      spread: Math.max(0, d.durationMinutes) * MINUTE,
    }))
    .sort((a, b) => a.at - b.at);
}

/**
 * The moment the last glass is empty.
 *
 * Not simply the last dose: a pint started at eight and nursed for an hour
 * outlasts a shot downed at half past.
 */
function lastDoseEnd(doses: readonly Dose[]): number {
  return doses.reduce((latest, dose) => Math.max(latest, dose.at + dose.spread), -Infinity);
}

/** Total alcohol absorbed into the blood by time `t`, in grams. */
function absorbedGrams(doses: readonly Dose[], t: number, absorptionMinutes: number): number {
  let total = 0;
  for (const dose of doses) {
    if (dose.at > t) break;
    total += dose.grams * absorbedFraction(t - dose.at, absorptionMinutes, dose.spread);
  }
  return total;
}

/**
 * Walks the Widmark curve forward from the first drink.
 *
 * Elimination is zero-order (a flat %/hour) but only while there is alcohol
 * left to burn, so it is integrated stepwise rather than subtracted in closed
 * form — that is what makes the tail flatten out at exactly 0.00 instead of
 * going negative.
 */
function walk(
  doses: readonly Dose[],
  profile: Profile,
  until: number,
  onSample?: (t: number, bac: number) => void,
): { bac: number; eliminated: number; t: number } {
  const perGram = bacPerGram(profile);
  const perStep = (profile.eliminationRate * STEP_MS) / HOUR;
  const start = doses[0].at;

  let eliminated = 0;
  let bac = 0;
  let t = start;

  onSample?.(t, 0);
  while (t < until) {
    t = Math.min(t + STEP_MS, until);
    const potential = absorbedGrams(doses, t, profile.absorptionMinutes) * perGram;
    eliminated = Math.min(eliminated + perStep, potential);
    bac = Math.max(0, potential - eliminated);
    onSample?.(t, bac);
  }
  return { bac, eliminated, t };
}

/**
 * BAC as a percentage (g/100 ml), e.g. `0.042`, at an arbitrary moment.
 *
 * The engine works in percent throughout because that is the unit the Widmark
 * equation is written in. Promille — ten times this — is a presentation
 * concern; see `shared/util/format.ts`.
 */
export function bacAt(drinks: readonly Drink[], profile: Profile, at: number): number {
  const doses = toDoses(drinks);
  if (!doses.length || at <= doses[0].at) return 0;
  return round(walk(doses, profile, at).bac);
}

/**
 * The moment BAC first returns to 0.00 after the last drink, or `null` when
 * there is nothing to burn off.
 */
export function soberAt(drinks: readonly Drink[], profile: Profile): number | null {
  const doses = toDoses(drinks);
  if (!doses.length) return null;

  const last = lastDoseEnd(doses);
  const deadline = last + MAX_PROJECTION_MS;
  const perGram = bacPerGram(profile);
  const perStep = (profile.eliminationRate * STEP_MS) / HOUR;

  let eliminated = 0;
  let t = doses[0].at;
  while (t < deadline) {
    t += STEP_MS;
    const potential = absorbedGrams(doses, t, profile.absorptionMinutes) * perGram;
    eliminated = Math.min(eliminated + perStep, potential);
    // Sober only counts once every drink has been absorbed and burned off.
    if (t > last && potential - eliminated <= 0.000_05) return t;
  }
  return deadline;
}

/**
 * Samples the curve into a fixed number of evenly spaced points.
 *
 * A constant sample count is what lets the chart morph between two states by
 * interpolating index-for-index.
 */
export function buildTimeline(
  drinks: readonly Drink[],
  profile: Profile,
  now: number,
  options: { readonly samples: number; readonly from?: number; readonly to?: number },
): BacTimeline {
  const doses = toDoses(drinks);
  const sober = doses.length ? soberAt(drinks, profile) : null;
  const from = options.from ?? (doses.length ? doses[0].at - 10 * MINUTE : now - HOUR);
  const to = options.to ?? Math.max(now + 30 * MINUTE, sober ?? now + HOUR);

  const samples = Math.max(2, options.samples);
  const step = (to - from) / (samples - 1);
  const wanted: number[] = [];
  for (let i = 0; i < samples; i++) wanted.push(from + i * step);

  if (!doses.length) {
    return {
      points: wanted.map((t) => ({ t, bac: 0 })),
      from,
      to,
      current: 0,
      peak: 0,
      peakAt: now,
      soberAt: null,
      rising: false,
    };
  }

  // Walk once at full resolution, picking off the samples as they go past.
  const curve: BacPoint[] = [];
  let cursor = 0;
  let previous: BacPoint = { t: doses[0].at, bac: 0 };
  let peak = 0;
  let peakAt = doses[0].at;

  const consume = (t: number, bac: number) => {
    if (bac > peak) {
      peak = bac;
      peakAt = t;
    }
    while (cursor < wanted.length && wanted[cursor] <= t) {
      curve.push({ t: wanted[cursor], bac: interpolate(previous, { t, bac }, wanted[cursor]) });
      cursor++;
    }
    previous = { t, bac };
  };

  walk(doses, profile, to, consume);
  while (cursor < wanted.length) {
    curve.push({ t: wanted[cursor], bac: previous.bac });
    cursor++;
  }

  const current = bacAt(drinks, profile, now);
  const soon = bacAt(drinks, profile, now + 5 * MINUTE);

  return {
    points: curve.map((p) => ({ t: p.t, bac: round(p.bac) })),
    from,
    to,
    current,
    peak: round(peak),
    peakAt,
    soberAt: current > 0 ? sober : null,
    rising: soon > current,
  };
}

function interpolate(a: BacPoint, b: BacPoint, t: number): number {
  if (b.t === a.t) return b.bac;
  const ratio = (t - a.t) / (b.t - a.t);
  return a.bac + (b.bac - a.bac) * ratio;
}

/** BAC is meaningless past three decimals; rounding keeps signals from churning. */
function round(bac: number): number {
  return Math.round(bac * 1000) / 1000;
}

export type SoberStatus = 'sober' | 'buzzed' | 'merry' | 'drunk' | 'wasted';

/**
 * Where each band stops, as a BAC percentage.
 *
 * Also the ceilings the drink planner offers as presets: "stay merry" is
 * exactly "stay under the top of the merry band", so the two can never drift
 * apart. `wasted` is open-ended and has no entry.
 */
export const STATUS_CEILING = { buzzed: 0.03, merry: 0.06, drunk: 0.12 } as const;

/** A band with an upper bound, so it can be used as a limit. */
export type CappedStatus = keyof typeof STATUS_CEILING;

/** Qualitative band used for colour and copy. */
export function statusFor(bac: number): SoberStatus {
  if (bac <= 0) return 'sober';
  if (bac < STATUS_CEILING.buzzed) return 'buzzed';
  if (bac < STATUS_CEILING.merry) return 'merry';
  if (bac < STATUS_CEILING.drunk) return 'drunk';
  return 'wasted';
}

/**
 * The highest BAC still ahead of you at `from`.
 *
 * Not the same as a timeline's `peak`, which looks at the whole session: a
 * night that already topped out at 1.20 ‰ an hour ago has that behind it, and
 * what matters when planning the next drink is only what is still to come.
 */
export function peakFrom(drinks: readonly Drink[], profile: Profile, from: number): number {
  const doses = toDoses(drinks);
  if (!doses.length) return 0;

  const settled = lastDoseEnd(doses) + ABSORPTION_TAIL * profile.absorptionMinutes * MINUTE;
  let peak = 0;
  walk(doses, profile, Math.max(from, settled), (t, bac) => {
    if (t >= from && bac > peak) peak = bac;
  });
  return round(peak);
}

/** A serving being considered but not yet logged. */
export interface PlannedDrink {
  readonly volumeMl: number;
  readonly abv: number;
  readonly durationMinutes: number;
}

/** What the planner works out about one prospective drink. */
export interface DrinkPlan {
  /** The ceiling being planned against, as a BAC percentage. */
  readonly limit: number;
  /** Highest BAC still ahead if nothing more is drunk. */
  readonly currentPeak: number;
  /** Earliest moment the drink fits under the limit; `now` when it already does. */
  readonly at: number;
  /** How far away that is, floored at zero. */
  readonly waitMs: number;
  /** Highest BAC still ahead if the drink is had at `at`. */
  readonly peak: number;
  /** False when no amount of waiting brings the drink under the limit. */
  readonly fits: boolean;
}

/**
 * Answers "when can I have this and still stay under X ‰?".
 *
 * Peaks are measured from `now` rather than from the drink, so a limit already
 * breached by what is on board reads as breached instead of as a wait that
 * would not help. Waiting can only ever lower the peak — a later dose lands on
 * a lower baseline and absorbs no faster, so `peak` is monotonic in `at` —
 * which is what makes the earliest fitting moment a binary search rather than
 * a minute-by-minute scan.
 */
export function planDrink(
  drinks: readonly Drink[],
  profile: Profile,
  planned: PlannedDrink,
  limit: number,
  now: number,
): DrinkPlan {
  const peakWith = (at: number) => peakFrom([...drinks, asDrink(planned, at)], profile, now);
  const shared = { limit, currentPeak: peakFrom(drinks, profile, now) };

  const immediate = peakWith(now);
  if (immediate <= limit) return { ...shared, at: now, waitMs: 0, peak: immediate, fits: true };

  // Once everything on board has burned off, waiting any longer changes nothing.
  const latest = Math.max(now, soberAt(drinks, profile) ?? now);
  const latestPeak = peakWith(latest);
  if (latestPeak > limit) {
    return { ...shared, at: latest, waitMs: latest - now, peak: latestPeak, fits: false };
  }

  let low = 1;
  let high = Math.ceil((latest - now) / MINUTE);
  while (low < high) {
    const mid = (low + high) >> 1;
    if (peakWith(now + mid * MINUTE) <= limit) high = mid;
    else low = mid + 1;
  }
  const at = now + low * MINUTE;
  return { ...shared, at, waitMs: at - now, peak: peakWith(at), fits: true };
}

/** Dresses a prospective serving up as a `Drink` so the engine can simulate it. */
function asDrink(planned: PlannedDrink, at: number): Drink {
  return {
    id: 'planned',
    consumedAt: at,
    volumeMl: planned.volumeMl,
    abv: planned.abv,
    durationMinutes: planned.durationMinutes,
    label: '',
    icon: '',
    createdAt: at,
    updatedAt: at,
    deleted: false,
    synced: false,
  };
}

/**
 * The shortest of `options` that brings the drink under the limit right now,
 * or `null` when none of them does.
 *
 * Taking longer over the same drink genuinely lowers the peak — the alcohol
 * arrives slower than it is burned off — so when a limit says "wait", drinking
 * it slowly is the other way to say yes. Candidates are the durations the UI
 * actually offers rather than a search, so the answer is always something the
 * user can tap.
 */
export function stretchToFit(
  drinks: readonly Drink[],
  profile: Profile,
  planned: PlannedDrink,
  limit: number,
  now: number,
  options: readonly number[],
): number | null {
  for (const durationMinutes of options) {
    if (durationMinutes <= planned.durationMinutes) continue;
    const stretched = asDrink({ ...planned, durationMinutes }, now);
    if (peakFrom([...drinks, stretched], profile, now) <= limit) return durationMinutes;
  }
  return null;
}
