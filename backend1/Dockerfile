FROM node:20-bookworm-slim

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma

RUN npm config set legacy-peer-deps true
RUN npm install --legacy-peer-deps

COPY . .

RUN npx prisma generate

ENV NODE_ENV=production
EXPOSE 5000

CMD ["node", "src/server.js"]
