/** A single logged drink. Timestamps are epoch milliseconds (UTC). */
export interface Drink {
  readonly id: string;
  /** When the drink was consumed — editable, so it can differ from `createdAt`. */
  readonly consumedAt: number;
  /** Served volume in millilitres. */
  readonly volumeMl: number;
  /** Alcohol by volume, as a percentage (5 === 5%). */
  readonly abv: number;
  /** Free-text label, usually the preset name ("Beer", "Wine"…). */
  readonly label: string;
  /** Emoji shown in the timeline. */
  readonly icon: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  /** Tombstone flag — rows are soft-deleted so the change can be synced. */
  readonly deleted: boolean;
  /** False while the row still has changes the server has not acknowledged. */
  readonly synced: boolean;
}

/** The user-supplied part of a drink; everything else is derived. */
export type DrinkDraft = Pick<Drink, 'consumedAt' | 'volumeMl' | 'abv' | 'label' | 'icon'>;

export interface DrinkPreset {
  readonly id: string;
  readonly label: string;
  readonly icon: string;
  readonly volumeMl: number;
  readonly abv: number;
}

/** One-tap presets, ordered by how often a night out needs them. */
export const DRINK_PRESETS: readonly DrinkPreset[] = [
  { id: 'beer-bottle', label: 'Beer', icon: '🍺', volumeMl: 330, abv: 4.7 },
  { id: 'beer-pint', label: 'Pint', icon: '🍻', volumeMl: 568, abv: 5 },
  { id: 'wine', label: 'Wine', icon: '🍷', volumeMl: 150, abv: 12 },
  { id: 'shot', label: 'Shot', icon: '🥃', volumeMl: 40, abv: 40 },
  { id: 'cider', label: 'Cider', icon: '🍎', volumeMl: 330, abv: 4.5 },
  { id: 'longdrink', label: 'Long drink', icon: '🍹', volumeMl: 330, abv: 5.5 },
  { id: 'sparkling', label: 'Bubbly', icon: '🥂', volumeMl: 120, abv: 12 },
  { id: 'nonalc', label: 'Alcohol-free', icon: '💧', volumeMl: 330, abv: 0 },
];
