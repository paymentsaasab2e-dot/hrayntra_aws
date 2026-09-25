import { getCountryByCodeOrName } from './cscData';
import type { CandidateWorkExperienceDocument } from './candidateWorkExperienceFields';

export const VISA_TYPE_OPTIONS = [
  'Citizen / Permanent Resident',
  'Work Visa',
  'Student Visa',
  'Tourist Visa',
  'Business Visa',
  'Dependent Visa',
  'Other',
] as const;

export const VISA_STATUS_OPTIONS = ['Active', 'Expired', 'Pending', 'Renewal Required'] as const;

export const VISA_WORKPERMIT_OPTIONS = [
  'Yes, I require sponsorship',
  "No, I don't require sponsorship",
  'Open to either',
] as const;

export type CandidateVisaEntryRecord = {
  id?: string;
  isPrimary?: boolean;
  country?: string;
  countryName?: string;
  requiresVisa?: 'Yes' | 'No' | '';
  visaType?: string;
  visaStatus?: string;
  visaExpiryDate?: string;
  workPermitNumber?: string;
  visaWorkpermitRequired?: string;
  documents?: CandidateWorkExperienceDocument[];
  additionalRemarks?: string;
};

function str(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
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

export function parseVisaDocuments(value: unknown): CandidateWorkExperienceDocument[] {
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
      const url = String(item.url || item.fileUrl || item.file || item.href || '').trim();
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
    .filter((doc) => Boolean(doc?.name || doc?.url)) as CandidateWorkExperienceDocument[];
}

export function countryDisplayName(codeOrName?: string): string {
  const raw = str(codeOrName);
  if (!raw) return '';
  const meta = getCountryByCodeOrName(raw, raw);
  return meta?.name || raw;
}

function buildVisaDetailsPayload(entry: CandidateVisaEntryRecord): Record<string, unknown> {
  return {
    id: entry.id && entry.id !== 'primary' ? entry.id : 'expected',
    visaType: entry.visaType || '',
    visaStatus: entry.visaStatus || 'Active',
    visaExpiryDate: entry.visaExpiryDate || '',
    itemFamilyNumber: entry.workPermitNumber || '',
    documents: entry.documents
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

function entryFromVisaParts(
  parts: {
    id?: string;
    isPrimary?: boolean;
    country?: string;
    countryName?: string;
    requiresVisa?: string;
    visaDetails?: Record<string, unknown> | null;
    visaWorkpermitRequired?: string;
    additionalRemarks?: string;
  },
): CandidateVisaEntryRecord {
  const details = parts.visaDetails || {};
  const visaType = str(details.visaType);
  const country = str(parts.country);
  const countryName = str(parts.countryName) || countryDisplayName(country);
  const explicitRequires = str(parts.requiresVisa);
  const requiresVisa =
    explicitRequires === 'Yes' || explicitRequires === 'No'
      ? explicitRequires
      : visaType
        ? 'Yes'
        : str(parts.visaWorkpermitRequired)
          ? 'No'
          : '';

  return {
    id: parts.id,
    isPrimary: parts.isPrimary,
    country: country || undefined,
    countryName: countryName || undefined,
    requiresVisa,
    visaType: visaType || undefined,
    visaStatus: str(details.visaStatus) || undefined,
    visaExpiryDate: str(details.visaExpiryDate) || undefined,
    workPermitNumber: str(details.itemFamilyNumber) || undefined,
    visaWorkpermitRequired: str(parts.visaWorkpermitRequired) || undefined,
    documents: parseVisaDocuments(details.documents),
    additionalRemarks: str(parts.additionalRemarks) || undefined,
  };
}

export function visaEntryHasContent(entry: CandidateVisaEntryRecord | Record<string, unknown>): boolean {
  const row = entry as Record<string, unknown>;
  const documents = Array.isArray(row.documents) ? row.documents : [];
  return Boolean(
    str(row.country) ||
      str(row.countryName) ||
      str(row.destination) ||
      str(row.requiresVisa) ||
      str(row.visaType) ||
      str(row.visaExpiryDate) ||
      str(row.workPermitNumber) ||
      str(row.itemFamilyNumber) ||
      str(row.visaWorkpermitRequired) ||
      str(row.additionalRemarks) ||
      documents.length,
  );
}

export function extractVisaDisplayEntries(
  visa: Record<string, unknown> | null | undefined,
): CandidateVisaEntryRecord[] {
  if (!visa || typeof visa !== 'object') return [];

  const entries: CandidateVisaEntryRecord[] = [];

  if (visa.openForAll === true && !str(visa.selectedDestination)) {
    return [
      {
        id: 'open-all',
        countryName: 'Open for all destinations',
        additionalRemarks: str(visa.additionalRemarks) || undefined,
      },
    ];
  }

  const destination = str(visa.selectedDestination);
  const primaryDetails =
    visa.visaDetailsExpected && typeof visa.visaDetailsExpected === 'object'
      ? (visa.visaDetailsExpected as Record<string, unknown>)
      : null;
  const hasPrimary = Boolean(
    destination ||
      str(visa.requiresVisa) ||
      str(visa.visaWorkpermitRequired) ||
      str(visa.additionalRemarks) ||
      str(primaryDetails?.visaType) ||
      str(primaryDetails?.itemFamilyNumber),
  );
  if (hasPrimary) {
    entries.push(
      entryFromVisaParts({
        id: 'primary',
        isPrimary: true,
        country: destination,
        requiresVisa: str(visa.requiresVisa),
        visaDetails: primaryDetails,
        visaWorkpermitRequired: str(visa.visaWorkpermitRequired),
        additionalRemarks: str(visa.additionalRemarks),
      }),
    );
  }

  const nestedEntries = Array.isArray(visa.visaEntries) ? visa.visaEntries : [];
  for (const raw of nestedEntries) {
    if (!raw || typeof raw !== 'object') continue;
    const row = raw as Record<string, unknown>;
    const country = str(row.country) || str(row.destination);
    if (destination && country && country === destination) continue;
    const details =
      row.visaDetails && typeof row.visaDetails === 'object'
        ? (row.visaDetails as Record<string, unknown>)
        : str(row.visaType) || str(row.workPermitNumber)
          ? {
              visaType: row.visaType,
              visaStatus: row.visaStatus,
              visaExpiryDate: row.visaExpiryDate,
              itemFamilyNumber: row.workPermitNumber,
              documents: row.documents,
            }
          : null;
    entries.push(
      entryFromVisaParts({
        id: str(row.id) || undefined,
        isPrimary: row.isPrimary === true,
        country,
        countryName: str(row.countryName),
        requiresVisa: str(row.requiresVisa),
        visaDetails: details,
        visaWorkpermitRequired: str(row.visaWorkpermitRequired),
        additionalRemarks: str(row.additionalRemarks),
      }),
    );
  }

  return entries;
}

export function normalizeVisaEntryRecord(
  entry: CandidateVisaEntryRecord | Record<string, unknown>,
): CandidateVisaEntryRecord {
  const row = entry as Record<string, unknown>;
  const country = str(row.country) || str(row.destination);
  const countryName = str(row.countryName) || countryDisplayName(country);
  const requiresVisaRaw = str(row.requiresVisa);
  const requiresVisa =
    requiresVisaRaw === 'Yes' || requiresVisaRaw === 'No'
      ? requiresVisaRaw
      : str(row.visaType)
        ? 'Yes'
        : str(row.visaWorkpermitRequired)
          ? 'No'
          : '';

  return {
    id: str(row.id) || undefined,
    isPrimary: row.isPrimary === true,
    country: country || undefined,
    countryName: countryName || undefined,
    requiresVisa,
    visaType: str(row.visaType) || undefined,
    visaStatus: str(row.visaStatus) || undefined,
    visaExpiryDate: str(row.visaExpiryDate) || undefined,
    workPermitNumber: str(row.workPermitNumber) || str(row.itemFamilyNumber) || undefined,
    visaWorkpermitRequired: str(row.visaWorkpermitRequired) || undefined,
    documents: parseVisaDocuments(row.documents),
    additionalRemarks: str(row.additionalRemarks) || undefined,
  };
}

function storedVisaEntry(entry: CandidateVisaEntryRecord): Record<string, unknown> {
  return {
    id: entry.id || `visa-${Date.now()}`,
    isPrimary: entry.isPrimary === true,
    country: entry.country || '',
    countryName: entry.countryName || countryDisplayName(entry.country),
    requiresVisa: entry.requiresVisa || '',
    visaWorkpermitRequired: entry.requiresVisa === 'No' ? entry.visaWorkpermitRequired || '' : '',
    visaType: entry.visaType || '',
    visaStatus: entry.visaStatus || '',
    visaExpiryDate: entry.visaExpiryDate || '',
    workPermitNumber: entry.workPermitNumber || '',
    visaDetails:
      entry.requiresVisa === 'Yes'
        ? buildVisaDetailsPayload(entry)
        : { id: 'expected', visaType: '', visaStatus: 'Active', documents: [] },
    additionalRemarks: entry.additionalRemarks || '',
    documents: entry.documents || [],
  };
}

export function visaDisplayEntriesToSnapshot(
  entries: CandidateVisaEntryRecord[],
  previous?: Record<string, unknown> | null,
): Record<string, unknown> {
  const normalized = entries.map((entry) => normalizeVisaEntryRecord(entry));
  const primary =
    normalized.find((entry) => entry.isPrimary && visaEntryHasContent(entry)) ||
    normalized.find((entry) => entry.country || entry.countryName) ||
    normalized.find((entry) => visaEntryHasContent(entry)) ||
    null;
  const rest = normalized.filter((entry) => entry !== primary && visaEntryHasContent(entry));
  const previousRecord = { ...(previous || {}) };
  delete previousRecord.editorEntries;

  return {
    ...previousRecord,
    openForAll: previous?.openForAll === true,
    selectedDestination: primary?.country || primary?.countryName || '',
    requiresVisa: primary?.requiresVisa || '',
    visaDetailsExpected:
      primary?.requiresVisa === 'Yes' ? buildVisaDetailsPayload(primary) : undefined,
    visaWorkpermitRequired:
      primary?.requiresVisa === 'No' ? primary.visaWorkpermitRequired || '' : '',
    additionalRemarks: primary?.additionalRemarks || '',
    visaEntries: rest.map((entry) => storedVisaEntry(entry)),
  };
}
