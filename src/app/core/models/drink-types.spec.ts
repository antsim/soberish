import { DRINK_TYPES, drinkTypeFor, quickPresets, starterPresets } from './drink-types';

const NAMES = {
  beer: 'Beer',
  pint: 'Pint',
  wine: 'Wine',
  shot: 'Shot',
  cocktail: 'Cocktail',
  longDrink: 'Long drink',
  sparkling: 'Sparkling',
  cider: 'Cider',
  water: 'Water',
};

describe('drink types', () => {
  it('gives every icon a single type', () => {
    const icons = DRINK_TYPES.map((type) => type.icon);
    expect(new Set(icons).size).toBe(icons.length);
    expect(drinkTypeFor('🍷')?.volumeMl).toBe(120);
    expect(drinkTypeFor('🧉')).toBeUndefined();
  });

  it('starts a new install with named shortcuts', () => {
    const starters = starterPresets(NAMES);
    expect(starters.map((preset) => preset.label)).toEqual([
      'Beer',
      'Pint',
      'Wine',
      'Shot',
      'Long drink',
    ]);
  });

  it('puts the user’s own drinks first and never repeats a starter they already have', () => {
    const starters = starterPresets(NAMES);
    const own = { ...starters[2], durationMinutes: 60 };
    const custom = {
      id: 'x',
      label: 'IPA',
      icon: '🍺',
      volumeMl: 400,
      abv: 6,
      durationMinutes: 30,
    };
    const row = quickPresets([custom, own], starters, 6);
    expect(row.map((preset) => preset.label)).toEqual([
      'IPA',
      'Wine',
      'Beer',
      'Pint',
      'Shot',
      'Long drink',
    ]);
    expect(row[1].durationMinutes).toBe(60);
  });
});
