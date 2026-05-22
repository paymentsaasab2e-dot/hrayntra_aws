/**
 * Snapshot + client-preview payload for Submit to Client / public review links.
 */

import { mergeCandidateWithClientPresentation } from './clientPresentationDraft.js';

const DEFAULT_SECTION_ORDER = ['summary', 'experience', 'education', 'skills'];
const DEFAULT_CANDIDATE_PHOTO_POS = { x: 430, y: 36 };
const DEFAULT_COMPANY_LOGO_POS = { x: 430, y: 118 };
const DEFAULT_WATERMARK = {
  text: 'CONFIDENTIAL',
  opacity: 8,
  color: '#000000',
  active: false,
};

function readCvEditorLayout(extraData) {
  if (!extraData || typeof extraData !== 'object' || Array.isArray(extraData)) return null;
  const layout = extraData.cvEditorLayout;
  if (!layout || typeof layout !== 'object' || Array.isArray(layout)) return null;
  return layout;
}

function formatPeriod(start, end) {
  const parts = [start, end].map((v) => String(v || '').trim()).filter(Boolean);
  return parts.join(' – ');
}

function workEntryToExperience(entry, index) {
  if (!entry || typeof entry !== 'object') return null;
  const title = entry.title || entry.jobTitle || '';
  const company = entry.company || entry.companyName || '';
  const responsibilities = Array.isArray(entry.responsibilities)
    ? entry.responsibilities
    : [];
  const desc = responsibilities
    .map((line) => String(line || '').trim())
    .filter(Boolean)
    .join('\n');
  const period = formatPeriod(entry.startDate, entry.endDate);
  if (!title && !company && !desc) return null;
  return {
    id: index + 1,
    role: String(title || '').trim(),
    company: String(company || '').trim(),
    period,
    desc,
  };
}

function educationEntryToEducation(entry, index) {
  if (!entry || typeof entry !== 'object') return null;
  const degree = entry.degree || '';
  const school = entry.institution || entry.school || '';
  const period = formatPeriod(entry.startYear, entry.endYear);
  if (!degree && !school) return null;
  return {
    id: index + 1,
    degree: String(degree || '').trim(),
    school: String(school || '').trim(),
    period,
  };
}

/**
 * Frozen CV payload at submit time (stored on candidate.extraData.cvSubmission.snapshot).
 */
export function buildCvSubmissionSnapshot(candidate, jobTitle = '') {
  const source = mergeCandidateWithClientPresentation(candidate);
  const extra =
    source?.extraData && typeof source.extraData === 'object' && !Array.isArray(source.extraData)
      ? source.extraData
      : {};
  const layout = readCvEditorLayout(extra);

  return {
    submittedAt: new Date().toISOString(),
    jobTitle: String(jobTitle || '').trim(),
    firstName: source?.firstName ?? null,
    lastName: source?.lastName ?? null,
    email: source?.email ?? null,
    phone: source?.phone ?? null,
    linkedIn: source?.linkedIn ?? null,
    location: source?.location ?? null,
    address: source?.address ?? null,
    city: source?.city ?? null,
    country: source?.country ?? null,
    currentTitle: source?.currentTitle ?? source?.designation ?? null,
    currentCompany: source?.currentCompany ?? null,
    experience: source?.experience ?? null,
    cvSummary: source?.cvSummary ?? null,
    skills: Array.isArray(source?.skills) ? source.skills : [],
    languages: Array.isArray(source?.languages) ? source.languages : [],
    education: source?.education ?? null,
    certifications: Array.isArray(source?.certifications) ? source.certifications : [],
    cvEducationEntries: Array.isArray(source?.cvEducationEntries) ? source.cvEducationEntries : [],
    cvWorkExperienceEntries: Array.isArray(source?.cvWorkExperienceEntries)
      ? source.cvWorkExperienceEntries
      : [],
    resume: source?.resume || source?.resumeUrl || null,
    avatar: source?.avatar ?? null,
    cvEditorLayout: layout,
  };
}

/**
 * Wire-format CV editor preview for the public client-review page (read-only modal).
 */
export function buildCvEditorPreviewFromSnapshot(snapshot, fallbackJobTitle = '') {
  if (!snapshot || typeof snapshot !== 'object') return null;

  const firstName = String(snapshot.firstName || '').trim();
  const lastName = String(snapshot.lastName || '').trim();
  const layout = snapshot.cvEditorLayout || {};
  const experiences = (Array.isArray(snapshot.cvWorkExperienceEntries)
    ? snapshot.cvWorkExperienceEntries
    : []
  )
    .map((entry, index) => workEntryToExperience(entry, index))
    .filter(Boolean);
  const education = (Array.isArray(snapshot.cvEducationEntries) ? snapshot.cvEducationEntries : [])
    .map((entry, index) => educationEntryToEducation(entry, index))
    .filter(Boolean);

  const avatar = (snapshot.avatar && String(snapshot.avatar).trim()) || null;
  const companyLogoUrl =
    (layout.companyLogoUrl && String(layout.companyLogoUrl).trim()) || null;

  return {
    name: `${firstName} ${lastName}`.trim() || 'Candidate',
    jobTitle: String(snapshot.jobTitle || fallbackJobTitle || snapshot.currentTitle || '').trim(),
    email: String(snapshot.email || '').trim(),
    phone: String(snapshot.phone || '').trim(),
    location: String(snapshot.location || '').trim(),
    linkedin: String(snapshot.linkedIn || '').trim(),
    summary: String(snapshot.cvSummary || '').trim(),
    experiences,
    education,
    skills: Array.isArray(snapshot.skills) ? snapshot.skills : [],
    candidatePhotoUrl: avatar,
    initialCandidatePhotoUrl: avatar,
    companyLogoUrl,
    initialCompanyLogoUrl: layout.initialCompanyLogoUrl ?? companyLogoUrl,
    candidatePhotoPos: layout.candidatePhotoPos ?? DEFAULT_CANDIDATE_PHOTO_POS,
    companyLogoPos: layout.companyLogoPos ?? DEFAULT_COMPANY_LOGO_POS,
    showCandidatePhotoSlot: layout.showCandidatePhotoSlot !== false,
    showCompanyLogoSlot: layout.showCompanyLogoSlot !== false,
    sectionOrder: layout.sectionOrder?.length ? layout.sectionOrder : DEFAULT_SECTION_ORDER,
    watermark: layout.watermark ?? DEFAULT_WATERMARK,
    resumeUrl: (snapshot.resume && String(snapshot.resume).trim()) || null,
  };
}

export function buildCvEditorPreviewFromCandidate(candidate, jobTitle = '') {
  const snapshot = buildCvSubmissionSnapshot(candidate, jobTitle);
  return buildCvEditorPreviewFromSnapshot(snapshot, jobTitle);
}

export function mapSnapshotToClientCandidateFields(snapshot) {
  if (!snapshot) return null;
  return {
    name: `${snapshot.firstName || ''} ${snapshot.lastName || ''}`.trim(),
    email: snapshot.email || '',
    phone: snapshot.phone || '',
    currentCompany: snapshot.currentCompany || '',
    designation: snapshot.currentTitle || snapshot.designation || '',
    experience: snapshot.experience ?? null,
    skills: snapshot.skills || [],
    languages: snapshot.languages || [],
    education: snapshot.education || '',
    certifications: snapshot.certifications || [],
    cvSummary: snapshot.cvSummary || '',
    cvEducationEntries: snapshot.cvEducationEntries || [],
    cvWorkExperienceEntries: snapshot.cvWorkExperienceEntries || [],
    address: snapshot.address || '',
    city: snapshot.city || '',
    country: snapshot.country || '',
    linkedIn: snapshot.linkedIn || '',
    resume: '',
  };
}
