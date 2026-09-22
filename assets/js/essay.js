/* ============================================================
   ESSAY — the reading view

   Runs in one of two modes.

   PRE-RENDERED (/essay/<slug>/, built by tools/build.js)
     The prose is already in the HTML. Nothing is fetched; this
     file only adds behaviour — typesetting the mathematics,
     laying out the margin, the progress bar, quote links.

   RUNTIME (essay.html?p=<slug>)
     Fetches the markdown and renders it. This is what you get
     during local editing before running a build, and what any
     older link still resolves to. It points a canonical at the
     pre-rendered URL so the two don't compete.

   Either way the same code does the four things that make the
   margin apparatus work:

     · anchors every note beside the line that summons it
     · stops two notes from landing on top of each other
     · re-runs the layout when the text reflows
     · folds the apparatus inline when the rail is gone
   ============================================================ */

(function () {
  'use strict';

  var prose = document.getElementById('prose');
  var head = document.getElementById('essay-head');
  if (!prose) return;

  var baked = document.body.getAttribute('data-prerendered');
  var slug = baked || new URLSearchParams(location.search).get('p');

  /* Everything that is behaviour rather than content. Runs in
     both modes, once the prose is on the page. */
  function enhance() {
    if (window.TP.md && window.TP.md.typeset) window.TP.md.typeset(prose);
    wireEmbeds();
    if (window.TP.sway) window.TP.sway();
    window.TP.margin.init(prose);
    progress();
    quoteToLink();
    highlightQuoted();
  }

  if (baked) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', enhance);
    } else {
      enhance();
    }
    return;
  }

  /* ---- Load (runtime mode only) --------------------------- */

  function fail(message) {
    document.title = 'Not on the shelf — The Tipsy Professor';
    setMeta('description', 'No essay at this address.');
    if (head) {
      head.innerHTML =
        '<p class="dateline"><span>Nothing poured</span></p>' +
        '<h1>That essay isn’t on the shelf</h1>' +
        '<p class="dek">' + message + '</p>';
    }
    prose.innerHTML =
      '<p>Try <a href="archive.html">the full run</a>, or go back to ' +
      '<a href="index.html">the press</a>. The dial in the corner still works, ' +
      'for whatever that is worth.</p>';
  }

  if (!slug || !/^[a-z0-9-]+$/i.test(slug)) {
    fail('No essay was named in the address, or the name had characters I don’t accept.');
    return;
  }

  Promise.all([
    fetch('posts/' + slug + '.md').then(function (r) {
      if (!r.ok) throw new Error('missing');
      return r.text();
    }),
    fetch('posts/posts.json').then(function (r) { return r.ok ? r.json() : []; })
      .catch(function () { return []; })
  ]).then(function (res) {
    render(res[0], res[1] || []);
  }).catch(function () {
    fail('There’s no file behind that name. It may have been renamed, or never written.');
  });

  /* ---- Render --------------------------------------------- */

  function render(source, manifest) {
    var doc = window.TP.md.parse(source);
    var meta = doc.meta;
    var entry = manifest.filter(function (p) { return p.slug === slug; })[0] || {};

    var title = meta.title || entry.title || 'Untitled';
    var place = meta.place || entry.place || '';
    var time = meta.time || entry.time || '';
    var pours = meta.pours || entry.pours || '';
    var tangent = meta.tangent || entry.tangent || '';
    var dek = meta.dek || entry.dek || '';

    document.title = title + ' — The Tipsy Professor';
    setMeta('description', dek);

    // Point search engines at the pre-rendered copy so this
    // query-string URL doesn't compete with it.
    var canon = document.createElement('link');
    canon.rel = 'canonical';
    canon.href = location.origin + '/essay/' + encodeURIComponent(slug) + '/';
    document.head.appendChild(canon);

    var guest = meta.with || entry.with || '';

    // The section's second ink, applied to the whole page.
    if (tangent) document.body.setAttribute('data-tangent', tangent);
    if (doc.video && doc.video.id) document.body.setAttribute('data-hero', '');
    if (window.TP.markNav) window.TP.markNav();

    if (head) {
      // A reading context gets the hour it was finished — unless
      // it's a conversation, where the hour is nobody's business.
      head.innerHTML =
        window.TP.dateline.render(
          {
            place: place, date: meta.date || entry.date, time: time,
            pours: pours, tangent: tangent,
            with: guest, met: meta.met || entry.met || ''
          },
          { time: !guest, tangent: true, link: true }
        ) +
        '<h1>' + esc(title) + '</h1>' +
        (dek ? '<p class="dek">' + esc(dek) + '</p>' : '');
    }

    // The hero video and the catalogue slip come from front
    // matter, not the body, so they always land in the same
    // place and the prose stays prose.
    prose.innerHTML =
      window.TP.md.videoHero(doc.video) +
      window.TP.md.subjectCard(doc.subject) +
      doc.html;

    relatedTo(entry, manifest);
    offprintSlug(title);
    enhance();
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function setMeta(name, content) {
    if (!content) return;
    var tag = document.querySelector('meta[name="' + name + '"]');
    if (tag) tag.setAttribute('content', content);
  }

  /* ---- Video ----------------------------------------------
     The facade is swapped for a real player only here, on a
     deliberate press. Until then the page has made no third-
     party request at all.                                     */

  function wireEmbeds() {
    Array.prototype.forEach.call(prose.querySelectorAll('.embed__poster'), function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-id');
        var provider = btn.getAttribute('data-provider');

        var start = parseInt(btn.getAttribute('data-start'), 10) || 0;

        var frame = document.createElement('iframe');
        frame.src = provider === 'vimeo'
          ? 'https://player.vimeo.com/video/' + encodeURIComponent(id) +
            '?autoplay=1&dnt=1' + (start ? '#t=' + start + 's' : '')
          : 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) +
            '?autoplay=1&rel=0' + (start ? '&start=' + start : '');
        frame.title = btn.querySelector('.embed__title').textContent;
        frame.allow = 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen';
        frame.setAttribute('allowfullscreen', '');
        frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');

        btn.parentNode.replaceChild(frame, btn);
        frame.focus();
      });
    });
  }

  /* ---- Reading progress ------------------------------------ */

  function progress() {
    var bar = document.querySelector('.progress__bar');
    if (!bar) return;

    var ticking = false;
    function update() {
      var box = prose.getBoundingClientRect();
      var total = box.height - window.innerHeight;
      var done = total > 0 ? (-box.top) / total : (box.top <= 0 ? 1 : 0);
      bar.style.width = (Math.min(1, Math.max(0, done)) * 100).toFixed(2) + '%';
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  /* ---- Quote to link ---------------------------------------
     Opinion pieces get quoted. Make the quote carry its own
     way back.                                                 */

  function quoteToLink() {
    var pop = document.createElement('div');
    pop.className = 'quotelink';
    pop.innerHTML = '<button type="button" class="btn btn--wide">copy link to quote</button>';
    document.body.appendChild(pop);

    var btn = pop.querySelector('button');
    var held = '';

    function hide() { pop.setAttribute('data-open', 'false'); }

    document.addEventListener('selectionchange', function () {
      var sel = document.getSelection();
      if (!sel || sel.isCollapsed) { hide(); return; }

      var text = sel.toString().trim().replace(/\s+/g, ' ');
      if (text.length < 12) { hide(); return; }
      if (!prose.contains(sel.anchorNode) || !prose.contains(sel.focusNode)) { hide(); return; }

      held = text;
      var r = sel.getRangeAt(0).getBoundingClientRect();
      pop.style.left = (r.left + r.width / 2 + window.scrollX) + 'px';
      pop.style.top = (r.top + window.scrollY - 10) + 'px';
      pop.setAttribute('data-open', 'true');
      btn.textContent = 'copy link to quote';
    });

    btn.addEventListener('click', function () {
      var snippet = held.slice(0, 300);
      // A pre-rendered essay already lives at its own path; the
      // runtime page still needs the slug in the query.
      var base = location.origin + location.pathname +
        (baked ? '?' : '?p=' + encodeURIComponent(slug) + '&');
      var url = base +
        'q=' + encodeURIComponent(snippet) +
        '#:~:text=' + encodeURIComponent(snippet.slice(0, 160));

      var done = function () {
        btn.textContent = 'copied';
        setTimeout(hide, 900);
      };

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(done, function () {
          btn.textContent = 'press ⌘C';
        });
      } else {
        btn.textContent = 'press ⌘C';
      }
    });

    document.addEventListener('scroll', hide, { passive: true });
  }

  /* Arriving from someone else's quote link. */
  function highlightQuoted() {
    var q = new URLSearchParams(location.search).get('q');
    if (!q) return;

    var needle = q.trim().replace(/\s+/g, ' ').slice(0, 120);
    var walker = document.createTreeWalker(prose, NodeFilter.SHOW_TEXT);
    var node;

    while ((node = walker.nextNode())) {
      var at = node.nodeValue.indexOf(needle);
      if (at === -1) continue;

      var range = document.createRange();
      range.setStart(node, at);
      range.setEnd(node, at + needle.length);
      var mark = document.createElement('mark');
      mark.className = 'quoted';
      try { range.surroundContents(mark); } catch (e) { return; }

      mark.scrollIntoView({ block: 'center', behavior: 'auto' });
      return;
    }

    // The snippet spans several elements; settle for the block.
    var first = needle.split(' ').slice(0, 5).join(' ');
    var blocks = prose.querySelectorAll('p, li, blockquote');
    for (var i = 0; i < blocks.length; i++) {
      if (blocks[i].textContent.indexOf(first) !== -1) {
        blocks[i].scrollIntoView({ block: 'center', behavior: 'auto' });
        return;
      }
    }
  }

  /* ---- Related --------------------------------------------- */

  function relatedTo(entry, manifest) {
    var host = document.getElementById('related');
    if (!host || !manifest.length) return;

    var others = manifest.filter(function (p) { return p.slug !== slug; });
    var same = others.filter(function (p) { return p.tangent === entry.tangent; });
    var pool = same.concat(others.filter(function (p) { return same.indexOf(p) === -1; }));
    var picks = pool.slice(0, 3);
    if (!picks.length) return;

    host.innerHTML =
      '<div class="head-rule"><h2>Also poured</h2>' +
      '<p>' + (same.length ? 'filed under ' + esc(entry.tangent || '') : 'most recent') + '</p></div>' +
      '<ul class="run">' + picks.map(function (p) {
        return '<li><a href="/essay/' + encodeURIComponent(p.slug) + '/">' +
          window.TP.dateline.render(p, {}) +
          '<span class="run__title">' + esc(p.title) + '</span>' +
          '<span class="run__dek">' + esc(p.dek || '') + '</span>' +
        '</a></li>';
      }).join('') + '</ul>';
  }

  /* ---- Offprint -------------------------------------------- */

  function offprintSlug(title) {
    var el = document.getElementById('offprint');
    if (!el) return;
    el.textContent = title + ' · The Tipsy Professor · ' +
      location.origin + location.pathname + '?p=' + slug;
  }
})();
