#!/usr/bin/env node
/* ============================================================
   BUILD — make the blog legible to machines

   The site works without this. Run it before deploying and it
   additionally produces, for every essay:

     essay/<slug>/index.html   the prose, in the HTML, with a
                               real title, description, Open
                               Graph card and canonical URL

   plus sitemap.xml, robots.txt, feed.xml, a _redirects file,
   and a crawlable list of essays injected into the home and
   archive pages.

     node tools/build.js                      (uses SITE below)
     node tools/build.js https://example.com

   It renders with the same assets/js/md.js the browser uses, so
   the static and runtime output cannot drift apart.
   ============================================================ */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const SITE = (process.argv[2] || 'https://thetipsyprofessor.com').replace(/\/+$/, '');

const BRAND = 'The Tipsy Professor';
const TAGLINE = 'Essays written between the second coffee and the first drink. Mostly explaining how things work, occasionally wondering why.';

/* Names an essay slug may not take, because a file already
   answers to them. */
const RESERVED = new Set(['index', 'essay', 'archive', 'about', 'photos', '404', 'assets', 'posts', 'tools', 'feed', 'sitemap', 'robots']);

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const write = (p, s) => {
  const full = path.join(ROOT, p);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, s);
};

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const attr = (s) => esc(s).replace(/"/g, '&quot;');

/* The site serves WebP; link scrapers get the JPEG sibling that
   tools/optimize-images.js writes alongside it. WebP support in
   preview crawlers is still uneven, and a broken card is close
   to invisible until someone tells you. */
const social = (p) => p.replace(/\.webp$/i, '.jpg');

/* ---- Load the real parser ---------------------------------
   Same file the browser loads. No second implementation to
   keep in step.                                              */
const sandbox = { window: {}, console };
sandbox.window.window = sandbox.window;
vm.createContext(sandbox);
vm.runInContext(read('assets/js/md.js'), sandbox);
vm.runInContext(read('assets/js/dateline.js'), sandbox);
const md = sandbox.window.TP.md;
const dateline = sandbox.window.TP.dateline;

const posts = JSON.parse(read('posts/posts.json'));

/* ---- Checks worth failing on ------------------------------ */
{
  const problems = [];
  const warnings = [];
  const seen = new Set();
  const usedImages = new Map();

  for (const p of posts) {
    if (!/^[a-z0-9-]+$/.test(p.slug)) problems.push(`slug not url-safe: ${p.slug}`);
    if (RESERVED.has(p.slug)) problems.push(`slug collides with a site file: ${p.slug}`);
    if (seen.has(p.slug)) problems.push(`duplicate slug: ${p.slug}`);
    seen.add(p.slug);
    if (!fs.existsSync(path.join(ROOT, 'posts', p.slug + '.md'))) problems.push(`no markdown for: ${p.slug}`);
    if (p.image && !fs.existsSync(path.join(ROOT, p.image))) problems.push(`missing image: ${p.image}`);
    if (p.image && !p.imageAlt) problems.push(`image without alt text: ${p.slug}`);
    if (!p.dek) problems.push(`no dek (used as the meta description): ${p.slug}`);

    /* Every post gets its own illustration and no plate is ever
       reused, so a repeat is a mistake rather than a choice. */
    if (p.image) {
      if (usedImages.has(p.image)) {
        problems.push(`plate used twice — ${p.image}\n      (${usedImages.get(p.image)} and ${p.slug})`);
      }
      usedImages.set(p.image, p.slug);
    } else {
      warnings.push(`${p.slug} has no plate yet — its card will set two initials instead`);
    }
  }

  if (warnings.length) {
    console.log('Waiting on artwork:\n' + warnings.map((s) => '  · ' + s).join('\n') + '\n');
  }
  if (problems.length) {
    console.error('Build stopped:\n' + problems.map((s) => '  · ' + s).join('\n'));
    process.exit(1);
  }
}

/* ---- Shared chrome, lifted from essay.html ----------------
   Taking the head and the furniture from the real template
   means the pre-rendered pages cannot drift from the hand-
   written ones.                                              */
const template = read('essay.html');

const slice = (open, close) => {
  const a = template.indexOf(open);
  const b = template.indexOf(close, a);
  if (a === -1 || b === -1) throw new Error(`essay.html is missing ${open}`);
  return template.slice(a, b + close.length);
};

/* Built pages live two directories down at /essay/<slug>/, so
   every relative URL — in the chrome and in the rendered prose
   alike — has to become root-relative or it resolves inside
   the essay's own folder and 404s. */
const rootRelative = (html) => html
  .replace(
    /\b(href|src)="(?!https?:|data:|mailto:|#|\/)([^"]+)"/g,
    (_, a, v) => `${a}="/${v}"`
  )
  // Assets referenced from an inline style — the hero poster —
  // need the same treatment, and are easy to forget because
  // they aren't an href or a src.
  .replace(
    /url\((?!['"]?(?:https?:|data:|\/))(['"]?)([^)'"]+)\1\)/g,
    (_, q, v) => `url(${q}/${v}${q})`
  );

/* Everything essay.html carries in its <head> below the page's own
   title and description. Terminated by an explicit marker rather
   than by the first </script>, which is what it used to use: that
   silently truncated the block the moment a second script was added
   to the head, dropping the preferences bootstrap from every
   pre-rendered essay. */
const HEAD_EXTRAS = rootRelative(
  slice('<link rel="preconnect"', '<!--/head-extras-->')
    .replace(/<link rel="alternate"[\s\S]*?>\s*/g, '')
);
const BAR = rootRelative(slice('<header class="bar">', '</header>'));
const FOOTER = rootRelative(slice('<div class="shell">\n    <footer class="foot">', '</footer>\n  </div>'));
const DIAL = slice('<div class="dial"', '</div>\n\n<script');
const SCRIPTS = rootRelative(slice('<script src="https://cdn.jsdelivr.net/npm/katex', '<script src="assets/js/essay.js"></script>'));

const dialBlock = DIAL.slice(0, DIAL.lastIndexOf('</div>') + 6);

/* ---- Pieces ----------------------------------------------- */

const pours = dateline.pours;

/* Reading context — the essay's own header. A conversation
   suppresses the hour: it says where you met, not when he
   finished typing. */
const readingLine = (p) => dateline.render(p, { time: !p.with, tangent: true, link: true });

/* Scanning contexts — cards, index rows, related lists. */
const scanLine = (p, withTangent) => dateline.render(p, { tangent: !!withTangent });

/* Use the locally-cached thumbnail if tools/fetch-thumbs.js has
   been run for this video, otherwise leave the printed panel.
   Checked here rather than in the browser because only the
   build can see whether the file exists. */
const withPoster = (v) => {
  if (!v || !v.id || v.poster) return v;
  const rel = `assets/img/thumbs/${v.id}.webp`;
  return fs.existsSync(path.join(ROOT, rel))
    ? Object.assign({}, v, { poster: rel })
    : v;
};

/* "Dr Rhea Kulkarni" → "RK", for the two-initial plate. */
const initialsFor = (p) => {
  if (!p.with) return null;
  const of = (s) => String(s || '').replace(/^(Dr|Prof|Professor|Mr|Ms|Mrs)\.?\s+/i, '')
    .split(/\s+/).filter(Boolean).slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase()).join('');
  return ['TP', of(p.with.split(',')[0]) || '?'];
};

const platePanel = (p) => {
  const pair = initialsFor(p);
  return `<figure class="card__plate card__plate--set" aria-hidden="true"><span class="card__panel">` +
    (pair
      ? `<span class="card__pair"><span>${esc(pair[0])}</span><span>${esc(pair[1])}</span></span>`
      : `<span class="card__initial">${esc((p.title || '?').trim().charAt(0))}</span>`) +
    `<span class="card__stamp">${esc(p.tangent || '')}</span></span></figure>`;
};

function relatedBlock(entry) {
  const others = posts.filter((p) => p.slug !== entry.slug);
  const same = others.filter((p) => p.tangent === entry.tangent);
  const picks = same.concat(others.filter((p) => !same.includes(p))).slice(0, 3);
  if (!picks.length) return '';

  return `<div class="head-rule"><h2>Also poured</h2>` +
    `<p>${same.length ? 'filed under ' + esc(entry.tangent) : 'most recent'}</p></div>` +
    `<ul class="run">` + picks.map((p) =>
      `<li><a href="/essay/${p.slug}/">` +
        scanLine(p) +
        `<span class="run__title">${esc(p.title)}</span>` +
        `<span class="run__dek">${esc(p.dek)}</span>` +
      `</a></li>`).join('') +
    `</ul>`;
}

/* ---- One essay -------------------------------------------- */

function buildEssay(p) {
  const source = read(`posts/${p.slug}.md`);
  const doc = md.parse(source);
  const url = `${SITE}/essay/${p.slug}/`;
  const title = doc.meta.title || p.title;
  const dek = doc.meta.dek || p.dek;
  const image = p.image ? `${SITE}/${social(p.image)}` : null;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">

<title>${esc(title)} — ${BRAND}</title>
<meta name="description" content="${attr(dek)}">
<meta name="author" content="${BRAND}">
<link rel="canonical" href="${attr(url)}">
<meta name="theme-color" content="#ffffff">

<meta property="og:type" content="article">
<meta property="og:site_name" content="${BRAND}">
<meta property="og:title" content="${attr(title)}">
<meta property="og:description" content="${attr(dek)}">
<meta property="og:url" content="${attr(url)}">
${image ? `<meta property="og:image" content="${attr(image)}">
<meta property="og:image:alt" content="${attr(p.imageAlt)}">` : ''}
<meta property="article:published_time" content="${attr(p.date)}">
<meta property="article:section" content="${attr(p.tangent)}">
<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">
<meta name="twitter:title" content="${attr(title)}">
<meta name="twitter:description" content="${attr(dek)}">
${image ? `<meta name="twitter:image" content="${attr(image)}">` : ''}

<link rel="icon" href="/assets/img/favicon-32.png" sizes="32x32">
<link rel="icon" href="/assets/img/favicon-192.png" sizes="192x192">
<link rel="apple-touch-icon" href="/assets/img/apple-touch-icon.png">
<link rel="alternate" type="application/rss+xml" title="${BRAND}" href="/feed.xml">
${doc.video && doc.video.id ? `
<!-- Tells search engines there is a video here, which is what
     earns the thumbnail beside the result — and the thumbnail
     is most of why anyone clicks through to watch it. -->
<meta property="og:video" content="https://www.youtube.com/watch?v=${attr(doc.video.id)}">
<script type="application/ld+json">
${JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'VideoObject',
  name: doc.video.title || title,
  description: dek,
  uploadDate: p.date,
  thumbnailUrl: `https://i.ytimg.com/vi/${doc.video.id}/maxresdefault.jpg`,
  embedUrl: `https://www.youtube-nocookie.com/embed/${doc.video.id}`,
  contentUrl: `https://www.youtube.com/watch?v=${doc.video.id}`
}, null, 2)}
</script>` : ''}

${HEAD_EXTRAS}
</head>

<body data-prerendered="${attr(p.slug)}" data-tangent="${attr(p.tangent || '')}"${doc.video && doc.video.id ? ' data-hero' : ''}>
<a class="skip-link" href="#prose">Skip to the essay</a>

<div class="progress" aria-hidden="true"><div class="progress__bar"></div></div>

${BAR}

<p id="pref-status" class="vh" role="status" aria-live="polite"></p>

<main id="main">
  <header class="essay-head reader-grid" id="essay-head">
    ${readingLine(p)}
    <h1>${esc(title)}</h1>
    <p class="dek">${esc(dek)}</p>
  </header>

  <article class="prose reader-grid" id="prose">
${rootRelative(
    md.videoHero(withPoster(doc.video)) +
    md.subjectCard(doc.subject) +
    doc.html
  )}
  </article>

  <div class="reader-grid">
    <section class="related wide" id="related" aria-label="Related essays">${relatedBlock(p)}</section>
  </div>

  <p class="offprint-slug" id="offprint">${esc(title)} · ${BRAND} · ${esc(url)}</p>

  ${FOOTER}
</main>

${dialBlock}

${SCRIPTS}
</body>
</html>
`;

  write(`essay/${p.slug}/index.html`, html);
  return { words: doc.html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length, notes: doc.notes };
}

/* ---- Inject crawlable lists into the JS-driven pages ------
   The markup is meaningful without JavaScript; listing.js
   replaces it with the interactive version on load.          */

function inject(file, open, close, markup, tail) {
  const src = read(file);
  const a = src.indexOf(open);
  const b = src.indexOf(close);
  if (a === -1 || b === -1) {
    console.warn(`  ! ${file}: no ${open} marker, skipped`);
    return false;
  }
  write(file, src.slice(0, a + open.length) + '\n' + markup + '\n' + (tail || '') + src.slice(b));
  return true;
}

const injectList = (file, open, close, markup) => inject(file, open, close, markup, '      ');

/* Canonical and Open Graph need an absolute origin, so they
   can't be hand-written into a file that doesn't know one.
   Title and description stay authored in the page itself and
   are lifted from it here — one source of truth. */
function injectMeta(file, pagePath, image, imageAlt) {
  const src = read(file);
  const grab = (re) => { const m = re.exec(src); return m ? m[1] : ''; };
  const title = grab(/<title>([\s\S]*?)<\/title>/);
  const desc = grab(/<meta name="description" content="([\s\S]*?)">/);
  const url = SITE + pagePath;

  const block = [
    `<link rel="canonical" href="${attr(url)}">`,
    `<meta property="og:url" content="${attr(url)}">`,
    `<meta property="og:site_name" content="${BRAND}">`,
    `<meta property="og:title" content="${attr(title)}">`,
    `<meta property="og:description" content="${attr(desc)}">`,
    image && `<meta property="og:image" content="${attr(SITE + '/' + social(image))}">`,
    image && `<meta property="og:image:alt" content="${attr(imageAlt)}">`,
    `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">`,
    `<meta name="twitter:title" content="${attr(title)}">`,
    `<meta name="twitter:description" content="${attr(desc)}">`,
    image && `<meta name="twitter:image" content="${attr(SITE + '/' + social(image))}">`
  ].filter(Boolean).join('\n');

  return inject(file, '<!--build:meta-->', '<!--/build:meta-->', block, '');
}

/* The pre-rendered rows are the unfiltered run, which is never
   a plated section — so every one of them that has artwork
   advertises it to peek.js. See row() in listing.js. */
const staticRows = posts.map((p) =>
  `        <li data-tangent="${attr(p.tangent || '')}"><a href="/essay/${p.slug}/"` +
    (p.image ? ` data-plate="/${attr(p.image)}"` : '') + `>` +
    scanLine(p, true) +
    `<span class="run__title">${esc(p.title)}</span>` +
    `<span class="run__dek">${esc(p.dek)}</span>` +
  `</a></li>`).join('\n');

const staticCard = (p) =>
  `        <article class="card" data-tangent="${attr(p.tangent || '')}"><a class="card__link" href="/essay/${p.slug}/">` +
    (p.image
        ? `<figure class="card__plate"><img src="/${attr(p.image)}" alt="${attr(p.imageAlt)}" width="1086" height="1448"></figure>`
        : platePanel(p)) +
    `<span class="card__body">` +
      scanLine(p, true) +
      `<h2 class="card__title">${esc(p.title)}</h2>` +
      `<p class="card__dek">${esc(p.dek)}</p>` +
      `<span class="card__tangent">${esc(p.tangent)}</span>` +
    `</span>` +
  `</a></article>`;

/* The home page is three strips that must not repeat a post
   between them. Split here exactly as listing.js splits at
   runtime, or the static and enhanced versions disagree. */
const leadPost = posts[0];
const homePool = posts.filter((p) => p !== leadPost);
const talks = homePool.filter((p) => p.tangent === 'Strangers').slice(0, 3);
const restPosts = homePool.filter((p) => !talks.includes(p)).slice(0, 6);

const staticCards = restPosts.map(staticCard).join('\n');
const staticTalks = talks.map(staticCard).join('\n');

/* ---- Go ---------------------------------------------------- */

console.log(`Building ${BRAND} for ${SITE}\n`);

/* Sweep out essays that no longer exist. Without this, deleting
   or renaming a post leaves its old page sitting there — still
   served, still linkable, still findable — long after it has
   gone from the manifest and the sitemap. */
{
  const dir = path.join(ROOT, 'essay');
  const live = new Set(posts.map((p) => p.slug));
  if (fs.existsSync(dir)) {
    for (const name of fs.readdirSync(dir)) {
      if (live.has(name)) continue;
      if (!fs.statSync(path.join(dir, name)).isDirectory()) continue;
      fs.rmSync(path.join(dir, name), { recursive: true, force: true });
      console.log(`  removed essay/${name}/ — no longer in the manifest`);
    }
  }
}

let totalWords = 0;
for (const p of posts) {
  const r = buildEssay(p);
  totalWords += r.words;
  console.log(`  essay/${p.slug}/`.padEnd(46) + `${String(r.words).padStart(5)} words, ${r.notes} notes`);
}

console.log('');
if (injectList('index.html', '<!--build:strangers-->', '<!--/build:strangers-->', staticTalks)) {
  console.log('  index.html'.padEnd(46) + `${talks.length} conversation${talks.length === 1 ? '' : 's'}`);
}
if (injectList('index.html', '<!--build:cards-->', '<!--/build:cards-->', staticCards)) {
  console.log('  index.html'.padEnd(46) + `${restPosts.length} crawlable cards`);
}
if (injectList('archive.html', '<!--build:rows-->', '<!--/build:rows-->', staticRows)) {
  console.log('  archive.html'.padEnd(46) + `${posts.length} crawlable rows`);
}

/* Origin-dependent head tags for the hand-written pages.
   An opaque plate, never the transparent cutout — platforms
   composite transparency onto black. */
const SOCIAL = [
  ['index.html', '/', 'assets/img/plate-overlook.webp',
    'Ink and wash drawing of a bearded man leaning on a fence above a red-roofed town.'],
  ['archive.html', '/archive.html', 'assets/img/plate-mountains.webp',
    'Ink and wash drawing of a bearded man in profile against clouded mountains.'],
  ['about.html', '/about.html', 'assets/img/plate-coffee.webp',
    'Ink and wash drawing of a bearded man in a cream field jacket drinking from a paper cup.']
];
for (const [file, p, img, alt] of SOCIAL) {
  if (injectMeta(file, p, img, alt)) {
    console.log(`  ${file}`.padEnd(46) + 'canonical + social card');
  }
}

/* sitemap */
const urls = [
  { loc: `${SITE}/`, pri: '1.0' },
  { loc: `${SITE}/archive.html`, pri: '0.6' },
  { loc: `${SITE}/about.html`, pri: '0.5' },
  //   { loc: `${SITE}/photos.html`, pri: '0.5' },   hidden for now
  ...posts.map((p) => ({ loc: `${SITE}/essay/${p.slug}/`, pri: '0.8', date: p.date }))
];
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url>
    <loc>${u.loc}</loc>${u.date ? `
    <lastmod>${u.date}</lastmod>` : ''}
    <priority>${u.pri}</priority>
  </url>`).join('\n')}
</urlset>
`);
console.log('  sitemap.xml'.padEnd(46) + `${urls.length} urls`);

/* robots */
write('robots.txt', `User-agent: *
Allow: /

# The runtime renderer serves the same shell for every essay.
# The real pages are under /essay/.
Disallow: /essay.html

Sitemap: ${SITE}/sitemap.xml
`);
console.log('  robots.txt'.padEnd(46) + 'written');

/* redirects — honoured by Netlify and Cloudflare Pages; other
   hosts need the equivalent rule, see the README. */
write('_redirects', posts.map((p) =>
  `/essay.html?p=${p.slug}  /essay/${p.slug}/  301`).join('\n') + '\n');
console.log('  _redirects'.padEnd(46) + `${posts.length} legacy urls`);

/* feed */
const rfc822 = (date, time) => new Date(`${date}T${time || '00:00'}:00Z`).toUTCString();

/* lastBuildDate is optional in RSS 2.0, and an empty blog has no
   newest post to date it by. Omitting the element is correct; the
   alternative — stamping the current time — would also rewrite
   feed.xml on every build whether or not anything had changed. */
const lastBuilt = posts.length
  ? `\n    <lastBuildDate>${rfc822(posts[0].date, posts[0].time)}</lastBuildDate>`
  : '';
write('feed.xml', `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${BRAND}</title>
    <link>${SITE}/</link>
    <atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml"/>
    <description>${esc(TAGLINE)}</description>
    <language>en</language>${lastBuilt}
    <generator>tools/build.js</generator>
${posts.map((p) => `    <item>
      <title>${esc(p.title)}</title>
      <link>${SITE}/essay/${p.slug}/</link>
      <guid isPermaLink="true">${SITE}/essay/${p.slug}/</guid>
      <pubDate>${rfc822(p.date, p.time)}</pubDate>
      <category>${esc(p.tangent)}</category>
      <description>${esc(p.dek)}</description>
    </item>`).join('\n')}
  </channel>
</rss>
`);
console.log('  feed.xml'.padEnd(46) + `${posts.length} items`);

console.log(`\nDone. ${totalWords.toLocaleString('en-GB')} words now in static HTML.`);
