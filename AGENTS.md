# AGENTS.md

## Repo layout

This repo has one production app and one production redirect shell:

- **`imt/`** -- the active Astro site for `imt.sh`, including the unified
  personal site and blog. Pages are React components rendered to static HTML
  at build time; no framework JavaScript ships to the browser.
- **`imt/bench/`** -- local benchmark results and scripts (git-ignored); see
  its `README.md`.
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
`imt/posts/`. Treat that directory as the source of truth for
blog content.

`apmoverflow.xyz` should remain a routing shell: old APM paths redirect to
`https://imt.sh/blog/...`. Both redirect tables derive from the post manifests
through `imt/lib/apm-redirects.mjs`: `npm run generate:redirects` in `imt/`
writes both `imt/vercel.json` (retired slugs plus host-conditioned APM
redirects) and `apmoverflow/vercel.json`. Re-run the generator after adding or
renaming a post; `npm run test:migration` fails when either config is stale.

## Main site commands

All active-site commands run from `imt/`:

```sh
npm run dev            # local dev server (astro dev)
npm run build          # typecheck + static build to dist/ + font check
npm start              # serve dist/ (astro preview)
npm run lint           # eslint
npm run format         # prettier --write .
npm run format:check   # prettier --check .
npm run generate:redirects   # rewrite imt/ and apmoverflow/ vercel.json from post manifests
npm test               # content + migration + pageview + no-motion
npm run test:content   # blog loading/rendering/feed validation
npm run test:migration # old-domain redirects + public payload checks
npm run test:pageview  # pageview webhook payload/routing validation
npm run test:no-motion # fail on motion/resizing/dither/canvas leftovers
npm run test:visual    # Playwright screenshots + DOM measurements against dist/ (build first; needs npx playwright install chromium once)
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
- **Reading metadata format:** Express every word count in thousands with
  uppercase `K` and always one decimal, including counts under 1,000 and whole
  thousands, and use parenthesized minutes, e.g. `1.0K words (4 mins)`,
  `3.0K words (12 mins)`, and `0.5K words (2 mins)`.
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
- **Blog voice:** Show, don't tell. When editing posts, cut lines that announce
  a feeling, a skill, or a takeaway (`I missed the stress of it`, `I've built
some fingerspitzengefühl`, `it got me thinking about...`, sentences that
  restate what a scene already showed). Let the concrete detail around them
  carry the point. Prefer cutting and reordering the author's own sentences
  over rewriting, and flag any new wording for review. `one-to-zero.md` is the
  voice reference.
- **Article headers:** Blog article title/date headers use tight section-like
  spacing: `mb-4 flex flex-col gap-1`.
- **Blog title weight:** Blog titles on the homepage writing preview, `/blog`
  index, and article pages should render at font-weight 600.
- **Blog post tags:** Every listed post gets exactly one validated `kind` in
  its JSON manifest: `technical` (built-and-measured write-ups, currently
  Decant and Harmonia) or `opinion` (everything else). Off-site writing in
  `data/external-writing.ts` also carries a `kind`, plus the `external` tag
  with its icon, rendered after the kind; there is no `New` tag. Every tag
  uses the same ink dotted border; tones only tint the fill. Kind fills follow
  existing section meaning: `technical` is yellow (research/publications),
  `opinion` is red (personal voice), `external` stays neutral. Blue is reserved for the writing
  section's hover accent and orange for experience "current" state. Hold at
  two kinds until a post clearly fits neither. Render all post labels through
  the shared `PostTags`/`Tag` primitives; keep tag text regular-weight, vertically aligned
  with its title line, and colored to match non-neutral tones. Do not hand-style
  labels in individual rails.
- **Blog manifests:** Use `listed: false` for source-backed pages that should
  exist at their slug but stay out of `/blog`, feeds, and sitemaps. Hidden
  source-backed pages still need old APM top-level redirect coverage when their
  `/blog/...` page exists. Use `allowHtml: true` only for posts that need raw
  HTML blocks. Manifests have no `summary` or `description` field; post pages
  deliberately set no meta description so they don't inherit the homepage bio.
- **Blog titles and renames:** Prefer plain, descriptive titles over quirky
  ones, and use the `On X` form only where it fits (`On Closing Doors`). When
  a post's slug changes, rename its `.md`/`.json` pair, append the retired
  slug to `previousSlugs` (oldest first), and re-run
  `npm run generate:redirects`. Retired slugs redirect permanently on
  `imt.sh/blog/...` and on the APM shell, and feed entry IDs stay on the first
  slug so readers don't see the post as new.
- **Page load:** The only client code is the inline scripts in
  `lib/site-scripts.ts`. Each page, background included, stays hidden
  (`html.js:not(.ready)`) until its fonts are loaded and the document is parsed, so the first visible frame
  is the finished page: no font swap, re-wrap, or theme flash. The reveal gives
  up after 3s; without JavaScript there is no `.js` class and nothing hides. Harmonia
  embeds start loading right after the reveal with `?theme=` in their URL.
  Interactions use the platform: experience groups are `<details>`, the theme
  toggle is a delegated click handler in the theme script.
- **Fonts:** Open Sans ships as Google's own subset files in `public/fonts/`,
  except latin. `styles/fonts.css` narrows each `unicode-range` to the
  characters the file really contains, so a page never downloads a subset just
  because Google's range claims a glyph (→ ↔ ↩ ⌘ ⌥) the file lacks. The latin
  face is trimmed to the characters the site renders and to weights 400-700 (the
  axis keeps its 400 and 700 masters, so used weights interpolate as before) by
  `scripts/subset-open-sans.py` (fontTools), which writes a content-hashed
  file and `styles/open-sans-latin.css`. The build fails when a page renders a
  character the trim lacks: run `python3 scripts/subset-open-sans.py`, then
  build again. The script keeps glyph names and the original font-wide bounds;
  dropping either shifts glyph antialiasing. Fonts are cached as immutable
  (`imt/vercel.json`), so a font file must get a new name whenever its bytes
  change. Keep the CSS on Lightning CSS with Next's old browser targets (see
  `astro.config.mjs`) so colors keep rendering identically.
- **Stylesheet:** one shared, content-hashed file in `/_astro/`, cached as
  immutable (`imt/vercel.json`), so after the first visit only a page's HTML
  travels. Keep each page's HTML under about 14 KB compressed so it fits in
  the first network round trip.
- **Prerendering:** a `speculationrules` block prerenders site pages as soon as
  a link is hovered (`eager`; Chrome/Edge). Inline scripts must handle prerendered pages: the
  pageview waits for `prerenderingchange`, and the theme is re-read then.
- **Pageview events:** The active site uses a tiny `sendBeacon` pageview script
  and the `api/pageview.ts` Vercel Function for Discord webhook notifications. Keep it
  post-response, avoid canvas/fingerprinting/external geolocation lookups, and
  use Vercel request geolocation headers for location context. Configure it
  with `SITE_VISIT_WEBHOOK_URL`, or the existing `DISCORD_WEBHOOK_URL` fallback;
  disable client emission with `PUBLIC_SITE_VISIT_EVENTS=false` (the old
  `NEXT_PUBLIC_SITE_VISIT_EVENTS` name still works) at build time or server
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

The main production Vercel project should build from `imt/`; `imt/vercel.json`
sets the Astro framework preset, clean URLs, and redirects.
`imt.sh` is the canonical domain. Keep crawler-facing metadata,
feeds, sitemaps, and old-domain redirect destinations on that host.

The existing `apm-overflow` Vercel project should build from `apmoverflow/`.
Keep `apmoverflow.xyz` and `www.apmoverflow.xyz` attached there unless the
domains are deliberately moved later. The shell `vercel.json` handles live
old-path redirects, while `imt/vercel.json` keeps equivalent
host-conditioned redirects ready if the domains are moved to the main project.
