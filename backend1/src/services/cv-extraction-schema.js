/**
 * Full profile extraction schema for Phase 1 CV upload (OpenAI structuring).
 * Maps to Prisma models in backend1/prisma/schema.prisma.
 */

const { normalizePersonalInformation } = require('../utils/person-name.util');

const FULL_CV_EXTRACTION_JSON_TEMPLATE = `{
  "personalInformation": {
    "firstName": "",
    "middleName": "",
    "lastName": "",
    "fullName": "",
    "email": "",
    "phoneNumber": "",
    "alternatePhoneNumber": "",
    "countryCode": "",
    "gender": "",
    "dateOfBirth": "YYYY-MM-DD",
    "maritalStatus": "",
    "address": "",
    "city": "",
    "country": "",
    "nationality": "",
    "passportNumber": "",
    "linkedinProfile": "",
    "employmentStatus": ""
  },
  "summary": "",
  "education": [
    {
      "educationLevel": "",
      "degree": "",
      "institution": "",
      "location": "",
      "specialization": "",
      "startYear": 0,
      "startMonth": 0,
      "endYear": 0,
      "endMonth": 0,
      "isOngoing": false,
      "grade": "",
      "modeOfStudy": "",
      "courseDuration": "",
      "description": ""
    }
  ],
  "workExperience": [
    {
      "jobTitle": "",
      "company": "",
      "employmentType": "",
      "industry": "",
      "numberOfReportees": "",
      "startDate": "YYYY-MM-DD",
      "endDate": "YYYY-MM-DD",
      "currentlyWorking": false,
      "workLocation": "",
      "workMode": "",
      "companyProfile": "",
      "companyTurnover": "",
      "responsibilities": "",
      "achievements": "",
      "workSkills": []
    }
  ],
  "internships": [
    {
      "internshipTitle": "",
      "companyName": "",
      "internshipType": "",
      "domainDepartment": "",
      "startDate": "YYYY-MM-DD",
      "endDate": "YYYY-MM-DD",
      "currentlyWorking": false,
      "location": "",
      "workMode": "",
      "responsibilities": "",
      "learnings": "",
      "skills": []
    }
  ],
  "skills": [
    {
      "name": "",
      "proficiency": "BEGINNER|INTERMEDIATE|ADVANCED|NATIVE",
      "category": "Hard Skills|Soft Skills|Tools / Technologies"
    }
  ],
  "languages": [
    {
      "name": "",
      "proficiency": "BEGINNER|INTERMEDIATE|ADVANCED|NATIVE",
      "speak": true,
      "read": true,
      "write": true
    }
  ],
  "projects": [
    {
      "projectTitle": "",
      "projectType": "",
      "organizationClient": "",
      "currentlyWorking": false,
      "startDate": "YYYY-MM-DD",
      "endDate": "YYYY-MM-DD",
      "projectDescription": "",
      "responsibilities": "",
      "technologies": [],
      "projectOutcome": "",
      "projectLink": ""
    }
  ],
  "certifications": [
    {
      "certificationName": "",
      "issuingOrganization": "",
      "issueDate": "YYYY-MM-DD",
      "expiryDate": "YYYY-MM-DD",
      "doesNotExpire": false,
      "credentialId": "",
      "credentialUrl": "",
      "description": ""
    }
  ],
  "accomplishments": [
    {
      "title": "",
      "category": "",
      "organization": "",
      "achievementDate": "YYYY-MM-DD",
      "description": ""
    }
  ],
  "academicAchievements": [
    {
      "achievementTitle": "",
      "awardedBy": "",
      "yearReceived": "",
      "categoryType": "",
      "description": ""
    }
  ],
  "competitiveExams": [
    {
      "examName": "",
      "yearTaken": "",
      "resultStatus": "",
      "scoreMarks": "",
      "scoreType": "",
      "validUntil": "YYYY-MM-DD",
      "additionalNotes": ""
    }
  ],
  "gapExplanation": {
    "gapCategory": "",
    "reasonForGap": "",
    "gapDuration": "",
    "selectedSkills": [],
    "coursesText": "",
    "preferredSupport": {
      "flexibleRole": false,
      "hybridRemote": false,
      "midLevelReEntry": false,
      "skillRefresher": false
    }
  },
  "careerPreferences": {
    "currentCurrency": "",
    "currentSalaryType": "",
    "currentSalary": null,
    "currentLocation": "",
    "currentBenefits": [],
    "preferredRoles": [],
    "preferredIndustry": "",
    "functionalArea": "",
    "jobTypes": [],
    "preferredWorkMode": "",
    "preferredLocations": [],
    "relocationPreference": "",
    "preferredCurrency": "",
    "preferredSalaryType": "",
    "preferredSalary": null,
    "preferredBenefits": [],
    "availabilityToStart": "",
    "noticePeriod": "",
    "openToRelocation": false
  },
  "portfolioLinks": [
    {
      "linkType": "",
      "url": "",
      "title": "",
      "description": ""
    }
  ]
}`;

const KNOWN_LANGUAGE_NAMES = new Set([
  'english', 'hindi', 'marathi', 'spanish', 'french', 'german', 'chinese', 'mandarin',
  'japanese', 'arabic', 'portuguese', 'russian', 'bengali', 'tamil', 'telugu', 'gujarati',
  'punjabi', 'urdu', 'kannada', 'malayalam', 'italian', 'dutch', 'korean', 'turkish',
]);

function buildCvExtractionPrompt(cleanResumeText) {
  return `You are a resume structuring AI for a candidate profile platform.

You will receive RAW RESUME TEXT.
Do NOT summarize or invent information not present in the resume.
Extract every section you can find: personal details, summary, education, work experience, internships, skills, languages, projects, certifications, accomplishments, academic achievements, competitive exams, career gaps, and career preferences.

Return ONLY valid JSON matching this exact structure (use null for missing scalar fields, [] for missing lists):

${FULL_CV_EXTRACTION_JSON_TEMPLATE}

Extraction rules:
1. Extract the COMPLETE candidate name from the resume header — never return only an initial (e.g. "V.") without the rest of the name. Split into firstName, middleName, lastName AND fullName (e.g. V. / Bindu / Vijayan → fullName "V. Bindu Vijayan"). For Indian names with a leading initial, keep the initial in firstName and put given + family names in middleName/lastName.
2. Parse phone as digits only in phoneNumber; put country code in countryCode when visible (default +91 for Indian numbers).
3. Convert all dates to YYYY-MM-DD when a full date is known; use YYYY-MM-01 when only month+year; use YYYY-01-01 when only year for start/end dates.
4. Education: map 10th/12th/BE/B.Tech/MBA etc. to degree; infer educationLevel (High School, Diploma, Bachelor's, Master's, etc.).
5. For fresher candidates with no real jobs, use workExperience: [] and set employmentStatus to Student or Unemployed — do NOT add placeholder rows like "Fresher at N/A".
6. Languages (English, Hindi, Marathi, etc.) go in languages[], NOT skills[]. Technical/professional skills go in skills[] with category.
7. Marathi, Hindi, English listed under skills/languages on resume → languages array with speak/read/write inferred from resume context.
8. Infer city and country from address when possible (e.g. Kamothe → city, India → country).
9. Extract projects, certifications, internships, and achievements whenever mentioned.
10. If current/expected salary or benefits appear, fill careerPreferences.
11. portfolioLinks: only real URLs (GitHub, LinkedIn, portfolio) — never email domains like gmail.com.
12. Return ONLY JSON, no markdown.

Resume Text:
${cleanResumeText}`;
}

function isKnownLanguage(name) {
  if (!name) return false;
  const key = String(name).trim().toLowerCase();
  if (KNOWN_LANGUAGE_NAMES.has(key)) return true;
  return KNOWN_LANGUAGE_NAMES.has(key.split(/\s+/)[0]);
}

/** Migrate legacy parser output (skills with languageName) to new shape. */
function migrateLegacyExtraction(data) {
  if (!data || typeof data !== 'object') return data;
  const out = { ...data };

  if (!Array.isArray(out.languages)) out.languages = [];
  if (!Array.isArray(out.skills)) out.skills = [];

  if (Array.isArray(data.skills) && data.skills.length > 0 && data.skills[0]?.languageName) {
    for (const item of data.skills) {
      const name = item.languageName || item.name;
      if (!name) continue;
      if (isKnownLanguage(name)) {
        out.languages.push({
          name,
          proficiency: item.proficiency || 'INTERMEDIATE',
          speak: item.speak !== false,
          read: item.read !== false,
          write: item.write !== false,
        });
      } else {
        out.skills.push({
          name,
          proficiency: item.proficiency || 'INTERMEDIATE',
          category: item.category || 'Hard Skills',
        });
      }
    }
  }

  const pi = out.personalInformation || {};
  const normalizedNames = normalizePersonalInformation(pi);
  out.personalInformation = {
    ...pi,
    ...normalizedNames,
  };

  return out;
}

function emptyExtraction() {
  return {
    personalInformation: {
      firstName: null,
      middleName: null,
      lastName: null,
      fullName: null,
      email: null,
      phoneNumber: null,
      alternatePhoneNumber: null,
      countryCode: null,
      gender: null,
      dateOfBirth: null,
      maritalStatus: null,
      address: null,
      city: null,
      country: null,
      nationality: null,
      passportNumber: null,
      linkedinProfile: null,
      employmentStatus: null,
    },
    summary: null,
    education: [],
    workExperience: [],
    internships: [],
    skills: [],
    languages: [],
    projects: [],
    certifications: [],
    accomplishments: [],
    academicAchievements: [],
    competitiveExams: [],
    gapExplanation: null,
    careerPreferences: null,
    portfolioLinks: [],
  };
}

module.exports = {
  FULL_CV_EXTRACTION_JSON_TEMPLATE,
  buildCvExtractionPrompt,
  migrateLegacyExtraction,
  emptyExtraction,
  isKnownLanguage,
  KNOWN_LANGUAGE_NAMES,
};
