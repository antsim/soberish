import { describe, expect, it } from 'vitest';
import { HOUR, MINUTE } from '../bac/bac';
import { sessionElapsed, sessionEnd } from './session-store';

const START = Date.UTC(2026, 0, 1, 20, 0, 0);
const SOBER = START + 6 * HOUR;

describe('sessionEnd', () => {
  it('is null while there is still alcohol on board', () => {
    expect(sessionEnd(SOBER, START + 2 * HOUR)).toBeNull();
  });

  it('is null with no drinks at all', () => {
    expect(sessionEnd(null, START)).toBeNull();
  });

  it('becomes the sober time the moment the clock reaches it', () => {
    expect(sessionEnd(SOBER, SOBER)).toBe(SOBER);
    expect(sessionEnd(SOBER, SOBER + MINUTE)).toBe(SOBER);
  });

  it('stays at the sober time however long ago that was', () => {
    expect(sessionEnd(SOBER, SOBER + 23 * HOUR)).toBe(SOBER);
  });
});

describe('sessionElapsed', () => {
  it('is zero before anything is logged', () => {
    expect(sessionElapsed(null, null, START)).toBe(0);
  });

  it('counts up while the session runs', () => {
    expect(sessionElapsed(START, null, START + 90 * MINUTE)).toBe(90 * MINUTE);
  });

  it('freezes at the session length once it has ended', () => {
    // The bug: this kept climbing for the 24 hours until the history was
    // wiped, so a 6h night read as "29h" the next morning.
    expect(sessionElapsed(START, SOBER, SOBER)).toBe(6 * HOUR);
    expect(sessionElapsed(START, SOBER, SOBER + 12 * HOUR)).toBe(6 * HOUR);
    expect(sessionElapsed(START, SOBER, SOBER + 23 * HOUR)).toBe(6 * HOUR);
  });

  it('never goes negative for a drink logged in the future', () => {
    expect(sessionElapsed(START, null, START - HOUR)).toBe(0);
  });
});
