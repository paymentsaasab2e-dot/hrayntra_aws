const path = require('path');
const fs = require('fs');

/** Only when this app lives under hrayntra_aws monorepo (parent has backendphase2). */
const parentDir = path.join(__dirname, '..');
const isMonorepoChild = fs.existsSync(path.join(parentDir, 'backendphase2'));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: process.env.UAT_SKIP_FRONT_GATES === '1' ? true : false,
  },
  eslint: {
    ignoreDuringBuilds: process.env.UAT_SKIP_FRONT_GATES === '1',
  },
  // Standalone Vercel deploy must NOT set this — it doubles /vercel/path0/path0/.next
  ...(isMonorepoChild
    ? { outputFileTracingRoot: parentDir }
    : {}),
  // Wide brand PNGs can fail the image optimizer ("received null"); serve statically.
  images: {
    unoptimized: true,
  },
  // Ensure SuperDoc (Word DOCX editor) is compiled for client bundles.
  transpilePackages: ['superdoc'],
  // Turbopack + pnpm symlink: resolve package name → real ESM entry (relative, no spaces issues).
  turbopack: {
    resolveAlias: {
      superdoc: './node_modules/superdoc/dist/superdoc.es.js',
    },
  },
  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      superdoc: path.join(__dirname, 'node_modules/superdoc/dist/superdoc.es.js'),
    };
    return config;
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
    serverActions: {
      bodySizeLimit: '64mb',
    },
  },
  // Avoid re-bundling heavy CJS libs during compile when possible
  serverExternalPackages: ['mammoth', 'pdf-lib', 'xlsx', 'html2canvas', 'jspdf'],
  outputFileTracingIncludes: {
    '/api/superdoc-style': [
      './public/superdoc/**/*',
      './node_modules/superdoc/dist/**/*',
      './node_modules/@superdoc/docx-engine/dist/**/*',
      './node_modules/.pnpm/**/node_modules/superdoc/dist/**/*',
      './node_modules/.pnpm/**/node_modules/@superdoc/docx-engine/dist/**/*',
    ],
    '/api/superdoc-worker': [
      './public/superdoc/**/*',
      './node_modules/superdoc/dist/**/*',
      './node_modules/@superdoc/docx-engine/dist/**/*',
      './node_modules/.pnpm/**/node_modules/superdoc/dist/**/*',
      './node_modules/.pnpm/**/node_modules/@superdoc/docx-engine/dist/**/*',
    ],
  },
};

module.exports = nextConfig;
