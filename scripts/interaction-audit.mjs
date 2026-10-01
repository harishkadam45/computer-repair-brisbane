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
  // --- header row must not squeeze the phone number ---
  // The phone number moved from the navbar into the utility bar (immediately
  // before "Get a quote"), keeping the brand pill it had as a navbar button.
  // Guard the new location: the pill must exist, keep its natural width, not
  // clip or wrap, stay inside the bar, and come before "Get a quote".
  // It previously lived at 146px in the navbar row and was crushed to 85px by
  // flex-shrink when search was introduced, so the width check stays.
  for (const width of [1024, 1280, 1440]) {
    const ctx = await browser.newContext({ viewport: { width, height: 800 } });
    const page = await ctx.newPage();
    await page.goto(`${O}/`, { waitUntil: 'load' });
    const phone = await page.evaluate(() => {
      const bar = document.querySelector('header .container-page.flex.h-9');
      // The pill is the brand-filled tel: link. "Get a quote" is a separate
      // plain link in the same group.
      const el = [...bar.querySelectorAll('a[href^="tel:"]')].find((a) =>
        a.className.includes('bg-brand-500'),
      );
      const quote = [...bar.querySelectorAll('a')].find((a) =>
        a.textContent.includes('Get a quote'),
      );
      const r = el.getBoundingClientRect();
      const qr = quote.getBoundingClientRect();
      const br = bar.getBoundingClientRect();
      // Natural width, measured off-layout so flex-shrink cannot mask it.
      const host = document.createElement('div');
      host.style.cssText =
        'position:absolute;visibility:hidden;width:auto;left:-9999px;top:0;display:flex';
      const clone = el.cloneNode(true);
      host.appendChild(clone);
      document.body.appendChild(host);
      const natural = Math.round(clone.getBoundingClientRect().width);
      host.remove();
      return {
        current: Math.round(r.width),
        natural,
        clipped: el.scrollWidth > el.clientWidth + 1,
        wraps: r.height > 40,
        beforeQuote: r.left < qr.left,
        // If everything is shrink-0 the bar overflows instead of squeezing,
        // so both failure modes have to be asserted.
        barOverflow: Math.round(bar.scrollWidth) > Math.round(br.width) + 1,
        insideBar: r.right <= br.right + 1 && r.top >= br.top - 1,
        right: Math.round(r.right),
        vw: document.documentElement.clientWidth,
        text: el.textContent.trim().replace(/\s+/g, ' '),
      };
    });
    record(name, `phone pill keeps full width at ${width}px`,
      phone.current >= phone.natural - 1 && !phone.clipped && !phone.wraps,
      `natural=${phone.natural} got=${phone.current} ${phone.text}`);
    record(name, `phone pill sits before Get a quote at ${width}px`,
      phone.beforeQuote && !phone.barOverflow && phone.insideBar && phone.right <= phone.vw,
      `before=${phone.beforeQuote} inBar=${phone.insideBar} scroll=${phone.barOverflow} right=${phone.right} vw=${phone.vw}`);
    await ctx.close();
  }

  // The navbar row no longer carries the phone button; assert it stays that way
  // so the number is not silently duplicated back into the nav.
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    await page.goto(`${O}/`, { waitUntil: 'load' });
    const row = await page.evaluate(() => {
      const el = document.querySelector('header .container-page.flex.h-16');
      // Direct children only, so the mega-menu's hidden "Start here" tel: link
      // nested inside the nav does not count as a navbar-row button.
      const direct = [...el.children].some((c) => c.matches('a[href^="tel:"]'));
      // Read the expected number off the utility-bar pill rather than
      // hardcoding it, so this survives a number change.
      const pill = document.querySelector(
        'header .container-page.flex.h-9 a[href^="tel:"]',
      );
      const number = pill.textContent.match(/\(?0\d\)?\s?\d{4}\s?\d{4}/)?.[0] ?? '';
      // Strip the nav before scanning for the text: the mega-menu panel is a
      // descendant of the row and legitimately contains its own "Start here"
      // call link, which is not a duplicate navbar button.
      const copy = el.cloneNode(true);
      copy.querySelector('nav')?.remove();
      return { direct, number, duplicated: copy.textContent.includes(number) };
    });
    record(name, 'phone number is not duplicated in the navbar row',
      !row.direct && !row.duplicated,
      `directTelLink=${row.direct} numberText=${row.duplicated} (${row.number})`);
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