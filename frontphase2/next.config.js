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
  // SuperDoc ships prebuilt ESM — do not transpilePackages (Vue/jsdom/pdfjs OOM in Docker).
  // Resolve via alias; load only through dynamic import() in warmSuperDoc / ResumeDocxEditor.
  turbopack: {
    resolveAlias: {
      superdoc: './node_modules/superdoc/dist/superdoc.es.js',
    },
  },
  webpack: (config, { isServer, webpack: wp }) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      superdoc: path.join(__dirname, 'node_modules/superdoc/dist/superdoc.es.js'),
    };
    // Keep production client builds from pulling SuperDoc's node-only optional deps.
    if (!isServer) {
      config.plugins = config.plugins || [];
      config.plugins.push(
        new wp.IgnorePlugin({
          resourceRegExp: /^(canvas|@napi-rs\/canvas|jsdom)$/,
        }),
      );
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        fs: false,
        path: false,
        canvas: false,
      };
    }
    // Smaller parallel graph — helps Docker builders with tight RAM.
    if (process.env.NEXT_BUILD_WORKER_HEAP === '1' || process.env.DOCKER === '1') {
      config.parallelism = 1;
    }
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
    // Lower peak memory on constrained Docker hosts during `next build`.
    ...(process.env.DOCKER === '1' || process.env.NEXT_DISABLE_WEBPACK_CACHE === '1'
      ? { webpackMemoryOptimizations: true }
      : {}),
  },
  // Avoid re-bundling heavy CJS libs during compile when possible
  serverExternalPackages: [
    'mammoth',
    'pdf-lib',
    'xlsx',
    'html2canvas',
    'jspdf',
    'superdoc',
    '@superdoc/docx-engine',
  ],
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
