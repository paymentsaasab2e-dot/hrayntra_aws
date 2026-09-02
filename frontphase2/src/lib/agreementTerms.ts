/** Shared Agreements & Terms fields for leads and clients. */

import { formatDateDMY } from '../utils/dateDisplay';

export type AgreementFreeReplacementUnit = 'MONTHS' | 'DAYS';

export type AgreementTermsFormValues = {
  agreementLevel: string;
  agreementServiceChargePercent: string;
  /** Legacy combined validity text kept for backwards compatibility. */
  agreementContractValidity: string;
  /** Start date of the agreement (`YYYY-MM-DD` for native calendar inputs). */
  agreementContractStartDate: string;
  /** End date of the agreement (`YYYY-MM-DD` for native calendar inputs). */
  agreementContractEndDate: string;
  /** Payment terms (DB: agreementTimePeriod) */
  agreementTimePeriod: string;
  /** Advance payment % (DB: agreementAdvancePaymentPercent) */
  agreementAdvancePaymentPercent: string;
  agreementFreeReplacementValue: string;
  agreementFreeReplacementUnit: AgreementFreeReplacementUnit | '';
};

export const AGREEMENT_LEVEL_OPTIONS = [
  'Level 1',
  'Level 2',
  'Level 3',
  'Level 4',
  'Executive',
  'All levels',
] as const;

export const AGREEMENT_REPLACEMENT_UNIT_OPTIONS: { value: AgreementFreeReplacementUnit; label: string }[] = [
  { value: 'MONTHS', label: 'Months' },
  { value: 'DAYS', label: 'Days' },
];

export const DEFAULT_AGREEMENT_PAYMENT_TERMS =
  'Payment to be made by the client after the candidate has joined';

export function toAgreementDateInputValue(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const ymd = raw.match(/^(\d{4})[/.](\d{1,2})[/.](\d{1,2})$/);
  if (ymd) {
    return `${ymd[1]}-${String(ymd[2]).padStart(2, '0')}-${String(ymd[3]).padStart(2, '0')}`;
  }
  const dmy = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmy) {
    return `${dmy[3]}-${String(dmy[2]).padStart(2, '0')}-${String(dmy[1]).padStart(2, '0')}`;
  }
  return raw.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : '';
}

export function emptyAgreementTerms(): AgreementTermsFormValues {
  return {
    agreementLevel: '',
    agreementServiceChargePercent: '',
    agreementContractValidity: '',
    agreementContractStartDate: '',
    agreementContractEndDate: '',
    agreementTimePeriod: '',
    agreementAdvancePaymentPercent: '',
    agreementFreeReplacementValue: '',
    agreementFreeReplacementUnit: 'MONTHS',
  };
}

type AgreementTermsRecord = {
  [K in Exclude<
    keyof AgreementTermsFormValues,
    'agreementFreeReplacementValue' | 'agreementFreeReplacementUnit'
  >]?: AgreementTermsFormValues[K] | null;
} & {
  agreementFreeReplacementValue?: number | string | null;
  agreementFreeReplacementUnit?: AgreementFreeReplacementUnit | '' | null;
  agreementAdvancePaymentPercent?: string | null;
  agreementTotalPayment?: string | null;
};

export function agreementTermsFromRecord(
  record?: AgreementTermsRecord | null,
): AgreementTermsFormValues {
  const base = emptyAgreementTerms();
  if (!record) return base;

  const src = record as AgreementTermsRecord & {
    terms?: AgreementTermsRecord;
    level?: string | null;
    serviceChargePercent?: string | number | null;
    paymentTerms?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    contractStartDate?: string | null;
    contractEndDate?: string | null;
  };
  const nested = src.terms && typeof src.terms === 'object' ? src.terms : null;
  const row = nested ? { ...src, ...nested } : src;

  const unit = String(row.agreementFreeReplacementUnit || '').toUpperCase();

  return {
    agreementLevel:
      row.agreementLevel != null && String(row.agreementLevel).trim()
        ? String(row.agreementLevel)
        : row.level != null
          ? String(row.level)
          : '',
    agreementServiceChargePercent:
      row.agreementServiceChargePercent != null && String(row.agreementServiceChargePercent).trim()
        ? String(row.agreementServiceChargePercent)
        : row.serviceChargePercent != null
          ? String(row.serviceChargePercent)
          : '',
    agreementContractValidity:
      (row as { agreementContractValidity?: string | null }).agreementContractValidity != null
        ? String((row as { agreementContractValidity?: string | null }).agreementContractValidity)
        : '',
    agreementContractStartDate: toAgreementDateInputValue(
      (row as { agreementContractStartDate?: string | null }).agreementContractStartDate ||
        row.contractStartDate ||
        row.startDate,
    ),
    agreementContractEndDate: toAgreementDateInputValue(
      (row as { agreementContractEndDate?: string | null }).agreementContractEndDate ||
        row.contractEndDate ||
        row.endDate,
    ),
    agreementTimePeriod:
      row.agreementTimePeriod != null && String(row.agreementTimePeriod).trim()
        ? String(row.agreementTimePeriod)
        : row.paymentTerms != null
          ? String(row.paymentTerms)
          : '',
    agreementAdvancePaymentPercent:
      row.agreementAdvancePaymentPercent != null && row.agreementAdvancePaymentPercent !== ''
        ? String(row.agreementAdvancePaymentPercent)
        : '',
    agreementFreeReplacementValue:
      row.agreementFreeReplacementValue != null && row.agreementFreeReplacementValue !== ''
        ? String(row.agreementFreeReplacementValue)
        : '',
    agreementFreeReplacementUnit:
      unit === 'DAYS' || unit === 'MONTHS' ? (unit as AgreementFreeReplacementUnit) : 'MONTHS',
  };
}

export function agreementTermsApiPayload(values: AgreementTermsFormValues) {
  const replacementRaw = values.agreementFreeReplacementValue.trim();
  const replacementParsed = replacementRaw === '' ? null : Number.parseInt(replacementRaw, 10);
  const freeReplacementValue =
    replacementParsed != null && Number.isFinite(replacementParsed) && replacementParsed >= 0
      ? replacementParsed
      : null;

  return {
    agreementTotalPayment: null,
    agreementLevel: values.agreementLevel.trim() || null,
    agreementServiceChargePercent: values.agreementServiceChargePercent.trim() || null,
    agreementContractValidity:
      values.agreementContractStartDate.trim() || values.agreementContractEndDate.trim()
        ? [values.agreementContractStartDate.trim(), values.agreementContractEndDate.trim()]
            .filter(Boolean)
            .map((value) => formatDateDMY(value))
            .join(' to ')
        : values.agreementContractValidity.trim() || null,
    agreementContractStartDate: values.agreementContractStartDate.trim() || null,
    agreementContractEndDate: values.agreementContractEndDate.trim() || null,
    agreementTimePeriod: values.agreementTimePeriod.trim() || null,
    agreementAdvancePaymentPercent: values.agreementAdvancePaymentPercent.trim() || null,
    agreementFreeReplacementValue: freeReplacementValue,
    agreementFreeReplacementUnit:
      freeReplacementValue != null && values.agreementFreeReplacementUnit
        ? values.agreementFreeReplacementUnit
        : null,
  };
}

export function filledAgreementTermKeys(values: Partial<AgreementTermsFormValues>): (keyof AgreementTermsFormValues)[] {
  const keys: (keyof AgreementTermsFormValues)[] = [
    'agreementLevel',
    'agreementServiceChargePercent',
    'agreementContractStartDate',
    'agreementContractEndDate',
    'agreementTimePeriod',
    'agreementAdvancePaymentPercent',
    'agreementFreeReplacementValue',
    'agreementFreeReplacementUnit',
  ];
  return keys.filter((key) => {
    const value = values[key];
    if (value == null || String(value).trim() === '') return false;
    if (key === 'agreementFreeReplacementUnit' && !String(values.agreementFreeReplacementValue || '').trim()) {
      return false;
    }
    return true;
  });
}

/** Apply non-empty values parsed from an uploaded agreement document. */
export function mergeExtractedAgreementTerms(
  current: AgreementTermsFormValues,
  extracted: Partial<AgreementTermsFormValues>,
): AgreementTermsFormValues {
  const next = { ...current };
  const keys: (keyof AgreementTermsFormValues)[] = [
    'agreementLevel',
    'agreementServiceChargePercent',
    'agreementContractValidity',
    'agreementContractStartDate',
    'agreementContractEndDate',
    'agreementTimePeriod',
    'agreementAdvancePaymentPercent',
    'agreementFreeReplacementValue',
    'agreementFreeReplacementUnit',
  ];
  for (const key of keys) {
    const value = extracted[key];
    if (value != null && String(value).trim() !== '') {
      if (key === 'agreementContractStartDate' || key === 'agreementContractEndDate') {
        const date = toAgreementDateInputValue(value);
        if (date) next[key] = date;
        continue;
      }
      next[key] = value as AgreementTermsFormValues[typeof key];
    }
  }
  return next;
}

export function formatAgreementTermsSummary(values: AgreementTermsFormValues): string[] {
  const lines: string[] = [];
  if (values.agreementLevel.trim()) {
    lines.push(`Level: ${values.agreementLevel.trim()}`);
  }
  if (values.agreementServiceChargePercent.trim()) {
    lines.push(`Service charge: ${values.agreementServiceChargePercent.trim()}%`);
  }
  if (values.agreementContractStartDate.trim() || values.agreementContractEndDate.trim()) {
    const start = values.agreementContractStartDate.trim()
      ? formatDateDMY(values.agreementContractStartDate.trim())
      : '';
    const end = values.agreementContractEndDate.trim()
      ? formatDateDMY(values.agreementContractEndDate.trim())
      : '';
    lines.push(`Contract validity: ${[start, end].filter(Boolean).join(' to ')}`);
  } else if (values.agreementContractValidity.trim()) {
    lines.push(`Contract validity: ${values.agreementContractValidity.trim()}`);
  }
  if (values.agreementTimePeriod.trim()) {
    lines.push(`Payment terms: ${values.agreementTimePeriod.trim()}`);
  }
  if (values.agreementAdvancePaymentPercent.trim()) {
    lines.push(`Advance payment: ${values.agreementAdvancePaymentPercent.trim()}%`);
  }
  if (values.agreementFreeReplacementValue.trim()) {
    const unit =
      values.agreementFreeReplacementUnit === 'DAYS'
        ? 'days'
        : values.agreementFreeReplacementUnit === 'MONTHS'
          ? 'months'
          : '';
    lines.push(
      `Free replacement: ${values.agreementFreeReplacementValue.trim()}${unit ? ` ${unit}` : ''}`,
    );
  }
  return lines;
}
