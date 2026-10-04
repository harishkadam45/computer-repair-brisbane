export interface Review {
  name: string;
  quote: string;
  date: string;
  rating: number;
  context?: string;
}

export const reviews: Review[] = [
  { name: 'REPLACE - customer name', quote: 'REPLACE - paste the review text exactly as the customer wrote it on the platform. Do not tidy the wording.', date: '2025-03-14', rating: 5, context: 'REPLACE - suburb' },
  { name: 'REPLACE - customer name', quote: 'REPLACE - paste the review text exactly as the customer wrote it on the platform. Do not tidy the wording.', date: '2025-02-02', rating: 5 },
  { name: 'REPLACE - customer name', quote: 'REPLACE - paste the review text exactly as the customer wrote it on the platform. Do not tidy the wording.', date: '2025-01-20', rating: 4, context: 'REPLACE - business customer' },
  { name: 'REPLACE - customer name', quote: 'REPLACE - paste the review text exactly as the customer wrote it on the platform. Do not tidy the wording.', date: '2024-12-08', rating: 5 },
  { name: 'REPLACE - customer name', quote: 'REPLACE - paste the review text exactly as the customer wrote it on the platform. Do not tidy the wording.', date: '2024-11-19', rating: 5, context: 'REPLACE - suburb' },
  { name: 'REPLACE - customer name', quote: 'REPLACE - paste the review text exactly as the customer wrote it on the platform. Do not tidy the wording.', date: '2024-10-30', rating: 5 },
];

export function formatReviewDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Brisbane',
  });
}