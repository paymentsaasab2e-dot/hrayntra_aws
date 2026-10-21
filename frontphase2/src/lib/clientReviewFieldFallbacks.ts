import type { ClientReviewBatchRow, ClientReviewData } from './clientReviewTypes';
import type { ClientReviewSection } from './clientPresentationSections';
import {
  SUBMIT_TO_CLIENT_FIELD_LABELS,
  SUBMIT_TO_CLIENT_REVIEW_LABEL_FIELDS,
  type SubmitToClientFieldId,
} from './submitToClientFieldVisibility';

const LABEL_KEYS_BY_FIELD: Record<SubmitToClientFieldId, string[]> = (() => {
  const map = {} as Record<SubmitToClientFieldId, string[]>;
  for (const [fieldId, label] of Object.entries(SUBMIT_TO_CLIENT_FIELD_LABELS) as Array<
    [SubmitToClientFieldId, string]
  >) {
    map[fieldId] = [label.trim().toLowerCase()];
  }
  for (const [label, ids] of Object.entries(SUBMIT_TO_CLIENT_REVIEW_LABEL_FIELDS)) {
    if (ids.length !== 1) continue;
    const fieldId = ids[0];
    if (!fieldId) continue;
    // Split name labels must not satisfy the Full Name cell by themselves
    // (otherwise "First Name" = "R." wins over "R. Lamkhade").
    if (
      fieldId === 'fullName' &&
      (label === 'first name' || label === 'middle name' || label === 'last name')
    ) {
      continue;
    }
    const next = map[fieldId] ?? [];
    if (!next.includes(label)) next.push(label);
    map[fieldId] = next;
  }
  return map;
})();

function presentationFieldValue(
  detail: ClientReviewData | null | undefined,
  labels: string[],
): string {
  const wanted = new Set(labels.map((label) => label.trim().toLowerCase()).filter(Boolean));
  if (!wanted.size) return '';
  for (const section of sectionsOf(detail)) {
    for (const field of section.fields || []) {
      const label = String(field.label || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
      if (!wanted.has(label)) continue;
      const value = String(field.value ?? '').trim();
      if (!isBlankResolvedValue(value)) return value;
    }
  }
  return '';
}

function nameTokenCount(value: string): number {
  return String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function pickRichestName(...candidates: Array<string | null | undefined>): string {
  const ranked = candidates
    .map((value) => String(value || '').trim())
    .filter((value) => !isBlankResolvedValue(value))
    .sort((a, b) => {
      const tokenDiff = nameTokenCount(b) - nameTokenCount(a);
      if (tokenDiff !== 0) return tokenDiff;
      return b.length - a.length;
    });
  return ranked[0] || '';
}

/** Combined first + middle + last (or stored display name) for client table / drawer. */
export function resolveClientReviewFullName(row: ClientReviewBatchRow): string {
  const detail = row.detail;
  const candidate = detail?.candidate || {};
  const fromCandidateParts = [
    String(candidate.firstName || '').trim(),
    String(candidate.middleName || '').trim(),
    String(candidate.lastName || '').trim(),
  ]
    .filter(Boolean)
    .join(' ');
  const fromStoredName = String(candidate.name || row.candidateName || '').trim();
  const fromPresentationFull = presentationFieldValue(detail, [
    'full name',
    'name',
    'name of candidate',
  ]);
  const fromPresentationParts = [
    presentationFieldValue(detail, ['first name']),
    presentationFieldValue(detail, ['middle name']),
    presentationFieldValue(detail, ['last name']),
  ]
    .filter(Boolean)
    .join(' ');

  return pickRichestName(
    fromCandidateParts,
    fromStoredName,
    fromPresentationParts,
    fromPresentationFull,
  );
}

function candidateExtra(candidate: ClientReviewData['candidate']): Record<string, unknown> {
  return (candidate || {}) as Record<string, unknown>;
}

function isBlankResolvedValue(value: unknown): boolean {
  const text = String(value ?? '').trim();
  return !text || text === '—' || text === '-' || text === '[]' || text === '{}';
}

function decodeBasicHtmlEntities(value: string): string {
  return String(value || '')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&nbsp;/gi, ' ');
}

/** Plain text from SAASA CV overlays — used when profile city/country/name were never filled. */
export function collectClientReviewCvPlainText(
  detail: ClientReviewData | null | undefined,
): string {
  const pages = detail?.saasaCvPreview?.pdfTextLayerHtml;
  if (!Array.isArray(pages) || !pages.length) return '';
  const chunks: string[] = [];
  for (const html of pages) {
    const raw = String(html || '');
    for (const match of raw.matchAll(/data-saasa-original="([^"]*)"/gi)) {
      chunks.push(decodeBasicHtmlEntities(match[1] || ''));
    }
    for (const match of raw.matchAll(/>([^<]{2,180})</g)) {
      chunks.push(decodeBasicHtmlEntities(match[1] || ''));
    }
  }
  return chunks.join('\n');
}

const KNOWN_COUNTRY_HINTS = [
  'cameroon',
  'cameroun',
  'nigeria',
  'ghana',
  'kenya',
  'uganda',
  'tanzania',
  'rwanda',
  'senegal',
  'ivory coast',
  "cote d'ivoire",
  'south africa',
  'india',
  'united arab emirates',
  'uae',
  'united states',
  'usa',
  'united kingdom',
  'uk',
  'france',
  'germany',
  'canada',
];

function looksLikeCountryName(value: string): boolean {
  const key = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\./g, '');
  if (!key || key.length < 2) return false;
  return KNOWN_COUNTRY_HINTS.some(
    (hint) => key === hint || key.includes(hint) || hint.includes(key),
  );
}

/** Pull City / Country from CV header lines like `Douala,Cameroon(+237)...`. */
export function inferLocationFromClientReviewCvText(text: string): {
  city: string;
  country: string;
} {
  const raw = String(text || '');
  if (!raw.trim()) return { city: '', country: '' };

  const spaced = [
    ...raw.matchAll(
      /\b([A-Za-z][A-Za-z .'-]{1,40}),\s*([A-Za-z][A-Za-z .'-]{1,40})\b/g,
    ),
  ];
  const mashed = [...raw.matchAll(/\b([A-Za-z]{3,40}),([A-Za-z]{3,40})\b/g)];

  for (const match of [...spaced, ...mashed]) {
    const left = String(match[1] || '').trim();
    const right = String(match[2] || '').trim();
    if (!left || !right) continue;
    if (looksLikeCountryName(right)) {
      return { city: left, country: right };
    }
    if (looksLikeCountryName(left)) {
      return { city: right, country: left };
    }
  }

  return { city: '', country: '' };
}

function formatEntryRows(entries: Array<Record<string, unknown>> | undefined): string {
  if (!Array.isArray(entries) || !entries.length) return '';
  return entries
    .map((entry) => {
      const title =
        String(entry.degreeProgram || entry.degree || entry.jobTitle || entry.title || entry.company || entry.institutionName || entry.institution || '').trim();
      const meta = [
        String(entry.institutionName || entry.institution || entry.companyName || entry.company || '').trim(),
        [
          String(entry.startYear || entry.startDate || '').trim(),
          String(entry.endYear || entry.endDate || '').trim(),
        ]
          .filter(Boolean)
          .join('–'),
      ]
        .filter(Boolean)
        .filter((part) => part !== title);
      if (!title && !meta.length) return '';
      return meta.length ? `${title}${title ? ' · ' : ''}${meta.join(' · ')}` : title;
    })
    .filter(Boolean)
    .join('\n');
}

function formatVisaEntries(entries: Array<Record<string, unknown>> | undefined): string {
  if (!Array.isArray(entries) || !entries.length) return '';
  return entries
    .map((entry) => {
      const country = String(entry.countryName || entry.country || '').trim();
      const visaType = String(entry.visaType || '').trim();
      const status = String(entry.visaStatus || entry.requiresVisa || '').trim();
      const parts = [country, visaType, status].filter(Boolean);
      return parts.join(' · ');
    })
    .filter(Boolean)
    .join('\n');
}

function sectionsOf(detail: ClientReviewData | null | undefined): ClientReviewSection[] {
  return Array.isArray(detail?.presentationSections) ? detail.presentationSections : [];
}

export function presentationValueForField(
  detail: ClientReviewData | null | undefined,
  fieldId: SubmitToClientFieldId,
): string {
  const labels = new Set((LABEL_KEYS_BY_FIELD[fieldId] || []).map((label) => label.toLowerCase()));
  for (const section of sectionsOf(detail)) {
    for (const field of section.fields || []) {
      const label = String(field.label || '')
        .trim()
        .toLowerCase();
      if (!labels.has(label)) continue;
      const value = String(field.value ?? '').trim();
      if (!isBlankResolvedValue(value)) return value;
    }
  }
  return '';
}

function educationEntriesText(row: ClientReviewBatchRow): string {
  const candidate = row.detail?.candidate;
  const fromCandidate = formatEntryRows(
    (candidate?.cvEducationEntries || []) as Array<Record<string, unknown>>,
  );
  if (fromCandidate) return fromCandidate;
  const section = sectionsOf(row.detail).find((item) => String(item.id || '').toLowerCase() === 'education');
  if (section?.entries?.length) return formatEntryRows(section.entries as Array<Record<string, unknown>>);
  return String(candidate?.education || candidate?.educationSummary || '').trim();
}

function workEntriesText(row: ClientReviewBatchRow): string {
  const candidate = row.detail?.candidate;
  const fromCandidate = formatEntryRows(
    (candidate?.cvWorkExperienceEntries || []) as Array<Record<string, unknown>>,
  );
  if (fromCandidate) return fromCandidate;
  const section = sectionsOf(row.detail).find((item) => String(item.id || '').toLowerCase() === 'work');
  if (section?.entries?.length) return formatEntryRows(section.entries as Array<Record<string, unknown>>);
  return '';
}

function visaEntriesText(row: ClientReviewBatchRow): string {
  const section = sectionsOf(row.detail).find((item) => String(item.id || '').toLowerCase() === 'visa');
  if (section?.entries?.length) return formatVisaEntries(section.entries as Array<Record<string, unknown>>);
  return presentationValueForField(row.detail, 'p1Visa');
}

function joinList(value: unknown): string {
  if (!Array.isArray(value)) return String(value || '').trim();
  return value
    .map((item) => {
      if (item && typeof item === 'object') {
        const rec = item as Record<string, unknown>;
        const lang = String(rec.language || rec.name || '').trim();
        const prof = String(rec.proficiency || rec.level || '').trim();
        return [lang, prof].filter(Boolean).join(' | ');
      }
      return String(item || '').trim();
    })
    .filter(Boolean)
    .join(', ');
}

function parseBirthDate(value: unknown): Date | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const date = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const dmy = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (dmy) {
    const day = dmy[1].padStart(2, '0');
    const month = dmy[2].padStart(2, '0');
    const date = new Date(`${dmy[3]}-${month}-${day}T00:00:00`);
    if (!Number.isNaN(date.getTime()) && date.getDate() === Number(dmy[1])) return date;
    const alt = new Date(`${dmy[3]}-${day}-${month}T00:00:00`);
    return Number.isNaN(alt.getTime()) ? null : alt;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function ageFromBirthDate(value: unknown): string {
  const birth = parseBirthDate(value);
  if (!birth) return '';
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age -= 1;
  if (!Number.isFinite(age) || age < 0 || age > 120) return '';
  return String(age);
}

function storedAge(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const num = Number(raw);
  if (Number.isFinite(num) && num > 0 && num <= 120) return String(Math.round(num));
  return raw;
}

function money(value: unknown): string {
  if (value === undefined || value === null || value === '') return '';
  return String(value).trim();
}

function careerPrefsOf(candidate: ClientReviewData['candidate']): Record<string, unknown> {
  const rec = candidate as Record<string, unknown> | undefined;
  const prefs = rec?.careerPreferences;
  return prefs && typeof prefs === 'object' && !Array.isArray(prefs)
    ? (prefs as Record<string, unknown>)
    : {};
}

function overviewExpectedSalary(candidate: ClientReviewData['candidate']): unknown {
  const prefs = careerPrefsOf(candidate);
  return prefs.preferredSalary ?? prefs.salaryAmount ?? candidate?.expectedSalary;
}

function overviewCurrentSalary(candidate: ClientReviewData['candidate']): unknown {
  const prefs = careerPrefsOf(candidate);
  return prefs.currentSalary ?? candidate?.currentSalary;
}

function overviewExperience(candidate: ClientReviewData['candidate']): string {
  const rec = candidate as Record<string, unknown> | undefined;
  const years = rec?.experienceYears;
  const exp = candidate?.experience;
  const y = years != null && Number.isFinite(Number(years)) ? Number(years) : null;
  const e = exp != null && Number.isFinite(Number(exp)) ? Number(exp) : null;
  const pick = y != null && e != null ? (!Number.isInteger(y) ? y : !Number.isInteger(e) ? e : y) : y ?? e;
  if (pick == null) return String(exp ?? '').trim();
  return String(Math.round(pick * 10) / 10);
}

/** Values the table already has — used to fill empty drawer fields. */
export function clientReviewFieldFallbacks(
  detail: ClientReviewData | null | undefined,
): Partial<Record<SubmitToClientFieldId, string>> {
  const candidate = detail?.candidate || {};
  const scoreHidden = detail?.trackerOptions?.showScore === false;
  const rawScore = detail?.matchScore;
  const score =
    !scoreHidden && Number.isFinite(Number(rawScore)) ? String(Math.round(Number(rawScore))) : '';
  const experience = overviewExperience(candidate);
  const prefs = careerPrefsOf(candidate);
  const birthDate = String(candidate.birthDate || '').trim();
  const age = storedAge(candidate.age) || ageFromBirthDate(birthDate);
  const extra = candidateExtra(candidate);
  const cvText = collectClientReviewCvPlainText(detail);
  const fromCvLocation = inferLocationFromClientReviewCvText(cvText);
  const city =
    String(candidate.city || '').trim() ||
    fromCvLocation.city ||
    String(extra.currentLocation || '').trim();
  const country =
    String(candidate.country || '').trim() || fromCvLocation.country;

  return {
    fullName: resolveClientReviewFullName({
      matchId: String(detail?.matchId || detail?.interviewId || 'candidate'),
      candidateName: String(candidate.name || '').trim(),
      detail,
    } as ClientReviewBatchRow),
    email: String(candidate.email || '').trim(),
    phoneCode: String(candidate.phoneCode || '').trim(),
    phone: String(candidate.phone || '').trim(),
    age,
    birthDate,
    city,
    state: String(candidate.state || '').trim(),
    country,
    address: String(candidate.address || '').trim(),
    zip: String(candidate.zip || '').trim(),
    nationality: String(candidate.nationality || '').trim(),
    gender: String(candidate.gender || '').trim(),
    employment: String(candidate.employment || '').trim(),
    maritalStatus: String(candidate.maritalStatus || '').trim(),
    passportNumber: String(candidate.passportNumber || '').trim(),
    preferredLocation: String(candidate.preferredLocation || '').trim(),
    currentCompanyWebsite: String(candidate.currentCompanyWebsite || '').trim(),
    currentTitle: String(
      prefs.currentRole || candidate.designation || candidate.currentTitle || '',
    ).trim(),
    currentCompany: String(
      prefs.currentOrganization || prefs.currentCompany || candidate.currentCompany || '',
    ).trim(),
    experience,
    candidateScore: score,
    currentSalary: money(overviewCurrentSalary(candidate)),
    currentSalaryCurrency: String(
      prefs.currentCurrency || candidate.currentSalaryCurrency || '',
    ).trim(),
    currentBenefits: joinList(
      Object.prototype.hasOwnProperty.call(prefs, 'currentBenefits')
        ? prefs.currentBenefits
        : candidate.currentBenefits,
    ),
    expectedSalary: money(overviewExpectedSalary(candidate)),
    expectedSalaryCurrency: String(
      prefs.preferredCurrency || prefs.salaryCurrency || candidate.expectedSalaryCurrency || '',
    ).trim(),
    expectedBenefits: joinList(
      Object.prototype.hasOwnProperty.call(prefs, 'preferredBenefits')
        ? prefs.preferredBenefits
        : candidate.expectedBenefits,
    ),
    noticePeriod: String(candidate.noticePeriod || '').trim(),
    remarks: String(candidate.remarks || '').trim(),
    skills: joinList(candidate.skills),
    languageProficiency: joinList(candidate.languageProficiency || candidate.languages),
    cvSummary: String(candidate.cvSummary || '').trim(),
    educationSummary: String(candidate.education || candidate.educationSummary || '').trim(),
    educationCourses: joinList(candidate.educationCourses),
    linkedIn: String(candidate.linkedIn || '').trim(),
    twitter: String(candidate.twitter || '').trim(),
    facebook: String(candidate.facebook || '').trim(),
    website: String(candidate.website || '').trim(),
    skypeId: String(candidate.skypeId || '').trim(),
    stackOverflow: String(candidate.stackOverflow || '').trim(),
    xing: String(candidate.xing || '').trim(),
    cvPortfolioLinks: joinList(candidate.cvPortfolioLinks),
    certifications: joinList(candidate.certifications),
    honours: joinList(candidate.honours),
    notes: String(candidate.notes || '').trim(),
    workHistoryText: String(extra.workHistoryText || '').trim(),
    extracurricular: joinList(extra.extracurricular),
    volunteers: joinList(extra.volunteers),
    projects: joinList(extra.projects),
    hackathons: joinList(extra.hackathons),
    p1PreferredJobTitles: joinList(extra.p1PreferredJobTitles),
    p1PreferredIndustries: joinList(extra.p1PreferredIndustries),
    p1FunctionalAreas: joinList(extra.p1FunctionalAreas),
    p1JobTypes: joinList(extra.p1JobTypes),
    p1WorkModes: joinList(extra.p1WorkModes),
    p1Relocation: String(extra.p1Relocation || '').trim(),
    p1AvailabilityToStart: String(extra.p1AvailabilityToStart || '').trim(),
    p1Internships: joinList(extra.p1Internships),
    p1Gap: String(extra.p1Gap || '').trim(),
    p1Academic: joinList(extra.p1Academic),
    p1Exams: joinList(extra.p1Exams),
    p1Accomplishments: joinList(extra.p1Accomplishments),
    p1Vaccination: String(extra.p1Vaccination || '').trim(),
  };
}

/** Same resolution order as the client review table and drawer. */
export function resolveClientReviewFieldValue(
  row: ClientReviewBatchRow,
  fieldId: SubmitToClientFieldId,
): string {
  const detail = row.detail;
  const candidate = detail?.candidate || {};
  const mergedDetail: ClientReviewData = {
    ...(detail || { interviewId: '' }),
    matchScore: row.matchScore ?? detail?.matchScore,
  };

  if (fieldId === 'candidateScore' && detail?.trackerOptions?.showScore === false) {
    return '';
  }

  const fallbacks = clientReviewFieldFallbacks(mergedDetail);
  const liveOverviewFields = new Set<SubmitToClientFieldId>([
    'expectedSalary',
    'expectedSalaryCurrency',
    'currentSalary',
    'currentSalaryCurrency',
    'currentBenefits',
    'expectedBenefits',
    'experience',
    'languageProficiency',
    'currentTitle',
    'currentCompany',
  ]);
  if (fieldId !== 'fullName' && liveOverviewFields.has(fieldId) && fallbacks[fieldId]) {
    return String(fallbacks[fieldId] || '');
  }

  const fromPresentation = presentationValueForField(detail, fieldId);
  if (fieldId !== 'fullName' && fromPresentation) return fromPresentation;

  if (fieldId === 'fullName') {
    return resolveClientReviewFullName(row);
  }

  const fromFallback = fallbacks[fieldId];
  if (fromFallback) return fromFallback;

  switch (fieldId) {
    case 'currentTitle':
      return String(row.designation || candidate.designation || candidate.currentTitle || '').trim();
    case 'experience':
      return overviewExperience(candidate) || String(row.experience || '').trim();
    case 'age':
      return (
        storedAge(candidate.age) ||
        ageFromBirthDate(candidate.birthDate) ||
        ageFromBirthDate(presentationValueForField(detail, 'birthDate'))
      );
    case 'cvEducationEntries':
      return educationEntriesText(row);
    case 'educationSummary':
      return String(candidate.education || candidate.educationSummary || '').trim();
    case 'cvWorkExperienceEntries':
      return workEntriesText(row);
    case 'p1Visa':
      return visaEntriesText(row);
    case 'p1Resume':
      return '';
    default:
      return '';
  }
}

export function resolveClientReviewLabelValue(row: ClientReviewBatchRow, label: string): string {
  const key = String(label || '')
    .trim()
    .toLowerCase();
  if (!key) return '';

  const mapped = SUBMIT_TO_CLIENT_REVIEW_LABEL_FIELDS[key];
  if (mapped?.length === 1) {
    return resolveClientReviewFieldValue(row, mapped[0]);
  }

  for (const section of sectionsOf(row.detail)) {
    for (const field of section.fields || []) {
      if (
        String(field.label || '')
          .trim()
          .toLowerCase() !== key
      ) {
        continue;
      }
      const value = String(field.value ?? '').trim();
      if (!isBlankResolvedValue(value)) return value;
    }
  }

  for (const [fieldId, fieldLabel] of Object.entries(SUBMIT_TO_CLIENT_FIELD_LABELS) as Array<
    [SubmitToClientFieldId, string]
  >) {
    if (fieldLabel.trim().toLowerCase() !== key) continue;
    return resolveClientReviewFieldValue(row, fieldId);
  }

  return '';
}
