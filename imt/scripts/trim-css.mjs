// Drops CSS rules a page can never use from that page's inlined stylesheet,
// so the HTML lands in fewer network round trips. Runs after astro build.
// Keep in sync with lib/site-scripts.ts: classes/attributes scripts add at
// runtime must be safelisted, or their rules would be dropped.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { PurgeCSS } from 'purgecss';
import purgeHtml from 'purgecss-from-html';

const runtimeTokens = ['dark', 'light', 'ready', 'open'];

function htmlFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(full);
    return entry.name.endsWith('.html') ? [full] : [];
  });
}

let before = 0;
let after = 0;

for (const file of htmlFiles(path.join(process.cwd(), 'dist'))) {
  const html = readFileSync(file, 'utf8');
  const styles = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)];
  let output = html;

  for (const [tag, css] of styles) {
    const [result] = await new PurgeCSS().purge({
      content: [{ raw: html, extension: 'html' }],
      css: [{ raw: css }],
      extractors: [{ extractor: purgeHtml, extensions: ['html'] }],
      safelist: { standard: runtimeTokens },
    });
    output = output.replace(tag, `<style>${result.css}</style>`);
    before += css.length;
    after += result.css.length;
  }

  writeFileSync(file, output);
}

console.log(`trimmed inlined CSS from ${before} to ${after} bytes`);
