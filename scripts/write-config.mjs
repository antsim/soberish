/**
 * Writes `public/config.json` from the environment, before the build.
 *
 * It has to happen pre-build so the service worker's hash manifest covers the
 * final file — rewriting it afterwards would make ngsw reject it. Supabase's
 * anon key is a public client credential, so shipping it in the bundle is
 * expected; it is only kept out of the repository so forks can point at their
 * own project.
 */
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const config = {
  supabaseUrl: process.env['SUPABASE_URL']?.trim() ?? '',
  supabaseAnonKey: process.env['SUPABASE_ANON_KEY']?.trim() ?? '',
};

await writeFile(join(root, 'public/config.json'), `${JSON.stringify(config, null, 2)}\n`);

console.log(
  config.supabaseUrl && config.supabaseAnonKey
    ? 'config.json written — Supabase auth, sync and leaderboard enabled.'
    : 'config.json written — no Supabase credentials, building in offline-only mode.',
);
