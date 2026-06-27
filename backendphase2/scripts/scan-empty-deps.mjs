/**
 * Finds zero-byte JS/CJS/MJS files in critical node_modules paths.
 * Empty files cause ERR_INTERNAL_ASSERTION on Node 22+.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const criticalRoots = [
  'node_modules/@prisma/client',
  'node_modules/.prisma/client',
  'node_modules/express',
  'node_modules/ioredis',
  'node_modules/jsonwebtoken',
  'node_modules/socket.io',
  'node_modules/pdf-parse',
  'node_modules/bcryptjs',
  'node_modules/openai',
  'node_modules/zod',
];

const empty = [];
const missing = [];

function walk(dir, depth = 0) {
  if (depth > 8 || !fs.existsSync(dir)) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules') continue;
      walk(abs, depth + 1);
      continue;
    }
    if (!/\.(js|cjs|mjs)$/.test(ent.name)) continue;
    const stat = fs.statSync(abs);
    if (stat.size === 0) {
      empty.push(path.relative(root, abs));
    }
  }
}

for (const rel of criticalRoots) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) {
    missing.push(rel);
    continue;
  }
  walk(abs);
}

if (missing.length) {
  console.error('[scan-empty-deps] MISSING paths (run npm install):');
  missing.forEach((p) => console.error('  -', p));
  process.exit(1);
}

if (empty.length) {
  console.error('[scan-empty-deps] EMPTY files (corrupt install — delete node_modules and npm install):');
  empty.forEach((p) => console.error('  -', p));
  process.exit(1);
}

console.log('[scan-empty-deps] No empty files in critical dependencies.');
