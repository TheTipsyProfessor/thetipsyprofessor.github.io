#!/usr/bin/env node
/* ============================================================
   FETCH-THUMBS — pull each hero video's thumbnail down once

   A guest page's hero is a click-to-load panel. With a real
   thumbnail behind it — faces, a room — far more people press
   play, and plays are the point.

   The thumbnail is fetched ONCE, at your keyboard, and served
   from your own domain. That keeps the site's promise that a
   page load touches no third party: an <img> pointed at
   i.ytimg.com would quietly break it on every visit.

     node tools/fetch-thumbs.js          fetch what's missing
     node tools/fetch-thumbs.js --force  refetch everything

   Needs cwebp:  brew install webp
   ============================================================ */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'assets', 'img', 'thumbs');
const force = process.argv.includes('--force');

try { execFileSync('cwebp', ['-version'], { stdio: 'ignore' }); }
catch (e) { console.error('cwebp not found. Install it with:  brew install webp'); process.exit(1); }

const sandbox = { window: {}, console };
sandbox.window.window = sandbox.window;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'assets/js/md.js'), 'utf8'), sandbox);
const md = sandbox.window.TP.md;

/* Every video declared across the posts. */
const wanted = [];
for (const file of fs.readdirSync(path.join(ROOT, 'posts')).filter((f) => f.endsWith('.md'))) {
  const src = fs.readFileSync(path.join(ROOT, 'posts', file), 'utf8');
  const doc = md.parse(src);
  if (doc.video && doc.video.id) wanted.push({ slug: file.replace(/\.md$/, ''), v: doc.video });
}

if (!wanted.length) { console.log('No hero videos declared.'); process.exit(0); }

fs.mkdirSync(OUT, { recursive: true });

/* YouTube does not always have a maxres still; fall back down
   the ladder rather than writing a 404 page to disk. */
const candidates = (v) => v.provider === 'vimeo'
  ? [`https://vumbnail.com/${v.id}.jpg`]
  : [
      `https://i.ytimg.com/vi/${v.id}/maxresdefault.jpg`,
      `https://i.ytimg.com/vi/${v.id}/sddefault.jpg`,
      `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`
    ];

(async () => {
  let got = 0, skipped = 0, failed = 0;

  for (const { slug, v } of wanted) {
    const webp = path.join(OUT, `${v.id}.webp`);
    if (!force && fs.existsSync(webp)) { skipped++; continue; }

    let buf = null;
    for (const url of candidates(v)) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const b = Buffer.from(await res.arrayBuffer());
        // A YouTube "missing thumbnail" placeholder is tiny.
        if (b.length < 6000) continue;
        buf = b;
        break;
      } catch (e) { /* try the next size down */ }
    }

    if (!buf) {
      console.log(`  ! ${slug}: no thumbnail for ${v.id} — the printed panel will show instead`);
      failed++;
      continue;
    }

    const tmp = path.join(OUT, `${v.id}.jpg`);
    fs.writeFileSync(tmp, buf);
    execFileSync('cwebp', ['-q', '82', '-m', '6', '-quiet', tmp, '-o', webp]);
    fs.unlinkSync(tmp);

    console.log(`  ${slug}`.padEnd(42) + `${Math.round(buf.length / 1024)} KB → ${Math.round(fs.statSync(webp).size / 1024)} KB`);
    got++;
  }

  console.log(`\n${got} fetched` + (skipped ? `, ${skipped} already here` : '') + (failed ? `, ${failed} unavailable` : ''));
})();
