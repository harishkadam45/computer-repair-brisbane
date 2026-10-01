# Fix My Home Computer

Static rebuild of the Fix My Home Computer site (Brisbane), replacing a WordPress
install. Astro + Tailwind v4, no runtime server, no database.

**2,817 pages**, of which 2,664 are a per-suburb × per-service matrix.

---

## Commands

```bash
npm run dev        # dev server (background)
npm run build      # build to dist/
npm run release    # build + generate redirects + verify  <- use this to ship
npm run preview    # serve the built site
```

Supporting scripts, run individually:

| Command | What it does |
| --- | --- |
| `npm run verify` | Checks every canonical matches its emitted path, every JSON-LD block parses, every internal link resolves. Exits non-zero on failure. |
| `npm run redirects` | Regenerates `redirects.json`, `dist/_redirects`, `redirects.nginx.conf` from the legacy URL list. **Run after `build`** — it writes into `dist/`. |
| `npm run posts:fetch` | Pulls full post content from the legacy WordPress REST API into `.migration/`. |
| `npm run posts:build` | Regenerates `src/data/posts.json` from that content. |
| `npm run suburbs` | Rebuilds `src/data/suburbs.json` from the legacy URL list. |
| `npm run icons` | Regenerates favicon/OG PNGs from `public/logo.svg` via Sharp. |

---

## The one rule that matters: legacy URLs

The legacy site published services and blog posts **at the domain root**, not
nested:

```
/data-repairs-style/          -> /data-recovery/
/computer-repair-bongaree/    -> singular prefix, also legacy
/pc-repairs-aspley-qld-4066/  -> some families embed the postcode
/why-does-my-pc-crash/        -> blog posts, also at root
```

Of 1,806 legacy URLs, only two live under `/services/`. Nesting anything would
have 301'd a few hundred already-indexed pages and thrown away the rankings.

So `src/lib/suburb-url.mjs` owns every URL decision, and **every caller uses it**:

- `liveSuburbUrl(family, suburb)` — the single source of truth. Oldest legacy
  slug if the page had one, otherwise the canonical form.
- `getStaticPaths()` uses it to decide where to write the file.
- `SuburbPageLayout` uses it for the canonical tag, breadcrumb and JSON-LD.
- Every internal link uses it.

This is not theoretical tidiness. Two bugs of exactly this shape shipped during
the build and both were invisible to `astro build`:

1. The route emitted each suburb page at its legacy slug while the layout
   independently fell back to the canonical slug — so every indexed suburb page
   advertised a canonical pointing at a URL that did not exist. That tells Google
   to ignore the URL that already had its ranking.
2. `FamilyHubLayout` hand-built `/{prefix}-{key}/` inline and linked 5 pages that
   were never emitted.

`npm run verify` exists because of these. It is a 2-minute check that would have
caught both, and it is part of `npm run release`.

### Singular prefixes

Some legacy pages were published as `/computer-repair-bongaree/` and
`/laptop-repair-mango-hill/`. `legacySlugsFor()` matches the family stem as well
as the full prefix, and prefers the plural where both exist (615 of 640 published
pages are plural, and it is the form `canonicalSlug()` generates). 27 pages are
emitted at a singular URL because no plural was ever published for them.

---

## Route map

| Path | Source | Count |
| --- | --- | --- |
| `/[...suburb]` | `src/pages/[...suburb].astro` | 2,664 |
| `/[slug]` | `src/pages/[slug].astro` | 129 (19 services + 110 posts) |
| `/service-area/[region]` | `src/pages/service-area/[region]/index.astro` | 11 |
| `/computer-repairs/` etc. | `src/layouts/FamilyHubLayout.astro` | 4 |
| core | `index`, `about`, `contact`, `pricing`, `quote`, `testimonials`, `services`, `blog` | 8 |
| endpoints | `rss.xml.ts`, `robots.txt.ts` | 2 |

Astro allows one dynamic segment per directory, which is why services and posts
share `[slug].astro` and dispatch on `kind`. Priority is
`static > [slug] > [...suburb]`, so the core routes and the suburb matrix never
collide.

---

## Data and content

- `src/data/services.ts` — 4 service families + 19 standalone services, all copy
  and FAQs. Source of truth for service content.
- `src/data/suburbs.json` — 666 suburbs: postcode, region, coordinates, and
  `oldSlugs` from the legacy crawl. **Generated**; edit `scripts/build-suburbs.mjs`.
- `src/data/posts.json` — 110 migrated blog posts, ~98,000 words. **Generated**;
  edit `scripts/build-posts.mjs`.
- `src/data/site.ts` — business name, phone, pricing, hours, contacts.

### Migrated post HTML

Post bodies are rendered with `set:html`, so `scripts/build-posts.mjs` strips
`<script>`, `<style>`, `<iframe>`, inline `on*=` handlers, `javascript:` URLs and
Divi theme wrappers at build time. **If you edit that script, keep the stripping.**

---

## Deliberate omissions

Three fields in `src/data/site.ts` are intentionally blank and must not be filled
with guesses:

```ts
address.street          // no confirmed street address
aggregateRating.*       // no verified rating or review count
```

`schema.aggregateRating` and `schema.reviewSnippet()` emit nothing while these are
empty, and `/testimonials/` links to the real Word of Mouth profile instead of
quoting reviews on-site. Inventing a rating or a review quote is both a trust
problem and a legal problem (Australian Consumer Law).

Also unresolved, and needing the site owner:

- Six suburb postcodes were hand-supplied and need checking: `buddine`,
  `harper-creek`, `noosa-national-park`, `sinnamon-park-west`,
  `southern-moreton-bay-islands`, `teewah`.
- Opening hours are provisional pending confirmation.
- `site.serviceAreas` lists Brisbane, Logan and Ipswich, but some copy also
  mentions the Sunshine Coast and northern Gold Coast. Confirm actual coverage.
- `public/logo.svg` is a **placeholder** geometric mark. Replace it, then run
  `npm run icons`.

---

## Configuration

`PUBLIC_SITE_URL` sets the origin used for canonicals, `og:url` and the sitemap.
It defaults to production, so a local build is safe but a staging deploy that
needs different canonicals must set it.

```bash
PUBLIC_SITE_URL=https://staging.example.com.au npm run build
```

`trailingSlash` is `'always'` because the legacy site served directory-style URLs.
Changing it would 301 all 2,664 programmatic pages.

The sitemap deliberately **includes** the programmatic suburb pages. They are thin
but already indexed, and a sitemap is the cheapest way to help Google re-discover
them after a replatform. The defence against thin content is the per-region copy,
not hiding the URLs.

---

## Redirects

`npm run redirects` writes three formats:

- `dist/_redirects` — Netlify / Cloudflare Pages
- `redirects.nginx.conf` — nginx (VPS, Railway static container)
- `redirects.json` — neutral, for anything else

Currently 23 redirects: 14 duplicate suburb slugs and 9 hand-mapped legacy URLs.

Six legacy URLs are deliberately **not** redirected and will 404 — they belong to
an unrelated camp/activities site that once shared the domain
(`/activities/`, `/camp-session-one/`, `/find-a-camp/`, `/gallery/`, `/partners/`,
`/projects-2/`). The script prints them on every run so they stay visible rather
than being silently dropped. If the owner wants them kept, add them to `MANUAL`
in the script.

---

## Deployment

Any static host. Upload `dist/`. Point `_redirects` (or the nginx snippet) at the
generated file. Set `PUBLIC_SITE_URL` in the build environment.

After going live: submit `sitemap-index.xml` in Search Console, then watch
Coverage and "Manual Actions" for a few weeks. The redirect map is the part most
worth re-checking, because a 301 pointing at a 404 loses the link equity it was
meant to preserve — `npm run verify` catches the internal cases, not server-level
misconfiguration.
