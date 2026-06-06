import { env } from '../config/env.js';

/**
 * Optional Prisma `take` for smart-search tenant snapshots.
 * Default: unlimited (all accessible rows). Set SMART_SEARCH_MAX_LEADS_CONTEXT to a
 * positive integer only if you need an ops-level cap for very large tenants.
 */
export function resolveSmartSearchTakeLimit() {
  const raw = String(env.SMART_SEARCH_MAX_LEADS_CONTEXT ?? '').trim();
  if (!raw || raw === '0') return undefined;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return parsed;
}

/** Spread into prisma.findMany — omits `take` when unlimited. */
export function smartSearchFindManyTake() {
  const take = resolveSmartSearchTakeLimit();
  return take ? { take } : {};
}
