const path = require('path');
const fs = require('fs');

/** Only when this app lives under hrayntra_aws monorepo (parent has backendphase2). */
const parentDir = path.join(__dirname, '..');
const isMonorepoChild = fs.existsSync(path.join(parentDir, 'backendphase2'));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  // Standalone Vercel deploy must NOT set this — it doubles /vercel/path0/path0/.next
  ...(isMonorepoChild
    ? { outputFileTracingRoot: parentDir }
    : {}),
  // Wide brand PNGs can fail the image optimizer ("received null"); serve statically.
  images: {
    unoptimized: true,
  },
  // Shrinks client graphs for icon/chart/UI barrels (big win on /job, /dashboard compile).
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'recharts',
      '@mui/material',
      '@mui/icons-material',
      '@emotion/react',
      '@emotion/styled',
      'motion',
      'date-fns',
    ],
  },
  // Avoid re-bundling heavy CJS libs during compile when possible
  serverExternalPackages: ['mammoth', 'pdf-lib', 'xlsx', 'html2canvas', 'jspdf'],
};

module.exports = nextConfig;
