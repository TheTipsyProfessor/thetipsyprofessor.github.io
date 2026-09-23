#!/usr/bin/env node
/* ============================================================
   OPTIMIZE-IMAGES — turn the plates into something you can
   actually ship

   The illustrations arrive as ~3 MB PNGs. At that weight a
   single home-page visit is nearly 20 MB, which undoes every
   other decision on the site. Re-encoded to WebP they land
   around 170 KB with no visible loss — the same picture, one
   sixteenth the wire.

     node tools/optimize-images.js          encode what's stale
     node tools/optimize-images.js --force  re-encode everything

   It also writes a .jpg of each plate. Nothing on the site
   loads those — they exist only for og:image, because link
   scrapers are the last place WebP support is still patchy and
   a silently broken preview is hard to notice.

   The PNGs stay put as the masters. Only .webp and .jpg are
   referenced, so the PNGs don't need uploading.

   Needs cwebp:  brew install webp
   ============================================================ */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const DIR = path.join(__dirname, '..', 'assets', 'img');
const QUALITY = 85;
const force = process.argv.includes('--force');

try {
  execFileSync('cwebp', ['-version'], { stdio: 'ignore' });
} catch (e) {
  console.error('cwebp not found. Install it with:  brew install webp');
  process.exit(1);
}

/* The icons are already small, already the right size, and are
   linked as .png from every page — a WebP and a JPEG of each
   would be dead weight that reappears on every run. */
const ICONS = /^(favicon|apple-touch-icon|espresso)/i;

const sources = fs.readdirSync(DIR)
  .filter((f) => /\.png$/i.test(f) && !ICONS.test(f))
  .sort();
if (!sources.length) {
  console.error(`No PNGs in ${DIR}`);
  process.exit(1);
}

const kb = (n) => Math.round(n / 1024);
let before = 0, after = 0, encoded = 0, skipped = 0;

console.log(`Encoding ${sources.length} plates to WebP at q${QUALITY}\n`);

for (const file of sources) {
  const src = path.join(DIR, file);
  const out = path.join(DIR, file.replace(/\.png$/i, '.webp'));
  const jpg = path.join(DIR, file.replace(/\.png$/i, '.jpg'));
  const srcStat = fs.statSync(src);

  // Skip anything already newer than its source.
  if (!force && fs.existsSync(out) && fs.existsSync(jpg) &&
      fs.statSync(out).mtimeMs >= srcStat.mtimeMs) {
    before += srcStat.size;
    after += fs.statSync(out).size;
    skipped++;
    continue;
  }

  // -m 6 is the slowest, densest search. These are encoded once
  // and served forever, so the extra seconds are free.
  execFileSync('cwebp', ['-q', String(QUALITY), '-m', '6', '-quiet', src, '-o', out]);

  // Social fallback. Flattened onto the paper colour, because a
  // transparent cutout saved as JPEG goes black.
  execFileSync('sips', [
    '-s', 'format', 'jpeg',
    '-s', 'formatOptions', '80',
    '--padColor', 'EFE9DC',
    src, '--out', jpg
  ], { stdio: 'ignore' });

  const outStat = fs.statSync(out);
  before += srcStat.size;
  after += outStat.size;
  encoded++;

  const pct = (100 - (outStat.size / srcStat.size) * 100).toFixed(1);
  console.log(
    '  ' + file.replace(/\.png$/i, '').padEnd(28) +
    String(kb(srcStat.size)).padStart(5) + ' KB → ' +
    String(kb(outStat.size)).padStart(4) + ' KB   −' + pct + '%'
  );
}

console.log(
  `\n${encoded} encoded` + (skipped ? `, ${skipped} already current` : '') +
  `\n${(before / 1048576).toFixed(1)} MB of PNG → ${(after / 1048576).toFixed(1)} MB of WebP ` +
  `(${(before / after).toFixed(1)}× smaller)`
);
