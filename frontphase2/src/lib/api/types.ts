/* API type re-exports and local type declarations */
import type {
  BillingSettingsSnapshot,
  CreatePlacementInvoicePayload,
} from '../../types/recruitmentInvoice';
import type {
  CreatePlacementPayload,
  MarkFailedPayload,
  MarkJoinedPayload,
  PaginatedResponse as PlacementPaginatedResponse,
  Placement,
  PlacementFilters,
  PlacementStats,
  RequestReplacementPayload,
  ScheduleJoiningPayload,
} from '../../types/placement';
export type { PlacementPaginatedResponse };
import type { PostServiceKycFormValues } from '../clientKycForm';
import type { InterviewClientReviewContext } from '../clientReviewTypes';

export type { BillingSettingsSnapshot, CreatePlacementInvoicePayload };

export type OrgPlanUsageCache = {
  activeJobs: number;
  activeUsers: number;
  maxJobs: number | null;
  maxUsers: number | null;
};

export interface HqSubscriptionPackage {
  id: string;
  slug: string;
  name: string;
  displayName?: string;
  description: string;
  price?: string;
  yearlyPrice?: string;
  pricePeriod?: string;
  features?: string[];
  isPopular?: boolean;
  maxUsers: number | null;
  maxJobs: number | null;
  annualMaxUsers?: number | null;
  annualMaxJobs?: number | null;
  isSystem: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export type SubscriptionPlanOption = HqSubscriptionPackage;

export interface HqTenantSubscriptionPlan {
  id?: string;
  name: string;
  billingCycle?: 'monthly' | 'annual';
  maxUsers?: number | null;
  maxJobs?: number | null;
  planStartDate?: string;
  planEndDate?: string;
  isTrial?: boolean;
  trialDays?: number;
  upgradedAt?: string;
  upgradedFrom?: string;
  lastPaymentReference?: string;
  purchasedAt?: string;
  employerDemoRequestId?: string;
  upgradedBy?: string;
  coins?: number;
  price?: string;
}

export type SubscriptionPaymentOrder = {
  mode?: 'clone' | 'live';
  orderId: string;
  amount: number;
  amountPaise: number;
  amountInr?: string;
  currency: string;
  keyId?: string;
  merchantName: string;
  merchantUpi: string;
  packageName: string;
  billingCycle: 'monthly' | 'annual';
  packageId: string;
  description: string;
  upiPayLink?: string;
};

export type IndustrySuggestionSource = 'history' | 'catalog' | 'ai';

export interface IndustrySuggestion {
  label: string;
  source: IndustrySuggestionSource;
}

export type LanguageSuggestionSource = 'history' | 'catalog' | 'ai';

export interface LanguageSuggestion {
  label: string;
  source: LanguageSuggestionSource;
}

export type CompanyServiceSuggestionSource = 'history' | 'catalog' | 'ai';

export interface CompanyServiceSuggestion {
  label: string;
  source: CompanyServiceSuggestionSource;
}

export interface StatusCatalogResponse {
  statuses: string[];
  defaults?: string[];
  custom?: string[];
}

export interface HqTenantRow {
  id: string;
  name: string;
  email: string;
  loginId: string;
  organizationType: 'agency' | 'standalone';
  organizationName?: string;
  signupSource?: 'landing_purchase' | 'landing_trial' | 'hq_manual' | string;
  productLine?: 'crm' | 'recruitment' | string;
  enabledModules?: string[];
  modulesRestricted?: boolean;
  /** When false, Phase 2 All candidates hides Phase 1 common pool. Default true. */
  phase1CommonPoolEnabled?: boolean;
  subscriptionPlan: HqTenantSubscriptionPlan | null;
  tenantDbName: string;
  tenantProvisioningMode: string;
  /** Public jobs integration key. Give this to the tenant so they can pull their posted jobs. */
  jobsApiKey?: string;
  jobsApiKeyIssuedAt?: string | null;
  jobsApiUrl?: string;
  status?: string;
  pausedAt?: string | null;
  pausedBy?: string;
  createdAt: string | null;
  updatedAt: string | null;
  isLandingSignupOnly?: boolean;
  isDeleted?: boolean;
  deletedAt?: string | null;
  deletedBy?: string;
  source?: 'tenant' | 'landing' | string;
}

export type HqAccountSupportLookup = {
  exists: boolean;
  accountKind?: 'employer' | 'employee' | string;
  email?: string | null;
  loginId?: string | null;
  name?: string | null;
  organizationName?: string | null;
  customerId?: string | null;
  tenantDbName?: string | null;
  status?: string | null;
  signupSource?: string | null;
  createdAt?: string | null;
  accountExists?: boolean;
  passwordGenerated?: boolean;
  tempPasswordPending?: boolean;
  hasLoggedInToCrm?: boolean;
  hasLoggedInToPortal?: boolean;
  lastLoginAt?: string | null;
  inviteSentAt?: string | null;
  crmUserExists?: boolean;
  loginUrl?: string | null;
  relatedTickets?: Array<{
    id: string;
    subject: string;
    status: string;
    priority?: string;
    raisedByEmail?: string;
    tenantDbName?: string;
    createdAt?: string;
    audience?: 'employer' | 'employee';
  }>;
  ticketCount?: number;
  tenantStatusError?: string | null;
  query?: { email?: string | null; customerId?: string | null };
  employer?: HqAccountSupportLookup | null;
  employee?: {
    exists?: boolean;
    candidateId?: string;
    email?: string | null;
    name?: string | null;
    status?: string | null;
    isVerified?: boolean;
    passwordGenerated?: boolean;
    hasLoggedInToPortal?: boolean;
    lastLoginAt?: string | null;
    createdAt?: string | null;
    portalFrontendUrl?: string;
    relatedTickets?: HqAccountSupportLookup['relatedTickets'];
    ticketCount?: number;
  } | null;
};

export type HqTenantImpersonationAccess = {
  token: string;
  loginUrl: string;
  expiresAt: string;
  loginId: string;
  tenantEmail: string;
  tenantDbName: string;
  tenantName: string;
};

export type HqLeadStorageInfo = {
  engine: string;
  database: string;
  collection: string;
};

export type HqLeadStats = {
  total: number;
  newLeads: number;
  followUpsToday: number;
  converted: number;
  lost: number;
  conversionRate: number;
};

export type HqDemoStats = {
  total: number;
  verified: number;
  pending: number;
  expired: number;
  trials?: number;
  trialsLive?: number;
  purchases?: number;
  purchasesLive?: number;
};

export type HqDemoRequestApiRow = {
  id: string;
  fullName: string;
  email: string;
  organizationName: string;
  countryCode: string;
  dialCode: string;
  phoneNumber: string;
  companySize: string;
  outcome: string;
  requestKind?: 'demo' | 'trial' | 'purchase';
  packageSlug?: string;
  packageName?: string;
  billingCycle?: string;
  trialProvisioned?: boolean;
  trialTenantDbName?: string;
  trialLoginId?: string;
  trialDays?: number | null;
  trialStartsAt?: string | null;
  trialEndsAt?: string | null;
  trialLoginUrl?: string;
  credentialsSentAt?: string | null;
  status: 'PENDING' | 'VERIFIED' | 'EXPIRED';
  emailVerifiedAt: string | null;
  createdAt: string | null;
  submittedAt: string;
};

export type HqLeadApiRow = {
  id: string;
  name: string;
  company: string;
  industry: string;
  score: 'Hot' | 'Warm' | 'Cold';
  users: number;
  owner: string;
  stage: 'new' | 'demo' | 'trial' | 'contacted' | 'qualified' | 'converted' | 'lost';
  updatedAt?: string | null;
  closedAt?: string | null;
  nextFollowUp: string;
  nextFollowUpAt?: string | null;
  email?: string;
  phone?: string;
  country?: string;
  state?: string;
  city?: string;
  estimatedDealValue?: number;
  leadSource?: string;
  leadSourceDetail?: string;
  interestedModules?: string[];
  initialNotes?: string;
  createdAt?: string | null;
  followUps?: HqLeadFollowUp[];
  remarks?: HqLeadRemark[];
  convertedToCompanyId?: string | null;
  contactPerson?: string;
  directorName?: string;
  directorSalutation?: string | null;
  emails?: string[];
  phones?: string[];
  type?: string;
  source?: string | null;
  status?: string;
  priority?: string;
  website?: string | null;
  companyLinks?: string[];
  linkedIn?: string | null;
  location?: string | null;
  designation?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  campaignName?: string | null;
  campaignLink?: string | null;
  referralName?: string | null;
  sourceWebsiteUrl?: string | null;
  sourceLinkedInUrl?: string | null;
  sourceEmail?: string | null;
  sourceOther?: string | null;
  teamMemberDesignation?: string | null;
  teamMemberEmail?: string | null;
  teamMemberPhone?: string | null;
  otherDetails?: Array<{ label: string; value: string }>;
  interestedNeeds?: string | null;
  servicesNeeded?: string | null;
  expectedBusinessValue?: string | null;
  notes?: string | null;
  assignedToId?: string | null;
  assignedToIds?: string[];
  assignedToUsers?: Array<{
    id: string;
    name: string;
    email?: string;
    role?: string;
    roleId?: string | null;
  }>;
  formSchema?: string | null;
  hqProductLine?: string | null;
  hqProductLines?: string[];
  employerDemoRequestId?: string | null;
  preferredDemoDate?: string | null;
  preferredDemoTime?: string | null;
};

export type HqLeadFollowUp = {
  id: string;
  type: string;
  scheduledAt: string | null;
  notes: string;
  status: string;
  createdAt: string | null;
  createdByEmail?: string | null;
  completedAt?: string | null;
};

export type HqLeadRemark = {
  id: string;
  text: string;
  createdAt: string | null;
  createdByEmail?: string | null;
};

export type HqCompanyApiRow = {
  id: string;
  name: string;
  contact: string;
  industry: string;
  score: 'Hot' | 'Warm' | 'Cold';
  users: number;
  owner: string;
  status: 'active' | 'inactive' | 'on_hold' | 'closed';
  nextFollowUp: string;
  nextFollowUpAt?: string | null;
  email?: string;
  phone?: string;
  website?: string;
  logo?: string | null;
  country?: string;
  state?: string;
  city?: string;
  estimatedDealValue?: number;
  companySource?: string;
  interestedModules?: string[];
  initialNotes?: string;
  createdAt?: string | null;
  followUps?: HqLeadFollowUp[];
  remarks?: HqLeadRemark[];
  directorName?: string;
  directorSalutation?: string | null;
  emails?: string[];
  phones?: string[];
  companySize?: string;
  location?: string;
  hiringLocations?: string;
  servicesNeeded?: string;
  expectedBusinessValue?: string;
  linkedin?: string;
  timezone?: string;
  priority?: string;
  sla?: string;
  leadStatus?: string;
  latitude?: number | null;
  longitude?: number | null;
  teamMemberDesignation?: string | null;
  teamMemberEmail?: string | null;
  teamMemberPhone?: string | null;
  otherDetails?: Array<{ label: string; value: string }>;
  assignedToId?: string | null;
  formSchema?: string | null;
  convertedFromLeadId?: string | null;
  companyTag?: string | null;
  hqProductLine?: string | null;
  tenantDbName?: string | null;
  tenantAdminEmail?: string | null;
  tenantProvisionedAt?: string | null;
};

export type HqCompanyStats = {
  total: number;
  active: number;
  inactive: number;
  onHold: number;
  closed: number;
  followUpsToday: number;
};

export type HqSupportTicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export type HqSupportTicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export type HqSupportTicketCategory = 'general' | 'billing' | 'technical' | 'account' | 'feature';

export type HqSupportTicket = {
  id: string;
  ticketNumber?: string;
  subject: string;
  description: string;
  priority: HqSupportTicketPriority;
  status: HqSupportTicketStatus;
  category: HqSupportTicketCategory;
  tenantDbName: string;
  organizationName: string;
  raisedByUserId: string;
  raisedByName: string;
  raisedByEmail: string;
  hqNotes: string;
  createdAt: string | null;
  updatedAt: string | null;
};

export type HqSupportTicketMessage = {
  id: string;
  ticketId: string;
  senderRole: 'employer' | 'hq';
  senderName: string;
  senderId?: string | null;
  body: string;
  createdAt: string | null;
};

export type HqSupportTicketStats = {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
  highPriority: number;
};

export type HqHelpTicketStatus = 'open' | 'in_progress' | 'closed';

export type HqHelpTicket = {
  id: string;
  createdAt: string;
  name: string;
  email: string;
  category: string;
  subject: string;
  description: string;
  problemId?: string | null;
  userId?: string | null;
  status: HqHelpTicketStatus;
  source?: string;
  meta?: Record<string, unknown> | null;
};

export type HqHelpTicketStats = {
  total: number;
  open: number;
  inProgress: number;
  closed: number;
};

export type HqHelpTicketMessage = {
  id: string;
  ticketId: string;
  senderRole: 'candidate' | 'hq';
  senderName?: string;
  senderId?: string | null;
  body: string;
  createdAt: string;
};

export type HqTeamMemberStatus = 'active' | 'inactive';

export type HqTeamMemberRow = {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email: string;
  role: string;
  roleId?: string;
  roleColor?: string;
  permissionIds?: string[];
  phone: string;
  designation?: string;
  status: HqTeamMemberStatus;
  department: string;
  /** 1 = top of hierarchy */
  rank?: number;
  reportsToId?: string;
  reportsToName?: string;
  loginId?: string;
  loginPassword?: string;
  hasCredentials?: boolean;
  createdAt: string | null;
  updatedAt?: string | null;
};

export type HqTeamStats = {
  total: number;
  active: number;
  inactive: number;
};

export type HqRoleRow = {
  id: string;
  roleName: string;
  description: string;
  color: string;
  permissionIds: string[];
  isSystem?: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type HqPermissionRow = {
  id: string;
  permissionName: string;
  module: string;
  description: string;
};

export type HqPortalCandidateRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  title: string;
  location: string;
  status: string;
  source: string;
  stage: string;
  tenantDbName: string;
  updatedAt: string | null;
  createdAt: string | null;
  origin: 'phase1_portal' | 'phase1_common' | 'phase2_crm';
  personId?: string;
  kycVerified?: boolean;
  isInterviewer?: boolean;
};

export type HqPortalJobRow = {
  id: string;
  title: string;
  company: string;
  /** Real client name, always visible inside HQ even when hidden on Phase 1. */
  clientName?: string;
  /** Whether the client name is shown on the Phase 1 job cards / job pages. */
  showClientNamePublicly?: boolean;
  /** True when HQ has locked the client name hidden — tenant edits cannot re-expose it. */
  hqHideClientName?: boolean;
  location: string;
  status: string;
  workMode: string;
  tenantDbName: string;
  postedBy: string;
  openings: number;
  visibility: string;
  origin: 'phase1_portal' | 'phase2_crm';
  updatedAt: string | null;
  postedDate: string | null;
};

export type HqPortalStats = {
  totalCandidates: number;
  portalCandidates: number;
  commonCandidates: number;
  phase2Candidates: number;
  totalJobs: number;
  phase2Jobs: number;
  tenantJobs: number;
  portalOnlyJobs: number;
  tenantCount: number;
};

export type HqPortalStorageInfo = {
  portal: {
    engine: string;
    database: string;
    collections: { candidates: string; jobs: string };
  };
  common: {
    engine: string;
    database: string;
    collection: string;
  } | null;
  phase2: {
    engine: string;
    tenantDatabases: string[];
  };
};

export type HqKycInterviewerRow = {
  id: string;
  applicationId?: string | null;
  name: string;
  email: string;
  phone: string;
  currentRole: string;
  currentCompany: string;
  yearsOfExperience: number;
  interviewPrice: number;
  expertiseAreas: string[];
  interviewTypes: string[];
  languages: string[];
  weeklyAvailability?: string;
  aboutYourself?: string;
  feedbackStyle?: string;
  linkedinUrl?: string;
  resumeUrl?: string;
  profilePhotoUrl?: string;
  dateOfBirth?: string | null;
  passportNumber?: string;
  applicationStatus: string;
  profileStatus?: string | null;
  reviewedBy?: string | null;
  reviewNotes?: string | null;
  kycVerified: boolean;
  kycMissing: string[];
  hqVerified: boolean;
  liveForCandidates: boolean;
  kind?: 'applicant' | 'interviewer';
  createdAt?: string | null;
  updatedAt: string | null;
};

export type HqCourseLessonSummary = {
  id: string;
  title: string;
  order: number;
};

export type HqCertificateSlot = {
  x: number;
  y: number;
  fontSize: number;
  color: string;
  align: 'left' | 'center' | 'right' | string;
  fontFamily?: string;
};

export type HqCourseCertificate = {
  mode: 'preset' | 'uploaded' | string;
  presetId: string;
  backgroundUrl?: string | null;
  slots?: Record<string, HqCertificateSlot>;
};

export type HqCourseCheckpoint = {
  id: string;
  type: 'quiz' | 'assignment' | 'manual' | string;
  title: string;
  order: number;
  required: boolean;
  afterLessonId?: string | null;
  quizId?: string | null;
  passPercent?: number;
};

export type HqCourseRow = {
  id: string;
  title: string;
  description: string;
  category: string;
  level: string;
  thumbnailUrl?: string | null;
  videoUrl?: string | null;
  instructorName?: string | null;
  instructorAvatar?: string | null;
  totalLessons: number;
  estimatedHours: number;
  tags: string[];
  isPublished: boolean;
  accessTier: string;
  tokenCost: number;
  isCertified: boolean;
  certificate?: HqCourseCertificate | null;
  checkpoints?: HqCourseCheckpoint[];
  lessons?: HqCourseLessonSummary[];
  enrolledCount?: number;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type HqCourseStats = {
  total: number;
  published: number;
  draft: number;
  premium: number;
  enrollments?: number;
};

export type HqCourseLearner = {
  id: string;
  userId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  avatar?: string | null;
  title?: string | null;
  location?: string | null;
  progressPercent: number;
  completedLessonCount: number;
  completedAt?: string | null;
  startedAt?: string | null;
  lastAccessedAt?: string | null;
  savedAt?: string | null;
  certificateId?: string | null;
  certificateIssuedAt?: string | null;
  checkpointProgress?: Record<string, { passed?: boolean; at?: string; source?: string }>;
  status: 'joined' | 'in_progress' | 'completed' | string;
};

export type HqCourseEnrollmentResult = {
  course: HqCourseRow;
  learners: HqCourseLearner[];
  stats: {
    total: number;
    completed: number;
    inProgress: number;
    joined: number;
  };
};

export type HqCoursePayload = {
  title: string;
  description?: string;
  category?: string;
  level?: string;
  thumbnailUrl?: string;
  videoUrl?: string;
  instructorName?: string;
  estimatedHours?: number;
  totalLessons?: number;
  tags?: string[] | string;
  isPublished?: boolean;
  accessTier?: string;
  tokenCost?: number;
  isCertified?: boolean;
  certificate?: HqCourseCertificate | null;
  checkpoints?: HqCourseCheckpoint[];
};

export type HqCandidateBehaviorInsight = {
  id: string;
  label: string;
  severity: 'info' | 'watch' | 'action';
  summary: string;
  evidence: string[];
};

export type HqCandidateBehaviorRollup = {
  userId?: string;
  range?: string;
  fromDate?: string;
  toDate?: string;
  logins?: number;
  visits?: number;
  jobCardClicks?: number;
  applies?: number;
  activeMs?: number;
  sessionCount?: number;
  daysActive?: number;
  avgActiveMsPerDay?: number;
  topFirstOpen?: string;
  pageVisitsByCategory?: Record<string, number>;
  activeMsByCategory?: Record<string, number>;
  firstOpenBreakdown?: Record<string, number>;
  insights?: HqCandidateBehaviorInsight[];
  behaviourSignals?: {
    preferSlotIds?: string[];
    deprioritizeSlotIds?: string[];
    insightIds?: string[];
  };
  recentEvents?: Array<{
    id: string;
    at: string;
    type: string;
    category: string;
    path?: string;
    sessionId?: string;
    meta?: Record<string, unknown>;
  }>;
  recentSessions?: Array<{
    id: string;
    startedAt: string;
    endedAt?: string;
    durationMs: number;
    pageCount: number;
    firstPath?: string;
    lastPath?: string;
    deviceType?: string;
    browser?: string;
    operatingSystem?: string;
    country?: string;
    state?: string;
    city?: string;
  }>;
  profileSnapshot?: {
    skillsCount?: number | null;
    profileCompleteness?: number | null;
    cvScore?: number | null;
    applicationsTotal?: number;
    rejectionsTotal?: number;
  };
  hqTriggers?: Array<{
    id: string;
    flag: string;
    title: string;
    reason: string;
    evidence: string[];
    recommendedAction: string;
    priority: number;
  }>;
};

export type HqCandidateBehaviorAnalysis = {
  candidateId: string;
  candidate: {
    id: string;
    name: string;
    email: string;
    phone: string;
    title: string;
    location: string;
    status: string;
    source: string;
    lastActivity: string | null;
  } | null;
  capturedAt: string | null;
  activityStateUpdatedAt: string | null;
  rollup7d: HqCandidateBehaviorRollup | null;
  triggers: HqCandidateBehaviorRollup['hqTriggers'];
  suggestionMetrics: Record<string, unknown> | null;
  portalSessions: Array<{
    id: string;
    startedAt: string;
    endedAt: string | null;
    durationMs: number;
    durationLabel: string;
    ipAddress?: string | null;
    deviceType: string | null;
    browser: string | null;
    operatingSystem: string | null;
    country: string | null;
    state: string | null;
    city: string | null;
    timezone?: string | null;
    isActive: boolean;
  }>;
  sessionEngagement?: {
    sessionCount: number;
    activeCount: number;
    totalDurationMs: number;
    avgDurationMs: number;
    medianDurationMs: number;
    uniqueIps: number;
    uniqueDevices: number;
    locations: Array<{
      key: string;
      city: string | null;
      state: string | null;
      country: string | null;
      sessions: number;
      totalDurationMs: number;
    }>;
    byHour: Array<{
      hour: number;
      label: string;
      sessions: number;
      totalDurationMs: number;
    }>;
    byWeekday: Array<{
      weekday: number;
      label: string;
      sessions: number;
      totalDurationMs: number;
    }>;
  } | null;
  alertTiming?: {
    bestHours: number[];
    bestHourLabels: string[];
    bestWeekdays: string[];
    bestWindowLabel: string;
    avoidHours: number[];
    timezone: string | null;
    confidence: 'low' | 'medium' | 'high';
    reason: string;
    sampleSessions: number;
    avgDurationMs: number;
    medianDurationMs: number;
  } | null;
  locations?: Array<{
    key: string;
    city: string | null;
    state: string | null;
    country: string | null;
    sessions: number;
    totalDurationMs: number;
  }>;
  applications: Array<{
    id: string;
    status: string;
    jobTitle: string;
    company: string;
    createdAt: string;
  }>;
  applicationStats: { total: number; rejections: number };
  dbSummary: {
    logins: number;
    applies: number;
    activeMs: number;
    sessionCount: number;
    activeSessions: number;
    rejectionsTotal: number;
  };
  dataSource: 'phase1_behavior_tracker' | 'portal_db_sessions' | 'none';
  phase1BehaviorUrl: string;
};

export type HqTenantBehaviorAnalysis = {
  tenantDbName: string;
  tenantName: string;
  tenantEmail?: string;
  organizationType?: string;
  planName?: string;
  capturedAt: string;
  dataSource: 'behavior_engine' | 'sessions_fallback' | 'none';
  range?: 'today' | 'week' | 'month' | 'year';
  engagement: {
    trackedUsers: number;
    usersCreated?: number;
    usersLoaded?: number;
    teamMembersTotal: number;
    activeUsers7d: number;
    onlineNow: number;
    totalLogins7d: number;
    totalLogouts7d: number;
    totalSessions7d: number;
    totalActiveMs7d: number;
    totalActiveMsToday: number;
    totalVisits7d: number;
    totalActions7d: number;
    totalApiMutations7d: number;
    totalEntityViews7d: number;
    totalSearches7d: number;
    avgTimePerUser7d: number;
    lastActivityAt: string | null;
    firstActivityAt: string | null;
  };
  periodMetrics?: {
    range: 'today' | 'week' | 'month' | 'year';
    windowDays: number;
    visits: number;
    actions: number;
    apiMutations: number;
    entityViews: number;
    searches: number;
    activeMs: number;
    logins: number;
    sessions: number;
    activeUsers: number;
    avgWorkflow: number;
  };
  tenantHealthScore: number;
  weekMetrics: {
    visits: number;
    actions: number;
    apiMutations: number;
    entityViews: number;
    searches: number;
    activeMs: number;
    avgWorkflow: number;
  };
  todayMetrics: { visits: number; actions: number; activeMs: number };
  crmContext: Record<string, number | string | null> | null;
  moduleMatrix: Array<{
    category: string;
    label: string;
    visits: number;
    activeMs: number;
    actions: number;
    entityViews: number;
    conversionRate: number;
  }>;
  funnelSteps: Array<{ category: string; label: string; visits: number }>;
  actionBreakdown: Record<string, number>;
  topTriggers: Array<{
    id: string;
    flag: string;
    title: string;
    reason: string;
    evidence: string[];
    recommendedAction: string;
    priority: number;
  }>;
  intelligenceSummary: string[];
  insights: Array<{
    id: string;
    label: string;
    severity: string;
    summary: string;
    evidence: string[];
  }>;
  liveFeed: Array<{
    at: string;
    type: string;
    category: string;
    path?: string;
  }>;
};

export type HqAnalyticsChartPoint = { name: string; value: number; [key: string]: string | number };

export type HqAnalyticsInsight = {
  tone: 'info' | 'good' | 'warn';
  text: string;
};

export type HqEmployeeAnalytics = {
  available: boolean;
  live?: boolean;
  kpis: {
    totalCandidates: number;
    commonCandidates: number;
    new1d?: number;
    new7d: number;
    new30d: number;
    portalJobs: number;
    openJobs: number;
    closedJobs?: number;
    jobsPostedToday?: number;
    jobsPosted7d?: number;
    jobsPosted30d?: number;
    applications: number;
    activeApplications: number;
    applicationsToday?: number;
    applications7d?: number;
    applications30d?: number;
    selectedApplications?: number;
    rejectedApplications?: number;
    avgMatchScore: number | null;
    avgCvScore?: number | null;
    avgAtsScore?: number | null;
    savedJobs?: number;
    interviewRequests?: number;
    interviewPending?: number;
    interviewCompleted?: number;
    cvAnalyses?: number;
    lmsEnrollments?: number;
    aiMatches?: number;
    profileCompleteness?: number;
    loginsToday?: number;
    logins7d?: number;
    logins30d?: number;
    activeSessions?: number;
    totalSessionsTracked?: number;
    avgSessionDurationMs?: number | null;
    liveTrackedUsers?: number;
    liveVisits7d?: number;
    liveApplies7d?: number;
    liveJobClicks7d?: number;
    liveActiveMs7d?: number;
    resumesUploaded?: number;
    candidatesWithSkills?: number;
  };
  liveTracking?: {
    available: boolean;
    source: 'phase1_behavior_tracker' | 'portal_db_sessions' | string;
    trackedUsers: number;
    onlineNow: number;
    totalActiveMs7d: number;
    totalVisits7d: number;
    totalApplies7d: number;
    totalJobClicks7d: number;
    totalLogins7d: number;
    totalSessions7d: number;
    avgActiveMsPerUser7d: number;
    /** Visits on premium / LMS / AI CV / interview prep surfaces (7d). */
    premiumVisits7d?: number;
    /** Tokens spent on premium catalog services (7d). */
    premiumTokensSpent7d?: number;
    /** Visits on community / Office Gossip / chat / reference-check surfaces (7d). */
    communityVisits7d?: number;
    pageVisitsByCategory: HqAnalyticsChartPoint[];
    /** Premium-services-wise usage (most → least) — named catalog spends when available. */
    premiumServicesUsage?: Array<HqAnalyticsChartPoint & { tokens?: number; kind?: string }>;
    /** Most popular features: premium spends + earn + free surfaces. */
    popularFeatures?: Array<HqAnalyticsChartPoint & { kind?: string }>;
    tokenUsage?: {
      available?: boolean;
      premiumSpendEvents?: number;
      premiumTokensSpent?: number;
      earnEvents?: number;
    } | null;
    /** First-open entry points (e.g. landed on Services before/at first meaningful open). */
    entryPoints?: HqAnalyticsChartPoint[];
    /** Office Gossip, chat, reference-check style behaviour. */
    communityBehavior?: HqAnalyticsChartPoint[];
    /** Product rollup from Office Gossips bundle (users + reference-check statuses). */
    officeGossip?: {
      available?: boolean;
      updatedAt?: string | null;
      usersOnOfficeGossip?: number;
      identities?: number;
      communities?: number;
      companyPages?: number;
      posts?: number;
      comments?: number;
      openForReference?: number;
      referenceChecks?: number;
      referenceByStatus?: Record<string, number>;
      referenceChecksSummary?: {
        total?: number;
        initiated?: number;
        responded?: number;
        completed?: number;
        rejected?: number;
      };
    } | null;
    /** Top interest topics among candidates (affinity engine). */
    topInterests?: Array<HqAnalyticsChartPoint & { key?: string; avgScore?: number; scoreSum?: number }>;
    /** Trending topics (interests + roles + companies). */
    trendingTopics?: Array<HqAnalyticsChartPoint & { kind?: string }>;
    topTriggers: HqAnalyticsChartPoint[];
    liveFeed: Array<{
      userId: string;
      capturedAt: string | null;
      activityStateUpdatedAt: string | null;
      activeMs7d: number;
      visits7d: number;
      applies7d: number;
      jobCardClicks7d: number;
      topTrigger: string | null;
      topInterest?: string | null;
      topFirstOpen?: string | null;
    }>;
    capturedAt: string;
  };
  charts: {
    applicationsByStatus: HqAnalyticsChartPoint[];
    candidatesOverTime: HqAnalyticsChartPoint[];
    applicationsOverTime: HqAnalyticsChartPoint[];
    candidatesDaily?: HqAnalyticsChartPoint[];
    applicationsDaily?: HqAnalyticsChartPoint[];
    candidatesByStatus: HqAnalyticsChartPoint[];
    candidatesBySource: HqAnalyticsChartPoint[];
    topLocations: HqAnalyticsChartPoint[];
    topSkills: HqAnalyticsChartPoint[];
    experienceBands?: HqAnalyticsChartPoint[];
    jobsByStatus?: HqAnalyticsChartPoint[];
    matchScoreBuckets?: HqAnalyticsChartPoint[];
    interviewRequestsByStatus?: HqAnalyticsChartPoint[];
    loginsByCountry?: HqAnalyticsChartPoint[];
    loginsByState?: HqAnalyticsChartPoint[];
    loginsByCity?: HqAnalyticsChartPoint[];
    loginsByDevice?: HqAnalyticsChartPoint[];
    loginsByBrowser?: HqAnalyticsChartPoint[];
    loginsOverTime?: HqAnalyticsChartPoint[];
    loginsDaily?: HqAnalyticsChartPoint[];
  };
  tables: {
    recentCandidates: Array<{
      id: string;
      name: string;
      email: string;
      status: string;
      source: string;
      location: string;
      stage: string;
      skills?: string;
      experience?: number | null;
      updatedAt: string | null;
      createdAt: string | null;
    }>;
    recentApplications: Array<{
      id: string;
      candidate: string;
      email: string;
      job: string;
      status: string;
      matchScore: number | null;
      appliedAt: string | null;
    }>;
    topJobsByApplications: Array<{
      title: string;
      applications: number;
      status: string;
      location: string;
      openings?: number | null;
      avgMatchScore?: number | null;
      selected?: number;
      joined?: number;
    }>;
    recentOpenJobs?: Array<{
      id: string;
      title: string;
      status: string;
      location: string;
      workMode: string;
      openings: number;
      postedDate: string | null;
      updatedAt: string | null;
    }>;
    recentInterviewRequests?: Array<{
      role: string;
      status: string;
      difficulty: string;
      matchingScore: number | null;
      preferredDate: string | null;
      createdAt: string | null;
    }>;
    recentSessions?: Array<{
      candidateId: string;
      candidate: string;
      loginAt: string | null;
      logoutAt: string | null;
      durationMs: number;
      deviceType: string;
      browser: string;
      operatingSystem: string;
      country: string;
      state: string;
      city: string;
      isActive: boolean;
      status?: 'online' | 'idle' | 'closed' | string;
    }>;
  };
  insights: HqAnalyticsInsight[];
};

export type HqEmployerTenantRow = {
  tenantDbName: string;
  name: string;
  email: string;
  organizationType: string;
  plan: string;
  status: string;
  signupSource: string;
  jobs: number;
  openJobs: number;
  closedJobs?: number;
  candidates: number;
  candidates7d?: number;
  applications: number;
  applications7d?: number;
  interviews: number;
  interviewsToday?: number;
  interviewsScheduled?: number;
  interviewsCompleted?: number;
  placements: number;
  placementsJoined?: number;
  clients: number;
  leads: number;
  tasks?: number;
  tasksOpen?: number;
  activityScore?: number;
  health?: number;
  error: string | null;
};

export type HqEmployerAtRiskTenant = {
  tenantId: string;
  name: string;
  plan: string;
  health: number;
  openJobs: number;
  applications7d: number;
  reason: string;
  reasons?: string[];
};

export type HqEmployerAnalytics = {
  available: boolean;
  live?: boolean;
  kpis: {
    tenants: number;
    agency: number;
    standalone: number;
    paused: number;
    onPlan: number;
    landingPurchases: number;
    landingTrials: number;
    openJobs: number;
    closedJobs?: number;
    jobs: number;
    candidates: number;
    candidates7d?: number;
    applications: number;
    applications7d?: number;
    interviews: number;
    interviewsToday?: number;
    interviewsScheduled?: number;
    interviewsCompleted?: number;
    placements: number;
    placementsJoined?: number;
    clients: number;
    tenantLeads: number;
    tasks?: number;
    tasksOpen?: number;
    hqLeads: number;
    hqLeadConversionRate: number;
    hqCompanies: number;
    hotLeads?: number;
    pipelineValue?: number;
    monthlyBillingTotal?: number;
    billingTenants?: number;
    trialTenants?: number;
    demosVerified: number;
    demosPurchases: number;
    demosTrials: number;
    demosPending?: number;
    demosExpired?: number;
    demosTotal?: number;
    demosTrialsLive?: number;
    followUpsToday: number;
    mrr?: number;
    arr?: number;
    platformHealthScore?: number;
    concentrationTop1JobsPct?: number;
    concentrationTop3JobsPct?: number;
  };
  charts: {
    hiringFunnel: HqAnalyticsChartPoint[];
    landingFunnel?: HqAnalyticsChartPoint[];
    tenantsByPlan: HqAnalyticsChartPoint[];
    tenantsByType: HqAnalyticsChartPoint[];
    tenantsBySignup?: HqAnalyticsChartPoint[];
    leadsByStage: HqAnalyticsChartPoint[];
    leadsByScore?: HqAnalyticsChartPoint[];
    companiesByStatus: HqAnalyticsChartPoint[];
    demosByKind?: HqAnalyticsChartPoint[];
    demosByStatus?: HqAnalyticsChartPoint[];
    jobsByStatus?: HqAnalyticsChartPoint[];
    interviewsByStatus?: HqAnalyticsChartPoint[];
    placementsByStatus?: HqAnalyticsChartPoint[];
    tenantActivity: Array<HqAnalyticsChartPoint & { openJobs?: number; placements?: number }>;
    mrrByPlan?: Array<HqAnalyticsChartPoint & { tenantCount?: number }>;
    featureUsage?: HqAnalyticsChartPoint[];
  };
  tables: {
    rankedTenants: HqEmployerTenantRow[];
    atRiskTenants?: HqEmployerAtRiskTenant[];
    recentTenantActivity: Array<{
      tenant: string;
      tenantDbName: string;
      openJobs: number;
      candidates: number;
      candidates7d?: number;
      applications7d?: number;
      interviews: number;
      interviewsToday?: number;
      placements: number;
      placementsJoined?: number;
      tasksOpen?: number;
      plan: string;
      organizationType: string;
      health?: number;
    }>;
    recentJobs?: Array<{
      id: string;
      title: string;
      status: string;
      company: string;
      location: string;
      openings: number;
      updatedAt: string | null;
      tenant: string;
      tenantDbName: string;
    }>;
    recentPlacements?: Array<{
      id: string;
      candidate: string;
      job: string;
      company: string;
      status: string;
      salary: number | null;
      joiningDate: string | null;
      updatedAt: string | null;
      tenant: string;
      tenantDbName: string;
    }>;
    crmLeads: Array<{
      id: string;
      name: string;
      company: string;
      stage: string;
      score: string;
      owner: string;
      nextFollowUp: string;
      estimatedDealValue: number;
      industry?: string;
      country?: string;
    }>;
    crmCompanies?: Array<{
      id: string;
      name: string;
      status: string;
      score: string;
      industry: string;
      country: string;
      owner: string;
      nextFollowUp: string;
    }>;
    recentDemos?: Array<{
      id: string;
      name: string;
      company: string;
      email: string;
      requestKind: string;
      status: string;
      submittedAt: string | null;
    }>;
    crmLeadStats: Record<string, number>;
    crmCompanyStats: Record<string, number>;
    demoStats: Record<string, number>;
  };
  insights: HqAnalyticsInsight[];
};

export type HqAnalyticsPayload = {
  generatedAt: string;
  durationMs?: number;
  live?: boolean;
  employee: HqEmployeeAnalytics;
  employer: HqEmployerAnalytics;
};

export type HqBillingTransactionDirection = 'credit' | 'debit';

export type HqBillingCandidatePurchaseRow = {
  id: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  candidatePhone: string;
  packageId: string | null;
  packageName: string;
  tokens: number;
  balanceAfter: number;
  reference: string;
  description: string;
  purchasedAt: string | null;
};

export type HqBillingCandidateTransactionRow = {
  id: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  candidatePhone: string;
  type: string;
  label: string;
  amount: number;
  direction: HqBillingTransactionDirection;
  unit: string;
  balanceAfter: number;
  packageId: string | null;
  packageName: string;
  service: string;
  reference: string;
  description: string;
  occurredAt: string | null;
};

export type HqBillingEmployerTransactionRow = {
  id: string;
  tenantId: string;
  tenantName: string;
  email: string;
  tenantDbName: string;
  type: string;
  label: string;
  amount: number;
  direction: HqBillingTransactionDirection;
  unit: string;
  balanceAfter?: number;
  reference: string;
  description: string;
  featureId?: string;
  packId?: string;
  occurredAt: string | null;
  actorEmail: string;
};

export type HqBillingLedgerStats = {
  purchases: number;
  spends: number;
  grants: number;
  coinsIn: number;
  coinsOut: number;
  total: number;
};

export type HqBillingCandidateLedgerPayload = {
  entity: {
    id: string;
    name: string;
    email: string;
    phone: string;
    title: string;
    tokenBalance: number;
    phase: 'phase1';
  };
  transactions: HqBillingCandidateTransactionRow[];
  stats: HqBillingLedgerStats;
};

export type HqBillingEmployerLedgerPayload = {
  entity: {
    phase: 'phase2';
    tenantId: string;
    tenantName: string;
    email: string;
    tenantDbName: string;
    planName: string;
    billingCycle: 'monthly' | 'annual';
    aiCoins: number;
    price: string | null;
    planStartDate: string | null;
    planEndDate: string | null;
  };
  transactions: HqBillingEmployerTransactionRow[];
  stats: HqBillingLedgerStats;
};

export type HqBillingTenantCycleRow = {
  tenantId: string;
  tenantName: string;
  email: string;
  tenantDbName: string;
  signupSource: string;
  planName: string;
  planId: string | null;
  billingCycle: 'monthly' | 'annual';
  price: string | null;
  planStartDate: string | null;
  planEndDate: string | null;
  purchasedAt: string | null;
  lastPaymentReference: string | null;
  isTrial: boolean;
  aiCoins: number;
  status: string;
  createdAt: string | null;
  updatedAt: string | null;
};

export type HqBillingPurchaseRequestRow = {
  id: string;
  fullName: string;
  email: string;
  organizationName: string;
  requestKind: string;
  packageName: string;
  packageSlug: string;
  billingCycle: 'monthly' | 'annual';
  trialProvisioned: boolean;
  trialTenantDbName: string;
  status: string;
  submittedAt: string | null;
  createdAt: string | null;
};

export type HqBillingPayload = {
  overview: {
    employer: {
      totalTenants: number;
      tenantsOnPlan: number;
      monthlyCycles: number;
      annualCycles: number;
      landingPurchases: number;
      purchaseRequests: number;
      coinPurchases?: number;
      coinSpends?: number;
      totalTransactions?: number;
    };
    candidate: {
      totalPurchases: number;
      totalSpends?: number;
      totalGrants?: number;
      totalTokensSold: number;
      totalTokensSpent?: number;
      uniqueBuyers: number;
      activePackTypes: number;
      totalTransactions?: number;
    };
    generatedAt: string;
  };
  candidate: {
    transactions: HqBillingCandidateTransactionRow[];
    stats: HqBillingLedgerStats;
  };
  employer: {
    tenantCycles: HqBillingTenantCycleRow[];
    purchaseRequests: HqBillingPurchaseRequestRow[];
    transactions: HqBillingEmployerTransactionRow[];
    stats: {
      totalTenants: number;
      tenantsOnPlan: number;
      monthlyCycles: number;
      annualCycles: number;
      landingPurchases: number;
      purchaseRequests: number;
      totalTransactions?: number;
    };
  };
};

export type HqCustomReportRow = {
  id: string;
  name: string;
  dataset:
    | 'leads'
    | 'clients'
    | 'demos'
    | 'tenants'
    | 'tickets'
    | 'team'
    | 'candidates'
    | 'kyc'
    | 'courses'
    | 'jobs'
    | 'events'
    | 'helpTickets'
    | 'companies';
  groupBy: string;
  metric: 'count' | 'pipeline';
  dateFrom?: string;
  dateTo?: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  createdByEmail?: string | null;
};

export type HqPushJobsToFeedsResult = {
  scanned: number;
  eligible: number;
  updated: number;
  alreadyInFeed: number;
  mirroredToPortal: number;
  skipped: number;
  skippedByReason: Record<string, number>;
  feedUrls: {
    adzuna: string;
    careerjet: string;
  };
};

export type HqSyncTenantJobsToPhase1Result = {
  requested: number;
  synced: number;
  failed: number;
  results: Array<{
    tenantDbName: string;
    jobId: string;
    title?: string;
    ok: boolean;
    error?: string;
  }>;
};

export type HqAiFeature = {
  id: string;
  name: string;
  description: string;
  coins: number;
  category: string;
  defaultCoins?: number;
  isCustomCost?: boolean;
  locked?: boolean;
  affordable?: boolean;
};

export type HqAiCoinPack = {
  id: string;
  name: string;
  coins: number;
  priceUsd: number;
  priceLabel: string;
  description: string;
  popular?: boolean;
  active?: boolean;
  sortOrder?: number;
};

export type HqPhase1TokenPack = {
  id: string;
  name: string;
  tokens: number;
  priceAmount: number;
  priceLabel: string;
  currency?: string;
  description?: string;
  popular?: boolean;
  active?: boolean;
  sortOrder?: number;
};

export type HqPhase1TokenService = {
  id: string;
  name: string;
  description: string;
  cost: number;
  category: string;
  defaultCost?: number;
  isCustomCost?: boolean;
};

export type HqPhase1EarnTask = {
  id: string;
  name: string;
  description: string;
  tokens: number;
  category: string;
  order?: number;
  defaultTokens?: number;
  isCustomTokens?: boolean;
};

export interface InvoicePaymentReminder {
  id: string;
  mode: 'now' | 'schedule';
  status: 'PENDING' | 'SENT' | 'FAILED' | 'CANCELLED';
  toEmail: string;
  note?: string | null;
  scheduledAt: string;
  timezone?: string | null;
  createdAt?: string;
  sentAt?: string | null;
  error?: string | null;
}

export interface SendInvoiceReminderPayload {
  mode: 'now' | 'schedule';
  /** Wall-clock date `YYYY-MM-DD` — required when mode is `schedule`. */
  scheduledDate?: string;
  /** Wall-clock time `HH:mm` — required when mode is `schedule`. */
  scheduledTime?: string;
  /** IANA timezone the date/time is expressed in. */
  timezone?: string;
  toEmail?: string;
  note?: string;
}

export interface InvoiceActivityEvent {
  kind:
    | 'lead'
    | 'client'
    | 'job'
    | 'candidate'
    | 'pipeline'
    | 'interview'
    | 'placement'
    | 'invoice'
    | 'payment'
    | 'reminder'
    | 'activity';
  title: string;
  description: string | null;
  at: string;
  meta?: Record<string, any>;
}

export interface InvoiceActivityResponse {
  invoice: {
    id: string;
    invoiceNumber: string;
    amount: number;
    currency: string;
    status: string;
    date: string;
    dueDate: string;
    paidAt: string | null;
    invoiceUrl?: string | null;
    hasInvoiceDocument?: boolean;
    canSendReminder?: boolean;
    reminders?: InvoicePaymentReminder[];
  };
  lead: { id: string; companyName: string | null; contactName: string | null; status: string | null; source: string | null } | null;
  client: { id: string; companyName: string | null; status: string | null; industry: string | null } | null;
  job: { id: string; title: string | null; status: string | null } | null;
  candidate: { id: string; name: string; email: string | null } | null;
  placement: {
    id: string;
    status: string | null;
    joiningDate: string | null;
    recruiter: string | null;
    fee: number;
  } | null;
  events: InvoiceActivityEvent[];
  auditMeta?: import('../../types/audit').AuditMeta | null;
}

export type BulkCvStoredFileMeta = {
  storedFileId: string;
  name: string;
  size: number;
};

export type BulkCvExpandZipResult = {
  total: number;
  skipped: number;
  maxAllowed: number;
  files: BulkCvStoredFileMeta[];
};

export type ServerFailedBulkResume = {
  id: string;
  fileName: string;
  reason: string;
  fileUrl?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  status: string;
  failedAt: string;
  hasFile?: boolean;
};

/** Upload failed Bulk CV files to server storage (S3 + DB) for one-click reparse. */

export type RepairBadNamesChange = {
  id: string;
  status: string;
  from: string;
  to: string | null;
  source?: string | null;
};

export type RepairBadNamesResult = {
  scanned: number;
  badNames: number;
  updated: number;
  wouldUpdate: number;
  skippedNoResume: number;
  skippedUnparseable: number;
  unchanged: number;
  dryRun: boolean;
  /** Full preview / applied rename list. */
  changes?: RepairBadNamesChange[];
  samples: RepairBadNamesChange[];
};

/** Re-read stored CVs and auto-fix garbage candidate names (filenames / titles / locations). */

export interface BackendUser {
  id: string;
  name: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string;
  loginId?: string | null;
  role: string;
  roleName?: string;
  roleColor?: string;
  department?: string | null;
  designation?: string | null;
  location?: string | null;
  status?: string | null;
  phone?: string | null;
  avatar?: string | null;
  isActive: boolean;
  lastLogin?: string;
  createdAt?: string;
  updatedAt?: string;
  /** Reporting manager on the team hierarchy (User.managerId). */
  managerId?: string | null;
  /** Company name entered when HQ created this tenant. */
  organizationName?: string | null;
  companyName?: string | null;
}

export type JobVisibilityDefaultsPayload = {
  publicFieldVisibility?: Record<string, boolean> | null;
  showClientNamePublicly?: boolean;
  updatedAt?: string | null;
};

export type SubmitToClientVisibilityDefaultsPayload = {
  fieldVisibility?: Record<string, boolean> | null;
  tableColumns?: string[] | null;
  allowedClientStages?: string[] | null;
  clientStageCatalog?: string[] | null;
  updatedAt?: string | null;
};

export interface MyPermissionsPayload {
  id: string;
  role: string;
  roleName: string;
  roleColor?: string;
  isSuperAdmin: boolean;
  isActive: boolean;
  permissions: string[];
}

export interface BackendJob {
  id: string;
  title: string;
  description?: string | null;
  overview?: string | null;
  location?: string | null;
  status: string;
  /** Tenant-facing label when org uses custom job statuses */
  statusLabel?: string | null;
  openings: number;
  createdAt: string;
  postedDate?: string | null;
  client?: {
    id: string;
    companyName: string;
  } | null;
  assignedToId?: string | null;
  createdById?: string | null;
  assignedTo?: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  } | null;
  _count?: {
    matches: number;
    interviews: number;
    placements?: number;
    applications?: number;
  };
  jobCategory?: string | null;
  department?: string;
  hiringManager?: string;
  hiringManagerId?: string;
  type?: string;
  salary?: {
    min?: number;
    max?: number;
    amount?: string | number;
    type?: string;
    currency?: string;
    currencySymbol?: string;
  } | null;
  experienceRequired?: string | null;
  education?: string | null;
  priority?: string | null;
  keyResponsibilities?: string[];
  candidateRequirements?: string[];
  skills?: string[];
  preferredSkills?: string[];
  benefits?: string[];
  requirements?: string[];
  nationality?: string | null;
  country?: string | null;
  state?: string | null;
  city?: string | null;
  languages?: Array<{ language: string; proficiency: string }> | null;
  workMode?: string | null;
  expectedClosureDate?: string | null;
  jdFileName?: string | null;
  videoMediaLink?: string | null;
  forecastRevenue?: string | null;
  hot?: boolean;
  aiMatch?: boolean;
  noCandidates?: boolean;
  slaRisk?: boolean;
  visibility?: string | null;
  showClientNamePublicly?: boolean | null;
  publicFieldVisibility?: Record<string, boolean> | null;
  aboutCompany?: string | null;
  postingCompanyName?: string | null;
  orgUnitId?: string | null;
  recruiterProfile?: {
    id?: string;
    name?: string;
    designation?: string | null;
    avatarUrl?: string | null;
    email?: string | null;
  } | null;
  manager?: { id: string; name: string; email?: string } | null;
  managerId?: string | null;
  supportingRecruiters?: string[] | null;
  jobLocationType?: string | null;
  applicationFormEnabled?: boolean;
  applicationFormLogo?: string | null;
  applicationFormQuestions?: string[];
  applicationFormNote?: string | null;
  applicationFormSchema?: { version: number; fields: unknown[] } | null;
  preScreenAssessments?: unknown[];
  applyLinkToken?: string | null;
  applyUrl?: string | null;
  matches?: Array<{
    id?: string;
    candidateId?: string;
    score?: number;
    stage?: string;
    interviewStatus?: string;
    updatedAt?: string;
    createdAt?: string;
    recruiter?: { name?: string };
    candidate?: {
      id?: string;
      firstName?: string | null;
      lastName?: string | null;
      stage?: string;
      recruiter?: { name?: string };
    };
  }>;
  pipelineStages?: Array<{
    id: string;
    name: string;
    order: number;
    color?: string;
    systemRole?: string | null;
    _count?: { entries?: number };
  }>;
  applications?: Array<{
    id: string;
    candidateId: string;
    status?: string;
    appliedAt?: string;
    screeningAnswers?: Record<string, unknown> | null;
    candidate?: {
      id?: string;
      firstName?: string | null;
      lastName?: string | null;
      email?: string | null;
    } | null;
  }>;
}

export interface PaginatedJobs {
  items: BackendJob[];
}

export type PortalAccessMember = {
  id: string;
  name: string;
  email: string;
  roleName?: string;
  jobsCreated: number;
  jobsAssigned: number;
  jobCount: number;
};

export type PortalAccessJobRow = {
  id: string;
  title: string;
  status?: string;
  location?: string;
  clientName?: string;
  createdAt?: string;
  postedDate?: string;
  createdByMe?: boolean;
  assignedToMe?: boolean;
  onHryantraPortal: boolean;
};

export interface CreateJobData {
  title: string;
  description?: string;
  overview?: string;
  requirements?: string[];
  skills?: string[];
  preferredSkills?: string[];
  keyResponsibilities?: string[];
  candidateRequirements?: string[];
  location?: string;
  type?: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'FREELANCE' | 'INTERNSHIP';
  status?: 'DRAFT' | 'OPEN' | 'ON_HOLD' | 'CLOSED' | 'FILLED';
  /** Display label (supports tenant custom statuses) */
  statusLabel?: string | null;
  clientId: string;
  /** Job assignee (recruiter). Use `null` on PATCH to unassign. */
  assignedToId?: string | null;
  openings?: number;
  salary?: any;
  experienceRequired?: string;
  education?: string;
  benefits?: string[];
  postedDate?: string;
  hiringManager?: string;
  hiringManagerId?: string;
  department?: string;
  jobCategory?: string;
  jobLocationType?: string;
  workMode?: string;
  expectedClosureDate?: string;
  jdFileName?: string;
  hot?: boolean;
  aiMatch?: boolean;
  noCandidates?: boolean;
  slaRisk?: boolean;
  pipelineStages?: Array<{
    id?: string;
    name: string;
    sla?: string;
    order?: number;
    systemRole?: string | null;
  }>;
  applicationFormEnabled?: boolean;
  applicationFormLogo?: string;
  applicationFormQuestions?: string[];
  applicationFormNote?: string;
  applicationFormSchema?: { version: number; fields: unknown[] };
  statusRemark?: string;
  priority?: string;
  nationality?: string;
  country?: string;
  state?: string;
  city?: string;
  forecastRevenue?: string;
  videoMediaLink?: string;
  languages?: Array<{ language: string; proficiency: string }>;
  managerId?: string | null;
  supportingRecruiters?: string[];
  /** When false, client name is hidden on Phase 1 listings and social posts. Default true. */
  showClientNamePublicly?: boolean;
  /** Per-field visibility for public apply page, Phase 1, and social posts. */
  publicFieldVisibility?: Record<string, boolean>;
  aboutCompany?: string | null;
  /** Tenant company / organization name shown on Phase 1, LinkedIn, and public apply. */
  postingCompanyName?: string | null;
  /** Org unit that is posting this job (Super Admin chooser). */
  orgUnitId?: string | null;
  distributionPlatforms?: {
    internalCompany?: boolean;
    companyPage?: boolean;
    hryantra?: boolean;
    externalPlatforms?: boolean;
    adzuna?: boolean;
    careerjet?: boolean;
    socialMedia?: boolean;
  };
  preScreenAssessments?: Array<{
    assessmentId: string;
    sortOrder?: number;
    required?: boolean;
    timing?: string;
    durationOverrideMinutes?: number | null;
    passScoreOverridePercent?: number | null;
  }>;
}

export type CandidateAssessmentResultGroup = {
  jobId: string;
  jobTitle: string;
  applicationId?: string | null;
  results: Array<Record<string, unknown>>;
};

export interface JobMetrics {
  activeJobs: number;
  newJobsThisWeek: number;
  appliedCandidates: number;
  noCandidates: number;
  nearSla: number;
  closedThisMonth: number;
}

export interface UpdateJobData extends CreateJobData {
  id: string;
}

export interface BackendCandidate {
  id: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  email: string;
  phone?: string | null;
  linkedIn?: string | null;
  /** Stored on backend Candidate model; used for linked job and interview scheduling fallback */
  assignedJobs?: string[];
  /** Computed by backend candidates list for display */
  assignedJobTitles?: string[];
  experience?: number | null;
  location?: string | null;
  status: string;
  source?: string | null;
  currentTitle?: string | null;
  currentCompany?: string | null;
  resume?: string | null;
  /** Alias used by profile and client-review views. Same file as `resume` when only one is stored. */
  resumeUrl?: string | null;
  nextFollowUp?: string | null;
  designation?: string | null;
  cvCountry?: string | null;
  /** Profile photo URL (Cloudinary, S3, etc.) */
  avatar?: string | null;
  skills?: string[];
  address?: string | null;
  city?: string | null;
  country?: string | null;
  gender?: string | null;
  availability?: string | null;
  noticePeriod?: string | null;
  stage?: string | null;
  /** Phase 1 / candidatecommon pool row */
  isPhase1Candidate?: boolean;
  /** Discovery-only Phase 1 candidate (not yet on a tenant job) */
  isNewCandidate?: boolean;
  /** Assigned to a job and/or applied — CRM stage is Applied */
  isJobAppliedCandidate?: boolean;
  applications?: Array<{
    id?: string;
    jobId?: string;
    status?: string;
    job?: { id?: string; title?: string | null };
  }>;
  pipelineEntries?: Array<{
    id?: string;
    jobId?: string;
    stageId?: string;
    movedAt?: string;
    notes?: string | null;
    stage?: { id?: string; name?: string } | null;
    job?: { id?: string; title?: string } | null;
  }>;
  poolOrigin?: 'phase1_common' | 'phase1' | 'tenant' | string | null;
  tags?: string[];
  expectedSalary?: number | null;
  currentSalary?: number | null;
  education?: string | null;
  certifications?: string[];
  languages?: string[];
  portfolio?: string | null;
  website?: string | null;
  notes?: string | null;
  cvSummary?: string | null;
  cvEducationEntries?: Array<{
    degree?: string;
    institution?: string;
    startYear?: string;
    endYear?: string;
  }> | null;
  cvWorkExperienceEntries?: Array<{
    title?: string;
    company?: string;
    location?: string;
    startDate?: string;
    endDate?: string;
    responsibilities?: string[];
  }> | null;
  cvPortfolioLinks?: Array<{
    type?: string;
    url?: string;
  }> | null;
  preferredLocation?: string | null;
  salary?: {
    min?: number;
    max?: number;
    currency?: string;
  } | null;
  /**
   * Candidate-self-entered career preferences from the job portal.
   * Backend merges this in from the portal `career_preferences` collection.
   */
  careerPreferences?: {
    currentRole?: string | null;
    preferredJobTitles?: string[];
    preferredRoles?: string[];
    preferredIndustries?: string[];
    preferredIndustry?: string | null;
    functionalAreas?: string[];
    functionalArea?: string | null;
    jobTypes?: string[];
    workModes?: string[];
    preferredWorkMode?: string | null;
    preferredLocations?: string[];
    relocationPreference?: string | null;
    salaryCurrency?: string | null;
    salaryAmount?: number | string | null;
    salaryFrequency?: string | null;
    preferredCurrency?: string | null;
    preferredSalary?: number | null;
    preferredSalaryType?: string | null;
    preferredBenefits?: string[];
    availabilityToStart?: string | null;
    noticePeriod?: string | null;
    noticePeriodDays?: number | null;
    openToRelocation?: boolean;
    currentLocation?: string | null;
    currentSalary?: number | null;
    currentCurrency?: string | null;
    currentSalaryType?: string | null;
    currentBenefits?: string[];
    passportNumbersByLocation?: Record<string, string> | null;
  } | null;
  assignedTo?: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  } | null;
  createdAt: string;
  updatedAt?: string;
  extraData?: Record<string, unknown> | null;
  matches?: Array<{
    id: string;
    jobId?: string;
    status?: string;
    score?: number;
    createdById?: string | null;
    evaluation?: { origin?: string; pending?: boolean } | null;
    job?: {
      id: string;
      title: string;
      client?: {
        companyName: string;
      };
    };
  }>;
  interviews?: Array<{
    id: string;
    status?: string;
    scheduledAt?: string;
    round?: string | null;
    duration?: number | null;
    mode?: string | null;
    timezone?: string | null;
    platform?: string | null;
    meetingLink?: string | null;
    location?: string | null;
    notes?: string | null;
    interviewer?: {
      id: string;
      name: string;
      email: string;
      avatar?: string | null;
      role?: string | null;
      department?: string | null;
    } | null;
    job?: {
      id: string;
      title: string;
    } | null;
  }>;
  placements?: Array<{
    id: string;
    jobId?: string;
    status?: string;
    updatedAt?: string;
    createdAt?: string;
    deletedAt?: string | null;
  }>;
  placementStatus?: string | null;
  tagObjects?: Array<{
    id: string;
    label: string;
    color: string;
  }>;
  internalNotes?: Array<{
    id: string;
    text: string;
    createdAt: string;
    recruiter: {
      id?: string;
      name: string;
      avatar?: string | null;
    };
    tags?: string[];
    isPinned?: boolean;
  }>;
  activityFeed?: Array<{
    id: string;
    type:
      | 'stage-movement'
      | 'email-sent'
      | 'resume-parsed'
      | 'added-to-pipeline'
      | 'interview-scheduled'
      | 'rejected'
      | 'note-added';
    title: string;
    description?: string | null;
    timestamp: string;
    performedBy: {
      name: string;
      avatar?: string | null;
    };
    relatedJob?: string | null;
    reviewUrl?: string | null;
    clientName?: string | null;
  }>;
  aiCandidateAnalysis?: {
    source?: 'match' | 'estimated' | string;
    jobTitle?: string | null;
    overall?: number;
    breakdown?: {
      skillsMatch?: number;
      experienceFit?: number;
      educationFit?: number;
      keywordMatch?: number;
    };
    insights?: Array<{
      type?: 'strength' | 'gap' | string;
      text?: string;
    }>;
  };
  rating?: number | null;
  hotlist: boolean;
  createdById?: string | null;
  clientReplies?: Array<{
    id: string;
    clientName?: string | null;
    jobTitle?: string | null;
    tag?: string | null;
    comments?: string | null;
    documentUrl?: string | null;
    documentFileName?: string | null;
    documentLabel?: string | null;
    repliedAt?: string | Date | null;
    submissionType?: string | null;
  }>;
  clientSubmissions?: Array<{
    id: string;
    clientName?: string | null;
    jobTitle?: string | null;
    reviewUrl?: string | null;
    submittedAt?: string | Date | null;
  }>;
}

export interface UpdateCandidatePayload {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  linkedIn?: string;
  resume?: string | null;
  skills?: string[];
  experience?: number | null;
  experienceYears?: number | null;
  currentTitle?: string;
  currentCompany?: string;
  designation?: string;
  location?: string;
  status?: string;
  source?: string;
  assignedToId?: string | null;
  noticePeriod?: string;
  availability?: string;
  expectedSalary?: number | null;
  currentSalary?: number | null;
  education?: string;
  certifications?: string[];
  languages?: string[];
  portfolio?: string;
  website?: string;
  notes?: string;
  cvSummary?: string;
  cvEducationEntries?: Array<{
    degree?: string;
    institution?: string;
    startYear?: string;
    endYear?: string;
  }>;
  cvWorkExperienceEntries?: Array<{
    title?: string;
    company?: string;
    location?: string;
    startDate?: string;
    endDate?: string;
    responsibilities?: string[];
  }>;
  cvPortfolioLinks?: Array<{
    type?: string;
    url?: string;
  }>;
  preferredLocation?: string | null;
  address?: string;
  city?: string;
  country?: string;
  gender?: string;
  middleName?: string;
  dateOfBirth?: string | null;
  stage?: string;
  assignedJobs?: string[];
  avatar?: string | null;
  extraData?: Record<string, unknown> | null;
  salary?: {
    min?: number | null;
    max?: number | null;
    currency?: string;
  } | null;
}

export interface AddCandidatePayload {
  firstName: string;
  lastName: string;
  email: string | null;
  phone?: string;
  currentCompany?: string;
  designation?: string;
  currentDesignation?: string;
  experience: number | string;
  location?: string;
  linkedinUrl?: string;
  jobId?: string;
  stage?: string;
  recruiterId?: string;
  source: string;
  sourceUrl?: string;
  referrerName?: string;
  agencyName?: string;
  priority?: string;
  tags?: string[];
  expectedSalary?: number | string;
  currency?: string;
  noticePeriod?: string;
  availabilityStatus?: string;
  portfolioUrl?: string;
  skills?: string[];
  initialNote?: string;
  currentSalary?: number | string;
  education?: string;
  certifications?: string[];
  languages?: string[];
  notes?: string;
  cvSummary?: string;
  cvEducationEntries?: Array<{
    degree?: string;
    institution?: string;
    startYear?: string;
    endYear?: string;
  }>;
  cvWorkExperienceEntries?: Array<{
    title?: string;
    company?: string;
    location?: string;
    startDate?: string;
    endDate?: string;
    responsibilities?: string[];
  }>;
  cvPortfolioLinks?: Array<{
    type?: string;
    url?: string;
  }>;
  city?: string;
  country?: string;
  preferredLocation?: string;
  address?: string;
  website?: string;
  extraData?: Record<string, unknown>;
  resume?: string;
  duplicateAction?: 'create' | 'updateExisting' | 'createAnyway';
}

export interface DuplicateCheckCandidate {
  _id: string;
  name: string;
  email?: string;
  phone?: string | null;
  currentCompany?: string | null;
  designation?: string | null;
  stage?: string | null;
}

export interface DuplicateCheckResponse {
  isDuplicate: boolean;
  matchedOn?: 'email' | 'phone';
  candidate?: DuplicateCheckCandidate;
}

export interface ImportedProfileData {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  currentCompany?: string;
  designation?: string;
  currentDesignation?: string;
  experience?: number | string;
  location?: string;
  linkedinUrl?: string;
  source?: string;
  priority?: string;
  tags?: string[];
  skills?: string[];
  expectedSalary?: number;
  currentSalary?: number;
  currency?: string;
  portfolioUrl?: string;
  education?: string;
  certifications?: string[];
  languages?: string[];
  summary?: string;
  city?: string;
  country?: string;
  noticePeriod?: string;
  score?: {
    overall?: number;
    breakdown?: {
      skillsMatch?: number;
      experienceFit?: number;
      educationFit?: number;
      keywordMatch?: number;
    };
    insights?: string[];
  };
  resumeUrl?: string | null;
  resumeFileName?: string | null;
  /** Cloudinary (or other HTTPS) URL for a photo extracted from the CV PDF; null if none. */
  profilePhotoUrl?: string | null;
  educationEntries?: Array<{
    degree?: string;
    institution?: string;
    startYear?: string;
    endYear?: string;
  }>;
  workExperienceEntries?: Array<{
    title?: string;
    company?: string;
    location?: string;
    startDate?: string;
    endDate?: string;
    responsibilities?: string[];
  }>;
  portfolioLinks?: Array<{
    type?: string;
    url?: string;
  }>;
  githubUrl?: string;
  extraData?: Record<string, unknown>;
  rawEmailsFound?: string[];
  rawPhonesFound?: string[];
  tempFilePath?: string;
  parsedAt?: string;
  importedAt?: string;
  isMockData?: boolean;
}

export interface CandidateTagSuggestion {
  id: string;
  name: string;
  label?: string;
  usageCount?: number;
  color?: string;
}

export interface BulkImportResult {
  total: number;
  created: number;
  skipped: number;
  failed: number;
  skippedDetails: Array<{
    row: number;
    email: string;
    reason: string;
  }>;
}

export interface ClientImportPreviewResult {
  fileName: string;
  sheetName: string;
  columns: string[];
  previewRows: Record<string, string | number | boolean | null>[];
  rows?: Record<string, string | number | boolean | null>[];
  totalRows: number;
  columnStats: Record<string, number>;
  suggestedMapping: Record<string, string>;
}

export interface ClientImportExecuteResult {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: string[];
}

export interface ClientImportDuplicateField {
  key: string;
  label: string;
}

export interface ClientImportDuplicateRecord {
  rowIndex: number;
  matchedBy: string[];
  imported: Record<string, string | null>;
  existing: { id: string } & Record<string, string | null>;
}

export interface ClientImportDuplicateCheckResult {
  totalRows: number;
  duplicateCount: number;
  duplicates: ClientImportDuplicateRecord[];
  compareFields: ClientImportDuplicateField[];
}

export type LeadImportPreviewResult = ClientImportPreviewResult;

export type LeadImportExecuteResult = ClientImportExecuteResult;

export interface LeadImportDuplicateField {
  key: string;
  label: string;
}

export interface LeadImportDuplicateRecord {
  rowIndex: number;
  matchedBy: string[];
  imported: Record<string, string | null>;
  existing: { id: string } & Record<string, string | null>;
}

export interface LeadImportDuplicateCheckResult {
  totalRows: number;
  duplicateCount: number;
  duplicates: LeadImportDuplicateRecord[];
  compareFields: LeadImportDuplicateField[];
}

export type AgreementDocumentParseData = {
  terms: {
    agreementLevel?: string;
    agreementServiceChargePercent?: string;
    agreementContractValidity?: string;
    agreementContractStartDate?: string;
    agreementContractEndDate?: string;
    agreementTimePeriod?: string;
    agreementAdvancePaymentPercent?: string;
    agreementFreeReplacementValue?: string;
    agreementFreeReplacementUnit?: 'MONTHS' | 'DAYS';
  };
  filledCount: number;
  textLength?: number;
};

export type KycDocumentParseData = {
  form: Partial<import('../clientKycForm').PostServiceKycFormValues>;
  filledCount: number;
  totalExtractable?: number;
  textLength?: number;
  sourceType?: string;
  message?: string | null;
};

export interface BackendInterviewListItem {
  id: string;
  scheduledAt: string;
  updatedAt?: string;
  createdAt?: string;
  duration: number;
  round?: string | null;
  type: string;
  mode?: string | null;
  platform?: string | null;
  timezone?: string | null;
  meetingLink?: string | null;
  location?: string | null;
  status: string;
  notes?: string | null;
  rsvp?: {
    proposedAt?: string | null;
    proposedTimezone?: string | null;
    proposedNote?: string | null;
    candidateStatus?: string | null;
    recruiterDecision?: string | null;
  } | null;
  candidate?: {
    id: string;
    firstName: string;
    middleName?: string | null;
    lastName: string;
    email: string;
    phone?: string | null;
    avatar?: string | null;
    stage?: string | null;
    status?: string | null;
    extraData?: BackendCandidate['extraData'];
    isPhase1Candidate?: boolean;
  } | null;
  job?: {
    id: string;
    title: string;
    clientId?: string;
    client?: {
      id?: string;
      companyName: string;
    } | null;
  } | null;
  client?: {
    id: string;
    companyName: string;
    location?: string | null;
  } | null;
  createdBy?: {
    id: string;
    name: string;
    email: string;
    avatar?: string | null;
  } | null;
  panel?: Array<{
    id: string;
    role: string;
    user?: {
      id: string;
      name: string;
      email: string;
      avatar?: string | null;
      department?: string | null;
      phone?: string | null;
    } | null;
  }> | null;
  feedbackEntries?: Array<{
    id: string;
    createdAt: string;
    strengths?: string | null;
    weakness?: string | null;
    comments?: string | null;
    recommendation: string;
    aiSummary?: string | null;
    technicalScore: number;
    communicationScore: number;
    problemSolvingScore: number;
    cultureFitScore: number;
    experienceMatchScore: number;
    overallScore: number;
    interviewer: {
      id: string;
      name: string;
      email: string;
      avatar?: string | null;
    } | null;
  }> | null;
  interviewNotes?: Array<{
    id: string;
    note: string;
    createdAt: string;
    author?: {
      id: string;
      name: string;
      email: string;
      avatar?: string | null;
    } | null;
  }> | null;
  activityLogs?: Array<{
    id: string;
    action: string;
    timestamp: string;
    metadata?: any;
    user?: {
      id: string;
      name: string;
      email: string;
      avatar?: string | null;
    } | null;
  }> | null;
  meetingLinkError?: string | null;
  emailsSent?: boolean;
}

export interface BackendInterviewKpis {
  todayCount: number;
  upcomingCount: number;
  pendingFeedbackCount: number;
  completedCount: number;
  conversionRate?: number;
  avgFeedbackTime?: number;
}

export interface BackendInterviewListResponse {
  data: BackendInterviewListItem[];
  total: number;
  page: number;
  totalPages: number;
  kpis: BackendInterviewKpis;
}

export interface CreateInterviewPayload {
  candidateId: string;
  jobId: string;
  clientId: string;
  round: string;
  type: 'VIDEO' | 'PHONE' | 'IN_PERSON' | 'TECHNICAL_TEST' | 'ASSESSMENT' | 'GROUP_DISCUSSION';
  mode: 'ONLINE' | 'OFFLINE';
  date: string;
  duration: number;
  timezone: string;
  meetingPlatform?: 'ZOOM' | 'GOOGLE_MEET' | 'MS_TEAMS' | null;
  location?: string;
  panelUserIds: string[];
  panelRoles?: Record<string, 'HR' | 'TECHNICAL' | 'CLIENT' | 'HIRING_MANAGER'>;
  notes?: string;
  sendCalendarInvite: boolean;
  sendEmailNotification: boolean;
  sendWhatsappReminder: boolean;
}

export interface PublicClientReviewPayload {
  interviewId: string;
  submissionType: 'INITIAL_REVIEW' | 'INTERIM_REVIEW' | 'OFFER_CONFIRMATION' | 'GENERAL';
  candidate: {
    name: string;
    email: string;
    phone: string;
    currentCompany: string;
    designation: string;
    experience: number | null;
    skills: string[];
    languages: string[];
    education: string;
    certifications: string[];
    cvSummary: string;
    address: string;
    city: string;
    country: string;
    linkedIn: string;
    resume: string;
  };
  job: { title: string };
  client: { companyName: string };
  interviewFeedback: Array<{
    id: string;
    interviewerName: string;
    submittedAt: string;
    recommendation: string;
    comments: string;
    strengths: string;
    weakness: string;
    overallScore: number | null;
  }>;
  offerLetterUrl?: string | null;
}

export type InterviewApplicationFormStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export type InterviewApplicationStatus =
  | 'SUBMITTED'
  | 'PENDING_REVIEW'
  | 'IN_INTERVIEW'
  | 'INTERVIEW_COMPLETED'
  | 'APPROVED'
  | 'REJECTED';

export type InterviewApplicationForm = {
  id: string;
  title: string;
  description?: string | null;
  schema: unknown;
  status: InterviewApplicationFormStatus;
  publicToken: string;
  publishedAt?: string | null;
  createdById?: string | null;
  createdAt: string;
  updatedAt: string;
  applicationCount?: number;
};

export type InterviewApplicationRow = {
  id: string;
  interviewFormId: string;
  formName: string;
  candidateId: string;
  candidateName: string;
  candidateEmail?: string | null;
  candidatePhone?: string | null;
  resumeUrl?: string | null;
  responses?: unknown;
  status: InterviewApplicationStatus;
  assignedInterviewerIds: string[];
  interviewNotes?: string | null;
  rating?: number | null;
  feedback?: string | null;
  recommendation?: string | null;
  phase1SubmissionId?: string | null;
  reviewedAt?: string | null;
  decidedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  source?: string;
  formSchema?: unknown;
  candidate?: Record<string, unknown>;
};

export type PlacementInvoiceCreateResponse = Placement & {
  createdInvoice?: { id: string; invoiceNumber?: string | null };
};

export interface BackendMatch {
  id: string;
  candidateId: string;
  jobId: string;
  name: string;
  photo: string;
  initials: string;
  score: number;
  skills: string[];
  experience: number;
  location: string;
  salary: {
    expected: string;
    currency: string;
    amount: number;
    fit: 'excellent' | 'good' | 'average' | 'poor';
  };
  noticePeriod: string;
  status: string;
  /** CRM candidate.stage for job drawer — use this instead of match workflow status */
  candidateStage?: string | null;
  /** Raw Match.status enum (SUGGESTED, SHORTLISTED, …) */
  matchRecordStatus?: string | null;
  candidate?: { stage?: string | null };
  matchSource: 'ai' | 'manual';
  /** True when match came from Phase 1 / candidatecommon pool. */
  isPhase1Candidate?: boolean;
  /** True when match is from the applied-candidate pipeline (tenant assigned to job). */
  isAppliedCandidate?: boolean;
  explanation: {
    skills: boolean | 'partial';
    experience: boolean | 'partial';
    location: boolean | 'partial';
    salary: boolean | 'partial';
    text: string;
    matchedSkills: string[];
    missingSkills: string[];
    roleRequirement: string;
    /** Optional server-provided band; UI can derive from score if absent. */
    scoreBand?: string;
    /** Present when AI tab uses the 4-pass HR matching pipeline (v1). */
    aiEngine?: {
      deterministicScore: number;
      aiScore: number | null;
      verdict: string;
      confidenceLevel: string;
      confidenceScore: number;
      breakdown?: {
        skills?: number;
        experience?: number;
        semantic?: number;
        cultural?: number;
      } & Record<string, number>;
      pipelineWeights?: { p1?: number; p2?: number; p3?: number; p4?: number };
      suggestion?: string;
      runId?: string;
      formula?: string;
    };
  };
  currentTitle: string;
  currentCompany: string;
  email: string;
  phone: string;
  resumeName: string;
  portfolioUrl?: string;
  savedAt?: string | null;
  notes: Array<{
    id: string;
    text: string;
    createdAt: string;
    author: string;
  }>;
  activity: Array<{
    id: string;
    title: string;
    description: string;
    timestamp: string;
  }>;
  matchRating?: number | null;
  submittedHistory?: {
    date: string;
    status: string;
  } | null;
  createdBy?: { name: string };
  createdAt?: string;
  /** CRM candidate owner (assigned recruiter). */
  candidateOwner?: string | null;
  city?: string | null;
  country?: string | null;
  experienceYears?: number | null;
}

export interface BackendLead {
  id: string;
  companyName: string | null;
  contactPerson: string | null;
  directorName?: string | null;
  directorSalutation?: string | null;
  email: string | null;
  phone?: string | null;
  emails?: string[];
  phones?: string[];
  type: 'Company' | 'Individual' | 'Referral';
  source?: 'Website' | 'LinkedIn' | 'Email' | 'Referral' | 'Campaign' | 'Other' | null;
  status: 'New' | 'Contacted' | 'Qualified' | 'Converted' | 'Lost';
  convertedToClientId?: string | null;
  client?: {
    id: string;
    companyName: string;
  } | null;
  priority: 'High' | 'Medium' | 'Low';
  interestedNeeds?: string | null;
  notes?: string | null;
  industry?: string | null;
  companySize?: string | null;
  website?: string | null;
  linkedIn?: string | null;
  location?: string | null;
  designation?: string | null;
  teamMemberDesignation?: string | null;
  teamMemberEmail?: string | null;
  teamMemberPhone?: string | null;
  country?: string | null;
  city?: string | null;
  /** Smart-location autofill metadata sourced from OpenStreetMap/Nominatim. */
  state?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  campaignName?: string | null;
  campaignLink?: string | null;
  referralName?: string | null;
  sourceWebsiteUrl?: string | null;
  sourceLinkedInUrl?: string | null;
  sourceEmail?: string | null;
  sourceOther?: string | null;
  otherDetails?: Array<{ label: string; value: string }> | null;
  lastFollowUp?: string | null;
  nextFollowUp?: string | null;
  lostReason?: string | null;
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
  assignedTo?: {
    id: string;
    name: string;
    email: string;
    avatar?: string | null;
  } | null;
  /** Multi-assignee — all team members the lead is shared with. */
  assignedToIds?: string[];
  /** Hydrated user records for `assignedToIds`, ordered to match. */
  assignedToUsers?: Array<{
    id: string;
    name: string;
    email: string;
    avatar?: string | null;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLeadData {
  companyName?: string | null;
  contactPerson?: string | null;
  directorName?: string;
  directorSalutation?: string | null;
  email?: string | null;
  phone?: string;
  emails?: string[];
  phones?: string[];
  type?: 'Company' | 'Individual' | 'Referral';
  source?: 'Website' | 'LinkedIn' | 'Email' | 'Referral' | 'Campaign' | 'Other';
  status?: string;
  priority?: 'High' | 'Medium' | 'Low';
  interestedNeeds?: string;
  servicesNeeded?: string;
  notes?: string;
  expectedBusinessValue?: string;
  industry?: string;
  sector?: string;
  companySize?: string;
  teamName?: string;
  website?: string;
  companyLinks?: string[];
  linkedIn?: string;
  location?: string;
  designation?: string;
  teamMemberDesignation?: string | null;
  teamMemberEmail?: string | null;
  teamMemberPhone?: string | null;
  country?: string;
  city?: string;
  /** Smart-location autofill metadata. Latitude/Longitude are decimal degrees. */
  state?: string;
  latitude?: number | null;
  longitude?: number | null;
  campaignName?: string;
  campaignLink?: string;
  referralName?: string;
  sourceWebsiteUrl?: string;
  sourceLinkedInUrl?: string;
  sourceEmail?: string;
  sourceOther?: string;
  otherDetails?: Array<{ label: string; value: string }>;
  lastFollowUp?: string;
  nextFollowUp?: string;
  lostReason?: string;
  /**
   * Structured follow-up / meet schedule (type, link, reminder, timezone, attendees).
   * Backend emails invitees for Meet and stores reminder metadata.
   */
  followUpSchedule?: {
    type?: string;
    followUpType?: string;
    contact?: string;
    followUpContact?: string;
    meetLink?: string;
    followUpMeetLink?: string;
    reminder?: string;
    followUpReminder?: string;
    timezone?: string;
    followUpTimezone?: string;
    attendeeIds?: string[];
    followUpAttendeeIds?: string[];
    notes?: string;
    followUpNotes?: string;
    postponed?: boolean;
    postponeReason?: string;
  };
  /** Agreements & Terms — single primary document uploaded against the lead. */
  agreementsFileName?: string | null;
  agreementsFileUrl?: string | null;
  agreementsUploadedAt?: string | null;
  agreementTotalPayment?: string | null;
  agreementLevel?: string | null;
  agreementServiceChargePercent?: string | null;
  agreementTimePeriod?: string | null;
  agreementAdvancePaymentPercent?: string | null;
  agreementFreeReplacementValue?: number | null;
  agreementFreeReplacementUnit?: 'MONTHS' | 'DAYS' | null;
  assignedToId?: string;
  /** Multi-assignee list. First item also written to `assignedToId` (primary). */
  assignedToIds?: string[];
  /** Display name(s) for assignee(s) — used by HQ leadOwner snapshot. */
  assignedToName?: string;
  /**
   * Optional remark when changing status from the leads table.
   * Used only for activity logging; not stored directly on the Lead model.
   */
  statusRemark?: string;
  /**
   * When true, always insert a new lead even if an existing live lead shares
   * the same company name (used by "Create anyway" after duplicate warning).
   */
  forceNew?: boolean;
}

export interface BackendActivity {
  id: string;
  action: string;
  description: string | null;
  performedBy: {
    id: string;
    name: string;
    email: string;
    avatar: string | null;
  };
  /** Some activity payloads use `user` instead of `performedBy`. */
  user?: {
    id: string;
    name: string;
    email: string;
    avatar: string | null;
  };
  entityType: string;
  entityId: string | null;
  metadata: any;
  createdAt: string;
}

export type CrmAssignableMember = {
  id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  role?: { id?: string; roleName?: string; color?: string };
  department?: { id?: string; name?: string };
  orgUnit?: { id?: string; name?: string; kind?: string } | null;
};

export interface ConvertLeadToClientData {
  companyName?: string;
  industry?: string;
  companySize?: string;
  website?: string;
  address?: string;
  linkedin?: string;
  location?: string;
  city?: string;
  state?: string;
  country?: string;
  latitude?: number | null;
  longitude?: number | null;
  hiringLocations?: string;
  servicesNeeded?: string;
  expectedBusinessValue?: string;
  priority?: string;
  assignedToId?: string;
  directorSalutation?: string;
  directorName?: string;
  contactPerson?: string;
  primaryContact?: string;
  email?: string;
  phone?: string;
  emails?: string[];
  phones?: string[];
  teamMemberDesignation?: string | null;
  teamMemberEmail?: string | null;
  teamMemberPhone?: string | null;
  otherDetails?: Array<{ label: string; value: string }>;
  nextFollowUpDue?: string | null;
  agreementsFileName?: string | null;
  agreementsFileUrl?: string | null;
  agreementsUploadedAt?: string | null;
  agreementLevel?: string | null;
  agreementServiceChargePercent?: string | null;
  agreementContractValidity?: string | null;
  agreementContractStartDate?: string | null;
  agreementContractEndDate?: string | null;
  agreementTimePeriod?: string | null;
  agreementAdvancePaymentPercent?: string | null;
  agreementFreeReplacementValue?: number | null;
  agreementFreeReplacementUnit?: 'MONTHS' | 'DAYS' | null;
  requestNote?: string;
}

// ────────────────────────────────────────────────────────────
// Clients
// ────────────────────────────────────────────────────────────

export interface BackendClient {
  id: string;
  companyName: string;
  industry?: string | null;
  website?: string | null;
  logo?: string | null;
  location?: string | null;
  status: 'ACTIVE' | 'PROSPECT' | 'ON_HOLD' | 'INACTIVE';
  assignedTo?: {
    id: string;
    name: string;
    email: string;
    avatar?: string | null;
  } | null;
  companySize?: string | null;
  hiringLocations?: string | null;
  servicesNeeded?: string | null;
  expectedBusinessValue?: string | null;
  leadStatus?: string | null;
  linkedin?: string | null;
  timezone?: string | null;
  clientSince?: string | null;
  priority?: string | null;
  sla?: string | null;
  nextFollowUpDue?: string | null;
  /** Smart-location autofill metadata (shared with Lead). */
  city?: string | null;
  state?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  /** Salutation captured on the Add Client form alongside the primary director. */
  directorSalutation?: string | null;
  teamMemberDesignation?: string | null;
  teamMemberEmail?: string | null;
  teamMemberPhone?: string | null;
  /** Director / company contact channels (primary also on Contact when applicable). */
  emails?: string[];
  phones?: string[];
  /** Agreements & Terms — single primary document uploaded against the client. */
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
  postServiceKycForm?: PostServiceKycFormValues | null;
  otherDetails?: Array<{ label: string; value: string }> | null;
  avgTimeToFill?: string | null;
  healthStatus?: string | null;
  revenueGenerated?: string | null;
  billingTotalRevenue?: string | null;
  billingOutstanding?: string | null;
  billingPaid?: string | null;
  /** When true, this client appears in Recruitment Clients and Add Job. */
  recruitmentEnabled?: boolean | null;
  recruitmentEnabledAt?: string | null;
  recruitmentEnabledBy?: string | null;
  /** Created from Recruitment Clients — omitted from the CRM Clients list. */
  createdInRecruitment?: boolean | null;
  contacts?: Array<{
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    designation?: string | null;
    department?: string | null;
    email?: string | null;
    phone?: string | null;
    lastContacted?: string | null;
    createdAt?: string | null;
  }>;
  createdAt: string;
  updatedAt: string;
  _count?: {
    jobs?: number;
    contacts?: number;
    placements?: number;
  };
}

export type RecruitmentForwardMember = {
  id: string;
  name: string;
  email?: string;
  isSelf?: boolean;
};

export type RecruitmentForwardOrganization = {
  id: string;
  name: string;
  members: RecruitmentForwardMember[];
};

export type RecruitmentForwardTargets = {
  companyName?: string;
  hasCompanies?: boolean;
  organizations?: RecruitmentForwardOrganization[];
};

export interface ClientMetrics {
  activeClients: {
    value: number;
    trend: number;
    trendUp: boolean;
  };
  openJobs: {
    value: number;
    trend: number;
    trendUp: boolean;
  };
  candidatesInProgress: {
    value: number;
    trend: number;
    trendUp: boolean;
  };
  placementsThisMonth: {
    value: number;
    trend: number;
    trendUp: boolean;
  };
  revenueGenerated: {
    value: number;
    formatted: string;
    trend: number;
    trendUp: boolean;
  };
}

export interface ScheduledMeeting {
  id: string;
  clientId: string;
  scheduledById: string;
  meetingType: string;
  scheduledAt: string;
  reminder?: string | null;
  notes?: string | null;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED';
  completedAt?: string | null;
  cancelledAt?: string | null;
  cancelledBy?: string | null;
  createdAt: string;
  updatedAt: string;
  scheduledBy?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email: string;
    avatar?: string | null;
  };
  cancelledByUser?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email: string;
  } | null;
}

export type UnifiedCalendarEventType =
  | 'JOB_CREATED'
  | 'TASK'
  | 'INTERVIEW'
  | 'CLIENT_MEETING'
  | 'CLIENT_FOLLOW_UP';

export interface UnifiedCalendarEvent {
  id: string;
  type: UnifiedCalendarEventType;
  entityType: string;
  entityId: string;
  title: string;
  subtitle?: string | null;
  start: string;
  end?: string | null;
  allDay: boolean;
  status?: string | null;
  priority?: string | null;
  color: string;
  route: string;
  description?: string | null;
  metadata: Record<string, string | number | boolean | null>;
}

export interface UnifiedCalendarResponse {
  range: {
    start: string;
    end: string;
  };
  scope?: {
    mineOnly: boolean;
    userId: string | null;
  };
  summary: {
    total: number;
    jobs: number;
    tasks: number;
    interviews: number;
    meetings: number;
    followUps: number;
  };
  events: UnifiedCalendarEvent[];
}

export interface CreateScheduledMeetingData {
  meetingType: string;
  scheduledAt: string; // ISO datetime string
  reminder?: string;
  notes?: string;
  contact?: string;
  meetLink?: string;
  timezone?: string;
  attendeeIds?: string[];
  followUpNotes?: string;
  followUpSchedule?: {
    type?: string;
    contact?: string;
    meetLink?: string;
    reminder?: string;
    timezone?: string;
    attendeeIds?: string[];
    notes?: string;
    postponed?: boolean;
    postponeReason?: string;
  };
}

export interface UpdateScheduledMeetingData {
  meetingType?: string;
  scheduledAt?: string;
  reminder?: string;
  notes?: string;
  status?: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED';
}

export interface BackendClientNote {
  id: string;
  clientId: string;
  title: string;
  content?: string | null;
  tags: string[];
  createdById: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: {
    id: string;
    name?: string | null;
    email: string;
    avatar?: string | null;
  };
}

export interface CreateClientNoteData {
  title: string;
  content?: string;
  tags?: string[];
}

export interface UpdateClientNoteData {
  title?: string;
  content?: string;
  tags?: string[];
  isPinned?: boolean;
}

export interface BackendLeadNote {
  id: string;
  leadId: string;
  title: string;
  content?: string | null;
  tags: string[];
  createdById: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: {
    id: string;
    name?: string | null;
    email: string;
    avatar?: string | null;
  };
}

export interface CreateLeadNoteData {
  title: string;
  content?: string;
  tags?: string[];
}

export interface UpdateLeadNoteData {
  title?: string;
  content?: string;
  tags?: string[];
  isPinned?: boolean;
}

export interface BackendJobNote {
  id: string;
  jobId: string;
  title: string;
  content?: string | null;
  tags: string[];
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: {
    id: string;
    name: string;
    email: string;
    avatar?: string | null;
  };
}

export interface CreateJobNoteData {
  title: string;
  content?: string;
  tags?: string[];
  isPinned?: boolean;
}

export interface UpdateJobNoteData {
  title?: string;
  content?: string;
  tags?: string[];
  isPinned?: boolean;
}

export type JobClientRemark = {
  id: string;
  clientName: string;
  jobTitle?: string | null;
  tag?: string | null;
  comments?: string | null;
  documentUrl?: string | null;
  documentFileName?: string | null;
  documentLabel?: string | null;
  repliedAt?: string | null;
  submissionType?: string | null;
};

export type JobClientRemarkCandidate = {
  candidateId: string;
  candidateName: string;
  email?: string | null;
  avatar?: string | null;
  submittedAt?: string | null;
  waiting: boolean;
  remarks: JobClientRemark[];
};

export type JobClientRemarksPayload = {
  jobId: string;
  jobTitle: string;
  clientName: string;
  remarkCount: number;
  candidates: JobClientRemarkCandidate[];
};

export interface BackendContact {
  id: string;
  salutation?: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  phone?: string | null;
  linkedinUrl?: string | null;
  designation?: string | null;
  department?: string | null;
  location?: string | null;
  contactType: 'CANDIDATE' | 'CLIENT' | 'HIRING_MANAGER' | 'INTERVIEWER' | 'VENDOR' | 'DECISION_MAKER' | 'FINANCE';
  status: 'ACTIVE' | 'INACTIVE';
  companyId?: string | null;
  ownerId?: string | null;
  avatarUrl?: string | null;
  tags: string[];
  associatedJobIds: string[];
  lastContacted?: string | null;
  createdAt: string;
  updatedAt: string;
  // Additional optional fields that may be present
  title?: string | null;
  isPrimary?: boolean;
  avatar?: string | null;
  preferredChannel?: 'Email' | 'Phone' | 'WhatsApp' | null;
  notesText?: string | null;
  company?: {
    id: string;
    companyName: string;
  };
  owner?: {
    id: string;
    name: string;
    email: string;
    avatar?: string | null;
  };
  notes?: BackendContactNote[];
  activities?: BackendContactActivity[];
  communications?: BackendContactCommunication[];
  associatedJobs?: Array<{ id: string; title: string; status: string }>;
  auditMeta?: import('../../types/audit').AuditMeta | null;
}

export interface BackendContactNote {
  id: string;
  contactId: string;
  note: string;
  authorId: string;
  createdAt: string;
  author?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface BackendContactActivity {
  id: string;
  contactId: string;
  activityType: string;
  description: string;
  userId: string;
  timestamp: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface BackendContactCommunication {
  id: string;
  contactId: string;
  type: string;
  subject?: string | null;
  message: string;
  direction: string;
  timestamp: string;
}

export interface ContactFilters {
  contactType?: string;
  type?: string; // Alias for contactType
  companyId?: string;
  clientId?: string; // Alias for companyId when filtering by client
  location?: string;
  tags?: string[];
  ownerId?: string;
  status?: string;
  recentlyContacted?: '7d' | '30d' | 'all';
  search?: string;
  page?: number;
  limit?: number;
}

export interface CreateContactData {
  salutation?: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  companyId?: string;
  clientId?: string; // Alias for companyId when creating for a client
  designation?: string;
  department?: string;
  location?: string;
  linkedinUrl?: string;
  contactType?: 'CANDIDATE' | 'CLIENT' | 'HIRING_MANAGER' | 'INTERVIEWER' | 'VENDOR' | 'DECISION_MAKER' | 'FINANCE';
  status?: 'ACTIVE' | 'INACTIVE';
  ownerId?: string;
  avatarUrl?: string;
  tags?: string[];
  associatedJobIds?: string[];
  isPrimary?: boolean;
  notes?: string;
  preferredChannel?: 'Email' | 'Phone' | 'WhatsApp';
  whatsAppSameAsPhone?: boolean;
}

export interface ContactStats {
  total: number;
  candidates: number;
  clientContacts: number;
  hiringManagers: number;
}

export interface ContactImportPreviewResult {
  sheetName: string;
  columns: string[];
  previewRows: Record<string, string | number | boolean | null>[];
  totalRows: number;
  suggestedMapping: Record<string, string>;
  columnStats: Record<string, number>;
}

export interface ContactImportExecuteResult {
  imported: number;
  skipped: number;
  updated: number;
}

export interface CreateClientData {
  companyName: string;
  industry?: string;
  website?: string;
  logo?: string;
  location?: string;
  status?: 'ACTIVE' | 'PROSPECT' | 'ON_HOLD' | 'INACTIVE';
  /** Lead-style status snapshot. The Add Client form (mirroring Add Lead) writes here. */
  leadStatus?: string;
  assignedToId?: string;
  companySize?: string;
  hiringLocations?: string;
  servicesNeeded?: string;
  expectedBusinessValue?: string;
  linkedin?: string;
  timezone?: string;
  priority?: string;
  sla?: string;
  nextFollowUpDue?: string | null;
  /** Smart-location autofill metadata (shared with Lead). */
  city?: string;
  state?: string;
  country?: string;
  latitude?: number | null;
  longitude?: number | null;
  /** Salutation captured on the Add Client form alongside the primary director. */
  directorSalutation?: string;
  teamMemberDesignation?: string | null;
  teamMemberEmail?: string | null;
  teamMemberPhone?: string | null;
  email?: string;
  phone?: string;
  emails?: string[];
  phones?: string[];
  /** Agreements & Terms — single primary document uploaded against the client. */
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
  postServiceKycForm?: PostServiceKycFormValues | null;
  otherDetails?: Array<{ label: string; value: string }>;
  recruitmentEnabled?: boolean;
}

export interface UpdateClientData {
  companyName?: string;
  industry?: string;
  website?: string;
  logo?: string;
  location?: string;
  status?: 'ACTIVE' | 'PROSPECT' | 'ON_HOLD' | 'INACTIVE';
  /** Lead-style status snapshot. The Add Client form (mirroring Add Lead) writes here. */
  leadStatus?: string | null;
  assignedToId?: string | null;
  companySize?: string | null;
  hiringLocations?: string | null;
  servicesNeeded?: string | null;
  expectedBusinessValue?: string | null;
  linkedin?: string | null;
  timezone?: string | null;
  priority?: string | null;
  sla?: string | null;
  nextFollowUpDue?: string | null;
  /** Smart-location autofill metadata (shared with Lead). */
  city?: string | null;
  state?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  /** Salutation captured on the Add Client form alongside the primary director. */
  directorSalutation?: string | null;
  teamMemberDesignation?: string | null;
  teamMemberEmail?: string | null;
  teamMemberPhone?: string | null;
  email?: string | null;
  phone?: string | null;
  emails?: string[];
  phones?: string[];
  /** Agreements & Terms — single primary document uploaded against the client. */
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
  postServiceKycForm?: PostServiceKycFormValues | null;
  otherDetails?: Array<{ label: string; value: string }>;
  recruitmentEnabled?: boolean;
}

export interface BackendGlobalActivity {
  id: string;
  action: string;
  description?: string | null;
  entityType: string;
  entityId?: string | null;
  category?: string | null;
  relatedLabel?: string | null;
  metadata?: unknown;
  createdAt: string;
  displaySummary?: string | null;
  displayKind?: 'create' | 'update' | 'delete' | 'info' | string | null;
  performedBy: {
    id: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    email: string;
    avatar?: string | null;
    systemRole?: { roleName?: string };
    departmentRelation?: { id: string; name: string } | null;
  };
}

export type ActivityVisibilityCapabilities = {
  level: 'self' | 'department' | 'tenant';
  canViewMembers: boolean;
  canViewDepartments: boolean;
  canViewTeam: boolean;
  viewerRank: number | null;
  departmentId?: string | null;
  departmentName?: string | null;
};

export type ActivityViewableMember = {
  id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  designation?: string;
  avatar?: string | null;
  departmentId?: string;
  role?: { roleName?: string; color?: string } | null;
  department?: { id: string; name: string } | null;
};

export type ActivityViewableDepartment = {
  id: string;
  name: string;
  memberCount: number;
};

export interface BackendTask {
  id: string;
  title: string;
  description?: string | null;
  dueDate: string;
  dueTime?: string | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'PENDING' | 'TODO' | 'IN_PROGRESS' | 'AWAITING_APPROVAL' | 'DONE' | 'CANCELLED';
  taskType?: string | null;
  assignedToId: string;
  createdById: string;
  participantIds?: string[];
  completionRequestedById?: string | null;
  completionRequestedAt?: string | null;
  completionApproverId?: string | null;
  linkedEntityType?: 'CANDIDATE' | 'JOB' | 'CLIENT' | 'INTERVIEW' | 'INTERNAL' | 'TEAM_REQUEST' | null;
  linkedEntityId?: string | null;
  reminder?: string | null;
  reminderChannel?: string | null;
  attachments: string[];
  notifyAssignee: boolean;
  notes: string[];
  createdAt: string;
  updatedAt: string;
  assignedTo: {
    id: string;
    name: string;
    email: string;
  };
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
  files?: TaskFile[];
  isOverdue?: boolean;
}

export interface CreateTaskData {
  title: string;
  description?: string;
  relatedTo?: 'Candidate' | 'Job' | 'Client' | 'Interview' | 'Internal' | 'Team Request';
  relatedEntityId?: string;
  assigneeId: string;
  priority: 'Low' | 'Medium' | 'High';
  dueDate: string;
  dueTime?: string;
  time?: string;
  reminder?: string;
  reminderChannel?: string;
  attachmentNames?: string;
  attachments?: string[];
  notifyAssignee?: boolean;
  notes?: string[];
  taskType?: string;
  type?: string;
  completionApproverId?: string;
  status?: 'Pending' | 'In Progress' | 'Completed' | 'Cancelled' | 'PENDING' | 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
}

export interface UpdateTaskData extends Partial<CreateTaskData> {
  id?: string;
}

export interface TaskStats {
  completedToday: number;
  overdueCount: number;
  avgCompletionTimeDays: number;
  productivityPercent: number;
  dueToday: number;
  overdue: number;
  upcoming7d: number;
  completed: number;
  trendCompletedToday?: string;
}

export type TaskAssignableMember = {
  id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  role?: { id?: string; roleName?: string; color?: string };
  department?: { id?: string; name?: string };
  orgUnit?: { id?: string; name?: string; kind?: string } | null;
};

export interface TaskFile {
  id: string;
  taskId: string;
  fileName: string;
  fileType?: string | null;
  fileUrl: string;
  fileSize?: number | null;
  uploadedById: string;
  uploadDate: string;
  createdAt: string;
  updatedAt: string;
  uploadedBy: {
    id: string;
    name: string;
    email: string;
  };
}

export interface JobFile {
  id: string;
  jobId: string;
  fileName: string;
  fileType: string;
  fileUrl: string | null;
  fileSize?: number;
  description?: string | null;
  uploadedById: string;
  uploadDate: string;
  createdAt: string;
  updatedAt: string;
  uploadedBy?: {
    id: string;
    name: string;
    email: string;
  };
}

export type FileEntityType = 'job' | 'lead' | 'client' | 'candidate' | 'interview';

export interface EntityFile {
  id: string;
  fileName: string;
  fileType: string;
  fileUrl: string | null;
  uploadDate: string;
  uploadedBy?: {
    id: string;
    name: string;
    email?: string;
    avatar?: string | null;
  };
}

/** Get files for any entity (job, lead, client). Use in job drawer, client drawer, etc. */

export type EntityChatType =
  | 'CANDIDATE'
  | 'JOB'
  | 'CLIENT'
  | 'INTERVIEW'
  | 'TASK'
  | 'LEAD'
  | 'CONTACT'
  | 'USER';

export interface InboxMessage {
  id: string;
  threadId: string;
  body: string;
  attachments: string[];
  createdAt: string;
  updatedAt: string;
  sender: {
    id: string;
    name: string;
    email: string;
    avatar?: string | null;
  };
}

export interface InboxThread {
  id: string;
  subject?: string | null;
  relatedEntityType?: EntityChatType | null;
  relatedEntityId?: string | null;
  createdAt: string;
  updatedAt: string;
  participants: {
    user: {
      id: string;
      name: string;
      email: string;
      avatar?: string | null;
    };
  }[];
  messages: InboxMessage[];
}

export interface GmailInboxMessage {
  id: string;
  threadId: string;
  sender: string;
  email: string;
  subject: string;
  preview: string;
  timestamp: string | null;
  unread: boolean;
  starred: boolean;
  hasAttachment: boolean;
  candidate?: string;
  job?: string;
  client?: string;
  type?: string;
  to?: string;
  cc?: string;
  body?: string;
  htmlBody?: string;
  attachments?: any[];
}

export interface GmailInboxResponse {
  connected: boolean;
  email?: string;
  messages: GmailInboxMessage[];
  nextPageToken?: string | null;
  requiresReconnect?: boolean;
  mailboxUnavailable?: boolean;
}

export interface GmailMessageActionResult {
  success: boolean;
  messageId: string;
  unread?: boolean;
  starred?: boolean;
  eventId?: string;
  eventLink?: string;
}

export interface MailboxStatusResponse {
  gmail: { connected: boolean; email?: string };
  outlook: { connected: boolean; email?: string };
}

export type OutlookComposeDraftResult = {
  id: string;
  email?: string;
  sent?: boolean;
  webLink?: string | null;
  openUrl?: string | null;
};

export type OutlookSendMailResult = {
  sent: boolean;
  email?: string;
  to?: string;
  cc?: string;
  bcc?: string;
};

/** Create a draft in the connected Outlook mailbox (open in Outlook for signature). */

export type MailboxSignatureResult = {
  connected: boolean;
  email?: string;
  html?: string;
  text?: string;
  source?: 'provider' | 'none' | string;
  requiresReconnect?: boolean;
  unsupported?: boolean;
};

/** Fetch signature from the connected Gmail send-as settings (empty if none / needs reconnect). */

export type SocialPublishingAccount = {
  id: string;
  key: string;
  name: string;
  type?: 'personal' | 'page';
  picture?: string | null;
  accountEmail?: string | null;
  connected?: boolean;
  expired?: boolean;
  organizationId?: string;
  parentAccountId?: string;
  /** Team member who connected this LinkedIn (tenant-shared). */
  ownerUserId?: string | null;
  ownerName?: string | null;
  /** True when the current user owns this connection. */
  isOwn?: boolean;
};

export interface LinkedInStatus {
  connected: boolean;
  expired?: boolean;
  name?: string;
  picture?: string;
  accounts?: SocialPublishingAccount[];
}

export interface LinkedInPostJobData {
  jobTitle: string;
  company: string;
  description?: string;
  applyUrl: string;
  location?: string;
  postText?: string; // Optional custom post text
}

export interface LinkedInPostJobResponse {
  success: boolean;
  linkedinPostUrl: string;
  postId?: string;
}

export interface SocialPublishData {
  jobId: string;
  title: string;
  companyName: string;
  showClientNamePublicly?: boolean;
  description?: string;
  applyUrl: string;
  location?: string;
  platforms: {
    linkedin?: boolean;
    twitter?: boolean;
    facebook?: boolean;
  };
  linkedinPostText?: string;
  twitterPostText?: string;
  facebookPostText?: string;
  linkedinTargets?: string[];
  twitterTargets?: string[];
  /** Public image URL attached to the LinkedIn share (JPG/PNG/GIF). */
  linkedinImageUrl?: string;
}

export type CommunicationJobBoardKey = 'LinkedIn' | 'Indeed' | 'Naukri';

export interface CommunicationSettingsShape {
  defaultEmails: string[];
  defaultSendingEmail: string;
  twilioAccountSid: string;
  twilioAuthToken: string;
  smsAutoNotifications: boolean;
  googleCalendarSync: boolean;
  teamsCalendarSync: boolean;
  teamsTenantId: string;
  teamsClientId: string;
  teamsClientSecret: string;
  interviewAutoScheduling: boolean;
  emailComposeSignature: string;
  emailComposeSignatureLogoUrl: string;
}

export type ConnectionStatus = { connected: boolean; email?: string; pageName?: string };

export type CommunicationConnections = {
  gmail: ConnectionStatus;
  googleCalendar: ConnectionStatus;
  outlook: ConnectionStatus;
  teams: ConnectionStatus;
  linkedin: ConnectionStatus;
};

export type CommunicationFullResponse = {
  settings: CommunicationSettingsShape;
  connections: CommunicationConnections;
  jobBoardKeys: {
    LinkedIn: { apiKey: string; clientId: string; connected: boolean };
    Indeed: { apiKey: string; publisherId: string; connected: boolean };
    Naukri: { apiKey: string; clientId: string; connected: boolean };
  };
  linkedinApp: { clientId: string; clientSecret: string };
};

export type PutCommunicationBody = {
  settings?: Partial<CommunicationSettingsShape>;
  jobBoardKeys?: Partial<CommunicationFullResponse['jobBoardKeys']>;
  linkedinApp?: Partial<CommunicationFullResponse['linkedinApp']>;
};

export type NotificationTriggerSettingsPayload = {
  active: Record<string, boolean>;
  additional: Array<{ id: string; label: string; enabled: boolean }>;
};

export type NotificationTriggerEffectiveTemplate = {
  subject: string;
  bodyHtml: string;
  variables: string[];
  customized: boolean;
};

export type NotificationTriggerTemplateOverride = {
  subject?: string;
  bodyHtml?: string;
  customized?: boolean;
};

export type AlertChannelSettings = {
  email: boolean;
  portal: boolean;
};

export type AlertExamplePreview = {
  portalTitle: string;
  portalBody: string;
  emailSubject: string;
  shownIn: string;
};

export type AlertDefinition = {
  id: string;
  module: string;
  label: string;
  description: string;
  emailTriggerId?: string | null;
  category: string;
  severity: 'info' | 'warning' | 'critical' | string;
  defaultEmail: boolean;
  defaultPortal: boolean;
  examplePreview?: AlertExamplePreview | null;
};

export type AlertCatalogGroup = {
  module: string;
  alerts: AlertDefinition[];
};

export type ScheduledAnalysisSettings = {
  enabled: boolean;
  /** 24-hour local time HH:mm */
  time: string;
  /** IANA timezone */
  timezone: string;
};

export type AlertManagementPayload = {
  catalog: AlertCatalogGroup[];
  channels: Record<string, AlertChannelSettings>;
  scheduledAnalysis?: ScheduledAnalysisSettings;
  scope?: string;
  updatedAt?: string | null;
};

export type AriaUndoPayload = {
  available: boolean;
  actionId: string;
  expiresAt: string;
  expiresInSeconds: number;
  label: string;
  action: 'DELETE' | 'BULK_DELETE' | 'UPDATE' | 'RESTORE' | 'PLACEMENT_UNDO';
  endpoint: string;
  method: string;
  targetIds?: string[];
  reverseData?: {
    id: string;
    snapshot: any;
  };
  uiReverse: {
    action: 'DELETE_ROW' | 'BULK_DELETE_ROWS' | 'UPDATE_ROW' | 'FLASH_ROW' | 'RESTORE_ROW';
    target: string;
    rowId?: string;
    rowIds?: string[];
    metricsRollback?: Record<string, { delta: number }>;
    toast?: { type: 'success' | 'info' | 'warning'; message: string; duration: number };
  };
};

export type AriaUiPayload = {
  action: 'INSERT_ROW' | 'BULK_INSERT_ROWS' | 'UPDATE_ROW' | 'DELETE_ROW' | 'UPDATE_METRIC_CARDS' | 'OPEN_DRAWER' | 'NAVIGATE' | 'REFRESH_MODULE';
  target: string;
  data?: any;
  metricsUpdate?: Record<string, { delta: number; newTotal?: number }>;
  toast?: {
    type: 'success' | 'info' | 'warning' | 'error';
    message: string;
    duration: number;
    actions?: Array<{ label: string; actionId: string; style?: string; expiresIn?: number }>;
  };
};

export type AriaChatDetail = { label: string; value: string };

export type AriaSuggestion = {
  label: string;
  action: string;
  params: Record<string, any>;
};

export type AriaChatOutput = {
  headline: string;
  summary: string;
  details: AriaChatDetail[];
  warnings?: string[];
  aiInsights?: string[];
  undoLine?: string;
  suggestions: AriaSuggestion[];
  bulkRows?: Array<{
    status: 'created' | 'skipped' | 'failed';
    label: string;
    id?: string;
    reason?: string;
  }>;
};

export type AssistantStructuredResponse = {
  intent: string;
  module: string;
  currentPage: string;
  isBulk: boolean;
  recordCount: number;
  clarificationNeeded: boolean;
  clarificationQuestion: string | null;
  sessionId: string;
  memoryUpdated: boolean;
  actions: Array<{
    step: number;
    method: string;
    endpoint: string;
    payload: any;
    idempotencyKey: string;
    status: string;
    responseId?: string;
  }>;
  result: {
    status: 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'PENDING' | 'CLARIFICATION_NEEDED';
    created: number;
    updated: number;
    deleted: number;
    skipped: number;
    failed: number;
    records: any[];
    errors: any[];
  };
  chatOutput: AriaChatOutput;
  uiPayload?: AriaUiPayload;
  undoPayload?: AriaUndoPayload;
  memoryUpdate?: {
    lastAction?: {
      type: string;
      module: string;
      recordId: string;
      recordLabel: string;
      timestamp: string;
      page: string;
    };
    addToRecentEntities?: {
      type: string;
      id: string;
      label: string;
    };
    addToUndoStack?: string;
  };
  plan?: string[];
  output?: string;
};

export type AriaLeadsUiPayload = {
  action: 'INSERT_ROW' | 'REPLACE_TABLE' | 'UPDATE_ROW' | 'DELETE_ROW' | 'BULK_INSERT' | string;
  target?: string;
  data?: any;
};

export type AriaLeadsResponse = {
  success: boolean;
  result?: any;
  uiPayload?: AriaLeadsUiPayload;
  clarificationNeeded?: boolean;
  message?: string;
  missingFields?: string[];
};

export type IntegrationProvider =
  | 'gmail'
  | 'outlook'
  | 'google-calendar'
  | 'zoom'
  | 'google-meet'
  | 'microsoft-teams'
  | 'linkedin'
  | 'twitter'
  | 'facebook';

export type IntegrationStatusItem = {
  connected: boolean;
  provider: IntegrationProvider | string;
  label: string;
  accountEmail?: string;
  accountName?: string;
  scope?: string[];
  expiresAt?: string | null;
};

export type IntegrationStatusResponse = Record<string, IntegrationStatusItem>;

export type AssistantChatMessage = { role: 'user' | 'assistant'; content: string };

export type AssistantHistoryMessage = AssistantChatMessage & { id: string };

export type AssistantTaskChain = {
  task_id: string;
  goal: string;
  steps: string[];
  completed_steps: string[];
  pending_steps: string[];
  status: 'in_progress' | 'completed' | 'pending';
};

export type AssistantConversationMemory = {
  userIntent: string;
  lastActions: string[];
  currentPageContext: string;
  userPreferences: string[];
  frequentlyUsedActions: string[];
  updatedAt?: string | null;
};

export type AssistantActionLogItem = {
  action_id: string;
  entity: string;
  operation: string;
  previous_state?: unknown;
  new_state?: unknown;
  summary: string;
  createdAt?: string;
};

export type AssistantHistoryRecord = {
  pageKey: string;
  pathname?: string | null;
  messages: AssistantHistoryMessage[];
  conversationMemory?: AssistantConversationMemory;
  taskMemory?: {
    tasks: AssistantTaskChain[];
  };
  actionLog?: AssistantActionLogItem[];
  updatedAt?: string | null;
};

/** In-app AI assistant (floating bot). Requires backend OPENAI_API_KEY. */

export type BrainAskResult = {
  reply: string;
  intent?: string;
  entities?: string[];
  usedTools?: string[];
  retrieval?: { chunkIds?: string[]; entities?: string[] };
  auditId?: string;
  llmEnabled?: boolean;
  durationMs?: number;
};

export type JobCreationPipelineResult = {
  nationality: string;
  jobTitle: string;
  priority: string;
  companyName: string;
  companyId: string;
  numberOfOpenings: string;
  country: string;
  state: string;
  city: string;
  industryType: string;
  employmentType: string;
  targetHireDate: string;
  minExperience: number;
  maxExperience: number;
  payRangeMin: string;
  payRangeMax: string;
  salaryCurrency: string;
  salaryInput: string;
  jobLocation: string;
  jobLocationType: string;
  jobType: string;
  languages: Array<{ language: string; proficiency: string }>;
  skills: string[];
  jobDescriptionHtml: string;
  jobSummary: string;
  keyResponsibilitiesText: string;
  qualificationsExperienceText: string;
  candidateRequirementsText: string;
  compensationBenefitsText: string;
  additionalSections?: Array<{ title: string; bodyText: string }>;
  educationalQualification: string;
  educationalSpecialization: string;
  extractedTextLength?: number;
  jobParseMeta?: Record<string, unknown>;
};

export type LeadAiGeneratedDetails = {
  companyName: string;
  contactPerson: string;
  directorSalutation?: string;
  designation: string;
  email: string;
  phone: string;
  emails?: string[];
  phones?: string[];
  type: 'Company' | 'Individual' | 'Referral';
  source: 'Website' | 'LinkedIn' | 'Email' | 'Referral' | 'Campaign' | 'Other';
  status: 'New' | 'Contacted' | 'Qualified' | 'Converted' | 'Lost';
  priority: 'High' | 'Medium' | 'Low';
  interestedNeeds: string;
  notes: string;
  expectedBusinessValue?: string;
  industry: string;
  companySize: string;
  website: string;
  linkedIn: string;
  location: string;
  country: string;
  city: string;
  state?: string;
  campaignName: string;
  campaignLink: string;
  referralName: string;
  sourceWebsiteUrl: string;
  sourceLinkedInUrl: string;
  sourceEmail: string;
  sourceOther?: string;
  otherDetails: Array<{ label: string; value: string }>;
  lastFollowUp: string;
  nextFollowUp: string;
  assignedToId: string;
  assignedToName?: string;
  companyLinks?: string[];
  teamMemberSalutation?: string;
  teamMemberName?: string;
  teamMemberDesignation?: string;
  teamMemberEmail?: string;
  teamMemberPhone?: string;
};

export type LeadAiChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type ClientAiGeneratedDetails = {
  companyName: string;
  directorName: string;
  directorSalutation: string;
  designation: string;
  email: string;
  phone: string;
  emails?: string[];
  phones?: string[];
  industry: string;
  companySize: string;
  website: string;
  linkedIn: string;
  location: string;
  country: string;
  city: string;
  state?: string;
  timezone: string;
  leadStatus: string;
  priority: string;
  servicesNeeded: string;
  expectedBusinessValue: string;
  nextFollowUpDue: string;
  assignedToId: string;
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
  otherDetails: Array<{ label: string; value: string }>;
};

export type CandidateAiGeneratedDetails = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  age?: string;
  cityState?: string;
  address?: string;
  zip?: string;
  nationality?: string;
  maritalStatus?: string;
  birthDate?: string;
  passportNumber?: string;
  currentCompany?: string;
  currentDesignation?: string;
  currentCompanyWebsite?: string;
  experience?: string;
  currentSalary?: string;
  currentSalaryCurrency?: string;
  currentBenefits?: string;
  expectedSalary?: string;
  currency?: string;
  expectedBenefits?: string;
  noticePeriodDays?: string;
  noticePeriod?: string;
  availabilityStatus?: string;
  courses?: string;
  extracurricularActivities?: string;
  volunteers?: string;
  linkedinUrl?: string;
  twitter?: string;
  facebook?: string;
  skypeId?: string;
  stackOverflow?: string;
  website?: string;
  portfolioUrl?: string;
  summary?: string;
  workHistory?: string;
  educationHistory?: string;
  honoursAwards?: string;
  source?: string;
  sourceUrl?: string;
  referrerName?: string;
  agencyName?: string;
  priority?: string;
  location?: string;
  remarks?: string;
  initialNote?: string;
  skills?: string[];
};

export type AppNotificationCategory =
  | 'CANDIDATE'
  | 'JOB'
  | 'INTERVIEW'
  | 'PLACEMENT'
  | 'CLIENT'
  | 'LEAD'
  | 'BILLING'
  | 'TASK'
  | 'SYSTEM';

export interface AppNotification {
  id: string;
  userId: string;
  category: AppNotificationCategory;
  title: string;
  description: string | null;
  actionLabel: string | null;
  actionPath: string | null;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  timestamp: string;
}

export interface NotificationsListResponse {
  notifications: AppNotification[];
  unreadCount: number;
  totalCount: number;
}

export type AiCoinPack = {
  id: string;
  name: string;
  coins: number;
  priceUsd: number;
  priceLabel: string;
  description: string;
  popular?: boolean;
};

export interface TrashRow {
  id: string;
  deletedAt?: string | null;
  deletedBy?: string | null;
  /** Pre-formatted name for the UI; computed from each entity's primary label field. */
  displayName?: string;
  /** Short secondary line (e.g. email, client name). */
  subtitle?: string;
  /** Pass-through original payload for entity-specific UIs. */
  raw?: unknown;
}
