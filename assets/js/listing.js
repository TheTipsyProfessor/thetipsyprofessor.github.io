/* ============================================================
   LISTING — the press (home) and the full run (archive)

   One file, two pages. It renders whichever containers it
   finds and ignores the rest.

     #lead    the most recent essay, run large
     #feed    cards on the tipsy grid
     #run     the dense index, searchable and filterable
   ============================================================ */

(function () {
  'use strict';

  var lead = document.getElementById('lead');
  var feed = document.getElementById('feed');
  var run = document.getElementById('run');
  var strangersBox = document.getElementById('strangers');
  var strangersSection = document.getElementById('strangers-section');
  if (!lead && !feed && !run) return;

  var searchBox = document.querySelector('.search input');
  var filterBox = document.getElementById('filters');
  var countBox = document.getElementById('count');
  var emptyBox = document.getElementById('empty');

  var all = [];
  var tangent = new URLSearchParams(location.search).get('t') || '';
  var query = '';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function attr(s) { return esc(s).replace(/"/g, '&quot;'); }

  /* Point at the pre-rendered page, not the runtime renderer:
     it is the canonical URL and it needs no fetch or parse.
     Written by tools/build.js — run a build after adding a post
     or the new card will lead nowhere. */
  function href(p) { return '/essay/' + encodeURIComponent(p.slug) + '/'; }

  /* Both of these are scanning contexts, so they get the date
     and not the hour. See assets/js/dateline.js. */
  function dateline(p, withTangent) {
    return window.TP.dateline.render(p, { tangent: !!withTangent });
  }

  /* "The Professor" + "Dr Rhea Kulkarni" → ["TP", "RK"].
     Returns null for a piece with no guest. */
  function initialsFor(p) {
    if (!p.with) return null;
    var of = function (s) {
      return String(s || '').replace(/^(Dr|Prof|Professor|Mr|Ms|Mrs)\.?\s+/i, '')
        .split(/\s+/).filter(Boolean).slice(0, 2)
        .map(function (w) { return w.charAt(0).toUpperCase(); }).join('');
    };
    return ['TP', of(p.with.split(',')[0]) || '?'];
  }

  /* A post without a plate gets a printed panel instead of a
     borrowed photograph — better than reusing someone else's
     illustration for an essay it has nothing to do with.

     The panel must be opaque and sit inside the figure: the
     figure's two ink layers are painted above its own
     background, so anything translucent lets them through.   */
  function plate(p) {
    if (p.image) {
      return '<figure class="card__plate">' +
        '<img src="' + attr(p.image) + '" alt="' + attr(p.imageAlt || '') + '" loading="lazy" decoding="async">' +
        '</figure>';
    }
    // A conversation prints two initials in the two inks.
    var pair = initialsFor(p);
    return '<figure class="card__plate card__plate--set" aria-hidden="true">' +
      '<span class="card__panel">' +
        (pair
          ? '<span class="card__pair"><span>' + esc(pair[0]) + '</span><span>' + esc(pair[1]) + '</span></span>'
          : '<span class="card__initial">' + esc((p.title || '?').trim().charAt(0)) + '</span>') +
        '<span class="card__stamp">' + esc(p.tangent || '') + '</span>' +
      '</span>' +
      '</figure>';
  }

  function card(p, isLead) {
    return '<article class="card' + (isLead ? ' card--lead' : '') + '" data-sway data-tangent="' + attr(p.tangent || '') + '">' +
      '<a class="card__link" href="' + href(p) + '">' +
        plate(p) +
        '<span class="card__body">' +
          dateline(p) +
          '<h2 class="card__title">' + esc(p.title) + '</h2>' +
          (p.dek ? '<p class="card__dek">' + esc(p.dek) + '</p>' : '') +
          '<span class="card__tangent">' + esc(p.tangent || 'Filed') + '</span>' +
        '</span>' +
      '</a>' +
    '</article>';
  }

  /* Sections whose rows carry their plate. Conversations lead
     with a picture of two people; a bare line of type sells
     them badly. Everything else stays a dense index. */
  var PLATED = ['Strangers'];

  /* A row that isn't already carrying its plate advertises one
     for peek.js to hold up on hover. Nothing is fetched until
     then, so the index stays a text document on load. */
  function row(p) {
    var plated = PLATED.indexOf(tangent) !== -1;
    return '<li data-tangent="' + attr(p.tangent || '') + '"><a href="' + href(p) + '"' +
      (!plated && p.image ? ' data-plate="' + attr(p.image) + '"' : '') + '>' +
      (plated ? plate(p) : '') +
      dateline(p, true) +
      '<span class="run__title">' + esc(p.title) + '</span>' +
      (p.dek ? '<span class="run__dek">' + esc(p.dek) + '</span>' : '') +
      snippet(p) +
    '</a></li>';
  }

  /* ---- Filtering ------------------------------------------- */

  /* The essays' own text, from posts/search.json, which the build
     writes. Fetched the first time a reader types, not on load. */
  var texts = null;
  var textsWanted = false;

  function wantTexts() {
    if (textsWanted) return;
    textsWanted = true;
    fetch('/posts/search.json')
      .then(function (r) { return r.ok ? r.json() : {}; })
      .catch(function () { return {}; })
      .then(function (t) { texts = t || {}; if (query) paint(); });
  }

  function haystack(p) {
    return [p.title, p.dek, p.place, p.tangent, p.keywords]
      .filter(Boolean).join(' ').toLowerCase();
  }

  function body(p) {
    return texts && texts[p.slug] ? texts[p.slug] : '';
  }

  function terms() { return query.split(/\s+/).filter(Boolean); }

  /* Terms match from the start of a word. A short term must be the
     whole word, give or take a plural ("cow" finds cows, not
     cowardice); a longer one may be the start of a word, so a half-
     typed "thar" already finds Tharoor. Unicode letter classes, so
     "árbenz" works. */
  function escRe(t) { return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  var START = '(?<![\\p{L}\\p{N}])';
  var END = '(?![\\p{L}\\p{N}])';
  function termRe(term, flags) {
    return new RegExp(START + '(' + escRe(term) + (term.length < 4 ? '(?:e?s)?' + END : '') + ')', flags);
  }
  function has(hay, term) { return termRe(term, 'iu').test(hay); }

  // Where a term first appears, preferring it as a whole word.
  function where(hay, term) {
    var whole = new RegExp(START + escRe(term) + '(?![\\p{L}\\p{N}])', 'iu').exec(hay);
    if (whole) return whole.index;
    var part = termRe(term, 'iu').exec(hay);
    return part ? part.index : -1;
  }

  function matches(p) {
    if (tangent && p.tangent !== tangent) return false;
    if (!query) return true;
    var hay = haystack(p) + ' ' + body(p);
    return terms().every(function (term) { return has(hay, term); });
  }

  /* A word in the title outranks one in the keywords or the dek,
     which outranks one somewhere in the text. */
  function score(p) {
    var title = p.title || '';
    var meta = haystack(p);
    var text = body(p);
    return terms().reduce(function (n, term) {
      if (has(title, term)) return n + 5;
      if (has(meta, term)) return n + 3;
      return n + (has(text, term) ? 1 : 0);
    }, 0);
  }

  /* When a search reaches into the text, show the line it found,
     so the result explains itself. Anchored on the first term the
     title and dek don't already show. */
  function snippet(p) {
    if (!query) return '';
    var text = body(p);
    if (!text) return '';
    var shown = (p.title || '') + ' ' + (p.dek || '');
    var ts = terms();
    var anchor = ts.filter(function (t) { return !has(shown, t) && has(text, t); })[0];
    if (!anchor) return '';

    var at = where(text, anchor);
    var from = Math.max(0, at - 70), to = Math.min(text.length, at + anchor.length + 110);
    // Start and end on word boundaries.
    if (from > 0) from = text.indexOf(' ', from) + 1;
    if (to < text.length) { var sp = text.lastIndexOf(' ', to); if (sp > at) to = sp; }
    var cut = text.slice(from, to);

    var marked = esc(cut);
    ts.forEach(function (t) {
      marked = marked.replace(termRe(t, 'giu'), '<mark>$1</mark>');
    });
    return '<span class="run__snippet">' + (from > 0 ? '…' : '') + marked + (to < text.length ? '…' : '') + '</span>';
  }

  function paint() {
    var hits = all.filter(matches);
    if (query) {
      // Best match first; ties keep the newest-first order.
      var rank = hits.map(function (p, i) { return { p: p, s: score(p), i: i }; });
      rank.sort(function (a, b) { return b.s - a.s || a.i - b.i; });
      hits = rank.map(function (r) { return r.p; });
    }

    if (run) {
      run.innerHTML = hits.map(row).join('');
      run.hidden = !hits.length;
      run.classList.toggle('run--plated', PLATED.indexOf(tangent) !== -1);
    }

    if (countBox) {
      countBox.textContent = hits.length === all.length
        ? all.length + (all.length === 1 ? ' essay' : ' essays')
        : hits.length + ' of ' + all.length;
    }

    if (emptyBox) {
      emptyBox.hidden = hits.length > 0;

      /* An empty run and a search that found nothing are not the
         same thing. Before the first post exists there is no
         query to blame and no filter to clear, and offering to
         clear one reads as a fault. */
      if (!all.length) {
        emptyBox.innerHTML = 'Nothing has been poured yet.';
      } else if (!hits.length) {
        emptyBox.innerHTML = 'Nothing here matches <strong>' + esc(query || tangent) +
          '</strong>. Try fewer words, or <a href="#" data-clear>clear the filters</a>.';
        var clear = emptyBox.querySelector('[data-clear]');
        if (clear) clear.addEventListener('click', function (e) {
          e.preventDefault();
          query = ''; tangent = '';
          if (searchBox) searchBox.value = '';
          syncUrl(); buildFilters(); paint(); setMasthead();
        });
      }
    }

    if (window.TP && window.TP.sway) window.TP.sway();
  }

  /* The archive masthead names whatever is actually on screen.
     Scoped to #run-label rather than "the last line of the
     masthead", because that selector on the home page would
     rename the word "Professor". */
  function setMasthead() {
    var label = document.getElementById('run-label');
    if (!label) return;
    var name = tangent || 'The full run';
    label.textContent = name;
    label.setAttribute('data-text', name);   // the two plates read this
    document.title = name + ' — The Tipsy Professor';
  }

  function syncUrl() {
    var url = new URL(location.href);
    if (tangent) url.searchParams.set('t', tangent);
    else url.searchParams.delete('t');
    if (query) url.searchParams.set('q', query);
    else url.searchParams.delete('q');
    history.replaceState(null, '', url);
  }

  function buildFilters() {
    if (!filterBox) return;

    var names = [];
    all.forEach(function (p) {
      if (p.tangent && names.indexOf(p.tangent) === -1) names.push(p.tangent);
    });

    filterBox.innerHTML =
      '<button type="button" class="btn" data-t="" aria-pressed="' + (!tangent) + '">all</button>' +
      names.map(function (n) {
        return '<button type="button" class="btn" data-t="' + attr(n) + '" data-tangent="' + attr(n) + '" aria-pressed="' +
          (tangent === n) + '">' + esc(n) + '</button>';
      }).join('');

    Array.prototype.forEach.call(filterBox.querySelectorAll('button'), function (b) {
      b.addEventListener('click', function () {
        tangent = b.getAttribute('data-t');
        syncUrl(); buildFilters(); paint(); setMasthead();
        if (window.TP && window.TP.markNav) window.TP.markNav();
      });
    });
  }

  /* ---- Go --------------------------------------------------- */

  fetch('posts/posts.json')
    .then(function (r) {
      if (!r.ok) throw new Error('no manifest');
      return r.json();
    })
    .then(function (list) {
      all = Array.isArray(list) ? list : [];

      /* The home page is three strips that must not repeat a
         post between them: the lead, the conversations, then
         the essays. Each one takes from what the last left. */
      var leadPost = (lead && all.length) ? all[0] : null;
      var pool = all.filter(function (p) { return p !== leadPost; });

      var talks = pool.filter(function (p) { return p.tangent === 'Strangers'; }).slice(0, 3);
      var rest = pool.filter(function (p) { return talks.indexOf(p) === -1; })
                     .slice(0, feed && strangersBox ? 6 : 7);

      if (leadPost) lead.innerHTML = card(leadPost, true);
      else if (lead) lead.innerHTML =
        '<p class="empty">Nothing has been poured yet. The first one lands here.</p>';

      if (strangersBox) {
        strangersBox.innerHTML = talks.map(function (p) {
          return card(p, talks.length === 1);
        }).join('');
        // A single conversation runs as a lead composition;
        // one card at a third of the width looks like a mistake.
        strangersBox.classList.toggle('feed--lead', talks.length === 1);
        if (strangersSection) strangersSection.hidden = !talks.length;
      }

      if (feed) feed.innerHTML = rest.map(function (p) {
        return card(p, false);
      }).join('');

      buildFilters();
      setMasthead();
      paint();

      if (searchBox) {
        searchBox.addEventListener('input', function () {
          query = searchBox.value.trim().toLowerCase();
          if (query) wantTexts();
          syncUrl();
          paint();
        });
        // Arriving with a search in the address (?q=), or with
        // something already typed in a restored form.
        var asked = new URLSearchParams(location.search).get('q') || searchBox.value;
        if (asked && asked.trim()) {
          searchBox.value = asked.trim();
          query = asked.trim().toLowerCase();
          wantTexts();
          paint();
        }
      }
    })
    .catch(function () {
      var msg = '<p class="empty">The index of essays didn’t load. ' +
        'If you’re opening these files directly, run a local server — ' +
        '<code>python3 -m http.server</code> — and reload.</p>';
      if (lead) lead.innerHTML = msg;
      else if (run) run.outerHTML = msg;
      else if (feed) feed.innerHTML = msg;
    });
})();
