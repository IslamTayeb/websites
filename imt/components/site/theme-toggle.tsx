import { RoybLinkText } from '@/components/primitives/royb-link';

// The click handler lives in the inline theme script (lib/site-scripts.ts).
export function ThemeToggle() {
  return (
    <button
      type="button"
      data-testid="theme-toggle"
      data-theme-toggle
      aria-label="Toggle color scheme"
      className="royb-link-plain section-color-n royb-link-hover-scope font-mono text-base text-[#6B6966] outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      <span className="dark:hidden">
        <RoybLinkText section="n">light</RoybLinkText>
      </span>
      <span className="hidden dark:inline">
        <RoybLinkText section="n">dark</RoybLinkText>
      </span>
    </button>
  );
}
