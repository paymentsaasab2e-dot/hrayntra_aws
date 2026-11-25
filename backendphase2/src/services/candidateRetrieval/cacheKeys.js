/**
 * Organization-aware candidate list cache keys.
 * Mine lists stay user-scoped; All lists can be shared across same-permission recruiters.
 */

import crypto from 'node:crypto';
import { getActiveTenantDbName } from '../../config/prisma.js';

export function cacheEnvNamespace() {
  return String(process.env.CANDIDATE_ORG_CACHE_ENV || process.env.NODE_ENV || 'test')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 32) || 'test';
}

export function isCandidateOrgCacheEnabled() {
  const raw = String(process.env.CANDIDATE_ORG_CACHE_ENABLED || '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

export function candidateOrgCacheTtlSec() {
  return Math.min(
    600,
    Math.max(10, Number(process.env.CANDIDATE_ORG_CACHE_TTL_SEC || 60) || 60),
  );
}

function stableHash(input) {
  return crypto.createHash('sha1').update(String(input || '')).digest('hex').slice(0, 16);
}

function resolveTenantId() {
  try {
    return String(getActiveTenantDbName?.() || '').trim() || 'default';
  } catch {
    return 'default';
  }
}

/**
 * Permission fingerprint — users with different visibility must not share All-cache.
 */
export function buildPermScope(req, { mine, loadCommonPool }) {
  if (mine) {
    return `mine:${String(req?.user?.id || 'anon')}`;
  }
  const perms = Array.isArray(req?.user?.permissions)
    ? [...req.user.permissions].map(String).sort().join(',')
    : String(req?.user?.role || req?.user?.roleName || '');
  const orgUnit = String(
    req?.headers?.['x-org-unit-id'] || req?.query?.orgUnitId || '',
  ).trim();
  const viewAll = /view_all_candidates|all/i.test(perms) || req?.user?.role === 'SUPER_ADMIN';
  return stableHash(
    [
      viewAll ? 'viewAll' : 'scoped',
      orgUnit,
      loadCommonPool ? 'common1' : 'common0',
      perms.slice(0, 200),
    ].join('|'),
  );
}

export function buildFilterHash(query = {}) {
  const keys = [
    'status',
    'assignedToId',
    'search',
    'ids',
    'company',
    'location',
    'jobId',
    'experienceRange',
    'experience',
    'stage',
    'minExperience',
    'maxExperience',
    'sort',
    'sortBy',
    'sortDir',
    'order',
    'picker',
    'placementPicker',
  ];
  const parts = keys
    .map((k) => `${k}=${String(query?.[k] ?? '').trim()}`)
    .join('&');
  return stableHash(parts);
}

/**
 * @returns {{ key: string, tenantId: string, tab: string, shareable: boolean, meta: object }}
 */
export function buildListCacheKey(req, { mine, loadCommonPool, version }) {
  const q = req?.query || {};
  const tenantId = resolveTenantId();
  const page = String(q.page || '1');
  const limit = String(q.limit || q.pageSize || '10');
  const tab = mine ? 'mine' : 'all';
  const visibility = loadCommonPool ? 'combined' : 'private';
  const perm = buildPermScope(req, { mine, loadCommonPool });
  const filterHash = buildFilterHash(q);
  const sort = String(q.sort || q.sortBy || 'updated_desc').trim() || 'updated_desc';
  const ver = String(version || 1);
  const env = cacheEnvNamespace();

  const key = [
    'candidate',
    env,
    tenantId,
    visibility,
    tab,
    perm,
    filterHash,
    sort,
    page,
    limit,
    `v${ver}`,
  ].join(':');

  return {
    key,
    tenantId,
    tab,
    shareable: !mine,
    meta: {
      env,
      tenantId,
      visibility,
      tab,
      perm,
      filterHash,
      sort,
      page,
      limit,
      version: ver,
    },
  };
}

export function orgCachePrefix(tenantId) {
  const tid = String(tenantId || resolveTenantId()).trim() || 'default';
  return `candidate:${cacheEnvNamespace()}:${tid}:`;
}
