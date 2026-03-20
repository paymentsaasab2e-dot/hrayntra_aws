export type ClientStage = 'Active' | 'Prospect' | 'On Hold' | 'Inactive' | 'Hot Clients 🔥';
export type ClientPriority = 'Low' | 'Medium' | 'High';
export type ClientHealthStatus = 'Good' | 'Needs attention' | 'At risk';
export type ContactDepartment = 'HR' | 'Hiring' | 'Hiring Manager' | 'Finance' | 'Other';
export type PreferredChannel = 'Email' | 'Phone' | 'WhatsApp';
export type JobStatus = 'Open' | 'Paused' | 'Closed';
export type PipelineStageName = 'Applied' | 'Screened' | 'Interview' | 'Offer' | 'Joined';
export type PlacementStatus = 'Pending Invoice' | 'Invoiced' | 'Paid';
export type PlacementFeeType = 'Flat' | '%';
export type InvoiceStatus = 'Draft' | 'Sent' | 'Paid' | 'Overdue';

export interface ClientInvoice {
  id: string;
  invoiceNumber: string;
  date: string;
  amount: string;
  status: InvoiceStatus;
  dueDate: string;
}

export type ActivityFilterType = 'All' | 'Jobs' | 'Candidates' | 'Interviews' | 'Billing' | 'Notes' | 'Files';

export interface ClientActivityItem {
  id: string;
  /** Filter category for timeline filters */
  category: Exclude<ActivityFilterType, 'All'>;
  title: string;
  description?: string;
  user: { name: string; avatar?: string };
  timestamp: string;
  timestampFull?: string; // Full ISO timestamp for sorting
  relatedType?: 'job' | 'candidate' | 'invoice' | 'contact' | 'placement';
  relatedLabel?: string;
  relatedId?: string;
}

export interface ClientPlacement {
  id: string;
  candidateName: string;
  jobRole: string;
  placementDate: string;
  recruiter: string;
  feeType: PlacementFeeType;
  amount: string;
  warrantyDaysLeft: number;
  status: PlacementStatus;
}

export interface ClientPipelineCandidate {
  id: string;
  name: string;
  role?: string;
  jobTitle: string;
  jobId: string;
  currentStage: PipelineStageName;
  assignedRecruiter: string;
  nextActionDate: string;
  /** Profile image URL for pipeline card */
  avatar?: string;
  /** Match score 0–100 for display */
  matchScore?: number;
  /** Short status label e.g. "Scheduled", "Pending" */
  status?: string;
}

export interface ClientJob {
  id: string;
  title: string;
  department: string;
  location: string;
  hiringManager: string;
  openings: number;
  pipelineStages?: { stage: string; count: number }[];
  status: JobStatus;
  createdDate: string;
  isAging?: boolean;
}

export interface ClientContact {
  id: string;
  name: string;
  designation: string;
  department: ContactDepartment;
  email: string;
  phone: string;
  isPrimary: boolean;
  lastContacted: string;
  avatar?: string;
  preferredChannel?: PreferredChannel;
  notes?: string;
  activity?: { date: string; type: string; summary: string }[];
}

export type NoteTag = 'HR' | 'Finance' | 'Contract' | 'Feedback';

export interface ClientNote {
  id: string;
  title: string;
  content?: string;
  tags: NoteTag[];
  createdBy: { name: string; avatar?: string };
  createdAt: string;
  isPinned?: boolean;
}

export type ClientFileType = 'NDA' | 'Contract' | 'SLA' | 'Policy' | 'Invoice' | 'Job Brief';

export interface ClientFile {
  id: string;
  fileName: string;
  fileType: ClientFileType;
  uploadedBy: { name: string; avatar?: string };
  uploadDate: string;
}

export interface Client {
  id: string;
  name: string;
  industry: string;
  location: string;
  openJobs: number;
  activeCandidates: number;
  placements: number;
  stage: ClientStage;
  owner: { name: string; avatar: string };
  lastActivity: string;
  logo: string;
  revenue?: string;
  // Overview — Company Snapshot
  companySize?: string;
  hiringLocations?: string;
  website?: string;
  linkedin?: string;
  timezone?: string;
  clientSince?: string;
  // Relationship & Ownership
  recruiterTeam?: string[];
  priority?: ClientPriority;
  sla?: string;
  // Performance (can derive from existing + optional overrides)
  candidatesInProgress?: number;
  interviewsThisWeek?: number;
  placementsThisMonth?: number;
  revenueGenerated?: string;
  // Client Health
  nextFollowUpDue?: string;
  staleJobsCount?: number;
  pendingInvoicesCount?: number;
  avgTimeToFill?: string;
  healthStatus?: ClientHealthStatus;
  contacts?: ClientContact[];
  jobs?: ClientJob[];
  pipelineCandidates?: ClientPipelineCandidate[];
  placementList?: ClientPlacement[];
  // Billing (client-level finance)
  billingTotalRevenue?: string;
  billingOutstanding?: string;
  billingPaid?: string;
  billingOverdueCount?: number;
  invoiceList?: ClientInvoice[];
  activityList?: ClientActivityItem[];
  notesList?: ClientNote[];
  fileList?: ClientFile[];
}

export const INITIAL_CLIENTS: Client[] = [
  {
    id: '1',
    name: 'TechFlow Systems',
    industry: 'Software Engineering',
    location: 'San Francisco, CA',
    openJobs: 12,
    activeCandidates: 45,
    placements: 8,
    stage: 'Active',
    owner: { name: 'Alex Rivera', avatar: 'https://images.unsplash.com/photo-1622169804256-0eb6873ff441?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBoZWFkc2hvdCUyMG1hbiUyMGF2YXRhcnxlbnwxfHx8fDE3NzAzNjIzNTR8MA&ixlib=rb-4.1.0&q=80&w=1080' },
    lastActivity: '2 hours ago',
    logo: 'https://images.unsplash.com/photo-1760037028517-e5cc6e3ebd3e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhYnN0cmFjdCUyMHRlY2glMjBsb2dvJTIwaWNvbiUyMGJsdWV8ZW58MXx8fHwxNzcwMjY3NTQxfDA&ixlib=rb-4.1.0&q=80&w=1080',
    revenue: '$28.0k',
    companySize: '201-500',
    hiringLocations: 'San Francisco, Austin, Remote',
    website: 'https://techflow.io',
    linkedin: 'https://linkedin.com/company/techflow',
    timezone: 'PST (UTC-8)',
    clientSince: 'Jan 2024',
    recruiterTeam: ['Alex Rivera', 'Sarah Jenkins'],
    priority: 'High',
    sla: '48h response',
    candidatesInProgress: 45,
    interviewsThisWeek: 8,
    placementsThisMonth: 2,
    revenueGenerated: '$28.0k',
    nextFollowUpDue: 'Mar 10, 2026',
    staleJobsCount: 1,
    pendingInvoicesCount: 0,
    avgTimeToFill: '18 days',
    healthStatus: 'Good',
    contacts: [
      {
        id: 'c1',
        name: 'David Miller',
        designation: 'Head of Talent',
        department: 'HR',
        email: 'd.miller@techflow.io',
        phone: '+1 (555) 123-4567',
        isPrimary: true,
        lastContacted: '2 hours ago',
        avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
        preferredChannel: 'Email',
        notes: 'Prefers email for initial outreach. Available for calls Tue–Thu 2–4 PM PST.',
        activity: [
          { date: 'Mar 5, 2026', type: 'Call', summary: 'Discussed Q2 hiring plan' },
          { date: 'Mar 1, 2026', type: 'Email', summary: 'Sent role brief for Senior Dev' },
        ],
      },
      {
        id: 'c2',
        name: 'Sarah Chen',
        designation: 'Recruitment Lead',
        department: 'Hiring',
        email: 's.chen@techflow.io',
        phone: '+1 (555) 987-6543',
        isPrimary: false,
        lastContacted: 'Yesterday',
        preferredChannel: 'WhatsApp',
        notes: '',
        activity: [{ date: 'Mar 4, 2026', type: 'WhatsApp', summary: 'Quick sync on candidate shortlist' }],
      },
      {
        id: 'c3',
        name: 'James Wilson',
        designation: 'Finance Director',
        department: 'Finance',
        email: 'j.wilson@techflow.io',
        phone: '+1 (555) 456-7890',
        isPrimary: false,
        lastContacted: '1 week ago',
        preferredChannel: 'Phone',
        activity: [],
      },
    ],
    jobs: [
      {
        id: 'j1',
        title: 'Senior Software Engineer',
        department: 'Engineering',
        location: 'San Francisco, CA',
        hiringManager: 'David Miller',
        openings: 2,
        pipelineStages: [{ stage: 'Applied', count: 12 }, { stage: 'Screening', count: 5 }, { stage: 'Interview', count: 2 }],
        status: 'Open',
        createdDate: 'Feb 15, 2026',
        isAging: true,
      },
      {
        id: 'j2',
        title: 'Product Manager',
        department: 'Product',
        location: 'Remote',
        hiringManager: 'Sarah Chen',
        openings: 1,
        pipelineStages: [{ stage: 'Applied', count: 8 }, { stage: 'Screening', count: 3 }],
        status: 'Open',
        createdDate: 'Mar 1, 2026',
      },
      {
        id: 'j3',
        title: 'DevOps Engineer',
        department: 'Engineering',
        location: 'Austin, TX',
        hiringManager: 'David Miller',
        openings: 1,
        pipelineStages: [{ stage: 'Applied', count: 6 }, { stage: 'Offer', count: 1 }],
        status: 'Paused',
        createdDate: 'Jan 20, 2026',
      },
      {
        id: 'j4',
        title: 'UX Designer',
        department: 'Design',
        location: 'San Francisco, CA',
        hiringManager: 'Sarah Chen',
        openings: 2,
        pipelineStages: [],
        status: 'Closed',
        createdDate: 'Dec 10, 2025',
      },
    ],
    pipelineCandidates: [
      { id: 'pc1', name: 'Emma Wilson', role: 'Software Engineer', jobTitle: 'Senior Software Engineer', jobId: 'j1', currentStage: 'Applied', assignedRecruiter: 'Alex Rivera', nextActionDate: 'Mar 8, 2026', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop&crop=face', matchScore: 92, status: 'New' },
      { id: 'pc2', name: 'Ryan Cox', jobTitle: 'Senior Software Engineer', jobId: 'j1', currentStage: 'Applied', assignedRecruiter: 'Sarah Jenkins', nextActionDate: 'Mar 7, 2026', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&crop=face', matchScore: 88, status: 'Pending' },
      { id: 'pc3', name: 'Priya Sharma', role: 'PM', jobTitle: 'Product Manager', jobId: 'j2', currentStage: 'Screened', assignedRecruiter: 'Alex Rivera', nextActionDate: 'Mar 10, 2026', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&h=80&fit=crop&crop=face', matchScore: 95, status: 'Screened' },
      { id: 'pc4', name: 'James Lee', jobTitle: 'Senior Software Engineer', jobId: 'j1', currentStage: 'Screened', assignedRecruiter: 'Sarah Jenkins', nextActionDate: 'Mar 9, 2026', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&h=80&fit=crop&crop=face', matchScore: 78, status: 'Shortlist' },
      { id: 'pc5', name: 'Maria Garcia', jobTitle: 'Product Manager', jobId: 'j2', currentStage: 'Interview', assignedRecruiter: 'Alex Rivera', nextActionDate: 'Mar 12, 2026', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=80&h=80&fit=crop&crop=face', matchScore: 90, status: 'Scheduled' },
      { id: 'pc6', name: 'David Kim', jobTitle: 'DevOps Engineer', jobId: 'j3', currentStage: 'Interview', assignedRecruiter: 'Sarah Jenkins', nextActionDate: 'Mar 11, 2026', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop&crop=face', matchScore: 85, status: 'Feedback' },
      { id: 'pc7', name: 'Anna Bell', jobTitle: 'Senior Software Engineer', jobId: 'j1', currentStage: 'Offer', assignedRecruiter: 'Alex Rivera', nextActionDate: 'Mar 15, 2026', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&h=80&fit=crop&crop=face', matchScore: 94, status: 'Offer sent' },
      { id: 'pc8', name: 'Chris Taylor', jobTitle: 'UX Designer', jobId: 'j4', currentStage: 'Joined', assignedRecruiter: 'Sarah Jenkins', nextActionDate: '—', avatar: 'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=80&h=80&fit=crop&crop=face', matchScore: 91, status: 'Onboarded' },
    ],
    placementList: [
      { id: 'pl1', candidateName: 'Chris Taylor', jobRole: 'UX Designer', placementDate: 'Mar 1, 2026', recruiter: 'Sarah Jenkins', feeType: 'Flat', amount: '$4,500', warrantyDaysLeft: 85, status: 'Paid' },
      { id: 'pl2', candidateName: 'Lisa Park', jobRole: 'Senior Software Engineer', placementDate: 'Feb 28, 2026', recruiter: 'Alex Rivera', feeType: '%', amount: '18%', warrantyDaysLeft: 82, status: 'Invoiced' },
      { id: 'pl3', candidateName: 'Michael Torres', jobRole: 'Product Manager', placementDate: 'Feb 20, 2026', recruiter: 'Sarah Jenkins', feeType: 'Flat', amount: '$5,200', warrantyDaysLeft: 74, status: 'Paid' },
      { id: 'pl4', candidateName: 'Jennifer Walsh', jobRole: 'DevOps Engineer', placementDate: 'Feb 15, 2026', recruiter: 'Alex Rivera', feeType: 'Flat', amount: '$4,800', warrantyDaysLeft: 69, status: 'Pending Invoice' },
      { id: 'pl5', candidateName: 'Daniel Brown', jobRole: 'Senior Software Engineer', placementDate: 'Feb 10, 2026', recruiter: 'Sarah Jenkins', feeType: '%', amount: '20%', warrantyDaysLeft: 64, status: 'Paid' },
    ],
    billingTotalRevenue: '$28.0k',
    billingOutstanding: '$9.7k',
    billingPaid: '$18.3k',
    billingOverdueCount: 1,
    invoiceList: [
      { id: 'inv1', invoiceNumber: 'INV-2026-001', date: 'Mar 1, 2026', amount: '$4,500', status: 'Paid', dueDate: 'Mar 31, 2026' },
      { id: 'inv2', invoiceNumber: 'INV-2026-002', date: 'Feb 28, 2026', amount: '$5,200', status: 'Sent', dueDate: 'Mar 28, 2026' },
      { id: 'inv3', invoiceNumber: 'INV-2026-003', date: 'Feb 15, 2026', amount: '$4,800', status: 'Overdue', dueDate: 'Mar 15, 2026' },
      { id: 'inv4', invoiceNumber: 'INV-2026-004', date: 'Feb 10, 2026', amount: '$3,800', status: 'Paid', dueDate: 'Mar 10, 2026' },
      { id: 'inv5', invoiceNumber: 'INV-2026-005', date: 'Mar 5, 2026', amount: '$2,100', status: 'Draft', dueDate: 'Apr 5, 2026' },
    ],
    activityList: [
      { id: 'act1', category: 'Jobs', title: 'Job created', description: 'Senior Software Engineer role opened in Engineering.', user: { name: 'Alex Rivera', avatar: 'https://images.unsplash.com/photo-1622169804256-0eb6873ff441?w=80&h=80&fit=crop&crop=face' }, timestamp: 'Mar 5, 2026, 10:30 AM', relatedType: 'job', relatedLabel: 'Senior Software Engineer', relatedId: 'j1' },
      { id: 'act2', category: 'Candidates', title: 'Candidate submitted', description: 'Emma Wilson submitted for Senior Software Engineer.', user: { name: 'Sarah Jenkins', avatar: 'https://images.unsplash.com/photo-1589220286904-3dcef62c68ee?w=80&h=80&fit=crop&crop=face' }, timestamp: 'Mar 5, 2026, 9:15 AM', relatedType: 'candidate', relatedLabel: 'Emma Wilson', relatedId: 'pc1' },
      { id: 'act3', category: 'Interviews', title: 'Interview scheduled', description: 'Technical round with Maria Garcia for Product Manager.', user: { name: 'Alex Rivera', avatar: 'https://images.unsplash.com/photo-1622169804256-0eb6873ff441?w=80&h=80&fit=crop&crop=face' }, timestamp: 'Mar 4, 2026, 3:00 PM', relatedType: 'candidate', relatedLabel: 'Maria Garcia', relatedId: 'pc5' },
      { id: 'act4', category: 'Billing', title: 'Payment received', description: 'Invoice INV-2026-001 marked as paid.', user: { name: 'Sarah Jenkins', avatar: 'https://images.unsplash.com/photo-1589220286904-3dcef62c68ee?w=80&h=80&fit=crop&crop=face' }, timestamp: 'Mar 4, 2026, 11:00 AM', relatedType: 'invoice', relatedLabel: 'INV-2026-001', relatedId: 'inv1' },
      { id: 'act5', category: 'Jobs', title: 'Job paused', description: 'DevOps Engineer role temporarily paused.', user: { name: 'Alex Rivera', avatar: 'https://images.unsplash.com/photo-1622169804256-0eb6873ff441?w=80&h=80&fit=crop&crop=face' }, timestamp: 'Mar 3, 2026, 2:45 PM', relatedType: 'job', relatedLabel: 'DevOps Engineer', relatedId: 'j3' },
      { id: 'act6', category: 'Candidates', title: 'Placement completed', description: 'Chris Taylor joined as UX Designer.', user: { name: 'Sarah Jenkins', avatar: 'https://images.unsplash.com/photo-1589220286904-3dcef62c68ee?w=80&h=80&fit=crop&crop=face' }, timestamp: 'Mar 1, 2026, 4:20 PM', relatedType: 'placement', relatedLabel: 'Chris Taylor · UX Designer', relatedId: 'pl1' },
      { id: 'act7', category: 'Billing', title: 'Invoice generated', description: 'New invoice INV-2026-002 for $5,200.', user: { name: 'Alex Rivera', avatar: 'https://images.unsplash.com/photo-1622169804256-0eb6873ff441?w=80&h=80&fit=crop&crop=face' }, timestamp: 'Feb 28, 2026, 10:00 AM', relatedType: 'invoice', relatedLabel: 'INV-2026-002', relatedId: 'inv2' },
      { id: 'act8', category: 'Notes', title: 'Note added', description: 'Q2 hiring plan discussed; 3 roles to open in April.', user: { name: 'David Miller' }, timestamp: 'Feb 27, 2026, 5:30 PM', relatedType: 'contact', relatedLabel: 'David Miller', relatedId: 'c1' },
      { id: 'act9', category: 'Interviews', title: 'Interview rescheduled', description: 'Priya Sharma — Product Manager interview moved to Mar 10.', user: { name: 'Sarah Jenkins', avatar: 'https://images.unsplash.com/photo-1589220286904-3dcef62c68ee?w=80&h=80&fit=crop&crop=face' }, timestamp: 'Feb 26, 2026, 9:00 AM', relatedType: 'candidate', relatedLabel: 'Priya Sharma', relatedId: 'pc3' },
      { id: 'act10', category: 'Files', title: 'File uploaded', description: 'JD document attached to Senior Software Engineer.', user: { name: 'Alex Rivera', avatar: 'https://images.unsplash.com/photo-1622169804256-0eb6873ff441?w=80&h=80&fit=crop&crop=face' }, timestamp: 'Feb 25, 2026, 2:00 PM', relatedType: 'job', relatedLabel: 'Senior Software Engineer', relatedId: 'j1' },
    ],
    notesList: [
      { id: 'n1', title: 'Q2 hiring plan discussion', content: 'Agreed on 3 roles to open in April. Budget approved.', tags: ['HR'], createdBy: { name: 'Alex Rivera', avatar: 'https://images.unsplash.com/photo-1622169804256-0eb6873ff441?w=80&h=80&fit=crop&crop=face' }, createdAt: 'Mar 5, 2026, 10:30 AM', isPinned: true },
      { id: 'n2', title: 'Payment terms for placement fees', content: 'Net 30. Flat fee for senior roles, % for others.', tags: ['Finance', 'Contract'], createdBy: { name: 'Sarah Jenkins', avatar: 'https://images.unsplash.com/photo-1589220286904-3dcef62c68ee?w=80&h=80&fit=crop&crop=face' }, createdAt: 'Mar 4, 2026, 2:00 PM', isPinned: false },
      { id: 'n3', title: 'Feedback on last 3 candidates', content: 'Tech lead liked Emma and James. Ryan deferred.', tags: ['Feedback', 'HR'], createdBy: { name: 'David Miller' }, createdAt: 'Mar 3, 2026, 5:00 PM', isPinned: true },
      { id: 'n4', title: 'MSA renewal reminder', content: 'Master service agreement expires June 2026.', tags: ['Contract', 'Finance'], createdBy: { name: 'Alex Rivera', avatar: 'https://images.unsplash.com/photo-1622169804256-0eb6873ff441?w=80&h=80&fit=crop&crop=face' }, createdAt: 'Mar 1, 2026, 9:00 AM', isPinned: false },
    ],
    fileList: [
      { id: 'f1', fileName: 'TechFlow_MSA_2026.pdf', fileType: 'Contract', uploadedBy: { name: 'Alex Rivera', avatar: 'https://images.unsplash.com/photo-1622169804256-0eb6873ff441?w=80&h=80&fit=crop&crop=face' }, uploadDate: 'Mar 1, 2026' },
      { id: 'f2', fileName: 'NDA_signed.pdf', fileType: 'NDA', uploadedBy: { name: 'Sarah Jenkins', avatar: 'https://images.unsplash.com/photo-1589220286904-3dcef62c68ee?w=80&h=80&fit=crop&crop=face' }, uploadDate: 'Feb 28, 2026' },
      { id: 'f3', fileName: 'Recruitment_SLA_2026.pdf', fileType: 'SLA', uploadedBy: { name: 'Alex Rivera', avatar: 'https://images.unsplash.com/photo-1622169804256-0eb6873ff441?w=80&h=80&fit=crop&crop=face' }, uploadDate: 'Feb 25, 2026' },
      { id: 'f4', fileName: 'INV-2026-001.pdf', fileType: 'Invoice', uploadedBy: { name: 'Sarah Jenkins', avatar: 'https://images.unsplash.com/photo-1589220286904-3dcef62c68ee?w=80&h=80&fit=crop&crop=face' }, uploadDate: 'Mar 2, 2026' },
      { id: 'f5', fileName: 'Senior_Software_Engineer_JD.pdf', fileType: 'Job Brief', uploadedBy: { name: 'Alex Rivera', avatar: 'https://images.unsplash.com/photo-1622169804256-0eb6873ff441?w=80&h=80&fit=crop&crop=face' }, uploadDate: 'Feb 15, 2026' },
      { id: 'f6', fileName: 'Company_Privacy_Policy.pdf', fileType: 'Policy', uploadedBy: { name: 'David Miller' }, uploadDate: 'Feb 10, 2026' },
    ],
  },
  {
    id: '2',
    name: 'Stripe Payments',
    industry: 'Fintech',
    location: 'Dublin, IE',
    openJobs: 5,
    activeCandidates: 18,
    placements: 3,
    stage: 'Prospect',
    owner: { name: 'Sarah Jenkins', avatar: 'https://images.unsplash.com/photo-1589220286904-3dcef62c68ee?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBoZWFkc2hvdCUyMHdvbWFuJTIwYXZhdGFyfGVufDF8fHx8MTc3MDM2MjM1NHww&ixlib=rb-4.1.0&q=80&w=1080' },
    lastActivity: 'Yesterday',
    logo: 'https://images.unsplash.com/photo-1643299397136-a6cf89431e19?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb21wYW55JTIwbG9nbyUyMGljb24lMjB0ZWNoJTIwc3RhcnR1cHxlbnwxfHx8fDE3NzAzNzMxNDF8MA&ixlib=rb-4.1.0&q=80&w=1080',
    revenue: '$10.5k',
  },
  {
    id: '3',
    name: 'GreenEnergy Co.',
    industry: 'Renewables',
    location: 'Austin, TX',
    openJobs: 8,
    activeCandidates: 22,
    placements: 5,
    stage: 'On Hold',
    owner: { name: 'Alex Rivera', avatar: 'https://images.unsplash.com/photo-1622169804256-0eb6873ff441?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBoZWFkc2hvdCUyMG1hbiUyMGF2YXRhcnxlbnwxfHx8fDE3NzAzNjIzNTR8MA&ixlib=rb-4.1.0&q=80&w=1080' },
    lastActivity: '3 days ago',
    logo: 'https://images.unsplash.com/photo-1760037035212-216095656f71?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBjb3Jwb3JhdGUlMjBsb2dvJTIwZGVzaWduJTIwdGVjaHxlbnwxfHx8fDE3NzAzNzMxNDZ8MA&ixlib=rb-4.1.0&q=80&w=1080',
    revenue: '$17.5k',
  },
  {
    id: '4',
    name: 'Designers Inc.',
    industry: 'Creative Agency',
    location: 'London, UK',
    openJobs: 3,
    activeCandidates: 12,
    placements: 12,
    stage: 'Active',
    owner: { name: 'Michael Chen', avatar: 'https://images.unsplash.com/photo-1629507208649-70919ca33793?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBwb3J0cmFpdCUyMG1hbiUymJ1c2luZXNzfGVufDF8fHx8MTc3MDM1NDM1MHww&ixlib=rb-4.1.0&q=80&w=1080' },
    lastActivity: '1 hour ago',
    logo: 'https://images.unsplash.com/photo-1581065178047-8ee15951ede6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBwb3J0cmFpdCUyMHdvbWFuJTIwYnVzaW5lc3N8ZW58MXx8fHwxNzcwMzI1ODIyfDA&ixlib=rb-4.1.0&q=80&w=1080',
    revenue: '$42.0k',
  },
  {
    id: '5',
    name: 'BioGen Lab',
    industry: 'Healthcare',
    location: 'Boston, MA',
    openJobs: 15,
    activeCandidates: 60,
    placements: 2,
    stage: 'Active',
    owner: { name: 'Sarah Jenkins', avatar: 'https://images.unsplash.com/photo-1589220286904-3dcef62c68ee?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBoZWFkc2hvdCUyMHdvbWFuJTIwYXZhdGFyfGVufDF8fHx8MTc3MDM2MjM1NHww&ixlib=rb-4.1.0&q=80&w=1080' },
    lastActivity: 'Just now',
    logo: 'https://images.unsplash.com/photo-1760037028517-e5cc6e3ebd3e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhYnN0cmFjdCUyMHRlY2glMjBsb2dvJTIwaWNvbiUyMGJsdWV8ZW58MXx8fHwxNzcwMjY3NTQxfDA&ixlib=rb-4.1.0&q=80&w=1080',
    revenue: '$7.0k',
  },
];
