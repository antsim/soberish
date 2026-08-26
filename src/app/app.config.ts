import {
  ApplicationConfig,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  inject,
} from '@angular/core';
import { provideRouter, withInMemoryScrolling, withViewTransitions } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { routes } from './app.routes';
import { APP_CONFIG, AppConfig } from './core/config/app-config';
import { PwaService } from './core/platform/pwa.service';
import { DrinksStore } from './core/state/drinks-store';
import { ProfileStore } from './core/state/profile-store';
import { RetentionService } from './core/state/retention.service';
import { DrinkSyncService } from './core/sync/drink-sync.service';
import { AuthStore } from './core/supabase/auth-store';
import { StatusPublisherService } from './core/supabase/status-publisher.service';

/**
 * Bootstrap wiring.
 *
 * Local state (IndexedDB) is awaited so the first paint already has the real
 * curve; everything network-shaped is started but never blocks startup, which
 * is what keeps the app usable with no connection at all.
 */
export function createAppConfig(config: AppConfig): ApplicationConfig {
  return {
    providers: [
      provideBrowserGlobalErrorListeners(),
      { provide: APP_CONFIG, useValue: config },
      provideRouter(
        routes,
        withViewTransitions(),
        withInMemoryScrolling({ scrollPositionRestoration: 'top' }),
      ),
      provideServiceWorker('ngsw-worker.js', {
        enabled: !isDevMode(),
        registrationStrategy: 'registerWhenStable:30000',
      }),
      provideAppInitializer(async () => {
        const profiles = inject(ProfileStore);
        const drinks = inject(DrinksStore);
        const auth = inject(AuthStore);
        const retention = inject(RetentionService);
        const sync = inject(DrinkSyncService);
        const publisher = inject(StatusPublisherService);
        const pwa = inject(PwaService);

        await Promise.all([profiles.load(), drinks.load()]);

        retention.start();
        sync.start();
        publisher.start();
        pwa.start();

        // Session restore can hit the network; never let it delay first paint.
        void auth.init();
      }),
    ],
  };
}
