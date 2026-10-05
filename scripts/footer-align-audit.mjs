import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const DIST = path.resolve('dist');
const PORT = 4412;
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
let bad = 0;
const say = (ok, m) => { if (!ok) bad++; console.log(`  ${ok ? 'OK  ' : 'FAIL'}  ${m}`); };

/*
 * Verifies every footer block is flush left on narrow screens.
 *
 * Three traps this has to avoid, each of which produced a false failure first
 * time round:
 *
 *   - container-page's *box* starts at x=0; its padding is the real gutter.
 *     Measuring against the box reports every heading as 20px out.
 *   - a two-column list is legitimately left-aligned with items on two edges.
 *     Spreading every link into one min/max reports a healthy grid as ragged.
 *   - a[aria-label] also catches the phone/email/address links, which stack in
 *     the brand block. Social tiles have to be scoped to the Follow row.
 *
 * So: compare against the padded content edge, and group links into columns
 * before asserting anything about their left edges.
 */
for (const w of [320, 375, 414, 640, 768, 1023]) {
  const page = await browser.newPage({ viewport: { width: w, height: 900 } });
  await page.goto(`${O}/`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts?.ready);
  await page.waitForTimeout(250);

  const r = await page.evaluate(() => {
    const footer = document.querySelector('footer');
    const box = footer.querySelector('.container-page');
    const bs = getComputedStyle(box);
    const b = box.getBoundingClientRect();
    const edge = Math.round(b.left + parseFloat(bs.paddingLeft));

    const rows = [];
    for (const h of footer.querySelectorAll('h2')) {
      const list = h.nextElementSibling;
      if (!list || list.tagName !== 'UL') continue;
      const cols = new Map();
      for (const a of list.querySelectorAll('a')) {
        const l = Math.round(a.getBoundingClientRect().left);
        cols.set(l, (cols.get(l) ?? 0) + 1);
      }
      rows.push({
        head: h.textContent.trim(),
        align: getComputedStyle(h).textAlign,
        headLeft: Math.round(h.getBoundingClientRect().left),
        listAlign: getComputedStyle(list).textAlign,
        cols: [...cols.entries()].sort((a, b) => a[0] - b[0]),
      });
    }

    // Scope social tiles to the row after the Follow heading, not every labelled link.
    const follow = [...footer.querySelectorAll('h2')].find((h) => h.textContent.trim() === 'Follow');
    const socialRow = follow?.nextElementSibling;
    const socialLefts = socialRow ? [...socialRow.children].map((c) => Math.round(c.getBoundingClientRect().left)) : [];

    return {
      rows,
      edge,
      socialLefts,
      over: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    };
  });

  console.log(`\n=== ${w}px  (content left edge ${r.edge}) ===`);
  say(r.edge > 0, 'container gutter resolved', `edge=${r.edge}`);
  for (const row of r.rows) {
    const leftmost = row.cols[0]?.[0];
    const flush = Math.abs(leftmost - r.edge) <= 1;
    say(row.align === 'left', `${row.head} heading is left-aligned`, `text-align:${row.align}`);
    say(row.listAlign === 'left', `${row.head} list text is left-aligned`, `text-align:${row.listAlign}`);
    say(Math.abs(row.headLeft - r.edge) <= 1, `${row.head} heading is flush with the gutter`, `${row.headLeft} vs ${r.edge}`);
    say(flush, `${row.head} first column starts at the gutter`, `${leftmost} vs ${r.edge}`);
    say(
      row.cols.length <= 2,
      `${row.head} columns are flush-left, not centred`,
      `${row.cols.length} col(s): [${row.cols.map(([l, n]) => `${l}x${n}`).join(', ')}]`,
    );
  }
  // Tiles sit in a row, so only the first one defines the left edge. Asserting
  // a zero spread here would flag two tiles side by side as misalignment.
  say(r.socialLefts.length > 0 && Math.abs(r.socialLefts[0] - r.edge) <= 1, 'first social tile starts at the gutter', `left=${r.socialLefts[0]} vs ${r.edge}`);
  say(!r.over, 'no horizontal overflow');
  await page.close();
}

/*
 * Desktop must keep every footer block on one row with equal gaps, and every
 * link column must line up with its own heading.
 *
 * These used to assert centred headings. They are now left-aligned at every
 * width: centring the Services two-column grid left a ragged edge on both sides
 * that read as misalignment, most obviously on an iPad Mini at 1024 and a
 * Surface Pro 10 at 1366 - the widths that trip the lg breakpoint. The centred
 * tier was also the reason those devices looked wrong, since the old rule made
 * the narrowest "desktop" width the trigger.
 *
 * Note what is NOT asserted here: the columns do not line up with the page
 * gutter at these widths, and must not be made to. From lg up the blocks are a
 * justify-between row, so only the first block touches the gutter and the rest
 * are spaced by leftover width. What has to hold is that each column's own list
 * starts where its own heading starts. The gutter check belongs to the stacked
 * tier above, and is correct there.
 */
for (const w of [1024, 1280, 1366, 1440]) {
  const page = await browser.newPage({ viewport: { width: w, height: 900 } });
  await page.goto(`${O}/`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts?.ready);
  await page.waitForTimeout(250);
  const r = await page.evaluate(() => {
    const footer = document.querySelector('footer');
    const row = [...footer.querySelectorAll('div')].find((d) => String(d.className).includes('lg:justify-between'));
    const rects = [...row.children].map((c) => c.getBoundingClientRect());
    const gaps = [];
    for (let i = 1; i < rects.length; i++) if (Math.abs(rects[i].top - rects[i - 1].top) < 2) gaps.push(Math.round(rects[i].left - rects[i - 1].right));

    const cols = [...footer.querySelectorAll('h2')].map((h) => {
      const n = h.nextElementSibling;
      const headLeft = Math.round(h.getBoundingClientRect().left);
      const links = n?.tagName === 'UL' ? [...n.querySelectorAll('a')] : [...(n?.children ?? [])];
      const lefts = links.map((a) => Math.round(a.getBoundingClientRect().left));
      return {
        text: h.textContent.trim(),
        align: getComputedStyle(h).textAlign,
        listAlign: n?.tagName === 'UL' ? getComputedStyle(n).textAlign : null,
        headLeft,
        firstCol: lefts.length ? Math.min(...lefts) : null,
      };
    });

    return {
      gaps,
      equal: gaps.length === 3 && Math.max(...gaps) - Math.min(...gaps) <= 1,
      rows: new Set(rects.map((x) => Math.round(x.top))).size,
      cols,
      over: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    };
  });
  console.log(`\n=== ${w}px desktop ===`);
  say(r.rows === 1, 'footer blocks on one row', `rows=${r.rows}`);
  say(r.equal, 'equal gaps preserved', `[${r.gaps.join(', ')}]`);
  for (const c of r.cols) {
    say(c.align === 'left', `${c.text} heading is left-aligned`, `text-align:${c.align}`);
    if (c.listAlign !== null) say(c.listAlign === 'left', `${c.text} list text is left-aligned`, `text-align:${c.listAlign}`);
    say(c.firstCol !== null && Math.abs(c.firstCol - c.headLeft) <= 1, `${c.text} content lines up with its heading`, `${c.firstCol} vs ${c.headLeft}`);
  }
  say(!r.over, 'no horizontal overflow');
  await page.close();
}

console.log(bad === 0 ? '\nPASS: footer flush left when stacked, columns aligned to their headings on desktop.' : `\n${bad} check(s) failed.`);
await browser.close();
server.close();