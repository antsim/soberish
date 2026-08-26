import { Injectable, inject } from '@angular/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { APP_CONFIG, hasSupabaseConfig } from '../config/app-config';

/**
 * Lazily creates the Supabase client.
 *
 * The SDK is only imported once a backend is actually configured *and* first
 * needed, so an offline-only deployment never downloads it.
 */
@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly #config = inject(APP_CONFIG);

  /** True when this deployment was built with Supabase credentials. */
  readonly enabled = hasSupabaseConfig(this.#config);

  #client: Promise<SupabaseClient | null> | null = null;

  client(): Promise<SupabaseClient | null> {
    if (!this.enabled) return Promise.resolve(null);
    this.#client ??= import('@supabase/supabase-js')
      .then(({ createClient }) =>
        createClient(this.#config.supabaseUrl, this.#config.supabaseAnonKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            storageKey: 'soberish.auth',
          },
        }),
      )
      .catch((error: unknown) => {
        console.error('Supabase client failed to initialise', error);
        return null;
      });
    return this.#client;
  }
}
