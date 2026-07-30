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
};

module.exports = nextConfig;
