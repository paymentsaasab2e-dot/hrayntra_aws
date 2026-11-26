/**
 * Request-scoped MongoDB operation counter (AsyncLocalStorage).
 *
 * Prisma middleware (installed once per client in config/prisma.js) calls
 * `recordQueryOp` for every operation. When no counter is active the cost is a
 * single `getStore()` lookup, so this is safe to leave installed everywhere.
 *
 * Used by the candidate retrieval engine to report REAL operation counts per
 * request (not inferred / simulated).
 */

import { AsyncLocalStorage } from 'node:async_hooks';

const als = new AsyncLocalStorage();

const BLOCK_WRITES = ['1', 'true'].includes(String(process.env.PRISMA_BLOCK_WRITES || '').toLowerCase());
const WRITE_ACTIONS = new Set([
  'create',
  'createMany',
  'update',
  'updateMany',
  'upsert',
  'delete',
  'deleteMany',
  'executeRaw',
  'executeRawUnsafe',
  'runCommandRaw',
]);

export function isQueryCounterActive() {
  return Boolean(als.getStore());
}

/**
 * Record one DB operation into the active counter (no-op when none is active).
 * @param {string} db     which client ran it (tenant / jobportal / common / default)
 * @param {string} model  Prisma model (or "raw")
 * @param {string} action Prisma action
 * @param {number} ms     wall time of the operation
 */
export function recordQueryOp(db, model, action, ms) {
  const store = als.getStore();
  if (!store) return;
  store.ops += 1;
  store.dbMs += ms;
  const label = `${model || 'raw'}.${action || 'op'}`;
  store.byOp[label] = (store.byOp[label] || 0) + 1;
  store.byDb[db] = (store.byDb[db] || 0) + 1;
}

function snapshot(store) {
  return {
    ops: store.ops,
    // Sum of per-operation wall time (operations may overlap, so this can exceed total request time).
    dbMsSum: Math.round(store.dbMs),
    byOp: { ...store.byOp },
    byDb: { ...store.byDb },
  };
}

/**
 * Run `fn` with a fresh counter. Returns `{ result, stats }`.
 * Errors still propagate, with the partial `stats` attached as `error.queryStats`.
 */
export async function runWithQueryCounter(fn) {
  const store = { ops: 0, dbMs: 0, byOp: {}, byDb: {} };
  try {
    const result = await als.run(store, fn);
    return { result, stats: snapshot(store) };
  } catch (error) {
    try {
      error.queryStats = snapshot(store);
    } catch {
      /* ignore frozen errors */
    }
    throw error;
  }
}

/** Snapshot of the active counter (for progressive reads inside a run). */
export function peekQueryCounter() {
  const store = als.getStore();
  return store ? snapshot(store) : null;
}

/** Clients call this from `$use` middleware. */
export function installQueryCounter(client, dbLabel) {
  if (!client || typeof client.$use !== 'function' || client.__queryCounterInstalled) return;
  client.__queryCounterInstalled = true;
  client.$use(async (params, next) => {
    // Opt-in safety net for read-only measurement runs: PRISMA_BLOCK_WRITES=1 refuses any
    // write before it reaches MongoDB. Off by default (no effect on normal operation).
    if (BLOCK_WRITES && WRITE_ACTIONS.has(params.action)) {
      throw new Error(`[PRISMA_BLOCK_WRITES] blocked ${params.model || 'raw'}.${params.action}`);
    }
    if (!als.getStore()) return next(params);
    const t0 = performance.now();
    try {
      return await next(params);
    } finally {
      recordQueryOp(dbLabel, params.model, params.action, performance.now() - t0);
    }
  });
}
