import type { CandidateWorkExperienceDocument } from './candidateWorkExperienceFields';

export const ACADEMIC_ACHIEVEMENT_CATEGORY_OPTIONS = [
  'Academic Excellence',
  'Scholarship',
  'Competition',
  'Research',
  'Publication',
  'Honor Society',
  'Other',
] as const;

export type CandidateAcademicAchievementRecord = {
  id?: string;
  achievementTitle?: string;
  awardedBy?: string;
  yearReceived?: string;
  categoryType?: string;
  description?: string;
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

function parseAcademicAchievementDocuments(value: unknown): CandidateWorkExperienceDocument[] {
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

export function buildAcademicAchievementYearOptions(): number[] {
  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let year = currentYear; year >= currentYear - 50; year -= 1) {
    years.push(year);
  }
  return years;
}

export function normalizeAcademicAchievementRecord(
  entry: Record<string, unknown> | CandidateAcademicAchievementRecord,
): CandidateAcademicAchievementRecord {
  const row = entry as Record<string, unknown>;
  return {
    id: str(row.id) || undefined,
    achievementTitle: str(row.achievementTitle) || str(row.title),
    awardedBy: str(row.awardedBy) || str(row.awardedByInstitution),
    yearReceived: str(row.yearReceived) || str(row.year),
    categoryType: str(row.categoryType) || str(row.category),
    description: str(row.description),
    documents: parseAcademicAchievementDocuments(
      row.documents ?? row.academicDocuments ?? row.certificates ?? row.attachments,
    ),
  };
}

export function academicAchievementRecordToSnapshotRow(
  entry: CandidateAcademicAchievementRecord,
): Record<string, unknown> {
  const normalized = normalizeAcademicAchievementRecord(entry);
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
