/**
 * Confirms the hero band is real, not just a class in the markup:
 *  - it is the first <section> in <main>
 *  - it spans the full viewport width (not trapped inside container-page)
 *  - the page's single <h1> sits inside it
 *  - it actually paints a non-white background
 * Run against a sample that includes every layout family plus the routes
 * changed for this task.
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const DIST = path.resolve('dist');
const PORT = 4401;
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

const ROUTES = [
  ['/', 'homepage custom hero'],
  ['/about/', 'CHANGED: about'],
  ['/contact/', 'CHANGED: contact'],
  ['/404.html', 'CHANGED: 404'],
  ['/blog/', 'blog listing (PageHero)'],
  ['/why-task-manager-ram-usage-is-misleading/', 'CHANGED: blog post'],
  ['/replace-or-repair-computer/', 'CHANGED: blog post'],
  ['/pricing/', 'pricing (PageHero)'],
  ['/quote/', 'quote (PageHero)'],
  ['/testimonials/', 'testimonials (PageHero)'],
  ['/services/', 'services (PageHero)'],
  ['/service-area/', 'service-area (PageHero)'],
  ['/service-area/brisbane-north/', 'region (PageHero)'],
  ['/computer-repairs/', 'family hub'],
  ['/laptop-repairs/', 'family hub'],
  ['/laptop-repairs-brendale/', 'suburb page'],
  ['/search/?q=repair', 'search'],
];

const browser = await chromium.launch();
let bad = 0;

// Mobile pass on the routes restructured for this task. A hero that is
// full-bleed on desktop can still overflow on a narrow viewport, and the
// 404 page is not reachable by the responsive audit at all.
const CHANGED = [
  '/about/',
  '/contact/',
  '/404.html',
  '/why-task-manager-ram-usage-is-misleading/',
  '/replace-or-repair-computer/',
];
for (const route of CHANGED) {
  const page = await browser.newPage({ viewport: { width: 375, height: 780 } });
  await page.goto(`${O}${route}`, { waitUntil: 'load' });
  await page.waitForTimeout(150);
  const r = await page.evaluate(() => {
    const mesh = document.querySelector('.bg-brand-mesh');
    if (!mesh) return { ok: false, problems: ['no hero'], over: 0 };
    const vw = document.documentElement.clientWidth;
    const w = mesh.getBoundingClientRect().width;
    return {
      ok: Math.abs(w - vw) <= 1.5 && document.documentElement.scrollWidth <= vw + 1,
      problems: [
        Math.abs(w - vw) > 1.5 ? `hero ${Math.round(w)}px vs viewport ${vw}px` : '',
        document.documentElement.scrollWidth > vw + 1 ? `page scrollWidth ${document.documentElement.scrollWidth} > ${vw}` : '',
      ].filter(Boolean),
      w: Math.round(w),
    };
  });
  if (!r.ok) bad++;
  console.log(`  ${r.ok ? 'OK  ' : 'FAIL'}  375px  ${route.padEnd(46)} hero w=${r.w}`);
  if (!r.ok) r.problems.forEach((p) => console.log(`          - ${p}`));
  await page.close();
}
console.log('');

for (const [route, label] of ROUTES) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`${O}${route}`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts?.ready);
  await page.waitForTimeout(200);

  const r = await page.evaluate(() => {
    const mesh = document.querySelector('.bg-brand-mesh');
    if (!mesh) return { ok: false, problems: ['no .bg-brand-mesh element'], w: 0, h: 0, h1: '' };
    const rect = mesh.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    // First <section> at any depth inside <main>. Not restricted to direct
// children: on blog posts the hero intentionally sits inside <article> so the
// h1 stays part of the article element.
const firstSection = document.querySelector('main section');
    const h1s = [...document.querySelectorAll('h1')];
    const h1 = h1s[0];
    const bg = getComputedStyle(mesh).backgroundImage;
    const problems = [];
    if (!firstSection || firstSection !== mesh) problems.push('not the first <section> inside <main>');
    if (Math.abs(rect.width - vw) > 1.5) problems.push(`not full-bleed: ${Math.round(rect.width)}px vs viewport ${vw}px`);
    if (rect.height < 100) problems.push(`suspiciously short: ${Math.round(rect.height)}px`);
    if (bg === 'none' || bg === '') problems.push('no background-image painting');
    if (h1s.length !== 1) problems.push(`expected exactly one h1, found ${h1s.length}`);
    else if (!mesh.contains(h1)) problems.push('h1 is not inside the hero');
    return { ok: problems.length === 0, problems, w: Math.round(rect.width), h: Math.round(rect.height), h1: h1?.textContent?.trim().slice(0, 34), bg: bg.slice(0, 44) };
  });

  if (!r.ok) bad++;
  console.log(`  ${r.ok ? 'OK  ' : 'FAIL'}  ${route.padEnd(28)} ${label.padEnd(24)} w=${r.w} h=${r.h}  h1="${r.h1 ?? ''}"`);
  if (!r.ok) r.problems.forEach((p) => console.log(`          - ${p}`));
  await page.close();
}

console.log(bad === 0 ? `\nPASS: hero band present, first, full-bleed and wrapping the h1 on all ${ROUTES.length} sampled routes.` : `\n${bad} route(s) failed.`);
await browser.close();
server.close();