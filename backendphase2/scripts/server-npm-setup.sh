#!/usr/bin/env bash
# Fresh npm install for production (Ubuntu). Run from backendphase2:
#   chmod +x scripts/server-npm-setup.sh && ./scripts/server-npm-setup.sh
set -euo pipefail

cd "$(dirname "$0")/.."
echo "==> backendphase2 npm setup (Node $(node -v))"

if ! command -v npm >/dev/null 2>&1; then
  echo "ERROR: npm not found. Install Node.js 22+ first."
  exit 1
fi

echo "==> Removing old installs (pnpm + npm artifacts)"
rm -rf node_modules
rm -f pnpm-lock.yaml

echo "==> npm install"
npm install

echo "==> prisma generate"
npx prisma generate

echo "==> Verifying Prisma client"
test -s node_modules/.prisma/client/index.js || {
  echo "ERROR: Prisma client missing. Check DATABASE_URL in .env and run: npx prisma generate"
  exit 1
}

echo "==> Scanning for empty/corrupt dependency files"
node scripts/scan-empty-deps.mjs

echo "==> Testing imports (find-startup-crash)"
node scripts/find-startup-crash.mjs

echo ""
echo "Setup OK. Start with: npm start"
