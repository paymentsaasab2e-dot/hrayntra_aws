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
      candidateRequirementsText: { type: 'string' },
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
      'candidateRequirementsText',
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

function parseSalaryFields(salaryInput, contextText = '') {
  const raw = String(salaryInput || '').trim();
  const blob = `${raw} ${String(contextText || '')}`.trim();
  if (!raw && !blob) return { payRangeMin: '', payRangeMax: '', salaryCurrency: '', salaryInput: '' };

  const inferCurrency = () => {
    if (/\bINR\b/i.test(blob) || /\bIndia\b/i.test(blob) || /\b₹\b/.test(blob) || /\bLPA\b/i.test(blob)) {
      return 'INR';
    }
    if (/\bUSD\b/i.test(blob) || /\$/.test(blob)) return 'USD';
    return '';
  };

  const kRange = blob.match(/(\d+(?:\.\d+)?)\s*k\s*(?:to|-|–)\s*(\d+(?:\.\d+)?)\s*k/i);
  if (kRange) {
    const min = String(Math.round(Number(kRange[1]) * 1000));
    const max = String(Math.round(Number(kRange[2]) * 1000));
    const display = `${kRange[1]}k to ${kRange[2]}k`;
    const currency = inferCurrency() || (/\bIndia\b/i.test(blob) ? 'INR' : '');
    return {
      payRangeMin: min,
      payRangeMax: max,
      salaryCurrency: currency || 'INR',
      salaryInput: raw || display,
    };
  }

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

/** Known Indian cities — used to lock location from recruiter prompts (never guess Bengaluru if user said Mumbai). */
const INDIAN_CITY_LOOKUP = [
  { keys: ['mumbai', 'bombay'], city: 'Mumbai', state: 'Maharashtra', country: 'India' },
  { keys: ['bengaluru', 'bangalore'], city: 'Bengaluru', state: 'Karnataka', country: 'India' },
  { keys: ['delhi', 'new delhi'], city: 'Delhi', state: 'Delhi', country: 'India' },
  { keys: ['pune'], city: 'Pune', state: 'Maharashtra', country: 'India' },
  { keys: ['hyderabad'], city: 'Hyderabad', state: 'Telangana', country: 'India' },
  { keys: ['chennai', 'madras'], city: 'Chennai', state: 'Tamil Nadu', country: 'India' },
  { keys: ['kolkata', 'calcutta'], city: 'Kolkata', state: 'West Bengal', country: 'India' },
  { keys: ['ahmedabad'], city: 'Ahmedabad', state: 'Gujarat', country: 'India' },
  { keys: ['noida'], city: 'Noida', state: 'Uttar Pradesh', country: 'India' },
  { keys: ['gurgaon', 'gurugram'], city: 'Gurugram', state: 'Haryana', country: 'India' },
  { keys: ['panvel'], city: 'Panvel', state: 'Maharashtra', country: 'India' },
  { keys: ['kharghar'], city: 'Kharghar', state: 'Maharashtra', country: 'India' },
];

function detectKnownCityInText(text) {
  const lower = String(text || '').toLowerCase();
  if (!lower) return null;
  for (const row of INDIAN_CITY_LOOKUP) {
    for (const key of row.keys) {
      const pattern = new RegExp(`\\b${key.replace(/\s+/g, '\\s+')}\\b`, 'i');
      if (pattern.test(lower)) {
        return {
          city: row.city,
          state: row.state,
          country: row.country,
          jobLocation: [row.city, row.state, row.country].filter(Boolean).join(', '),
        };
      }
    }
  }
  return null;
}

function normalizeEmploymentTypeFromText(text) {
  const lower = String(text || '').toLowerCase();
  if (/\bpart[\s-]?time\b/i.test(lower)) return 'Part Time';
  if (/\bcontract\b/i.test(lower)) return 'Contract';
  if (/\binternship\b/i.test(lower)) return 'Internship';
  if (/\bfreelance\b/i.test(lower)) return 'Freelance';
  if (/\bfull[\s-]?time\b/i.test(lower)) return 'Full Time';
  return '';
}

function inferIndustryFromJobTitle(jobTitle) {
  const title = String(jobTitle || '').toLowerCase();
  if (!title) return '';
  if (
    /developer|engineer|frontend|backend|full[\s-]?stack|devops|software|data\s+scientist|qa|tester|designer|ui|ux|it\b/.test(
      title,
    )
  ) {
    return 'Information Technology';
  }
  if (/finance|analyst|accountant/.test(title)) return 'Finance';
  if (/marketing|sales/.test(title)) return 'Marketing';
  return '';
}

/**
 * Hard constraints parsed from the recruiter's original prompt.
 * These override AI guesses for location, salary, nationality, and employment type.
 */
export function extractPromptConstraints(promptText) {
  const text = String(promptText || '').trim();
  if (!text) return {};

  const fallback = extractJobRegexFallback(text);
  const knownCity = detectKnownCityInText(text);
  const salaryRaw = inferSalaryFromNaturalText(text) || fallback.salaryInput;
  const salaryFields = parseSalaryFields(salaryRaw, text);
  const employmentType = normalizeEmploymentTypeFromText(text) || fallback.employmentType || 'Full Time';

  const constraints = {};

  if (fallback.jobTitle) constraints.jobTitle = fallback.jobTitle;

  const cityRow = knownCity || (fallback.city ? {
    city: fallback.city,
    state: fallback.state,
    country: fallback.country || (/\bIndia\b/i.test(text) ? 'India' : ''),
    jobLocation: fallback.jobLocation,
  } : null);

  if (cityRow?.city) {
    constraints.city = cityRow.city;
    constraints.state = cityRow.state || '';
    constraints.country = cityRow.country || '';
    constraints.jobLocation = cityRow.jobLocation || [cityRow.city, cityRow.state, cityRow.country].filter(Boolean).join(', ');
  } else if (/\b(?:only\s+for\s+)?India\b/i.test(text)) {
    constraints.country = 'India';
  }

  if (/\b(?:only\s+for\s+)?India\b/i.test(text) || constraints.country === 'India') {
    constraints.nationality = 'Indian';
    constraints.country = 'India';
    if (!constraints.salaryCurrency && salaryFields.payRangeMin) {
      salaryFields.salaryCurrency = 'INR';
    }
  }

  if (salaryFields.payRangeMin) {
    constraints.payRangeMin = salaryFields.payRangeMin;
    constraints.payRangeMax = salaryFields.payRangeMax || '';
    constraints.salaryCurrency = salaryFields.salaryCurrency || (constraints.country === 'India' ? 'INR' : '');
    constraints.salaryInput = salaryFields.salaryInput || salaryRaw;
  }

  if (fallback.nationality) constraints.nationality = fallback.nationality;
  if (employmentType) constraints.employmentType = employmentType;

  if (fallback.minExperience || fallback.maxExperience) {
    constraints.minExperience = fallback.minExperience;
    constraints.maxExperience = fallback.maxExperience;
  }

  const industry = fallback.industryType || inferIndustryFromJobTitle(constraints.jobTitle || fallback.jobTitle);
  if (industry) constraints.industryType = industry;

  return constraints;
}

/** Apply explicit prompt constraints on top of AI+regex merge (wins over AI hallucinations). */
export function applyPromptConstraintsToMerged(merged, promptText) {
  const text = String(promptText || '').trim();
  if (!text) return merged;

  const c = extractPromptConstraints(text);
  const next = { ...merged };

  if (c.jobTitle) next.jobTitle = c.jobTitle;
  if (c.city) {
    next.city = c.city;
    next.state = c.state || next.state;
    next.country = c.country || next.country;
    next.jobLocation = c.jobLocation || next.jobLocation;
  } else if (c.country) {
    next.country = c.country;
  }
  if (c.nationality) next.nationality = c.nationality;
  if (c.payRangeMin) {
    next.payRangeMin = c.payRangeMin;
    next.payRangeMax = c.payRangeMax || next.payRangeMax;
    next.salaryCurrency = c.salaryCurrency || (c.country === 'India' ? 'INR' : next.salaryCurrency);
    next.salaryInput = c.salaryInput || next.salaryInput;
  }
  if (c.employmentType) {
    next.employmentType = c.employmentType;
    next.jobType = c.employmentType;
  } else if (!/\bpart[\s-]?time\b/i.test(text) && next.employmentType === 'Part Time') {
    next.employmentType = 'Full Time';
    next.jobType = 'Full Time';
  }
  if (c.minExperience != null && Number.isFinite(Number(c.minExperience))) {
    next.minExperience = Number(c.minExperience);
  }
  if (c.maxExperience != null && Number.isFinite(Number(c.maxExperience))) {
    next.maxExperience = Number(c.maxExperience);
  }
  if (c.industryType) next.industryType = c.industryType;

  if (next.country === 'India' && (!next.salaryCurrency || next.salaryCurrency === 'USD')) {
    next.salaryCurrency = 'INR';
  }

  return next;
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

function stripHtmlTags(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Pull bullet/paragraph lines from an h2–h4 section in generated jobDescriptionHtml. */
function extractListSectionFromHtml(html, headingKeywords) {
  const raw = String(html || '');
  if (!raw.trim()) return '';

  const headingRegex = /<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/gi;
  const sections = [];
  let match;
  while ((match = headingRegex.exec(raw)) !== null) {
    sections.push({
      heading: stripHtmlTags(match[1]).toLowerCase(),
      headingStart: match.index,
      bodyStart: match.index + match[0].length,
    });
  }

  const keywords = (Array.isArray(headingKeywords) ? headingKeywords : [headingKeywords]).map((kw) =>
    String(kw).toLowerCase(),
  );

  for (let i = 0; i < sections.length; i += 1) {
    const heading = sections[i].heading;
    const hit = keywords.some(
      (kw) => heading.includes(kw) || kw.split(/\s+/).every((part) => heading.includes(part)),
    );
    if (!hit) continue;

    const bodyEnd = i + 1 < sections.length ? sections[i + 1].headingStart : raw.length;
    const body = raw.slice(sections[i].bodyStart, bodyEnd);

    const liItems = [...body.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
      .map((m) => stripHtmlTags(m[1]))
      .filter(Boolean);
    if (liItems.length) return liItems.join('\n');

    const paragraphs = [...body.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
      .map((m) => stripHtmlTags(m[1]))
      .filter(Boolean);
    if (paragraphs.length) return paragraphs.join('\n');

    const plain = stripHtmlTags(body);
    if (plain) return plain;
  }

  return '';
}

function buildDefaultCandidateRequirements(fields) {
  const lines = [];
  if (fields.educationalQualification) lines.push(String(fields.educationalQualification).trim());
  if (fields.educationalSpecialization) lines.push(String(fields.educationalSpecialization).trim());
  const min = Number(fields.minExperience);
  const max = Number(fields.maxExperience);
  if (Number.isFinite(min) && min > 0 && Number.isFinite(max) && max > 0) {
    lines.push(`${min}–${max} years of relevant experience`);
  } else if (Number.isFinite(min) && min > 0) {
    lines.push(`At least ${min} years of relevant experience`);
  }
  if (fields.nationality) lines.push(`Nationality: ${fields.nationality}`);
  if (fields.country) lines.push(`Eligible to work in ${fields.country}`);
  return lines.filter(Boolean).join('\n');
}

/** When AI only fills jobDescriptionHtml, derive list fields for the Add Job drawer. */
export function hydrateListFieldsFromJobHtml(fields) {
  const next = { ...fields };
  const html = String(next.jobDescriptionHtml || '').trim();
  if (!html) return next;

  if (!String(next.keyResponsibilitiesText || '').trim()) {
    next.keyResponsibilitiesText = extractListSectionFromHtml(html, [
      'key responsibilities',
      'responsibilities',
      'roles and responsibilities',
    ]);
  }

  if (!String(next.qualificationsExperienceText || '').trim()) {
    const requirementParts = [
      extractListSectionFromHtml(html, ['requirements', 'requirement', 'qualifications']),
      extractListSectionFromHtml(html, ['preferred qualifications', 'preferred qualification', 'education']),
    ].filter(Boolean);
    if (requirementParts.length) {
      next.qualificationsExperienceText = requirementParts.join('\n');
    }
  }

  if (!String(next.candidateRequirementsText || '').trim()) {
    const fromHtml = extractListSectionFromHtml(html, [
      'candidate requirements',
      'additional requirements',
      'must have',
    ]);
    next.candidateRequirementsText = fromHtml || buildDefaultCandidateRequirements(next);
  }

  if (!String(next.compensationBenefitsText || '').trim()) {
    next.compensationBenefitsText = extractListSectionFromHtml(html, [
      'benefits',
      'compensation',
      'perks',
    ]);
  }

  return next;
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

function inferJobTitleFromNaturalText(text) {
  const clean = String(text || '').trim().replace(/\s+/g, ' ');
  if (!clean) return '';

  const labeled = extractLabeledValue(clean, ['role', 'job title', 'position', 'title']);
  if (labeled) return labeled;

  const patterns = [
    /(?:create|creat|generate|make|write)\s+(?:a\s+)?job(?:\s+description|\s+jd)?\s+(?:for|of)\s+(?:an?\s+|the\s+)?(.+?)(?:\s+in\s+[A-Za-z]|\s+with\s+salary|\s+for\s+salary|\s+salary\s+|\s+only\s+for|,|$)/i,
    /(?:hiring|looking\s+for|need)\s+(?:an?\s+)?(.+?)(?:\s+in\s+[A-Za-z]|\s+with\s+salary|\s+for\s+salary|,|$)/i,
    /(?:role|position)\s+(?:of|for)\s+(?:an?\s+)?(.+?)(?:\s+in\s+[A-Za-z]|,|$)/i,
  ];
  for (const pattern of patterns) {
    const match = clean.match(pattern);
    if (match?.[1]) {
      return match[1].trim().replace(/[.!,]$/, '');
    }
  }
  return '';
}

function inferCityFromNaturalText(text) {
  const labeled = extractLabeledValue(text, ['location', 'job location', 'work location', 'city']);
  if (labeled) {
    const parsed = parseLocationLine(labeled);
    return parsed.city || labeled.split(',')[0]?.trim() || '';
  }

  const inCity = String(text || '').match(
    /\bin\s+([A-Za-z][A-Za-z\s]{1,40}?)(?:\s*,|\s+for\s+|\s+with\s+|\s+salary|\s+only\s+for|,|$)/i,
  );
  if (inCity?.[1]) {
    const candidate = inCity[1].trim();
    if (!/^(india|the|a|an|only)$/i.test(candidate)) return candidate;
  }
  return '';
}

function inferSalaryFromNaturalText(text) {
  const labeled = extractLabeledValue(text, ['salary', 'compensation', 'ctc', 'pay', 'package']);
  if (labeled) return labeled;

  const patterns = [
    /salary\s+(?:is\s+)?(\d+\s*k\s*(?:to|-|–)\s*\d+\s*k)/i,
    /(\d+\s*k\s*(?:to|-|–)\s*\d+\s*k)/i,
    /(\d[\d,]*\s*(?:to|-|–)\s*\d[\d,]*\s*(?:lpa|inr|₹)?)/i,
  ];
  for (const pattern of patterns) {
    const match = String(text || '').match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return '';
}

export function extractJobRegexFallback(cleanedText) {
  const text = String(cleanedText || '');
  const jobTitle =
    extractLabeledValue(text, ['role', 'job title', 'position', 'title']) ||
    inferJobTitleFromNaturalText(text);
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
  const inferredCity = inferCityFromNaturalText(text);
  const loc = locationLine
    ? parseLocationLine(locationLine)
    : { city: '', state: '', country: '', workMode: '', jobLocation: '' };
  if (!loc.city && inferredCity) {
    loc.city = inferredCity;
    loc.jobLocation = inferredCity;
  }
  let country = loc.country;
  if (!country && /\b(?:only\s+for\s+)?India\b/i.test(text)) country = 'India';
  if (!country && /\bUnited States\b|\bUSA\b/i.test(text)) country = 'United States';
  if (country === 'India' && loc.city && !loc.jobLocation.includes(loc.city)) {
    loc.jobLocation = [loc.city, loc.state, country].filter(Boolean).join(', ');
  }
  const experienceLine = extractLabeledValue(text, ['experience', 'exp', 'years of experience']);
  const exp = parseExperienceRange(experienceLine);
  const skillsLine = extractLabeledValue(text, ['skills', 'skill set', 'tech stack', 'technologies']);
  const skills = skillsLine
    ? skillsLine
        .split(/[,;|]/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  const salaryInput = extractLabeledValue(text, ['salary', 'compensation', 'ctc', 'pay', 'package']) || inferSalaryFromNaturalText(text);
  const targetHireDateRaw = extractLabeledValue(text, [
    'target hire date',
    'hire date',
    'expected closure',
    'closing date',
  ]);
  const isoDate = targetHireDateRaw.match(/\d{4}-\d{2}-\d{2}/)?.[0] || defaultTargetHireDateIso();
  const salaryFields = parseSalaryFields(salaryInput, text);
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
  const candidateRequirements = extractLabeledSectionBlock(text, [
    'candidate requirements',
    'candidate requirement',
    'additional requirements',
  ]);
  const eduMatch = requirements.match(/\b(B\.?\s*E\.?|B\.?\s*Tech|M\.?\s*Tech|MBA|Bachelor|Master)[^.\n]*/i);
  const educationalQualification = eduMatch ? eduMatch[0].trim() : '';
  const jobSummaryParts = [
    jobTitle ? `${jobTitle}${companyName ? ` at ${companyName}` : ''}.` : '',
    loc.city && loc.country ? `Based in ${loc.city}, ${loc.country}.` : '',
    exp.min != null && exp.max != null ? `Experience: ${exp.min}–${exp.max} years.` : '',
  ].filter(Boolean);
  const employmentType = extractLabeledValue(text, ['employment type', 'job type', 'employment']);
  const industryType = extractLabeledValue(text, ['industry', 'industry type', 'sector']);
  const nationality =
    extractLabeledValue(text, ['nationality']) ||
    (/\b(?:only\s+for\s+)?India\b/i.test(text) ? 'Indian' : '');
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
    candidateRequirementsText: candidateRequirements,
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
    const loc = [next.city, next.country].filter(Boolean).join(', ');
    next.jobSummary = loc
      ? `${next.jobTitle}${next.companyName ? ` at ${next.companyName}` : ''} — ${loc}.`
      : `${next.jobTitle}${next.companyName ? ` at ${next.companyName}` : ''}.`;
  }
  if (!next.targetHireDate?.trim()) {
    next.targetHireDate = defaultTargetHireDateIso();
  }
  if (!next.numberOfOpenings?.trim()) next.numberOfOpenings = '1';
  if (!next.priority?.trim()) next.priority = 'Medium';
  if (!next.salaryInput?.trim() && (next.payRangeMin || next.payRangeMax)) {
    const minNum = Number(next.payRangeMin);
    const maxNum = Number(next.payRangeMax);
    const isLpaScale = minNum > 0 && minNum <= 50 && (!maxNum || maxNum <= 80);
    if (next.salaryCurrency === 'INR' && isLpaScale) {
      next.salaryInput = [next.payRangeMin, next.payRangeMax].filter(Boolean).join(' – ') + ' LPA';
    } else if (next.salaryCurrency === 'INR' && minNum >= 1000) {
      next.salaryInput = `₹${next.payRangeMin} – ₹${next.payRangeMax}`;
    } else {
      next.salaryInput = [next.payRangeMin, next.payRangeMax].filter(Boolean).join(' – ');
    }
  }
  if (next.country === 'India' && (!next.salaryCurrency || next.salaryCurrency === 'USD')) {
    next.salaryCurrency = 'INR';
  }
  return hydrateListFieldsFromJobHtml(next);
}

export function mergeJobAiWithFallback(ai, fallback, promptText = '') {
  const pick = (aiVal, fbVal) => {
    if (aiVal == null) return fbVal;
    if (typeof aiVal === 'string' && !aiVal.trim()) return fbVal;
    if (Array.isArray(aiVal) && !aiVal.length) return fbVal;
    return aiVal;
  };
  const merged = {
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
    candidateRequirementsText: pick(ai?.candidateRequirementsText, fallback.candidateRequirementsText),
    compensationBenefitsText: pick(ai?.compensationBenefitsText, fallback.compensationBenefitsText),
    educationalQualification: pick(ai?.educationalQualification, fallback.educationalQualification),
    educationalSpecialization: pick(ai?.educationalSpecialization, fallback.educationalSpecialization),
  };
  return applyPromptConstraintsToMerged(merged, promptText);
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

export function buildJobExtractionPromptInstructions(isNaturalLanguagePrompt = false) {
  const lines = [
    'Extract structured job posting data for an ATS Add Job form.',
    'Sections: ' + JOB_CREATION_PIPELINE_SECTIONS.join('; '),
  ];
  if (isNaturalLanguagePrompt) {
    lines.push(
      'The user message is a SHORT natural-language instruction (not a full JD).',
      'CRITICAL — do NOT invent or guess location, country, state, city, salary, or nationality.',
      'Use ONLY location and salary values explicitly stated in the user text.',
      'Example: "create job for frontend developer in Mumbai salary 10k to 20k only for India" → jobTitle=Frontend Developer, city=Mumbai, state=Maharashtra, country=India, nationality=Indian, salaryCurrency=INR, payRangeMin=10000, payRangeMax=20000, salaryInput="10k to 20k".',
      'Never substitute Bengaluru, Delhi, or any other city if the user named a different city.',
      'Default employmentType to Full Time unless the user explicitly says part-time, contract, or internship.',
      'Generate complete jobDescriptionHtml (Overview, Key Responsibilities, Requirements, Preferred Qualifications, Benefits), 6-10 skills, and realistic min/max experience for the role.',
    );
  } else {
    lines.push(
      'Understand natural language prompts such as: "create job for frontend developer in Mumbai salary 10k to 20k only for India".',
      'When salary uses k (e.g. 10k to 20k) and country is India, set salaryCurrency to INR, payRangeMin=10000, payRangeMax=20000, salaryInput="10k to 20k".',
    );
  }
  lines.push(
    'priority: High | Medium | Low. employmentType: Full Time | Part Time | Contract | Internship.',
    'jobLocationType: Remote | Hybrid | On-site. targetHireDate: YYYY-MM-DD or empty.',
    'Copy labeled lines exactly (Role/Job Title, Company, Openings, Location, Experience, Salary, Skills).',
    'jobDescriptionHtml: concise HTML with h3 sections Overview, Key Responsibilities, Requirements, Preferred Qualifications, Benefits.',
    'keyResponsibilitiesText: 4–8 bullet lines (one responsibility per line, no HTML).',
    'qualificationsExperienceText: requirements + preferred education/experience (one item per line, no HTML).',
    'candidateRequirementsText: eligibility items e.g. degree, years of experience, nationality/work authorization (one per line).',
    'If unknown, use empty string, 0 for experience integers, or empty arrays.',
  );
  return lines.join('\n');
}
