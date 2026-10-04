import { ExternalLink } from '@/components/primitives/external-link';
import { footerQuote } from '@/data/links';

export function SiteFooter() {
  return (
    <footer
      data-testid="site-footer"
      className="mt-auto grid min-h-[47px] grid-cols-[max-content_minmax(0,1fr)] items-center gap-1 border-t border-border py-2.5 font-mono text-sm leading-normal text-muted-foreground site-desktop:flex site-desktop:justify-between site-desktop:gap-4"
    >
      <span data-testid="site-footer-updated" className="whitespace-nowrap">
        Last updated Oct 4, 2026
      </span>
      <span
        data-testid="site-footer-quote"
        className="hidden min-w-0 text-right site-desktop:block"
      >
        <span className="whitespace-nowrap">
          {'"'}
          <ExternalLink
            href={footerQuote.href}
            section="b"
            className="text-muted-foreground"
          >
            {footerQuote.label}
          </ExternalLink>
          {'"'}
        </span>{' '}
        <span className="whitespace-nowrap">
          ~
          <ExternalLink
            href={footerQuote.creditHref}
            section="b"
            className="text-muted-foreground"
          >
            {footerQuote.credit}
          </ExternalLink>
        </span>
      </span>
    </footer>
  );
}
