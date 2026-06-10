export const WORK_EMPLOYMENT_TYPE_OPTIONS = [
  { value: 'full-time', label: 'Full-time' },
  { value: 'part-time', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'internship', label: 'Internship' },
  { value: 'freelance', label: 'Freelance' },
] as const;

export const WORK_MODE_OPTIONS = [
  { value: 'remote', label: 'Remote' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'onsite', label: 'On-site' },
] as const;

export const WORK_INDUSTRY_OPTIONS = [
  'Technology',
  'Finance',
  'Healthcare',
  'Education',
  'Consulting',
  'Marketing',
  'Advertising',
  'Manufacturing',
  'Retail',
  'Media',
  'Real Estate',
  'Legal',
  'Government',
  'Insurance',
  'E-commerce',
  'Human Resources',
  'Construction',
  'Hospitality',
  'Transportation',
  'Energy',
] as const;

export const WORK_TURNOVER_CURRENCIES = [
  'INR',
  'USD',
  'EUR',
  'GBP',
  'AED',
  'SGD',
  'AUD',
  'CAD',
  'JPY',
] as const;

export type CandidateWorkExperienceDocument = {
  id?: string;
  name?: string;
  url?: string;
  fileName?: string;
  size?: number;
};

function documentNameFromUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return 'Document';
  try {
    const pathname = new URL(trimmed, 'https://placeholder.local').pathname;
    const tail = pathname.split('/').filter(Boolean).pop();
    if (tail) return decodeURIComponent(tail);
  } catch {
    const tail = trimmed.split('/').filter(Boolean).pop();
    if (tail) return decodeURIComponent(tail);
  }
  return 'Document';
}

function parseWorkExperienceDocuments(value: unknown): CandidateWorkExperienceDocument[] {
  if (!value) return [];
  const rawList = Array.isArray(value) ? value : [value];

  return rawList
    .map((doc, index) => {
      if (typeof doc === 'string') {
        const url = doc.trim();
        if (!url) return null;
        return {
          id: `doc-${index}-${url}`,
          url,
          name: documentNameFromUrl(url),
          fileName: documentNameFromUrl(url),
        };
      }
      if (!doc || typeof doc !== 'object') return null;
      const item = doc as Record<string, unknown>;
      const url = String(item.url || item.fileUrl || item.href || '').trim();
      const name =
        String(item.name || item.fileName || item.title || '').trim() ||
        (url ? documentNameFromUrl(url) : 'Document');
      const sizeValue = Number(item.size);
      return {
        id: String(item.id || url || `${name}-${index}`),
        name,
        fileName: String(item.fileName || name),
        url: url || undefined,
        size: Number.isFinite(sizeValue) && sizeValue > 0 ? sizeValue : undefined,
      };
    })
    .filter((doc): doc is CandidateWorkExperienceDocument => Boolean(doc?.name || doc?.url));
}

export type CandidateWorkExperienceRecord = {
  id?: string;
  jobTitle?: string;
  title?: string;
  company?: string;
  companyName?: string;
  employmentType?: string;
  industryDomain?: string;
  numberOfReportees?: string;
  startDate?: string;
  endDate?: string;
  currentlyWorkHere?: boolean;
  currentlyWorking?: boolean;
  isCurrentJob?: boolean;
  workLocation?: string;
  location?: string;
  workMode?: string;
  companyProfile?: string;
  companyTurnover?: string;
  companyTurnoverCurrency?: string;
  companyTurnoverAmount?: string;
  keyResponsibilities?: string;
  achievements?: string;
  workSkills?: string[] | string;
  responsibilities?: string[] | string;
  description?: string;
  documents?: CandidateWorkExperienceDocument[];
  durationText?: string;
};

function str(value: unknown): string {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function parseSkills(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => str(item)).filter(Boolean);
  }
  const text = str(value);
  if (!text) return [];
  return text
    .split(/[,;]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseResponsibilities(entry: Record<string, unknown>): string[] {
  const keyResp = str(entry.keyResponsibilities);
  if (keyResp) {
    return keyResp
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
  }
  const responsibilities = entry.responsibilities;
  if (Array.isArray(responsibilities)) {
    return responsibilities.map((line) => str(line)).filter(Boolean);
  }
  const description = str(entry.description);
  if (!description) return [];
  return description
    .split(/\n+/)
    .map((line) => line.replace(/^-+\s*/, '').trim())
    .filter(Boolean);
}

export function parseStoredTurnover(stored: string): { currency: string; amount: string } {
  const raw = stored.trim();
  if (!raw) return { currency: 'INR', amount: '' };

  const codes = new Set<string>(WORK_TURNOVER_CURRENCIES as unknown as string[]);
  const parts = raw.split(/\s+/);
  const head = parts[0]?.toUpperCase() ?? '';
  if (codes.has(head)) {
    return { currency: head, amount: parts.slice(1).join(' ').trim() };
  }
  return { currency: 'INR', amount: raw };
}

export function formatStoredTurnover(currency: string, amount: string): string {
  const value = amount.trim();
  if (!value) return '';
  return `${currency.trim().toUpperCase()} ${value}`.trim();
}

export function normalizeWorkExperienceRecord(
  entry: Record<string, unknown> | CandidateWorkExperienceRecord,
): CandidateWorkExperienceRecord {
  const row = entry as Record<string, unknown>;
  const jobTitle = str(row.jobTitle) || str(row.title);
  const companyName = str(row.companyName) || str(row.company);
  const workLocation = str(row.workLocation) || str(row.location);
  const industryDomain = str(row.industryDomain) || str(row.industry);
  const companyProfile =
    str(row.companyProfile) ||
    str(row.companyDescription) ||
    str(row.company_description);
  const currentlyWorkHere =
    row.currentlyWorkHere === true ||
    row.currentlyWorking === true ||
    row.isCurrentJob === true ||
    /^present$/i.test(str(row.endDate));

  const storedTurnover = str(row.companyTurnover);
  const turnoverCurrency = str(row.companyTurnoverCurrency) || parseStoredTurnover(storedTurnover).currency;
  const turnoverAmount = str(row.companyTurnoverAmount) || parseStoredTurnover(storedTurnover).amount;

  const responsibilities = parseResponsibilities(row);
  const keyResponsibilities =
    str(row.keyResponsibilities) ||
    (responsibilities.length ? responsibilities.join('\n') : '');

  const documents = parseWorkExperienceDocuments(
    row.documents ?? row.workExperienceDocuments ?? row.certificates ?? row.attachments,
  );

  const achievements =
    str(row.achievements) ||
    str(row.accomplishment) ||
    str(row.accomplishmentText);

  const workSkills = parseSkills(
    row.workSkills ?? row.skills ?? row.skillsUsed ?? row.skill,
  );

  return {
    id: str(row.id) || undefined,
    jobTitle,
    title: jobTitle,
    companyName,
    company: companyName,
    employmentType: str(row.employmentType),
    industryDomain,
    numberOfReportees: str(row.numberOfReportees),
    startDate: str(row.startDate),
    endDate: currentlyWorkHere ? '' : str(row.endDate),
    currentlyWorkHere,
    currentlyWorking: currentlyWorkHere,
    isCurrentJob: currentlyWorkHere,
    workLocation,
    location: workLocation,
    workMode: str(row.workMode),
    companyProfile,
    companyTurnover: formatStoredTurnover(turnoverCurrency, turnoverAmount) || storedTurnover,
    companyTurnoverCurrency: turnoverCurrency,
    companyTurnoverAmount: turnoverAmount,
    keyResponsibilities,
    achievements,
    workSkills,
    responsibilities,
    description: str(row.description),
    documents,
    durationText: str(row.durationText) || undefined,
  };
}

export function workExperienceRecordToSnapshotRow(
  entry: CandidateWorkExperienceRecord,
): Record<string, unknown> {
  const normalized = normalizeWorkExperienceRecord(entry);
  return {
    ...normalized,
    jobTitle: normalized.jobTitle,
    company: normalized.companyName,
    companyName: normalized.companyName,
    workLocation: normalized.workLocation,
    location: normalized.workLocation,
    responsibilities: normalized.responsibilities,
    workSkills: normalized.workSkills,
    documents: normalized.documents
      ?.filter((doc) => doc.url && !doc.url.startsWith('blob:'))
      .map((doc) => ({
        id: doc.id,
        name: doc.name,
        fileName: doc.fileName || doc.name,
        url: doc.url,
        size: doc.size,
      })),
    companyTurnover: normalized.companyTurnover,
  };
}

export function formatWorkExperienceDocumentSize(bytes?: number): string {
  if (!bytes || !Number.isFinite(bytes)) return '';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function formatEmploymentTypeLabel(value: string): string {
  const match = WORK_EMPLOYMENT_TYPE_OPTIONS.find((opt) => opt.value === value);
  return match?.label || value.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatWorkModeLabel(value: string): string {
  const match = WORK_MODE_OPTIONS.find((opt) => opt.value === value);
  return match?.label || value.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
