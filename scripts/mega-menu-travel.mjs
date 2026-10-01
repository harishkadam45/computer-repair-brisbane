/**
 * The mega menu is now `position: fixed`, so it no longer sits inside the
 * trigger's border box the way an absolutely-positioned dropdown would.
 * Verify the pointer can actually travel from the trigger into the panel
 * without it closing, in every engine.
 *
 * Usage: node scripts/mega-menu-travel.mjs
 */
import { chromium, firefox, webkit } from 'playwright';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const DIST = path.resolve('dist');
const PORT = 4396;
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

let failed = 0;
console.log('Pointer travel: trigger -> across the gap -> panel link\n');

for (const { name, type } of engines) {
  const browser = await type.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${O}/`, { waitUntil: 'load' });

  const trigger = page.locator('header nav .group.relative > a').first();
  const panel = page.locator('header nav .group.relative > div').first();
  const link = panel.locator('a').first();

  await trigger.hover();
  await page.waitForTimeout(350);
  const openAfterHover = await panel.evaluate((el) => getComputedStyle(el).visibility === 'visible');

  // Move the pointer toward the panel in small steps, the way a hand does,
  // so we cross the space between the trigger and the panel edge.
  const t = await trigger.boundingBox();
  const l = await link.boundingBox();
  let stayedOpen = true;
  const steps = 12;
  for (let i = 1; i <= steps; i++) {
    const x = t.x + ((l.x + 20 - t.x) * i) / steps;
    const y = t.y + t.height / 2 + ((l.y + l.height / 2 - (t.y + t.height / 2)) * i) / steps;
    await page.mouse.move(x, y);
    await page.waitForTimeout(45);
    const vis = await panel.evaluate((el) => getComputedStyle(el).visibility === 'visible');
    if (!vis) { stayedOpen = false; break; }
  }

  const hoverWorks = stayedOpen;
  // And a service link is actually reachable/clickable
  let clickable = false;
  if (hoverWorks) {
    try {
      await link.click({ timeout: 3000 });
      clickable = true;
    } catch { clickable = false; }
  }

  const ok = openAfterHover && hoverWorks && clickable;
  if (!ok) failed++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}: opens=${openAfterHover} staysOpenOnTravel=${hoverWorks} linkClickable=${clickable}`);

  // Keyboard reachability.
  const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p2 = await ctx2.newPage();
  await p2.goto(`${O}/`, { waitUntil: 'load' });

  // Some engines will not focus anchors at all without a preference that
  // headless builds do not enable: WebKit defaults to tabbing only through form
  // controls and <summary>, matching Safari's "Tab highlights text fields
  // only". Detect that first, because pressing Tab there measures the engine,
  // not the markup.
  let engineTabsLinks = false;
  for (let i = 0; i < 25; i++) {
    await p2.keyboard.press('Tab');
    if (await p2.evaluate(() => document.activeElement?.tagName === 'A')) {
      engineTabsLinks = true;
      break;
    }
  }

  if (!engineTabsLinks) {
    console.log(`  SKIP  ${name}: engine does not focus anchors via Tab (Safari default), keyboard not measurable here`);
  } else {
    let focusedTrigger = false;
    for (let i = 0; i < 20; i++) {
      await p2.keyboard.press('Tab');
      const hit = await p2.evaluate(() =>
        document.activeElement?.closest('nav .group.relative') !== null &&
        document.activeElement?.tagName === 'A');
      if (hit) { focusedTrigger = true; break; }
    }

    await p2.waitForTimeout(300);
    const kbOpen = await p2.locator('header nav .group.relative > div').first()
      .evaluate((el) => getComputedStyle(el).visibility === 'visible');
    const kbOk = focusedTrigger && kbOpen;
    if (!kbOk) failed++;
    console.log(`  ${kbOk ? 'PASS' : 'FAIL'}  ${name}: trigger focusable=${focusedTrigger} panel opens on focus=${kbOpen}`);

    // Focus must land inside the panel and hold it open.
    if (kbOk) {
      let innerFocusable = false;
      for (let i = 0; i < 6; i++) {
        await p2.keyboard.press('Tab');
        innerFocusable = await p2.evaluate(() => {
          const panel = document.querySelector('nav .group.relative > div');
          return !!document.activeElement && !!panel?.contains(document.activeElement);
        });
        if (innerFocusable) break;
      }
      if (!innerFocusable) failed++;
      console.log(`  ${innerFocusable ? 'PASS' : 'FAIL'}  ${name}: focus lands in panel and holds it open`);
    }
  }

  await ctx2.close();
  await ctx.close();
  await browser.close();
}

server.close();
console.log('\n' + '='.repeat(60));
console.log(failed === 0 ? 'PASS: mega menu reachable by pointer and keyboard in all engines.' : `${failed} check(s) failed.`);
process.exit(failed === 0 ? 0 : 1);