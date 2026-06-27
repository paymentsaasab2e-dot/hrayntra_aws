/**
 * Validates backend can boot. Run automatically via `pnpm start` (prestart hook).
 * Manual: node scripts/prestart-check.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fail(message) {
  console.error(`\n[prestart-check] ${message}\n`);
  process.exit(1);
}

const nodeMajor = Number(process.versions.node.split('.')[0]);
const nodeMinor = Number(process.versions.node.split('.')[1] || 0);
const nodePatch = Number(process.versions.node.split('.')[2]?.split('-')[0] || 0);

console.log(`[prestart-check] Node ${process.versions.node}`);

if (nodeMajor === 20 && (nodeMinor > 19 || (nodeMinor === 20 && nodePatch >= 2))) {
  console.warn(
    '[prestart-check] WARNING: Node 20.20+ can crash with ERR_INTERNAL_ASSERTION on CJS loads.',
  );
  console.warn('[prestart-check] Recommended: nvm install 22 && nvm use 22');
}

const prismaClientDir = path.join(root, 'node_modules', '.prisma', 'client');
const prismaIndex = path.join(prismaClientDir, 'index.js');
if (!fs.existsSync(prismaIndex)) {
  fail(
    'Prisma client not generated. Run:\n  cd backendphase2 && npx prisma generate',
  );
}

const prismaStat = fs.statSync(prismaIndex);
if (prismaStat.size < 100) {
  fail('Prisma client index.js looks empty/corrupt. Run: npx prisma generate');
}

const criticalFiles = [
  'node_modules/@prisma/client/default.js',
  'node_modules/express/index.js',
  'node_modules/ioredis/built/index.js',
];

for (const rel of criticalFiles) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) {
    fail(`Missing dependency file: ${rel}\nRun: pnpm install (or npm install) in backendphase2`);
  }
  const stat = fs.statSync(abs);
  if (stat.size === 0) {
    fail(`Empty/corrupt file: ${rel}\nDelete node_modules and reinstall dependencies.`);
  }
}

const modules = [
  './src/config/env.js',
  './src/config/prisma.js',
  './src/modules/auth/auth.routes.js',
  './src/routes/addCandidate.routes.js',
  './src/modules/ai/ai.routes.js',
  './src/app.js',
];

for (const mod of modules) {
  const label = mod.replace('./src/', '');
  process.stdout.write(`[prestart-check] import ${label} ... `);
  try {
    await import(pathToFileURL(path.join(root, mod.slice(2))).href);
    console.log('OK');
  } catch (err) {
    console.log('FAIL');
    console.error(err);
    fail(`Import failed: ${mod}. See error above.`);
  }
}

console.log('[prestart-check] All checks passed.\n');
