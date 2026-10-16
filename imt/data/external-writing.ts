import type { PostKind } from '@/lib/blog/manifest';

type ExternalWriting = {
  title: string;
  href: string;
  meta: string;
  date: string;
  kind: PostKind;
};

export const externalWriting: ExternalWriting[] = [
  {
    title: 'Finding the Right Answer Was Never the Point',
    href: 'https://www.dukechronicle.com/article/daf941cd-e431-4e71-a282-5f7da9a56c28',
    meta: '0.9K words (4 mins)',
    date: 'Nov 2024',
    kind: 'opinion',
  },
];
