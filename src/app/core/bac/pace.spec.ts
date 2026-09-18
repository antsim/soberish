import { describe, expect, it } from 'vitest';
import { Drink } from '../models/drink.model';
import { DEFAULT_PROFILE, Profile } from '../models/profile.model';
import { HOUR, MINUTE, alcoholGrams, bacAt } from './bac';
import { PACE_HORIZON_MS, measurePace, projectAtPace } from './pace';

const NOW = Date.UTC(2026, 0, 1, 22, 0, 0);
const profile: Profile = { ...DEFAULT_PROFILE, weightKg: 80 };

/** A 330 ml / 5% beer — 13.0 g of ethanol. */
function beer(minutesAgo: number, overrides: Partial<Drink> = {}): Drink {
  const at = NOW - minutesAgo * MINUTE;
  return {
    id: `d${minutesAgo}`,
    consumedAt: at,
    volumeMl: 330,
    abv: 5,
    durationMinutes: 0,
    label: 'Beer',
    icon: '🍺',
    createdAt: at,
    updatedAt: at,
    deleted: false,
    synced: true,
    ...overrides,
  };
}

describe('measurePace', () => {
  it('says nothing from a single drink', () => {
    expect(measurePace([beer(30)], NOW)).toBeNull();
    expect(measurePace([], NOW)).toBeNull();
  });

  it('ignores drinks that have aged out of the window', () => {
    // 90-minute window: the two-hour-old pair is history.
    expect(measurePace([beer(120), beer(110)], NOW)).toBeNull();
  });

  it('ignores deleted and alcohol-free rows', () => {
    const drinks = [beer(60), beer(30, { deleted: true }), beer(20, { abv: 0 })];
    expect(measurePace(drinks, NOW)).toBeNull();
  });

  it('measures a steady rate as that rate', () => {
    // Three beers over 90 minutes is two an hour.
    const pace = measurePace([beer(90), beer(60), beer(30)], NOW);
    expect(pace).not.toBeNull();
    expect(pace!.drinks).toBe(3);
    expect(pace!.gramsPerHour).toBeCloseTo((3 * alcoholGrams(330, 5)) / 1.5, 5);
  });

  it('damps a fast opening instead of extrapolating panic', () => {
    // Two beers ten minutes apart is arithmetically twelve an hour. The
    // 45-minute floor on the denominator reports a believable number instead.
    const pace = measurePace([beer(10), beer(0)], NOW)!;
    const perHour = pace.gramsPerHour / pace.averageGrams;
    expect(perHour).toBeCloseTo(2 / 0.75, 5);
    expect(perHour).toBeLessThan(3);
  });

  it('reports the average serving it would repeat', () => {
    const drinks = [beer(60), beer(30, { volumeMl: 660 })];
    const pace = measurePace(drinks, NOW)!;
    expect(pace.averageGrams).toBeCloseTo((alcoholGrams(330, 5) + alcoholGrams(660, 5)) / 2, 6);
    expect(pace.averageAbv).toBeCloseTo(5, 6);
  });
});

describe('projectAtPace', () => {
  const steady = () => [beer(90), beer(60), beer(30)];

  it('says nothing without a measurable pace', () => {
    expect(projectAtPace([beer(30)], profile, NOW)).toBeNull();
  });

  it('projects above where stopping now would leave you', () => {
    const projection = projectAtPace(steady(), profile, NOW)!;
    // The whole point: this is not `bacIn()`. Stopping now means decay.
    const ifYouStopped = bacAt(steady(), profile, NOW + PACE_HORIZON_MS);
    expect(projection.bac).toBeGreaterThan(ifYouStopped);
    expect(projection.at).toBe(NOW + PACE_HORIZON_MS);
    expect(projection.moreDrinks).toBeGreaterThan(0);
  });

  it('lands somewhere a human would recognise', () => {
    // 80 kg, two beers an hour for two more hours, from three already drunk.
    const projection = projectAtPace(steady(), profile, NOW)!;
    expect(projection.bac).toBeGreaterThan(0.05);
    expect(projection.bac).toBeLessThan(0.15);
    expect(projection.status).toBe('drunk');
  });

  it('projects harder for a faster pace', () => {
    const slow = projectAtPace([beer(90), beer(30)], profile, NOW)!;
    const fast = projectAtPace([beer(90), beer(60), beer(30), beer(5)], profile, NOW)!;
    expect(fast.bac).toBeGreaterThan(slow.bac);
    expect(fast.moreDrinks).toBeGreaterThan(slow.moreDrinks);
  });

  it('carries the profile through, so a heavier drinker is projected lower', () => {
    const light = projectAtPace(steady(), { ...profile, weightKg: 55 }, NOW)!;
    const heavy = projectAtPace(steady(), { ...profile, weightKg: 110 }, NOW)!;
    expect(heavy.bac).toBeLessThan(light.bac);
  });

  it('respects tonight’s stomach state via absorption', () => {
    const quick = projectAtPace(steady(), { ...profile, absorptionMinutes: 27 }, NOW)!;
    const slow = projectAtPace(steady(), { ...profile, absorptionMinutes: 90 }, NOW)!;
    expect(quick.bac).toBeGreaterThan(slow.bac);
  });

  it('stays quiet when the trajectory goes nowhere', () => {
    // Two small alcohol-light drinks: a pace, but not one worth a sentence.
    const drinks = [beer(80, { volumeMl: 40, abv: 1 }), beer(40, { volumeMl: 40, abv: 1 })];
    expect(projectAtPace(drinks, profile, NOW)).toBeNull();
  });

  it('finds the moment a ceiling is crossed', () => {
    const projection = projectAtPace(steady(), profile, NOW, { limit: 0.06 })!;
    expect(projection.crossesAt).not.toBeNull();
    expect(projection.crossesAt!).toBeGreaterThan(NOW);
    expect(projection.crossesAt!).toBeLessThanOrEqual(NOW + PACE_HORIZON_MS);
    // Crossing must precede the horizon value that exceeds it.
    expect(projection.bac).toBeGreaterThan(0.06);
  });

  it('reports no crossing for a ceiling the night never reaches', () => {
    expect(projectAtPace(steady(), profile, NOW, { limit: 0.5 })!.crossesAt).toBeNull();
  });

  it('reports no crossing when there is no ceiling', () => {
    expect(projectAtPace(steady(), profile, NOW)!.crossesAt).toBeNull();
  });

  it('honours a shorter horizon', () => {
    const near = projectAtPace(steady(), profile, NOW, { horizonMs: HOUR })!;
    const far = projectAtPace(steady(), profile, NOW, { horizonMs: 3 * HOUR })!;
    expect(near.at).toBe(NOW + HOUR);
    expect(far.bac).toBeGreaterThan(near.bac);
  });

  it('bounds the work for an implausible pace', () => {
    const many = Array.from({ length: 12 }, (_, i) => beer(i * 5));
    const projection = projectAtPace(many, profile, NOW, { horizonMs: 12 * HOUR })!;
    expect(projection.moreDrinks).toBeLessThanOrEqual(20);
  });
});
