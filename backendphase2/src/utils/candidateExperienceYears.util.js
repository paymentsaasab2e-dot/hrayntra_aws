/** Compute total experience years from work history + CV narrative (list + profile). */

function isOpenEndedEndDate(value) {
  const raw = String(value || '').trim();
  return !raw || /^[\u2014\u2013\-–—]+$/.test(raw) || /^present$/i.test(raw) || /^current$/i.test(raw);
}

function parseDurationYears(text) {
  const t = String(text || '').toLowerCase().trim();
  if (!t) return null;
  const yearMatch = t.match(/(\d+(?:\.\d+)?)\s*(?:\+)?\s*years?/);
  if (yearMatch) {
    const n = Number(yearMatch[1]);
    return Number.isFinite(n) ? n : null;
  }
  const monthMatch = t.match(/(\d+(?:\.\d+)?)\s*months?/);
  if (monthMatch) {
    const n = Number(monthMatch[1]);
    return Number.isFinite(n) ? n / 12 : null;
  }
  const yrAbbr = t.match(/(\d+(?:\.\d+)?)\s*yr\b/);
  if (yrAbbr) {
    const n = Number(yrAbbr[1]);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function parseDateMs(value) {
  const raw = String(value || '').trim();
  if (!raw || isOpenEndedEndDate(raw)) return null;

  let ms = Date.parse(raw);
  if (Number.isFinite(ms)) return ms;

  const monthYear = raw.match(/^([A-Za-z]{3,9})\s+(\d{4})$/);
  if (monthYear) {
    ms = Date.parse(`${monthYear[1]} 1, ${monthYear[2]}`);
    if (Number.isFinite(ms)) return ms;
  }

  const slashMY = raw.match(/^(\d{1,2})[/.-](\d{4})$/);
  if (slashMY) {
    ms = Date.parse(`${slashMY[1]}/1/${slashMY[2]}`);
    if (Number.isFinite(ms)) return ms;
  }

  const yearMonth = raw.match(/^(\d{4})[/.-](\d{1,2})$/);
  if (yearMonth) {
    ms = Date.parse(`${yearMonth[2]}/1/${yearMonth[1]}`);
    if (Number.isFinite(ms)) return ms;
  }

  const yearOnly = raw.match(/^(\d{4})$/);
  if (yearOnly) {
    ms = Date.parse(`Jan 1, ${yearOnly[1]}`);
    if (Number.isFinite(ms)) return ms;
  }

  return null;
}

function normalizeWorkEntry(entry) {
  const end = String(entry?.endDate || '').trim();
  const isCurrent =
    entry?.isCurrentJob === true ||
    entry?.currentlyWorkHere === true ||
    entry?.currentlyWorking === true ||
    isOpenEndedEndDate(end);
  return {
    ...entry,
    isCurrentJob: isCurrent,
    endDate: isCurrent ? null : entry?.endDate ?? null,
  };
}

function extractDurationTextFromEntry(entry) {
  const explicit = String(entry?.durationText || '').trim();
  if (explicit) return explicit;
  const responsibilities = Array.isArray(entry?.responsibilities) ? entry.responsibilities : [];
  const blob = [entry?.title, entry?.company, entry?.location, ...responsibilities]
    .filter(Boolean)
    .join('\n');
  const match =
    blob.match(/(\d+(?:\.\d+)?)\s*years?\s+(?:experience|exp\.?)?/i) ||
    blob.match(/(\d+(?:\.\d+)?)\s*years?\s+on[- ]?site/i);
  return match ? match[0] : '';
}

function parseWorkEntriesFromCvNarrative(text) {
  const normalized = String(text || '').replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  const entries = [];
  const re =
    /([^\n]{2,120}?)\s*,?\s*at\s+([^,\n]+?)(?:,\s*([^\n]{2,80}?))?\s*[\n\r]+\s*(\d+(?:\.\d+)?)\s*years?\s+experience/gi;

  for (const match of normalized.matchAll(re)) {
    const title = String(match[1] || '')
      .trim()
      .replace(/\s+/g, ' ');
    const company = String(match[2] || '').trim();
    const location = String(match[3] || '').trim();
    const years = match[4];
    if (!title || !company) continue;
    entries.push(
      normalizeWorkEntry({
        title,
        company,
        location: location || null,
        durationText: `${years} years experience`,
        responsibilities: [],
      }),
    );
  }

  const seen = new Set();
  return entries.filter((entry) => {
    const key = `${String(entry.title || '').toLowerCase()}|${String(entry.company || '').toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function collectPhase1SnapshotNarrativeParts(extra) {
  if (!extra || typeof extra !== 'object') return [];
  const snap = extra.phase1ProfileSnapshot;
  if (!snap || typeof snap !== 'object' || Array.isArray(snap)) return [];

  const parts = [];
  if (typeof snap.cvWorkHistoryNarrative === 'string' && snap.cvWorkHistoryNarrative.trim()) {
    parts.push(snap.cvWorkHistoryNarrative.trim());
  }
  if (Array.isArray(snap.workExperience)) {
    for (const row of snap.workExperience) {
      if (!row || typeof row !== 'object') continue;
      const title = String(row.jobTitle || row.title || '').trim();
      const company = String(row.company || row.companyName || '').trim();
      const location = String(row.workLocation || row.location || '').trim();
      const responsibilities = row.responsibilities ?? row.description;
      const respText = Array.isArray(responsibilities)
        ? responsibilities.join('\n')
        : String(responsibilities || '').trim();
      if (title || company) {
        parts.push(
          [title, company ? `at ${company}` : '', location ? `, ${location}` : '', respText ? `\n${respText}` : '']
            .filter(Boolean)
            .join(''),
        );
      }
    }
  }
  return parts;
}

function getCvNarrativeText(extra, candidate = {}) {
  if (!extra || typeof extra !== 'object') {
    return [candidate.cvNotes, candidate.cvSummary].filter(Boolean).join('\n\n');
  }
  const pipeline = extra.pipeline || {};
  const summary = pipeline.summary || {};
  const parts = [
    extra.workHistoryText,
    extra.workHistory,
    summary.workHistory,
    pipeline.workHistory,
    extra.experienceRaw,
    extra.cvRawText,
    extra.resumeText,
    extra.parsedResumeText,
    candidate.cvNotes,
    ...collectPhase1SnapshotNarrativeParts(extra),
  ];
  return parts
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join('\n\n');
}

function parseGlobalExperienceFromExtra(extra, narrative) {
  const pipeline = (extra && extra.pipeline) || {};
  const professional = pipeline.professional || {};
  const personal = pipeline.personal || {};
  const nums = [
    professional.totalExperience,
    professional.experience,
    professional.experienceYears,
    personal.experience,
    extra?.totalExperience,
    extra?.experience,
    pipeline.experience,
  ];
  for (const value of nums) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return Math.round(n * 10) / 10;
  }
  const blob = [narrative, String(extra?.experienceRaw || '')].filter(Boolean).join('\n');
  const totalMatch = blob.match(
    /(\d+(?:\.\d+)?)\s*(?:\+)?\s*years?\s+(?:of\s+)?(?:total\s+)?experience/i,
  );
  if (totalMatch) {
    const n = Number(totalMatch[1]);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function collectPipelineWorkEntries(extra) {
  if (!extra || typeof extra !== 'object') return [];
  const pipeline = extra.pipeline || {};
  const workBlock = pipeline.work || {};
  const raw =
    workBlock.entries ||
    workBlock.workExperienceEntries ||
    pipeline.workExperienceEntries ||
    extra.workExperienceEntries;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((row) => row && typeof row === 'object')
    .map((row) =>
      normalizeWorkEntry({
        title: row.title || row.jobTitle || null,
        company: row.company || row.companyName || null,
        location: row.location || row.workLocation || null,
        startDate: row.startDate || null,
        endDate: row.endDate || null,
        durationText: row.durationText || null,
        responsibilities: row.responsibilities || null,
        isCurrentJob: row.isCurrentJob,
        currentlyWorkHere: row.currentlyWorkHere,
        currentlyWorking: row.currentlyWorking,
      }),
    );
}

function collectWorkEntries(candidate) {
  if (!candidate || typeof candidate !== 'object') return [];

  const buckets = [];
  const cv = Array.isArray(candidate.cvWorkExperienceEntries) ? candidate.cvWorkExperienceEntries : [];
  if (cv.length) {
    buckets.push(
      cv.map((row) =>
        normalizeWorkEntry({
          title: row.title || row.jobTitle || null,
          company: row.company || row.companyName || null,
          location: row.location || row.workLocation || null,
          startDate: row.startDate ?? row.start ?? null,
          endDate: row.endDate ?? row.end ?? null,
          durationText: row.durationText || extractDurationTextFromEntry(row),
          responsibilities: row.responsibilities || null,
          isCurrentJob: row.isCurrentJob,
          currentlyWorkHere: row.currentlyWorkHere,
          currentlyWorking: row.currentlyWorking,
        }),
      ),
    );
  }

  const extra = candidate.extraData;
  const snap =
    extra &&
    typeof extra === 'object' &&
    !Array.isArray(extra) &&
    extra.phase1ProfileSnapshot &&
    typeof extra.phase1ProfileSnapshot === 'object'
      ? extra.phase1ProfileSnapshot
      : candidate.profileSnapshot && typeof candidate.profileSnapshot === 'object'
        ? candidate.profileSnapshot
        : null;

  if (snap && Array.isArray(snap.workExperience) && snap.workExperience.length) {
    buckets.push(
      snap.workExperience.map((row) => {
        const entry = normalizeWorkEntry({
          title: row.jobTitle || row.title || null,
          company: row.company || row.companyName || null,
          location: row.workLocation || row.location || null,
          startDate: row.startDate ?? null,
          endDate: row.endDate ?? null,
          durationText: row.durationText ?? null,
          responsibilities: row.responsibilities || row.description || null,
          isCurrentJob: row.isCurrentJob,
          currentlyWorkHere: row.currentlyWorkHere,
          currentlyWorking: row.currentlyWorking,
        });
        const durationText = entry.durationText || extractDurationTextFromEntry(entry);
        return durationText ? { ...entry, durationText } : entry;
      }),
    );
  }

  buckets.push(collectPipelineWorkEntries(extra));

  const narrative = getCvNarrativeText(extra, candidate);
  if (narrative) {
    buckets.push(parseWorkEntriesFromCvNarrative(narrative));
  }

  const merged = [];
  for (const bucket of buckets) {
    merged.push(...bucket);
  }

  const seen = new Set();
  return merged.filter((entry) => {
    const key = `${String(entry.title || '').toLowerCase()}|${String(entry.company || '').toLowerCase()}`;
    if (!key || key === '|') return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function computeYearsFromDateRanges(list) {
  const ranges = [];
  for (const entry of list) {
    const normalized = normalizeWorkEntry(entry);
    const start = parseDateMs(normalized.startDate);
    const end = normalized.isCurrentJob
      ? Date.now()
      : parseDateMs(normalized.endDate) ?? (start != null ? Date.now() : null);
    if (start != null && end != null && end >= start) {
      ranges.push({ start, end });
    }
  }
  if (!ranges.length) return null;

  ranges.sort((a, b) => a.start - b.start);
  let totalMs = 0;
  let cursorEnd = -1;
  for (const range of ranges) {
    const start = range.start < cursorEnd ? cursorEnd : range.start;
    const end = range.end;
    if (end > start) {
      totalMs += end - start;
      cursorEnd = end;
    }
  }
  if (totalMs <= 0) return null;
  const years = totalMs / (365.25 * 24 * 60 * 60 * 1000);
  const rounded = Math.round(years * 10) / 10;
  return rounded > 0 ? rounded : 0.1;
}

function computeYearsFromDurationClaims(list) {
  let durationSum = 0;
  let anyDuration = false;
  for (const entry of list) {
    const years = parseDurationYears(extractDurationTextFromEntry(entry));
    if (years != null) {
      durationSum += years;
      anyDuration = true;
    }
  }
  if (!anyDuration) return null;
  const rounded = Math.round(durationSum * 10) / 10;
  return rounded > 0 ? rounded : 0.1;
}

function computeTotalExperienceYears(entries, fallbackYears) {
  const list = Array.isArray(entries) ? entries.filter(Boolean) : [];
  if (!list.length) {
    if (fallbackYears != null && Number.isFinite(Number(fallbackYears))) {
      return Math.max(0, Number(fallbackYears));
    }
    return null;
  }

  const durationSum = computeYearsFromDurationClaims(list);
  const calendarYears = computeYearsFromDateRanges(list);

  if (durationSum != null && durationSum > 0) {
    if (calendarYears == null || durationSum > calendarYears || calendarYears < 0.5) {
      return durationSum;
    }
  }
  if (calendarYears != null && calendarYears > 0) {
    const fallbackNum =
      fallbackYears != null && Number.isFinite(Number(fallbackYears)) ? Number(fallbackYears) : null;
    if (fallbackNum != null && fallbackNum >= 1 && calendarYears < 1) {
      return fallbackNum;
    }
    if (fallbackNum != null && fallbackNum > calendarYears) {
      return fallbackNum;
    }
    return calendarYears;
  }

  if (fallbackYears != null && Number.isFinite(Number(fallbackYears))) {
    return Math.max(0, Number(fallbackYears));
  }
  if (list.length > 0) return 0.1;
  return null;
}

export function resolveCandidateListExperienceYears(candidate) {
  const entries = collectWorkEntries(candidate);
  const extra =
    candidate?.extraData && typeof candidate.extraData === 'object' && !Array.isArray(candidate.extraData)
      ? candidate.extraData
      : null;
  const narrative = getCvNarrativeText(extra, candidate);
  const apiYears = candidate?.experience ?? candidate?.experienceYears ?? null;
  const fallback =
    parseGlobalExperienceFromExtra(extra, narrative) ??
    (apiYears != null && Number.isFinite(Number(apiYears)) ? Number(apiYears) : null);
  const computed = computeTotalExperienceYears(entries, fallback);
  const apiNum = apiYears != null && Number.isFinite(Number(apiYears)) ? Number(apiYears) : null;
  if (computed != null && computed < 1 && apiNum != null && apiNum >= 1) {
    return apiNum;
  }
  if (computed != null) return computed;
  if (entries.length > 0) return 0.1;
  return null;
}
