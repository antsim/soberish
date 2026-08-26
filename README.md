# 🍺 Soberish

Track your blood alcohol level in promille — on the bar stool, with or without a signal.

Soberish is an offline-first Angular PWA. Log what you drink in one tap, watch the curve rise and
fall, and see who else is still above 0.00% on the live leaderboard.

> **Not a breathalyser.** Soberish estimates BAC with the Widmark equation. Real blood alcohol
> depends on food, hydration, medication, and genetics. Never use it to decide whether to drive.

---

## What it does

- **One-tap logging.** Preset chips for beer, pint, wine, shots and more; a full editor for
  anything unusual, with a live "+0.26 ‰" preview before you commit.
- **A curve that animates.** Adding, editing, or deleting a drink morphs the graph instead of
  redrawing it — the line, the axis, and the hero number all tween to the new shape.
- **Works with no connection.** Everything lives in IndexedDB. The service worker serves the app
  shell, so a dead signal in the basement bar changes nothing.
- **Optional cloud.** Point it at a Supabase project and you get accounts, cross-device sync, and
  the shared leaderboard. Leave it unconfigured and the same build runs fully local.
- **Live Top ‰ board.** Published rows carry a snapshot plus a projected sober time, so every
  client ticks the numbers down against its own clock between refreshes.
- **Edit and delete anything.** Every logged drink stays editable, with undo on deletion.
- **A session that cleans up after itself.** Once you have been back at 0.00 ‰ for 24 hours the
  history is wiped. Keep drinking before then and the whole night — drinks and graph — stays.
- **Installable.** Add to Home Screen on iOS and Android, standalone display, maskable icons.

## Quick start

```bash
npm install
npm start          # http://localhost:4200
npm test           # vitest, via the Angular unit-test builder
npm run build      # production build into dist/soberish/browser
npm run icons      # regenerate every icon from src/assets/brand/icon.svg
```

Requires Node 22.22.3+ or 24.15+ (Angular 22's minimum).

## How the BAC model works

`src/app/core/bac/bac.ts` is pure, dependency-free, and unit tested.

1. **Dose.** `volume × ABV × 0.789` gives grams of ethanol.
2. **Absorption.** Each drink enters the blood as a first-order curve —
   `1 − e^(−3t/T)`, where `T` is the profile's _absorption minutes_ (time to ~95%).
   This is why a fresh drink reads 0.00 ‰ and the app says "kicking in" rather than "sober".
3. **Distribution.** Widmark: `BAC% = grams / (weight_g × r) × 100`, with
   `r` = 0.68 (male), 0.55 (female), or 0.615 (average).
4. **Elimination.** A flat %/hour, integrated forward one minute at a time so it stops at exactly
   zero instead of going negative.

The simulation runs forward from the first drink and always emits a fixed number of samples, which
is what lets the chart interpolate between two curves index-for-index.

### Percent inside, promille outside

The engine computes and the `bac_status` table stores BAC as a **percentage** (g/100 ml), because
that is the unit the Widmark equation is written in and the unit already on the wire. Every screen
displays **promille** (‰, g/L) — exactly ten times that — converted at the presentation boundary in
`shared/util/format.ts`.

Keeping the split means the tested maths never changes units and rows published by older clients
stay readable. `bacAt()` rounds to three decimals of a percent, which is precisely two decimals of
a promille, so the conversion neither loses nor invents precision.

All four inputs — weight, body composition, burn-off rate, absorption time — are adjustable under
**You**.

## Architecture

```
src/app/
  core/            everything with no UI
    bac/           the Widmark simulation (pure functions + specs)
    models/        Drink, Profile, LeaderboardEntry
    storage/       IndexedDB wrapper and the offline store of record
    state/         signal stores: profile, drinks, derived session, retention
    sync/          offline-first replication to Supabase
    supabase/      lazily loaded client, auth, leaderboard, status publishing
    platform/      clock, connectivity, toasts, install/update prompts
    config/        runtime config loaded before bootstrap
  features/        one folder per screen, lazily routed
    tracker/       the BAC readout, the animated chart, quick-add, the editor
    leaderboard/   Top BAC
    profile/       body profile, account, install, data
    auth/          shared email sign-in card
  shared/          sheet, toasts, formatters, pipes
```

Some conventions worth knowing:

- **Standalone components, signals, zoneless.** No NgModules and no Zone.js. State is signals;
  everything visible is a `computed()`.
- **One clock drives everything.** `Clock` is a signal of `Date.now()`. BAC, the countdown, the
  chart and the leaderboard are all `computed()` off it, so the UI decays on its own and no
  component owns a timer.
- **IndexedDB is the source of truth.** Writes hit local storage first; Supabase is a replica
  reconciled when a connection happens to exist. Deletes are tombstoned so they replicate too.
- **`core` never imports from `features`.** Dependencies point one way.
- **The chart is hand-rolled SVG.** A charting library cannot morph between two curves the way the
  fixed-sample-count timeline can, and this keeps the initial bundle at ~85 kB transferred.

## Deploying to GitHub Pages

`.github/workflows/deploy.yml` builds and publishes on every push to `main`. Push, and the site
lands at `https://<user>.github.io/<repo>/` — there is nothing to click first.

The workflow's `configure-pages` step runs with `enablement: true`, so the first run turns Pages on
itself (source: GitHub Actions) rather than failing with `Ensure GitHub Pages has been enabled`. It
also reports the site's base path, which becomes Angular's `--base-href` — correct for a project
site under `/<repo>/`, a user or org site at the root, or a custom domain, without hardcoding
anything. The build then copies `index.html` to `404.html` (how Pages hands deep links to the
router) and writes `.nojekyll`.

That enablement is best-effort. Creating a Pages site over the REST API needs admin rights the
workflow token does not always have, and organisations can block it outright; when that happens the
step logs `Resource not accessible by integration` and is skipped rather than failing the build.
The fix is a one-time click:

**Settings → Pages → Source: GitHub Actions**, then re-run the workflow.

From then on the step succeeds and reports the base path as normal.

### Turning on Supabase (optional)

Without credentials the app builds and runs offline-only — no accounts, no sync, no leaderboard,
and the affected screens say so.

1. Create a Supabase project and run [`supabase/schema.sql`](supabase/schema.sql) in the SQL
   editor. It creates `drinks` and `bac_status` with row-level security: your drinks are private,
   the leaderboard is readable by signed-in users, and nobody can publish a status but themselves.
2. Add two **repository variables** (Settings → Secrets and variables → Actions → Variables):
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
3. Under **Authentication → URL Configuration**, set both fields to your deployed app — this is
   what decides where confirmation and magic-link emails land:
   - **Site URL**: `https://<user>.github.io/<repo>/`
   - **Redirect URLs**: add `https://<user>.github.io/<repo>/**`, plus `http://localhost:4200/**`
     if you also sign in while developing.

> **Auth emails pointing at `localhost`?** Supabase validates `emailRedirectTo` against the
> Redirect URLs allow-list and silently falls back to **Site URL** when it does not match — and
> Site URL defaults to `http://localhost:3000`. Both fields in step 3 have to be set; a link that
> lands on localhost means one of them is still at its default.
>
> > **Seeing `permission denied for table bac_status`?** An early version of `schema.sql` created the
> > tables and RLS policies but never granted table privileges to the `authenticated` role. RLS only
> > filters rows _after_ Postgres checks those privileges, so every query was refused outright.
> > Re-running the current `schema.sql` is safe and fixes it, or apply just the two `grant` lines it
> > now contains.

Variables rather than secrets, deliberately: the anon key is a public client credential protected
by row-level security, and it has to reach the browser to be useful. It is kept out of the
repository only so forks can point at their own project.

`scripts/write-config.mjs` writes those values into `public/config.json` **before** the build, so
the service worker's hash manifest covers the final file. The app fetches it at startup, which
means one artifact can be deployed with or without a backend.

## Local Supabase development

```bash
SUPABASE_URL=https://xyz.supabase.co SUPABASE_ANON_KEY=eyJ... node scripts/write-config.mjs
npm start
```

`public/config.json` is committed with empty values as the offline-only default; the command above
overwrites it locally. Check it back out before committing if you would rather not carry your
project URL around.

## Licence

MIT — see [LICENSE](LICENSE).
