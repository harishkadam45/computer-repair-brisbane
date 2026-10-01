/**
 * Motion audit.
 *
 * Animations are the easiest thing on this site to ship and the easiest to
 * break silently, because a failed reveal does not throw - it just leaves a
 * blank section. So the checks here are about safety, not taste:
 *
 *  1. Content is never left invisible. With JS on, with JS off, and with
 *     IntersectionObserver forced to fail.
 *  2. Reduced-motion users get no animation and no hidden content.
 *  3. Nothing animates a layout property, so CLS stays at zero.
 *  4. Revealed elements do not shift the page when they appear.
 *
 * Run against dist, like the other audits.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { chromium, firefox, webkit } from 'playwright';

const DIST = path.resolve('dist');
const PORT = 4398;
const O = `http://127.0.0.1:${PORT}`;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
};

const server = createServer(async (req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  let file = path.join(DIST, url);
  if (existsSync(file) && statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!existsSync(file)) {
    const notFound = path.join(DIST, '404.html');
    if (existsSync(notFound)) {
      const body = await readFile(notFound);
      res.writeHead(404, { 'content-type': MIME['.html'] });
      return res.end(body);
    }
    res.writeHead(404);
    return res.end('not found');
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
  res.end(await readFile(file));
});

await new Promise((r) => server.listen(PORT, r));

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

/**
 * Counts elements that are laid out but painted at nothing.
 *
 * `label` is included so a failure says which block went dark. Only elements the
 * visitor has actually had a chance to see are counted: anything still below the
 * fold is legitimately waiting for its turn, so checking those would just assert
 * that the observer does not work.
 */
const hiddenCount = async () =>
  page.evaluate(() => {
    const out = [];
    const vh = document.documentElement.clientHeight;
    for (const el of document.querySelectorAll('[data-reveal], [data-enter]')) {
      const r = el.getBoundingClientRect();
      // Bottom edge above the fold means it has been on screen.
      if (r.top > vh) continue;
      if (Number(getComputedStyle(el).opacity) < 0.05) {
        out.push((el.tagName + '.' + String(el.className || '')).slice(0, 50));
      }
    }
    return out;
  });

let page;

/*
 * Long enough for the slowest reveal to finish: the stagger caps at 5 steps of
 * 60ms, so the last item in a group starts at 300ms and its 500ms animation
 * ends at 800ms. Probing before then measures mid-flight opacity and reports a
 * perfectly healthy element as hidden.
 */
const settleMs = 1200;

for (const { name, type } of engines) {
  const browser = await type.launch();
  console.log(`\n=== ${name} ===`);

  // --- reveals actually fire ---
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    page = await ctx.newPage();
    await page.goto(`${O}/`, { waitUntil: 'load' });

    const ready = await page.evaluate(() =>
      document.documentElement.classList.contains('motion-ready'));
    record(name, 'motion-ready is set on <html>', ready);

    const total = await page.locator('[data-reveal], [data-enter]').count();
    record(name, 'home page has motion targets', total > 0, `${total} elements`);

    // Walk the page so every reveal target gets its turn in the viewport.
    await page.evaluate(async () => {
      const step = window.innerHeight * 0.6;
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 90));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(settleMs);

    const hidden = await hiddenCount();
    record(name, 'nothing stays invisible after scrolling', hidden.length === 0, hidden.join(' | ') || '0 hidden');

    const animating = await page.locator('[data-reveal].is-in').count();
    record(name, 'revealed elements are marked is-in', animating > 0, `${animating} marked`);

    await ctx.close();
  }

  // --- no layout properties animated ---
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    page = await ctx.newPage();
    await page.goto(`${O}/`, { waitUntil: 'load' });

    const layoutAnimated = await page.evaluate(() => {
      const bad = [];
      for (const sheet of document.styleSheets) {
        let rules;
        try {
          rules = sheet.cssRules;
        } catch {
          continue; // cross-origin
        }
        for (const rule of rules) {
          const text = rule.cssText || '';
          if (!/@keyframes|animation/.test(text)) continue;
          // Walk the keyframes for anything that would trigger reflow.
          if (rule.type === CSSRule.KEYFRAMES_RULE) {
            for (const kf of rule.cssRules) {
              for (const prop of kf.style) {
                if (/^(width|height|top|left|right|bottom|margin|padding|font-size|inset)/.test(prop)) {
                  bad.push(`${rule.name}:${prop}`);
                }
              }
            }
          }
        }
      }
      return [...new Set(bad)];
    });
    record(name, 'keyframes animate only transform/opacity',
      layoutAnimated.length === 0, layoutAnimated.join(','));

    await ctx.close();
  }

  // --- reduced motion ---
  {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce',
    });
    page = await ctx.newPage();
    await page.goto(`${O}/`, { waitUntil: 'load' });

    const ready = await page.evaluate(() =>
      document.documentElement.classList.contains('motion-ready'));
    record(name, 'reduced motion does not set motion-ready', !ready);

    const hidden = await hiddenCount();
    record(name, 'reduced motion leaves all content visible', hidden.length === 0, hidden.join(' | ') || '0 hidden');

    const durations = await page.evaluate(() => {
      const el = document.querySelector('[data-reveal]') || document.querySelector('[data-enter]');
      if (!el) return null;
      const cs = getComputedStyle(el);
      return { anim: cs.animationDuration, trans: cs.transitionDuration };
    });
    // Compare as seconds rather than as text: Chromium serialises 0.01ms as
    // "1e-05s" while Firefox and WebKit write "0.00001s", and both mean the
    // same clamp. 50ms is the threshold - anything slower is a real animation.
    const secs = (v) => {
      const s = String(v).split(',')[0].trim();
      return s.endsWith('ms') ? parseFloat(s) / 1000 : parseFloat(s);
    };
    record(name, 'reduced motion clamps animation durations',
      durations !== null && secs(durations.anim) < 0.05,
      durations ? `anim=${durations.anim}` : 'no target found');

    await ctx.close();
  }

  // --- no-JS: content must be fully visible ---
  {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 }, javaScriptEnabled: false,
    });
    page = await ctx.newPage();
    await page.goto(`${O}/`, { waitUntil: 'load' });

    const hidden = await hiddenCount();
    record(name, 'no-JS leaves all content visible', hidden.length === 0, hidden.join(' | ') || '0 hidden');

    await ctx.close();
  }

  // --- observer failure: the safety net must catch it ---
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    page = await ctx.newPage();
    // An observer that constructs fine and then never delivers a callback,
    // which is what a hostile extension or a quirk mode looks like.
    await page.addInitScript(() => {
      window.__ioCount = 0;
      const Real = window.IntersectionObserver;
      window.IntersectionObserver = class extends Real {
        constructor(cb, opts) {
          window.__ioCount++;
          super(() => {}, opts);
        }
      };
    });
    await page.goto(`${O}/`, { waitUntil: 'load' });
    await page.waitForTimeout(4600); // past the 4s safety net

    const used = await page.evaluate(() => window.__ioCount);
    const hidden = await hiddenCount();
    record(name, 'safety net reveals content when the observer never fires',
      hidden.length === 0, `observers=${used} hidden=${hidden.join(' | ') || 0}`);

    await ctx.close();
  }

  // --- the audit must fail when the reveal breaks ---
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    page = await ctx.newPage();
    // Blank out the reveal so motion-ready hides content that nothing ever
    // reveals. This is the exact failure that ships silently, so the audit has
    // to be able to see it - otherwise "everything is visible" proves nothing.
    //
    // The patch is installed on Document.prototype, so the probe below has to
    // use the captured original or it blinds itself and reports 0 hidden.
    await page.addInitScript(() => {
      window.__realQSA = Document.prototype.querySelectorAll;
      const real = window.__realQSA;
      Document.prototype.querySelectorAll = function (sel) {
        if (typeof sel === 'string' && sel.includes('data-reveal')) return [];
        return real.call(this, sel);
      };
    });
    await page.goto(`${O}/`, { waitUntil: 'load' });
    await page.evaluate(async () => {
      const step = window.innerHeight * 0.6;
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 70));
      }
    });
    await page.waitForTimeout(settleMs);

    const stranded = await page.evaluate(() => {
      const vh = document.documentElement.clientHeight;
      let n = 0;
      const list = window.__realQSA.call(document, '[data-reveal], [data-enter]');
      for (const el of list) {
        if (el.getBoundingClientRect().top > vh) continue;
        if (Number(getComputedStyle(el).opacity) < 0.05) n++;
      }
      return n;
    });
    record(name, 'audit detects a reveal that never runs (negative control)',
      stranded > 0, `${stranded} elements stranded`);

    await ctx.close();
  }

  // --- across page types, not just the home page ---
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    page = await ctx.newPage();

    // The home page is the easiest case: its motion targets are high up. These
    // are the templates where a bad reveal would strand a real block of content
    // - service grid, FAQ accordion, family hub with its suburb sidebar.
    const routes = [
      '/laptop-repairs/',
      '/laptop-repairs-tallai/',
      '/virus-malware-and-spyware-removal-brisbane/',
      '/what-is-seo-search-engine-optimisation/',
      '/pricing/',
    ];
    const stranded = [];
    const counts = [];
    for (const route of routes) {
      await page.goto(`${O}${route}`, { waitUntil: 'load' });
      const n = await page.locator('[data-reveal], [data-enter]').count();
      counts.push(`${route}=${n}`);
      await page.evaluate(async () => {
        const step = window.innerHeight * 0.6;
        for (let y = 0; y < document.body.scrollHeight; y += step) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 70));
        }
      });
      await page.waitForTimeout(settleMs);
      const hidden = await hiddenCount();
      if (hidden.length > 0) stranded.push(`${route}: ${hidden.join(', ')}`);
    }
    record(name, 'every sampled route reveals all its content', stranded.length === 0,
      stranded.length ? stranded.join(' ') : counts.join(' '));

    await ctx.close();
  }

  // --- CLS: revealing must not move anything ---
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    page = await ctx.newPage();
    await page.goto(`${O}/`, { waitUntil: 'load' });

    const cls = await page.evaluate(async (settle) => {
      let total = 0;
      const po = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) if (!e.hadRecentInput) total += e.value;
      });
      po.observe({ type: 'layout-shift', buffered: true });
      const step = window.innerHeight * 0.6;
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 120));
      }
      await new Promise((r) => setTimeout(r, settle));
      po.disconnect();
      return total;
    }, settleMs);
    // 0.1 is the "good" threshold. Reveals are transform/opacity only, so this
    // should stay at 0; a small allowance covers sub-pixel rounding.
    record(name, 'scrolling the whole page causes no layout shift', cls < 0.02, `CLS=${cls.toFixed(4)}`);

    await ctx.close();
  }

  await browser.close();
}

server.close();
const failed = results.filter((r) => !r.ok);
console.log('\n' + '='.repeat(70));
if (failed.length === 0) {
  console.log(`PASS: all ${results.length} motion checks green across ${engines.length} engines.`);
} else {
  console.log(`${failed.length} failed of ${results.length}:`);
  failed.forEach((f) => console.log(`  [${f.engine}] ${f.check} - ${f.detail}`));
}
process.exit(failed.length === 0 ? 0 : 1);