import type { BackendClient } from './api';
import { postServiceKycFormFromRecord } from './clientKycForm';
import type {
  BillingSettingsSnapshot,
  InvoiceBankDetails,
  InvoiceLegalTerms,
  InvoiceSignatoryBlock,
  RecruitmentInvoiceData,
} from '../types/recruitmentInvoice';
import { calculatePlacementFee } from '../utils/placements';
import { addDaysIso, recalcInvoiceTotals, recalcLineItem } from './invoiceCalculations';
import { resolveClientEmail } from './invoiceCurrency';
import { formatDateDMY } from '../utils/dateDisplay';

/** Placeholder agency bank until billing settings are fully configured. */
export const DUMMY_AGENCY_BANK: InvoiceBankDetails = {
  bankName: 'HDFC Bank Ltd.',
  accountHolderName: 'HRYANTRA Recruitment Pvt. Ltd.',
  accountNumber: '50200012345678',
  iban: '',
  swiftCode: 'HDFCINBB',
  bankAddress: 'Mumbai Main Branch, Maharashtra, India',
  currency: 'INR',
};

export function parseAgreementPercent(raw: unknown): number | null {
  const s = String(raw ?? '').replace(/%/g, '').trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parsePercent(raw: unknown): number | null {
  return parseAgreementPercent(raw);
}

function formatDateDisplay(iso?: string | null): string {
  if (!iso) return '';
  const formatted = formatDateDMY(iso);
  return formatted || String(iso);
}

function formatReplacementTerms(client: BackendClient): string {
  const value = client.agreementFreeReplacementValue;
  const unit = client.agreementFreeReplacementUnit;
  if (value == null || value === '') return '';
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '';
  const unitLabel = unit === 'DAYS' ? (n === 1 ? 'day' : 'days') : n === 1 ? 'month' : 'months';
  return `${n} ${unitLabel} free replacement from date of joining`;
}

function buildAgreementValidityNote(client: BackendClient): string {
  const start = formatDateDisplay(client.agreementContractStartDate);
  const end = formatDateDisplay(client.agreementContractEndDate);
  const validity = String(client.agreementContractValidity || '').trim();
  if (start && end) {
    return `Agreement valid from ${start} to ${end}${validity ? ` (${validity})` : ''}`;
  }
  if (validity) return `Agreement validity: ${validity}`;
  if (start) return `Agreement effective from ${start}`;
  if (end) return `Agreement valid until ${end}`;
  return '';
}

export function resolveSellerBankDetails(settings: BillingSettingsSnapshot): InvoiceBankDetails {
  const hasReal =
    String(settings.bankName || '').trim() ||
    String(settings.accountNumber || '').trim() ||
    String(settings.swiftCode || '').trim();
  if (!hasReal) {
    return {
      ...DUMMY_AGENCY_BANK,
      accountHolderName: settings.companyName || DUMMY_AGENCY_BANK.accountHolderName,
      currency: settings.defaultCurrency || DUMMY_AGENCY_BANK.currency,
    };
  }
  return {
    bankName: settings.bankName || '—',
    accountHolderName:
      settings.accountHolderName || settings.companyName || 'Your agency',
    accountNumber: settings.accountNumber || '—',
    iban: settings.iban || '',
    swiftCode: settings.swiftCode || '—',
    bankAddress: settings.bankAddress || '',
    currency: settings.defaultCurrency || 'USD',
  };
}

/** Build terms & conditions body from agreement fields (shown on invoice page 2). */
function looksLikeAgreementNotes(notes: string): boolean {
  const text = notes.trim();
  if (!text) return false;
  return (
    text.includes('Agreement level') ||
    text.includes('Payment terms') ||
    text.includes('Service charge') ||
    text.includes('Advance payment') ||
    text.includes('Free replacement') ||
    text.includes('Agreement valid') ||
    text.includes('Agreement period') ||
    (text.includes('Placement invoice') && text.split('\n').filter(Boolean).length > 1)
  );
}

/** Move legacy agreement text from Notes into Terms & conditions. */
export function migrateLegacyInvoiceNotesToTerms(
  invoice: RecruitmentInvoiceData,
): RecruitmentInvoiceData {
  const notes = String(invoice.notes || '').trim();
  const terms = String(invoice.termsAndConditions || '').trim();
  if (terms || !notes || !looksLikeAgreementNotes(notes)) {
    return invoice;
  }
  const firstLine = notes.split('\n').find((line) => line.trim()) || '';
  const shortNote = firstLine.startsWith('Placement invoice')
    ? firstLine
    : `Placement invoice for ${
        invoice.placementSummary?.candidateName ||
        invoice.placementSummary?.jobTitle ||
        invoice.buyer.name ||
        'client'
      }.`;
  return {
    ...invoice,
    termsAndConditions: notes,
    notes: shortNote,
  };
}

export function buildTermsAndConditionsFromLegal(legal: InvoiceLegalTerms): string {
  const lines: string[] = [];
  if (legal.agreementLevel) lines.push(`Agreement level: ${legal.agreementLevel}.`);
  if (legal.serviceChargePercent != null) {
    lines.push(`Service charge / commission: ${legal.serviceChargePercent}% per signed agreement.`);
  }
  if (legal.agreementValidNote) lines.push(legal.agreementValidNote);
  else if (legal.contractStartDate || legal.contractEndDate) {
    const start = formatDateDisplay(legal.contractStartDate);
    const end = formatDateDisplay(legal.contractEndDate);
    if (start || end) lines.push(`Agreement period: ${start || '—'} to ${end || '—'}.`);
  }
  if (legal.paymentTerms) lines.push(`Payment terms: ${legal.paymentTerms}.`);
  if (legal.advancePaymentPercent != null && legal.advancePaymentPercent > 0) {
    lines.push(`Advance payment: ${legal.advancePaymentPercent}% of invoice total as per client agreement.`);
  }
  if (legal.freeReplacementText) lines.push(`Free replacement: ${legal.freeReplacementText}.`);
  return lines.join('\n');
}

export function resolveBuyerBankDetails(client: BackendClient | null | undefined): InvoiceBankDetails | null {
  const kyc = postServiceKycFormFromRecord(client);
  const bank = kyc.bankAccountDetails;
  if (!bank.bankName && !bank.accountNumber && !bank.iban) return null;
  return {
    bankName: bank.bankName || '—',
    accountHolderName: bank.accountHolderName || client?.companyName || '—',
    accountNumber: bank.accountNumber || '—',
    iban: bank.iban || '',
    swiftCode: bank.swiftBicCode || '—',
    bankAddress: bank.bankAddress || '',
    currency: bank.currency || '',
  };
}

export function buildLegalTermsFromClient(
  client: BackendClient | null | undefined,
  settings: BillingSettingsSnapshot,
): InvoiceLegalTerms {
  if (!client) {
    return {
      paymentTerms: settings.defaultPaymentTerms || 'Net 30 Days',
    };
  }
  const pct = parsePercent(client.agreementServiceChargePercent);
  const advance = parsePercent(client.agreementAdvancePaymentPercent);
  const paymentTerms =
    String(client.agreementTimePeriod || '').trim() || settings.defaultPaymentTerms || 'Net 30 Days';

  return {
    agreementLevel: String(client.agreementLevel || '').trim() || undefined,
    serviceChargePercent: pct ?? undefined,
    commissionLabel: pct != null ? `${pct}% service charge per signed agreement` : undefined,
    contractStartDate: client.agreementContractStartDate || undefined,
    contractEndDate: client.agreementContractEndDate || undefined,
    contractValidity: client.agreementContractValidity || undefined,
    paymentTerms,
    advancePaymentPercent: advance ?? undefined,
    freeReplacementText: formatReplacementTerms(client) || undefined,
    agreementValidNote: buildAgreementValidityNote(client) || undefined,
  };
}

export function resolveClientSignatory(client: BackendClient | null | undefined): InvoiceSignatoryBlock {
  const kyc = postServiceKycFormFromRecord(client);
  const fromKyc = kyc.authorizedSignatory.fullName || kyc.declaration.authorizedSignatoryName;
  if (!fromKyc) {
    return {
      label: 'Client',
      name: 'Not available',
      designation: undefined,
    };
  }
  return {
    label: 'Client',
    name: fromKyc,
    designation: kyc.authorizedSignatory.designation || undefined,
  };
}

export function resolveAgencySignatory(settings: BillingSettingsSnapshot): InvoiceSignatoryBlock {
  const name =
    String(settings.authorizedSignatoryName || '').trim() ||
    settings.companyName ||
    'Authorized Signatory';
  return {
    label: 'Agency',
    name,
    designation:
      String(settings.authorizedSignatoryDesignation || '').trim() ||
      'For and on behalf of the agency',
    signatureImageUrl: String(settings.agencySignatureUrl || '').trim() || undefined,
  };
}

export type ApplyClientInvoiceContextOptions = {
  offerSalary?: number;
  placementFee?: number;
  jobTitle?: string;
  candidateName?: string;
  clientName?: string;
  /** Commission % used for fee math and line description (agreement or form). */
  commissionPercent?: number;
  /** When true, do not recalculate placement fee from salary × commission. */
  feeEditedManually?: boolean;
  /** When true, keep agency bank and agency signatory if already set. */
  preserveUserEdits?: boolean;
  /** When true, keep existing terms & conditions textarea content. */
  preserveTermsEdits?: boolean;
};

/**
 * Merge client agreement, KYC bank, and commission into an invoice draft.
 */
export function applyClientContextToInvoice(
  invoice: RecruitmentInvoiceData,
  client: BackendClient | null | undefined,
  settings: BillingSettingsSnapshot,
  options: ApplyClientInvoiceContextOptions = {},
): RecruitmentInvoiceData {
  const legalTerms = buildLegalTermsFromClient(client, settings);
  const agreementPct = legalTerms.serviceChargePercent;
  const formPct =
    options.commissionPercent != null && options.commissionPercent > 0
      ? options.commissionPercent
      : null;
  /** Agreement commission always wins when present on the client record. */
  const effectiveCommissionPct = agreementPct ?? formPct ?? null;

  const offerSalary = Number(options.offerSalary || 0);
  let placementFee = Number(options.placementFee ?? 0);

  if (
    !options.feeEditedManually &&
    offerSalary > 0 &&
    effectiveCommissionPct != null &&
    effectiveCommissionPct > 0
  ) {
    placementFee = Math.round(calculatePlacementFee(offerSalary, effectiveCommissionPct));
  }

  const candidateName = options.candidateName || invoice.placementSummary?.candidateName || '';
  const jobTitle = options.jobTitle || invoice.placementSummary?.jobTitle || '';
  const clientName = options.clientName || client?.companyName || invoice.buyer.name;

  const lineName =
    placementFee > 0
      ? `Placement fee — ${jobTitle || 'role'} (${
          effectiveCommissionPct != null ? `${effectiveCommissionPct}%` : 'per agreement'
        })`
      : invoice.lineItems[0]?.name || `Placement fee — ${jobTitle || 'role'}`;

  const lineItems =
    placementFee > 0
      ? [
          recalcLineItem({
            name: lineName,
            quantity: 1,
            price: placementFee,
            total: placementFee,
          }),
        ]
      : invoice.lineItems;

  const totals = recalcInvoiceTotals(lineItems, invoice.additionalCharges, invoice.taxRate);

  const kyc = postServiceKycFormFromRecord(client);
  const buyerAddress =
    kyc.clientInformation.businessAddress ||
    [client?.city, client?.state, client?.country].filter(Boolean).join(', ') ||
    invoice.buyer.address;

  const paymentDaysMatch = String(legalTerms.paymentTerms || '').match(/(\d+)/);
  const dueDate =
    paymentDaysMatch && invoice.invoiceDate
      ? addDaysIso(Number(paymentDaysMatch[1]), invoice.invoiceDate)
      : invoice.dueDate;

  const shortNote = `Placement invoice for ${candidateName || jobTitle || clientName || 'client'}.`;
  const termsText = buildTermsAndConditionsFromLegal(legalTerms);
  const preserveTerms = options.preserveTermsEdits === true;
  const preserveUserEdits = options.preserveUserEdits === true;
  const migrated = migrateLegacyInvoiceNotesToTerms(invoice);

  let notes = shortNote;
  let termsAndConditions = termsText;

  if (preserveTerms && String(invoice.termsAndConditions || '').trim()) {
    termsAndConditions = invoice.termsAndConditions!;
  } else if (!termsText && String(migrated.termsAndConditions || '').trim()) {
    termsAndConditions = migrated.termsAndConditions!;
    notes = migrated.notes || shortNote;
  } else if (!preserveTerms && looksLikeAgreementNotes(String(invoice.notes || ''))) {
    termsAndConditions = migrated.termsAndConditions || termsText;
    notes = migrated.notes || shortNote;
  }

  const keptNotes = String(invoice.notes || '').trim();
  if (preserveTerms && keptNotes && !looksLikeAgreementNotes(keptNotes)) {
    notes = keptNotes;
  }

  const legalTermsForInvoice: InvoiceLegalTerms = {
    ...legalTerms,
  };

  return {
    ...invoice,
    ...totals,
    dueDate,
    lineItems,
    notes,
    termsAndConditions,
    buyer: {
      ...invoice.buyer,
      name: clientName || invoice.buyer.name,
      email: resolveClientEmail(client) || invoice.buyer.email,
      address: buyerAddress || invoice.buyer.address,
      city: client?.city || invoice.buyer.city,
      state: client?.state || invoice.buyer.state,
      country: client?.country || invoice.buyer.country,
    },
    legalTerms: legalTermsForInvoice,
    sellerBank:
      preserveUserEdits && invoice.sellerBank
        ? invoice.sellerBank
        : resolveSellerBankDetails(settings),
    clientSignatory: resolveClientSignatory(client),
    agencySignatory:
      preserveUserEdits && invoice.agencySignatory
        ? invoice.agencySignatory
        : resolveAgencySignatory(settings),
    placementSummary: {
      ...invoice.placementSummary,
      candidateName: candidateName || invoice.placementSummary?.candidateName,
      jobTitle: jobTitle || invoice.placementSummary?.jobTitle,
      clientName: clientName || invoice.placementSummary?.clientName,
    },
  };
}
