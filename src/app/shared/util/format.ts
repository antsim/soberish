import { MINUTE } from '../../core/bac/bac';
import { Messages } from '../../core/i18n/messages.en';
import { UnitSystem } from '../../core/models/profile.model';

const ML_PER_OZ = 29.5735;
const KG_PER_LB = 0.453_592_37;

/**
 * Promille (‰) is grams of alcohol per litre of blood — ten times the BAC
 * percentage (g/100 ml). Soberish computes and stores the percentage, because
 * that is the unit the Widmark equation and the `bac_status` table are written
 * in, and converts here at the presentation boundary.
 */
export const PERMILLE_PER_PERCENT = 10;

export function toPermille(bacPercent: number): number {
  return bacPercent * PERMILLE_PER_PERCENT;
}

export function fromPermille(permille: number): number {
  return permille / PERMILLE_PER_PERCENT;
}

/**
 * Promille always reads with two decimals — "1.20 ‰", never "1.2 ‰".
 *
 * The engine rounds BAC to three decimals of a percent, which is exactly two
 * decimals of a promille, so nothing is lost or invented by this conversion.
 */
export function formatPermille(bacPercent: number): string {
  return toPermille(bacPercent).toFixed(2);
}

/** Time of day, 24-hour, in the browser's own locale — "23:45". */
export function formatClock(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** "2h 15m", "45m", "just now" — with the unit suffixes of the active language. */
export function formatDuration(ms: number, words: Messages['time']): string {
  if (ms < MINUTE) return words.justNow;
  const totalMinutes = Math.round(ms / MINUTE);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const h = `${hours}${words.hourSuffix}`;
  const m = `${minutes}${words.minuteSuffix}`;
  if (!hours) return m;
  return minutes ? `${h} ${m}` : h;
}

export function mlToOz(ml: number): number {
  return ml / ML_PER_OZ;
}

export function ozToMl(oz: number): number {
  return oz * ML_PER_OZ;
}

export function kgToLb(kg: number): number {
  return kg / KG_PER_LB;
}

export function lbToKg(lb: number): number {
  return lb * KG_PER_LB;
}

export function formatVolume(ml: number, units: UnitSystem): string {
  return units === 'imperial' ? `${round(mlToOz(ml), 1)} oz` : `${Math.round(ml)} ml`;
}

export function formatWeight(kg: number, units: UnitSystem): string {
  return units === 'imperial' ? `${Math.round(kgToLb(kg))} lb` : `${Math.round(kg)} kg`;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
