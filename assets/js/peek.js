/* ============================================================
   PEEK — holding a plate up against the index

   The full run is deliberately a text document: a dense list
   of lines, not a wall of thumbnails. But most of these pieces
   do have artwork, and there is no reason a reader scanning
   the list shouldn't be able to see it.

   So the plate is pulled like a proof — held next to the line
   while the pointer is on it, printed in the same two inks as
   everything else, misregistered by the dial. It leaves the
   list itself untouched.

   Nothing is fetched until a row is actually pointed at, so
   the archive still loads as text.

   Rows that already carry their plate (see PLATED in
   listing.js) are skipped — they have nothing to reveal.
   ============================================================ */

(function () {
  'use strict';

  var run = document.getElementById('run');
  if (!run) return;

  /* No cursor, no hover. On a touch screen this would either
     never fire or fire on the tap that is already navigating
     away, and either way the row is one press from the real
     page with the real picture on it. */
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  var box = null;
  var img = null;
  var current = null;      // the <a> being pointed at
  var pending = 0;         // rAF handle
  var px = 0, py = 0;      // where to hold the plate

  function build() {
    box = document.createElement('div');
    box.className = 'peek';
    box.setAttribute('aria-hidden', 'true');   // the row's text is the label
    img = new Image();
    img.decoding = 'async';
    img.alt = '';
    box.appendChild(img);
    document.body.appendChild(box);
  }

  function show(a) {
    if (a === current) return;
    current = a;
    if (!box) build();

    var src = a.getAttribute('data-plate');
    if (img.getAttribute('src') !== src) img.setAttribute('src', src);

    /* Take the row's own second ink, so the plate behind the
       picture is the colour that section prints in. */
    var li = a.parentNode;
    box.setAttribute('data-tangent', (li && li.getAttribute('data-tangent')) || '');

    /* Placed synchronously, not through the frame queue. In a
       throttled or backgrounded frame requestAnimationFrame
       never fires, and the plate would appear in the corner of
       the screen instead of beside the row. */
    box.classList.add('is-on');
    place();
  }

  function hide() {
    current = null;
    if (box) box.classList.remove('is-on');
  }

  function queue() {
    if (!pending) pending = requestAnimationFrame(place);
  }

  function place() {
    pending = 0;
    if (!box || !current) return;

    /* The list repaints on every search keystroke and filter
       click, which throws away the element we are tracking. */
    if (!current.isConnected) { hide(); return; }

    var w = box.offsetWidth;
    var h = box.offsetHeight;
    var gap = 26;

    // Prefer the right of the pointer; flip when it won't fit.
    var left = px + gap;
    if (left + w > window.innerWidth - 14) left = px - w - gap;
    left = Math.max(14, left);

    // Centred on the pointer, but never hanging off the screen.
    var top = Math.min(Math.max(14, py - h / 2), window.innerHeight - h - 14);

    box.style.transform = 'translate(' + Math.round(left) + 'px, ' + Math.round(top) + 'px)';
  }

  function rowFrom(node) {
    return node && node.closest ? node.closest('a[data-plate]') : null;
  }

  run.addEventListener('pointerover', function (e) {
    var a = rowFrom(e.target);
    if (a) { px = e.clientX; py = e.clientY; show(a); }
    else hide();
  });

  run.addEventListener('pointermove', function (e) {
    if (!current) return;
    px = e.clientX;
    py = e.clientY;
    queue();
  }, { passive: true });

  run.addEventListener('pointerleave', hide);

  /* Keyboard: there is no pointer to follow, so the plate is
     held at the end of the focused row instead. */
  run.addEventListener('focusin', function (e) {
    var a = rowFrom(e.target);
    if (!a) return;
    var r = a.getBoundingClientRect();
    px = Math.min(r.right, window.innerWidth - 20);
    py = r.top + r.height / 2;
    show(a);
  });
  run.addEventListener('focusout', hide);

  /* Scrolling moves the row out from under a plate that is
     pinned to the viewport. Rather than chase it, put it down. */
  window.addEventListener('scroll', hide, { passive: true });

  /* Leaving the tab with a plate held up means coming back to
     one stranded under a pointer that has since moved. */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) hide();
  });
})();
