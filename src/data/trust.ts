/**
 * The commercial promises, in one place.
 *
 * These are the six things a customer can rely on, and every one of them is a
 * fact about how the business trades rather than an opinion about it. That is
 * the whole reason they exist here: this site has no review data and refuses to
 * invent any (see src/data/reviews.ts for why), so the reassurance on offer has
 * to come from terms that can actually be checked.
 *
 * Shared by /testimonials/ and the card grid above the footer on the homepage,
 * so the two can never drift apart.
 */
import type { IconName } from './services';
import { site } from './site';

export interface Promise {
  /** Short heading for the card or the row. */
  h: string;
  /** The promise itself, written out. */
  p: string;
  icon: IconName;
}

export const promises: Promise[] = [
  {
    h: 'The price is the price',
    p: `A flat $${site.pricing.flatRate} for the first hour and 15-minute blocks after that. No call-out fee, and no surcharge for evenings, weekends or public holidays. If a job is quoted at two hours, that is what it costs.`,
    icon: 'gauge',
  },
  {
    h: 'If it cannot be fixed, you do not pay',
    p: 'That covers the diagnosis too. If the fault is beyond repair, or beyond what is worth spending money on, you are told and there is no charge. A business that only makes money from completed work has no reason to invent faults.',
    icon: 'shield',
  },
  {
    h: 'Parts at cost, agreed first',
    p: 'You are told the part and the price before anything is ordered. No markup, and no fitting a part that is not worth fitting on a machine of that age.',
    icon: 'wrench',
  },
  {
    h: 'The same person who answers the phone',
    p: `It is a one-person business. ${site.technician.name} is the person who turns up, does the work and explains it afterwards - no call centre, no junior tech, no upsell.`,
    icon: 'support',
  },
  {
    h: 'If something I did stops working, I come back',
    p: 'That is not a marketing line, it is just what has to be true when the alternative is that you have to find someone else and explain what happened. Anything I did that fails is fixed at no charge.',
    icon: 'refresh',
  },
  {
    h: 'No obligation on a quote',
    p: 'A quote is a cost estimate, not a commitment. If it is more than you want to spend, or you want a second opinion, that is completely fine and you owe nothing.',
    icon: 'check',
  },
];