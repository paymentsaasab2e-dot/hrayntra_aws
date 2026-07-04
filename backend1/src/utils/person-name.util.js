/**
 * Normalize and split person names from resumes (including initials like "V. Bindu Vijayan").
 */

function isNameInitial(token) {
  return /^[A-Za-z]\.?$/.test(String(token || '').trim());
}

function isWeakNamePart(value) {
  const t = String(value || '').trim();
  if (!t) return true;
  if (isNameInitial(t)) return true;
  return t.length <= 2 && !t.includes('.');
}

function isIncompleteNameParts({ firstName, middleName, lastName, fullName }) {
  const fullParts = String(fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const hasLast = Boolean(String(lastName || '').trim());
  const hasMiddle = Boolean(String(middleName || '').trim());
  const partCount = [firstName, middleName, lastName].filter((p) => String(p || '').trim()).length;

  // fullName can include a middle segment while explicit middleName is still empty
  if (fullParts.length > partCount) return true;
  if (hasLast && fullParts.length >= 2) return false;
  if (!hasLast && fullParts.length > 1) return true;
  if (fullParts.length <= 1 && isWeakNamePart(firstName)) return true;
  if (fullParts.length > partCount) return true;
  if (!hasLast && !hasMiddle && isWeakNamePart(firstName) && fullParts.length > 1) return true;
  return false;
}

function splitPersonName(fullName) {
  const parts = String(fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) {
    return { firstName: '', middleName: '', lastName: '', fullName: '' };
  }

  if (parts.length === 1) {
    return {
      firstName: parts[0],
      middleName: '',
      lastName: '',
      fullName: parts[0],
    };
  }

  if (parts.length === 2) {
    const result = {
      firstName: parts[0],
      middleName: '',
      lastName: parts[1],
      fullName: parts.join(' '),
    };
    return result;
  }

  if (isNameInitial(parts[0])) {
    return {
      firstName: parts[0],
      middleName: parts.slice(1, -1).join(' '),
      lastName: parts[parts.length - 1],
      fullName: parts.join(' '),
    };
  }

  return {
    firstName: parts[0],
    middleName: parts.slice(1, -1).join(' '),
    lastName: parts[parts.length - 1],
    fullName: parts.join(' '),
  };
}

function normalizePersonalInformation(pi) {
  const input = pi && typeof pi === 'object' ? pi : {};
  let fullName = String(input.fullName || '').trim();

  if (!fullName) {
    fullName = [input.firstName, input.middleName, input.lastName].filter(Boolean).join(' ').trim();
  }

  let firstName = String(input.firstName || '').trim();
  let middleName = String(input.middleName || '').trim();
  let lastName = String(input.lastName || '').trim();

  const shouldResplit =
    !firstName ||
    isIncompleteNameParts({ firstName, middleName, lastName, fullName });

  if (shouldResplit && fullName) {
    const split = splitPersonName(fullName);
    firstName = split.firstName;
    middleName = split.middleName;
    lastName = split.lastName;
    fullName = split.fullName;
  }

  if (!fullName) {
    fullName = [firstName, middleName, lastName].filter(Boolean).join(' ').trim();
  }

  return {
    firstName: firstName || null,
    middleName: middleName || null,
    lastName: lastName || null,
    fullName: fullName || null,
  };
}

function extractNameFromResumeText(text) {
  const lines = String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, 10);

  const skipLine =
    /^(resume|curriculum\s*vitae|vitae|cv|profile|contact|personal\s*details?|objective|summary|professional\s*summary)/i;
  const jobTitleLine =
    /\b(engineer|developer|manager|analyst|consultant|intern|designer|architect|specialist|executive|director|lead|tester|qa)\b/i;

  for (const line of lines) {
    if (skipLine.test(line)) continue;
    if (line.includes('@')) continue;
    if (/^\+?[\d\s\-()]{8,}$/.test(line.replace(/\s/g, ''))) continue;
    if (line.length < 3 || line.length > 80) continue;

    const labelMatch = line.match(/^(?:name|full\s*name|candidate\s*name)[\s:]+(.+)$/i);
    if (labelMatch) {
      const candidate = labelMatch[1].trim();
      if (candidate.split(/\s+/).length >= 2) return candidate;
    }

    const words = line.split(/\s+/).filter(Boolean);
    if (words.length < 2 || words.length > 6) continue;
    if (jobTitleLine.test(line)) continue;

    const nameLike = /^[A-Za-z][A-Za-z.'\-\s]+$/;
    if (!nameLike.test(line)) continue;

    const hasSubstantiveToken = words.some((w) => w.replace(/\./g, '').length > 1);
    if (!hasSubstantiveToken && !isNameInitial(words[0])) continue;

    return line.replace(/\s+/g, ' ').trim();
  }

  return null;
}

function enrichPersonalInformationFromResumeText(pi, resumeText) {
  const normalized = normalizePersonalInformation(pi);
  const fullParts = String(normalized.fullName || '')
    .split(/\s+/)
    .filter(Boolean);

  if (!isIncompleteNameParts(normalized) && fullParts.length >= 2) {
    return normalized;
  }

  const extracted = extractNameFromResumeText(resumeText);
  if (!extracted) return normalized;

  const extractedParts = extracted.split(/\s+/).filter(Boolean);
  const currentParts = fullParts;

  if (extractedParts.length > currentParts.length) {
    return normalizePersonalInformation({ fullName: extracted });
  }

  return normalized;
}

function resolvePersonalInfoNames({ candidate, profile, resumeJson }) {
  const fromProfile = normalizePersonalInformation({
    firstName: candidate?.firstName,
    middleName: resumeJson?.personalInformation?.middleName,
    lastName: candidate?.lastName,
    fullName: profile?.fullName,
  });

  if (!isIncompleteNameParts(fromProfile) && String(fromProfile.lastName || '').trim()) {
    return fromProfile;
  }

  const pi = resumeJson?.personalInformation || {};
  const fromResume = normalizePersonalInformation({
    firstName: pi.firstName,
    middleName: pi.middleName,
    lastName: pi.lastName,
    fullName: pi.fullName,
  });

  if (!isIncompleteNameParts(fromResume) && String(fromResume.fullName || '').trim()) {
    return fromResume;
  }

  const resumePartCount = String(fromResume.fullName || '')
    .split(/\s+/)
    .filter(Boolean).length;
  const profilePartCount = String(fromProfile.fullName || '')
    .split(/\s+/)
    .filter(Boolean).length;

  if (resumePartCount > profilePartCount && String(fromResume.fullName || '').trim()) {
    return fromResume;
  }

  if (String(fromProfile.fullName || '').trim()) {
    return fromProfile;
  }

  return fromResume;
}

module.exports = {
  isNameInitial,
  isWeakNamePart,
  isIncompleteNameParts,
  splitPersonName,
  normalizePersonalInformation,
  extractNameFromResumeText,
  enrichPersonalInformationFromResumeText,
  resolvePersonalInfoNames,
};
