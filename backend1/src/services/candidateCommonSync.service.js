const { prisma } = require('../lib/prisma');
const { getCandidateCommonPrisma } = require('../lib/candidateCommonPrisma');

function splitFullName(fullName) {
  const parts = String(fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return { firstName: null, lastName: null };
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function buildWorkEntries(candidate) {
  if (Array.isArray(candidate.cvWorkExperienceEntries) && candidate.cvWorkExperienceEntries.length) {
    return candidate.cvWorkExperienceEntries;
  }
  if (!Array.isArray(candidate.workExperiences) || !candidate.workExperiences.length) {
    return null;
  }
  return candidate.workExperiences.map((w) => ({
    title: w.jobTitle,
    jobTitle: w.jobTitle,
    company: w.company,
    companyName: w.company,
    location: w.workLocation,
    description: w.responsibilities,
    responsibilities: w.responsibilities,
  }));
}

function buildEducationEntries(candidate) {
  if (Array.isArray(candidate.cvEducationEntries) && candidate.cvEducationEntries.length) {
    return candidate.cvEducationEntries;
  }
  if (!Array.isArray(candidate.educations) || !candidate.educations.length) {
    return null;
  }
  return candidate.educations.map((e) => ({
    degree: e.degree,
    field: e.specialization,
    fieldOfStudy: e.specialization,
    institution: e.institution,
    school: e.institution,
  }));
}

function collectSkillNames(candidate) {
  const fromRelations = Array.isArray(candidate.skills)
    ? candidate.skills.map((row) => row?.skill?.name || row?.name).filter(Boolean)
    : [];
  const merged = [
    ...(Array.isArray(candidate.recruiterSkills) ? candidate.recruiterSkills : []),
    ...fromRelations,
  ];
  return [...new Set(merged.map((s) => String(s).trim()).filter(Boolean))];
}

function collectLanguageNames(candidate) {
  if (!Array.isArray(candidate.languages)) return [];
  return [...new Set(candidate.languages.map((l) => String(l?.name || '').trim()).filter(Boolean))];
}

function buildCvEducationEntriesFromRelations(candidate) {
  if (Array.isArray(candidate.cvEducationEntries) && candidate.cvEducationEntries.length) {
    return candidate.cvEducationEntries;
  }
  if (!Array.isArray(candidate.educations) || !candidate.educations.length) {
    return null;
  }
  return candidate.educations.map((item) => ({
    degree: item.degree || null,
    institution: item.institution || null,
    specialization: item.specialization || null,
    field: item.specialization || null,
    startYear: item.startYear ?? null,
    endYear: item.endYear ?? (item.isOngoing ? 'Present' : null),
  }));
}

function buildCvWorkEntriesFromRelations(candidate) {
  if (Array.isArray(candidate.cvWorkExperienceEntries) && candidate.cvWorkExperienceEntries.length) {
    return candidate.cvWorkExperienceEntries;
  }
  if (!Array.isArray(candidate.workExperiences) || !candidate.workExperiences.length) {
    return null;
  }
  return candidate.workExperiences.map((item) => ({
    title: item.jobTitle || null,
    jobTitle: item.jobTitle || null,
    company: item.company || null,
    companyName: item.company || null,
    location: item.workLocation || null,
    startDate: item.startDate ? new Date(item.startDate).toISOString().split('T')[0] : null,
    endDate: item.isCurrentJob
      ? 'Present'
      : item.endDate
        ? new Date(item.endDate).toISOString().split('T')[0]
        : null,
    responsibilities: item.responsibilities || null,
  }));
}

function normalizePortfolioLinksForCommon(links) {
  if (!Array.isArray(links)) return null;
  const cleaned = links
    .map((link) => ({
      linkType: link?.linkType || link?.type || 'Portfolio',
      url: String(link?.url || '').trim(),
      title: link?.title || null,
      description: link?.description || null,
    }))
    .filter((link) => link.url && !/gmail\.com$/i.test(link.url.replace(/^https?:\/\//, '')));
  return cleaned.length ? cleaned : null;
}

function buildCommonPayload(candidate, { lastLogin = false } = {}) {
  const profile = candidate.profile || null;
  const fromProfile = profile ? splitFullName(profile.fullName) : { firstName: null, lastName: null };
  const firstName = candidate.firstName || fromProfile.firstName;
  const lastName = candidate.lastName || fromProfile.lastName;
  const skillNames = collectSkillNames(candidate);
  const languageNames = collectLanguageNames(candidate);
  const mergedSkills = [...new Set([...skillNames, ...languageNames])];
  const matchJobIds = [
    ...new Set(
      (Array.isArray(candidate.recruiterMatches) ? candidate.recruiterMatches : [])
        .map((m) => String(m?.jobId || '').trim())
        .filter(Boolean)
    ),
  ];
  const experience =
    candidate.experienceYears ?? candidate.experience ?? null;

  const payload = {
    id: candidate.id,
    candidateId: candidate.id,
    isVerified: Boolean(candidate.isVerified),
    firstName: firstName || null,
    lastName: lastName || null,
    email: candidate.email || profile?.email || null,
    phone:
      candidate.phone ||
      candidate.whatsappNumber ||
      profile?.phoneNumber ||
      null,
    linkedIn: candidate.linkedIn || profile?.linkedinUrl || null,
    resumeUrl: candidate.resume?.fileUrl || candidate.resumeUrl || null,
    skills: mergedSkills.length ? mergedSkills : skillNames,
    recruiterSkills: mergedSkills.length
      ? mergedSkills
      : Array.isArray(candidate.recruiterSkills)
        ? candidate.recruiterSkills
        : skillNames,
    experience: typeof experience === 'number' ? experience : null,
    experienceYears: typeof experience === 'number' ? experience : null,
    currentTitle: candidate.currentTitle || candidate.designation || null,
    currentCompany: candidate.currentCompany || null,
    location:
      candidate.location ||
      profile?.city ||
      profile?.country ||
      candidate.preferredLocation ||
      null,
    city: candidate.city || profile?.city || null,
    country: candidate.country || profile?.country || null,
    designation: candidate.designation || candidate.currentTitle || null,
    cvSummary:
      candidate.cvSummary ||
      candidate.summary?.summaryText ||
      candidate.recruiterNotes ||
      null,
    notes: candidate.recruiterNotes || null,
    recruiterNotes: candidate.recruiterNotes || null,
    certifications: Array.isArray(candidate.certifications) ? candidate.certifications : [],
    certificationsList: Array.isArray(candidate.certificationsList) ? candidate.certificationsList : [],
    cvEducationEntries: buildEducationEntries(candidate) || buildCvEducationEntriesFromRelations(candidate),
    cvWorkExperienceEntries: buildWorkEntries(candidate) || buildCvWorkEntriesFromRelations(candidate),
    cvPortfolioLinks:
      candidate.cvPortfolioLinks ||
      normalizePortfolioLinksForCommon(candidate.portfolioLinks?.links) ||
      null,
    assignedJobs: Array.isArray(candidate.assignedJobs) ? candidate.assignedJobs.map(String) : [],
    matchJobIds,
    stage: candidate.stage || null,
    source: 'phase1',
    syncedAt: new Date(),
  };

  if (lastLogin) {
    payload.lastLoginAt = new Date();
  }

  return payload;
}

async function loadCandidateForCommonSync(candidateId) {
  return prisma.candidate.findUnique({
    where: { id: candidateId },
    include: {
      profile: true,
      summary: true,
      workExperiences: { orderBy: { startDate: 'desc' }, take: 30 },
      educations: { orderBy: { startYear: 'desc' }, take: 20 },
      skills: { include: { skill: true }, take: 100 },
      recruiterMatches: { select: { jobId: true } },
    },
  });
}

/**
 * Upsert full Phase 1 candidate snapshot into the candidatecommon database.
 * Non-blocking for callers — logs warnings on failure.
 */
async function syncCandidateToCommon(candidateId, options = {}) {
  const id = String(candidateId || '').trim();
  if (!id) return null;

  const commonPrisma = getCandidateCommonPrisma();
  if (!commonPrisma) {
    console.warn('[candidateCommon] CANDIDATE_COMMON_DATABASE_URL / DATABASE_URL not configured — skip sync');
    return null;
  }

  try {
    const candidate = await loadCandidateForCommonSync(id);
    if (!candidate) return null;

    const data = buildCommonPayload(candidate, options);
    const { id: rowId, ...mutableFields } = data;
    const row = await commonPrisma.candidateCommon.upsert({
      where: { candidateId: id },
      create: { ...mutableFields, id: rowId, candidateId: id },
      update: mutableFields,
    });

    if (process.env.CANDIDATE_COMMON_SYNC_LOG === 'true') {
      console.log(`[candidateCommon] synced ${id} (${data.assignedJobs?.length || 0} jobs)`);
    }

    return row;
  } catch (err) {
    console.warn('[candidateCommon] sync failed:', id, err?.message || err);
    return null;
  }
}

/**
 * Alias used by dashboard sync — same as syncCandidateToCommon.
 */
async function persistCandidateSnapshotAndSync(candidateId, options = {}) {
  return syncCandidateToCommon(candidateId, options);
}

/**
 * Fire-and-forget sync — used after job application and from dashboard visit.
 */
function scheduleCandidateCommonSync(candidateId, options = {}) {
  void syncCandidateToCommon(candidateId, options).catch(() => {});
}

module.exports = {
  syncCandidateToCommon,
  scheduleCandidateCommonSync,
  persistCandidateSnapshotAndSync,
  buildCommonPayload,
};
