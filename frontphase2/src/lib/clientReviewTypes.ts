import type { CVEditorData } from './cvEditorMapping';
import type { ClientReviewSection } from './clientPresentationSections';

export interface CvWorkEntry {
  title?: string;
  company?: string;
  startDate?: string;
  endDate?: string;
  responsibilities?: string[];
}

export interface CvEducationEntry {
  degree?: string;
  institution?: string;
  startYear?: string;
  endYear?: string;
}

export interface ClientReviewData {
  matchId?: string;
  interviewId: string;
  submissionType?: string;
  cvShareMode?: 'edited' | 'original' | 'saasa' | string;
  offerLetterUrl?: string | null;
  presentationSections?: ClientReviewSection[];
  candidate?: {
    name?: string;
    email?: string;
    phone?: string;
    designation?: string;
    currentCompany?: string;
    experience?: number | null;
    address?: string;
    city?: string;
    country?: string;
    cvSummary?: string;
    education?: string;
    skills?: string[];
    languages?: string[];
    resume?: string;
    cvWorkExperienceEntries?: CvWorkEntry[];
    cvEducationEntries?: CvEducationEntry[];
  };
  job?: { title?: string };
  client?: { companyName?: string };
  interviewFeedback?: Array<{
    id: string;
    interviewerName: string;
    recommendation: string;
    comments: string;
  }>;
  cvEditorPreview?: CVEditorData | null;
  sharedResumeUrl?: string | null;
  activeMatchId?: string;
  batchCandidates?: ClientReviewBatchRow[];
}

export interface ClientReviewBatchRow {
  matchId: string;
  candidateName: string;
  designation?: string;
  experience?: number | null;
  jobTitle?: string;
  detail: ClientReviewData;
}

export interface ClientReviewResponse {
  tag: string;
  comments: string;
  documentLabel?: string | null;
  documentFileName?: string | null;
  documentUrl?: string | null;
}

export interface InterviewClientReviewContext extends ClientReviewData {
  clientResponses?: ClientReviewResponse[];
  submittedToClient?: string | null;
}

export const TAG_OPTIONS_BY_TYPE: Record<string, string[]> = {
  INITIAL_REVIEW: ['Proceed to Interview', 'Need Clarification', 'Hold', 'Not a Fit'],
  INTERIM_REVIEW: ['Proceed to Next Round', 'Need Clarification', 'Hold', 'Reject'],
  OFFER_CONFIRMATION: ['Offer Confirmed', 'Need Clarification', 'On Hold'],
  GENERAL: ['Interested', 'Need Clarification', 'Hold', 'Rejected', 'Proceed to Next Round'],
};

export const PURPOSE_COPY: Record<string, { title: string; body: string }> = {
  INITIAL_REVIEW: {
    title: 'Initial Candidate Review',
    body: 'The recruiter is asking for your go-ahead before scheduling an interview with this candidate.',
  },
  INTERIM_REVIEW: {
    title: 'Mid-cycle Candidate Review',
    body: 'Please review the latest interview feedback and confirm whether to proceed to the next round.',
  },
  OFFER_CONFIRMATION: {
    title: 'Offer Confirmation',
    body: 'Final hand-off — please attach the signed offer letter and confirm the candidate is being placed.',
  },
  GENERAL: {
    title: 'Candidate Review',
    body: 'Please review the candidate details and share your decision with the recruiter.',
  },
};
