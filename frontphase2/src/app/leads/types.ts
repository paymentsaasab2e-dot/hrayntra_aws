export type LeadStatus = 'New' | 'Contacted' | 'Qualified' | 'Converted' | 'Lost';
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
  source: LeadSource;
  contactPerson: string;
  email: string;
  phone: string;
  status: LeadStatus;
  assignedTo: {
    name: string;
    avatar: string;
  };
  lastFollowUp: string;
  nextFollowUp?: string;
  priority: Priority;
  interestedNeeds: string;
  notes: string;
  activities: Activity[];
  notesList?: LeadNote[];
  // Optional extended fields for drawer
  industry?: string;
  companySize?: string;
  website?: string;
  linkedIn?: string;
  location?: string;
  designation?: string;
  country?: string;
  city?: string;
  campaignName?: string;
  createdDate?: string;
}
