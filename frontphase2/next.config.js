const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  // Monorepo: one lockfile in parent — keeps file tracing predictable
  outputFileTracingRoot: path.join(__dirname, '..'),
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
      'country-state-city',
    ],
  },
  // Avoid re-bundling heavy CJS libs during compile when possible
  serverExternalPackages: ['mammoth', 'pdf-lib', 'xlsx', 'html2canvas', 'jspdf'],
};

module.exports = nextConfig;
