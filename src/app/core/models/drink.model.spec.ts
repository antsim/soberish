import { describe, expect, it } from 'vitest';
import { Drink, isDisposableTombstone } from './drink.model';

function drink(patch: Partial<Drink>): Drink {
  return {
    id: 'a',
    consumedAt: 0,
    volumeMl: 330,
    abv: 5,
    durationMinutes: 0,
    stomach: 'snack',
    label: 'Beer',
    icon: '🍺',
    createdAt: 0,
    updatedAt: 0,
    deleted: true,
    synced: false,
    ...patch,
  };
}

describe('isDisposableTombstone', () => {
  it('never drops a live drink', () => {
    expect(isDisposableTombstone(drink({ deleted: false, onServer: false }), true)).toBe(false);
  });

  it('drops every tombstone when there is no server', () => {
    expect(isDisposableTombstone(drink({ onServer: true }), true)).toBe(true);
    expect(isDisposableTombstone(drink({}), true)).toBe(true);
  });

  it('drops a tombstone that never reached the server', () => {
    expect(isDisposableTombstone(drink({ onServer: false }), false)).toBe(true);
  });

  it('keeps a tombstone the server still has to hear about', () => {
    expect(isDisposableTombstone(drink({ onServer: true }), false)).toBe(false);
  });

  it('keeps a pre-existing tombstone whose history is unknown', () => {
    expect(isDisposableTombstone(drink({}), false)).toBe(false);
  });
});
