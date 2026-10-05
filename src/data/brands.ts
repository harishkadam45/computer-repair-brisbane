/**
 * Brands this shop repairs.
 *
 * This is the single source of truth: the homepage marquee and the "Brands
 * serviced" chips both read from it, so the two cannot drift apart. The set is
 * deliberately no longer than the list the business already published - a
 * marquee is a claim about what you actually repair, so adding a brand here is
 * an operational decision, not a design one.
 *
 * The wordmarks are set in type rather than shipped as logo artwork. Every
 * trademarked logo file is somebody's licensed property, and pulling them off
 * the internet to put on a commercial page is not something to do on a client's
 * behalf. Setting the brand name in the brand's published colour conveys the
 * same association with none of that, and it stays crisp at any size. If this
 * ever becomes paid placement, swap the wordmarks for logo files the
 * manufacturers supply under a licence.
 *
 * Colour sourcing: each value is the manufacturer's widely published primary.
 * Two needed adjusting for legibility, and those are marked below - a brand
 * green that cannot be read as type on a light tile is not worth being accurate
 * about. Wordmarks are set at 24px+, where WCAG asks for 3:1 rather than 4.5:1,
 * and every value here clears that against white. Verified with
 * scripts/contrast-audit.mjs and audit:dark-wash.
 */
export interface Brand {
  name: string;
  /** The manufacturer's primary colour. Drives the tile ring. */
  color: string;
  /**
   * Wordmark colour, when it has to differ from `color`. Defaults to `color`.
   *
   * The tile is a tint of the brand colour, which lightens the ground the
   * wordmark sits on and so costs it a little contrast. Most brands can afford
   * that. HP and Acer cannot: their primaries were only just readable on white
   * (3.32:1 and 3.07:1), so any tint drops them under the 3:1 that large text
   * asks for. Those two get a slightly darkened shade of the same hue.
   */
  mark?: string;
  /**
   * Tile fill at rest, as a literal hex.
   *
   * Precomputed rather than written as `color-mix()` in the CSS, and that is
   * deliberate. The oklab mix was produced in a real browser so the colour is
   * the one that would have rendered - mixing by hand in sRGB shifts the hue as
   * it lightens and turns Acer's green olive. But a `color-mix()` in the
   * stylesheet is opaque to `scripts/audit-contrast.mjs`, which reported these
   * tiles as "not statically checked" and quietly stopped guarding them. Literal
   * hexes render identically and stay auditable.
   */
  tint: string;
  /** Tile fill on hover: the same mix, darker. */
  tintHover: string;
  /** What kind of machine this covers, shown under the wordmark. */
  kind: string;
  /** Set when the colour is a darkened shade of the official one. */
  adjusted?: string;
}

export const brands: Brand[] = [
  {
    name: 'Apple',
    color: '#1D1D1F',
    tint: '#E0E0E1',
    tintHover: '#CCCCCD',
    kind: 'MacBook, iMac, Mac Studio',
  },
  { name: 'Dell', color: '#007DB8', tint: '#E5EFF7', tintHover: '#D3E5F2', kind: 'Inspiron, Latitude, XPS' },
  {
    name: 'HP',
    color: '#0096D6',
    mark: '#0093D2',
    tint: '#E7F3FB',
    tintHover: '#D7EAF8',
    kind: 'Pavilion, Envy, ProBook',
    adjusted: "HP blue on the tinted tile is 2.94:1. Wordmark darkened a shade to 3.05:1.",
  },
  { name: 'Lenovo', color: '#E2231A', tint: '#FFE8E4', tintHover: '#FFD9D3', kind: 'ThinkPad, IdeaPad, Legion' },
  { name: 'ASUS', color: '#00539F', tint: '#E1EAF4', tintHover: '#CEDCED', kind: 'VivoBook, ZenBook, ROG' },
  {
    name: 'Acer',
    color: '#6AA238',
    mark: '#649835',
    tint: '#EDF4E8',
    tintHover: '#E0EDD8',
    kind: 'Aspire, Swift, Predator',
    adjusted:
      "Acer's green is #80C343, which is 2.14:1 on white. Darkened to the same hue for the tile, " +
      'then again for the wordmark, which the tint had pushed to 2.74:1.',
  },
  { name: 'Toshiba', color: '#E60012', tint: '#FFE8E4', tintHover: '#FFD8D2', kind: 'Satellite, older stock' },
  { name: 'Sony', color: '#000000', tint: '#D7D7D7', tintHover: '#BEBEBE', kind: 'VAIO, desktops' },
  { name: 'Compaq', color: '#0A5CAB', tint: '#E2EBF6', tintHover: '#D0DEF0', kind: 'Presario, ProLiant' },
  { name: 'IBM', color: '#1F70C1', tint: '#E5EEF9', tintHover: '#D3E2F4', kind: 'ThinkPad, ThinkCentre' },
];

/**
 * Split for the two marquee rows. Kept even so neither row is left with a
 * single orphan tile, and so a row can be timed independently of the list
 * length without one of them looking stretched.
 */
export function splitRows<T>(items: T[]): [T[], T[]] {
  const half = Math.ceil(items.length / 2);
  return [items.slice(0, half), items.slice(half)];
}

/** Small print under the marquee, so the claim is not wider than the list. */
export const brandsFootnote =
  'Parts for older models are ordered in as needed. If a machine is not listed, ask anyway - the ' +
  'fix is often generic rather than model-specific.';