const { prisma } = require('../lib/prisma');
const { getCandidateCommonPrisma } = require('../lib/candidateCommonPrisma');
const {
  PROFILE_SYNC_INCLUDE,
  buildProfileSnapshot,
} = require('../utils/profileSnapshotForCommon.util');
const { applyResumeJsonToCommonPayload } = require('../utils/resumeWorkNarrative.util');
const { buildIdentityFields } = require('../lib/personIdentity');

function isPlaceholderProfileEmail(email) {
  const value = String(email || '').trim().toLowerCase();
  return !value || value.includes('@temp.local');
}

function resolveProfileDisplayEmail(candidate) {
  const candidateEmail = String(candidate?.email || '').trim();
  const profileEmail = String(candidate?.profile?.email || '').trim();

  if (candidateEmail && !isPlaceholderProfileEmail(candidateEmail)) return candidateEmail;
  if (profileEmail && !isPlaceholderProfileEmail(profileEmail)) return profileEmail;

  const resumeJson = candidate?.resume?.resumeJson;
  if (resumeJson && typeof resumeJson === 'object') {
    const resumeEmail = resumeJson?.personalInformation?.email;
    if (resumeEmail && String(resumeEmail).trim()) {
      return String(resumeEmail).trim();
    }
  }

  return profileEmail || candidateEmail || null;
}

function splitFullName(fullName) {
  const parts = String(fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return { firstName: null, lastName: null };
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

const { isJunkPortfolioUrl } = require('../utils/portfolioLinkFilter.util');

function normalizePortfolioLinksForCommon(links) {
  if (!Array.isArray(links)) return null;
  const cleaned = links
    .map((link) => ({
      linkType: link?.linkType || link?.type || 'Portfolio',
      url: String(link?.url || '').trim(),
      title: link?.title || null,
      description: link?.description || null,
    }))
    .filter(
      (link) =>
        link.url &&
        !isJunkPortfolioUrl(link.url) &&
        !/gmail\.com$/i.test(link.url.replace(/^https?:\/\//, '')),
    );
  return cleaned.length ? cleaned : null;
}

function mapWorkEntriesFromSnapshot(snapshot) {
  if (!Array.isArray(snapshot?.workExperience) || !snapshot.workExperience.length) return null;
  return snapshot.workExperience.map((w) => ({
    title: w.jobTitle || w.title || null,
    jobTitle: w.jobTitle || w.title || null,
    company: w.company || w.companyName || null,
    companyName: w.company || w.companyName || null,
    location: w.workLocation || w.location || null,
    startDate: w.startDate || null,
    endDate: w.endDate || w.isCurrentJob ? 'Present' : null,
    responsibilities: w.responsibilities || w.description || null,
    description: w.responsibilities || w.description || null,
  }));
}

function mapEducationEntriesFromSnapshot(snapshot) {
  if (!Array.isArray(snapshot?.education) || !snapshot.education.length) return null;
  return snapshot.education.map((e) => ({
    degree: e.degreeProgram || e.degree || null,
    field: e.fieldOfStudy || e.field || null,
    fieldOfStudy: e.fieldOfStudy || e.field || null,
    institution: e.institutionName || e.institution || null,
    school: e.institutionName || e.institution || null,
    startYear: e.startYear || null,
    endYear: e.endYear || null,
  }));
}

function collectSkillNamesFromSnapshot(snapshot) {
  if (!Array.isArray(snapshot?.skills)) return [];
  return [...new Set(snapshot.skills.map((s) => String(s?.name || '').trim()).filter(Boolean))];
}

function buildCommonPayload(candidate, existingCommon = null, { lastLogin = false, forceVerified = false } = {}) {
  const profile = candidate.profile || null;
  const snapshot = buildProfileSnapshot(candidate);
  const fromProfile = profile ? splitFullName(profile.fullName) : { firstName: null, lastName: null };
  const pi = snapshot?.personalInfo || {};
  const firstName = candidate.firstName || pi.firstName || fromProfile.firstName;
  const lastName = candidate.lastName || pi.lastName || fromProfile.lastName;
  const skillNames = collectSkillNamesFromSnapshot(snapshot);
  const languageNames = Array.isArray(snapshot?.languages)
    ? snapshot.languages.map((l) => String(l?.name || '').trim()).filter(Boolean)
    : [];
  const mergedSkills = [...new Set([...skillNames, ...languageNames])];
  const matchJobIds = [
    ...new Set(
      (Array.isArray(candidate.recruiterMatches) ? candidate.recruiterMatches : [])
        .map((m) => String(m?.jobId || '').trim())
        .filter(Boolean)
    ),
  ];
  const experience = candidate.experienceYears ?? candidate.experience ?? null;
  const workEntries = mapWorkEntriesFromSnapshot(snapshot);
  const educationEntries = mapEducationEntriesFromSnapshot(snapshot);
  const certNames = Array.isArray(snapshot?.certifications)
    ? snapshot.certifications.map((c) => String(c.certificationName || '').trim()).filter(Boolean)
    : [];
  const languageDetail = Array.isArray(snapshot?.languages) ? snapshot.languages : [];
  const cp = snapshot?.careerPreferences || null;

  const payload = {
    id: candidate.id,
    candidateId: candidate.id,
    isVerified: forceVerified ? true : Boolean(candidate.isVerified),
    firstName: firstName || null,
    lastName: lastName || null,
    middleName: candidate.middleName || pi.middleName || null,
    email: resolveProfileDisplayEmail(candidate),
    phone: pi.phone || candidate.phone || candidate.whatsappNumber || profile?.phoneNumber || null,
    linkedIn: pi.linkedinUrl || candidate.linkedIn || profile?.linkedinUrl || null,
    resumeUrl: snapshot?.resume?.fileUrl || candidate.resume?.fileUrl || candidate.resumeUrl || null,
    skills: mergedSkills.length ? mergedSkills : skillNames,
    recruiterSkills: mergedSkills.length ? mergedSkills : skillNames,
    experience: typeof experience === 'number' ? experience : null,
    experienceYears: typeof experience === 'number' ? experience : null,
    currentTitle:
      snapshot?.latestWorkTitle || candidate.currentTitle || candidate.designation || null,
    currentCompany: snapshot?.latestWorkCompany || candidate.currentCompany || null,
    location:
      [pi.city, pi.country].filter(Boolean).join(', ') ||
      candidate.location ||
      profile?.city ||
      null,
    city: pi.city || candidate.city || profile?.city || null,
    country: pi.country || candidate.country || profile?.country || null,
    designation: snapshot?.latestWorkTitle || candidate.designation || candidate.currentTitle || null,
    cvSummary: snapshot?.summaryText || candidate.cvSummary || candidate.summary?.summaryText || null,
    notes: candidate.recruiterNotes || null,
    recruiterNotes: candidate.recruiterNotes || null,
    certifications: certNames,
    certificationsList: certNames,
    cvEducationEntries: educationEntries,
    cvWorkExperienceEntries: workEntries,
    cvPortfolioLinks:
      normalizePortfolioLinksForCommon(snapshot?.portfolioLinks) ||
      candidate.cvPortfolioLinks ||
      normalizePortfolioLinksForCommon(candidate.portfolioLinks?.links) ||
      null,
    profileSnapshot: snapshot,
    profilePhotoUrl: pi.profilePhotoUrl || profile?.profilePhotoUrl || null,
    gender: pi.gender || null,
    whatsappNumber: candidate.whatsappNumber || null,
    addressLine: profile?.address || candidate.addressLine || null,
    state: null,
    zipCode: null,
    dateOfBirth: pi.dob || null,
    languagesDetail: languageDetail.length ? languageDetail : null,
    recruiterLanguages: languageNames.length ? languageNames : [],
    careerPreferences: cp,
    resumeFileName: snapshot?.resume?.fileName || candidate.resume?.fileName || null,
    resumeMimeType: snapshot?.resume?.mimeType || candidate.resume?.mimeType || null,
    resumeAtsScore:
      typeof snapshot?.resume?.atsScore === 'number' ? snapshot.resume.atsScore : null,
    noticePeriod: cp?.noticePeriod || candidate.noticePeriod || null,
    availability: cp?.availabilityToStart || candidate.availability || null,
    assignedJobs: Array.isArray(candidate.assignedJobs) ? candidate.assignedJobs.map(String) : [],
    matchJobIds,
    stage: candidate.stage || 'New',
    source: 'phase1',
    syncedAt: new Date(),
  };

  if (lastLogin) {
    payload.lastLoginAt = new Date();
  }

  const enriched = applyResumeJsonToCommonPayload(candidate, payload, snapshot);
  enriched.payload.profileSnapshot = enriched.snapshot || snapshot;

  const existingPersonId = candidate.personId || existingCommon?.personId || null;
  const identity = buildIdentityFields({
    email: enriched.payload.email,
    phone: enriched.payload.phone,
    existingPersonId,
    resumeSha256: null,
  });
  enriched.payload.personId = identity.personId;
  enriched.payload.emailNormalized = identity.emailNormalized;
  enriched.payload.phoneE164 = identity.phoneE164;
  enriched.payload.fingerprintKeys = identity.fingerprintKeys;

  return enriched.payload;
}

async function loadCandidateForCommonSync(candidateId) {
  return prisma.candidate.findUnique({
    where: { id: candidateId },
    include: PROFILE_SYNC_INCLUDE,
  });
}

async function updateCandidateCommonInChunks(commonPrisma, where, data) {
  const entries = Object.entries(data);
  const CHUNK_SIZE = 25;
  let result = null;
  for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
    const chunkData = Object.fromEntries(entries.slice(i, i + CHUNK_SIZE));
    result = await commonPrisma.candidateCommon.update({
      where,
      data: chunkData,
    });
  }
  return result;
}

/**
 * Upsert full Phase 1 candidate snapshot into the candidatecommon database.
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

    const existingCommon = await commonPrisma.candidateCommon.findUnique({
      where: { candidateId: id },
    });

    const data = buildCommonPayload(candidate, existingCommon, options);
    const { id: rowId, ...mutableFields } = data;
    let row;
    if (existingCommon?.id) {
      try {
        row = await updateCandidateCommonInChunks(
          commonPrisma,
          { id: existingCommon.id },
          mutableFields
        );
      } catch (updateErr) {
        if (updateErr?.code === 'P2025') {
          row = await commonPrisma.candidateCommon.create({
            data: { ...mutableFields, id: rowId, candidateId: id },
          });
        } else {
          throw updateErr;
        }
      }
    } else {
      try {
        row = await commonPrisma.candidateCommon.create({
          data: { ...mutableFields, id: rowId, candidateId: id },
        });
      } catch (createErr) {
        if (createErr?.code === 'P2002') {
          row = await updateCandidateCommonInChunks(
            commonPrisma,
            { candidateId: id },
            mutableFields
          );
        } else {
          throw createErr;
        }
      }
    }

    // If common sync minted a new personId and the portal row is still empty,
    // write it back so the portal candidate owns its own identity.
    if (!candidate.personId && data.personId) {
      await prisma.candidate.update({
        where: { id },
        data: { personId: data.personId },
      });
    }

    if (process.env.CANDIDATE_COMMON_SYNC_LOG === 'true') {
      console.log(
        `[candidateCommon] synced ${id} (${data.assignedJobs?.length || 0} jobs, snapshot=${Boolean(data.profileSnapshot)})`
      );
    }

    return row;
  } catch (err) {
    console.warn('[candidateCommon] sync failed:', id, err?.message || err);
    return null;
  }
}

async function persistCandidateSnapshotAndSync(candidateId, options = {}) {
  return syncCandidateToCommon(candidateId, options);
}

function scheduleCandidateCommonSync(candidateId, options = {}) {
  void syncCandidateToCommon(candidateId, options).catch(() => {});
}

const lastScheduledSyncAt = new Map();
const SCHEDULE_DEBOUNCE_MS = 45_000;

function scheduleCandidateCommonSyncDebounced(candidateId, options = {}) {
  const id = String(candidateId || '').trim();
  if (!id) return;
  if (options.force) {
    scheduleCandidateCommonSync(id, options);
    lastScheduledSyncAt.set(id, Date.now());
    return;
  }
  const now = Date.now();
  const last = lastScheduledSyncAt.get(id) || 0;
  if (now - last < SCHEDULE_DEBOUNCE_MS) return;
  lastScheduledSyncAt.set(id, Date.now());
  scheduleCandidateCommonSync(id, options);
}

/** Immediate full sync when candidate opens /candidate-dashboard */
async function syncCandidateCommonFromDashboard(candidateId) {
  return syncCandidateToCommon(candidateId, {
    lastLogin: true,
    forceVerified: true,
    dashboard: true,
  });
}

module.exports = {
  syncCandidateToCommon,
  scheduleCandidateCommonSync,
  scheduleCandidateCommonSyncDebounced,
  persistCandidateSnapshotAndSync,
  syncCandidateCommonFromDashboard,
  buildCommonPayload,
  loadCandidateForCommonSync,
};
