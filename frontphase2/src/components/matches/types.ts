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
}

export interface MatchJob {
  id: string;
  title: string;
  client: string;
  status: 'Open' | 'Urgent' | 'On Hold';
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
