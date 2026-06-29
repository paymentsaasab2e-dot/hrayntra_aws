FROM node:22-bookworm-slim

WORKDIR /app

# Native deps for PDF/OCR pipelines (tesseract, image tooling)
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    graphicsmagick \
    ghostscript \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma

RUN npm config set legacy-peer-deps true
RUN npm install --legacy-peer-deps

COPY . .

RUN npx prisma generate

ENV NODE_ENV=production
EXPOSE 5001

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:5001/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/server.js"]
