import { DrinkPreset, presetKey } from './drink.model';

/**
 * What an icon in the editor stands for: a kind of drink with the pour a Finnish
 * bar would hand over. Picking one fills size, strength and pace in, so the
 * icon row is the fast way to describe a drink rather than decoration.
 */
export interface DrinkType {
  readonly key: DrinkTypeKey;
  readonly icon: string;
  readonly volumeMl: number;
  readonly abv: number;
  readonly durationMinutes: number;
}

export type DrinkTypeKey =
  'beer' | 'pint' | 'wine' | 'shot' | 'cocktail' | 'longDrink' | 'sparkling' | 'cider' | 'water';

export const DRINK_TYPES: readonly DrinkType[] = [
  { key: 'beer', icon: '🍺', volumeMl: 330, abv: 4.7, durationMinutes: 30 },
  { key: 'pint', icon: '🍻', volumeMl: 500, abv: 4.7, durationMinutes: 45 },
  { key: 'wine', icon: '🍷', volumeMl: 120, abv: 12.5, durationMinutes: 30 },
  { key: 'shot', icon: '🥃', volumeMl: 40, abv: 40, durationMinutes: 0 },
  { key: 'cocktail', icon: '🍸', volumeMl: 160, abv: 15, durationMinutes: 30 },
  { key: 'longDrink', icon: '🍹', volumeMl: 330, abv: 5.5, durationMinutes: 30 },
  { key: 'sparkling', icon: '🥂', volumeMl: 120, abv: 11.5, durationMinutes: 30 },
  { key: 'cider', icon: '🍎', volumeMl: 330, abv: 4.7, durationMinutes: 30 },
  { key: 'water', icon: '💧', volumeMl: 330, abv: 0, durationMinutes: 15 },
];

/** Icons with no pour of their own: they label a drink without describing it. */
export const PLAIN_ICONS: readonly string[] = ['🧉'];

/** The shortcuts a brand-new install starts with, before it has any history. */
const STARTER_KEYS: readonly DrinkTypeKey[] = ['beer', 'pint', 'wine', 'shot', 'longDrink'];

export function drinkTypeFor(icon: string): DrinkType | undefined {
  return DRINK_TYPES.find((type) => type.icon === icon);
}

export function starterPresets(names: Record<DrinkTypeKey, string>): readonly DrinkPreset[] {
  return STARTER_KEYS.map((key) => {
    const type = DRINK_TYPES.find((candidate) => candidate.key === key)!;
    const preset = { label: names[key], icon: type.icon, volumeMl: type.volumeMl, abv: type.abv };
    return { ...preset, id: presetKey(preset), durationMinutes: type.durationMinutes };
  });
}

/**
 * The quick-add row: the user's own drinks first, padded out with starters
 * they have not already made their own.
 */
export function quickPresets(
  recent: readonly DrinkPreset[],
  starters: readonly DrinkPreset[],
  limit: number,
): readonly DrinkPreset[] {
  const taken = new Set(recent.map((preset) => preset.id));
  return [...recent, ...starters.filter((preset) => !taken.has(preset.id))].slice(0, limit);
}
