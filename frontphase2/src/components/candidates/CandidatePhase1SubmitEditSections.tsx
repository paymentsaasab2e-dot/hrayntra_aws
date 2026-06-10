'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  Briefcase,
  ChevronDown,
  Eye,
  EyeOff,
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
import type { Phase1ProfileSnapshot } from '@/lib/phase1ProfileSnapshot';
import { resolvePhase1PersonalInfo } from '@/lib/phase1ProfileSnapshot';
import {
  PHASE1_CLIENT_SECTION_IDS,
  type Phase1ClientSectionId,
  type Phase1ClientSectionVisibility,
} from '@/lib/phase1ClientPresentationSections';
import { phase1FieldLabelClass, phase1FieldValueClass, phase1SectionMetaClass, phase1SectionTitleClass } from '@/lib/phase1Typography';
import { CandidatePhase1CareerPreferencesEdit } from './CandidatePhase1CareerPreferencesEdit';
import { EditDateField } from './EditDateField';
import { getLocalDateInputMinToday } from '@/utils/dateInputConstraints';

type SectionId = Phase1ClientSectionId;

const DEFAULT_CLOSED_SECTIONS = Object.fromEntries(
  PHASE1_CLIENT_SECTION_IDS.map((id) => [id, false]),
) as Record<SectionId, boolean>;

function EditField({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}) {
  return (
    <label className="block">
      <span className={`mb-1.5 block ${phase1FieldLabelClass}`}>
        {label}
      </span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          className={`w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 ${phase1FieldValueClass}`}
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 ${phase1FieldValueClass}`}
        />
      )}
    </label>
  );
}

function Phase1EditSection({
  id,
  title,
  icon: Icon,
  open,
  onToggle,
  count,
  children,
  showClientVisibilityToggle = false,
  clientVisible = true,
  onToggleClientVisibility,
}: {
  id: SectionId;
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  open: boolean;
  onToggle: (key: SectionId) => void;
  count?: number;
  children: React.ReactNode;
  showClientVisibilityToggle?: boolean;
  clientVisible?: boolean;
  onToggleClientVisibility?: (sectionId: Phase1ClientSectionId) => void;
}) {
  const hidden = showClientVisibilityToggle && !clientVisible;
  return (
    <section
      className={`overflow-hidden rounded-2xl border bg-violet-50/30 ${
        hidden ? 'border-dashed border-slate-300 opacity-90' : 'border-violet-200/80'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-violet-200/60 px-4 py-3">
        <button
          type="button"
          onClick={() => onToggle(id)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left hover:opacity-80"
        >
          <span className="rounded-lg bg-white p-2 text-violet-700 shadow-sm ring-1 ring-violet-200/80">
            <Icon size={16} />
          </span>
          <div className="min-w-0">
            <h3 className={phase1SectionTitleClass}>{title}</h3>
            {count != null ? (
              <p className={phase1SectionMetaClass}>
                {count} {count === 1 ? 'entry' : 'entries'}
              </p>
            ) : null}
          </div>
          <ChevronDown
            size={18}
            className={`ml-auto shrink-0 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>
        {hidden ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900">
            Hidden from client
          </span>
        ) : null}
        {showClientVisibilityToggle && onToggleClientVisibility ? (
          <button
            type="button"
            onClick={() => onToggleClientVisibility(id)}
            title={
              clientVisible
                ? 'Hide this section on the client review link'
                : 'Show this section on the client review link'
            }
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
      {open ? (
        clientVisible ? (
          <div className="space-y-3 border-t border-violet-200/60 px-4 pb-4 pt-3">{children}</div>
        ) : (
          <p className="border-t border-violet-200/60 px-4 py-3 text-xs text-slate-500">
            This section will not appear on the client review link. Click Visible to include it.
          </p>
        )
      ) : null}
    </section>
  );
}

function str(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.filter(Boolean).map(String).join(', ');
  return String(value).trim();
}

type Props = {
  candidate: CandidateProfileDrawerData;
  snapshot: Phase1ProfileSnapshot;
  onChange: (next: Phase1ProfileSnapshot) => void;
  showClientSectionVisibility?: boolean;
  clientSectionVisibility?: Partial<Phase1ClientSectionVisibility>;
  onToggleClientSectionVisibility?: (sectionId: Phase1ClientSectionId) => void;
};

export function CandidatePhase1SubmitEditSections({
  candidate,
  snapshot,
  onChange,
  showClientSectionVisibility = false,
  clientSectionVisibility,
  onToggleClientSectionVisibility,
}: Props) {
  const [open, setOpen] = useState<Record<SectionId, boolean>>(DEFAULT_CLOSED_SECTIONS);

  useEffect(() => {
    setOpen(DEFAULT_CLOSED_SECTIONS);
  }, [candidate.id]);

  const toggle = (key: SectionId) => {
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const pi = resolvePhase1PersonalInfo(snapshot, candidate);
  const birthDateMax = getLocalDateInputMinToday();
  const patchPersonal = (patch: Partial<NonNullable<Phase1ProfileSnapshot['personalInfo']>>) => {
    onChange({ ...snapshot, personalInfo: { ...pi, ...patch } });
  };

  const patchArray = (
    key: keyof Phase1ProfileSnapshot,
    index: number,
    field: string,
    value: string,
  ) => {
    const arr = Array.isArray(snapshot[key])
      ? [...(snapshot[key] as Array<Record<string, unknown>>)]
      : [];
    while (arr.length <= index) arr.push({});
    arr[index] = { ...arr[index], [field]: value };
    onChange({ ...snapshot, [key]: arr });
  };

  const patchNested = (key: keyof Phase1ProfileSnapshot, field: string, value: string) => {
    const obj =
      snapshot[key] && typeof snapshot[key] === 'object' && !Array.isArray(snapshot[key])
        ? { ...(snapshot[key] as Record<string, unknown>) }
        : {};
    obj[field] = value;
    onChange({ ...snapshot, [key]: obj });
  };

  const eduEntries = useMemo(() => {
    if (Array.isArray(snapshot.education) && snapshot.education.length) return snapshot.education;
    return (candidate.cvEducationEntries || []).map((e) => ({
      degreeProgram: e.degree,
      institutionName: e.institution,
      startYear: e.startYear,
      endYear: e.endYear,
    }));
  }, [snapshot.education, candidate.cvEducationEntries]);

  const workEntries = useMemo(() => {
    if (Array.isArray(snapshot.workExperience) && snapshot.workExperience.length) {
      return snapshot.workExperience;
    }
    return (candidate.cvWorkExperienceEntries || []).map((w) => ({
      jobTitle: w.title,
      company: w.company,
      workLocation: w.location,
      startDate: w.startDate,
      endDate: w.endDate,
      responsibilities: w.responsibilities,
    }));
  }, [snapshot.workExperience, candidate.cvWorkExperienceEntries]);

  const certifications = snapshot.certifications?.length
    ? snapshot.certifications
    : (candidate.cvCertifications || []).map((name) => ({ certificationName: name }));

  const sectionVisible = (id: SectionId) => clientSectionVisibility?.[id] !== false;
  const sectionToggleProps = {
    showClientVisibilityToggle: showClientSectionVisibility,
    onToggleClientVisibility: onToggleClientSectionVisibility,
  };

  return (
    <div className="space-y-4">
      {showClientSectionVisibility ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          <p className="font-semibold">Client review visibility</p>
          <p className="mt-1 text-blue-800/90">
            Use Visible / Hidden on each section header. Only visible sections are sent on the client review link.
          </p>
        </div>
      ) : null}

      <Phase1EditSection
        id="personal"
        title="Basic information"
        icon={User}
        open={open.personal}
        onToggle={toggle}
        {...sectionToggleProps}
        clientVisible={sectionVisible('personal')}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <EditField label="First name" value={str(pi.firstName || candidate.firstName)} onChange={(v) => patchPersonal({ firstName: v })} />
          <EditField label="Middle name" value={str(pi.middleName)} onChange={(v) => patchPersonal({ middleName: v })} />
          <EditField label="Last name" value={str(pi.lastName || candidate.lastName)} onChange={(v) => patchPersonal({ lastName: v })} />
          <EditField label="Email" value={str(pi.email || candidate.email)} onChange={(v) => patchPersonal({ email: v })} />
          <EditField label="Phone code" value={str(pi.phoneCode)} onChange={(v) => patchPersonal({ phoneCode: v })} />
          <EditField label="Mobile" value={str(pi.phone || candidate.phone)} onChange={(v) => patchPersonal({ phone: v })} />
          <EditDateField
            label="Date of birth"
            value={str(pi.dob)}
            max={birthDateMax}
            outputIso
            onChange={(v) => patchPersonal({ dob: v })}
          />
          <EditField label="Gender" value={str(pi.gender)} onChange={(v) => patchPersonal({ gender: v })} />
          <EditField label="Nationality" value={str(pi.nationality)} onChange={(v) => patchPersonal({ nationality: v })} />
          <EditField label="City" value={str(pi.city || candidate.cvCity)} onChange={(v) => patchPersonal({ city: v })} />
          <EditField label="Country" value={str(pi.country || candidate.cvCountry)} onChange={(v) => patchPersonal({ country: v })} />
          <div className="sm:col-span-2">
            <EditField label="Current address" value={str(pi.address || candidate.cvAddress)} onChange={(v) => patchPersonal({ address: v })} />
          </div>
          <EditField label="Employment status" value={str(pi.employment)} onChange={(v) => patchPersonal({ employment: v })} />
          <EditField label="Passport number" value={str(pi.passportNumber)} onChange={(v) => patchPersonal({ passportNumber: v })} />
          <div className="sm:col-span-2">
            <EditField label="LinkedIn" value={str(pi.linkedinUrl || candidate.linkedIn)} onChange={(v) => patchPersonal({ linkedinUrl: v })} />
          </div>
        </div>
      </Phase1EditSection>

      <Phase1EditSection
        id="summary"
        title="Professional summary"
        icon={Sparkles}
        open={open.summary}
        onToggle={toggle}
        {...sectionToggleProps}
        clientVisible={sectionVisible('summary')}
      >
        <EditField
          label="Summary"
          value={str(snapshot.summaryText || candidate.cvSummary || candidate.summary)}
          onChange={(v) => onChange({ ...snapshot, summaryText: v })}
          multiline
        />
      </Phase1EditSection>

      <Phase1EditSection
        id="internships"
        title="Internships"
        icon={Briefcase}
        open={open.internships}
        onToggle={toggle}
        count={snapshot.internships?.length || 0}
        {...sectionToggleProps}
        clientVisible={sectionVisible('internships')}
      >
        {(snapshot.internships || []).map((row, index) => (
          <div key={`intern-${index}`} className="rounded-xl border border-slate-200 bg-white p-3 grid gap-2 sm:grid-cols-2">
            <EditField label="Title" value={str(row.internshipTitle)} onChange={(v) => patchArray('internships', index, 'internshipTitle', v)} />
            <EditField label="Company" value={str(row.companyName)} onChange={(v) => patchArray('internships', index, 'companyName', v)} />
            <EditField label="Type" value={str(row.internshipType)} onChange={(v) => patchArray('internships', index, 'internshipType', v)} />
            <EditField label="Location" value={str(row.location)} onChange={(v) => patchArray('internships', index, 'location', v)} />
            <EditDateField label="Start date" value={str(row.startDate)} outputIso onChange={(v) => patchArray('internships', index, 'startDate', v)} />
            <EditDateField label="End date" value={str(row.endDate)} outputIso onChange={(v) => patchArray('internships', index, 'endDate', v)} />
            <div className="sm:col-span-2">
              <EditField label="Responsibilities" value={str(row.responsibilities)} onChange={(v) => patchArray('internships', index, 'responsibilities', v)} multiline />
            </div>
          </div>
        ))}
      </Phase1EditSection>

      <Phase1EditSection
        id="education"
        title="Education"
        icon={GraduationCap}
        open={open.education}
        onToggle={toggle}
        count={eduEntries.length}
        {...sectionToggleProps}
        clientVisible={sectionVisible('education')}
      >
        {eduEntries.map((e, index) => (
          <div key={`edu-${index}`} className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
            <p className="text-sm font-semibold text-slate-900">Education {index + 1}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <EditField label="Degree / program" value={str(e.degreeProgram || e.degree)} onChange={(v) => patchArray('education', index, 'degreeProgram', v)} />
              <EditField label="Institution" value={str(e.institutionName || e.institution)} onChange={(v) => patchArray('education', index, 'institutionName', v)} />
              <EditField label="Level" value={str(e.educationLevel)} onChange={(v) => patchArray('education', index, 'educationLevel', v)} />
              <EditField label="Field of study" value={str(e.fieldOfStudy || e.field)} onChange={(v) => patchArray('education', index, 'fieldOfStudy', v)} />
              <EditField label="Start year" value={str(e.startYear)} onChange={(v) => patchArray('education', index, 'startYear', v)} />
              <EditField label="End year" value={str(e.endYear)} onChange={(v) => patchArray('education', index, 'endYear', v)} />
              <EditField label="Grade" value={str(e.grade)} onChange={(v) => patchArray('education', index, 'grade', v)} />
            </div>
          </div>
        ))}
      </Phase1EditSection>

      <Phase1EditSection
        id="work"
        title="Work experience"
        icon={Briefcase}
        open={open.work}
        onToggle={toggle}
        count={workEntries.length}
        {...sectionToggleProps}
        clientVisible={sectionVisible('work')}
      >
        {workEntries.map((w, index) => (
          <div key={`work-${index}`} className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
            <p className="text-sm font-semibold text-slate-900">Role {index + 1}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <EditField label="Job title" value={str(w.jobTitle || w.title)} onChange={(v) => patchArray('workExperience', index, 'jobTitle', v)} />
              <EditField label="Company" value={str(w.company || w.companyName)} onChange={(v) => patchArray('workExperience', index, 'company', v)} />
              <EditField label="Location" value={str(w.workLocation || w.location)} onChange={(v) => patchArray('workExperience', index, 'workLocation', v)} />
              <EditDateField label="Start date" value={str(w.startDate)} outputIso onChange={(v) => patchArray('workExperience', index, 'startDate', v)} />
              <EditDateField label="End date" value={str(w.endDate)} outputIso onChange={(v) => patchArray('workExperience', index, 'endDate', v)} />
              <div className="sm:col-span-2">
                <EditField
                  label="Responsibilities (; separated)"
                  value={
                    Array.isArray(w.responsibilities)
                      ? w.responsibilities.join('; ')
                      : str(w.description)
                  }
                  onChange={(v) => {
                    const arr = Array.isArray(snapshot.workExperience)
                      ? [...snapshot.workExperience]
                      : [];
                    while (arr.length <= index) arr.push({});
                    arr[index] = {
                      ...arr[index],
                      responsibilities: v
                        .split(';')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    };
                    onChange({ ...snapshot, workExperience: arr });
                  }}
                  multiline
                />
              </div>
            </div>
          </div>
        ))}
      </Phase1EditSection>

      <Phase1EditSection
        id="certifications"
        title="Certifications"
        icon={Award}
        open={open.certifications}
        onToggle={toggle}
        count={certifications?.length || 0}
        {...sectionToggleProps}
        clientVisible={sectionVisible('certifications')}
      >
        {(certifications || []).map((cert, index) => (
          <div key={`cert-${index}`} className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
            <div className="grid gap-2 sm:grid-cols-2">
              <EditField label="Name" value={str(cert.certificationName)} onChange={(v) => patchArray('certifications', index, 'certificationName', v)} />
              <EditField label="Issuing organization" value={str(cert.issuingOrganization)} onChange={(v) => patchArray('certifications', index, 'issuingOrganization', v)} />
              <EditDateField label="Issue date" value={str(cert.issueDate)} outputIso onChange={(v) => patchArray('certifications', index, 'issueDate', v)} />
              <EditDateField label="Expiry date" value={str(cert.expiryDate)} outputIso onChange={(v) => patchArray('certifications', index, 'expiryDate', v)} />
            </div>
          </div>
        ))}
      </Phase1EditSection>

      <Phase1EditSection id="gap" title="Gap explanation" icon={Timer} open={open.gap} onToggle={toggle} count={snapshot.gapExplanations?.length || 0} {...sectionToggleProps} clientVisible={sectionVisible('gap')}>
        {(snapshot.gapExplanations || []).map((gap, index) => (
          <div key={`gap-${index}`} className="rounded-xl border border-slate-200 bg-white p-3 grid gap-2 sm:grid-cols-2">
            <EditField label="Category" value={str(gap.gapCategory)} onChange={(v) => patchArray('gapExplanations', index, 'gapCategory', v)} />
            <EditField label="Reason" value={str(gap.reasonForGap)} onChange={(v) => patchArray('gapExplanations', index, 'reasonForGap', v)} />
            <EditField label="Duration" value={str(gap.gapDuration)} onChange={(v) => patchArray('gapExplanations', index, 'gapDuration', v)} />
            <EditField label="Skills during gap" value={str(gap.selectedSkills)} onChange={(v) => patchArray('gapExplanations', index, 'selectedSkills', v)} />
          </div>
        ))}
      </Phase1EditSection>

      <Phase1EditSection id="academic" title="Academic achievements" icon={Medal} open={open.academic} onToggle={toggle} count={snapshot.academicAchievements?.length || 0} {...sectionToggleProps} clientVisible={sectionVisible('academic')}>
        {(snapshot.academicAchievements || []).map((row, index) => (
          <div key={`ach-${index}`} className="rounded-xl border border-slate-200 bg-white p-3 grid gap-2 sm:grid-cols-2">
            <EditField label="Title" value={str(row.achievementTitle)} onChange={(v) => patchArray('academicAchievements', index, 'achievementTitle', v)} />
            <EditField label="Awarded by" value={str(row.awardedBy)} onChange={(v) => patchArray('academicAchievements', index, 'awardedBy', v)} />
            <EditField label="Year" value={str(row.yearReceived)} onChange={(v) => patchArray('academicAchievements', index, 'yearReceived', v)} />
            <EditField label="Category" value={str(row.categoryType)} onChange={(v) => patchArray('academicAchievements', index, 'categoryType', v)} />
            <div className="sm:col-span-2">
              <EditField label="Description" value={str(row.description)} onChange={(v) => patchArray('academicAchievements', index, 'description', v)} multiline />
            </div>
          </div>
        ))}
      </Phase1EditSection>

      <Phase1EditSection id="exams" title="Competitive exams" icon={Layers} open={open.exams} onToggle={toggle} count={snapshot.competitiveExams?.length || 0} {...sectionToggleProps} clientVisible={sectionVisible('exams')}>
        {(snapshot.competitiveExams || []).map((exam, index) => (
          <div key={`exam-${index}`} className="rounded-xl border border-slate-200 bg-white p-3 grid gap-2 sm:grid-cols-2">
            <EditField label="Exam name" value={str(exam.examName)} onChange={(v) => patchArray('competitiveExams', index, 'examName', v)} />
            <EditField label="Year taken" value={str(exam.yearTaken)} onChange={(v) => patchArray('competitiveExams', index, 'yearTaken', v)} />
            <EditField label="Result status" value={str(exam.resultStatus)} onChange={(v) => patchArray('competitiveExams', index, 'resultStatus', v)} />
            <EditField label="Score" value={str(exam.scoreMarks)} onChange={(v) => patchArray('competitiveExams', index, 'scoreMarks', v)} />
            <EditField label="Valid until" value={str(exam.validUntil)} onChange={(v) => patchArray('competitiveExams', index, 'validUntil', v)} />
            <div className="sm:col-span-2">
              <EditField label="Notes" value={str(exam.additionalNotes)} onChange={(v) => patchArray('competitiveExams', index, 'additionalNotes', v)} multiline />
            </div>
          </div>
        ))}
      </Phase1EditSection>

      <Phase1EditSection id="skills" title="Skills" icon={Wrench} open={open.skills} onToggle={toggle} count={snapshot.skills?.length || 0} {...sectionToggleProps} clientVisible={sectionVisible('skills')}>
        <EditField
          label="Skills (one per line: name | proficiency | category)"
          value={(snapshot.skills || [])
            .map((s) => [s.name, s.proficiency, s.category].filter(Boolean).join(' | '))
            .join('\n')}
          onChange={(v) => {
            const skills = v
              .split('\n')
              .map((line) => line.trim())
              .filter(Boolean)
              .map((line) => {
                const [name, proficiency, category] = line.split('|').map((p) => p.trim());
                return {
                  name: name || line,
                  proficiency: proficiency || '',
                  category: category || 'Hard Skills',
                };
              });
            onChange({ ...snapshot, skills });
          }}
          multiline
        />
      </Phase1EditSection>

      <Phase1EditSection id="languages" title="Languages" icon={Languages} open={open.languages} onToggle={toggle} count={snapshot.languages?.length || 0} {...sectionToggleProps} clientVisible={sectionVisible('languages')}>
        <EditField
          label="Languages (one per line: name | proficiency)"
          value={(snapshot.languages || [])
            .map((l) => [l.name, l.proficiency].filter(Boolean).join(' | '))
            .join('\n')}
          onChange={(v) => {
            const languages = v
              .split('\n')
              .map((line) => line.trim())
              .filter(Boolean)
              .map((line) => {
                const [name, proficiency] = line.split('|').map((p) => p.trim());
                return { name: name || line, proficiency: proficiency || '' };
              });
            onChange({ ...snapshot, languages });
          }}
          multiline
        />
      </Phase1EditSection>

      <Phase1EditSection id="projects" title="Projects" icon={Globe2} open={open.projects} onToggle={toggle} count={snapshot.projects?.length || 0} {...sectionToggleProps} clientVisible={sectionVisible('projects')}>
        {(snapshot.projects || []).map((project, index) => (
          <div key={`proj-${index}`} className="rounded-xl border border-slate-200 bg-white p-3 grid gap-2 sm:grid-cols-2">
            <EditField label="Project title" value={str(project.projectTitle)} onChange={(v) => patchArray('projects', index, 'projectTitle', v)} />
            <EditField label="Type" value={str(project.projectType)} onChange={(v) => patchArray('projects', index, 'projectType', v)} />
            <EditField label="Organization / client" value={str(project.organizationClient)} onChange={(v) => patchArray('projects', index, 'organizationClient', v)} />
            <EditField label="Link" value={str(project.projectLink)} onChange={(v) => patchArray('projects', index, 'projectLink', v)} />
            <div className="sm:col-span-2">
              <EditField label="Description" value={str(project.projectDescription)} onChange={(v) => patchArray('projects', index, 'projectDescription', v)} multiline />
            </div>
          </div>
        ))}
      </Phase1EditSection>

      <Phase1EditSection id="portfolio" title="Portfolio links" icon={Link2} open={open.portfolio} onToggle={toggle} count={snapshot.portfolioLinks?.length || 0} {...sectionToggleProps} clientVisible={sectionVisible('portfolio')}>
        <EditField
          label="Links (one per line: label | url)"
          value={(snapshot.portfolioLinks || [])
            .map((l) => [l.type || 'Portfolio', l.url].filter(Boolean).join(' | '))
            .join('\n')}
          onChange={(v) => {
            const portfolioLinks = v
              .split('\n')
              .map((line) => line.trim())
              .filter(Boolean)
              .map((line) => {
                const [type, url] = line.split('|').map((p) => p.trim());
                return { type: type || 'Portfolio', url: url || type || line };
              });
            onChange({ ...snapshot, portfolioLinks });
          }}
          multiline
        />
      </Phase1EditSection>

      <Phase1EditSection id="accomplishments" title="Accomplishments" icon={Star} open={open.accomplishments} onToggle={toggle} count={snapshot.accomplishments?.length || 0} {...sectionToggleProps} clientVisible={sectionVisible('accomplishments')}>
        {(snapshot.accomplishments || []).map((row, index) => (
          <div key={`acc-${index}`} className="rounded-xl border border-slate-200 bg-white p-3 grid gap-2 sm:grid-cols-2">
            <EditField label="Title" value={str(row.title || row.accomplishmentTitle)} onChange={(v) => patchArray('accomplishments', index, 'title', v)} />
            <EditField label="Category" value={str(row.category)} onChange={(v) => patchArray('accomplishments', index, 'category', v)} />
            <EditField label="Organization" value={str(row.organization)} onChange={(v) => patchArray('accomplishments', index, 'organization', v)} />
            <EditDateField label="Date" value={str(row.achievementDate)} outputIso onChange={(v) => patchArray('accomplishments', index, 'achievementDate', v)} />
            <div className="sm:col-span-2">
              <EditField label="Description" value={str(row.description)} onChange={(v) => patchArray('accomplishments', index, 'description', v)} multiline />
            </div>
          </div>
        ))}
      </Phase1EditSection>

      <Phase1EditSection id="careerPreferences" title="Career preferences" icon={Target} open={open.careerPreferences} onToggle={toggle} {...sectionToggleProps} clientVisible={sectionVisible('careerPreferences')}>
        <CandidatePhase1CareerPreferencesEdit
          careerPreferences={snapshot.careerPreferences || null}
          onChange={(careerPreferences) => onChange({ ...snapshot, careerPreferences })}
        />
      </Phase1EditSection>

      <Phase1EditSection id="visa" title="Visa & work authorization" icon={Shield} open={open.visa} onToggle={toggle} {...sectionToggleProps} clientVisible={sectionVisible('visa')}>
        <div className="grid gap-2 sm:grid-cols-2">
          <EditField label="Destination" value={str(snapshot.visaWorkAuthorization?.selectedDestination)} onChange={(v) => patchNested('visaWorkAuthorization', 'selectedDestination', v)} />
          <EditField label="Visa required" value={str(snapshot.visaWorkAuthorization?.visaWorkpermitRequired)} onChange={(v) => patchNested('visaWorkAuthorization', 'visaWorkpermitRequired', v)} />
          <EditField label="Open for all destinations" value={str(snapshot.visaWorkAuthorization?.openForAll)} onChange={(v) => patchNested('visaWorkAuthorization', 'openForAll', v)} />
          <div className="sm:col-span-2">
            <EditField label="Additional remarks" value={str(snapshot.visaWorkAuthorization?.additionalRemarks)} onChange={(v) => patchNested('visaWorkAuthorization', 'additionalRemarks', v)} multiline />
          </div>
        </div>
      </Phase1EditSection>

      <Phase1EditSection id="vaccination" title="Vaccination" icon={Syringe} open={open.vaccination} onToggle={toggle} {...sectionToggleProps} clientVisible={sectionVisible('vaccination')}>
        <div className="grid gap-2 sm:grid-cols-2">
          <EditField label="Status" value={str(snapshot.vaccination?.vaccinationStatus)} onChange={(v) => patchNested('vaccination', 'vaccinationStatus', v)} />
          <EditField label="Vaccine type" value={str(snapshot.vaccination?.vaccineType)} onChange={(v) => patchNested('vaccination', 'vaccineType', v)} />
          <EditDateField label="Last vaccination date" value={str(snapshot.vaccination?.lastVaccinationDate)} outputIso max={birthDateMax} onChange={(v) => patchNested('vaccination', 'lastVaccinationDate', v)} />
          <EditField label="Validity month" value={str(snapshot.vaccination?.validityMonth)} onChange={(v) => patchNested('vaccination', 'validityMonth', v)} />
          <EditField label="Validity year" value={str(snapshot.vaccination?.validityYear)} onChange={(v) => patchNested('vaccination', 'validityYear', v)} />
        </div>
      </Phase1EditSection>
    </div>
  );
}
