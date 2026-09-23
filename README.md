# The Tipsy Professor

A static blog. No framework and no npm dependencies — one Node script, run before
deploying, turns the markdown into real HTML pages.

This file is the reference. For a step-by-step walkthrough — writing a post, and
putting the site on GitHub Pages at a custom domain — see **[GUIDE.md](GUIDE.md)**.

```
index.html      the press — masthead, lead essay, the tipsy grid
archive.html    the full run — searchable, filterable
about.html      about
404.html
essay.html      runtime renderer (?p=slug) — local editing + legacy links
essay/<slug>/   the real, published essays        ← built
feed.xml  sitemap.xml  robots.txt  _redirects     ← built
assets/css/     tokens · base · layout · components
assets/js/      prefs · grid · md · margin · essay · listing
assets/img/     the illustrations
posts/          posts.json + one .md per essay
tools/          build.js, test-md.js
```

## Running it

`fetch()` is blocked on `file://`, so use any static server:

```sh
python3 -m http.server 8777
# then open http://localhost:8777
```

## Publishing

```sh
node tools/build.js
```

The origin defaults to `https://thetipsyprofessor.com` (set at the top of
`tools/build.js`); pass a different one as the first argument to build for a
staging domain. That one command pre-renders every essay to `essay/<slug>/index.html` with its own
title, description, Open Graph card and canonical URL, injects a crawlable list of
essays into the home and archive pages, and writes `sitemap.xml`, `robots.txt`,
`_redirects` and `feed.xml`. Then upload the folder.

It renders using `assets/js/md.js` — the same parser the browser uses — so the
static and runtime output cannot drift apart. It refuses to build on a duplicate
slug, a slug that collides with a site file, a missing markdown file, a missing
image, an image without alt text, or a post with no dek.

**Deploy at a domain root.** Built pages use root-relative paths (`/assets/…`), so
a subdirectory deploy would break them.

**Two URLs per essay, deliberately.** `/essay/<slug>/` is the real one — canonical,
linked from everywhere, no fetch or parse. `essay.html?p=<slug>` still renders at
runtime so you can read a draft before building, and so old links survive; it sets
a canonical pointing at the built page, `robots.txt` disallows it, and `_redirects`
301s it (Netlify and Cloudflare Pages honour that file directly). On nginx:

```nginx
if ($arg_p ~ "^[a-z0-9-]+$") { return 301 /essay/$arg_p/; }
```

Point your host's 404 handler at `404.html`.

## Writing a new essay

**1. Create `posts/your-slug.md`** with front matter:

```markdown
---
title: The Harbour Was a Rumour
dek: One sentence that makes someone want to read it.
place: Reykjavík
time: 02:14
date: 2026-09-14
tangent: Explained       # Explained | Overheard | Arguments | Strangers
pours: 3                  # reading length; 1 pour ≈ 6 minutes
image: assets/img/x.png   # optional — omit and the card sets type instead
imageAlt: Describe it.    # required whenever image is set
keywords: words for search
---

Your first paragraph gets the drop cap automatically.
```

**2. Add the same entry to `posts/posts.json`**, newest first. That file drives the
home page, the archive, search and the shuffle. The markdown front matter drives the
essay page itself; keeping them in step is the one piece of bookkeeping here.

**3. Build**: `node tools/build.js`

Until you build, the new essay has no page — cards linking to it will 404. Read the
draft at `essay.html?p=your-slug` in the meantime.

## The house markdown dialect

Everything standard works — headings, lists, tables, blockquotes, links, fenced
code, `**bold**`, `*italic*`. Plus:

| You write | You get |
|---|---|
| `^[a note]` | margin note beside that line; folds inline on narrow screens |
| `::: aside` … `:::` | "the professor interrupts" — a voice note in the rail |
| `::: pull` … `:::` | pull quote breaking the measure; a final `— name` line becomes a cite |
| `@[youtube](ID "Title")` | click-to-load player; nothing hits YouTube until pressed |
| `@[vimeo](ID "Title")` | same, for Vimeo |
| `$x^2$` / `$$…$$` | inline / display mathematics via KaTeX |
| `:ja[日本語]` | a run tagged with its language and set in a face drawn for it |
| `![alt](src "Cap"){wide 1086x1448}` | captioned plate — `wide`, `bleed`, and the pixel size |

Notes on the last two:

- **Language tags** take any BCP-47 code — `:hi[…]`, `:ar[…]`, `:el[…]`, `:is[…]`.
  RTL scripts are isolated automatically. Add a stack for a new script in
  `assets/css/tokens.css` under `--script-*`.
- **Always give image dimensions.** Without them the browser reserves no space, the
  essay jumps when the image lands, and the margin notes have to be re-laid.

Run `node tools/test-md.js` after writing — it parses every post and checks the
custom syntax actually became markup.

## Guest pieces — interviews and reviews

Interviews live in **Strangers**. Reviews of films and books live in
**Arguments** alongside everything else he argues with — a review is an argument
about someone else's work, and the `subject:` slip already distinguishes it.
Both use the same machinery, because both are just *more than one person talking*.

```markdown
---
title: The Eleven-Minute Universe
with: Dr Rhea Kulkarni, radio astronomer
met: Utrecht
tangent: Strangers
speakers: TP = The Professor | RK = Dr Rhea Kulkarni
video: youtube | dQw4w9WgXcQ | The full conversation, 58 minutes
subject: film | Stalker | Andrei Tarkovsky | 1979
---

::: exchange
TP: Did you actually believe it at the time?

RK: I believed it the way you believe a timetable.
:::
```

| Field | Does what |
|---|---|
| `with:` | the guest — leads the dateline, and suppresses the hour |
| `met:` | where you met, used instead of where it was written |
| `speakers:` | maps the short code to a display name; `Name, role` splits |
| `video:` | hero video, placed automatically under the title |
| `subject:` | catalogue slip for the thing being reviewed |

**Speaker names render into the margin rail, not inline.** The text column stays a
clean single measure and the reading rhythm never breaks for a bolded name. Each
speaker keeps one ink for the whole piece — `md.js` assigns the voice by order of
first appearance, so an aside landing between two turns can't shift the colours.
Consecutive turns by the same person drop the label. Labels go through the same
collision pass as the footnotes, so the two can never overlap.

**The video is a frontmatter field, not a body line.** That guarantees it lands
directly under the title on every guest page and keeps the markdown body pure
description. It renders as the same click-to-load facade as any other embed —
nothing reaches YouTube until the reader presses play — and the build emits
`VideoObject` structured data so search results can carry a thumbnail.

**No scores.** *Against the Highlight Reel* argues against reporting the numerator;
a star rating three cards away would contradict your own writer.

## Plates

Every post gets its own illustration and **no plate is ever reused**. The build
enforces this: two posts sharing an `image` is a hard error, not a warning.

A post with no plate yet isn't broken — its card sets two initials in the two inks,
slightly out of register, which is the "waiting on artwork" state. The build lists
those under *Waiting on artwork* each time it runs.

## The dateline

Four facts, rendered two ways by `assets/js/dateline.js` — one implementation,
used by the browser and by the build, so they can't drift.

```
scanning   REYKJAVÍK · 14 SEP 2026 · 3 POURS · EXPLAINED     cards, archive, related
reading    REYKJAVÍK · 14 SEP 2026, 02:14 · 3 POURS · EXPLAINED   the essay page
```

A card is answering *is this new, what order am I in*, so it gets the date. An essay
has already been chosen, so it can afford the hour it was finished — which is the
point of the thing, and only means anything once you're inside.

The month is spelled because `05.06.2026` is two different days depending on who is
reading. The machine-readable form rides along in `<time datetime="2026-09-14T02:14">`,
which is also what puts a date next to the result in search listings.

The middot is drawn by CSS as an `::after` on each item but the last. As its own
element it wraps onto the next line and sits there alone the moment the column gets
narrow — which it does, in the archive's left column, constantly.

## The dial

One control drives everything: `--tipsy`, 0 to 1. At 0 the page is a plain square
grid with the two ink plates in perfect register and Fraunces at `WONK 0`. At 1 the
grid sways, the plates separate, and the letterforms loosen. Every angle comes from
a hash of the element's index, so the layout is identically askew on every load.

`prefers-reduced-motion` pins it to 0 before first paint and disables the slider.

To change the house setting, edit the default in `assets/css/tokens.css` (`--tipsy`)
and the matching fallback in each page's inline `<head>` script.

## Keyboard

`t` edition · `+` `−` text size · `s` sober/tipsy · `/` search · `r` random essay

## Things worth knowing

- **Placeholder video IDs.** The sample essays embed Big Buck Bunny and a Vimeo demo
  reel. Swap them for real ones.
- **The domain lives in one place** — `SITE` at the top of `tools/build.js`. It
  feeds every canonical URL, the sitemap, the feed and all the social cards. The
  hand-written pages carry no origin at all; the build writes theirs between the
  `<!--build:meta-->` markers in their `<head>`, so don't edit inside those.
- **Social cards use a plate, never the transparent cutout** — platforms
  composite transparency onto black. The illustrations are portrait (1086×1448),
  so X will crop them to a landscape band; Slack, WhatsApp and iMessage show them
  closer to full. A purpose-made 1200×630 card would preview better on X if that
  ever matters.
- **Mathematics is typeset in the browser.** The build writes the TeX source into
  the HTML and KaTeX upgrades it on load — so the expressions are real text for
  crawlers, and still legible if the CDN is ever blocked.
- **Fonts come from Google Fonts**, KaTeX from jsDelivr (both pinned with subresource
  integrity). To go fully self-hosted, download the woff2 files into `assets/font/`
  and replace the two `<link>` tags.
- **`@view-transition` can log a benign console error** (`Transition was aborted…
  Viewport size changed`) if the window is resized mid-navigation. It's browser-
  generated and harmless; delete the `@view-transition` rule in `layout.css` if you'd
  rather not see it.
