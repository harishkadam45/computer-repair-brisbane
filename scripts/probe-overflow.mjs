import { chromium } from 'playwright';
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
const b = await chromium.launch();

async function probe(route, w) {
  const ctx = await b.newContext({ viewport: { width: w, height: 800 } });
  const p = await ctx.newPage();
  await p.goto(O + route, { waitUntil: 'load' });
  const out = await p.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const res = [];
    // Elements whose own *content* exceeds their box force their parent's
    // min-content width, which is what widens the page. Widest first.
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el);
      if (cs.position === 'fixed' || cs.display === 'none') continue;
      if (el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1) {
        res.push({
          tag: el.tagName.toLowerCase(), cls: String(el.className || '').slice(0, 70),
          scrollW: el.scrollWidth, clientW: el.clientWidth, kids: el.children.length,
          text: (el.textContent || '').trim().slice(0, 45),
        });
      }
    }
    res.sort((a, b) => b.scrollW - a.scrollW);
    return { vw, scrollW: document.documentElement.scrollWidth, items: res.slice(0, 10) };
  });
  await ctx.close();
  console.log(`\n### ${route} @ ${w}  (vw=${out.vw} scrollW=${out.scrollW})`);
  if (!out.items.length) console.log('  (no self-overflowing element found)');
  out.items.forEach((i) =>
    console.log(`  <${i.tag}> scrollW=${i.scrollW} clientW=${i.clientW} kids=${i.kids}\n      class="${i.cls}"\n      text="${i.text}"`));
}

const cases = JSON.parse(await readFile(process.argv[2], 'utf8'));
for (const [route, w] of cases) await probe(route, w);
server.close();
await b.close();