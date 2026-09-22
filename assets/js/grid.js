/* ============================================================
   GRID — the sway, and the shake

   Two jobs:

   1. Give every [data-sway] element a fixed angle and drift,
      derived from its index. Deterministic, so the layout is
      identically askew on every load and on every machine —
      a composed page, not a random one.

   2. Let the press rattle. Fast scrolling pushes the two ink
      plates further out of register; they settle when you
      stop. It is the only motion on the page that isn't the
      masthead printing itself, and it is the same idea.
   ============================================================ */

(function () {
  'use strict';

  var root = document.documentElement;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---- Deterministic noise -------------------------------
     Integer hash → [0,1). Same input, same output, forever. */
  function hash(n) {
    n = (n ^ 61) ^ (n >>> 16);
    n = n + (n << 3);
    n = n ^ (n >>> 4);
    n = Math.imul(n, 0x27d4eb2d);
    n = n ^ (n >>> 15);
    return (n >>> 0) / 4294967296;
  }

  function signed(n) { return hash(n) * 2 - 1; }

  function sway() {
    var els = document.querySelectorAll('[data-sway]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      // An explicit data-sway="7" pins an element's character
      // so editing the page order doesn't reshuffle the layout.
      var seed = parseInt(el.getAttribute('data-sway'), 10);
      if (isNaN(seed)) seed = i + 1;

      el.style.setProperty('--sway-r', (signed(seed * 3 + 1) * 1.2).toFixed(3));
      el.style.setProperty('--sway-x', (signed(seed * 3 + 2) * 6).toFixed(2));
      el.style.setProperty('--sway-y', (signed(seed * 3 + 3) * 9).toFixed(2));
    }
  }

  /* ---- The shake ----------------------------------------- */

  function shake() {
    if (reduced.matches) return;

    var last = window.scrollY;
    var level = 0;
    var running = false;
    var idle = null;

    /* Settle the press. Also clears `running`, without which a
       loop that died mid-decay could never be restarted. */
    function settle() {
      clearTimeout(idle);
      level = 0;
      running = false;
      root.style.setProperty('--shake', '0');
    }

    function frame() {
      var now = window.scrollY;
      var v = Math.abs(now - last);
      last = now;

      // Rise quickly with velocity, fall back slowly.
      var target = Math.min(1, v / 55);
      level = target > level ? target : level * 0.86;

      root.style.setProperty('--shake', level.toFixed(3));

      if (level > 0.002) requestAnimationFrame(frame);
      else settle();
    }

    window.addEventListener('scroll', function () {
      if (!running) { running = true; requestAnimationFrame(frame); }

      /* Safety net. requestAnimationFrame stops in a background
         tab and in throttled offscreen frames; if it dies mid-
         decay the page is left permanently rattled, because
         --shake multiplies --offset everywhere. This guarantees
         it comes back to rest whatever happens to the loop. */
      clearTimeout(idle);
      idle = setTimeout(settle, 700);
    }, { passive: true });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) settle();
    });
  }

  function start() { sway(); shake(); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  window.TP = window.TP || {};
  window.TP.sway = sway;   // re-run after markdown renders
})();
