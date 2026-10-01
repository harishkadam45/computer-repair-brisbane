/**
 * Search index at /search-index.json.
 *
 * Served as a standalone file rather than inlined in every page: the index is
 * ~115 KB, and inlining it into all 2,800+ pages duplicated it into 315 MB of
 * HTML. Fetching it lazily on first interaction keeps it out of the critical
 * path for the ~98% of visitors who never search.
 */
import type { APIRoute } from 'astro';
import { searchIndexJson } from '../lib/search';

export const GET: APIRoute = () =>
  new Response(searchIndexJson, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });