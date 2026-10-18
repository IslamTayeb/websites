import { buildAtomFeed } from '@/lib/blog/feed';

export async function GET() {
  return new Response(await buildAtomFeed(), {
    headers: { 'Content-Type': 'application/atom+xml; charset=utf-8' },
  });
}
