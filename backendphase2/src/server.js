import app from './app.js';
import { env } from './config/env.js';
import { prisma } from './config/prisma.js';

const PORT = env.PORT || 5001;

// Verify Prisma client is initialized
if (!prisma) {
  console.error('❌ Prisma client is not initialized. Server cannot start.');
  console.error('Please check:');
  console.error('1. DATABASE_URL is set in .env file');
  console.error('2. Prisma client has been generated (run: npx prisma generate)');
  console.error('3. Database connection is available');
  process.exit(1);
}

// Test database connection on startup
prisma.$connect()
  .then(() => {
    console.log('✅ Database connection established');
    startServer();
  })
  .catch((error) => {
    console.error('❌ Failed to connect to database:', error.message);
    console.error('Server will start but database operations may fail.');
    console.error('Please check your DATABASE_URL in .env file');
    startServer();
  });

function startServer() {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📝 Environment: ${env.NODE_ENV}`);
    console.log(`🌐 Health check: http://localhost:${PORT}/health`);
  });
}
