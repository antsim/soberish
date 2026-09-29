import { Drink } from '../models/drink.model';
import { Profile } from '../models/profile.model';
import { BacPoint, MINUTE, SoberStatus, buildTimeline, standardDrinks, statusFor } from './bac';

/**
 * Samples on the recap curve. Nothing morphs here, so unlike `CHART_SAMPLES`
 * this is only about smoothness — enough for a long night to keep its shape.
 */
export const RECAP_SAMPLES = 120;

/** Air either side of the night, so the curve starts and lands on the floor. */
const RECAP_MARGIN_MS = 15 * MINUTE;

/** One entry in the lineup strip — every drink, in the order it went down. */
export interface RecapDrink {
  readonly icon: string;
  readonly label: string;
  readonly at: number;
}

/** The drink that was ordered most often. */
export interface RecapFavourite {
  readonly icon: string;
  readonly label: string;
  readonly count: number;
}

/**
 * Everything the night recap card shows, frozen at the moment the session ended.
 *
 * BAC values are percentages like everywhere else in the engine; the card
 * converts to promille at the presentation boundary.
 */
export interface NightRecap {
  readonly startedAt: number;
  readonly endedAt: number;
  readonly durationMs: number;
  readonly peak: number;
  readonly peakAt: number;
  readonly peakStatus: SoberStatus;
  /** Standard drinks on the Finnish 12 g scale. */
  readonly units: number;
  readonly drinkCount: number;
  readonly volumeMl: number;
  /** The whole night, evenly sampled from `from` to `to`. */
  readonly points: readonly BacPoint[];
  readonly from: number;
  readonly to: number;
  readonly lineup: readonly RecapDrink[];
  readonly favourite: RecapFavourite | null;
}

/**
 * Summarises a finished session, or returns `null` when there is nothing to sum up.
 *
 * `endedAt` is the moment BAC returned to 0.00 ‰ — the caller decides whether
 * that moment has arrived, which keeps this free of any clock and lets the
 * result stay identical for the whole day the recap is on offer.
 */
export function buildRecap(
  drinks: readonly Drink[],
  profile: Profile,
  endedAt: number | null,
): NightRecap | null {
  const live = drinks.filter((drink) => !drink.deleted).sort((a, b) => a.consumedAt - b.consumedAt);
  if (endedAt === null || !live.length) return null;

  const startedAt = live[0].consumedAt;
  const from = startedAt - RECAP_MARGIN_MS;
  const to = Math.max(endedAt, startedAt) + RECAP_MARGIN_MS;
  const timeline = buildTimeline(live, profile, endedAt, { samples: RECAP_SAMPLES, from, to });

  return {
    startedAt,
    endedAt,
    durationMs: Math.max(0, endedAt - startedAt),
    peak: timeline.peak,
    peakAt: timeline.peakAt,
    peakStatus: statusFor(timeline.peak),
    units: live.reduce((sum, drink) => sum + standardDrinks(drink.volumeMl, drink.abv), 0),
    drinkCount: live.length,
    volumeMl: live.reduce((sum, drink) => sum + drink.volumeMl, 0),
    points: timeline.points,
    from,
    to,
    lineup: live.map((drink) => ({ icon: drink.icon, label: drink.label, at: drink.consumedAt })),
    favourite: favouriteOf(live),
  };
}

/**
 * The most repeated drink, or `null` when nothing was had twice.
 *
 * A single drink "of the night" out of a night of singles is not a finding,
 * just the first thing in the list. Ties go to whichever was started first.
 */
function favouriteOf(drinks: readonly Drink[]): RecapFavourite | null {
  const counts = new Map<string, RecapFavourite>();
  for (const drink of drinks) {
    const key = `${drink.icon}|${drink.label.trim().toLowerCase()}`;
    const seen = counts.get(key);
    counts.set(key, {
      icon: drink.icon,
      label: seen?.label ?? drink.label.trim(),
      count: (seen?.count ?? 0) + 1,
    });
  }
  let best: RecapFavourite | null = null;
  for (const candidate of counts.values()) {
    if (candidate.count > (best?.count ?? 1)) best = candidate;
  }
  return best;
}
