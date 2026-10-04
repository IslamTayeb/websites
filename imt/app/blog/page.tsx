import type { Metadata } from 'next';
import { RoybBand } from '@/components/primitives/royb-band';
import { BorderedPanel, Section } from '@/components/primitives/section';
import { ExternalLink } from '@/components/primitives/external-link';
import { PostTags } from '@/components/primitives/post-tags';
import { RailItem, RailList } from '@/components/primitives/rail';
import { externalWriting } from '@/data/external-writing';
import { absoluteSiteUrl, siteMetadata } from '@/data/site-metadata';
import { getListedPosts, postHref } from '@/lib/blog/posts';
import { formatMonthYear } from '@/lib/blog/date';

const postDotClassName = 'bg-foreground/75';

export const metadata: Metadata = {
  title: 'Blog',
  alternates: {
    canonical: absoluteSiteUrl('/blog'),
  },
  openGraph: {
    title: 'Blog',
    url: absoluteSiteUrl('/blog'),
    type: 'website',
    images: [siteMetadata.socialImage],
  },
  twitter: {
    card: 'summary',
    title: 'Blog',
    images: [siteMetadata.socialImage],
  },
};

export default async function BlogIndexPage() {
  const posts = await getListedPosts();
  const itemCount = posts.length + externalWriting.length;

  return (
    <>
      <header data-testid="blog-index-header">
        <RoybBand />
      </header>
      <Section
        id="posts"
        index="1"
        title={`Index (${itemCount})`}
        accent="text-roy-b"
        headingLevel="h1"
        className="pt-0"
      >
        <BorderedPanel>
          <RailList testId="blog-index-rail">
            {posts.map((post, index) => {
              return (
                <RailItem
                  key={post.manifest.slug}
                  dotClassName={postDotClassName}
                  hoverAccent="b"
                  titleClassName="font-semibold"
                  title={
                    <span>
                      <ExternalLink
                        href={postHref(post)}
                        section="b"
                        data-rail-hover-source="true"
                        className="text-base font-semibold leading-tight text-foreground"
                      >
                        {post.manifest.title}
                      </ExternalLink>
                      <PostTags kind={post.manifest.kind} />
                    </span>
                  }
                  meta={formatMonthYear(post.manifest.publishedAt)}
                  footer={
                    <div
                      data-testid="blog-index-row-meta"
                      className="reading-copy flex flex-wrap gap-x-3 gap-y-1 text-base leading-snug text-foreground"
                    >
                      <span>{post.readingMeta}</span>
                    </div>
                  }
                  connector={
                    index < posts.length - 1 || externalWriting.length > 0
                      ? 'solid'
                      : 'none'
                  }
                />
              );
            })}
            {externalWriting.map((item, index) => (
              <RailItem
                key={item.href}
                testId="external-writing-row"
                dotClassName={postDotClassName}
                hoverAccent="b"
                titleClassName="font-semibold"
                title={
                  <span>
                    <ExternalLink
                      href={item.href}
                      section="b"
                      data-rail-hover-source="true"
                      data-testid="external-writing-title"
                      className="min-w-0 text-base font-semibold leading-tight text-foreground"
                    >
                      {item.title}
                    </ExternalLink>
                    <PostTags external />
                  </span>
                }
                meta={item.date}
                footer={
                  <div
                    data-testid="external-writing-meta"
                    className="reading-copy text-base leading-snug text-foreground"
                  >
                    {item.meta}
                  </div>
                }
                connector={
                  index < externalWriting.length - 1 ? 'solid' : 'none'
                }
              />
            ))}
          </RailList>
        </BorderedPanel>
      </Section>
    </>
  );
}
