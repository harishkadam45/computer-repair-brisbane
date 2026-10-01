/**
 * robots.txt, generated rather than a static file in public/.
 *
 * The Sitemap: line has to contain the deployed origin, which is only known at
 * build time. A hand-written public/robots.txt would either hardcode the
 * production domain (breaking staging and any future domain change) or ship
 * without a sitemap reference at all.
 *
 * Served with the correct text/plain content type by Astro's Response.
 */
import type { APIRoute } from 'astro';
import { site } from '../data/site';

export const GET: APIRoute = () => {
  const body = [
    'User-agent: *',
    'Allow: /',
    '',
    '# Nothing here is private. The 404 and any redirect stubs are the only',
    '# pages excluded, and they are excluded from the sitemap rather than here,',
    '# so that a genuinely useful 404 still gets crawled if it is linked.',
    '',
    '# Explicitly welcome the major SEO crawlers so they are not rate-limited',
    '# on a 2,700-page static site where crawling is cheap.',
    'User-agent: Googlebot',
    'Allow: /',
    '',
    'User-agent: Bingbot',
    'Allow: /',
    '',
    `Sitemap: ${site.url}/sitemap-index.xml`,
    '',
  ].join('\n');

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
