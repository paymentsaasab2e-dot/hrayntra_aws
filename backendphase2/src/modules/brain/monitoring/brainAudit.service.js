/**
 * Brain monitoring / action audit.
 * Every tool call and answer is logged (tenant-scoped). Never fabricates data.
 */

import { getActiveTenantDbName } from '../../../config/prisma.js';
import logger from '../../../utils/logger.js';

/** In-process ring buffer for recent actions (per process). Horizontal scale: export to SIEM later. */
const RECENT = [];
const MAX_RECENT = 500;

/**
 * @param {{
 *  user: any;
 *  action: string;
 *  toolName?: string;
 *  entityIds?: string[];
 *  status: 'ok' | 'error' | 'denied' | 'skipped';
 *  inputSummary?: string;
 *  outputSummary?: string;
 *  meta?: Record<string, unknown>;
 *  durationMs?: number;
 * }} entry
 */
export function logBrainAction(entry) {
  const record = {
    id: `brain-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    tenantDbName: getActiveTenantDbName() || entry.user?.tenantDbName || entry.user?.orgId || null,
    userId: entry.user?.id || null,
    userEmail: entry.user?.email || null,
    role: entry.user?.role || entry.user?.systemRole?.roleName || null,
    action: String(entry.action || 'unknown'),
    toolName: entry.toolName || null,
    entityIds: Array.isArray(entry.entityIds) ? entry.entityIds : [],
    status: entry.status || 'ok',
    inputSummary: String(entry.inputSummary || '').slice(0, 500),
    outputSummary: String(entry.outputSummary || '').slice(0, 1000),
    durationMs: entry.durationMs ?? null,
    meta: entry.meta || {},
  };

  RECENT.push(record);
  if (RECENT.length > MAX_RECENT) RECENT.splice(0, RECENT.length - MAX_RECENT);

  logger.info({
    evt: 'brain_audit',
    ...record,
  });

  if (process.env.BRAIN_AUDIT_CONSOLE !== 'false') {
    console.log(
      `[BrainAudit] ${record.status} ${record.action}${record.toolName ? `/${record.toolName}` : ''} user=${record.userEmail || record.userId} tenant=${record.tenantDbName}`,
    );
  }

  return record;
}

export function listRecentBrainActions({ userId, limit = 50 } = {}) {
  const rows = userId ? RECENT.filter((r) => r.userId === userId) : RECENT;
  return rows.slice(-Math.min(200, Math.max(1, limit))).reverse();
}

export function getBrainHealthSnapshot() {
  const last5 = RECENT.slice(-5);
  const errors = RECENT.filter((r) => r.status === 'error').length;
  const denied = RECENT.filter((r) => r.status === 'denied').length;
  return {
    service: 'hryantra-brain',
    recentActions: RECENT.length,
    errorActions: errors,
    deniedActions: denied,
    lastActions: last5,
    timestamp: new Date().toISOString(),
  };
}

export const brainAudit = {
  logBrainAction,
  listRecentBrainActions,
  getBrainHealthSnapshot,
};
