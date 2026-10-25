import { DestroyRef, Injectable, inject, signal } from '@angular/core';

export type NotificationPermissionState = NotificationPermission | 'unsupported';

/**
 * The browser's notification permission and a way to show one.
 *
 * Knows nothing about *what* to notify about — that is the rules' job — so
 * every future kind goes through the same permission and display path.
 */
@Injectable({ providedIn: 'root' })
export class SystemNotifications {
  readonly supported = typeof Notification !== 'undefined';

  readonly #permission = signal<NotificationPermissionState>(this.#read());
  readonly permission = this.#permission.asReadonly();

  constructor() {
    if (!this.supported) return;
    // Permission can be revoked from the browser's site settings at any time,
    // and only some browsers report that as an event.
    const refresh = () => this.#permission.set(this.#read());
    document.addEventListener('visibilitychange', refresh);
    let status: PermissionStatus | null = null;
    navigator.permissions
      ?.query({ name: 'notifications' })
      .then((result) => {
        status = result;
        status.addEventListener('change', refresh);
      })
      .catch(() => undefined);
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('visibilitychange', refresh);
      status?.removeEventListener('change', refresh);
    });
  }

  /** Asks the browser. Must run inside a user gesture, or Safari ignores it. */
  async request(): Promise<NotificationPermissionState> {
    if (!this.supported) return 'unsupported';
    const result = await Notification.requestPermission();
    this.#permission.set(result);
    return result;
  }

  async show(title: string, options: { body: string; tag: string }): Promise<void> {
    if (this.#read() !== 'granted') return;
    const full: NotificationOptions = {
      ...options,
      icon: new URL('icons/icon-192.png', document.baseURI).href,
      // Read by the Angular service worker's click handler: bring the app back
      // to the front, or open it if it has been closed since.
      data: { onActionClick: { default: { operation: 'focusLastFocusedOrOpen', url: '' } } },
    };
    // Android Chrome refuses `new Notification()` outright; it only shows
    // notifications through a service worker.
    const registration = await navigator.serviceWorker?.getRegistration().catch(() => undefined);
    if (registration) return registration.showNotification(title, full);
    const notification = new Notification(title, full);
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  }

  #read(): NotificationPermissionState {
    return this.supported ? Notification.permission : 'unsupported';
  }
}
