export type CandidateAiGeneratedPayload = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  age?: string;
  cityState?: string;
  address?: string;
  zip?: string;
  nationality?: string;
  maritalStatus?: string;
  birthDate?: string;
  passportNumber?: string;
  currentCompany?: string;
  currentDesignation?: string;
  currentCompanyWebsite?: string;
  experience?: string;
  currentSalary?: string;
  currentSalaryCurrency?: string;
  currentBenefits?: string;
  expectedSalary?: string;
  currency?: string;
  expectedBenefits?: string;
  noticePeriodDays?: string;
  noticePeriod?: string;
  availabilityStatus?: string;
  courses?: string;
  extracurricularActivities?: string;
  volunteers?: string;
  linkedinUrl?: string;
  twitter?: string;
  facebook?: string;
  skypeId?: string;
  stackOverflow?: string;
  website?: string;
  portfolioUrl?: string;
  summary?: string;
  workHistory?: string;
  educationHistory?: string;
  honoursAwards?: string;
  source?: string;
  sourceUrl?: string;
  referrerName?: string;
  agencyName?: string;
  priority?: string;
  location?: string;
  remarks?: string;
  initialNote?: string;
  skills?: string[];
};

export type CandidateAiInsights = {
  score: number;
  priority: string;
  nextAction: string;
  followUpHint: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function buildCandidateAiMissingMessage(form: {
  firstName?: string;
  email?: string;
}) {
  const missing: string[] = [];
  if (!String(form.firstName || '').trim()) missing.push('first name');
  if (!EMAIL_RE.test(String(form.email || '').trim())) missing.push('a valid email');
  if (!missing.length) return '';
  return `Still need ${missing.join(' and ')} before creating this candidate.`;
}

export function computeCandidateAiInsights(
  form: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    currentDesignation?: string;
    currentCompany?: string;
    skills?: string[];
    summary?: string;
    priority?: string;
  },
  sourceText: string,
): CandidateAiInsights {
  let score = 28;
  if (form.firstName) score += 12;
  if (EMAIL_RE.test(String(form.email || '').trim())) score += 18;
  if (form.phone) score += 8;
  if (form.currentDesignation) score += 8;
  if (form.currentCompany) score += 6;
  if ((form.skills || []).length) score += 10;
  if (form.summary) score += 6;
  if (sourceText.trim().length > 180) score += 4;
  score = Math.min(100, score);

  const priority =
    form.priority === 'High' || form.priority === 'Low' || form.priority === 'Medium'
      ? form.priority
      : score >= 78
        ? 'High'
        : score >= 50
          ? 'Medium'
          : 'Low';

  const name = [form.firstName, form.lastName].filter(Boolean).join(' ') || 'this candidate';
  return {
    score,
    priority,
    nextAction: form.email
      ? `Review ${name}'s profile, then create the candidate.`
      : `Capture email for ${name} so we can save the profile.`,
    followUpHint: form.currentDesignation
      ? `${form.currentDesignation}${form.currentCompany ? ` at ${form.currentCompany}` : ''} looks ready to screen.`
      : 'Add current role or skills to strengthen the profile.',
  };
}

export function mapParsedResumeToAiPayload(data: {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  currentCompany?: string;
  currentDesignation?: string;
  designation?: string;
  experience?: number | string;
  location?: string;
  city?: string;
  country?: string;
  address?: string;
  linkedinUrl?: string;
  website?: string;
  portfolioUrl?: string;
  summary?: string;
  skills?: string[];
  expectedSalary?: number | string;
  currentSalary?: number | string;
  currency?: string;
  noticePeriod?: string;
  source?: string;
  priority?: string;
  educationEntries?: Array<{ degree?: string; institution?: string; startYear?: string; endYear?: string }>;
  workExperienceEntries?: Array<{
    title?: string;
    company?: string;
    startDate?: string;
    endDate?: string;
  }>;
}): CandidateAiGeneratedPayload {
  const location =
    String(data.location || '').trim() ||
    [data.city, data.country].map((v) => String(v || '').trim()).filter(Boolean).join(', ');
  const workHistory = Array.isArray(data.workExperienceEntries)
    ? data.workExperienceEntries
        .map((entry) => [entry.title, entry.company, entry.startDate, entry.endDate].filter(Boolean).join(' · '))
        .filter(Boolean)
        .join('\n')
    : '';
  const educationHistory = Array.isArray(data.educationEntries)
    ? data.educationEntries
        .map((entry) => [entry.degree, entry.institution, entry.startYear, entry.endYear].filter(Boolean).join(' · '))
        .filter(Boolean)
        .join('\n')
    : '';

  return {
    firstName: data.firstName || '',
    lastName: data.lastName || '',
    email: data.email || '',
    phone: data.phone ? String(data.phone).replace(/[^\d]/g, '') : '',
    currentCompany: data.currentCompany || '',
    currentDesignation: data.currentDesignation || data.designation || '',
    experience: data.experience != null && data.experience !== '' ? String(data.experience) : '',
    cityState: location,
    location,
    address: data.address || '',
    linkedinUrl: data.linkedinUrl || '',
    website: data.website || data.portfolioUrl || '',
    portfolioUrl: data.portfolioUrl || '',
    summary: data.summary || '',
    workHistory,
    educationHistory,
    skills: Array.isArray(data.skills) ? data.skills.map(String).filter(Boolean) : [],
    expectedSalary: data.expectedSalary != null && data.expectedSalary !== '' ? String(data.expectedSalary) : '',
    currency: data.currency || '',
    noticePeriod: data.noticePeriod || '',
    source: data.source || '',
    priority: data.priority || '',
  };
}

export const CANDIDATE_AI_STRING_KEYS = [
  'firstName',
  'lastName',
  'email',
  'phone',
  'age',
  'cityState',
  'address',
  'zip',
  'nationality',
  'maritalStatus',
  'birthDate',
  'passportNumber',
  'currentCompany',
  'currentDesignation',
  'currentCompanyWebsite',
  'experience',
  'currentSalary',
  'currentSalaryCurrency',
  'currentBenefits',
  'expectedSalary',
  'currency',
  'expectedBenefits',
  'noticePeriodDays',
  'noticePeriod',
  'availabilityStatus',
  'courses',
  'extracurricularActivities',
  'volunteers',
  'linkedinUrl',
  'twitter',
  'facebook',
  'skypeId',
  'stackOverflow',
  'website',
  'portfolioUrl',
  'summary',
  'workHistory',
  'educationHistory',
  'honoursAwards',
  'source',
  'sourceUrl',
  'referrerName',
  'agencyName',
  'priority',
  'location',
  'remarks',
  'initialNote',
] as const;
