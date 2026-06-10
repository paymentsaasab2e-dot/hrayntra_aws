import type { CandidateWorkExperienceDocument } from './candidateWorkExperienceFields';

export const COMPETITIVE_EXAM_NAME_OPTIONS = [
  'GATE',
  'CAT',
  'UPSC',
  'GRE',
  'GMAT',
  'TOEFL',
  'IELTS',
  'SSC',
  'Bank PO',
  'JEE',
  'NEET',
  'CLAT',
  'Other',
] as const;

export const COMPETITIVE_EXAM_RESULT_STATUS_OPTIONS = [
  'Passed',
  'Failed',
  'Appeared',
  'Qualified',
  'Not Qualified',
] as const;

export const COMPETITIVE_EXAM_SCORE_TYPE_OPTIONS = [
  'Bands',
  'Score',
  'Percentile',
  'Rank',
  'Marks',
  'Percentage',
  'CGPA',
  'Other',
] as const;

export type CandidateCompetitiveExamRecord = {
  id?: string;
  examName?: string;
  yearTaken?: string;
  resultStatus?: string;
  scoreMarks?: string;
  scoreType?: string;
  validUntil?: string;
  additionalNotes?: string;
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

function parseCompetitiveExamDocuments(value: unknown): CandidateWorkExperienceDocument[] {
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

export function buildCompetitiveExamYearOptions(): number[] {
  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let year = currentYear; year >= currentYear - 50; year -= 1) {
    years.push(year);
  }
  return years;
}

export function normalizeCompetitiveExamRecord(
  entry: Record<string, unknown> | CandidateCompetitiveExamRecord,
): CandidateCompetitiveExamRecord {
  const row = entry as Record<string, unknown>;
  return {
    id: str(row.id) || undefined,
    examName: str(row.examName),
    yearTaken: str(row.yearTaken),
    resultStatus: str(row.resultStatus),
    scoreMarks: str(row.scoreMarks),
    scoreType: str(row.scoreType),
    validUntil: str(row.validUntil),
    additionalNotes: str(row.additionalNotes),
    documents: parseCompetitiveExamDocuments(
      row.documents ?? row.examDocuments ?? row.certificates ?? row.attachments,
    ),
  };
}

export function competitiveExamRecordToSnapshotRow(
  entry: CandidateCompetitiveExamRecord,
): Record<string, unknown> {
  const normalized = normalizeCompetitiveExamRecord(entry);
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
