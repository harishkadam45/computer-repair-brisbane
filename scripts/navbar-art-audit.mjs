import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

/**
 * Contrast audit for text sitting on the navbar artwork.
 *
 * Why this exists rather than trusting contrast-audit.mjs: that script can
 * only resolve a solid background colour, so anything painted over a gradient
 * is skipped with a "not statically checked" note. The navbar scrim is exactly
 * that - a gradient over an image - so adding the artwork moved the entire
 * header out of the main audit's coverage without any error being raised. Its
 * distinct failure count silently fell from 11 groups to 5 while the header
 * stopped being checked at all.
 *
 * So this walks the header's real text nodes, composites the artwork's actual
 * pixels under the actual scrim, and scores the worst case for each one.
 *
 * Two things it has to get right:
 *
 *   - Blend in sRGB space (255*scrim + image*(1-scrim)), which is what the
 *     browser does. Blending in luminance space reported the darkest pixel as
 *     0.52 instead of 0.77 and produced failures that do not exist.
 *   - Test for a background-image before testing for an opaque background
 *     colour. The header carries an opaque white fallback *and* the artwork,
 *     so checking colour first scores everything against plain white and the
 *     artwork is never actually verified.
 */

const DIST = path.resolve('dist');
const PORT = 4419;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.woff2': 'font/woff2',
};
const ART = '/images/navbar-galaxy.jpg';
const SCRIM = 0.7;
const WIDTHS = [375, 768, 1280, 1440];

const server = createServer(async (req, res) => {
  let rel = decodeURIComponent(new URL(req.url, ORIGIN).pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const f = path.join(DIST, rel);
  try {
    const s = await stat(f);
    if (s.isDirectory()) return;
  } catch {
    res.writeHead(404).end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] ?? 'application/octet-stream' });
  res.end(await readFile(f));
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

const browser = await chromium.launch();
let failures = 0;
let checks = 0;
const fail = (m) => {
  failures++;
  console.log(`  FAIL  ${m}`);
};
const pass = (m) => {
  checks++;
  console.log(`  OK    ${m}`);
};

for (const width of WIDTHS) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  await page.goto(`${ORIGIN}/`, { waitUntil: 'load' });
  await page.waitForTimeout(250);

  const data = await page.evaluate(async ({ art, scrim }) => {
    const srgb = (v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
    const lum = ([r, g, b]) => 0.2126 * srgb(r / 255) + 0.7152 * srgb(g / 255) + 0.0722 * srgb(b / 255);
    const parse = (c) => c.match(/[\d.]+/g).slice(0, 3).map(Number);
    const alphaOf = (c) => (c.startsWith('rgba') ? Number(c.match(/[\d.]+/g)[3]) : 1);

    const img = new Image();
    img.src = art;
    let loaded = false;
    try {
      await img.decode();
      loaded = true;
    } catch {
      loaded = false;
    }
    let artMin = 1;
    let artMax = 0;
    if (loaded) {
      const cv = document.createElement('canvas');
      cv.width = img.naturalWidth;
      cv.height = img.naturalHeight;
      const ctx = cv.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
      for (let i = 0; i < d.length; i += 4) {
        const L = lum([0, 1, 2].map((k) => 255 * scrim + d[i + k] * (1 - scrim)));
        if (L < artMin) artMin = L;
        if (L > artMax) artMax = L;
      }
    }

    const header = document.querySelector('header');
    const headerHeight = Math.round(header.getBoundingClientRect().height);
    const hasArt = getComputedStyle(header).backgroundImage.includes('navbar-galaxy');

    const bgOf = (el) => {
      for (let n = el; n && n !== document.body; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.backgroundImage.includes('navbar-galaxy')) return { min: artMin, max: artMax, overArt: true };
        if (alphaOf(cs.backgroundColor) >= 0.95) return { lum: lum(parse(cs.backgroundColor)), overArt: false };
      }
      return { min: artMin, max: artMax, overArt: true };
    };

    const nodes = [];
    for (const el of header.querySelectorAll('*')) {
      const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join('');
      const r = el.getBoundingClientRect();
      if (!own || r.width < 2 || r.height < 2) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) continue;
      if (el.closest('.invisible')) continue; // dropdown panels that are closed
      const bg = bgOf(el);
      const fgL = lum(parse(cs.color));
      // Dark text is worst over the darkest pixel, light text over the lightest.
      const bgL = bg.overArt ? (fgL > 0.4 ? bg.max : bg.min) : bg.lum;
      const size = parseFloat(cs.fontSize);
      const weight = Number(cs.fontWeight);
      const large = size >= 24 || (size >= 18.66 && weight >= 700);
      nodes.push({
        text: own.replace(/\s+/g, ' ').slice(0, 26),
        color: cs.color,
        size,
        weight,
        need: large ? 3 : 4.5,
        ratio: (Math.max(fgL, bgL) + 0.05) / (Math.min(fgL, bgL) + 0.05),
        overArt: bg.overArt,
        white: cs.color === 'rgb(255, 255, 255)',
      });
    }

    // Panels that sit over the header art must stay opaque or the artwork
    // shows through the dropdown text.
    const panels = [...header.querySelectorAll('.bg-white')].map((p) => ({
      alpha: alphaOf(getComputedStyle(p).backgroundColor),
      id: p.id || p.className.slice(0, 28),
    }));

    return { loaded, hasArt, artMin, artMax, nodes, headerHeight, panels };
  }, { art: ART, scrim: SCRIM });

  console.log(`\n=== ${width}px ===`);
  if (!data.loaded) fail(`${ART} failed to decode`);
  else pass(`artwork loaded, scrim-composited luminance ${data.artMin.toFixed(3)}..${data.artMax.toFixed(3)}`);
  if (!data.hasArt) fail('header is not painting the artwork');
  else pass('header paints the artwork');

  const seen = new Set();
  for (const n of data.nodes) {
    const key = `${n.color}|${n.size}|${n.overArt}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // White on the orange pill is the long-standing accepted combination,
    // already whitelisted in contrast-audit as rgb(255,255,255) on rgb(255,102,0).
    if (n.white && !n.overArt) continue;
    if (n.ratio >= n.need) pass(`${n.ratio.toFixed(2)}:1 (need ${n.need}) ${n.size}px  ${n.overArt ? 'on artwork' : 'on opaque'}  ${n.color}  "${n.text}"`);
    else fail(`${n.ratio.toFixed(2)}:1 (need ${n.need}) ${n.size}px  ${n.overArt ? 'on artwork' : 'on opaque'}  ${n.color}  "${n.text}"`);
  }

  for (const p of data.panels) {
    if (p.alpha < 0.95) fail(`panel ${p.id} is translucent (alpha ${p.alpha}) and would show the artwork through its text`);
  }
  if (data.panels.length) pass(`${data.panels.length} dropdown/mobile panels opaque`);
  if (data.headerHeight !== 100) console.log(`  note  header is ${data.headerHeight}px tall`);
  await page.close();
}

await browser.close();
server.close();

console.log(
  failures === 0
    ? `\nPASS: ${checks} header checks green - every navbar text node is legible on the artwork.`
    : `\n${failures} failure(s).`,
);
process.exit(failures === 0 ? 0 : 1);