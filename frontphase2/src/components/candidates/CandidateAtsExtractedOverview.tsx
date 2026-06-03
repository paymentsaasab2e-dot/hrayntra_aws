'use client';

import React, { useMemo, useState } from 'react';
import {
  Award,
  Briefcase,
  ChevronDown,
  GraduationCap,
  Share2,
  User,
  FileText,
} from 'lucide-react';
import type { CandidateProfileDrawerData } from '../drawers/CandidateProfileDrawer';
import {
  buildEducationSummaryFromCvEntries,
  isGarbageEducationSummary,
} from '@/lib/candidateEducation';
import {
  collectCandidateWorkEntries,
  computeTotalExperienceYears,
  formatExperienceYearsLabel,
  formatWorkEntryHeadline,
  formatWorkEntryMeta,
  formatWorkEntryTenureLabel,
  type CvWorkEntryLike,
} from '@/lib/candidateExperience';
import { getPhase1ProfileSnapshot } from '@/lib/phase1ProfileSnapshot';
import type { ClientSectionVisibility } from '@/lib/clientPresentationSections';

type SectionKey = 'personal' | 'education' | 'work' | 'professional' | 'social' | 'summary';

function isOverviewSectionVisible(
  id: SectionKey,
  visibility?: Partial<ClientSectionVisibility> | null,
): boolean {
  if (!visibility) return true;
  return visibility[id] !== false;
}

function display(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return String(value).trim();
}

function FieldRow({
  label,
  value,
  optional = true,
  href,
}: {
  label: string;
  value?: string | null;
  optional?: boolean;
  href?: string | null;
}) {
  const text = display(value);
  const empty = !text;
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
        {label}
        {optional ? <span className="font-normal text-slate-300"> (optional)</span> : null}
      </p>
      {empty ? (
        <p className="mt-1 text-sm italic text-slate-400">Not in resume</p>
      ) : href && /^https?:\/\//i.test(href) ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="mt-1 block break-all text-sm font-medium text-blue-700 hover:underline"
        >
          {text}
        </a>
      ) : (
        <p className="mt-1 break-words text-sm font-medium text-slate-800">{text}</p>
      )}
    </div>
  );
}

function SectionBlock({
  id,
  title,
  icon: Icon,
  open,
  onToggle,
  children,
  filled,
  total,
  extraHint,
}: {
  id: SectionKey;
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  open: boolean;
  onToggle: (key: SectionKey) => void;
  children: React.ReactNode;
  filled: number;
  total: number;
  extraHint?: string;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/80">
      <button
        type="button"
        onClick={() => onToggle(id)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-100/80"
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="rounded-lg bg-white p-2 text-indigo-600 shadow-sm ring-1 ring-slate-200/80">
            <Icon size={16} />
          </span>
          <div>
            <h3 className="text-sm font-bold text-slate-900">{title}</h3>
            <p className="text-[11px] text-slate-500">
              {filled}/{total} fields captured
              {extraHint ? ` · ${extraHint}` : ''}
            </p>
          </div>
        </div>
        <ChevronDown
          size={18}
          className={`shrink-0 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open ? <div className="space-y-3 border-t border-slate-200/80 px-4 pb-4 pt-3">{children}</div> : null}
    </section>
  );
}

function WorkExperienceEntryCard({ entry, index }: { entry: CvWorkEntryLike; index: number }) {
  const meta = formatWorkEntryMeta(entry);
  const tenureLabel = formatWorkEntryTenureLabel(entry);
  const responsibilities = Array.isArray(entry.responsibilities)
    ? entry.responsibilities.filter((line) => String(line || '').trim())
    : [];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900">{formatWorkEntryHeadline(entry, index)}</p>
        {tenureLabel ? (
          <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
            {tenureLabel}
          </span>
        ) : null}
      </div>
      {meta ? <p className="mt-1 text-xs font-medium text-slate-500">{meta}</p> : null}
      {responsibilities.length > 0 ? (
        <ul className="mt-2.5 list-inside list-disc space-y-1 text-sm text-slate-700">
          {responsibilities.slice(0, 6).map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function EducationEntryCard({ entry, index }: { entry: Record<string, unknown>; index: number }) {
  const qual = display(entry.qualification || entry.degree);
  const inst = display(entry.instituteName || entry.institution);
  const dates = [entry.startYear, entry.endYear].filter(Boolean).join(' → ');
  const grade = display(entry.grade);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Entry {index + 1}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{qual || 'Qualification'}</p>
      {inst ? <p className="mt-0.5 text-sm text-slate-600">{inst}</p> : null}
      {dates || grade ? (
        <p className="mt-2 text-xs text-slate-500">
          {[dates, grade ? `Grade ${grade}` : ''].filter(Boolean).join(' · ')}
        </p>
      ) : null}
    </div>
  );
}

function normalizeLabelList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || '').trim())
      .filter(Boolean);
  }
  const text = display(value);
  if (!text) return [];
  if (text.includes(';')) {
    return text
      .split(';')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (text.includes('\n')) {
    return text
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [text];
}

function normalizePreferredList(primary: unknown, fallback?: unknown): string[] {
  const primaryList = normalizeLabelList(primary);
  if (primaryList.length) return primaryList;
  return normalizeLabelList(fallback);
}

function normalizeStringMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, raw]) => [String(key || '').trim(), String(raw || '').trim()])
      .filter(([key, raw]) => key && raw)
  );
}

function formatAmount(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toLocaleString();
  }
  const text = display(value);
  if (!text) return '';
  const numeric = Number(text.replace(/,/g, ''));
  if (Number.isFinite(numeric) && /^\d[\d,]*(\.\d+)?$/.test(text)) {
    return numeric.toLocaleString();
  }
  return text;
}

function normalizeSalaryTypeLabel(value: unknown): string {
  const text = display(value);
  if (!text) return '';
  const normalized = text.toUpperCase().replace(/\s+/g, '_');
  if (normalized === 'ANNUAL' || normalized === 'ANNUALLY') return 'Annual';
  if (normalized === 'MONTHLY') return 'Monthly';
  if (normalized === 'HOURLY') return 'Hourly';
  if (normalized === 'DAILY') return 'Daily';
  return text;
}

function normalizeWorkModeLabel(value: unknown): string {
  const text = display(value);
  if (!text) return '';
  const normalized = text.toUpperCase().replace(/\s+/g, '_');
  if (normalized === 'REMOTE') return 'Remote';
  if (normalized === 'ON_SITE' || normalized === 'ONSITE') return 'On-site';
  if (normalized === 'HYBRID') return 'Hybrid';
  return text;
}

function PreferenceCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
      <div className="mt-3 space-y-3">{children}</div>
    </div>
  );
}

function CompactField({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  const text = display(value);
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-sm ${text ? 'font-medium text-slate-800' : 'italic text-slate-400'}`}>
        {text || 'Not provided'}
      </p>
    </div>
  );
}

function ChipField({
  label,
  items,
}: {
  label: string;
  items: string[];
}) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      {items.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {items.map((item) => (
            <span
              key={`${label}-${item}`}
              className="rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-800"
            >
              {item}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-1 text-sm italic text-slate-400">Not provided</p>
      )}
    </div>
  );
}

function PassportNumbersField({
  values,
}: {
  values: Record<string, string>;
}) {
  const entries = Object.entries(values);
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
        Passport Numbers By Location
      </p>
      {entries.length ? (
        <div className="mt-2 space-y-1.5">
          {entries.map(([location, passport]) => (
            <div
              key={location}
              className="flex flex-col gap-0.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="font-medium text-slate-700">{location}</span>
              <span className="font-mono text-slate-900">{passport}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-1 text-sm italic text-slate-400">Not provided</p>
      )}
    </div>
  );
}

function buildOverviewModel(candidate: CandidateProfileDrawerData) {
  const extra = (candidate.extraData || {}) as Record<string, unknown>;
  const phase1 = getPhase1ProfileSnapshot(extra);
  const phase1Pi = phase1?.personalInfo || {};
  const pipeline = (extra.pipeline || {}) as Record<string, unknown>;
  const personal = (pipeline.personal || extra.personal || {}) as Record<string, unknown>;
  const professional = (pipeline.professional || extra.professional || {}) as Record<string, unknown>;
  const socialPipe = (pipeline.social || extra.social || {}) as Record<string, unknown>;
  const summaryPipe = (pipeline.summary || {}) as Record<string, unknown>;
  const educationPipe = (pipeline.education || {}) as Record<string, unknown>;
  const careerPrefs = {
    ...(((phase1?.careerPreferences as Record<string, unknown> | null) || {})),
    ...(((candidate.careerPreferences as Record<string, unknown> | null) || {})),
  };

  const eduEntries = (
    Array.isArray(educationPipe.entries) && educationPipe.entries.length
      ? (educationPipe.entries as Array<Record<string, unknown>>)
      : Array.isArray(phase1?.education) && phase1.education.length
        ? phase1.education.map((e) => ({
            degree: e.degreeProgram || e.degree,
            institution: e.institutionName || e.institution,
            field: e.fieldOfStudy,
            startYear: e.startYear,
            endYear: e.endYear,
          }))
        : candidate.cvEducationEntries || []
  ) as Array<Record<string, unknown>>;

  const workEntries = collectCandidateWorkEntries(candidate);

  const educationSummaryText =
    display(educationPipe.summaryText) ||
    display((summaryPipe as Record<string, unknown>).educationSummary) ||
    (isGarbageEducationSummary(candidate.cvEducation)
      ? ''
      : display(candidate.cvEducation)) ||
    buildEducationSummaryFromCvEntries(eduEntries);

  const educationCourses = Array.isArray(educationPipe.courses)
    ? (educationPipe.courses as string[]).join('; ')
    : Array.isArray(professional.courses)
      ? (professional.courses as string[]).join('; ')
      : Array.isArray(extra.courses)
        ? (extra.courses as string[]).join('; ')
        : '';

  const cityState = [candidate.cvCity, personal.state as string]
    .map((v) => display(v))
    .filter(Boolean)
    .join(', ');

  const candidateScore =
    display(personal.candidateScore) ||
    (candidate.aiScore?.overall != null ? String(candidate.aiScore.overall) : '');

  const computedExperienceYears = computeTotalExperienceYears(
    workEntries,
    candidate.experience ?? null,
  );

  const langProf = Array.isArray(summaryPipe.languageProficiency)
    ? (summaryPipe.languageProficiency as Array<{ language?: string; proficiency?: string }>)
        .map((row) => `${row.language || ''}${row.proficiency ? ` (${row.proficiency})` : ''}`)
        .filter(Boolean)
        .join(', ')
    : Array.isArray(phase1?.languages) && phase1.languages.length
      ? phase1.languages
          .map((row) => `${row.name || ''}${row.proficiency ? ` (${row.proficiency})` : ''}`)
          .filter(Boolean)
          .join(', ')
      : candidate.cvLanguages?.join(', ') || '';

  const honours = Array.isArray(summaryPipe.honoursAndAwards)
    ? (summaryPipe.honoursAndAwards as string[]).join('; ')
    : Array.isArray(extra.honoursAndAwards)
      ? (extra.honoursAndAwards as string[]).join('; ')
      : '';

  const workHistoryFromEntries = workEntries
    .map((w, i) => {
      const headline = formatWorkEntryHeadline(w, i).replace(/^\[\d+\]\s*/, '');
      const meta = formatWorkEntryMeta(w);
      const bullets = Array.isArray(w.responsibilities)
        ? w.responsibilities.slice(0, 2).join('; ')
        : '';
      return [headline, meta, bullets].filter(Boolean).join(': ');
    })
    .join('\n');

  const workHistory =
    display(summaryPipe.workHistory) ||
    workHistoryFromEntries ||
    '';

  return {
    personal: {
      name: candidate.name,
      email: candidate.email || display(phase1Pi.email),
      phone: candidate.phone || display(phase1Pi.phone),
      age: display(personal.age),
      candidateScore,
      cityState: cityState || [phase1Pi.city, phase1Pi.country].filter(Boolean).join(', ') || candidate.location,
      address: candidate.cvAddress || display(personal.currentAddress),
      zip: display(personal.zip),
      image: candidate.avatar || phase1Pi.profilePhotoUrl || null,
      nationality: display(personal.nationality),
      companyWebsite: display(personal.currentCompanyWebsite),
      maritalStatus: display(personal.maritalStatus),
      birthDate: display(personal.birthDate) || display(phase1Pi.dob),
      passport: display(personal.passportNumber),
      gender: display(phase1Pi.gender),
    },
    education: {
      entries: eduEntries,
      courses: educationCourses,
      summaryText: educationSummaryText,
    },
    professional: {
      experienceYears: computedExperienceYears,
      experienceLabel: formatExperienceYearsLabel(computedExperienceYears),
      currentPackage: {
        role: display(careerPrefs.currentRole) || candidate.designation || candidate.currentTitle,
        currency:
          display(careerPrefs.currentCurrency) ||
          display(professional.currentSalaryCurrency) ||
          candidate.salaryCurrency,
        salaryType: normalizeSalaryTypeLabel(careerPrefs.currentSalaryType),
        salary: formatAmount(careerPrefs.currentSalary) || formatAmount(candidate.currentSalaryValue),
        location: display(careerPrefs.currentLocation) || candidate.location || candidate.cvAddress,
        benefits: normalizeLabelList(careerPrefs.currentBenefits || professional.currentBenefits),
      },
      preferredPackage: {
        roles: normalizeLabelList(
          careerPrefs.preferredRoles || careerPrefs.preferredJobTitles || professional.preferredRoles
        ),
        currency:
          display(careerPrefs.preferredCurrency || careerPrefs.salaryCurrency) ||
          display(professional.expectedSalaryCurrency) ||
          candidate.salaryCurrency,
        salaryType: normalizeSalaryTypeLabel(
          careerPrefs.preferredSalaryType || careerPrefs.salaryFrequency
        ),
        salary:
          formatAmount(careerPrefs.preferredSalary || careerPrefs.salaryAmount) ||
          formatAmount(candidate.expectedSalaryValue),
        locations: normalizeLabelList(careerPrefs.preferredLocations).length
          ? normalizeLabelList(careerPrefs.preferredLocations)
          : normalizeLabelList(candidate.cvPreferredLocation),
        passportNumbersByLocation: normalizeStringMap(careerPrefs.passportNumbersByLocation),
        workMode:
          normalizeWorkModeLabel(careerPrefs.preferredWorkMode) ||
          normalizeLabelList(careerPrefs.workModes)[0] ||
          normalizeWorkModeLabel(candidate.cvAvailability),
        benefits: normalizeLabelList(careerPrefs.preferredBenefits || professional.expectedBenefits),
      },
      roleDomain: {
        industries: normalizePreferredList(
          careerPrefs.preferredIndustries,
          careerPrefs.preferredIndustry
        ),
        functionalAreas: normalizePreferredList(
          careerPrefs.functionalAreas,
          careerPrefs.functionalArea
        ),
        jobTypes: normalizeLabelList(careerPrefs.jobTypes),
      },
      availability: {
        relocation: display(careerPrefs.relocationPreference),
        earliestStartDate: display(careerPrefs.availabilityToStart) || candidate.cvAvailability,
        noticePeriod: display(careerPrefs.noticePeriod) || candidate.noticePeriod,
      },
      noticePeriod: candidate.noticePeriod,
      resume: candidate.resumeUrl,
      workEntries,
    },
    social: {
      linkedIn: candidate.linkedIn || display(socialPipe.linkedIn) || display(phase1Pi.linkedinUrl),
      twitter: display(socialPipe.twitter),
      xing: display(socialPipe.xing),
      skype: display(socialPipe.skypeId),
      facebook: display(socialPipe.facebook),
      stackOverflow: display(socialPipe.stackOverflow),
      website: candidate.cvWebsite || display(socialPipe.website),
      portfolio: candidate.cvPortfolio,
      links:
        (candidate.cvPortfolioLinks?.length ? candidate.cvPortfolioLinks : null) ||
        (Array.isArray(phase1?.portfolioLinks) ? phase1.portfolioLinks : []),
    },
    summary: {
      summary: candidate.cvSummary || candidate.summary || display(phase1?.summaryText),
      workHistory,
      educationText: educationSummaryText,
      certificates:
        candidate.cvCertifications?.join('; ') ||
        (Array.isArray(phase1?.certifications)
          ? phase1.certifications.map((c) => c.certificationName).filter(Boolean).join('; ')
          : ''),
      honours,
      languages: langProf,
      skills:
        (candidate.cvSkills?.length ? candidate.cvSkills : null) ||
        (Array.isArray(phase1?.skills)
          ? phase1.skills.map((s) => String(s.name || '').trim()).filter(Boolean)
          : []),
      projects: Array.isArray(extra.projects) ? (extra.projects as string[]).join('; ') : '',
      hackathons: Array.isArray(extra.hackathons) ? (extra.hackathons as string[]).join('; ') : '',
    },
  };
}

function countFilled(values: string[]) {
  return values.filter((v) => display(v)).length;
}

type Props = {
  candidate: CandidateProfileDrawerData;
  /** When set, sections marked false are omitted (client review preview). */
  sectionVisibility?: Partial<ClientSectionVisibility> | null;
};

export function CandidateAtsExtractedOverview({ candidate, sectionVisibility }: Props) {
  const model = useMemo(() => buildOverviewModel(candidate), [candidate]);
  const [open, setOpen] = useState<Record<SectionKey, boolean>>({
    personal: true,
    education: true,
    work: true,
    professional: true,
    social: true,
    summary: true,
  });

  const toggle = (key: SectionKey) => {
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const p = model.personal;
  const personalFilled = countFilled([
    p.name,
    p.email,
    p.phone,
    p.age,
    p.candidateScore,
    p.cityState,
    p.address,
    p.zip,
    p.image,
    p.nationality,
    p.companyWebsite,
    p.maritalStatus,
    p.birthDate,
    (p as { gender?: string }).gender,
    p.passport,
  ]);

  const edu = model.education;
  const eduEntryFilled = edu.entries.filter(
    (e) => display(e.qualification || e.degree) || display(e.instituteName || e.institution),
  ).length;
  const eduFilled =
    eduEntryFilled + (edu.courses ? 1 : 0) + (edu.summaryText ? 1 : 0);
  const eduTotal = Math.max(edu.entries.length, 1) + 2;

  const prof = model.professional;
  const profScalarFilled = countFilled([
    prof.experienceLabel,
    prof.currentPackage.role,
    prof.currentPackage.currency,
    prof.currentPackage.salaryType,
    prof.currentPackage.salary,
    prof.currentPackage.location,
    prof.currentPackage.benefits.join('; '),
    prof.preferredPackage.roles.join('; '),
    prof.preferredPackage.currency,
    prof.preferredPackage.salaryType,
    prof.preferredPackage.salary,
    prof.preferredPackage.locations.join('; '),
    Object.values(prof.preferredPackage.passportNumbersByLocation).join('; '),
    prof.preferredPackage.workMode,
    prof.preferredPackage.benefits.join('; '),
    prof.roleDomain.industries.join('; '),
    prof.roleDomain.functionalAreas.join('; '),
    prof.roleDomain.jobTypes.join('; '),
    prof.availability.relocation,
    prof.availability.earliestStartDate,
    prof.availability.noticePeriod,
    prof.resume,
  ]);
  const profTotal = 21;
  const workEntries = prof.workEntries;
  const workCount = workEntries.length;
  const workEntryFilled = workEntries.filter(
    (job) =>
      display(job.title) ||
      display(job.company) ||
      display(job.startDate) ||
      display(job.endDate),
  ).length;

  const s = model.social;
  const socialFilled =
    countFilled([
      s.linkedIn,
      s.twitter,
      s.xing,
      s.skype,
      s.facebook,
      s.stackOverflow,
      s.website,
      s.portfolio,
    ]) + (s.links.length > 0 ? 1 : 0);

  const sum = model.summary;
  const summaryFilled =
    countFilled([
      sum.summary,
      sum.workHistory,
      sum.educationText,
      sum.certificates,
      sum.honours,
      sum.languages,
      sum.projects,
      sum.hackathons,
    ]) + (sum.skills.length > 0 ? 1 : 0);

  const hasAnyExtracted =
    personalFilled > 0 ||
    eduFilled > 0 ||
    profScalarFilled > 0 ||
    workCount > 0 ||
    socialFilled > 0 ||
    summaryFilled > 0;

  if (!hasAnyExtracted) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
        <FileText className="mx-auto text-slate-300" size={32} />
        <p className="mt-3 text-sm font-medium text-slate-700">No extracted CV data yet</p>
        <p className="mt-1 text-xs text-slate-500">
          Upload a resume via Bulk CV or parse a resume to populate ATS fields here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isOverviewSectionVisible('personal', sectionVisibility) ? (
      <SectionBlock
        id="personal"
        title="Personal Information"
        icon={User}
        open={open.personal}
        onToggle={toggle}
        filled={personalFilled}
        total={15}
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <FieldRow label="Name" value={p.name} optional={false} />
          <FieldRow label="E-mail" value={p.email} />
          <FieldRow label="Mobile No" value={p.phone} />
          <FieldRow label="Age" value={p.age} />
          <FieldRow label="Candidate Score" value={p.candidateScore} />
          <FieldRow label="City & State" value={p.cityState} />
          <FieldRow label="Current Address" value={p.address} />
          <FieldRow label="Zip" value={p.zip} />
          <FieldRow label="Candidate Image" value={p.image ? 'On file' : ''} href={p.image} />
          <FieldRow label="Nationality" value={p.nationality} />
          <FieldRow label="Current Company Website" value={p.companyWebsite} href={p.companyWebsite} />
          <FieldRow label="Marital Status" value={p.maritalStatus} />
          <FieldRow label="Birth Date" value={p.birthDate} />
          <FieldRow label="Gender" value={(p as { gender?: string }).gender} />
          <FieldRow label="Passport Number" value={p.passport} />
        </div>
      </SectionBlock>
      ) : null}

      {isOverviewSectionVisible('education', sectionVisibility) ? (
      <SectionBlock
        id="education"
        title="Education"
        icon={GraduationCap}
        open={open.education}
        onToggle={toggle}
        filled={eduFilled}
        total={eduTotal}
        extraHint={
          edu.entries.length ? `${edu.entries.length} education ${edu.entries.length === 1 ? 'entry' : 'entries'}` : undefined
        }
      >
        {edu.entries.length > 0 ? (
          <div className="space-y-2">
            {edu.entries.map((entry, index) => (
              <EducationEntryCard key={`edu-${index}`} entry={entry} index={index} />
            ))}
          </div>
        ) : (
          <FieldRow label="Qualification" value="" optional={false} />
        )}
        <FieldRow label="Education (summary text)" value={edu.summaryText} />
        <FieldRow label="Courses" value={edu.courses} />
      </SectionBlock>
      ) : null}

      {isOverviewSectionVisible('professional', sectionVisibility) ? (
      <SectionBlock
        id="professional"
        title="Career Preferences"
        icon={Briefcase}
        open={open.professional}
        onToggle={toggle}
        filled={profScalarFilled}
        total={profTotal}
      >
        <div className="grid gap-3 lg:grid-cols-2">
          <PreferenceCard title="Current Package">
            <CompactField label="Current Role" value={prof.currentPackage.role} />
            <CompactField label="Currency" value={prof.currentPackage.currency} />
            <CompactField label="Salary Type" value={prof.currentPackage.salaryType} />
            <CompactField label="Current Salary" value={prof.currentPackage.salary} />
            <CompactField label="Current Location" value={prof.currentPackage.location} />
            <ChipField label="Benefits" items={prof.currentPackage.benefits} />
          </PreferenceCard>
          <PreferenceCard title="Preferred Package">
            <ChipField label="Preferred Role" items={prof.preferredPackage.roles} />
            <CompactField label="Currency" value={prof.preferredPackage.currency} />
            <CompactField label="Salary Type" value={prof.preferredPackage.salaryType} />
            <CompactField label="Preferred Salary" value={prof.preferredPackage.salary} />
            <ChipField label="Preferred Locations" items={prof.preferredPackage.locations} />
            <PassportNumbersField values={prof.preferredPackage.passportNumbersByLocation} />
            <CompactField label="Preferred Work Mode" value={prof.preferredPackage.workMode} />
            <ChipField label="Benefits" items={prof.preferredPackage.benefits} />
          </PreferenceCard>
        </div>

        <PreferenceCard title="Role & Domain">
          <ChipField label="Preferred Industries" items={prof.roleDomain.industries} />
          <ChipField label="Functional Areas" items={prof.roleDomain.functionalAreas} />
          <ChipField label="Job Types" items={prof.roleDomain.jobTypes} />
        </PreferenceCard>

        <div className="grid gap-3 lg:grid-cols-2">
          <PreferenceCard title="Availability">
            <CompactField label="Experience" value={prof.experienceLabel} />
            <CompactField label="Relocation Preference" value={prof.availability.relocation} />
            <CompactField label="Earliest Start Date" value={prof.availability.earliestStartDate} />
            <CompactField label="Notice Period" value={prof.availability.noticePeriod} />
          </PreferenceCard>
          <PreferenceCard title="Resume">
            <FieldRow label="Resume" value={prof.resume ? 'Attached' : ''} href={prof.resume} />
          </PreferenceCard>
        </div>

      </SectionBlock>
      ) : null}

      {isOverviewSectionVisible('work', sectionVisibility) ? (
      <SectionBlock
        id="work"
        title="Work Experience"
        icon={Briefcase}
        open={open.work}
        onToggle={toggle}
        filled={workEntryFilled}
        total={Math.max(workCount, 1)}
        extraHint={
          workCount > 0 ? `${workCount} ${workCount === 1 ? 'entry' : 'entries'}` : undefined
        }
      >
        {workCount > 0 ? (
          <div className="space-y-2">
            {workEntries.map((job, index) => (
              <WorkExperienceEntryCard key={`work-${index}`} entry={job} index={index} />
            ))}
          </div>
        ) : (
          <p className="text-sm italic text-slate-400">Not in resume</p>
        )}
      </SectionBlock>
      ) : null}

      {isOverviewSectionVisible('social', sectionVisibility) ? (
      <SectionBlock
        id="social"
        title="Social Network Information"
        icon={Share2}
        open={open.social}
        onToggle={toggle}
        filled={socialFilled}
        total={8}
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <FieldRow label="LinkedIn" value={s.linkedIn} href={s.linkedIn} />
          <FieldRow label="Twitter" value={s.twitter} href={s.twitter} />
          <FieldRow label="Xing" value={s.xing} href={s.xing} />
          <FieldRow label="Skype ID" value={s.skype} />
          <FieldRow label="Facebook" value={s.facebook} href={s.facebook} />
          <FieldRow label="Stack Overflow" value={s.stackOverflow} href={s.stackOverflow} />
          <FieldRow label="Website" value={s.website} href={s.website} />
        </div>
        {s.links.length > 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-[10px] font-bold uppercase text-slate-400">Portfolio / project links</p>
            <ul className="mt-2 space-y-1">
              {s.links.map((link, i) => {
                const label = [link.label, link.type].filter(Boolean).join(' — ') || 'Link';
                return (
                  <li key={i}>
                    <a
                      href={link.url || '#'}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-blue-700 hover:underline"
                    >
                      {label}: {link.url}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </SectionBlock>
      ) : null}

      {isOverviewSectionVisible('summary', sectionVisibility) ? (
      <SectionBlock
        id="summary"
        title="Summary & Additional"
        icon={Award}
        open={open.summary}
        onToggle={toggle}
        filled={summaryFilled}
        total={8}
      >
        <FieldRow label="Summary" value={sum.summary} optional={false} />
        {workCount > 0 ? (
          <div className="rounded-xl border border-slate-200/80 bg-white px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              Work History (optional)
            </p>
            <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{sum.workHistory}</p>
          </div>
        ) : (
          <FieldRow label="Work History" value={sum.workHistory} />
        )}
        <FieldRow label="Education" value={sum.educationText} />
        <FieldRow label="Certificate" value={sum.certificates} />
        <FieldRow label="Honours & Awards" value={sum.honours} />
        <FieldRow label="Language & Proficiency" value={sum.languages} />
        {sum.skills.length > 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-[10px] font-bold uppercase text-slate-400">Skills</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {sum.skills.map((skill) => (
                <span
                  key={skill}
                  className="rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-800"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <FieldRow label="Skills" value="" optional={false} />
        )}
        {sum.projects ? <FieldRow label="Projects (extra)" value={sum.projects} /> : null}
        {sum.hackathons ? <FieldRow label="Hackathons (extra)" value={sum.hackathons} /> : null}
      </SectionBlock>
      ) : null}
    </div>
  );
}
