import type { ReactNode } from 'react';
import { Tag } from '@/components/primitives/tag';
import type { PostKind } from '@/lib/blog/manifest';

// Yellow ties technical write-ups to the research/publications color; red
// ties opinion pieces to the personal voice. Blue stays the writing
// section's hover accent and orange stays the experience "current" marker.
// The gap between a title and its tags belongs to the title, as trailing
// margin on the title link: when the tags wrap onto their own line, the gap
// stays behind at the end of the title and the tags start flush left.
export const postTitleTagGapClassName = 'mr-2';

const postKindTone = {
  technical: 'y',
  opinion: 'r',
} as const satisfies Record<PostKind, string>;

// Lucide's square-arrow-out-up-right, inlined.
function ExternalIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-[10px] shrink-0"
      aria-hidden="true"
    >
      <path d="M21 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6" />
      <path d="m21 3-9 9" />
      <path d="M15 3h6v6" />
    </svg>
  );
}

export function PostTags({
  kind,
  external = false,
}: {
  kind?: PostKind | null;
  // Marks writing published somewhere other than this site.
  external?: boolean;
}) {
  const tags: ReactNode[] = [];

  if (kind) {
    tags.push(
      <Tag key={kind} tone={postKindTone[kind]} data-post-tag={kind}>
        {kind}
      </Tag>
    );
  }

  if (external) {
    tags.push(
      <Tag
        key="external"
        tone="neutral"
        data-post-tag="external"
        className="gap-1"
      >
        <ExternalIcon />
        external
      </Tag>
    );
  }

  if (tags.length === 0) {
    return null;
  }

  return (
    <span data-post-tags className="inline-flex flex-wrap gap-1 align-middle">
      {tags}
    </span>
  );
}
