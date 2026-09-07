/**
 * Recruiter-selected fields and actions for the public client preview link.
 * Defaults for new submits are all on. Missing values on older tokens keep
 * the previous public-review behaviour (no extra files/score/notes).
 */

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
];

export const CLIENT_TRACKER_OPTION_DEFAULTS = Object.freeze({
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
});

export const CLIENT_TRACKER_OPTION_LEGACY_DEFAULTS = Object.freeze({
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
});

export function normalizeClientTrackerOptions(raw, { useNewDefaults = false } = {}) {
  const next = {
    ...(useNewDefaults ? CLIENT_TRACKER_OPTION_DEFAULTS : CLIENT_TRACKER_OPTION_LEGACY_DEFAULTS),
  };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return next;
  for (const key of CLIENT_TRACKER_OPTION_KEYS) {
    if (typeof raw[key] === 'boolean') next[key] = raw[key];
  }
  return next;
}

export function readClientTrackerOptionsFromExtraData(extraData, fallback) {
  const extra =
    extraData && typeof extraData === 'object' && !Array.isArray(extraData) ? extraData : {};
  const submission =
    extra.cvSubmission && typeof extra.cvSubmission === 'object' && !Array.isArray(extra.cvSubmission)
      ? extra.cvSubmission
      : {};
  const stored = submission.trackerOptions;
  if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
    return normalizeClientTrackerOptions(stored);
  }
  return normalizeClientTrackerOptions(fallback);
}

export function mergeCvSubmissionExtraData(existingExtra, patch) {
  const extra =
    existingExtra && typeof existingExtra === 'object' && !Array.isArray(existingExtra)
      ? { ...existingExtra }
      : {};
  const existingSubmission =
    extra.cvSubmission && typeof extra.cvSubmission === 'object' && !Array.isArray(extra.cvSubmission)
      ? extra.cvSubmission
      : {};
  return {
    ...extra,
    cvSubmission: {
      ...existingSubmission,
      ...patch,
      updatedAt: new Date().toISOString(),
    },
  };
}
