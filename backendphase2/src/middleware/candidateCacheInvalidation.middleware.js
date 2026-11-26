/**
 * Invalidates the organization's candidate list cache after a SUCCESSFUL mutation on any
 * route that can change what the candidate list shows (or who may see it).
 *
 * Why a middleware instead of per-controller calls: the audit found 40+ mutation paths
 * (uploads, bulk import, stage moves, submit-to-client, placements, jobs, roles/team,
 * portal sync, …) and only 3 invalidated. One choke point can't be forgotten.
 *
 * Guarantees:
 *  - runs only for POST/PUT/PATCH/DELETE and only when the response status is < 400,
 *    i.e. after the database write succeeded (failed writes never invalidate);
 *  - invalidates ONLY the organization that made the request;
 *  - the local version bump + L1 clear happen synchronously just before the response is
 *    flushed, so a client that refetches instantly never reads the pre-mutation entry;
 *    Redis (L2) cleanup and the refresh-ahead warm-up follow asynchronously;
 *  - when the organization cannot be determined it over-clears (safe) instead of skipping;
 *  - never throws and never blocks the response.
 *
 * Non-HTTP writers (background workers, jobs) are covered by service-level hooks
 * (e.g. updateCandidateStage) and bounded by the cache TTL.
 */

import { getActiveTenantDbName } from '../config/prisma.js';
import { resolvePublicApplyTenant } from './tenant-context.middleware.js';
import { isCandidateOrgCacheEnabled } from '../services/candidateRetrieval/cacheKeys.js';
import {
  invalidateOrgCandidateCaches,
  invalidateOrgCandidateCachesSync,
  invalidateAllOrgCandidateCaches,
} from '../services/candidateRetrieval/invalidation.service.js';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * [prefix, reason, excludeRegex?]
 * A request matches when its path starts with `prefix` and does not match `exclude`.
 */
const RULES = [
  // ATS candidates: create / update / delete / restore / purge / bulk / pipeline / interviews / tags / uploads
  ['/api/v1/candidates', 'candidates', /\/(parse-resume|notes)(\/|$)|\/interviews\/meeting-link$/],
  ['/api/v1/cv', 'cv', /\/parse-jobs(\/|$)/],
  // Jobs (assignment titles, public apply, close/delete)
  ['/api/v1/jobs', 'jobs', /\/(notes|files|process-jd-file|process-jd|portal-access)(\/|$)/],
  // Client submission, matches, pipeline, interviews, placements, stage changes
  ['/api/v1/matches', 'matches'],
  ['/api/v1/pipeline', 'pipeline'],
  ['/api/v1/interviews', 'interviews'],
  ['/api/v1/interview-applications', 'interview-applications'],
  ['/api/v1/placements', 'placements'],
  // Portal → Phase 2 sync (registration/apply/withdraw/offer) lands here
  ['/api/v1/internal', 'portal-sync'],
  // Visibility: users, roles, permissions, teams, departments, org units
  ['/api/v1/users', 'users'],
  ['/api/v1/team', 'team'],
  ['/api/v1/teams', 'teams'],
  ['/api/team', 'team'],
  ['/api/v1/roles', 'roles'],
  ['/api/roles', 'roles'],
  ['/api/v1/permissions', 'permissions'],
  ['/api/permissions', 'permissions'],
  ['/api/v1/departments', 'departments'],
  ['/api/departments', 'departments'],
  ['/api/v1/org-units', 'org-units'],
  // Organization visibility / discovery settings that change list content
  [
    '/api/v1/settings/org/recruitment-mode',
    'settings:recruitment-mode',
  ],
  ['/api/v1/settings/org/candidate-edit-fields', 'settings:candidate-fields'],
  ['/api/v1/settings/org/pipeline-template', 'settings:pipeline-template'],
];

/** Returns a short reason string when this write should invalidate, else null. Pure. */
export function classifyCandidateMutation(method, rawPath) {
  if (!WRITE_METHODS.has(String(method || '').toUpperCase())) return null;
  const path = String(rawPath || '').split('?')[0];
  for (const [prefix, reason, exclude] of RULES) {
    if (path === prefix || path.startsWith(`${prefix}/`)) {
      if (exclude && exclude.test(path)) return null;
      return reason;
    }
  }
  return null;
}

export function candidateCacheInvalidationMiddleware(req, res, next) {
  try {
    if (!isCandidateOrgCacheEnabled()) return next();
    const reason = classifyCandidateMutation(req.method, req.originalUrl || req.url);
    if (!reason) return next();

    // The tenant context middleware already ran, so the ALS store is available here.
    const capturedTenant = String(getActiveTenantDbName() || '').trim();
    const resolveTenant = () =>
      capturedTenant ||
      String(req.user?.tenantDbName || '').trim() ||
      String(resolvePublicApplyTenant(req) || '').trim();

    let syncDone = false;
    const originalEnd = res.end;
    res.end = function patchedEnd(...args) {
      if (!syncDone && res.statusCode < 400) {
        const tenant = resolveTenant();
        // Synchronous: the pre-mutation entry is gone before the client sees the response.
        if (tenant) syncDone = invalidateOrgCandidateCachesSync(`http:${reason}`, tenant) != null;
      }
      return originalEnd.apply(this, args);
    };

    res.once('finish', () => {
      if (res.statusCode >= 400) return; // failed write → nothing changed → keep the cache
      const tenant = resolveTenant();
      if (tenant) {
        void invalidateOrgCandidateCaches(`http:${reason}`, tenant, { alreadyBumped: syncDone });
      } else {
        void invalidateAllOrgCandidateCaches(`http:${reason}:unknown-tenant`);
      }
    });
  } catch (error) {
    console.warn('[candidateCacheInvalidation] middleware error:', error?.message || error);
  }
  return next();
}
