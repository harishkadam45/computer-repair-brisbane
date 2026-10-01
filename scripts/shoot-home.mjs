/**
 * Screenshots the homepage at one viewport width, full page and per-section,
 * so layout differences can be compared by eye as well as by number.
 *
 * Usage: node scripts/shoot-home.mjs [width] [outdir]
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, stat, mkdir } from 'node:fs/promises';
import path from 'node:path';

const DIST = path.resolve('dist');
const PORT = 4392;
const O = `http://127.0.0.1:${PORT}`;
const width = Number(process.argv[2] ?? 1280);
const outDir = path.resolve(process.argv[3] ?? '.shots');

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

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width, height: 1000 },
  deviceScaleFactor: 1,
});
const page = await ctx.newPage();
await page.goto(`${O}/`, { waitUntil: 'load' });
// Settle fonts and any reveal-on-scroll state.
await page.evaluate(() => document.fonts?.ready);
await page.waitForTimeout(300);

const full = path.join(outDir, `home-${width}-full.png`);
await page.screenshot({ path: full, fullPage: true });
console.log(`wrote ${full}`);

const sections = await page.$$('main > section');
for (let i = 0; i < sections.length; i++) {
  const label = await sections[i]
    .$eval('h2', (el) => el.textContent.trim().slice(0, 26).replace(/[^\w]+/g, '-'))
    .catch(() => `section-${i}`);
  const file = path.join(outDir, `${width}-${String(i).padStart(2, '0')}-${label}.png`);
  await sections[i].screenshot({ path: file });
  console.log(`wrote ${file}`);
}

await ctx.close();
await browser.close();
server.close();