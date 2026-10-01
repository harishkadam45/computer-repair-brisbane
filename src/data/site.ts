/**
 * Single source of truth for business facts.
 *
 * Every phone number, price, opening hour and schema node on the site reads
 * from here, so a price change or a new service area is a one-line edit rather
 * than a find-and-replace across 1,800 pages.
 */

export const site = {
  /** Used in titles, schema and the footer. */
  name: 'Fix My Home Computer',
  /** The legal/registered brand behind the trading name. */
  legalName: 'Zoo Computer Repairs',
  tagline: 'Computer Repairs Brisbane',
  description:
    'One-on-one computer repairs across Brisbane, Logan and Ipswich. A Microsoft certified ex-IBM help desk technician comes to your home, 7 days a week, for a flat $150. No call-out fee, no weekend surcharge.',
  /** Production origin. Override with PUBLIC_SITE_URL at build time. */
  url: (import.meta.env.PUBLIC_SITE_URL ?? 'https://www.fixmyhomecomputer.com.au').replace(/\/$/, ''),
  locale: 'en_AU',
  lang: 'en-AU',
  /** Site name used for Open Graph / Twitter. */
  ogSiteName: 'Fix My Home Computer Repairs',

  phone: {
    /** Human readable, e.g. (07) 3155 2051 */
    display: '(07) 3155 2051',
    /** E.164, used for click-to-call and schema. */
    e164: '+61731552051',
    href: 'tel:+61731552051',
  },

  email: {
    display: 'hello@fixmyhomecomputer.com.au',
    href: 'mailto:hello@fixmyhomecomputer.com.au',
  },

  /**
   * The technician. This is a one-person business and the site leans on that,
   * so the detail is part of the conversion argument.
   */
  technician: {
    name: 'Robert',
    credential: 'Microsoft Certified',
    background:
      'Spent years on the help desk of the largest IT company in the world, fixing other people’s problems over the phone, before deciding it was better to fix them in person.',
  },

  /**
   * Published pricing. The flat rate is the whole pitch - the legacy site
   * compared it against Geek Squad and Gizmo, so those numbers are kept.
   */
  pricing: {
    /** Flat onsite rate per house for the standard job list. */
    flatRate: 150,
    /** Rate is GST-inclusive for households. */
    gstNote: 'Includes GST for home users. Excluding GST for businesses.',
    callOutFee: 0,
    weekendSurcharge: 0,
    /** Repairs are billed in these blocks after the first hour. */
    billingIncrement: '15 minutes',
    /** Parts are charged at cost with no mark-up. */
    partsMarkup: false,
  },

  /**
   * Service areas, in the order used by the /service-area/ index. These are
   * the three areas the business actually advertises; the legacy site also
   * built pages out to the Sunshine Coast and Gold Coast, which are kept as
   * individual suburb pages but are not headlined.
   */
  serviceAreas: ['Brisbane', 'Logan', 'Ipswich'],

  /**
   * Opening hours. The legacy schema claimed 09:00–17:00 seven days a week,
   * which contradicted the on-page copy about early/late availability. These
   * values are the honest reading of "flexible around you" and are easy to
   * correct - see the note in README about confirming real hours.
   */
  hours: {
    timezone: 'Australia/Brisbane',
    note: 'Bookings available 7 days a week, including public holidays.',
    /** Broad window; tight availability is arranged by phone. */
    opens: '07:00',
    closes: '19:00',
    days: [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ],
  },

  /**
   * Street address.
   *
   * TODO(client): fill this in. LocalBusiness schema and Google Business
   * Profile both work far better with a real NAP address, and NAP consistency
   * across the site is a ranking factor. Left empty rather than invented -
   * while it is empty the schema emits the address as absent and the site
   * still works, but the `areaServed` coverage is doing all the local work.
   */
  address: {
    street: '',
    locality: 'Brisbane',
    region: 'QLD',
    postcode: '',
    country: 'AU',
  },

  /**
   * Business account ids for the sameReview / aggregateRating nodes. Empty
   * until the profile is created; schema is omitted entirely while blank so
   * we never emit a fabricated rating.
   */
  aggregateRating: {
    ratingValue: '',
    reviewCount: '',
  },

  /** Third-party review profile, linked in the footer and on /testimonials. */
  reviews: {
    url: 'https://www.wordofmouth.com.au/reviews/zoo-computer-repairs',
    label: 'Read our reviews on Word of Mouth',
    /** Source label used in schema.aggregateRating and Review nodes. */
    publisher: 'Word of Mouth',
  },

  /** The hosted quote form. Opened in a new tab; the site has no backend. */
  quoteForm: {
    url: 'https://my.forms.app/form/63abe8b4a94b75117d3d47ad',
    /** The legacy self-hosted form, kept as a fallback during rollout. */
    legacyUrl: 'http://quote.zoorepairs.com.au/',
  },

  social: {
    facebook: 'https://www.facebook.com/fixmyhomecomputer.com.au',
    twitter: 'https://twitter.com/FixMyHomeCmputer',
  },

  /** Absolute-path defaults, used where a page has no better og:image. */
  defaultOgImage: '/og/default.png',
  logo: '/logo.svg',
} as const;

/** schema.org openingHours string, e.g. "Mo-Su 07:00-19:00". */
export function openingHoursSpec(): string {
  const { days, opens, closes } = site.hours;
  const map: Record<string, string> = {
    Monday: 'Mo',
    Tuesday: 'Tu',
    Wednesday: 'We',
    Thursday: 'Th',
    Friday: 'Fr',
    Saturday: 'Sa',
    Sunday: 'Su',
  };
  const codes = days.map((d) => map[d]).filter(Boolean);
  if (codes.length === 7) return `Mo-Su ${opens}-${closes}`;
  return `${codes.join(',')} ${opens}-${closes}`;
}

export const absolute = (path: string): string =>
  path.startsWith('http') ? path : `${site.url}${path.startsWith('/') ? path : `/${path}`}`;
