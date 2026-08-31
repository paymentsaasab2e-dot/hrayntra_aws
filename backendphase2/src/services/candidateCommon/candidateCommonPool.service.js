import {
  prisma,
  getActiveTenantDbName,
  getCandidateCommonPrismaClient,
  getJobPortalPrismaClient,
} from '../../config/prisma.js';
import { resolveCandidateListExperienceYears } from '../../utils/candidateExperienceYears.util.js';
import { normalizePortalCareerPreferences } from '../../utils/normalizePortalCareerPreferences.js';
import { batchHydrateCandidatesResumeFromPortal } from '../../utils/candidateResumeHydrate.util.js';
import { hydratePhase1SnapshotPersonalInfoFromPortal } from '../../utils/phase1SnapshotHydrate.util.js';
import { buildSuperAdminOwnerScope, isSuperAdminUser } from '../../utils/superAdminScope.js';
import { canViewAllAssignments, hasAnyPermission as hasAnyPermissionScope } from '../../utils/permissionScope.js';
import { mergeOrgCompanyListScope } from '../orgListScope.service.js';
import { normalizePortfolioLinksForCommon } from '../../utils/portfolioLinkFilter.util.js';
import { getHqEnabledModules } from '../../modules/setting/recruitmentMode.service.js';

function isTenantScopedRequest() {
  return Boolean(getActiveTenantDbName());
}

/** HQ flag: Phase 1 candidatecommon access. Missing/legacy → allowed. */
async function tenantAllowsPhase1CommonPool() {
  if (!isTenantScopedRequest()) return true;
  try {
    const modules = await getHqEnabledModules();
    return modules?.phase1CommonPoolEnabled !== false;
  } catch {
    return true;
  }
}

async function getVisibleTenantJobIds(req, mine) {
  const jobWhere = {};
  if (mine && req?.user?.id) {
    jobWhere.createdById = req.user.id;
  }
  const scoped = await mergeOrgCompanyListScope(
    { ...jobWhere, isDeleted: { not: true } },
    req,
    {
      assignedToIdField: 'assignedToId',
      createdByField: 'createdById',
      extraHasField: 'supportingRecruiters',
    },
  );
  const jobs = await prisma.job.findMany({
    where: scoped,
    select: { id: true },
  });
  return jobs.map((job) => job.id);
}

function parseProfileSnapshot(row) {
  const snap = row?.profileSnapshot;
  return snap && typeof snap === 'object' && !Array.isArray(snap) ? snap : null;
}

function normalizeCareerPreferences(preferences, candidate = {}) {
  if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences)) return null;
  return normalizePortalCareerPreferences(preferences, candidate);
}

export function applyProfileSnapshotFields(mapped, row) {
  const snapshot = parseProfileSnapshot(row);
  if (!snapshot) return mapped;
  const mergedCareerPreferences =
    row?.careerPreferences && typeof row.careerPreferences === 'object' && !Array.isArray(row.careerPreferences)
      ? {
          ...(snapshot?.careerPreferences && typeof snapshot.careerPreferences === 'object' && !Array.isArray(snapshot.careerPreferences)
            ? snapshot.careerPreferences
            : {}),
          ...row.careerPreferences,
        }
      : snapshot?.careerPreferences && typeof snapshot.careerPreferences === 'object' && !Array.isArray(snapshot.careerPreferences)
        ? snapshot.careerPreferences
        : null;

  const pi = snapshot.personalInfo || {};
  const work = Array.isArray(snapshot.workExperience) ? snapshot.workExperience : [];
  const latestWork = work[0] || null;
  const edu = Array.isArray(snapshot.education) ? snapshot.education : [];
  const skillRows = Array.isArray(snapshot.skills) ? snapshot.skills : [];
  const langRows = Array.isArray(snapshot.languages) ? snapshot.languages : [];
  const skillNames = skillRows.map((s) => String(s?.name || '').trim()).filter(Boolean);
  const languageNames = langRows.map((l) => String(l?.name || '').trim()).filter(Boolean);

  const cvWorkExperienceEntries =
    Array.isArray(mapped.cvWorkExperienceEntries) && mapped.cvWorkExperienceEntries.length
      ? mapped.cvWorkExperienceEntries
      : work.map((w) => ({
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
    Array.isArray(mapped.cvEducationEntries) && mapped.cvEducationEntries.length
      ? mapped.cvEducationEntries
      : edu.map((e) => ({
      degree: e.degreeProgram || e.degree || null,
      institution: e.institutionName || e.institution || null,
      field: e.fieldOfStudy || e.field || null,
      startYear: e.startYear || null,
      endYear: e.endYear || null,
    }));

  const certificationsFromSnap = Array.isArray(snapshot.certifications)
    ? snapshot.certifications.map((c) => String(c.certificationName || '').trim()).filter(Boolean)
    : [];

  const portfolioLinks =
    normalizePortfolioLinksForCommon(snapshot.portfolioLinks) ||
    (Array.isArray(snapshot.portfolioLinks) ? snapshot.portfolioLinks : []);
  const cvPortfolioLinks =
    normalizePortfolioLinksForCommon(mapped.cvPortfolioLinks) ||
    normalizePortfolioLinksForCommon(portfolioLinks) ||
    mapped.cvPortfolioLinks ||
    portfolioLinks;
  let linkedIn = mapped.linkedIn || pi.linkedinUrl || null;
  if (!String(linkedIn || '').trim()) {
    for (const link of [...portfolioLinks, ...(Array.isArray(cvPortfolioLinks) ? cvPortfolioLinks : [])]) {
      const url = String(link?.url || '').trim();
      if (!url) continue;
      const host = url.replace(/^https?:\/\//i, '').toLowerCase();
      if (host === 'gmail.com' || host === 'b.com') continue;
      const type = String(link?.linkType || link?.type || link?.title || '').toLowerCase();
      if (type.includes('linkedin') || /linkedin\.com/i.test(url)) {
        linkedIn = url;
        break;
      }
    }
  }

  const enrichedPersonalInfo = {
    ...(pi || {}),
    employment: pi?.employment || null,
    passportNumber: pi?.passportNumber || null,
    nationality: pi?.nationality || null,
    address: pi?.address || row.addressLine || mapped.address || null,
    linkedinUrl: pi?.linkedinUrl || linkedIn || null,
  };

  const enrichedSnapshot = {
    ...snapshot,
    personalInfo: enrichedPersonalInfo,
    ...(Array.isArray(portfolioLinks) && portfolioLinks.length ? { portfolioLinks } : {}),
  };

  const withSnapshot = {
    ...mapped,
    firstName: mapped.firstName || pi.firstName || null,
    middleName: mapped.middleName || pi.middleName || null,
    lastName: mapped.lastName || pi.lastName || null,
    email: mapped.email || pi.email || null,
    phone: mapped.phone || pi.phone || null,
    linkedIn,
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
    address: enrichedPersonalInfo.address || row.addressLine || mapped.address || null,
    careerPreferences: normalizeCareerPreferences(mergedCareerPreferences) || mapped.careerPreferences || null,
    certifications: certificationsFromSnap.length ? certificationsFromSnap : mapped.certifications,
    certificationsList: certificationsFromSnap.length
      ? certificationsFromSnap
      : mapped.certificationsList,
    cvEducationEntries,
    cvWorkExperienceEntries,
    cvPortfolioLinks: cvPortfolioLinks?.length ? cvPortfolioLinks : null,
    extraData: {
      ...(mapped.extraData && typeof mapped.extraData === 'object' ? mapped.extraData : {}),
      phase1ProfileSnapshot: enrichedSnapshot,
      ...(enrichedPersonalInfo.passportNumber
        ? { passportNumber: enrichedPersonalInfo.passportNumber }
        : {}),
      ...(enrichedPersonalInfo.employment ? { employment: enrichedPersonalInfo.employment } : {}),
      ...(enrichedPersonalInfo.nationality ? { nationality: enrichedPersonalInfo.nationality } : {}),
      ...(typeof snapshot.cvWorkHistoryNarrative === 'string' && snapshot.cvWorkHistoryNarrative.trim()
        ? { workHistory: snapshot.cvWorkHistoryNarrative.trim() }
        : {}),
    },
    resumeAtsScore:
      typeof row.resumeAtsScore === 'number'
        ? row.resumeAtsScore
        : typeof snapshot.resume?.atsScore === 'number'
          ? snapshot.resume.atsScore
          : mapped.resumeAtsScore,
  };

  const computedExperience = resolveCandidateListExperienceYears(withSnapshot);
  if (computedExperience != null) {
    withSnapshot.experience = computedExperience;
    withSnapshot.experienceYears = computedExperience;
  }

  return withSnapshot;
}

/** Map candidatecommon row → CRM Candidate shape for match pipeline / materialize. */
export function mapCandidateCommonRowToCandidate(row) {
  if (!row) return null;
  const id = String(row.candidateId || row.id || '').trim();
  if (!id) return null;

  const snapshot = parseProfileSnapshot(row);
  const mergedCareerPreferences =
    row.careerPreferences && typeof row.careerPreferences === 'object' && !Array.isArray(row.careerPreferences)
      ? {
          ...(snapshot?.careerPreferences && typeof snapshot.careerPreferences === 'object' && !Array.isArray(snapshot.careerPreferences)
            ? snapshot.careerPreferences
            : {}),
          ...row.careerPreferences,
        }
      : snapshot?.careerPreferences && typeof snapshot.careerPreferences === 'object' && !Array.isArray(snapshot.careerPreferences)
        ? snapshot.careerPreferences
        : null;

  const skills = Array.isArray(row.skills) ? row.skills : [];
  const recruiterSkills = Array.isArray(row.recruiterSkills) ? row.recruiterSkills : skills;

  const mapped = {
    id,
    firstName: row.firstName ?? null,
    middleName: row.middleName ?? null,
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
    careerPreferences: normalizeCareerPreferences(mergedCareerPreferences),
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

  const result = applyProfileSnapshotFields(mapped, row);
  const computedExperience = resolveCandidateListExperienceYears(result);
  if (computedExperience != null) {
    result.experience = computedExperience;
    result.experienceYears = computedExperience;
  }
  return result;
}

/**
 * All verified Phase 1 snapshots for AI matching (discovery — not limited to applicants on this job).
 */
export async function fetchCandidateCommonForMatchPipeline(req) {
  const commonPrisma = getCandidateCommonPrismaClient();
  if (!commonPrisma || !isTenantScopedRequest()) return [];
  if (!(await tenantAllowsPhase1CommonPool())) return [];

  const limit = Math.min(5000, Math.max(1, Number(process.env.MATCH_COMMON_POOL_MAX || 500) || 500));

  const rows = await commonPrisma.candidateCommon.findMany({
    where: { isVerified: true },
    orderBy: { syncedAt: 'desc' },
    take: limit,
  });

  return rows.map(mapCandidateCommonRowToCandidate).filter(Boolean);
}

function candidateHasAnyJobLink(row) {
  if (!row) return false;
  const assigned = Array.isArray(row.assignedJobs) ? row.assignedJobs : [];
  if (assigned.some((id) => String(id || '').trim())) return true;
  if (Array.isArray(row.applications) && row.applications.length > 0) return true;
  if (Array.isArray(row.pipelineEntries) && row.pipelineEntries.length > 0) return true;
  if (Array.isArray(row.matches) && row.matches.length > 0) return true;
  if (Array.isArray(row.interviews) && row.interviews.length > 0) return true;
  return false;
}

function rowHasTenantJobLink(row, allowed) {
  const inSet = (id) => allowed.has(String(id || '').trim());
  const assigned = Array.isArray(row.assignedJobs) ? row.assignedJobs : [];
  if (assigned.some((id) => inSet(id))) return true;
  const matchJobIds = Array.isArray(row.matchJobIds) ? row.matchJobIds : [];
  if (matchJobIds.some((id) => inSet(id))) return true;
  for (const listKey of ['applications', 'pipelineEntries', 'matches', 'interviews']) {
    const rows = Array.isArray(row[listKey]) ? row[listKey] : [];
    if (rows.some((entry) => inSet(entry?.jobId || entry?.job?.id))) return true;
  }
  return false;
}

async function getAllTenantJobIdSet() {
  const jobs = await prisma.job.findMany({
    where: { isDeleted: { not: true } },
    select: { id: true },
  });
  return new Set(jobs.map((job) => String(job.id)));
}

/**
 * Verified Phase 1 snapshots for CRM "All candidates" (tenant uploads + portal pool).
 * Job links on candidatecommon are global — keep only rows for this tenant or pure discovery.
 */
export async function fetchCandidateCommonForCandidatesList(req) {
  const commonPrisma = getCandidateCommonPrismaClient();
  if (!commonPrisma) return [];
  if (!(await tenantAllowsPhase1CommonPool())) return [];

  const limit = Math.min(
    10000,
    Math.max(1, Number(process.env.CANDIDATES_COMMON_POOL_MAX || 5000) || 5000),
  );

  const rows = await commonPrisma.candidateCommon.findMany({
    where: { isVerified: true },
    orderBy: { syncedAt: 'desc' },
    take: limit,
  });

  let mapped = rows.map(mapCandidateCommonRowToCandidate).filter(Boolean);

  if (isTenantScopedRequest()) {
    const allowed = await getAllTenantJobIdSet();
    mapped = mapped
      .filter((row) => {
        if (!candidateHasAnyJobLink(row)) return true;
        if (!allowed.size) return false;
        return rowHasTenantJobLink(row, allowed);
      })
      .map((row) => {
        if (!allowed.size) {
          return {
            ...row,
            assignedJobs: [],
            applications: [],
            pipelineEntries: [],
            matches: [],
            interviews: [],
            assignedJobTitles: [],
            stage: 'New',
          };
        }
        const assignedJobs = (Array.isArray(row.assignedJobs) ? row.assignedJobs : [])
          .map((id) => String(id || '').trim())
          .filter((id) => id && allowed.has(id));
        const hasTenantLink = rowHasTenantJobLink(row, allowed);
        return {
          ...row,
          assignedJobs,
          applications: hasTenantLink ? row.applications : [],
          pipelineEntries: hasTenantLink ? row.pipelineEntries : [],
          matches: hasTenantLink ? row.matches : [],
          interviews: hasTenantLink ? row.interviews : [],
          assignedJobTitles: hasTenantLink ? row.assignedJobTitles : [],
          stage: hasTenantLink ? row.stage : 'New',
        };
      });
  }

  return mapped;
}

/** Load one Phase 1 snapshot by portal candidate id (for profile drawer). */
export async function fetchCandidateCommonByCandidateId(candidateId, options = {}) {
  const { requireVerified = true } = options;
  const commonPrisma = getCandidateCommonPrismaClient();
  if (!commonPrisma) return null;
  if (!(await tenantAllowsPhase1CommonPool())) return null;

  const id = String(candidateId || '').trim();
  if (!id) return null;

  const where = { candidateId: id };
  if (requireVerified) {
    where.isVerified = true;
  }

  const row = await commonPrisma.candidateCommon.findFirst({ where });

  if (!row) return null;

  let mapped = mapCandidateCommonRowToCandidate(row);
  if (!mapped) return null;

  try {
    const portalClient = getJobPortalPrismaClient();
    if (portalClient) {
      await hydratePhase1SnapshotPersonalInfoFromPortal(mapped, portalClient);
      await batchHydrateCandidatesResumeFromPortal([mapped], portalClient);
      const computed = resolveCandidateListExperienceYears(mapped);
      if (computed != null) {
        mapped.experience = computed;
        mapped.experienceYears = computed;
      }
    }
  } catch (err) {
    console.warn(
      '[candidateCommon] resume hydrate for drawer failed:',
      id,
      err?.message || err,
    );
  }

  return mapped;
}

/**
 * Phase 1 candidatecommon rows linked to this tenant's jobs (Candidates list scope).
 */
export async function fetchCandidateCommonForTenant(req, jobId) {
  const commonPrisma = getCandidateCommonPrismaClient();
  if (!commonPrisma || !isTenantScopedRequest()) return [];
  if (!(await tenantAllowsPhase1CommonPool())) return [];

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
