import type { CandidateWorkExperienceDocument } from './candidateWorkExperienceFields';

export type CandidateCertificationRecord = {
  id?: string;
  certificationName?: string;
  issuingOrganization?: string;
  issueDate?: string;
  expiryDate?: string;
  doesNotExpire?: boolean;
  credentialId?: string;
  credentialUrl?: string;
  certificateFile?: string;
  documents?: CandidateWorkExperienceDocument[];
  description?: string;
};

const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

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

function parseCertificationDocuments(value: unknown): CandidateWorkExperienceDocument[] {
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

export function formatCertificationMonthDisplay(value: string | undefined): string {
  const raw = str(value);
  if (!raw) return '';

  const monthMatch = /^(\d{4})-(\d{2})$/.exec(raw);
  if (monthMatch) {
    const year = Number(monthMatch[1]);
    const month = Number(monthMatch[2]);
    if (month >= 1 && month <= 12) {
      return `${MONTH_LABELS[month - 1]} ${year}`;
    }
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return `${MONTH_LABELS[parsed.getMonth()]} ${parsed.getFullYear()}`;
  }

  return raw;
}

export function normalizeCertificationRecord(
  entry: Record<string, unknown> | CandidateCertificationRecord,
): CandidateCertificationRecord {
  const row = entry as Record<string, unknown>;
  const doesNotExpire = row.doesNotExpire === true;
  const documents = parseCertificationDocuments(
    row.documents ?? row.certificationDocuments ?? row.certificates,
  );
  const legacyFile = str(row.certificateFile);
  if (legacyFile && !documents.some((doc) => doc.url === legacyFile)) {
    documents.push({
      id: `legacy-${legacyFile}`,
      url: legacyFile,
      name: documentNameFromUrl(legacyFile),
      fileName: documentNameFromUrl(legacyFile),
    });
  }

  return {
    id: str(row.id) || undefined,
    certificationName: str(row.certificationName) || str(row.name),
    issuingOrganization: str(row.issuingOrganization) || str(row.organization),
    issueDate: str(row.issueDate),
    expiryDate: doesNotExpire ? '' : str(row.expiryDate),
    doesNotExpire,
    credentialId: str(row.credentialId),
    credentialUrl: str(row.credentialUrl) || str(row.credentialLink),
    certificateFile: legacyFile || undefined,
    documents,
    description: str(row.description),
  };
}

export function certificationRecordToSnapshotRow(
  entry: CandidateCertificationRecord,
): Record<string, unknown> {
  const normalized = normalizeCertificationRecord(entry);
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
