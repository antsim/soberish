/**
 * A row published by a signed-in drinker, as stored in Supabase.
 *
 * `bac` and `peakBac` are BAC percentages (g/100 ml), matching the column
 * type; the UI renders them as promille. Keeping the wire format in percent
 * means rows published by older clients stay readable.
 */
export interface LeaderboardEntry {
  readonly userId: string;
  readonly displayName: string;
  /** BAC percentage at `measuredAt`. Multiply by 10 for promille. */
  readonly bac: number;
  readonly peakBac: number;
  readonly drinks: number;
  readonly measuredAt: number;
  /** Epoch ms at which the publisher projected they hit zero. */
  readonly soberAt: number | null;
}

/** A leaderboard row with its BAC extrapolated to "right now". */
export interface RankedEntry extends LeaderboardEntry {
  readonly rank: number;
  readonly liveBac: number;
  readonly isSelf: boolean;
}
