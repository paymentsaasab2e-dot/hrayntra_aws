export type TaskRelatedTo = 'Candidate' | 'Job' | 'Client' | 'Interview' | 'Internal';
export type TaskPriority = 'Low' | 'Medium' | 'High';
export type TaskStatus = 'Pending' | 'Completed' | 'Overdue';
/** Status options for Edit Task form */
export type TaskEditStatus = 'Pending' | 'In Progress' | 'Completed' | 'Cancelled';
export type TaskType = 'Call' | 'Email' | 'Interview' | 'Follow-up' | 'Meeting' | 'Note';

export interface TaskFormValues {
  title: string;
  description: string;
  relatedTo: TaskRelatedTo | '';
  relatedEntityId: string;
  assigneeId: string;
  priority: TaskPriority | '';
  dueDate: string;
  reminder: string;
  attachmentNames: string;
  notifyAssignee: boolean;
  status?: TaskEditStatus;
  _files?: File[]; // Internal: files to upload
}

export interface TaskAssignee {
  id: string;
  name: string;
  avatar?: string;
  /** Role or team for assignment UI */
  role?: string;
}

export interface RelatedEntity {
  id: string;
  label: string;
  type: TaskRelatedTo;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  type: TaskType;
  relatedTo: { id: string; name: string; type: TaskRelatedTo };
  dueDate: string;
  time: string;
  priority: TaskPriority;
  status: TaskStatus;
  assignee: TaskAssignee;
  reminder?: string;
  notifyAssignee?: boolean;
}

export interface TaskActivity {
  id: string;
  type: TaskType;
  note: string;
  timestamp: string;
  recruiter: string;
}

/** Action types for Task Activity Log (audit trail) */
export type TaskActivityEventType =
  | 'created'
  | 'assigned'
  | 'priority_changed'
  | 'due_date_changed'
  | 'status_updated'
  | 'reminder_changed'
  | 'attachment_uploaded'
  | 'note_added'
  | 'completed'
  | 'reopened'
  | 'deleted'
  | 'edited';

export interface TaskActivityEvent {
  id: string;
  actionType: TaskActivityEventType;
  title: string;
  actorName: string;
  timestamp: string;
  /** Display date for grouping e.g. "Feb 10 09:20" or ISO */
  timestampDisplay?: string;
  metadata?: string;
}

export const TASK_RELATED_TO_OPTIONS: TaskRelatedTo[] = ['Candidate', 'Job', 'Client', 'Interview', 'Internal'];
export const TASK_PRIORITY_OPTIONS: TaskPriority[] = ['Low', 'Medium', 'High'];
export const TASK_EDIT_STATUS_OPTIONS: TaskEditStatus[] = ['Pending', 'In Progress', 'Completed', 'Cancelled'];
export const REMINDER_OPTIONS = [
  { id: '', label: 'None' },
  { id: '15min', label: '15 minutes before' },
  { id: '1hr', label: '1 hour before' },
  { id: '1day', label: '1 day before' },
  { id: 'custom', label: 'Custom' },
];

/** Reminder channel for custom reminder (delivery method) */
export type ReminderChannel = 'notification' | 'email' | 'whatsapp';
export const REMINDER_CHANNEL_OPTIONS: { id: ReminderChannel; label: string }[] = [
  { id: 'notification', label: 'In-app notification' },
  { id: 'email', label: 'Email' },
  { id: 'whatsapp', label: 'WhatsApp' },
];

export const MOCK_ASSIGNEES: TaskAssignee[] = [
  { id: 'u1', name: 'Alex Thompson', avatar: 'https://images.unsplash.com/photo-1701463387028-3947648f1337?q=80&w=150', role: 'Senior Recruiter' },
  { id: 'u2', name: 'Rushabh Shah', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=150', role: 'Recruitment Lead' },
  { id: 'u3', name: 'Nilakshi Mehta', avatar: 'https://images.unsplash.com/photo-1712168567859-e24cbc155219?q=80&w=150', role: 'Recruiter' },
  { id: 'u4', name: 'Sarah Chen', avatar: 'https://images.unsplash.com/photo-1712168567859-e24cbc155219?q=80&w=150', role: 'Recruiter' },
  { id: 'u5', name: 'Elena Rodriguez', avatar: 'https://images.unsplash.com/photo-1672675389084-5415d558dfd7?q=80&w=150', role: 'Talent Partner' },
  { id: 'u6', name: 'Marcus Wong', avatar: 'https://images.unsplash.com/photo-1617386124435-9eb3935b1e11?q=80&w=150', role: 'Recruiter' },
];

export const MOCK_CANDIDATES: RelatedEntity[] = [
  { id: 'c1', label: 'Sarah Jenkins', type: 'Candidate' },
  { id: 'c2', label: 'Marcus Chen', type: 'Candidate' },
  { id: 'c3', label: 'Emma Wilson', type: 'Candidate' },
];

export const MOCK_JOBS: RelatedEntity[] = [
  { id: 'j1', label: 'Senior Frontend Developer', type: 'Job' },
  { id: 'j2', label: 'Marketing Manager', type: 'Job' },
  { id: 'j3', label: 'Product Manager', type: 'Job' },
];

export const MOCK_CLIENTS: RelatedEntity[] = [
  { id: 'cl1', label: 'Acme Corp', type: 'Client' },
  { id: 'cl2', label: 'TechFlow Inc', type: 'Client' },
  { id: 'cl3', label: 'GreenEnergy Co.', type: 'Client' },
];

export const MOCK_INTERVIEWS: RelatedEntity[] = [
  { id: 'i1', label: 'Sarah J. - Technical Round', type: 'Interview' },
  { id: 'i2', label: 'Marcus C. - Final', type: 'Interview' },
];

/** Communication entry types for Task Communication History */
export type TaskCommunicationType = 'email' | 'call' | 'whatsapp' | 'note' | 'comment';

export interface TaskCommunicationEntry {
  id: string;
  type: TaskCommunicationType;
  title: string;
  timestamp: string;
  timestampDisplay?: string;
  /** Sender or "from" (e.g. recruiter name) */
  from?: string;
  /** Recipient (e.g. candidate name, "Sarah Jenkins") */
  to?: string;
  preview?: string;
  body?: string;
  /** For calls: duration in minutes or "4 min" */
  duration?: string;
  /** For emails: subject */
  subject?: string;
}

/** Mock communication history keyed by task id */
export const MOCK_TASK_COMMUNICATIONS: Record<string, TaskCommunicationEntry[]> = {
  '1': [
    { id: 'com1', type: 'email', title: 'Email sent to Sarah Jenkins', timestamp: '2026-02-10T09:30:00', timestampDisplay: 'Feb 10', from: 'Alex Thompson', to: 'Sarah Jenkins', subject: 'Interview Reminder', preview: 'Hi Sarah, this is a reminder for our screening call tomorrow at 10:00 AM.', body: 'Hi Sarah, this is a reminder for our screening call tomorrow at 10:00 AM. Please confirm your availability.' },
    { id: 'com2', type: 'call', title: 'Call attempted', timestamp: '2026-02-10T10:15:00', timestampDisplay: 'Feb 10', from: 'Alex Thompson', to: 'Sarah Jenkins', duration: '4 min', preview: 'Left voicemail regarding interview slot.' },
  ],
  '2': [
    { id: 'com3', type: 'email', title: 'Email sent to hiring manager', timestamp: '2026-02-09T14:30:00', timestampDisplay: 'Feb 9', from: 'Alex Thompson', subject: 'Offer letter – Senior Frontend Dev', preview: 'Draft offer letter attached for review.' },
  ],
  '3': [
    { id: 'com4', type: 'whatsapp', title: 'WhatsApp follow-up sent', timestamp: '2026-02-10T11:00:00', timestampDisplay: 'Feb 10', from: 'Elena Rodriguez', to: 'Marcus Chen', preview: 'Confirmed technical round for Thursday 2:30 PM.' },
    { id: 'com5', type: 'note', title: 'Internal note added', timestamp: '2026-02-10T11:15:00', timestampDisplay: 'Feb 10', from: 'Elena Rodriguez', preview: 'Candidate requested morning slot; rescheduled.' },
  ],
};

/** Candidate interaction types for Candidate Interaction Logs */
export type CandidateInteractionType =
  | 'whatsapp_sent'
  | 'email_sent'
  | 'call_attempted'
  | 'call_connected'
  | 'candidate_replied'
  | 'interview_reminder_sent'
  | 'candidate_reschedule_request';

export type CandidateInteractionChannel = 'whatsapp' | 'email' | 'call' | 'all';

export type InteractionDirection = 'outbound' | 'response';

export interface CandidateInteractionEntry {
  id: string;
  type: CandidateInteractionType;
  title: string;
  timestamp: string;
  timestampDisplay?: string;
  actor: string;
  direction: InteractionDirection;
  channel?: CandidateInteractionChannel;
  duration?: string;
  preview?: string;
}

/** Mock candidate interaction logs keyed by task id (for tasks related to candidates) */
export const MOCK_CANDIDATE_INTERACTIONS: Record<string, CandidateInteractionEntry[]> = {
  '1': [
    { id: 'ci1', type: 'whatsapp_sent', title: 'WhatsApp message sent', timestamp: '2026-02-10T09:30:00', timestampDisplay: 'Feb 10 09:30', actor: 'Alex Thompson', direction: 'outbound', channel: 'whatsapp', preview: 'Reminder for screening call tomorrow 10 AM.' },
    { id: 'ci2', type: 'candidate_replied', title: 'Candidate responded', timestamp: '2026-02-10T09:35:00', timestampDisplay: 'Feb 10 09:35', actor: 'Sarah Jenkins', direction: 'response', channel: 'whatsapp', preview: 'Confirmed, see you then.' },
    { id: 'ci3', type: 'call_connected', title: 'Call connected', timestamp: '2026-02-10T10:15:00', timestampDisplay: 'Feb 10 10:15', actor: 'Alex Thompson', direction: 'outbound', channel: 'call', duration: '6 min', preview: 'Discussed role and next steps.' },
    { id: 'ci4', type: 'email_sent', title: 'Email reminder sent', timestamp: '2026-02-11T08:00:00', timestampDisplay: 'Feb 11 08:00 AM', actor: 'Alex Thompson', direction: 'outbound', channel: 'email', preview: 'Interview reminder – Feb 12, 10:00 AM' },
  ],
  '3': [
    { id: 'ci5', type: 'whatsapp_sent', title: 'WhatsApp message sent', timestamp: '2026-02-10T11:00:00', timestampDisplay: 'Feb 10 11:00', actor: 'Elena Rodriguez', direction: 'outbound', channel: 'whatsapp', preview: 'Technical round confirmed for Thursday.' },
    { id: 'ci6', type: 'candidate_reschedule_request', title: 'Candidate requested reschedule', timestamp: '2026-02-10T11:30:00', timestampDisplay: 'Feb 10 11:30', actor: 'Marcus Chen', direction: 'response', channel: 'email', preview: 'Requested morning slot instead.' },
  ],
};

/** AI task suggestion category for filter */
export type AITaskSuggestionCategory = 'Candidate' | 'Interview' | 'Client' | 'Offer' | 'all';

/** Priority for urgency indicator */
export type AITaskSuggestionPriority = 'High' | 'Medium' | 'Low';

export interface AITaskSuggestion {
  id: string;
  category: Exclude<AITaskSuggestionCategory, 'all'>;
  title: string;
  context: string;
  suggestedAction: string;
  priority: AITaskSuggestionPriority;
  /** Optional: prefill for Create Task (relatedTo, relatedEntityId, title, etc.) */
  prefill?: Partial<TaskFormValues>;
}

/** Mock AI task suggestions for the Tasks page panel */
export const MOCK_AI_TASK_SUGGESTIONS: AITaskSuggestion[] = [
  {
    id: 'ai1',
    category: 'Candidate',
    title: 'Candidate waiting for interview feedback',
    context: 'Candidate Sarah Jenkins waiting for interview feedback for 3 days.',
    suggestedAction: 'Follow up with interviewer.',
    priority: 'High',
    prefill: { title: 'Follow up: interview feedback for Sarah Jenkins', relatedTo: 'Candidate', relatedEntityId: 'c1', priority: 'High' },
  },
  {
    id: 'ai2',
    category: 'Client',
    title: 'Client has not responded',
    context: 'Client TechFlow has not responded in 5 days.',
    suggestedAction: 'Send a follow-up email or call.',
    priority: 'High',
    prefill: { title: 'Follow up with TechFlow', relatedTo: 'Client', relatedEntityId: 'cl1', priority: 'High' },
  },
  {
    id: 'ai3',
    category: 'Offer',
    title: 'Offer follow-up needed',
    context: 'Offer follow-up needed before joining date.',
    suggestedAction: 'Schedule pre-joining check-in task.',
    priority: 'Medium',
    prefill: { title: 'Offer follow-up before joining', relatedTo: 'Candidate', relatedEntityId: 'c1', priority: 'Medium' },
  },
  {
    id: 'ai4',
    category: 'Interview',
    title: 'Interview scheduled but no reminder',
    context: 'Interview scheduled but no reminder task exists.',
    suggestedAction: 'Create interview reminder task.',
    priority: 'Medium',
    prefill: { title: 'Interview reminder', relatedTo: 'Interview', relatedEntityId: 'i1', priority: 'Medium' },
  },
];

/** Mock task activity log events (audit trail) keyed by task id */
export const MOCK_TASK_ACTIVITY_EVENTS: Record<string, TaskActivityEvent[]> = {
  '1': [
    { id: 'ev1', actionType: 'created', title: 'Task created', actorName: 'Alex Thompson', timestamp: '2026-02-10T09:20:00', timestampDisplay: 'Feb 10 09:20' },
    { id: 'ev2', actionType: 'assigned', title: 'Task assigned to Alex Thompson', actorName: 'Alex Thompson', timestamp: '2026-02-10T09:25:00', timestampDisplay: 'Feb 10 09:25', metadata: 'Alex Thompson' },
    { id: 'ev3', actionType: 'priority_changed', title: 'Priority changed to High', actorName: 'Alex Thompson', timestamp: '2026-02-10T10:00:00', timestampDisplay: 'Feb 10 10:00', metadata: 'High' },
  ],
  '2': [
    { id: 'ev4', actionType: 'created', title: 'Task created', actorName: 'Alex Thompson', timestamp: '2026-02-09T14:00:00', timestampDisplay: 'Feb 9 02:00 PM' },
    { id: 'ev5', actionType: 'due_date_changed', title: 'Due date changed', actorName: 'Alex Thompson', timestamp: '2026-02-09T14:15:00', timestampDisplay: 'Feb 9 02:15 PM', metadata: 'Feb 9, 2026' },
  ],
  '3': [
    { id: 'ev6', actionType: 'created', title: 'Task created', actorName: 'Elena Rodriguez', timestamp: '2026-02-10T08:30:00', timestampDisplay: 'Feb 10 08:30' },
    { id: 'ev7', actionType: 'note_added', title: 'Note added', actorName: 'Elena Rodriguez', timestamp: '2026-02-10T11:00:00', timestampDisplay: 'Feb 10 11:00', metadata: 'Candidate confirmed availability' },
  ],
};
