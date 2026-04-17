export type PlacementStatus =
  | 'OFFER_ACCEPTED'
  | 'JOINING_SCHEDULED'
  | 'JOINED'
  | 'NO_SHOW'
  | 'WITHDRAWN'
  | 'FAILED'
  | 'REPLACEMENT_REQUIRED'
  | 'REPLACED';

export type EmploymentType = 'PERMANENT' | 'CONTRACT' | 'FREELANCE';

export type BillingPaymentStatus = 'PENDING' | 'PAID' | 'OVERDUE';

export interface PlacementBilling {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  amount: number;
  taxPercentage: number;
  taxAmount?: number | null;
  totalAmount: number;
  paymentStatus: BillingPaymentStatus;
  paymentDate?: string | null;
  paymentMethod?: string | null;
  createdAt: string;
}

export interface PlacementCommission {
  id: string;
  recruiterId: string;
  commissionPercentage: number;
  commissionAmount: number;
  paymentStatus: 'PENDING' | 'PAID';
  paymentDate?: string | null;
  createdAt: string;
  recruiter?: {
    id: string;
    name: string;
    email: string;
    avatar?: string | null;
  } | null;
}

export interface PlacementDocument {
  id: string;
  documentType: 'OFFER_LETTER' | 'JOINING_LETTER' | 'INVOICE' | 'AGREEMENT' | 'OTHER';
  fileUrl: string;
  fileName?: string | null;
  uploadedAt: string;
  uploader?: {
    id: string;
    name: string;
    email: string;
    avatar?: string | null;
  } | null;
}

export interface PlacementActivityLog {
  id: string;
  action: string;
  createdAt: string;
  details?: Record<string, any> | null;
  actor?: {
    id: string;
    name: string;
    email: string;
    avatar?: string | null;
  } | null;
}

export interface Placement {
  id: string;
  candidateId: string;
  jobId: string;
  clientId: string;
  recruiterId?: string | null;
  salaryOffered?: number | null;
  placementFee?: number | null;
  commissionPercentage?: number | null;
  revenue?: number | null;
  employmentType?: EmploymentType | null;
  offerDate?: string | null;
  joiningDate?: string | null;
  actualJoiningDate?: string | null;
  status: PlacementStatus;
  failureReason?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  paymentStatus?: BillingPaymentStatus;
  invoiceNumber?: string | null;
  offerLetterUrl?: string | null;
  candidate: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatar?: string | null;
  };
  job: {
    id: string;
    title: string;
  };
  client: {
    id: string;
    companyName: string;
  };
  recruiter?: {
    id: string;
    name: string;
    email: string;
    avatar?: string | null;
  } | null;
  billing?: PlacementBilling[];
  commission?: PlacementCommission[];
  documents?: PlacementDocument[];
  activityLog?: PlacementActivityLog[];
  billingRecords?: Array<{
    id: string;
    amount: number;
    currency: string;
    status: string;
    invoiceNumber?: string | null;
    invoiceDate?: string | null;
    dueDate?: string | null;
  }>;
}

export interface PlacementStats {
  totalPlacements: number;
  placementsThisMonth: number;
  joiningPending: number;
  joined: number;
  revenueGenerated: number;
}

export interface PlacementFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: PlacementStatus | '';
  companyId?: string;
  recruiterId?: string;
  employmentType?: EmploymentType | '';
  offerDateFrom?: string;
  offerDateTo?: string;
  joiningDateFrom?: string;
  joiningDateTo?: string;
  revenueMin?: string;
  revenueMax?: string;
  feeMin?: string;
  feeMax?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface CreatePlacementPayload {
  candidateId: string;
  jobId: string;
  companyId?: string;
  recruiterId?: string;
  offerSalary: number | string;
  placementFee: number | string;
  commissionPercentage: number | string;
  offerDate: string;
  expectedJoiningDate?: string;
  employmentType: EmploymentType;
  notes?: string;
}

export interface MarkJoinedPayload {
  actualJoiningDate: string;
  confirmationNote?: string;
}

export interface MarkFailedPayload {
  reason: string;
  notes?: string;
  status: 'FAILED' | 'NO_SHOW' | 'WITHDRAWN';
}

export interface RequestReplacementPayload {
  reason?: string;
  expectedReplacementDate?: string;
}
