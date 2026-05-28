export type DefaultLeadStatus = 'New' | 'Contacted' | 'Qualified' | 'Converted' | 'Lost';
export type LeadStatus = DefaultLeadStatus | (string & {});
export type LeadType = 'Company' | 'Individual' | 'Referral';
export type LeadSource = 'Website' | 'LinkedIn' | 'Email' | 'Referral' | 'Campaign';
export type Priority = 'High' | 'Medium' | 'Low';

export interface Activity {
  id: string;
  type: 'Call' | 'Email' | 'Meeting' | 'Message';
  date: string;
  description: string;
  /** Optional for timeline card */
  title?: string;
  outcome?: string;
  duration?: string;
  notes?: string;
  user?: { name: string; avatar: string };
}

export type LeadNoteTag = 'HR' | 'Finance' | 'Contract' | 'Feedback';

export interface LeadNote {
  id: string;
  title: string;
  content?: string;
  tags: LeadNoteTag[];
  createdBy: { name: string; avatar?: string };
  createdAt: string;
  isPinned?: boolean;
}

export interface Lead {
  id: string;
  companyName: string;
  type: LeadType;
  source?: LeadSource | null;
  contactPerson: string;
  directorSalutation?: string;
  directorName?: string;
  email: string;
  phone: string;
  emails?: string[];
  phones?: string[];
  status: LeadStatus;
  assignedTo: {
    id?: string;
    name: string;
    avatar: string;
  };
  assignedToId?: string;
  /** Multi-assignee ids, includes the primary `assignedToId` as the first element. */
  assignedToIds?: string[];
  /** Resolved user records for multi-assignee display (matches `assignedToIds` order). */
  assignedToUsers?: Array<{
    id?: string;
    name: string;
    avatar: string;
    email?: string;
  }>;
  lastFollowUp: string;
  nextFollowUp?: string;
  priority: Priority;
  interestedNeeds: string;
  servicesNeeded?: string;
  notes: string;
  expectedBusinessValue?: string;
  activities: Activity[];
  notesList?: LeadNote[];
  // Optional extended fields for drawer
  industry?: string;
  sector?: string;
  companySize?: string;
  teamName?: string;
  website?: string;
  companyLinks?: string[];
  linkedIn?: string;
  location?: string;
  designation?: string;
  teamMemberDesignation?: string;
  teamMemberEmail?: string;
  teamMemberPhone?: string;
  country?: string;
  city?: string;
  state?: string;
  latitude?: number | null;
  longitude?: number | null;
  campaignName?: string;
  campaignLink?: string;
  referralName?: string;
  sourceWebsiteUrl?: string;
  sourceLinkedInUrl?: string;
  sourceEmail?: string;
  otherDetails?: Array<{ label: string; value: string }>;
  createdDate?: string;
  /** Agreements & Terms — single primary document uploaded against the lead. */
  agreementsFileName?: string | null;
  agreementsFileUrl?: string | null;
  agreementsUploadedAt?: string | null;
  agreementTotalPayment?: string | null;
  agreementLevel?: string | null;
  agreementServiceChargePercent?: string | null;
  agreementContractValidity?: string | null;
  agreementContractStartDate?: string | null;
  agreementContractEndDate?: string | null;
  agreementTimePeriod?: string | null;
  agreementAdvancePaymentPercent?: string | null;
  agreementFreeReplacementValue?: number | null;
  agreementFreeReplacementUnit?: 'MONTHS' | 'DAYS' | null;
}
