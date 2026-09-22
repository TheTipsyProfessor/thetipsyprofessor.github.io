/* ============================================================
   MARGIN — the apparatus in the rail

   Notes and asides are absolutely positioned so they sit beside
   the line that summons them instead of pushing the text down.
   That means nothing stops two of them landing in the same
   place, so this does:

     · anchor each item to its line
     · walk down the column pushing overlaps clear
     · redo the whole thing whenever the text reflows
     · stand down entirely when the rail is too narrow to exist

   Used by the essay template and by any static page that has
   notes in it.
   ============================================================ */

(function () {
  'use strict';

  var RAIL_QUERY = '(min-width: 68.001rem)';
  var GAP = 14;                       // px of air between margin items

  function init(prose) {
    if (!prose) return;
    var wide = window.matchMedia(RAIL_QUERY);

    function items() {
      var list = [];

      Array.prototype.forEach.call(prose.querySelectorAll('.mn__body'), function (body) {
        var box = document.getElementById(body.id.replace('mnb-', 'mn-'));
        var marker = box && box.nextElementSibling;   // the <label>
        if (marker) list.push({ el: body, anchor: marker });
      });

      Array.prototype.forEach.call(prose.querySelectorAll('.aside'), function (el) {
        list.push({ el: el, anchor: el.parentNode });
      });

      // Speaker labels share the rail with the notes, so they
      // go through the same collision pass — otherwise a
      // footnote lands on top of whoever is talking.
      Array.prototype.forEach.call(prose.querySelectorAll('.turn__who'), function (el) {
        list.push({ el: el, anchor: el.parentNode });
      });

      return list;
    }

    /* On a wide screen the note is always visible, so its
       checkbox has nothing to toggle — keep it out of the way
       of anyone tabbing through the page. */
    function syncToggles() {
      var on = wide.matches;
      Array.prototype.forEach.call(prose.querySelectorAll('.mn__toggle'), function (cb) {
        cb.tabIndex = on ? -1 : 0;
        cb.setAttribute('aria-hidden', on ? 'true' : 'false');
        if (on) cb.checked = false;
      });
    }

    /* Pull quotes, embeds and full-bleed figures reach left into
       the rail. They are laid out by the grid and cannot move,
       so notes have to go round them. */
    function blockers() {
      var out = [];
      var scroll = window.scrollY;
      var railRight = 0;

      // Where the rail ends, in viewport x. Both this and the
      // blocker boxes below are viewport-relative, so no scroll
      // offset belongs in the comparison.
      var probe = prose.querySelector('.mn__body, .aside');
      if (probe) railRight = probe.getBoundingClientRect().right;

      Array.prototype.forEach.call(
        prose.querySelectorAll(':scope > .wide, :scope > .spread, :scope > .bleed'),
        function (el) {
          var box = el.getBoundingClientRect();
          // Only counts as an obstacle if it actually overlaps
          // the rail horizontally.
          if (railRight && box.left >= railRight) return;
          out.push({ top: box.top + scroll - GAP, bottom: box.bottom + scroll + GAP });
        }
      );

      return out;
    }

    /* Find the first slot at or below `want` that clears both
       the obstacles and the previous item's bottom edge.

       Both constraints have to be satisfied in the same loop:
       clearing an obstacle can drop an item back above the
       running floor, which would stack it on its neighbour. */
    function place(want, height, floor, bars) {
      var top = Math.max(want, floor);

      for (var pass = 0; pass <= bars.length + 1; pass++) {
        var moved = false;

        for (var i = 0; i < bars.length; i++) {
          if (top < bars[i].bottom && top + height > bars[i].top) {
            top = bars[i].bottom;
            moved = true;
          }
        }
        if (top < floor) { top = floor; moved = true; }

        if (!moved) break;
      }

      return top;
    }

    function layout() {
      var list = items();
      if (!list.length) return;

      if (!wide.matches) {
        list.forEach(function (it) { it.el.style.top = ''; });
        return;
      }

      var scroll = window.scrollY;

      // Reset every item before measuring any of them, or each
      // measurement is polluted by the last one's offset.
      list.forEach(function (it) { it.el.style.top = '0px'; });

      var bars = blockers();

      var measured = list.map(function (it) {
        return {
          el: it.el,
          parentTop: it.el.offsetParent
            ? it.el.offsetParent.getBoundingClientRect().top + scroll
            : 0,
          wantTop: it.anchor.getBoundingClientRect().top + scroll,
          height: it.el.offsetHeight
        };
      });

      measured.sort(function (a, b) { return a.wantTop - b.wantTop; });

      var floor = -Infinity;
      measured.forEach(function (m) {
        var top = place(m.wantTop, m.height, floor, bars);
        floor = top + m.height + GAP;
        m.el.style.top = (top - m.parentTop) + 'px';
      });
    }

    var pending = false;
    function relayout() {
      if (pending) return;
      pending = true;
      requestAnimationFrame(function () {
        pending = false;
        syncToggles();
        layout();
      });
    }

    syncToggles();
    layout();

    // Catches window resize, text-size changes and images
    // arriving late — all of which move the lines.
    if (window.ResizeObserver) new ResizeObserver(relayout).observe(prose);
    else window.addEventListener('resize', relayout);

    if (wide.addEventListener) wide.addEventListener('change', relayout);
    window.addEventListener('load', relayout);

    return { layout: layout, relayout: relayout };
  }

  // Static pages can opt in by marking their article.
  function auto() {
    var el = document.querySelector('[data-margin]');
    if (el) init(el);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', auto);
  else auto();

  window.TP = window.TP || {};
  window.TP.margin = { init: init };
})();
