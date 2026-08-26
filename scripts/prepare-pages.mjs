/**
 * Post-processes the build output for GitHub Pages.
 *
 * - `404.html` is a copy of `index.html`: Pages serves it for unknown paths,
 *   which is how deep links like `/soberish/leaderboard` reach the router.
 * - `.nojekyll` stops Pages from stripping files that start with `_`.
 */
import { copyFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const dist = process.argv[2] ?? 'dist/soberish/browser';
const entries = await readdir(dist);

if (!entries.includes('index.html')) {
  throw new Error(`No index.html in ${dist} — did the build run?`);
}

await copyFile(join(dist, 'index.html'), join(dist, '404.html'));
await writeFile(join(dist, '.nojekyll'), '');

console.log(`Pages output ready in ${dist} (404.html + .nojekyll added).`);
