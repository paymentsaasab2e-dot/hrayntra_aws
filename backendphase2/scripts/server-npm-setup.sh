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
rm -f package-lock.json

echo "==> npm install (clean — do not mix with pnpm)"
npm install --legacy-peer-deps

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

echo "==> Starting with PM2 (if installed)"
if command -v pm2 >/dev/null 2>&1; then
  pm2 delete backendphase2 2>/dev/null || true
  pm2 start ecosystem.config.cjs --update-env
  pm2 save 2>/dev/null || true
  sleep 3
  if curl -sf "http://127.0.0.1:5001/health" >/dev/null; then
    echo "==> Health check OK: http://127.0.0.1:5001/health"
  else
    echo "WARN: Local health check failed. Run: pm2 logs backendphase2"
    pm2 logs backendphase2 --lines 30 --nostream 2>/dev/null || true
    exit 1
  fi
else
  echo "PM2 not installed. Start manually: npm start"
  echo "Or install PM2: npm install -g pm2"
fi

echo ""
echo "Setup OK. Public URL should respond after nginx: https://api2.hryantra.com/health"
