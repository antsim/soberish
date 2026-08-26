import { describe, expect, it } from 'vitest';
import { Drink } from '../models/drink.model';
import { merge } from './drink-sync.service';

function row(id: string, updatedAt: number, patch: Partial<Drink> = {}): Drink {
  return {
    id,
    consumedAt: updatedAt,
    volumeMl: 330,
    abv: 5,
    label: 'Beer',
    icon: '🍺',
    createdAt: updatedAt,
    updatedAt,
    deleted: false,
    synced: true,
    ...patch,
  };
}

describe('merge', () => {
  it('adds rows that only exist on the server', () => {
    expect(merge([], [row('a', 1)], [])).toHaveLength(1);
  });

  it('keeps the newer of two versions of the same row', () => {
    const merged = merge([row('a', 10, { abv: 5 })], [row('a', 20, { abv: 8 })], []);
    expect(merged).toHaveLength(1);
    expect(merged[0].abv).toBe(8);
  });

  it('keeps the local row when the server copy is older', () => {
    const merged = merge([row('a', 30, { abv: 5 })], [row('a', 20, { abv: 8 })], []);
    expect(merged[0].abv).toBe(5);
  });

  it('never lets a pull resurrect a drink deleted offline', () => {
    const pending = [row('a', 40, { deleted: true, synced: false })];
    const merged = merge(pending, [row('a', 50)], pending);
    expect(merged).toHaveLength(1);
    expect(merged[0].deleted).toBe(true);
  });

  it('drops server tombstones that nothing is waiting to push', () => {
    expect(merge([], [row('a', 10, { deleted: true })], [])).toHaveLength(0);
  });
});
