const { mapWorkExperienceForClient } = require('./workExperienceEnums');
const { resolveCandidateLocalPhone } = require('./phone.util');

function mapGenderLabel(value) {
  const raw = String(value || '').trim().toUpperCase();
  if (raw === 'MALE') return 'Male';
  if (raw === 'FEMALE') return 'Female';
  if (raw === 'OTHER') return 'Other';
  return value || '';
}

function mapProficiency(value) {
  const raw = String(value || '').trim().toUpperCase();
  if (raw === 'BEGINNER') return 'Beginner';
  if (raw === 'INTERMEDIATE') return 'Intermediate';
  if (raw === 'ADVANCED') return 'Advanced';
  if (raw === 'EXPERT') return 'Expert';
  return value || '';
}

function mapPhoneCode(countryCode) {
  return String(countryCode || '+91').trim() || '+91';
}

const INTERNSHIP_ENTRIES_PREFIX = '__INTERNSHIP_ENTRIES__:';

function extractGapEntries(gapExplanationRecord) {
  if (!gapExplanationRecord) return [];
  const preferredSupportObj =
    gapExplanationRecord.preferredSupport &&
    typeof gapExplanationRecord.preferredSupport === 'object'
      ? gapExplanationRecord.preferredSupport
      : {};
  if (Array.isArray(preferredSupportObj.entries)) {
    return preferredSupportObj.entries;
  }
  const hasLegacy = Boolean(
    gapExplanationRecord.gapCategory ||
      gapExplanationRecord.reasonForGap ||
      gapExplanationRecord.gapDuration
  );
  return hasLegacy
    ? [
        {
          gapCategory: gapExplanationRecord.gapCategory || '',
          reasonForGap: gapExplanationRecord.reasonForGap || '',
          gapDuration: gapExplanationRecord.gapDuration || '',
          selectedSkills: Array.isArray(gapExplanationRecord.selectedSkills)
            ? gapExplanationRecord.selectedSkills
            : [],
        },
      ]
    : [];
}

function extractInternshipEntries(internshipRecord) {
  if (!internshipRecord) return [];
  const documents = Array.isArray(internshipRecord.documents) ? internshipRecord.documents : [];
  const encoded = documents.find(
    (doc) => typeof doc === 'string' && doc.startsWith(INTERNSHIP_ENTRIES_PREFIX)
  );
  if (encoded) {
    try {
      const parsed = JSON.parse(
        Buffer.from(encoded.slice(INTERNSHIP_ENTRIES_PREFIX.length), 'base64').toString('utf8')
      );
      if (Array.isArray(parsed)) return parsed;
    } catch {
      /* ignore */
    }
  }
  if (
    internshipRecord.internshipTitle ||
    internshipRecord.companyName ||
    internshipRecord.responsibilities
  ) {
    return [
      {
        internshipTitle: internshipRecord.internshipTitle || '',
        companyName: internshipRecord.companyName || '',
        startDate: internshipRecord.startDate || '',
        endDate: internshipRecord.endDate || '',
        responsibilities: internshipRecord.responsibilities || '',
      },
    ];
  }
  return [];
}

/** Prisma include — mirrors GET /api/profile/:candidateId */
const PROFILE_SYNC_INCLUDE = {
  profile: true,
  summary: true,
  gapExplanation: true,
  internship: true,
  portfolioLinks: true,
  educations: { orderBy: { startYear: 'desc' } },
  workExperiences: { orderBy: { startDate: 'desc' } },
  skills: { include: { skill: true } },
  languages: true,
  careerPreferences: true,
  resume: true,
  project: true,
  academicAchievement: true,
  competitiveExam: true,
  certifications: { orderBy: { createdAt: 'desc' } },
  accomplishments: { orderBy: { createdAt: 'desc' } },
  visaWorkAuthorization: true,
  vaccination: true,
  recruiterMatches: { select: { jobId: true } },
};

function buildProfileSnapshot(candidate) {
  if (!candidate) return null;

  const profile = candidate.profile || null;
  const fullNameParts = String(profile?.fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const fallbackFirst = fullNameParts[0] || '';
  const fallbackMiddle = fullNameParts.length > 2 ? fullNameParts.slice(1, -1).join(' ') : '';
  const fallbackLast = fullNameParts.length > 1 ? fullNameParts[fullNameParts.length - 1] : '';

  const gapExplanations = extractGapEntries(candidate.gapExplanation);
  const internships = extractInternshipEntries(candidate.internship);
  const academicAchievements = candidate.academicAchievement
    ? [
        {
          id: candidate.academicAchievement.id,
          achievementTitle: candidate.academicAchievement.achievementTitle || '',
          awardedBy: candidate.academicAchievement.awardedBy || '',
          yearReceived: candidate.academicAchievement.yearReceived || '',
          categoryType: candidate.academicAchievement.categoryType || '',
          description: candidate.academicAchievement.description || '',
        },
      ]
    : [];
  const competitiveExams = candidate.competitiveExam
    ? [
        {
          id: candidate.competitiveExam.id,
          examName: candidate.competitiveExam.examName || '',
          yearTaken: candidate.competitiveExam.yearTaken || '',
          resultStatus: candidate.competitiveExam.resultStatus || '',
          scoreMarks: candidate.competitiveExam.scoreMarks || '',
          scoreType: candidate.competitiveExam.scoreType || '',
          validUntil: candidate.competitiveExam.validUntil || '',
          additionalNotes: candidate.competitiveExam.additionalNotes || '',
        },
      ]
    : [];
  const projects = candidate.project
    ? [
        {
          id: candidate.project.id,
          projectTitle: candidate.project.projectTitle || '',
          projectType: candidate.project.projectType || '',
          organizationClient: candidate.project.organizationClient || '',
          currentlyWorking: Boolean(candidate.project.currentlyWorking),
          startDate: candidate.project.startDate
            ? new Date(candidate.project.startDate).toISOString()
            : '',
          endDate: candidate.project.endDate
            ? new Date(candidate.project.endDate).toISOString()
            : '',
          projectDescription: candidate.project.projectDescription || '',
          responsibilities: candidate.project.responsibilities || '',
          technologies: candidate.project.technologies || [],
          projectOutcome: candidate.project.projectOutcome || '',
          projectLink: candidate.project.projectLink || '',
        },
      ]
    : [];

  const workExperience = (candidate.workExperiences || []).map((exp) => mapWorkExperienceForClient(exp));
  const latestWork = workExperience[0] || null;

  const education = (candidate.educations || []).map((edu) => ({
    id: edu.id,
    educationLevel: edu.educationLevel || '',
    degreeProgram: edu.degree || '',
    institutionName: edu.institution || '',
    fieldOfStudy: edu.specialization || '',
    startYear: edu.startYear?.toString() || '',
    endYear: edu.endYear?.toString() || '',
    currentlyStudying: edu.isOngoing || false,
    grade: edu.grade || '',
  }));

  const skills = (candidate.skills || []).map((cs) => ({
    id: cs.id,
    name: cs.skill?.name || '',
    proficiency: mapProficiency(cs.proficiency),
    category: cs.skill?.category || 'Hard Skills',
  }));

  const languages = (candidate.languages || []).map((lang) => ({
    id: lang.id,
    name: lang.name || '',
    proficiency: mapProficiency(lang.proficiency),
    speak: lang.canSpeak || false,
    read: lang.canRead || false,
    write: lang.canWrite || false,
  }));

  const cp = candidate.careerPreferences;

  return {
    candidateId: candidate.id,
    syncedSection: 'full_dashboard_profile',
    personalInfo: profile
      ? {
          firstName: candidate.firstName || fallbackFirst,
          middleName: candidate.middleName || fallbackMiddle,
          lastName: candidate.lastName || fallbackLast,
          email: profile.email || candidate.email || null,
          profilePhotoUrl: profile.profilePhotoUrl || '',
          phone: resolveCandidateLocalPhone(candidate),
          phoneCode: mapPhoneCode(candidate.countryCode),
          gender: mapGenderLabel(profile.gender),
          dob: profile.dateOfBirth
            ? new Date(profile.dateOfBirth).toISOString().split('T')[0]
            : '',
          country: profile.country || '',
          city: profile.city || '',
          linkedinUrl: profile.linkedinUrl || '',
        }
      : null,
    summaryText: candidate.summary?.summaryText || '',
    gapExplanations,
    internships,
    portfolioLinks: candidate.portfolioLinks?.links || [],
    education,
    workExperience,
    skills,
    skillsAdditionalNotes: profile?.skillsAdditionalNotes || '',
    languages,
    careerPreferences: cp
      ? {
          preferredRoles: cp.preferredRoles || [],
          preferredIndustry: cp.preferredIndustry || '',
          preferredLocations: cp.preferredLocations || [],
          preferredWorkMode: cp.preferredWorkMode || '',
          noticePeriod: cp.noticePeriod || '',
          availabilityToStart: cp.availabilityToStart || '',
        }
      : null,
    resume: candidate.resume
      ? {
          fileName: candidate.resume.fileName || '',
          fileUrl: candidate.resume.fileUrl || '',
          fileSize: candidate.resume.fileSize || null,
          atsScore: candidate.resume.atsScore ?? null,
          uploadedDate: candidate.resume.uploadedAt
            ? new Date(candidate.resume.uploadedAt).toISOString()
            : '',
        }
      : null,
    projects,
    academicAchievements,
    competitiveExams,
    certifications: (candidate.certifications || []).map((cert) => ({
      id: cert.id,
      certificationName: cert.certificationName || '',
      issuingOrganization: cert.issuingOrganization || '',
      issueDate: cert.issueDate || '',
      expiryDate: cert.expiryDate || undefined,
    })),
    accomplishments: (candidate.accomplishments || []).map((acc) => ({
      id: acc.id,
      title: acc.title || '',
      category: acc.category || '',
      organization: acc.organization || '',
      achievementDate: acc.achievementDate || '',
    })),
    visaWorkAuthorization: candidate.visaWorkAuthorization || null,
    vaccination: candidate.vaccination || null,
    latestWorkTitle: latestWork?.jobTitle || latestWork?.title || null,
    latestWorkCompany: latestWork?.company || latestWork?.companyName || null,
  };
}

module.exports = {
  PROFILE_SYNC_INCLUDE,
  buildProfileSnapshot,
};
