import type { CVEditorData } from './cvEditorMapping';
import type { ClientReviewSection } from './clientPresentationSections';
import type { ClientTrackerOptions } from './clientTrackerOptions';

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
  trackerOptions?: ClientTrackerOptions;
  matchScore?: number | null;
  recruiterNotes?: string;
  pipelineStages?: Array<{ id: string; name: string }>;
  /** Last stage marked by the client for this candidate on the preview link. */
  clientMarkedStage?: string | null;
  candidateFiles?: Array<{
    id: string;
    fileName: string;
    fileType: string;
    fileUrl: string;
  }>;
}

export interface ClientReviewBatchRow {
  matchId: string;
  candidateName: string;
  designation?: string;
  experience?: number | null;
  jobTitle?: string;
  matchScore?: number | null;
  /** Stage the client last marked on this preview link. */
  clientMarkedStage?: string | null;
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

/** Stages the client can mark on the Client Preview URL (Submit to Client link). */
export const CLIENT_PIPELINE_STAGE_CHOICES: Array<{ id: string; name: string }> = [
  { id: 'APPLIED', name: 'Applied' },
  { id: 'NEW', name: 'New' },
  { id: 'SCREENING', name: 'Screening' },
  { id: 'SUBMITTED', name: 'Submitted' },
  { id: 'INTERVIEWING', name: 'Interviewing' },
  { id: 'OFFERED', name: 'Offered' },
  { id: 'HIRED', name: 'Hired' },
  { id: 'REJECTED', name: 'Rejected' },
  { id: 'SCREENING_INTERVIEWING', name: 'Screening & Interviewing' },
  { id: 'SUBMITTED_TO_CLIENT', name: 'Submitted to Client' },
  { id: 'SHORTLISTED_BY_CLIENT', name: 'Shortlisted by Client' },
  { id: 'FEEDBACK_PENDING', name: 'Feedback Pending' },
  { id: 'JOINED', name: 'Joined' },
];

export const PURPOSE_COPY: Record<string, { title: string; body: string }> = {
  INITIAL_REVIEW: {
    title: 'Initial review',
    body: 'Confirm if this candidate should move to interview.',
  },
  INTERIM_REVIEW: {
    title: 'Progress review',
    body: 'Review the latest feedback and confirm next steps.',
  },
  OFFER_CONFIRMATION: {
    title: 'Offer confirmation',
    body: 'Attach the signed offer letter and confirm placement.',
  },
  GENERAL: {
    title: 'Candidate review',
    body: 'Review this candidate and share your decision.',
  },
};
