import {
  prisma,
  getActiveTenantDbName,
  getCandidateCommonPrismaClient,
} from '../../config/prisma.js';
import { buildSuperAdminOwnerScope, isSuperAdminUser } from '../../utils/superAdminScope.js';
import { canViewAllAssignments, hasAnyPermission as hasAnyPermissionScope } from '../../utils/permissionScope.js';

function isTenantScopedRequest() {
  return Boolean(getActiveTenantDbName());
}

async function getVisibleTenantJobIds(req, mine) {
  const jobWhere = {};
  if (mine && req?.user?.id) {
    jobWhere.createdById = req.user.id;
  }
  const jobs = await prisma.job.findMany({
    where: { ...jobWhere, isDeleted: { not: true } },
    select: { id: true },
  });
  return jobs.map((job) => job.id);
}

/** Map candidatecommon row → CRM Candidate shape for match pipeline / materialize. */
export function mapCandidateCommonRowToCandidate(row) {
  if (!row) return null;
  const id = String(row.candidateId || row.id || '').trim();
  if (!id) return null;

  const skills = Array.isArray(row.skills) ? row.skills : [];
  const recruiterSkills = Array.isArray(row.recruiterSkills) ? row.recruiterSkills : skills;

  return {
    id,
    firstName: row.firstName ?? null,
    lastName: row.lastName ?? null,
    email: row.email ?? null,
    phone: row.phone ?? null,
    linkedIn: row.linkedIn ?? null,
    resume: row.resumeUrl ?? null,
    resumeUrl: row.resumeUrl ?? null,
    skills,
    recruiterSkills,
    experience: row.experience ?? row.experienceYears ?? null,
    experienceYears: row.experienceYears ?? row.experience ?? null,
    currentTitle: row.currentTitle ?? row.designation ?? null,
    currentCompany: row.currentCompany ?? null,
    location: row.location ?? null,
    city: row.city ?? null,
    country: row.country ?? null,
    designation: row.designation ?? row.currentTitle ?? null,
    cvSummary: row.cvSummary ?? row.notes ?? row.recruiterNotes ?? null,
    notes: row.notes ?? row.recruiterNotes ?? null,
    recruiterNotes: row.recruiterNotes ?? row.notes ?? null,
    certifications: Array.isArray(row.certifications) ? row.certifications : [],
    certificationsList: Array.isArray(row.certificationsList) ? row.certificationsList : [],
    cvEducationEntries: row.cvEducationEntries ?? null,
    cvWorkExperienceEntries: row.cvWorkExperienceEntries ?? null,
    cvPortfolioLinks: row.cvPortfolioLinks ?? null,
    assignedJobs: Array.isArray(row.assignedJobs) ? row.assignedJobs : [],
    stage: row.stage ?? 'Applied',
    source: row.source ?? 'phase1',
    status: 'ACTIVE',
    isDeleted: false,
    lastActivity: row.syncedAt ?? row.updatedAt ?? new Date(),
  };
}

/**
 * All verified Phase 1 snapshots for AI matching (discovery — not limited to applicants on this job).
 */
export async function fetchCandidateCommonForMatchPipeline(req) {
  const commonPrisma = getCandidateCommonPrismaClient();
  if (!commonPrisma || !isTenantScopedRequest()) return [];

  const limit = Math.min(5000, Math.max(1, Number(process.env.MATCH_COMMON_POOL_MAX || 500) || 500));

  const rows = await commonPrisma.candidateCommon.findMany({
    where: { isVerified: true },
    orderBy: { syncedAt: 'desc' },
    take: limit,
  });

  return rows.map(mapCandidateCommonRowToCandidate).filter(Boolean);
}

/**
 * Phase 1 candidatecommon rows linked to this tenant's jobs (Candidates list scope).
 */
export async function fetchCandidateCommonForTenant(req, jobId) {
  const commonPrisma = getCandidateCommonPrismaClient();
  if (!commonPrisma || !isTenantScopedRequest()) return [];

  const jobIdStr = String(jobId || '').trim();
  const tenantJobIds = await getVisibleTenantJobIds(req, false);
  const scopeJobIds = [...new Set([...tenantJobIds, jobIdStr].filter(Boolean))];

  const canViewAll =
    isSuperAdminUser(req) ||
    canViewAllAssignments(req) ||
    hasAnyPermissionScope(req, ['view_all_candidates']);

  const andParts = [{ isVerified: true }];

  if (!canViewAll) {
    if (!scopeJobIds.length) return [];
    andParts.push({
      OR: [
        { assignedJobs: { hasSome: scopeJobIds } },
        { matchJobIds: { hasSome: scopeJobIds } },
      ],
    });
  } else if (jobIdStr) {
    andParts.push({
      OR: [
        { assignedJobs: { has: jobIdStr } },
        { matchJobIds: { has: jobIdStr } },
        ...(scopeJobIds.length
          ? [{ assignedJobs: { hasSome: scopeJobIds } }, { matchJobIds: { hasSome: scopeJobIds } }]
          : []),
      ],
    });
  }

  const rows = await commonPrisma.candidateCommon.findMany({
    where: { AND: andParts },
    orderBy: { syncedAt: 'desc' },
    take: 5000,
  });

  return rows.map(mapCandidateCommonRowToCandidate).filter(Boolean);
}
