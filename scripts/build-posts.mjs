/**
 * Turns .migration/legacy-posts-full.json into src/data/posts.json.
 *
 * The fetched HTML is WordPress/Divi output and is full of markup that means
 * nothing on the new site: the `dslc-theme-content` wrapper, share buttons,
 * related-post widgets, author avatars, and inline styles carried over from the
 * old theme. Left in, it would ship 110 pages of dead divs and fight the new
 * stylesheet.
 *
 * So this strips the chrome, keeps the prose, and produces a small typed
 * record per post. It also repairs the mojibake in some titles - the older
 * scrape mangled curly apostrophes into replacement characters, and the
 * WordPress API returns clean Unicode, which is why this runs from the API
 * data rather than the cached titles.
 *
 *   node scripts/build-posts.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(root, '.migration', 'legacy-posts-full.json');
const OUT = path.join(root, 'src', 'data', 'posts.json');

const raw = JSON.parse(await readFile(SRC, 'utf8'));

/** Divi wrappers and shortcode leftovers that carry no content. */
const WRAPPERS = [
  /<div[^>]*id="dslc-theme-content"[^>]*>/gi,
  /<div[^>]*class="[^"]*\bdslc-[^"]*"[^>]*>/gi,
  /<div[^>]*class="[^"]*\bsharedaddy\b[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
  /<div[^>]*class="[^"]*\bjp-relatedposts\b[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
  /<div[^>]*class="[^"]*\bpost-ajax-load-more\b[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
  /<div[^>]*class="[^"]*\bcr-post-tags\b[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
  /<!--\s*\/?wp:[\s\S]*?-->/gi,
];

/** Strip a level of a single tag pair, repeatedly, to unwrap theme divs. */
function unwrap(html) {
  let out = html;
  for (let i = 0; i < 6; i++) {
    const next = out.replace(/<div[^>]*>([\s\S]*?)<\/div>/gi, '$1');
    if (next === out) break;
    out = next;
  }
  return out;
}

function clean(html) {
  let out = html ?? '';

  // Embedded media widgets (Twitter, YouTube, Facebook) bring their own <script>.
  // These bodies are rendered with set:html, so a script surviving here would
  // execute on our origin - and a Twitter widget from 2020 is not worth that.
  // Drop the element *and* its contents rather than unwrapping, or the
  // leftover text would read as a broken paragraph.
  out = out
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<script\b[^>]*\/?>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, '')
    .replace(/<iframe\b[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object\b[\s\S]*?<\/object>/gi, '')
    .replace(/<embed\b[^>]*>/gi, '')
    .replace(/<form\b[\s\S]*?<\/form>/gi, '')
    // Inline event handlers and javascript: URLs, belt and braces.
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/javascript:/gi, '');

  for (const re of WRAPPERS) out = out.replace(re, '');
  out = unwrap(out);

  out = out
    // Theme layout classes carry no meaning here and would fight the new CSS.
    .replace(/<(\w+)\s+class="[^"]*"([^>]*)>/gi, '<$1$2>')
    .replace(/<(\w+)\s+style="[^"]*"([^>]*)>/gi, '<$1$2>')
    .replace(/<(\w+)\s+id="[^"]*"([^>]*)>/gi, '<$1$2>')
    // Empty paragraphs left behind by removed widgets.
    .replace(/<p>\s*(?:&nbsp;|<br\s*\/?>)*\s*<\/p>/gi, '')
    .replace(/^\s+|\s+$/g, '');

  return out;
}

/**
 * The WordPress API returns clean Unicode in titles, but a few posts carry
 * replacement characters inside the body where the original scrape mangled a
 * curly quote. Left alone they render as "�?" in the middle of a sentence.
 * Where the character sits between two word characters it was an apostrophe or
 * quote; anywhere else it is just noise and gets dropped.
 */
function repairMojibake(text) {
  return text
    .replace(/(\w)�\??(\w)/g, '$1’$2')
    .replace(/�\??/g, '')
    .replace(/’(?=\s|$)/g, '’');
}

/** The site style uses a hyphen where the legacy posts use an em dash. */
function dedash(text) {
  return text.replace(/—/g, '-');
}

/** Plain-text excerpt, used for meta description and the blog index. */
function toText(html, max = 200) {
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&#8217;/g, '’')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= max) return text;
  return `${text.slice(0, text.lastIndexOf(' ', max))}…`;
}

/**
 * Featured images, resolved to local paths by
 * .migration/localise-featured-images.mjs. The API only hands back a
 * featured_media id, never a URL, so the mapping is read from the manifest
 * rather than refetched - this script must stay runnable offline.
 */
const FEATURED = JSON.parse(
  await readFile(path.join(root, '.migration', 'featured-image-manifest.json'), 'utf8'),
);

const posts = raw
  .map((p) => {
    const body = dedash(repairMojibake(clean(p.content?.rendered)));
    const excerptRaw = dedash(toText(clean(p.excerpt?.rendered)) || toText(body));
    const art = FEATURED[p.slug] ?? null;
    return {
      slug: p.slug,
      title: dedash(repairMojibake(p.title?.rendered?.trim() ?? '')),
      date: p.date,
      modified: p.modified,
      /** Legacy posts were published at the root: /{slug}/ */
      path: `/${p.slug}/`,
      excerpt: excerptRaw,
      body,
      words: toText(body, 1e9).split(/\s+/).filter(Boolean).length,
      categories: p.categories ?? [],
      /** Local path to the card art, or null. See Post.image in src/data/posts.ts. */
      image: art?.path ?? null,
      imageAlt: art?.alt ?? '',
    };
  })
  .sort((a, b) => (a.date < b.date ? 1 : -1));

await writeFile(OUT, JSON.stringify(posts, null, 2), 'utf8');

const totalWords = posts.reduce((n, p) => n + p.words, 0);
console.log(`Wrote ${posts.length} posts -> ${path.relative(root, OUT)}`);
console.log(`  total ${totalWords.toLocaleString('en-AU')} words, median ${posts[Math.floor(posts.length / 2)]?.words} words/post`);
console.log(
  `  ${posts.filter((p) => p.image).length} posts have a featured image, ` +
    `${posts.filter((p) => !p.image && /<img[\s>]/i.test(p.body)).length} fall back to a body image, ` +
    `${posts.filter((p) => !p.image && !/<img[\s>]/i.test(p.body)).length} have none`,
);

const residual = posts.filter((p) => /dslc-|sharedaddy|jp-relatedposts|<style|<script/i.test(p.body));
console.log(`  ${residual.length} posts still contain theme markup`);
for (const p of residual.slice(0, 5)) console.log(`    ${p.slug}`);
