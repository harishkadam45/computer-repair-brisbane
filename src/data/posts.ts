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
