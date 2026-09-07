export const CLIENT_TRACKER_OPTION_KEYS = [
  'viewProfile',
  'showInterviewFeedback',
  'addComments',
  'downloadResume',
  'showLinkedIn',
  'showNotes',
  'showScore',
  'addRemarks',
  'changeStage',
  'attachDocument',
  'downloadFiles',
] as const;

export type ClientTrackerOptionKey = (typeof CLIENT_TRACKER_OPTION_KEYS)[number];

export type ClientTrackerOptions = Record<ClientTrackerOptionKey, boolean>;

export const CLIENT_TRACKER_OPTION_DEFAULTS: ClientTrackerOptions = {
  viewProfile: true,
  showInterviewFeedback: true,
  addComments: true,
  downloadResume: true,
  showLinkedIn: true,
  showNotes: true,
  showScore: true,
  addRemarks: true,
  changeStage: true,
  attachDocument: true,
  downloadFiles: true,
};

export const CLIENT_TRACKER_OPTION_LEGACY_DEFAULTS: ClientTrackerOptions = {
  viewProfile: true,
  showInterviewFeedback: true,
  addComments: true,
  downloadResume: true,
  showLinkedIn: true,
  showNotes: false,
  showScore: false,
  addRemarks: true,
  changeStage: false,
  attachDocument: true,
  downloadFiles: false,
};

export const CLIENT_TRACKER_OPTION_FIELDS: Array<{
  id: ClientTrackerOptionKey;
  label: string;
  action?: boolean;
  hint?: string;
}> = [
  { id: 'viewProfile', label: 'View profile' },
  { id: 'showInterviewFeedback', label: 'Show interview feedback' },
  { id: 'addComments', label: 'Add comments', action: true },
  { id: 'downloadResume', label: 'Download resume', action: true },
  { id: 'showLinkedIn', label: 'LinkedIn' },
  { id: 'showNotes', label: 'Show recruiter notes' },
  { id: 'showScore', label: 'Show match score' },
  { id: 'addRemarks', label: 'Share decision', action: true },
  {
    id: 'changeStage',
    label: 'Change stage',
    action: true,
    hint: 'Shown on Client tab only — does not move pipeline stage',
  },
  { id: 'attachDocument', label: 'Attach document', action: true },
  { id: 'downloadFiles', label: 'Download files' },
];

export function normalizeClientTrackerOptions(
  raw?: Partial<ClientTrackerOptions> | null,
  useNewDefaults = false,
): ClientTrackerOptions {
  const next: ClientTrackerOptions = {
    ...(useNewDefaults ? CLIENT_TRACKER_OPTION_DEFAULTS : CLIENT_TRACKER_OPTION_LEGACY_DEFAULTS),
  };
  if (!raw || typeof raw !== 'object') return next;
  for (const key of CLIENT_TRACKER_OPTION_KEYS) {
    if (typeof raw[key] === 'boolean') next[key] = raw[key];
  }
  return next;
}

export function clientTrackerAllowsResponse(options: ClientTrackerOptions): boolean {
  return options.addRemarks || options.addComments || options.attachDocument || options.changeStage;
}
