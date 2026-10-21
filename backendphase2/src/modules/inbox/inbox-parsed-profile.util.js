function str(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

export function repairParsedEmail(value) {
  let email = str(value).replace(/\s+/g, '').toLowerCase();
  if (!email) return '';
  email = email.replace(/@(gmail|googlemail|yahoo|ymail|outlook|hotmail|live|icloud)(com)$/i, '@$1.$2');
  email = email.replace(/@gmaill?\.com$/i, '@gmail.com');
  email = email.replace(/@gmial\.com$/i, '@gmail.com');
  return email;
}

function cleanEducationQualification(value) {
  return str(value)
    .replace(/\bXilin\b/gi, 'XII')
    .replace(/\bXi\s*in\b/gi, 'XII')
    .replace(/\bXin\b/gi, 'X')
    .replace(/\s+/g, ' ')
    .trim();
}

function yearFromValue(value) {
  const match = str(value).match(/(?:19|20)\d{2}/);
  return match ? match[0] : '';
}

function monthFromValue(value) {
  const raw = str(value);
  if (/^\d{1,2}$/.test(raw)) {
    const month = Number(raw);
    if (month >= 1 && month <= 12) return String(month);
  }
  const months = [
    'january',
    'february',
    'march',
    'april',
    'may',
    'june',
    'july',
    'august',
    'september',
    'october',
    'november',
    'december',
  ];
  const idx = months.findIndex(
    (name) => raw.toLowerCase() === name || raw.toLowerCase().startsWith(name.slice(0, 3))
  );
  return idx >= 0 ? String(idx + 1) : '';
}

function parseYearMonth(value) {
  const raw = str(value);
  if (!raw) return { year: '', month: '' };
  const yearFirst = raw.match(/^((?:19|20)\d{2})[/-](\d{1,2})$/);
  if (yearFirst) {
    const month = Number(yearFirst[2]);
    return {
      year: yearFirst[1],
      month: month >= 1 && month <= 12 ? String(month) : '',
    };
  }
  const monthFirst = raw.match(/^(\d{1,2})[/-]((?:19|20)\d{2})$/);
  if (monthFirst) {
    const month = Number(monthFirst[1]);
    return {
      year: monthFirst[2],
      month: month >= 1 && month <= 12 ? String(month) : '',
    };
  }
  return { year: yearFromValue(raw), month: monthFromValue(raw) };
}

function isCalendarYear(value) {
  const year = Number(value);
  return Number.isInteger(year) && year >= 1900 && year <= 2100;
}

function inferEducationLevel(qualification, institution) {
  const haystack = `${qualification} ${institution}`.toLowerCase();
  if (/\b(ph\.?d|doctorate)\b/.test(haystack)) return "Doctorate";
  if (/\b(m\.?tech|mba|m\.?sc|m\.?e\b|master|pgdm|post\s*grad)/.test(haystack)) return "Master's";
  if (/\b(b\.?tech|btech|b\.?e\b|b\.?sc|bachelor|bca|bba)\b/.test(haystack)) return "Bachelor's";
  if (/\bdiploma\b/.test(haystack)) return 'Diploma';
  if (/\b(12th|xii|hsc|higher\s*secondary|class\s*12|2nd\s*puc)\b/.test(haystack)) return 'High School';
  if (/\b(10th|\bssc\b|class\s*10|secondary)\b/.test(haystack)) return 'High School';
  if (/\b(cbse|icse|school)\b/.test(haystack)) return 'High School';
  return '';
}

function computeCourseDuration(startYear, startMonth, endYear, endMonth) {
  if (!isCalendarYear(startYear) || !isCalendarYear(endYear)) return '';
  const startY = Number(startYear);
  const endY = Number(endYear);
  const startM = Number(startMonth) || 1;
  const endM = Number(endMonth) || 1;
  if (endY < startY || (endY === startY && endM < startM)) return '';
  const months = Math.max(1, endY * 12 + endM - (startY * 12 + startM));
  const years = months / 12;
  if (years < 0.2) return '';
  const rounded = Number.isInteger(years) ? String(years) : years.toFixed(2).replace(/\.00$/, '');
  return `${rounded} ${Number(rounded) === 1 ? 'year' : 'years'}`;
}

export function normalizeEducationEntriesForProfile(entries = []) {
  if (!Array.isArray(entries)) return [];
  return entries
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const qualification = cleanEducationQualification(
        entry.qualification || entry.degree || entry.degreeProgram
      );
      const institution = str(
        entry.instituteName || entry.institution || entry.institutionName
      );
      if (!qualification && !institution) return null;
      const startParsed = parseYearMonth(entry.startYear || entry.startDate);
      const endParsed = parseYearMonth(entry.endYear || entry.endDate);
      const startYear = startParsed.year;
      const endYear = endParsed.year;
      const startMonth = monthFromValue(entry.startMonth) || startParsed.month;
      const currentlyStudying =
        entry.currentlyStudying === true || /present|current|ongoing/i.test(str(entry.endYear));
      const endMonth = currentlyStudying
        ? ''
        : monthFromValue(entry.endMonth) || endParsed.month;
      const educationLevel =
        str(entry.educationLevel) || inferEducationLevel(qualification, institution);
      const grade = str(entry.grade || entry.percentage || entry.gpa || entry.score);
      const storedDuration = str(entry.courseDuration);
      const storedDurationNumeric = Number(storedDuration.replace(/[^\d.]/g, ''));
      const junkStoredDuration =
        Number.isFinite(storedDurationNumeric) &&
        storedDurationNumeric > 0 &&
        storedDurationNumeric < 0.2 &&
        !/\bmonth/i.test(storedDuration);
      const courseDuration =
        storedDuration && !junkStoredDuration
          ? storedDuration
          : computeCourseDuration(startYear, startMonth, currentlyStudying ? '' : endYear, endMonth);
      return {
        ...entry,
        educationLevel,
        qualification,
        degree: qualification,
        degreeProgram: qualification,
        instituteName: institution,
        institution,
        institutionName: institution,
        fieldOfStudy: str(entry.fieldOfStudy || entry.field),
        startYear,
        endYear: currentlyStudying ? '' : endYear,
        startMonth,
        endMonth,
        currentlyStudying,
        grade,
        courseDuration,
      };
    })
    .filter(Boolean);
}

function languageRows(parsed = {}) {
  if (Array.isArray(parsed.languageProficiency) && parsed.languageProficiency.length) {
    return parsed.languageProficiency
      .map((row) => ({
        name: str(row?.language || row?.name),
        proficiency: str(row?.proficiency || row?.level) || undefined,
      }))
      .filter((row) => row.name);
  }
  const list = Array.isArray(parsed.languages) ? parsed.languages : [];
  return list
    .map((item) => {
      if (item && typeof item === 'object') {
        return {
          name: str(item.name || item.language),
          proficiency: str(item.proficiency || item.level) || undefined,
        };
      }
      const text = str(item);
      const match = text.match(/^(.*?)\s*\((.+)\)$/);
      return match
        ? { name: match[1].trim(), proficiency: match[2].trim() }
        : { name: text };
    })
    .filter((row) => row.name);
}

function skillRows(parsed = {}) {
  const list = Array.isArray(parsed.skills) ? parsed.skills : [];
  return list
    .map((item) => {
      if (item && typeof item === 'object') {
        return {
          name: str(item.name || item.skill),
          proficiency: str(item.proficiency) || undefined,
          category: str(item.category) || 'Hard Skills',
        };
      }
      const name = str(item);
      return name ? { name, category: 'Hard Skills' } : null;
    })
    .filter(Boolean);
}

function certificationRows(parsed = {}) {
  const list = Array.isArray(parsed.certifications) ? parsed.certifications : [];
  return list
    .map((item) => {
      if (item && typeof item === 'object') {
        const certificationName = str(item.certificationName || item.name || item.title);
        return certificationName ? { ...item, certificationName } : null;
      }
      const certificationName = str(item);
      return certificationName ? { certificationName } : null;
    })
    .filter(Boolean);
}

function workExperienceRows(entries = []) {
  if (!Array.isArray(entries)) return [];
  return entries
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const title = str(entry.title || entry.role || entry.designation);
      const company = str(entry.company || entry.employer || entry.organization);
      if (!title && !company) return null;
      return {
        ...entry,
        title,
        jobTitle: title,
        company,
        location: str(entry.location),
        startDate: str(entry.startDate || entry.startYear),
        endDate: str(entry.endDate || entry.endYear),
        startYear: parseYearMonth(entry.startYear || entry.startDate).year,
        endYear: parseYearMonth(entry.endYear || entry.endDate).year,
        startMonth: monthFromValue(entry.startMonth) || parseYearMonth(entry.startDate || entry.startYear).month,
        endMonth: monthFromValue(entry.endMonth) || parseYearMonth(entry.endDate || entry.endYear).month,
        currentlyWorking:
          entry.currentlyWorking === true || /present|current/i.test(str(entry.endDate || entry.endYear)),
        responsibilities: Array.isArray(entry.responsibilities) ? entry.responsibilities : [],
      };
    })
    .filter(Boolean);
}

const INDIA_PLACE_RX =
  /\b(india|mumbai|navi mumbai|delhi|new delhi|bengaluru|bangalore|hyderabad|chennai|kolkata|pune|ahmedabad|jaipur|kochi|gurgaon|gurugram|noida|andheri|thane|panvel)\b/i;

function inferNationality(parsed = {}, extraData = {}) {
  const direct =
    str(parsed.nationality) ||
    str(extraData?.pipeline?.personal?.nationality) ||
    str(extraData?.personal?.nationality);
  if (direct) return direct;
  const country = str(parsed.country);
  if (/^india$/i.test(country)) return 'India';
  const place = [country, parsed.city, parsed.location, parsed.currentAddress].filter(Boolean).join(' ');
  if (INDIA_PLACE_RX.test(place)) return 'India';
  return country || '';
}

function sanePassport(value) {
  const raw = str(value).replace(/\s+/g, '');
  if (raw.length < 6) return '';
  if (!/^[A-Za-z0-9]{6,12}$/.test(raw)) return '';
  return raw;
}

function splitCityCountry(parsed = {}) {
  const city = str(parsed.city);
  const country = str(parsed.country);
  if (city && country) return { city, country };
  const location = str(parsed.location);
  if (location.includes(',')) {
    const parts = location.split(',').map((part) => part.trim()).filter(Boolean);
    if (parts.length >= 2) {
      return {
        city: city || parts.slice(0, -1).join(', '),
        country: country || parts[parts.length - 1],
      };
    }
  }
  return { city: city || location, country };
}

function snapshotLooksComplete(snap) {
  if (!snap || typeof snap !== 'object' || Array.isArray(snap)) return false;
  if (snap._source === 'inbox-resume') return false;
  const hasEducation = Array.isArray(snap.education) && snap.education.length > 0;
  const hasWork = Array.isArray(snap.workExperience) && snap.workExperience.length > 0;
  const hasLanguages = Array.isArray(snap.languages) && snap.languages.length > 0;
  return Boolean(hasEducation || hasWork || hasLanguages);
}

export function buildInboxPhase1Snapshot(parsed = {}, extraData = {}, extras = {}) {
  const education = normalizeEducationEntriesForProfile(parsed.educationEntries);
  const workExperience = workExperienceRows(parsed.workExperienceEntries);
  const languages = languageRows(parsed);
  const skills = skillRows(parsed);
  const firstName = str(parsed.firstName);
  const lastName = str(parsed.lastName);
  const email = repairParsedEmail(parsed.email) || str(parsed.email);
  const split = splitCityCountry(parsed);
  const nationality = inferNationality({ ...parsed, country: split.country }, extraData);
  const city = split.city;
  const country = split.country || (/^india$/i.test(nationality) ? 'India' : '');
  const location =
    str(parsed.location) || [city, country].filter(Boolean).join(', ');
  const rawAddress = str(parsed.currentAddress || extraData?.pipeline?.personal?.currentAddress);
  const address =
    rawAddress && rawAddress.toLowerCase() !== city.toLowerCase() ? rawAddress : '';
  const currentRole = str(parsed.currentDesignation || parsed.designation);
  const currentCompany = str(parsed.currentCompany || parsed.currentEmployer);
  const noticePeriod = str(parsed.noticePeriod);
  const noticePeriodDays =
    parsed.noticePeriodInDays != null && Number(parsed.noticePeriodInDays) > 0
      ? Number(parsed.noticePeriodInDays)
      : null;
  const personal = extraData?.pipeline?.personal || extraData?.personal || {};
  const age = parsed.age != null ? parsed.age : personal.age;
  const maritalStatus = str(parsed.maritalStatus || personal.maritalStatus);

  return {
    personalInfo: {
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      email: email || undefined,
      phone: str(parsed.phone) || undefined,
      gender: str(parsed.gender || personal.gender) || undefined,
      dob: str(parsed.birthDate || personal.birthDate) || undefined,
      age: age != null && String(age).trim() ? age : undefined,
      maritalStatus: maritalStatus || undefined,
      country: country || undefined,
      city: city || undefined,
      address: address || undefined,
      nationality: nationality || undefined,
      passportNumber: sanePassport(parsed.passportNumber || personal.passportNumber) || undefined,
      linkedinUrl: str(parsed.linkedinUrl) || undefined,
      profilePhotoUrl: str(parsed.profilePhotoUrl) || undefined,
    },
    summaryText: str(parsed.summary) || undefined,
    workExperience,
    education,
    skills,
    languages,
    certifications: certificationRows(parsed),
    portfolioLinks: Array.isArray(parsed.portfolioLinks) ? parsed.portfolioLinks : [],
    careerPreferences: {
      currentRole: currentRole || undefined,
      currentOrganization: currentCompany || undefined,
      currentCompany: currentCompany || undefined,
      currentLocation: location || undefined,
      currentSalary: parsed.currentSalary ?? undefined,
      currentCurrency: str(parsed.currency || parsed.currentSalaryCurrency) || undefined,
      currentBenefits: str(parsed.currentBenefits) || undefined,
      preferredSalary: parsed.expectedSalary ?? undefined,
      preferredCurrency: str(parsed.expectedSalaryCurrency || parsed.currency) || undefined,
      preferredBenefits: str(parsed.expectedBenefits) || undefined,
      preferredLocations: location ? [location] : [],
      noticePeriod: noticePeriod || (noticePeriodDays ? `${noticePeriodDays} days` : undefined),
      noticePeriodDays,
      experience: parsed.experience ?? parsed.totalExperience ?? undefined,
    },
    resume: {
      fileName: str(extras.fileName) || undefined,
      fileUrl: str(extras.resumeUrl || parsed.resumeUrl) || undefined,
    },
    _phase1SnapshotSavedAt: new Date().toISOString(),
    _savedAt: new Date().toISOString(),
    _source: 'inbox-resume',
  };
}

export function mergeInboxExtraData(existing, parsedExtra, snapshot) {
  const current = existing && typeof existing === 'object' && !Array.isArray(existing) ? existing : {};
  const incoming =
    parsedExtra && typeof parsedExtra === 'object' && !Array.isArray(parsedExtra) ? parsedExtra : {};
  const existingSnap =
    current.phase1ProfileSnapshot &&
    typeof current.phase1ProfileSnapshot === 'object' &&
    !Array.isArray(current.phase1ProfileSnapshot)
      ? current.phase1ProfileSnapshot
      : null;
  const nextSnap = snapshotLooksComplete(existingSnap)
    ? existingSnap
    : snapshot || incoming.phase1ProfileSnapshot || existingSnap;
  const nationality =
    str(nextSnap?.personalInfo?.nationality) ||
    str(incoming.nationality) ||
    str(current.nationality);
  const careerPreferences = {
    ...(current.careerPreferences && typeof current.careerPreferences === 'object'
      ? current.careerPreferences
      : {}),
    ...(incoming.careerPreferences && typeof incoming.careerPreferences === 'object'
      ? incoming.careerPreferences
      : {}),
    ...(nextSnap?.careerPreferences && typeof nextSnap.careerPreferences === 'object'
      ? nextSnap.careerPreferences
      : {}),
  };

  const pipelineBase = incoming.pipeline || current.pipeline;
  const incomingEducation =
    pipelineBase && typeof pipelineBase === 'object' && pipelineBase.education && typeof pipelineBase.education === 'object'
      ? pipelineBase.education
      : {};
  const snapshotEducation = Array.isArray(nextSnap?.education) ? nextSnap.education : [];
  const pipeline =
    pipelineBase && typeof pipelineBase === 'object'
      ? {
          ...pipelineBase,
          personal: {
            ...(pipelineBase.personal && typeof pipelineBase.personal === 'object'
              ? pipelineBase.personal
              : {}),
            ...(nationality ? { nationality } : {}),
          },
          education: {
            ...incomingEducation,
            entries: snapshotEducation.length
              ? snapshotEducation
              : incomingEducation.entries || [],
          },
        }
      : pipelineBase;

  return {
    ...current,
    ...incoming,
    pipeline,
    personal: {
      ...(current.personal && typeof current.personal === 'object' ? current.personal : {}),
      ...(incoming.personal && typeof incoming.personal === 'object' ? incoming.personal : {}),
      ...(nationality ? { nationality } : {}),
    },
    social: incoming.social || current.social,
    professional: incoming.professional || current.professional,
    nationality: nationality || current.nationality,
    careerPreferences: Object.keys(careerPreferences).length ? careerPreferences : current.careerPreferences,
    phase1ProfileSnapshot: nextSnap,
  };
}
