const { mapWorkExperienceForClient } = require('./workExperienceEnums');
const { resolveCandidateLocalPhone } = require('./phone.util');
const { filterPortfolioLinks } = require('./portfolioLinkFilter.util');
const {
  extractAcademicAchievementEntries,
  extractCompetitiveExamEntries,
  extractProjectEntries,
  mapEducationForSnapshot,
} = require('./profileSectionEntries.util');

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

function mapEmploymentLabel(status) {
  const map = {
    EMPLOYED: 'Employed',
    UNEMPLOYED: 'Unemployed',
    FREELANCING: 'Freelancing',
    STUDENT: 'Student',
    OTHER: 'Other',
  };
  return map[String(status || '').trim().toUpperCase()] || String(status || '').trim();
}

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
  const academicAchievements = extractAcademicAchievementEntries(candidate.academicAchievement);
  const competitiveExams = extractCompetitiveExamEntries(candidate.competitiveExam);
  const projects = extractProjectEntries(candidate.project);

  const workExperience = (candidate.workExperiences || []).map((exp) => mapWorkExperienceForClient(exp));
  const latestWork = workExperience[0] || null;

  const education = (candidate.educations || []).map(mapEducationForSnapshot);

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
  const preferredIndustries =
    Array.isArray(cp?.preferredIndustries) && cp.preferredIndustries.length
      ? cp.preferredIndustries
      : cp?.preferredIndustry
        ? [cp.preferredIndustry]
        : [];
  const functionalAreas =
    Array.isArray(cp?.functionalAreas) && cp.functionalAreas.length
      ? cp.functionalAreas
      : cp?.functionalArea
        ? [cp.functionalArea]
        : [];

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
          address: profile.address || '',
          nationality: profile.nationality || '',
          passportNumber: profile.passportNumber || '',
          employment: mapEmploymentLabel(profile.employmentStatus),
          linkedinUrl: profile.linkedinUrl || '',
        }
      : null,
    summaryText: candidate.summary?.summaryText || '',
    gapExplanations,
    internships,
    portfolioLinks: filterPortfolioLinks(candidate.portfolioLinks?.links || []),
    education,
    workExperience,
    skills,
    skillsAdditionalNotes: profile?.skillsAdditionalNotes || '',
    languages,
    careerPreferences: cp
      ? {
          currentRole: cp.currentRole || '',
          preferredJobTitles: cp.preferredJobTitles || [],
          preferredRoles: cp.preferredRoles || [],
          preferredIndustries,
          preferredIndustry: cp.preferredIndustry || '',
          functionalAreas,
          functionalArea: cp.functionalArea || '',
          jobTypes: cp.jobTypes || [],
          workModes: cp.workModes || [],
          preferredLocations: cp.preferredLocations || [],
          preferredWorkMode: cp.preferredWorkMode || '',
          relocationPreference: cp.relocationPreference || '',
          salaryCurrency: cp.salaryCurrency || '',
          salaryAmount: cp.salaryAmount ?? '',
          salaryFrequency: cp.salaryFrequency || '',
          preferredCurrency: cp.preferredCurrency || '',
          preferredSalary: cp.preferredSalary ?? '',
          preferredSalaryType: cp.preferredSalaryType || '',
          preferredBenefits: cp.preferredBenefits || [],
          currentCurrency: cp.currentCurrency || '',
          currentSalaryType: cp.currentSalaryType || '',
          currentSalary: cp.currentSalary ?? '',
          currentLocation: cp.currentLocation || '',
          currentBenefits: cp.currentBenefits || [],
          noticePeriod: cp.noticePeriod || '',
          noticePeriodDays: cp.noticePeriodDays ?? '',
          availabilityToStart: cp.availabilityToStart || '',
          openToRelocation: cp.openToRelocation || false,
          passportNumbersByLocation: cp.passportNumbersByLocation || null,
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
      expiryDate: cert.expiryDate || '',
      doesNotExpire: cert.doesNotExpire || false,
      credentialId: cert.credentialId || '',
      credentialUrl: cert.credentialUrl || '',
      certificateFile: cert.certificateFile || '',
      documents: Array.isArray(cert.documents) ? cert.documents : [],
      description: cert.description || '',
    })),
    accomplishments: (candidate.accomplishments || []).map((acc) => ({
      id: acc.id,
      title: acc.title || '',
      category: acc.category || '',
      organization: acc.organization || '',
      achievementDate: acc.achievementDate || '',
      description: acc.description || '',
      supportingDocument: acc.supportingDocument || '',
      documents: Array.isArray(acc.documents) ? acc.documents : [],
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
