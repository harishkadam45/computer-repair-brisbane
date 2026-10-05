/**
 * Blog post index.
 *
 * The records in posts.json are produced by scripts/build-posts.mjs from the
 * WordPress REST API. They are intentionally thin: slug, title, date, excerpt
 * and cleaned body HTML. Nothing here is fetched at build time, so a build
 * never depends on the legacy site being up.
 */
import postsData from './posts.json';

export interface Post {
  slug: string;
  title: string;
  /** ISO 8601, as published. */
  date: string;
  modified: string;
  /** Canonical path. Legacy posts live at the root: /{slug}/ */
  path: string;
  excerpt: string;
  /** Sanitised HTML. Scripts, styles and iframes are stripped at build time. */
  body: string;
  words: number;
  categories: number[];
  /**
   * Local path to the post's featured image, or null.
   *
   * 99 of the 110 posts have one. The WordPress API hands back a featured_media
   * id rather than a URL, so these were resolved by .migration/localise-featured-images.mjs
   * and written into posts.json - the build never talks to the legacy site.
   */
  image: string | null;
  /** Alt text from the WordPress media record. Often empty; the cards treat it as decorative. */
  imageAlt: string;
}

/** Newest first, which is the order build-posts.mjs already wrote them in. */
export const posts = postsData as Post[];

const bySlug = new Map(posts.map((p) => [p.slug, p]));

export function getPost(slug: string): Post | undefined {
  return bySlug.get(slug);
}

export function postBySlug(slug: string): Post | undefined {
  return bySlug.get(slug);
}

/** `12 March 2024`, for bylines and the archive. */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Australia/Brisbane',
  });
}

/** `2024-03-12T00:00:00.000Z`, for <time datetime>. */
export function isoDate(iso: string): string {
  return new Date(iso).toISOString();
}

/**
 * The post's card art, as a local path, or null if it genuinely has no image.
 *
 * Preference order:
 *   1. the WordPress featured image, which is what the legacy blog used in its
 *      own listings and is the right thumbnail for a card;
 *   2. the first image in the body, for the 8 posts with no featured media that
 *      still have an inline picture;
 *   3. null, and the card renders a branded tile. Only 3 of 110 posts get here.
 *
 * Only /images/blog/ paths are accepted. Every image was hot-linked from the
 * legacy domain until the migration in .migration/, and a card must never be the
 * thing that puts that domain back on the critical path.
 */
export function postImage(post: Post): { src: string; alt: string } | null {
  if (post.image) return { src: post.image, alt: post.imageAlt || '' };

  const m = /<img[^>]*\ssrc="(\/images\/blog\/[^"]+)"[^>]*>/i.exec(post.body ?? '');
  if (!m) return null;
  const alt = /\salt="([^"]*)"/i.exec(m[0]);
  return { src: m[1], alt: alt ? alt[1] : '' };
}
