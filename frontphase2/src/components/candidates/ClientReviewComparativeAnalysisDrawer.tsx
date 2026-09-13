'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Columns2, X } from 'lucide-react';
import type { ClientReviewBatchRow, ClientReviewData } from '../../lib/clientReviewTypes';
import type { ClientReviewSection } from '../../lib/clientPresentationSections';

type Props = {
  open: boolean;
  rows: ClientReviewBatchRow[];
  jobTitle?: string;
  clientName?: string;
  onClose: () => void;
};

type CompareParam =
  | { kind: 'section'; id: string; label: string }
  | {
      kind: 'field';
      id: string;
      label: string;
      emphasize?: boolean;
      valuesByMatchId: Record<string, string>;
    };

function displayValue(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  const text = String(value).trim();
  if (!text) return '';
  const lower = text.toLowerCase();
  if (lower === 'null' || lower === 'undefined' || lower === 'n/a' || lower === '-') return '';
  return text;
}

function cell(value: unknown): string {
  return displayValue(value) || '—';
}

function shouldHideField(label: string, value: string): boolean {
  const key = String(label || '')
    .trim()
    .toLowerCase();
  if (!key) return true;
  if (key === 'resume url' || key === 'file url') return true;
  if (key.includes('url') && /amazonaws\.com|\/uploads\//i.test(value)) return true;
  if (key === 'candidate image' && /^on file$/i.test(value)) return true;
  return false;
}

function sectionsOf(row: ClientReviewBatchRow): ClientReviewSection[] {
  return Array.isArray(row.detail?.presentationSections) ? row.detail.presentationSections : [];
}

function fieldValueFromSections(detail: ClientReviewData | undefined, label: string): string {
  const wanted = label.trim().toLowerCase();
  if (!wanted) return '';
  for (const section of detail?.presentationSections || []) {
    for (const field of section.fields || []) {
      const fieldLabel = String(field.label || '')
        .trim()
        .toLowerCase();
      if (fieldLabel === wanted) return displayValue(field.value);
    }
  }
  return '';
}

function formatEntryRows(entries: Array<Record<string, unknown>> | undefined): string {
  if (!Array.isArray(entries) || !entries.length) return '';
  return entries
    .map((entry) => {
      const title =
        displayValue(entry.degreeProgram) ||
        displayValue(entry.degree) ||
        displayValue(entry.title) ||
        displayValue(entry.company) ||
        displayValue(entry.institutionName) ||
        displayValue(entry.institution) ||
        '';
      const meta = [
        displayValue(entry.institutionName) || displayValue(entry.institution) || displayValue(entry.company),
        [
          displayValue(entry.startYear) || displayValue(entry.startDate),
          displayValue(entry.endYear) || displayValue(entry.endDate),
        ]
          .filter(Boolean)
          .join('–'),
      ]
        .filter(Boolean)
        .filter((part) => part !== title);
      if (!title && !meta.length) return '';
      return meta.length ? `${title}${title ? ' · ' : ''}${meta.join(' · ')}` : title;
    })
    .filter(Boolean)
    .join('\n');
}

function formatEntries(section: ClientReviewSection): string {
  return formatEntryRows(section.entries as Array<Record<string, unknown>> | undefined);
}

function splitCandidateName(row: ClientReviewBatchRow): { first: string; last: string; full: string } {
  const full = displayValue(row.candidateName || row.detail?.candidate?.name);
  const parts = full.split(/\s+/).filter(Boolean);
  return {
    full,
    first: parts[0] || '',
    last: parts.slice(1).join(' '),
  };
}

function locationFromRow(row: ClientReviewBatchRow): string {
  const candidate = row.detail?.candidate;
  const parts = [candidate?.city, candidate?.country].map((part) => displayValue(part)).filter(Boolean);
  if (parts.length) return Array.from(new Set(parts)).join(', ');
  const address = displayValue(candidate?.address);
  if (address) return address;
  return displayValue(row.detail?.cvEditorPreview?.location);
}

function skillsFromRow(row: ClientReviewBatchRow): string {
  const candidate = row.detail?.candidate;
  const fromCandidate = Array.isArray(candidate?.skills)
    ? candidate.skills.map((skill) => displayValue(skill)).filter(Boolean)
    : [];
  if (fromCandidate.length) return fromCandidate.join(', ');
  const fromCv = Array.isArray(row.detail?.cvEditorPreview?.skills)
    ? row.detail.cvEditorPreview.skills.map((skill) => displayValue(skill)).filter(Boolean)
    : [];
  return fromCv.join(', ');
}

function educationFromRow(row: ClientReviewBatchRow): string {
  const candidate = row.detail?.candidate;
  const fromCandidate = formatEntryRows(
    (candidate?.cvEducationEntries || []) as Array<Record<string, unknown>>,
  );
  if (fromCandidate) return fromCandidate;
  const fromCv = formatEntryRows(
    (row.detail?.cvEditorPreview?.education || []).map((entry) => ({
      degree: entry.degree,
      institution: entry.school,
      startDate: entry.period,
    })) as Array<Record<string, unknown>>,
  );
  if (fromCv) return fromCv;
  return displayValue(candidate?.education);
}

function workFromRow(row: ClientReviewBatchRow): string {
  const candidate = row.detail?.candidate;
  const fromCandidate = formatEntryRows(
    (candidate?.cvWorkExperienceEntries || []) as Array<Record<string, unknown>>,
  );
  if (fromCandidate) return fromCandidate;
  return formatEntryRows(
    (row.detail?.cvEditorPreview?.experiences || []).map((entry) => ({
      title: entry.role,
      company: entry.company,
      startDate: entry.period,
    })) as Array<Record<string, unknown>>,
  );
}

/**
 * When presentation fields are empty for a candidate, pull the same attribute
 * from profile / CV payload so comparative columns stay filled.
 */
function profileFallbackForLabel(row: ClientReviewBatchRow, label: string): string {
  const key = String(label || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  const candidate = row.detail?.candidate;
  const preview = row.detail?.cvEditorPreview;
  const names = splitCandidateName(row);

  switch (key) {
    case 'name':
    case 'name of candidate':
      return names.full;
    case 'first name':
      return names.first;
    case 'last name':
      return names.last;
    case 'e mail':
    case 'email':
      return displayValue(candidate?.email) || displayValue(preview?.email);
    case 'mobile no':
    case 'mobile':
    case 'phone':
    case 'phone number':
      return displayValue(candidate?.phone) || displayValue(preview?.phone);
    case 'candidate score':
    case 'match score':
    case 'score': {
      const score = row.matchScore ?? row.detail?.matchScore;
      return Number.isFinite(Number(score)) ? String(Math.round(Number(score))) : '';
    }
    case 'city state':
    case 'city':
      return displayValue(candidate?.city);
    case 'state':
      return '';
    case 'country':
      return displayValue(candidate?.country);
    case 'location display':
    case 'actual location':
    case 'location':
    case 'preferred location':
      return locationFromRow(row);
    case 'current address':
    case 'address':
      return displayValue(candidate?.address);
    case 'current company':
    case 'current employer':
    case 'company':
    case 'employer':
      return displayValue(candidate?.currentCompany);
    case 'current designation':
    case 'designation':
    case 'job title':
      return displayValue(row.designation || candidate?.designation || preview?.jobTitle);
    case 'year of experience':
    case 'years of experience':
    case 'experience': {
      const years = row.experience ?? candidate?.experience;
      return Number.isFinite(Number(years)) ? String(years) : '';
    }
    case 'domain of expertise':
    case 'skills':
      return skillsFromRow(row);
    case 'education':
    case 'education summary':
    case 'education entries':
      return educationFromRow(row);
    case 'work experience':
    case 'work experience entries':
      return workFromRow(row);
    case 'professional summary':
    case 'summary':
    case 'cv summary':
      return displayValue(candidate?.cvSummary) || displayValue(preview?.summary);
    case 'languages': {
      const languages = Array.isArray(candidate?.languages)
        ? candidate.languages.map((item) => displayValue(item)).filter(Boolean)
        : [];
      return languages.join(', ');
    }
    case 'linkedin':
      return displayValue(preview?.linkedin);
    case 'stage':
    case 'candidate stage':
      return displayValue(row.clientMarkedStage || row.detail?.clientMarkedStage);
    default:
      return '';
  }
}

function resolveFieldValue(row: ClientReviewBatchRow, label: string): string {
  return fieldValueFromSections(row.detail, label) || profileFallbackForLabel(row, label);
}

function resolveEntriesValue(row: ClientReviewBatchRow, sectionId: string): string {
  const section = sectionsOf(row).find(
    (item) => String(item.id || item.title || '') === sectionId,
  );
  const fromSection = section ? formatEntries(section) : '';
  if (fromSection) return fromSection;
  if (sectionId === 'education') return educationFromRow(row);
  if (sectionId === 'work') return workFromRow(row);
  return '';
}

function fallbackValue(row: ClientReviewBatchRow, key: string): string {
  switch (key) {
    case 'location':
      return locationFromRow(row);
    case 'employer':
      return profileFallbackForLabel(row, 'Current Employer');
    case 'designation':
      return profileFallbackForLabel(row, 'Current Designation');
    case 'experience':
      return profileFallbackForLabel(row, 'Year of experience');
    case 'domain': {
      const skills = skillsFromRow(row);
      const summary = profileFallbackForLabel(row, 'Professional summary');
      if (skills && summary) return `${skills}\n\n${summary}`;
      return skills || summary;
    }
    case 'education':
      return educationFromRow(row);
    case 'stage':
      return profileFallbackForLabel(row, 'Stage');
    default:
      return '';
  }
}

/**
 * Build left-side parameters from visible presentation fields only
 * (non-empty for at least one selected candidate), then fill each candidate column.
 */
function buildCompareParams(selectedRows: ClientReviewBatchRow[]): CompareParam[] {
  const params: CompareParam[] = [];

  const nameValues: Record<string, string> = {};
  for (const row of selectedRows) {
    nameValues[row.matchId] = cell(row.candidateName || row.detail?.candidate?.name);
  }
  params.push({ kind: 'section', id: 'candidate-details', label: 'Candidate Details' });
  params.push({
    kind: 'field',
    id: 'name',
    label: 'Name of Candidate',
    emphasize: true,
    valuesByMatchId: nameValues,
  });

  const stageValues: Record<string, string> = {};
  let anyStage = false;
  for (const row of selectedRows) {
    const stage = profileFallbackForLabel(row, 'Stage');
    if (stage) anyStage = true;
    stageValues[row.matchId] = cell(stage);
  }
  if (anyStage) {
    params.push({
      kind: 'field',
      id: 'stage',
      label: 'Stage',
      valuesByMatchId: stageValues,
    });
  }

  const hasPresentation = selectedRows.some((row) => sectionsOf(row).length > 0);

  if (hasPresentation) {
    type FieldKey = {
      sectionId: string;
      sectionTitle: string;
      label: string;
      key: string;
    };
    const ordered: FieldKey[] = [];
    const seen = new Set<string>();

    for (const row of selectedRows) {
      for (const section of sectionsOf(row)) {
        const sectionId = String(section.id || section.title || 'section').trim() || 'section';
        const sectionTitle = displayValue(section.title) || sectionId;
        for (const field of section.fields || []) {
          const label = displayValue(field.label);
          if (!label) continue;
          // Keep the attribute if any selected candidate has it in presentation OR profile/CV.
          const anyValue = selectedRows.some((candidateRow) => {
            const value = resolveFieldValue(candidateRow, label);
            return Boolean(value) && !shouldHideField(label, value);
          });
          if (!anyValue) continue;
          const key = `${sectionId}::${label.toLowerCase()}`;
          if (seen.has(key)) continue;
          seen.add(key);
          ordered.push({ sectionId, sectionTitle, label, key });
        }
        const anyEntries = selectedRows.some((candidateRow) =>
          Boolean(resolveEntriesValue(candidateRow, sectionId)),
        );
        if (anyEntries) {
          const label =
            sectionId === 'education'
              ? 'Education entries'
              : sectionId === 'work'
                ? 'Work experience'
                : `${sectionTitle} entries`;
          const key = `${sectionId}::__entries`;
          if (!seen.has(key)) {
            seen.add(key);
            ordered.push({ sectionId, sectionTitle, label, key });
          }
        }
      }
    }

    // Also surface common profile fields that may exist only on candidates
    // without a filled presentation section.
    const profileExtras: Array<{ sectionId: string; sectionTitle: string; label: string }> = [
      { sectionId: 'personal', sectionTitle: 'Personal Information', label: 'First Name' },
      { sectionId: 'personal', sectionTitle: 'Personal Information', label: 'Last Name' },
      { sectionId: 'personal', sectionTitle: 'Personal Information', label: 'Candidate Score' },
      { sectionId: 'personal', sectionTitle: 'Personal Information', label: 'City' },
      { sectionId: 'personal', sectionTitle: 'Personal Information', label: 'Country' },
      { sectionId: 'personal', sectionTitle: 'Personal Information', label: 'Location (display)' },
      { sectionId: 'personal', sectionTitle: 'Personal Information', label: 'E-mail' },
      { sectionId: 'personal', sectionTitle: 'Personal Information', label: 'Mobile No' },
      { sectionId: 'work', sectionTitle: 'Work Experience', label: 'Current Company' },
      { sectionId: 'work', sectionTitle: 'Work Experience', label: 'Current Designation' },
      { sectionId: 'professional', sectionTitle: 'Career Preferences', label: 'Year of experience' },
      { sectionId: 'education', sectionTitle: 'Education', label: 'Education' },
      { sectionId: 'summary', sectionTitle: 'Summary & Additional', label: 'Skills' },
    ];
    for (const extra of profileExtras) {
      const key = `${extra.sectionId}::${extra.label.toLowerCase()}`;
      if (seen.has(key)) continue;
      const anyValue = selectedRows.some((row) => {
        const value = resolveFieldValue(row, extra.label);
        return Boolean(value) && !shouldHideField(extra.label, value);
      });
      if (!anyValue) continue;
      seen.add(key);
      ordered.push({ ...extra, key });
    }

    let lastSection = '';
    for (const meta of ordered) {
      const isPersonal =
        /^(candidate details|personal information|personal|basic information)$/i.test(
          meta.sectionTitle,
        );
      if (meta.sectionTitle !== lastSection) {
        lastSection = meta.sectionTitle;
        if (!isPersonal) {
          params.push({
            kind: 'section',
            id: `section-${meta.sectionId}`,
            label: meta.sectionTitle,
          });
        }
      }

      const valuesByMatchId: Record<string, string> = {};
      for (const row of selectedRows) {
        if (meta.key.endsWith('::__entries')) {
          valuesByMatchId[row.matchId] = cell(resolveEntriesValue(row, meta.sectionId));
        } else {
          valuesByMatchId[row.matchId] = cell(resolveFieldValue(row, meta.label));
        }
      }

      params.push({
        kind: 'field',
        id: meta.key,
        label: meta.label,
        valuesByMatchId,
      });
    }

    return params;
  }

  // Fallback when presentation sections are not configured: only show filled core fields.
  const fallbacks: Array<{ id: string; label: string; get: (row: ClientReviewBatchRow) => string }> = [
    { id: 'first-name', label: 'First Name', get: (row) => profileFallbackForLabel(row, 'First Name') },
    { id: 'last-name', label: 'Last Name', get: (row) => profileFallbackForLabel(row, 'Last Name') },
    { id: 'score', label: 'Candidate Score', get: (row) => profileFallbackForLabel(row, 'Candidate Score') },
    { id: 'location', label: 'Actual Location', get: (row) => fallbackValue(row, 'location') },
    { id: 'employer', label: 'Current Employer', get: (row) => fallbackValue(row, 'employer') },
    { id: 'designation', label: 'Current Designation', get: (row) => fallbackValue(row, 'designation') },
    { id: 'experience', label: 'Year of experience', get: (row) => fallbackValue(row, 'experience') },
    { id: 'domain', label: 'Domain of expertise', get: (row) => fallbackValue(row, 'domain') },
    { id: 'education', label: 'Education', get: (row) => fallbackValue(row, 'education') },
  ];

  for (const item of fallbacks) {
    const valuesByMatchId: Record<string, string> = {};
    let anyVisible = false;
    for (const row of selectedRows) {
      const value = displayValue(item.get(row));
      if (value) anyVisible = true;
      valuesByMatchId[row.matchId] = cell(value);
    }
    if (!anyVisible) continue;
    params.push({
      kind: 'field',
      id: item.id,
      label: item.label,
      valuesByMatchId,
    });
  }

  return params;
}

export function ClientReviewComparativeAnalysisDrawer({
  open,
  rows,
  jobTitle,
  clientName,
  onClose,
}: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setSelectedIds(rows.map((row) => row.matchId));
  }, [open, rows]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const selectedRows = useMemo(
    () => rows.filter((row) => selectedIds.includes(row.matchId)),
    [rows, selectedIds],
  );

  const compareParams = useMemo(() => buildCompareParams(selectedRows), [selectedRows]);

  const toggleCandidate = (matchId: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(matchId)) {
        if (prev.length <= 1) return prev;
        return prev.filter((id) => id !== matchId);
      }
      return [...prev, matchId];
    });
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="comparative-analysis"
          className="fixed inset-0 z-[200] flex flex-col bg-slate-950/50 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="comparative-analysis-title"
            initial={{ y: 28, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 28, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#F4F6FB]"
          >
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(ellipse_at_top,_rgba(99,102,241,0.14),_transparent_65%)]"
              aria-hidden
            />

            <header className="relative z-10 shrink-0 border-b border-slate-200/80 bg-white/90 px-4 py-2.5 backdrop-blur-xl sm:px-6 lg:px-8">
              <div className="flex w-full items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-indigo-700 ring-1 ring-indigo-100">
                      <Columns2 className="h-3 w-3" />
                      Comparative analysis
                    </span>
                    <h2
                      id="comparative-analysis-title"
                      className="truncate text-sm font-semibold tracking-tight text-slate-900 sm:text-base"
                    >
                      {jobTitle ? `Shortlisted — ${jobTitle}` : 'Shortlisted candidates'}
                    </h2>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] leading-4 text-slate-500 sm:text-xs">
                    Only visible shared parameters are compared
                    {clientName ? ` for ${clientName}` : ''}. Toggle candidates to change columns.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="shrink-0 rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
                  aria-label="Close comparative analysis"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </header>

            {rows.length > 1 ? (
              <div className="relative z-10 shrink-0 border-b border-slate-200/80 bg-white/70 px-4 py-2 backdrop-blur sm:px-6 lg:px-8">
                <div className="flex w-full flex-wrap gap-1.5">
                  {rows.map((row) => {
                    const active = selectedIds.includes(row.matchId);
                    return (
                      <button
                        key={row.matchId}
                        type="button"
                        onClick={() => toggleCandidate(row.matchId)}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                          active
                            ? 'bg-slate-900 text-white shadow-sm'
                            : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {row.candidateName || 'Candidate'}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="relative z-10 min-h-0 flex-1 overflow-auto">
              {selectedRows.length === 0 ? (
                <div className="flex h-48 items-center justify-center text-sm text-slate-500">
                  No candidates available to compare.
                </div>
              ) : (
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="sticky left-0 top-0 z-30 min-w-[12rem] border-b border-r border-slate-800 bg-slate-900 px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-white/80 sm:min-w-[15rem] sm:px-6 lg:px-8">
                        Attribute
                      </th>
                      {selectedRows.map((row) => (
                        <th
                          key={row.matchId}
                          className="sticky top-0 z-20 min-w-[15rem] border-b border-slate-800 bg-slate-900 px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-white sm:px-6"
                        >
                          {row.candidateName || 'Candidate'}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {compareParams.map((meta) => {
                      if (meta.kind === 'section') {
                        return (
                          <tr key={meta.id}>
                            <td
                              colSpan={selectedRows.length + 1}
                              className="sticky left-0 z-10 border-y border-indigo-100 bg-indigo-50 px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-800 sm:px-6 lg:px-8"
                            >
                              {meta.label}
                            </td>
                          </tr>
                        );
                      }

                      return (
                        <tr key={meta.id} className="align-top odd:bg-slate-50/50">
                          <th
                            scope="row"
                            className={`sticky left-0 z-10 border-b border-r border-slate-100 px-4 py-3.5 text-left text-xs font-semibold text-slate-600 sm:px-6 lg:px-8 ${
                              meta.emphasize ? 'bg-indigo-50/90 text-indigo-900' : 'bg-white'
                            }`}
                          >
                            {meta.label}
                          </th>
                          {selectedRows.map((row) => (
                            <td
                              key={`${row.matchId}-${meta.id}`}
                              className={`border-b border-slate-100 px-4 py-3.5 text-sm leading-6 whitespace-pre-line sm:px-6 ${
                                meta.emphasize
                                  ? 'bg-indigo-50/60 font-semibold text-slate-900'
                                  : 'text-slate-800'
                              }`}
                            >
                              {meta.valuesByMatchId[row.matchId] || '—'}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
