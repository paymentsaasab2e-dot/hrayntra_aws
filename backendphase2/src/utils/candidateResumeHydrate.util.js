import { resolveCandidateListExperienceYears } from './candidateExperienceYears.util.js';

function pickFirstNonEmpty(...values) {
  for (const value of values) {
    if (value == null) continue;
    if (typeof value === 'string' && !value.trim()) continue;
    if (Array.isArray(value) && !value.length) continue;
    return value;
  }
  return null;
}

/** Build CV work narrative from portal resumeJson (duration claims + role lines). */
export function buildWorkNarrativeFromResumeJson(resumeJson) {
  if (!resumeJson || typeof resumeJson !== 'object' || Array.isArray(resumeJson)) return '';

  const narrativeParts = [];
  if (typeof resumeJson.workHistory === 'string' && resumeJson.workHistory.trim()) {
    narrativeParts.push(resumeJson.workHistory.trim());
  }
  if (typeof resumeJson.rawText === 'string' && resumeJson.rawText.trim()) {
    narrativeParts.push(resumeJson.rawText.trim());
  }
  if (typeof resumeJson.text === 'string' && resumeJson.text.trim()) {
    narrativeParts.push(resumeJson.text.trim());
  }

  const experienceBlocks = resumeJson.workExperience || resumeJson.experience;
  if (Array.isArray(experienceBlocks)) {
    for (const row of experienceBlocks) {
      if (!row || typeof row !== 'object') continue;
      const title = String(row.title || row.jobTitle || row.role || row.position || '').trim();
      const company = String(row.company || row.employer || row.organization || '').trim();
      const duration = String(
        row.duration ||
          row.years ||
          row.period ||
          row.durationText ||
          row.experience ||
          '',
      ).trim();
      const location = String(row.location || row.workLocation || '').trim();
      const responsibilities = Array.isArray(row.responsibilities)
        ? row.responsibilities.join('\n')
        : String(row.responsibilities || row.description || '').trim();
      if (title || company) {
        narrativeParts.push(
          [
            title,
            company ? `at ${company}` : '',
            location ? `, ${location}` : '',
            duration ? `\n${duration}` : '',
            responsibilities ? `\n${responsibilities}` : '',
          ]
            .filter(Boolean)
            .join(''),
        );
      }
    }
  }

  return narrativeParts.filter(Boolean).join('\n\n');
}

/** Merge resumeJson work history into candidate.extraData for experience calculation. */
export function applyResumeJsonToCandidate(candidate, resumeJson) {
  if (!candidate || !resumeJson) return candidate;

  const mergedNarrative = buildWorkNarrativeFromResumeJson(resumeJson);
  if (mergedNarrative) {
    const prevExtra =
      candidate.extraData && typeof candidate.extraData === 'object' && !Array.isArray(candidate.extraData)
        ? candidate.extraData
        : {};
    const nextWorkHistory =
      pickFirstNonEmpty(prevExtra.workHistory, mergedNarrative) || mergedNarrative;
    if (String(prevExtra.workHistory || '').trim() !== String(nextWorkHistory || '').trim()) {
      candidate.extraData = {
        ...prevExtra,
        workHistory: nextWorkHistory,
        resumeJsonSyncedAt: new Date().toISOString(),
      };
    }
  }

  const computedExp = resolveCandidateListExperienceYears(candidate);
  if (computedExp != null) {
    candidate.experience = computedExp;
    candidate.experienceYears = computedExp;
  }

  return candidate;
}

/**
 * Load latest resumeJson per candidate from the job-portal DB and attach work narrative.
 */
export async function batchHydrateCandidatesResumeFromPortal(candidates, portalClient) {
  if (!portalClient?.resume?.findMany || !Array.isArray(candidates) || !candidates.length) {
    return candidates;
  }

  const ids = [...new Set(candidates.map((c) => String(c?.id || '').trim()).filter(Boolean))];
  if (!ids.length) return candidates;

  try {
    const rows = await portalClient.resume.findMany({
      where: { candidateId: { in: ids } },
      select: { candidateId: true, resumeJson: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    });

    const jsonByCandidateId = new Map();
    for (const row of rows) {
      const cid = String(row.candidateId || '').trim();
      if (!cid || jsonByCandidateId.has(cid)) continue;
      const resumeJson = row.resumeJson;
      if (resumeJson && typeof resumeJson === 'object' && !Array.isArray(resumeJson)) {
        jsonByCandidateId.set(cid, resumeJson);
      }
    }

    for (const candidate of candidates) {
      const resumeJson = jsonByCandidateId.get(String(candidate.id || '').trim());
      if (resumeJson) applyResumeJsonToCandidate(candidate, resumeJson);
    }
  } catch (err) {
    console.warn('[candidateResumeHydrate] batch hydrate failed:', err?.message || err);
  }

  return candidates;
}
