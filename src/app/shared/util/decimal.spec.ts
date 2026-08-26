import { describe, expect, it } from 'vitest';
import { formatDecimalInput, parseDecimal } from './decimal';

describe('parseDecimal', () => {
  it('accepts either decimal separator', () => {
    expect(parseDecimal('4.7')).toBe(4.7);
    expect(parseDecimal('4,7')).toBe(4.7);
  });

  it('accepts plain integers', () => {
    expect(parseDecimal('330')).toBe(330);
    expect(parseDecimal('0')).toBe(0);
  });

  it('accepts a bare fraction, so ",5" means a half', () => {
    expect(parseDecimal(',5')).toBe(0.5);
    expect(parseDecimal('.5')).toBe(0.5);
  });

  it('tolerates surrounding whitespace', () => {
    expect(parseDecimal('  4,7  ')).toBe(4.7);
  });

  it('treats a trailing separator as the number so far, so typing is not interrupted', () => {
    expect(parseDecimal('4,')).toBe(4);
    expect(parseDecimal('4.')).toBe(4);
  });

  it('handles signs', () => {
    expect(parseDecimal('-3,5')).toBe(-3.5);
    expect(parseDecimal('+2,5')).toBe(2.5);
  });

  it('never silently turns a comma into a digit shift', () => {
    // The bug this replaces: <input type="number"> stripped the comma and
    // read "4,7" as 47 — ten times the alcohol, with no visible complaint.
    expect(parseDecimal('4,7')).toBe(4.7);
    // A stray second separator must not resurrect that shift either.
    expect(parseDecimal('4,7,')).toBeNull();
    expect(parseDecimal('4,7.')).toBeNull();
  });

  it('accepts space grouping, which is unambiguous', () => {
    // A non-breaking space is what Intl emits, so it has to round-trip.
    expect(parseDecimal('1 234,5')).toBe(1234.5);
    expect(parseDecimal('1 234,5')).toBe(1234.5);
  });

  it('rejects dot or comma grouping rather than guessing what it meant', () => {
    for (const text of ['1.234,5', '1,234.5']) {
      expect(parseDecimal(text), text).toBeNull();
    }
  });

  it('returns null for anything that is not yet a number', () => {
    for (const text of ['', '   ', ',', '.', '-', 'abc', '1e5', '--3', '3px']) {
      expect(parseDecimal(text), text).toBeNull();
    }
  });
});

describe('formatDecimalInput', () => {
  it('renders without group separators, so the result re-parses unambiguously', () => {
    const text = formatDecimalInput(1234.5, 1);
    expect(parseDecimal(text)).toBe(1234.5);
  });

  it('respects the requested precision', () => {
    expect(parseDecimal(formatDecimalInput(330.4, 0))).toBe(330);
    expect(parseDecimal(formatDecimalInput(4.75, 1))).toBe(4.8);
  });

  it('round-trips through parse for the values the editor produces', () => {
    for (const value of [0, 4.7, 5, 12, 40, 330, 568, 96]) {
      expect(parseDecimal(formatDecimalInput(value, 1)), `${value}`).toBe(value);
    }
  });

  it('is empty for a non-finite value', () => {
    expect(formatDecimalInput(Number.NaN)).toBe('');
  });
});
