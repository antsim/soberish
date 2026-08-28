/** Languages the UI ships in. Adding one means adding a `messages.<code>.ts`. */
export const LOCALES = ['en', 'fi'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/**
 * First guess at a language, used until the user picks one themselves.
 *
 * Matches on the primary subtag so `fi-FI` and a bare `fi` both land on Finnish.
 */
export function detectLocale(languages: readonly string[] = navigator.languages ?? []): Locale {
  for (const tag of languages.length ? languages : [navigator.language ?? '']) {
    const primary = tag.toLowerCase().split('-')[0];
    if (isLocale(primary)) return primary;
  }
  return DEFAULT_LOCALE;
}
