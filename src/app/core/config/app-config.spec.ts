import { describe, expect, it } from 'vitest';
import { hasSupabaseConfig, resolveBaseUrl } from './app-config';

describe('resolveBaseUrl', () => {
  it('resolves a project-site base href to an absolute app root', () => {
    expect(resolveBaseUrl('/soberish/', 'https://antsim.github.io/soberish/')).toBe(
      'https://antsim.github.io/soberish/',
    );
  });

  it('points at the app root even from a deep route', () => {
    expect(resolveBaseUrl('/soberish/', 'https://antsim.github.io/soberish/leaderboard')).toBe(
      'https://antsim.github.io/soberish/',
    );
  });

  it('drops query and fragment so an auth callback cannot nest', () => {
    expect(
      resolveBaseUrl('/soberish/', 'https://antsim.github.io/soberish/?code=abc#access_token=x'),
    ).toBe('https://antsim.github.io/soberish/');
  });

  it('handles a root deployment', () => {
    expect(resolveBaseUrl('/', 'http://localhost:4200/you')).toBe('http://localhost:4200/');
  });

  it('handles a relative base href', () => {
    expect(resolveBaseUrl('./', 'https://example.com/app/')).toBe('https://example.com/app/');
  });
});

describe('hasSupabaseConfig', () => {
  it('needs both a URL and a plausible key', () => {
    expect(hasSupabaseConfig({ supabaseUrl: '', supabaseAnonKey: '' })).toBe(false);
    expect(
      hasSupabaseConfig({ supabaseUrl: 'https://x.supabase.co', supabaseAnonKey: 'short' }),
    ).toBe(false);
    expect(
      hasSupabaseConfig({
        supabaseUrl: 'https://x.supabase.co',
        supabaseAnonKey: 'a'.repeat(40),
      }),
    ).toBe(true);
  });
});
