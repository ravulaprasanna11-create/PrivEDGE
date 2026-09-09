/**
 * PRIVEDGE Phase 2: Browser Extension - Build Script
 * SIH26171: On-device Visual Perception for Light-weight Browser Agents (ISRO)
 * 
 * Compiles the TypeScript extension into a production-ready, loadable directory (dist/extension).
 * Zero extra dependencies: uses existing devDependency TypeScript.
 * Produces self-contained scripts compatible with Chrome (Manifest V3) and Firefox.
 */

import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const ROOT_DIR = process.cwd();
const EXTENSION_DIR = path.join(ROOT_DIR, 'extension');
const DIST_DIR = path.join(ROOT_DIR, 'dist', 'extension');

console.log('Building PRIVEDGE Phase 2 Browser Extension...');

// 1. Ensure output directories exist
fs.mkdirSync(DIST_DIR, { recursive: true });
fs.mkdirSync(path.join(DIST_DIR, 'background'), { recursive: true });
fs.mkdirSync(path.join(DIST_DIR, 'content'), { recursive: true });
fs.mkdirSync(path.join(DIST_DIR, 'icons'), { recursive: true });

// 2. Transpile TS to JS helper
function transpileTs(filePath) {
  const code = fs.readFileSync(filePath, 'utf8');
  const result = ts.transpileModule(code, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      removeComments: false
    }
  });
  return result.outputText;
}

// 3. Clean module imports/exports for self-contained bundle
function stripModuleSyntax(code) {
  return code
    .replace(/^import\s+type\s+.*?;?\r?\n/gm, '')
    .replace(/^import\s+.*?;?\r?\n/gm, '')
    .replace(/^export\s+(?:type|interface)\s+.*?;?\r?\n/gm, '')
    .replace(/^export\s+(const|let|var|function|class)\s+/gm, '$1 ')
    .replace(/^export\s*\{[^}]*\};?\r?\n/gm, '')
    .replace(/^export\s+default\s+.*?;?\r?\n/gm, '');
}

// 4. Build Content Script (Self-contained IIFE for maximum browser compatibility)
const contentFiles = [
  path.join(EXTENSION_DIR, 'background', 'messages.ts'),
  path.join(EXTENSION_DIR, 'content', 'accessibility.ts'),
  path.join(EXTENSION_DIR, 'content', 'dom.ts'),
  path.join(EXTENSION_DIR, 'content', 'content.ts')
];

let bundledContentJs = '/** PRIVEDGE Browser Agent - Content Script Bundle */\n(() => {\n';
for (const file of contentFiles) {
  const transpiled = transpileTs(file);
  bundledContentJs += `\n// --- ${path.basename(file)} ---\n` + stripModuleSyntax(transpiled) + '\n';
}
bundledContentJs += '})();\n';

fs.writeFileSync(path.join(DIST_DIR, 'content', 'content.js'), bundledContentJs, 'utf8');
console.log('  ✓ Built dist/extension/content/content.js');

// 5. Build Background Service Worker (Self-contained with Phase 1 Privacy Core and Phase 3 Perception)
const backgroundFiles = [
  path.join(ROOT_DIR, 'lib', 'privacy', 'patterns.ts'),
  path.join(ROOT_DIR, 'lib', 'privacy', 'policy.ts'),
  path.join(ROOT_DIR, 'lib', 'privacy', 'logger.ts'),
  path.join(ROOT_DIR, 'lib', 'privacy', 'detector.ts'),
  path.join(ROOT_DIR, 'lib', 'privacy', 'sanitizer.ts'),
  path.join(ROOT_DIR, 'lib', 'privacy', 'disclosure.ts'),
  path.join(ROOT_DIR, 'lib', 'privacy', 'validator.ts'),
  path.join(ROOT_DIR, 'lib', 'privacy', 'pipeline.ts'),
  path.join(ROOT_DIR, 'lib', 'perception', 'config.ts'),
  path.join(ROOT_DIR, 'lib', 'perception', 'runtime.ts'),
  path.join(ROOT_DIR, 'lib', 'perception', 'model.ts'),
  path.join(ROOT_DIR, 'lib', 'perception', 'detector.ts'),
  path.join(ROOT_DIR, 'lib', 'perception', 'processor.ts'),
  path.join(EXTENSION_DIR, 'perception', 'visual-perception.ts'),
  path.join(EXTENSION_DIR, 'background', 'messages.ts'),
  path.join(EXTENSION_DIR, 'background', 'service-worker.ts')
];

let bundledWorkerJs = '/** PRIVEDGE Browser Agent - Background Service Worker Bundle */\n';
for (const file of backgroundFiles) {
  const transpiled = transpileTs(file);
  bundledWorkerJs += `\n// --- ${path.basename(file)} ---\n` + stripModuleSyntax(transpiled) + '\n';
}

fs.writeFileSync(path.join(DIST_DIR, 'background', 'service-worker.js'), bundledWorkerJs, 'utf8');
console.log('  ✓ Built dist/extension/background/service-worker.js');

// 6. Copy Manifest V3
const manifestSrc = path.join(EXTENSION_DIR, 'manifest.json');
const manifestDest = path.join(DIST_DIR, 'manifest.json');
fs.copyFileSync(manifestSrc, manifestDest);
console.log('  ✓ Copied dist/extension/manifest.json');

// 7. Generate minimal SVG-based PNG placeholder icons if not present
const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="#0b132b"/>
  <path d="M32 12 L48 20 V34 C48 44 32 52 32 52 C32 52 16 44 16 34 V20 Z" fill="#00f0ff"/>
  <circle cx="32" cy="30" r="6" fill="#0b132b"/>
</svg>`;

for (const size of [16, 48, 128]) {
  const iconPath = path.join(DIST_DIR, 'icons', `icon${size}.png`);
  // Create an icon file or svg
  fs.writeFileSync(path.join(DIST_DIR, 'icons', `icon${size}.svg`), iconSvg, 'utf8');
  // Write a minimal valid 1x1 transparent PNG data if PNG doesn't exist
  if (!fs.existsSync(iconPath)) {
    const minPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );
    fs.writeFileSync(iconPath, minPng);
  }
}
console.log('  ✓ Generated extension icons');

console.log('\nExtension build complete: Ready to load unpacked in chrome://extensions\n');
