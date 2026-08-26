/**
 * Generates every PWA / favicon raster from the single source of truth:
 * `src/assets/brand/icon.svg`.
 *
 * Run with `npm run icons` after editing the SVG.
 */
import { Buffer } from 'node:buffer';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'src/assets/brand/icon.svg');
const iconsDir = join(root, 'public/icons');
const publicDir = join(root, 'public');

/** Sizes referenced by `manifest.webmanifest` for the `any` purpose. */
const ANY_SIZES = [72, 96, 128, 144, 152, 192, 256, 384, 512];
/** Android adaptive icons crop to the inner 80%, so the mark is scaled down. */
const MASKABLE_SIZES = [192, 512];
const MASKABLE_SCALE = 0.68;
const MARK_GROUP = /(<g id="soberish-icon-mark"[^>]*transform=")([^"]*)(")/;

const render = (svg, size) =>
  sharp(Buffer.from(svg), { density: 512 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toBuffer();

/** Wraps the mark in a centred scale so nothing is lost to the maskable crop. */
function toMaskable(svg) {
  if (!MARK_GROUP.test(svg)) {
    throw new Error('icon.svg is missing the <g id="soberish-icon-mark"> transform anchor');
  }
  const center = `translate(256 256) scale(${MASKABLE_SCALE}) translate(-256 -256)`;
  return svg.replace(
    MARK_GROUP,
    (_, head, transform, tail) => `${head}${center} ${transform}${tail}`,
  );
}

/** Minimal ICO container around a single PNG frame (PNG-in-ICO is universally supported). */
function pngToIco(png, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // image count
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size >= 256 ? 0 : size, 0);
  entry.writeUInt8(size >= 256 ? 0 : size, 1);
  entry.writeUInt8(0, 2); // palette
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // colour planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(header.length + entry.length, 12);
  return Buffer.concat([header, entry, png]);
}

const svg = await readFile(source, 'utf8');
const maskableSvg = toMaskable(svg);

await mkdir(iconsDir, { recursive: true });

const written = [];
for (const size of ANY_SIZES) {
  const file = join(iconsDir, `icon-${size}.png`);
  await writeFile(file, await render(svg, size));
  written.push(`icons/icon-${size}.png`);
}
for (const size of MASKABLE_SIZES) {
  const file = join(iconsDir, `maskable-${size}.png`);
  await writeFile(file, await render(maskableSvg, size));
  written.push(`icons/maskable-${size}.png`);
}

// iOS home-screen icon: no transparency, no rounding (iOS masks it itself).
await writeFile(
  join(iconsDir, 'apple-touch-icon.png'),
  await sharp(Buffer.from(svg.replace('rx="112"', 'rx="0"')), { density: 512 })
    .resize(180, 180)
    .flatten({ background: '#0a0d15' })
    .png()
    .toBuffer(),
);
written.push('icons/apple-touch-icon.png');

await writeFile(join(publicDir, 'favicon.svg'), svg);
const favicon32 = await render(svg, 32);
await writeFile(join(publicDir, 'favicon-32.png'), favicon32);
await writeFile(join(publicDir, 'favicon.ico'), pngToIco(favicon32, 32));
written.push('favicon.svg', 'favicon-32.png', 'favicon.ico');

console.log(`Generated ${written.length} icon files:\n  ${written.join('\n  ')}`);
