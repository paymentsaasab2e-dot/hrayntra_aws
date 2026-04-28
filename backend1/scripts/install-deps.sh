#!/bin/bash
# High-comprehensive Puppeteer dependency installer for AWS/Linux environments
echo "--------------------------------------------------------"
echo "🔍 STARTING SYSTEM DEPENDENCY CHECK FOR PUPPETEER"
echo "--------------------------------------------------------"

# Check if we are on a Debian/Ubuntu system
if [ -f /usr/bin/apt-get ]; then
  echo "📦 Detected Debian-based system. Updating packages..."
  
  # Use -y for non-interactive and avoid some common lock issues
  sudo apt-get update || apt-get update
  
  echo "📥 Installing required shared libraries..."
  sudo apt-get install -y \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils \
    libgbm-dev \
    libxshmfence1 \
    --no-install-recommends

  echo "✅ Dependencies installation attempt completed."
else
  echo "⚠️ apt-get not found. This might not be a Debian-based environment."
  echo "Please ensure the following libraries are installed manually: libnss3, libatk, libgbm, libXfixes"
fi

echo "--------------------------------------------------------"
echo "🏁 DEPENDENCY CHECK FINISHED"
echo "--------------------------------------------------------"
