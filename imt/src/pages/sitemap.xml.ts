import { getListedPosts } from '@/lib/blog/posts';
import { buildSitemapXml } from '@/lib/seo';

export async function GET() {
  return new Response(buildSitemapXml(await getListedPosts()), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}
