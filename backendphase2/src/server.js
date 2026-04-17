import app from './app.js';
import { env } from './config/env.js';
import { prisma } from './config/prisma.js';

const PORT = env.PORT || 5001;

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
  const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${env.NODE_ENV}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
  });

  server.on('error', (error) => {
    if (error?.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use.`);
      console.error('Stop the old backend process using this port, then run the server again.');
      console.error(`PowerShell tip: Get-NetTCPConnection -LocalPort ${PORT} -State Listen`);
      return;
    }

    console.error('Server failed to start:', error);
  });
}
