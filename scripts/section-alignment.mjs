/**
 * Measures homepage section geometry so layout drift shows up as numbers
 * rather than as a vague "looks off".
 *
 * For each section it reports: background colour, horizontal padding of the
 * container, left/right edge of the content, the heading's left edge and top,
 * and the vertical gap between the heading block and the grid below it. The
 * idea is that every section should agree on container edges and vertical
 * rhythm, so a mismatch is a real regression rather than taste.
 *
 * Usage: node scripts/section-alignment.mjs [origin]
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const DIST = path.resolve('dist');
const PORT = 4393;
const O = `http://127.0.0.1:${PORT}`;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.xml': 'application/xml', '.txt': 'text/plain', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
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

const width = Number(process.argv[3] ?? 1280);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width, height: 1000 } });
const page = await ctx.newPage();
await page.goto(`${O}/`, { waitUntil: 'load' });

const rows = await page.evaluate(() => {
  const out = [];
  const main = document.querySelector('main');
  if (!main) return out;

  for (const section of main.querySelectorAll(':scope > section')) {
    const cs = getComputedStyle(section);
    // The content container is either the section itself or its first child.
    const container = section.classList.contains('container-page')
      ? section
      : section.querySelector('.container-page');
    if (!container) continue;

    const ccs = getComputedStyle(container);
    const cr = container.getBoundingClientRect();
    const sr = section.getBoundingClientRect();

    const heading = section.querySelector('h2');
    const hr = heading?.getBoundingClientRect();
    // First grid/list that holds the section's cards.
    const grid = section.querySelector('ul[class*="grid"], div[class*="grid"]');
    const gr = grid?.getBoundingClientRect();

    // First card, so left-edge agreement can be checked at the content level.
    const card = grid?.querySelector('li, a, div');
    const cardR = card?.getBoundingClientRect();

    out.push({
      name: heading?.textContent?.trim().slice(0, 26) || '(no h2)',
      bg: cs.backgroundColor,
      borderTop: cs.borderTopWidth,
      borderBottom: cs.borderBottomWidth,
      secTop: Math.round(sr.top + window.scrollY),
      secHeight: Math.round(sr.height),
      padTop: ccs.paddingTop,
      padBottom: ccs.paddingBottom,
      left: Math.round(cr.left),
      right: Math.round(cr.right),
      hLeft: hr ? Math.round(hr.left) : null,
      gridTop: gr ? Math.round(gr.top) : null,
      cardLeft: cardR ? Math.round(cardR.left) : null,
      gapHeadingToGrid:
        hr && gr ? Math.round(gr.top - hr.bottom) : null,
    });
  }
  return out;
});

console.log(`Homepage section alignment @ ${width}px\n`);
const pad = (s, n) => String(s ?? '-').padStart(n);
console.log(
  `${pad('SECTION', 27)}${pad('BG', 18)}${pad('PAD-Y', 14)}${pad('LEFT', 7)}${pad('RIGHT', 7)}${pad('H-LEFT', 8)}${pad('CARD-L', 8)}${pad('H→GRID', 9)}`);
console.log('-'.repeat(105));
for (const r of rows) {
  const bg = r.bg.replace('rgb(', '').replace(')', '');
  const bgShort = bg === 'rgba(0, 0, 0, 0)' ? 'transparent' : bg;
  console.log(
    `${pad(r.name, 27)}${pad(bgShort, 18)}${pad(r.padTop + '/' + r.padBottom, 14)}` +
    `${pad(r.left, 7)}${pad(r.right, 7)}${pad(r.hLeft, 8)}${pad(r.cardLeft, 8)}${pad(r.gapHeadingToGrid, 9)}`);
}

// Highlight inconsistencies rather than leaving the reader to spot them.
console.log('\nConsistency check:');
const lefts = [...new Set(rows.map((r) => r.left))];
const rights = [...new Set(rows.map((r) => r.right))];
const cardLefts = [...new Set(rows.filter((r) => r.cardLeft != null).map((r) => r.cardLeft))];
const pads = [...new Set(rows.map((r) => `${r.padTop}/${r.padBottom}`))];

// Hero and trust bar are deliberately different blocks (tall mesh hero, compact
// trust strip), so compare the repeating content sections only.
const contentRows = rows.filter((r) => r.padTop !== '96px' && r.padTop !== '56px');
const gaps = [
  ...new Set(
    contentRows
      .filter((r) => r.gapHeadingToGrid != null && r.gapHeadingToGrid > 0)
      .map((r) => r.gapHeadingToGrid),
  ),
];

const flag = (label, vals) => {
  if (vals.length > 1) console.log(`  DRIFT  ${label}: ${vals.join(', ')}`);
  else console.log(`  ok     ${label}: ${vals[0] ?? 'n/a'}`);
};
const contentPads = [...new Set(contentRows.map((r) => `${r.padTop}/${r.padBottom}`))];
flag('container left edge', lefts);
flag('container right edge', rights);
flag('card left edge', cardLefts);
flag('content-section padding', contentPads);
flag('heading→grid gap (stacked cards)', gaps);
console.log(`         (hero ${pads.join(', ')} excluded - unique blocks)`);

// Sections whose cards are full-width grids under a heading should share a gap.
const stacked = rows.filter((r) => r.gapHeadingToGrid != null && r.gapHeadingToGrid > 0);
if (stacked.length) {
  const g = [...new Set(stacked.map((r) => r.gapHeadingToGrid))];
  console.log(`  ${g.length === 1 ? 'ok    ' : 'DRIFT '} stacked-card sections share one gap: ${g.join(', ')}`);
  stacked.forEach((r) => console.log(`         ${r.gapHeadingToGrid}px  ${r.name}`));
}

const bgs = rows.map((r) => r.bg);
console.log(`\n  backgrounds in order: ${bgs.map((b) => (b === 'rgba(0, 0, 0, 0)' ? 'transparent' : b.replace(/rgba?\(|\)/g, ''))).join(' | ')}`);

await ctx.close();
await browser.close();
server.close();