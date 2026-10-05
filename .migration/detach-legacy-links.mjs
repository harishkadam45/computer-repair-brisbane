/**
 * Second pass: finish detaching src/data/posts.json from the legacy domain.
 *
 * Pass one (localise-blog-images.mjs) rewrote every <img src>. Two things were
 * left pointing at www.fixmyhomecomputer.com.au:
 *
 *   1. srcset variants. 30 of them, e.g. pexels-plann-4549414-300x200.jpg. They
 *      are alternate sizes of images already on disk. Rather than pull another
 *      30 files that duplicate what we have, the srcset/sizes attributes come
 *      off entirely so the local src is the only candidate the browser picks.
 *   2. Internal links. The old site served services under /services/{slug}/; we
 *      serve them at /{slug}/. Those 17 links pointed at the legacy domain and
 *      sent readers off-site mid-article.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const POSTS = path.join(root, 'src', 'data', 'posts.json');

const posts = JSON.parse(fs.readFileSync(POSTS, 'utf8'));

/** Legacy path -> our path. Only entries we have actually verified exist. */
const LINK_MAP = {
  'https://www.fixmyhomecomputer.com.au/services/virus-malware-and-spyware-removal-brisbane/':
    '/virus-malware-and-spyware-removal-brisbane/',
  'https://www.fixmyhomecomputer.com.au/services/': '/services/',
  'https://www.fixmyhomecomputer.com.au/': '/',
  'http://www.fixmyhomecomputer.com.au/': '/',
  'http://www.fixmyhomecomputer.com.au': '/',
};

let srcsetStripped = 0;
let linksRewritten = 0;

for (const post of posts) {
  if (!post.body || !post.body.includes('fixmyhomecomputer')) continue;
  let body = post.body;

  // 1. Drop srcset/sizes. Counting the tags, not the candidates.
  srcsetStripped += (body.match(/<img[^>]*\ssrcset=/gi) || []).length;
  body = body
    .replace(/(<img[^>]*?)\ssrcset="[^"]*"/gi, '$1')
    .replace(/(<img[^>]*?)\ssizes="[^"]*"/gi, '$1');

  // 2. Repoint internal links.
  for (const [from, to] of Object.entries(LINK_MAP)) {
    const parts = body.split(from);
    if (parts.length > 1) {
      linksRewritten += parts.length - 1;
      body = parts.join(to);
    }
  }

  // 2b. A bare reference to the legacy domain, e.g. an old post linking to the
  // old homepage from inside its own body text. The negative lookahead matters:
  // without it this would also match the prefix of any /services/... URL and
  // turn it into a protocol-relative //services/... link.
  body = body.replace(
    /href="https?:\/\/(?:www\.)?fixmyhomecomputer\.com\.au(?![/\w.-])"/gi,
    'href="/"',
  );

  post.body = body;
}

fs.writeFileSync(POSTS, JSON.stringify(posts, null, 2) + '\n');
console.log(`srcset attributes stripped: ${srcsetStripped}`);
console.log(`internal links repointed: ${linksRewritten}`);

const remaining = posts.filter((p) => (p.body || '').includes('fixmyhomecomputer'));
console.log(`posts still mentioning the legacy domain: ${remaining.length}`);
for (const p of remaining) {
  const hits = [
    ...new Set(
      [...(p.body || '').matchAll(/https?:\/\/(?:www\.)?fixmyhomecomputer\.com\.au[^\s"'<)]*/gi)].map(
        (m) => m[0],
      ),
    ),
  ];
  console.log(`  ${p.slug}`);
  hits.forEach((h) => console.log(`      ${h}`));
}