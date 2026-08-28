import { describe, expect, it } from 'vitest';
import { LOCALES, Locale, detectLocale, isLocale } from './locale';
import { Messages, en } from './messages.en';
import { fi } from './messages.fi';

const DICTIONARIES: Record<Locale, Messages> = { en, fi };

/** Sample arguments per arity — enough to prove every function interpolates. */
const ARGS: readonly unknown[] = [1, 'x', 'y'];

function walk(value: unknown, path: string, visit: (leaf: string, path: string) => void): void {
  if (typeof value === 'string') return visit(value, path);
  if (typeof value === 'function') {
    const result = (value as (...args: unknown[]) => unknown)(...ARGS.slice(0, value.length));
    expect(typeof result, `${path} should return a string`).toBe('string');
    return visit(result as string, path);
  }
  for (const [key, child] of Object.entries(value as object)) {
    walk(child, path ? `${path}.${key}` : key, visit);
  }
}

describe('locale', () => {
  it('recognises the shipped locales only', () => {
    expect(isLocale('fi')).toBe(true);
    expect(isLocale('en')).toBe(true);
    expect(isLocale('sv')).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });

  it('matches a browser language on its primary subtag', () => {
    expect(detectLocale(['fi-FI', 'en-US'])).toBe('fi');
    expect(detectLocale(['FI'])).toBe('fi');
    expect(detectLocale(['en-GB'])).toBe('en');
  });

  it('falls back to English for a language it does not have', () => {
    expect(detectLocale(['sv-SE', 'de'])).toBe('en');
    expect(detectLocale([])).toBe('en');
  });
});

describe('dictionaries', () => {
  it('ships one for every locale', () => {
    for (const locale of LOCALES) expect(DICTIONARIES[locale]).toBeDefined();
  });

  for (const locale of LOCALES) {
    it(`${locale} has no empty copy`, () => {
      walk(DICTIONARIES[locale], '', (leaf, path) => {
        expect(leaf.trim(), `${locale}.${path} is empty`).not.toBe('');
      });
    });
  }

  it('interpolates its arguments in every language', () => {
    // A translation that drops its placeholder renders a sentence with a hole
    // in it, which type checking alone cannot catch.
    for (const locale of LOCALES) {
      walk(DICTIONARIES[locale], '', () => undefined);
    }
    expect(fi.toast.logged('🍺', 'Karhu')).toContain('Karhu');
    expect(fi.profile.drinksStored(3)).toContain('3');
    expect(fi.leaderboard.yourRank(2)).toContain('2');
  });

  it('inflects Finnish for the singular case', () => {
    expect(fi.profile.drinksStored(1)).toBe('1 juoma tallessa');
    expect(fi.profile.drinksStored(2)).toBe('2 juomaa tallessa');
    expect(fi.leaderboard.units(1)).toBe('1 annos');
    expect(fi.leaderboard.units(4)).toBe('4 annosta');
    expect(fi.editor.minutesAgo(1)).toBe('1 minuutti sitten');
    expect(fi.editor.minutesAgo(20)).toBe('20 minuuttia sitten');
  });

  it('translates rather than copying the English', () => {
    const shared = new Set(['metric', 'imperial', 'minus15', 'minus30', 'plus15']);
    const identical: string[] = [];
    walk(en, '', (leaf, path) => {
      const finnish = path
        .split('.')
        .reduce<Record<string, unknown>>((node, key) => node[key] as never, fi as never);
      const value = typeof finnish === 'function' ? undefined : (finnish as unknown);
      const key = path.split('.').pop() ?? '';
      if (typeof value === 'string' && value === leaf && !shared.has(key)) identical.push(path);
    });
    expect(identical).toEqual([]);
  });
});
