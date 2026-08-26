import { describe, expect, it } from 'vitest';
import { LeaderboardEntry } from '../models/leaderboard.model';
import { projectBac } from './leaderboard.service';

const HOUR = 3_600_000;
const NOW = Date.UTC(2026, 0, 1, 22, 0, 0);

function entry(patch: Partial<LeaderboardEntry> = {}): LeaderboardEntry {
  return {
    userId: 'u1',
    displayName: 'Test',
    bac: 0.06,
    peakBac: 0.08,
    drinks: 4,
    measuredAt: NOW,
    soberAt: NOW + 4 * HOUR,
    ...patch,
  };
}

describe('projectBac', () => {
  it('returns the published value at the moment it was published', () => {
    expect(projectBac(entry(), NOW)).toBeCloseTo(0.06, 3);
  });

  it('decays linearly towards the published sober time', () => {
    expect(projectBac(entry(), NOW + 2 * HOUR)).toBeCloseTo(0.03, 3);
  });

  it('reaches zero at the sober time and stays there', () => {
    expect(projectBac(entry(), NOW + 4 * HOUR)).toBe(0);
    expect(projectBac(entry(), NOW + 9 * HOUR)).toBe(0);
  });

  it('treats a row with no sober time as sober', () => {
    expect(projectBac(entry({ soberAt: null }), NOW)).toBe(0);
  });

  it('does not extrapolate backwards past the measurement', () => {
    expect(projectBac(entry(), NOW - HOUR)).toBeCloseTo(0.06, 3);
  });
});
