import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SoberStatus } from './core/bac/bac';
import { Connectivity } from './core/platform/connectivity';
import { PwaService } from './core/platform/pwa.service';
import { SessionStore } from './core/state/session-store';
import { DrinkSyncService } from './core/sync/drink-sync.service';
import { ToastHost } from './shared/ui/toast-host';

/** Accent colour per BAC band — drives the whole shell's tint. */
const STATUS_ACCENT: Record<SoberStatus, { accent: string; dim: string }> = {
  sober: { accent: '#38bdf8', dim: 'rgba(56, 189, 248, 0.14)' },
  buzzed: { accent: '#facc15', dim: 'rgba(250, 204, 21, 0.15)' },
  merry: { accent: '#fb923c', dim: 'rgba(251, 146, 60, 0.16)' },
  drunk: { accent: '#f4586e', dim: 'rgba(244, 88, 110, 0.17)' },
  wasted: { accent: '#d946ef', dim: 'rgba(217, 70, 239, 0.18)' },
};

/** App shell: header, routed screen, bottom navigation, toasts. */
@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ToastHost],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly session = inject(SessionStore);
  protected readonly network = inject(Connectivity);
  protected readonly pwa = inject(PwaService);
  protected readonly sync = inject(DrinkSyncService);

  constructor() {
    // Tint the whole app with the current BAC band.
    effect(() => {
      const { accent, dim } = STATUS_ACCENT[this.session.status()];
      const root = document.documentElement;
      root.style.setProperty('--accent', accent);
      root.style.setProperty('--accent-dim', dim);
    });
  }

  protected install(): void {
    void this.pwa.install();
  }
}
