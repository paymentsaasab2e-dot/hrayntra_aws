export type InterviewStatus = 'Scheduled' | 'Completed' | 'Cancelled' | 'Rescheduled' | 'No Show';
export type FeedbackStatus = 'Pending' | 'Submitted' | 'N/A';
export type InterviewRound =
  | 'Screening'
  | 'Technical'
  | 'HR'
  | 'Managerial'
  | 'Client'
  | 'Final';
export type InterviewType = 'Video' | 'Phone' | 'In-Person' | 'Technical Test' | 'Assessment' | 'Group Discussion';
export type InterviewMode = 'Online' | 'Offline';
export type Recommendation = 'Pass' | 'Reject' | 'Hold';
export type DrawerTab = 'overview' | 'panel' | 'feedback' | 'notes' | 'activity' | 'files';

export interface InterviewCandidate {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  stage?: string | null;
  status?: string | null;
}

export interface InterviewJob {
  id: string;
  title: string;
  client: string;
  clientId?: string;
}

export interface InterviewPanelMember {
  id: string;
  userId?: string;
  name: string;
  role: 'HR' | 'Technical' | 'Client';
  department: string;
  email: string;
  phone: string;
  avatar: string;
}

export interface InterviewNote {
  id: string;
  author: string;
  avatar: string;
  timestamp: string;
  text: string;
}

export interface InterviewActivity {
  id: string;
  action: string;
  user: string;
  timestamp: string;
  color: 'blue' | 'green' | 'orange' | 'red' | 'slate';
}

export interface InterviewRatings {
  technicalSkills: number;
  communication: number;
  problemSolving: number;
  cultureFit: number;
  experienceMatch: number;
  overallRating: number;
}

export interface InterviewFeedbackEntry {
  id: string;
  interviewerId: string;
  interviewerName: string;
  submittedAt: string;
  ratings: InterviewRatings;
  strengths: string;
  weaknesses: string;
  comments: string;
  recommendation: Recommendation;
}

export interface InterviewRecording {
  type: 'file' | 'link' | 'cloud';
  value: string;
}

export interface Interview {
  id: string;
  candidate: InterviewCandidate;
  job: InterviewJob;
  round: InterviewRound;
  type: InterviewType;
  mode: InterviewMode;
  date: string;
  time: string;
  duration: number;
  timezone: string;
  meetingLink?: string;
  meetingPlatform?: 'Zoom' | 'Google Meet' | 'MS Teams';
  location?: string;
  status: InterviewStatus;
  feedbackStatus: FeedbackStatus;
  createdBy: string;
  notes: string;
  panel: InterviewPanelMember[];
  feedbackEntries: InterviewFeedbackEntry[];
  internalNotes: InterviewNote[];
  activityLog: InterviewActivity[];
  recording?: InterviewRecording | null;
}

export interface InterviewFiltersState {
  date: string;
  status: string;
  round: string;
  mode: string;
  interviewer: string;
  clientJob: string;
}

export interface InterviewKpi {
  title: string;
  value: number;
  icon: 'calendar' | 'clock' | 'message' | 'check';
  accent: string;
}

export interface ScheduleInterviewPayload {
  candidateId: string;
  jobId: string;
  clientId?: string;
  round: InterviewRound;
  type: InterviewType;
  mode: InterviewMode;
  date: string;
  time: string;
  duration: number;
  timezone: string;
  panelIds: string[];
  meetingPlatform?: 'Zoom' | 'Google Meet' | 'MS Teams';
  panelRoles?: Record<string, 'HR' | 'Technical' | 'Client' | 'Hiring Manager'>;
  location?: string;
  notes: string;
  sendCalendarInvite: boolean;
  sendEmailNotification: boolean;
  sendWhatsAppReminder: boolean;
}

export interface ReschedulePayload {
  date: string;
  time: string;
  reason: string;
  notifyCandidate: boolean;
  notifyInterviewer: boolean;
}

export interface CancelInterviewPayload {
  reason: string;
  notes: string;
  notifyCandidate: boolean;
}

export interface FeedbackPayload {
  ratings: InterviewRatings;
  strengths: string;
  weaknesses: string;
  comments: string;
  recommendation: Recommendation;
  salaryFit: boolean;
  availableToJoin: string;
  aiSummary?: string;
  saveAsDraft?: boolean;
}

export interface NoShowPayload {
  reason: string;
  notes: string;
}

export interface PaginationState {
  page: number;
  pageSize: number;
}
