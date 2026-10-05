/**
 * Download the WordPress featured images and record them per post.
 *
 * fetch-posts.mjs asked the API for `featured_media`, but build-posts.mjs threw
 * that field away, so 44 posts that have a thumbnail on the legacy site were
 * rendered as blank tiles - their only image, the one WordPress treats as the
 * post's own, was never captured.
 *
 * These are the images the legacy blog used in its own listings, so they are the
 * correct card art. They take precedence over the first image in the body; the
 * body scan stays as the fallback for the 11 posts with no featured media but
 * an inline image.
 *
 * Nothing is written until every download validates, so a partial failure leaves
 * posts.json untouched.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://www.fixmyhomecomputer.com.au/wp-json/wp/v2';
const OUT = path.join(root, 'public', 'images', 'blog');
const POSTS = path.join(root, 'src', 'data', 'posts.json');
const MANIFEST = path.join(root, '.migration', 'featured-image-manifest.json');

const posts = JSON.parse(fs.readFileSync(POSTS, 'utf8'));

// posts.json predates this field, so recover the ids from the raw capture
if (!posts.some((p) => p.mediaId)) {
  const raw = JSON.parse(fs.readFileSync(path.join(root, '.migration', 'legacy-posts-full.json'), 'utf8'));
  const byId = new Map(raw.map((p) => [p.slug, p.featured_media]));
  for (const p of posts) {
    const fm = byId.get(p.slug);
    if (fm && fm !== 0) p.mediaId = fm;
  }
}

const mediaIds = [...new Set(posts.map((p) => p.mediaId).filter(Boolean))];
if (!mediaIds.length) throw new Error('no featured_media ids recovered - aborting rather than stamping nulls');

/** Pull the media records, including every derived size. */
console.log(`resolving ${mediaIds.length} featured media ids`);
const media = new Map();
for (let i = 0; i < mediaIds.length; i += 50) {
  const batch = mediaIds.slice(i, i + 50);
  const res = await fetch(`${API}/media?include=${batch.join(',')}&per_page=100`);
  if (!res.ok) throw new Error(`media ${res.status} for batch ${i}: ${await res.text()}`);
  for (const m of await res.json()) {
    media.set(m.id, { source_url: m.source_url, alt: m.alt_text || '', sizes: m.media_details?.sizes || {} });
  }
}
console.log(`  got ${media.size} of ${mediaIds.length}`);

/**
 * Card art is rendered at ~350 CSS px, so 2x wants about 700px of source.
 * medium_large is 768w on this site; fall back through the larger variants and
 * only then to the original, which tops out around 1400w.
 */
function pickSize(m) {
  for (const key of ['medium_large', 'large', 'full']) {
    const s = m.sizes?.[key];
    if (s?.source_url) return { url: s.source_url, w: s.width };
  }
  return { url: m.source_url, w: null };
}

const MAGIC = [
  [0xff, 0xd8, 0xff], // jpeg
  [0x89, 0x50, 0x4e, 0x47], // png
  [0x47, 0x49, 0x46, 0x38], // gif
  [0x42, 0x4d], // bmp
];

function looksLikeImage(buf) {
  return MAGIC.some((sig) => sig.every((b, i) => buf[i] === b)) || buf.subarray(0, 4).toString('ascii') === 'RIFF';
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The legacy host sits behind Cloudflare and intermittently answers 522. */
async function download(url) {
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'blog-image-migration/1.0' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const type = (res.headers.get('content-type') || '').toLowerCase();
      const buf = Buffer.from(await res.arrayBuffer());
      if (!type.startsWith('image/')) throw new Error(`content-type ${type || 'none'}`);
      if (buf.length < 1024) throw new Error(`only ${buf.length} bytes`);
      if (!looksLikeImage(buf)) throw new Error('not an image by magic bytes');
      return buf;
    } catch (e) {
      lastErr = e;
      if (attempt < 4) {
        await sleep(1000 * attempt * attempt);
        continue;
      }
    }
  }
  throw lastErr;
}

const manifest = {};
let downloaded = 0;
let reused = 0;
let missing = 0;
const failures = [];

for (const post of posts) {
  const m = post.mediaId && media.get(post.mediaId);
  if (!m) {
    manifest[post.slug] = null;
    post.imageAlt = '';
    missing++;
    continue;
  }

  const { url, w } = pickSize(m);
  const base = path.basename(new URL(url).pathname);
  const file = `${post.slug}--${base}`;
  const dest = path.join(OUT, file);

  try {
    const buf = await download(url);
    if (!fs.existsSync(dest)) {
      fs.writeFileSync(dest, buf);
      downloaded++;
    } else {
      reused++;
    }
    manifest[post.slug] = {
      file,
      path: `/images/blog/${file}`,
      src: url,
      width: w,
      alt: m.alt,
    };
    post.imageAlt = m.alt || '';
  } catch (e) {
    failures.push(`${post.slug}: ${e.message}`);
  }
}

console.log(`\ndownloaded ${downloaded}, already on disk ${reused}, no featured media ${missing}`);
if (failures.length) {
  console.log(`FAILURES (${failures.length}), posts.json left untouched:`);
  failures.forEach((f) => console.log('  ' + f));
  process.exit(1);
}

fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1) + '\n');
const withArt = Object.values(manifest).filter(Boolean).length;
console.log(`manifest written: ${withArt}/${posts.length} posts have featured art`);

// Stamp the resolved path onto each record so the page build needs no network.
for (const p of posts) {
  const rec = manifest[p.slug];
  p.image = rec ? rec.path : null;
  delete p.mediaId;
}
fs.writeFileSync(POSTS, JSON.stringify(posts, null, 2) + '\n');
console.log('posts.json updated with image paths');