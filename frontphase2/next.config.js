const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  // Monorepo: one lockfile in parent — keeps file tracing predictable
  outputFileTracingRoot: path.join(__dirname, '..'),
  webpack: (config, { dev }) => {
    // Avoid huge webpack disk cache (fixes ENOSPC on full disks during `next dev` / build)
    if (dev) {
      config.cache = false;
    }
    return config;
  },
};

module.exports = nextConfig;
