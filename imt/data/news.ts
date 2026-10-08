import type { TextSegment } from '@/data/profile';

export type NewsItem = {
  // Only the segments that name something get an href.
  segments: TextSegment[];
  date: string;
};

// The hero renders only the newest NEWS_ROW_LIMIT items.
export const NEWS_ROW_LIMIT = 3;

// Newest first; each renders as a single rail row. Older items past
// NEWS_ROW_LIMIT are dropped from the page, so prune them here.
export const newsItems: NewsItem[] = [
  {
    segments: [
      { text: 'Posted ' },
      { text: '10→1 vs 1→0', href: '/blog/one-to-zero' },
      { text: ', on taking the customer out of the loop' },
    ],
    date: 'Oct 2026',
  },
  {
    segments: [
      { text: 'Presented at the ' },
      {
        text: 'AI Research Scientist Workshop',
        href: 'https://ai-scientist-workshop.github.io/',
      },
      { text: ' at Microsoft Research in Boston' },
    ],
    date: 'Aug 2026',
  },
  {
    segments: [
      { text: 'Accepted into the ' },
      {
        text: 'Anthropic AI for Science program',
        href: 'https://www.anthropic.com/news/ai-for-science-program',
      },
      { text: ', thx for the compute!' },
    ],
    date: 'Jun 2026',
  },
];
