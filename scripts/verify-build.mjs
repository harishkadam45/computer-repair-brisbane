/**
 * Post-build integrity check for the programmatic suburb matrix.
 *
 * `astro build` exiting 0 says nothing about whether the *URLs* are right. A
 * page can build perfectly and still be internally inconsistent, and the
 * failure mode here is invisible in the terminal and expensive in traffic:
 *
 *   - a canonical tag pointing somewhere other than where the file was written
 *     tells Google to ignore the URL that already has its ranking;
 *   - an internal link to a page that was never emitted is a soft 404.
 *
 * Both happened once already: getStaticPaths() wrote each suburb page to its
 * oldest legacy slug while the layout independently fell back to the canonical
 * slug, so every suburb with a legacy URL served from one path and advertised
 * another. The build was green. src/lib/suburb-url.mjs now owns the rule, and
 * this script is what proves the two halves still agree.
 *
 * Run after `astro build`:
 *   node scripts/verify-build.mjs
 *
 * Exits non-zero on any mismatch, so it can gate a deploy.
 */
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');

if (!existsSync(dist)) {
  console.error('dist/ not found - run `npx astro build` first.');
  process.exit(1);
}

const ORIGIN = (process.env.PUBLIC_SITE_URL ?? 'https://www.fixmyhomecomputer.com.au').replace(
  /\/$/,
  '',
);

/** Recursively collect every emitted HTML file, as [absolutePath, urlPath]. */
async function collect(dir, urlBase = '') {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await collect(abs, `${urlBase}/${entry.name}`)));
    } else if (entry.name === 'index.html') {
      out.push([abs, `${urlBase}/`]);
    }
  }
  return out;
}

const files = await collect(dist);
// The set of URLs that actually exist, for link checking.
const live = new Set(files.map(([, url]) => url));

const problems = [];
let canonicalChecked = 0;
let linksChecked = 0;
let jsonLdChecked = 0;

/** Strip the origin off an absolute URL so it can be compared to a urlPath. */
function toPath(href) {
  if (href.startsWith(ORIGIN)) return href.slice(ORIGIN.length) || '/';
  return null;
}

for (const [abs, urlPath] of files) {
  const html = await readFile(abs, 'utf8');

  // ---- 1. Canonical must be this page's own URL. -------------------------
  const canonical = html.match(
    /<link\s+rel="canonical"\s+href="([^"]+)"/i,
  )?.[1];

  if (canonical) {
    canonicalChecked++;
    const canonPath = toPath(canonical);
    if (canonPath === null) {
      problems.push(`${urlPath} canonical is off-origin: ${canonical}`);
    } else if (canonPath !== urlPath) {
      problems.push(
        `${urlPath}\n    served at : ${urlPath}\n    canonical: : ${canonPath}`,
      );
    }
  } else if (!urlPath.startsWith('/404')) {
    problems.push(`${urlPath} has no canonical tag`);
  }

  // ---- 2. JSON-LD must be valid JSON, not a broken string. --------------
  for (const m of html.matchAll(
    /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    jsonLdChecked++;
    try {
      JSON.parse(m[1]);
    } catch (err) {
      problems.push(`${urlPath} has invalid JSON-LD: ${err.message}`);
    }
  }

  // ---- 3. Internal links must resolve to an emitted page. ---------------
  for (const m of html.matchAll(/href="(\/[^"#?]*)"/g)) {
    const href = m[1];
    // Ignore asset requests; only page links are checked here.
    if (/\.(css|js|mjs|svg|png|jpg|jpeg|webp|avif|ico|xml|txt|webmanifest|json)$/i.test(href)) {
      continue;
    }
    linksChecked++;
    const target = href.endsWith('/') ? href : `${href}/`;
    if (!live.has(target)) {
      problems.push(`${urlPath} links to ${href} - not emitted by this build`);
    }
  }
}

const label = (n, what) => `${n.toLocaleString('en-AU')} ${what}`;

console.log(`Checked ${label(files.length, 'pages')}`);
console.log(`  ${label(canonicalChecked, 'canonical tags')}`);
console.log(`  ${label(jsonLdChecked, 'JSON-LD blocks')}`);
console.log(`  ${label(linksChecked, 'internal links')}`);

if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n`);
  // Cap the output; a systematic mistake would otherwise print thousands of lines.
  for (const p of problems.slice(0, 40)) console.error(`  ${p}`);
  if (problems.length > 40) console.error(`  ...and ${problems.length - 40} more`);
  process.exit(1);
}

console.log('\nOK: every canonical matches its emitted path and every internal link resolves.');
