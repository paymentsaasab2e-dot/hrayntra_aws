'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  Briefcase,
  GraduationCap,
  Share2,
  User,
  FileText,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { CandidateProfileDrawerData } from '../drawers/CandidateProfileDrawer';
import { DrawerSectionCard } from '../drawers/drawerFormUi';
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
} from '@/lib/candidateExperience';
import { CandidateWorkExperienceEntryView } from './CandidateWorkExperienceEntryView';
import { getPhase1ProfileSnapshot, resolvePhase1PersonalInfo } from '@/lib/phase1ProfileSnapshot';
import type { ClientSectionVisibility } from '@/lib/clientPresentationSections';
import { CandidateCareerPreferencesOverview } from './CandidateCareerPreferencesOverview';
import { CandidateHiringOverview } from './CandidateHiringSection';
import { buildCareerPreferencesViewModel, countCareerPreferencesFilled } from '@/lib/candidateCareerPreferencesModel';

type SectionKey = 'personal' | 'education' | 'work' | 'professional' | 'social' | 'summary';

const DEFAULT_CLOSED_SECTIONS: Record<SectionKey, boolean> = {
  personal: false,
  education: false,
  work: false,
  professional: false,
  social: false,
  summary: false,
};

function isOverviewSectionVisible(
  id: SectionKey,
  visibility?: Partial<ClientSectionVisibility> | null,
): boolean {
  if (!visibility) return true;
  return visibility[id] !== false;
}

import { formatIsoDateOnlyForDisplay } from '@/utils/dateDisplay';

function display(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return formatIsoDateOnlyForDisplay(String(value).trim());
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
  icon: LucideIcon;
  open: boolean;
  onToggle: (key: SectionKey) => void;
  children: React.ReactNode;
  filled: number;
  total: number;
  extraHint?: string;
}) {
  const subtitle = `${filled}/${total} fields captured${extraHint ? ` · ${extraHint}` : ''}`;
  return (
    <DrawerSectionCard
      title={title}
      subtitle={subtitle}
      icon={Icon}
      accent="indigo"
      collapsible
      open={open}
      onOpenChange={() => onToggle(id)}
    >
      {children}
    </DrawerSectionCard>
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

function buildOverviewModel(candidate: CandidateProfileDrawerData) {
  const extra = (candidate.extraData || {}) as Record<string, unknown>;
  const phase1 = getPhase1ProfileSnapshot(extra);
  const phase1Pi = resolvePhase1PersonalInfo(phase1, {
    cvAddress: candidate.cvAddress,
    cvCity: candidate.cvCity,
    cvCountry: candidate.cvCountry,
    email: candidate.email,
    phone: candidate.phone,
    linkedIn: candidate.linkedIn,
    extraData: extra,
  });
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
      nationality: display(personal.nationality) || display(phase1Pi.nationality),
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
  onAssignJob?: () => void;
};

export function CandidateAtsExtractedOverview({ candidate, sectionVisibility, onAssignJob }: Props) {
  const model = useMemo(() => buildOverviewModel(candidate), [candidate]);
  const [open, setOpen] = useState<Record<SectionKey, boolean>>(DEFAULT_CLOSED_SECTIONS);

  useEffect(() => {
    setOpen(DEFAULT_CLOSED_SECTIONS);
  }, [candidate.id]);

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
  const careerModel = useMemo(() => buildCareerPreferencesViewModel(candidate), [candidate]);
  const profScalarFilled = countCareerPreferencesFilled(careerModel);
  const profTotal = 23;
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

  return (
    <div className="space-y-5">
      <CandidateHiringOverview candidate={candidate} onAssignJob={onAssignJob} />

      {!hasAnyExtracted ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <FileText className="mx-auto text-slate-300" size={32} />
          <p className="mt-3 text-sm font-medium text-slate-700">No extracted CV data yet</p>
          <p className="mt-1 text-xs text-slate-500">
            Upload a resume via Bulk CV or parse a resume to populate ATS fields here.
          </p>
        </div>
      ) : null}

      {hasAnyExtracted && isOverviewSectionVisible('personal', sectionVisibility) ? (
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

      {hasAnyExtracted && isOverviewSectionVisible('education', sectionVisibility) ? (
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

      {hasAnyExtracted && isOverviewSectionVisible('professional', sectionVisibility) ? (
      <SectionBlock
        id="professional"
        title="Career Preferences"
        icon={Briefcase}
        open={open.professional}
        onToggle={toggle}
        filled={profScalarFilled}
        total={profTotal}
      >
        <CandidateCareerPreferencesOverview candidate={candidate} />
      </SectionBlock>
      ) : null}

      {hasAnyExtracted && isOverviewSectionVisible('work', sectionVisibility) ? (
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
              <CandidateWorkExperienceEntryView key={`work-${index}`} entry={job} index={index} />
            ))}
          </div>
        ) : (
          <p className="text-sm italic text-slate-400">Not in resume</p>
        )}
      </SectionBlock>
      ) : null}

      {hasAnyExtracted && isOverviewSectionVisible('social', sectionVisibility) ? (
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

      {hasAnyExtracted && isOverviewSectionVisible('summary', sectionVisibility) ? (
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
