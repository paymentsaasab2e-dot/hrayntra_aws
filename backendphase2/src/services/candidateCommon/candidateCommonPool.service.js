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

function parseProfileSnapshot(row) {
  const snap = row?.profileSnapshot;
  return snap && typeof snap === 'object' && !Array.isArray(snap) ? snap : null;
}

function applyProfileSnapshotFields(mapped, row) {
  const snapshot = parseProfileSnapshot(row);
  if (!snapshot) return mapped;

  const pi = snapshot.personalInfo || {};
  const work = Array.isArray(snapshot.workExperience) ? snapshot.workExperience : [];
  const latestWork = work[0] || null;
  const edu = Array.isArray(snapshot.education) ? snapshot.education : [];
  const skillRows = Array.isArray(snapshot.skills) ? snapshot.skills : [];
  const langRows = Array.isArray(snapshot.languages) ? snapshot.languages : [];
  const skillNames = skillRows.map((s) => String(s?.name || '').trim()).filter(Boolean);
  const languageNames = langRows.map((l) => String(l?.name || '').trim()).filter(Boolean);

  const cvWorkExperienceEntries =
    mapped.cvWorkExperienceEntries ||
    work.map((w) => ({
      title: w.jobTitle || w.title || null,
      jobTitle: w.jobTitle || w.title || null,
      company: w.company || w.companyName || null,
      companyName: w.company || w.companyName || null,
      location: w.workLocation || w.location || null,
      startDate: w.startDate || null,
      endDate: w.endDate || null,
      responsibilities: w.responsibilities || w.description || null,
    }));

  const cvEducationEntries =
    mapped.cvEducationEntries ||
    edu.map((e) => ({
      degree: e.degreeProgram || e.degree || null,
      institution: e.institutionName || e.institution || null,
      field: e.fieldOfStudy || e.field || null,
      startYear: e.startYear || null,
      endYear: e.endYear || null,
    }));

  const certificationsFromSnap = Array.isArray(snapshot.certifications)
    ? snapshot.certifications.map((c) => String(c.certificationName || '').trim()).filter(Boolean)
    : [];

  return {
    ...mapped,
    firstName: mapped.firstName || pi.firstName || null,
    lastName: mapped.lastName || pi.lastName || null,
    email: mapped.email || pi.email || null,
    phone: mapped.phone || pi.phone || null,
    linkedIn: mapped.linkedIn || pi.linkedinUrl || null,
    city: mapped.city || pi.city || null,
    country: mapped.country || pi.country || null,
    location:
      mapped.location || [pi.city, pi.country].filter(Boolean).join(', ') || mapped.location || null,
    avatar: row.profilePhotoUrl || pi.profilePhotoUrl || mapped.avatar || null,
    gender: row.gender || pi.gender || mapped.gender || null,
    currentTitle:
      mapped.currentTitle || snapshot.latestWorkTitle || latestWork?.jobTitle || latestWork?.title || null,
    currentCompany:
      mapped.currentCompany || snapshot.latestWorkCompany || latestWork?.company || latestWork?.companyName || null,
    cvSummary: mapped.cvSummary || snapshot.summaryText || null,
    resumeUrl: mapped.resumeUrl || snapshot.resume?.fileUrl || mapped.resume || null,
    resume: mapped.resume || snapshot.resume?.fileUrl || mapped.resumeUrl || null,
    skills: skillNames.length ? skillNames : mapped.skills,
    recruiterSkills: skillNames.length ? skillNames : mapped.recruiterSkills,
    languages: languageNames.length ? languageNames : mapped.languages,
    recruiterLanguages:
      (Array.isArray(row.recruiterLanguages) && row.recruiterLanguages.length
        ? row.recruiterLanguages
        : languageNames) || mapped.recruiterLanguages,
    noticePeriod:
      row.noticePeriod ||
      snapshot.careerPreferences?.noticePeriod ||
      mapped.noticePeriod ||
      null,
    availability:
      row.availability ||
      snapshot.careerPreferences?.availabilityToStart ||
      mapped.availability ||
      null,
    address: row.addressLine || mapped.address || null,
    careerPreferences:
      (row.careerPreferences && typeof row.careerPreferences === 'object'
        ? row.careerPreferences
        : snapshot.careerPreferences) || mapped.careerPreferences || null,
    certifications: certificationsFromSnap.length ? certificationsFromSnap : mapped.certifications,
    certificationsList: certificationsFromSnap.length
      ? certificationsFromSnap
      : mapped.certificationsList,
    cvEducationEntries,
    cvWorkExperienceEntries,
    cvPortfolioLinks:
      mapped.cvPortfolioLinks ||
      (Array.isArray(snapshot.portfolioLinks) && snapshot.portfolioLinks.length
        ? snapshot.portfolioLinks
        : null),
    extraData: {
      ...(mapped.extraData && typeof mapped.extraData === 'object' ? mapped.extraData : {}),
      phase1ProfileSnapshot: snapshot,
    },
    resumeAtsScore:
      typeof row.resumeAtsScore === 'number'
        ? row.resumeAtsScore
        : typeof snapshot.resume?.atsScore === 'number'
          ? snapshot.resume.atsScore
          : mapped.resumeAtsScore,
  };
}

/** Map candidatecommon row → CRM Candidate shape for match pipeline / materialize. */
export function mapCandidateCommonRowToCandidate(row) {
  if (!row) return null;
  const id = String(row.candidateId || row.id || '').trim();
  if (!id) return null;

  const skills = Array.isArray(row.skills) ? row.skills : [];
  const recruiterSkills = Array.isArray(row.recruiterSkills) ? row.recruiterSkills : skills;

  const mapped = {
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
    languages: Array.isArray(row.recruiterLanguages) ? row.recruiterLanguages : [],
    recruiterLanguages: Array.isArray(row.recruiterLanguages) ? row.recruiterLanguages : [],
    cvEducationEntries: row.cvEducationEntries ?? null,
    cvWorkExperienceEntries: row.cvWorkExperienceEntries ?? null,
    cvPortfolioLinks: row.cvPortfolioLinks ?? null,
    noticePeriod: row.noticePeriod ?? null,
    availability: row.availability ?? null,
    address: row.addressLine ?? null,
    careerPreferences:
      row.careerPreferences && typeof row.careerPreferences === 'object'
        ? row.careerPreferences
        : null,
    assignedJobs: Array.isArray(row.assignedJobs) ? row.assignedJobs : [],
    stage: row.stage ?? 'New',
    source: row.source ?? 'phase1',
    status: 'ACTIVE',
    isDeleted: false,
    createdAt: row.syncedAt ?? row.updatedAt ?? new Date(),
    updatedAt: row.updatedAt ?? row.syncedAt ?? new Date(),
    syncedAt: row.syncedAt ?? row.updatedAt ?? null,
    lastActivity: row.syncedAt ?? row.updatedAt ?? new Date(),
  };

  return applyProfileSnapshotFields(mapped, row);
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
 * Verified Phase 1 snapshots for CRM "All candidates" (tenant uploads + portal pool).
 */
export async function fetchCandidateCommonForCandidatesList(_req) {
  const commonPrisma = getCandidateCommonPrismaClient();
  if (!commonPrisma) return [];

  const limit = Math.min(
    10000,
    Math.max(1, Number(process.env.CANDIDATES_COMMON_POOL_MAX || 5000) || 5000),
  );

  const rows = await commonPrisma.candidateCommon.findMany({
    where: { isVerified: true },
    orderBy: { syncedAt: 'desc' },
    take: limit,
  });

  return rows.map(mapCandidateCommonRowToCandidate).filter(Boolean);
}

/** Load one Phase 1 snapshot by portal candidate id (for profile drawer). */
export async function fetchCandidateCommonByCandidateId(candidateId, options = {}) {
  const { requireVerified = true } = options;
  const commonPrisma = getCandidateCommonPrismaClient();
  if (!commonPrisma) return null;

  const id = String(candidateId || '').trim();
  if (!id) return null;

  const where = { candidateId: id };
  if (requireVerified) {
    where.isVerified = true;
  }

  const row = await commonPrisma.candidateCommon.findFirst({ where });

  return row ? mapCandidateCommonRowToCandidate(row) : null;
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
