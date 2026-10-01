type GlyphProps = {
  size?: number;
  className?: string;
};

const cutout = 'var(--background)';

export function MoonGlyph({ size = 16, className = '' }: GlyphProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <circle cx="8.49" cy="8" r="5.82" fill="currentColor" />
      <circle cx="11.61" cy="6.75" r="4.89" fill={cutout} />
    </svg>
  );
}

export function SparkleGlyph({ size = 16, className = '' }: GlyphProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M8 1.8 9.7 6.3 14.2 8 9.7 9.7 8 14.2 6.3 9.7 1.8 8 6.3 6.3 8 1.8Z"
        fill="currentColor"
      />
    </svg>
  );
}

const textArrowPath = 'M1 6h17M13 1l5 5-5 5';

// Open Sans has no U+2192, so the fallback font's long hairline arrow shows up instead.
// This draws one sized to the surrounding text; .text-arrow in globals.css matches its weight.
export const textArrowSvg = `<svg class="text-arrow" viewBox="0 0 20 12" role="img" aria-label="→"><path d="${textArrowPath}"/></svg>`;

export function TextArrow() {
  return (
    <svg className="text-arrow" viewBox="0 0 20 12" role="img" aria-label="→">
      <path d={textArrowPath} />
    </svg>
  );
}

export function WithTextArrows({ text }: { text: string }) {
  return text
    .split('→')
    .flatMap((part, i) => (i ? [<TextArrow key={i} />, part] : [part]));
}
