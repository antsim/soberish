import { describe, expect, it } from 'vitest';
import { DRINK_TYPES } from '../models/drink-types';
import { KCAL_PER_ALCOHOL_GRAM, drinkKcal } from './energy';

const kcal = (icon: string, volumeMl: number, abv: number) => drinkKcal({ icon, volumeMl, abv });

describe('drinkKcal', () => {
  it('lands each default pour near what the label says', () => {
    // Label values for typical Finnish products, ±10 %.
    const label: Record<string, number> = {
      beer: 140,
      pint: 210,
      wine: 95,
      shot: 90,
      longDrink: 210,
      sparkling: 85,
      cider: 165,
      water: 0,
    };
    for (const type of DRINK_TYPES) {
      const expected = label[type.key];
      if (expected === undefined) continue;
      const actual = kcal(type.icon, type.volumeMl, type.abv);
      expect(actual, type.key).toBeGreaterThanOrEqual(expected * 0.9);
      expect(actual, type.key).toBeLessThanOrEqual(expected * 1.1 + 1);
    }
  });

  it('counts spirits as alcohol and nothing else', () => {
    // 40 ml at 40 % is 12.6 g of ethanol.
    expect(kcal('🥃', 40, 40)).toBeCloseTo(40 * 0.4 * 0.789 * KCAL_PER_ALCOHOL_GRAM, 10);
  });

  it('grows with both size and strength', () => {
    expect(kcal('🍺', 500, 4.7)).toBeGreaterThan(kcal('🍺', 330, 4.7));
    expect(kcal('🍺', 330, 8)).toBeGreaterThan(kcal('🍺', 330, 4.7));
  });

  it('still counts a sweet drink’s sugar when it has no alcohol', () => {
    expect(kcal('🍹', 330, 0)).toBeGreaterThan(100);
    expect(kcal('💧', 330, 0)).toBe(0);
  });

  it('guesses from strength when the icon names no kind of drink', () => {
    expect(kcal('🧉', 330, 4.7)).toBeCloseTo(kcal('🍺', 330, 4.7), 10);
    expect(kcal('🧉', 120, 12.5)).toBeCloseTo(kcal('🍷', 120, 12.5), 10);
    expect(kcal('🧉', 40, 40)).toBeCloseTo(kcal('🥃', 40, 40), 10);
    expect(kcal('🧉', 330, 0)).toBe(0);
  });
});
