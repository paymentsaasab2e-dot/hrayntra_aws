'use client';

import React, { useMemo, useState } from 'react';
import {
  Award,
  Briefcase,
  ChevronDown,
  ExternalLink,
  FileText,
  GraduationCap,
  Globe2,
  Languages,
  Layers,
  Link2,
  Medal,
  Shield,
  Sparkles,
  Star,
  Syringe,
  Target,
  Timer,
  User,
  Wrench,
} from 'lucide-react';
import type { CandidateProfileDrawerData } from '../drawers/CandidateProfileDrawer';
import { getPhase1ProfileSnapshot } from '@/lib/phase1ProfileSnapshot';
import type { Phase1ClientSectionId, Phase1ClientSectionVisibility } from '@/lib/phase1ClientPresentationSections';
import {
  resolvePhase1Accomplishments,
  resolvePhase1CareerPreferences,
  resolvePhase1Internships,
  resolvePhase1Languages,
  resolvePhase1PortfolioLinks,
  resolvePhase1Resume,
  resolvePhase1Skills,
  SKILL_CATEGORIES,
} from '@/lib/phase1OverviewResolvers';
import {
  collectCandidateWorkEntries,
  extractDurationTextFromEntry,
  formatWorkEntryHeadline,
  formatWorkEntryMeta,
  formatWorkEntryTenureLabel,
  normalizeCvWorkEntry,
  type CvWorkEntryLike,
} from '@/lib/candidateExperience';
import type { Phase1ProfileSnapshot } from '@/lib/phase1ProfileSnapshot';

type SectionId = Phase1ClientSectionId;

function display(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (Array.isArray(value)) return value.filter(Boolean).map(String).join(', ');
  if (typeof value === 'object') return '';
  return String(value).trim();
}

function FieldRow({ label, value }: { label: string; value?: unknown }) {
  const text = display(value);
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      {text ? (
        <p className="mt-1 whitespace-pre-line break-words text-sm font-medium text-slate-800">{text}</p>
      ) : (
        <p className="mt-1 text-sm italic text-slate-400">Not provided</p>
      )}
    </div>
  );
}

function Phase1Section({
  id,
  title,
  icon: Icon,
  open,
  onToggle,
  count,
  children,
}: {
  id: SectionId;
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  open: boolean;
  onToggle: (key: SectionId) => void;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-violet-200/80 bg-violet-50/30">
      <button
        type="button"
        onClick={() => onToggle(id)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-violet-100/50"
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="rounded-lg bg-white p-2 text-violet-700 shadow-sm ring-1 ring-violet-200/80">
            <Icon size={16} />
          </span>
          <div>
            <h3 className="text-sm font-bold text-slate-900">{title}</h3>
            {count != null ? (
              <p className="text-[11px] text-slate-500">
                {count} {count === 1 ? 'entry' : 'entries'}
              </p>
            ) : null}
          </div>
        </div>
        <ChevronDown
          size={18}
          className={`shrink-0 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open ? <div className="space-y-3 border-t border-violet-200/60 px-4 pb-4 pt-3">{children}</div> : null}
    </section>
  );
}

function mapWorkFromSnapshot(work: Phase1ProfileSnapshot['workExperience']): CvWorkEntryLike[] {
  if (!Array.isArray(work)) return [];
  return work.map((w) => {
    const base = normalizeCvWorkEntry({
      title: (w.jobTitle as string) || (w.title as string) || '',
      company: (w.company as string) || (w.companyName as string) || '',
      location: (w.workLocation as string) || (w.location as string) || '',
      startDate: (w.startDate as string) || '',
      endDate: (w.endDate as string) || '',
      durationText: (w.durationText as string) || null,
      responsibilities: Array.isArray(w.responsibilities)
        ? (w.responsibilities as string[])
        : w.description
          ? [String(w.description)]
          : [],
      isCurrentJob: w.isCurrentJob === true || w.currentlyWorkHere === true,
    });
    const durationText = base.durationText || extractDurationTextFromEntry(base);
    return durationText ? { ...base, durationText } : base;
  });
}

function WorkCard({ entry, index }: { entry: CvWorkEntryLike; index: number }) {
  const headline = formatWorkEntryHeadline(entry, index).replace(/^\[\d+\]\s*/, '');
  const meta = formatWorkEntryMeta(entry);
  const tenureLabel = formatWorkEntryTenureLabel(entry);
  const bullets = Array.isArray(entry.responsibilities) ? entry.responsibilities : [];
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900">{headline}</p>
        {tenureLabel ? (
          <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
            {tenureLabel}
          </span>
        ) : null}
      </div>
      {meta ? <p className="mt-0.5 text-xs text-slate-500">{meta}</p> : null}
      {bullets.length > 0 ? (
        <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-slate-700">
          {bullets.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function RecordCard({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; value?: unknown }>;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {rows.map((row) => (
          <FieldRow key={row.label} label={row.label} value={row.value} />
        ))}
      </div>
    </div>
  );
}

function SkillsGrouped({ skills }: { skills: ReturnType<typeof resolvePhase1Skills> }) {
  if (!skills.length) {
    return <p className="text-sm italic text-slate-400">Not provided</p>;
  }
  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-slate-900">
        {skills.length} skill{skills.length === 1 ? '' : 's'}
      </p>
      <p className="text-xs text-slate-500">Grouped by category</p>
      {SKILL_CATEGORIES.map((cat) => {
        const list = skills.filter((s) => (s.category || 'Hard Skills') === cat);
        if (!list.length) return null;
        return (
          <div key={cat}>
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">{cat}</p>
            <div className="flex flex-wrap gap-1.5">
              {list.map((skill, i) => (
                <span
                  key={`${cat}-${skill.name}-${i}`}
                  className="inline-flex max-w-full items-center gap-1.5 truncate rounded-md border border-blue-200 bg-blue-50/80 px-2 py-0.5 text-xs font-medium text-blue-900"
                >
                  {skill.name}
                  {skill.proficiency ? (
                    <span className="shrink-0 rounded bg-white/80 px-1 text-[10px] text-gray-600">
                      {skill.proficiency}
                    </span>
                  ) : null}
                </span>
              ))}
            </div>
          </div>
        );
      })}
      {skills.some((s) => s.category && !SKILL_CATEGORIES.includes(s.category as (typeof SKILL_CATEGORIES)[number])) ? (
        <div>
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">Other</p>
          <div className="flex flex-wrap gap-1.5">
            {skills
              .filter(
                (s) =>
                  !s.category ||
                  !SKILL_CATEGORIES.includes(s.category as (typeof SKILL_CATEGORIES)[number]),
              )
              .map((skill, i) => (
                <span
                  key={`other-${skill.name}-${i}`}
                  className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50/80 px-2 py-0.5 text-xs font-medium text-blue-900"
                >
                  {skill.name}
                  {skill.proficiency ? (
                    <span className="shrink-0 rounded bg-white/80 px-1 text-[10px] text-gray-600">
                      {skill.proficiency}
                    </span>
                  ) : null}
                </span>
              ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CareerPreferencesView({ prefs }: { prefs: Record<string, unknown> }) {
  const titles =
    (Array.isArray(prefs.preferredJobTitles) && prefs.preferredJobTitles.length
      ? prefs.preferredJobTitles
      : Array.isArray(prefs.preferredRoles)
        ? prefs.preferredRoles
        : []) as string[];
  const workModes =
    (Array.isArray(prefs.workModes) && prefs.workModes.length
      ? prefs.workModes
      : prefs.preferredWorkMode
        ? [String(prefs.preferredWorkMode)]
        : []) as string[];
  const industries =
    (Array.isArray(prefs.preferredIndustries) && prefs.preferredIndustries.length
      ? prefs.preferredIndustries
      : prefs.preferredIndustry
        ? [String(prefs.preferredIndustry)]
        : []) as string[];
  const areas =
    (Array.isArray(prefs.functionalAreas) && prefs.functionalAreas.length
      ? prefs.functionalAreas
      : prefs.functionalArea
        ? [String(prefs.functionalArea)]
        : []) as string[];
  const prefSalary = prefs.preferredSalary ?? prefs.salaryAmount;
  const prefCurr = prefs.preferredCurrency ?? prefs.salaryCurrency;

  return (
    <div className="space-y-3">
      {titles.length > 0 ? (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Target roles</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {titles.map((t, i) => (
              <span key={i} className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-900">
                {String(t)}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2">
        <FieldRow label="Current role" value={prefs.currentRole} />
        <FieldRow label="Notice period" value={prefs.noticePeriod} />
        <FieldRow label="Availability to start" value={prefs.availabilityToStart} />
        <FieldRow label="Relocation preference" value={prefs.relocationPreference} />
        <FieldRow
          label="Salary expectation"
          value={
            prefSalary
              ? `${prefCurr || 'USD'} ${prefSalary}${prefs.preferredSalaryType || prefs.salaryFrequency ? ` (${prefs.preferredSalaryType || prefs.salaryFrequency})` : ''}`
              : ''
          }
        />
      </div>
      {industries.length > 0 ? (
        <FieldRow label="Preferred industries" value={industries.join(', ')} />
      ) : null}
      {areas.length > 0 ? <FieldRow label="Functional areas" value={areas.join(', ')} /> : null}
      {Array.isArray(prefs.jobTypes) && prefs.jobTypes.length ? (
        <FieldRow label="Job types" value={prefs.jobTypes} />
      ) : null}
      {workModes.length > 0 ? <FieldRow label="Work modes" value={workModes.join(', ')} /> : null}
      {Array.isArray(prefs.preferredLocations) && prefs.preferredLocations.length ? (
        <FieldRow label="Preferred locations" value={prefs.preferredLocations} />
      ) : null}
    </div>
  );
}

const DEFAULT_OPEN: Record<SectionId, boolean> = {
  personal: true,
  resume: true,
  summary: true,
  work: true,
  internships: true,
  gap: false,
  education: true,
  academic: false,
  exams: false,
  skills: true,
  languages: true,
  projects: false,
  portfolio: true,
  certifications: false,
  accomplishments: false,
  careerPreferences: false,
  visa: false,
  vaccination: false,
};

type Props = {
  candidate: CandidateProfileDrawerData;
  sectionVisibility?: Partial<Phase1ClientSectionVisibility> | null;
};

/** Phase 1 candidate profile sections for the profile drawer (no duplicate-policy banner). */
export function CandidatePhase1DetailSections({ candidate, sectionVisibility }: Props) {
  const snap = useMemo(
    () => getPhase1ProfileSnapshot(candidate.extraData),
    [candidate.extraData],
  );

  const [open, setOpen] = useState<Record<SectionId, boolean>>(DEFAULT_OPEN);

  const toggle = (key: SectionId) => {
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const sectionVisible = (id: Phase1ClientSectionId) => sectionVisibility?.[id] !== false;

  const resume = useMemo(() => resolvePhase1Resume(snap, candidate), [snap, candidate]);
  const skills = useMemo(() => resolvePhase1Skills(snap, candidate), [snap, candidate]);
  const languages = useMemo(() => resolvePhase1Languages(snap, candidate), [snap, candidate]);
  const portfolioLinks = useMemo(() => resolvePhase1PortfolioLinks(snap, candidate), [snap, candidate]);
  const internships = useMemo(() => resolvePhase1Internships(snap, candidate), [snap, candidate]);
  const accomplishments = useMemo(() => resolvePhase1Accomplishments(snap, candidate), [snap, candidate]);
  const careerPrefs = useMemo(() => resolvePhase1CareerPreferences(snap, candidate), [snap, candidate]);

  const cvWorkEntries = useMemo(
    () => collectCandidateWorkEntries(candidate),
    [candidate],
  );

  const workEntries = useMemo(() => {
    if (cvWorkEntries.length) return cvWorkEntries;
    return mapWorkFromSnapshot(snap?.workExperience);
  }, [cvWorkEntries, snap?.workExperience]);

  const eduEntries = useMemo(() => {
    if (Array.isArray(snap?.education) && snap.education.length) return snap.education;
    return (candidate.cvEducationEntries || []).map((e) => ({
      degreeProgram: e.degree,
      institutionName: e.institution,
      startYear: e.startYear,
      endYear: e.endYear,
    }));
  }, [snap?.education, candidate.cvEducationEntries]);

  const certifications = snap?.certifications?.length
    ? snap.certifications
    : (candidate.cvCertifications || []).map((name) => ({ certificationName: name }));

  const personInfoRows = useMemo(() => {
    const pi = snap?.personalInfo || {};
    const fullName =
      [pi.firstName, pi.middleName, pi.lastName].filter(Boolean).join(' ').trim() ||
      candidate.name ||
      '';
    const phoneParts = [pi.phoneCode, pi.phone].map((v) => display(v)).filter(Boolean);
    const phone = phoneParts.join(' ') || candidate.phone || '';
    const cityStateCountry = [pi.city, pi.country].map((v) => display(v)).filter(Boolean).join(', ');
    return [
      { label: 'Full name', value: fullName },
      { label: 'Employment status', value: pi.employment },
      { label: 'Email', value: pi.email || candidate.email },
      { label: 'Phone', value: phone },
      { label: 'Gender', value: pi.gender },
      { label: 'Date of birth', value: pi.dob },
      { label: 'City', value: pi.city || candidate.cvCity },
      { label: 'Country', value: pi.country || candidate.cvCountry },
      { label: 'Nationality', value: pi.nationality },
      { label: 'Current address', value: pi.address || candidate.cvAddress },
      { label: 'City & country', value: cityStateCountry || candidate.location },
      { label: 'Passport number', value: pi.passportNumber },
      { label: 'LinkedIn', value: pi.linkedinUrl || candidate.linkedIn },
    ];
  }, [snap, candidate]);

  const hasAnyOverviewData =
    Boolean(snap) ||
    workEntries.length > 0 ||
    eduEntries.length > 0 ||
    personInfoRows.some((row) => display(row.value)) ||
    Boolean(resume.fileUrl) ||
    skills.length > 0 ||
    languages.length > 0 ||
    portfolioLinks.length > 0 ||
    internships.length > 0 ||
    accomplishments.length > 0 ||
    Boolean(careerPrefs);

  if (!hasAnyOverviewData) {
    return (
      <div className="rounded-2xl border border-dashed border-violet-300 bg-violet-50/50 p-8 text-center">
        <FileText className="mx-auto text-violet-300" size={32} />
        <p className="mt-3 text-sm font-medium text-slate-700">Phase 1 profile details not synced yet</p>
        <p className="mt-1 text-xs text-slate-500">
          This candidate is from the Phase 1 pool. Full dashboard sections appear after their profile is
          synced to candidatecommon.
        </p>
      </div>
    );
  }

  const summaryText = snap?.summaryText || candidate.cvSummary || candidate.summary || '';

  return (
    <div className="space-y-4">
      {sectionVisible('personal') ? (
        <Phase1Section
          id="personal"
          title="Basic information"
          icon={User}
          open={open.personal}
          onToggle={toggle}
        >
          <div className="grid gap-2 sm:grid-cols-2">
            {personInfoRows.map((row) => (
              <FieldRow key={row.label} label={row.label} value={row.value} />
            ))}
          </div>
        </Phase1Section>
      ) : null}

      {sectionVisible('resume') ? (
        <Phase1Section
          id="resume"
          title="Resume / CV"
          icon={FileText}
          open={open.resume}
          onToggle={toggle}
        >
          {resume.fileUrl || resume.fileName ? (
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{resume.fileName || 'Resume'}</p>
                  <p className="mt-0.5 text-xs text-slate-500">PDF · Job portal upload</p>
                </div>
                {resume.atsScore != null ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-center">
                    <p className="text-lg font-bold text-emerald-800">{resume.atsScore}%</p>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                      ATS readiness
                    </p>
                  </div>
                ) : (
                  <p className="text-xs italic text-slate-400">ATS score — upload or refresh in portal</p>
                )}
              </div>
              {resume.fileUrl ? (
                <a
                  href={resume.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-violet-700 hover:text-violet-900"
                >
                  Open resume
                  <ExternalLink size={14} />
                </a>
              ) : null}
            </div>
          ) : (
            <p className="text-sm italic text-slate-400">No resume uploaded</p>
          )}
        </Phase1Section>
      ) : null}

      {sectionVisible('summary') ? (
        <Phase1Section
          id="summary"
          title="Professional summary"
          icon={Sparkles}
          open={open.summary}
          onToggle={toggle}
        >
          {summaryText ? (
            <p className="whitespace-pre-line rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800">
              {summaryText}
            </p>
          ) : (
            <p className="text-sm italic text-slate-400">
              Add a short professional summary to introduce yourself to recruiters.
            </p>
          )}
        </Phase1Section>
      ) : null}

      {sectionVisible('work') ? (
        <Phase1Section
          id="work"
          title="Work experience"
          icon={Briefcase}
          open={open.work}
          onToggle={toggle}
          count={workEntries.length}
        >
          {workEntries.length ? (
            workEntries.map((entry, index) => <WorkCard key={`work-${index}`} entry={entry} index={index} />)
          ) : (
            <p className="text-sm italic text-slate-400">Not provided</p>
          )}
        </Phase1Section>
      ) : null}

      {sectionVisible('internships') ? (
        <Phase1Section
          id="internships"
          title="Internships"
          icon={Briefcase}
          open={open.internships}
          onToggle={toggle}
          count={internships.length}
        >
          {internships.length ? (
            internships.map((row, index) => (
              <RecordCard
                key={`intern-${index}`}
                title={
                  [display(row.internshipTitle), display(row.companyName)].filter(Boolean).join(' — ') ||
                  `Internship ${index + 1}`
                }
                rows={[
                  { label: 'Type', value: row.internshipType },
                  { label: 'Department / domain', value: row.domainDepartment },
                  {
                    label: 'Period',
                    value: [row.startDate, row.currentlyWorking ? 'Present' : row.endDate]
                      .filter(Boolean)
                      .join(' – '),
                  },
                  { label: 'Location', value: row.location },
                  { label: 'Work mode', value: row.workMode },
                  { label: 'Responsibilities', value: row.responsibilities },
                  { label: 'Learnings', value: row.learnings },
                  { label: 'Skills', value: row.skills },
                ]}
              />
            ))
          ) : (
            <p className="text-sm italic text-slate-400">No internship added yet</p>
          )}
        </Phase1Section>
      ) : null}

      {sectionVisible('gap') ? (
        <Phase1Section
          id="gap"
          title="Gap explanation"
          icon={Timer}
          open={open.gap}
          onToggle={toggle}
          count={snap?.gapExplanations?.length || 0}
        >
          {snap?.gapExplanations?.length ? (
            snap.gapExplanations.map((gap, index) => (
              <RecordCard
                key={`gap-${index}`}
                title={display(gap.gapCategory) || `Gap ${index + 1}`}
                rows={[
                  { label: 'Reason', value: gap.reasonForGap },
                  { label: 'Duration', value: gap.gapDuration },
                  { label: 'Skills during gap', value: gap.selectedSkills },
                  { label: 'Support', value: gap.preferredSupport },
                ]}
              />
            ))
          ) : (
            <p className="text-sm italic text-slate-400">No gap explanation added yet</p>
          )}
        </Phase1Section>
      ) : null}

      {sectionVisible('education') ? (
        <Phase1Section
          id="education"
          title="Education"
          icon={GraduationCap}
          open={open.education}
          onToggle={toggle}
          count={eduEntries.length}
        >
          {eduEntries.length ? (
            eduEntries.map((e, index) => (
              <RecordCard
                key={`edu-${index}`}
                title={
                  [display(e.degreeProgram || e.degree), display(e.institutionName || e.institution)]
                    .filter(Boolean)
                    .join(' — ') || `Education ${index + 1}`
                }
                rows={[
                  { label: 'Level', value: e.educationLevel },
                  { label: 'Field of study', value: e.fieldOfStudy || e.field },
                  { label: 'Period', value: [e.startYear, e.endYear].filter(Boolean).join(' – ') },
                  { label: 'Grade', value: e.grade },
                  { label: 'Currently studying', value: e.currentlyStudying },
                ]}
              />
            ))
          ) : (
            <p className="text-sm italic text-slate-400">Not provided</p>
          )}
        </Phase1Section>
      ) : null}

      {sectionVisible('academic') ? (
        <Phase1Section
          id="academic"
          title="Academic achievements"
          icon={Medal}
          open={open.academic}
          onToggle={toggle}
          count={snap?.academicAchievements?.length || 0}
        >
          {snap?.academicAchievements?.length ? (
            snap.academicAchievements.map((row, index) => (
              <RecordCard
                key={`ach-${index}`}
                title={display(row.achievementTitle) || `Achievement ${index + 1}`}
                rows={[
                  { label: 'Awarded by', value: row.awardedBy },
                  { label: 'Year', value: row.yearReceived },
                  { label: 'Category', value: row.categoryType },
                  { label: 'Description', value: row.description },
                ]}
              />
            ))
          ) : (
            <p className="text-sm italic text-slate-400">No academic achievements added yet</p>
          )}
        </Phase1Section>
      ) : null}

      {sectionVisible('exams') ? (
        <Phase1Section
          id="exams"
          title="Competitive exams"
          icon={Layers}
          open={open.exams}
          onToggle={toggle}
          count={snap?.competitiveExams?.length || 0}
        >
          {snap?.competitiveExams?.length ? (
            snap.competitiveExams.map((exam, index) => (
              <RecordCard
                key={`exam-${index}`}
                title={display(exam.examName) || `Exam ${index + 1}`}
                rows={[
                  { label: 'Year taken', value: exam.yearTaken },
                  { label: 'Result status', value: exam.resultStatus },
                  { label: 'Score', value: exam.scoreMarks },
                  { label: 'Score type', value: exam.scoreType },
                  { label: 'Valid until', value: exam.validUntil },
                  { label: 'Notes', value: exam.additionalNotes },
                ]}
              />
            ))
          ) : (
            <p className="text-sm italic text-slate-400">No competitive exam information added yet</p>
          )}
        </Phase1Section>
      ) : null}

      {sectionVisible('skills') ? (
        <Phase1Section
          id="skills"
          title="Skills"
          icon={Wrench}
          open={open.skills}
          onToggle={toggle}
          count={skills.length}
        >
          <SkillsGrouped skills={skills} />
        </Phase1Section>
      ) : null}

      {sectionVisible('languages') ? (
        <Phase1Section
          id="languages"
          title="Languages"
          icon={Languages}
          open={open.languages}
          onToggle={toggle}
          count={languages.length}
        >
          {languages.length ? (
            <div className="space-y-2">
              {languages.map((lang, index) => (
                <div
                  key={`lang-${index}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5"
                >
                  <p className="text-sm font-semibold text-slate-900">{lang.name}</p>
                  {lang.proficiency ? (
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                      {lang.proficiency}
                    </span>
                  ) : (
                    <span className="text-xs italic text-slate-400">Proficiency not set</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm italic text-slate-400">No languages added yet</p>
          )}
        </Phase1Section>
      ) : null}

      {sectionVisible('projects') ? (
        <Phase1Section
          id="projects"
          title="Projects"
          icon={Globe2}
          open={open.projects}
          onToggle={toggle}
          count={snap?.projects?.length || 0}
        >
          {snap?.projects?.length ? (
            snap.projects.map((project, index) => (
              <RecordCard
                key={`proj-${index}`}
                title={display(project.projectTitle) || `Project ${index + 1}`}
                rows={[
                  { label: 'Type', value: project.projectType },
                  { label: 'Organization / client', value: project.organizationClient },
                  { label: 'Currently working', value: project.currentlyWorking },
                  {
                    label: 'Period',
                    value: [project.startDate, project.endDate].filter(Boolean).join(' – '),
                  },
                  { label: 'Description', value: project.projectDescription },
                  { label: 'Responsibilities', value: project.responsibilities },
                  { label: 'Technologies', value: project.technologies },
                  { label: 'Outcome', value: project.projectOutcome },
                  { label: 'Link', value: project.projectLink },
                ]}
              />
            ))
          ) : (
            <p className="text-sm italic text-slate-400">No projects added yet</p>
          )}
        </Phase1Section>
      ) : null}

      {sectionVisible('portfolio') ? (
        <Phase1Section
          id="portfolio"
          title="Portfolio links"
          icon={Link2}
          open={open.portfolio}
          onToggle={toggle}
          count={portfolioLinks.length}
        >
          {portfolioLinks.length ? (
            portfolioLinks.map((link, index) => (
              <div key={`port-${index}`} className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-sm font-semibold text-slate-900">
                  {link.label || link.type || `Link ${index + 1}`}
                </p>
                {link.url ? (
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 break-all text-sm text-violet-700 hover:underline"
                  >
                    {link.url}
                    <ExternalLink size={12} className="shrink-0" />
                  </a>
                ) : (
                  <p className="mt-1 text-sm italic text-slate-400">URL not provided</p>
                )}
              </div>
            ))
          ) : (
            <p className="text-sm italic text-slate-400">No portfolio links added yet</p>
          )}
        </Phase1Section>
      ) : null}

      {sectionVisible('certifications') ? (
        <Phase1Section
          id="certifications"
          title="Certifications"
          icon={Award}
          open={open.certifications}
          onToggle={toggle}
          count={certifications?.length || 0}
        >
          {certifications?.length ? (
            certifications.map((cert, index) => (
              <RecordCard
                key={`cert-${index}`}
                title={display(cert.certificationName) || `Certification ${index + 1}`}
                rows={[
                  { label: 'Issuing organization', value: cert.issuingOrganization },
                  { label: 'Issue date', value: cert.issueDate },
                  { label: 'Expiry date', value: cert.expiryDate },
                ]}
              />
            ))
          ) : (
            <p className="text-sm italic text-slate-400">No certifications added yet</p>
          )}
        </Phase1Section>
      ) : null}

      {sectionVisible('accomplishments') ? (
        <Phase1Section
          id="accomplishments"
          title="Accomplishments"
          icon={Star}
          open={open.accomplishments}
          onToggle={toggle}
          count={accomplishments.length}
        >
          {accomplishments.length ? (
            accomplishments.map((row, index) => (
              <RecordCard
                key={`acc-${index}`}
                title={display(row.title || row.accomplishmentTitle) || `Accomplishment ${index + 1}`}
                rows={[
                  { label: 'Category', value: row.category },
                  { label: 'Organization', value: row.organization },
                  { label: 'Date', value: row.achievementDate },
                  { label: 'Description', value: row.description },
                ]}
              />
            ))
          ) : (
            <p className="text-sm italic text-slate-400">No accomplishments added yet</p>
          )}
        </Phase1Section>
      ) : null}

      {sectionVisible('careerPreferences') ? (
        <Phase1Section
          id="careerPreferences"
          title="Career preferences"
          icon={Target}
          open={open.careerPreferences}
          onToggle={toggle}
        >
          {careerPrefs ? (
            <CareerPreferencesView prefs={careerPrefs} />
          ) : (
            <p className="text-sm italic text-slate-400">No career preferences added yet</p>
          )}
        </Phase1Section>
      ) : null}

      {sectionVisible('visa') ? (
        <Phase1Section
          id="visa"
          title="Visa & work authorization"
          icon={Shield}
          open={open.visa}
          onToggle={toggle}
        >
          {snap?.visaWorkAuthorization ? (
            <>
              <RecordCard
                title="Work authorization"
                rows={[
                  { label: 'Destination', value: snap.visaWorkAuthorization.selectedDestination },
                  {
                    label: 'Visa / work permit required',
                    value: snap.visaWorkAuthorization.visaWorkpermitRequired,
                  },
                  { label: 'Open for all destinations', value: snap.visaWorkAuthorization.openForAll },
                  { label: 'Additional remarks', value: snap.visaWorkAuthorization.additionalRemarks },
                ]}
              />
              {Array.isArray(snap.visaWorkAuthorization.visaEntries) &&
              snap.visaWorkAuthorization.visaEntries.length ? (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Visa entries</p>
                  {(snap.visaWorkAuthorization.visaEntries as Array<Record<string, unknown>>).map(
                    (entry, index) => (
                      <RecordCard
                        key={`visa-${index}`}
                        title={display(entry.country || entry.destination) || `Visa ${index + 1}`}
                        rows={Object.entries(entry).map(([label, value]) => ({
                          label: label.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()),
                          value,
                        }))}
                      />
                    ),
                  )}
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-sm italic text-slate-400">No visa & work authorization information added yet</p>
          )}
        </Phase1Section>
      ) : null}

      {sectionVisible('vaccination') ? (
        <Phase1Section
          id="vaccination"
          title="Vaccination"
          icon={Syringe}
          open={open.vaccination}
          onToggle={toggle}
        >
          {snap?.vaccination ? (
            <RecordCard
              title="Vaccination record"
              rows={[
                { label: 'Status', value: snap.vaccination.vaccinationStatus },
                { label: 'Vaccine type', value: snap.vaccination.vaccineType },
                { label: 'Last vaccination date', value: snap.vaccination.lastVaccinationDate },
                {
                  label: 'Validity',
                  value: [snap.vaccination.validityMonth, snap.vaccination.validityYear]
                    .filter(Boolean)
                    .join('/'),
                },
                { label: 'Documents', value: snap.vaccination.documents || snap.vaccination.certificate },
              ]}
            />
          ) : (
            <p className="text-sm italic text-slate-400">No vaccination information added yet</p>
          )}
        </Phase1Section>
      ) : null}
    </div>
  );
}
