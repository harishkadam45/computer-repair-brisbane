/**
 * Contrast audit for the recolour. Walks the real rendered pages, resolves each
 * text node's effective background by walking up for a non-transparent one, and
 * reports every combination that fails WCAG AA.
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const DIST = path.resolve('dist');
const PORT = 4395;
const O = `http://127.0.0.1:${PORT}`;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.xml': 'application/xml', '.woff2': 'font/woff2',
};

const server = createServer(async (req, res) => {
  let rel = decodeURIComponent(new URL(req.url, O).pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const f = path.join(DIST, rel);
  try { const s = await stat(f); if (s.isDirectory()) return; } catch { res.writeHead(404).end('nf'); return; }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] ?? 'application/octet-stream' });
  res.end(await readFile(f));
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

const ROUTES = ['/', '/laptop-repairs/', '/pricing/', '/contact/', '/quote/', '/laptop-repairs-brendale/'];

const browser = await chromium.launch();
const totals = new Map();
const gradientTotals = new Map();

for (const route of ROUTES) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  await page.goto(`${O}${route}`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts?.ready);
  await page.waitForTimeout(250);

  const failures0 = await page.evaluate(() => {
    const srgb = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    const lum = ([r, g, b]) => 0.2126 * srgb(r / 255) + 0.7152 * srgb(g / 255) + 0.0722 * srgb(b / 255);
    const parse = (str) => {
      const m = str.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
      return { rgb: [p[0], p[1], p[2]], a: p.length > 3 ? p[3] : 1 };
    };
    const over = (fg, bg) => fg.rgb.map((c, i) => c * fg.a + bg[i] * (1 - fg.a));

    const bgOf = (el) => {
      let node = el;
      let acc = null;
      while (node && node !== document.documentElement) {
        const c = parse(getComputedStyle(node).backgroundColor);
        if (c && c.a > 0) {
          acc = acc === null ? (c.a === 1 ? c.rgb : null) : acc;
          if (c.a === 1) return c.rgb;
          if (acc === null) acc = over(c, [255, 255, 255]);
          else acc = over(c, acc);
        }
        node = node.parentElement;
      }
      return acc || [255, 255, 255];
    };

    const out = [];
    const onGradient = [];
    const seen = new Set();

    // An ancestor painting a background-image (the hero gradient, the brand
    // mesh) makes the walk-up below meaningless: it reports white text inside
    // the dark hero as white-on-white, 1:1, which is pure noise. Those are
    // counted separately rather than reported as failures.
    const insideGradient = (el) => {
      let node = el;
      while (node && node !== document.documentElement) {
        const bi = getComputedStyle(node).backgroundImage;
        if (bi && bi !== 'none') return true;
        node = node.parentElement;
      }
      return false;
    };

    for (const el of document.querySelectorAll('body *')) {
      // Only elements with their own visible text.
      const own = [...el.childNodes]
        .filter((n) => n.nodeType === 3)
        .map((n) => n.textContent.trim())
        .join('');
      if (!own) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.15) continue;

      const fg = parse(cs.color);
      if (!fg) continue;
      const bg = bgOf(el);
      const eff = fg.a < 1 ? over(fg, bg) : fg.rgb;
      const l1 = lum(eff);
      const l2 = lum(bg);
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

      const size = parseFloat(cs.fontSize);
      const weight = Number(cs.fontWeight) || 400;
      const large = size >= 24 || (size >= 18.66 && weight >= 700);
      const need = large ? 3 : 4.5;
      if (ratio < need) {
        if (insideGradient(el)) {
          onGradient.push({ sample: own.slice(0, 34), color: cs.color, ratio, need });
          continue;
        }
        const key = `${cs.color}|${bg.join(',')}|${size}|${weight}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
          sample: own.slice(0, 34),
          color: cs.color,
          bg: `rgb(${bg.join(',')})`,
          ratio: Math.round(ratio * 100) / 100,
          need,
          size: Math.round(size * 10) / 10,
          weight,
          tag: el.tagName.toLowerCase(),
          cls: (el.className || '').toString().slice(0, 44),
        });
      }
    }
    return { out, onGradient };
  });

  const failures = failures0.out;
  const grad = failures0.onGradient;
  let skipped = 0;

  if (failures.length) {
    console.log(`\n=== ${route} (${failures.length} distinct failures) ===`);
    for (const f of failures.slice(0, 22)) {
      const key = `${f.color} on ${f.bg}`;
      totals.set(key, (totals.get(key) ?? 0) + 1);
      console.log(
        `  ${String(f.ratio).padStart(5)}:1 (need ${f.need})  ${f.color} on ${f.bg}  ` +
          `${f.size}px/${f.weight}  <${f.tag}> "${f.sample}"`
      );
    }
  } else {
    console.log(`\n=== ${route} === no AA failures`);
  }
  if (grad.length) {
    const uniq = [...new Map(grad.map((g) => [`${g.color}|${g.sample}`, g])).values()];
    console.log(`    (${grad.length} nodes on gradient backgrounds not statically checked, e.g. ${uniq.slice(0, 3).map((g) => `"${g.sample}" ${g.color}`).join('; ')})`);
    for (const g of uniq) {
      if (!gradientTotals.has(g.color)) gradientTotals.set(g.color, new Set());
      gradientTotals.get(g.color).add(g.sample);
    }
  }
  await page.close();
}

console.log('\n=== distinct failing combinations across sampled pages ===');
for (const [k, v] of [...totals.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${v} occurrence-group(s)  ${k}`);
}

console.log('\n=== text colours sitting on gradients (verify by eye) ===');
for (const [color, samples] of gradientTotals) {
  console.log(`  ${color}  e.g. ${[...samples].slice(0, 3).map((s) => `"${s}"`).join(', ')}`);
}

await browser.close();
server.close();