const { randomUUID } = require('crypto');

const ACADEMIC_ACHIEVEMENT_ENTRIES_PREFIX = '__ACADEMIC_ACHIEVEMENT_ENTRIES__:';
const COMPETITIVE_EXAM_ENTRIES_PREFIX = '__COMPETITIVE_EXAM_ENTRIES__:';
const PROJECT_ENTRIES_PREFIX = '__PROJECT_ENTRIES__:';

function stripAcademicAchievementMetadataDocuments(documents = []) {
  return documents.filter(
    (doc) =>
      typeof doc === 'string' &&
      doc.trim() &&
      !doc.startsWith(ACADEMIC_ACHIEVEMENT_ENTRIES_PREFIX)
  );
}

function decodeAcademicAchievementEntriesFromDocuments(documents = []) {
  const encodedEntry = documents.find(
    (doc) =>
      typeof doc === 'string' && doc.startsWith(ACADEMIC_ACHIEVEMENT_ENTRIES_PREFIX)
  );
  if (!encodedEntry) return [];

  try {
    const encodedPayload = encodedEntry.slice(ACADEMIC_ACHIEVEMENT_ENTRIES_PREFIX.length);
    const parsed = JSON.parse(Buffer.from(encodedPayload, 'base64').toString('utf8'));
    if (!Array.isArray(parsed)) return [];
    return parsed.map((entry) =>
      buildAcademicAchievementEntryFromPayload(entry, randomUUID())
    );
  } catch (_error) {
    return [];
  }
}

function buildAcademicAchievementEntryFromPayload(data = {}, fallbackId = randomUUID()) {
  const normalizedDocuments = Array.isArray(data.documents)
    ? data.documents
        .map((doc) => (typeof doc === 'string' ? doc : doc?.url || doc?.name))
        .filter(
          (doc) =>
            typeof doc === 'string' &&
            doc.trim() &&
            !doc.startsWith(ACADEMIC_ACHIEVEMENT_ENTRIES_PREFIX)
        )
    : [];

  return {
    id: typeof data.id === 'string' && data.id.trim() ? data.id.trim() : fallbackId,
    achievementTitle: typeof data.achievementTitle === 'string' ? data.achievementTitle : '',
    awardedBy: typeof data.awardedBy === 'string' ? data.awardedBy : '',
    yearReceived: typeof data.yearReceived === 'string' ? data.yearReceived : '',
    categoryType: typeof data.categoryType === 'string' ? data.categoryType : '',
    description: typeof data.description === 'string' ? data.description : '',
    documents: normalizedDocuments,
  };
}

function extractAcademicAchievementEntries(academicAchievementRecord) {
  if (!academicAchievementRecord) return [];

  const documents = Array.isArray(academicAchievementRecord.documents)
    ? academicAchievementRecord.documents
    : [];
  const extractedFromMetadata =
    decodeAcademicAchievementEntriesFromDocuments(documents);
  if (extractedFromMetadata.length > 0) {
    return extractedFromMetadata;
  }

  const plainDocuments = stripAcademicAchievementMetadataDocuments(documents);
  const hasLegacyData = Boolean(
    academicAchievementRecord.achievementTitle ||
      academicAchievementRecord.awardedBy ||
      academicAchievementRecord.yearReceived ||
      academicAchievementRecord.categoryType ||
      academicAchievementRecord.description ||
      plainDocuments.length > 0
  );

  if (!hasLegacyData) return [];

  return [
    {
      id:
        typeof academicAchievementRecord.id === 'string' && academicAchievementRecord.id.trim()
          ? academicAchievementRecord.id
          : randomUUID(),
      achievementTitle: academicAchievementRecord.achievementTitle || '',
      awardedBy: academicAchievementRecord.awardedBy || '',
      yearReceived: academicAchievementRecord.yearReceived || '',
      categoryType: academicAchievementRecord.categoryType || '',
      description: academicAchievementRecord.description || '',
      documents: plainDocuments,
    },
  ];
}

function stripCompetitiveExamMetadataDocuments(documents = []) {
  return documents.filter(
    (doc) =>
      typeof doc === 'string' &&
      doc.trim() &&
      !doc.startsWith(COMPETITIVE_EXAM_ENTRIES_PREFIX)
  );
}

function decodeCompetitiveExamEntriesFromDocuments(documents = []) {
  const encodedEntry = documents.find(
    (doc) =>
      typeof doc === 'string' && doc.startsWith(COMPETITIVE_EXAM_ENTRIES_PREFIX)
  );
  if (!encodedEntry) return [];

  try {
    const encodedPayload = encodedEntry.slice(COMPETITIVE_EXAM_ENTRIES_PREFIX.length);
    const parsed = JSON.parse(Buffer.from(encodedPayload, 'base64').toString('utf8'));
    if (!Array.isArray(parsed)) return [];
    return parsed.map((entry) =>
      buildCompetitiveExamEntryFromPayload(entry, randomUUID())
    );
  } catch (_error) {
    return [];
  }
}

function buildCompetitiveExamEntryFromPayload(data = {}, fallbackId = randomUUID()) {
  const normalizedDocuments = Array.isArray(data.documents)
    ? data.documents
        .map((doc) => (typeof doc === 'string' ? doc : doc?.url || doc?.name))
        .filter(
          (doc) =>
            typeof doc === 'string' &&
            doc.trim() &&
            !doc.startsWith(COMPETITIVE_EXAM_ENTRIES_PREFIX)
        )
    : [];

  return {
    id: typeof data.id === 'string' && data.id.trim() ? data.id.trim() : fallbackId,
    examName: typeof data.examName === 'string' ? data.examName : '',
    yearTaken: typeof data.yearTaken === 'string' ? data.yearTaken : '',
    resultStatus: typeof data.resultStatus === 'string' ? data.resultStatus : '',
    scoreMarks: typeof data.scoreMarks === 'string' ? data.scoreMarks : '',
    scoreType: typeof data.scoreType === 'string' ? data.scoreType : '',
    validUntil: typeof data.validUntil === 'string' ? data.validUntil : '',
    additionalNotes: typeof data.additionalNotes === 'string' ? data.additionalNotes : '',
    documents: normalizedDocuments,
  };
}

function extractCompetitiveExamEntries(competitiveExamRecord) {
  if (!competitiveExamRecord) return [];

  const documents = Array.isArray(competitiveExamRecord.documents)
    ? competitiveExamRecord.documents
    : [];
  const extractedFromMetadata = decodeCompetitiveExamEntriesFromDocuments(documents);
  if (extractedFromMetadata.length > 0) {
    return extractedFromMetadata;
  }

  const plainDocuments = stripCompetitiveExamMetadataDocuments(documents);
  const hasLegacyData = Boolean(
    competitiveExamRecord.examName ||
      competitiveExamRecord.yearTaken ||
      competitiveExamRecord.resultStatus ||
      competitiveExamRecord.scoreMarks ||
      competitiveExamRecord.scoreType ||
      competitiveExamRecord.validUntil ||
      competitiveExamRecord.additionalNotes ||
      plainDocuments.length > 0
  );

  if (!hasLegacyData) return [];

  return [
    {
      id:
        typeof competitiveExamRecord.id === 'string' && competitiveExamRecord.id.trim()
          ? competitiveExamRecord.id
          : randomUUID(),
      examName: competitiveExamRecord.examName || '',
      yearTaken: competitiveExamRecord.yearTaken || '',
      resultStatus: competitiveExamRecord.resultStatus || '',
      scoreMarks: competitiveExamRecord.scoreMarks || '',
      scoreType: competitiveExamRecord.scoreType || '',
      validUntil: competitiveExamRecord.validUntil || '',
      additionalNotes: competitiveExamRecord.additionalNotes || '',
      documents: plainDocuments,
    },
  ];
}

function mapEducationForSnapshot(edu) {
  return {
    id: edu.id,
    educationLevel: edu.educationLevel || '',
    degreeProgram: edu.degree || '',
    institutionName: edu.institution || '',
    institutionLocation: edu.institutionLocation || '',
    fieldOfStudy: edu.specialization || '',
    startYear: edu.startYear?.toString() || '',
    startMonth: edu.startMonth?.toString() || '',
    endYear: edu.endYear?.toString() || '',
    endMonth: edu.endMonth?.toString() || '',
    currentlyStudying: edu.isOngoing || false,
    grade: edu.grade || '',
    modeOfStudy: edu.modeOfStudy || '',
    courseDuration: edu.courseDuration || '',
    documents: Array.isArray(edu.documents) ? edu.documents : [],
  };
}

function stripProjectMetadataDocuments(documents = []) {
  return documents.filter(
    (doc) =>
      typeof doc === 'string' &&
      doc.trim() &&
      !doc.startsWith(PROJECT_ENTRIES_PREFIX)
  );
}

function decodeProjectEntriesFromDocuments(documents = []) {
  const encodedEntry = documents.find(
    (doc) => typeof doc === 'string' && doc.startsWith(PROJECT_ENTRIES_PREFIX)
  );
  if (!encodedEntry) return [];

  try {
    const encodedPayload = encodedEntry.slice(PROJECT_ENTRIES_PREFIX.length);
    const parsed = JSON.parse(Buffer.from(encodedPayload, 'base64').toString('utf8'));
    if (!Array.isArray(parsed)) return [];
    return parsed.map((entry) => buildProjectEntryFromPayload(entry, randomUUID()));
  } catch (_error) {
    return [];
  }
}

function normalizeProjectDateValue(value) {
  if (!value) return '';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '';
    return trimmed.includes('T') ? trimmed.split('T')[0] : trimmed;
  }
  try {
    return new Date(value).toISOString().split('T')[0];
  } catch (_error) {
    return '';
  }
}

function buildProjectEntryFromPayload(data = {}, fallbackId = randomUUID()) {
  const normalizedDocuments = Array.isArray(data.documents)
    ? data.documents
        .map((doc) => (typeof doc === 'string' ? doc : doc?.url || doc?.name))
        .filter(
          (doc) =>
            typeof doc === 'string' &&
            doc.trim() &&
            !doc.startsWith(PROJECT_ENTRIES_PREFIX)
        )
    : [];

  return {
    id: typeof data.id === 'string' && data.id.trim() ? data.id.trim() : fallbackId,
    projectTitle: typeof data.projectTitle === 'string' ? data.projectTitle : '',
    projectType: typeof data.projectType === 'string' ? data.projectType : '',
    organizationClient: typeof data.organizationClient === 'string' ? data.organizationClient : '',
    currentlyWorking: Boolean(data.currentlyWorking),
    startDate: normalizeProjectDateValue(data.startDate),
    endDate: normalizeProjectDateValue(data.endDate),
    projectDescription: typeof data.projectDescription === 'string' ? data.projectDescription : '',
    responsibilities: typeof data.responsibilities === 'string' ? data.responsibilities : '',
    technologies: Array.isArray(data.technologies) ? data.technologies : [],
    projectOutcome: typeof data.projectOutcome === 'string' ? data.projectOutcome : '',
    projectLink: typeof data.projectLink === 'string' ? data.projectLink : '',
    documents: normalizedDocuments,
  };
}

function extractProjectEntries(projectRecord) {
  if (!projectRecord) return [];

  const documents = Array.isArray(projectRecord.documents) ? projectRecord.documents : [];
  const extractedFromMetadata = decodeProjectEntriesFromDocuments(documents);
  if (extractedFromMetadata.length > 0) {
    return extractedFromMetadata;
  }

  const plainDocuments = stripProjectMetadataDocuments(documents);
  const hasLegacyData = Boolean(
    projectRecord.projectTitle ||
      projectRecord.projectType ||
      projectRecord.organizationClient ||
      projectRecord.currentlyWorking ||
      projectRecord.startDate ||
      projectRecord.endDate ||
      projectRecord.projectDescription ||
      projectRecord.responsibilities ||
      (Array.isArray(projectRecord.technologies) && projectRecord.technologies.length > 0) ||
      projectRecord.projectOutcome ||
      projectRecord.projectLink ||
      plainDocuments.length > 0
  );

  if (!hasLegacyData) return [];

  return [
    {
      id:
        typeof projectRecord.id === 'string' && projectRecord.id.trim()
          ? projectRecord.id
          : randomUUID(),
      projectTitle: projectRecord.projectTitle || '',
      projectType: projectRecord.projectType || '',
      organizationClient: projectRecord.organizationClient || '',
      currentlyWorking: Boolean(projectRecord.currentlyWorking),
      startDate: normalizeProjectDateValue(projectRecord.startDate),
      endDate: normalizeProjectDateValue(projectRecord.endDate),
      projectDescription: projectRecord.projectDescription || '',
      responsibilities: projectRecord.responsibilities || '',
      technologies: Array.isArray(projectRecord.technologies) ? projectRecord.technologies : [],
      projectOutcome: projectRecord.projectOutcome || '',
      projectLink: projectRecord.projectLink || '',
      documents: plainDocuments,
    },
  ];
}

module.exports = {
  extractAcademicAchievementEntries,
  extractCompetitiveExamEntries,
  extractProjectEntries,
  mapEducationForSnapshot,
};
