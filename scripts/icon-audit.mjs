/**
 * Footer icon audit.
 *
 * Checks that every icon in the footer actually renders the shape it claims to.
 * A path can be valid SVG and still render as a featureless blob, which is
 * exactly what happened to the hand-rolled envelope and clock that these icons
 * replaced - both were solid shapes whose knock-out detail was filled back in by
 * the nonzero fill rule. Nothing about that is visible in a diff or a snapshot
 * filename, so each icon is rasterised and sampled for interior voids.
 *
 * The failure this guards against: an icon that is mostly-filled with no
 * interior hole is a blob, not a glyph. Facebook, X, the pin and the envelope
 * all have voids; the clock must show a void where the hands are.
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const DIST = path.resolve('dist');
const PORT = 4406;
const O = `http://127.0.0.1:${PORT}`;
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
const server = createServer(async (req, res) => {
  let rel = decodeURIComponent(new URL(req.url, O).pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const f = path.join(DIST, rel);
  try { const s = await stat(f); if (s.isDirectory()) return; } catch { res.writeHead(404).end('nf'); return; }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] ?? 'application/octet-stream' });
  res.end(await readFile(f));
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

const browser = await chromium.launch();
// Device scale 3 so a 16px icon samples at 48px and 1-unit features survive.
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 3 });
await page.goto(`${O}/`, { waitUntil: 'load' });
await page.evaluate(() => document.fonts?.ready);
await page.waitForTimeout(250);

let bad = 0;
const say = (ok, msg) => {
  if (!ok) bad++;
  console.log(`  ${ok ? 'OK  ' : 'FAIL'}  ${msg}`);
};

const icons = await page.evaluate(() => {
  const footer = document.querySelector('footer');
  const named = [];
  // NAP icons sit beside phone/email/place/hours text. The two social links are
  // labelled by aria-label instead, so text here is always a contact row.
  // aria-label carries no text content, so excluding labelled anchors leaves
  // exactly the four contact rows.
  const rows = [...footer.querySelectorAll('a, p')].filter(
    (el) => el.querySelector('svg') && !el.hasAttribute('aria-label')
  );
  for (const el of rows) {
    const svg = el.querySelector('svg');
    const text = el.textContent.trim().replace(/\s+/g, ' ').slice(0, 34);
    named.push({ kind: text, box: svg.getBoundingClientRect().width });
  }
  const social = [...footer.querySelectorAll('a[aria-label]')].map((a) => ({
    kind: a.getAttribute('aria-label'),
    box: a.querySelector('svg').getBoundingClientRect().width,
  }));
  return { named, social };
});

console.log('icon inventory');
for (const i of [...icons.named, ...icons.social]) {
  console.log(`  -  ${String(i.kind).padEnd(36)} ${i.box}px`);
}
say(icons.named.length === 4, 'footer has 4 contact icons');
say(icons.social.length === 2, 'footer has 2 social icons');

// Rasterise each SVG in isolation and measure fill + interior voids.
const samples = await page.evaluate(() => {
  const footer = document.querySelector('footer');
  const svgs = [...footer.querySelectorAll('svg')];
  const N = 24;
  const out = [];
  for (const svg of svgs) {
    const owner = svg.closest('a, p');
    const label = (owner?.getAttribute('aria-label') || owner?.textContent || '?').trim().replace(/\s+/g, ' ').slice(0, 26);
    const vb = svg.getAttribute('viewBox');
    const c = new OffscreenCanvas(N, N);
    const ctx = c.getContext('2d');
    const [, , w, h] = vb.split(/\s+/).map(Number);
    ctx.scale(N / w, N / h);
    // Must sample red only. The SVGs use fill="currentColor" and the canvas is
    // not in the document, so currentColor resolves to the default black and
    // every icon rasterises empty - which is what a black-on-black read looks
    // like, not a rendering failure.
    ctx.fillStyle = '#ff0000';
    // Honour the element's own fill-rule. Refilling with the default nonzero
    // would re-break the clock - its hands wash back in and it rasterises as a
    // featureless disc, which is the exact bug this audit exists to catch.
    ctx.fill(new Path2D(svg.querySelector('path').getAttribute('d')), svg.getAttribute('fill-rule') || 'nonzero');
    const px = ctx.getImageData(0, 0, N, N).data;
    const on = (i, j) => px[(j * N + i) * 4] > 40;
    let ink = 0;
    const rows = [];
    for (let j = 0; j < N; j++) {
      let s = '';
      for (let i = 0; i < N; i++) { if (on(i, j)) { ink++; s += '#'; } else { s += '.'; } }
      rows.push(s);
    }
    // Flood fill background inward from the border; anything unreached is a void.
    const seen = new Uint8Array(N * N);
    const stack = [];
    for (let i = 0; i < N; i++) for (const q of [i, (N - 1) * N + i, i * N, i * N + N - 1]) if (!seen[q] && !on(q % N, (q / N) | 0)) { seen[q] = 1; stack.push(q); }
    while (stack.length) {
      const p = stack.pop();
      const i = p % N, j = (p / N) | 0;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = i + di, nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
        const q = nj * N + ni;
        if (seen[q] || on(ni, nj)) continue;
        seen[q] = 1; stack.push(q);
      }
    }
    let voids = 0;
    for (let p = 0; p < N * N; p++) if (!seen[p] && !on(p % N, (p / N) | 0)) voids++;
    out.push({ label, vb, ink: Math.round((ink / (N * N)) * 100), voids, art: rows });
  }
  return out;
});

console.log('');
say(samples.length === 6, `rasterised ${samples.length} icons`);
for (const s of samples) {
  console.log(`\n  ${s.label}   viewBox="${s.vb}"  fill=${s.ink}%  voids=${s.voids}px`);
  for (const row of s.art) console.log('    ' + row);
}

/*
 * Per-icon shape expectations.
 *
 * A blanket "every icon needs an interior void" rule is wrong. The Facebook
 * mark is a filled disc whose f-shaped counter is open to the circle edge, and
 * the phone handset is a single solid stroke with no hole in it - both are
 * correct glyphs, and both would be reported as blobs by that rule.
 *
 * What actually distinguishes a blob from a glyph is the silhouette: a blob is
 * convex, a glyph is not. Ink in the corners of the bounding box is the cheap
 * proxy for that, so each icon is checked against what its own shape should do
 * rather than against a universal rule.
 */
console.log('');
const CORNERS = 5;
const cornerInk = (s) => {
  let n = 0;
  for (const [j0, j1] of [[0, CORNERS], [s.art.length - CORNERS, s.art.length]]) {
    for (let j = j0; j < j1; j++) {
      for (let i = 0; i < CORNERS; i++) {
        if (s.art[j][i] === '#') n++;
        if (s.art[j][s.art[j].length - 1 - i] === '#') n++;
      }
    }
  }
  return n;
};

const byLabel = (frag) => samples.find((s) => s.label.toLowerCase().includes(frag));

// The three knock-out utility icons must show interior voids: the envelope's
// flap, the pin's centre, the clock's hands.
for (const [frag, why] of [['hello@', 'envelope flap'], ['mobile service', 'pin counter'], ['bookings', 'clock hands']]) {
  const s = byLabel(frag);
  if (!s) { say(false, `${frag} icon not found`); continue; }
  say(s.voids > 0, `${why} is cut out, not filled in`, `${s.voids}px void at ${s.ink}% fill`);
}

// The phone is one solid handset: no void is correct, but it must not be a blob
// either, so it needs ink in the corners rather than a filled bounding box.
{
  const s = byLabel('(07)');
  if (!s) say(false, 'phone icon not found');
  else {
    say(s.ink < 45, 'phone is a light handset, not a filled block', `${s.ink}% fill`);
    say(cornerInk(s) < 90, 'phone silhouette is diagonal, not a solid square', `${cornerInk(s)} corner px`);
  }
}

// Facebook and X are dense brand marks. Both are recognisable only if the
// silhouette is right, so each must be neither empty nor a plain rectangle.
for (const [frag, min, max] of [['facebook', 55, 80], ['x (twitter)', 25, 55]]) {
  const s = byLabel(frag);
  if (!s) { say(false, `${frag} icon not found`); continue; }
  say(s.ink >= min && s.ink <= max, `${frag} mark has expected density`, `${s.ink}% fill`);
  say(cornerInk(s) < 90, `${frag} silhouette is not a solid square`, `${cornerInk(s)} corner px`);
}

console.log(bad === 0 ? '\nPASS: all footer icons render as real glyphs.' : `\n${bad} footer icon check(s) failed.`);
await browser.close();
server.close();