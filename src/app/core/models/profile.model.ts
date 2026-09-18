import { DEFAULT_LOCALE, Locale } from '../i18n/locale';

/** Widmark distribution ratios (litres of body water per kg of body mass). */
export const WIDMARK_R = { male: 0.68, female: 0.55, unspecified: 0.615 } as const;

export type BodyType = keyof typeof WIDMARK_R;
export type UnitSystem = 'metric' | 'imperial';

/**
 * How much food is in the way tonight, as a multiplier on absorption time.
 *
 * Food changes how *fast* alcohol reaches the blood, never how much of it gets
 * there — a full stomach spreads the same dose over a longer curve, so the
 * peak lands later and lower. `snack` is deliberately 1.0: a profile that has
 * never touched this setting keeps the exact curve it had before it existed.
 */
export const STOMACH_FACTOR = { empty: 0.6, snack: 1, full: 2 } as const;

export type StomachState = keyof typeof STOMACH_FACTOR;

export const STOMACH_STATES = Object.keys(STOMACH_FACTOR) as readonly StomachState[];

export const DEFAULT_STOMACH: StomachState = 'snack';

/**
 * Bounds on the *scaled* value. Wider than the profile slider's own range,
 * because scaling a calibrated baseline legitimately lands outside it.
 */
export const ABSORPTION_BOUNDS = { min: 15, max: 180 } as const;

export function isStomachState(value: unknown): value is StomachState {
  return typeof value === 'string' && value in STOMACH_FACTOR;
}

/** Minutes to ~95% absorption once tonight's stomach state is applied. */
export function absorptionMinutesFor(profile: Profile, stomach: StomachState): number {
  const scaled = Math.round(profile.absorptionMinutes * STOMACH_FACTOR[stomach]);
  return Math.min(ABSORPTION_BOUNDS.max, Math.max(ABSORPTION_BOUNDS.min, scaled));
}

/**
 * The profile the BAC maths should run on tonight.
 *
 * Returns the original object when nothing moved, so a `computed()` reading
 * this does not invalidate the whole chart on an unrelated profile edit.
 */
export function withStomach(profile: Profile, stomach: StomachState): Profile {
  const absorptionMinutes = absorptionMinutesFor(profile, stomach);
  return absorptionMinutes === profile.absorptionMinutes
    ? profile
    : { ...profile, absorptionMinutes };
}

/** Everything that shapes the BAC curve, plus presentation preferences. */
export interface Profile {
  /** Shown on the leaderboard when signed in. */
  readonly displayName: string;
  readonly weightKg: number;
  readonly bodyType: BodyType;
  /** BAC percentage points burned off per hour (0.015 % = 0.15 ‰). */
  readonly eliminationRate: number;
  /**
   * Minutes for a drink to be ~95% absorbed on a normal stomach — the personal
   * baseline that tonight's `StomachState` scales.
   */
  readonly absorptionMinutes: number;
  readonly units: UnitSystem;
  /** UI language. Defaults to the browser's until the user picks one. */
  readonly locale: Locale;
  /** Opt-in: publish live BAC to the leaderboard while signed in. */
  readonly shareToLeaderboard: boolean;
  readonly updatedAt: number;
}

export const DEFAULT_PROFILE: Profile = {
  displayName: '',
  weightKg: 80,
  bodyType: 'unspecified',
  eliminationRate: 0.015,
  absorptionMinutes: 45,
  units: 'metric',
  locale: DEFAULT_LOCALE,
  shareToLeaderboard: true,
  updatedAt: 0,
};

export const PROFILE_LIMITS = {
  weightKg: { min: 35, max: 250 },
  eliminationRate: { min: 0.01, max: 0.02, step: 0.001 },
  absorptionMinutes: { min: 15, max: 120, step: 5 },
} as const;
