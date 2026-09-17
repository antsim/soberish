import { Injectable, inject, signal } from '@angular/core';
import { DEFAULT_DRINK_DURATION, DrinkDraft, DrinkPreset, presetKey } from '../models/drink.model';
import { META_KEYS, SoberishDb } from '../storage/soberish-db';

/** How many custom drinks the quick-add row remembers. */
export const RECENT_DRINK_LIMIT = 5;

/**
 * The shortcuts behind "Log a drink": the last few drinks added through the
 * custom editor, most recent first.
 *
 * Kept out of `DrinksStore` on purpose — this is a preference about the row of
 * buttons, not session data, so the 24 h retention wipe must not touch it.
 */
@Injectable({ providedIn: 'root' })
export class RecentDrinksStore {
  readonly #db = inject(SoberishDb);
  readonly #recent = signal<readonly DrinkPreset[]>([]);

  readonly recent = this.#recent.asReadonly();

  async load(): Promise<void> {
    const stored = await this.#db.readMeta<unknown>(META_KEYS.recentDrinks);
    this.#recent.set(sanitize(stored));
  }

  /** Records a custom add, promoting a repeat to the front rather than duplicating it. */
  async remember(draft: DrinkDraft): Promise<void> {
    const entry = toPreset(draft);
    const next = [entry, ...this.#recent().filter((preset) => preset.id !== entry.id)].slice(
      0,
      RECENT_DRINK_LIMIT,
    );
    this.#recent.set(next);
    await this.#db.writeMeta(META_KEYS.recentDrinks, next);
  }
}

function toPreset(draft: DrinkDraft): DrinkPreset {
  const preset = {
    label: draft.label.trim() || 'Drink',
    icon: draft.icon,
    volumeMl: Math.round(draft.volumeMl),
    abv: draft.abv,
  };
  // Duration is deliberately not part of the key: the same pint taken slower is
  // the same shortcut, updated, not a second one cluttering the row.
  return { ...preset, id: presetKey(preset), durationMinutes: draft.durationMinutes };
}

/** Stored rows survive app updates, so nothing about their shape is assumed. */
function sanitize(stored: unknown): readonly DrinkPreset[] {
  if (!Array.isArray(stored)) return [];
  const presets: DrinkPreset[] = [];
  for (const row of stored) {
    if (!row || typeof row !== 'object') continue;
    const { id, label, icon, volumeMl, abv, durationMinutes } = row as Partial<DrinkPreset>;
    if (typeof id !== 'string' || typeof label !== 'string' || typeof icon !== 'string') continue;
    if (!Number.isFinite(volumeMl) || !Number.isFinite(abv)) continue;
    presets.push({
      id,
      label,
      icon,
      volumeMl: volumeMl as number,
      abv: abv as number,
      // A shortcut is a template for a drink not yet had, not a record of one,
      // so an older entry takes the current default rather than "in one go".
      durationMinutes: Number.isFinite(durationMinutes)
        ? (durationMinutes as number)
        : DEFAULT_DRINK_DURATION,
    });
  }
  return presets.slice(0, RECENT_DRINK_LIMIT);
}
