import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { listFiles } from './source-files.mjs';

const root = process.cwd();
const scannedDirs = ['src', 'components', 'data', 'lib', 'styles'];
const blocked = [
  'transition',
  'animate',
  'framer-motion',
  'react-spring',
  'ResizeObserver',
  'getBoundingClientRect',
  'requestAnimationFrame',
  'useEffect',
  'useLayoutEffect',
  'useSyncExternalStore',
  'canvas',
  'dither',
];
// Narrow, reviewed exceptions: file -> tokens it may contain.
const allowed = {};
const extensions = new Set(['.ts', '.tsx', '.css', '.astro']);
const issues = [];

for (const dir of scannedDirs) {
  const files = (await listFiles(path.join(root, dir))).filter((file) =>
    extensions.has(path.extname(file))
  );

  for (const fullPath of files) {
    const text = await readFile(fullPath, 'utf8');
    const relative = path.relative(root, fullPath);

    for (const token of blocked) {
      // Skip prose like "transitioned" (token followed by lowercase letters)
      // while still catching `transition-colors`, `canvasRef`, `useEffect(`.
      const pattern = new RegExp(`\\b${token}(?![a-z])`);

      if (pattern.test(text) && !allowed[relative]?.includes(token)) {
        issues.push(`${relative}: contains "${token}"`);
      }
    }
  }
}

if (issues.length > 0) {
  throw new Error(`No-motion check failed:\n${issues.join('\n')}`);
}

console.log('no-motion ok');
