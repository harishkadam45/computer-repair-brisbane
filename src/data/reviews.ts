/**
 * Customer reviews for the review cards above the footer on the homepage.
 *
 * EMPTY ON PURPOSE. Do not type a review into this file from memory, and do not
 * let a generator write one. A testimonial has to be a real customer's words,
 * copied from the platform it was published on, with the date they left it.
 *
 * Two reasons, and the first is not a matter of taste:
 *
 * 1. Under the Australian Consumer Law it is unlawful to publish a review that
 *    is not genuine, and publishing one as though a customer wrote it is a
 *    false or misleading representation. The penalty is real. This is the same
 *    reason /testimonials/ refuses to paraphrase reviews onto the page and
 *    `site.aggregateRating` is left blank - see the note there.
 * 2. A review nobody can trace back to a profile is worth nothing to the person
 *    reading it, and worse than nothing to the business if it is ever checked.
 *
 * HOW TO FILL IT IN: open site.reviews.url (the Word of Mouth profile), copy
 * six reviews across verbatim, and record the date shown on the platform. Keep
 * the wording exactly as published - trimmed or tidied quotes stop being the
 * customer's words. Order them newest first, which is the order the section
 * renders them in.
 *
 * Until this array has entries the review section is skipped entirely, so the
 * homepage never shows a heading with nothing under it. Add six and the grid
 * appears on its own.
 *
 * Once it has entries, `site.aggregateRating` can be filled in to match - but
 * only with the real rating value and count from the profile. A made-up number
 * in the schema is worse than no schema at all.
 */
export interface Review {
  /**
   * Reviewer's name as the platform shows it. If a reviewer chose to show only
   * a first name or an initial, that is the name to use.
   */
  name: string;
  /** The review text, verbatim. Ampersands and apostrophes are fine as-is. */
  quote: string;
  /** ISO 8601 date the review was left, e.g. '2025-03-14'. */
  date: string;
  /** 1-5, exactly as the platform recorded it. */
  rating: number;
  /** Suburb or "business customer", shown next to the date. Optional. */
  context?: string;
}

export const reviews: Review[] = [];

/** `14 March 2025`, in Brisbane time, matching the blog bylines. */
export function formatReviewDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Australia/Brisbane',
  });
}