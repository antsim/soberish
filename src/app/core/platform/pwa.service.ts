import { ApplicationRef, DestroyRef, Injectable, inject, signal } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { first } from 'rxjs/operators';
import { Toaster } from './toaster';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Owns "Add to Home Screen" and service-worker update prompts. */
@Injectable({ providedIn: 'root' })
export class PwaService {
  readonly #updates = inject(SwUpdate);
  readonly #appRef = inject(ApplicationRef);
  readonly #toaster = inject(Toaster);

  readonly #deferred = signal<BeforeInstallPromptEvent | null>(null);
  readonly #installed = signal(isStandalone());

  /** True when Chrome/Edge has offered us an install prompt to replay. */
  readonly canInstall = this.#deferred.asReadonly();
  readonly installed = this.#installed.asReadonly();
  /** iOS never fires `beforeinstallprompt`, so it needs written instructions. */
  readonly isIos = isIos();

  constructor() {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      this.#deferred.set(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      this.#installed.set(true);
      this.#deferred.set(null);
    };
    addEventListener('beforeinstallprompt', onPrompt);
    addEventListener('appinstalled', onInstalled);
    inject(DestroyRef).onDestroy(() => {
      removeEventListener('beforeinstallprompt', onPrompt);
      removeEventListener('appinstalled', onInstalled);
    });
  }

  /** Called once during bootstrap. */
  start(): void {
    if (!this.#updates.isEnabled) return;

    this.#updates.versionUpdates.subscribe((event) => {
      if (event.type !== 'VERSION_READY') return;
      this.#toaster.show('A new version of Soberish is ready.', 'info', {
        label: 'Reload',
        run: () => void this.#updates.activateUpdate().then(() => location.reload()),
      });
    });

    // Poll for updates once the app settles, then hourly.
    this.#appRef.isStable.pipe(first((stable) => stable)).subscribe(() => {
      void this.#updates.checkForUpdate();
      setInterval(() => void this.#updates.checkForUpdate(), 60 * 60 * 1000);
    });
  }

  async install(): Promise<void> {
    const event = this.#deferred();
    if (!event) return;
    await event.prompt();
    const { outcome } = await event.userChoice;
    if (outcome === 'accepted') this.#installed.set(true);
    this.#deferred.set(null);
  }
}

function isStandalone(): boolean {
  return (
    matchMedia('(display-mode: standalone)').matches ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);
}
