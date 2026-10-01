/**
 * One-off legacy scraper. Reads the live WordPress site and writes raw inputs
 * into .migration/ for scripts/build-suburbs.mjs and the redirect map.
 *
 * Outputs:
 *   .migration/suburb-rows.txt      family|suburbKey|postcode|oldSlug
 *   .migration/qld-postcodes.csv     QLD postcode/suburb/lat/lon reference
 *   .migration/legacy-pages.json    every non-suburb page + its metadata
 *   .migration/legacy-posts.json    every blog post (raw HTML, for conversion)
 *   .migration/legacy-urls.txt      every old URL, one per line
 *
 * Run: node scripts/scrape-legacy.mjs
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mig = path.join(root, '.migration');
const ORIGIN = 'https://www.fixmyhomecomputer.com.au';
const QLD_CSV_URL =
  'https://raw.githubusercontent.com/schappim/australian-postcodes/master/data/by-state/QLD.csv';

await mkdir(mig, { recursive: true });

/** WordPress REST API pages are capped at 100 per request; walk them all. */
async function fetchAllPages(collection, extraFields = 'id,slug,link,title,parent,date,modified') {
  const out = [];
  const perPage = 100;
  for (let page = 1; ; page++) {
    const url = `${ORIGIN}/wp-json/wp/v2/${collection}?per_page=${perPage}&page=${page}&orderby=id&order=asc&_fields=${extraFields}`;
    const res = await fetch(url);
    if (res.status === 400) break; // past the last page
    if (!res.ok) throw new Error(`${url} -> ${res.status}`);
    const batch = await res.json();
    if (batch.length === 0) break;
    out.push(...batch);
    process.stdout.write(`\r  ${collection}: ${out.length} fetched   `);
  }
  process.stdout.write('\n');
  return out;
}

/** The five legacy page families. Longest prefix first so `laptop-repairs-`
 *  is not shadowed by `laptop-repair-`. */
const FAMILIES = [
  'computer-repairs',
  'computer-repair',
  'pc-repairs',
  'pc-repair',
  'mac-repairs',
  'mac-repair',
  'laptop-repairs',
  'laptop-repair',
];

/** Normalises a legacy slug to {family, suburbKey, postcode}, or null. */
function splitSuburb(slug) {
  const family = FAMILIES.find((f) => slug.startsWith(`${f}-`));
  if (!family) return null;
  const rest = slug.slice(family.length + 1);
  const m = /^(.*)-qld-(\d{4})$/.exec(rest);
  return { family, sub: m ? m[1] : rest, postcode: m ? m[2] : '' };
}

/**
 * `--offline` reuses .migration/legacy-pages.json and legacy-posts.json instead
 * of re-fetching from WordPress, so the derivation step can be re-run cheaply
 * after editing the slug rules above.
 */
const OFFLINE = process.argv.includes('--offline');

async function cached(collection, filename) {
  const target = path.join(mig, filename);
  if (OFFLINE) {
    return JSON.parse(await readFile(target, 'utf8'));
  }
  const rows = await fetchAllPages(collection);
  await writeFile(target, JSON.stringify(rows, null, 2));
  return rows;
}

async function main() {
  if (!OFFLINE) {
    console.log('1/5  QLD postcode reference');
    const csv = await (await fetch(QLD_CSV_URL)).text();
    await writeFile(path.join(mig, 'qld-postcodes.csv'), csv);
  } else {
    console.log('1/5  offline - reusing cached fetch');
  }

  console.log('2/5  pages (incl. ~1,650 suburb pages)');
  const pages = await cached('pages', 'legacy-pages.json');

  console.log('3/5  posts');
  const posts = await cached('posts', 'legacy-posts.json');

  console.log('4/5  suburb rows + URL list');
  const all = [...pages, ...posts];
  const suburbRows = [];
  const allUrls = [];
  for (const p of all) {
    const pathname = new URL(p.link).pathname.replace(/^\/+|\/+$/g, '');
    allUrls.push(pathname ? `/${pathname}/` : '/');
    if (!pathname) continue;
    const parts = splitSuburb(pathname);
    if (parts) suburbRows.push(`${parts.family}|${parts.sub}|${parts.postcode}|${pathname}`);
  }
  await writeFile(path.join(mig, 'suburb-rows.txt'), [...new Set(suburbRows)].sort().join('\n'));
  await writeFile(path.join(mig, 'legacy-urls.txt'), [...new Set(allUrls)].sort().join('\n'));

  const dupes = pages.length - new Set(pages.map((p) => p.slug)).size;
  console.log('5/5  done');
  console.log(`  pages: ${pages.length}  (slug collisions: ${dupes})`);
  console.log(`  posts: ${posts.length}`);
  console.log(`  suburb rows: ${suburbRows.length}`);
  console.log(`  total old URLs: ${allUrls.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
