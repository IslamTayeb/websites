# websites

- `imt/` - [imt.sh](https://imt.sh), an Astro site built from React components.
  Pages render to static HTML at build time; no framework JavaScript ships to
  the browser. Vercel project `personal-website`.
- `apmoverflow/` - redirect shell. Sends old `apmoverflow.xyz` paths to `imt.sh/blog`.

`islamtayeb.dev` is abandoned. Do not reference it anywhere.

## Run

```sh
cd imt
npm install
npm run dev
```

## Check before committing

```sh
npm run build && npm test && npm run lint && npm run format:check && npm run test:visual
```

Blog posts live in `imt/posts/`. Rules for design and content are in `AGENTS.md`.
