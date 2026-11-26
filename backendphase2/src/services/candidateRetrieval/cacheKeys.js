/**
 * Organization-aware candidate list cache keys.
 *
 * Key layout:
 *   candidate:{env}:{tenant}:{visibility}:{tab}:{perm}:{filterHash}:{sort}:{page}:{limit}:v{version}
 *
 * Isolation rules (correctness over hit-rate):
 *  - `tenant` and `env` are always part of the key  → orgs / environments never share.
 *  - Mine lists are scoped to the user id            → never shared between users.
 *  - All lists are shared ONLY between full-access Super Admins that look at the same
 *    org unit / side. Every other user gets a per-user entry because their visible rows
 *    depend on assignment, job ownership, home company and Switch-Companies picks —
 *    none of which can be fingerprinted without querying MongoDB.
 *  - Super Admin "Own work" (x-work-scope: own / mineOnly) is its own scope.
 */

import crypto from 'node:crypto';
import { getActiveTenantDbName } from '../../config/prisma.js';
import { isSuperAdminUser, isSuperAdminOwnWork } from '../../utils/superAdminScope.js';
import { canViewAllAssignments, hasAnyPermission } from '../../utils/permissionScope.js';
import { getPaginationParams } from '../../utils/pagination.js';

export function cacheEnvNamespace() {
  return String(process.env.CANDIDATE_ORG_CACHE_ENV || process.env.NODE_ENV || 'test')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 32) || 'test';
}

/** True when CANDIDATE_ORG_CACHE_ENV was set on purpose (vs. falling back to NODE_ENV). */
export function isCacheEnvExplicit() {
  return Boolean(String(process.env.CANDIDATE_ORG_CACHE_ENV || '').trim());
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

/**
 * Extra seconds an expired entry may still be served instantly while a fresh copy
 * loads in the background (stale-while-revalidate). 0 disables it.
 */
export function candidateOrgStaleSec() {
  const raw = process.env.CANDIDATE_ORG_CACHE_STALE_SEC;
  if (raw === undefined || raw === '') return 300;
  return Math.min(1800, Math.max(0, Number(raw) || 0));
}

/** Refresh-ahead after invalidation (re-warms the lists people were just looking at). */
export function isCandidateOrgWarmEnabled() {
  const raw = String(process.env.CANDIDATE_ORG_CACHE_WARM ?? '1').trim().toLowerCase();
  return !(raw === '0' || raw === 'false' || raw === 'no');
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

function truthyFlag(value) {
  return value === true || value === '1' || value === 'true' || value === 1;
}

/** Permissions as the permission middleware resolved them (req.userWithPermissions), else req.user. */
function resolvePermissions(req) {
  const raw = req?.userWithPermissions?.permissions || req?.user?.permissions || [];
  return Array.isArray(raw) ? [...new Set(raw.map(String))].sort() : [];
}

function resolveUserId(req) {
  return String(req?.user?.id || req?.userWithPermissions?.id || '').trim();
}

/** True for a Super Admin looking at the whole org (not "Own work"). */
function isFullAccessAdmin(req) {
  if (isSuperAdminOwnWork(req)) return false;
  return Boolean(isSuperAdminUser(req) || req?.userWithPermissions?.isSuperAdmin);
}

function orgScopeParts(req) {
  const q = req?.query || {};
  const h = req?.headers || {};
  return [
    String(h['x-org-unit-id'] || q.orgUnitId || '').trim(),
    String(h['x-org-side'] || q.orgSide || '').trim().toLowerCase(),
    String(q.companyId || '').trim(),
    String(q.recruitmentEnabled || '').trim().toLowerCase(),
  ];
}

/**
 * Permission / visibility fingerprint. Two requests may share a cache entry only
 * when this value is identical.
 */
export function buildPermScope(req, { mine, loadCommonPool } = {}) {
  const uid = resolveUserId(req);
  if (mine) {
    return `mine:${uid || 'anon'}`;
  }

  const own = isSuperAdminOwnWork(req);
  const full = isFullAccessAdmin(req);
  const canViewAll = canViewAllAssignments(req) || hasAnyPermission(req, ['view_all_candidates']);
  const perms = resolvePermissions(req).join(',');

  const identity = own ? `own:${uid}` : full ? 'sa' : `u:${uid}`;
  const fingerprint = stableHash(
    [
      identity,
      full ? 'full' : canViewAll ? 'viewAll' : 'scoped',
      ...orgScopeParts(req),
      loadCommonPool ? 'common1' : 'common0',
      perms,
    ].join('|'),
  );
  return `${full ? 'sa' : own ? 'own' : 'usr'}:${fingerprint}`;
}

const FILTER_KEYS = [
  'status',
  'assignedToId',
  'search',
  'ids',
  'matchingCandidateIds',
  'company',
  'location',
  'jobId',
  'experienceRange',
  'stage',
  'minExperience',
  'maxExperience',
  'sortBy',
  'sortDir',
  'order',
  'distinctPersonId',
];

/**
 * Hash of every filter that changes the returned rows. Mine / includeCommonPool /
 * sort / paging are intentionally NOT here — they have their own key segments.
 */
export function buildFilterHash(query = {}) {
  const q = query || {};
  const parts = FILTER_KEYS.map((k) => {
    let v = q[k];
    if (k === 'experienceRange') v = q.experienceRange ?? q.experience;
    return `${k}=${String(v ?? '').trim()}`;
  });
  parts.push(`picker=${truthyFlag(q.picker) ? 1 : 0}`);
  parts.push(`placementPicker=${truthyFlag(q.placementPicker) ? 1 : 0}`);
  return stableHash(parts.join('&'));
}

/**
 * Mirror candidateService.getAll paging so ?limit=500 and ?limit=100 (both clamped to
 * 100) map to ONE key, and ?pageSize=… (ignored by the API) does not create new keys.
 */
export function effectivePaging(req) {
  const q = req?.query || {};
  if (truthyFlag(q.picker) || truthyFlag(q.placementPicker)) {
    return { page: String(q.page || '1'), limit: String(q.limit || '') };
  }
  const pagination = getPaginationParams({ query: q });
  const cap = Math.min(200, Number(process.env.CANDIDATE_LIST_MAX_PAGE || 100) || 100);
  const limit = Math.min(Math.max(1, pagination.limit || 10), cap);
  return { page: String(pagination.page), limit: String(limit) };
}

/**
 * @returns {{ key: string, tenantId: string, tab: string, shareable: boolean, meta: object }}
 */
export function buildListCacheKey(req, { mine, loadCommonPool, version }) {
  const q = req?.query || {};
  const tenantId = resolveTenantId();
  const { page, limit } = effectivePaging(req);
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
    shareable: !mine && perm.startsWith('sa:'),
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

/** Key without the trailing version (used to remember "hot" views for refresh-ahead). */
export function stripKeyVersion(key) {
  return String(key || '').replace(/:v\d+$/, '');
}

export function orgCachePrefix(tenantId) {
  const tid = String(tenantId || resolveTenantId()).trim() || 'default';
  return `candidate:${cacheEnvNamespace()}:${tid}:`;
}
