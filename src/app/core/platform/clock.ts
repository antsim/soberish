import { DestroyRef, Injectable, inject, signal } from '@angular/core';

/** How often the UI re-reads "now". BAC moves ~0.00025% in that time. */
const TICK_MS = 15_000;

/**
 * A signal-shaped wall clock.
 *
 * Every BAC number in the app is a `computed()` off this, so the whole UI
 * decays on its own without any component owning a timer.
 */
@Injectable({ providedIn: 'root' })
export class Clock {
  readonly #now = signal(Date.now());
  /** Current epoch milliseconds, refreshed on a timer and on tab focus. */
  readonly now = this.#now.asReadonly();

  constructor() {
    const tick = () => this.#now.set(Date.now());
    const timer = setInterval(tick, TICK_MS);
    // A backgrounded tab throttles timers, so catch up the moment it returns.
    const onVisible = () => document.visibilityState === 'visible' && tick();
    document.addEventListener('visibilitychange', onVisible);

    inject(DestroyRef).onDestroy(() => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    });
  }

  /** Forces an immediate re-read, e.g. right after a drink is logged. */
  sync(): void {
    this.#now.set(Date.now());
  }
}
