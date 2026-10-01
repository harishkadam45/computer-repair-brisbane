/**
 * RSS 2.0 feed at /rss.xml.
 *
 * Every page in the site advertises this in <head> via
 * <link rel="alternate" type="application/rss+xml">, so it has to exist - a
 * declared feed that 404s is worse than none.
 *
 * The 110 migrated posts are the reason this is worth having at all: they are
 * the only content on the site with a publish date, which is exactly what a feed
 * is for.
 */
import type { APIRoute } from 'astro';
import { site } from '../data/site';
import { posts } from '../data/posts';

/** RFC 822 date, which is what RSS 2.0 requires. */
const rfc822 = (iso: string): string =>
  new Date(iso).toUTCString();

/** XML text escaping. Titles and excerpts contain ampersands and quotes. */
const esc = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

export const GET: APIRoute = () => {
  const items = posts
    .map(
      (p) => `    <item>
      <title>${esc(p.title)}</title>
      <link>${site.url}${p.path}</link>
      <guid isPermaLink="true">${site.url}${p.path}</guid>
      <pubDate>${rfc822(p.date)}</pubDate>
      <description>${esc(p.excerpt)}</description>
    </item>`,
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(site.name)}</title>
    <link>${site.url}/blog/</link>
    <description>${esc(site.description)}</description>
    <language>en-AU</language>
    <lastBuildDate>${rfc822(posts[0]?.date ?? new Date().toISOString())}</lastBuildDate>
    <atom:link href="${site.url}/rss.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
