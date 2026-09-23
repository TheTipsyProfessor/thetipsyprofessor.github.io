#!/usr/bin/env node
/* ============================================================
   OPTIMIZE-PHOTOS — from the camera roll to the shoebox

   Drop originals (JPEG, HEIC, PNG or TIFF) into
   photos/originals/ and run:

     node tools/optimize-photos.js          encode what's new
     node tools/optimize-photos.js --force  re-encode everything

   For each original it writes, next to photos.json:

     photos/<name>.webp      2200px on the long edge, for the viewer
     photos/<name>-sm.webp   900px wide, for the wall

   and records the size in photos/photos.json, adding a stub
   entry (date filled from the camera, caption left for you) for
   any photo the manifest doesn't have yet. Existing captions are
   never touched.

   The originals folder is ignored by git: this repository is
   public, and a phone's JPEG carries the GPS position it was
   taken at. The WebPs carry no metadata at all.

   Phones store many pictures sideways with a flag saying which
   way up they go; nothing downstream reads that flag once the
   metadata is gone, so the rotation is applied to the pixels
   here first.

   Needs cwebp:  brew install webp
   ============================================================ */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const DIR = path.join(__dirname, '..', 'photos');
const ORIGINALS = path.join(DIR, 'originals');
const MANIFEST = path.join(DIR, 'photos.json');
const FULL = 2200;
const SMALL = 900;
const QUALITY = 80;
const force = process.argv.includes('--force');

try {
  execFileSync('cwebp', ['-version'], { stdio: 'ignore' });
} catch (e) {
  console.error('cwebp not found. Install it with:  brew install webp');
  process.exit(1);
}

if (!fs.existsSync(ORIGINALS)) {
  fs.mkdirSync(ORIGINALS, { recursive: true });
  console.log(`Made ${path.relative(process.cwd(), ORIGINALS)}/ — put photographs in it and run this again.`);
  process.exit(0);
}

const sources = fs.readdirSync(ORIGINALS)
  .filter((f) => /\.(jpe?g|heic|png|tiff?)$/i.test(f))
  .sort();
if (!sources.length) {
  console.log(`No photographs in ${path.relative(process.cwd(), ORIGINALS)}/`);
  process.exit(0);
}

/* ---- EXIF: orientation and date --------------------------
   Just enough of a TIFF reader to find two tags: 0x0112 in the
   first IFD and 0x9003 (DateTimeOriginal) in the Exif IFD.  */
function exif(file) {
  const out = { orientation: 1, date: null };
  const b = fs.readFileSync(file);
  if (b[0] !== 0xff || b[1] !== 0xd8) return out;

  let o = 2;
  while (o + 4 < b.length) {
    if (b[o] !== 0xff) break;
    const marker = b[o + 1];
    const len = b.readUInt16BE(o + 2);
    if (marker === 0xe1 && b.toString('latin1', o + 4, o + 10) === 'Exif\0\0') {
      const t = o + 10;
      const le = b.toString('latin1', t, t + 2) === 'II';
      const u16 = (p) => (le ? b.readUInt16LE(p) : b.readUInt16BE(p));
      const u32 = (p) => (le ? b.readUInt32LE(p) : b.readUInt32BE(p));

      const walk = (ifd, fn) => {
        const n = u16(t + ifd);
        for (let i = 0; i < n; i++) {
          const e = t + ifd + 2 + i * 12;
          fn(u16(e), e);
        }
      };

      let exifIfd = 0;
      walk(u32(t + 4), (tag, e) => {
        if (tag === 0x0112) out.orientation = u16(e + 8);
        if (tag === 0x8769) exifIfd = u32(e + 8);
      });
      if (exifIfd) {
        walk(exifIfd, (tag, e) => {
          if (tag === 0x9003) {
            const s = b.toString('latin1', t + u32(e + 8), t + u32(e + 8) + 10);
            const m = /^(\d{4}):(\d{2}):(\d{2})$/.exec(s);
            if (m) out.date = `${m[1]}-${m[2]}-${m[3]}`;
          }
        });
      }
      return out;
    }
    if (marker === 0xda) break;   // image data: no more headers
    o += 2 + len;
  }
  return out;
}

// EXIF orientation → the sips operations that put it upright.
const UPRIGHT = {
  2: ['-f', 'horizontal'],
  3: ['-r', '180'],
  4: ['-f', 'vertical'],
  5: ['-r', '90', '-f', 'horizontal'],
  6: ['-r', '90'],
  7: ['-r', '270', '-f', 'horizontal'],
  8: ['-r', '270']
};

function size(file) {
  const s = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', file]).toString();
  return {
    w: parseInt(/pixelWidth: (\d+)/.exec(s)[1], 10),
    h: parseInt(/pixelHeight: (\d+)/.exec(s)[1], 10)
  };
}

/* ---- Manifest --------------------------------------------- */

let manifest = [];
if (fs.existsSync(MANIFEST)) manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
const byFile = new Map(manifest.map((p) => [p.file, p]));

const slug = (f) => path.basename(f, path.extname(f))
  .toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'photos-'));
const kb = (n) => Math.round(n / 1024);
let encoded = 0, skipped = 0, added = 0;

for (const file of sources) {
  const name = slug(file);
  const src = path.join(ORIGINALS, file);
  const full = path.join(DIR, name + '.webp');
  const small = path.join(DIR, name + '-sm.webp');

  if (!force && byFile.has(name) && fs.existsSync(full) && fs.existsSync(small) &&
      fs.statSync(full).mtimeMs >= fs.statSync(src).mtimeMs) {
    skipped++;
    continue;
  }

  // Everything goes through a JPEG first: sips reads HEIC and
  // TIFF, cwebp doesn't, and the EXIF reader only speaks JPEG.
  const work = path.join(tmp, name + '.jpg');
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '95', src, '--out', work], { stdio: 'ignore' });
  const info = exif(work);
  if (UPRIGHT[info.orientation]) {
    execFileSync('sips', [...UPRIGHT[info.orientation], work, '--out', work], { stdio: 'ignore' });
  }

  const { w, h } = size(work);
  const scale = Math.min(1, FULL / Math.max(w, h));
  const fw = Math.round(w * scale), fh = Math.round(h * scale);

  // -metadata none is cwebp's default; spelled out because it is
  // the reason the GPS position never reaches the site.
  const enc = (args, out) => execFileSync('cwebp',
    ['-q', String(QUALITY), '-m', '6', '-metadata', 'none', '-quiet', ...args, work, '-o', out]);
  enc(scale < 1 ? ['-resize', String(fw), String(fh)] : [], full);
  enc(w > SMALL ? ['-resize', String(SMALL), '0'] : [], small);

  let entry = byFile.get(name);
  if (!entry) {
    entry = { file: name, w: fw, h: fh, caption: '', alt: '', place: '', date: info.date || '' };
    manifest.push(entry);
    byFile.set(name, entry);
    added++;
  }
  entry.w = fw;
  entry.h = fh;

  encoded++;
  console.log(
    '  ' + name.padEnd(30) +
    String(kb(fs.statSync(src).size)).padStart(6) + ' KB → ' +
    String(kb(fs.statSync(full).size)).padStart(4) + ' KB + ' +
    String(kb(fs.statSync(small).size)).padStart(3) + ' KB' +
    (info.orientation > 1 ? '   (turned upright)' : '')
  );
}

fs.rmSync(tmp, { recursive: true, force: true });
fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');

console.log(
  `\n${encoded} encoded` + (skipped ? `, ${skipped} already current` : '') +
  (added ? `\n${added} new in photos.json — give ${added === 1 ? 'it' : 'them'} a caption and alt text` : '')
);
