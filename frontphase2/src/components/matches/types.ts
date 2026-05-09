export type ActiveView = 'internal' | 'client';
export type MatchMode = 'ai' | 'manual';
export type OpenModal = 'submit' | 'pipeline' | 'reject' | 'duplicate' | null;
export type MatchStatus =
  | 'New'
  | 'Reviewed'
  | 'Sent to Pipeline'
  | 'Submitted'
  | 'Selected'
  | 'Rejected';

export interface MatchFilters {
  skillMatch: number;
  expMin: number;
  expMax: number;
  location: string;
  salaryMin: number | null;
  salaryMax: number | null;
  noticePeriod: 'Immediate' | '15d' | '30d' | null;
  savedOnly: boolean;
}

export interface MatchJob {
  id: string;
  title: string;
  client: string;
  clientId?: string;
  clientContactId?: string;
  clientEmail?: string;
  location?: string;
  clientLocation?: string;
  status: 'Open' | 'Urgent' | 'On Hold';
  /** Required skills from the job, used to score manual/applied candidates client-side. */
  skills?: string[];
  /** Preferred (nice-to-have) skills — half weight when scoring. */
  preferredSkills?: string[];
  /** Free-form experience requirement string from the job (e.g. "3-5 years"). */
  experienceRequired?: string | null;
}

export interface MatchNote {
  id: string;
  text: string;
  createdAt: string;
  author: string;
}

export interface MatchActivity {
  id: string;
  title: string;
  description: string;
  timestamp: string;
}

export interface MatchSubmissionHistory {
  date: string;
  status: string;
}

export interface MatchCandidate {
  id: string;
  matchId: string;
  isAppliedCandidate?: boolean;
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
  status: MatchStatus;
  matchSource: MatchMode;
  explanation: {
    skills: boolean | 'partial';
    experience: boolean | 'partial';
    location: boolean | 'partial';
    salary: boolean | 'partial';
    text: string;
    matchedSkills: string[];
    missingSkills: string[];
    roleRequirement: string;
    aiEngine?: {
      deterministicScore: number;
      aiScore: number | null;
      verdict: string;
      confidenceLevel: string;
      confidenceScore: number;
      breakdown?: Record<string, number>;
    };
  };
  currentTitle: string;
  currentCompany: string;
  email: string;
  phone: string;
  resumeName: string;
  portfolioUrl?: string;
  savedAt?: string | null;
  notes: MatchNote[];
  activity: MatchActivity[];
  matchRating?: number;
  submittedHistory?: MatchSubmissionHistory | null;
}
