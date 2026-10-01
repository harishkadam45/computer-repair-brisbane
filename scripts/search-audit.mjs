/**
 * Functional checks for the navbar search added in this change.
 *
 * 1. Desktop and mobile search inputs exist, are tappable, and fit the viewport.
 * 2. /search-index.json is served, is valid JSON, and covers services, families,
 *    posts and suburbs.
 * 3. Typing ranks the matching service page first (the whole point: "virus"
 *    must not return a blog post before the virus service page).
 * 4. The dropdown opens, stays inside the viewport, closes on Escape and on
 *    outside click.
 * 5. Submitting without JavaScript still reaches /search/, and that page falls
 *    back to a browsable service list rather than an empty shell.
 *
 * Usage: node scripts/search-audit.mjs   (requires a built dist/)
 */
import { chromium, firefox, webkit } from 'playwright';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const DIST = path.resolve('dist');
const PORT = 4398;
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

// --- index contents (engine independent) ---
{
  const raw = await readFile(path.join(DIST, 'search-index.json'), 'utf8');
  const index = JSON.parse(raw);
  const byType = {};
  index.forEach((h) => (byType[h.ty] = (byType[h.ty] || 0) + 1));
  console.log('\n=== index ===');
  record('index', 'search-index.json is valid JSON', Array.isArray(index), `${index.length} entries`);
  record('index', 'covers services, families, posts and suburbs',
    byType.service >= 18 && byType.family === 4 && byType.post === 110 && byType.suburb > 600,
    JSON.stringify(byType));
  record('index', 'every entry has a title and a root-relative path',
    index.every((h) => h.t && h.u.startsWith('/')));
  record('index', 'summaries stripped of HTML tags',
    index.every((h) => !h.d || !/<[a-z]/i.test(h.d)));
  record('index', 'index is not inlined into pages',
    !(await readFile(path.join(DIST, 'index.html'), 'utf8')).includes('id="search-index"'),
    'fetched on demand');
}

for (const { name, type } of engines) {
  const browser = await type.launch();
  console.log(`\n=== ${name} ===`);

  // --- desktop navbar search ---
  // There are two desktop fields: #nav-search in the utility bar, visible only
  // from 1024 to 1119px, and #navbar-search in the main nav from 1120px up.
  // Exactly one is on screen at any width, so resolve whichever is live instead
  // of hardcoding one id - at 1440px #nav-search is hidden and its bounding box
  // collapses to x=-1 w=0.
  const desktopSearchId = async (page) =>
    page.evaluate(() => {
      const nav = document.getElementById('navbar-search');
      return nav && nav.offsetParent ? 'navbar-search' : 'nav-search';
    });

  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${O}/`, { waitUntil: 'load' });

    const id = await desktopSearchId(page);
    record(name, 'desktop search is in the main nav at 1440',
      id === 'navbar-search', `#${id}`);

    // Only one desktop field may be on screen at a time.
    record(name, 'exactly one desktop search field is visible',
      await page.evaluate(() =>
        ['navbar-search', 'nav-search']
          .filter((x) => document.getElementById(x)?.offsetParent).length === 1),
      'no duplicated search inputs');

    const input = page.locator(`#${id}`);
    record(name, 'desktop search input visible', await input.isVisible());

    const box = await input.boundingBox();
    record(name, 'desktop search input fits viewport',
      box && box.x >= 0 && box.x + box.width <= 1440, `x=${Math.round(box?.x ?? -1)} w=${Math.round(box?.width ?? 0)}`);

    record(name, 'form is a real GET to /search/',
      await input.evaluate((el) => el.form?.getAttribute('method') === 'get' && el.form?.getAttribute('action') === '/search/'),
      'works without JS');

    // It must sit after Contact, at the end of the nav.
    record(name, 'nav search is placed after Contact',
      await page.evaluate(() => {
        const f = document.getElementById('navbar-search');
        const c = [...document.querySelectorAll('header a')].find((a) => a.textContent.trim() === 'Contact');
        return !!f && !!c && !!(c.compareDocumentPosition(f) & Node.DOCUMENT_POSITION_FOLLOWING);
      }), 'DOM order');

    // About must directly precede Contact, with nothing wedged between them.
    record(name, 'About is directly followed by Contact',
      await page.evaluate(() => {
        const links = [...document.querySelectorAll('header nav a')];
        const about = links.findIndex((a) => a.textContent.trim() === 'About');
        return about !== -1 && links[about + 1]?.textContent.trim() === 'Contact';
      }), 'no items between');

    await input.click();
    await input.fill('virus');
    await page.waitForTimeout(350);

    const panel = page.locator(`#${id}-results`);
    const open = await panel.isVisible();
    record(name, 'dropdown opens while typing', open);

    const first = await panel.locator('a').first().textContent().catch(() => '');
    record(name, 'exact service ranks first for "virus"',
      /virus/i.test(first?.trim() ?? ''), first?.trim().slice(0, 40));

    const pbox = await panel.boundingBox();
    record(name, 'dropdown stays inside viewport',
      pbox && pbox.x >= 0 && pbox.x + pbox.width <= 1440,
      `x=${Math.round(pbox?.x ?? -1)} w=${Math.round(pbox?.width ?? 0)}`);

    record(name, 'aria-expanded tracks dropdown state',
      (await input.getAttribute('aria-expanded')) === 'true');

    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    record(name, 'Escape closes the dropdown', !(await panel.isVisible()));

    await input.fill('slow');
    await page.waitForTimeout(350);
    record(name, 'dropdown reopens after Escape', await panel.isVisible());

    await page.mouse.click(20, 700);
    await page.waitForTimeout(200);
    record(name, 'outside click closes the dropdown', !(await panel.isVisible()));

    await input.fill('data recovery');
    await page.waitForTimeout(350);
    await input.press('Enter');
    await page.waitForLoadState('load');
    record(name, 'Enter navigates to the search page',
      page.url().includes('/search/?q=data+recovery') || page.url().includes('/search/?q=data%20recovery'),
      new URL(page.url()).search);

    await ctx.close();
  }

  // --- desktop at 1024: the tightest desktop layout, where the main nav has no
  // room for a field and the utility-bar copy is the one on screen ---
  {
    const ctx = await browser.newContext({ viewport: { width: 1024, height: 800 } });
    const page = await ctx.newPage();
    await page.goto(`${O}/`, { waitUntil: 'load' });
    record(name, 'desktop search is in the utility bar at 1024',
      (await desktopSearchId(page)) === 'nav-search');
    const overflow = await page.evaluate(() => {
      const id = document.getElementById('navbar-search')?.offsetParent ? 'navbar-search' : 'nav-search';
      const r = document.getElementById(id).getBoundingClientRect();
      const bar = document.querySelector('header .container-page.flex.h-9');
      return {
        right: Math.round(r.right),
        vw: document.documentElement.clientWidth,
        barFits: Math.round(bar.scrollWidth) <= Math.round(bar.getBoundingClientRect().width) + 1,
      };
    });
    record(name, 'search fits beside the nav at 1024',
      overflow.right <= overflow.vw && overflow.barFits,
      `right=${overflow.right} vw=${overflow.vw} barFits=${overflow.barFits}`);
    await ctx.close();
  }

  // --- the handover window: exactly one field either side of 1120px ---
  for (const [w, expect] of [[1119, 'nav-search'], [1120, 'navbar-search']]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 800 } });
    const page = await ctx.newPage();
    await page.goto(`${O}/`, { waitUntil: 'load' });
    const got = await desktopSearchId(page);
    record(name, `desktop search handover at ${w}px`, got === expect, `#${got} (want #${expect})`);
    await ctx.close();
  }

  // --- search results page ---
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${O}/search/?q=virus`, { waitUntil: 'load' });
    await page.waitForTimeout(400);

    const results = await page.locator('[data-search-list] li').count();
    record(name, 'search page renders results', results > 0, `${results} results`);

    const first = await page.locator('[data-search-list] li a').first().textContent();
    record(name, 'search page ranks the service first',
      /virus/i.test(first?.trim() ?? ''), first?.trim().slice(0, 40));

    const descs = await page.locator('[data-search-list] li p').count();
    record(name, 'search results show summaries', descs > 0, `${descs} results with a summary`);

    const pageInput = page.locator('#search-page-input');
    record(name, 'search page reflects the query', (await pageInput.inputValue()) === 'virus');

    await pageInput.fill('brendale');
    await page.waitForTimeout(400);
    const sub = await page.locator('[data-search-list] li').first().textContent();
    record(name, 'suburb search resolves', /brendale/i.test(sub ?? ''), sub?.trim().slice(0, 40));

    record(name, 'query is reflected in the URL',
      page.url().includes('q=brendale'), new URL(page.url()).search);

    await pageInput.fill('zzzzqqq');
    await page.waitForTimeout(400);
    const empty = await page.locator('[data-search-list] li').count();
    const status = await page.locator('[data-search-status]').textContent();
    record(name, 'no-match state is explained, not blank', empty === 0 && /different word/i.test(status ?? ''),
      status?.trim().slice(0, 50));

    await ctx.close();
  }

  // --- mobile search ---
  {
    const ctx = await browser.newContext({
      viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true,
    });
    const page = await ctx.newPage();
    await page.goto(`${O}/`, { waitUntil: 'load' });

    const input = page.locator('#mobile-search');
    record(name, 'mobile search input visible', await input.isVisible());

    const h = await input.boundingBox();
    record(name, 'mobile search input meets tap target size', (h?.height ?? 0) >= 40, `h=${Math.round(h?.height ?? 0)}`);

    await input.click();
    await input.fill('virus');
    await page.waitForTimeout(350);

    const panel = page.locator('#mobile-search-results');
    record(name, 'mobile dropdown opens', await panel.isVisible());
    const pbox = await panel.boundingBox();
    record(name, 'mobile dropdown stays inside viewport',
      pbox && pbox.x >= 0 && pbox.x + pbox.width <= 375,
      `x=${Math.round(pbox?.x ?? -1)} w=${Math.round(pbox?.width ?? 0)}`);

    const first = await panel.locator('a').first().textContent().catch(() => '');
    record(name, 'mobile dropdown ranks the service first', /virus/i.test(first?.trim() ?? ''),
      first?.trim().slice(0, 40));

    await ctx.close();
  }

  // --- no JavaScript: the form must still work ---
  {
    const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    await page.goto(`${O}/search/?q=virus`, { waitUntil: 'load' });
    record(name, 'search page reachable without JS', await page.locator('[data-search-page]').count() > 0);
    record(name, 'search input visible without JS', await page.locator('#search-page-input').isVisible());
    // A static build cannot read ?q=, so the no-JS path must still offer links.
    const browse = await page.locator('a[href^="/"]').count();
    record(name, 'no-JS fallback lists browsable services', browse > 20, `${browse} links`);
    record(name, 'no-JS fallback explains itself',
      /JavaScript/i.test((await page.locator('[data-search-status]').textContent()) ?? ''));
    await ctx.close();
  }

  await browser.close();
}

server.close();
const failed = results.filter((r) => !r.ok);
console.log('\n' + '='.repeat(70));
if (failed.length === 0) {
  console.log(`PASS: all ${results.length} search checks green across ${engines.length} engines.`);
} else {
  console.log(`${failed.length} failed of ${results.length}:`);
  failed.forEach((f) => console.log(`  [${f.engine}] ${f.check} - ${f.detail}`));
}
process.exit(failed.length === 0 ? 0 : 1);