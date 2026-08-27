export type InvoiceLineItem = {
  name: string;
  quantity: number;
  price: number;
  total: number;
  /** Offer / monthly salary shown on SAASA-style templates. */
  monthlySalary?: number | null;
  /** Service / commission rate % shown on the invoice table. */
  ratePercent?: number | null;
  /** Values for custom template columns (keyed by column id). */
  extraValues?: Record<string, number | string | null>;
};

export type InvoiceAdditionalCharge = {
  name: string;
  amount: number;
};

/** Custom table column on an invoice template. */
export type InvoiceColumnFormula =
  | 'manual'
  | 'fixed'
  | 'percent_salary'
  | 'percent_fee'
  | 'text';

export type InvoiceCustomColumn = {
  id: string;
  name: string;
  formula: InvoiceColumnFormula;
  /** Percent or fixed amount default, depending on formula. */
  defaultValue?: number | string;
};

export type InvoiceTemplateBranding = {
  companyName?: string;
  accountHolderName?: string;
  iban?: string;
  bankAddress?: string;
  bankName?: string;
  accountNumber?: string;
  swiftCode?: string;
  authorizedSignatoryName?: string;
  authorizedSignatoryDesignation?: string;
  agencySignatureUrl?: string;
  agencyLogoUrl?: string;
  agencyStampUrl?: string;
  companyTagline?: string;
  companyLocationLine?: string;
  companyFooterLine?: string;
  companyWebsite?: string;
  showLogo?: boolean;
  showStamp?: boolean;
  showSignature?: boolean;
  defaultTermsAndConditions?: string;
  invoiceTemplateStyle?: 'saasa' | 'classic';
  invoicePrefix?: string;
  defaultCurrency?: string;
  defaultPaymentTerms?: string;
  taxLabel?: string;
  taxRate?: number;
};

export type InvoiceTemplate = InvoiceTemplateBranding & {
  id: string;
  name: string;
  customColumns?: InvoiceCustomColumn[];
  updatedAt?: string;
};

export type InvoicePartyDetails = {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
};

export type InvoiceBankDetails = {
  bankName: string;
  accountHolderName?: string;
  accountNumber: string;
  iban?: string;
  swiftCode: string;
  bankAddress?: string;
  currency?: string;
};

export type InvoiceSignatoryBlock = {
  label: string;
  name: string;
  designation?: string;
  signatureImageUrl?: string;
};

export type InvoiceLegalTerms = {
  agreementLevel?: string;
  serviceChargePercent?: number;
  commissionLabel?: string;
  contractStartDate?: string | null;
  contractEndDate?: string | null;
  contractValidity?: string | null;
  paymentTerms?: string;
  advancePaymentPercent?: number;
  freeReplacementText?: string;
  agreementValidNote?: string;
};

export type RecruitmentInvoiceData = {
  invoiceNo: string;
  invoiceDate: string;
  dueDate: string;
  placementId: string;
  currency: string;
  status: 'DRAFT' | 'SENT';
  seller: InvoicePartyDetails;
  buyer: InvoicePartyDetails;
  lineItems: InvoiceLineItem[];
  additionalCharges: InvoiceAdditionalCharge[];
  taxRate: number;
  subtotal: number;
  taxAmount: number;
  total: number;
  notes: string;
  /** Legal / agreement text shown under Terms & conditions on page 2 (not Notes). */
  termsAndConditions?: string;
  placementSummary?: {
    candidateName?: string;
    jobTitle?: string;
    clientName?: string;
    offerDate?: string | null;
    joiningDate?: string | null;
  };
  legalTerms?: InvoiceLegalTerms;
  sellerBank?: InvoiceBankDetails;
  buyerBank?: InvoiceBankDetails;
  clientSignatory?: InvoiceSignatoryBlock;
  agencySignatory?: InvoiceSignatoryBlock;
  /** Selected named template id when creating the invoice. */
  templateId?: string | null;
  /** Snapshot of custom columns used for this invoice. */
  customColumns?: InvoiceCustomColumn[];
};

export type BillingSettingsSnapshot = {
  invoicePrefix: string;
  defaultCurrency: string;
  defaultPaymentTerms: string;
  bankName: string;
  accountNumber: string;
  swiftCode: string;
  taxLabel: string;
  taxRate: number;
  companyName?: string;
  accountHolderName?: string;
  iban?: string;
  bankAddress?: string;
  authorizedSignatoryName?: string;
  authorizedSignatoryDesignation?: string;
  agencySignatureUrl?: string;
  agencyLogoUrl?: string;
  agencyStampUrl?: string;
  companyTagline?: string;
  companyLocationLine?: string;
  companyFooterLine?: string;
  companyWebsite?: string;
  showLogo?: boolean;
  showStamp?: boolean;
  showSignature?: boolean;
  defaultTermsAndConditions?: string;
  invoiceTemplateStyle?: 'saasa' | 'classic';
  /** Named saved templates (logo, stamp, firm text, custom columns). */
  invoiceTemplates?: InvoiceTemplate[];
  /** Currently edited / default template for new invoices. */
  activeInvoiceTemplateId?: string | null;
};

export type CreatePlacementInvoicePayload = {
  invoiceNo?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  currency?: string;
  status?: 'DRAFT' | 'SENT';
  notes?: string;
  termsAndConditions?: string;
  lineItems: InvoiceLineItem[];
  additionalCharges: InvoiceAdditionalCharge[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  buyer?: InvoicePartyDetails | null;
  seller?: InvoicePartyDetails | null;
  placementSummary?: RecruitmentInvoiceData['placementSummary'];
  legalTerms?: InvoiceLegalTerms;
  sellerBank?: InvoiceBankDetails;
  buyerBank?: InvoiceBankDetails;
  clientSignatory?: InvoiceSignatoryBlock;
  agencySignatory?: InvoiceSignatoryBlock;
  templateId?: string | null;
  customColumns?: InvoiceCustomColumn[];
};
