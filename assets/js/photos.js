/* ============================================================
   PHOTOS — the shoebox

   Lays photos/photos.json out as a wall of pinned prints and
   runs the viewer that opens when one is picked up.

   Each entry:
     { "file": "cusco-railing",        photos/<file>.webp and
                                       photos/<file>-sm.webp
       "w": 1600, "h": 1200,           the full image's size
       "caption": "…",                 the line on the back
       "alt": "…",                     what is in the picture
       "place": "Cusco",               optional
       "date": "2025-03-14",           optional; YYYY, YYYY-MM
                                       or YYYY-MM-DD
       "focus": "50% 30%" }            optional; where the square
                                       crop on the wall sits

   tools/optimize-photos.js writes the two images and the size,
   and adds a stub entry for any photo the manifest is missing.
   ============================================================ */

(function () {
  'use strict';

  var wall = document.getElementById('wall');
  var empty = document.getElementById('wall-empty');
  var box = document.getElementById('lightbox');
  if (!wall || !box) return;

  var photos = [];
  var current = -1;
  var opener = null;

  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];

  /* ---- Helpers ------------------------------------------- */

  // Integer hash of a string → [0,1). The same print keeps the
  // same angle however the manifest is reordered.
  function hash(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) / 4294967296;
  }

  function when(d) {
    var m = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(String(d || ''));
    if (!m) return d || '';
    var out = m[1];
    if (m[2]) out = MONTHS[parseInt(m[2], 10) - 1] + ' ' + out;
    if (m[3]) out = parseInt(m[3], 10) + ' ' + out;
    return out;
  }

  function src(p, small) { return 'photos/' + p.file + (small ? '-sm' : '') + '.webp'; }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function meta(p, into) {
    into.textContent = '';
    [p.place, when(p.date)].forEach(function (t) {
      if (t) into.appendChild(el('span', null, t));
    });
    into.hidden = !into.childNodes.length;
  }

  /* ---- The wall ------------------------------------------ */

  function render() {
    var frag = document.createDocumentFragment();

    photos.forEach(function (p, i) {
      var li = el('li', 'wall__item');
      li.id = 'photo-' + p.file;

      var fig = el('figure', 'print');
      var r = hash(p.file);
      fig.style.setProperty('--tilt', ((r * 2 - 1) * 3.2).toFixed(2));
      fig.style.setProperty('--tape', ((hash(p.file + '/tape') * 2 - 1) * 7).toFixed(2));

      var img = el('img', 'print__img');
      img.src = src(p, true);
      img.alt = p.alt || '';
      if (p.w && p.h) { img.width = p.w; img.height = p.h; }
      if (p.focus) img.style.objectPosition = p.focus;
      img.decoding = 'async';
      if (i > 5) img.loading = 'lazy';
      fig.appendChild(img);

      var cap = el('figcaption', 'print__caption');
      if (p.caption) cap.appendChild(el('p', 'print__text', p.caption));
      var m = el('p', 'dateline print__meta');
      meta(p, m);
      cap.appendChild(m);
      fig.appendChild(cap);

      var btn = el('button', 'print__open');
      btn.type = 'button';
      btn.setAttribute('aria-label', 'Open photograph' + (p.caption ? ': ' + p.caption : ''));
      btn.addEventListener('click', function () { open(i, btn); });
      fig.appendChild(btn);

      li.appendChild(fig);
      frag.appendChild(li);
    });

    wall.appendChild(frag);
    if (empty) empty.hidden = photos.length > 0;
  }

  /* ---- The viewer ---------------------------------------- */

  var part = {};
  Array.prototype.forEach.call(box.querySelectorAll('[data-lb]'), function (n) {
    part[n.getAttribute('data-lb')] = n;
  });

  var loaded = {};
  function preload(i) {
    var p = photos[(i + photos.length) % photos.length];
    if (!p || loaded[p.file]) return;
    var im = new Image();
    im.onload = function () { loaded[p.file] = true; };
    im.src = src(p, false);
  }

  function show(i) {
    var n = photos.length;
    current = (i + n) % n;
    var p = photos[current];

    // The small print is already in the cache, so it goes up at
    // once; the full-size one replaces it when it arrives.
    var img = part.img;
    img.alt = p.alt || '';
    if (p.w && p.h) { img.width = p.w; img.height = p.h; }
    else { img.removeAttribute('width'); img.removeAttribute('height'); }
    img.src = loaded[p.file] ? src(p, false) : src(p, true);
    if (!loaded[p.file]) {
      var full = new Image();
      full.onload = function () {
        loaded[p.file] = true;
        if (photos[current] === p) img.src = full.src;
      };
      full.src = src(p, false);
    }

    part.caption.textContent = p.caption || '';
    part.caption.hidden = !p.caption;
    meta(p, part.meta);
    part.count.textContent = (current + 1) + ' / ' + n;
    box.setAttribute('aria-label', 'Photograph ' + (current + 1) + ' of ' + n +
      (p.caption ? ': ' + p.caption : ''));

    part.prev.hidden = part.next.hidden = n < 2;

    try { history.replaceState(null, '', '#photo-' + p.file); } catch (e) { /* file:// */ }

    preload(current + 1);
    preload(current - 1);
  }

  function open(i, from) {
    opener = from || null;
    show(i);
    if (!box.open) box.showModal();
    part.close.focus();
  }

  function close() { if (box.open) box.close(); }

  box.addEventListener('close', function () {
    current = -1;
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* file:// */ }
    if (opener) opener.focus();
  });

  part.close.addEventListener('click', close);
  part.prev.addEventListener('click', function () { show(current - 1); });
  part.next.addEventListener('click', function () { show(current + 1); });

  // A click on the dark around the picture puts it down.
  box.addEventListener('click', function (e) {
    if (swiped) { swiped = false; return; }
    if (e.target === box) close();
  });

  box.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft')  { e.preventDefault(); show(current - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); show(current + 1); }
  });

  // Swipe between prints on a touch screen.
  var sx = null, sy = 0, swiped = false;
  box.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse') return;
    sx = e.clientX; sy = e.clientY; swiped = false;
  });
  box.addEventListener('pointerup', function (e) {
    if (sx === null) return;
    var dx = e.clientX - sx, dy = e.clientY - sy;
    sx = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      swiped = true;   // the click that follows is the end of the swipe, not a tap
      show(current + (dx < 0 ? 1 : -1));
    }
  });

  /* ---- Load ---------------------------------------------- */

  fetch('photos/photos.json')
    .then(function (r) { return r.ok ? r.json() : []; })
    .catch(function () { return []; })
    .then(function (list) {
      photos = (Array.isArray(list) ? list : []).filter(function (p) { return p && p.file; });
      render();

      // A link to #photo-<file> opens that print.
      var m = /^#photo-(.+)$/.exec(location.hash);
      if (m) {
        for (var i = 0; i < photos.length; i++) {
          if (photos[i].file === decodeURIComponent(m[1])) {
            var b = wall.children[i].querySelector('.print__open');
            open(i, b);
            break;
          }
        }
      }
    });
})();
