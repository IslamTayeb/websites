# AGENTS.md

## Repo layout

This repo has one production app and one production redirect shell:

- **`imt/`** -- the active Next.js App Router site for
  `imt.sh`, including the unified personal site and blog.
- **`apmoverflow/`** -- a tiny static Vercel redirect shell for
  `apmoverflow.xyz`. It contains no authored content; it only sends old APM
  paths to `https://imt.sh/blog/...`.

There is no root `package.json`. Run commands from the project directory you
are changing.

## Active site intent

`imt/` is the official overhaul and replaces both the old
`imt.sh` app and the old `apmoverflow.xyz` static blog. The active site
uses: Open Sans + UI Mono, narrow document width, sharp borders, paper/ink
base, the `islam / blog` selector, the top ROYB bar, and strong ROYB accents.

The desired feel is elevated minimalism with real density: whitespace separates
ideas, not inflates the page. Keep it motionless: no animations, transitions,
render-time measurements, resize observers, canvas/dither experiments, autoplay
media, or animation libraries.

APM Overflow writing now lives as Markdown plus JSON manifests under
`imt/content/posts/`. Treat that directory as the source of truth for
blog content.

`apmoverflow.xyz` should remain a routing shell: old APM paths redirect to
`https://imt.sh/blog/...`. Both redirect tables derive from the post manifests
through `imt/lib/apm-redirects.mjs`: `imt/next.config.mjs` builds
host-conditioned redirects from it at build time, and `apmoverflow/vercel.json`
is written by `npm run generate:redirects` in `imt/`. Re-run the generator
after adding or renaming a post; `npm run test:migration` fails when the shell
config is stale.

## Main site commands

All active-site commands run from `imt/`:

```sh
npm run dev            # local dev server
npm run build          # Next production build
npm run lint           # eslint
npm run format         # prettier --write .
npm run format:check   # prettier --check .
npm run generate:redirects   # rewrite apmoverflow/vercel.json from post manifests
npm test               # content + migration + pageview + no-motion
npm run test:content   # blog loading/rendering/feed validation
npm run test:migration # old-domain redirects + public payload checks
npm run test:pageview  # pageview webhook payload/routing validation
npm run test:no-motion # fail on motion/resizing/dither/canvas leftovers
npm run test:visual    # Playwright screenshots + DOM measurements (needs npx playwright install chromium once)
```

Before considering active-site work done, run build, lint, format check,
`npm test`, and the visual test. Inspect the generated screenshots for visual
rhythm, not just pass/fail output.

## Verification discipline

Testing and verification are part of the fix. For every behavioral, layout,
interaction, routing, or content change, run or add a concrete check that proves
the intended behavior changed and surrounding behavior did not regress.

When iterating on visuals, prefer repeatable checks for rail spacing, selected
state behavior, responsive layout, link affordances, and contrast. If the
intended behavior or visual meaning is ambiguous, ask.

## Committing

Commit and push when the project is in a good rollback state. Before committing:

1. Run the active-site gates from `imt/`.
2. If formatting is off, run `npm run format` in the affected project, then
   re-run the relevant gates.

Use meaningful commit messages that describe the why.

## Key conventions

- **Package manager:** npm, with `package-lock.json`.
- **Path alias:** `@/*` maps to the active project root inside each app.
- **Styling:** Tailwind CSS 4 in the active site. Use shared CSS variables and
  primitives before hand-tuning individual sections.
- **Ledger background:** Desktop ruled-paper lines should use the shared 24px
  rhythm with the visible rule at the bottom of the tile, not a 12px half-offset.
  Keep `body` from margin-collapsing so the ledger origin stays at the viewport
  top.
- **Header / ROYB seam:** The site header draws no rule of its own. The
  ROYB band sits flush under it, bleeds across the page's 20px gutters with
  `-mx-5` so it spans the paper sheet on desktop and the screen on mobile, and
  keeps only its top and bottom ink rules (side rules would double the page
  frame). Spacing: 12px from wordmark to band (header `py-3`) and 16px from
  band to the first section (`pb-4`).
- **Links:** React-rendered hyperlinks should use
  `components/primitives/external-link.tsx`. Markdown-rendered article links
  should receive the same ROYB link classes in the renderer.
- **Experience advisor links:** In `imt/data/experience.ts`, use
  `href` when the whole experience title should link. Use `piHref` only when
  the advisor/mentor label should link while the organization/course title
  remains plain text.
- **Experience teaching labels:** Teaching rows use `piName` for role labels
  like `TA` or `Tutor`. Put collaborator/program context in the description as
  linked `descLinks`, e.g. `with Matthew Lentz, ...` or `with SAGE, ...`.
- **Experience date labels:** Capitalize display status words in experience
  dates, e.g. `Incoming Aug 2026` and `Aug 2025 - Present`. Keep internal
  `state` values lowercase.
- **Icon plus text links:** When a control has an icon plus a text label that
  should use the ROYB underline/highlight, keep the icon outside the underline
  span and wrap only the label in `RoybLinkText`. Use
  `royb-link-hover-scope` when the icon or gap should trigger the label hover
  state.
- **Clickable states:** Every clickable control needs deliberate default,
  hover, active/pressed, disabled/unavailable, and keyboard-focus states. The
  theme toggle is the narrow exception: base and keyboard-focus states only.
- **One-line compact copy:** Descriptions, summaries, excerpts, compact rails,
  course details, and previews should be concise and constrained with explicit
  one-line CSS where needed.
- **Rail detail scale:** Publication author/type rows and writing word/time
  metadata use `text-base` Open Sans reading copy. Rail dates remain compact
  `text-sm` mono.
- **Reading metadata format:** Abbreviate thousands with uppercase `K`, trim
  whole-number decimals, and use parenthesized minutes, e.g.
  `3K words (5 mins)`.
- **Publication text stacks:** Publication title/author/type stacks should own
  vertical rhythm with `flex flex-col gap-0.5`; avoid child `mt-*` margins.
- **Show-more actions:** Bare disclosure labels use `show more...`; labeled index
  actions put the ellipsis after the destination, e.g.
  `show more on blog...` and `show more on Scholar...`. Collapse controls use
  `show less...`.
- **Rail hover accents:** Neutral rail dots should hover/focus to the owning
  section color only when the primary title hyperlink is hovered/focused. Rail
  connector lines stay grey. Already-colored state markers such as `Present`
  and `Incoming` stay fixed.
- **Experience org marks:** Experience rows replace the square dot with the
  organization's mark from `components/primitives/org-marks.tsx`, keyed by
  `orgKey` in `data/experience.ts`. Marks are monochrome `currentColor`, take
  the dot's state color (present and incoming solid orange, ended neutral),
  hover like a neutral dot, and are sized by `orgMarkBalancedHeight`, which
  moves each mark halfway toward the 12px dot's filled area. They stay centered on the shared
  rail axis and may overhang the 12px box. New marks need a tight `box` and a
  raster-measured `ink` value; simplify fine detail so the mark reads at 12px.
- **Rail title/date balance:** On mobile rail rows, dates get width priority.
  Titles should give up space before dates wrap, while genuinely long dates can
  still wrap on narrow phones without creating horizontal overflow.
- **Mobile breakpoint:** For the active site, "mobile" means any viewport at or
  below the named `--site-mobile-breakpoint` token. Desktop form starts at
  `--site-desktop-breakpoint`. Keep those form breakpoints separate from
  `--site-paper-max-width`, which preserves the old paper sheet width. At the
  desktop breakpoint and above, the desktop paper sheet, ledger background, hero
  portrait, and footer quote/credit may appear; at mobile widths, keep the shell
  full-width and textureless with the page background behind overscroll.
- **Blog internals:** Active posts should use local `/blog/...` links for links
  to other posts. Do not link active content back to `apmoverflow.xyz`.
- **Article headers:** Blog article title/date headers use tight section-like
  spacing: `mb-4 flex flex-col gap-1`.
- **Blog title weight:** Blog titles on the homepage writing preview, `/blog`
  index, and article pages should render at font-weight 600.
- **Blog post tags:** Use the validated `kind` field in a post's JSON manifest
  for durable labels such as `technical`; currently only Decant and Harmonia
  are tagged. Off-site writing gets the `external` tag; there is no `New` tag.
  Render all post labels through the shared
  `PostTags`/`Tag` primitives; keep tag text regular-weight, vertically aligned
  with its title line, and colored to match non-neutral tones. Do not hand-style
  labels in individual rails.
- **Blog manifests:** Use `listed: false` for source-backed pages that should
  exist at their slug but stay out of `/blog`, feeds, and sitemaps. Hidden
  source-backed pages still need old APM top-level redirect coverage when their
  `/blog/...` page exists. Use `allowHtml: true` only for posts that need raw
  HTML blocks. Every manifest carries a one-line `summary` (96 characters or
  fewer) used for the meta description, feeds, and JSON-LD; there is no
  `description` field.
- **Pageview events:** The active site uses a tiny `sendBeacon` pageview script
  and `/api/pageview` route for Discord webhook notifications. Keep it
  post-response, avoid canvas/fingerprinting/external geolocation lookups, and
  use Vercel request geolocation headers for location context. Configure it
  with `SITE_VISIT_WEBHOOK_URL`, or the existing `DISCORD_WEBHOOK_URL` fallback;
  disable client emission with `NEXT_PUBLIC_SITE_VISIT_EVENTS=false` or server
  delivery with `SITE_VISIT_EVENTS_ENABLED=false`.
- **Pageview notification detail:** Discord pageview messages may use emojis for
  section clarity, but location must be labeled as approximate network location.
  Do not ask visitors for browser geolocation permission. Bot detection should
  stay passive and heuristic unless a deliberate BotID-style integration is
  planned.
- **Pageview history:** Persist accepted pageviews post-response to private Neon
  Postgres through the server-only `DATABASE_URL`; keep the schema migration in
  `imt/db/migrations/`. Store the raw request IP and every normalized
  client/request field, but expose no public read API or visitor dashboard.
  Enrich only ASN/network ownership through IPinfo. Prefer IPinfo Lite with the
  server-only `SITE_VISIT_IPINFO_TOKEN`; when no token is configured, use the
  supported tokenless `/org` endpoint as a best-effort fallback. Ignore provider
  geolocation and continue using Vercel headers for location. Database and
  Discord failures must stay independent so either destination can succeed on
  its own.
- **Tables:** Blog tables use Obsidian-like intrinsic sizing: auto layout,
  small per-column minimums, normal wrapping, and no internal horizontal table
  scrollbars unless a post intentionally needs custom markup.
- **Favicon:** The active favicon is the moon glyph on a transparent
  background. Keep the crescent cutout transparent. Its SVG should react to
  browser color scheme: off-black (`#1C1C1C`) in light chrome and `#FAFAFA` in
  dark chrome. Keep PNG and ICO fallbacks generated from the same crescent
  geometry, including `apple-icon.png`, `icon-light-32x32.png`,
  `icon-dark-32x32.png`, and `favicon.ico`.
- **Repeated UI:** if something is used more than once, make it a component.
- **Profile picture:** Generate hero profile assets from source photos with
  `npm run render:profile-picture -- /absolute/path/to/source-image` inside
  `imt/`. This writes both `public/me.webp` and
  `public/hero-portrait.png` with the established 384px crop and transparent
  square edge mask.

## Deployment

The main production Vercel project should build from `imt/`.
`imt.sh` is the canonical domain. Keep crawler-facing metadata,
feeds, sitemaps, and old-domain redirect destinations on that host.

The existing `apm-overflow` Vercel project should build from `apmoverflow/`.
Keep `apmoverflow.xyz` and `www.apmoverflow.xyz` attached there unless the
domains are deliberately moved later. The shell `vercel.json` handles live
old-path redirects, while `imt/next.config.mjs` keeps equivalent
host-conditioned redirects ready if the domains are moved to the main project.
