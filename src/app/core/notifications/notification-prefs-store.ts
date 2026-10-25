import { Injectable, computed, inject, signal } from '@angular/core';
import { META_KEYS, SoberishDb } from '../storage/soberish-db';
import { NotificationKind } from './notification-rules';

export interface NotificationPrefs {
  /** The master switch. Off until the user turns it on and the browser agrees. */
  readonly enabled: boolean;
  /** Per-kind opt-outs. A kind missing here is on, so new kinds arrive enabled. */
  readonly kinds: Readonly<Partial<Record<NotificationKind, boolean>>>;
}

const DEFAULT_PREFS: NotificationPrefs = { enabled: false, kinds: {} };

/**
 * Which notifications the user wants.
 *
 * Deliberately not part of `Profile`: writing it through `ProfileStore.patch`
 * would stamp `updatedAt`, which is what marks the body profile as confirmed.
 */
@Injectable({ providedIn: 'root' })
export class NotificationPrefsStore {
  readonly #db = inject(SoberishDb);
  readonly #prefs = signal<NotificationPrefs>(DEFAULT_PREFS);

  readonly prefs = this.#prefs.asReadonly();
  readonly enabled = computed(() => this.#prefs().enabled);

  async load(): Promise<void> {
    this.#prefs.set(sanitize(await this.#db.readMeta<unknown>(META_KEYS.notifications)));
  }

  isOn(kind: NotificationKind): boolean {
    return this.#prefs().kinds[kind] ?? true;
  }

  setEnabled(enabled: boolean): Promise<void> {
    return this.#write({ ...this.#prefs(), enabled });
  }

  setKind(kind: NotificationKind, on: boolean): Promise<void> {
    const prefs = this.#prefs();
    return this.#write({ ...prefs, kinds: { ...prefs.kinds, [kind]: on } });
  }

  async #write(next: NotificationPrefs): Promise<void> {
    this.#prefs.set(next);
    await this.#db.writeMeta(META_KEYS.notifications, next);
  }
}

/** Stored values survive app updates, so nothing about their shape is assumed. */
function sanitize(stored: unknown): NotificationPrefs {
  if (typeof stored !== 'object' || stored === null) return DEFAULT_PREFS;
  const { enabled, kinds } = stored as Partial<NotificationPrefs>;
  const cleanKinds = Object.fromEntries(
    Object.entries(typeof kinds === 'object' && kinds !== null ? kinds : {}).filter(
      ([, on]) => typeof on === 'boolean',
    ),
  );
  return { enabled: enabled === true, kinds: cleanKinds };
}
