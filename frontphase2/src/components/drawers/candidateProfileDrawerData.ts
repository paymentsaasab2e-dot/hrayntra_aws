import type { AuditMeta } from '../../types/audit';

export interface CandidateTagItem {
  id: string;
  label: string;
  color: string;
}

export interface CandidateScheduledInterview {
  id: string;
  candidateId: string;
  jobId?: string | null;
  jobTitle?: string | null;
  type: string;
  round: number;
  date: string;
  time: string;
  duration: string;
  timezone?: string;
  mode: 'video' | 'in-person' | 'phone';
  platform?: 'Google Meet' | 'Zoom' | null;
  meetingLink?: string | null;
  location?: string | null;
  phoneNumber?: string | null;
  interviewers: Array<{
    id: string;
    name: string;
    role: 'Lead Interviewer' | 'Interviewer' | 'Observer';
  }>;
  clientId?: string | null;
  clientName?: string | null;
  clientPanel?: Array<{
    id: string;
    name: string;
    role?: string | null;
    designation?: string | null;
  }>;
  notes?: string;
  sendCandidateInvite?: boolean;
  sendInterviewerInvite?: boolean;
  status: 'scheduled' | 'completed' | 'cancelled';
}

export interface CandidateProfileDrawerData {
  id: string;
  name: string;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  avatar?: string | null;
  currentTitle?: string | null;
  currentCompany?: string | null;
  stage?: string | null;
  experience?: number | null;
  location?: string | null;
  email?: string | null;
  phone?: string | null;
  linkedIn?: string | null;
  designation?: string | null;
  expectedSalary?: string | null;
  expectedSalaryValue?: number | null;
  currentSalaryValue?: number | null;
  salaryCurrency?: string | null;
  noticePeriod?: string | null;
  assignedJob?: string | null;
  assignedJobId?: string | null;
  assignedJobs?: Array<{
    id?: string | null;
    title: string;
    department?: string | null;
    status?: string | null;
    stage?: string | null;
    appliedAt?: string | null;
    movedAt?: string | null;
    notes?: string | null;
    pipelineEntryId?: string | null;
    isPipelineEntry?: boolean;
  }>;
  recruiter?: string | null;
  recruiterId?: string | null;
  source?: string | null;
  status?: string | null;
  availability?: 'available' | 'limited' | 'unavailable' | string | null;
  resumeUrl?: string | null;
  summary?: string | null;
  cvAddress?: string | null;
  cvCity?: string | null;
  cvCountry?: string | null;
  cvAvailability?: string | null;
  cvExpectedSalary?: string | null;
  cvCurrentSalary?: string | null;
  cvEducation?: string | null;
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
    label?: string;
    url?: string;
  }>;
  cvCertifications?: string[];
  cvLanguages?: string[];
  cvPortfolio?: string | null;
  cvWebsite?: string | null;
  cvSummary?: string | null;
  cvNotes?: string | null;
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
    salaryCurrency?: string | number | null;
    salaryAmount?: string | number | null;
    salaryFrequency?: string | null;
    preferredCurrency?: string | null;
    preferredSalary?: string | number | null;
    preferredSalaryType?: string | null;
    preferredBenefits?: string[];
    currentCurrency?: string | null;
    currentSalaryType?: string | null;
    currentSalary?: string | number | null;
    currentLocation?: string | null;
    currentBenefits?: string[];
    availabilityToStart?: string | null;
    noticePeriod?: string | null;
    passportNumbersByLocation?: Record<string, string> | null;
  } | null;
  extraData?: Record<string, unknown> | null;
  cvPreferredLocation?: string | null;
  cvSkills?: string[];
  tags?: CandidateTagItem[];
  notes?: Array<{
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
  files?: Array<{ name: string; url?: string | null }>;
  activity?: Array<{
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
  aiScore?: {
    overall: number;
    source?: 'match' | 'estimated' | string;
    jobTitle?: string | null;
    breakdown: {
      skillsMatch: number;
      experienceFit: number;
      educationFit: number;
      keywordMatch: number;
    };
    insights: Array<{
      type: 'strength' | 'gap';
      text: string;
    }>;
  };
  scheduledInterviews?: CandidateScheduledInterview[];
  auditMeta?: AuditMeta;
  isPhase1Candidate?: boolean;
  poolOrigin?: string | null;
}
