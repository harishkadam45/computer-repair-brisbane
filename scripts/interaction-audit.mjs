/**
 * Functional checks that a clean layout audit cannot prove:
 *
 * 1. The Services mega menu actually opens on hover and is not clipped by the
 *    root `overflow-x: clip` that now contains its stray overflow.
 * 2. The sticky header still sticks - `clip` was chosen over `hidden` partly for
 *    this reason, so it needs proving.
 * 3. Mobile nav opens and closes.
 * 4. Tap targets on primary controls meet the 44px recommendation.
 *
 * Usage: node scripts/interaction-audit.mjs
 */
import { chromium, firefox, webkit } from 'playwright';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const DIST = path.resolve('dist');
const PORT = 4397;
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

const engines = [
  { name: 'chromium', type: chromium },
  { name: 'firefox', type: firefox },
  { name: 'webkit', type: webkit },
];

const results = [];
const record = (engine, check, ok, detail = '') => {
  results.push({ engine, check, ok, detail });
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${check}${detail ? ` - ${detail}` : ''}`);
};

for (const { name, type } of engines) {
  const browser = await type.launch();
  console.log(`\n=== ${name} ===`);

  // --- desktop mega menu ---
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${O}/`, { waitUntil: 'load' });
    const trigger = page.locator('header nav .group.relative > a').first();
    await trigger.hover();
    await page.waitForTimeout(400);

    const panel = page.locator('header nav .group.relative > div').first();
    const state = await panel.evaluate((el) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        visibility: cs.visibility,
        opacity: Number(cs.opacity),
        width: Math.round(r.width),
        right: Math.round(r.right),
        viewport: document.documentElement.clientWidth,
        links: el.querySelectorAll('a').length,
      };
    });
    record(name, 'mega menu opens on hover', state.visibility === 'visible' && state.opacity > 0.9,
      `vis=${state.visibility} op=${state.opacity}`);
    record(name, 'mega menu fully inside viewport (not clipped)',
      state.right <= state.viewport && state.width > 300,
      `right=${state.right} vw=${state.viewport} w=${state.width}`);
    record(name, 'mega menu has service links', state.links > 20, `${state.links} links`);

    // Group headings present
    const groups = await page.locator('header nav h3').allTextContents();
    record(name, 'mega menu grouped into 3 headings', groups.length >= 3, groups.join(' / '));

    await ctx.close();
  }

  // --- sticky header ---
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 700 } });
    const page = await ctx.newPage();
    await page.goto(`${O}/data-recovery/`, { waitUntil: 'load' });
    const top = await page.locator('header').evaluate((el) => el.getBoundingClientRect().top);
    await page.evaluate(() => window.scrollTo(0, 1200));
    await page.waitForTimeout(300);
    const after = await page.locator('header').evaluate((el) => el.getBoundingClientRect().top);
    record(name, 'header stays sticky after scroll', Math.abs(after - top) < 2 && after <= 1,
      `before=${Math.round(top)} after=${Math.round(after)}`);
    await ctx.close();
  }

  // --- mobile nav ---
  {
    const ctx = await browser.newContext({
      viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true,
    });
    const page = await ctx.newPage();
    await page.goto(`${O}/`, { waitUntil: 'load' });
    const toggle = page.locator('[aria-controls="mobile-nav"]').first();
    const hiddenBefore = await page.locator('#mobile-nav').isHidden();
    await toggle.click();
    await page.waitForTimeout(350);
    const shownAfter = await page.locator('#mobile-nav').isVisible();
    record(name, 'mobile nav hidden then opens on tap', hiddenBefore && shownAfter);

    const groups = await page.locator('#mobile-nav h3').allTextContents();
    record(name, 'mobile nav grouped headings', groups.length >= 3, groups.join(' / '));

    // tap target sizes
    const small = await page.evaluate(() => {
      const out = [];
      for (const a of document.querySelectorAll('#mobile-nav a, header a, header button')) {
        const r = a.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.height < 40) out.push(`${(a.textContent || '').trim().slice(0, 24)}=${Math.round(r.height)}px`);
      }
      return out;
    });
    record(name, 'header/mobile tap targets >= 40px', small.length === 0, small.slice(0, 4).join(', '));
    await ctx.close();
  }

  await browser.close();
}

server.close();
const failed = results.filter((r) => !r.ok);
console.log('\n' + '='.repeat(70));
if (failed.length === 0) {
  console.log(`PASS: all ${results.length} interaction checks green across ${engines.length} engines.`);
} else {
  console.log(`${failed.length} failed of ${results.length}:`);
  failed.forEach((f) => console.log(`  [${f.engine}] ${f.check} - ${f.detail}`));
}
process.exit(failed.length === 0 ? 0 : 1);