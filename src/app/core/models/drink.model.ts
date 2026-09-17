/** A single logged drink. Timestamps are epoch milliseconds (UTC). */
export interface Drink {
  readonly id: string;
  /** When the drink was consumed — editable, so it can differ from `createdAt`. */
  readonly consumedAt: number;
  /** Served volume in millilitres. */
  readonly volumeMl: number;
  /** Alcohol by volume, as a percentage (5 === 5%). */
  readonly abv: number;
  /**
   * Minutes spent drinking it, counted from `consumedAt`. Zero means it went
   * down in one go, which is how every drink logged before this existed reads.
   */
  readonly durationMinutes: number;
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
export type DrinkDraft = Pick<
  Drink,
  'consumedAt' | 'volumeMl' | 'abv' | 'label' | 'icon' | 'durationMinutes'
>;

/** A one-tap shortcut in the "Log a drink" row. */
export interface DrinkPreset {
  readonly id: string;
  readonly label: string;
  readonly icon: string;
  readonly volumeMl: number;
  readonly abv: number;
  readonly durationMinutes: number;
}

/**
 * Identity of a shortcut, so re-adding the same drink moves it to the front of
 * the row instead of taking a second slot.
 */
export function presetKey(drink: Pick<Drink, 'label' | 'icon' | 'volumeMl' | 'abv'>): string {
  return [drink.label.trim().toLowerCase(), drink.icon, drink.volumeMl, drink.abv].join('|');
}

/** Sipping windows offered as chips, in minutes. Zero is "in one go". */
export const DURATION_PRESETS = [0, 15, 30, 45, 60, 120];

/** Minutes a custom drink is assumed to take when nothing says otherwise. */
export const DEFAULT_DRINK_DURATION = 30;
/** Nobody nurses one drink for half a day; this bounds the stored value. */
export const MAX_DRINK_DURATION = 240;
