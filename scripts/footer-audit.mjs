/**
 * Footer dark-surface check.
 *
 * The interesting part is not that the footer is black - it is that its text
 * is actually light. The base layer paints text-ink-700 straight onto every
 * <p> and text-ink-900 onto every h1-h4, which beats inheritance, so a footer
 * that only set a light colour on <footer> would still render its copyright
 * and credit lines in near-black on black. This asserts the computed colours
 * of the elements that carry no colour utility of their own, plus hover.
 *
 * Colours are resolved through a canvas rather than by parsing the computed
 * string. Tailwind v4 emits text-white/75 as `oklab(... / 0.75)`, not rgba(),
 * so a regex parser silently skips every muted colour in the footer - exactly
 * the ones this check exists to prove are readable.
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const DIST = path.resolve('dist');
const PORT = 4402;
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

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(`${O}/`, { waitUntil: 'load' });
await page.evaluate(() => document.fonts?.ready);
await page.waitForTimeout(250);

let bad = 0;
const say = (ok, msg, extra = '') => {
  if (!ok) bad++;
  console.log(`  ${ok ? 'OK  ' : 'FAIL'}  ${msg}${extra ? '  ' + extra : ''}`);
};

// Installed once; resolves any CSS colour string (rgb, oklab, color-mix, alpha)
// to sRGB bytes plus alpha.
await page.evaluate(() => {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 1;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  window.__resolve = (css) => {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#000';
    ctx.fillStyle = css;
    // If the browser rejected the value, fillStyle kept the previous colour.
    const accepted = ctx.fillStyle !== '#000000' || css.includes('#000');
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = css;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return { rgb: [d[0], d[1], d[2]], a: d[3] / 255, accepted };
  };
  window.__lum = (rgb) => {
    const s = (c) => (c / 255 <= 0.03928 ? c / 255 / 12.92 : Math.pow((c / 255 + 0.055) / 1.055, 2.4));
    return 0.2126 * s(rgb[0]) + 0.7152 * s(rgb[1]) + 0.0722 * s(rgb[2]);
  };
  window.__ratio = (f, b, alpha) => {
    const eff = f.rgb.map((c, i) => c * alpha + b[i] * (1 - alpha));
    const l1 = window.__lum(eff), l2 = window.__lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };
});

const bg = await page.evaluate(() => {
  const f = document.querySelector('footer');
  return { css: getComputedStyle(f).backgroundColor, resolved: window.__resolve(getComputedStyle(f).backgroundColor) };
});
say(bg.resolved.rgb.every((c) => c === 0), 'footer background is black', bg.css);

console.log('');
const text = await page.evaluate(() => {
  const footer = document.querySelector('footer');
  const bgc = window.__resolve(getComputedStyle(footer).backgroundColor);
  const out = [];
  const seen = new Set();
  for (const el of footer.querySelectorAll('*')) {
    const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join('');
    if (!own) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.15) continue;
    const fg = window.__resolve(cs.color);
    if (!fg.accepted) continue;
    const ratio = window.__ratio(fg, bgc.rgb, fg.a);
    const size = parseFloat(cs.fontSize);
    const weight = Number(cs.fontWeight) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const need = large ? 3 : 4.5;
    const key = `${cs.color}|${Math.round(size)}|${weight}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ sample: own.slice(0, 30), color: cs.color, ratio: Math.round(ratio * 100) / 100, need, size: Math.round(size * 10) / 10, weight });
  }
  return out.sort((a, b) => a.ratio - b.ratio);
});
say(text.length > 0, `resolved ${text.length} distinct footer text styles`);
for (const t of text) say(t.ratio >= t.need, `${String(t.ratio).padStart(6)}:1 (need ${t.need})  ${t.size}px/${t.weight}  "${t.sample}"`);

// The regression this whole change risks: elements with no colour utility of
// their own, which the base p/h rules used to paint dark.
console.log('');
const unstyled = await page.evaluate(() => {
  const want = ['©', 'Sitemap', 'RSS', 'Servicing', 'Pricing', 'Contact', 'Reviews', 'Blog', 'About Robert'];
  const footer = document.querySelector('footer');
  const rows = [];
  const seen = new Set();
  for (const el of footer.querySelectorAll('*')) {
    const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join('');
    if (!own) continue;
    if (!want.some((w) => own.startsWith(w))) continue;
    if (seen.has(own)) continue;
    seen.add(own);
    const bgc = window.__resolve(getComputedStyle(footer).backgroundColor);
    const fg = window.__resolve(getComputedStyle(el).color);
    const eff = fg.rgb.map((c, i) => c * fg.a + bgc.rgb[i] * (1 - fg.a));
    rows.push({ text: own.slice(0, 26), color: getComputedStyle(el).color, lum: window.__lum(eff) });
  }
  return rows;
});
say(unstyled.length >= 8, `found ${unstyled.length} elements with no colour utility`);
for (const u of unstyled) say(u.lum >= 0.1, `"${u.text}" is light on black`, `lum=${u.lum.toFixed(3)} ${u.color}`);

console.log('');
for (const sel of ['footer nav a', 'footer a[href*="sitemap"]', 'footer a[href*="rss"]', 'footer a[href*="fixmyhomecomputer"]']) {
  const el = page.locator(sel).first();
  if ((await el.count()) === 0) { say(false, `${sel} not found`); continue; }
  const before = await el.evaluate((n) => getComputedStyle(n).color);
  await el.hover();
  await page.waitForTimeout(320);
  const after = await el.evaluate((n) => {
    const bgc = window.__resolve(getComputedStyle(document.querySelector('footer')).backgroundColor);
    const fg = window.__resolve(getComputedStyle(n).color);
    return { color: getComputedStyle(n).color, ratio: window.__ratio(fg, bgc.rgb, fg.a) };
  });
  say(after.ratio >= 4.5, `${sel} hover readable`, `${String(Math.round(after.ratio * 100) / 100)}:1  ${before} -> ${after.color}`);
}

console.log(bad === 0 ? '\nPASS: footer is black with light, accessible text throughout.' : `\n${bad} footer check(s) failed.`);
await browser.close();
server.close();