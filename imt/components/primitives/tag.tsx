import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/utils';

type TagTone = 'neutral' | 'r' | 'o' | 'y' | 'b';

// Tones only tint the fill; every tag shares the ink dotted rule, like a
// catalog SKU box.
const tagToneClasses: Record<TagTone, string> = {
  neutral: 'bg-[var(--tag-background)] text-foreground',
  r: 'bg-roy-r/[0.14] text-foreground',
  o: 'bg-roy-o/[0.16] text-foreground',
  y: 'bg-roy-y/[0.22] text-foreground',
  b: 'bg-roy-b/[0.14] text-roy-b',
};

export function Tag({
  tone = 'neutral',
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<'span'> & {
  tone?: TagTone;
}) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center border border-dotted border-foreground px-1.5 py-0.5 font-mono text-[11px] font-normal uppercase leading-none tracking-[0.12em]',
        tagToneClasses[tone],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
