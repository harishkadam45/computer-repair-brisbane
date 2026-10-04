import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

/**
 * Contrast audit for the dark field.
 *
 * Why this exists: contrast-audit.mjs resolves solid background-colour values
 * only. Now that the wash is painted on <body>, every node on every page
 * inherits a gradient background, so that script stops being able to see the
 * site at all - it reports "no AA failures" while noting 22-47 nodes per page as
 * "not statically checked". A silently shrinking checked-set reads like an
 * improvement and is the opposite of one.
 *
 * Gradients are composited rather than skipped. For each element the nearest
 * ancestor that actually establishes a background is found - an opaque colour
 * or the first gradient up the tree - and the lightest pixel that surface can
 * reach is computed by stacking its layers:
 *
 *   - layers are composited bottom-up, each with its own alpha, so a 0.28 glow
 *     over near-black does not get mistaken for solid orange;
 *   - within a layer the lightest colour stop is chosen, and within the stack
 *     the lightest partial composite is kept, so the result is an upper bound on
 *     how light the surface can get anywhere on the page.
 *
 * That bound is then what the text is scored against, which is the hard case for
 * light text: the dark header, the home hero and the navy CTA card all pass on
 * their genuinely darkest areas but the bound is what catches a mid-orange
 * glow washing out a heading.
 *
 * Three traps this has to avoid, each of which produced plausible but entirely
 * wrong numbers first time round:
 *
 *   1. Tailwind v4 emits oklab() for its opacity modifiers, so `text-white/60`
 *      computes to "oklab(0.999994 0.00004 0.00002 / 0.6)". Scraping three
 *      numbers out of that string returns oklab components, not channels, and
 *      every ratio collapses to a nonsense 1.56:1. Colours are normalised
 *      through a canvas, which handles rgb/rgba/oklab/oklch/color alike.
 *
 *   2. getImageData returns unpremultiplied RGBA, so reading white/60 back
 *      gives (255,255,255,153) - full white with an alpha hint. Scoring the
 *      channels alone reports an identical 13.44:1 for white/60, white/70 and
 *      white/80. Text alpha has to be composited over the background first.
 *
 *   3. The brightest pixel is not the base colour. The wash is near-black
 *      (#010104 - #08090f) with an orange glow over it at 0.28 alpha, and that
 *      composite is where light text has its worst ratio. Scoring against
 *      #010104 flatters every number on the page.
 */

const DIST = path.resolve('dist');
const PORT = 4422;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.woff2': 'font/woff2',
};
const ROUTES = [
  '/', '/pricing/', '/services/', '/contact/', '/quote/', '/about/',
 '/blog/', '/search/?q=laptop', '/laptop-repairs/',
  '/laptop-repairs-brendale/', '/service-area/', '/service-area/brisbane-north/',
  '/replace-or-repair-computer/', '/computer-repairs/',
];
const WIDTHS = [390, 768, 1280];

/*
 * There is deliberately no "known failure" list here any more. The old one
 * whitelisted white text on the orange button fill (2.94:1); that fill is now
 * the logo blue and carries dark text at 5.2:1 instead, so nothing needs
 * excusing and any failure below is a real one.
 */

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
const failures = new Map();
const warns = new Map();
let checks = 0;
let uncovered = 0;

const note = (map, key, sample) => {
  if (!map.has(key)) map.set(key, { n: 0, e: [] });
  const e = map.get(key);
  e.n++;
  if (e.e.length < 3 && !e.e.includes(sample)) e.e.push(sample);
};

for (const route of ROUTES) {
  for (const width of WIDTHS) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(`${ORIGIN}${route}`, { waitUntil: 'load' });
    await page.waitForTimeout(300);

    const res = await page.evaluate(() => {
      const srgb = (v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
      const lum = ([r, g, b]) => 0.2126 * srgb(r / 255) + 0.7152 * srgb(g / 255) + 0.0722 * srgb(b / 255);
      const over = (fg, bg) => [0, 1, 2].map((k) => fg[k] * fg[3] + bg[k] * (1 - fg[3]));

      const cv = document.createElement('canvas');
      cv.width = cv.height = 1;
      const ctx = cv.getContext('2d', { willReadFrequently: true });
      const toRGBA = (css) => {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = css;
        ctx.fillRect(0, 0, 1, 1);
        const d = ctx.getImageData(0, 0, 1, 1).data;
        return [d[0], d[1], d[2], d[3] / 255];
      };

      const LAYER_RE = /(?:linear|radial|conic)-gradient\((?:[^()]|\([^()]*\))*\)/gi;
      const STOP_RE = /rgba?\([^)]*\)|hsla?\([^)]*\)|#[0-9a-f]{3,8}\b/gi;

      /** Lightest pixel any point of this background stack can reach. */
      const boundOf = (bgColor, bgImage) => {
        const base = toRGBA(bgColor);
        let acc = base[3] >= 0.95 ? base.slice(0, 3) : [0, 0, 0];
        let best = acc;
        const consider = (c) => {
          if (lum(c) > lum(best)) best = c.slice();
        };
        consider(acc);
        for (const g of bgImage.match(LAYER_RE) ?? []) {
          const stops = (g.match(STOP_RE) ?? []).map(toRGBA).filter((s) => s[3] > 0);
          if (!stops.length) continue;
          // Lightest stop in the layer, at its strongest alpha: the most this
          // layer can ever contribute.
          const light = stops.reduce((a, b) => (lum(b) > lum(a) ? b : a));
          const a = Math.max(...stops.map((s) => s[3]));
          acc = [0, 1, 2].map((k) => light[k] * a + acc[k] * (1 - a));
          consider(acc);
        }
        return { bg: best, gradient: bgImage !== 'none' };
      };

/**
       * A gradient that only covers a hairline is decoration, not a backdrop.
       *
       * .link-underline draws its underline with linear-gradient(currentColor,
       * currentColor) at background-size 100% 1px - and Chrome resolves
       * currentColor in the computed background-image, so it reads back as
       * "linear-gradient(rgb(255,170,128), rgb(255,170,128))". Scored as a
       * surface that makes every underlined link report its own text colour as
       * its background, i.e. a permanent, entirely fictional 1:1 failure.
       */
      const isHairline = (p) => {
        const s = getComputedStyle(p);
        const m = s.backgroundSize.match(/^([\d.]+)(px|%)?\s+([\d.]+)(px|%)?$/);
        if (!m) return false;
        const box = p.getBoundingClientRect().height || 1;
        const h = m[4] === '%' ? (parseFloat(m[3]) / 100) * box : parseFloat(m[3]);
        return h < box * 0.5;
      };

      /** Nearest ancestor that establishes a background, gradient or not. */
      const surfaceOf = (el) => {
        for (let p = el; p && p !== document.documentElement; p = p.parentElement) {
          const s = getComputedStyle(p);
          const label = `${p.tagName.toLowerCase()}${p.id ? '#' + p.id : ''}.${String(p.className).split(/\s+/).filter(Boolean).slice(0, 3).join('.')}`;
          if (s.backgroundImage.includes('gradient') && !isHairline(p)) return { ...boundOf(s.backgroundColor, s.backgroundImage), from: label, rawColor: s.backgroundColor, rawImage: s.backgroundImage.slice(0, 70) };
          const c = toRGBA(s.backgroundColor);
          if (c[3] >= 0.95) return { ...boundOf(s.backgroundColor, 'none'), from: label, rawColor: s.backgroundColor, rawImage: 'none' };
        }
        const b = getComputedStyle(document.body);
        return { ...boundOf(b.backgroundColor, b.backgroundImage), from: 'body', rawColor: b.backgroundColor, rawImage: b.backgroundImage.slice(0, 70) };
      };

      const rows = [];
      for (const el of document.body.querySelectorAll('*')) {
        const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join('');
        const r = el.getBoundingClientRect();
        if (!own || r.width < 2 || r.height < 2) continue;
        const s = getComputedStyle(el);
        if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) === 0) continue;
        if (el.closest('.invisible') || el.closest('[hidden]')) continue;

        const surf = surfaceOf(el);
        const bgL = lum(surf.bg);
        const fg = toRGBA(s.color);
        const fgL = lum(over(fg, [...surf.bg, 1]));
        const size = parseFloat(s.fontSize);
        const weight = Number(s.fontWeight);
        rows.push({
          text: own.replace(/\s+/g, ' ').slice(0, 30),
          html: el.outerHTML.slice(0, 130),
          color: s.color,
          bg: `rgb(${surf.bg.map(Math.round).join(', ')})`,
          gradient: surf.gradient,
          surface: `${surf.from} [bg=${surf.rawColor} img=${surf.rawImage}]`,
          size,
          need: size >= 24 || (size >= 18.66 && weight >= 700) ? 3 : 4.5,
          ratio: (Math.max(fgL, bgL) + 0.05) / (Math.min(fgL, bgL) + 0.05),
        });
      }
      return rows;
    });

    for (const r of res) {
      if (r.gradient) uncovered++;
      const ratio = Math.round(r.ratio * 100) / 100;
      if (ratio >= r.need) {
        checks++;
        continue;
      }
note(failures, `${r.color} on ${r.bg} = ${ratio}:1 (need ${r.need})  <-  ${r.surface}  ${route}`, r.html);
    }
    await page.close();
  }
}

await browser.close();
server.close();

const dump = (title, map) => {
  console.log(`\n=== ${title} ===`);
  if (!map.size) return console.log('  none');
  for (const [k, v] of [...map].sort((a, b) => b[1].n - a[1].n)) {
    console.log(`  ${String(v.n).padStart(4)}x  ${k}`);
    console.log(`         e.g. ${v.e.map((t) => `"${t}"`).join(', ')}`);
  }
};
dump('FAIL - fix these', failures);
dump('WARN - deliberately accepted', warns);
console.log(`\n${checks} nodes pass. ${uncovered} were scored against a composited gradient bound.`);
console.log(failures.size === 0 ? 'PASS' : `${failures.size} failing combination(s)`);
process.exit(failures.size === 0 ? 0 : 1);