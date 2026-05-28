/** Job creation pipeline — field schema, regex fallback, merge helpers (mirrors Add Job drawer). */

export const JOB_CREATION_PIPELINE_NAME = 'jobcreation pipeline';

export const JOB_CREATION_PIPELINE_SECTIONS = [
  'Job identity (title, openings, priority, company)',
  'Location (country, state, city, workplace type)',
  'Employment (type, industry, target hire date, nationality)',
  'Compensation (salary range, currency, benefits text)',
  'Experience & skills',
  'Description (HTML, summary, responsibilities, requirements)',
];

export const jobCreationJsonSchema = {
  name: 'job_creation_payload',
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      nationality: { type: 'string' },
      jobTitle: { type: 'string' },
      priority: { type: 'string' },
      companyName: { type: 'string' },
      numberOfOpenings: { type: 'string' },
      country: { type: 'string' },
      state: { type: 'string' },
      city: { type: 'string' },
      industryType: { type: 'string' },
      employmentType: { type: 'string' },
      targetHireDate: { type: 'string' },
      minExperience: { type: 'integer' },
      maxExperience: { type: 'integer' },
      payRangeMin: { type: 'string' },
      payRangeMax: { type: 'string' },
      salaryCurrency: { type: 'string' },
      salaryInput: { type: 'string' },
      jobLocation: { type: 'string' },
      jobLocationType: { type: 'string' },
      jobType: { type: 'string' },
      languages: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            language: { type: 'string' },
            proficiency: { type: 'string' },
          },
          required: ['language', 'proficiency'],
        },
      },
      skills: { type: 'array', items: { type: 'string' } },
      jobDescriptionHtml: { type: 'string' },
      jobSummary: { type: 'string' },
      keyResponsibilitiesText: { type: 'string' },
      qualificationsExperienceText: { type: 'string' },
      compensationBenefitsText: { type: 'string' },
      educationalQualification: { type: 'string' },
      educationalSpecialization: { type: 'string' },
    },
    required: [
      'nationality',
      'jobTitle',
      'priority',
      'companyName',
      'numberOfOpenings',
      'country',
      'state',
      'city',
      'industryType',
      'employmentType',
      'targetHireDate',
      'minExperience',
      'maxExperience',
      'payRangeMin',
      'payRangeMax',
      'salaryCurrency',
      'salaryInput',
      'jobLocation',
      'jobLocationType',
      'jobType',
      'languages',
      'skills',
      'jobDescriptionHtml',
      'jobSummary',
      'keyResponsibilitiesText',
      'qualificationsExperienceText',
      'compensationBenefitsText',
      'educationalQualification',
      'educationalSpecialization',
    ],
  },
  strict: true,
};

function extractLabeledValue(text, labels) {
  const sortedLabels = [...labels].sort((a, b) => b.length - a.length);
  const lines = String(text || '').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    for (const label of sortedLabels) {
      const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`^\\s*${escaped}\\s*[:\\-–—]\\s*(.+)$`, 'i');
      const match = trimmed.match(pattern);
      if (match?.[1]) return match[1].trim();
    }
  }
  return '';
}

/** Multi-line section after a label (e.g. Responsibilities: + bullet lines). */
function extractLabeledSectionBlock(text, labels) {
  const sortedLabels = [...labels].sort((a, b) => b.length - a.length);
  const lines = String(text || '').split(/\r?\n/);
  const isNewLabelLine = (line) => {
    const t = line.trim();
    if (!t) return false;
    if (/^[-•*]\s/.test(t)) return false;
    return /^[A-Za-z][A-Za-z0-9\s/&]{1,40}\s*[:\\-–—]\s*.+$/.test(t);
  };

  for (let i = 0; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;
    for (const label of sortedLabels) {
      const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`^\\s*${escaped}\\s*[:\\-–—]\\s*(.*)$`, 'i');
      const match = trimmed.match(pattern);
      if (!match) continue;
      const block = [];
      const inline = String(match[1] || '').trim();
      if (inline) block.push(inline);
      for (let j = i + 1; j < lines.length; j += 1) {
        const next = lines[j].trim();
        if (!next) continue;
        if (isNewLabelLine(next)) break;
        block.push(next.replace(/^[-•*]\s*/, '').trim());
      }
      return block.filter(Boolean).join('\n');
    }
  }
  return '';
}

function defaultTargetHireDateIso() {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

function parseSalaryFields(salaryInput) {
  const raw = String(salaryInput || '').trim();
  if (!raw) return { payRangeMin: '', payRangeMax: '', salaryCurrency: '', salaryInput: '' };
  const lpa = raw.match(/(\d+(?:\.\d+)?)\s*[-–—]\s*(\d+(?:\.\d+)?)\s*LPA/i);
  if (lpa) {
    return {
      payRangeMin: lpa[1],
      payRangeMax: lpa[2],
      salaryCurrency: 'INR',
      salaryInput: raw,
    };
  }
  const usd = raw.match(/\$\s*(\d[\d,]*)\s*[-–—]\s*\$?\s*(\d[\d,]*)/);
  if (usd) {
    return {
      payRangeMin: usd[1].replace(/,/g, ''),
      payRangeMax: usd[2].replace(/,/g, ''),
      salaryCurrency: 'USD',
      salaryInput: raw,
    };
  }
  return { payRangeMin: '', payRangeMax: '', salaryCurrency: '', salaryInput: raw };
}

export function buildJobDescriptionHtmlFromFields(fields) {
  const sections = [];
  if (fields.jobTitle) sections.push(`<h2>${fields.jobTitle}</h2>`);
  if (fields.companyName) sections.push(`<p><strong>Company:</strong> ${fields.companyName}</p>`);
  const loc = [fields.city, fields.state, fields.country].filter(Boolean).join(', ');
  if (loc || fields.jobLocation) {
    sections.push(
      `<p><strong>Location:</strong> ${loc || fields.jobLocation}${fields.jobLocationType ? ` (${fields.jobLocationType})` : ''}</p>`,
    );
  }
  if (fields.salaryInput) sections.push(`<p><strong>Compensation:</strong> ${fields.salaryInput}</p>`);
  if (fields.jobSummary) sections.push(`<h3>Overview</h3><p>${fields.jobSummary}</p>`);
  if (fields.keyResponsibilitiesText) {
    const items = fields.keyResponsibilitiesText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    sections.push(
      `<h3>Key Responsibilities</h3><ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`,
    );
  }
  if (fields.qualificationsExperienceText) {
    const items = fields.qualificationsExperienceText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    sections.push(
      `<h3>Requirements</h3><ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`,
    );
  }
  if (fields.compensationBenefitsText) {
    sections.push(`<h3>Benefits</h3><p>${fields.compensationBenefitsText.replace(/\n/g, '<br/>')}</p>`);
  }
  if (fields.skills?.length) {
    sections.push(
      `<h3>Skills</h3><ul>${fields.skills.map((s) => `<li>${s}</li>`).join('')}</ul>`,
    );
  }
  return sections.join('\n');
}

export function logJobRegexFieldExtraction(fallback) {
  const lines = [
    fallback.jobTitle ? `✅ Job Title: ${fallback.jobTitle}` : '❌ Job Title: not found',
    fallback.companyName ? `✅ Company: ${fallback.companyName}` : '❌ Company: not found',
    fallback.numberOfOpenings ? `✅ Openings: ${fallback.numberOfOpenings}` : '❌ Openings: not found',
    fallback.country ? `✅ Country: ${fallback.country}` : '❌ Country: not found',
    fallback.city ? `✅ City: ${fallback.city}` : '❌ City: not found',
    fallback.state ? `✅ State: ${fallback.state}` : '❌ State: not found',
    fallback.jobLocationType ? `✅ Workplace: ${fallback.jobLocationType}` : '❌ Workplace: not found',
    fallback.minExperience || fallback.maxExperience
      ? `✅ Experience: ${fallback.minExperience || 0}–${fallback.maxExperience || fallback.minExperience || 0} years`
      : '❌ Experience: not found',
    fallback.salaryInput ? `✅ Salary: ${fallback.salaryInput}` : '❌ Salary: not found',
    fallback.skills?.length
      ? `✅ Skills (${fallback.skills.length}): ${fallback.skills.slice(0, 8).join(', ')}`
      : '❌ Skills: none',
    fallback.keyResponsibilitiesText ? '✅ Responsibilities block captured' : '❌ Responsibilities: not captured',
    fallback.qualificationsExperienceText ? '✅ Requirements block captured' : '❌ Requirements: not captured',
    fallback.compensationBenefitsText ? '✅ Benefits block captured' : '❌ Benefits: not captured',
    fallback.targetHireDate ? `✅ Target hire date: ${fallback.targetHireDate}` : '⚪ Target hire date: will default (+30 days)',
    'fallbackData saved — will fill any AI nulls',
  ];
  return lines;
}

function parseExperienceRange(text) {
  if (!String(text || '').trim()) return {};
  const range = String(text).match(/(\d+)\s*(?:to|-|–)\s*(\d+)/i);
  if (range) return { min: Number(range[1]), max: Number(range[2]) };
  const years = String(text).match(/(\d+)\s*years?/i);
  if (years) return { min: Number(years[1]) };
  return {};
}

function parseLocationLine(location) {
  const workMode = /\bhybrid\b/i.test(location)
    ? 'Hybrid'
    : /\bremote\b/i.test(location)
      ? 'Remote'
      : /\bon-?site\b/i.test(location)
        ? 'On-site'
        : '';
  const withoutParens = location.replace(/\([^)]*\)/g, '').trim();
  const parts = withoutParens.split(',').map((p) => p.trim()).filter(Boolean);
  let city = '';
  let state = '';
  let country = '';
  if (parts.length >= 3) {
    city = parts[0];
    state = parts[1];
    country = parts[parts.length - 1];
  } else if (parts.length === 2) {
    city = parts[0];
    country = parts[1];
  } else if (parts.length === 1) {
    country = parts[0];
  }
  return { city, state, country, workMode, jobLocation: withoutParens || location.trim() };
}

export function extractJobRegexFallback(cleanedText) {
  const text = String(cleanedText || '');
  const jobTitle =
    extractLabeledValue(text, ['role', 'job title', 'position', 'title']) || '';
  const openingsRaw = extractLabeledValue(text, [
    'openings',
    'number of openings',
    'no of positions',
    'positions',
    'vacancies',
  ]);
  const openingsMatch = openingsRaw.match(/\d+/);
  const companyName = extractLabeledValue(text, ['company', 'client', 'employer']);
  const locationLine = extractLabeledValue(text, ['location', 'job location', 'work location']);
  const loc = locationLine ? parseLocationLine(locationLine) : { city: '', state: '', country: '', workMode: '', jobLocation: '' };
  let country = loc.country;
  if (!country && /\bIndia\b/i.test(text)) country = 'India';
  if (!country && /\bUnited States\b|\bUSA\b/i.test(text)) country = 'United States';
  const experienceLine = extractLabeledValue(text, ['experience', 'exp', 'years of experience']);
  const exp = parseExperienceRange(experienceLine);
  const skillsLine = extractLabeledValue(text, ['skills', 'skill set', 'tech stack', 'technologies']);
  const skills = skillsLine
    ? skillsLine
        .split(/[,;|]/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  const salaryInput = extractLabeledValue(text, ['salary', 'compensation', 'ctc', 'pay', 'package']);
  const targetHireDateRaw = extractLabeledValue(text, [
    'target hire date',
    'hire date',
    'expected closure',
    'closing date',
  ]);
  const isoDate = targetHireDateRaw.match(/\d{4}-\d{2}-\d{2}/)?.[0] || defaultTargetHireDateIso();
  const salaryFields = parseSalaryFields(salaryInput);
  const responsibilities = extractLabeledSectionBlock(text, [
    'responsibilities',
    'responsibility',
    'key responsibilities',
  ]);
  const requirements = extractLabeledSectionBlock(text, [
    'requirements',
    'requirement',
    'qualifications',
  ]);
  const benefits = extractLabeledSectionBlock(text, ['benefits', 'benefit']);
  const eduMatch = requirements.match(/\b(B\.?\s*E\.?|B\.?\s*Tech|M\.?\s*Tech|MBA|Bachelor|Master)[^.\n]*/i);
  const educationalQualification = eduMatch ? eduMatch[0].trim() : '';
  const jobSummaryParts = [
    jobTitle ? `${jobTitle}${companyName ? ` at ${companyName}` : ''}.` : '',
    loc.city && loc.country ? `Based in ${loc.city}, ${loc.country}.` : '',
    exp.min != null && exp.max != null ? `Experience: ${exp.min}–${exp.max} years.` : '',
  ].filter(Boolean);
  const employmentType = extractLabeledValue(text, ['employment type', 'job type', 'employment']);
  const industryType = extractLabeledValue(text, ['industry', 'industry type', 'sector']);
  const nationality = extractLabeledValue(text, ['nationality']);
  const priority = extractLabeledValue(text, ['priority']);
  const workMode =
    loc.workMode ||
    (/\bhybrid\b/i.test(text) ? 'Hybrid' : /\bremote\b/i.test(text) ? 'Remote' : /\bon-?site\b/i.test(text) ? 'On-site' : '');

  return {
    nationality: nationality || '',
    jobTitle,
    priority: priority || 'Medium',
    companyName,
    numberOfOpenings: openingsMatch?.[0] || openingsRaw || '1',
    country,
    state: loc.state,
    city: loc.city,
    industryType,
    employmentType,
    targetHireDate: isoDate,
    minExperience: Number.isFinite(exp.min) ? exp.min : 0,
    maxExperience: Number.isFinite(exp.max) ? exp.max : exp.min || 0,
    payRangeMin: salaryFields.payRangeMin,
    payRangeMax: salaryFields.payRangeMax,
    salaryCurrency: salaryFields.salaryCurrency,
    salaryInput: salaryFields.salaryInput || salaryInput,
    jobLocation: loc.jobLocation || locationLine,
    jobLocationType: workMode,
    jobType: employmentType || 'Full Time',
    languages: [],
    skills,
    jobDescriptionHtml: '',
    jobSummary: jobSummaryParts.join(' '),
    keyResponsibilitiesText: responsibilities,
    qualificationsExperienceText: requirements,
    compensationBenefitsText: benefits,
    educationalQualification,
    educationalSpecialization: '',
  };
}

export function enrichJobFieldsAfterMerge(merged) {
  const next = { ...merged };
  if (!next.jobDescriptionHtml?.trim()) {
    next.jobDescriptionHtml = buildJobDescriptionHtmlFromFields(next);
  }
  if (!next.jobSummary?.trim() && next.jobTitle) {
    next.jobSummary = `${next.jobTitle}${next.companyName ? ` at ${next.companyName}` : ''}.`;
  }
  if (!next.targetHireDate?.trim()) {
    next.targetHireDate = defaultTargetHireDateIso();
  }
  if (!next.numberOfOpenings?.trim()) next.numberOfOpenings = '1';
  if (!next.priority?.trim()) next.priority = 'Medium';
  if (!next.salaryInput?.trim() && (next.payRangeMin || next.payRangeMax)) {
    next.salaryInput = [next.payRangeMin, next.payRangeMax].filter(Boolean).join('–');
    if (next.salaryCurrency === 'INR') next.salaryInput += ' LPA';
  }
  return next;
}

export function mergeJobAiWithFallback(ai, fallback) {
  const pick = (aiVal, fbVal) => {
    if (aiVal == null) return fbVal;
    if (typeof aiVal === 'string' && !aiVal.trim()) return fbVal;
    if (Array.isArray(aiVal) && !aiVal.length) return fbVal;
    return aiVal;
  };
  return {
    nationality: pick(ai?.nationality, fallback.nationality),
    jobTitle: pick(ai?.jobTitle, fallback.jobTitle),
    priority: pick(ai?.priority, fallback.priority) || 'Medium',
    companyName: pick(ai?.companyName, fallback.companyName),
    numberOfOpenings: String(pick(ai?.numberOfOpenings, fallback.numberOfOpenings) || '1'),
    country: pick(ai?.country, fallback.country),
    state: pick(ai?.state, fallback.state),
    city: pick(ai?.city, fallback.city),
    industryType: pick(ai?.industryType, fallback.industryType),
    employmentType: pick(ai?.employmentType, fallback.employmentType),
    targetHireDate: pick(ai?.targetHireDate, fallback.targetHireDate),
    minExperience: Number.isFinite(Number(ai?.minExperience))
      ? Number(ai.minExperience)
      : fallback.minExperience,
    maxExperience: Number.isFinite(Number(ai?.maxExperience))
      ? Number(ai.maxExperience)
      : fallback.maxExperience,
    payRangeMin: pick(ai?.payRangeMin, fallback.payRangeMin),
    payRangeMax: pick(ai?.payRangeMax, fallback.payRangeMax),
    salaryCurrency: pick(ai?.salaryCurrency, fallback.salaryCurrency),
    salaryInput: pick(ai?.salaryInput, fallback.salaryInput),
    jobLocation: pick(ai?.jobLocation, fallback.jobLocation),
    jobLocationType: pick(ai?.jobLocationType, fallback.jobLocationType),
    jobType: pick(ai?.jobType, fallback.jobType) || 'Full Time',
    languages: Array.isArray(ai?.languages) && ai.languages.length ? ai.languages : fallback.languages,
    skills: Array.isArray(ai?.skills) && ai.skills.length ? ai.skills : fallback.skills,
    jobDescriptionHtml: pick(ai?.jobDescriptionHtml, fallback.jobDescriptionHtml),
    jobSummary: pick(ai?.jobSummary, fallback.jobSummary),
    keyResponsibilitiesText: pick(ai?.keyResponsibilitiesText, fallback.keyResponsibilitiesText),
    qualificationsExperienceText: pick(ai?.qualificationsExperienceText, fallback.qualificationsExperienceText),
    compensationBenefitsText: pick(ai?.compensationBenefitsText, fallback.compensationBenefitsText),
    educationalQualification: pick(ai?.educationalQualification, fallback.educationalQualification),
    educationalSpecialization: pick(ai?.educationalSpecialization, fallback.educationalSpecialization),
  };
}

function normalizeCompanyMatchKey(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\b(private|limited|ltd|inc|llc|corp|corporation|solutions|technologies|technology|services|group|company|co)\b/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

export function resolveCompanyIdByName(companyName, clients = []) {
  const raw = String(companyName || '').trim();
  if (!raw) return '';
  const normalized = raw.toLowerCase();
  const compact = normalizeCompanyMatchKey(raw);

  const exact = clients.find((c) => String(c.companyName || '').trim().toLowerCase() === normalized);
  if (exact?.id) return exact.id;

  const compactMatch = clients.find(
    (c) => compact && normalizeCompanyMatchKey(c.companyName) === compact,
  );
  if (compactMatch?.id) return compactMatch.id;

  const partial = clients.find((c) => {
    const cn = String(c.companyName || '').trim().toLowerCase();
    if (!cn) return false;
    return cn.includes(normalized) || normalized.includes(cn);
  });
  if (partial?.id) return partial.id;

  const token = compact.slice(0, Math.max(4, Math.floor(compact.length * 0.6)));
  if (token.length >= 4) {
    const tokenMatch = clients.find((c) => normalizeCompanyMatchKey(c.companyName).includes(token));
    if (tokenMatch?.id) return tokenMatch.id;
  }

  return '';
}

export function buildJobExtractionPromptInstructions() {
  return [
    'Extract structured job posting data for an ATS Add Job form.',
    'Sections: ' + JOB_CREATION_PIPELINE_SECTIONS.join('; '),
    'priority: High | Medium | Low. employmentType: Full Time | Part Time | Contract | Internship.',
    'jobLocationType: Remote | Hybrid | On-site. targetHireDate: YYYY-MM-DD or empty.',
    'Copy labeled lines exactly (Role/Job Title, Company, Openings, Location, Experience, Salary, Skills).',
    'jobDescriptionHtml: concise HTML with h3 sections Overview, Responsibilities, Requirements, Benefits.',
    'If unknown, use empty string, 0 for experience integers, or empty arrays.',
  ].join('\n');
}
