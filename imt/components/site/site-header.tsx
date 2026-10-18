import { Wordmark } from '@/components/primitives/wordmark';
import { ThemeToggle } from '@/components/site/theme-toggle';

export function SiteHeader({ active }: { active: 'islam' | 'blog' }) {
  // No rule under the header: the ROYB band directly below is the separator.
  return (
    <header data-testid="site-header" className="bg-background py-3">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
        <Wordmark active={active} />
        <ThemeToggle />
      </div>
    </header>
  );
}
