import { prisma } from '../config/prisma.js';
import { resolveCandidateListExperienceYears } from './candidateExperienceYears.util.js';
import { mergeCandidateRecruiterExtraData } from './candidateRecruiterCvExtra.util.js';

function pickFirstNonEmpty(...values) {
  for (const value of values) {
    if (value == null) continue;
    if (typeof value === 'string' && !value.trim()) continue;
    if (Array.isArray(value) && !value.length) continue;
    return value;
  }
  return null;
}

function resolveResumeUrl(candidate) {
  const resume = candidate?.resume;
  if (typeof resume === 'string' && resume.trim()) return resume.trim();
  if (resume && typeof resume === 'object' && typeof resume.fileUrl === 'string' && resume.fileUrl.trim()) {
    return resume.fileUrl.trim();
  }
  return pickFirstNonEmpty(candidate?.resumeUrl) || null;
}

function stripVolatileExtraFields(extra) {
  if (!extra || typeof extra !== 'object' || Array.isArray(extra)) return {};
  const { resumeJsonSyncedAt, ...rest } = extra;
  return rest;
}

function jsonEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function cvPersistPayloadChanged(existingRow, data, mergedExtra) {
  if (!existingRow) return true;

  const existingExtra =
    existingRow.extraData && typeof existingRow.extraData === 'object' && !Array.isArray(existingRow.extraData)
      ? existingRow.extraData
      : {};

  if (
    !jsonEqual(stripVolatileExtraFields(existingExtra), stripVolatileExtraFields(mergedExtra))
  ) {
    return true;
  }

  if (existingExtra.cvEditorContentSaved === true) {
    return false;
  }

  const compareFields = [
    'cvSummary',
    'cvWorkExperienceEntries',
    'cvEducationEntries',
    'skills',
    'recruiterSkills',
    'experience',
    'experienceYears',
    'currentTitle',
    'currentCompany',
    'location',
    'resume',
    'resumeUrl',
    'noticePeriod',
    'availability',
  ];

  return compareFields.some((field) => !jsonEqual(existingRow[field] ?? null, data[field] ?? null));
}

/** Profile + CV fields written to tenant DB (never overwrites workflow fields on update). */
export function buildCandidateCvPersistPayload(candidate) {
  if (!candidate?.id) return null;

  const experienceYears = resolveCandidateListExperienceYears(candidate);
  const experience =
    experienceYears != null
      ? Math.max(0, Math.round(experienceYears))
      : candidate.experience ?? candidate.experienceYears ?? null;

  const extraData =
    candidate.extraData && typeof candidate.extraData === 'object' && !Array.isArray(candidate.extraData)
      ? candidate.extraData
      : {};

  const resumeUrl = resolveResumeUrl(candidate);

  return {
    firstName: candidate.firstName ?? null,
    lastName: candidate.lastName ?? null,
    email: candidate.email ?? null,
    phone: candidate.phone ?? null,
    linkedIn: candidate.linkedIn ?? null,
    resume: resumeUrl,
    resumeUrl,
    skills: Array.isArray(candidate.skills) ? candidate.skills : [],
    recruiterSkills: Array.isArray(candidate.recruiterSkills) ? candidate.recruiterSkills : [],
    experience,
    experienceYears: experienceYears ?? experience,
    currentTitle: candidate.currentTitle ?? candidate.designation ?? null,
    currentCompany: candidate.currentCompany ?? null,
    location: candidate.location ?? null,
    address: candidate.address ?? candidate.addressLine ?? null,
    addressLine: candidate.addressLine ?? candidate.address ?? null,
    city: candidate.city ?? null,
    country: candidate.country ?? null,
    designation: candidate.designation ?? candidate.currentTitle ?? null,
    cvSummary: candidate.cvSummary ?? null,
    cvEducationEntries: candidate.cvEducationEntries ?? null,
    cvWorkExperienceEntries: candidate.cvWorkExperienceEntries ?? null,
    cvPortfolioLinks: candidate.cvPortfolioLinks ?? null,
    extraData,
    certifications: Array.isArray(candidate.certifications) ? candidate.certifications : [],
    certificationsList: Array.isArray(candidate.certificationsList) ? candidate.certificationsList : [],
    languages: Array.isArray(candidate.languages) ? candidate.languages : [],
    recruiterLanguages: Array.isArray(candidate.recruiterLanguages) ? candidate.recruiterLanguages : [],
    notes: candidate.notes ?? candidate.recruiterNotes ?? null,
    recruiterNotes: candidate.recruiterNotes ?? candidate.notes ?? null,
    noticePeriod: candidate.noticePeriod ?? null,
    availability: candidate.availability ?? null,
    lastActivity: candidate.lastActivity ?? new Date(),
  };
}

/**
 * Upsert CV-derived profile onto the active tenant candidate row.
 * Phase 1 discovery rows get a tenant stub so list + drawer read persisted experience.
 */
export async function persistCandidateCvProfileToTenant(candidate) {
  const id = String(candidate?.id || '').trim();
  if (!id) return null;

  const data = buildCandidateCvPersistPayload(candidate);
  if (!data) return null;

  const existing = await prisma.candidate.findUnique({
    where: { id },
    select: { id: true, isDeleted: true, stage: true, assignedJobs: true, source: true },
  });

  if (existing?.isDeleted === true) return null;

  if (existing) {
    const existingRow = await prisma.candidate.findUnique({
      where: { id },
      select: {
        extraData: true,
        cvSummary: true,
        cvWorkExperienceEntries: true,
        cvEducationEntries: true,
        skills: true,
        recruiterSkills: true,
        experience: true,
        experienceYears: true,
        currentTitle: true,
        currentCompany: true,
        location: true,
        resume: true,
        resumeUrl: true,
        noticePeriod: true,
        availability: true,
      },
    });
    const existingExtra =
      existingRow?.extraData && typeof existingRow.extraData === 'object' && !Array.isArray(existingRow.extraData)
        ? existingRow.extraData
        : {};
    const incomingExtra =
      data.extraData && typeof data.extraData === 'object' && !Array.isArray(data.extraData)
        ? data.extraData
        : {};
    const mergedExtra = mergeCandidateRecruiterExtraData(existingExtra, incomingExtra);

    if (!cvPersistPayloadChanged(existingRow, data, mergedExtra)) {
      return existingRow;
    }

    if (existingExtra.cvEditorContentSaved === true) {
      return prisma.candidate.update({
        where: { id },
        data: {
          extraData: mergedExtra,
        },
      });
    }

    return prisma.candidate.update({
      where: { id },
      data: {
        ...data,
        extraData: mergedExtra,
      },
    });
  }

  const phase1 = String(candidate.source || '').trim().toLowerCase() === 'phase1';
  return prisma.candidate.create({
    data: {
      id,
      ...data,
      status: 'ACTIVE',
      source: phase1 ? 'phase1' : candidate.source ?? 'Job portal',
      stage: candidate.stage && String(candidate.stage).trim() ? String(candidate.stage).trim() : 'New',
      assignedJobs: Array.isArray(candidate.assignedJobs) ? candidate.assignedJobs.map(String) : [],
    },
  });
}
