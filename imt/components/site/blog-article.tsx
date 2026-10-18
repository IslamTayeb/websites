import { ArticleProse } from '@/components/primitives/article-prose';
import { RoybBand } from '@/components/primitives/royb-band';
import { JsonLd } from '@/components/site/json-ld';
import { formatDate } from '@/lib/blog/date';
import type { BlogPost } from '@/lib/blog/posts';
import { buildBlogPostingJsonLd } from '@/lib/seo';

export function BlogArticle({ post }: { post: BlogPost }) {
  return (
    <>
      {post.manifest.listed ? (
        <JsonLd data={buildBlogPostingJsonLd(post)} />
      ) : null}
      <RoybBand />
      <article data-testid="blog-article" className="pb-3 pt-0">
        <header className="mb-4 flex flex-col gap-1">
          <h1
            data-testid="blog-article-title"
            className="text-3xl font-bold leading-tight tracking-tight text-foreground text-balance site-desktop:text-4xl"
          >
            {post.manifest.title}
          </h1>
          <time
            dateTime={post.manifest.publishedAt}
            className="font-mono text-sm tracking-[0.08em] text-muted-foreground"
          >
            {formatDate(post.manifest.publishedAt)}
          </time>
        </header>
        <ArticleProse html={post.html} />
      </article>
    </>
  );
}
