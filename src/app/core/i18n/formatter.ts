import { UnitSystem } from '../models/profile.model';
import { Locale } from './locale';

/**
 * Every number and time of day on screen goes through one of these, so a
 * reading looks the same wherever it appears: "0,31 ‰", "4,7 %" and
 * "klo 00.15" in Finnish, "0.31 ‰", "4.7%" and "00:15" in English.
 *
 * Keyed by the language picked in the app rather than the browser's, so the
 * numbers always agree with the copy around them.
 */
export interface Formatter {
  /** A BAC percentage as promille, always two decimals. The ‰ sign is the caller's. */
  permille(bacPercent: number): string;
  /** A plain number with exactly `digits` decimals. */
  decimal(value: number, digits: number): string;
  /** Alcohol by volume with its percent sign, e.g. `4.7` → "4,7 %". */
  abv(percent: number): string;
  /** Time of day, 24-hour. */
  clock(timestamp: number): string;
  volume(ml: number, units: UnitSystem): string;
  weight(kg: number, units: UnitSystem): string;
}

const ML_PER_OZ = 29.5735;
const KG_PER_LB = 0.453_592_37;

/** en-GB rather than en-US: the app is 24-hour and metric-first in both languages. */
const INTL_TAG: Record<Locale, string> = { en: 'en-GB', fi: 'fi-FI' };

const cache = new Map<Locale, Formatter>();

export function formatterFor(locale: Locale): Formatter {
  let formatter = cache.get(locale);
  if (!formatter) cache.set(locale, (formatter = build(INTL_TAG[locale])));
  return formatter;
}

function build(tag: string): Formatter {
  const fixed = new Map<number, Intl.NumberFormat>();
  const decimal = (value: number, digits: number) => {
    let format = fixed.get(digits);
    if (!format) {
      format = new Intl.NumberFormat(tag, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
        useGrouping: false,
      });
      fixed.set(digits, format);
    }
    return format.format(value);
  };
  const loose = new Intl.NumberFormat(tag, { maximumFractionDigits: 2, useGrouping: false });
  const percent = new Intl.NumberFormat(tag, { style: 'percent', maximumFractionDigits: 2 });
  const clock = new Intl.DateTimeFormat(tag, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });

  return {
    // The engine rounds BAC to three decimals of a percent, which is exactly
    // two of a promille, so nothing is lost or invented here.
    permille: (bacPercent) => decimal(bacPercent * 10, 2),
    decimal,
    abv: (value) => percent.format(value / 100),
    clock: (timestamp) => clock.format(timestamp),
    volume: (ml, units) =>
      units === 'imperial'
        ? `${loose.format(Math.round((ml / ML_PER_OZ) * 10) / 10)} oz`
        : `${Math.round(ml)} ml`,
    weight: (kg, units) =>
      units === 'imperial' ? `${Math.round(kg / KG_PER_LB)} lb` : `${Math.round(kg)} kg`,
  };
}
