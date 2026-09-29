import { describe, expect, it } from 'vitest';
import { Drink } from '../models/drink.model';
import { DEFAULT_PROFILE, Profile } from '../models/profile.model';
import { HOUR, MINUTE, buildTimeline, soberAt, standardDrinks, statusFor } from './bac';
import { RECAP_SAMPLES, buildRecap } from './recap';

const START = Date.UTC(2026, 0, 1, 20, 0, 0);
const profile: Profile = { ...DEFAULT_PROFILE, weightKg: 80 };

function drink(minutesIn: number, overrides: Partial<Drink> = {}): Drink {
  const at = START + minutesIn * MINUTE;
  return {
    id: `d${minutesIn}`,
    consumedAt: at,
    volumeMl: 330,
    abv: 5,
    durationMinutes: 0,
    stomach: 'snack',
    label: 'Beer',
    icon: '🍺',
    createdAt: at,
    updatedAt: at,
    deleted: false,
    synced: true,
    ...overrides,
  };
}

const night = [
  drink(0),
  drink(40),
  drink(90, { label: 'Wine', icon: '🍷', volumeMl: 120, abv: 12 }),
  drink(120),
];

describe('buildRecap', () => {
  it('has nothing to say before the night has ended', () => {
    expect(buildRecap(night, profile, null)).toBeNull();
  });

  it('has nothing to say without drinks', () => {
    expect(buildRecap([], profile, START)).toBeNull();
    expect(buildRecap([drink(0, { deleted: true })], profile, START + HOUR)).toBeNull();
  });

  it('spans the night from the first drink to the moment of sobriety', () => {
    const ended = soberAt(night, profile)!;
    const recap = buildRecap(night, profile, ended)!;
    expect(recap.startedAt).toBe(START);
    expect(recap.endedAt).toBe(ended);
    expect(recap.durationMs).toBe(ended - START);
    expect(recap.from).toBeLessThan(START);
    expect(recap.to).toBeGreaterThan(ended);
  });

  it('reports the same peak as the live chart did', () => {
    const ended = soberAt(night, profile)!;
    const recap = buildRecap(night, profile, ended)!;
    const live = buildTimeline(night, profile, START + HOUR, { samples: 160 });
    expect(recap.peak).toBe(live.peak);
    expect(recap.peakStatus).toBe(statusFor(recap.peak));
    expect(recap.peakStatus).not.toBe('sober');
    expect(recap.peakAt).toBeGreaterThan(START);
    expect(recap.peakAt).toBeLessThan(ended);
  });

  it('draws a curve that starts and lands at zero', () => {
    const ended = soberAt(night, profile)!;
    const { points } = buildRecap(night, profile, ended)!;
    expect(points).toHaveLength(RECAP_SAMPLES);
    expect(points[0].bac).toBe(0);
    expect(points.at(-1)!.bac).toBe(0);
    expect(Math.max(...points.map((p) => p.bac))).toBeGreaterThan(0);
  });

  it('counts units on the same 12 g scale as the tracker', () => {
    const ended = soberAt(night, profile)!;
    const recap = buildRecap(night, profile, ended)!;
    const expected = night.reduce((sum, d) => sum + standardDrinks(d.volumeMl, d.abv), 0);
    expect(recap.units).toBeCloseTo(expected, 10);
    expect(recap.drinkCount).toBe(4);
    expect(recap.volumeMl).toBe(330 * 3 + 120);
  });

  it('ignores deleted drinks', () => {
    const withTombstone = [...night, drink(150, { id: 'gone', deleted: true })];
    const ended = soberAt(night, profile)!;
    expect(buildRecap(withTombstone, profile, ended)!.drinkCount).toBe(4);
  });

  it('lines the drinks up in the order they went down', () => {
    const shuffled = [night[2], night[0], night[3], night[1]];
    const ended = soberAt(night, profile)!;
    const icons = buildRecap(shuffled, profile, ended)!.lineup.map((d) => d.icon);
    expect(icons).toEqual(['🍺', '🍺', '🍷', '🍺']);
  });

  it('names the most repeated drink as the drink of the night', () => {
    const ended = soberAt(night, profile)!;
    expect(buildRecap(night, profile, ended)!.favourite).toEqual({
      icon: '🍺',
      label: 'Beer',
      count: 3,
    });
  });

  it('treats differently cased names as the same drink', () => {
    const mixed = [drink(0), drink(30, { label: 'beer ' })];
    const ended = soberAt(mixed, profile)!;
    expect(buildRecap(mixed, profile, ended)!.favourite?.count).toBe(2);
  });

  it('names no favourite when nothing was had twice', () => {
    const singles = [drink(0), drink(30, { label: 'Wine', icon: '🍷' })];
    const ended = soberAt(singles, profile)!;
    expect(buildRecap(singles, profile, ended)!.favourite).toBeNull();
  });
});
