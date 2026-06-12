/** Recruiter CV editor / resume-tab fields stored on tenant candidate.extraData */
export const RECRUITER_CV_EXTRA_KEYS = [
  'cvEditorLayout',
  'cvEditorContentSaved',
  'cvEditorContentSavedAt',
  'resumeCvViewMode',
  'cvSubmission',
  'portalTailoredCvHtml',
  'portalStudioTemplateId',
  'portalTailoredCv',
  'portalAiCvSaved',
  'portalAiCvSavedAt',
  'recruiterCvEditorSaved',
];

function parseExtra(extraData) {
  if (!extraData || typeof extraData !== 'object' || Array.isArray(extraData)) return {};
  return extraData;
}

function readClientPresentationLayout(extra) {
  if (extra?.cvEditorLayout === null) return null;
  const presentation = extra?.clientPresentation;
  if (!presentation || typeof presentation !== 'object' || Array.isArray(presentation)) return null;
  const layout = presentation.cvEditorLayout;
  if (!layout || typeof layout !== 'object' || Array.isArray(layout)) return null;
  return layout;
}

/** Lift recruiter CV editor fields from tenant extraData (top-level + clientPresentation). */
export function pickRecruiterCvExtraFields(extraData) {
  const extra = parseExtra(extraData);
  const picked = {};
  for (const key of RECRUITER_CV_EXTRA_KEYS) {
    if (key === 'cvEditorContentSaved') {
      if (extra[key] === true) picked[key] = true;
      continue;
    }
    if (extra[key] != null && extra[key] !== false) picked[key] = extra[key];
  }
  if (extra.cvEditorLayout === null) {
    return picked;
  }
  if (!picked.cvEditorLayout) {
    const layout = readClientPresentationLayout(extra);
    if (layout) picked.cvEditorLayout = layout;
  }
  return picked;
}

/**
 * Merge incoming extraData onto existing without dropping recruiter CV editor state
 * when portal/common hydration rows omit those keys.
 */
export function mergeCandidateRecruiterExtraData(existingExtraData, incomingExtraData) {
  const existing = parseExtra(existingExtraData);
  const incoming = parseExtra(incomingExtraData);
  const merged = { ...existing, ...incoming };

  for (const key of RECRUITER_CV_EXTRA_KEYS) {
    if (Object.prototype.hasOwnProperty.call(incoming, key)) {
      if (incoming[key] == null || incoming[key] === false) {
        delete merged[key];
      }
      continue;
    }
    if (existing[key] != null && existing[key] !== false) {
      merged[key] = existing[key];
    }
  }

  if (incoming.cvEditorLayout === null) {
    delete merged.cvEditorLayout;
  } else if (!merged.cvEditorLayout) {
    const layout =
      readClientPresentationLayout(incoming) || readClientPresentationLayout(existing);
    if (layout) merged.cvEditorLayout = layout;
  }

  return merged;
}
