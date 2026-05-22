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
  computeTotalExperienceYears,
  formatExperienceYearsLabel,
  formatWorkEntryHeadline,
  formatWorkEntryMeta,
  type CvWorkEntryLike,
} from '@/lib/candidateExperience';
import { getPhase1ProfileSnapshot } from '@/lib/phase1ProfileSnapshot';

type SectionKey = 'personal' | 'education' | 'professional' | 'social' | 'summary';

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
  const responsibilities = Array.isArray(entry.responsibilities)
    ? entry.responsibilities.filter((line) => String(line || '').trim())
    : [];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
      <p className="text-sm font-semibold text-slate-900">{formatWorkEntryHeadline(entry, index)}</p>
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

  const workEntries = (
    Array.isArray(candidate.cvWorkExperienceEntries) && candidate.cvWorkExperienceEntries.length
      ? candidate.cvWorkExperienceEntries
      : Array.isArray(phase1?.workExperience)
        ? phase1.workExperience.map((w) => ({
            title: w.jobTitle || w.title,
            company: w.company || w.companyName,
            location: w.workLocation || w.location,
            startDate: w.startDate,
            endDate: w.endDate,
            responsibilities: Array.isArray(w.responsibilities)
              ? w.responsibilities
              : w.description
                ? [String(w.description)]
                : [],
          }))
        : []
  ) as CvWorkEntryLike[];

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
      remarks: candidate.cvNotes || display(professional.remarks) || display(extra.remarks),
      experienceYears: computedExperienceYears,
      experienceLabel: formatExperienceYearsLabel(computedExperienceYears),
      employer: candidate.currentCompany,
      designation: candidate.designation || candidate.currentTitle,
      currentSalary: candidate.cvCurrentSalary,
      currentSalaryCurrency:
        display(professional.currentSalaryCurrency) ||
        (candidate.cvCurrentSalary || candidate.currentSalaryValue != null
          ? candidate.salaryCurrency
          : ''),
      currentBenefits: display(professional.currentBenefits),
      expectedSalary: candidate.cvExpectedSalary || candidate.expectedSalary,
      expectedSalaryCurrency: display(professional.expectedSalaryCurrency),
      expectedBenefits: display(professional.expectedBenefits),
      noticePeriod: candidate.noticePeriod,
      resume: candidate.resumeUrl,
      courses: Array.isArray(professional.courses)
        ? (professional.courses as string[]).join('; ')
        : Array.isArray(extra.courses)
          ? (extra.courses as string[]).join('; ')
          : '',
      extracurricular: Array.isArray(professional.extracurricularActivities)
        ? (professional.extracurricularActivities as string[]).join('; ')
        : Array.isArray(extra.extracurricularActivities)
          ? (extra.extracurricularActivities as string[]).join('; ')
          : '',
      volunteers: Array.isArray(professional.volunteers)
        ? (professional.volunteers as string[]).join('; ')
        : Array.isArray(extra.volunteers)
          ? (extra.volunteers as string[]).join('; ')
          : '',
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
};

export function CandidateAtsExtractedOverview({ candidate }: Props) {
  const model = useMemo(() => buildOverviewModel(candidate), [candidate]);
  const [open, setOpen] = useState<Record<SectionKey, boolean>>({
    personal: true,
    education: true,
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
    prof.remarks,
    prof.experienceLabel,
    prof.employer,
    prof.designation,
    prof.currentSalary,
    prof.currentSalaryCurrency,
    prof.currentBenefits,
    prof.expectedSalary,
    prof.expectedSalaryCurrency,
    prof.expectedBenefits,
    prof.noticePeriod,
    prof.resume,
    prof.courses,
    prof.extracurricular,
    prof.volunteers,
  ]);
  const profTotal = 15;
  const workCount = prof.workEntries.length;

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
      <p className="text-xs text-slate-500">
        Parsed from resume (bulk CV pipeline). Education and work history are shown as structured
        entries; total experience is calculated from role durations or employment dates when
        available.
      </p>

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

      <SectionBlock
        id="professional"
        title="Professional Information"
        icon={Briefcase}
        open={open.professional}
        onToggle={toggle}
        filled={profScalarFilled}
        total={profTotal}
        extraHint={
          workCount > 0
            ? `${workCount} work ${workCount === 1 ? 'entry' : 'entries'}`
            : undefined
        }
      >
        {workCount > 0 ? (
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              Work experience entries
            </p>
            {prof.workEntries.map((job, index) => (
              <WorkExperienceEntryCard key={`work-${index}`} entry={job} index={index} />
            ))}
          </div>
        ) : null}

        <div className="grid gap-2 sm:grid-cols-2">
          <FieldRow label="Remarks" value={prof.remarks} />
          <FieldRow
            label="Experience"
            value={
              prof.experienceLabel
                ? workCount > 0
                  ? `${prof.experienceLabel} (from ${workCount} role${workCount === 1 ? '' : 's'})`
                  : prof.experienceLabel
                : ''
            }
          />
          <FieldRow label="Current Employer" value={prof.employer} />
          <FieldRow label="Current Designation" value={prof.designation} />
          <FieldRow label="Current Salary" value={prof.currentSalary} />
          <FieldRow label="Current Salary Currency Type" value={prof.currentSalaryCurrency} />
          <FieldRow label="Current Benefits" value={prof.currentBenefits} />
          <FieldRow label="Expected Salary" value={prof.expectedSalary} />
          <FieldRow label="Expected Salary Currency Type" value={prof.expectedSalaryCurrency} />
          <FieldRow label="Expected Benefits" value={prof.expectedBenefits} />
          <FieldRow label="Notice Period in days" value={prof.noticePeriod} />
          <FieldRow label="Resume" value={prof.resume ? 'Attached' : ''} href={prof.resume} />
          <FieldRow label="Courses" value={prof.courses} />
          <FieldRow label="Extracurricular Activities" value={prof.extracurricular} />
          <FieldRow label="Volunteers" value={prof.volunteers} />
        </div>
      </SectionBlock>

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
    </div>
  );
}
