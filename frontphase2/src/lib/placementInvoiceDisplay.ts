import type {
  BillingSettingsSnapshot,
  InvoiceBankDetails,
  RecruitmentInvoiceData,
} from '../types/recruitmentInvoice';
import { formatDateDMY } from '../utils/dateDisplay';

export const INVOICE_FIELD_NOT_AVAILABLE = 'Not available';

export type InvoiceDetailRow = {
  label: string;
  value: string;
  missing: boolean;
};

function displayValue(raw?: string | number | null): { value: string; missing: boolean } {
  if (raw === null || raw === undefined) {
    return { value: INVOICE_FIELD_NOT_AVAILABLE, missing: true };
  }
  const text = String(raw).trim();
  if (!text) return { value: INVOICE_FIELD_NOT_AVAILABLE, missing: true };
  return { value: text, missing: false };
}

function formatDateField(iso?: string | null): { value: string; missing: boolean } {
  if (!iso) return { value: INVOICE_FIELD_NOT_AVAILABLE, missing: true };
  const formatted = formatDateDMY(iso);
  if (!formatted) return displayValue(iso);
  return {
    value: formatted,
    missing: false,
  };
}

function bankRows(prefix: string, bank?: InvoiceBankDetails | null): InvoiceDetailRow[] {
  const holder = displayValue(bank?.accountHolderName);
  const bankName = displayValue(bank?.bankName);
  const account = displayValue(bank?.accountNumber);
  const swift = displayValue(bank?.swiftCode);
  return [
    { label: `${prefix} — account name`, ...holder },
    { label: `${prefix} — bank`, ...bankName },
    { label: `${prefix} — account number`, ...account },
    { label: `${prefix} — SWIFT / IFSC`, ...swift },
  ];
}

export function buildPlacementInvoiceAgreementRows(
  invoice: RecruitmentInvoiceData | null | undefined,
  settings?: BillingSettingsSnapshot | null,
): InvoiceDetailRow[] {
  const legal = invoice?.legalTerms;
  const paymentTerms = displayValue(
    legal?.paymentTerms || settings?.defaultPaymentTerms || '',
  );
  const level = displayValue(legal?.agreementLevel);
  const commission =
    legal?.serviceChargePercent != null && legal.serviceChargePercent > 0
      ? { value: `${legal.serviceChargePercent}%`, missing: false }
      : displayValue(null);
  const start = formatDateField(legal?.contractStartDate);
  const end = formatDateField(legal?.contractEndDate);
  const validity = displayValue(legal?.agreementValidNote || legal?.contractValidity);
  const advance =
    legal?.advancePaymentPercent != null && legal.advancePaymentPercent > 0
      ? { value: `${legal.advancePaymentPercent}%`, missing: false }
      : displayValue(null);
  const replacement = displayValue(legal?.freeReplacementText);
  const clientSignatory = displayValue(invoice?.clientSignatory?.name);
  const clientDesignation = displayValue(invoice?.clientSignatory?.designation);
  const agencySignatory = displayValue(invoice?.agencySignatory?.name);

  return [
    { label: 'Agreement level', ...level },
    { label: 'Service charge / commission', ...commission },
    { label: 'Agreement start date', ...start },
    { label: 'Agreement end date', ...end },
    { label: 'Agreement validity', ...validity },
    { label: 'Payment terms', ...paymentTerms },
    { label: 'Advance payment', ...advance },
    { label: 'Free replacement', ...replacement },
    ...bankRows('Client bank (KYC)', invoice?.buyerBank),
    ...bankRows('Agency bank', invoice?.sellerBank),
    { label: 'Client authorized signatory', ...clientSignatory },
    { label: 'Client signatory designation', ...clientDesignation },
    { label: 'Agency authorized signatory', ...agencySignatory },
  ];
}
