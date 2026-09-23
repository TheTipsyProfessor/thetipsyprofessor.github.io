/* ============================================================
   PREFS — the reader's three controls
   Edition (day/night), text size, and sobriety.
   All three persist. All three are keyboard-operable.

   The values are applied before first paint by the inline
   snippet in each page's <head>; this file only wires the UI.
   ============================================================ */

(function () {
  'use strict';

  var KEY = 'tp.prefs';
  var SIZES = [0.875, 1, 1.125, 1.25, 1.375, 1.5];
  var DEFAULT_SIZE = 1;
  var root = document.documentElement;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* Words, not numbers. A reader setting the room's angle
     shouldn't have to think in decimals. */
  // Banded so the 0.6 default lands on the house setting.
  var MOODS = [
    [0.00, 'sober'],
    [0.14, 'steady'],
    [0.36, 'loosened'],
    [0.56, 'tipsy'],
    [0.86, 'merry']
  ];

  function moodFor(v) {
    var word = MOODS[0][1];
    for (var i = 0; i < MOODS.length; i++) if (v >= MOODS[i][0]) word = MOODS[i][1];
    return word;
  }

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; }
    catch (e) { return {}; }
  }

  function write(p) {
    try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) { /* private mode */ }
  }

  var prefs = read();
  if (prefs.edition !== 'night') prefs.edition = 'day';
  if (typeof prefs.size !== 'number' || !SIZES[prefs.size]) prefs.size = DEFAULT_SIZE;
  if (typeof prefs.tipsy !== 'number' || prefs.tipsy < 0 || prefs.tipsy > 1) prefs.tipsy = 0.6;

  /* ---- Edition ------------------------------------------- */

  function applyEdition() {
    root.setAttribute('data-edition', prefs.edition);

    var btn = document.querySelector('[data-control="edition"]');
    if (!btn) return;
    var label = prefs.edition;
    var next = { day: 'the night edition', night: 'the day edition' }[prefs.edition];
    var glyph = { day: '☀', night: '☾' }[prefs.edition];
    btn.querySelector('[data-slot="glyph"]').textContent = glyph;
    btn.querySelector('[data-slot="label"]').textContent = label;
    btn.setAttribute('aria-label', 'Edition: ' + label + '. Switch to ' + next + '.');
  }

  function cycleEdition() {
    prefs.edition = prefs.edition === 'night' ? 'day' : 'night';
    write(prefs);
    applyEdition();
  }

  /* ---- Text size ----------------------------------------- */

  function applySize() {
    root.style.setProperty('--fs-scale', SIZES[prefs.size]);

    var out = document.querySelector('[data-slot="size"]');
    if (out) out.textContent = Math.round(SIZES[prefs.size] * 100) + '%';

    var dec = document.querySelector('[data-control="size-down"]');
    var inc = document.querySelector('[data-control="size-up"]');
    if (dec) dec.disabled = prefs.size === 0;
    if (inc) inc.disabled = prefs.size === SIZES.length - 1;

    var live = document.getElementById('pref-status');
    if (live) live.textContent = 'Text size ' + Math.round(SIZES[prefs.size] * 100) + ' percent';
  }

  function stepSize(dir) {
    var next = Math.min(SIZES.length - 1, Math.max(0, prefs.size + dir));
    if (next === prefs.size) return;
    prefs.size = next;
    write(prefs);
    applySize();
  }

  /* ---- Sobriety ------------------------------------------ */

  function applyTipsy(persist) {
    var v = reduced.matches ? 0 : prefs.tipsy;
    root.style.setProperty('--tipsy', v);

    var slider = document.querySelector('[data-control="tipsy"]');
    if (slider) {
      if (slider.value !== String(prefs.tipsy)) slider.value = prefs.tipsy;
      slider.disabled = reduced.matches;
      slider.setAttribute('aria-valuetext', moodFor(v));
    }
    var out = document.querySelector('[data-slot="mood"]');
    if (out) out.textContent = reduced.matches ? 'sober' : moodFor(v);

    if (persist) write(prefs);
  }

  /* ---- Which nav item is lit ------------------------------
     Every section link lands on archive.html, so a hardcoded
     aria-current in the markup can only ever mark one of them
     — which is why the underline used to sit under "The full
     run" no matter what you clicked. Read it from the URL
     instead, falling back to the page's own section on an
     essay page.                                              */

  function markNav() {
    var links = document.querySelectorAll('.bar__nav a');
    if (!links.length) return;

    var section = new URLSearchParams(location.search).get('t') ||
                  document.body.getAttribute('data-tangent') || '';
    var here = location.pathname.replace(/\/+$/, '') || '/';
    var best = null;

    Array.prototype.forEach.call(links, function (a) {
      a.removeAttribute('aria-current');
      if (!section) return;
      var t = new URL(a.getAttribute('href'), location.href).searchParams.get('t');
      if (t === section) best = a;
    });

    // No section in play: light the link for this actual page.
    if (!best && !section) {
      Array.prototype.forEach.call(links, function (a) {
        var u = new URL(a.getAttribute('href'), location.href);
        if (u.searchParams.get('t')) return;
        var p = u.pathname.replace(/\/+$/, '') || '/';
        if (p === here) best = a;
      });
    }

    if (best) best.setAttribute('aria-current', 'page');
  }

  /* ---- Pour me something --------------------------------- */

  var manifest = null;

  function posts() {
    if (manifest) return manifest;
    manifest = fetch('posts/posts.json')
      .then(function (r) { return r.ok ? r.json() : []; })
      .catch(function () { return []; });
    return manifest;
  }

  function pour() {
    posts().then(function (list) {
      if (!list.length) return;
      // Don't pour the reader the essay they're already on,
      // whichever kind of URL they arrived by.
      var here = document.body.getAttribute('data-prerendered') ||
                 new URLSearchParams(location.search).get('p');
      var pool = list.filter(function (p) { return p.slug !== here; });
      if (!pool.length) pool = list;
      var pick = pool[Math.floor(Math.random() * pool.length)];
      location.href = '/essay/' + encodeURIComponent(pick.slug) + '/';
    });
  }

  /* ---- Wiring -------------------------------------------- */

  function wire() {
    var ed = document.querySelector('[data-control="edition"]');
    if (ed) ed.addEventListener('click', cycleEdition);

    var dec = document.querySelector('[data-control="size-down"]');
    if (dec) dec.addEventListener('click', function () { stepSize(-1); });

    var inc = document.querySelector('[data-control="size-up"]');
    if (inc) inc.addEventListener('click', function () { stepSize(1); });

    var slider = document.querySelector('[data-control="tipsy"]');
    if (slider) {
      slider.addEventListener('input', function () {
        prefs.tipsy = parseFloat(slider.value);
        applyTipsy(false);
      });
      // Persist on release, not on every frame of the drag.
      slider.addEventListener('change', function () { write(prefs); });
    }

    Array.prototype.forEach.call(
      document.querySelectorAll('[data-control="pour"]'),
      function (b) { b.addEventListener('click', function (e) { e.preventDefault(); pour(); }); }
    );

    markNav();
    applyEdition();
    applySize();
    applyTipsy(false);
  }

  /* ---- Keyboard ------------------------------------------
     Single keys, ignored while the reader is typing.        */

  function typing(el) {
    if (!el) return false;
    var t = el.tagName;
    return t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT' || el.isContentEditable;
  }

  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (typing(e.target)) {
      if (e.key === 'Escape') e.target.blur();
      return;
    }

    switch (e.key) {
      case 't': cycleEdition(); break;
      case '+': case '=': stepSize(1); break;
      case '-': case '_': stepSize(-1); break;
      case 's':
        prefs.tipsy = prefs.tipsy > 0 ? 0 : 0.6;
        applyTipsy(true);
        break;
      case 'r': pour(); break;
      case '/': {
        var f = document.querySelector('.search input');
        if (f) { e.preventDefault(); f.focus(); f.select(); }
        break;
      }
      default: return;
    }
  });

  if (reduced.addEventListener) {
    reduced.addEventListener('change', function () { applyTipsy(false); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }

  window.TP = window.TP || {};
  window.TP.posts = posts;
  window.TP.markNav = markNav;
})();
