import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client');

const globalForPrisma = globalThis;

// Initialize Prisma Client with proper error handling
let prismaInstance;

if (globalForPrisma.prisma) {
  // Reuse existing instance in development (hot reload)
  prismaInstance = globalForPrisma.prisma;
} else {
  try {
    prismaInstance = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });

    if (process.env.NODE_ENV !== 'production') {
      globalForPrisma.prisma = prismaInstance;
    }

    // Test the connection asynchronously (don't block initialization)
    prismaInstance.$connect().catch((error) => {
      console.error('⚠️  Failed to connect to database:', error.message);
      console.error('Please check your DATABASE_URL in .env file');
    });
  } catch (error) {
    console.error('❌ Failed to initialize Prisma Client:', error.message);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
    });
    console.error('Please ensure:');
    console.error('1. DATABASE_URL is set in .env file');
    console.error('2. Prisma client has been generated (run: npx prisma generate)');
    console.error('3. Database server is running and accessible');
    // Re-throw to prevent server from starting with invalid Prisma client
    throw error;
  }
}

// Optional structured logging for reads/writes.
// Enable by setting LOG_DB_DATA=true in backendphase2 environment.
const shouldLogDbData =
  process.env.LOG_DB_DATA === 'true' ||
  process.env.LOG_DB_QUERIES === 'true' ||
  process.env.NODE_ENV === 'development';

function safeStringify(value) {
  try {
    const str = JSON.stringify(value);
    if (str.length > 800) return `${str.slice(0, 800)}... (truncated)`;
    return str;
  } catch {
    return '[unserializable]';
  }
}

function summarizeResult(result) {
  if (Array.isArray(result)) return { type: 'array', length: result.length };
  if (result && typeof result === 'object') {
    const id = result.id ?? result._id;
    return { type: 'object', id: id ?? undefined, keys: Object.keys(result).slice(0, 20) };
  }
  return { type: typeof result, value: result };
}

if (shouldLogDbData && prismaInstance && typeof prismaInstance.$use === 'function') {
  prismaInstance.$use(async (params, next) => {
    const model = params.model || 'raw';
    const action = params.action;

    // Only log common operations to avoid noisy logs.
    const isInteresting =
      action.startsWith('find') ||
      ['create', 'update', 'upsert', 'delete', 'deleteMany', 'updateMany'].includes(action);

    if (!isInteresting) return next(params);

    const argsSummary = {};
    ['where', 'data', 'select', 'include', 'take', 'skip', 'orderBy'].forEach((k) => {
      if (params.args && params.args[k] !== undefined) argsSummary[k] = params.args[k];
    });

    console.log(`🔎 [Prisma] ${model}.${action} args=`, safeStringify(argsSummary));
    const result = await next(params);
    console.log(`✅ [Prisma] ${model}.${action} result=`, safeStringify(summarizeResult(result)));

    return result;
  });
}

export const prisma = prismaInstance;
