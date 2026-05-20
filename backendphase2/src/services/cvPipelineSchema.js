/**
 * Bulk CV pipeline — field catalog and mapping to candidate create payload.
 * Sections mirror ATS import: Personal, Education, Professional, Social, Summary.
 */

export const CV_PIPELINE_SECTIONS = {
  personal: [
    'Name',
    'E-mail',
    'Mobile No',
    'Age',
    'Candidate Score',
    'City & State',
    'Current Address',
    'Zip',
    'Candidate Image',
    'Nationality',
    'Current Company Website',
    'Marital Status',
    'Birth Date',
    'Passport Number',
  ],
  education: ['Qualification', 'Institute Name', 'Education entries', 'Courses'],
  professional: [
    'Remarks',
    'Experience',
    'Current Employer',
    'Current Designation',
    'Current/Expected Salary & Currency',
    'Benefits',
    'Notice Period (days)',
    'Resume',
    'Courses',
    'Extracurricular',
    'Volunteers',
  ],
  social: ['LinkedIn', 'Twitter', 'Xing', 'Skype', 'Facebook', 'Stack Overflow', 'Website'],
  summary: [
    'Summary',
    'Work History',
    'Certificates',
    'Honours & Awards',
    'Languages & Proficiency',
    'Skills',
  ],
};

/** JSON schema fragment for the LLM prompt. */
export function buildCvExtractionJsonSchemaBlock() {
  return `{
  "firstName": string|null,
  "lastName": string|null,
  "email": string|null,
  "phone": string|null,
  "age": number|null,
  "candidateScore": integer 0-100|null,
  "city": string|null,
  "state": string|null,
  "currentAddress": string|null,
  "zip": string|null,
  "nationality": string|null,
  "currentCompanyWebsite": string|null,
  "maritalStatus": string|null,
  "birthDate": string|null,
  "passportNumber": string|null,
  "currentCompany": string|null,
  "currentEmployer": string|null,
  "designation": string|null,
  "currentDesignation": string|null,
  "location": string|null,
  "country": string|null,
  "remarks": string|null,
  "experience": number|null,
  "totalExperience": number|null,
  "currentSalary": number|null,
  "currentSalaryCurrency": string|null,
  "currentBenefits": string|null,
  "expectedSalary": number|null,
  "expectedSalaryCurrency": string|null,
  "expectedBenefits": string|null,
  "noticePeriod": string|null,
  "noticePeriodInDays": number|null,
  "linkedinUrl": string|null,
  "twitterUrl": string|null,
  "xingUrl": string|null,
  "skypeId": string|null,
  "facebookUrl": string|null,
  "stackOverflowUrl": string|null,
  "githubUrl": string|null,
  "website": string|null,
  "portfolioUrl": string|null,
  "portfolioLinks": [{"type": string, "url": string, "label": string|null}],
  "summary": string|null,
  "workHistory": string|null,
  "skills": string[],
  "languages": string[],
  "languageProficiency": [{"language": string, "proficiency": string|null}],
  "certifications": string[],
  "honoursAndAwards": string[],
  "courses": string[],
  "extracurricularActivities": string[],
  "volunteers": string[],
  "educationEntries": [{
    "qualification": string|null,
    "instituteName": string|null,
    "degree": string|null,
    "institution": string|null,
    "startYear": string|null,
    "endYear": string|null,
    "grade": string|null
  }],
  "workExperienceEntries": [{
    "title": string,
    "company": string,
    "location": string|null,
    "startDate": string|null,
    "endDate": string|null,
    "durationText": string|null,
    "responsibilities": string[]
  }],
  "score": {
    "overall": integer 0-100,
    "skills": integer 0-100,
    "experience": integer 0-100,
    "education": integer 0-100,
    "completeness": integer 0-100
  },
  "rawEmailsFound": string[],
  "rawPhonesFound": string[],
  "extraFields": object,
  "source": "LinkedIn"|"Naukri"|"Indeed"|"Referral"|"Company Career Page"|"Agency"|"Other"|null,
  "priority": "High"|"Medium"|"Low"|null
}`;
}

export function buildCvExtractionPromptInstructions() {
  return `
FIELD CATALOG — extract into the JSON keys below (use null when absent; never invent).

CRITICAL for short or narrative-only resumes:
- If employers are mentioned in prose (e.g. "Worked at Kalki Digital, Ellitecodo, Pravidon"), you MUST populate workExperienceEntries (one entry per company) AND currentEmployer/currentCompany (most recent).
- If years of experience are stated (e.g. "6 years experience"), set totalExperience and experience to that number.
- Put the full professional narrative in both summary and workHistory when there is no formal job section.
- Extract every skill mentioned into skills[].

Personal Information:
  Name → firstName, lastName | E-mail → email | Mobile → phone
  Age → age | Candidate Score → candidateScore (0-100) or use score.overall
  City & State → city, state | Current Address → currentAddress | Zip → zip
  Nationality → nationality | Current Company Website → currentCompanyWebsite
  Marital Status → maritalStatus | Birth Date → birthDate | Passport → passportNumber

Education:
  Each school/college → educationEntries[] with qualification (or degree), instituteName (or institution), startYear, endYear, grade
  Short courses → courses[]

Professional Information:
  Remarks → remarks | Experience years → totalExperience or experience
  Current Employer → currentEmployer or currentCompany | Designation → currentDesignation or designation
  Current Salary → currentSalary | Currency → currentSalaryCurrency
  Current Benefits → currentBenefits | Expected Salary → expectedSalary | expectedSalaryCurrency, expectedBenefits
  Notice Period → noticePeriod (text) and noticePeriodInDays (number if stated)
  Extracurricular → extracurricularActivities[] | Volunteers → volunteers[]

Social Network:
  LinkedIn → linkedinUrl | Twitter → twitterUrl | Xing → xingUrl | Skype → skypeId
  Facebook → facebookUrl | Stack Overflow → stackOverflowUrl | Website → website or portfolioUrl

Summary & Additional:
  Summary → summary | Work History narrative → workHistory
  Certificates → certifications[] | Honours & Awards → honoursAndAwards[]
  Languages → languages[] and languageProficiency[{language, proficiency}]
  Skills → skills[]

workExperienceEntries: same as before — title, company, location, dates, responsibilities.
portfolioLinks: all URLs with type/label. extraFields: only non-empty keys for misc CV sections.
`;
}

function str(v) {
  return v === undefined || v === null ? '' : String(v).trim();
}

function arr(v) {
  return Array.isArray(v) ? v.filter((x) => x != null && String(x).trim()) : [];
}

function normalizeEducationEntries(entries) {
  if (!Array.isArray(entries)) return [];
  return entries.map((e) => {
    if (!e || typeof e !== 'object') return e;
    const qualification = str(e.qualification || e.degree);
    const instituteName = str(e.instituteName || e.institution);
    return {
      ...e,
      qualification: qualification || null,
      instituteName: instituteName || null,
      degree: qualification || str(e.degree) || null,
      institution: instituteName || str(e.institution) || null,
    };
  });
}

/**
 * Build structured extraData.pipeline + merge legacy extraFields.
 */
export function buildPipelineExtraData(base = {}, legacyExtra = {}) {
  const social = {
    linkedIn: str(base.linkedinUrl) || null,
    twitter: str(base.twitterUrl) || null,
    xing: str(base.xingUrl) || null,
    skypeId: str(base.skypeId) || null,
    facebook: str(base.facebookUrl) || null,
    stackOverflow: str(base.stackOverflowUrl) || null,
    github: str(base.githubUrl) || null,
    website: str(base.website || base.portfolioUrl) || null,
  };

  const personal = {
    age: base.age != null ? Number(base.age) : null,
    candidateScore: base.candidateScore != null ? Number(base.candidateScore) : null,
    state: str(base.state) || null,
    currentAddress: str(base.currentAddress) || null,
    zip: str(base.zip) || null,
    nationality: str(base.nationality) || null,
    currentCompanyWebsite: str(base.currentCompanyWebsite) || null,
    maritalStatus: str(base.maritalStatus) || null,
    birthDate: str(base.birthDate) || null,
    passportNumber: str(base.passportNumber) || null,
  };

  const professional = {
    remarks: str(base.remarks) || null,
    currentBenefits: str(base.currentBenefits) || null,
    expectedBenefits: str(base.expectedBenefits) || null,
    currentSalaryCurrency: str(base.currentSalaryCurrency) || null,
    expectedSalaryCurrency: str(base.expectedSalaryCurrency) || null,
    noticePeriodInDays:
      base.noticePeriodInDays != null && Number.isFinite(Number(base.noticePeriodInDays))
        ? Number(base.noticePeriodInDays)
        : null,
    courses: arr(base.courses),
    extracurricularActivities: arr(base.extracurricularActivities),
    volunteers: arr(base.volunteers),
  };

  const eduEntries = normalizeEducationEntries(base.educationEntries);
  const educationSummary =
    eduEntries.length > 0
      ? eduEntries
          .map((e) => {
            const q = e?.qualification || e?.degree || '';
            const i = e?.instituteName || e?.institution || '';
            return [q, i].filter(Boolean).join(' — ');
          })
          .filter(Boolean)
          .join(' | ')
      : null;

  const summarySections = {
    workHistory: str(base.workHistory) || null,
    educationSummary,
    honoursAndAwards: arr(base.honoursAndAwards),
    languageProficiency: Array.isArray(base.languageProficiency)
      ? base.languageProficiency.filter((row) => row && str(row.language))
      : [],
  };

  const pipeline = {
    personal: Object.fromEntries(Object.entries(personal).filter(([, v]) => v != null && v !== '')),
    education: {
      entries: eduEntries,
      courses: arr(base.courses),
      summaryText: educationSummary,
    },
    professional: Object.fromEntries(
      Object.entries(professional).filter(([, v]) => {
        if (Array.isArray(v)) return v.length > 0;
        return v != null && v !== '';
      })
    ),
    social: Object.fromEntries(Object.entries(social).filter(([, v]) => v)),
    summary: Object.fromEntries(
      Object.entries(summarySections).filter(([, v]) => {
        if (Array.isArray(v)) return v.length > 0;
        return v != null && v !== '';
      })
    ),
  };

  return {
    ...legacyExtra,
    pipeline,
    social,
    personal,
    professional: professional.remarks ? { remarks: professional.remarks } : {},
  };
}

function logLine(label, value, optional = true) {
  const empty =
    value === undefined ||
    value === null ||
    value === '' ||
    (Array.isArray(value) && value.length === 0);
  const opt = optional ? ' (optional)' : '';
  if (empty) {
    console.log(`  ${label}${opt}: — not in resume`);
    return;
  }
  if (Array.isArray(value)) {
    console.log(`  ${label}${opt}: ${value.length} item(s)`);
    value.slice(0, 8).forEach((item, i) => {
      const line =
        typeof item === 'object'
          ? JSON.stringify(item).slice(0, 200)
          : String(item).slice(0, 200);
      console.log(`      [${i + 1}] ${line}`);
    });
    if (value.length > 8) console.log(`      … +${value.length - 8} more`);
    return;
  }
  const text = String(value).replace(/\s+/g, ' ').trim();
  console.log(`  ${label}${opt}: ${text.slice(0, 300)}${text.length > 300 ? '…' : ''}`);
}

/**
 * Terminal log — every ATS field grouped by section (bulk CV pipeline).
 */
export function logPipelineSectionsExtraction(data = {}) {
  const name = [data.firstName, data.lastName].filter(Boolean).join(' ');
  const cityState = [data.city, data.state].filter(Boolean).join(', ');
  const scoreVal =
    data.candidateScore != null
      ? data.candidateScore
      : data.score?.overall != null
        ? data.score.overall
        : null;

  console.log('');
  console.log('──────────────────────────────────────────────────────────────────────────────');
  console.log('EXTRACTED DATA — Personal Information');
  console.log('──────────────────────────────────────────────────────────────────────────────');
  logLine('Name', name || null, false);
  logLine('E-mail', data.email);
  logLine('Mobile No', data.phone);
  logLine('Age', data.age);
  logLine('Candidate Score', scoreVal);
  logLine('City & State', cityState || data.location);
  logLine('Current Address', data.address || data.currentAddress);
  logLine('Zip', data.zip);
  logLine('Candidate Image', data.profilePhotoUrl);
  logLine('Nationality', data.nationality);
  logLine('Current Company Website', data.currentCompanyWebsite);
  logLine('Marital Status', data.maritalStatus);
  logLine('Birth Date', data.birthDate);
  logLine('Passport Number', data.passportNumber);

  console.log('');
  console.log('──────────────────────────────────────────────────────────────────────────────');
  console.log('EXTRACTED DATA — Education');
  console.log('──────────────────────────────────────────────────────────────────────────────');
  const eduRows = Array.isArray(data.educationEntries) ? data.educationEntries : [];
  if (eduRows.length) {
    eduRows.forEach((row, i) => {
      const qual = str(row?.qualification || row?.degree);
      const inst = str(row?.instituteName || row?.institution);
      console.log(`  Entry ${i + 1}:`);
      logLine('    Qualification', qual, false);
      logLine('    Institute Name', inst, false);
      if (row?.startYear || row?.endYear) {
        console.log(`    Dates: ${row.startYear || '?'} → ${row.endYear || '?'}`);
      }
      if (row?.grade) console.log(`    Grade: ${row.grade}`);
    });
  } else {
    logLine('Qualification', data.education ? data.education.split('—')[0]?.trim() : null);
    logLine('Institute Name', data.education?.includes('—') ? data.education.split('—')[1]?.trim() : null);
    if (!data.education) console.log('  (no education entries in resume)');
  }
  logLine('Education (summary text)', data.education);

  console.log('');
  console.log('──────────────────────────────────────────────────────────────────────────────');
  console.log('EXTRACTED DATA — Professional Information');
  console.log('──────────────────────────────────────────────────────────────────────────────');
  logLine('Remarks', data.remarks);
  logLine('Experience', data.experience != null ? `${data.experience} years` : null);
  logLine('Current Employer', data.currentCompany || data.currentEmployer);
  logLine('Current Designation', data.currentDesignation || data.designation);
  logLine('Current Salary', data.currentSalary);
  logLine('Current Salary Currency Type', data.currentSalaryCurrency || (data.currency && data.currentSalary ? data.currency : null));
  logLine('Current Benefits', data.currentBenefits);
  logLine('Expected Salary', data.expectedSalary);
  logLine('Expected Salary Currency Type', data.expectedSalaryCurrency);
  logLine('Expected Benefits', data.expectedBenefits);
  logLine(
    'Notice Period in days',
    data.noticePeriodInDays != null ? data.noticePeriodInDays : data.noticePeriod
  );
  logLine('Resume', data.resumeUrl || data.resumeFileName);
  logLine('Courses', data.courses);
  logLine('Extracurricular Activities', data.extracurricularActivities);
  logLine('Volunteers', data.volunteers);
  const work = Array.isArray(data.workExperienceEntries) ? data.workExperienceEntries : [];
  if (work.length) {
    console.log(`  Work Experience entries: ${work.length}`);
    work.forEach((job, i) => {
      console.log(
        `      [${i + 1}] ${[job.title, job.company].filter(Boolean).join(' @ ') || 'Role'}${job.location ? ` (${job.location})` : ''}`
      );
    });
  }

  console.log('');
  console.log('──────────────────────────────────────────────────────────────────────────────');
  console.log('EXTRACTED DATA — Social Network Information');
  console.log('──────────────────────────────────────────────────────────────────────────────');
  logLine('LinkedIn', data.linkedinUrl);
  logLine('Twitter', data.twitterUrl);
  logLine('Xing', data.xingUrl);
  logLine('Skype ID', data.skypeId);
  logLine('Facebook', data.facebookUrl);
  logLine('Stack Overflow', data.stackOverflowUrl);
  logLine('Website', data.website || data.portfolioUrl);
  if (Array.isArray(data.portfolioLinks) && data.portfolioLinks.length) {
    logLine('Other links', data.portfolioLinks);
  }

  console.log('');
  console.log('──────────────────────────────────────────────────────────────────────────────');
  console.log('EXTRACTED DATA — Summary & Additional');
  console.log('──────────────────────────────────────────────────────────────────────────────');
  logLine('Summary', data.summary, false);
  logLine('Work History', data.workHistory || (work.length ? work.map((j) => `${j.title || ''} at ${j.company}`).join('; ') : null));
  logLine('Education', data.education);
  logLine('Certificate', data.certifications);
  logLine('Honours & Awards', data.honoursAndAwards);
  const langProf = Array.isArray(data.languageProficiency) && data.languageProficiency.length
    ? data.languageProficiency.map((l) => `${l.language}${l.proficiency ? ` (${l.proficiency})` : ''}`)
    : data.languages;
  logLine('Language & Proficiency', langProf);
  logLine('Skills', data.skills, false);
  console.log('──────────────────────────────────────────────────────────────────────────────');
  console.log('');
}

/**
 * Fill gaps from narrative text when AI returns empty arrays (short CVs).
 */
export function enrichParsedFromNarrative(data = {}, cleanedText = '') {
  const out = { ...data };
  const blob = [cleanedText, out.summary, out.workHistory, out.experienceRaw].filter(Boolean).join('\n');

  if (out.experience == null && out.totalExperience == null) {
    const ym = blob.match(/(\d{1,2})\s*(?:\+?\s*)?years?\s+(?:of\s+)?experience/i);
    if (ym) {
      out.experience = Number(ym[1]);
      out.totalExperience = Number(ym[1]);
    }
  } else if (out.experience == null && out.totalExperience != null) {
    out.experience = out.totalExperience;
  } else if (out.experience != null && out.totalExperience == null) {
    out.totalExperience = out.experience;
  }

  if (!Array.isArray(out.workExperienceEntries) || !out.workExperienceEntries.length) {
    const workedAt = blob.match(/worked\s+at\s+([^.!\n]+)/i);
    if (workedAt) {
      const chunk = workedAt[1].replace(/\s+and\s+/gi, ',');
      const companies = chunk
        .split(',')
        .map((s) => s.trim().replace(/\.$/, ''))
        .filter((s) => s.length > 2);
      const deduped = [...new Set(companies)];
      if (deduped.length) {
        const title = str(out.designation || out.currentDesignation) || 'Professional';
        out.workExperienceEntries = deduped.map((company) => ({
          title,
          company,
          location: null,
          startDate: null,
          endDate: null,
          durationText: null,
          responsibilities: [],
        }));
        if (!str(out.currentCompany)) {
          out.currentCompany = deduped[0];
          out.currentEmployer = deduped[0];
        }
      }
    }
  }

  if (!str(out.workHistory) && str(out.summary)) {
    out.workHistory = out.summary;
  }

  if (out.candidateScore == null && out.score?.overall != null) {
    out.candidateScore = out.score.overall;
  }

  if (!str(out.currentDesignation) && str(out.designation)) {
    out.currentDesignation = out.designation;
  }

  return out;
}

/** Count populated pipeline fields for logs. */
export function countPipelineFieldCoverage(normalized = {}) {
  const checks = [
    ['Name', Boolean(normalized.firstName || normalized.lastName)],
    ['Email', Boolean(normalized.email)],
    ['Phone', Boolean(normalized.phone)],
    ['Age', normalized.extraData?.pipeline?.personal?.age != null],
    ['Address', Boolean(normalized.address || normalized.extraData?.pipeline?.personal?.currentAddress)],
    ['Education', (normalized.educationEntries?.length || 0) > 0],
    ['Experience', normalized.experience != null],
    ['Employer', Boolean(normalized.currentCompany)],
    ['LinkedIn', Boolean(normalized.linkedinUrl)],
    ['Summary', Boolean(normalized.summary)],
    ['Skills', (normalized.skills?.length || 0) > 0],
    ['Work history', (normalized.workExperienceEntries?.length || 0) > 0],
  ];
  const filled = checks.filter(([, ok]) => ok).map(([label]) => label);
  return { filled, total: checks.length, count: filled.length };
}

export function applyPipelineFieldsToNormalized(base, fallback = {}, extras = {}, cleanedText = '') {
  const merged = enrichParsedFromNarrative({ ...fallback, ...base }, cleanedText);
  const eduEntries = normalizeEducationEntries(
    Array.isArray(merged.educationEntries) ? merged.educationEntries : []
  );

  const noticePeriod =
    str(merged.noticePeriod) ||
    (merged.noticePeriodInDays != null ? `${merged.noticePeriodInDays} days` : '');

  const state = str(merged.state);
  const city = str(merged.city || fallback.city);
  const location =
    str(merged.location) ||
    [city, state, str(merged.country)].filter(Boolean).join(', ') ||
    '';

  const legacyExtra =
    merged.extraFields && typeof merged.extraFields === 'object' && !Array.isArray(merged.extraFields)
      ? merged.extraFields
      : {};

  const extraData = buildPipelineExtraData(
    { ...merged, educationEntries: eduEntries },
    legacyExtra
  );

  const primaryQualification = eduEntries[0]?.qualification || eduEntries[0]?.degree || '';
  const primaryInstitute = eduEntries[0]?.instituteName || eduEntries[0]?.institution || '';
  const educationSummary =
    eduEntries.length > 0
      ? eduEntries
          .map((e) => {
            const q = e?.qualification || e?.degree || '';
            const i = e?.instituteName || e?.institution || '';
            return [q, i].filter(Boolean).join(' — ');
          })
          .filter(Boolean)
          .join(' | ')
      : str(merged.education) && !/experience on-site|TECHNOLGIES/i.test(String(merged.education))
        ? str(merged.education)
        : '';

  return {
    ...merged,
    city,
    state,
    location,
    currentCompany: str(merged.currentCompany || merged.currentEmployer || fallback.currentCompany),
    currentDesignation: str(
      merged.currentDesignation || merged.designation || fallback.currentDesignation
    ),
    designation: str(merged.designation || merged.currentDesignation),
    noticePeriod,
    address: str(merged.currentAddress || merged.address),
    addressLine: str(merged.currentAddress || merged.addressLine),
    website: str(merged.website || merged.portfolioUrl),
    currency: str(merged.expectedSalaryCurrency || merged.currentSalaryCurrency || merged.currency),
    education: educationSummary,
    educationEntries: eduEntries,
    extraData,
    rating:
      merged.candidateScore != null && Number.isFinite(Number(merged.candidateScore))
        ? Math.round(Number(merged.candidateScore))
        : merged.rating,
    profilePhotoUrl: extras.profilePhotoUrl ?? merged.profilePhotoUrl,
    resumeUrl: extras.resumeUrl ?? merged.resumeUrl,
    resumeFileName: extras.resumeFileName ?? merged.resumeFileName,
  };
}
