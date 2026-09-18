import { describe, expect, it } from 'vitest';
import {
  ABSORPTION_BOUNDS,
  DEFAULT_PROFILE,
  DEFAULT_STOMACH,
  PROFILE_LIMITS,
  Profile,
  STOMACH_STATES,
  absorptionMinutesFor,
  isStomachState,
  withStomach,
} from './profile.model';

const profile = (absorptionMinutes: number): Profile => ({
  ...DEFAULT_PROFILE,
  absorptionMinutes,
});

describe('stomach state', () => {
  it('leaves the baseline alone on the default state', () => {
    // Anyone who never touches this must keep the curve they already had.
    expect(absorptionMinutesFor(profile(45), DEFAULT_STOMACH)).toBe(45);
  });

  it('speeds absorption up on an empty stomach and slows it after a meal', () => {
    expect(absorptionMinutesFor(profile(45), 'empty')).toBe(27);
    expect(absorptionMinutesFor(profile(45), 'full')).toBe(90);
  });

  it('scales the user’s own baseline rather than replacing it', () => {
    // A calibrated slider still counts: two people on "full" land elsewhere.
    expect(absorptionMinutesFor(profile(30), 'full')).toBe(60);
    expect(absorptionMinutesFor(profile(60), 'full')).toBe(120);
  });

  it('keeps every combination of slider and state inside the bounds', () => {
    for (const state of STOMACH_STATES) {
      for (let base = PROFILE_LIMITS.absorptionMinutes.min; base <= 120; base += 5) {
        const minutes = absorptionMinutesFor(profile(base), state);
        expect(minutes).toBeGreaterThanOrEqual(ABSORPTION_BOUNDS.min);
        expect(minutes).toBeLessThanOrEqual(ABSORPTION_BOUNDS.max);
      }
    }
  });

  it('returns the same profile object when nothing moved', () => {
    // Identity matters: a new object here would invalidate the whole chart.
    const original = profile(45);
    expect(withStomach(original, DEFAULT_STOMACH)).toBe(original);
  });

  it('touches only the absorption field', () => {
    const original = profile(45);
    expect(withStomach(original, 'full')).toEqual({ ...original, absorptionMinutes: 90 });
  });

  it('recognises stored states and rejects anything else', () => {
    expect(isStomachState('full')).toBe(true);
    expect(isStomachState('stuffed')).toBe(false);
    expect(isStomachState(undefined)).toBe(false);
    expect(isStomachState(2)).toBe(false);
  });
});
