import type { CandidateWorkExperienceDocument } from './candidateWorkExperienceFields';

export const ACCOMPLISHMENT_CATEGORY_OPTIONS = [
  'Award',
  'Publication',
  'Research',
  'Competition',
  'Conference',
  'Patent',
  'Recognition',
  'Achievement',
  'Other',
] as const;

export type CandidateAccomplishmentRecord = {
  id?: string;
  title?: string;
  category?: string;
  organization?: string;
  achievementDate?: string;
  description?: string;
  supportingDocument?: string;
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

function parseAccomplishmentDocuments(value: unknown): CandidateWorkExperienceDocument[] {
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

export function normalizeAccomplishmentRecord(
  entry: Record<string, unknown> | CandidateAccomplishmentRecord,
): CandidateAccomplishmentRecord {
  const row = entry as Record<string, unknown>;
  const legacyFile = str(row.supportingDocument);
  const documents = parseAccomplishmentDocuments(
    row.documents ?? row.accomplishmentDocuments ?? row.supportingDocuments,
  );
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
    title: str(row.title) || str(row.accomplishmentTitle),
    category: str(row.category),
    organization: str(row.organization),
    achievementDate: str(row.achievementDate) || str(row.date),
    description: str(row.description),
    supportingDocument: legacyFile || undefined,
    documents,
  };
}

export function accomplishmentRecordToSnapshotRow(
  entry: CandidateAccomplishmentRecord,
): Record<string, unknown> {
  const normalized = normalizeAccomplishmentRecord(entry);
  const documentUrls = normalized.documents
    ?.filter((doc) => doc.url && !doc.url.startsWith('blob:'))
    .map((doc) => doc.url as string);

  return {
    id: normalized.id,
    title: normalized.title || '',
    category: normalized.category || '',
    organization: normalized.organization || '',
    achievementDate: normalized.achievementDate || '',
    description: normalized.description || '',
    supportingDocument: normalized.supportingDocument || documentUrls?.[0] || '',
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
