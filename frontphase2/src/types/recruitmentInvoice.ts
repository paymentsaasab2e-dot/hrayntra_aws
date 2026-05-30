export type InvoiceLineItem = {
  name: string;
  quantity: number;
  price: number;
  total: number;
};

export type InvoiceAdditionalCharge = {
  name: string;
  amount: number;
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
};
