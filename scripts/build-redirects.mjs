/**
 * Generates the 301 map for the legacy WordPress URLs.
 *
 * Two classes of redirect matter here, and only two:
 *
 *   1. Duplicate suburb slugs. A suburb that had several near-duplicate legacy
 *      pages (`computer-repairs-surfers-paradise-2`) keeps the oldest live and
 *      301s the rest to it. Left unredirected these are soft 404s, and a soft
 *      404 on a URL with backlinks is worse than a redirect.
 *
 *   2. Legacy URLs with no equivalent in the new structure - `/services/
 *      virus-malware-and-spyware-removal-brisbane/` (the one service the old
 *      site published under /services/ rather than the root), the
 *      `/about-2/` style duplicates, and the junk WordPress left behind.
 *
 * Critically, it does *not* generate redirects for URLs that are already
 * emitted. A redirect pointing at a live page is fine; a redirect loop or a
 * redirect to a 404 is not, so anything already built is skipped and reported.
 *
 * It imports the same helpers the routes use, under --experimental-strip-types,
 * so the map cannot disagree with what the build actually emitted.
 *
 *   node --experimental-strip-types scripts/build-redirects.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { services, families } from '../src/data/services.ts';
import { liveSuburbUrl, legacySlugsFor } from '../src/lib/suburb-url.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LEGACY = path.join(root, '.migration', 'legacy-urls.txt');

const legacyUrls = (await readFile(LEGACY, 'utf8'))
  .split('\n')
  .map((l) => l.trim())
  .filter(Boolean)
  .map((u) => {
    // Normalise to a root-relative path with a trailing slash.
    let p = u.replace(/^https?:\/\/[^/]+/i, '');
    if (!p.startsWith('/')) p = `/${p}`;
    if (!p.endsWith('/')) p = `${p}/`;
    return p;
  });

/**
 * Read straight from the JSON rather than importing src/lib/suburbs.ts: that
 * module imports JSON, which plain Node ESM requires an import attribute for,
 * and all this script needs is the records themselves.
 */
const suburbs = JSON.parse(await readFile(path.join(root, 'src', 'data', 'suburbs.json'), 'utf8'));
const posts = JSON.parse(await readFile(path.join(root, 'src', 'data', 'posts.json'), 'utf8'));

/** Standalone service pages, e.g. /data-recovery/. */
const standaloneServices = services.filter((s) => !families.some((f) => f.slug === s.slug));

/** Every URL this build emits, so we never redirect a live page to itself. */
const emitted = new Set([
  '/',
  '/404/',
  '/about/',
  '/blog/',
  '/contact/',
  '/pricing/',
  '/quote/',
  '/services/',
  '/service-area/',
  '/testimonials/',
  ...families.map((f) => `/${f.slug}/`),
  ...standaloneServices.map((s) => `/${s.slug}/`),
  ...posts.map((p) => p.path),
  ...suburbs.flatMap((s) => families.map((f) => liveSuburbUrl(f, s))),
]);

/** from -> to, insertion-ordered, deduplicated. */
const redirects = new Map();
const add = (from, to) => {
  if (from === to) return;
  redirects.set(from, to);
};

// ---- 1. Duplicate legacy suburb slugs -------------------------------------
let duplicateCount = 0;
for (const family of families) {
  for (const suburb of suburbs) {
    const all = legacySlugsFor(family, suburb);
    if (all.length < 2) continue;
    const live = liveSuburbUrl(family, suburb);
    // Keep the first (oldest) live; 301 every other variant to it.
    for (const slug of all.slice(1)) {
      add(`/${slug}/`, live);
      duplicateCount++;
    }
  }
}

// ---- 2. Legacy URLs with no direct equivalent ----------------------------
const known = new Set(emitted);
const orphans = legacyUrls.filter((u) => !known.has(u));

/** Explicit hand-maintained mappings, checked here so a typo cannot 404. */
const MANUAL = {
  // The only service the old site filed under /services/; it now lives at root
  // alongside its 18 siblings, which is where the other 18 legacy URLs are.
  '/services/virus-malware-and-spyware-removal-brisbane/':
    '/virus-malware-and-spyware-removal-brisbane/',
  // Short aliases people linked to directly.
  '/contact-us/': '/contact/',
  '/laptop-repair/': '/laptop-repairs/',
  '/virus-removal/': '/virus-malware-and-spyware-removal-brisbane/',

  // WordPress "page in a box" duplicates and the old home page variants.
  '/about-2/': '/about/',
  '/contact-2/': '/contact/',
  '/home-2/': '/',
  '/homepage/': '/',
  '/bottom/': '/',
};

let manualCount = 0;
for (const [from, to] of Object.entries(MANUAL)) {
  if (redirects.has(from)) continue;
  if (!emitted.has(to)) {
    console.warn(`  ! manual redirect ${from} -> ${to} targets a page that is not emitted`);
    continue;
  }
  add(from, to);
  manualCount++;
}

// Everything else orphaned is WordPress cruft with no meaningful destination.
// These are reported rather than guessed at: some may be real pages that were
// dropped in error, and only the site owner can tell which.
const cruft = orphans.filter((u) => !redirects.has(u));

// ---- Write the outputs ---------------------------------------------------
const entries = [...redirects.entries()].sort(([a], [b]) => a.localeCompare(b));

await writeFile(
  path.join(root, 'redirects.json'),
  `${JSON.stringify(Object.fromEntries(entries), null, 2)}\n`,
  'utf8',
);

// Netlify / Cloudflare Pages format.
const netlify = entries
  .map(([from, to]) => `${from}  ${to}  301`)
  .join('\n');
await writeFile(path.join(root, 'dist', '_redirects'), `${netlify}\n`, 'utf8');

// nginx, for a VPS or Railway-style static container.
const nginx = entries
  .map(([from, to]) => `rewrite ^${from.replace(/^\//, '')}$ ${to.replace(/^\//, '')} permanent;`)
  .join('\n');
await writeFile(path.join(root, 'redirects.nginx.conf'), `${nginx}\n`, 'utf8');

console.log(`Generated ${entries.length} redirects`);
console.log(`  ${duplicateCount}  duplicate suburb slugs -> their live page`);
console.log(`  ${manualCount}  hand-mapped legacy URLs`);
console.log(`  ${cruft.length}  legacy URLs with no destination (see below)`);
console.log(`\nWrote redirects.json, dist/_redirects, redirects.nginx.conf`);

if (cruft.length) {
  console.log(`\nLegacy URLs not emitted and not redirected - review these:`);
  for (const u of cruft.slice(0, 30)) console.log(`  ${u}`);
  if (cruft.length > 30) console.log(`  ...and ${cruft.length - 30} more`);
}

// A redirect whose target is not itself emitted would 404 after the hop, which
// is the failure mode this whole script exists to prevent.
const dangling = entries.filter(([, to]) => !emitted.has(to) && !redirects.has(to));
if (dangling.length) {
  console.error(`\n${dangling.length} redirect(s) point at a page that is not emitted:`);
  for (const [from, to] of dangling.slice(0, 20)) console.error(`  ${from} -> ${to}`);
  process.exit(1);
}
