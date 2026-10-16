import type { ReactNode } from 'react';
import { SquareArrowOutUpRight } from 'lucide-react';
import { Tag } from '@/components/primitives/tag';
import type { PostKind } from '@/lib/blog/manifest';

// Yellow ties technical write-ups to the research/publications color; red
// ties opinion pieces to the personal voice. Blue stays the writing
// section's hover accent and orange stays the experience "current" marker.
const postKindTone = {
  technical: 'y',
  opinion: 'r',
} as const satisfies Record<PostKind, string>;

export function PostTags({
  kind,
  external = false,
}: {
  kind?: PostKind | null;
  // Marks writing published somewhere other than this site.
  external?: boolean;
}) {
  const tags: ReactNode[] = [];

  if (external) {
    tags.push(
      <Tag
        key="external"
        tone="neutral"
        data-post-tag="external"
        className="gap-1"
      >
        <SquareArrowOutUpRight
          aria-hidden
          className="size-[10px] shrink-0"
          strokeWidth={2}
        />
        external
      </Tag>
    );
  }

  if (kind) {
    tags.push(
      <Tag key={kind} tone={postKindTone[kind]} data-post-tag={kind}>
        {kind}
      </Tag>
    );
  }

  if (tags.length === 0) {
    return null;
  }

  return (
    <span
      data-post-tags
      className="ml-2 inline-flex flex-wrap gap-1 align-middle"
    >
      {tags}
    </span>
  );
}
