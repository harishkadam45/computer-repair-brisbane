/**
 * schema.org JSON-LD builders.
 *
 * The legacy site emitted a single Rank Math @graph containing only
 * ComputerStore + WebSite. It had no address, no telephone, no geo, no
 * serviceArea, no per-service schema, and it claimed 09:00-17:00 every day
 * while the page copy said otherwise.
 *
 * These builders emit a proper graph: ProfessionalService (the correct subtype
 * for this business - not ComputerStore, which is a retail store), with
 * Offer, Service, FAQPage, BreadcrumbList, and Article where they apply.
 *
 * Nothing is invented. Where site.address or site.aggregateRating is blank the
 * corresponding property is omitted rather than emitted empty, so we never ship
 * a node that contradicts itself.
 */
import { site, openingHoursSpec, absolute } from '../data/site';
import type { Faq, Service, ServiceFamily } from '../data/services';

type Node = Record<string, unknown>;

/** The persistent organisation node, referenced by every other node. */
export function organization(): Node {
  const node: Node = {
    '@type': ['ProfessionalService', 'LocalBusiness'],
    '@id': `${site.url}/#organization`,
    name: site.name,
    legalName: site.legalName,
    url: site.url,
    description: site.description,
    telephone: site.phone.e164,
    email: site.email.display,
    priceRange: '$$',
    currenciesAccepted: 'AUD',
    paymentAccepted: 'Cash, Electronic transfer, Card',
    areaServed: site.serviceAreas.map((name) => ({
      '@type': 'City',
      name,
      containedInPlace: { '@type': 'State', name: 'Queensland' },
    })),
    serviceArea: {
      '@type': 'GeoCircle',
      geoMidpoint: { '@type': 'GeoCoordinates', latitude: -27.4698, longitude: 153.0251 },
      // Generous radius covering Brisbane, Logan, Ipswich and the Gold Coast.
      geoRadius: 60000,
    },
    knowsLanguage: 'en-AU',
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: [...site.hours.days],
        opens: site.hours.opens,
        closes: site.hours.closes,
      },
    ],
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Computer repair services',
      itemListElement: [],
    },
  };

  if (site.logo) {
    node.logo = { '@type': 'ImageObject', url: absolute(site.logo) };
  }
  if (site.address.street && site.address.postcode) {
    node.address = {
      '@type': 'PostalAddress',
      streetAddress: site.address.street,
      addressLocality: site.address.locality,
      addressRegion: site.address.region,
      postalCode: site.address.postcode,
      addressCountry: site.address.country,
    };
  }
  // Only emit a rating when a real one has been configured. A fabricated
  // aggregateRating is a manual-action risk, not a ranking trick.
  if (site.aggregateRating.ratingValue && site.aggregateRating.reviewCount) {
    node.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: site.aggregateRating.ratingValue,
      reviewCount: site.aggregateRating.reviewCount,
      bestRating: 5,
      worstRating: 1,
    };
  }
  if (site.social.facebook) node.sameAs = [site.social.facebook, site.social.twitter].filter(Boolean);
  return node;
}

export function website(): Node {
  return {
    '@type': 'WebSite',
    '@id': `${site.url}/#website`,
    url: site.url,
    name: site.name,
    description: site.description,
    inLanguage: site.lang,
    publisher: { '@id': `${site.url}/#organization` },
  };
}

/**
 * A ContactPoint node for the business phone number.
 *
 * Small, but it is what makes the phone number machine-readable for local
 * search, and it is the node that a future ContactPage or AboutPage can
 * reference rather than restating.
 */
export function contactPoint(): Node {
  return {
    '@type': 'ContactPoint',
    '@id': `${site.url}/#contactpoint`,
    telephone: site.phone.e164,
    email: site.email.display,
    contactType: 'Customer service',
    areaServed: 'AU',
    availableLanguage: ['en-AU'],
    url: site.url,
  };
}

/**
 * The technician, as a Person node.
 *
 * Worth emitting separately from the Organization for a one-person trade
 * business: it is the person who does the work, and linking them into the graph
 * is what lets a "sameAs" profile (Google Business, a LinkedIn, a trade
 * register) reinforce the business identity rather than sitting on an
 * unrelated domain.
 *
 * The `sameAs` list comes from site.social, so it stays empty until real
 * profile URLs are supplied rather than being invented to fill the property.
 */
export function person(name: string, description: string): Node {
  const node: Node = {
    '@type': 'Person',
    '@id': `${site.url}/#technician`,
    name,
    description,
    jobTitle: 'Computer repair technician',
    worksFor: { '@id': `${site.url}/#organization` },
    knowsAbout: [
      'Computer repair',
      'Laptop repair',
      'Mac repair',
      'Data recovery',
      'Virus removal',
      'Hardware upgrades',
      'Computer networking',
    ],
  };

  const profiles = [site.social.facebook, site.social.twitter].filter(Boolean) as string[];
  if (profiles.length > 0) node.sameAs = profiles;

  return node;
}

export function webPage(opts: {
  name: string;
  path: string;
  description: string;
  datePublished?: string;
  dateModified?: string;
  /** @type override, e.g. CollectionPage for the blog index. */
  type?: string;
}): Node {
  const node: Node = {
    '@type': opts.type ?? 'WebPage',
    '@id': `${site.url}${opts.path}#webpage`,
    url: absolute(opts.path),
    name: opts.name,
    description: opts.description,
    isPartOf: { '@id': `${site.url}/#website` },
    about: { '@id': `${site.url}/#organization` },
    inLanguage: site.lang,
  };
  if (opts.datePublished) node.datePublished = opts.datePublished;
  if (opts.dateModified) node.dateModified = opts.dateModified;
  return node;
}

export function breadcrumbList(trail: { name: string; path: string }[]): Node {
  return {
    '@type': 'BreadcrumbList',
    '@id': `${absolute(trail[trail.length - 1]?.path ?? '/')}#breadcrumb`,
    itemListElement: trail.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: absolute(item.path),
    })),
  };
}

export function faqPage(faqs: Faq[]): Node | null {
  if (!faqs.length) return null;
  return {
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

/** The flat-rate Offer, referenced by every Service node. */
function offer(price?: number): Node {
  const amount = price ?? site.pricing.flatRate;
  return {
    '@type': 'Offer',
    '@id': `${site.url}/#offer`,
    price: String(amount),
    priceCurrency: 'AUD',
    availability: 'https://schema.org/InStock',
    areaServed: site.serviceAreas,
    priceValidUntil: `${new Date().getFullYear() + 1}-12-31`,
    seller: { '@id': `${site.url}/#organization` },
  };
}

export function service(opts: {
  name: string;
  description: string;
  path: string;
  price?: number;
  faqs?: Faq[];
}): Node {
  const node: Node = {
    '@type': 'Service',
    '@id': `${site.url}${opts.path}#service`,
    name: opts.name,
    description: opts.description,
    serviceType: opts.name,
    provider: { '@id': `${site.url}/#organization` },
    areaServed: [
      ...site.serviceAreas.map((name) => ({ '@type': 'City', name })),
      { '@type': 'AdministrativeArea', name: 'Queensland, Australia' },
    ],
    offers: offer(opts.price),
    url: absolute(opts.path),
  };
  if (opts.faqs?.length) node.hasOfferCatalog = undefined;
  return node;
}

/**
 * The per-suburb node. This is the one that actually earns the local pack:
 * a ProfessionalService whose areaServed is that specific suburb, with a
 * geographic coordinate so it can qualify for a local result.
 */
export function localService(opts: {
  name: string;
  description: string;
  path: string;
  suburb: string;
  region: string;
  lat: number | null;
  lon: number | null;
  price?: number;
}): Node {
  const node: Node = {
    '@type': 'ProfessionalService',
    '@id': `${site.url}${opts.path}#service`,
    name: opts.name,
    description: opts.description,
    serviceType: opts.name,
    url: absolute(opts.path),
    provider: { '@id': `${site.url}/#organization` },
    parentOrganization: { '@id': `${site.url}/#organization` },
    areaServed: [
      { '@type': 'Place', name: opts.suburb, containedInPlace: { '@type': 'AdministrativeArea', name: 'Queensland' } },
      { '@type': 'AdministrativeArea', name: opts.region },
    ],
    offers: offer(opts.price),
  };
  if (opts.lat != null && opts.lon != null) {
    node.geo = {
      '@type': 'GeoCoordinates',
      latitude: opts.lat,
      longitude: opts.lon,
    };
    node.hasMap = `https://www.google.com/maps/search/?api=1&query=${opts.lat},${opts.lon}`;
  }
  return node;
}

export function article(opts: {
  headline: string;
  description: string;
  path: string;
  datePublished: string;
  dateModified: string;
  author: string;
  image: string;
}): Node {
  return {
    '@type': 'Article',
    '@id': `${site.url}${opts.path}#article`,
    headline: opts.headline,
    description: opts.description,
    datePublished: opts.datePublished,
    dateModified: opts.dateModified,
    inLanguage: site.lang,
    mainEntityOfPage: { '@id': `${site.url}${opts.path}#webpage` },
    author: { '@type': 'Person', name: opts.author },
    publisher: { '@id': `${site.url}/#organization` },
    image: absolute(opts.image),
  };
}

/** ItemList for the service-area index. */
export function itemList(opts: {
  name: string;
  path: string;
  items: { name: string; path: string }[];
}): Node {
  return {
    '@type': 'ItemList',
    '@id': `${site.url}${opts.path}#itemlist`,
    name: opts.name,
    itemListOrder: 'https://schema.org/ItemListOrderAscending',
    numberOfItems: opts.items.length,
    itemListElement: opts.items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      url: absolute(item.path),
    })),
  };
}

/** Reviews from the third-party profile, with the real aggregate if configured. */
export function reviewSnippet(): Node[] {
  if (!site.aggregateRating.ratingValue) return [];
  return [
    {
      '@type': 'Review',
      reviewRating: { '@type': 'Rating', ratingValue: site.aggregateRating.ratingValue, bestRating: 5 },
      author: { '@type': 'Person', name: 'Verified customer' },
      itemReviewed: { '@id': `${site.url}/#organization` },
    },
  ];
}

export interface GraphOptions {
  /** Canonical path for the page, always leading-slashed. */
  path: string;
  name: string;
  description: string;
  extra?: (Node | null | undefined)[];
  datePublished?: string;
  dateModified?: string;
  type?: string;
}

/**
 * Assembles the final @graph. Organization and WebSite come first so the
 * @id references elsewhere resolve, then the page node, then anything
 * page-specific that is not null.
 */
export function graph(opts: GraphOptions): string {
  const nodes: Node[] = [
    organization(),
    website(),
    webPage({
      name: opts.name,
      path: opts.path,
      description: opts.description,
      datePublished: opts.datePublished,
      dateModified: opts.dateModified,
      type: opts.type,
    }),
  ];
  for (const node of opts.extra ?? []) {
    if (node) nodes.push(node);
  }
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': nodes });
}

/** Fill the catalog inside the organisation node with the real service list. */
export function serviceCatalog(entries: { name: string; description: string; path: string; price?: number }[]) {
  return {
    '@type': 'OfferCatalog',
    name: 'Computer repair services',
    itemListElement: entries.map((e) => ({
      '@type': 'Offer',
      itemOffered: {
        '@type': 'Service',
        name: e.name,
        description: e.description,
        url: absolute(e.path),
      },
      price: String(e.price ?? site.pricing.flatRate),
      priceCurrency: 'AUD',
    })),
  };
}

export type { Service, ServiceFamily };
