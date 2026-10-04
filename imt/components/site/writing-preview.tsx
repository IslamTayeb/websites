import { getListedPosts, postHref } from '@/lib/blog/posts';
import { formatMonthYear } from '@/lib/blog/date';
import { ExternalLink } from '@/components/primitives/external-link';
import { PostTags } from '@/components/primitives/post-tags';
import {
  RailActionItem,
  RailItem,
  RailList,
} from '@/components/primitives/rail';
import { SectionActionLink } from '@/components/primitives/section-action';
import { BorderedPanel, Section } from '@/components/primitives/section';

export async function WritingPreview() {
  const posts = (await getListedPosts()).slice(0, 3);

  return (
    <Section
      id="writing"
      index="4"
      title="Writing"
      accent="text-roy-b"
      className="mb-4"
      divided
    >
      <BorderedPanel>
        <div className="flex w-full flex-col">
          <RailList>
            {posts.map((post, index) => {
              return (
                <RailItem
                  key={post.manifest.slug}
                  dotClassName="bg-foreground/75"
                  hoverAccent="b"
                  titleClassName="font-semibold"
                  title={
                    <span>
                      <ExternalLink
                        href={postHref(post)}
                        section="b"
                        data-rail-hover-source="true"
                        className="font-semibold text-foreground"
                      >
                        {post.manifest.title}
                      </ExternalLink>
                      <PostTags kind={post.manifest.kind} />
                    </span>
                  }
                  meta={formatMonthYear(post.manifest.publishedAt)}
                  footer={
                    <div
                      data-testid="writing-row-meta"
                      className="reading-copy text-base leading-snug text-foreground"
                    >
                      {post.readingMeta}
                    </div>
                  }
                  connector={index < posts.length - 1 ? 'solid' : 'dashed'}
                />
              );
            })}
            <RailActionItem testId="writing-action-row">
              <SectionActionLink href="/blog" section="b">
                show more on blog...
              </SectionActionLink>
            </RailActionItem>
          </RailList>
        </div>
      </BorderedPanel>
    </Section>
  );
}
