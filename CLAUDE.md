# Soberish — operating manual

## Overview

- Angular 22 PWA that estimates blood alcohol from logged drinks, works fully offline, and
  optionally syncs to Supabase for accounts and a live leaderboard.
- Deployed to GitHub Pages at `https://antsim.github.io/soberish/` from `main`.
- Stack: Angular 22 (standalone, signals, **zoneless** — no zone.js, no NgModules), TypeScript 6,
  SCSS, `@angular/service-worker`, `@supabase/supabase-js`, Vitest via `@angular/build:unit-test`.
  Charts are hand-rolled SVG — no charting library.

## Commands

- `npm start` — dev server on :4200.
- `npm test` — Vitest (`*.spec.ts` beside sources).
- `npm run build` — production build to `dist/soberish/browser`.
- `BASE_HREF=/soberish/ npm run build:pages` — Pages build (adds `404.html`, `.nojekyll`).
- `npm run format` — Prettier write. **CI gate:**
  `npx prettier --check "src/**/*.{ts,html,scss}" "scripts/**/*.mjs"`.
- `npm run icons` — regenerate every icon from `src/assets/brand/icon.svg`.
- No ESLint in this repo. Do not add one without asking.
- Requires Node `^22.22.3 || ^24.15.0 || >=26`. If `ng` refuses on version, install Node 24 and
  prepend it to `PATH` — sandbox default Node is often 22.22.2, one patch below the minimum.

## Hard rules

- **Never push to `main`.** Work on the designated branch, push there, open a PR only when asked.
- **Never commit real Supabase credentials.** `public/config.json` stays empty in git; CI writes it
  from repository variables.
- Do not add dependencies without asking. Do not import `@supabase/supabase-js` at module scope —
  it is dynamically imported in `supabase.service.ts` so offline-only builds never ship it.
  Type-only imports are fine.
- **Never use `<input type="number">`.** It strips non-`.` decimal separators, so "4,7" silently
  became 47. Use `app-decimal-field` (`shared/ui/decimal-field.ts`).
- Before pushing: `npm run format`, `npm test`, `npm run build` must all pass.
- UI changes must be verified in a real browser (Playwright + `/opt/pw-browsers/chromium`), not
  only by unit tests. Several shipped bugs here were invisible to tests.

## Conventions

- Standalone components only; `changeDetection: ChangeDetectionStrategy.OnPush` on every new
  component (`shared/ui/sheet.ts` is the sole legacy exception).
- Signals for all state: `signal()` + `computed()`. Angular DI always via `inject()`, never
  constructor parameters (plain non-DI classes may still take them). Services are
  `@Injectable({ providedIn: 'root' })`.
- Private members use the `#field` syntax, not the `private` keyword.
- Expose read-only signals: keep `#foo = signal()` private and publish `foo = this.#foo.asReadonly()`.
- Selector prefix `app-`; component files kebab-case; SCSS per component.
- Templates use built-in control flow (`@if` / `@for` / `@empty`), never `*ngIf` / `*ngFor`.
- Prettier: 100 columns, single quotes. Sort `imports:` arrays alphabetically.
- Comments explain _why_, never _what_. Do not narrate obvious code.

## Architecture

```
src/app/
  core/          no UI, never imports from features/ (one-way, enforced by review)
    bac/         Widmark simulation — pure functions + specs
    models/      Drink, Profile, LeaderboardEntry
    storage/     IndexedDB wrapper + offline store of record
    state/       signal stores: drinks, profile, session (derived), retention, chart viewport
    sync/        offline-first replication to Supabase
    supabase/    lazy client, auth, leaderboard, status publishing
    platform/    clock, connectivity, toaster, PWA install/update
    config/      runtime config loaded before bootstrap
  features/      one lazily-routed folder per screen: tracker, leaderboard, profile, auth
  shared/        sheet, toast host, decimal field, formatters, pipes
```

- Entry points: `src/main.ts` (fetches `config.json`, then bootstraps), `src/app/app.config.ts`
  (providers + `provideAppInitializer`), `src/app/app.routes.ts`.
- `core/bac/bac.ts` is pure and unit-tested. Keep it dependency-free.
- `supabase/schema.sql` is the single source of DB truth.

## Domain rules that break things if ignored

- **Units: percent inside, promille outside.** The engine and the `bac_status` column store BAC as
  a percentage (g/100 ml); every screen shows promille (×10), converted only in
  `shared/util/format.ts`. Never change the engine's unit — it would break stored rows and the
  Widmark maths.
- **A drink is 12 g of alcohol, the Finnish way.** `STANDARD_DRINK_GRAMS` is THL's *annos*, not the
  WHO's 10 g or the UK's 8 g unit. It is also the scale `bac_status.drinks` is published on, so
  changing it silently rewrites every row already on the leaderboard.
- **One clock drives everything.** `platform/clock.ts` is a signal of `Date.now()`; BAC,
  countdowns, chart and leaderboard are `computed()` off it. Never give a component its own timer.
- **IndexedDB is the source of truth.** Writes land locally first; Supabase is a replica. Deletes
  are tombstoned (`deleted: true`) so they replicate; pending local rows always win a merge.
- **Chart sample count must stay constant** (`CHART_SAMPLES`). The add/edit/delete morph works by
  interpolating two curves index-for-index; a variable count silently disables the animation.
- **A session ends when BAC returns to 0; retention is a separate, later thing.** `endedAt` /
  `elapsedMs` freeze at that moment, and `chartBounds` stops following the clock so a finished
  night does not shrink over the following day. Do not conflate the two — the session clock once
  counted through 24 h of sobriety because of exactly that.
- **Retention:** the session is wiped 24 h after BAC returns to 0. Drinking again before the
  deadline carries the whole night forward. Implemented as a signal effect, not a timer.
- The chart draws a _window_ onto the session (`core/state/chart-viewport.ts`, pure + tested), and
  the timeline is rebuilt per window. Plain wheel belongs to the page; only pinch (`ctrl`+wheel)
  zooms, and `touch-action: pan-y` keeps vertical scrolling with the browser.

## Supabase

- Two tables, `drinks` and `bac_status`, both RLS-protected.
- **GRANTs and RLS are separate gates.** Without `grant … to authenticated`, Postgres refuses with
  `permission denied for table …` before any policy runs. `schema.sql` contains both; keep it that
  way.
- Auth emails must use `appBaseUrl()` for `emailRedirectTo`. Supabase validates it against the
  Redirect URLs allow-list and _silently_ falls back to Site URL, which defaults to localhost —
  a misconfiguration there looks exactly like an app bug.
- Without credentials the app builds and runs offline-only; affected screens say so. Keep that path
  working.

## Deployment

- `.github/workflows/deploy.yml` builds and deploys on push to `main`; `ci.yml` runs format, tests
  and build on PRs.
- `scripts/write-config.mjs` runs **before** the build so the service worker's hash manifest covers
  the final `config.json`. Never rewrite it post-build.
- `--base-href` comes from `configure-pages`' `base_path`, falling back to the repo name.
- Pages enablement from CI is best-effort (`continue-on-error`); the workflow token usually lacks
  the admin rights to create a Pages site. Enabling it is a one-time manual setting.
