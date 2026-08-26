import { Drink } from '../models/drink.model';
import { LeaderboardEntry } from '../models/leaderboard.model';

/** Row shapes for the tables created by `supabase/schema.sql`. */
export interface DrinkRow {
  id: string;
  user_id: string;
  consumed_at: string;
  volume_ml: number;
  abv: number;
  label: string;
  icon: string;
  created_at: string;
  updated_at: string;
  deleted: boolean;
}

export interface BacStatusRow {
  user_id: string;
  display_name: string;
  bac: number;
  peak_bac: number;
  drinks: number;
  measured_at: string;
  sober_at: string | null;
}

export const TABLES = { drinks: 'drinks', status: 'bac_status' } as const;

export function toDrinkRow(drink: Drink, userId: string): DrinkRow {
  return {
    id: drink.id,
    user_id: userId,
    consumed_at: new Date(drink.consumedAt).toISOString(),
    volume_ml: drink.volumeMl,
    abv: drink.abv,
    label: drink.label,
    icon: drink.icon,
    created_at: new Date(drink.createdAt).toISOString(),
    updated_at: new Date(drink.updatedAt).toISOString(),
    deleted: drink.deleted,
  };
}

export function fromDrinkRow(row: DrinkRow): Drink {
  return {
    id: row.id,
    consumedAt: Date.parse(row.consumed_at),
    volumeMl: Number(row.volume_ml),
    abv: Number(row.abv),
    label: row.label,
    icon: row.icon,
    createdAt: Date.parse(row.created_at),
    updatedAt: Date.parse(row.updated_at),
    deleted: row.deleted,
    synced: true,
  };
}

export function fromStatusRow(row: BacStatusRow): LeaderboardEntry {
  return {
    userId: row.user_id,
    displayName: row.display_name,
    bac: Number(row.bac),
    peakBac: Number(row.peak_bac),
    drinks: Number(row.drinks),
    measuredAt: Date.parse(row.measured_at),
    soberAt: row.sober_at ? Date.parse(row.sober_at) : null,
  };
}
