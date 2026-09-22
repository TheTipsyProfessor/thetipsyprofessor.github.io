/* ============================================================
   MD — a small markdown renderer with a house dialect

   Standard markdown, plus the five things this blog actually
   needs that markdown has no opinion about:

     ^[note]              a margin note beside the line
     ::: aside … :::      the professor interrupts, in the rail
     ::: pull … :::       a pull quote that breaks the measure
     @[youtube](id "…")   a video that loads nothing until asked
     :ja[текст]           a run set in the right script
     $x$  /  $$x$$        inline and display maths

   Images take a title and an optional {bleed} or {wide}:
     ![alt](src "Caption"){bleed}

   Returns { meta, html }. Never throws on bad input — a blog
   post with a typo should still render.
   ============================================================ */

(function () {
  'use strict';

  var NUL = '\u0000';  // placeholder sentinel; cannot occur in prose

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
  function attr(s) { return esc(s).replace(/"/g, '&quot;'); }

  /* ---- Front matter --------------------------------------
     Flat key: value. Values starting with [ are split lists. */
  function frontmatter(src) {
    var meta = {};
    var m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(src);
    if (!m) return { meta: meta, body: src };

    m[1].split(/\r?\n/).forEach(function (line) {
      var kv = /^\s*([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(line);
      if (!kv) return;
      var v = kv[2].trim().replace(/^["']|["']$/g, '');
      if (/^\[.*\]$/.test(v)) {
        v = v.slice(1, -1).split(',').map(function (x) {
          return x.trim().replace(/^["']|["']$/g, '');
        }).filter(Boolean);
      }
      meta[kv[1]] = v;
    });

    return { meta: meta, body: src.slice(m[0].length) };
  }

  /* ---- Maths ---------------------------------------------
     The parser only ever emits the TeX source, wrapped. It is
     typeset later by typeset(), once KaTeX is available.

     Two reasons for the indirection: the parser stays pure, so
     it runs identically in Node for pre-rendering; and the
     source survives into the static HTML, which is both what a
     crawler can read and what a reader still gets if the CDN
     is blocked.                                               */
  function tex(src, display) {
    return '<span class="tex' + (display ? ' tex--display' : '') + '"' +
           (display ? ' data-display="1"' : '') + '>' + esc(src) + '</span>';
  }

  /* Upgrade every TeX span in `root` to rendered mathematics.
     Safe to call more than once. */
  function typeset(root) {
    if (!root || typeof window === 'undefined' || !window.katex) return;

    Array.prototype.forEach.call(root.querySelectorAll('.tex'), function (el) {
      var display = el.getAttribute('data-display') === '1';
      try {
        el.outerHTML = window.katex.renderToString(el.textContent, {
          displayMode: display,
          throwOnError: false,
          strict: false,
          output: 'htmlAndMathml'
        });
      } catch (e) {
        el.classList.add('tex--failed');
        el.title = 'This expression could not be typeset';
      }
    });
  }

  /* ---- Typographic pass ----------------------------------
     Runs last, on text between tags only, so it never touches
     an href or a generated attribute.                        */
  function typography(html) {
    return html.split(/(<[^>]*>)/).map(function (part, i) {
      if (i % 2) return part;                 // odd chunks are tags
      return part
        .replace(/---/g, '—')
        .replace(/(^|[^-])--(?!-)/g, '$1–')
        .replace(/\.\.\./g, '…')
        .replace(/(^|[\s(\[—–])"/g, '$1“')
        .replace(/"/g, '”')
        .replace(/(^|[\s(\[—–])'/g, '$1‘')
        .replace(/'/g, '’');
    }).join('');
  }

  /* ---- Balanced-bracket scan -----------------------------
     Margin notes hold links, which hold brackets. A regex
     cannot see that; this can.                               */
  function matchBracket(str, open) {
    var depth = 0;
    for (var i = open; i < str.length; i++) {
      if (str[i] === '\\') { i++; continue; }
      if (str[i] === '[') depth++;
      else if (str[i] === ']') { depth--; if (!depth) return i; }
    }
    return -1;
  }

  /* ---- Inline --------------------------------------------- */

  function inline(src, ctx, allowNotes) {
    var stash = [];
    function keep(html) { return NUL + (stash.push(html) - 1) + NUL; }

    var s = String(src);

    // Code and maths are taken out of circulation first, so no
    // later rule can mangle an asterisk or an underscore.
    s = s.replace(/`([^`\n]+)`/g, function (_, c) {
      return keep('<code>' + esc(c) + '</code>');
    });
    s = s.replace(/\$(?!\s)([^$\n]*?[^\s$])\$/g, function (_, t) {
      return keep(tex(t, false));
    });

    // Margin notes, outermost-first, before anything else can
    // eat their brackets.
    if (allowNotes !== false) {
      var out = '';
      var i = 0;
      while (i < s.length) {
        var at = s.indexOf('^[', i);
        if (at === -1) { out += s.slice(i); break; }
        var close = matchBracket(s, at + 1);
        if (close === -1) { out += s.slice(i, at + 2); i = at + 2; continue; }

        out += s.slice(i, at);

        var n = ++ctx.notes;
        var body = inline(s.slice(at + 2, close), ctx, false);
        out += keep(
          '<span class="mn">' +
            '<input type="checkbox" class="mn__toggle" id="mn-' + n + '">' +
            '<label class="mn__marker" for="mn-' + n + '" aria-describedby="mnb-' + n + '">' + n + '</label>' +
            '<small class="mn__body" id="mnb-' + n + '" data-n="' + n + '">' + body + '</small>' +
          '</span>'
        );
        i = close + 1;
      }
      s = out;
    }

    s = esc(s);

    // :ja[…] — a run in another script, correctly tagged so the
    // right face and line-height apply and screen readers switch.
    s = s.replace(/:([a-z]{2,3}(?:-[A-Za-z]{2,4})?)\[([^\]]*)\]/g, function (_, lang, txt) {
      return '<span lang="' + attr(lang) + '">' + txt + '</span>';
    });

    // Inline images. A standalone image line is caught earlier
    // and promoted to a captioned figure instead.
    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, function (_, alt, src2, title) {
      return '<img src="' + attr(src2) + '" alt="' + attr(alt) + '"' +
             (title ? ' title="' + attr(title) + '"' : '') +
             ' loading="lazy" decoding="async">';
    });

    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, function (_, txt, href, title) {
      var ext = /^https?:\/\//.test(href);
      return '<a href="' + attr(href) + '"' +
        (title ? ' title="' + attr(title) + '"' : '') +
        (ext ? ' rel="noopener noreferrer"' : '') +
        '>' + txt + '</a>';
    });

    s = s
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
      .replace(/~~([^~]+)~~/g, '<s>$1</s>');

    s = typography(s);

    // Restore innermost-last so nested stashes resolve.
    for (var k = stash.length - 1; k >= 0; k--) {
      s = s.split(NUL + k + NUL).join(stash[k]);
    }
    return s;
  }

  /* ---- Guest metadata -------------------------------------
     The frontmatter parser is flat, so anything with structure
     arrives as a pipe-delimited line. Three of those:

       speakers: TP = The Professor | RK = Dr Rhea Kulkarni
       subject:  film | Stalker | Andrei Tarkovsky | 1979
       video:    youtube | dQw4w9WgXcQ | Title | poster.webp
                                                               */
  function parseSpeakers(line) {
    var map = {};
    String(line || '').split('|').forEach(function (pair) {
      var m = /^\s*([A-Za-z][A-Za-z0-9]{0,4})\s*=\s*(.+?)\s*$/.exec(pair);
      if (!m) return;
      var name = m[2], role = '';
      var comma = name.indexOf(',');
      if (comma !== -1) { role = name.slice(comma + 1).trim(); name = name.slice(0, comma).trim(); }
      map[m[1]] = { name: name, role: role };
    });
    return map;
  }

  function parseParts(line, keys) {
    if (!line) return null;
    var bits = String(line).split('|').map(function (s) { return s.trim(); });
    if (!bits[0]) return null;
    var out = {};
    keys.forEach(function (k, i) { out[k] = bits[i] || ''; });
    return out;
  }

  var parseSubject = function (line) { return parseParts(line, ['kind', 'title', 'by', 'year']); };

  /* "1h2m3s" | "231s" | "231" → 231 */
  function seconds(t) {
    if (!t) return 0;
    var hms = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/.exec(String(t).trim());
    if (!hms) return 0;
    return (parseInt(hms[1] || 0, 10) * 3600) +
           (parseInt(hms[2] || 0, 10) * 60) +
           (parseInt(hms[3] || 0, 10));
  }

  /* Accepts a pasted URL or the older "provider | id" form:

       video: https://www.youtube.com/watch?v=IkPh03ZQS4g&t=231s | Title
       video: youtube | IkPh03ZQS4g | Title

     Paste-what-you-copied is the point — nobody should have to
     dig an eleven-character id out of a query string, and the
     timestamp comes along for free.                           */
  function parseVideo(line) {
    var bits = String(line || '').split('|').map(function (s) { return s.trim(); });
    if (!bits[0]) return null;

    if (/^https?:/i.test(bits[0])) {
      var url = bits[0];
      var start = 0;
      var t = /[?&#](?:t|start)=([0-9hms]+)/i.exec(url);
      if (t) start = seconds(t[1]);

      var yt = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|live\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/i.exec(url);
      if (yt) return { provider: 'youtube', id: yt[1], start: start, title: bits[1] || '', poster: bits[2] || '' };

      var vm = /vimeo\.com\/(?:video\/)?(\d+)/i.exec(url);
      if (vm) return { provider: 'vimeo', id: vm[1], start: start, title: bits[1] || '', poster: bits[2] || '' };

      return null;
    }

    var out = parseParts(line, ['provider', 'id', 'title', 'poster']);
    if (out) out.start = 0;
    return out;
  }

  /* ---- Video facade ---------------------------------------
     A button, not an iframe. Nothing is requested from a third
     party until the reader presses play.                      */
  function facade(provider, id, title, caption, poster, start, extra) {
    var url = provider === 'vimeo'
      ? 'https://vimeo.com/' + id
      : 'https://youtu.be/' + id;
    var name = provider === 'vimeo' ? 'Vimeo' : 'YouTube';

    return '<figure class="embed wide' + (extra ? ' ' + extra : '') + '" data-sway>' +
      '<div class="embed__frame">' +
        '<button type="button" class="embed__poster' + (poster ? ' embed__poster--art' : '') + '" ' +
          (poster ? 'style="background-image:url(' + attr(poster) + ')" ' : '') +
          'data-provider="' + attr(provider) + '" data-id="' + attr(id) + '" data-url="' + attr(url) + '" ' +
          (start ? 'data-start="' + start + '" ' : '') +
          'aria-label="Play &quot;' + attr(title || name + ' video') + '&quot; from ' + name + '">' +
          '<span class="embed__play" aria-hidden="true">▶</span>' +
          '<span class="embed__meta">' + name + ' · nothing loads until you press play</span>' +
          '<span class="embed__title">' + esc(title || 'Watch on ' + name) + '</span>' +
        '</button>' +
      '</div>' +
      (caption ? '<figcaption>' + esc(caption) + '</figcaption>' : '') +
    '</figure>';
  }

  /* The hero video on an interview or a review. Declared in
     frontmatter rather than typed into the body, so it always
     lands in the same place and the prose stays prose.        */
  function videoHero(spec) {
    if (!spec || !spec.id) return '';
    // No wrapper: the embed has to BE the grid child, or its
    // span class is inert and the hero renders at text width —
    // narrower than a passing embed in an ordinary essay.
    return facade(spec.provider || 'youtube', spec.id, spec.title, '',
                  spec.poster, spec.start, 'embed--hero');
  }

  /* The catalogue slip for a thing being reviewed. Spans the
     same columns as the hero video above it, so the two share
     an edge instead of stepping in and out. */
  function subjectCard(s) {
    if (!s || !s.title) return '';
    var line = [s.by, s.year].filter(Boolean).join(' · ');
    return '<aside class="slip wide">' +
      (s.kind ? '<span class="slip__kind">' + esc(s.kind) + '</span>' : '') +
      '<span class="slip__title">' + esc(s.title) + '</span>' +
      (line ? '<span class="slip__by">' + esc(line) + '</span>' : '') +
    '</aside>';
  }

  /* ---- Blocks ---------------------------------------------- */

  // Content inside an aside, pull quote or blockquote is one
  // level down; only top-level prose carries the drop cap.
  function nested(src, ctx) {
    ctx.depth++;
    var html = blocks(src, ctx);
    ctx.depth--;
    return html;
  }

  function blocks(src, ctx) {
    var lines = String(src).replace(/\r\n?/g, '\n').split('\n');
    var out = [];
    var i = 0;

    // The drop cap belongs to the essay's first paragraph only —
    // never to one that happens to open an aside or a quote.
    function flushParagraph(buf) {
      if (!buf.length) return;
      var lead = ctx.depth === 0 && !ctx.firstPara;
      if (lead) ctx.firstPara = true;
      out.push('<p' + (lead ? ' class="opening"' : '') + '>' +
               inline(buf.join('\n'), ctx, true) + '</p>');
    }

    while (i < lines.length) {
      var line = lines[i];

      // blank
      if (!line.trim()) { i++; continue; }

      // fenced code
      var fence = /^```\s*([A-Za-z0-9_-]*)\s*$/.exec(line);
      if (fence) {
        var code = [];
        i++;
        while (i < lines.length && !/^```\s*$/.test(lines[i])) code.push(lines[i++]);
        i++;
        out.push('<pre><code' + (fence[1] ? ' class="language-' + attr(fence[1]) + '"' : '') + '>' +
                 esc(code.join('\n')) + '</code></pre>');
        continue;
      }

      // display maths
      if (/^\$\$\s*$/.test(line)) {
        var math = [];
        i++;
        while (i < lines.length && !/^\$\$\s*$/.test(lines[i])) math.push(lines[i++]);
        i++;
        out.push(tex(math.join('\n'), true));
        continue;
      }

      // ::: exchange — two or more people talking.
      // Each turn becomes its own grid child so its speaker
      // label can sit in the margin rail, which keeps the text
      // column a clean single measure with no inline names
      // interrupting the line.
      if (/^:::\s*exchange\s*$/.test(line)) {
        var talk = [];
        i++;
        while (i < lines.length && !/^:::\s*$/.test(lines[i])) talk.push(lines[i++]);
        i++;

        var turns = [];
        var cur2 = null;
        talk.forEach(function (l) {
          var t = /^\s*([A-Za-z][A-Za-z0-9]{0,4}):\s+(.*)$/.exec(l);
          if (t) {
            if (cur2) turns.push(cur2);
            cur2 = { who: t[1], text: [t[2]] };
          } else if (cur2 && l.trim()) {
            cur2.text.push(l.trim());
          } else if (cur2 && !l.trim()) {
            cur2.text.push('');
          }
        });
        if (cur2) turns.push(cur2);

        var last = null;
        turns.forEach(function (t) {
          var who = ctx.speakers[t.who];
          var name = who ? who.name : t.who;
          var repeat = t.who === last;
          last = t.who;

          /* Each speaker keeps one ink for the whole piece.
             Alternating by position would desync the moment
             somebody talks twice in a row, or an aside lands
             between two turns. */
          if (!ctx.voices[t.who]) {
            ctx.voices[t.who] = Object.keys(ctx.voices).length + 1;
          }
          var voice = ctx.voices[t.who];

          var paras = t.text.join('\n').split(/\n\s*\n/).filter(function (s) { return s.trim(); });

          out.push('<div class="turn' + (repeat ? ' turn--same' : '') +
            '" data-who="' + attr(t.who) + '" data-voice="' + voice + '">' +
            (repeat ? '' : '<span class="turn__who">' + esc(name) + '</span>') +
            paras.map(function (s) {
              return '<p>' + inline(s, ctx, true) + '</p>';
            }).join('') +
          '</div>');
        });
        continue;
      }

      // ::: aside / ::: pull
      var open = /^:::\s*(aside|pull)\s*$/.exec(line);
      if (open) {
        var kind = open[1];
        var body = [];
        i++;
        while (i < lines.length && !/^:::\s*$/.test(lines[i])) body.push(lines[i++]);
        i++;

        var inner = body.join('\n');
        if (kind === 'aside') {
          out.push('<div class="aside-anchor"><aside class="aside">' +
                   nested(inner, ctx) + '</aside></div>');
        } else {
          // A trailing "— attribution" line becomes the cite.
          var cite = '';
          var bl = body.slice();
          if (bl.length > 1 && /^\s*[—–-]{1,3}\s+\S/.test(bl[bl.length - 1])) {
            cite = bl.pop().replace(/^\s*[—–-]{1,3}\s+/, '');
          }
          out.push('<blockquote class="pull wide" data-sway>' +
                   nested(bl.join('\n'), ctx) +
                   (cite ? '<cite>' + inline(cite, ctx, false) + '</cite>' : '') +
                   '</blockquote>');
        }
        continue;
      }

      // video
      var vid = /^@\[(youtube|vimeo)\]\(([\w-]+)(?:\s+"([^"]*)")?\)\s*(?:\{([^}]*)\})?\s*$/.exec(line);
      if (vid) {
        out.push(facade(vid[1], vid[2], vid[3], vid[4]));
        i++;
        continue;
      }

      // standalone image → figure
      // Modifiers: {wide}, {bleed}, and intrinsic size {1086x1448}.
      // Give the size whenever you know it — without it the browser
      // reserves no space and the whole essay jumps when the image
      // lands, taking the margin notes with it.
      var fig = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)\s*(?:\{([^}]*)\})?\s*$/.exec(line);
      if (fig) {
        var plate = ++ctx.plates;
        var mods = (fig[4] || '').trim();
        var span = /\b(bleed|wide)\b/.exec(mods);
        var size = /\b(\d{1,5})x(\d{1,5})\b/.exec(mods);

        out.push('<figure class="plate' + (span ? ' ' + span[1] : '') + '" data-sway>' +
          '<img src="' + attr(fig[2]) + '" alt="' + attr(fig[1]) + '"' +
            (size ? ' width="' + size[1] + '" height="' + size[2] + '"' : '') +
            ' loading="lazy" decoding="async">' +
          (fig[3]
            ? '<figcaption><b>Plate ' + plate + '</b>' + inline(fig[3], ctx, false) + '</figcaption>'
            : '') +
          '</figure>');
        i++;
        continue;
      }

      // heading
      var h = /^(#{2,4})\s+(.*)$/.exec(line);
      if (h) {
        var lv = h[1].length;
        var id = h[2].toLowerCase().replace(/[^\wÀ-￿]+/g, '-').replace(/^-|-$/g, '');
        out.push('<h' + lv + ' id="' + attr(id) + '">' + inline(h[2], ctx, true) + '</h' + lv + '>');
        i++;
        continue;
      }

      // rule
      if (/^(\*{3,}|-{3,}|_{3,})\s*$/.test(line)) { out.push('<hr>'); i++; continue; }

      // table
      if (/^\|/.test(line) && i + 1 < lines.length && /^\|[\s:|-]+\|?\s*$/.test(lines[i + 1])) {
        var rows = [];
        while (i < lines.length && /^\|/.test(lines[i])) rows.push(lines[i++]);
        var cells = function (r) {
          return r.replace(/^\||\|$/g, '').split('|').map(function (c) { return c.trim(); });
        };
        var head = cells(rows[0]);
        var bodyRows = rows.slice(2).map(cells);
        out.push('<div class="table-wrap"><table><thead><tr>' +
          head.map(function (c) { return '<th>' + inline(c, ctx, false) + '</th>'; }).join('') +
          '</tr></thead><tbody>' +
          bodyRows.map(function (r) {
            return '<tr>' + r.map(function (c) { return '<td>' + inline(c, ctx, true) + '</td>'; }).join('') + '</tr>';
          }).join('') +
          '</tbody></table></div>');
        continue;
      }

      // blockquote
      if (/^>\s?/.test(line)) {
        var q = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, ''));
        out.push('<blockquote>' + nested(q.join('\n'), ctx) + '</blockquote>');
        continue;
      }

      // lists
      var isUl = /^[-*+]\s+/.test(line);
      var isOl = /^\d+[.)]\s+/.test(line);
      if (isUl || isOl) {
        var tag = isUl ? 'ul' : 'ol';
        var items = [];
        var cur = null;

        while (i < lines.length) {
          var l = lines[i];
          var mark = isUl ? /^[-*+]\s+(.*)$/.exec(l) : /^\d+[.)]\s+(.*)$/.exec(l);
          if (mark) {
            if (cur) items.push(cur);
            cur = [mark[1]];
            i++;
          } else if (cur && /^\s{2,}\S/.test(l)) {
            cur.push(l.trim());          // lazy continuation
            i++;
          } else break;
        }
        if (cur) items.push(cur);

        out.push('<' + tag + '>' + items.map(function (it) {
          return '<li>' + inline(it.join(' '), ctx, true) + '</li>';
        }).join('') + '</' + tag + '>');
        continue;
      }

      // paragraph — runs until a blank line or a block opener
      var para = [];
      while (i < lines.length && lines[i].trim() &&
             !/^(#{2,4}\s|>\s?|```|:::|\$\$|\||[-*+]\s|\d+[.)]\s|@\[)/.test(lines[i]) &&
             !/^(\*{3,}|-{3,}|_{3,})\s*$/.test(lines[i])) {
        para.push(lines[i++]);
      }
      flushParagraph(para);
    }

    return out.join('\n');
  }

  function parse(src) {
    var fm = frontmatter(String(src || ''));
    var ctx = {
      notes: 0, plates: 0, firstPara: false, depth: 0,
      speakers: parseSpeakers(fm.meta.speakers),
      voices: {}
    };
    var html;
    try {
      html = blocks(fm.body, ctx);
    } catch (e) {
      html = '<p class="math-error">This essay could not be set: ' + esc(e.message) + '</p>';
    }
    return {
      meta: fm.meta,
      html: html,
      notes: ctx.notes,
      speakers: ctx.speakers,
      subject: parseSubject(fm.meta.subject),
      video: parseVideo(fm.meta.video)
    };
  }

  window.TP = window.TP || {};
  window.TP.md = {
    parse: parse, inline: inline, typeset: typeset,
    videoHero: videoHero, subjectCard: subjectCard,
    parseSpeakers: parseSpeakers, parseSubject: parseSubject, parseVideo: parseVideo
  };
})();
