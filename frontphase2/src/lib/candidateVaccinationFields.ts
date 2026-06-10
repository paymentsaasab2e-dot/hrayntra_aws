import type { CandidateWorkExperienceDocument } from './candidateWorkExperienceFields';

export const VACCINATION_MONTH_OPTIONS = [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
] as const;

const MONTH_LABELS: Record<string, string> = Object.fromEntries(
  VACCINATION_MONTH_OPTIONS.map((option) => [option.value, option.label]),
);

export type VaccinationValidityMode = 'lifetime' | 'custom';

export type CandidateVaccinationRecord = {
  vaccinationStatus?: string;
  vaccineType?: string;
  lastVaccinationDate?: string;
  validityMode?: VaccinationValidityMode;
  validityMonth?: string;
  validityYear?: string;
  certificate?: string;
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

export function parseVaccinationDocuments(value: unknown): CandidateWorkExperienceDocument[] {
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

export function deriveVaccinationValidityMode(
  month?: string | null,
  year?: string | null,
): VaccinationValidityMode {
  const m = str(month).toUpperCase();
  const y = str(year).toUpperCase();
  if (m === 'LIFETIME' || y === 'LIFETIME') return 'lifetime';
  if (m || y) return 'custom';
  return 'lifetime';
}

export function formatVaccinationValidityDisplay(
  month?: string | null,
  year?: string | null,
): string {
  const mode = deriveVaccinationValidityMode(month, year);
  if (mode === 'lifetime') return 'Lifetime';

  const m = str(month);
  const y = str(year);
  if (!m && !y) return 'Lifetime';

  const monthLabel =
    MONTH_LABELS[m] ||
    VACCINATION_MONTH_OPTIONS.find((option) => option.label.toLowerCase() === m.toLowerCase())?.label ||
    m;
  if (monthLabel && y) return `${monthLabel} ${y}`;
  if (y) return y;
  return monthLabel || '';
}

export function normalizeVaccinationRecord(
  entry: Record<string, unknown> | CandidateVaccinationRecord | null | undefined,
): CandidateVaccinationRecord {
  const row = (entry || {}) as Record<string, unknown>;
  const legacyCertificate = str(row.certificate);
  const documents = parseVaccinationDocuments(row.documents ?? row.vaccinationDocuments);
  if (legacyCertificate && !documents.some((doc) => doc.url === legacyCertificate)) {
    documents.unshift({
      id: `legacy-${legacyCertificate}`,
      url: legacyCertificate,
      name: documentNameFromUrl(legacyCertificate),
      fileName: documentNameFromUrl(legacyCertificate),
    });
  }

  const validityMonth = str(row.validityMonth);
  const validityYear = str(row.validityYear);

  return {
    vaccinationStatus: str(row.vaccinationStatus) || undefined,
    vaccineType: str(row.vaccineType) || undefined,
    lastVaccinationDate: str(row.lastVaccinationDate) || undefined,
    validityMode: deriveVaccinationValidityMode(validityMonth, validityYear),
    validityMonth: validityMonth || undefined,
    validityYear: validityYear || undefined,
    certificate: legacyCertificate || documents[0]?.url || undefined,
    documents,
  };
}

export function hasVaccinationContent(record: CandidateVaccinationRecord): boolean {
  return Boolean(
    record.vaccineType ||
      record.lastVaccinationDate ||
      record.validityMonth ||
      record.validityYear ||
      record.vaccinationStatus ||
      (record.documents && record.documents.length > 0),
  );
}

export function vaccinationRecordToSnapshotRow(
  entry: CandidateVaccinationRecord | Record<string, unknown>,
): Record<string, unknown> {
  const normalized = normalizeVaccinationRecord(entry);
  const documentUrls = normalized.documents
    ?.filter((doc) => doc.url && !doc.url.startsWith('blob:'))
    .map((doc) => doc.url as string);

  const validityMonth =
    normalized.validityMode === 'lifetime'
      ? 'LIFETIME'
      : normalized.validityMonth || undefined;
  const validityYear =
    normalized.validityMode === 'lifetime' ? undefined : normalized.validityYear || undefined;

  return {
    vaccinationStatus: normalized.vaccinationStatus || '',
    vaccineType: normalized.vaccineType || '',
    lastVaccinationDate: normalized.lastVaccinationDate || '',
    validityMonth: validityMonth || '',
    validityYear: validityYear || '',
    certificate: documentUrls?.[0] || normalized.certificate || '',
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
