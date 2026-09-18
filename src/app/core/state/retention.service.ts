import { I18n } from '../i18n/i18n.service';
import { Injectable, Injector, effect, inject, untracked } from '@angular/core';
import { Clock } from '../platform/clock';
import { Toaster } from '../platform/toaster';
import { DrinksStore } from './drinks-store';
import { SessionStore } from './session-store';
import { StomachStore } from './stomach-store';

/**
 * Enforces the 24-hour rule: once the level has been back at 0.00 ‰ for a full day the
 * session — drinks and graph — is wiped.
 *
 * Drinking again before the deadline simply moves the projected sober time
 * forward, which pushes the deadline with it, so an ongoing night keeps its
 * history. The check is a signal effect rather than a timer, so it also fires
 * on reload and whenever the clock ticks the app back into view.
 */
@Injectable({ providedIn: 'root' })
export class RetentionService {
  readonly #session = inject(SessionStore);
  readonly #drinks = inject(DrinksStore);
  readonly #clock = inject(Clock);
  readonly #toaster = inject(Toaster);
  readonly #stomach = inject(StomachStore);
  readonly #i18n = inject(I18n);
  readonly #injector = inject(Injector);
  #running = false;

  /** Called once during bootstrap. */
  start(): void {
    effect(
      () => {
        const deadline = this.#session.retentionDeadline();
        const now = this.#clock.now();
        const ready = this.#session.ready();
        if (!ready || deadline === null || now < deadline) return;
        untracked(() => void this.#wipe());
      },
      { injector: this.#injector },
    );
  }

  async #wipe(): Promise<void> {
    if (this.#running || !this.#drinks.count()) return;
    this.#running = true;
    try {
      const cleared = this.#drinks.count();
      await this.#drinks.clear();
      // Last night's meal says nothing about the next one.
      await this.#stomach.reset();
      this.#toaster.show(this.#i18n.messages().toast.retentionWipe(cleared));
    } finally {
      this.#running = false;
    }
  }
}
