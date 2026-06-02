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
import type { ClientReviewSection } from '@/lib/clientPresentationSections';
import { CLIENT_PRESENTATION_SECTION_LABELS } from '@/lib/clientPresentationSections';
import { PHASE1_CLIENT_SECTION_LABELS } from '@/lib/phase1ClientPresentationSections';
import {
  phase1EntryBodyClass,
  phase1EntryMetaClass,
  phase1EntryTitleClass,
  phase1FieldEmptyClass,
  phase1FieldLabelClass,
  phase1FieldValueClass,
  phase1SectionMetaClass,
  phase1SectionTitleClass,
} from '@/lib/phase1Typography';
import {
  formatWorkEntryHeadline,
  formatWorkEntryMeta,
  normalizeWorkEntryRecords,
  parseWorkEntriesFromUnknown,
  parseWorkExperienceDisplayText,
  parseWorkExperienceEditorValue,
  looksLikeWorkExperienceDisplayText,
  type CvWorkEntryLike,
} from '@/lib/candidateExperience';

function isUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

function display(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return String(value).trim();
}

function FieldRow({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  const text = display(value);
  const empty = !text;
  const link = href || (isUrl(text) ? text : '');

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white px-3 py-2.5">
      <p className={phase1FieldLabelClass}>{label}</p>
      {empty ? (
        <p className={`mt-1 ${phase1FieldEmptyClass}`}>Not in resume</p>
      ) : link ? (
        <a
          href={link}
          target="_blank"
          rel="noreferrer"
          className="mt-1 block break-all text-sm font-medium text-blue-700 hover:underline"
        >
          {text}
        </a>
      ) : (
        <p className={`mt-1 whitespace-pre-line break-words ${phase1FieldValueClass}`}>{text}</p>
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
  filled,
  total,
  extraHint,
  children,
}: {
  id: string;
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  open: boolean;
  onToggle: (key: string) => void;
  filled: number;
  total: number;
  extraHint?: string;
  children: React.ReactNode;
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
            <h3 className={phase1SectionTitleClass}>{title}</h3>
            <p className={phase1SectionMetaClass}>
              {extraHint ?? `${filled}/${total} fields captured`}
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

const SECTION_META: Record<
  string,
  { title: string; icon: React.ComponentType<{ size?: number; className?: string }> }
> = {
  personal: { title: 'Personal Information', icon: User },
  education: { title: 'Education', icon: GraduationCap },
  professional: { title: 'Career Preferences', icon: Briefcase },
  social: { title: 'Social Network Information', icon: Globe2 },
  summary: { title: 'Summary & Additional', icon: FileText },
  work: { title: 'Work Experience', icon: Briefcase },
  certifications: { title: 'Certifications', icon: Award },
  gap: { title: 'Gap Explanation', icon: Timer },
  academic: { title: 'Academic Achievements', icon: Medal },
  exams: { title: 'Competitive Exams', icon: Layers },
  projects: { title: 'Projects', icon: FileText },
  visa: { title: 'Visa & Work Authorization', icon: Shield },
  vaccination: { title: 'Vaccination', icon: Syringe },
};

function resolveSectionTitle(id: string, fallback?: string): string {
  return (
    SECTION_META[id]?.title ||
    CLIENT_PRESENTATION_SECTION_LABELS[id as keyof typeof CLIENT_PRESENTATION_SECTION_LABELS] ||
    PHASE1_CLIENT_SECTION_LABELS[id as keyof typeof PHASE1_CLIENT_SECTION_LABELS] ||
    fallback ||
    id
  );
}

function mergeSectionsById(sections: ClientReviewSection[]): ClientReviewSection[] {
  const map = new Map<string, ClientReviewSection>();
  for (const section of sections) {
    const existing = map.get(section.id);
    if (!existing) {
      map.set(section.id, {
        id: section.id,
        title: resolveSectionTitle(section.id, section.title),
        fields: [...section.fields],
        entries: section.entries ? [...section.entries] : undefined,
      });
      continue;
    }
    existing.fields.push(...section.fields);
    if (section.entries?.length) {
      existing.entries = [...(existing.entries || []), ...section.entries];
    }
  }
  return Array.from(map.values());
}

/** Legacy flat Phase 1 work fields → grouped entries (older submit snapshots). */
function groupWorkFieldsFromFlat(fields: Array<{ label: string; value: string }>): Record<string, unknown>[] {
  const map = new Map<string, Record<string, unknown>>();
  for (const row of fields) {
    const match = row.label.match(/^(.+?) — (Job title|Company|Location|Start date|End date|Period|Responsibilities)$/i);
    if (!match) continue;
    const header = match[1].trim();
    const prop = match[2].trim().toLowerCase();
    if (!map.has(header)) {
      const atParts = header.split(' @ ').map((part) => part.trim());
      map.set(header, {
        title: atParts[0] || header,
        company: atParts[1] || '',
      });
    }
    const entry = map.get(header)!;
    if (prop === 'job title') entry.title = row.value;
    else if (prop === 'company') entry.company = row.value;
    else if (prop === 'location') entry.location = row.value;
    else if (prop === 'start date') entry.startDate = row.value;
    else if (prop === 'end date') entry.endDate = row.value;
    else if (prop === 'responsibilities') {
      entry.responsibilities = row.value.split(';').map((line) => line.trim()).filter(Boolean);
    }
  }
  return Array.from(map.values()).filter(
    (entry) => display(entry.title) || display(entry.company),
  );
}

function parseWorkFromSectionFields(
  fields: Array<{ label: string; value: string }>,
): Record<string, unknown>[] {
  for (const row of fields) {
    if (!/work experience/i.test(row.label)) continue;
    const fromUnknown = parseWorkEntriesFromUnknown(row.value);
    if (fromUnknown.length) return fromUnknown;
    const fromEditor = parseWorkExperienceEditorValue(row.value);
    if (fromEditor.length) return fromEditor as Record<string, unknown>[];
    if (looksLikeWorkExperienceDisplayText(row.value)) {
      return parseWorkExperienceDisplayText(row.value) as Record<string, unknown>[];
    }
  }
  return [];
}

function resolveWorkEntries(section: ClientReviewSection): Record<string, unknown>[] {
  if (section.entries?.length && (section.id === 'work' || section.id === 'professional')) {
    return normalizeWorkEntryRecords(section.entries);
  }
  if (section.id === 'work') {
    const fromFlat = groupWorkFieldsFromFlat(section.fields);
    if (fromFlat.length) return fromFlat;
    const fromText = parseWorkFromSectionFields(section.fields);
    if (fromText.length) return fromText;
  }
  if (section.id === 'professional') {
    return groupWorkFieldsFromFlat(section.fields);
  }
  return [];
}

function entryHasData(entry: Record<string, unknown>): boolean {
  return Object.values(entry).some((value) => {
    if (Array.isArray(value)) return value.some((item) => display(item));
    return Boolean(display(value));
  });
}

function isLongFormField(label: string, value: string): boolean {
  if (value.length > 160) return true;
  return /summary|details|description|history|notes|responsibilities|activities|volunteers|remarks/i.test(
    label,
  );
}

function tryParseJsonArray(value: string): Record<string, unknown>[] | null {
  if (!value.startsWith('[') && !value.startsWith('{')) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((item) => item && typeof item === 'object') as Record<string, unknown>[];
    }
    return null;
  } catch {
    return null;
  }
}

function WorkEntryCard({ entry, index }: { entry: Record<string, unknown>; index: number }) {
  const cvEntry: CvWorkEntryLike = {
    title: display(entry.title || entry.jobTitle),
    company: display(entry.company || entry.companyName),
    location: display(entry.location || entry.workLocation),
    startDate: display(entry.startDate),
    endDate: display(entry.endDate),
    responsibilities: Array.isArray(entry.responsibilities)
      ? (entry.responsibilities as string[]).filter((line) => String(line || '').trim())
      : display(entry.description)
        ? [display(entry.description)]
        : [],
  };
  const meta = formatWorkEntryMeta(cvEntry);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
      <p className={phase1EntryTitleClass}>{formatWorkEntryHeadline(cvEntry, index)}</p>
      {meta ? <p className={`mt-0.5 ${phase1EntryMetaClass}`}>{meta}</p> : null}
      {(cvEntry.responsibilities?.length ?? 0) > 0 ? (
        <ul className={`mt-2.5 list-inside list-disc space-y-1 ${phase1EntryBodyClass}`}>
          {cvEntry.responsibilities!.slice(0, 8).map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function EducationEntryCard({ entry, index }: { entry: Record<string, unknown>; index: number }) {
  const qual = display(entry.degreeProgram || entry.degree || entry.qualification);
  const inst = display(entry.institutionName || entry.institution || entry.instituteName);
  const title =
    [qual, inst].filter(Boolean).join(' — ') || `Education ${index + 1}`;
  const dates = [entry.startYear, entry.endYear].map((part) => display(part)).filter(Boolean).join(' – ');
  const grade = display(entry.grade);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <p className={phase1EntryTitleClass}>{title}</p>
      {dates || grade ? (
        <p className={`mt-1 ${phase1EntryMetaClass}`}>
          {[dates, grade ? `Grade ${grade}` : ''].filter(Boolean).join(' · ')}
        </p>
      ) : null}
      {display(entry.educationLevel) ? (
        <p className="mt-1 text-sm text-slate-600">Level: {display(entry.educationLevel)}</p>
      ) : null}
      {display(entry.fieldOfStudy || entry.field) ? (
        <p className="mt-0.5 text-sm text-slate-600">Field: {display(entry.fieldOfStudy || entry.field)}</p>
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
  const visibleRows = rows.filter((row) => display(row.value));
  if (!visibleRows.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <p className={phase1EntryTitleClass}>{title}</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {visibleRows.map((row) => (
          <FieldRow key={row.label} label={row.label} value={display(row.value)} />
        ))}
      </div>
    </div>
  );
}

function renderEntryCards(section: ClientReviewSection): React.ReactNode {
  const workEntries =
    section.id === 'work' || section.id === 'professional' ? resolveWorkEntries(section) : [];
  const entries =
    workEntries.length > 0
      ? workEntries
      : section.entries?.length
        ? section.entries
        : [];

  if (!entries.length) {
    if (section.fields.length === 1 && section.fields[0]?.value === 'No entries provided') {
      return <p className="text-sm italic text-slate-400">Not provided</p>;
    }
    return null;
  }

  if (section.id === 'work' || section.id === 'professional') {
    return (
      <div className="space-y-2">
        {entries.map((entry, index) => (
          <WorkEntryCard key={`work-${index}`} entry={entry} index={index} />
        ))}
      </div>
    );
  }

  if (section.id === 'education') {
    return (
      <div className="space-y-2">
        {entries.map((entry, index) => (
          <EducationEntryCard key={`edu-${index}`} entry={entry} index={index} />
        ))}
      </div>
    );
  }

  if (section.id === 'certifications') {
    return (
      <div className="space-y-2">
        {entries.map((cert, index) => (
          <RecordCard
            key={`cert-${index}`}
            title={display(cert.certificationName) || `Certification ${index + 1}`}
            rows={[
              { label: 'Issuing organization', value: cert.issuingOrganization },
              { label: 'Issue date', value: cert.issueDate },
              { label: 'Expiry date', value: cert.expiryDate },
            ]}
          />
        ))}
      </div>
    );
  }

  if (section.id === 'gap') {
    return (
      <div className="space-y-2">
        {entries.map((gap, index) => (
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
        ))}
      </div>
    );
  }

  if (section.id === 'academic') {
    return (
      <div className="space-y-2">
        {entries.map((row, index) => (
          <RecordCard
            key={`academic-${index}`}
            title={display(row.achievementTitle) || `Achievement ${index + 1}`}
            rows={[
              { label: 'Awarded by', value: row.awardedBy },
              { label: 'Year', value: row.yearReceived },
              { label: 'Category', value: row.categoryType },
              { label: 'Description', value: row.description },
            ]}
          />
        ))}
      </div>
    );
  }

  if (section.id === 'exams') {
    return (
      <div className="space-y-2">
        {entries.map((exam, index) => (
          <RecordCard
            key={`exam-${index}`}
            title={display(exam.examName) || `Exam ${index + 1}`}
            rows={[
              { label: 'Year', value: exam.yearTaken },
              { label: 'Result', value: exam.resultStatus },
              { label: 'Score', value: exam.scoreMarks },
              { label: 'Valid until', value: exam.validUntil },
              { label: 'Notes', value: exam.additionalNotes },
            ]}
          />
        ))}
      </div>
    );
  }

  if (section.id === 'projects') {
    return (
      <div className="space-y-2">
        {entries.map((project, index) => (
          <RecordCard
            key={`project-${index}`}
            title={display(project.projectTitle) || `Project ${index + 1}`}
            rows={[
              { label: 'Type', value: project.projectType },
              { label: 'Organization', value: project.organizationClient },
              {
                label: 'Period',
                value: [project.startDate, project.endDate].filter(Boolean).join(' – '),
              },
              { label: 'Description', value: project.projectDescription },
              { label: 'Link', value: project.projectLink },
            ]}
          />
        ))}
      </div>
    );
  }

  return null;
}

function renderStructuredField(label: string, value: string) {
  if (/work experience/i.test(label)) {
    const workEntries = parseWorkEntriesFromUnknown(value);
    if (workEntries.length) {
      return (
        <div className="space-y-2">
          {workEntries.map((entry, index) => (
            <WorkEntryCard key={`work-${index}`} entry={entry} index={index} />
          ))}
        </div>
      );
    }
    return null;
  }

  const parsed = tryParseJsonArray(value);
  if (!parsed?.length) return null;

  if (/education entries/i.test(label)) {
    return (
      <div className="space-y-2">
        {parsed.map((entry, index) => (
          <EducationEntryCard key={`edu-${index}`} entry={entry} index={index} />
        ))}
      </div>
    );
  }

  return null;
}

type Props = {
  sections: ClientReviewSection[];
  jobTitle?: string;
  clientName?: string;
  defaultOpen?: boolean;
  showMeta?: boolean;
};

export function ClientReviewSectionsPanel({
  sections,
  jobTitle,
  clientName,
  defaultOpen = true,
  showMeta = true,
}: Props) {
  const mergedSections = useMemo(() => mergeSectionsById(sections), [sections]);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const isOpen = (id: string) => openSections[id] ?? defaultOpen;
  const toggle = (id: string) => {
    setOpenSections((current) => ({ ...current, [id]: !isOpen(id) }));
  };

  if (!mergedSections.length) return null;

  return (
    <div className="space-y-4">
      {(jobTitle || clientName) && showMeta ? (
        <div className="flex flex-wrap gap-2">
          {jobTitle ? (
            <span className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-800">
              Assigned Job: {jobTitle}
            </span>
          ) : null}
          {clientName ? (
            <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
              Client: {clientName}
            </span>
          ) : null}
        </div>
      ) : null}

      {mergedSections.map((section) => {
        const meta = SECTION_META[section.id] || { title: section.title, icon: FileText };
        const workEntries = resolveWorkEntries(section);
        const entryList =
          workEntries.length > 0 ? workEntries : section.entries?.length ? section.entries : [];
        const entryCards = renderEntryCards(section);
        const structuredRows: React.ReactNode[] = [];
        const scalarFields: Array<{ label: string; value: string }> = [];

        for (const row of section.fields) {
          if (row.value === 'No entries provided') continue;
          const structured = renderStructuredField(row.label, row.value);
          if (structured) {
            structuredRows.push(
              <div key={`${section.id}-${row.label}-structured`}>{structured}</div>,
            );
          } else if (
            entryList.length > 0 &&
            (section.id === 'work' || section.id === 'professional') &&
            (/work experience/i.test(row.label) || looksLikeWorkExperienceDisplayText(row.value))
          ) {
            continue;
          } else if (
            entryList.length > 0 &&
            section.id === 'work' &&
            / — (Job title|Company|Location|Start date|End date|Period|Responsibilities)$/i.test(row.label)
          ) {
            continue;
          } else {
            scalarFields.push(row);
          }
        }

        const entryCount = entryList.length;
        const filled =
          entryCount > 0
            ? entryList.filter((entry) => entryHasData(entry)).length
            : scalarFields.filter((row) => display(row.value)).length;
        const total = entryCount > 0 ? entryCount : scalarFields.length || 1;
        const subtitle =
          entryCount > 0 && section.id === 'work'
            ? `${filled}/${total} fields captured · ${entryCount} ${entryCount === 1 ? 'entry' : 'entries'}`
            : entryCount > 0
              ? `${entryCount} ${entryCount === 1 ? 'entry' : 'entries'}`
              : `${filled}/${total} fields captured`;

        return (
          <SectionBlock
            key={section.id}
            id={section.id}
            title={meta.title || section.title}
            icon={meta.icon}
            open={isOpen(section.id)}
            onToggle={toggle}
            filled={filled}
            total={total}
            extraHint={subtitle}
          >
            {entryCards}
            {structuredRows}
            {scalarFields.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {scalarFields.map((row) => {
                  const longForm = isLongFormField(row.label, row.value);
                  return (
                    <div
                      key={`${section.id}-${row.label}`}
                      className={longForm ? 'sm:col-span-2' : undefined}
                    >
                      <FieldRow label={row.label} value={row.value} />
                    </div>
                  );
                })}
              </div>
            ) : !entryCards && !structuredRows.length ? (
              <p className={phase1FieldEmptyClass}>Not provided</p>
            ) : null}
          </SectionBlock>
        );
      })}
    </div>
  );
}
