/**
 * Source a lead photo for the three posts that never had an image.
 *
 * The other 107 posts got their art from the legacy WordPress uploads. These
 * three have no featured media and no inline picture, so nothing was captured
 * for them and they fall back to a branded tile.
 *
 * Pexels and Unsplash both licence their photos for commercial use without
 * charging, which is what makes them safe to put on a client's site - unlike
 * anything pulled out of a search engine, which is almost always someone
 * else's copyright.
 *
 * Needs PEXELS_API_KEY (or UNSPLASH_ACCESS_KEY) in .env:
 *   https://www.pexels.com/api/      free, instant
 *   https://unsplash.com/developers   free, instant
 *
 *   node .migration/source-lead-images.mjs
 *
 * Skips posts that already have art, so it is safe to re-run.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, 'public', 'images', 'blog');
const POSTS = path.join(root, 'src', 'data', 'posts.json');
const MANIFEST = path.join(root, '.migration', 'featured-image-manifest.json');
const ENV = path.join(root, '.env');

/**
 * Query sets per slug, best first. The legacy posts have no tags to match on,
 * so these are written against the actual subject of each article. Results are
 * checked against every query in the list and the first that yields a usable
 * landscape photo wins.
 */
const WANTED = {
  '9-trends-of-2020-you-need-to-follow-with-blurn-digital-marketing-agencys-expertise': {
    title: 'Digital marketing trends',
    alt: 'Marketing and social media planning',
    queries: [
      'digital marketing strategy',
      'social media marketing desk',
      'business team planning laptop',
    ],
  },
  'creating-an-app-without-coding-its-possible': {
    title: 'Building an app without code',
    alt: 'Mobile app development on a phone',
    queries: ['mobile app development', 'smartphone app interface', 'person coding laptop'],
  },
  'microsoft-confirms-widespread-failures-in-core-windows-11-features': {
    title: 'Windows 11 failures',
    alt: 'Windows 11 on a laptop screen',
    queries: ['laptop computer screen windows', 'computer screen error', 'desktop computer setup'],
  },
};

function loadEnv() {
  if (!fs.existsSync(ENV)) return {};
  const out = {};
  for (const line of fs.readFileSync(ENV, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i.exec(line);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

const env = { ...loadEnv(), ...process.env };
const provider = env.PEXELS_API_KEY
  ? 'pexels'
  : env.UNSPLASH_ACCESS_KEY
    ? 'unsplash'
    : null;

if (!provider) {
  console.log('No image API key found. Add one of these to .env:\n');
  console.log('  PEXELS_API_KEY=...        https://www.pexels.com/api/');
  console.log('  UNSPLASH_ACCESS_KEY=...   https://unsplash.com/developers\n');
  console.log('Nothing was changed.');
  process.exit(1);
}
console.log(`provider: ${provider}`);

/** Candidates with a width big enough for a 350px card at 2x. */
const MIN_W = 700;

function usable(p) {
  return p.width >= MIN_W && p.height > 0 && p.width / p.height >= 1.2 && p.width / p.height <= 2.2;
}

async function pexels(query) {
  const u = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=15&orientation=landscape&size=large`;
  const res = await fetch(u, { headers: { Authorization: env.PEXELS_API_KEY } });
  if (!res.ok) throw new Error(`pexels ${res.status}`);
  const json = await res.json();
  return (json.photos || []).map((p) => ({
    src: p.src.large2x || p.src.large,
    width: p.width,
    height: p.height,
    alt: p.alt || '',
    credit: `Photo by ${p.photographer} on Pexels`,
    page: p.url,
  }));
}

async function unsplash(query) {
  const u = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=15&orientation=landscape`;
  const res = await fetch(u, { headers: { Authorization: `Client-ID ${env.UNSPLASH_ACCESS_KEY}` } });
  if (!res.ok) throw new Error(`unsplash ${res.status}`);
  const json = await res.json();
  return (json.results || []).map((p) => ({
    src: p.urls.regular,
    width: p.width,
    height: p.height,
    alt: p.alt_description || p.description || '',
    credit: `Photo by ${p.user.name} on Unsplash`,
    page: p.links.html,
  }));
}

const search = provider === 'pexels' ? pexels : unsplash;

const MAGIC = [
  [0xff, 0xd8, 0xff],
  [0x89, 0x50, 0x4e, 0x47],
  [0x47, 0x49, 0x46, 0x38],
];
function looksLikeImage(buf) {
  return (
    MAGIC.some((sig) => sig.every((b, i) => buf[i] === b)) ||
    buf.subarray(0, 4).toString('ascii') === 'RIFF'
  );
}

const posts = JSON.parse(fs.readFileSync(POSTS, 'utf8'));
const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));

const added = [];
const skipped = [];
const failed = [];

for (const [slug, want] of Object.entries(WANTED)) {
  const post = posts.find((p) => p.slug === slug);
  if (!post) {
    failed.push(`${slug}: not in posts.json`);
    continue;
  }
  if (post.image) {
    skipped.push(`${slug}: already has ${post.image}`);
    continue;
  }

  let pick = null;
  for (const q of want.queries) {
    let hits = [];
    try {
      hits = await search(q);
    } catch (e) {
      console.log(`  search "${q}" failed: ${e.message}`);
      continue;
    }
    const hit = hits.filter(usable)[0];
    if (hit) {
      pick = { ...hit, query: q };
      break;
    }
  }
  if (!pick) {
    failed.push(`${slug}: no usable landscape result`);
    continue;
  }

  try {
    const res = await fetch(pick.src);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const type = (res.headers.get('content-type') || '').toLowerCase();
    const buf = Buffer.from(await res.arrayBuffer());
    if (!type.startsWith('image/')) throw new Error(`content-type ${type}`);
    if (buf.length < 1024) throw new Error(`only ${buf.length} bytes`);
    if (!looksLikeImage(buf)) throw new Error('not an image by magic bytes');

    const base = `${slug}--${provider}-${path.basename(new URL(pick.src).pathname).replace(/\.\w+$/, '')}.jpg`;
    fs.writeFileSync(path.join(OUT, base), buf);

    manifest[slug] = {
      file: base,
      path: `/images/blog/${base}`,
      src: pick.src,
      width: pick.width,
      alt: pick.alt || want.alt,
      credit: pick.credit,
      page: pick.page,
    };
    post.image = manifest[slug].path;
    post.imageAlt = manifest[slug].alt;
    added.push(`${slug}\n    query="${pick.query}" ${pick.width}x${pick.height} ${(buf.length / 1024).toFixed(0)}KB`);
  } catch (e) {
    failed.push(`${slug}: ${e.message}`);
  }
}

console.log(`\nadded ${added.length}:`);
added.forEach((a) => console.log('  ' + a));
if (skipped.length) {
  console.log(`\nskipped ${skipped.length}:`);
  skipped.forEach((s) => console.log('  ' + s));
}
if (failed.length) {
  console.log(`\nFAILED ${failed.length}, nothing written:`);
  failed.forEach((f) => console.log('  ' + f));
  process.exit(1);
}

fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1) + '\n');
fs.writeFileSync(POSTS, JSON.stringify(posts, null, 2) + '\n');
console.log('\nmanifest + posts.json updated');
console.log(
  'NOTE: Pexels and Unsplash licences are free for commercial use, but both ask ' +
    'for a visible credit when you use their API. Add the credit lines before shipping.',
);