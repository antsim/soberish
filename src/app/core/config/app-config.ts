import { InjectionToken } from '@angular/core';

/**
 * Runtime configuration, fetched from `config.json` before bootstrap.
 *
 * Keeping it out of the bundle means the same build can be deployed with or
 * without a backend: GitHub Actions writes the file from repository
 * variables, and when it is absent Soberish simply runs offline-only.
 */
export interface AppConfig {
  readonly supabaseUrl: string;
  readonly supabaseAnonKey: string;
}

export const EMPTY_CONFIG: AppConfig = { supabaseUrl: '', supabaseAnonKey: '' };

export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG', {
  providedIn: 'root',
  factory: () => EMPTY_CONFIG,
});

export function hasSupabaseConfig(config: AppConfig): boolean {
  return /^https?:\/\//.test(config.supabaseUrl) && config.supabaseAnonKey.length > 20;
}

/** Loads `config.json` relative to the deployed base href. Never throws. */
export async function loadAppConfig(): Promise<AppConfig> {
  try {
    const base = document.querySelector('base')?.getAttribute('href') ?? '/';
    const response = await fetch(new URL('config.json', new URL(base, location.href)), {
      cache: 'no-cache',
    });
    if (!response.ok) return EMPTY_CONFIG;
    const raw = (await response.json()) as Partial<AppConfig>;
    return {
      supabaseUrl: (raw.supabaseUrl ?? '').trim(),
      supabaseAnonKey: (raw.supabaseAnonKey ?? '').trim(),
    };
  } catch {
    return EMPTY_CONFIG;
  }
}
