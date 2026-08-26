import { Injectable, signal } from '@angular/core';

export interface Toast {
  readonly id: number;
  readonly message: string;
  readonly tone: 'info' | 'success' | 'error';
  readonly action?: { readonly label: string; readonly run: () => void };
}

const VISIBLE_MS = 4500;

/** Transient, non-blocking feedback — including the undo affordance. */
@Injectable({ providedIn: 'root' })
export class Toaster {
  readonly #toasts = signal<readonly Toast[]>([]);
  readonly toasts = this.#toasts.asReadonly();
  #nextId = 1;

  show(message: string, tone: Toast['tone'] = 'info', action?: Toast['action']): number {
    const id = this.#nextId++;
    this.#toasts.update((all) => [...all, { id, message, tone, action }]);
    setTimeout(() => this.dismiss(id), VISIBLE_MS);
    return id;
  }

  success(message: string, action?: Toast['action']): number {
    return this.show(message, 'success', action);
  }

  error(message: string): number {
    return this.show(message, 'error');
  }

  dismiss(id: number): void {
    this.#toasts.update((all) => all.filter((toast) => toast.id !== id));
  }
}
