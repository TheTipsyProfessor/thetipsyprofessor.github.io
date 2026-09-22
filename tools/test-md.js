#!/usr/bin/env node
/* Smoke test for the markdown dialect: parse every post and
   assert the custom syntax actually turned into markup.
   Run: node tools/test-md.js                                  */

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const sandbox = { window: {}, console };
sandbox.window.window = sandbox.window;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'assets/js/md.js'), 'utf8'), sandbox);

const NUL = String.fromCharCode(0);
const files = fs.readdirSync(path.join(ROOT, 'posts')).filter((f) => f.endsWith('.md')).sort();

let failures = 0;

for (const f of files) {
  const src = fs.readFileSync(path.join(ROOT, 'posts', f), 'utf8');
  const r = sandbox.window.TP.md.parse(src);
  const h = r.html;

  const checks = {
    'front matter parsed': !!r.meta.title && !!r.meta.tangent,
    'drop cap on first para': h.includes('class="opening"'),
    'exactly one drop cap': (h.match(/class="opening"/g) || []).length === 1,
    'no unclosed ::: block': !/^:::/m.test(h),
    'no leftover placeholder': !h.includes(NUL),
    'no unparsed margin note': !h.includes('^['),
    'no unparsed video': !h.includes('@['),
    'no unparsed script span': !/:[a-z]{2,3}\[/.test(h),
    'no raw display $$': !/^\$\$/m.test(h),
    'notes produced markup': r.notes === (h.match(/class="mn__body"/g) || []).length,
    'balanced <p>': (h.match(/<p[ >]/g) || []).length === (h.match(/<\/p>/g) || []).length,
    'balanced <li>': (h.match(/<li>/g) || []).length === (h.match(/<\/li>/g) || []).length,
  };

  const bad = Object.keys(checks).filter((k) => !checks[k]);
  if (bad.length) {
    failures++;
    console.log('FAIL  ' + f);
    bad.forEach((b) => console.log('        · ' + b));
  } else {
    const counts = [
      r.notes + ' notes',
      (h.match(/class="aside"/g) || []).length + ' asides',
      (h.match(/class="pull/g) || []).length + ' pulls',
      (h.match(/class="embed/g) || []).length + ' embeds',
      (h.match(/<figure/g) || []).length + ' figures',
      (h.match(/<table/g) || []).length + ' tables',
      (h.match(/class="tex/g) || []).length + ' maths',
      (h.match(/<span lang=/g) || []).length + ' scripts',
    ].join(', ');
    console.log('ok    ' + f.padEnd(40) + counts);
  }
}

console.log(failures ? '\n' + failures + ' file(s) failed' : '\nall ' + files.length + ' posts parsed clean');
process.exit(failures ? 1 : 0);
