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
  placementSummary?: {
    candidateName?: string;
    jobTitle?: string;
    clientName?: string;
    offerDate?: string | null;
    joiningDate?: string | null;
  };
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
};

export type CreatePlacementInvoicePayload = {
  invoiceNo?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  currency?: string;
  status?: 'DRAFT' | 'SENT';
  notes?: string;
  lineItems: InvoiceLineItem[];
  additionalCharges: InvoiceAdditionalCharge[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  buyer?: InvoicePartyDetails | null;
  seller?: InvoicePartyDetails | null;
};
