import { Injectable, Injector, computed, effect, inject, untracked } from '@angular/core';
import { I18n } from '../i18n/i18n.service';
import { Clock } from '../platform/clock';
import { SystemNotifications } from '../platform/system-notifications';
import { DrinksStore } from '../state/drinks-store';
import { META_KEYS, SoberishDb } from '../storage/soberish-db';
import { NOTIFICATION_RULES, NotificationKind, dueNotices } from './notification-rules';
import { NotificationPrefsStore } from './notification-prefs-store';

/** Enough history to outlast any notice's grace window, small enough to never matter. */
const DELIVERED_CAP = 50;

/**
 * Turns the notification rules into notifications on screen.
 *
 * A signal effect off the shared clock rather than a timer per notice, so a
 * reminder survives reloads and edits without bookkeeping: every tick simply
 * asks the rules what is due. What has already been shown is persisted, which
 * is what makes "only once" hold across reloads too.
 *
 * Only runs while the page does. Delivering to a closed app needs Web Push,
 * which would slot in here behind the same rules.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  readonly #db = inject(SoberishDb);
  readonly #clock = inject(Clock);
  readonly #drinks = inject(DrinksStore);
  readonly #prefs = inject(NotificationPrefsStore);
  readonly #system = inject(SystemNotifications);
  readonly #i18n = inject(I18n);
  readonly #injector = inject(Injector);

  #delivered: readonly string[] = [];

  /** On in settings *and* allowed by the browser. */
  readonly active = computed(
    () => this.#prefs.enabled() && this.#system.permission() === 'granted',
  );

  async load(): Promise<void> {
    const stored = await this.#db.readMeta<unknown>(META_KEYS.notificationsDelivered);
    this.#delivered = Array.isArray(stored)
      ? stored.filter((key): key is string => typeof key === 'string')
      : [];
  }

  /** Called once during bootstrap. */
  start(): void {
    effect(
      () => {
        if (!this.active() || !this.#drinks.loaded()) return;
        const due = dueNotices(
          NOTIFICATION_RULES,
          { drinks: this.#drinks.drinks() },
          this.#clock.now(),
          { enabled: (kind) => this.#prefs.isOn(kind), delivered: new Set(this.#delivered) },
        );
        untracked(() => {
          for (const notice of due) {
            // Recorded before showing, so the next tick cannot race a slow
            // service worker into showing it twice.
            this.#markDelivered(notice.key);
            const { title, body } = notice.text(this.#i18n.messages());
            void this.#system.show(title, { body, tag: notice.key });
          }
        });
      },
      { injector: this.#injector },
    );
  }

  /**
   * Switches notifications on, asking the browser first when it has not been
   * asked yet. Resolves to whether they ended up on.
   */
  async enable(): Promise<boolean> {
    const permission =
      this.#system.permission() === 'default'
        ? await this.#system.request()
        : this.#system.permission();
    const granted = permission === 'granted';
    await this.#prefs.setEnabled(granted);
    return granted;
  }

  disable(): Promise<void> {
    return this.#prefs.setEnabled(false);
  }

  setKind(kind: NotificationKind, on: boolean): Promise<void> {
    return this.#prefs.setKind(kind, on);
  }

  #markDelivered(key: string): void {
    this.#delivered = [...this.#delivered, key].slice(-DELIVERED_CAP);
    void this.#db.writeMeta(META_KEYS.notificationsDelivered, this.#delivered);
  }
}
