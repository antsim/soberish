import { describe, expect, it } from 'vitest';
import { Drink } from '../models/drink.model';
import { DEFAULT_PROFILE, Profile } from '../models/profile.model';
import { formatPermille, toPermille } from '../../shared/util/format';
import {
  HOUR,
  MINUTE,
  STATUS_CEILING,
  alcoholGrams,
  bacAt,
  buildTimeline,
  peakFrom,
  planDrink,
  stretchToFit,
  soberAt,
  standardDrinks,
  statusFor,
} from './bac';

const T0 = Date.UTC(2026, 0, 1, 20, 0, 0);

const profile: Profile = {
  ...DEFAULT_PROFILE,
  weightKg: 80,
  bodyType: 'male',
  eliminationRate: 0.015,
  absorptionMinutes: 45,
};

function drink(offsetMs: number, volumeMl: number, abv: number, durationMinutes = 0): Drink {
  return {
    id: `d${offsetMs}-${volumeMl}`,
    consumedAt: T0 + offsetMs,
    volumeMl,
    abv,
    durationMinutes,
    label: 'Test',
    icon: '🍺',
    createdAt: T0 + offsetMs,
    updatedAt: T0 + offsetMs,
    deleted: false,
    synced: true,
  };
}

describe('alcoholGrams', () => {
  it('applies ethanol density', () => {
    expect(alcoholGrams(330, 5)).toBeCloseTo(13.02, 2);
  });

  it('treats an alcohol-free drink as zero', () => {
    expect(alcoholGrams(330, 0)).toBe(0);
  });

  it('counts a 330 ml 5% beer as ~1.3 standard drinks', () => {
    expect(standardDrinks(330, 5)).toBeCloseTo(1.3, 1);
  });
});

describe('bacAt', () => {
  it('is zero before the first drink', () => {
    expect(bacAt([drink(0, 330, 5)], profile, T0 - MINUTE)).toBe(0);
  });

  it('is still near zero the instant a drink is logged', () => {
    expect(bacAt([drink(0, 330, 5)], profile, T0)).toBe(0);
  });

  it('approaches the Widmark peak once absorbed, minus what has burned off', () => {
    // 13.02 g / (80 kg × 0.68) → 0.0239%, less ~1 h of elimination at 0.015.
    const bac = bacAt([drink(0, 330, 5)], profile, T0 + HOUR);
    expect(bac).toBeGreaterThan(0.006);
    expect(bac).toBeLessThan(0.012);
  });

  it('never goes negative once everything has burned off', () => {
    expect(bacAt([drink(0, 330, 5)], profile, T0 + 12 * HOUR)).toBe(0);
  });

  it('scales inversely with body mass', () => {
    const light = bacAt([drink(0, 500, 5)], profile, T0 + HOUR);
    const heavy = bacAt([drink(0, 500, 5)], { ...profile, weightKg: 120 }, T0 + HOUR);
    expect(heavy).toBeLessThan(light);
  });

  it('adds up across a session', () => {
    const one = bacAt([drink(0, 500, 5)], profile, T0 + 2 * HOUR);
    const three = bacAt(
      [drink(0, 500, 5), drink(30 * MINUTE, 500, 5), drink(HOUR, 500, 5)],
      profile,
      T0 + 2 * HOUR,
    );
    expect(three).toBeGreaterThan(one * 2);
  });

  it('ignores deleted drinks', () => {
    const deleted = { ...drink(0, 500, 5), deleted: true };
    expect(bacAt([deleted], profile, T0 + HOUR)).toBe(0);
  });
});

describe('soberAt', () => {
  it('is null with no drinks', () => {
    expect(soberAt([], profile)).toBeNull();
  });

  it('lands after the last drink, with BAC back at zero', () => {
    const drinks = [drink(0, 500, 5), drink(HOUR, 500, 5)];
    const sober = soberAt(drinks, profile)!;
    expect(sober).toBeGreaterThan(T0 + HOUR);
    expect(bacAt(drinks, profile, sober)).toBe(0);
    expect(bacAt(drinks, profile, sober - 30 * MINUTE)).toBeGreaterThan(0);
  });

  it('moves later when another drink is added', () => {
    const first = soberAt([drink(0, 500, 5)], profile)!;
    const second = soberAt([drink(0, 500, 5), drink(HOUR, 500, 5)], profile)!;
    expect(second).toBeGreaterThan(first);
  });

  it('comes sooner for a faster metaboliser', () => {
    const slow = soberAt([drink(0, 500, 5)], { ...profile, eliminationRate: 0.01 })!;
    const fast = soberAt([drink(0, 500, 5)], { ...profile, eliminationRate: 0.02 })!;
    expect(fast).toBeLessThan(slow);
  });
});

describe('buildTimeline', () => {
  const drinks = [drink(0, 500, 5), drink(45 * MINUTE, 40, 40)];

  it('always returns the requested number of samples', () => {
    for (const samples of [2, 40, 160]) {
      expect(buildTimeline(drinks, profile, T0 + HOUR, { samples }).points).toHaveLength(samples);
    }
  });

  it('produces a strictly increasing, evenly spaced time axis', () => {
    const { points } = buildTimeline(drinks, profile, T0 + HOUR, { samples: 50 });
    const gaps = points.slice(1).map((p, i) => p.t - points[i].t);
    expect(Math.min(...gaps)).toBeGreaterThan(0);
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThan(1);
  });

  it('reports a peak at least as high as the current value', () => {
    const timeline = buildTimeline(drinks, profile, T0 + HOUR, { samples: 80 });
    expect(timeline.peak).toBeGreaterThanOrEqual(timeline.current);
    expect(timeline.peakAt).toBeGreaterThanOrEqual(T0);
  });

  it('flags a rising curve right after a drink and a falling one hours later', () => {
    expect(buildTimeline(drinks, profile, T0 + 5 * MINUTE, { samples: 20 }).rising).toBe(true);
    expect(buildTimeline(drinks, profile, T0 + 4 * HOUR, { samples: 20 }).rising).toBe(false);
  });

  it('has no sober time once the drinker is already sober', () => {
    expect(buildTimeline(drinks, profile, T0 + 24 * HOUR, { samples: 20 }).soberAt).toBeNull();
  });

  it('degrades to a flat line with no drinks', () => {
    const timeline = buildTimeline([], profile, T0, { samples: 30 });
    expect(timeline.points.every((point) => point.bac === 0)).toBe(true);
    expect(timeline.current).toBe(0);
    expect(timeline.soberAt).toBeNull();
  });
});

describe('statusFor', () => {
  it('maps BAC onto bands', () => {
    expect(statusFor(0)).toBe('sober');
    expect(statusFor(0.02)).toBe('buzzed');
    expect(statusFor(0.05)).toBe('merry');
    expect(statusFor(0.09)).toBe('drunk');
    expect(statusFor(0.2)).toBe('wasted');
  });
});

describe('promille presentation', () => {
  it('is ten times the BAC percentage', () => {
    expect(toPermille(0.05)).toBeCloseTo(0.5, 6);
    expect(toPermille(0.1)).toBeCloseTo(1, 6);
    expect(toPermille(0)).toBe(0);
  });

  it('renders two decimals, matching the engine’s three decimals of a percent', () => {
    expect(formatPermille(0.082)).toBe('0.82');
    expect(formatPermille(0.1)).toBe('1.00');
    expect(formatPermille(0.001)).toBe('0.01');
    expect(formatPermille(0)).toBe('0.00');
  });

  it('loses nothing the engine actually resolves', () => {
    // bacAt() rounds to 0.001% — exactly one unit in the last displayed place.
    const drinks = [drink(0, 500, 5)];
    const bac = bacAt(drinks, profile, T0 + 90 * MINUTE);
    expect(formatPermille(bac)).toBe((bac * 10).toFixed(2));
  });
});

describe('peakFrom', () => {
  it('sees a peak that is still ahead', () => {
    const drinks = [drink(0, 500, 5)];
    expect(peakFrom(drinks, profile, T0)).toBeGreaterThan(bacAt(drinks, profile, T0 + MINUTE));
  });

  it('ignores a peak already behind you', () => {
    const drinks = [drink(0, 500, 5)];
    const later = T0 + 2 * HOUR;
    expect(peakFrom(drinks, profile, later)).toBeCloseTo(bacAt(drinks, profile, later), 3);
  });

  it('is zero with nothing logged', () => {
    expect(peakFrom([], profile, T0)).toBe(0);
  });
});

describe('planDrink', () => {
  const pint = { volumeMl: 500, abv: 5, durationMinutes: 0 };

  it('waves through a drink that stays under the limit', () => {
    const plan = planDrink([], profile, pint, STATUS_CEILING.merry, T0);
    expect(plan.fits).toBe(true);
    expect(plan.waitMs).toBe(0);
    expect(plan.peak).toBeLessThanOrEqual(STATUS_CEILING.merry);
  });

  it('names the earliest moment a drink fits, and it really does fit', () => {
    const drinks = [drink(0, 500, 5), drink(10 * MINUTE, 500, 5)];
    const now = T0 + 30 * MINUTE;
    const plan = planDrink(drinks, profile, pint, STATUS_CEILING.merry, now);

    expect(plan.fits).toBe(true);
    expect(plan.waitMs).toBeGreaterThan(0);
    expect(plan.peak).toBeLessThanOrEqual(STATUS_CEILING.merry);
    // A minute earlier would not have fitted, or it was not the earliest.
    const earlier = peakFrom(
      [...drinks, { ...drink(0, pint.volumeMl, pint.abv), consumedAt: plan.at - MINUTE }],
      profile,
      now,
    );
    expect(earlier).toBeGreaterThan(STATUS_CEILING.merry);
  });

  it('never suggests a peak higher than drinking it right now', () => {
    const drinks = [drink(0, 500, 5)];
    const now = T0 + 20 * MINUTE;
    const limit = STATUS_CEILING.buzzed;
    const plan = planDrink(drinks, profile, pint, limit, now);
    const immediate = peakFrom(
      [...drinks, { ...drink(0, pint.volumeMl, pint.abv), consumedAt: now }],
      profile,
      now,
    );
    expect(plan.peak).toBeLessThanOrEqual(immediate);
  });

  it('gives up when the drink alone clears the limit', () => {
    const plan = planDrink(
      [],
      profile,
      { volumeMl: 500, abv: 40, durationMinutes: 0 },
      STATUS_CEILING.buzzed,
      T0,
    );
    expect(plan.fits).toBe(false);
    expect(plan.currentPeak).toBe(0);
    expect(plan.peak).toBeGreaterThan(STATUS_CEILING.buzzed);
  });

  it('gives up when the night is already over the limit', () => {
    const drinks = [drink(0, 500, 12), drink(15 * MINUTE, 500, 12), drink(30 * MINUTE, 500, 12)];
    const plan = planDrink(drinks, profile, pint, STATUS_CEILING.buzzed, T0 + 45 * MINUTE);
    expect(plan.fits).toBe(false);
    expect(plan.currentPeak).toBeGreaterThan(STATUS_CEILING.buzzed);
  });

  it('waits no longer than it takes to sober up', () => {
    const drinks = [drink(0, 500, 5)];
    const now = T0 + 10 * MINUTE;
    const plan = planDrink(drinks, profile, pint, STATUS_CEILING.buzzed, now);
    const sober = soberAt(drinks, profile)!;
    expect(plan.at).toBeLessThanOrEqual(sober);
  });
});

describe('drink duration', () => {
  const instant = [drink(0, 500, 5)];
  const sipped = [drink(0, 500, 5, 30)];

  it('spreads the same alcohol to a lower, later peak', () => {
    expect(peakFrom(sipped, profile, T0)).toBeLessThan(peakFrom(instant, profile, T0));

    const fast = buildTimeline(instant, profile, T0, { samples: 400 });
    const slow = buildTimeline(sipped, profile, T0, { samples: 400 });
    expect(slow.peakAt).toBeGreaterThan(fast.peakAt);
  });

  it('is behind the instant curve while the glass is still full', () => {
    // Ten minutes in, two thirds of a sipped pint is still in the glass.
    expect(bacAt(sipped, profile, T0 + 10 * MINUTE)).toBeLessThan(
      bacAt(instant, profile, T0 + 10 * MINUTE),
    );
  });

  it('has no kink where the last sip lands', () => {
    // The two halves of the closed form have to meet exactly at t = duration,
    // or the curve steps and the chart shows a notch.
    const around = [-2, -1, 0, 1, 2].map((offset) =>
      bacAt(sipped, profile, T0 + (30 + offset) * MINUTE),
    );
    const steps = around.slice(1).map((value, index) => value - around[index]);
    for (const step of steps) expect(Math.abs(step)).toBeLessThan(0.0015);
  });

  it('rises the whole time the drink is being drunk', () => {
    let previous = 0;
    for (let minute = 1; minute <= 30; minute++) {
      const bac = bacAt(sipped, profile, T0 + minute * MINUTE);
      expect(bac).toBeGreaterThanOrEqual(previous);
      previous = bac;
    }
  });

  it('never sobers up mid-sip', () => {
    const marathon = [drink(0, 500, 5, 180)];
    expect(soberAt(marathon, profile)!).toBeGreaterThan(T0 + 180 * MINUTE);
  });

  it('barely moves when you sober up — the total decides that, not the pace', () => {
    // Both curves absorb the same alcohol and burn it at the same flat rate, so
    // the finish line hardly shifts. The few minutes it does slip are the ones
    // at the very start, where there is not yet enough in the blood to burn.
    const delay = soberAt(sipped, profile)! - soberAt(instant, profile)!;
    expect(delay).toBeGreaterThanOrEqual(0);
    expect(delay).toBeLessThan(10 * MINUTE);
  });

  it('leaves a drink taken in one go exactly as it was', () => {
    expect(peakFrom([drink(0, 500, 5, 0)], profile, T0)).toBe(peakFrom(instant, profile, T0));
    expect(soberAt([drink(0, 500, 5, 0)], profile)).toBe(soberAt(instant, profile));
  });
});

describe('stretchToFit', () => {
  const options = [0, 15, 30, 45, 60, 120];
  const pint = { volumeMl: 500, abv: 5, durationMinutes: 0 };

  it('finds a window that really does bring the peak under the limit', () => {
    const minutes = stretchToFit([], profile, pint, 0.025, T0, options);
    expect(minutes).not.toBeNull();
    expect(peakFrom([drink(0, 500, 5, minutes!)], profile, T0)).toBeLessThanOrEqual(0.025);
  });

  it('returns the shortest window that works', () => {
    const minutes = stretchToFit([], profile, pint, 0.025, T0, options)!;
    const shorter = options.filter((option) => option > 0 && option < minutes);
    for (const option of shorter) {
      expect(peakFrom([drink(0, 500, 5, option)], profile, T0)).toBeGreaterThan(0.025);
    }
  });

  it('gives up when no offered window is slow enough', () => {
    expect(stretchToFit([], profile, pint, 0.001, T0, options)).toBeNull();
  });

  it('never suggests a window at or below the one already chosen', () => {
    const slow = { ...pint, durationMinutes: 120 };
    expect(stretchToFit([], profile, slow, 0.025, T0, options)).toBeNull();
  });
});

describe('planDrink with a duration', () => {
  it('asks for less of a wait than the same drink taken in one go', () => {
    const drinks = [drink(0, 500, 5), drink(10 * MINUTE, 500, 5)];
    const now = T0 + 30 * MINUTE;
    const fast = planDrink(
      drinks,
      profile,
      { volumeMl: 500, abv: 5, durationMinutes: 0 },
      STATUS_CEILING.merry,
      now,
    );
    const slow = planDrink(
      drinks,
      profile,
      { volumeMl: 500, abv: 5, durationMinutes: 60 },
      STATUS_CEILING.merry,
      now,
    );
    expect(slow.waitMs).toBeLessThan(fast.waitMs);
  });
});
