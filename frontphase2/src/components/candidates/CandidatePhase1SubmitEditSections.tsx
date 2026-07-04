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
import { CandidateAcademicAchievementEntryEdit } from './CandidateAcademicAchievementEntryEdit';
import { CandidateCompetitiveExamEntryEdit } from './CandidateCompetitiveExamEntryEdit';
import { CandidateEducationEntryEdit } from './CandidateEducationEntryEdit';
import { CandidateCertificationEntryEdit } from './CandidateCertificationEntryEdit';
import { CandidateProjectEntryEdit } from './CandidateProjectEntryEdit';
import { CandidateGapExplanationEntryEdit } from './CandidateGapExplanationEntryEdit';
import { CandidateInternshipEntryEdit } from './CandidateInternshipEntryEdit';
import { CandidateWorkExperienceEntryEdit } from './CandidateWorkExperienceEntryEdit';
import { EditDateField } from './EditDateField';
import { normalizeAcademicAchievementRecord } from '@/lib/candidateAcademicAchievementFields';
import { normalizeCompetitiveExamRecord } from '@/lib/candidateCompetitiveExamFields';
import { normalizeEducationRecord } from '@/lib/candidateEducationFields';
import {
  accomplishmentRecordToSnapshotRow,
  normalizeAccomplishmentRecord,
} from '@/lib/candidateAccomplishmentFields';
import { normalizeCertificationRecord } from '@/lib/candidateCertificationFields';
import { normalizeProjectRecord } from '@/lib/candidateProjectFields';
import { normalizeGapExplanationRecord } from '@/lib/candidateGapExplanationFields';
import { normalizeInternshipRecord } from '@/lib/candidateInternshipFields';
import { normalizeWorkExperienceRecord } from '@/lib/candidateWorkExperienceFields';
import {
  resolvePhase1AcademicAchievements,
  resolvePhase1CompetitiveExams,
  resolvePhase1Education,
  resolvePhase1GapExplanations,
  resolvePhase1Internships,
  resolvePhase1Accomplishments,
  resolvePhase1Certifications,
  resolvePhase1Projects,
  resolvePhase1Vaccination,
  resolvePhase1VisaWorkAuthorization,
} from '@/lib/phase1OverviewResolvers';
import {
  extractVisaDisplayEntries,
  normalizeVisaEntryRecord,
  visaDisplayEntriesToSnapshot,
} from '@/lib/candidateVisaWorkAuthorizationFields';
import { CandidateVisaWorkAuthorizationEntryEdit } from './CandidateVisaWorkAuthorizationEntryEdit';
import { CandidateVaccinationEntryEdit } from './CandidateVaccinationEntryEdit';
import {
  normalizeVaccinationRecord,
  vaccinationRecordToSnapshotRow,
} from '@/lib/candidateVaccinationFields';
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

  const patchWorkEntry = (index: number, patch: Record<string, unknown>) => {
    const arr = Array.isArray(snapshot.workExperience)
      ? [...snapshot.workExperience]
      : [];
    while (arr.length <= index) arr.push({});
    arr[index] = { ...arr[index], ...patch };
    onChange({ ...snapshot, workExperience: arr });
  };

  const patchInternshipEntry = (index: number, patch: Record<string, unknown>) => {
    const arr = Array.isArray(snapshot.internships) ? [...snapshot.internships] : [];
    while (arr.length <= index) arr.push({});
    arr[index] = { ...arr[index], ...patch };
    onChange({ ...snapshot, internships: arr });
  };

  const patchGapEntry = (index: number, patch: Record<string, unknown>) => {
    const arr = Array.isArray(snapshot.gapExplanations) ? [...snapshot.gapExplanations] : [];
    while (arr.length <= index) arr.push({});
    arr[index] = { ...arr[index], ...patch };
    onChange({ ...snapshot, gapExplanations: arr });
  };

  const patchNested = (key: keyof Phase1ProfileSnapshot, field: string, value: string) => {
    const obj =
      snapshot[key] && typeof snapshot[key] === 'object' && !Array.isArray(snapshot[key])
        ? { ...(snapshot[key] as Record<string, unknown>) }
        : {};
    obj[field] = value;
    onChange({ ...snapshot, [key]: obj });
  };

  const patchEducationEntry = (index: number, patch: Record<string, unknown>) => {
    const arr = Array.isArray(snapshot.education) ? [...snapshot.education] : [];
    while (arr.length <= index) arr.push({});
    arr[index] = { ...arr[index], ...patch };
    onChange({ ...snapshot, education: arr });
  };

  const eduEntries = useMemo(() => {
    const rows =
      Array.isArray(snapshot.education) && snapshot.education.length
        ? snapshot.education
        : resolvePhase1Education(snapshot, candidate);
    return rows.map((row) => normalizeEducationRecord(row as Record<string, unknown>));
  }, [snapshot.education, candidate]);

  const workEntries = useMemo(() => {
    if (Array.isArray(snapshot.workExperience) && snapshot.workExperience.length) {
      return snapshot.workExperience;
    }
    return (candidate.cvWorkExperienceEntries || []).map((w) =>
      normalizeWorkExperienceRecord(w as Record<string, unknown>),
    );
  }, [snapshot.workExperience, candidate.cvWorkExperienceEntries]);

  const internshipEntries = useMemo(() => {
    const rows =
      Array.isArray(snapshot.internships) && snapshot.internships.length
        ? snapshot.internships
        : resolvePhase1Internships(snapshot, candidate);
    return rows.map((row) => normalizeInternshipRecord(row as Record<string, unknown>));
  }, [snapshot.internships, candidate]);

  const gapEntries = useMemo(() => {
    const rows =
      Array.isArray(snapshot.gapExplanations) && snapshot.gapExplanations.length
        ? snapshot.gapExplanations
        : resolvePhase1GapExplanations(snapshot, candidate);
    return rows.map((row) => normalizeGapExplanationRecord(row as Record<string, unknown>));
  }, [snapshot.gapExplanations, candidate]);

  const patchAcademicAchievementEntry = (index: number, patch: Record<string, unknown>) => {
    const arr = Array.isArray(snapshot.academicAchievements) ? [...snapshot.academicAchievements] : [];
    while (arr.length <= index) arr.push({});
    arr[index] = { ...arr[index], ...patch };
    onChange({ ...snapshot, academicAchievements: arr });
  };

  const academicAchievementEntries = useMemo(() => {
    const rows =
      Array.isArray(snapshot.academicAchievements) && snapshot.academicAchievements.length
        ? snapshot.academicAchievements
        : resolvePhase1AcademicAchievements(snapshot, candidate);
    return rows.map((row) => normalizeAcademicAchievementRecord(row as Record<string, unknown>));
  }, [snapshot.academicAchievements, candidate]);

  const patchCompetitiveExamEntry = (index: number, patch: Record<string, unknown>) => {
    const arr = Array.isArray(snapshot.competitiveExams) ? [...snapshot.competitiveExams] : [];
    while (arr.length <= index) arr.push({});
    arr[index] = { ...arr[index], ...patch };
    onChange({ ...snapshot, competitiveExams: arr });
  };

  const competitiveExamEntries = useMemo(() => {
    const rows =
      Array.isArray(snapshot.competitiveExams) && snapshot.competitiveExams.length
        ? snapshot.competitiveExams
        : resolvePhase1CompetitiveExams(snapshot, candidate);
    return rows.map((row) => normalizeCompetitiveExamRecord(row as Record<string, unknown>));
  }, [snapshot.competitiveExams, candidate]);

  const patchProjectEntry = (index: number, patch: Record<string, unknown>) => {
    const arr = Array.isArray(snapshot.projects) ? [...snapshot.projects] : [];
    while (arr.length <= index) arr.push({});
    arr[index] = { ...arr[index], ...patch };
    onChange({ ...snapshot, projects: arr });
  };

  const projectEntries = useMemo(() => {
    const rows =
      Array.isArray(snapshot.projects) && snapshot.projects.length
        ? snapshot.projects
        : resolvePhase1Projects(snapshot, candidate);
    return rows.map((row) => normalizeProjectRecord(row as Record<string, unknown>));
  }, [snapshot.projects, candidate]);

  const patchCertificationEntry = (index: number, patch: Record<string, unknown>) => {
    const arr = Array.isArray(snapshot.certifications) ? [...snapshot.certifications] : [];
    while (arr.length <= index) arr.push({});
    arr[index] = { ...arr[index], ...patch };
    onChange({ ...snapshot, certifications: arr });
  };

  const visaEntries = useMemo(() => {
    const visa =
      snapshot.visaWorkAuthorization && typeof snapshot.visaWorkAuthorization === 'object'
        ? (snapshot.visaWorkAuthorization as Record<string, unknown>)
        : resolvePhase1VisaWorkAuthorization(snapshot, candidate);
    return extractVisaDisplayEntries(visa).map((row) => normalizeVisaEntryRecord(row));
  }, [snapshot.visaWorkAuthorization, candidate]);

  const patchVisaEntry = (index: number, patch: Record<string, unknown>) => {
    const nextEntries = visaEntries.map((row, rowIndex) =>
      rowIndex === index ? normalizeVisaEntryRecord({ ...row, ...patch }) : row,
    );
    onChange({
      ...snapshot,
      visaWorkAuthorization: visaDisplayEntriesToSnapshot(
        nextEntries,
        snapshot.visaWorkAuthorization as Record<string, unknown> | null,
      ),
    });
  };

  const accomplishmentEntries = useMemo(() => {
    const rows =
      Array.isArray(snapshot.accomplishments) && snapshot.accomplishments.length
        ? snapshot.accomplishments
        : resolvePhase1Accomplishments(snapshot, candidate);
    return rows.map((row) => normalizeAccomplishmentRecord(row as Record<string, unknown>));
  }, [snapshot.accomplishments, candidate]);

  const vaccinationRecord = useMemo(() => {
    const raw =
      snapshot.vaccination && typeof snapshot.vaccination === 'object'
        ? snapshot.vaccination
        : resolvePhase1Vaccination(snapshot, candidate);
    return normalizeVaccinationRecord((raw || {}) as Record<string, unknown>);
  }, [snapshot.vaccination, snapshot, candidate]);

  const patchVaccination = (patch: Record<string, unknown>) => {
    const next = normalizeVaccinationRecord({ ...vaccinationRecord, ...patch });
    onChange({
      ...snapshot,
      vaccination: vaccinationRecordToSnapshotRow(next),
    });
  };

  const patchAccomplishmentEntry = (index: number, patch: Record<string, unknown>) => {
    const nextEntries = accomplishmentEntries.map((row, rowIndex) =>
      rowIndex === index
        ? normalizeAccomplishmentRecord({ ...row, ...patch })
        : row,
    );
    onChange({
      ...snapshot,
      accomplishments: nextEntries.map((row) => accomplishmentRecordToSnapshotRow(row)),
    });
  };

  const certificationEntries = useMemo(() => {
    const rows =
      Array.isArray(snapshot.certifications) && snapshot.certifications.length
        ? snapshot.certifications
        : resolvePhase1Certifications(snapshot, candidate);
    return rows.map((row) => normalizeCertificationRecord(row as Record<string, unknown>));
  }, [snapshot.certifications, candidate]);

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
          <EditField label="First name" value={str(candidate.firstName || pi.firstName)} onChange={(v) => patchPersonal({ firstName: v })} />
          <EditField label="Middle name" value={str(candidate.middleName || pi.middleName)} onChange={(v) => patchPersonal({ middleName: v })} />
          <EditField label="Last name" value={str(candidate.lastName || pi.lastName)} onChange={(v) => patchPersonal({ lastName: v })} />
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
        count={internshipEntries.length}
        {...sectionToggleProps}
        clientVisible={sectionVisible('internships')}
      >
        {internshipEntries.map((row, index) => (
          <CandidateInternshipEntryEdit
            key={`intern-${index}`}
            candidateId={candidate.id}
            entry={row as Record<string, unknown>}
            index={index}
            onChange={patchInternshipEntry}
          />
        ))}
        <button
          type="button"
          onClick={() =>
            onChange({
              ...snapshot,
              internships: [...(Array.isArray(snapshot.internships) ? snapshot.internships : []), {}],
            })
          }
          className="w-full rounded-xl border border-dashed border-violet-300 bg-violet-50/60 px-4 py-3 text-sm font-semibold text-violet-700 hover:bg-violet-50"
        >
          Add internship
        </button>
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
          <CandidateEducationEntryEdit
            key={`edu-${index}`}
            candidateId={candidate.id}
            entry={e as Record<string, unknown>}
            index={index}
            onChange={patchEducationEntry}
          />
        ))}
        <button
          type="button"
          onClick={() =>
            onChange({
              ...snapshot,
              education: [...(Array.isArray(snapshot.education) ? snapshot.education : []), {}],
            })
          }
          className="w-full rounded-xl border border-dashed border-violet-300 bg-violet-50/60 px-4 py-3 text-sm font-semibold text-violet-700 hover:bg-violet-50"
        >
          Add education
        </button>
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
          <CandidateWorkExperienceEntryEdit
            key={`work-${index}`}
            candidateId={candidate.id}
            entry={w as Record<string, unknown>}
            index={index}
            onChange={patchWorkEntry}
          />
        ))}
        <button
          type="button"
          onClick={() =>
            onChange({
              ...snapshot,
              workExperience: [...(Array.isArray(snapshot.workExperience) ? snapshot.workExperience : []), {}],
            })
          }
          className="w-full rounded-xl border border-dashed border-violet-300 bg-violet-50/60 px-4 py-3 text-sm font-semibold text-violet-700 hover:bg-violet-50"
        >
          Add work experience role
        </button>
      </Phase1EditSection>

      <Phase1EditSection
        id="certifications"
        title="Certifications"
        icon={Award}
        open={open.certifications}
        onToggle={toggle}
        count={certificationEntries.length}
        {...sectionToggleProps}
        clientVisible={sectionVisible('certifications')}
      >
        {certificationEntries.map((row, index) => (
          <CandidateCertificationEntryEdit
            key={`cert-${index}`}
            candidateId={candidate.id}
            entry={row as Record<string, unknown>}
            index={index}
            onChange={patchCertificationEntry}
          />
        ))}
        <button
          type="button"
          onClick={() =>
            onChange({
              ...snapshot,
              certifications: [
                ...(Array.isArray(snapshot.certifications) ? snapshot.certifications : []),
                {},
              ],
            })
          }
          className="w-full rounded-xl border border-dashed border-violet-300 bg-violet-50/60 px-4 py-3 text-sm font-semibold text-violet-700 hover:bg-violet-50"
        >
          Add certification
        </button>
      </Phase1EditSection>

      <Phase1EditSection
        id="gap"
        title="Gap explanation"
        icon={Timer}
        open={open.gap}
        onToggle={toggle}
        count={gapEntries.length}
        {...sectionToggleProps}
        clientVisible={sectionVisible('gap')}
      >
        {gapEntries.map((gap, index) => (
          <CandidateGapExplanationEntryEdit
            key={`gap-${index}`}
            entry={gap as Record<string, unknown>}
            index={index}
            onChange={patchGapEntry}
          />
        ))}
        <button
          type="button"
          onClick={() =>
            onChange({
              ...snapshot,
              gapExplanations: [
                ...(Array.isArray(snapshot.gapExplanations) ? snapshot.gapExplanations : []),
                {},
              ],
            })
          }
          className="w-full rounded-xl border border-dashed border-violet-300 bg-violet-50/60 px-4 py-3 text-sm font-semibold text-violet-700 hover:bg-violet-50"
        >
          Add gap explanation
        </button>
      </Phase1EditSection>

      <Phase1EditSection
        id="academic"
        title="Academic achievements"
        icon={Medal}
        open={open.academic}
        onToggle={toggle}
        count={academicAchievementEntries.length}
        {...sectionToggleProps}
        clientVisible={sectionVisible('academic')}
      >
        {academicAchievementEntries.map((row, index) => (
          <CandidateAcademicAchievementEntryEdit
            key={`ach-${index}`}
            candidateId={candidate.id}
            entry={row as Record<string, unknown>}
            index={index}
            onChange={patchAcademicAchievementEntry}
          />
        ))}
        <button
          type="button"
          onClick={() =>
            onChange({
              ...snapshot,
              academicAchievements: [
                ...(Array.isArray(snapshot.academicAchievements) ? snapshot.academicAchievements : []),
                {},
              ],
            })
          }
          className="w-full rounded-xl border border-dashed border-violet-300 bg-violet-50/60 px-4 py-3 text-sm font-semibold text-violet-700 hover:bg-violet-50"
        >
          Add academic achievement
        </button>
      </Phase1EditSection>

      <Phase1EditSection
        id="exams"
        title="Competitive exams"
        icon={Layers}
        open={open.exams}
        onToggle={toggle}
        count={competitiveExamEntries.length}
        {...sectionToggleProps}
        clientVisible={sectionVisible('exams')}
      >
        {competitiveExamEntries.map((row, index) => (
          <CandidateCompetitiveExamEntryEdit
            key={`exam-${index}`}
            candidateId={candidate.id}
            entry={row as Record<string, unknown>}
            index={index}
            onChange={patchCompetitiveExamEntry}
          />
        ))}
        <button
          type="button"
          onClick={() =>
            onChange({
              ...snapshot,
              competitiveExams: [
                ...(Array.isArray(snapshot.competitiveExams) ? snapshot.competitiveExams : []),
                {},
              ],
            })
          }
          className="w-full rounded-xl border border-dashed border-violet-300 bg-violet-50/60 px-4 py-3 text-sm font-semibold text-violet-700 hover:bg-violet-50"
        >
          Add competitive exam
        </button>
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

      <Phase1EditSection
        id="projects"
        title="Projects"
        icon={Globe2}
        open={open.projects}
        onToggle={toggle}
        count={projectEntries.length}
        {...sectionToggleProps}
        clientVisible={sectionVisible('projects')}
      >
        {projectEntries.map((row, index) => (
          <CandidateProjectEntryEdit
            key={`proj-${index}`}
            candidateId={candidate.id}
            entry={row as Record<string, unknown>}
            index={index}
            onChange={patchProjectEntry}
          />
        ))}
        <button
          type="button"
          onClick={() =>
            onChange({
              ...snapshot,
              projects: [...(Array.isArray(snapshot.projects) ? snapshot.projects : []), {}],
            })
          }
          className="w-full rounded-xl border border-dashed border-violet-300 bg-violet-50/60 px-4 py-3 text-sm font-semibold text-violet-700 hover:bg-violet-50"
        >
          Add project
        </button>
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

      <Phase1EditSection
        id="accomplishments"
        title="Accomplishments"
        icon={Star}
        open={open.accomplishments}
        onToggle={toggle}
        count={accomplishmentEntries.length}
        {...sectionToggleProps}
        clientVisible={sectionVisible('accomplishments')}
      >
        {accomplishmentEntries.map((row, index) => (
          <div key={`acc-${index}`} className="rounded-xl border border-slate-200 bg-white p-3 grid gap-2 sm:grid-cols-2">
            <EditField
              label="Title"
              value={row.title || ''}
              onChange={(v) => patchAccomplishmentEntry(index, { title: v })}
            />
            <EditField
              label="Category"
              value={row.category || ''}
              onChange={(v) => patchAccomplishmentEntry(index, { category: v })}
            />
            <EditField
              label="Organization"
              value={row.organization || ''}
              onChange={(v) => patchAccomplishmentEntry(index, { organization: v })}
            />
            <EditDateField
              label="Date"
              value={row.achievementDate || ''}
              outputIso
              onChange={(v) => patchAccomplishmentEntry(index, { achievementDate: v })}
            />
            <div className="sm:col-span-2">
              <EditField
                label="Description"
                value={row.description || ''}
                onChange={(v) => patchAccomplishmentEntry(index, { description: v })}
                multiline
              />
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

      <Phase1EditSection
        id="visa"
        title="Visa & work authorization"
        icon={Shield}
        open={open.visa}
        onToggle={toggle}
        count={visaEntries.length}
        {...sectionToggleProps}
        clientVisible={sectionVisible('visa')}
      >
        {visaEntries.map((row, index) => (
          <CandidateVisaWorkAuthorizationEntryEdit
            key={`visa-${index}`}
            candidateId={candidate.id}
            entry={row as Record<string, unknown>}
            index={index}
            onChange={patchVisaEntry}
          />
        ))}
        <button
          type="button"
          onClick={() => {
            const nextEntries = [
              ...visaEntries,
              normalizeVisaEntryRecord({ id: `visa-${Date.now()}`, isPrimary: visaEntries.length === 0 }),
            ];
            onChange({
              ...snapshot,
              visaWorkAuthorization: visaDisplayEntriesToSnapshot(
                nextEntries,
                snapshot.visaWorkAuthorization as Record<string, unknown> | null,
              ),
            });
          }}
          className="w-full rounded-xl border border-dashed border-violet-300 bg-violet-50/60 px-4 py-3 text-sm font-semibold text-violet-700 hover:bg-violet-50"
        >
          Add country authorization
        </button>
      </Phase1EditSection>

      <Phase1EditSection id="vaccination" title="Vaccination" icon={Syringe} open={open.vaccination} onToggle={toggle} {...sectionToggleProps} clientVisible={sectionVisible('vaccination')}>
        <CandidateVaccinationEntryEdit
          candidateId={candidate.id}
          entry={vaccinationRecord}
          birthDateMax={birthDateMax}
          onChange={patchVaccination}
        />
      </Phase1EditSection>
    </div>
  );
}
