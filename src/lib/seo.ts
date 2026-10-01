/**
 * SEO helpers: title/meta composition, and the small text helpers shared by
 * the service and suburb templates.
 */
import { site } from '../data/site';

/** Clamp a meta description to Google's ~160 character display budget. */
export function clampDescription(text: string, max = 158): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  // Trim on a word boundary rather than mid-word.
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 60 ? cut.slice(0, lastSpace) : cut).replace(/[,;:.\s]+$/, '')}…`;
}

/** Warn at build time if a title is long enough to be truncated in the SERP. */
export function checkTitleLength(title: string, path: string): void {
  if (title.length > 62) {
    console.warn(`[seo] title ${title.length} chars on ${path} - likely truncated: "${title}"`);
  }
}

export function checkDescriptionLength(desc: string, path: string): void {
  if (desc.length > 165) {
    console.warn(`[seo] description ${desc.length} chars on ${path} - likely truncated`);
  }
}

/** `Computer Repairs Aspley | Fix My Home Computer` */
export function pageTitle(title: string, opts: { suffix?: string } = {}): string {
  return opts.suffix ? `${title} | ${opts.suffix}` : `${title} | ${site.name}`;
}

/**
 * Substitute the placeholders used in service copy. Kept deliberately simple -
 * no template engine, no eval, so a suburb name from data can never become
 * executable content.
 */
export function fill(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (match, key: string) => vars[key] ?? match);
}

/**
 * Very small inline formatter for service body copy: **bold**, *italic* and
 * `code`. It escapes first, so content coming from the CMS cannot inject markup.
 */
export function formatInline(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,;:]|$)/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

/** Strip markup for meta descriptions and OG tags. */
export function plainText(text: string): string {
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
