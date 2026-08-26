import { DestroyRef, Injectable, inject, signal } from '@angular/core';

/** Tracks browser connectivity as a signal. */
@Injectable({ providedIn: 'root' })
export class Connectivity {
  readonly #online = signal(navigator.onLine);
  readonly online = this.#online.asReadonly();

  constructor() {
    const update = () => this.#online.set(navigator.onLine);
    addEventListener('online', update);
    addEventListener('offline', update);
    inject(DestroyRef).onDestroy(() => {
      removeEventListener('online', update);
      removeEventListener('offline', update);
    });
  }
}
