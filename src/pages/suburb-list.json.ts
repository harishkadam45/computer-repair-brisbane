/**
 * Suburb list at /suburb-list.json.
 *
 * Backs the suburb combobox in the quote modal. Separate from
 * /search-index.json on purpose: that one is ~115 KB because it carries blog
 * posts and service pages, and a visitor typing their suburb needs none of
 * that. This is just name, postcode and region for all 666 suburbs, which
 * lands around 30 KB, and it is only fetched once the field is focused.
 *
 * Deliberately not inlined into the modal markup. The modal ships on all
 * 2,800+ pages, and a 30 KB array repeated across every one of them is the
 * same mistake the search index already got right once.
 */
import type { APIRoute } from 'astro';
import { suburbs, regionOrder } from '../lib/suburbs';

/** Postcodes worth showing, and regions worth filtering by. */
const rows = [...suburbs]
  .sort((a, b) => a.name.localeCompare(b.name, 'en-AU'))
  .map((s) => ({
    n: s.name,
    // A null postcode is a data gap, not a real postcode. Sending null keeps
    // the client from rendering "undefined" next to a name.
    p: s.postcode ?? '',
    r: s.region,
  }));

const body = JSON.stringify({
  regions: regionOrder,
  suburbs: rows,
});

export const GET: APIRoute = () =>
  new Response(body, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // Suburb data changes rarely, so this can sit in a CDN for a day.
      'Cache-Control': 'public, max-age=86400',
    },
  });