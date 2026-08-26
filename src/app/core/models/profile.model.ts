/** Widmark distribution ratios (litres of body water per kg of body mass). */
export const WIDMARK_R = { male: 0.68, female: 0.55, unspecified: 0.615 } as const;

export type BodyType = keyof typeof WIDMARK_R;
export type UnitSystem = 'metric' | 'imperial';

/** Everything that shapes the BAC curve, plus presentation preferences. */
export interface Profile {
  /** Shown on the leaderboard when signed in. */
  readonly displayName: string;
  readonly weightKg: number;
  readonly bodyType: BodyType;
  /** BAC percentage points burned off per hour. Typical range 0.010–0.020. */
  readonly eliminationRate: number;
  /** Minutes for a drink to be ~95% absorbed. Lower on an empty stomach. */
  readonly absorptionMinutes: number;
  readonly units: UnitSystem;
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
  shareToLeaderboard: true,
  updatedAt: 0,
};

export const PROFILE_LIMITS = {
  weightKg: { min: 35, max: 250 },
  eliminationRate: { min: 0.01, max: 0.02, step: 0.001 },
  absorptionMinutes: { min: 15, max: 120, step: 5 },
} as const;
