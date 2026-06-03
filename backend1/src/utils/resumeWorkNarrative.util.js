/** Extract CV work narrative from portal resumeJson for candidatecommon sync. */

function pickFirstNonEmpty(...values) {
  for (const value of values) {
    if (value == null) continue;
    if (typeof value === 'string' && !value.trim()) continue;
    return value;
  }
  return null;
}

function buildWorkNarrativeFromResumeJson(resumeJson) {
  if (!resumeJson || typeof resumeJson !== 'object' || Array.isArray(resumeJson)) return '';

  const narrativeParts = [];
  if (typeof resumeJson.workHistory === 'string' && resumeJson.workHistory.trim()) {
    narrativeParts.push(resumeJson.workHistory.trim());
  }
  if (typeof resumeJson.rawText === 'string' && resumeJson.rawText.trim()) {
    narrativeParts.push(resumeJson.rawText.trim());
  }

  const experienceBlocks = resumeJson.workExperience || resumeJson.experience;
  if (Array.isArray(experienceBlocks)) {
    for (const row of experienceBlocks) {
      if (!row || typeof row !== 'object') continue;
      const title = String(row.title || row.jobTitle || row.role || row.position || '').trim();
      const company = String(row.company || row.employer || row.organization || '').trim();
      const duration = String(
        row.duration || row.years || row.period || row.durationText || row.experience || '',
      ).trim();
      const location = String(row.location || row.workLocation || '').trim();
      if (title || company) {
        narrativeParts.push(
          [title, company ? `at ${company}` : '', location ? `, ${location}` : '', duration ? `\n${duration}` : '']
            .filter(Boolean)
            .join(''),
        );
      }
    }
  }

  return narrativeParts.filter(Boolean).join('\n\n');
}

function sumYearsFromNarrative(text) {
  const normalized = String(text || '').trim();
  if (!normalized) return null;
  let sum = 0;
  let found = false;
  const re = /(\d+(?:\.\d+)?)\s*years?\s+(?:experience|exp\.?|on[- ]?site)/gi;
  for (const match of normalized.matchAll(re)) {
    const n = Number(match[1]);
    if (Number.isFinite(n) && n > 0) {
      sum += n;
      found = true;
    }
  }
  if (!found) return null;
  const rounded = Math.round(sum * 10) / 10;
  return rounded > 0 ? rounded : null;
}

function enrichWorkEntriesWithDuration(entries, resumeJson) {
  const list = Array.isArray(entries) ? [...entries] : [];
  const narrative = buildWorkNarrativeFromResumeJson(resumeJson);
  if (!narrative) return list.length ? list : null;

  const durationByKey = new Map();
  const re =
    /([^\n]{2,120}?)\s*,?\s*at\s+([^,\n]+?)(?:,\s*([^\n]{2,80}?))?\s*[\n\r]+\s*(\d+(?:\.\d+)?)\s*years?\s+experience/gi;
  for (const match of narrative.matchAll(re)) {
    const title = String(match[1] || '').trim().toLowerCase();
    const company = String(match[2] || '').trim().toLowerCase();
    const years = match[4];
    if (title && company) {
      durationByKey.set(`${title}|${company}`, `${years} years experience`);
    }
  }

  return list.map((entry) => {
    const title = String(entry?.title || entry?.jobTitle || '').trim().toLowerCase();
    const company = String(entry?.company || entry?.companyName || '').trim().toLowerCase();
    const durationText =
      entry?.durationText ||
      durationByKey.get(`${title}|${company}`) ||
      null;
    return durationText ? { ...entry, durationText } : entry;
  });
}

function applyResumeJsonToCommonPayload(candidate, payload, snapshot) {
  const resumeJson = candidate?.resume?.resumeJson;
  if (!resumeJson || typeof resumeJson !== 'object' || Array.isArray(resumeJson)) {
    return { payload, snapshot };
  }

  const narrative = buildWorkNarrativeFromResumeJson(resumeJson);
  const nextSnapshot = snapshot && typeof snapshot === 'object' ? { ...snapshot } : snapshot;
  if (narrative && nextSnapshot) {
    nextSnapshot.cvWorkHistoryNarrative = narrative;
  }

  const workEntries = enrichWorkEntriesWithDuration(payload.cvWorkExperienceEntries, resumeJson);
  if (workEntries?.length) {
    payload.cvWorkExperienceEntries = workEntries;
  }

  const fromNarrative = sumYearsFromNarrative(narrative);
  if (fromNarrative != null) {
    payload.experience = Math.max(0, Math.round(fromNarrative));
    payload.experienceYears = fromNarrative;
  }

  return { payload, snapshot: nextSnapshot };
}

module.exports = {
  buildWorkNarrativeFromResumeJson,
  sumYearsFromNarrative,
  applyResumeJsonToCommonPayload,
  pickFirstNonEmpty,
};
