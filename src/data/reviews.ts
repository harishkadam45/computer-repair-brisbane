/**
 * Real customer reviews, transcribed from the Word of Mouth profile.
 *
 * This is NOT invented content. Every entry below was copied verbatim from
 * wordofmouth.com.au/reviews/zoo-computer-repairs, which is this business's own
 * public profile (it carries the legacy "Zoo Computer Repairs" trading name, and
 * most of the reviewers name Robert directly). Transcribed 4 October 2026.
 *
 * Rules for editing this file, which exist because the earlier version of it
 * was empty by design:
 *
 *   1. Never add a review that is not on that profile. Publishing a fabricated
 *      testimonial is unlawful under the Australian Consumer Law, which is the
 *      whole reason this file sat empty for as long as it did.
 *   2. Keep the wording exactly as published. Typos and all - see Selena B.
 *      below for proof that they were left alone. Tidying a customer's words
 *      stops them being the customer's words.
 *   3. The dates are the ones the platform shows, so they are the publication
 *      dates. Do not convert them to relative time ("3 months ago"), which
 *      would go stale and quietly change the meaning.
 *   4. Only reviews quoted in full are here. Three longer ones are absent
 *      because the platform truncates them behind a "Read more" and quoting a
 *      half review would misrepresent it.
 *
 * `business` below is the profile's own aggregate. It has to match the platform
 * or the numbers on the page are a lie; re-read it off the profile when
 * refreshing these reviews.
 */

/** Where these came from, and the numbers as published alongside them. */
export const business = {
  name: 'Word of Mouth',
  url: 'https://www.wordofmouth.com.au/reviews/zoo-computer-repairs',
  /** '4.9', exactly as the profile shows it. */
  rating: '4.9',
  /** '1,160' reviews, as displayed. */
  count: '1,160',
  /** Pulled straight from the profile's trust signals panel. */
  trust: [
    { label: 'would choose again', value: '96%' },
    { label: 'on time and reliable', value: '100%' },
    { label: 'friendly and professional', value: '100%' },
  ],
};

export interface Review {
  /** As the platform shows it, including the initial. */
  name: string;
  /** The review, verbatim. Line breaks in the original are joined with spaces. */
  quote: string;
  /** ISO 8601 publication date as shown on the platform. */
  date: string;
  /** 1-5. The Quality score the platform recorded. */
  rating: number;
}

/** Newest first, which is the order the profile lists them in. */
export const reviews: Review[] = [
  {
    name: 'David H.',
    quote:
      'Andrew is very professional and provided excellent service and advice. I would recommend him for expert help.',
    date: '2026-10-04',
    rating: 5,
  },
  {
    name: 'Charlie F.',
    quote:
      "Robert made what could've been a really stressful situation so much better. He was super professional and genuinely friendly throughout the whole process, which honestly helped calm my nerves. Best part? He actually got rid of the virus completely. I really appreciate how he handled everything from start to finish. Thanks, Robert!",
    date: '2026-10-01',
    rating: 5,
  },
  {
    name: 'Phil V.',
    quote:
      'was sceptical at first, but let him remotely enter my computer and he did a fantastic job removing a bad virus in around 3 hours. Will use him again for sure if I ever have another problem !',
    date: '2026-09-01',
    rating: 5,
  },
  {
    name: 'Ryan R.',
    quote:
      'Immediately felt at ease after speaking with Robert. Did exactly what he said he would do, and did it straight away. Thanks again.',
    date: '2026-07-10',
    rating: 5,
  },
  {
    name: 'Mark P.',
    quote: 'Quick and reasonably priced repair',
    date: '2026-07-01',
    rating: 4,
  },
  {
    name: 'Marg C.',
    quote:
      'Professional, speedy and successful. We are very impressed with the service we received. All working perfectly now.',
    date: '2026-06-15',
    rating: 5,
  },
  {
    name: 'Axel P.',
    quote:
      'The service was virtually immediate, with responses coming through straight away. The support was centred around my crisis and my needs, rather than being restricted to standard office hours. It genuinely felt like the priority was helping me, not fitting me into a schedule.',
    date: '2026-06-09',
    rating: 5,
  },
  {
    name: 'Chris M.',
    quote:
      'Thanks to robert and his team for supporting my mother. My mother in her 90s was always a techno chick. Her confidence online was damaged when she had a bad news, hacking experience on one of her bank accounts. Robert and his team quickly addressed her laptop problems over a weekend. Since that crisis, they have been reassuring and prompt in dealing with her concerns and keeping her keeping on confidently online. Many thanks! Highly recommended.',
    date: '2026-05-21',
    rating: 5,
  },
  {
    name: 'Ian C.',
    quote: 'Robert was efficient, profesional, gave a prompt response to my enquiry',
    date: '2026-05-19',
    rating: 5,
  },
  {
    name: 'Selena B.',
    quote:
      'Prompt and profressional. Robert was prompt in getting back to my call and very professional during the service including regular updates on actions being taken and what needed fixing. Highly recommend the service and if I have another malware scare or hard drive slow down I\'ll reach back out for sure.',
    date: '2026-05-11',
    rating: 5,
  },
  {
    name: 'Joan G.',
    quote:
      'Robert was very understanding of problems with my computer and printer. Fixed the problems in record time. I will recommend Robert to my friends.',
    date: '2026-05-07',
    rating: 5,
  },
  {
    name: 'Sue E.',
    quote:
      'Prompt service. Continual contact. And amazing clean up of a very frightening virus. Very professional service by Robert.',
    date: '2026-04-30',
    rating: 5,
  },
  {
    name: 'Serge A.',
    quote:
      'Fantastically professional. I ma so glad that we found Robert to help us clean up my laptop from a hacker.',
    date: '2026-04-13',
    rating: 5,
  },
  {
    name: 'Bruce L.',
    quote:
      'Great speedy repair. I was told by Apple that my MacBook was unrepairable.',
    date: '2026-04-06',
    rating: 5,
  },
  {
    name: 'Brigitte C.',
    quote:
      'Outlook email virus. Robert was extremely thorough and helped me when I had a virus in my outlook email. He was very patient and I really appreciate the knowledge that he has regarding all things IT. He is a very genuine guy and I can\'t thank him enough for helping me. He even came and sorted my stuff out in person as he was just around the corner at the time of my call.',
    date: '2026-02-11',
    rating: 5,
  },
];

/** `14 March 2025`, in Brisbane time, matching the blog bylines. */
export function formatReviewDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Australia/Brisbane',
  });
}