#!/usr/bin/env node
/**
 * Copies the Pretendard woff2-subset files (Korean + Latin) used by the app
 * from the `pretendard` npm package into `public/fonts/subset/`, so Vite
 * ships them as static assets in `dist/`.
 *
 * Why this exists:
 *   - `@fontsource/pretendard` only ships the Latin subset, leaving Korean
 *     text to system fonts. We need Pretendard's Korean glyphs for
 *     consistent SNS-tone rendering on every device.
 *   - Pretendard's official `woff2-subset/` (used by Google Fonts and the
 *     Pretendard site) is ~270 KB per weight, balanced for Korean + Latin
 *     usage. Hosting it ourselves keeps the bundle self-contained, with
 *     no third-party CDN dependency.
 */
import { existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

// Weights used by the type system (see tailwind.config.js / src/index.css).
// File names match Pretendard's `dist/web/static/woff2-subset/` directory.
const WEIGHTS = [
  { weight: 400, file: 'Pretendard-Regular.subset.woff2' },
  { weight: 500, file: 'Pretendard-Medium.subset.woff2' },
  { weight: 600, file: 'Pretendard-SemiBold.subset.woff2' },
  { weight: 700, file: 'Pretendard-Bold.subset.woff2' },
];

const sourceDir = join(
  projectRoot,
  'node_modules',
  'pretendard',
  'dist',
  'web',
  'static',
  'woff2-subset',
);
const targetDir = join(projectRoot, 'public', 'fonts', 'subset');

if (!existsSync(sourceDir)) {
  console.error(
    `[copy-pretendard] Missing source: ${sourceDir}\n` +
      `              Install the 'pretendard' devDependency first.`,
  );
  process.exit(1);
}

mkdirSync(targetDir, { recursive: true });

let copied = 0;
for (const { file } of WEIGHTS) {
  const src = join(sourceDir, file);
  const dst = join(targetDir, file);
  copyFileSync(src, dst);
  copied += 1;
}

console.log(
  `[copy-pretendard] Copied ${copied} weight files to public/fonts/subset/`,
);
