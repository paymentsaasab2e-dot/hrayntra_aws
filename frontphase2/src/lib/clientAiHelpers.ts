import type { PostServiceKycFormValues } from './clientKycForm';
import { normalizePostServiceKycShareholders } from './clientKycForm';

export type ClientAiGeneratedPayload = {
  companyName?: string;
  directorName?: string;
  directorSalutation?: string;
  designation?: string;
  email?: string;
  phone?: string;
  emails?: string[];
  phones?: string[];
  industry?: string;
  companySize?: string;
  website?: string;
  linkedIn?: string;
  location?: string;
  country?: string;
  city?: string;
  state?: string;
  timezone?: string;
  leadStatus?: string;
  priority?: string;
  servicesNeeded?: string;
  expectedBusinessValue?: string;
  nextFollowUpDue?: string;
  assignedToId?: string;
  teamMemberName?: string;
  teamMemberEmail?: string;
  teamMemberPhone?: string;
  teamMemberDesignation?: string;
  agreementLevel?: string;
  agreementServiceChargePercent?: string;
  agreementContractStartDate?: string;
  agreementContractEndDate?: string;
  agreementTimePeriod?: string;
  agreementAdvancePaymentPercent?: string;
  agreementFreeReplacementValue?: string;
  agreementFreeReplacementUnit?: string;
  kycTradeName?: string;
  kycEntityType?: string;
  kycIncorporationDate?: string;
  kycCountryOfIncorporation?: string;
  kycLegalRegistrationNumber?: string;
  kycTaxIdVatNumber?: string;
  kycBusinessAddress?: string;
  kycSignatoryFullName?: string;
  kycSignatoryDesignation?: string;
  kycSignatoryNationality?: string;
  kycSignatoryEmail?: string;
  kycSignatoryPhone?: string;
  kycBankName?: string;
  kycAccountHolderName?: string;
  kycAccountNumber?: string;
  kycIban?: string;
  kycSwiftBic?: string;
  kycBankCurrency?: string;
  kycBankAddress?: string;
  kycShareholder1Name?: string;
  kycShareholder1Nationality?: string;
  kycShareholder1OwnershipPercent?: string;
  kycShareholder2Name?: string;
  kycShareholder2Nationality?: string;
  kycShareholder2OwnershipPercent?: string;
  otherDetails?: Array<{ label: string; value: string }>;
};

export type ClientAiInsights = {
  score: number;
  priority: string;
  nextAction: string;
  followUpHint: string;
  packageSuggestion: string;
};

const AGREEMENT_KEYS: (keyof ClientAiGeneratedPayload)[] = [
  'agreementLevel',
  'agreementServiceChargePercent',
  'agreementContractStartDate',
  'agreementContractEndDate',
  'agreementTimePeriod',
  'agreementAdvancePaymentPercent',
  'agreementFreeReplacementValue',
  'agreementFreeReplacementUnit',
];

const KYC_KEYS: (keyof ClientAiGeneratedPayload)[] = [
  'kycTradeName',
  'kycEntityType',
  'kycIncorporationDate',
  'kycCountryOfIncorporation',
  'kycLegalRegistrationNumber',
  'kycTaxIdVatNumber',
  'kycBusinessAddress',
  'kycSignatoryFullName',
  'kycSignatoryDesignation',
  'kycSignatoryNationality',
  'kycSignatoryEmail',
  'kycSignatoryPhone',
  'kycBankName',
  'kycAccountHolderName',
  'kycAccountNumber',
  'kycIban',
  'kycSwiftBic',
  'kycBankCurrency',
  'kycBankAddress',
  'kycShareholder1Name',
  'kycShareholder1Nationality',
  'kycShareholder1OwnershipPercent',
  'kycShareholder2Name',
  'kycShareholder2Nationality',
  'kycShareholder2OwnershipPercent',
];

export function clientAiHasAgreementData(generated: ClientAiGeneratedPayload): boolean {
  return AGREEMENT_KEYS.some((key) => String(generated[key] || '').trim());
}

export function clientAiHasKycData(generated: ClientAiGeneratedPayload): boolean {
  return KYC_KEYS.some((key) => String(generated[key] || '').trim());
}

export function mergeClientAiKycForm(
  existing: PostServiceKycFormValues,
  generated: ClientAiGeneratedPayload,
  fallback: { companyName?: string; directorName?: string; email?: string; phone?: string; website?: string },
): PostServiceKycFormValues {
  const shareholders = normalizePostServiceKycShareholders(existing.shareholders);
  const patchShareholder = (index: number, name?: string, nationality?: string, ownership?: string) => {
    if (!name?.trim() && !nationality?.trim() && !ownership?.trim()) return;
    shareholders[index] = {
      ...shareholders[index],
      fullName: name?.trim() || shareholders[index].fullName,
      nationality: nationality?.trim() || shareholders[index].nationality,
      ownershipPercentage: ownership?.trim() || shareholders[index].ownershipPercentage,
    };
  };

  patchShareholder(0, generated.kycShareholder1Name, generated.kycShareholder1Nationality, generated.kycShareholder1OwnershipPercent);
  patchShareholder(1, generated.kycShareholder2Name, generated.kycShareholder2Nationality, generated.kycShareholder2OwnershipPercent);

  return {
    ...existing,
    clientInformation: {
      ...existing.clientInformation,
      companyName: fallback.companyName || existing.clientInformation.companyName,
      tradeName: generated.kycTradeName?.trim() || existing.clientInformation.tradeName,
      entityType: (generated.kycEntityType?.trim() || existing.clientInformation.entityType) as PostServiceKycFormValues['clientInformation']['entityType'],
      incorporationDate: generated.kycIncorporationDate?.trim() || existing.clientInformation.incorporationDate,
      countryOfIncorporation: generated.kycCountryOfIncorporation?.trim() || existing.clientInformation.countryOfIncorporation,
      legalRegistrationNumber: generated.kycLegalRegistrationNumber?.trim() || existing.clientInformation.legalRegistrationNumber,
      taxIdVatNumber: generated.kycTaxIdVatNumber?.trim() || existing.clientInformation.taxIdVatNumber,
      businessAddress: generated.kycBusinessAddress?.trim() || existing.clientInformation.businessAddress,
      website: fallback.website || existing.clientInformation.website,
      primaryContactPerson: fallback.directorName || existing.clientInformation.primaryContactPerson,
      contactDesignation: generated.designation?.trim() || existing.clientInformation.contactDesignation,
      officialEmail: fallback.email || existing.clientInformation.officialEmail,
      phoneNumber: fallback.phone || existing.clientInformation.phoneNumber,
    },
    authorizedSignatory: {
      ...existing.authorizedSignatory,
      fullName: generated.kycSignatoryFullName?.trim() || existing.authorizedSignatory.fullName,
      designation: generated.kycSignatoryDesignation?.trim() || existing.authorizedSignatory.designation,
      nationality: generated.kycSignatoryNationality?.trim() || existing.authorizedSignatory.nationality,
      email: generated.kycSignatoryEmail?.trim() || existing.authorizedSignatory.email,
      phone: generated.kycSignatoryPhone?.trim() || existing.authorizedSignatory.phone,
    },
    shareholders,
    bankAccountDetails: {
      ...existing.bankAccountDetails,
      bankName: generated.kycBankName?.trim() || existing.bankAccountDetails.bankName,
      accountHolderName: generated.kycAccountHolderName?.trim() || existing.bankAccountDetails.accountHolderName,
      accountNumber: generated.kycAccountNumber?.trim() || existing.bankAccountDetails.accountNumber,
      iban: generated.kycIban?.trim() || existing.bankAccountDetails.iban,
      swiftBicCode: generated.kycSwiftBic?.trim() || existing.bankAccountDetails.swiftBicCode,
      currency: generated.kycBankCurrency?.trim() || existing.bankAccountDetails.currency,
      bankAddress: generated.kycBankAddress?.trim() || existing.bankAccountDetails.bankAddress,
    },
  };
}

export function buildClientAiMissingMessage(form: {
  companyName?: string;
  directorName?: string;
  email?: string;
  contactEmail?: string;
}): string | null {
  const missing: string[] = [];
  if (!String(form.companyName || '').trim()) missing.push('Company name');
  if (!String(form.directorName || '').trim()) missing.push('Director name');
  const email = String(form.email || form.contactEmail || '').trim();
  if (!email) missing.push('Valid email address');

  if (!missing.length) return null;

  return `I filled what I could. Still needed before you can create this client: ${missing.join(', ')}. Optional but helpful: phone, location, services needed, agreements, KYC details.`;
}

export function computeClientAiInsights(
  form: {
    companyName?: string;
    directorName?: string;
    email?: string;
    contactEmail?: string;
    phone?: string;
    contactPhone?: string;
    servicesNeeded?: string;
    expectedBusinessValue?: string;
    website?: string;
    linkedIn?: string;
    nextFollowUpDue?: string;
    priority?: string;
  },
  sourceText = '',
): ClientAiInsights {
  const text = `${sourceText} ${form.expectedBusinessValue || ''} ${form.servicesNeeded || ''}`.toLowerCase();
  const email = form.email || form.contactEmail || '';
  const phone = form.phone || form.contactPhone || '';
  let score = 0;

  if (/\b(budget|lakh|crore|₹|\$|usd|inr|value|revenue|deal|contract)\b/i.test(text) || String(form.expectedBusinessValue || '').trim()) {
    score += 20;
  }
  if (String(form.directorName || '').trim()) score += 20;
  if (String(form.nextFollowUpDue || '').trim() || /\b(next week|tomorrow|follow up|within \d+ days?)\b/i.test(text)) {
    score += 15;
  }
  if (String(form.website || '').trim() || String(form.linkedIn || '').trim()) score += 10;
  if (String(email).trim()) score += 15;
  if (String(phone).trim()) score += 10;
  if (String(form.servicesNeeded || '').trim()) score += 10;

  score = Math.min(100, score);
  const priority = score >= 70 ? 'High' : score >= 40 ? 'Medium' : 'Low';
  const service = String(form.servicesNeeded || '').trim() || 'recruitment services';

  return {
    score,
    priority,
    nextAction: service.toLowerCase().includes('ats') ? 'Schedule ATS onboarding call' : 'Schedule discovery call',
    followUpHint: String(form.nextFollowUpDue || '').trim()
      ? `Follow up on ${form.nextFollowUpDue}`
      : 'Contact within 3 business days',
    packageSuggestion: service.toLowerCase().includes('ats') ? 'ATS + bulk CV module' : `${service} package`,
  };
}
