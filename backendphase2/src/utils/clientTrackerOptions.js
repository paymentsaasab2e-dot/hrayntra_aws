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
  changeStage: true,
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

/** Fixed catalog of stages recruiters can offer on Client Preview links. */
export const CLIENT_PREVIEW_STAGE_CATALOG = Object.freeze([
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
]);

export function normalizeAllowedClientStages(raw, { fallbackAll = true, catalog = null } = {}) {
  const baseCatalog = Array.isArray(catalog) && catalog.length ? catalog : CLIENT_PREVIEW_STAGE_CATALOG;
  const byName = new Map(baseCatalog.map((row) => [row.name.toLowerCase(), row]));
  const byId = new Map(baseCatalog.map((row) => [row.id.toLowerCase(), row]));
  const incoming = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? raw.split(',').map((part) => part.trim())
      : [];
  const picked = [];
  for (const item of incoming) {
    const key = String(item || '').trim();
    if (!key) continue;
    const lower = key.toLowerCase();
    const known =
      byName.get(lower) || byId.get(lower.replace(/[\s-&]+/g, '_')) || null;
    const row = known || {
      id: key
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '_')
        .replace(/^_|_$/g, '') || `CUSTOM_${picked.length + 1}`,
      name: key,
    };
    if (!picked.some((p) => p.name.toLowerCase() === row.name.toLowerCase())) {
      picked.push({ id: row.id, name: row.name });
    }
  }
  if (picked.length) return picked;
  return fallbackAll ? baseCatalog.map((row) => ({ id: row.id, name: row.name })) : [];
}

export function normalizeClientStageCatalog(raw, fallbackCatalog = CLIENT_PREVIEW_STAGE_CATALOG) {
  const incoming = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? raw.split(',').map((part) => part.trim())
      : [];
  if (!incoming.length) {
    return fallbackCatalog.map((row) => ({ id: row.id, name: row.name }));
  }
  return normalizeAllowedClientStages(incoming, {
    fallbackAll: false,
    catalog: fallbackCatalog,
  });
}

export function readAllowedClientStagesFromExtraData(extraData, fallback) {
  const extra =
    extraData && typeof extraData === 'object' && !Array.isArray(extraData) ? extraData : {};
  const submission =
    extra.cvSubmission && typeof extra.cvSubmission === 'object' && !Array.isArray(extra.cvSubmission)
      ? extra.cvSubmission
      : {};
  const catalog = normalizeClientStageCatalog(
    submission.clientStageCatalog,
    CLIENT_PREVIEW_STAGE_CATALOG,
  );
  if (Array.isArray(submission.allowedClientStages) && submission.allowedClientStages.length) {
    return normalizeAllowedClientStages(submission.allowedClientStages, {
      fallbackAll: false,
      catalog,
    });
  }
  return normalizeAllowedClientStages(fallback, { fallbackAll: true, catalog });
}

export function readClientStageCatalogFromExtraData(extraData) {
  const extra =
    extraData && typeof extraData === 'object' && !Array.isArray(extraData) ? extraData : {};
  const submission =
    extra.cvSubmission && typeof extra.cvSubmission === 'object' && !Array.isArray(extra.cvSubmission)
      ? extra.cvSubmission
      : {};
  const fromCatalog = normalizeClientStageCatalog(submission.clientStageCatalog);
  const fromAllowed = Array.isArray(submission.allowedClientStages)
    ? normalizeAllowedClientStages(submission.allowedClientStages, {
        fallbackAll: false,
        catalog: fromCatalog,
      })
    : [];
  const merged = [...fromCatalog];
  for (const row of fromAllowed) {
    if (!merged.some((m) => m.name.toLowerCase() === row.name.toLowerCase())) {
      merged.push(row);
    }
  }
  return merged.length ? merged : CLIENT_PREVIEW_STAGE_CATALOG.map((row) => ({ ...row }));
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
