import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import browserslist from 'browserslist';
import { browserslistToTargets } from 'lightningcss';
import siteUrlConfig from './data/site-url.json' with { type: 'json' };

// Every page is prerendered to plain HTML with its CSS inlined; React only
// runs at build time. Redirects live in vercel.json (npm run generate:redirects).
export default defineConfig({
  site: siteUrlConfig.url,
  output: 'static',
  trailingSlash: 'never',
  build: {
    format: 'file',
    inlineStylesheets: 'always',
  },
  devToolbar: { enabled: false },
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    // Same browser targets the Next build used, so colors are lowered to the
    // same values (oklch -> lab) and render identically.
    css: {
      transformer: 'lightningcss',
      lightningcss: {
        targets: browserslistToTargets(
          browserslist(['chrome 111', 'edge 111', 'firefox 111', 'safari 16.4'])
        ),
      },
    },
  },
});
