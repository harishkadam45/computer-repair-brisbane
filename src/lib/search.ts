/**
 * Tiny static search index.
 *
 * Users want to search for a specific service - viruses, data recovery, slow
 * PC - from the navbar. We have no backend, so we ship a small prebuilt index
 * (titles, short summaries and paths) and match in the browser. It is emitted
 * once as /search-index.json and fetched lazily, never inlined into 2,800+ pages.
 */
import { services, families } from '../data/services';
import { posts } from '../data/posts';
import { suburbs } from './suburbs';
import { liveSuburbUrl } from './suburb-url.mjs';

/** Suburb pages are all built off the computer-repairs family. */
const computerRepairs = families.find((f) => f.slug === 'computer-repairs')!;

/** Summaries are truncated so 110 excerpts cannot dominate the index. */
const MAX_SUMMARY = 180;

const normalize = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s\/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Index entries are inserted into the results list via innerHTML, so any HTML
 * coming from post content has to be stripped before it leaves the build.
 */
const plain = (s: string): string =>
  s
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const summarize = (s: string): string => {
  const text = plain(s);
  return text.length > MAX_SUMMARY ? `${text.slice(0, MAX_SUMMARY).trimEnd()}…` : text;
};

type HitType = 'service' | 'family' | 'post' | 'suburb';

type Hit = {
  /** Title. */
  t: string;
  /** Path. */
  u: string;
  /** Pre-normalized haystack for keyword matching. */
  k: string;
  /** Result type, used for labelling and ranking. */
  ty: HitType;
  /** Short plain-text summary. Omitted for suburbs to keep the index small. */
  d?: string;
};

function build(): Hit[] {
  const hits: Hit[] = [];

  for (const f of families) {
    hits.push({
      t: f.title,
      u: `/${f.slug}/`,
      k: normalize(`${f.title} ${f.noun} ${f.summary}`),
      ty: 'family',
      d: summarize(f.summary),
    });
  }

  for (const s of services) {
    // The suburb matrix page is not a distinct service.
    if (s.slug === 'pc-repairs-brisbane') continue;
    hits.push({
      t: s.title,
      u: `/${s.slug}/`,
      k: normalize(`${s.title} ${s.shortTitle} ${s.summary}`),
      ty: 'service',
      d: summarize(s.summary),
    });
  }

  for (const p of posts) {
    hits.push({
      t: p.title,
      u: p.path,
      k: normalize(`${p.title} ${p.excerpt}`),
      ty: 'post',
      d: summarize(p.excerpt),
    });
  }

  // Every suburb gets an entry so "can you come to Brendale" resolves. Only
  // name, region, postcode and path are kept - no page bodies, no summary.
  for (const sub of suburbs) {
    hits.push({
      t: sub.name,
      u: liveSuburbUrl(computerRepairs, sub),
      k: normalize(`${sub.name} ${sub.region} ${sub.postcode ?? ''}`),
      ty: 'suburb',
    });
  }

  return hits;
}

/** Serialized once at build time and served by /search-index.json. */
export const searchIndexJson = JSON.stringify(build());