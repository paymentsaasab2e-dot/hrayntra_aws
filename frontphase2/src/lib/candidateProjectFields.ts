import type { CandidateWorkExperienceDocument } from './candidateWorkExperienceFields';

export const PROJECT_TYPE_OPTIONS = [
  'Academic Project',
  'Personal Project',
  'Freelance Project',
  'Open Source',
  'Company Project',
  'Research Project',
  'Other',
] as const;

export type CandidateProjectRecord = {
  id?: string;
  projectTitle?: string;
  projectType?: string;
  organizationClient?: string;
  currentlyWorking?: boolean;
  startDate?: string;
  endDate?: string;
  projectDescription?: string;
  responsibilities?: string;
  technologies?: string[];
  projectOutcome?: string;
  projectLink?: string;
  documents?: CandidateWorkExperienceDocument[];
};

function str(value: unknown): string {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

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

function parseProjectDocuments(value: unknown): CandidateWorkExperienceDocument[] {
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

function normalizeProjectDate(value: unknown): string {
  const raw = str(value);
  if (!raw) return '';
  return raw.includes('T') ? raw.split('T')[0] : raw;
}

function parseTechnologies(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => str(item)).filter(Boolean);
  }
  const text = str(value);
  if (!text) return [];
  return text
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function formatProjectDateDisplay(value: string | undefined): string {
  const iso = normalizeProjectDate(value);
  if (!iso) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || !month || !day) return iso;
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatProjectDateLine(
  startDate?: string,
  endDate?: string,
  currentlyWorking?: boolean,
): string {
  const start = formatProjectDateDisplay(startDate);
  const end = currentlyWorking ? 'Present' : formatProjectDateDisplay(endDate);
  if (start && end) return `${start} – ${end}`;
  return start || end;
}

export function normalizeProjectRecord(
  entry: Record<string, unknown> | CandidateProjectRecord,
): CandidateProjectRecord {
  const row = entry as Record<string, unknown>;
  const currentlyWorking = row.currentlyWorking === true;

  return {
    id: str(row.id) || undefined,
    projectTitle: str(row.projectTitle) || str(row.title),
    projectType: str(row.projectType) || str(row.type),
    organizationClient: str(row.organizationClient) || str(row.organization),
    currentlyWorking,
    startDate: normalizeProjectDate(row.startDate),
    endDate: currentlyWorking ? '' : normalizeProjectDate(row.endDate),
    projectDescription: str(row.projectDescription) || str(row.description),
    responsibilities: str(row.responsibilities),
    technologies: parseTechnologies(row.technologies ?? row.techStack),
    projectOutcome: str(row.projectOutcome) || str(row.outcome),
    projectLink: str(row.projectLink) || str(row.link) || str(row.url),
    documents: parseProjectDocuments(
      row.documents ?? row.projectDocuments ?? row.certificates ?? row.attachments,
    ),
  };
}

export function projectRecordToSnapshotRow(
  entry: CandidateProjectRecord,
): Record<string, unknown> {
  const normalized = normalizeProjectRecord(entry);
  return {
    ...normalized,
    documents: normalized.documents
      ?.filter((doc) => doc.url && !doc.url.startsWith('blob:'))
      .map((doc) => ({
        id: doc.id,
        name: doc.name,
        fileName: doc.fileName || doc.name,
        url: doc.url,
        size: doc.size,
      })),
  };
}
