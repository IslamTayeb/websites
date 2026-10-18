import { ExternalLink } from '@/components/primitives/external-link';
import { RoybLinkText } from '@/components/primitives/royb-link';
import { cn } from '@/lib/utils';
import { MoonGlyph, SparkleGlyph } from './glyphs';

const inactiveWordmarkClassName = 'text-[#6B6966]';

export function Wordmark({ active }: { active: 'islam' | 'blog' }) {
  return (
    <div
      className="flex items-center gap-4 font-mono text-base"
      aria-label="Site surfaces"
      data-testid="wordmark"
    >
      <ExternalLink
        href="/"
        section="r"
        variant="plain"
        className={cn(
          'royb-link-hover-scope flex items-center gap-2',
          active === 'islam' ? 'text-roy-r' : inactiveWordmarkClassName
        )}
      >
        <MoonGlyph size={15} />
        <RoybLinkText section="r">islam</RoybLinkText>
      </ExternalLink>
      <span aria-hidden className={inactiveWordmarkClassName}>
        /
      </span>
      <ExternalLink
        href="/blog"
        section="b"
        variant="plain"
        className={cn(
          'royb-link-hover-scope flex items-center gap-2',
          active === 'blog' ? 'text-roy-b' : inactiveWordmarkClassName
        )}
      >
        <SparkleGlyph size={14} />
        <RoybLinkText section="b">blog</RoybLinkText>
      </ExternalLink>
    </div>
  );
}
