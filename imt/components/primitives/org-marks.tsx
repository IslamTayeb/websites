// Organization marks for the experience rail, normalized into a 16x16 box.
// Sources are noted per mark. Each mark is one or more filled paths and
// renders in currentColor. `box` is the tight bounds inside the 16x16 box, and
// `ink` the filled area, so marks can be sized to equal visual weight.

export type OrgKey =
  | 'duke'
  | 'kfupm'
  | 'yc'
  | 'soff'
  | 'diig'
  | 'dihi'
  | 'raycast';

type OrgMarkDef = {
  label: string;
  box: [number, number, number, number];
  // Filled area in 16x16 box units, measured from a raster of the paths.
  ink: number;
  // Optional perceptual nudge on the balanced height. Equal ink still reads
  // unequal: wide sparse marks look heavy, compact dense ones look light.
  weight?: number;
  paths: string[];
};

const orgMarks: Record<OrgKey, OrgMarkDef> = {
  // Duke Athletics "D" (Wikimedia Commons, Duke_Athletics_logo.svg)
  duke: {
    label: 'Duke University',
    box: [0.0, 0.88, 16.0, 14.24],
    ink: 152.2,
    weight: 1.1,
    paths: [
      'M8.9 0.88L10.9 4.18L10.9 11.81L8.9 15.12L13.09 15.12C14.7 15.11 16 13.82 16 12.14L16 3.93C16 2.24 14.7 0.88 13.09 0.88L8.9 0.88L8.9 0.88M0 0.88L2 4.18L2 11.81L0 15.12L8.46 15.12L6.46 11.81L6.46 4.18L8.46 0.88L0 0.88L0 0.88Z',
    ],
  },
  // Emblem cropped from kfupm.edu.sa/images/default-source/default-album/kfupm_logo_en.svg,
  // with the sixteen window cutouts merged into one tower opening so it reads at 12px
  kfupm: {
    label: 'KFUPM',
    box: [0.52, 0.0, 14.95, 16.0],
    ink: 130.0,
    weight: 1.08,
    paths: [
      'M14.83 4L11.73 0.68C11.32 0.25 10.77 0 10.19 0L5.8 0C5.23 0 4.68 0.25 4.27 0.68L1.17 4C0.76 4.44 0.53 5.03 0.53 5.65L0.53 10.35C0.53 10.96 0.76 11.56 1.17 11.99L4.27 15.32C4.68 15.75 5.23 16 5.81 16L10.19 16C10.77 16 11.32 15.75 11.73 15.32L14.83 11.99C15.24 11.56 15.47 10.96 15.47 10.35L15.47 5.65C15.47 5.03 15.24 4.44 14.83 4ZM4.46 4.66L4.74 4.47L4.88 4.38L5.45 4L6.01 3.75L6.48 3.67L7.42 3.51L7.66 3.47L8.35 3.47L8.82 3.55L9.76 3.71L9.99 3.75L10.55 4L10.69 4.09L11.26 4.47L11.55 4.66L10.23 15.28L5.78 15.28L4.46 4.66Z',
    ],
  },
  // Simple Icons "ycombinator"
  yc: {
    label: 'Y Combinator',
    box: [0.0, 0.0, 16.0, 16.0],
    ink: 241.4,
    paths: [
      'M0 16L0 0L16 0L16 16L0 16M4.63 3.93L7.38 9.07L7.38 12.45L8.43 12.45L8.43 9.13L11.2 3.93L10.03 3.93L8.39 7.18C8.14 7.68 7.93 8.14 7.93 8.14C7.93 8.14 7.74 7.67 7.5 7.18L5.89 3.93L4.63 3.93Z',
    ],
  },
  // Traced from the Soff logo PNG on ycombinator.com/companies/soff (black on white)
  soff: {
    label: 'Soff',
    box: [-0.0, 3.14, 16.0, 9.72],
    ink: 64.1,
    weight: 0.85,
    paths: [
      'M0 12.72C0 12.64 0.24 11.98 0.53 11.25C1.48 8.88 2.65 8 4.9 8C6.3 8 6.94 7.8 7.39 7.23C7.55 7.03 8.02 6.02 8.43 5L9.18 3.14L12.59 3.14L16 3.14L15.72 3.84C15.03 5.61 14.6 6.38 14.01 6.91C13.17 7.66 12.57 7.88 11.15 7.95C8.66 8.08 8.64 8.09 7.5 10.86L6.68 12.86L3.34 12.86C1.22 12.86 0 12.81 0 12.72Z',
    ],
  },
  // Leaf-and-D cropped from the wordmark at dukeimpact.com/diig-logo.png, traced
  // with the leaf veins filled and strokes thickened so it reads at 12px
  diig: {
    label: 'Duke Impact Investing Group',
    box: [0, 3.11, 16, 9.78],
    ink: 79,
    weight: 0.85,
    paths: [
      'M6.35 3.17C6.19 3.33 6.29 3.68 6.5 3.68C6.79 3.68 7.31 3.99 7.37 4.2C7.54 4.82 7.4 7.7 7.22 7.16C6.77 5.8 5.31 4.26 4.46 4.26C4.39 4.26 4.22 4.21 4.08 4.15C3.7 3.97 1.67 3.97 1.5 4.14C1.36 4.28 1.35 4.54 1.47 4.86C1.52 4.99 1.58 5.16 1.61 5.25C2.07 6.71 3.83 7.83 5.65 7.83C6.02 7.83 6.23 7.85 6.3 7.91C6.37 7.95 6.61 8 6.85 8.03C7.34 8.08 7.42 8.12 7.42 8.35C7.42 8.58 7.34 8.61 6.75 8.65C6.41 8.67 6.17 8.71 6.09 8.77C5.92 8.89 5.75 8.89 5.58 8.76C5.06 8.38 3.88 8.25 3.38 8.52C3.26 8.58 3.09 8.63 3.01 8.63C2.34 8.64 0.98 9.87 0.48 10.93C-0.31 12.59 -0.18 12.86 1.35 12.86C3.49 12.86 4.67 12.13 5.67 10.17C5.94 9.63 6.24 9.47 6.96 9.47L7.4 9.47L7.4 10.64C7.4 11.99 7.38 12.04 6.78 12.12C6.27 12.18 6.03 12.69 6.43 12.84C7.03 13.07 12.16 12.81 12.72 12.52C12.81 12.47 12.93 12.43 12.99 12.43C13.11 12.43 13.91 12.03 14.17 11.85C14.81 11.38 15.42 10.61 15.65 9.99C15.72 9.8 15.82 9.55 15.88 9.44C16.02 9.13 16.05 6.98 15.91 6.62C15.86 6.48 15.8 6.27 15.77 6.16C15.74 6.05 15.65 5.84 15.57 5.7C15.49 5.56 15.38 5.36 15.33 5.27C15 4.66 13.58 3.57 13.15 3.57C13.1 3.57 12.97 3.52 12.85 3.45C12.73 3.39 12.59 3.34 12.54 3.34C12.48 3.34 12.29 3.29 12.1 3.24C11.66 3.11 6.47 3.05 6.35 3.17ZM9.45 4.12C9.7 3.94 11.3 4.06 11.71 4.28C11.81 4.33 11.93 4.37 11.97 4.37C12.39 4.38 13.81 5.92 13.81 6.37C13.81 6.43 13.87 6.58 13.94 6.71C14.13 7.05 14.13 8.98 13.94 9.38C13.87 9.52 13.81 9.7 13.81 9.78C13.81 10.27 12.44 11.62 11.94 11.63C11.88 11.63 11.72 11.68 11.58 11.74C11.21 11.91 9.69 11.98 9.47 11.83C9.25 11.69 9.23 4.27 9.45 4.12Z',
    ],
  },
  // Solid horned bulb and one merged base block from dihi.org/wp-content/uploads/2020/02/DIHI-Logo-RGB.svg,
  // without the tail or wordmark so it reads at 12px
  dihi: {
    label: 'Duke Institute for Health Innovation',
    box: [2.85, 0.0, 10.3, 16.0],
    ink: 103.6,
    paths: [
      'M12.7 3.28C13.16 2.41 13.28 1.49 12.96 0.54C12.95 0.52 12.94 0.49 12.92 0.44C12.62 0.99 12.25 1.46 11.75 1.82C10.76 0.65 9.53 0 8 0L7.99 0C6.46 0 5.23 0.65 4.25 1.82C3.74 1.46 3.38 0.99 3.07 0.44C3.05 0.49 3.04 0.51 3.03 0.54C2.71 1.49 2.84 2.41 3.29 3.28C3.16 4.13 3.16 4.69 3.24 5.26C3.37 6.1 3.67 6.9 4.03 7.67C4.42 8.53 4.85 9.38 5.22 10.25C5.53 10.97 5.77 11.73 6.05 12.5L6.18 12.5Q7.09 12.5 8 12.5Q8.91 12.5 9.82 12.5L9.94 12.5C10.23 11.73 10.47 10.97 10.78 10.25C11.15 9.38 11.57 8.53 11.97 7.67C12.32 6.9 12.63 6.11 12.75 5.26C12.84 4.69 12.83 4.13 12.68 3.57Z',
      'M6.12 14.6L6.13 13.45L6.14 13.33L6.18 13.23L6.25 13.16L6.36 13.12L6.49 13.11L9.51 13.11L9.65 13.12L9.75 13.16L9.82 13.23L9.87 13.33L9.88 13.46L9.88 14.56L9.86 14.69L9.82 14.79L9.04 15.86L8.97 15.93L8.88 15.98L8.76 16L7.23 16L7.12 15.98L7.02 15.93L6.96 15.86L6.15 14.73Z',
    ],
  },
  // Raycast's own logo (raycast.com header SVG, same as Simple Icons "raycast")
  raycast: {
    label: 'Raycast',
    box: [0.0, 0.0, 16.0, 16.0],
    ink: 77.5,
    weight: 1.05,
    paths: [
      'M4 10.33L4 12L0 7.99L0.84 7.16ZM5.67 12L4 12L8.01 16L8.84 15.16ZM15.17 8.83L16 8L8 0L7.17 0.83L10.33 4L8.42 4L6.21 1.79L5.38 2.63L6.75 4L5.79 4L5.79 10.21L12 10.21L12 9.25L13.37 10.63L14.21 9.79L12 7.58L12 5.67ZM4.42 3.58L3.59 4.42L4.48 5.31L5.32 4.48ZM11.52 10.68L10.69 11.52L11.59 12.41L12.42 11.58ZM2.63 5.37L1.79 6.21L4 8.42L4 6.75ZM9.25 12L7.58 12L9.79 14.21L10.63 13.37Z',
    ],
  },
};

export const orgKeys = Object.keys(orgMarks) as OrgKey[];

// Ink area of a mark rendered `height` px tall with its natural width.
function inkAtHeight(org: OrgKey, height: number) {
  const mark = orgMarks[org];
  const scale = height / mark.box[3];

  return mark.ink * scale * scale;
}

// Height that moves this mark toward the ink area of the plain square rail
// dot of side `dotSize`. `strength` 1 makes every mark carry exactly the dot's
// filled area; 0.5 goes halfway there, so sparse marks grow less.
export function orgMarkBalancedHeight(
  org: OrgKey,
  dotSize: number,
  strength = 0.5,
  bounds?: [number, number]
) {
  const target = dotSize * dotSize;
  const height =
    dotSize *
    Math.pow(target / inkAtHeight(org, dotSize), 0.5 * strength) *
    (orgMarks[org].weight ?? 1);
  const clamped = bounds
    ? Math.min(bounds[1], Math.max(bounds[0], height))
    : height;

  return Math.round(clamped * 100) / 100;
}

export function OrgMark({
  org,
  size = 16,
  fit = 'contain',
  className,
}: {
  org: OrgKey;
  size?: number;
  // `contain` fits the mark in a `size` square; `height` makes `size` the
  // height and lets the width follow the mark's aspect ratio.
  fit?: 'contain' | 'height';
  className?: string;
}) {
  const mark = orgMarks[org];
  const [, , boxWidth, boxHeight] = mark.box;
  const width =
    fit === 'height'
      ? Math.round(((size * boxWidth) / boxHeight) * 100) / 100
      : size;

  return (
    <svg
      width={width}
      height={size}
      viewBox={mark.box.join(' ')}
      fill="currentColor"
      aria-hidden
      data-org-mark={org}
      className={className}
    >
      {mark.paths.map((d, index) => (
        <path key={index} d={d} />
      ))}
    </svg>
  );
}
