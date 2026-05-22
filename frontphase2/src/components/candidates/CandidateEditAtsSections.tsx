'use client';

import React from 'react';
import { Award, Briefcase, Eye, EyeOff, GraduationCap, Share2, User } from 'lucide-react';
import type { ClientPresentationSectionId } from '@/lib/clientPresentationSections';
import type { LucideIcon } from 'lucide-react';
import type { UpdateCandidatePayload } from '@/lib/api';
import {
  buildEducationSummaryFromCvEntries,
  isGarbageEducationSummary,
} from '@/lib/candidateEducation';
import type { CandidateProfileDrawerData } from '../drawers/CandidateProfileDrawer';
import { CandidatePhotoUpload } from './AddCandidateFormSections';

export type CandidateEditFormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  linkedIn: string;
  currentTitle: string;
  currentCompany: string;
  experience: string;
  location: string;
  stage: string;
  status: string;
  source: string;
  recruiterId: string;
  assignedJobId: string;
  noticePeriod: string;
  availability: string;
  salaryCurrency: string;
  expectedSalary: string;
  currentSalary: string;
  address: string;
  city: string;
  state: string;
  country: string;
  preferredLocation: string;
  resumeUrl: string;
  education: string;
  portfolio: string;
  website: string;
  skills: string;
  languages: string;
  certifications: string;
  cvSummary: string;
  notes: string;
  cvEducationEntries: string;
  cvWorkExperienceEntries: string;
  cvPortfolioLinks: string;
  age: string;
  candidateScore: string;
  zip: string;
  nationality: string;
  currentCompanyWebsite: string;
  maritalStatus: string;
  birthDate: string;
  passportNumber: string;
  educationCourses: string;
  remarks: string;
  currentBenefits: string;
  expectedBenefits: string;
  currentSalaryCurrency: string;
  expectedSalaryCurrency: string;
  extracurricular: string;
  volunteers: string;
  workHistoryText: string;
  twitter: string;
  xing: string;
  skypeId: string;
  facebook: string;
  stackOverflow: string;
  educationSummary: string;
  honours: string;
  languageProficiency: string;
  projects: string;
  hackathons: string;
  avatar: string;
};

const CANDIDATE_STATUS_OPTIONS = ['NEW', 'ACTIVE', 'PLACED', 'INACTIVE', 'BLACKLISTED'];
const CANDIDATE_STAGE_OPTIONS = ['Applied', 'Shortlisted', 'Screening', 'Interviewing', 'Offered', 'Hired', 'Rejected'];
const CANDIDATE_AVAILABILITY_OPTIONS = ['available', 'limited', 'unavailable'];
const SALARY_CURRENCY_OPTIONS = ['INR', 'USD', 'EUR', 'GBP', 'AED'];

function str(value: unknown): string {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function joinSemicolonList(value: unknown): string {
  if (Array.isArray(value)) return value.map((item) => str(item)).filter(Boolean).join('; ');
  return '';
}

function parseSemicolonList(value: string): string[] {
  return String(value || '')
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitCandidateName(candidate: CandidateProfileDrawerData) {
  const firstName = candidate.firstName?.trim();
  const lastName = candidate.lastName?.trim();
  if (firstName || lastName) {
    return { firstName: firstName || '', lastName: lastName || '' };
  }
  const parts = String(candidate.name || '').trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') };
}

function normalizeStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? '').trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    return trimmed
      .split(/[;\n]/)
      .map((part) => part.trim())
      .filter(Boolean);
  }
  return [];
}

function formatEducationEntriesForEditor(
  entries?: CandidateProfileDrawerData['cvEducationEntries']
) {
  const list = Array.isArray(entries) ? entries : [];
  if (!list.length) return '';
  return list
    .map((item) => {
      const row = item as Record<string, unknown>;
      return [
        row.qualification || row.degree,
        row.instituteName || row.institution,
        row.startYear,
        row.endYear,
        row.grade,
      ]
        .map((part) => str(part))
        .filter(Boolean)
        .join(' | ');
    })
    .filter(Boolean)
    .join('\n');
}

function formatWorkExperienceEntriesForEditor(
  entries?: CandidateProfileDrawerData['cvWorkExperienceEntries']
) {
  const list = Array.isArray(entries) ? entries : [];
  if (!list.length) return '';
  return list
    .map((item) => {
      const header = [item.title, item.company, item.location, item.startDate, item.endDate]
        .map((part) => str(part))
        .filter(Boolean)
        .join(' | ');
      const responsibilities = normalizeStringList(
        item.responsibilities ?? (item as { description?: unknown }).description
      ).join('; ');
      return [header, responsibilities].filter(Boolean).join('\n');
    })
    .filter(Boolean)
    .join('\n\n');
}

function formatPortfolioLinksForEditor(
  entries?: CandidateProfileDrawerData['cvPortfolioLinks']
) {
  if (!entries?.length) return '';
  return entries
    .map((item) => {
      const url = str(item.url);
      const label = str(item.label || item.type) || (url ? 'Link' : '');
      if (!url && !label) return '';
      if (!url) return label;
      return `${label} | ${url}`;
    })
    .filter(Boolean)
    .join('\n');
}

function formatLanguageProficiencyForEditor(
  rows: Array<{ language?: string; proficiency?: string }> | undefined,
  fallbackLanguages?: string[]
) {
  if (Array.isArray(rows) && rows.length) {
    return rows
      .map((row) => {
        const lang = str(row.language);
        const prof = str(row.proficiency);
        return prof ? `${lang} | ${prof}` : lang;
      })
      .filter(Boolean)
      .join('\n');
  }
  return Array.isArray(fallbackLanguages) ? fallbackLanguages.join(', ') : '';
}

function getPipeline(candidate: CandidateProfileDrawerData) {
  const extra = (candidate.extraData || {}) as Record<string, unknown>;
  return (extra.pipeline || {}) as Record<string, unknown>;
}

export function buildCandidateEditForm(candidate: CandidateProfileDrawerData): CandidateEditFormState {
  const nameParts = splitCandidateName(candidate);
  const pipeline = getPipeline(candidate);
  const personal = (pipeline.personal || {}) as Record<string, unknown>;
  const educationPipe = (pipeline.education || {}) as Record<string, unknown>;
  const professional = (pipeline.professional || {}) as Record<string, unknown>;
  const social = (pipeline.social || {}) as Record<string, unknown>;
  const summary = (pipeline.summary || {}) as Record<string, unknown>;
  const extra = (candidate.extraData || {}) as Record<string, unknown>;

  const eduEntries = Array.isArray(educationPipe.entries)
    ? educationPipe.entries
    : candidate.cvEducationEntries || [];

  const educationSummary =
    str(educationPipe.summaryText) ||
    str(summary.educationSummary) ||
    (isGarbageEducationSummary(candidate.cvEducation)
      ? buildEducationSummaryFromCvEntries(eduEntries as Array<Record<string, unknown>>)
      : str(candidate.cvEducation));

  return {
    firstName: nameParts.firstName,
    lastName: nameParts.lastName,
    email: candidate.email || '',
    phone: candidate.phone && candidate.phone !== '—' ? candidate.phone : '',
    linkedIn: candidate.linkedIn || str(social.linkedIn) || '',
    currentTitle:
      candidate.currentTitle && candidate.currentTitle !== '—' ? candidate.currentTitle : '',
    currentCompany:
      candidate.currentCompany && candidate.currentCompany !== '—' ? candidate.currentCompany : '',
    experience: candidate.experience != null ? String(candidate.experience) : '',
    location: candidate.location && candidate.location !== '—' ? candidate.location : '',
    stage: candidate.stage && candidate.stage !== '—' ? candidate.stage : 'Applied',
    status: candidate.status && candidate.status !== '—' ? candidate.status : 'NEW',
    source: candidate.source && candidate.source !== '—' ? candidate.source : '',
    recruiterId: candidate.recruiterId || '',
    assignedJobId: candidate.assignedJobId || '',
    noticePeriod:
      candidate.noticePeriod && candidate.noticePeriod !== '—' ? candidate.noticePeriod : '',
    availability: candidate.cvAvailability || candidate.availability || 'available',
    salaryCurrency: candidate.salaryCurrency || 'INR',
    expectedSalary:
      candidate.expectedSalaryValue != null ? String(candidate.expectedSalaryValue) : '',
    currentSalary:
      candidate.currentSalaryValue != null ? String(candidate.currentSalaryValue) : '',
    address: candidate.cvAddress || str(personal.currentAddress) || '',
    city: candidate.cvCity || '',
    state: str(personal.state),
    country: candidate.cvCountry || '',
    preferredLocation: candidate.cvPreferredLocation || candidate.location || '',
    resumeUrl: candidate.resumeUrl || '',
    education: educationSummary,
    portfolio: candidate.cvPortfolio || str(social.website) || '',
    website: candidate.cvWebsite || str(social.website) || '',
    skills: Array.isArray(candidate.cvSkills) ? candidate.cvSkills.join(', ') : '',
    languages: Array.isArray(candidate.cvLanguages) ? candidate.cvLanguages.join(', ') : '',
    certifications: Array.isArray(candidate.cvCertifications)
      ? candidate.cvCertifications.join('\n')
      : '',
    cvSummary: candidate.cvSummary || candidate.summary || '',
    notes: candidate.cvNotes || candidate.summary || '',
    cvEducationEntries: formatEducationEntriesForEditor(
      (eduEntries as CandidateProfileDrawerData['cvEducationEntries']) || []
    ),
    cvWorkExperienceEntries: formatWorkExperienceEntriesForEditor(
      candidate.cvWorkExperienceEntries || []
    ),
    cvPortfolioLinks: formatPortfolioLinksForEditor(candidate.cvPortfolioLinks || []),
    age: str(personal.age),
    candidateScore:
      str(personal.candidateScore) ||
      (candidate.aiScore?.overall != null ? String(candidate.aiScore.overall) : ''),
    zip: str(personal.zip),
    nationality: str(personal.nationality),
    currentCompanyWebsite: str(personal.currentCompanyWebsite),
    maritalStatus: str(personal.maritalStatus),
    birthDate: str(personal.birthDate),
    passportNumber: str(personal.passportNumber),
    educationCourses:
      joinSemicolonList(educationPipe.courses) || joinSemicolonList(extra.courses),
    remarks: candidate.cvNotes || str(professional.remarks) || str(extra.remarks) || '',
    currentBenefits: str(professional.currentBenefits),
    expectedBenefits: str(professional.expectedBenefits),
    currentSalaryCurrency: str(professional.currentSalaryCurrency),
    expectedSalaryCurrency: str(professional.expectedSalaryCurrency),
    extracurricular:
      joinSemicolonList(professional.extracurricularActivities) ||
      joinSemicolonList(extra.extracurricularActivities),
    volunteers:
      joinSemicolonList(professional.volunteers) || joinSemicolonList(extra.volunteers),
    workHistoryText: str(summary.workHistory),
    avatar: str(candidate.avatar),
    twitter: str(social.twitter),
    xing: str(social.xing),
    skypeId: str(social.skypeId),
    facebook: str(social.facebook),
    stackOverflow: str(social.stackOverflow),
    educationSummary,
    honours:
      joinSemicolonList(summary.honoursAndAwards) || joinSemicolonList(extra.honoursAndAwards),
    languageProficiency: formatLanguageProficiencyForEditor(
      summary.languageProficiency as Array<{ language?: string; proficiency?: string }>,
      candidate.cvLanguages
    ),
    projects: joinSemicolonList(extra.projects),
    hackathons: joinSemicolonList(extra.hackathons),
  };
}

function parseOptionalNumber(value: string) {
  const normalized = String(value || '').trim();
  if (!normalized) return null;
  const numeric = Number(normalized.replace(/[^\d.-]/g, ''));
  return Number.isFinite(numeric) ? Math.round(numeric) : null;
}

function parseCsvValues(value: string) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseLineValues(value: string) {
  return String(value || '')
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseEducationEntriesEditorValue(value: string) {
  return String(value || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split('|').map((part) => part.trim());
      const [qualification = '', instituteName = '', startYear = '', endYear = '', grade = ''] =
        parts;
      return {
        degree: qualification,
        qualification,
        institution: instituteName,
        instituteName,
        startYear,
        endYear,
        grade: grade || undefined,
      };
    });
}

function parseWorkExperienceEditorValue(value: string) {
  return String(value || '')
    .split(/\r?\n\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      const headerLine = lines[0] || '';
      const responsibilitiesLine = lines.slice(1).join(' ');
      const [title = '', company = '', location = '', startDate = '', endDate = ''] = headerLine
        .split('|')
        .map((part) => part.trim());
      const responsibilities = responsibilitiesLine
        ? responsibilitiesLine
            .split(';')
            .map((item) => item.trim())
            .filter(Boolean)
        : [];
      return { title, company, location, startDate, endDate, responsibilities };
    });
}

function isLikelyUrl(text: string): boolean {
  const t = String(text || '').trim();
  return /^https?:\/\//i.test(t) || /^www\./i.test(t) || /^[a-z0-9][-a-z0-9]*\.[a-z]{2,}/i.test(t);
}

function parsePortfolioLinksEditorValue(value: string) {
  return String(value || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      if (!line.includes('|')) {
        if (isLikelyUrl(line)) {
          return { type: 'Link', label: 'Link', url: line };
        }
        return { type: line, label: line, url: '' };
      }
      const parts = line.split('|').map((part) => part.trim());
      const [typeOrLabel = '', ...rest] = parts;
      const url = rest.join('|').trim();
      return { type: typeOrLabel || 'Link', label: typeOrLabel || 'Link', url };
    })
    .filter((item) => item.url || item.type);
}

function parseLanguageProficiencyEditorValue(value: string) {
  return String(value || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      if (line.includes('|')) {
        const [language = '', proficiency = ''] = line.split('|').map((p) => p.trim());
        return { language, proficiency };
      }
      const paren = line.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
      if (paren) return { language: paren[1].trim(), proficiency: paren[2].trim() };
      return { language: line, proficiency: '' };
    })
    .filter((row) => row.language);
}

export function validateEditFormStructured(editForm: CandidateEditFormState) {
  const invalidEducationLine = String(editForm.cvEducationEntries || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .find((line) => line.split('|').length > 5);

  if (invalidEducationLine) {
    throw new Error(
      'Education entries: Qualification | Institute | Start Year | End Year | Grade (one per line)'
    );
  }

  // Portfolio links accept "Label | URL" or a plain URL per line — parser normalizes on save.
}

export function buildExtraDataFromEditForm(
  editForm: CandidateEditFormState,
  existing?: Record<string, unknown> | null
): Record<string, unknown> {
  const prev = existing && typeof existing === 'object' ? { ...existing } : {};
  const eduEntries = parseEducationEntriesEditorValue(editForm.cvEducationEntries);
  const courses = parseSemicolonList(editForm.educationCourses);
  const educationSummary =
    editForm.educationSummary.trim() ||
    buildEducationSummaryFromCvEntries(eduEntries as Array<Record<string, unknown>>);

  const languageProficiency = parseLanguageProficiencyEditorValue(editForm.languageProficiency);
  const honours = parseSemicolonList(editForm.honours);
  const projects = parseSemicolonList(editForm.projects);
  const hackathons = parseSemicolonList(editForm.hackathons);

  return {
    ...prev,
    pipeline: {
      personal: {
        age: parseOptionalNumber(editForm.age),
        candidateScore: parseOptionalNumber(editForm.candidateScore),
        state: editForm.state.trim() || null,
        currentAddress: editForm.address.trim() || null,
        zip: editForm.zip.trim() || null,
        nationality: editForm.nationality.trim() || null,
        currentCompanyWebsite: editForm.currentCompanyWebsite.trim() || null,
        maritalStatus: editForm.maritalStatus.trim() || null,
        birthDate: editForm.birthDate.trim() || null,
        passportNumber: editForm.passportNumber.trim() || null,
      },
      education: {
        entries: eduEntries,
        courses,
        summaryText: educationSummary || null,
      },
      professional: {
        remarks: editForm.remarks.trim() || null,
        currentBenefits: editForm.currentBenefits.trim() || null,
        expectedBenefits: editForm.expectedBenefits.trim() || null,
        currentSalaryCurrency: editForm.currentSalaryCurrency.trim() || null,
        expectedSalaryCurrency: editForm.expectedSalaryCurrency.trim() || null,
        courses,
        extracurricularActivities: parseSemicolonList(editForm.extracurricular),
        volunteers: parseSemicolonList(editForm.volunteers),
      },
      social: {
        linkedIn: editForm.linkedIn.trim() || null,
        twitter: editForm.twitter.trim() || null,
        xing: editForm.xing.trim() || null,
        skypeId: editForm.skypeId.trim() || null,
        facebook: editForm.facebook.trim() || null,
        stackOverflow: editForm.stackOverflow.trim() || null,
        website: editForm.website.trim() || editForm.portfolio.trim() || null,
      },
      summary: {
        workHistory: editForm.workHistoryText.trim() || null,
        educationSummary: educationSummary || null,
        honoursAndAwards: honours,
        languageProficiency,
      },
    },
    courses,
    honoursAndAwards: honours,
    extracurricularActivities: parseSemicolonList(editForm.extracurricular),
    volunteers: parseSemicolonList(editForm.volunteers),
    projects,
    hackathons,
    remarks: editForm.remarks.trim() || undefined,
  };
}

/** Client-facing fields only — excludes CRM stage, status, recruiter, and job assignment. */
export function buildClientPresentationFieldsPatch(
  editForm: CandidateEditFormState
): Omit<UpdateCandidatePayload, 'assignedToId' | 'assignedJobs' | 'stage' | 'status' | 'source'> {
  const full = buildUpdatePayloadFromEditForm(editForm, null);
  const { assignedToId, assignedJobs, stage, status, source, ...clientFields } = full;
  void assignedToId;
  void assignedJobs;
  void stage;
  void status;
  void source;
  return clientFields;
}

export function buildUpdatePayloadFromEditForm(
  editForm: CandidateEditFormState,
  existingExtra?: Record<string, unknown> | null
): UpdateCandidatePayload {
  const eduEntries = parseEducationEntriesEditorValue(editForm.cvEducationEntries);
  const education =
    editForm.education.trim() ||
    editForm.educationSummary.trim() ||
    buildEducationSummaryFromCvEntries(eduEntries as Array<Record<string, unknown>>);

  const langProf = parseLanguageProficiencyEditorValue(editForm.languageProficiency);
  const languagesFromProf = langProf.map((r) => r.language).filter(Boolean);
  const languagesCsv = parseCsvValues(editForm.languages);

  return {
    assignedToId: editForm.recruiterId || null,
    assignedJobs: editForm.assignedJobId ? [editForm.assignedJobId] : [],
    firstName: editForm.firstName.trim(),
    lastName: editForm.lastName.trim(),
    email: editForm.email.trim(),
    phone: editForm.phone.trim() || undefined,
    linkedIn: editForm.linkedIn.trim() || undefined,
    currentTitle: editForm.currentTitle.trim() || undefined,
    currentCompany: editForm.currentCompany.trim() || undefined,
    designation: editForm.currentTitle.trim() || undefined,
    experience: parseOptionalNumber(editForm.experience),
    location: editForm.location.trim() || undefined,
    stage: editForm.stage.trim() || undefined,
    status: editForm.status.trim() || undefined,
    source: editForm.source.trim() || undefined,
    resume: editForm.resumeUrl.trim() || undefined,
    noticePeriod: editForm.noticePeriod.trim() || undefined,
    availability: editForm.availability.trim() || undefined,
    salary: {
      currency: editForm.salaryCurrency || 'INR',
      min: parseOptionalNumber(editForm.currentSalary),
      max: parseOptionalNumber(editForm.expectedSalary),
    },
    expectedSalary: parseOptionalNumber(editForm.expectedSalary),
    currentSalary: parseOptionalNumber(editForm.currentSalary),
    address: editForm.address.trim() || undefined,
    city: editForm.city.trim() || undefined,
    country: editForm.country.trim() || undefined,
    preferredLocation: editForm.preferredLocation.trim() || undefined,
    education: education || undefined,
    portfolio: editForm.portfolio.trim() || undefined,
    website: editForm.website.trim() || undefined,
    skills: parseCsvValues(editForm.skills),
    languages: languagesFromProf.length ? languagesFromProf : languagesCsv,
    certifications: parseLineValues(editForm.certifications),
    cvSummary: editForm.cvSummary.trim() || undefined,
    notes: editForm.remarks.trim() || editForm.notes.trim() || undefined,
    cvEducationEntries: eduEntries as UpdateCandidatePayload['cvEducationEntries'],
    cvWorkExperienceEntries: parseWorkExperienceEditorValue(
      editForm.cvWorkExperienceEntries
    ) as UpdateCandidatePayload['cvWorkExperienceEntries'],
    cvPortfolioLinks: parsePortfolioLinksEditorValue(
      editForm.cvPortfolioLinks
    ) as UpdateCandidatePayload['cvPortfolioLinks'],
    avatar: editForm.avatar.trim() || null,
    extraData: buildExtraDataFromEditForm(editForm, existingExtra),
  };
}

function EditField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
      />
    </label>
  );
}

function EditSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
      >
        <option value="">Select</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function EditTextarea({
  label,
  value,
  onChange,
  rows = 4,
  helper,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  helper?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
      />
      {helper ? <span className="mt-1 block text-xs text-slate-400">{helper}</span> : null}
    </label>
  );
}

function EditSection({
  sectionId,
  title,
  icon: Icon,
  children,
  showClientVisibilityToggle = false,
  clientVisible = true,
  onToggleClientVisibility,
}: {
  sectionId?: ClientPresentationSectionId;
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
  showClientVisibilityToggle?: boolean;
  clientVisible?: boolean;
  onToggleClientVisibility?: (sectionId: ClientPresentationSectionId) => void;
}) {
  const hidden = showClientVisibilityToggle && !clientVisible;
  return (
    <section
      className={`overflow-hidden rounded-2xl border bg-slate-50/80 ${
        hidden ? 'border-dashed border-slate-300 opacity-90' : 'border-slate-200'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 bg-white/60 px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="rounded-lg bg-white p-2 text-indigo-600 shadow-sm ring-1 ring-slate-200/80">
            <Icon size={16} />
          </span>
          <h4 className="text-sm font-bold text-slate-900">{title}</h4>
          {hidden ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900">
              Hidden from client
            </span>
          ) : null}
        </div>
        {showClientVisibilityToggle && sectionId && onToggleClientVisibility ? (
          <button
            type="button"
            onClick={() => onToggleClientVisibility(sectionId)}
            title={clientVisible ? 'Hide this section on the client review link' : 'Show this section on the client review link'}
            className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold shadow-sm ${
              clientVisible
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-slate-600 text-white hover:bg-slate-700'
            }`}
          >
            {clientVisible ? <Eye size={16} /> : <EyeOff size={16} />}
            {clientVisible ? 'Visible to client' : 'Hidden from client'}
          </button>
        ) : null}
      </div>
      {clientVisible ? (
        <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">{children}</div>
      ) : (
        <p className="px-4 py-3 text-xs text-slate-500">
          This section will not appear on the client review link. Click Visible to include it.
        </p>
      )}
    </section>
  );
}

type Props = {
  form: CandidateEditFormState;
  onChange: <K extends keyof CandidateEditFormState>(field: K, value: CandidateEditFormState[K]) => void;
  recruiters: Array<{ id: string; name: string }>;
  jobs: Array<{ id: string; title: string; department?: string | null }>;
  avatarPreview?: string;
  onAvatarFile?: (file: File) => void;
  onAvatarRemove?: () => void;
  showClientSectionVisibility?: boolean;
  clientSectionVisibility?: Partial<Record<ClientPresentationSectionId, boolean>>;
  onToggleClientSectionVisibility?: (sectionId: ClientPresentationSectionId) => void;
};

export function CandidateEditAtsSections({
  form,
  onChange,
  recruiters,
  jobs,
  avatarPreview = '',
  onAvatarFile,
  onAvatarRemove,
  showClientSectionVisibility = false,
  clientSectionVisibility,
  onToggleClientSectionVisibility,
}: Props) {
  const sectionVisible = (id: ClientPresentationSectionId) => clientSectionVisibility?.[id] !== false;
  return (
    <div className="space-y-5">
      {showClientSectionVisibility ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          <p className="font-semibold">Client review visibility</p>
          <p className="mt-1 text-xs text-blue-800">
            Use the button on the right of each section header to show or hide that block on the client
            review link. Hidden sections are not sent to the client.
          </p>
        </div>
      ) : null}
      {onAvatarFile && onAvatarRemove ? (
        <CandidatePhotoUpload
          preview={avatarPreview || form.avatar}
          onSelectFile={onAvatarFile}
          onRemove={onAvatarRemove}
        />
      ) : null}
      <EditSection
        sectionId="personal"
        title="Personal Information"
        icon={User}
        showClientVisibilityToggle={showClientSectionVisibility}
        clientVisible={sectionVisible('personal')}
        onToggleClientVisibility={onToggleClientSectionVisibility}
      >
        <EditField label="First Name" value={form.firstName} onChange={(v) => onChange('firstName', v)} />
        <EditField label="Last Name" value={form.lastName} onChange={(v) => onChange('lastName', v)} />
        <EditField label="E-mail" value={form.email} onChange={(v) => onChange('email', v)} type="email" />
        <EditField label="Mobile No" value={form.phone} onChange={(v) => onChange('phone', v)} />
        <EditField label="Age" value={form.age} onChange={(v) => onChange('age', v)} type="number" />
        <EditField
          label="Candidate Score"
          value={form.candidateScore}
          onChange={(v) => onChange('candidateScore', v)}
          type="number"
        />
        <EditField label="City" value={form.city} onChange={(v) => onChange('city', v)} />
        <EditField label="State" value={form.state} onChange={(v) => onChange('state', v)} />
        <EditField label="Country" value={form.country} onChange={(v) => onChange('country', v)} />
        <EditField label="Location (display)" value={form.location} onChange={(v) => onChange('location', v)} />
        <div className="md:col-span-2">
          <EditField label="Current Address" value={form.address} onChange={(v) => onChange('address', v)} />
        </div>
        <EditField label="Zip" value={form.zip} onChange={(v) => onChange('zip', v)} />
        <EditField label="Nationality" value={form.nationality} onChange={(v) => onChange('nationality', v)} />
        <EditField
          label="Current Company Website"
          value={form.currentCompanyWebsite}
          onChange={(v) => onChange('currentCompanyWebsite', v)}
        />
        <EditField label="Marital Status" value={form.maritalStatus} onChange={(v) => onChange('maritalStatus', v)} />
        <EditField label="Birth Date" value={form.birthDate} onChange={(v) => onChange('birthDate', v)} />
        <EditField label="Passport Number" value={form.passportNumber} onChange={(v) => onChange('passportNumber', v)} />
        <EditField label="Preferred Location" value={form.preferredLocation} onChange={(v) => onChange('preferredLocation', v)} />
      </EditSection>

      <EditSection
        sectionId="education"
        title="Education"
        icon={GraduationCap}
        showClientVisibilityToggle={showClientSectionVisibility}
        clientVisible={sectionVisible('education')}
        onToggleClientVisibility={onToggleClientSectionVisibility}
      >
        <div className="md:col-span-2">
          <EditTextarea
            label="Education entries"
            value={form.cvEducationEntries}
            onChange={(v) => onChange('cvEducationEntries', v)}
            rows={6}
            helper="One line per entry: Qualification | Institute | Start Year | End Year | Grade"
          />
        </div>
        <div className="md:col-span-2">
          <EditTextarea
            label="Education summary"
            value={form.educationSummary}
            onChange={(v) => {
              onChange('educationSummary', v);
              onChange('education', v);
            }}
            rows={2}
          />
        </div>
        <div className="md:col-span-2">
          <EditTextarea
            label="Courses"
            value={form.educationCourses}
            onChange={(v) => onChange('educationCourses', v)}
            rows={2}
            helper="Semicolon-separated"
          />
        </div>
      </EditSection>

      <EditSection title="Professional Information" icon={Briefcase}>
        <div className="md:col-span-2">
          <EditTextarea label="Remarks" value={form.remarks} onChange={(v) => onChange('remarks', v)} rows={3} />
        </div>
        <EditField
          label="Experience (years)"
          value={form.experience}
          onChange={(v) => onChange('experience', v)}
          type="number"
        />
        <EditField
          label="Current Designation"
          value={form.currentTitle}
          onChange={(v) => onChange('currentTitle', v)}
        />
        <EditField
          label="Current Employer"
          value={form.currentCompany}
          onChange={(v) => onChange('currentCompany', v)}
        />
        <EditField
          label="Current Salary"
          value={form.currentSalary}
          onChange={(v) => onChange('currentSalary', v)}
          type="number"
        />
        <EditField
          label="Current Salary Currency"
          value={form.currentSalaryCurrency}
          onChange={(v) => onChange('currentSalaryCurrency', v)}
        />
        <EditField label="Current Benefits" value={form.currentBenefits} onChange={(v) => onChange('currentBenefits', v)} />
        <EditField
          label="Expected Salary"
          value={form.expectedSalary}
          onChange={(v) => onChange('expectedSalary', v)}
          type="number"
        />
        <EditField
          label="Expected Salary Currency"
          value={form.expectedSalaryCurrency}
          onChange={(v) => onChange('expectedSalaryCurrency', v)}
        />
        <EditField label="Expected Benefits" value={form.expectedBenefits} onChange={(v) => onChange('expectedBenefits', v)} />
        <EditField label="Notice Period" value={form.noticePeriod} onChange={(v) => onChange('noticePeriod', v)} />
        <div className="md:col-span-2">
          <EditField label="Resume URL" value={form.resumeUrl} onChange={(v) => onChange('resumeUrl', v)} />
        </div>
        <div className="md:col-span-2">
          <EditTextarea
            label="Work experience"
            value={form.cvWorkExperienceEntries}
            onChange={(v) => onChange('cvWorkExperienceEntries', v)}
            rows={8}
            helper="Blank line between roles. Line 1: Title | Company | Location | Start | End. Line 2+: responsibilities (; separated)"
          />
        </div>
        <div className="md:col-span-2">
          <EditTextarea
            label="Work history (narrative)"
            value={form.workHistoryText}
            onChange={(v) => onChange('workHistoryText', v)}
            rows={4}
          />
        </div>
        <div className="md:col-span-2">
          <EditTextarea
            label="Extracurricular activities"
            value={form.extracurricular}
            onChange={(v) => onChange('extracurricular', v)}
            rows={3}
            helper="Semicolon-separated"
          />
        </div>
        <div className="md:col-span-2">
          <EditTextarea
            label="Volunteers"
            value={form.volunteers}
            onChange={(v) => onChange('volunteers', v)}
            rows={2}
            helper="Semicolon-separated"
          />
        </div>
      </EditSection>

      <EditSection
        sectionId="social"
        title="Social Network Information"
        icon={Share2}
        showClientVisibilityToggle={showClientSectionVisibility}
        clientVisible={sectionVisible('social')}
        onToggleClientVisibility={onToggleClientSectionVisibility}
      >
        <EditField label="LinkedIn" value={form.linkedIn} onChange={(v) => onChange('linkedIn', v)} />
        <EditField label="Twitter" value={form.twitter} onChange={(v) => onChange('twitter', v)} />
        <EditField label="Xing" value={form.xing} onChange={(v) => onChange('xing', v)} />
        <EditField label="Skype ID" value={form.skypeId} onChange={(v) => onChange('skypeId', v)} />
        <EditField label="Facebook" value={form.facebook} onChange={(v) => onChange('facebook', v)} />
        <EditField label="Stack Overflow" value={form.stackOverflow} onChange={(v) => onChange('stackOverflow', v)} />
        <EditField label="Website" value={form.website} onChange={(v) => onChange('website', v)} />
        <EditField label="Portfolio URL" value={form.portfolio} onChange={(v) => onChange('portfolio', v)} />
        <div className="md:col-span-2">
          <EditTextarea
            label="Portfolio / project links"
            value={form.cvPortfolioLinks}
            onChange={(v) => onChange('cvPortfolioLinks', v)}
            rows={6}
            helper="One link per line: Label | URL, or paste a URL only"
          />
        </div>
      </EditSection>

      <EditSection
        sectionId="summary"
        title="Summary & Additional"
        icon={Award}
        showClientVisibilityToggle={showClientSectionVisibility}
        clientVisible={sectionVisible('summary')}
        onToggleClientVisibility={onToggleClientSectionVisibility}
      >
        <div className="md:col-span-2">
          <EditTextarea label="Summary" value={form.cvSummary} onChange={(v) => onChange('cvSummary', v)} rows={4} />
        </div>
        <div className="md:col-span-2">
          <EditTextarea label="Skills" value={form.skills} onChange={(v) => onChange('skills', v)} rows={3} helper="Comma-separated" />
        </div>
        <div className="md:col-span-2">
          <EditTextarea
            label="Language & proficiency"
            value={form.languageProficiency}
            onChange={(v) => onChange('languageProficiency', v)}
            rows={3}
            helper="One per line: Language | Proficiency (e.g. English | Fluent)"
          />
        </div>
        <div className="md:col-span-2">
          <EditTextarea
            label="Honours & awards"
            value={form.honours}
            onChange={(v) => onChange('honours', v)}
            rows={3}
            helper="Semicolon-separated"
          />
        </div>
        <div className="md:col-span-2">
          <EditTextarea
            label="Certifications"
            value={form.certifications}
            onChange={(v) => onChange('certifications', v)}
            rows={3}
            helper="One per line"
          />
        </div>
        <div className="md:col-span-2">
          <EditTextarea
            label="Projects (extra)"
            value={form.projects}
            onChange={(v) => onChange('projects', v)}
            rows={3}
            helper="Semicolon-separated"
          />
        </div>
        <div className="md:col-span-2">
          <EditTextarea
            label="Hackathons (extra)"
            value={form.hackathons}
            onChange={(v) => onChange('hackathons', v)}
            rows={2}
            helper="Semicolon-separated"
          />
        </div>
        <div className="md:col-span-2">
          <EditTextarea label="Internal notes" value={form.notes} onChange={(v) => onChange('notes', v)} rows={4} />
        </div>
      </EditSection>

      <EditSection title="Hiring & assignment" icon={Briefcase}>
        <EditField label="Source" value={form.source} onChange={(v) => onChange('source', v)} />
        <EditSelect
          label="Stage"
          value={form.stage}
          options={CANDIDATE_STAGE_OPTIONS.map((value) => ({ label: value, value }))}
          onChange={(v) => onChange('stage', v)}
        />
        <EditSelect
          label="Status"
          value={form.status}
          options={CANDIDATE_STATUS_OPTIONS.map((value) => ({ label: value, value }))}
          onChange={(v) => onChange('status', v)}
        />
        <EditSelect
          label="Assigned recruiter"
          value={form.recruiterId}
          options={recruiters.map((r) => ({ label: r.name, value: r.id }))}
          onChange={(v) => onChange('recruiterId', v)}
        />
        <EditSelect
          label="Assigned job"
          value={form.assignedJobId}
          options={jobs.map((job) => ({
            label: `${job.title}${job.department ? ` · ${job.department}` : ''}`,
            value: job.id,
          }))}
          onChange={(v) => onChange('assignedJobId', v)}
        />
        <EditSelect
          label="Availability"
          value={form.availability}
          options={CANDIDATE_AVAILABILITY_OPTIONS.map((value) => ({ label: value, value }))}
          onChange={(v) => onChange('availability', v)}
        />
        <EditSelect
          label="Salary currency (default)"
          value={form.salaryCurrency}
          options={SALARY_CURRENCY_OPTIONS.map((value) => ({ label: value, value }))}
          onChange={(v) => onChange('salaryCurrency', v)}
        />
      </EditSection>
    </div>
  );
}
