'use client';

import React, { useMemo, useState } from 'react';
import {
  Award,
  Briefcase,
  ChevronDown,
  FileText,
  GraduationCap,
  Globe2,
  Layers,
  Medal,
  Shield,
  Syringe,
  Timer,
  User,
} from 'lucide-react';
import type { CandidateProfileDrawerData } from '../drawers/CandidateProfileDrawer';
import {
  formatWorkEntryHeadline,
  formatWorkEntryMeta,
  type CvWorkEntryLike,
} from '@/lib/candidateExperience';
import { getPhase1ProfileSnapshot, type Phase1ProfileSnapshot } from '@/lib/phase1ProfileSnapshot';
import type { Phase1ClientSectionId, Phase1ClientSectionVisibility } from '@/lib/phase1ClientPresentationSections';

type SectionId =
  | 'personal'
  | 'education'
  | 'work'
  | 'certifications'
  | 'gap'
  | 'academic'
  | 'exams'
  | 'projects'
  | 'visa'
  | 'vaccination'
  | 'summary';

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
  return work.map((w) => ({
    title: (w.jobTitle as string) || (w.title as string) || '',
    company: (w.company as string) || (w.companyName as string) || '',
    location: (w.workLocation as string) || (w.location as string) || '',
    startDate: (w.startDate as string) || '',
    endDate: (w.endDate as string) || '',
    responsibilities: Array.isArray(w.responsibilities)
      ? (w.responsibilities as string[])
      : w.description
        ? [String(w.description)]
        : [],
  }));
}

function WorkCard({ entry, index }: { entry: CvWorkEntryLike; index: number }) {
  const headline = formatWorkEntryHeadline(entry, index).replace(/^\[\d+\]\s*/, '');
  const meta = formatWorkEntryMeta(entry);
  const bullets = Array.isArray(entry.responsibilities) ? entry.responsibilities : [];
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-sm font-semibold text-slate-900">{headline}</p>
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
  const hasAny = rows.some((r) => display(r.value));
  if (!hasAny) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {rows.map((row) =>
          display(row.value) ? <FieldRow key={row.label} label={row.label} value={row.value} /> : null
        )}
      </div>
    </div>
  );
}

type Props = {
  candidate: CandidateProfileDrawerData;
  /** When set (Client tab saved copy), sections marked false are omitted. */
  sectionVisibility?: Partial<Phase1ClientSectionVisibility> | null;
};

export function CandidatePhase1DetailSections({ candidate, sectionVisibility }: Props) {
  const snap = useMemo(
    () => getPhase1ProfileSnapshot(candidate.extraData),
    [candidate.extraData]
  );

  const [open, setOpen] = useState<Record<SectionId, boolean>>({
    personal: true,
    summary: true,
    education: true,
    work: true,
    certifications: true,
    gap: true,
    academic: true,
    exams: true,
    projects: true,
    visa: true,
    vaccination: true,
  });

  const toggle = (key: SectionId) => {
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const sectionVisible = (id: Phase1ClientSectionId) => sectionVisibility?.[id] !== false;

  const workEntries = useMemo(() => {
    const fromSnap = mapWorkFromSnapshot(snap?.workExperience);
    if (fromSnap.length) return fromSnap;
    return (candidate.cvWorkExperienceEntries || []) as CvWorkEntryLike[];
  }, [snap?.workExperience, candidate.cvWorkExperienceEntries]);

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
      { label: 'Email', value: pi.email || candidate.email },
      { label: 'Mobile', value: phone },
      { label: 'Date of birth', value: pi.dob },
      { label: 'Gender', value: pi.gender },
      { label: 'Nationality', value: pi.nationality },
      { label: 'Current address', value: pi.address || candidate.cvAddress },
      { label: 'City & country', value: cityStateCountry || candidate.location },
      { label: 'Employment status', value: pi.employment },
      { label: 'Passport number', value: pi.passportNumber },
      {
        label: 'LinkedIn',
        value: pi.linkedinUrl || candidate.linkedIn,
      },
    ];
  }, [snap, candidate]);

  const hasPersonInfo = personInfoRows.some((row) => display(row.value));

  if (!snap && !workEntries.length && !eduEntries.length && !hasPersonInfo) {
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
      <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-violet-800">Phase 1 candidate</p>
        <p className="mt-1 text-sm text-violet-950/80">
          Sections below are loaded from the Phase 1 job portal profile (person information, education,
          experience, certifications, and compliance fields).
        </p>
      </div>

      {sectionVisible('personal') ? (
      <Phase1Section
        id="personal"
        title="Person information"
        icon={User}
        open={open.personal}
        onToggle={toggle}
      >
        {hasPersonInfo ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {personInfoRows.map((row) => (
              <FieldRow key={row.label} label={row.label} value={row.value} />
            ))}
          </div>
        ) : (
          <p className="text-sm italic text-slate-400">Not provided</p>
        )}
      </Phase1Section>
      ) : null}

      {summaryText && sectionVisible('summary') ? (
        <Phase1Section
          id="summary"
          title="Professional summary"
          icon={FileText}
          open={open.summary}
          onToggle={toggle}
        >
          <p className="whitespace-pre-line rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800">
            {summaryText}
          </p>
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
          <p className="text-sm italic text-slate-400">Not provided</p>
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
          <p className="text-sm italic text-slate-400">Not provided</p>
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
          <p className="text-sm italic text-slate-400">Not provided</p>
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
          <p className="text-sm italic text-slate-400">Not provided</p>
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
                { label: 'Visa / work permit required', value: snap.visaWorkAuthorization.visaWorkpermitRequired },
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
                  )
                )}
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-sm italic text-slate-400">Not provided</p>
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
          <p className="text-sm italic text-slate-400">Not provided</p>
        )}
      </Phase1Section>
      ) : null}
    </div>
  );
}
