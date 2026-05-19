/** Map UI / legacy values → Prisma EmploymentType enum */
function mapEmploymentTypeToDb(value) {
  if (value == null || String(value).trim() === '') return null;

  const normalized = String(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/_/g, '-');

  const map = {
    'full-time': 'FULL_TIME',
    fulltime: 'FULL_TIME',
    'part-time': 'PART_TIME',
    parttime: 'PART_TIME',
    contract: 'CONTRACT',
    internship: 'INTERNSHIP',
    freelance: 'FREELANCE',
    full_time: 'FULL_TIME',
    part_time: 'PART_TIME',
  };

  if (map[normalized]) return map[normalized];

  const upper = String(value).trim().toUpperCase().replace(/\s+/g, '_').replace(/-/g, '_');
  const upperMap = {
    FULL_TIME: 'FULL_TIME',
    PART_TIME: 'PART_TIME',
    CONTRACT: 'CONTRACT',
    INTERNSHIP: 'INTERNSHIP',
    FREELANCE: 'FREELANCE',
  };

  return upperMap[upper] || null;
}

/** Map Prisma EmploymentType → UI select value */
function mapEmploymentTypeFromDb(value) {
  if (value == null || String(value).trim() === '') return '';

  const upper = String(value).trim().toUpperCase().replace(/\s+/g, '_').replace(/-/g, '_');
  const fromDb = {
    FULL_TIME: 'full-time',
    PART_TIME: 'part-time',
    CONTRACT: 'contract',
    INTERNSHIP: 'internship',
    FREELANCE: 'freelance',
  };

  if (fromDb[upper]) return fromDb[upper];

  return String(value).trim().toLowerCase().replace(/_/g, '-');
}

/** Map UI / legacy values → Prisma WorkMode enum */
function mapWorkModeToDb(value) {
  if (value == null || String(value).trim() === '') return null;

  const normalized = String(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/_/g, '-');

  const map = {
    remote: 'REMOTE',
    hybrid: 'HYBRID',
    onsite: 'ON_SITE',
    'on-site': 'ON_SITE',
    'on site': 'ON_SITE',
    on_site: 'ON_SITE',
  };

  if (map[normalized]) return map[normalized];

  const upper = String(value).trim().toUpperCase().replace(/\s+/g, '_').replace(/-/g, '_');
  const upperMap = {
    REMOTE: 'REMOTE',
    HYBRID: 'HYBRID',
    ON_SITE: 'ON_SITE',
    ONSITE: 'ON_SITE',
  };

  return upperMap[upper] || null;
}

/** Map Prisma WorkMode → UI select value */
function mapWorkModeFromDb(value) {
  if (value == null || String(value).trim() === '') return '';

  const upper = String(value).trim().toUpperCase().replace(/\s+/g, '_').replace(/-/g, '_');
  const fromDb = {
    REMOTE: 'remote',
    HYBRID: 'hybrid',
    ON_SITE: 'onsite',
    ONSITE: 'onsite',
  };

  if (fromDb[upper]) return fromDb[upper];

  const lower = String(value).trim().toLowerCase();
  if (lower === 'on-site' || lower === 'on site') return 'onsite';
  return lower.replace(/_/g, '-');
}

function mapWorkExperienceForClient(exp) {
  return {
    id: exp.id,
    jobTitle: exp.jobTitle || '',
    companyName: exp.company || '',
    employmentType: mapEmploymentTypeFromDb(exp.employmentType),
    industryDomain: exp.industry || '',
    numberOfReportees: exp.numberOfReportees || '',
    startDate: exp.startDate ? new Date(exp.startDate).toISOString().split('T')[0] : '',
    endDate: exp.endDate ? new Date(exp.endDate).toISOString().split('T')[0] : '',
    currentlyWorkHere: exp.isCurrentJob || false,
    workLocation: exp.workLocation || '',
    workMode: mapWorkModeFromDb(exp.workMode),
    companyProfile: exp.companyProfile || '',
    companyTurnover: exp.companyTurnover || '',
    keyResponsibilities: exp.responsibilities || '',
    achievements: exp.achievements || '',
    workSkills: exp.workSkills || [],
    documents: exp.documents || [],
  };
}

module.exports = {
  mapEmploymentTypeToDb,
  mapEmploymentTypeFromDb,
  mapWorkModeToDb,
  mapWorkModeFromDb,
  mapWorkExperienceForClient,
};
