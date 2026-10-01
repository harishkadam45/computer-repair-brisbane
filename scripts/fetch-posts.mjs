/**
 * Fetches full post content from the legacy WordPress REST API into
 * .migration/legacy-posts-full.json.
 *
 * The earlier scrape (scripts/scrape-legacy.mjs) only cached id/date/slug/
 * title, which is enough to build an index but not to render a post. This pulls
 * the rendered HTML, excerpts, categories and featured media so the blog can be
 * migrated as real pages rather than stubs.
 *
 * Safe to re-run: it overwrites the one output file and reports a summary.
 *   node scripts/fetch-posts.mjs
 */
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://www.fixmyhomecomputer.com.au';
const OUT = path.join(root, '.migration', 'legacy-posts-full.json');
const PER_PAGE = 100;

/** Word count with tags stripped, used only to flag suspiciously thin posts. */
const words = (html) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;|&#\d+;/gi, ' ')
    .split(/\s+/)
    .filter(Boolean).length;

const posts = [];

for (let page = 1; ; page++) {
  const url =
    `${ORIGIN}/wp-json/wp/v2/posts?per_page=${PER_PAGE}&page=${page}` +
    '&_fields=id,date,modified,slug,link,title,excerpt,content,categories,tags,featured_media';

  const res = await fetch(url);
  if (res.status === 400) break; // Past the last page: WP answers 400, not 404.
  if (!res.ok) throw new Error(`${url} -> ${res.status} ${res.statusText}`);

  const batch = await res.json();
  if (!batch.length) break;
  posts.push(...batch);
  process.stdout.write(`  page ${page}: ${batch.length}\n`);
}

const total = await fetch(
  `${ORIGIN}/wp-json/wp/v2/posts?per_page=1&_fields=id`,
).then((r) => Number(r.headers.get('x-wp-total') ?? posts.length));

await mkdir(path.dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(posts, null, 2), 'utf8');

console.log(`\nFetched ${posts.length} of ${total} posts -> ${path.relative(root, OUT)}`);

// Word counts are the cheapest signal of which posts are real writing and which
// are placeholder or spun filler left over from the old site.
const counts = posts
  .map((p) => ({ slug: p.slug, date: p.date?.slice(0, 10), w: words(p.content?.rendered ?? '') }))
  .sort((a, b) => a.w - b.w);

const thin = counts.filter((c) => c.w < 250);
console.log(`\nContent length spread:`);
console.log(`  median      ${counts[Math.floor(counts.length / 2)]?.w} words`);
console.log(`  under 250   ${thin.length} posts`);
console.log(`  under 100   ${counts.filter((c) => c.w < 100).length} posts`);

if (thin.length) {
  console.log(`\nThinnest 15 (review these before publishing):`);
  for (const c of counts.slice(0, 15)) console.log(`  ${String(c.w).padStart(5)}  ${c.date}  ${c.slug}`);
}
