import { buildRssFeed } from '@/lib/blog/feed';

export async function GET() {
  return new Response(await buildRssFeed(), {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  });
}
