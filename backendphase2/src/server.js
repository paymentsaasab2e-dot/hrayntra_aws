import http from 'http';
import { Server } from 'socket.io';
import app from './app.js';
import { env } from './config/env.js';
import { prisma } from './config/prisma.js';
import { attachBulkCvSocket } from './socket/bulkCvSocket.js';

const PORT = env.PORT || 5001;

const SOCKET_CORS_ORIGINS = (
  process.env.FRONTEND_URLS ||
  `${env.FRONTEND_URL},http://localhost:3000,http://localhost:3001,https://frontendphase2.vercel.app,https://phase2.saasab2e.com`
)
  .split(',')
  .map((v) => v.trim())
  .filter(Boolean);

if (!prisma) {
  console.error('Prisma client is not initialized. Server cannot start.');
  console.error('Please check:');
  console.error('1. DATABASE_URL is set in .env file');
  console.error('2. Prisma client has been generated (run: npx prisma generate)');
  console.error('3. Database connection is available');
  process.exit(1);
}

prisma
  .$connect()
  .then(() => {
    console.log('Database connection established');
    startServer();
  })
  .catch((error) => {
    console.error('Failed to connect to database:', error.message);
    console.error('Server will start but database operations may fail.');
    console.error('Please check your DATABASE_URL in .env file');
    startServer();
  });

function startServer() {
  const httpServer = http.createServer(app);

  const io = new Server(httpServer, {
    cors: {
      origin: SOCKET_CORS_ORIGINS,
      credentials: true,
    },
  });
  attachBulkCvSocket(io);
  console.log('[bulk-cv] Socket.IO attached for duplicate resolution');

  let isShuttingDown = false;

  const shutdown = async (exitCode = 0) => {
    if (isShuttingDown) {
      return;
    }
    isShuttingDown = true;

    await new Promise((resolve) => {
      httpServer.close(() => resolve());
    });

    try {
      await prisma.$disconnect();
    } catch {
      // Ignore disconnect errors during shutdown.
    }

    process.exit(exitCode);
  };

  process.once('SIGINT', () => {
    console.log('\nShutting down server...');
    shutdown(0);
  });
  process.once('SIGTERM', () => shutdown(0));

  const server = httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${env.NODE_ENV}`);
    console.log(
      `[ai] OpenAI: ${env.OPENAI_CHAT_MODEL} (${env.OPENAI_API_KEY ? 'key set' : 'no key'}) · Mistral fallback: ${env.MISTRAL_CHAT_MODEL} (${env.MISTRAL_API_KEY ? 'key set' : 'no key'})`
    );
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`Invite/email login links use FRONTEND_URL: ${env.FRONTEND_URL}`);
    if (
      env.NODE_ENV === 'production' &&
      /localhost|127\.0\.0\.1/i.test(env.FRONTEND_URL)
    ) {
      console.error(
        '[config] FRONTEND_URL still points to localhost in production. Team invite emails will contain broken links. Set FRONTEND_URL=https://employers.hryantra.com (or APP_PUBLIC_URL) on this API server.'
      );
    }
  });

  server.on('error', (error) => {
    if (error?.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use.`);
      console.error('Stop the old backend process using this port, then run the server again.');
      console.error(
        `PowerShell tip: pnpm dev:stop`
      );
      shutdown(1);
      return;
    }

    console.error('Server failed to start:', error);
    shutdown(1);
  });
}
