/** A row published by a signed-in drinker, as stored in Supabase. */
export interface LeaderboardEntry {
  readonly userId: string;
  readonly displayName: string;
  /** BAC percentage at `measuredAt`. */
  readonly bac: number;
  readonly peakBac: number;
  readonly drinks: number;
  readonly measuredAt: number;
  /** Epoch ms at which the publisher projected they hit 0.00%. */
  readonly soberAt: number | null;
}

/** A leaderboard row with its BAC extrapolated to "right now". */
export interface RankedEntry extends LeaderboardEntry {
  readonly rank: number;
  readonly liveBac: number;
  readonly isSelf: boolean;
}
