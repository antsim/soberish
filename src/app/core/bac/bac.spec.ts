import { describe, expect, it } from 'vitest';
import { Drink } from '../models/drink.model';
import { DEFAULT_PROFILE, Profile } from '../models/profile.model';
import {
  HOUR,
  MINUTE,
  alcoholGrams,
  bacAt,
  buildTimeline,
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

function drink(offsetMs: number, volumeMl: number, abv: number): Drink {
  return {
    id: `d${offsetMs}-${volumeMl}`,
    consumedAt: T0 + offsetMs,
    volumeMl,
    abv,
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
