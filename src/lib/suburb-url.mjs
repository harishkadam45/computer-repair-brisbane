/**
 * Canonical suburb URL construction.
 *
 * This is deliberately a plain .mjs module with no Astro imports, because two
 * very different places need to agree on these URLs exactly:
 *
 *   1. src/pages/[...suburb].astro   - getStaticPaths() is hoisted into its
 *      own build chunk and cannot see the component's own frontmatter, so the
 *      function has to live in a module.
 *   2. scripts/build-redirects.mjs   - runs under bare Node, outside the
 *      bundler, and cannot import TypeScript.
 *
 * If these two ever disagree you get pages whose canonical tag points at a
 * 404, which is worse than a broken link because it looks fine. Keeping one
 * implementation is the fix.
 *
 * @typedef {import('../data/services').ServiceFamily} ServiceFamily
 * @typedef {import('./suburbs').Suburb} Suburb
 */

/**
 * The canonical path for a (family, suburb) pair, always with a trailing slash
 * to match Astro's `trailingSlash: 'always'`.
 *
 * Some legacy families embedded the postcode in the slug (`pc-repairs-aspley-
 * qld-4066`) and some did not (`computer-repairs-aspley`). That difference is
 * carried on the family as `suburbHasPostcode` rather than being guessed here,
 * so the rule stays visible in services.ts next to the content that owns it.
 *
 * @param {ServiceFamily} family
 * @param {Suburb} suburb
 * @returns {string}
 */
export function canonicalSlug(family, suburb) {
  const base = `${family.suburbPrefix}-${suburb.key}`;
  return family.suburbHasPostcode && suburb.postcode ? `${base}-qld-${suburb.postcode}` : base;
}

/**
 * The public URL for a (family, suburb) pair, e.g. `/pc-repairs-aspley-qld-4066/`.
 *
 * @param {ServiceFamily} family
 * @param {Suburb} suburb
 * @returns {string}
 */
export function suburbUrl(family, suburb) {
  return `/${canonicalSlug(family, suburb)}/`;
}

/**
 * URL-safe slug for a region name, e.g. "Ipswich & West Moreton" ->
 * "ipswich-west-moreton".
 *
 * Ampersands are dropped rather than transliterated to "and", so the region
 * pages sit at readable URLs. Note the legacy site had no region pages at all,
 * so unlike the suburb slugs these URLs are new and there is nothing to
 * preserve - free to pick the clean form.
 *
 * @param {string} region
 * @returns {string}
 */
export function regionSlug(region) {
  return region
    .toLowerCase()
    .replace(/&/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * The URL a (family, suburb) page is actually published at, e.g.
 * `/pc-repairs-aspley-qld-4066/`.
 *
 * This is the one function that answers "where does this page live", and every
 * caller must use it: getStaticPaths() (which decides the emitted file), the
 * layout's canonical/breadcrumb/JSON-LD, and every internal link pointing at
 * the page.
 *
 * It is the whole reason the previous canonical tags were wrong. The route
 * emitted each page at its oldest legacy slug while the layout independently
 * fell back to suburbUrl(), so a page served from `/pc-repairs-aspley-qld-
 * 4066/` advertised a canonical of `/pc-repairs-aspley/`. Google would have
 * been told to ignore the URL that already had its ranking, on every suburb
 * that had a legacy page. One function, called by both sides, cannot drift.
 *
 * @param {ServiceFamily} family
 * @param {Suburb} suburb
 * @returns {string}
 */
export function liveSuburbUrl(family, suburb) {
  return `/${legacySlugsFor(family, suburb)[0] ?? canonicalSlug(family, suburb)}/`;
}

/**
 * Every legacy slug the WordPress site published for this (family, suburb),
 * best candidate to keep live first.
 *
 * Two wrinkles the legacy site left behind:
 *
 *   1. Singly-spelled prefixes. Some pages were published as
 *      `/computer-repair-bongaree/` and `/laptop-repair-mango-hill/` rather
 *      than the plural. Filtering on the exact family prefix threw these away
 *      entirely, so those 27 pages fell back to the canonical slug and left the
 *      URL Google had actually indexed as a 404. So the stem is matched too.
 *
 *   2. WordPress duplicate suffixes (`...-2`, `...-3`) and the singular/plural
 *      pair, where either could be the oldest. Ordered explicitly rather than
 *      by raw string sort: plural before singular (615 of 640 published pages
 *      are plural, and it is the form canonicalSlug() generates, so keeping it
 *      keeps the sitemap and internal links consistent), then the base slug
 *      before its `-2` / `-3` duplicates.
 *
 * @param {ServiceFamily} family
 * @param {Suburb} suburb
 * @returns {string[]}
 */
export function legacySlugsFor(family, suburb) {
  const stem = family.suburbPrefix.replace(/s$/, '');

  /** [duplicate number, singular?] - lower sorts first. */
  const rank = (slug) => {
    const dup = slug.match(/-(\d+)$/);
    const singular = !slug.startsWith(`${family.suburbPrefix}-`) ? 1 : 0;
    return [dup ? Number(dup[1]) : 1, singular];
  };

  return (suburb.oldSlugs ?? [])
    .filter((slug) => slug.startsWith(`${family.suburbPrefix}-`) || slug.startsWith(`${stem}-`))
    .sort((a, b) => {
      const [aDup, aSing] = rank(a);
      const [bDup, bSing] = rank(b);
      return aDup - bDup || aSing - bSing || a.localeCompare(b);
    });
}
