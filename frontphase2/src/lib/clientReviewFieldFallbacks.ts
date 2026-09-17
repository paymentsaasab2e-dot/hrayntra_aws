import type { ClientReviewData } from './clientReviewTypes';
import type { SubmitToClientFieldId } from './submitToClientFieldVisibility';

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

/** Values the table already has — used to fill empty drawer fields. */
export function clientReviewFieldFallbacks(
  detail: ClientReviewData | null | undefined,
): Partial<Record<SubmitToClientFieldId, string>> {
  const candidate = detail?.candidate || {};
  const parts = String(candidate.name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const scoreHidden = detail?.trackerOptions?.showScore === false;
  const rawScore = detail?.matchScore;
  const score =
    !scoreHidden && Number.isFinite(Number(rawScore)) ? String(Math.round(Number(rawScore))) : '';
  const experience = Number.isFinite(Number(candidate.experience))
    ? String(candidate.experience)
    : String(candidate.experience || '').trim();
  const birthDate = String(candidate.birthDate || '').trim();
  const age = storedAge(candidate.age) || ageFromBirthDate(birthDate);

  return {
    firstName: parts[0] || String(candidate.firstName || '').trim(),
    middleName: String(candidate.middleName || '').trim(),
    lastName: parts.length > 1 ? parts[parts.length - 1] || '' : String(candidate.lastName || '').trim(),
    email: String(candidate.email || '').trim(),
    phoneCode: String(candidate.phoneCode || '').trim(),
    phone: String(candidate.phone || '').trim(),
    age,
    birthDate,
    city: String(candidate.city || '').trim(),
    state: String(candidate.state || '').trim(),
    country: String(candidate.country || '').trim(),
    address: String(candidate.address || '').trim(),
    zip: String(candidate.zip || '').trim(),
    nationality: String(candidate.nationality || '').trim(),
    gender: String(candidate.gender || '').trim(),
    employment: String(candidate.employment || '').trim(),
    maritalStatus: String(candidate.maritalStatus || '').trim(),
    passportNumber: String(candidate.passportNumber || '').trim(),
    preferredLocation: String(candidate.preferredLocation || '').trim(),
    currentCompanyWebsite: String(candidate.currentCompanyWebsite || '').trim(),
    currentTitle: String(candidate.designation || candidate.currentTitle || '').trim(),
    currentCompany: String(candidate.currentCompany || '').trim(),
    experience,
    candidateScore: score,
    currentSalary: money(candidate.currentSalary),
    currentSalaryCurrency: String(candidate.currentSalaryCurrency || '').trim(),
    currentBenefits: String(candidate.currentBenefits || '').trim(),
    expectedSalary: money(candidate.expectedSalary),
    expectedSalaryCurrency: String(candidate.expectedSalaryCurrency || '').trim(),
    expectedBenefits: String(candidate.expectedBenefits || '').trim(),
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
  };
}
