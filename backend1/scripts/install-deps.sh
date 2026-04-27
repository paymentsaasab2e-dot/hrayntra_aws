#!/bin/bash
# Install Puppeteer dependencies for Linux (Debian/Ubuntu)
echo "🔍 Checking and installing Puppeteer dependencies..."

if [ -f /usr/bin/apt-get ]; then
  # We are on a Debian-based system
  apt-get update && apt-get install -y \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpangocairo-1.0-0 \
    libpango-1.0-0 \
    libharfbuzz0b \
    libnss3-dev \
    libgconf-2-4 \
    libxshmfence1 \
    --no-install-recommends
  echo "✅ Dependencies installation attempt completed."
else
  echo "⚠️ apt-get not found. Skipping auto-installation of system dependencies."
  echo "Please ensure libnss3 and other required libraries are installed manually."
fi
