'use client';

import React, { useEffect, useMemo, useState } from 'react';
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
import { DrawerLinkActions, looksLikeHttpUrl } from '../drawers/DrawerLinkActions';
import { DrawerTabBar } from '../drawers/DrawerTabBar';
import { DRAWER_FORM_SCROLL_BG } from '../drawers/drawerFormUi';
import { isClientReviewFileHref } from '../../lib/clientReviewAssets';
import { CLIENT_PRESENTATION_SECTION_LABELS, type ClientReviewSection } from '@/lib/clientPresentationSections';
import { PHASE1_CLIENT_SECTION_LABELS } from '@/lib/phase1ClientPresentationSections';
import {
  isSubmitToClientReviewFieldVisible,
  parseSubmitToClientFieldVisibility,
  phase1SectionVisibilityFromSubmitFields,
  sectionVisibilityFromSubmitFields,
  SUBMIT_TO_CLIENT_FIELD_GROUPS,
  SUBMIT_TO_CLIENT_REVIEW_LABEL_FIELDS,
  type SubmitToClientFieldId,
} from '@/lib/submitToClientFieldVisibility';
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
import { CandidateCertificationEntryView } from './CandidateCertificationEntryView';
import { CandidateVisaWorkAuthorizationEntryView } from './CandidateVisaWorkAuthorizationEntryView';
import { CandidateVaccinationEntryView } from './CandidateVaccinationEntryView';
import { ageFromBirthDate } from '@/lib/clientReviewFieldFallbacks';

function isUrl(value: string): boolean {
  const raw = value.trim();
  return /^https?:\/\//i.test(raw) || isClientReviewFileHref(raw);
}

function isInternalResumeStorageUrl(value: string): boolean {
  return /hryantra-bucket\.s3|amazonaws\.com\/uploads\/|\/uploads\/(phase\d+|tenants)\//i.test(
    String(value || ''),
  );
}

function shouldHideClientReviewField(label: string, value: string): boolean {
  const key = String(label || '').trim().toLowerCase();
  if (key === 'resume url' || key === 'file url') return true;
  if (key.includes('url') && isInternalResumeStorageUrl(value)) return true;
  return false;
}

function display(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (Array.isArray(value)) {
    return value
      .map((item) => display(item))
      .filter(Boolean)
      .join(', ');
  }
  const raw = String(value).trim();
  if (!raw || raw === 'No entries provided' || raw === '[]' || raw === '{}') return '';
  if ((raw.startsWith('[') && raw.endsWith(']')) || (raw.startsWith('{') && raw.endsWith('}'))) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => display(item))
          .filter(Boolean)
          .join(', ');
      }
    } catch {
      /* keep raw */
    }
  }
  return raw;
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

  const valueNode = empty ? (
    <p className={phase1FieldEmptyClass}>Not provided</p>
  ) : link && (isInternalResumeStorageUrl(link) || isClientReviewFileHref(link)) ? (
    <a
      href={link}
      target="_blank"
      rel="noreferrer"
      className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
    >
      Open resume
    </a>
  ) : link && looksLikeHttpUrl(link) ? (
    <DrawerLinkActions url={link} shareTitle={label} />
  ) : (
    <p className={`whitespace-pre-line break-words ${phase1FieldValueClass}`}>{text}</p>
  );

  return (
    <div className="grid gap-1 border-b border-slate-100/90 py-2.5 last:border-b-0 sm:grid-cols-[minmax(10rem,28%)_1fr] sm:gap-6 lg:grid-cols-[minmax(12rem,24%)_1fr] lg:gap-8">
      <p className={`${phase1FieldLabelClass} sm:pt-0.5`}>{label}</p>
      <div className="min-w-0">{valueNode}</div>
    </div>
  );
}

const PHASE1_SECTION_FIELD_IDS: Record<string, SubmitToClientFieldId> = {
  resume: 'p1Resume',
  internships: 'p1Internships',
  gap: 'p1Gap',
  academic: 'p1Academic',
  exams: 'p1Exams',
  accomplishments: 'p1Accomplishments',
  visa: 'p1Visa',
  vaccination: 'p1Vaccination',
  certifications: 'certifications',
  projects: 'projects',
  portfolio: 'cvPortfolioLinks',
  skills: 'skills',
  languages: 'languageProficiency',
};

const PHASE1_EMPTY_SHELL_IDS = new Set([
  'resume',
  'internships',
  'gap',
  'academic',
  'exams',
  'accomplishments',
  'visa',
  'vaccination',
]);

const SECTION_GROUP_ID: Record<string, string> = {
  personal: 'personal',
  education: 'education',
  professional: 'professional',
  careerPreferences: 'professional',
  work: 'work',
  social: 'social',
  summary: 'summary',
};

function isFieldIdVisible(
  fieldId: SubmitToClientFieldId,
  visibleFields: Record<string, boolean> | null | undefined,
): boolean {
  if (!visibleFields) return true;
  const parsed = parseSubmitToClientFieldVisibility(visibleFields);
  return parsed[fieldId] !== false;
}

function findExistingFieldValue(
  fields: Array<{ label: string; value: string }>,
  fieldId: SubmitToClientFieldId,
  preferredLabel: string,
): string {
  const preferredKey = preferredLabel.trim().toLowerCase();
  let fallback = '';
  for (const row of fields) {
    const labelKey = String(row.label || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
    const value = display(row.value);
    if (labelKey === preferredKey && value) return value;
    const mapped = SUBMIT_TO_CLIENT_REVIEW_LABEL_FIELDS[labelKey];
    if (mapped?.length === 1 && mapped[0] === fieldId && value) return value;
    if (mapped?.includes(fieldId) && mapped.length === 1 && value) return value;
    if (!fallback && labelKey === preferredKey) fallback = value;
  }
  return fallback;
}

function reviewFieldDedupeKey(label: string): string {
  const key = String(label || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/ \(extra\)$/, '');
  if (key === 'current role') return 'current designation';
  if (key === 'preferred locations') return 'preferred location';
  if (key === 'portfolio url') return 'portfolio / project links';
  if (key === 'salary expectation') return 'expected salary';
  return key;
}

function dedupeReviewFields(fields: Array<{ label: string; value: string }>) {
  const seen = new Set<string>();
  const next: Array<{ label: string; value: string }> = [];
  for (const row of fields || []) {
    const key = reviewFieldDedupeKey(row.label);
    if (
      !key ||
      key === 'name' ||
      key === 'full name' ||
      key === 'name of candidate' ||
      key === 'city & state' ||
      key === 'salary expectation' ||
      key === 'location (display)' ||
      seen.has(key)
    ) {
      continue;
    }
    seen.add(key);
    next.push(row);
  }
  return next;
}

/** Ensure every tenant-visible field appears in the section (empty → Not provided). */
function expandSectionForVisibleFields(
  section: ClientReviewSection,
  visibleFields: Record<string, boolean> | null | undefined,
  omitFieldIds: SubmitToClientFieldId[] = [],
  fallbackValues: Partial<Record<SubmitToClientFieldId, string>> = {},
): ClientReviewSection {
  const groupId = SECTION_GROUP_ID[section.id];
  const group = groupId
    ? SUBMIT_TO_CLIENT_FIELD_GROUPS.find((item) => item.id === groupId)
    : null;
  const omitted = new Set(omitFieldIds);

  if (group) {
    const nextFields = group.fields
      .filter((field) => isFieldIdVisible(field.id, visibleFields) && !omitted.has(field.id))
      .map((field) => ({
        id: field.id,
        label: field.label,
        value:
          findExistingFieldValue(section.fields || [], field.id, field.label) ||
          String(fallbackValues[field.id] || ''),
      }));

    const ageField = nextFields.find((field) => field.id === 'age');
    if (ageField && !String(ageField.value || '').trim()) {
      const birthValue =
        nextFields.find((field) => field.id === 'birthDate')?.value ||
        fallbackValues.birthDate ||
        findExistingFieldValue(section.fields || [], 'birthDate', 'Birth Date');
      ageField.value = ageFromBirthDate(birthValue);
    }

    const entryFields =
      section.id === 'work'
        ? (['cvWorkExperienceEntries'] as SubmitToClientFieldId[])
        : section.id === 'education'
          ? (['cvEducationEntries'] as SubmitToClientFieldId[])
          : null;
    const entriesAllowed =
      !entryFields || entryFields.some((id) => isFieldIdVisible(id, visibleFields));

    return {
      ...section,
      fields: nextFields.map(({ label, value }) => ({ label, value })),
      entries: entriesAllowed ? section.entries : undefined,
    };
  }

  // Phase 1 / leftover sections: keep entries, replace placeholder-only fields with a clear empty row.
  const phase1FieldId = PHASE1_SECTION_FIELD_IDS[section.id];
  if (phase1FieldId && !isFieldIdVisible(phase1FieldId, visibleFields)) {
    return { ...section, fields: [], entries: undefined };
  }

  const hasEntries = Array.isArray(section.entries) && section.entries.length > 0;
  const cleanedFields = (section.fields || [])
    .filter((row) => {
      if (shouldHideClientReviewField(row.label, row.value)) return false;
      if (row.value === 'No entries provided') return false;
      if (phase1FieldId) return isFieldIdVisible(phase1FieldId, visibleFields);
      if (visibleFields && !isSubmitToClientReviewFieldVisible(row.label, visibleFields, section.id)) {
        return false;
      }
      return true;
    })
    .map((row) => ({ label: row.label, value: display(row.value) }));

  if (!cleanedFields.length && !hasEntries) {
    // Settings-hidden sections stay empty — do not invent a placeholder row that re-shows them.
    if (visibleFields && phase1FieldId && !isFieldIdVisible(phase1FieldId, visibleFields)) {
      return { ...section, fields: [], entries: undefined };
    }
    if (visibleFields) {
      return { ...section, fields: [], entries: undefined };
    }
    return {
      ...section,
      fields: [{ label: resolveSectionTitle(section.id, section.title), value: '' }],
      entries: section.entries,
    };
  }

  return { ...section, fields: cleanedFields, entries: section.entries };
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
    <section className="border-b border-slate-100 last:border-b-0">
      <button
        type="button"
        onClick={() => onToggle(id)}
        className={`flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition ${
          open ? 'bg-indigo-50/40' : 'bg-white hover:bg-slate-50/80'
        }`}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
              open ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-600'
            }`}
          >
            <Icon size={16} />
          </span>
          <div className="min-w-0">
            <h3 className={phase1SectionTitleClass}>{title}</h3>
            <p className={phase1SectionMetaClass}>
              {extraHint ?? `${filled}/${total} fields captured`}
            </p>
          </div>
        </div>
        <ChevronDown
          size={18}
          className={`shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180 text-indigo-500' : ''}`}
        />
      </button>
      {open ? (
        <div className="space-y-3 bg-slate-50/70 px-4 pb-4 pt-1">{children}</div>
      ) : null}
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
        fields: dedupeReviewFields([...section.fields]),
        entries: section.entries ? [...section.entries] : undefined,
      });
      continue;
    }
    existing.fields = dedupeReviewFields([...existing.fields, ...section.fields]);
    if (section.entries?.length) {
      const combined = [...(existing.entries || []), ...section.entries];
      const seen = new Set<string>();
      existing.entries = combined.filter((entry) => {
        let signature = '';
        try {
          signature = JSON.stringify(entry);
        } catch {
          signature = display(entry);
        }
        if (!signature || seen.has(signature)) return false;
        seen.add(signature);
        return true;
      });
    }
  }

  const professional = map.get('professional');
  const prefs = map.get('careerPreferences');
  const personalEarly = map.get('personal');
  if (professional && prefs) {
    const mappedPrefs: Array<{ label: string; value: string }> = [];
    for (const row of prefs.fields) {
      const key = reviewFieldDedupeKey(row.label);
      if (key === 'preferred location') {
        if (personalEarly) {
          const exists = personalEarly.fields.some(
            (field) => reviewFieldDedupeKey(field.label) === 'preferred location',
          );
          if (!exists) personalEarly.fields.push({ label: 'Preferred Location', value: row.value });
          else {
            personalEarly.fields = personalEarly.fields.map((field) =>
              reviewFieldDedupeKey(field.label) === 'preferred location' && !display(field.value)
                ? { ...field, value: row.value }
                : field,
            );
          }
        }
        continue;
      }
      if (key === 'expected salary') {
        mappedPrefs.push({ label: 'Expected Salary', value: row.value });
        continue;
      }
      if (key === 'current designation') {
        mappedPrefs.push({ label: 'Current Designation', value: row.value });
        continue;
      }
      mappedPrefs.push(row);
    }
    professional.fields = dedupeReviewFields([...professional.fields, ...mappedPrefs]);
    map.delete('careerPreferences');
  } else if (prefs && !professional) {
    map.set('professional', { ...prefs, id: 'professional', title: resolveSectionTitle('professional') });
    map.delete('careerPreferences');
  }

  const personal = map.get('personal');
  const social = map.get('social');
  if (personal) {
    const linkedIn = personal.fields.find((row) => reviewFieldDedupeKey(row.label) === 'linkedin');
    if (linkedIn && display(linkedIn.value) && social) {
      const exists = social.fields.some((row) => reviewFieldDedupeKey(row.label) === 'linkedin');
      if (!exists) social.fields.push({ label: 'LinkedIn', value: linkedIn.value });
      else {
        social.fields = social.fields.map((row) =>
          reviewFieldDedupeKey(row.label) === 'linkedin' && !display(row.value)
            ? { ...row, value: linkedIn.value }
            : row,
        );
      }
    }
    personal.fields = personal.fields.filter((row) => reviewFieldDedupeKey(row.label) !== 'linkedin');
  }

  const foldInto = (
    fromId: string,
    targetId: string,
    targetLabel: string,
  ) => {
    const from = map.get(fromId);
    const target = map.get(targetId);
    if (!from || !target) {
      if (from && !target) return;
      return;
    }
    const fromText = (from.fields || [])
      .map((row) => display(row.value))
      .filter(Boolean)
      .join(', ');
    if (fromText) {
      const exists = target.fields.some(
        (row) => reviewFieldDedupeKey(row.label) === reviewFieldDedupeKey(targetLabel),
      );
      if (!exists) target.fields.push({ label: targetLabel, value: fromText });
      else {
        target.fields = target.fields.map((row) =>
          reviewFieldDedupeKey(row.label) === reviewFieldDedupeKey(targetLabel) && !display(row.value)
            ? { ...row, value: fromText }
            : row,
        );
      }
    }
    map.delete(fromId);
  };

  foldInto('skills', 'summary', 'Skills');
  foldInto('languages', 'summary', 'Language & proficiency');
  foldInto('portfolio', 'social', 'Portfolio / project links');

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
    <div className="rounded-2xl bg-white px-3.5 py-3 ring-1 ring-slate-100">
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
          <CandidateCertificationEntryView key={`cert-${index}`} entry={cert} index={index} />
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

  if (section.id === 'visa') {
    return (
      <div className="space-y-2">
        {entries.map((entry, index) => (
          <CandidateVisaWorkAuthorizationEntryView key={`visa-${index}`} entry={entry} index={index} />
        ))}
      </div>
    );
  }

  if (section.id === 'vaccination') {
    return (
      <div className="space-y-2">
        {entries.map((entry, index) => (
          <CandidateVaccinationEntryView key={`vaccination-${index}`} entry={entry} />
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

type ExtraTab = {
  id: string;
  label: string;
  content: React.ReactNode;
};

type Props = {
  sections: ClientReviewSection[];
  jobTitle?: string;
  clientName?: string;
  defaultOpen?: boolean;
  showMeta?: boolean;
  hideLinkedIn?: boolean;
  hideInternalNotes?: boolean;
  hideResumeLinks?: boolean;
  /** Accordion (legacy) or horizontal tabs (client review full page). */
  mode?: 'accordion' | 'tabs';
  /** Extra tabs such as CV / Actions — only rendered when provided. */
  extraTabs?: ExtraTab[];
  /** Tenant Submit-to-Client field visibility — drives which tabs appear. */
  visibleFields?: Record<string, boolean> | null;
  /** Table/candidate values used to fill empty drawer fields (e.g. match score). */
  fieldFallbacks?: Partial<Record<SubmitToClientFieldId, string>>;
};

function omitFieldIdsForSections(
  sections: ClientReviewSection[],
): Record<string, SubmitToClientFieldId[]> {
  const omit: Record<string, SubmitToClientFieldId[]> = {};
  const skip: SubmitToClientFieldId[] = [];
  const cert = sections.find((section) => section.id === 'certifications');
  const projects = sections.find((section) => section.id === 'projects');
  const hasData = (section?: ClientReviewSection) =>
    Boolean(
      section &&
        ((Array.isArray(section.entries) && section.entries.length > 0) ||
          (section.fields || []).some((row) => display(row.value))),
    );
  if (hasData(cert)) skip.push('certifications');
  if (hasData(projects)) skip.push('projects');
  if (skip.length) omit.summary = skip;
  return omit;
}

function emptySection(id: string, title: string): ClientReviewSection {
  return { id, title, fields: [] };
}

function sectionLooksPlaceholderOnly(section: ClientReviewSection): boolean {
  const fields = section.fields || [];
  const entries = section.entries || [];
  if (entries.some((entry) => entryHasData(entry))) return false;
  if (!fields.length) return true;
  return fields.every((row) => {
    const value = display(row.value);
    return !value || value === 'No entries provided';
  });
}

const PHASE1_EXTRA_IDS = new Set([
  'gap',
  'academic',
  'exams',
  'visa',
  'vaccination',
  'internships',
  'resume',
  'accomplishments',
]);

const TAB_ORDER: Array<{ id: string; label: string; sectionIds: string[] }> = [
  { id: 'personal', label: 'Personal Information', sectionIds: ['personal'] },
  { id: 'education', label: 'Education', sectionIds: ['education'] },
  { id: 'professional', label: 'Career Preferences', sectionIds: ['professional'] },
  { id: 'work', label: 'Work Experience', sectionIds: ['work'] },
  { id: 'social', label: 'Social Network Information', sectionIds: ['social'] },
  {
    id: 'summary',
    label: 'Summary & Additional',
    sectionIds: ['summary', 'certifications', 'projects'],
  },
  {
    id: 'phase1',
    label: 'Other',
    sectionIds: [...PHASE1_EXTRA_IDS],
  },
];

function sectionHasVisibleContent(
  section: ClientReviewSection,
  opts: { hideLinkedIn: boolean; hideInternalNotes: boolean; hideResumeLinks: boolean },
): boolean {
  const workEntries = resolveWorkEntries(section);
  if (workEntries.some((entry) => entryHasData(entry))) return true;
  if (Array.isArray(section.entries) && section.entries.some((entry) => entryHasData(entry))) return true;
  for (const row of section.fields || []) {
    if (row.value === 'No entries provided') continue;
    if (shouldHideClientReviewField(row.label, row.value)) continue;
    if (opts.hideLinkedIn && /linkedin/i.test(row.label)) continue;
    if (opts.hideInternalNotes && /internal notes|^notes$/i.test(row.label)) continue;
    if (opts.hideResumeLinks && /resume/i.test(row.label)) continue;
    if (display(row.value)) return true;
  }
  return false;
}

function renderSectionBody(
  section: ClientReviewSection,
  opts: {
    hideLinkedIn: boolean;
    hideInternalNotes: boolean;
    hideResumeLinks: boolean;
    /** When true, keep empty visible fields so every shared field is listed. */
    keepEmptyFields?: boolean;
  },
): React.ReactNode {
  const workEntries = resolveWorkEntries(section);
  const entryList =
    workEntries.length > 0 ? workEntries : section.entries?.length ? section.entries : [];
  const entryCards = renderEntryCards(section);
  const structuredRows: React.ReactNode[] = [];
  const scalarFields: Array<{ label: string; value: string }> = [];

  for (const row of section.fields) {
    if (!opts.keepEmptyFields && row.value === 'No entries provided') continue;
    if (shouldHideClientReviewField(row.label, row.value)) continue;
    if (opts.hideLinkedIn && /linkedin/i.test(row.label)) continue;
    if (opts.hideInternalNotes && /internal notes|^notes$/i.test(row.label)) continue;
    if (opts.hideResumeLinks && /resume/i.test(row.label)) continue;
    const structured = opts.keepEmptyFields ? null : renderStructuredField(row.label, row.value);
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
    } else if (
      (section.id === 'education' || section.id === 'work') &&
      /^(education entries|work experience entries)$/i.test(row.label)
    ) {
      // Entry lists render as cards; only keep the scalar row when there are no entries.
      if (entryList.length > 0 || entryCards) continue;
      scalarFields.push({ label: row.label, value: display(row.value) });
    } else {
      scalarFields.push({
        label: row.label,
        value: display(row.value),
      });
    }
  }

  return (
    <div className="space-y-3">
      {entryCards}
      {structuredRows}
      {scalarFields.length > 0 ? (
        <div className="rounded-2xl bg-white px-3 ring-1 ring-slate-100">
          {scalarFields.map((row, index) => (
            <FieldRow key={`${section.id}-${row.label}-${index}`} label={row.label} value={row.value} />
          ))}
        </div>
      ) : !entryCards && !structuredRows.length ? (
        <p className={phase1FieldEmptyClass}>Not provided</p>
      ) : null}
    </div>
  );
}

export function ClientReviewSectionsPanel({
  sections,
  jobTitle,
  clientName,
  defaultOpen = true,
  showMeta = true,
  hideLinkedIn = false,
  hideInternalNotes = false,
  hideResumeLinks = false,
  mode = 'accordion',
  extraTabs = [],
  visibleFields = null,
  fieldFallbacks = {},
}: Props) {
  const hideOpts = { hideLinkedIn, hideInternalNotes, hideResumeLinks };
  const mergedSections = useMemo(() => mergeSectionsById(sections), [sections]);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<string>('');

  const isOpen = (id: string) => openSections[id] ?? defaultOpen;
  const toggle = (id: string) => {
    setOpenSections((current) => ({ ...current, [id]: !isOpen(id) }));
  };

  const coreSectionVisibility = useMemo(
    () => sectionVisibilityFromSubmitFields(visibleFields),
    [visibleFields],
  );
  const phase1FieldVisibility = useMemo(
    () => phase1SectionVisibilityFromSubmitFields(visibleFields),
    [visibleFields],
  );

  const { mainProfileTabs, phase1Tab, leftoverTabs } = useMemo(() => {
    const byId = new Map(mergedSections.map((section) => [section.id, section]));
    const main: Array<{ id: string; label: string; sections: ClientReviewSection[] }> = [];
    let phase1: { id: string; label: string; sections: ClientReviewSection[] } | null = null;
    const leftovers: Array<{ id: string; label: string; sections: ClientReviewSection[] }> = [];

    for (const def of TAB_ORDER) {
      if (def.id === 'phase1') {
        const matched = def.sectionIds
          .map((id) => byId.get(id))
          .filter((section): section is ClientReviewSection => Boolean(section))
          .filter((section) => {
            const key = section.id as keyof typeof phase1FieldVisibility;
            if (visibleFields && phase1FieldVisibility[key] === false) return false;
            return (
              sectionHasVisibleContent(section, hideOpts) || !sectionLooksPlaceholderOnly(section)
            );
          });
        // Keep empty Phase 1 sections that are still marked visible (show Not provided).
        for (const id of def.sectionIds) {
          if (matched.some((section) => section.id === id)) continue;
          const existing = byId.get(id);
          const key = id as keyof typeof phase1FieldVisibility;
          const fieldId = PHASE1_SECTION_FIELD_IDS[id];
          const markedVisible = fieldId
            ? isFieldIdVisible(fieldId, visibleFields)
            : !visibleFields || phase1FieldVisibility[key] !== false;
          if (!markedVisible) continue;
          if (existing) {
            matched.push(existing);
          } else if (mode === 'tabs' && visibleFields && PHASE1_EMPTY_SHELL_IDS.has(id)) {
            matched.push(emptySection(id, resolveSectionTitle(id)));
          }
        }
        if (!matched.length) continue;
        for (const section of matched) byId.delete(section.id);
        phase1 = { id: def.id, label: def.label, sections: matched };
        continue;
      }

      const coreId = (def.sectionIds[0] || def.id) as keyof typeof coreSectionVisibility;
      const sectionAllowed =
        !visibleFields || coreSectionVisibility[coreId as keyof typeof coreSectionVisibility] !== false;

      const matched = def.sectionIds
        .map((id) => byId.get(id))
        .filter((section): section is ClientReviewSection => Boolean(section))
        .filter((section) => {
          if (section.id === 'certifications') {
            return (
              isFieldIdVisible('certifications', visibleFields) &&
              sectionHasVisibleContent(section, hideOpts)
            );
          }
          if (section.id === 'projects') {
            return (
              isFieldIdVisible('projects', visibleFields) &&
              sectionHasVisibleContent(section, hideOpts)
            );
          }
          return true;
        });

      for (const id of def.sectionIds) byId.delete(id);

      if (!sectionAllowed) continue;

      if (matched.length) {
        main.push({ id: def.id, label: def.label, sections: matched });
      } else if (mode === 'tabs') {
        // Tenant marked this group visible — always show the tab, even with empty values.
        main.push({
          id: def.id,
          label: def.label,
          sections: [emptySection(def.sectionIds[0] || def.id, def.label)],
        });
      }
    }

    for (const section of byId.values()) {
      if (
        section.id === 'skills' ||
        section.id === 'languages' ||
        section.id === 'portfolio' ||
        section.id === 'careerPreferences'
      ) {
        continue;
      }
      if (!sectionHasVisibleContent(section, hideOpts) && sectionLooksPlaceholderOnly(section)) {
        continue;
      }
      const omitIds = omitFieldIdsForSections(mergedSections)[section.id] || [];
      const expanded = expandSectionForVisibleFields(section, visibleFields, omitIds, fieldFallbacks);
      if (
        !expanded.fields.length &&
        !(Array.isArray(expanded.entries) && expanded.entries.length)
      ) {
        continue;
      }
      leftovers.push({
        id: expanded.id,
        label: resolveSectionTitle(expanded.id, expanded.title),
        sections: [expanded],
      });
    }

    return { mainProfileTabs: main, phase1Tab: phase1, leftoverTabs: leftovers };
  }, [
    mergedSections,
    hideLinkedIn,
    hideInternalNotes,
    hideResumeLinks,
    visibleFields,
    fieldFallbacks,
    coreSectionVisibility,
    phase1FieldVisibility,
    mode,
  ]);

  const profileTabs = useMemo(
    () => [...mainProfileTabs, ...(phase1Tab ? [phase1Tab] : []), ...leftoverTabs],
    [mainProfileTabs, phase1Tab, leftoverTabs],
  );

  const allTabs = useMemo(() => {
    // Order: Personal…Summary → CV → Actions → Phase 1 extras → leftovers
    const list: Array<{ id: string; label: string; kind: 'profile' | 'extra' }> = [
      ...mainProfileTabs.map((tab) => ({ id: tab.id, label: tab.label, kind: 'profile' as const })),
      ...extraTabs.map((tab) => ({ id: tab.id, label: tab.label, kind: 'extra' as const })),
      ...(phase1Tab
        ? [{ id: phase1Tab.id, label: phase1Tab.label, kind: 'profile' as const }]
        : []),
      ...leftoverTabs.map((tab) => ({ id: tab.id, label: tab.label, kind: 'profile' as const })),
    ];
    return list;
  }, [mainProfileTabs, phase1Tab, leftoverTabs, extraTabs]);

  useEffect(() => {
    if (!allTabs.length) {
      setActiveTab('');
      return;
    }
    if (!allTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(allTabs[0]!.id);
    }
  }, [allTabs, activeTab]);

  const resolvedActiveTab =
    allTabs.some((tab) => tab.id === activeTab) ? activeTab : allTabs[0]?.id || '';

  if (!mergedSections.length && !extraTabs.length && !(mode === 'tabs' && visibleFields)) {
    return null;
  }

  if (mode === 'tabs') {
    const activeProfile = profileTabs.find((tab) => tab.id === resolvedActiveTab);
    const activeExtra = extraTabs.find((tab) => tab.id === resolvedActiveTab);
    const tabHideOpts = {
      hideLinkedIn: visibleFields
        ? parseSubmitToClientFieldVisibility(visibleFields).linkedIn === false
        : hideLinkedIn,
      hideInternalNotes: visibleFields
        ? parseSubmitToClientFieldVisibility(visibleFields).notes === false
        : hideInternalNotes,
      hideResumeLinks: visibleFields
        ? parseSubmitToClientFieldVisibility(visibleFields).p1Resume === false
        : hideResumeLinks,
      keepEmptyFields: true,
    };

    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {(jobTitle || clientName) && showMeta ? (
          <div className="mb-0 border-b border-indigo-100/50 bg-white/80 px-4 py-2.5 sm:px-6">
            <div className="flex flex-wrap gap-2">
              {jobTitle ? (
                <span className="inline-flex rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-800 ring-1 ring-violet-100">
                  Assigned Job: {jobTitle}
                </span>
              ) : null}
              {clientName ? (
                <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-100">
                  Client: {clientName}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}

        <DrawerTabBar
          ariaLabel="Candidate review sections"
          wrap
          tabs={allTabs.map((tab) => ({ id: tab.id, label: tab.label }))}
          activeId={resolvedActiveTab}
          onChange={(id) => setActiveTab(id)}
        />

        <div className={`min-h-0 flex-1 overflow-y-auto ${DRAWER_FORM_SCROLL_BG} p-4 sm:p-6`}>
          {activeProfile ? (
            <div className="w-full space-y-4">
              {activeProfile.sections.map((section) => {
                const omitIds = omitFieldIdsForSections(activeProfile.sections)[section.id] || [];
                const expanded = expandSectionForVisibleFields(section, visibleFields, omitIds, fieldFallbacks);
                if (
                  !expanded.fields.length &&
                  !(Array.isArray(expanded.entries) && expanded.entries.length)
                ) {
                  return null;
                }
                const meta = SECTION_META[expanded.id] || { title: expanded.title, icon: FileText };
                const Icon = meta.icon;
                return (
                  <section
                    key={expanded.id}
                    className="overflow-hidden rounded-2xl border border-indigo-100/80 bg-white shadow-[0_10px_30px_-18px_rgba(79,70,229,0.28)] ring-1 ring-indigo-500/5"
                  >
                    <div className="flex items-center gap-3 border-b border-indigo-50 bg-gradient-to-r from-white via-indigo-50/30 to-violet-50/20 px-5 py-3.5 sm:px-6">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
                        <Icon size={16} />
                      </span>
                      <h3 className="text-sm font-semibold text-slate-900 sm:text-base">
                        {meta.title || expanded.title}
                      </h3>
                    </div>
                    <div className="px-5 py-4 sm:px-6">{renderSectionBody(expanded, tabHideOpts)}</div>
                  </section>
                );
              })}
            </div>
          ) : null}
          {activeExtra ? <div className="w-full">{activeExtra.content}</div> : null}
          {!activeProfile && !activeExtra ? (
            <p className="py-16 text-center text-sm text-slate-500">No content in this tab.</p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {(jobTitle || clientName) && showMeta ? (
        <div className="flex flex-wrap gap-2">
          {jobTitle ? (
            <span className="inline-flex rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-800">
              Assigned Job: {jobTitle}
            </span>
          ) : null}
          {clientName ? (
            <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
              Client: {clientName}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-3xl bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)] ring-1 ring-slate-200/70">
      {mergedSections.map((section) => {
        const omitIds = omitFieldIdsForSections(mergedSections)[section.id] || [];
        const expanded = expandSectionForVisibleFields(section, visibleFields, omitIds, fieldFallbacks);
        if (
          !expanded.fields.length &&
          !(Array.isArray(expanded.entries) && expanded.entries.length)
        ) {
          return null;
        }
        const meta = SECTION_META[expanded.id] || { title: expanded.title, icon: FileText };
        const workEntries = resolveWorkEntries(expanded);
        const entryList =
          workEntries.length > 0 ? workEntries : expanded.entries?.length ? expanded.entries : [];
        const entryCount = entryList.length;
        const filled =
          entryCount > 0
            ? entryList.filter((entry) => entryHasData(entry)).length
            : expanded.fields.filter((row) => display(row.value)).length;
        const total = entryCount > 0 ? entryCount : expanded.fields.length || 1;
        const subtitle =
          entryCount > 0 && expanded.id === 'work'
            ? `${filled}/${total} fields captured · ${entryCount} ${entryCount === 1 ? 'entry' : 'entries'}`
            : entryCount > 0
              ? `${entryCount} ${entryCount === 1 ? 'entry' : 'entries'}`
              : `${filled}/${total} fields captured`;

        return (
          <SectionBlock
            key={expanded.id}
            id={expanded.id}
            title={meta.title || expanded.title}
            icon={meta.icon}
            open={isOpen(expanded.id)}
            onToggle={toggle}
            filled={filled}
            total={total}
            extraHint={subtitle}
          >
            {renderSectionBody(expanded, hideOpts)}
          </SectionBlock>
        );
      })}
      </div>
    </div>
  );
}
