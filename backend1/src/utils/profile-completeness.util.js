const { prisma } = require('../lib/prisma');

const SECTION_KEYS = {
  BASIC_INFORMATION: 'basicInformation',
  SUMMARY: 'summary',
  EDUCATION: 'education',
  SKILLS: 'skills',
  LANGUAGES: 'languages',
  PROJECTS: 'projects',
  PORTFOLIO_LINKS: 'portfolioLinks',
  CAREER_PREFERENCES: 'careerPreferences',
  VISA_AUTHORIZATION: 'visaWorkAuthorization',
  VACCINATION: 'vaccination',
  RESUME: 'resume',
};

const SECTION_ORDER = [
  SECTION_KEYS.BASIC_INFORMATION,
  SECTION_KEYS.SUMMARY,
  SECTION_KEYS.EDUCATION,
  SECTION_KEYS.SKILLS,
  SECTION_KEYS.LANGUAGES,
  SECTION_KEYS.PROJECTS,
  SECTION_KEYS.PORTFOLIO_LINKS,
  SECTION_KEYS.CAREER_PREFERENCES,
  SECTION_KEYS.VISA_AUTHORIZATION,
  SECTION_KEYS.VACCINATION,
  SECTION_KEYS.RESUME,
];

function splitFullName(fullName = '') {
  const parts = String(fullName).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) {
    return { firstName: '', lastName: '' };
  }

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

function hasValue(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'string') return value.trim().length > 0;
  return value !== null && value !== undefined;
}

function normalizeSection(section) {
  return {
    ...section,
    missingFields: Array.from(new Set(section.missingFields.filter(Boolean))),
  };
}

function buildSections(candidate) {
  const nameParts = splitFullName(candidate.profile?.fullName || '');
  const basicInfo = candidate.profile || null;
  const summary = candidate.summary || null;
  const educations = candidate.educations || [];
  const skills = candidate.skills || [];
  const languages = candidate.languages || [];
  const project = candidate.project || null;
  const portfolioLinks = candidate.portfolioLinks || null;
  const careerPreferences = candidate.careerPreferences || null;
  const visaWorkAuthorization = candidate.visaWorkAuthorization || null;
  const vaccination = candidate.vaccination || null;
  const resume = candidate.resume || null;

  const educationEntry = educations[0] || null;
  const projectFields = project
    ? {
        projectTitle: project.projectTitle,
        projectDescription: project.projectDescription,
        technologies: project.technologies,
      }
    : null;

  const portfolioEntries = Array.isArray(portfolioLinks?.links) ? portfolioLinks.links : [];

  const sections = [
    {
      key: SECTION_KEYS.BASIC_INFORMATION,
      label: 'Basic Information',
      completionRule: 'First name, last name, and email are required.',
      schemaFields: [
        'fullName',
        'email',
        'phoneNumber',
        'alternatePhone',
        'profilePhotoUrl',
        'gender',
        'dateOfBirth',
        'maritalStatus',
        'address',
        'city',
        'country',
        'nationality',
        'passportNumber',
        'linkedinUrl',
        'employmentStatus',
      ],
      requiredFields: ['firstName', 'lastName', 'email'],
      missingFields: [
        !hasValue(nameParts.firstName) ? 'firstName' : null,
        !hasValue(nameParts.lastName) ? 'lastName' : null,
        !hasValue(basicInfo?.email) ? 'email' : null,
      ],
      isComplete:
        hasValue(nameParts.firstName) &&
        hasValue(nameParts.lastName) &&
        hasValue(basicInfo?.email),
    },
    {
      key: SECTION_KEYS.SUMMARY,
      label: 'Summary',
      completionRule: 'A non-empty professional summary is required.',
      schemaFields: ['summaryText'],
      requiredFields: ['summaryText'],
      missingFields: !hasValue(summary?.summaryText) ? ['summaryText'] : [],
      isComplete: hasValue(summary?.summaryText),
    },
    {
      key: SECTION_KEYS.EDUCATION,
      label: 'Education',
      completionRule: 'At least one education entry is required.',
      schemaFields: [
        'educationLevel',
        'degree',
        'institution',
        'specialization',
        'startYear',
        'endYear',
        'isOngoing',
        'grade',
        'modeOfStudy',
        'courseDuration',
        'description',
        'documents',
      ],
      requiredFields: ['degree', 'institution', 'startYear'],
      missingFields: educationEntry
        ? [
            !hasValue(educationEntry.degree) ? 'degree' : null,
            !hasValue(educationEntry.institution) ? 'institution' : null,
            !hasValue(educationEntry.startYear) ? 'startYear' : null,
            !hasValue(educationEntry.specialization) ? 'fieldOfStudy' : null,
            !hasValue(educationEntry.endYear) && !educationEntry.isOngoing ? 'endYear' : null,
          ]
        : ['degree', 'institution', 'startYear', 'fieldOfStudy', 'endYear'],
      isComplete:
        educations.length > 0 &&
        educations.some(
          (entry) =>
            hasValue(entry.degree) &&
            hasValue(entry.institution) &&
            hasValue(entry.startYear)
        ),
    },
    {
      key: SECTION_KEYS.SKILLS,
      label: 'Skills',
      completionRule: 'At least one skill entry is required.',
      schemaFields: ['skill.name', 'skill.category', 'proficiency', 'yearsOfExp', 'isAiSuggested', 'skillsAdditionalNotes'],
      requiredFields: ['name', 'proficiency'],
      missingFields:
        skills.length > 0
          ? skills.flatMap((entry, index) => [
              !hasValue(entry.skill?.name) ? `skills[${index}].name` : null,
              !hasValue(entry.proficiency) ? `skills[${index}].proficiency` : null,
            ])
          : ['name', 'proficiency'],
      isComplete:
        skills.length > 0 &&
        skills.some((entry) => hasValue(entry.skill?.name) && hasValue(entry.proficiency)),
    },
    {
      key: SECTION_KEYS.LANGUAGES,
      label: 'Languages',
      completionRule: 'At least one language entry is required.',
      schemaFields: ['name', 'proficiency', 'canSpeak', 'canRead', 'canWrite', 'documents'],
      requiredFields: ['name', 'proficiency'],
      missingFields:
        languages.length > 0
          ? languages.flatMap((entry, index) => [
              !hasValue(entry.name) ? `languages[${index}].name` : null,
              !hasValue(entry.proficiency) ? `languages[${index}].proficiency` : null,
            ])
          : ['name', 'proficiency'],
      isComplete:
        languages.length > 0 &&
        languages.some((entry) => hasValue(entry.name) && hasValue(entry.proficiency)),
    },
    {
      key: SECTION_KEYS.PROJECTS,
      label: 'Projects',
      completionRule: 'At least one project is required.',
      schemaFields: [
        'projectTitle',
        'projectType',
        'organizationClient',
        'currentlyWorking',
        'startDate',
        'endDate',
        'projectDescription',
        'responsibilities',
        'technologies',
        'projectOutcome',
        'projectLink',
        'documents',
      ],
      requiredFields: ['projectTitle', 'projectDescription', 'technologies'],
      missingFields: projectFields
        ? [
            !hasValue(projectFields.projectTitle) ? 'projectTitle' : null,
            !hasValue(projectFields.projectDescription) ? 'projectDescription' : null,
            !hasValue(projectFields.technologies) ? 'technologies' : null,
          ]
        : ['projectTitle', 'projectDescription', 'technologies'],
      isComplete:
        hasValue(project?.projectTitle) &&
        hasValue(project?.projectDescription) &&
        hasValue(project?.technologies),
    },
    {
      key: SECTION_KEYS.PORTFOLIO_LINKS,
      label: 'Portfolio Links',
      completionRule: 'At least one portfolio link is required.',
      schemaFields: ['links[].linkType', 'links[].url', 'links[].title', 'links[].description'],
      requiredFields: ['url', 'linkType'],
      missingFields:
        portfolioEntries.length > 0
          ? portfolioEntries.flatMap((entry, index) => [
              !hasValue(entry?.url) ? `links[${index}].url` : null,
              !hasValue(entry?.linkType) ? `links[${index}].linkType` : null,
            ])
          : ['url', 'linkType'],
      isComplete:
        portfolioEntries.length > 0 &&
        portfolioEntries.some((entry) => hasValue(entry?.url) && hasValue(entry?.linkType)),
    },
    {
      key: SECTION_KEYS.CAREER_PREFERENCES,
      label: 'Career Preferences',
      completionRule: 'Any saved career preferences object counts as complete.',
      schemaFields: [
        'currentCurrency',
        'currentSalaryType',
        'currentSalary',
        'currentLocation',
        'currentBenefits',
        'preferredRoles',
        'preferredIndustry',
        'functionalArea',
        'jobTypes',
        'preferredWorkMode',
        'preferredLocations',
        'relocationPreference',
        'preferredCurrency',
        'preferredSalaryType',
        'preferredSalary',
        'preferredBenefits',
        'availabilityToStart',
        'noticePeriodDays',
        'noticePeriod',
        'openToRelocation',
        'passportNumbersByLocation',
      ],
      requiredFields: [],
      missingFields: !careerPreferences
        ? ['preferredRoles', 'preferredLocations', 'preferredSalary', 'availabilityToStart']
        : [],
      isComplete: Boolean(careerPreferences),
    },
    {
      key: SECTION_KEYS.VISA_AUTHORIZATION,
      label: 'Visa & Work Authorization',
      completionRule: 'Any saved visa/work authorization object counts as complete.',
      schemaFields: [
        'selectedDestination',
        'visaDetailsInitial',
        'visaDetailsExpected',
        'visaWorkpermitRequired',
        'openForAll',
        'additionalRemarks',
        'visaEntries',
      ],
      requiredFields: [],
      missingFields: !visaWorkAuthorization
        ? ['selectedDestination', 'visaWorkpermitRequired']
        : [],
      isComplete: Boolean(visaWorkAuthorization),
    },
    {
      key: SECTION_KEYS.VACCINATION,
      label: 'Vaccination',
      completionRule: 'Any saved vaccination object counts as complete.',
      schemaFields: ['vaccinationStatus', 'vaccineType', 'lastVaccinationDate', 'certificate'],
      requiredFields: [],
      missingFields: !vaccination ? ['vaccinationStatus'] : [],
      isComplete: Boolean(vaccination),
    },
    {
      key: SECTION_KEYS.RESUME,
      label: 'Resume',
      completionRule: 'A resume file with a valid file URL is required.',
      schemaFields: ['fileName', 'fileUrl', 'fileSize', 'mimeType', 'atsScore', 'aiAnalyzed', 'resumeJson', 'resumeHtml', 'templateId'],
      requiredFields: ['fileUrl'],
      missingFields: !hasValue(resume?.fileUrl) ? ['fileUrl'] : [],
      isComplete: hasValue(resume?.fileUrl),
    },
  ];

  return SECTION_ORDER.map((key) => normalizeSection(sections.find((section) => section.key === key)));
}

async function fetchCandidateProfileGraph(candidateId) {
  return prisma.candidate.findUnique({
    where: { id: candidateId },
    include: {
      profile: true,
      summary: true,
      educations: {
        orderBy: { startYear: 'desc' },
      },
      skills: {
        include: {
          skill: true,
        },
      },
      languages: true,
      project: true,
      portfolioLinks: true,
      careerPreferences: true,
      visaWorkAuthorization: true,
      vaccination: true,
      resume: true,
    },
  });
}

async function persistCompletion(candidateId, percentage) {
  const existingProfile = await prisma.candidateProfile.findUnique({
    where: { candidateId },
    select: { id: true, fullName: true, email: true },
  });

  if (existingProfile) {
    await prisma.candidateProfile.update({
      where: { candidateId },
      data: { profileCompleteness: percentage },
    });
  }

  await prisma.dashboardStats.upsert({
    where: { candidateId },
    update: {
      profileCompleteness: percentage,
      lastUpdated: new Date(),
    },
    create: {
      candidateId,
      profileCompleteness: percentage,
    },
  });
}

async function getMissingProfileSections(candidateId, options = {}) {
  const candidate = options.candidate || (await fetchCandidateProfileGraph(candidateId));

  if (!candidate) {
    const error = new Error('Candidate not found');
    error.statusCode = 404;
    throw error;
  }

  const sections = buildSections(candidate);
  const completedSections = sections.filter((section) => section.isComplete).map((section) => section.label);
  const incompleteSections = sections.filter((section) => !section.isComplete);
  const missingSections = incompleteSections.map((section) => section.label);
  const percentage = Math.round((completedSections.length / sections.length) * 100);

  if (options.persist) {
    await persistCompletion(candidateId, percentage);
  }

  return {
    candidateId,
    percentage,
    completedSections,
    missingSections,
    sections,
  };
}

module.exports = {
  SECTION_KEYS,
  SECTION_ORDER,
  fetchCandidateProfileGraph,
  getMissingProfileSections,
};
