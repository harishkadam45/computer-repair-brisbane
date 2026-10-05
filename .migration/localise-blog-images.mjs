/**
 * One-off: download every image referenced by src/data/posts.json into
 * public/images/blog/ and rewrite the post bodies to the local paths.
 *
 * The 147 images were all hot-linked from www.fixmyhomecomputer.com.au, so the
 * site was depending on that domain staying up and registered for every blog
 * image to render. Run from the repo root: node .migration/localise-blog-images.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const POSTS = path.join(root, 'src', 'data', 'posts.json');
const OUT_DIR = path.join(root, 'public', 'images', 'blog');
const REMOTE_HOST = 'www.fixmyhomecomputer.com.au';

fs.mkdirSync(OUT_DIR, { recursive: true });

const posts = JSON.parse(fs.readFileSync(POSTS, 'utf8'));

/** Every distinct remote image URL in use, with the alt text first seen with. */
const wanted = new Map();
for (const post of posts) {
  for (const m of (post.body || '').matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi)) {
    const url = m[1];
    if (!url.includes(REMOTE_HOST)) continue;
    const alt = /alt=["']([^"']*)["']/i.exec(m[0]);
    if (!wanted.has(url)) wanted.set(url, { alt: alt ? alt[1] : '', post: post.slug });
  }
}

console.log(`distinct remote images: ${wanted.size}`);

/** Keep the original filename but namespace by post, so no two posts collide. */
const localNameFor = (url, slug) => {
  const base = path.basename(new URL(url).pathname);
  const safe = base.replace(/[^a-zA-Z0-9._-]/g, '-');
  return `${slug}--${safe}`;
};

const manifest = {};
let ok = 0;
const failed = [];

let i = 0;
for (const [url, meta] of wanted) {
  i++;
  const name = localNameFor(url, meta.post);
  const dest = path.join(OUT_DIR, name);

  if (fs.existsSync(dest) && fs.statSync(dest).size > 1024) {
    manifest[url] = { src: `/images/blog/${name}`, alt: meta.alt };
    ok++;
    continue;
  }

  try {
    const res = await fetch(url, {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; site-migration)' },
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const type = res.headers.get('content-type') || '';
    if (!type.startsWith('image/')) throw new Error(`not an image: ${type}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 512) throw new Error(`suspiciously small: ${buf.length}b`);
    fs.writeFileSync(dest, buf);
    manifest[url] = { src: `/images/blog/${name}`, alt: meta.alt };
    ok++;
  } catch (err) {
    failed.push({ url, error: String(err.message || err) });
  }

  if (i % 20 === 0) console.log(`  ${i}/${wanted.size}`);
}

console.log(`downloaded: ${ok}/${wanted.size}`);
if (failed.length) {
  console.log(`FAILED (${failed.length}):`);
  for (const f of failed) console.log('  -', f.url, '=>', f.error);
}

fs.writeFileSync(
  path.join(root, '.migration', 'blog-image-manifest.json'),
  JSON.stringify(manifest, null, 2),
);

/**
 * Only rewrite bodies once every image we could get is on disk and mapped, so a
 * partial download can never leave the site pointing at files that do not exist.
 */
if (failed.length === 0) {
  let rewritten = 0;
  for (const post of posts) {
    if (!post.body || !post.body.includes(REMOTE_HOST)) continue;
    let body = post.body;
    for (const [remote, local] of Object.entries(manifest)) {
      body = body.split(remote).join(local.src);
    }
    post.body = body;
    rewritten++;
  }
  fs.writeFileSync(POSTS, JSON.stringify(posts, null, 2) + '\n');
  console.log(`rewrote bodies in ${rewritten} posts`);
  const leftover = posts.filter((p) => (p.body || '').includes(REMOTE_HOST)).length;
  console.log(`posts still referencing the old domain: ${leftover}`);
} else {
  console.log('NOT rewriting bodies - some downloads failed, rerun to finish.');
}