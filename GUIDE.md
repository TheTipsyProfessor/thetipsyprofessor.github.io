# Running The Tipsy Professor

A working guide: how to write a post and get it on screen, and how to put the
whole thing on GitHub Pages at `thetipsyprofessor.com`.

`README.md` is the reference — every field, every piece of syntax, why each
design decision was made. This is the walkthrough. Where something is covered in
depth there, this points at it instead of repeating it.

---

## What you are actually running

Plain files, plus one Node script you run before publishing. There is no
framework, no `package.json`, no dependency to install, and nothing to keep
updated. `node tools/build.js` turns the markdown in `posts/` into finished HTML
pages in `essay/`, and writes the sitemap, the feed and the social cards.

That means the folder on your disk **is** the website. Whatever is in it is what
gets served. Nothing is assembled on a server.

Requires Node (built and tested on v22; anything from v18 up is fine) and any
static file server for local previewing.

---

# Part 1 — Day to day

## Start the local server

`fetch()` doesn't work over `file://`, so opening `index.html` by double-clicking
it will show a page with no essays on it. Serve the folder instead:

```sh
cd /Users/amitabh/Documents/Static_amitabh.ch
python3 -m http.server 8777
```

Then open <http://localhost:8777>. Leave it running in its own terminal tab.

> If you edit CSS or JS and the change doesn't appear, the browser has cached the
> old file. Hard-reload with **⌘⇧R**.

## Write a post

**1. Create `posts/your-slug.md`.** The slug is the URL, so keep it lowercase
with hyphens. Start with the front matter block:

```markdown
---
title: The Harbour Was a Rumour
dek: One sentence that makes someone want to read it.
place: Reykjavík
time: 02:14
date: 2026-09-14
tangent: Explained
pours: 3
image: assets/img/plate-mountains.webp
imageAlt: Ink and wash drawing of a bearded man in profile against clouded mountains.
keywords: iceland harbour night walking insomnia
---

Your first paragraph gets the drop cap automatically.
```

`tangent` must be one of **Explained · Overheard · Arguments ·
Strangers**. `pours` is the reading length — one pour is about six minutes.

For an interview or a review there are five more fields (`with`, `met`,
`speakers`, `video`, `subject`) — see *Guest pieces* in `README.md`.

**2. Add the same post to `posts/posts.json`, newest first.** This is the one
piece of bookkeeping the site asks of you. The markdown drives the essay page;
this file drives the home page, the archive, the search and the shuffle. Copy an
existing entry and edit it — the keys are identical to the front matter.

**3. Read the draft** at `http://localhost:8777/essay.html?p=your-slug`. This
renders in the browser, so it needs no build and updates on reload. It is how
you write.

**4. Build** when you're happy:

```sh
node tools/build.js
```

Now `http://localhost:8777/essay/your-slug/` exists — that is the real, published
page, and the one every link points at.

> **Until you build, the post has no page.** Cards linking to it will 404. This
> is the single easiest mistake to make; see *Publishing a new essay* in Part 2
> for the habit that prevents it.

## Add photographs

The shoebox (`photos.html`) is a wall of prints read from
`photos/photos.json`.

1. Put the originals — JPEG, HEIC, PNG or TIFF, straight off the
   phone — in `photos/originals/`. Git ignores that folder: phone
   JPEGs carry the GPS position they were taken at.
2. Run `node tools/optimize-photos.js`. For each photo it writes
   `photos/<name>.webp` (2200px, for the viewer) and
   `photos/<name>-sm.webp` (900px, for the wall), turns sideways
   phone shots upright, strips all metadata, and adds an entry to
   `photos.json` with the size and the date the camera recorded.
3. Fill in `caption`, `alt`, and optionally `place`, in
   `photos.json`. Order in the file is order on the wall.

```json
{ "file": "cusco-railing", "w": 2200, "h": 1650,
  "caption": "The line on the back of the print.",
  "alt": "What is actually in the picture.",
  "place": "Cusco", "date": "2025-03-14" }
```

`date` takes `2025`, `2025-03` or `2025-03-14`. A link to
`photos.html#photo-<file>` opens that print directly.

## What the build refuses to do

It stops, loudly, rather than publishing something broken:

- two posts with the same slug
- a slug that collides with a real file (`about`, `archive`, …)
- a post in `posts.json` with no markdown file
- an `image` that isn't there
- an `image` with no `imageAlt`
- a post with no `dek`
- **two posts sharing a plate** — no illustration is ever reused

It also sweeps `essay/` for folders whose post you deleted, so removing a post
from `posts.json` and rebuilding genuinely unpublishes it.

Posts still waiting on artwork are listed under *Waiting on artwork* every time
it runs. They aren't broken — their cards set two initials in the two inks
instead, which is the house "not drawn yet" state.

## Checking your markdown

```sh
node tools/test-md.js
```

Parses every post and reports what each one actually produced — notes, asides,
pull quotes, embeds, figures, tables, maths, other scripts. If you wrote a margin
note and it reports `0 notes`, the syntax didn't take.

## The syntax, briefly

Everything standard works. The house additions:

| You write | You get |
|---|---|
| `^[a note]` | margin note; folds inline on a narrow screen |
| `::: aside` … `:::` | the professor interrupts, in the rail |
| `::: pull` … `:::` | pull quote breaking the measure |
| `::: exchange` … `:::` | an interview, speaker labels in the rail |
| `@[youtube](ID "Title")` | click-to-load player — nothing reaches YouTube until pressed |
| `$x^2$` · `$$…$$` | mathematics, via KaTeX |
| `:ja[日本語]` | a run set in a face drawn for that script |
| `![alt](src "Caption"){wide 1086x1448}` | a captioned plate |

**Always give image dimensions.** Without them the browser reserves no space, the
page jumps when the image lands, and every margin note has to be re-placed.

Full reference and the reasoning behind each: `README.md`.

---

# Part 2 — Deploying to GitHub Pages

## First, the constraint that decides your setup

The built essay pages use **root-relative paths** — `/assets/css/tokens.css`,
`/essay/against-cairns/`. They have to: a page living at `/essay/<slug>/` can't
reach the stylesheet with a relative path without climbing out of its own folder.

So the site must be served from the **root of a domain**. In GitHub Pages terms
there are exactly two arrangements that work:

| Setup | Serves at | Works |
|---|---|---|
| Repo named `<username>.github.io` | `https://<username>.github.io/` | ✅ |
| Any repo name **+ a custom domain** | `https://thetipsyprofessor.com/` | ✅ |
| Any repo name, no custom domain | `https://<username>.github.io/<repo>/` | ❌ |

The third serves the site from a subdirectory. The home page will half-work and
every essay will 404, because `/assets/…` resolves to the domain root, which
isn't where the site is. Don't spend an afternoon debugging it — pick one of the
first two.

Since you own `thetipsyprofessor.com`, **use a normal repo plus the custom
domain**. The instructions below do that.

## Step 1 — Make it a repository

It isn't one yet:

```sh
cd /Users/amitabh/Documents/Static_amitabh.ch
git init -b main
```

## Step 2 — Three files that are already here

These exist at the root of the folder. Don't delete them, and do commit them.

**`.gitignore`** — a Pages repo on the free plan is **public**, and anything
committed stays in the git history even after a later commit deletes it. So this
keeps things out rather than trying to take them back out: `.DS_Store`,
documents (`*.pdf`, `*.docx`, `*.pages`), secrets (`.env`, `*.key`, `*.pem`) and
logs. Documents are excluded **by extension on purpose** — so the next CV or
contract dropped in this folder is covered without anyone having to remember.

**`.nojekyll`** — empty, and it must stay empty. GitHub runs every branch-based
deploy through Jekyll, which silently skips files and folders beginning with an
underscore. This site ships `_redirects`. The file turns Jekyll off entirely.

**`CNAME`** — contains `thetipsyprofessor.com` and nothing else: no scheme, no
`www`, no trailing slash. This is what claims the domain.

> ⚠️ **Check the folder for documents before the first commit.** Anything you
> leave here is published at `thetipsyprofessor.com/<filename>` and indexed. The
> `*.pdf` rule covers the obvious case, but it only helps for files that are
> still uncommitted.

## Step 3 — Build, commit, push

```sh
node tools/build.js
git add -A
git commit -m "The Tipsy Professor"
```

Create an empty repository on GitHub — **no** README, .gitignore or licence, or
the first push will conflict — then:

```sh
git remote add origin https://github.com/<username>/<repo>.git
git push -u origin main
```

## Step 4 — Turn Pages on

In the repository: **Settings → Pages**.

- **Source:** *Deploy from a branch*
- **Branch:** `main`, folder `/ (root)`
- Save.

Give it a minute or two for the first build.

## Step 5 — Point the DNS at GitHub

At whoever manages `thetipsyprofessor.com`, for the apex domain:

| Type | Name | Value |
|---|---|---|
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |

All four, as four separate records. Optionally add IPv6:

| Type | Name | Value |
|---|---|---|
| AAAA | `@` | `2606:50c0:8000::153` |
| AAAA | `@` | `2606:50c0:8001::153` |
| AAAA | `@` | `2606:50c0:8002::153` |
| AAAA | `@` | `2606:50c0:8003::153` |

And so `www` reaches it too:

| Type | Name | Value |
|---|---|---|
| CNAME | `www` | `<username>.github.io.` |

Then in **Settings → Pages → Custom domain**, enter `thetipsyprofessor.com` and
save. GitHub will verify the records; this can take anywhere from a few minutes
to a few hours depending on your registrar's TTL.

## Step 6 — HTTPS

Once the domain verifies, the **Enforce HTTPS** checkbox on the same settings
page becomes available. Tick it. GitHub issues and renews the certificate; there
is nothing to buy or configure.

The checkbox stays greyed out until the certificate is issued — if it's still
grey after an hour, the DNS hasn't fully propagated yet.

## Step 7 — Check it landed

```sh
curl -sI https://thetipsyprofessor.com/ | head -1
curl -sI https://thetipsyprofessor.com/essay/against-cairns/ | head -1
curl -s  https://thetipsyprofessor.com/sitemap.xml | head -3
```

Two `200`s and a sitemap means you're live. Then open the site and confirm the
illustrations load — a broken plate is the symptom of a subdirectory deploy.

---

## Publishing a new essay, from then on

```sh
node tools/build.js          # ← the step people forget
git add -A
git commit -m "Essay: The Harbour Was a Rumour"
git push
```

Live in a minute or so.

**Build before you commit, every time.** If you push without building, the post
exists in `posts.json` — so it appears on the home page and in the archive — but
`/essay/<slug>/` was never written, and every card pointing at it 404s. It looks
exactly like a broken site rather than a missing build.

If you'd rather not have to remember, see the next section.

## Optional: let GitHub run the build

This removes the forget-to-build failure entirely: you commit markdown, and the
published HTML is generated on GitHub. Create
`.github/workflows/deploy.yml`:

```yaml
name: Build and deploy
on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - run: node tools/build.js
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: .
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

Then change **Settings → Pages → Source** to *GitHub Actions*.

Keep committing the built `essay/` folder anyway. It costs nothing, it keeps the
repository a complete working copy of the site, and it means you can go back to
plain branch deploys — or to any other host — without changing a thing.

Trade-off worth knowing: this adds a dependency on GitHub's build servers to a
site whose entire premise is not depending on tooling. Both approaches are
legitimate. The manual one is more in keeping; this one is harder to get wrong.

---

# Part 3 — What GitHub Pages changes

Everything works, with one degradation and a few facts worth knowing.

**`_redirects` does nothing here.** The build writes it, but it is a Netlify and
Cloudflare Pages format — GitHub Pages ignores it, and has no server-side
redirect mechanism at all.

What it would have done is 301 the old `essay.html?p=<slug>` URLs to
`/essay/<slug>/`. Without it those URLs still *work* — `essay.html` renders the
essay in the browser and sets a canonical link pointing at the built page, so
search engines credit the right URL and readers see the right essay. You lose the
redirect, not the content. Leave the file; it costs nothing and it's correct
again the moment you move hosts.

**`404.html` works** — GitHub Pages picks it up automatically.

**The repo must be public** for Pages on the free plan. Pages from a private
repository needs a paid plan.

**There is no server**, so nothing that needs one will ever work here: no forms,
no email subscriptions, no comments, no server-side redirects. All of those need
a third-party service if you want them.

**The domain lives in two places now** — `SITE` at the top of `tools/build.js`
(which writes every canonical URL, the sitemap and the social cards) and the
`CNAME` file. If you ever change domains, change both.

---

# Part 4 — Pre-flight checklist

Before the first push:

- [ ] No documents left loose in the folder — anything here gets published
- [ ] `.gitignore`, `.nojekyll` and `CNAME` are committed, not just present
- [ ] `node tools/build.js` ran clean, with no errors
- [ ] `node tools/test-md.js` reports every post parsing clean
- [ ] Repo is named `<username>.github.io`, **or** the custom domain is set
- [ ] Placeholder video IDs replaced — some sample posts still embed Big Buck
      Bunny and a Vimeo demo reel
- [ ] `tipsy@amitabh.ch` actually routes somewhere you read

---

# Part 5 — When something is wrong

| What you see | What it is |
|---|---|
| Home page loads, every essay 404s | Subdirectory deploy. Set the custom domain, or rename the repo to `<username>.github.io`. |
| No styling at all, just text | Same cause — `/assets/…` isn't resolving. |
| A card 404s but others are fine | That post was added to `posts.json` and never built. Run `node tools/build.js`. |
| "The index of essays didn't load" | You opened the files over `file://`. Serve them: `python3 -m http.server 8777`. |
| Build stops on a duplicate plate | Two posts point at the same illustration. Every post gets its own. |
| Changes don't appear after a push | Pages takes a minute. Then hard-reload — **⌘⇧R**. |
| **Enforce HTTPS** greyed out | DNS hasn't propagated. Wait, then re-check the four A records. |
| Console: `Transition was aborted — Viewport size changed` | Harmless. The window was resized mid-navigation. Documented in `README.md`. |

---

## Where things live

```
index.html        the press — masthead, lead essay, the tipsy grid
archive.html      the full run — searchable, filterable
about.html        who's buying
photos.html       the shoebox — a wall of prints, from photos/photos.json
essay.html        runtime renderer (?p=slug) — for reading drafts
404.html

essay/<slug>/     the published essays                    ← built, commit these
feed.xml  sitemap.xml  robots.txt  _redirects             ← built

posts/            posts.json + one .md per essay          ← what you edit
assets/css/       tokens · base · layout · components
assets/js/        prefs · grid · md · margin · essay · listing · peek · dateline
assets/img/       the illustrations
tools/            build.js · test-md.js
```

Never hand-edit anything in `essay/` — the next build overwrites it. Never edit
between the `<!--build:… -->` markers in `index.html`, `archive.html` or
`about.html` for the same reason.
