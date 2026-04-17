const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  // Monorepo: one lockfile in parent — keeps file tracing predictable
  outputFileTracingRoot: path.join(__dirname, '..'),
};

module.exports = nextConfig;
