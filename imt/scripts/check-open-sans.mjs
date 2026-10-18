// Fails the build when a page renders a character that Google's Open Sans
// latin file has but the trimmed copy lacks (it would fall back to Arial).
// Fix: python3 scripts/subset-open-sans.py, then build again.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const css = readFileSync(
  path.join(root, 'styles', 'open-sans-latin.css'),
  'utf8'
);
const source = css.match(/source coverage: ([^*]+)\*/)[1].trim();
const trimmed = css.match(/unicode-range: ([^;]+);/)[1];

function inRange(range, codePoint) {
  return range.split(',').some((part) => {
    const [start, end = start] = part.trim().replace('U+', '').split('-');
    return codePoint >= parseInt(start, 16) && codePoint <= parseInt(end, 16);
  });
}

function htmlFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(full);
    return entry.name.endsWith('.html') ? [full] : [];
  });
}

const missing = new Set();
for (const file of htmlFiles(path.join(root, 'dist'))) {
  const text = readFileSync(file, 'utf8')
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex) =>
      String.fromCodePoint(parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_m, dec) => String.fromCodePoint(Number(dec)));
  for (const char of text) {
    const codePoint = char.codePointAt(0);
    if (
      codePoint >= 0x20 &&
      inRange(source, codePoint) &&
      !inRange(trimmed, codePoint)
    ) {
      missing.add(char);
    }
  }
}

if (missing.size > 0) {
  console.error(
    `Open Sans is missing ${[...missing].join(' ')}; run python3 scripts/subset-open-sans.py, then build again.`
  );
  process.exit(1);
}
console.log('Open Sans covers every rendered character');
