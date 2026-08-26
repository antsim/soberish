/**
 * Locale-tolerant parsing and formatting for free-text numeric fields.
 *
 * `<input type="number">` only ever accepts `.` as the decimal separator, and
 * it does not reject anything else — it *strips* it. Someone typing "4,7", as
 * most of Europe does, gets 47: ten times the alcohol, with no visible
 * complaint. So the app's numeric fields are plain text with
 * `inputmode="decimal"`, parsed here instead.
 */

/** Spaces, non-breaking spaces and apostrophes are all used as group separators. */
const SEPARATORS = /[\s\u00a0\u202f\u2007']/g;

/**
 * At most one decimal separator, and no digit grouping.
 *
 * Space grouping is fine — it is stripped above and "1 234,5" is unambiguous.
 * Dot and comma grouping is not supported: allowing it means guessing whether
 * "1.234" is one-point-two-three-four or one thousand two hundred and
 * thirty-four, and a stray extra separator ("4,7,") then reads as 47 — the
 * very digit shift this module exists to prevent. Nobody types a grouped
 * thousand into a drink size, so two separators is simply not a number yet,
 * and the field keeps its last good value.
 */
const NUMERIC = /^[+-]?(\d+([.,]\d*)?|[.,]\d+)$/;

/**
 * Reads a number written with either decimal separator — "4.7" or "4,7" —
 * returning `null` for anything that is not a number yet.
 *
 * Partial entries parse to what has been typed so far ("4," is 4), so a value
 * mid-keystroke never has to be rejected.
 */
export function parseDecimal(text: string): number | null {
  const cleaned = text.replace(SEPARATORS, '');
  if (!NUMERIC.test(cleaned)) return null;
  const value = Number(cleaned.replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

/**
 * Renders a number the way the reader's locale writes it — "4,7" in Finnish,
 * "4.7" in English.
 *
 * Grouping is off on purpose: "1.234" would otherwise be ambiguous between
 * one-point-two-three-four and one thousand two hundred and thirty-four.
 */
export function formatDecimalInput(value: number, maximumFractionDigits = 2): string {
  if (!Number.isFinite(value)) return '';
  return new Intl.NumberFormat(undefined, { useGrouping: false, maximumFractionDigits }).format(
    value,
  );
}
