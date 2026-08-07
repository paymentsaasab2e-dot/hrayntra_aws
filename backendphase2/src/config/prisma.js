import { AsyncLocalStorage } from 'async_hooks';
import dns from 'node:dns';
import { PrismaClient } from '@prisma/client';
import { env } from './env.js';
import logger from '../utils/logger.js';

// Prefer IPv4 when resolving Atlas hosts (Windows/ISP often fail intermittently on AAAA).
try {
  dns.setDefaultResultOrder('ipv4first');
} catch {
  // Older Node — ignore
}

const tenantContext = new AsyncLocalStorage();
const clientsByUrl = new Map();
const clientsWithLogging = new WeakSet();
const clientsWithWriteAudit = new WeakSet();

/**
 * Harden MongoDB Atlas URLs for flaky networks:
 * sensible selection / connect timeouts when not already set.
 * (Do not add driver-only options like `family` — Prisma rejects them.)
 */
export function normalizeMongoDatabaseUrl(rawUrl) {
  const value = String(rawUrl || '').trim();
  if (!value) return value;
  if (!/^mongodb(\+srv)?:\/\//i.test(value)) return value;
  try {
    const parsed = new URL(value);
    if (!parsed.searchParams.has('serverSelectionTimeoutMS')) {
      parsed.searchParams.set('serverSelectionTimeoutMS', '20000');
    }
    if (!parsed.searchParams.has('connectTimeoutMS')) {
      parsed.searchParams.set('connectTimeoutMS', '20000');
    }
    return parsed.toString();
  } catch {
    return value;
  }
}

/** True when the error is a transient Atlas / DNS / selection timeout. */
export function isTransientMongoConnectivityError(error) {
  const message = String(error?.message || error || '');
  return (
    /Server selection timeout/i.test(message) ||
    /No available servers/i.test(message) ||
    /No such host is known/i.test(message) ||
    /ENOTFOUND|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN/i.test(message) ||
    /ReplicaSetNoPrimary/i.test(message)
  );
}

function isTenantPrismaWriteLogEnabled() {
  const v = process.env.TENANT_WRITE_LOG;
  if (v === 'false' || v === '0') return false;
  return true;
}

/** Models where we already emit a dedicated activity line — skip duplicate DB-write noise */
const PRISMA_WRITE_AUDIT_SKIP_MODELS = new Set(['Activity']);

const PRISMA_WRITE_ACTIONS = new Set([
  'create',
  'createMany',
  'update',
  'updateMany',
  'upsert',
  'delete',
  'deleteMany',
]);

function strPreview(value, max = 48) {
  if (value === undefined || value === null) return '';
  const s = String(value).replace(/\s+/g, ' ').trim();
  if (!s) return '';
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function summarizePrismaWriteArgs(model, action, args) {
  if (!args) return '';
  try {
    if (args.where?.id) return `id=${args.where.id}`;
    if (args.where?._id) return `id=${args.where._id}`;
    if (action === 'createMany' && Array.isArray(args.data)) return `rows=${args.data.length}`;
    if (action === 'updateMany' || action === 'deleteMany') {
      const w = args.where;
      if (w && typeof w === 'object') return `where keys: ${Object.keys(w).slice(0, 6).join(', ')}`;
    }
    if (action === 'upsert') {
      const u = args.create || args.update;
      if (u && typeof u === 'object') {
        return summarizePrismaWriteArgs(model, 'create', { data: u });
      }
    }
    const d = args.data;
    if (d && typeof d === 'object' && !Array.isArray(d)) {
      const bits = [];
      if (d.title) bits.push(`title="${strPreview(d.title)}"`);
      if (d.companyName) bits.push(`company="${strPreview(d.companyName)}"`);
      if (d.subject) bits.push(`subject="${strPreview(d.subject)}"`);
      if (d.taskTitle) bits.push(`task="${strPreview(d.taskTitle)}"`);
      if (d.firstName || d.lastName) {
        bits.push(`name="${strPreview([d.firstName, d.lastName].filter(Boolean).join(' '))}"`);
      }
      if (d.status) bits.push(`status=${d.status}`);
      if (d.roleName) bits.push(`roleName="${strPreview(d.roleName)}"`);
      if (bits.length) return bits.join(', ');
    }
    return action;
  } catch {
    return '';
  }
}

function formatAuditUserLine(audit) {
  if (!audit) return '(no user in request context)';
  const name =
    [audit.firstName, audit.lastName].filter(Boolean).join(' ').trim() ||
    strPreview(audit.name, 80) ||
    audit.email ||
    audit.id;
  const role = audit.roleName || audit.role || '—';
  return `${name} | role: ${role}`;
}

function installTenantPrismaWriteAudit(client) {
  if (!client || typeof client.$use !== 'function' || clientsWithWriteAudit.has(client)) return;
  clientsWithWriteAudit.add(client);

  client.$use(async (params, next) => {
    const result = await next(params);
    const model = params.model;
    const action = params.action;
    if (!model || !PRISMA_WRITE_ACTIONS.has(action)) return result;
    if (PRISMA_WRITE_AUDIT_SKIP_MODELS.has(model)) return result;
    if (!isTenantPrismaWriteLogEnabled()) return result;

    const tenant = getActiveTenantDbName() || '(default)';
    const audit = tenantContext.getStore()?.auditUser;
    const detail = summarizePrismaWriteArgs(model, action, params.args);

    console.log('\n-------- Tenant DB write --------');
    console.log(`Tenant DB: ${tenant}`);
    console.log(`User: ${formatAuditUserLine(audit)}`);
    console.log(`Mutation: ${model}.${action}`);
    if (detail) console.log(`Detail: ${detail}`);
    console.log('---------------------------------\n');

    logger.info({
      evt: 'tenant_db_write',
      tenant,
      user: audit?.email || audit?.id,
      model,
      action,
      detail,
    });
    return result;
  });
}

const shouldLogDbData =
  process.env.LOG_DB_DATA === 'true' ||
  process.env.LOG_DB_QUERIES === 'true';

function withQueryLogging(client) {
  if (!shouldLogDbData || clientsWithLogging.has(client) || typeof client.$use !== 'function') {
    return client;
  }

  client.$use(async (params, next) => {
    const model = params.model || 'raw';
    const action = params.action;
    const isInteresting =
      action.startsWith('find') ||
      ['create', 'update', 'upsert', 'delete', 'deleteMany', 'updateMany'].includes(action);

    if (!isInteresting) return next(params);

    const start = Date.now();
    const activeTenant = tenantContext.getStore()?.tenantDbName || 'default';
    const result = await next(params);
    logger.debug({
      route: 'prisma',
      message: `${model}.${action} ${Date.now() - start}ms`,
      tenant: activeTenant,
    });
    return result;
  });

  clientsWithLogging.add(client);
  return client;
}

function createClientForUrl(url) {
  const client = new PrismaClient({
    datasources: {
      db: { url: normalizeMongoDatabaseUrl(url) },
    },
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
  installTenantPrismaWriteAudit(client);
  return withQueryLogging(client);
}

function isStalePrismaClient(client) {
  return !client || typeof client.interviewApplicationForm === 'undefined';
}

function getClientForUrl(url, { forceRecreate = false } = {}) {
  if (!url) {
    throw new Error('Database URL is required');
  }
  const normalizedUrl = normalizeMongoDatabaseUrl(url);
  if (forceRecreate && clientsByUrl.has(normalizedUrl)) {
    const stale = clientsByUrl.get(normalizedUrl);
    clientsByUrl.delete(normalizedUrl);
    stale?.$disconnect?.().catch(() => {});
  }
  let client = clientsByUrl.get(normalizedUrl);
  if (isStalePrismaClient(client)) {
    if (client) {
      clientsByUrl.delete(normalizedUrl);
      client.$disconnect?.().catch(() => {});
    }
    client = createClientForUrl(normalizedUrl);
    clientsByUrl.set(normalizedUrl, client);
  } else if (!client) {
    clientsByUrl.set(normalizedUrl, createClientForUrl(normalizedUrl));
    client = clientsByUrl.get(normalizedUrl);
  }
  return client;
}

function buildTenantDatabaseUrl(tenantDbName) {
  const normalized = String(tenantDbName || '').trim();
  if (!normalized) return '';

  const baseUrl = env.HEADQUARTERS_DATABASE_URL || env.DATABASE_URL;
  if (!baseUrl) return '';

  const parsed = new URL(normalizeMongoDatabaseUrl(baseUrl));
  parsed.pathname = `/${normalized}`;
  return parsed.toString();
}

const defaultDbUrl = normalizeMongoDatabaseUrl(env.DATABASE_URL);
if (!defaultDbUrl) {
  throw new Error('DATABASE_URL is not set in environment');
}

let defaultClient = getClientForUrl(defaultDbUrl);
defaultClient.$connect().catch((error) => {
  logger.error({ route: 'database', message: `Failed to connect to default database: ${error.message}` });
});

function getDefaultClientInstance() {
  if (isStalePrismaClient(defaultClient)) {
    defaultClient = getClientForUrl(defaultDbUrl, { forceRecreate: true });
    defaultClient.$connect().catch(() => {});
  }
  return defaultClient;
}

function getScopedClient() {
  const store = tenantContext.getStore();
  const tenantDbName = String(store?.tenantDbName || '').trim();

  if (tenantDbName) {
    const tenantDbUrl = buildTenantDatabaseUrl(tenantDbName);
    if (tenantDbUrl) {
      if (process.env.PRISMA_TENANT_DEBUG === 'true') {
        console.log(`[prisma] Scoped to: ${tenantDbName}`);
      }
      return getClientForUrl(tenantDbUrl);
    }
  }

  if (process.env.PRISMA_TENANT_DEBUG === 'true') {
    console.log('[prisma] Falling back to defaultClient');
  }
  return getDefaultClientInstance();
}

export function runWithTenantContext(tenantDbName, fn) {
  const store = {
    tenantDbName: String(tenantDbName || '').trim(),
    auditUser: null,
  };
  return tenantContext.run(store, fn);
}

export function getActiveTenantDbName() {
  return String(tenantContext.getStore()?.tenantDbName || '').trim();
}

/**
 * Attach authenticated user to the current ALS store (set after auth middleware).
 * Used by Prisma write-audit and other tenant-scoped logging.
 */
export function setTenantAuditUser(user) {
  const store = tenantContext.getStore();
  if (!store || !user) return;
  store.auditUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    roleName: user.systemRole?.roleName,
  };
}

export const prisma = new Proxy(defaultClient, {
  get(_target, property) {
    const client = getScopedClient();
    const value = client[property];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});

export function getDefaultPrismaClient() {
  return getDefaultClientInstance();
}

/** Prisma client for the job portal DB (applications timeline, portal-side candidate stage). */
let jobPortalClient = null;

export function getJobPortalPrismaClient() {
  const url = String(env.JOB_PORTAL_DATABASE_URL || env.DATABASE_URL || '').trim();
  if (!url) {
    return getDefaultPrismaClient();
  }
  if (!jobPortalClient) {
    jobPortalClient = getClientForUrl(url);
  }
  return jobPortalClient;
}

/** Prisma client for Phase 1 candidatecommon DB (full portal snapshots for AI matching). */
let candidateCommonClient = null;

export function resolveCandidateCommonDatabaseUrl() {
  const explicit = String(env.CANDIDATE_COMMON_DATABASE_URL || '').trim();
  if (explicit) return explicit;
  const base = String(env.DATABASE_URL || '').trim();
  if (!base) return '';
  try {
    const parsed = new URL(base);
    parsed.pathname = '/candidatecommon';
    return parsed.toString();
  } catch {
    return '';
  }
}

export function getCandidateCommonPrismaClient() {
  const url = resolveCandidateCommonDatabaseUrl();
  if (!url) return null;
  if (!candidateCommonClient) {
    candidateCommonClient = getClientForUrl(url);
  }
  return candidateCommonClient;
}
