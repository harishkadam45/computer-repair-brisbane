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

  // --- quote modal ---
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${O}/`, { waitUntil: 'load' });

    const dialog = page.locator('#quote-modal');
    const modalTriggers = await page.locator('a[data-quote-open]').count();
    record(name, 'quote CTAs are wired to the modal', modalTriggers > 0, `${modalTriggers} triggers`);

    // Triggers must stay real links, so no-JS visitors still get a working form.
    const realHrefs = await page.evaluate(() =>
      [...document.querySelectorAll('a[data-quote-open]')].every((a) => a.href.length > 0));
    record(name, 'quote triggers keep a real href (no-JS fallback)', realHrefs);

    record(name, 'modal starts closed', !(await dialog.evaluate((el) => el.open)));

    const utility = page.locator('header a[data-quote-open]').first();
    await utility.click();
    await page.waitForTimeout(250);
    record(name, 'clicking Get a quote opens the modal as a popup',
      await dialog.evaluate((el) => el.open));
    // showModal() puts the dialog in the top layer, which is what makes the
    // rest of the page unreachable rather than merely covered.
    record(name, 'modal is in the top layer, not just overlaid',
      await dialog.evaluate((el) => el.matches(':modal')));

    // Only one modal per page, or triggers would stack duplicates.
    const modalCount = await page.locator('#quote-modal').count();
    record(name, 'exactly one modal mounted per page', modalCount === 1, `${modalCount} found`);

    // The dialog itself is the scroll container, so measure the dialog rather
    // than the panel: a tall form is allowed to exceed the viewport as long as
    // the overflow is reachable.
    const state = await dialog.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return {
        left: Math.round(r.left),
        right: Math.round(r.right),
        top: Math.round(r.top),
        vw: document.documentElement.clientWidth,
        vh: document.documentElement.clientHeight,
        height: Math.round(r.height),
        scrollable: el.scrollHeight > el.clientHeight,
      };
    });
    record(name, 'modal fits the viewport width and is fully reachable',
      state.left >= 0 && state.right <= state.vw && state.height <= state.vh + 1,
      `l=${state.left} r=${state.right} h=${state.height} vh=${state.vh}`);

    // Every field must be reachable by scrolling, including the submit button.
    const reachable = await dialog.evaluate((el) => {
      const btn = el.querySelector('[data-quote-form] button[type="submit"]');
      el.scrollTop = el.scrollHeight;
      const r = btn.getBoundingClientRect();
      const d = el.getBoundingClientRect();
      return r.bottom <= d.bottom + 1 && r.top >= d.top - 1;
    });
    record(name, 'submit button is reachable by scrolling', reachable);

    // Focus must land inside, not stay on the trigger behind the top layer.
    const focusedInside = await page.evaluate(() =>
      document.querySelector('#quote-modal').contains(document.activeElement));
    record(name, 'focus moves into the modal on open', focusedInside);

    const labelled = await dialog.evaluate((el) => {
      const id = el.getAttribute('aria-labelledby');
      return !!(id && document.getElementById(id));
    });
    record(name, 'modal is labelled for screen readers', labelled);

    // Escape closes, and focus goes back where it came from.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
    record(name, 'Escape closes the modal', !(await dialog.evaluate((el) => el.open)));
    const returned = await page.evaluate(() =>
      document.activeElement?.hasAttribute('data-quote-open') ?? false);
    record(name, 'focus returns to the trigger after close', returned);

    // Phone validation: a bad number must block submission and say why.
    await utility.click();
    await page.waitForTimeout(250);
    await page.fill('#q-phone', '12345');
    await page.click('[data-quote-form] button[type="submit"]');
    await page.waitForTimeout(200);
    const err = await page.locator('[data-error-for="phone"]');
    record(name, 'invalid phone is rejected with a visible message',
      (await err.isVisible()) && (await err.textContent()).trim().length > 5,
      (await err.textContent())?.trim());
    record(name, 'modal stays open after a validation failure',
      await dialog.evaluate((el) => el.open));

    // Suburb must be asked for: the hosted form switched it off, and suburb is
    // how this site routes work.
    record(name, 'modal asks for suburb', await page.locator('#q-suburb').isVisible());

    // --- suburb combobox ---
    // The modal is still open from the validation check above, so use it
    // rather than re-opening: the dialog is in the top layer and intercepts
    // clicks aimed at the header trigger underneath it.
    record(name, 'modal already open before the suburb checks',
      await dialog.evaluate((el) => el.open));

    const list = page.locator('#q-suburb-list');
    record(name, 'suburb list starts closed', !(await list.isVisible()));

    await page.fill('#q-suburb', 'brend');
    await page.waitForTimeout(500);
    record(name, 'suburb list opens on typing', await list.isVisible());

    const first = (await page.locator('#q-suburb-list [role="option"]').first().textContent()) ?? '';
    record(name, 'prefix match ranks Brendale first for "brend"',
      first.includes('Brendale'), first.trim().replace(/\s+/g, ' '));

    const count = await page.locator('#q-suburb-list [role="option"]').count();
    record(name, 'suburb list is capped and non-empty', count > 0 && count <= 8, `${count} options`);

    const expanded = await page.locator('#q-suburb').getAttribute('aria-expanded');
    record(name, 'suburb input reports aria-expanded=true', expanded === 'true', `aria-expanded=${expanded}`);

    const combobox = await page.locator('#q-suburb').getAttribute('role');
    record(name, 'suburb field is a combobox', combobox === 'combobox');

    // Keyboard: arrow down then Enter must pick the highlighted row.
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(150);
    const active = await page.locator('#q-suburb').getAttribute('aria-activedescendant');
    record(name, 'arrow key sets aria-activedescendant', !!active, `activedescendant=${active}`);

    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    const chosen = await page.inputValue('#q-suburb');
    record(name, 'Enter selects the highlighted suburb', chosen === 'Brendale', `value="${chosen}"`);
    record(name, 'suburb list closes after selection', !(await list.isVisible()));

    // Escape closes the dropdown without closing the modal - a jarring way to
    // lose a whole form.
    await page.fill('#q-suburb', 'toow');
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    record(name, 'Escape closes the suburb list', !(await list.isVisible()));
    record(name, 'Escape keeps the modal open', await dialog.evaluate((el) => el.open));

    // Postcode search, which is how people look up their own suburb.
    await page.fill('#q-suburb', '4066');
    await page.waitForTimeout(500);
    const byPostcode = (await page.locator('#q-suburb-list [role="option"]').first().textContent()) ?? '';
    record(name, 'postcode search returns suburbs', byPostcode.includes('4066'), byPostcode.trim().replace(/\s+/g, ' '));

    // An unknown string must not be treated as a match, and must not block.
    await page.fill('#q-suburb', 'zzzz');
    await page.waitForTimeout(500);
    const noneCount = await page.locator('#q-suburb-list [role="option"]').count();
    record(name, 'unmatched suburb shows no options', noneCount === 0, `${noneCount} options`);
    record(name, 'unmatched suburb still allows typing', (await page.inputValue('#q-suburb')) === 'zzzz');

    await page.fill('#q-suburb', '');
    await page.waitForTimeout(200);
    record(name, 'clearing the field closes the list', !(await list.isVisible()));

    // The close button must survive scrolling. It was absolute before, which
    // meant it scrolled out of reach on a long form.
    await dialog.evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await page.waitForTimeout(200);
    const closeBox = await page.locator('#quote-modal [data-quote-close]').first().boundingBox();
    record(name, 'close button stays visible after scrolling the dialog',
      !!closeBox && closeBox.y >= 0 && closeBox.y < 900,
      closeBox ? `y=${Math.round(closeBox.y)}` : 'no box');

    const closeLoc = page.locator('#quote-modal [data-quote-close]').first();

    // Click by coordinates rather than by locator. Playwright's actionability
    // check runs scrollIntoViewIfNeeded, which fights a position:sticky
    // element and reports the button as "not visible" even though it is
    // rendered, hit-testable and 40x40 on screen. A real click at the pixel a
    // finger would use is both the stronger assertion and the one that does
    // not depend on that check.
    const hit = await page.evaluate(() => {
      const b = document.querySelector('#quote-modal [data-quote-close]');
      const r = b.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, onButton: !!(top && top.closest('[data-quote-close]')) };
    });
    record(name, 'close button is hit-testable where it is painted',
      hit.onButton, `x=${Math.round(hit.x)} y=${Math.round(hit.y)}`);

    await page.mouse.click(hit.x, hit.y);
    await page.waitForTimeout(250);
    record(name, 'clicking the scrolled close button closes the modal',
      !(await dialog.evaluate((el) => el.open)));
    await page.waitForTimeout(200);

    // Reopen: the scrolled-close check above already closed it.
    await utility.click();
    await page.waitForTimeout(250);

    // Close button and backdrop both dismiss.
    await page.click('#quote-modal [data-quote-close]');
    await page.waitForTimeout(250);
    record(name, 'close button dismisses the modal', !(await dialog.evaluate((el) => el.open)));

    await utility.click();
    await page.waitForTimeout(250);
    await page.mouse.click(4, 4);
    await page.waitForTimeout(250);
    record(name, 'backdrop click dismisses the modal', !(await dialog.evaluate((el) => el.open)));

    // Every page must carry the modal, since the header CTA is global.
    let missing = [];
    // Covers the home page, a service page, contact, the quote page, a family hub,
    // a suburb page and a blog post, so every layout that wraps BaseLayout is hit.
    const routes = [
      '/', '/pricing/', '/contact/', '/quote/', '/laptop-repairs/',
      '/virus-malware-and-spyware-removal-brisbane/',
      '/laptop-repairs-tallai/',
      '/what-is-seo-search-engine-optimisation/',
    ];
    for (const route of routes) {
      await page.goto(`${O}${route}`, { waitUntil: 'load' });
      if (!(await page.locator('#quote-modal').count())) missing.push(route);
    }
    record(name, 'modal present on every sampled route', missing.length === 0, missing.join(' '));

    await ctx.close();
  }

  // --- quote modal on mobile ---
  {
    const ctx = await browser.newContext({
      viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true,
    });
    const page = await ctx.newPage();
    await page.goto(`${O}/`, { waitUntil: 'load' });
    await page.click('[aria-controls="mobile-nav"]');
    await page.waitForTimeout(350);
    await page.locator('#mobile-nav a[data-quote-open]').first().click();
    await page.waitForTimeout(300);
    const dialog = page.locator('#quote-modal');
    const state = await dialog.evaluate((el) => {
      const r = el.querySelector('div').getBoundingClientRect();
      return {
        open: el.open, left: Math.round(r.left), right: Math.round(r.right),
        vw: document.documentElement.clientWidth, scrollable: el.scrollHeight > el.clientHeight,
      };
    });
    record(name, 'mobile nav quote CTA opens the modal', state.open);
    record(name, 'modal fits the mobile viewport and scrolls',
      state.left >= 0 && state.right <= state.vw && state.scrollable,
      `l=${state.left} r=${state.right} vw=${state.vw} scrollable=${state.scrollable}`);
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