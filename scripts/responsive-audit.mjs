/**
 * Cross-browser responsive audit.
 *
 * Serves `dist/` and loads every route at five viewports in all three engines,
 * failing on horizontal overflow, console errors, or failed requests.
 * Overflow is reported with the widest offending elements so the cause is
 * visible in the output instead of just a boolean.
 *
 * Usage: node scripts/responsive-audit.mjs
 */
import { chromium, firefox, webkit } from 'playwright';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const DIST = path.resolve('dist');
const PORT = 4399;
const ORIGIN = `http://127.0.0.1:${PORT}`;

const ROUTES = [
  '/',
  '/services/',
  '/data-recovery/',
  '/computer-repair-bongaree/',
  '/service-area/',
  '/pricing/',
  '/contact/',
  '/quote/',
  '/blog/',
  '/about/',
  '/testimonials/',
  '/search/',
];

const VIEWPORTS = [
  { name: '320 small phone', width: 320, height: 640 },
  { name: '375 phone', width: 375, height: 812 },
  { name: '768 tablet', width: 768, height: 1024 },
  { name: '1024 small laptop', width: 1024, height: 768 },
  { name: '1440 desktop', width: 1440, height: 900 },
];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};

/** Serve dist/ with trailing-slash directory resolution, like the host will. */
function serve() {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, ORIGIN);
      let rel = decodeURIComponent(url.pathname);
      if (rel.endsWith('/')) rel += 'index.html';
      let file = path.join(DIST, rel);
      if (!file.startsWith(DIST)) {
        res.writeHead(403).end();
        return;
      }
      try {
        const s = await stat(file);
        if (s.isDirectory()) file = path.join(file, 'index.html');
      } catch {
        res.writeHead(404, { 'content-type': 'text/html' }).end('<h1>404</h1>');
        return;
      }
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(500).end();
    }
  });
  return new Promise((resolve) => server.listen(PORT, '127.0.0.1', () => resolve(server)));
}

/**
 * Runs in the page: can the user actually pan sideways?
 *
 * `scrollWidth > clientWidth` alone is not a bug - `overflow-x: clip` on the
 * root deliberately keeps that true while making the page unscrollable. So the
 * real test is whether the viewport moves when asked to scroll right.
 */
function findOverflow() {
  const de = document.documentElement;
  const vw = de.clientWidth;
  const before = window.scrollX;
  window.scrollTo(vw, 0);
  const panned = window.scrollX;
  window.scrollTo(before, 0);

  const offenders = [];
  if (panned > 1) {
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      const cs = getComputedStyle(el);
      if (cs.position === 'fixed' || cs.display === 'none') continue;
      // An element that opts into its own horizontal scrolling is intentional.
      let scrolls = false;
      for (let n = el; n && n !== document.body; n = n.parentElement) {
        const o = getComputedStyle(n).overflowX;
        if (o === 'auto' || o === 'scroll') { scrolls = true; break; }
        if (o === 'clip' || o === 'hidden') break;
      }
      if (scrolls) continue;
      if (r.right > vw + 1 || r.left < -1) {
        offenders.push({
          tag: el.tagName.toLowerCase(),
          cls: (el.className && String(el.className).slice(0, 70)) || '',
          right: Math.round(r.right),
          width: Math.round(r.width),
        });
      }
    }
  }
  return { vw, scrollW: de.scrollWidth, panned, overflowing: panned > 1, offenders: offenders.slice(0, 6) };
}

const engines = [
  { name: 'chromium', type: chromium },
  { name: 'firefox', type: firefox },
  { name: 'webkit', type: webkit },
];

const failures = [];
const server = await serve();
console.log(`Serving dist/ on ${ORIGIN}\n`);

for (const { name, type } of engines) {
  const browser = await type.launch();
  console.log(`=== ${name} ===`);
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.width < 768,
      hasTouch: vp.width < 768,
    });
    const page = await ctx.newPage();
    const consoleErrors = [];
    const badRequests = [];

    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 120));
    });
    page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${String(e).slice(0, 120)}`));
    page.on('response', (r) => {
      if (r.status() >= 400) badRequests.push(`${r.status()} ${new URL(r.url()).pathname}`);
    });

    for (const route of ROUTES) {
      consoleErrors.length = 0;
      badRequests.length = 0;
      try {
        const res = await page.goto(ORIGIN + route, { waitUntil: 'load', timeout: 30000 });
        if (!res || res.status() >= 400) {
          failures.push({ engine: name, vp: vp.name, route, issue: `HTTP ${res?.status() ?? 'no response'}` });
          console.log(`  FAIL ${route} (HTTP ${res?.status()})`);
          continue;
        }
        const o = await page.evaluate(findOverflow);
        const realErrors = consoleErrors.filter((e) => !/favicon/i.test(e));
        const realBad = badRequests.filter((u) => !/favicon|og\/default/.test(u));

        if (o.overflowing) {
          const detail = o.offenders.map((f) => `${f.tag}.${f.cls} w=${f.width} right=${f.right}`).join(' | ');
          failures.push({ engine: name, vp: vp.name, route, issue: `pans ${o.panned}px sideways: ${detail}` });
          console.log(`  FAIL ${route} pans ${o.panned}px sideways`);
          o.offenders.forEach((f) => console.log(`         ${f.tag}.${f.cls} w=${f.width} right=${f.right}`));
        } else if (realErrors.length || realBad.length) {
          const msg = [...realBad, ...realErrors].slice(0, 2).join(' | ');
          failures.push({ engine: name, vp: vp.name, route, issue: msg });
          console.log(`  FAIL ${route} ${msg}`);
        }
      } catch (err) {
        failures.push({ engine: name, vp: vp.name, route, issue: String(err).slice(0, 100) });
        console.log(`  ERR  ${route} ${String(err).slice(0, 100)}`);
      }
    }
    await ctx.close();
    const clean = !failures.some((f) => f.engine === name && f.vp === vp.name);
    console.log(`  ${vp.name.padEnd(18)} ${vp.width}x${vp.height}  ${clean ? 'clean' : 'issues above'}`);
  }
  await browser.close();
  console.log('');
}

server.close();

console.log('='.repeat(70));
if (failures.length === 0) {
  console.log(`PASS: ${ROUTES.length} routes x ${VIEWPORTS.length} viewports x ${engines.length} engines, no overflow or errors.`);
} else {
  console.log(`${failures.length} failure(s):\n`);
  for (const f of failures) console.log(`  [${f.engine} / ${f.vp}] ${f.route}\n     ${f.issue}`);
}
process.exit(failures.length === 0 ? 0 : 1);