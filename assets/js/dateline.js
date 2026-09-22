/* ============================================================
   DATELINE — where, when, how long, what kind

   Two audiences want different things from the same four facts,
   so there are two renderings:

     scanning   REYKJAVÍK · 14 SEP 2026 · 3 POURS
     reading    REYKJAVÍK · 14 SEP 2026, 02:14 · 3 POURS

   A card or an index row is answering "is this new, and what
   order am I in". An essay page has already been chosen, so it
   can afford the hour — which is the point of the thing, but
   only means something once you're inside.

   The month is spelled because 05.06.2026 is two different days
   depending on who is reading it. The machine-readable date
   rides along in the <time datetime> attribute.

   One implementation, used by listing.js in the browser, by
   essay.js at runtime and by tools/build.js in Node, so the
   three can't drift apart.
   ============================================================ */

(function () {
  'use strict';

  var MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
                'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* '2026-09-14' → '14 SEP 2026'. Parsed by hand rather than
     with Date, which would drag the reader's timezone into a
     date that has nothing to do with them. */
  function human(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
    if (!m) return '';
    var month = MONTHS[parseInt(m[2], 10) - 1];
    if (!month) return '';
    return parseInt(m[3], 10) + ' ' + month + ' ' + m[1];
  }

  function pours(n) {
    return n + (String(n) === '1' ? ' pour' : ' pours');
  }

  /* opts: { time, tangent, link }
       time     include the hour it was finished
       tangent  include the section
       link     make the section a link to the archive          */
  function render(p, opts) {
    opts = opts || {};
    var bits = [];

    /* A conversation leads with who it was with, and with where
       you met — not where he happened to write it up, which for
       a guest piece is nobody's business and nobody's interest. */
    if (p.with) {
      bits.push('<span class="dateline__with">' + esc(p.with) + '</span>');
      if (p.met) bits.push('<span>' + esc(p.met) + '</span>');
    } else if (p.place) {
      bits.push('<span>' + esc(p.place) + '</span>');
    }

    var date = human(p.date);
    if (date) {
      if (opts.time && p.time) {
        // The date sitting next to it is what makes the hour
        // legible; no label needed once they're a pair.
        bits.push('<time datetime="' + esc(p.date) + 'T' + esc(p.time) + '">' +
                  esc(date) + ', ' + esc(p.time) + '</time>');
      } else {
        bits.push('<time datetime="' + esc(p.date) + '">' + esc(date) + '</time>');
      }
    }

    if (p.pours) bits.push('<span>' + esc(pours(p.pours)) + '</span>');

    if (opts.tangent && p.tangent) {
      bits.push(opts.link
        ? '<a href="/archive.html?t=' + encodeURIComponent(p.tangent) + '">' + esc(p.tangent) + '</a>'
        : '<span>' + esc(p.tangent) + '</span>');
    }

    // No separator elements: the middot is drawn by CSS as an
    // ::after on each item but the last, so it can never wrap
    // onto a line by itself.
    return '<p class="dateline">' + bits.join('') + '</p>';
  }

  var root = typeof window !== 'undefined' ? window : this;
  root.TP = root.TP || {};
  root.TP.dateline = { render: render, human: human, pours: pours };
})();
