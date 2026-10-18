import type { AnchorHTMLAttributes, ReactNode } from 'react';
import {
  roybLinkClassName,
  type RoybLinkVariant,
  type RoybSection,
} from '@/components/primitives/royb-link';

function isExternalHref(href: string) {
  return /^https?:\/\//.test(href);
}

export function ExternalLink({
  href,
  children,
  className,
  section = 'b',
  variant = 'highlight',
  ...props
}: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'children'> & {
  href: string;
  children: ReactNode;
  className?: string;
  section?: RoybSection;
  variant?: RoybLinkVariant;
}) {
  const external = isExternalHref(href);
  const classes = roybLinkClassName({
    section,
    variant,
    external,
    className,
  });

  if (external) {
    return (
      <a
        {...props}
        href={href}
        target="_blank"
        rel="noreferrer external"
        className={classes}
      >
        {children}
      </a>
    );
  }

  return (
    <a href={href} className={classes} {...props}>
      {children}
    </a>
  );
}
