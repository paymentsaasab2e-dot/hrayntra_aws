import {
  formatWorkModeLabel,
  type CandidateWorkExperienceDocument,
} from './candidateWorkExperienceFields';

export const INTERNSHIP_TYPE_OPTIONS = [
  { value: 'full-time', label: 'Full-time Internship' },
  { value: 'part-time', label: 'Part-time Internship' },
  { value: 'remote', label: 'Remote Internship' },
  { value: 'hybrid', label: 'Hybrid Internship' },
] as const;

export const INTERNSHIP_DOMAIN_OPTIONS = [
  { value: 'marketing', label: 'Marketing' },
  { value: 'engineering', label: 'Engineering' },
  { value: 'finance', label: 'Finance' },
  { value: 'hr', label: 'Human Resources' },
  { value: 'operations', label: 'Operations' },
  { value: 'sales', label: 'Sales' },
  { value: 'design', label: 'Design' },
] as const;

export type CandidateInternshipRecord = {
  id?: string;
  internshipTitle?: string;
  companyName?: string;
  internshipType?: string;
  domainDepartment?: string;
  startDate?: string;
  endDate?: string;
  currentlyWorking?: boolean;
  location?: string;
  workMode?: string;
  responsibilities?: string;
  learnings?: string;
  skills?: string[] | string;
  documents?: CandidateWorkExperienceDocument[];
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

function parseInternshipDocuments(value: unknown): CandidateWorkExperienceDocument[] {
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

export function formatInternshipTypeLabel(value: string): string {
  const match = INTERNSHIP_TYPE_OPTIONS.find((opt) => opt.value === value);
  return match?.label || value.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatInternshipDomainLabel(value: string): string {
  const match = INTERNSHIP_DOMAIN_OPTIONS.find((opt) => opt.value === value);
  return match?.label || value.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export { formatWorkModeLabel };

export function normalizeInternshipRecord(
  entry: Record<string, unknown> | CandidateInternshipRecord,
): CandidateInternshipRecord {
  const row = entry as Record<string, unknown>;
  const currentlyWorking =
    row.currentlyWorking === true ||
    row.currentlyWorkHere === true ||
    /^present$/i.test(str(row.endDate));

  return {
    id: str(row.id) || undefined,
    internshipTitle: str(row.internshipTitle) || str(row.title),
    companyName: str(row.companyName) || str(row.company),
    internshipType: str(row.internshipType) || str(row.type),
    domainDepartment: str(row.domainDepartment) || str(row.department) || str(row.domain),
    startDate: str(row.startDate),
    endDate: currentlyWorking ? '' : str(row.endDate),
    currentlyWorking,
    location: str(row.location) || str(row.workLocation),
    workMode: str(row.workMode),
    responsibilities: str(row.responsibilities) || str(row.tasks),
    learnings: str(row.learnings),
    skills: parseSkills(row.skills ?? row.workSkills),
    documents: parseInternshipDocuments(
      row.documents ?? row.internshipDocuments ?? row.certificates ?? row.attachments,
    ),
  };
}

export function internshipRecordToSnapshotRow(
  entry: CandidateInternshipRecord,
): Record<string, unknown> {
  const normalized = normalizeInternshipRecord(entry);
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
