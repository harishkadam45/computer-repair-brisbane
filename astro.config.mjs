// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

/**
 * The production origin. Astro uses this to build absolute canonical URLs and
 * every sitemap entry, so it must be right at build time.
 *
 * Defaults to the real production domain rather than throwing, because a
 * hard failure here would block `npm run dev` and `npm run build` for anyone
 * who has not read the README — and a broken local build gets worked around
 * by editing the config, which is worse.
 *
 * The failure mode is deliberately the safe direction: an unset variable
 * yields *production* canonicals (correct for the real deploy, harmless on a
 * staging box) rather than localhost canonicals in production. A staging
 * deploy that needs different canonicals sets PUBLIC_SITE_URL in its own
 * environment.
 *
 * @type {string}
 */
const site = (process.env.PUBLIC_SITE_URL ?? 'https://www.fixmyhomecomputer.com.au').replace(
  /\/$/,
  '',
);

if (!/^https?:\/\/[^\s/]+/.test(site)) {
  throw new Error(
    `PUBLIC_SITE_URL is not a valid absolute URL: "${site}"\n` +
      'It must look like https://www.example.com.au with no path or trailing slash.',
  );
}

export default defineConfig({
  site,

  /**
   * The legacy WordPress site served directory-style URLs with a trailing
   * slash. Matching that exactly means `/pc-repairs-aspley-qld-4066/` resolves
   * without a redirect, which is the whole reason the route file is shaped the
   * way it is. Changing this to 'never' would silently 301 every one of the
   * ~2,660 programmatic pages.
   */
  trailingSlash: 'always',

  /**
   * The sitemap is generated from the build output, so it can never drift out
   * of sync with the pages that actually exist.
   *
   * The ~2,660 programmatic suburb pages are included on purpose. It is
   * tempting to exclude them as thin near-duplicates, but they are already
   * indexed from the legacy site and a sitemap is the cheapest way for Google
   * to re-discover them after a full replatform. The defence against thin
   * content here is the per-region copy, not hiding the URLs — and they carry
   * real self-referencing internal links from the service-area index and from
   * their four sibling families.
   */
  integrations: [sitemap()],

  /** Ship the small critical CSS inline; the rest becomes a cached file. */
  build: {
    inlineStylesheets: 'auto',
  },

  /** Strips the whitespace Astro would otherwise leave in the 2,660 pages. */
  compressHTML: true,

  /**
   * Quiets Astro's per-page build log. At 2,700 pages it prints a line per
   * page, which buries the things worth reading.
   *
   * Only Astro's own logger is silenced: the [seo] title-length checks and the
   * [related-services] unknown-slug warnings call console.warn directly and
   * still print. So the build stays quiet on success and stays noisy on the
   * problems that actually need a human.
   */
  logLevel: 'warn',

  vite: {
    plugins: [tailwindcss()],
  },
});
