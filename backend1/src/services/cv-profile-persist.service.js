const { randomUUID } = require('crypto');
const { prisma } = require('../lib/prisma');
const { Proficiency, Gender, MaritalStatus, EmploymentStatus, WorkMode, EmploymentType, SalaryType } = require('@prisma/client');
const { resolvePhoneNumberForCvSave } = require('../utils/phone.util');

const INTERNSHIP_ENTRIES_PREFIX = '__INTERNSHIP_ENTRIES__:';
const PROJECT_ENTRIES_PREFIX = '__PROJECT_ENTRIES__:';
const ACADEMIC_ACHIEVEMENT_ENTRIES_PREFIX = '__ACADEMIC_ACHIEVEMENT_ENTRIES__:';
const COMPETITIVE_EXAM_ENTRIES_PREFIX = '__COMPETITIVE_EXAM_ENTRIES__:';

function mapProficiency(proficiency) {
  if (!proficiency) return Proficiency.INTERMEDIATE;
  const upper = String(proficiency).toUpperCase();
  if (['NATIVE', 'FLUENT', 'EXPERT', 'ADVANCED'].includes(upper)) return Proficiency.ADVANCED;
  if (['BEGINNER', 'BASIC', 'ELEMENTARY'].includes(upper)) return Proficiency.BEGINNER;
  return Proficiency.INTERMEDIATE;
}

function normalizeGender(value) {
  if (!value) return null;
  const key = String(value).trim().toUpperCase();
  const map = { MALE: Gender.MALE, FEMALE: Gender.FEMALE, OTHER: Gender.OTHER, M: Gender.MALE, F: Gender.FEMALE };
  return map[key] || null;
}

function normalizeMaritalStatus(value) {
  if (!value) return null;
  const key = String(value).trim().toUpperCase();
  const map = {
    SINGLE: MaritalStatus.SINGLE,
    UNMARRIED: MaritalStatus.SINGLE,
    MARRIED: MaritalStatus.MARRIED,
    DIVORCED: MaritalStatus.DIVORCED,
    WIDOWED: MaritalStatus.WIDOWED,
  };
  return map[key] || null;
}

function normalizeEmploymentStatus(value) {
  if (!value) return null;
  const key = String(value).trim().toUpperCase().replace(/\s+/g, '_');
  const map = {
    EMPLOYED: EmploymentStatus.EMPLOYED,
    UNEMPLOYED: EmploymentStatus.UNEMPLOYED,
    FREELANCING: EmploymentStatus.FREELANCING,
    FREELANCE: EmploymentStatus.FREELANCING,
    STUDENT: EmploymentStatus.STUDENT,
    FRESHER: EmploymentStatus.STUDENT,
    OTHER: EmploymentStatus.OTHER,
  };
  return map[key] || null;
}

function normalizeWorkMode(value) {
  if (!value) return null;
  const key = String(value).trim().toUpperCase().replace(/[\s-]+/g, '_');
  const map = {
    REMOTE: WorkMode.REMOTE,
    ON_SITE: WorkMode.ON_SITE,
    ONSITE: WorkMode.ON_SITE,
    'ON-SITE': WorkMode.ON_SITE,
    HYBRID: WorkMode.HYBRID,
  };
  return map[key] || null;
}

function normalizeEmploymentType(value) {
  if (!value) return null;
  const key = String(value).trim().toUpperCase().replace(/[\s-]+/g, '_');
  const map = {
    FULL_TIME: EmploymentType.FULL_TIME,
    'FULL-TIME': EmploymentType.FULL_TIME,
    PART_TIME: EmploymentType.PART_TIME,
    CONTRACT: EmploymentType.CONTRACT,
    INTERNSHIP: EmploymentType.INTERNSHIP,
    FREELANCE: EmploymentType.FREELANCE,
  };
  return map[key] || null;
}

function normalizeSalaryType(value) {
  if (!value) return null;
  const key = String(value).trim().toUpperCase();
  const map = {
    MONTHLY: SalaryType.MONTHLY,
    ANNUAL: SalaryType.ANNUAL,
    ANNUALLY: SalaryType.ANNUAL,
    HOURLY: SalaryType.HOURLY,
    DAILY: SalaryType.DAILY,
  };
  return map[key] || null;
}

function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isPlaceholderWorkExp(exp) {
  const title = String(exp?.jobTitle || '').trim().toLowerCase();
  const company = String(exp?.company || '').trim().toLowerCase();
  return (
    !title ||
    title === 'n/a' ||
    title === 'fresher' ||
    title.includes('fresher') ||
    (title === 'fresher' && (!company || company === 'n/a' || company === 'na'))
  );
}

function encodeEntries(prefix, entries) {
  try {
    return `${prefix}${Buffer.from(JSON.stringify(entries), 'utf8').toString('base64')}`;
  } catch {
    return null;
  }
}

function buildDocumentsWithEncodedEntries(plainDocs, allEntries, prefix) {
  const plain = (Array.isArray(plainDocs) ? plainDocs : []).filter(
    (d) => typeof d === 'string' && d.trim() && !d.startsWith(prefix)
  );
  const encoded = encodeEntries(prefix, allEntries);
  return encoded ? [...plain, encoded] : plain;
}

async function persistExtractedCvProfile(candidateId, parsedData, { candidate } = {}) {
  const stats = {
    profile: false,
    summary: false,
    education: 0,
    workExperience: 0,
    internships: 0,
    skills: 0,
    languages: 0,
    projects: 0,
    certifications: 0,
    accomplishments: 0,
    academicAchievements: 0,
    competitiveExams: 0,
    gapExplanation: false,
    careerPreferences: false,
    portfolioLinks: 0,
  };

  const pi = parsedData.personalInformation || {};

  if (pi && Object.keys(pi).length > 0) {
    const genderEnum = normalizeGender(pi.gender);
    const maritalStatusEnum = normalizeMaritalStatus(pi.maritalStatus);
    const employmentStatusEnum = normalizeEmploymentStatus(pi.employmentStatus);

    const existingProfile = await prisma.candidateProfile.findUnique({ where: { candidateId } });
    const resolvedPhoneNumber = resolvePhoneNumberForCvSave({
      candidate,
      cvPhone: pi.phoneNumber,
      existingPhone: existingProfile?.phoneNumber,
    });

    const fullName =
      pi.fullName ||
      [pi.firstName, pi.middleName, pi.lastName].filter(Boolean).join(' ').trim() ||
      existingProfile?.fullName ||
      '';

    const profileData = {
      fullName,
      email: pi.email || existingProfile?.email || `${candidateId}@noemail.local`,
      phoneNumber: resolvedPhoneNumber,
      alternatePhone: pi.alternatePhoneNumber ?? existingProfile?.alternatePhone ?? null,
      address: pi.address ?? existingProfile?.address ?? null,
      city: pi.city ?? existingProfile?.city ?? null,
      country: pi.country ?? existingProfile?.country ?? null,
      linkedinUrl: pi.linkedinProfile ?? existingProfile?.linkedinUrl ?? null,
      dateOfBirth: pi.dateOfBirth ? parseDate(pi.dateOfBirth) : existingProfile?.dateOfBirth ?? null,
      gender: genderEnum ?? existingProfile?.gender ?? null,
      maritalStatus: maritalStatusEnum ?? existingProfile?.maritalStatus ?? null,
      nationality: pi.nationality ?? existingProfile?.nationality ?? null,
      passportNumber: pi.passportNumber ?? existingProfile?.passportNumber ?? null,
      employmentStatus: employmentStatusEnum ?? existingProfile?.employmentStatus ?? null,
      skillsAdditionalNotes: parsedData.skillsAdditionalNotes ?? existingProfile?.skillsAdditionalNotes ?? null,
      updatedAt: new Date(),
    };

    if (existingProfile) {
      await prisma.candidateProfile.update({ where: { candidateId }, data: profileData });
    } else {
      await prisma.candidateProfile.create({ data: { candidateId, ...profileData } });
    }
    stats.profile = true;

    const firstName = pi.firstName || fullName.split(/\s+/)[0] || null;
    const lastName =
      pi.lastName ||
      (fullName.split(/\s+/).length > 1 ? fullName.split(/\s+/).slice(-1)[0] : null);

    try {
      await prisma.candidate.update({
        where: { id: candidateId },
        data: {
          email: profileData.email,
          firstName,
          lastName,
          phone: resolvedPhoneNumber || candidate?.phone || null,
          city: profileData.city,
          country: profileData.country,
          location: [profileData.city, profileData.country].filter(Boolean).join(', ') || null,
          addressLine: profileData.address,
        },
      });
    } catch (err) {
      console.warn('Candidate mirror update from CV failed:', err?.message || err);
    }
  }

  if (parsedData.summary && String(parsedData.summary).trim()) {
    await prisma.candidateSummary.upsert({
      where: { candidateId },
      update: { summaryText: String(parsedData.summary).trim(), updatedAt: new Date() },
      create: { candidateId, summaryText: String(parsedData.summary).trim() },
    });
    stats.summary = true;
  }

  if (Array.isArray(parsedData.education) && parsedData.education.length > 0) {
    await prisma.education.deleteMany({ where: { candidateId } });
    for (const edu of parsedData.education) {
      if (!edu.degree && !edu.institution) continue;
      await prisma.education.create({
        data: {
          candidateId,
          educationLevel: edu.educationLevel || null,
          degree: edu.degree || 'Not specified',
          institution: edu.institution || 'Not specified',
          specialization: edu.specialization || null,
          startYear: edu.startYear || new Date().getFullYear() - 4,
          startMonth: edu.startMonth || null,
          endYear: edu.endYear || null,
          endMonth: edu.endMonth || null,
          isOngoing: Boolean(edu.isOngoing) || !edu.endYear,
          grade: edu.grade || null,
          modeOfStudy: edu.modeOfStudy || null,
          courseDuration: edu.courseDuration || null,
          description: edu.description || edu.location || null,
        },
      });
      stats.education += 1;
    }
  }

  const workRows = (parsedData.workExperience || []).filter((exp) => !isPlaceholderWorkExp(exp));
  if (workRows.length > 0) {
    await prisma.workExperience.deleteMany({ where: { candidateId } });
    for (const exp of workRows) {
      await prisma.workExperience.create({
        data: {
          candidateId,
          jobTitle: exp.jobTitle || 'Not specified',
          company: exp.company || 'Not specified',
          workLocation: exp.workLocation || null,
          workMode: normalizeWorkMode(exp.workMode),
          startDate: parseDate(exp.startDate) || new Date(),
          endDate: exp.endDate ? parseDate(exp.endDate) : null,
          isCurrentJob: Boolean(exp.currentlyWorking),
          responsibilities: exp.responsibilities || null,
          industry: exp.industry || null,
          employmentType: normalizeEmploymentType(exp.employmentType),
          numberOfReportees: exp.numberOfReportees || null,
          companyProfile: exp.companyProfile || null,
          companyTurnover: exp.companyTurnover || null,
          achievements: exp.achievements || null,
          workSkills: Array.isArray(exp.workSkills) ? exp.workSkills : [],
        },
      });
      stats.workExperience += 1;
    }
  }

  const technicalSkills = Array.isArray(parsedData.skills) ? parsedData.skills : [];
  if (technicalSkills.length > 0) {
    await prisma.candidateSkill.deleteMany({ where: { candidateId } });
    for (const skillData of technicalSkills) {
      const name = (skillData.name || skillData.languageName || '').trim();
      if (!name) continue;
      let skill = await prisma.skill.findUnique({ where: { name } });
      if (!skill) {
        skill = await prisma.skill.create({
          data: { name, category: skillData.category || null },
        });
      }
      await prisma.candidateSkill.create({
        data: {
          candidateId,
          skillId: skill.id,
          proficiency: mapProficiency(skillData.proficiency),
          yearsOfExp: skillData.yearsOfExp || null,
          isAiSuggested: true,
        },
      });
      stats.skills += 1;
    }
  }

  const languages = Array.isArray(parsedData.languages) ? parsedData.languages : [];
  if (languages.length > 0) {
    await prisma.candidateLanguage.deleteMany({ where: { candidateId } });
    for (const lang of languages) {
      const name = (lang.name || lang.languageName || '').trim();
      if (!name) continue;
      await prisma.candidateLanguage.create({
        data: {
          candidateId,
          name,
          proficiency: mapProficiency(lang.proficiency),
          canSpeak: lang.speak !== false,
          canRead: lang.read !== false,
          canWrite: lang.write !== false,
        },
      });
      stats.languages += 1;
    }
  }

  const internships = Array.isArray(parsedData.internships) ? parsedData.internships : [];
  if (internships.length > 0) {
    const entries = internships.map((item) => ({
      id: randomUUID(),
      internshipTitle: item.internshipTitle || '',
      companyName: item.companyName || '',
      internshipType: item.internshipType || '',
      domainDepartment: item.domainDepartment || '',
      startDate: item.startDate || '',
      endDate: item.endDate || '',
      currentlyWorking: Boolean(item.currentlyWorking),
      location: item.location || '',
      workMode: item.workMode || '',
      responsibilities: item.responsibilities || '',
      learnings: item.learnings || '',
      skills: Array.isArray(item.skills) ? item.skills : [],
      documents: [],
    }));
    const latest = entries[entries.length - 1];
    await prisma.candidateInternship.upsert({
      where: { candidateId },
      update: {
        internshipTitle: latest.internshipTitle,
        companyName: latest.companyName,
        internshipType: latest.internshipType || null,
        domainDepartment: latest.domainDepartment || null,
        startDate: latest.startDate ? parseDate(latest.startDate) : null,
        endDate: latest.endDate ? parseDate(latest.endDate) : null,
        currentlyWorking: latest.currentlyWorking,
        location: latest.location || null,
        workMode: latest.workMode || null,
        responsibilities: latest.responsibilities || null,
        learnings: latest.learnings || null,
        skills: latest.skills,
        documents: buildDocumentsWithEncodedEntries([], entries, INTERNSHIP_ENTRIES_PREFIX),
      },
      create: {
        candidateId,
        internshipTitle: latest.internshipTitle,
        companyName: latest.companyName,
        internshipType: latest.internshipType || null,
        domainDepartment: latest.domainDepartment || null,
        startDate: latest.startDate ? parseDate(latest.startDate) : null,
        endDate: latest.endDate ? parseDate(latest.endDate) : null,
        currentlyWorking: latest.currentlyWorking,
        location: latest.location || null,
        workMode: latest.workMode || null,
        responsibilities: latest.responsibilities || null,
        learnings: latest.learnings || null,
        skills: latest.skills,
        documents: buildDocumentsWithEncodedEntries([], entries, INTERNSHIP_ENTRIES_PREFIX),
      },
    });
    stats.internships = entries.length;
  }

  const projects = Array.isArray(parsedData.projects) ? parsedData.projects : [];
  if (projects.length > 0) {
    const entries = projects.map((item) => ({
      id: randomUUID(),
      projectTitle: item.projectTitle || '',
      projectType: item.projectType || 'Personal',
      organizationClient: item.organizationClient || '',
      currentlyWorking: Boolean(item.currentlyWorking),
      startDate: item.startDate || '',
      endDate: item.endDate || '',
      projectDescription: item.projectDescription || '',
      responsibilities: item.responsibilities || '',
      technologies: Array.isArray(item.technologies) ? item.technologies : [],
      projectOutcome: item.projectOutcome || '',
      projectLink: item.projectLink || '',
      documents: [],
    }));
    const latest = entries[entries.length - 1];
    await prisma.candidateProject.upsert({
      where: { candidateId },
      update: {
        projectTitle: latest.projectTitle,
        projectType: latest.projectType || 'Personal',
        organizationClient: latest.organizationClient || null,
        currentlyWorking: latest.currentlyWorking,
        startDate: latest.startDate ? parseDate(latest.startDate) : null,
        endDate: latest.endDate ? parseDate(latest.endDate) : null,
        projectDescription: latest.projectDescription || null,
        responsibilities: latest.responsibilities || null,
        technologies: latest.technologies,
        projectOutcome: latest.projectOutcome || null,
        projectLink: latest.projectLink || null,
        documents: buildDocumentsWithEncodedEntries([], entries, PROJECT_ENTRIES_PREFIX),
      },
      create: {
        candidateId,
        projectTitle: latest.projectTitle,
        projectType: latest.projectType || 'Personal',
        organizationClient: latest.organizationClient || null,
        currentlyWorking: latest.currentlyWorking,
        startDate: latest.startDate ? parseDate(latest.startDate) : null,
        endDate: latest.endDate ? parseDate(latest.endDate) : null,
        projectDescription: latest.projectDescription || null,
        responsibilities: latest.responsibilities || null,
        technologies: latest.technologies,
        projectOutcome: latest.projectOutcome || null,
        projectLink: latest.projectLink || null,
        documents: buildDocumentsWithEncodedEntries([], entries, PROJECT_ENTRIES_PREFIX),
      },
    });
    stats.projects = entries.length;
  }

  const certifications = Array.isArray(parsedData.certifications) ? parsedData.certifications : [];
  if (certifications.length > 0) {
    await prisma.candidateCertification.deleteMany({ where: { candidateId } });
    for (const cert of certifications) {
      if (!cert.certificationName && !cert.issuingOrganization) continue;
      await prisma.candidateCertification.create({
        data: {
          candidateId,
          certificationName: cert.certificationName || 'Certification',
          issuingOrganization: cert.issuingOrganization || 'Unknown',
          issueDate: cert.issueDate || '',
          expiryDate: cert.expiryDate || null,
          doesNotExpire: Boolean(cert.doesNotExpire),
          credentialId: cert.credentialId || null,
          credentialUrl: cert.credentialUrl || null,
          description: cert.description || null,
        },
      });
      stats.certifications += 1;
    }
  }

  const accomplishments = Array.isArray(parsedData.accomplishments) ? parsedData.accomplishments : [];
  if (accomplishments.length > 0) {
    await prisma.candidateAccomplishment.deleteMany({ where: { candidateId } });
    for (const item of accomplishments) {
      if (!item.title) continue;
      await prisma.candidateAccomplishment.create({
        data: {
          candidateId,
          title: item.title,
          category: item.category || 'Other',
          organization: item.organization || null,
          achievementDate: item.achievementDate || '',
          description: item.description || null,
        },
      });
      stats.accomplishments += 1;
    }
  }

  const academicAchievements = Array.isArray(parsedData.academicAchievements)
    ? parsedData.academicAchievements
    : [];
  if (academicAchievements.length > 0) {
    const entries = academicAchievements.map((item) => ({
      id: randomUUID(),
      achievementTitle: item.achievementTitle || '',
      awardedBy: item.awardedBy || '',
      yearReceived: item.yearReceived || '',
      categoryType: item.categoryType || '',
      description: item.description || '',
      documents: [],
    }));
    const latest = entries[entries.length - 1];
    await prisma.candidateAcademicAchievement.upsert({
      where: { candidateId },
      update: {
        achievementTitle: latest.achievementTitle,
        awardedBy: latest.awardedBy,
        yearReceived: latest.yearReceived,
        categoryType: latest.categoryType || null,
        description: latest.description || null,
        documents: buildDocumentsWithEncodedEntries([], entries, ACADEMIC_ACHIEVEMENT_ENTRIES_PREFIX),
      },
      create: {
        candidateId,
        achievementTitle: latest.achievementTitle,
        awardedBy: latest.awardedBy,
        yearReceived: latest.yearReceived,
        categoryType: latest.categoryType || null,
        description: latest.description || null,
        documents: buildDocumentsWithEncodedEntries([], entries, ACADEMIC_ACHIEVEMENT_ENTRIES_PREFIX),
      },
    });
    stats.academicAchievements = entries.length;
  }

  const competitiveExams = Array.isArray(parsedData.competitiveExams) ? parsedData.competitiveExams : [];
  if (competitiveExams.length > 0) {
    const entries = competitiveExams.map((item) => ({
      id: randomUUID(),
      examName: item.examName || '',
      yearTaken: item.yearTaken || '',
      resultStatus: item.resultStatus || '',
      scoreMarks: item.scoreMarks || '',
      scoreType: item.scoreType || '',
      validUntil: item.validUntil || '',
      additionalNotes: item.additionalNotes || '',
      documents: [],
    }));
    const latest = entries[entries.length - 1];
    await prisma.candidateCompetitiveExam.upsert({
      where: { candidateId },
      update: {
        examName: latest.examName,
        yearTaken: latest.yearTaken,
        resultStatus: latest.resultStatus,
        scoreMarks: latest.scoreMarks || null,
        scoreType: latest.scoreType || null,
        validUntil: latest.validUntil || null,
        additionalNotes: latest.additionalNotes || null,
        documents: buildDocumentsWithEncodedEntries([], entries, COMPETITIVE_EXAM_ENTRIES_PREFIX),
      },
      create: {
        candidateId,
        examName: latest.examName,
        yearTaken: latest.yearTaken,
        resultStatus: latest.resultStatus,
        scoreMarks: latest.scoreMarks || null,
        scoreType: latest.scoreType || null,
        validUntil: latest.validUntil || null,
        additionalNotes: latest.additionalNotes || null,
        documents: buildDocumentsWithEncodedEntries([], entries, COMPETITIVE_EXAM_ENTRIES_PREFIX),
      },
    });
    stats.competitiveExams = entries.length;
  }

  const gap = parsedData.gapExplanation;
  if (gap && (gap.gapCategory || gap.reasonForGap || gap.gapDuration)) {
    await prisma.candidateGapExplanation.upsert({
      where: { candidateId },
      update: {
        gapCategory: gap.gapCategory || '',
        reasonForGap: gap.reasonForGap || '',
        gapDuration: gap.gapDuration || '',
        selectedSkills: Array.isArray(gap.selectedSkills) ? gap.selectedSkills : [],
        coursesText: gap.coursesText || null,
        preferredSupport: gap.preferredSupport || null,
        updatedAt: new Date(),
      },
      create: {
        candidateId,
        gapCategory: gap.gapCategory || '',
        reasonForGap: gap.reasonForGap || '',
        gapDuration: gap.gapDuration || '',
        selectedSkills: Array.isArray(gap.selectedSkills) ? gap.selectedSkills : [],
        coursesText: gap.coursesText || null,
        preferredSupport: gap.preferredSupport || null,
      },
    });
    stats.gapExplanation = true;
  }

  const cp = parsedData.careerPreferences;
  if (cp && typeof cp === 'object') {
    const prefData = {
      currentCurrency: cp.currentCurrency || 'INR',
      currentSalaryType: normalizeSalaryType(cp.currentSalaryType),
      currentSalary: cp.currentSalary != null ? Number(cp.currentSalary) : null,
      currentLocation: cp.currentLocation || null,
      currentBenefits: Array.isArray(cp.currentBenefits) ? cp.currentBenefits : [],
      preferredRoles: Array.isArray(cp.preferredRoles) ? cp.preferredRoles : [],
      preferredIndustry: cp.preferredIndustry || null,
      functionalArea: cp.functionalArea || null,
      jobTypes: Array.isArray(cp.jobTypes) ? cp.jobTypes : [],
      preferredWorkMode: normalizeWorkMode(cp.preferredWorkMode),
      preferredLocations: Array.isArray(cp.preferredLocations) ? cp.preferredLocations : [],
      relocationPreference: cp.relocationPreference || null,
      preferredCurrency: cp.preferredCurrency || 'INR',
      preferredSalaryType: normalizeSalaryType(cp.preferredSalaryType),
      preferredSalary: cp.preferredSalary != null ? Number(cp.preferredSalary) : null,
      preferredBenefits: Array.isArray(cp.preferredBenefits) ? cp.preferredBenefits : [],
      availabilityToStart: cp.availabilityToStart || null,
      noticePeriod: cp.noticePeriod || null,
      openToRelocation: Boolean(cp.openToRelocation),
      updatedAt: new Date(),
    };
    await prisma.careerPreferences.upsert({
      where: { candidateId },
      update: prefData,
      create: { candidateId, ...prefData },
    });
    stats.careerPreferences = true;
  }

  return stats;
}

module.exports = {
  persistExtractedCvProfile,
  mapProficiency,
  isPlaceholderWorkExp,
};
