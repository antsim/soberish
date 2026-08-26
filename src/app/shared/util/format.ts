import { MINUTE } from '../../core/bac/bac';
import { UnitSystem } from '../../core/models/profile.model';

const ML_PER_OZ = 29.5735;
const KG_PER_LB = 0.453_592_37;

/** BAC always reads with three decimals — "0.042", never "0.04". */
export function formatBac(bac: number): string {
  return bac.toFixed(3);
}

/** "2h 15m", "45m", "just now". */
export function formatDuration(ms: number): string {
  if (ms < MINUTE) return 'just now';
  const totalMinutes = Math.round(ms / MINUTE);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) return `${minutes}m`;
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
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
