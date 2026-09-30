import { prisma, getJobPortalPrismaClient } from '../../config/prisma.js';
import { USER_BRIEF_SELECT } from '../../utils/listAuditMeta.js';
import { buildSuperAdminOwnerScope, isSuperAdminUser } from '../../utils/superAdminScope.js';
import { canViewAllAssignments, hasAnyPermission as hasAnyPermissionScope } from '../../utils/permissionScope.js';
import {
  applyOrgCompanyAssigneeWhere,
  getRequestOrgScope,
  isOrgHeadPurpose,
} from '../../services/orgListScope.service.js';
import { buildAssigneeVisibilityOr } from '../../services/memberVisibility.service.js';
import { fetchCandidateCommonByCandidateId } from '../../services/candidateCommon/candidateCommonPool.service.js';

export const candidateDetailInclude = {
  assignedTo: {
    select: { id: true, name: true, email: true, avatar: true },
  },
  createdBy: {
    select: USER_BRIEF_SELECT,
  },
  interviews: {
    include: {
      interviewer: {
        select: { id: true, name: true, email: true, avatar: true, role: true, department: true },
      },
      job: {
        select: { id: true, title: true },
      },
      client: {
        select: { id: true, companyName: true },
      },
    },
    orderBy: { scheduledAt: 'desc' },
  },
  placements: true,
  matches: {
    include: {
      job: {
        select: {
          id: true,
          title: true,
          client: { select: { companyName: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  },
  pipelineEntries: {
    include: {
      stage: true,
      movedBy: {
        select: { id: true, name: true, email: true, avatar: true },
      },
    },
    orderBy: { movedAt: 'desc' },
  },
  applications: {
    select: {
      id: true,
      jobId: true,
      status: true,
      appliedAt: true,
      job: { select: { id: true, title: true } },
    },
    orderBy: { appliedAt: 'desc' },
    take: 30,
  },
};

/**
 * Fetch candidate details for candidate drawer with segmented fallbacks and timing telemetry.
 */
export async function getCandidateDetailsById(id, req = null, helpers = {}) {
  const tStart = performance.now();
  const viewerUserId = req?.user?.id || null;

  const {
    isTenantScopedRequest = () => false,
    getTenantJobIdSet = async () => null,
    scopeCandidateForActiveTenant = (c) => c,
    annotateCandidateListFlags = (c) => c,
    fetchPortalCareerPreferencesRaw,
    mergeCareerPreferencesIntoCandidate,
    hydrateAndPersistCandidateCvProfile,
    buildCandidateResponse,
    enrichCandidateDetailJobTitles,
    mergePortalAndTenantCandidateRow,
    isPhase1CandidateSource,
  } = helpers;

  const tenantJobIdSet = isTenantScopedRequest() ? await getTenantJobIdSet() : null;

  const annotateForTenant = (row) =>
    annotateCandidateListFlags(scopeCandidateForActiveTenant(row, tenantJobIdSet), tenantJobIdSet);

  const superAdminScope = buildSuperAdminOwnerScope(req, ['createdById', 'assignedToId']);
  let accessScope = superAdminScope;
  const canViewAllCandidates =
    canViewAllAssignments(req) || hasAnyPermissionScope(req, ['view_all_candidates']);

  if (!isSuperAdminUser(req) && !canViewAllCandidates && req?.user?.id) {
    const org = await getRequestOrgScope(req);
    if (!isOrgHeadPurpose(org)) {
      const assignedScope = { OR: buildAssigneeVisibilityOr(req.user.id) };
      accessScope = accessScope ? { AND: [accessScope, assignedScope] } : assignedScope;
    }
  }
  const orgScope = await applyOrgCompanyAssigneeWhere(req, {
    assignedToIdField: 'assignedToId',
    createdByField: 'createdById',
  });
  if (orgScope) {
    accessScope = accessScope ? { AND: [accessScope, orgScope] } : orgScope;
  }

  const baseTenantWhere = { id, isDeleted: { not: true } };
  let candidate = null;
  try {
    candidate = await prisma.candidate.findFirst({
      where: accessScope ? { AND: [baseTenantWhere, accessScope] } : baseTenantWhere,
      include: candidateDetailInclude,
    });
  } catch (err) {
    if (!/ObjectID|Malformed/i.test(err?.message || '')) {
      console.warn('[candidate-details.service] candidate lookup failed:', err?.message || err);
    }
  }

  if (!candidate && isTenantScopedRequest()) {
    let portalPrisma = null;
    try {
      portalPrisma = getJobPortalPrismaClient();
    } catch {
      portalPrisma = null;
    }

    const [tombstone, purgedRef, commonCandidate] = await Promise.all([
      prisma.candidate.findFirst({
        where: { id, isDeleted: true },
        select: { id: true },
      }),
      prisma.purgedCandidateRef
        .findUnique({ where: { candidateId: id }, select: { candidateId: true } })
        .catch(() => null),
      fetchCandidateCommonByCandidateId(id, { requireVerified: false }),
    ]);

    // Phase 1 pool row still opens in the drawer even if tenant soft-deleted the same id.
    if (commonCandidate && (tombstone || purgedRef)) {
      const careerPrefs = fetchPortalCareerPreferencesRaw
        ? await fetchPortalCareerPreferencesRaw(portalPrisma, id)
        : null;
      if (mergeCareerPreferencesIntoCandidate) mergeCareerPreferencesIntoCandidate(commonCandidate, careerPrefs);
      if (hydrateAndPersistCandidateCvProfile) await hydrateAndPersistCandidateCvProfile(commonCandidate, portalPrisma);
      const res = buildCandidateResponse
        ? await buildCandidateResponse(
            enrichCandidateDetailJobTitles
              ? await enrichCandidateDetailJobTitles(annotateForTenant(commonCandidate), tenantJobIdSet)
              : annotateForTenant(commonCandidate),
            portalPrisma,
            viewerUserId,
          )
        : annotateForTenant(commonCandidate);
      return res;
    }
    if (tombstone || purgedRef) {
      return null;
    }

    if (portalPrisma) {
      candidate = await portalPrisma.candidate.findFirst({
        where: { id },
        include: candidateDetailInclude,
      });
      if (candidate) {
        const commonRow = await fetchCandidateCommonByCandidateId(id, { requireVerified: false });
        if (commonRow && mergePortalAndTenantCandidateRow) {
          candidate = mergePortalAndTenantCandidateRow(commonRow, candidate);
        }
        const careerPrefs = fetchPortalCareerPreferencesRaw
          ? await fetchPortalCareerPreferencesRaw(portalPrisma, candidate.id)
          : null;
        if (mergeCareerPreferencesIntoCandidate) mergeCareerPreferencesIntoCandidate(candidate, careerPrefs);
        if (hydrateAndPersistCandidateCvProfile) await hydrateAndPersistCandidateCvProfile(candidate, portalPrisma);
        const res = buildCandidateResponse
          ? await buildCandidateResponse(
              enrichCandidateDetailJobTitles
                ? await enrichCandidateDetailJobTitles(annotateForTenant(candidate), tenantJobIdSet)
                : annotateForTenant(candidate),
              portalPrisma,
              viewerUserId,
            )
          : annotateForTenant(candidate);
        return res;
      }
    }

    if (commonCandidate) {
      const careerPrefs = fetchPortalCareerPreferencesRaw
        ? await fetchPortalCareerPreferencesRaw(portalPrisma, id)
        : null;
      if (mergeCareerPreferencesIntoCandidate) mergeCareerPreferencesIntoCandidate(commonCandidate, careerPrefs);
      if (hydrateAndPersistCandidateCvProfile) await hydrateAndPersistCandidateCvProfile(commonCandidate, portalPrisma);
      const res = buildCandidateResponse
        ? await buildCandidateResponse(
            enrichCandidateDetailJobTitles
              ? await enrichCandidateDetailJobTitles(annotateForTenant(commonCandidate), tenantJobIdSet)
              : annotateForTenant(commonCandidate),
            portalPrisma,
            viewerUserId,
          )
        : annotateForTenant(commonCandidate);
      return res;
    }
  }

  if (!candidate) return null;

  // Always merge Phase 1 common-pool profile (same candidateId) into the drawer payload.
  const commonCandidate = await fetchCandidateCommonByCandidateId(id, { requireVerified: false });
  if (commonCandidate) {
    if (mergePortalAndTenantCandidateRow) {
      candidate = mergePortalAndTenantCandidateRow(commonCandidate, candidate);
    }
    if (isPhase1CandidateSource && !isPhase1CandidateSource(candidate.source)) {
      candidate = { ...candidate, source: 'phase1' };
    }
  }

  let portalClientForPrefs = null;
  try {
    portalClientForPrefs = getJobPortalPrismaClient();
  } catch {
    portalClientForPrefs = null;
  }

  if (!commonCandidate && portalClientForPrefs) {
    try {
      const portalRow = await portalClientForPrefs.candidate.findFirst({
        where: { id },
        include: candidateDetailInclude,
      });
      if (portalRow && mergePortalAndTenantCandidateRow) {
        candidate = mergePortalAndTenantCandidateRow(portalRow, candidate);
      }
    } catch (err) {
      console.warn('[candidate-details.service] portal merge for getById failed:', err?.message || err);
    }
  }

  const careerPrefs = fetchPortalCareerPreferencesRaw
    ? await fetchPortalCareerPreferencesRaw(portalClientForPrefs, candidate.id)
    : null;
  if (mergeCareerPreferencesIntoCandidate) mergeCareerPreferencesIntoCandidate(candidate, careerPrefs);
  if (hydrateAndPersistCandidateCvProfile) await hydrateAndPersistCandidateCvProfile(candidate, portalClientForPrefs);

  const durationMs = Math.round(performance.now() - tStart);
  if (req?.res && !req.res.headersSent) {
    req.res.setHeader('X-Candidate-Fetch-Time', `${durationMs}ms`);
  }

  const result = buildCandidateResponse
    ? await buildCandidateResponse(
        enrichCandidateDetailJobTitles
          ? await enrichCandidateDetailJobTitles(annotateForTenant(candidate), tenantJobIdSet)
          : annotateForTenant(candidate),
        prisma,
        viewerUserId,
      )
    : candidate;

  return result;
}
