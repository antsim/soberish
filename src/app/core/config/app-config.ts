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

/**
 * Resolves the app's `<base href>` against the current location.
 *
 * On GitHub Pages this is `https://user.github.io/repo/` rather than the
 * origin, which matters for anything that has to name the app by absolute URL
 * from outside the browser — auth emails above all.
 */
export function resolveBaseUrl(baseHref: string, currentHref: string): string {
  return new URL(baseHref, currentHref).href;
}

/** The deployed app's root URL, e.g. `https://antsim.github.io/soberish/`. */
export function appBaseUrl(): string {
  return resolveBaseUrl(document.querySelector('base')?.getAttribute('href') ?? '/', location.href);
}

/** Loads `config.json` relative to the deployed base href. Never throws. */
export async function loadAppConfig(): Promise<AppConfig> {
  try {
    const response = await fetch(new URL('config.json', appBaseUrl()), {
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
