/**
 * Copy SuperDoc's stylesheet and document workers into public/superdoc.
 * Production serves these as static files. The /api copies 404 when the
 * standalone server cannot see node_modules, which leaves the resume editor blank.
 */
const { createRequire } = require('node:module');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const outDir = path.join(root, 'public', 'superdoc');

function resolveSuperdocEntry() {
  const require = createRequire(path.join(root, 'package.json'));
  return fs.realpathSync(require.resolve('superdoc'));
}

const entry = resolveSuperdocEntry();
const distDir = path.dirname(entry);
const engineDist = path.join(distDir, '..', '..', '@superdoc', 'docx-engine', 'dist');
const shell = fs.readFileSync(path.join(distDir, 'style.css'), 'utf8');
const engine = fs.readFileSync(path.join(engineDist, 'style.css'), 'utf8');
const css = shell.replace(
  /@import\s+["']@superdoc\/docx-engine\/style\.css["']\s*;/,
  () => engine,
);

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'style.css'), css);

const assetsDir = path.join(engineDist, 'assets');
const names = fs.readdirSync(assetsDir);

function copyWorker(prefix, destName) {
  const name = names.find((file) => file.startsWith(prefix) && file.endsWith('.js'));
  if (!name) {
    throw new Error(`SuperDoc ${prefix} worker was not found in ${assetsDir}`);
  }
  fs.copyFileSync(path.join(assetsDir, name), path.join(outDir, destName));
}

copyWorker('browser-worker-entry-', 'document-worker.js');
copyWorker('review-index-worker-entry-', 'review-worker.js');
console.log('Copied SuperDoc editor assets to public/superdoc');
