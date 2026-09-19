'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Eye, FileText, Loader2, MessageSquareText } from 'lucide-react';
import {
  CLIENT_PIPELINE_STAGE_CHOICES,
  type ClientReviewBatchRow,
} from '../../lib/clientReviewTypes';
import { isClientReviewFileHref } from '../../lib/clientReviewAssets';
import {
  clientTrackerAllowsResponse,
  normalizeClientTrackerOptions,
} from '../../lib/clientTrackerOptions';
import {
  parseSubmitToClientTableColumns,
  SUBMIT_TO_CLIENT_FIELD_LABELS,
  SUBMIT_TO_CLIENT_REVIEW_LABEL_FIELDS,
  type SubmitToClientFieldId,
} from '../../lib/submitToClientFieldVisibility';
import { ageFromBirthDate, resolveClientReviewFullName } from '../../lib/clientReviewFieldFallbacks';

type Props = {
  rows: ClientReviewBatchRow[];
  onView: (row: ClientReviewBatchRow) => void;
  /** Opens feedback/comment dialog for this candidate (shared-link feedback). */
  onFeedback?: (row: ClientReviewBatchRow) => void;
  /** matchId → stage label the client marked (overrides row.clientMarkedStage). */
  stageByMatchId?: Record<string, string>;
  token?: string;
  apiBase?: string;
  /** Called after a stage is saved from the table dropdown. */
  onStageSubmitted?: (matchId: string, stageLabel: string) => void;
};

type TableCellValue =
  | { kind: 'text'; text: string }
  | { kind: 'chips'; chips: string[] }
  | { kind: 'score'; score: number }
  | { kind: 'empty' };

const CHIP_FIELDS = new Set<SubmitToClientFieldId>([
  'skills',
  'languageProficiency',
  'certifications',
  'educationCourses',
  'p1PreferredJobTitles',
  'p1PreferredIndustries',
  'p1FunctionalAreas',
  'p1JobTypes',
  'p1WorkModes',
]);

const NAME_FIELDS = new Set<SubmitToClientFieldId>(['fullName']);

const LABEL_KEYS_BY_FIELD: Record<SubmitToClientFieldId, string[]> = (() => {
  const map = {} as Record<SubmitToClientFieldId, string[]>;
  for (const [fieldId, label] of Object.entries(SUBMIT_TO_CLIENT_FIELD_LABELS) as Array<
    [SubmitToClientFieldId, string]
  >) {
    map[fieldId] = [label.trim().toLowerCase()];
  }
  for (const [label, ids] of Object.entries(SUBMIT_TO_CLIENT_REVIEW_LABEL_FIELDS)) {
    if (ids.length !== 1) continue;
    const fieldId = ids[0];
    if (!fieldId) continue;
    if (
      fieldId === 'fullName' &&
      (label === 'first name' || label === 'middle name' || label === 'last name')
    ) {
      continue;
    }
    const next = map[fieldId] ?? [];
    if (!next.includes(label)) next.push(label);
    map[fieldId] = next;
  }
  return map;
})();

function stageBadgeClass(stage: string): string {
  const n = stage.toLowerCase();
  if (n.includes('reject')) return 'bg-rose-50 text-rose-700 ring-rose-100';
  if (n.includes('hired') || n.includes('joined')) return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
  if (n.includes('offer')) return 'bg-amber-50 text-amber-800 ring-amber-100';
  if (n.includes('shortlist') || n.includes('feedback')) return 'bg-sky-50 text-sky-800 ring-sky-100';
  if (n.includes('interview') || n.includes('screen')) return 'bg-violet-50 text-violet-700 ring-violet-100';
  if (n.includes('submit')) return 'bg-indigo-50 text-indigo-700 ring-indigo-100';
  return 'bg-teal-50 text-teal-700 ring-teal-100';
}

function candidateOf(row: ClientReviewBatchRow) {
  return row.detail?.candidate || {};
}

function assignedColumnsForRows(rows: ClientReviewBatchRow[]): SubmitToClientFieldId[] {
  if (!rows.length) return parseSubmitToClientTableColumns(null);
  const first = parseSubmitToClientTableColumns(
    rows[0]?.detail?.tableColumns,
    rows[0]?.detail?.visibleFields,
  );
  const seen = new Set(first);
  const extra: SubmitToClientFieldId[] = [];
  for (const row of rows.slice(1)) {
    for (const id of parseSubmitToClientTableColumns(row.detail?.tableColumns, row.detail?.visibleFields)) {
      if (seen.has(id)) continue;
      seen.add(id);
      extra.push(id);
    }
  }
  return [...first, ...extra];
}

function nameParts(row: ClientReviewBatchRow) {
  const name = resolveClientReviewFullName(row);
  const parts = name.split(/\s+/).filter(Boolean);
  return {
    first: parts[0] || '',
    middle: parts.length > 2 ? parts.slice(1, -1).join(' ') : '',
    last: parts.length > 1 ? parts[parts.length - 1] : '',
  };
}

function initialsFor(row: ClientReviewBatchRow) {
  const name = resolveClientReviewFullName(row) || 'C';
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || 'C'
  );
}

function splitList(raw: string): string[] {
  return raw
    .split(/[,|\n]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function compactEntry(
  entry: Record<string, unknown> | undefined,
  titleKeys: string[],
  subKeys: string[],
): string {
  if (!entry) return '';
  const title = titleKeys
    .map((key) => String(entry[key] || '').trim())
    .find(Boolean);
  const sub = subKeys
    .map((key) => String(entry[key] || '').trim())
    .find(Boolean);
  if (title && sub) return `${title} · ${sub}`;
  return title || sub || '';
}

function presentationValue(row: ClientReviewBatchRow, fieldId: SubmitToClientFieldId): string {
  const labels = new Set(LABEL_KEYS_BY_FIELD[fieldId] || []);
  const sections = Array.isArray(row.detail?.presentationSections)
    ? row.detail.presentationSections
    : [];
  for (const section of sections) {
    for (const field of section.fields || []) {
      const label = String(field.label || '')
        .trim()
        .toLowerCase();
      if (!labels.has(label)) continue;
      const value = String(field.value || '').trim();
      if (value) return value;
    }
  }
  return '';
}

function educationEntriesValue(row: ClientReviewBatchRow): string {
  const candidate = candidateOf(row);
  const entries = Array.isArray(candidate.cvEducationEntries) ? candidate.cvEducationEntries : [];
  const first = entries.find((entry) =>
    String(entry?.degree || entry?.institution || '').trim(),
  );
  if (first) {
    const degree = String(first.degree || '').trim();
    const institution = String(first.institution || '').trim();
    const text = degree && institution ? `${degree} · ${institution}` : degree || institution;
    if (entries.length > 1) return `${text} +${entries.length - 1}`;
    return text;
  }

  const sections = Array.isArray(row.detail?.presentationSections)
    ? row.detail.presentationSections
    : [];
  for (const section of sections) {
    if (String(section.id || '').toLowerCase() !== 'education') continue;
    if (!Array.isArray(section.entries) || !section.entries.length) continue;
    const text = compactEntry(
      section.entries[0] as Record<string, unknown>,
      ['degreeProgram', 'degree', 'title'],
      ['institutionName', 'institution', 'company'],
    );
    if (!text) continue;
    return section.entries.length > 1 ? `${text} +${section.entries.length - 1}` : text;
  }
  return presentationValue(row, 'cvEducationEntries');
}

function workEntriesValue(row: ClientReviewBatchRow): string {
  const candidate = candidateOf(row);
  const entries = Array.isArray(candidate.cvWorkExperienceEntries)
    ? candidate.cvWorkExperienceEntries
    : [];
  const first = entries.find((entry) => String(entry?.title || entry?.company || '').trim());
  if (first) {
    const title = String(first.title || '').trim();
    const company = String(first.company || '').trim();
    const text = title && company ? `${title} · ${company}` : title || company;
    if (entries.length > 1) return `${text} +${entries.length - 1}`;
    return text;
  }

  const sections = Array.isArray(row.detail?.presentationSections)
    ? row.detail.presentationSections
    : [];
  for (const section of sections) {
    if (String(section.id || '').toLowerCase() !== 'work') continue;
    if (!Array.isArray(section.entries) || !section.entries.length) continue;
    const text = compactEntry(
      section.entries[0] as Record<string, unknown>,
      ['title', 'role', 'designation'],
      ['company', 'employer'],
    );
    if (!text) continue;
    return section.entries.length > 1 ? `${text} +${section.entries.length - 1}` : text;
  }
  return presentationValue(row, 'cvWorkExperienceEntries');
}

function resolveTableCell(row: ClientReviewBatchRow, fieldId: SubmitToClientFieldId): TableCellValue {
  const candidate = candidateOf(row);
  let text = '';

  switch (fieldId) {
    case 'fullName':
      text = resolveClientReviewFullName(row);
      break;
    case 'email':
      text = String(candidate.email || '').trim() || presentationValue(row, fieldId);
      break;
    case 'phone':
      text = String(candidate.phone || '').trim() || presentationValue(row, fieldId);
      break;
    case 'currentTitle':
      text =
        String(candidate.designation || row.designation || '').trim() ||
        presentationValue(row, fieldId);
      break;
    case 'currentCompany':
      text = String(candidate.currentCompany || '').trim() || presentationValue(row, fieldId);
      break;
    case 'city':
      text = String(candidate.city || '').trim() || presentationValue(row, fieldId);
      break;
    case 'state':
      text = String(candidate.state || '').trim() || presentationValue(row, fieldId);
      break;
    case 'country':
      text = String(candidate.country || '').trim() || presentationValue(row, fieldId);
      break;
    case 'preferredLocation':
      text = String(candidate.preferredLocation || '').trim() || presentationValue(row, fieldId);
      break;
    case 'address':
      text = String(candidate.address || '').trim() || presentationValue(row, fieldId);
      break;
    case 'age': {
      text =
        String(candidate.age || '').trim() ||
        ageFromBirthDate(candidate.birthDate) ||
        presentationValue(row, fieldId) ||
        ageFromBirthDate(presentationValue(row, 'birthDate'));
      break;
    }
    case 'birthDate':
      text = String(candidate.birthDate || '').trim() || presentationValue(row, fieldId);
      break;
    case 'experience': {
      const experience = row.experience ?? candidate.experience;
      text = Number.isFinite(Number(experience))
        ? String(Number(experience))
        : presentationValue(row, fieldId);
      break;
    }
    case 'candidateScore': {
      if (row.detail?.trackerOptions?.showScore === false) return { kind: 'empty' };
      const score = row.matchScore ?? row.detail?.matchScore;
      if (Number.isFinite(Number(score))) return { kind: 'score', score: Math.round(Number(score)) };
      text = presentationValue(row, fieldId);
      break;
    }
    case 'skills': {
      const fromCandidate = Array.isArray(candidate.skills)
        ? candidate.skills.map((skill) => String(skill || '').trim()).filter(Boolean)
        : [];
      const chips = fromCandidate.length ? fromCandidate : splitList(presentationValue(row, fieldId));
      return chips.length ? { kind: 'chips', chips: chips.slice(0, 4) } : { kind: 'empty' };
    }
    case 'languageProficiency': {
      const fromCandidate = Array.isArray(candidate.languages)
        ? candidate.languages.map((lang) => String(lang || '').trim()).filter(Boolean)
        : [];
      const chips = fromCandidate.length ? fromCandidate : splitList(presentationValue(row, fieldId));
      return chips.length ? { kind: 'chips', chips: chips.slice(0, 4) } : { kind: 'empty' };
    }
    case 'certifications': {
      const fromCandidate = Array.isArray(candidate.certifications)
        ? candidate.certifications.map((item) => String(item || '').trim()).filter(Boolean)
        : [];
      const chips = fromCandidate.length ? fromCandidate : splitList(presentationValue(row, fieldId));
      return chips.length ? { kind: 'chips', chips: chips.slice(0, 4) } : { kind: 'empty' };
    }
    case 'cvEducationEntries':
      text = educationEntriesValue(row);
      break;
    case 'educationSummary':
      text = String(candidate.education || '').trim() || presentationValue(row, fieldId);
      break;
    case 'cvWorkExperienceEntries':
      text = workEntriesValue(row);
      break;
    case 'cvSummary':
      text = String(candidate.cvSummary || '').trim() || presentationValue(row, fieldId);
      break;
    case 'linkedIn':
      text = String(candidate.linkedIn || '').trim() || presentationValue(row, fieldId);
      break;
    case 'p1Resume':
      text = resumeUrlOf(row) ? 'Available' : presentationValue(row, fieldId);
      break;
    case 'avatar':
      text = presentationValue(row, fieldId) || initialsFor(row);
      break;
    default:
      text = presentationValue(row, fieldId);
  }

  if (CHIP_FIELDS.has(fieldId) && text) {
    const chips = splitList(text);
    if (chips.length > 1) return { kind: 'chips', chips: chips.slice(0, 4) };
  }
  const trimmed = text.trim();
  return trimmed ? { kind: 'text', text: trimmed } : { kind: 'empty' };
}

function resumeUrlOf(row: ClientReviewBatchRow): string {
  return String(row.detail?.sharedResumeUrl || row.detail?.candidate?.resume || '').trim();
}

function canOpenCv(row: ClientReviewBatchRow): boolean {
  if (row.detail?.trackerOptions?.downloadResume === false) return false;
  const url = resumeUrlOf(row);
  if (!url) return false;
  return url.startsWith('http') || isClientReviewFileHref(url);
}

function stageOptionsFor(row: ClientReviewBatchRow): Array<{ id: string; name: string }> {
  const fromDetail =
    Array.isArray(row.detail?.pipelineStages) && row.detail.pipelineStages.length
      ? row.detail.pipelineStages
      : CLIENT_PIPELINE_STAGE_CHOICES;
  const seen = new Set<string>();
  const next: Array<{ id: string; name: string }> = [];
  for (const stage of fromDetail) {
    const name = String(stage.name || '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    next.push({
      id: String(stage.id || stage.name || '').trim() || name,
      name,
    });
  }
  return next;
}

function StageSelectDropdown({
  value,
  options,
  disabled,
  saving,
  ariaLabel,
  onChange,
}: {
  value: string;
  options: Array<{ id: string; name: string }>;
  disabled?: boolean;
  saving?: boolean;
  ariaLabel: string;
  onChange: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

  const selected = String(value || '').trim();
  const triggerClass = selected
    ? stageBadgeClass(selected)
    : 'bg-white text-slate-600 ring-slate-200';

  const placeMenu = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const menuWidth = Math.max(rect.width, 220);
    const estimatedHeight = Math.min(320, 48 + options.length * 40);
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < estimatedHeight + 12 && rect.top > spaceBelow;
    const left = Math.min(
      Math.max(12, rect.left),
      Math.max(12, window.innerWidth - menuWidth - 12),
    );
    setMenuStyle({
      position: 'fixed',
      top: openUp ? undefined : rect.bottom + 6,
      bottom: openUp ? window.innerHeight - rect.top + 6 : undefined,
      left,
      width: menuWidth,
      zIndex: 80,
    });
  };

  useEffect(() => {
    if (!open) return;
    placeMenu();
    const onReposition = () => placeMenu();
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, options.length]);

  return (
    <div className="relative min-w-[10.5rem] max-w-[14rem]">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled || saving || !options.length}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className={`inline-flex w-full items-center gap-1.5 rounded-full py-1.5 pl-3 pr-2 text-left text-[11px] font-semibold outline-none ring-1 ring-inset transition hover:brightness-[0.98] focus-visible:ring-2 focus-visible:ring-indigo-300 disabled:cursor-not-allowed disabled:opacity-60 ${triggerClass}`}
      >
        <span className="min-w-0 flex-1 truncate">{selected || 'Select stage…'}</span>
        {saving ? (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin opacity-70" />
        ) : (
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 opacity-70 transition ${open ? 'rotate-180' : ''}`}
          />
        )}
      </button>

      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={menuRef}
              style={menuStyle}
              role="listbox"
              aria-label={ariaLabel}
              className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_18px_40px_-18px_rgba(15,23,42,0.45)] ring-1 ring-slate-900/5"
            >
              <div className="border-b border-slate-100 bg-slate-50/90 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Choose stage
                </p>
              </div>
              <div className="max-h-72 overflow-y-auto p-1.5">
                {options.map((option) => {
                  const isActive = selected.toLowerCase() === option.name.toLowerCase();
                  return (
                    <button
                      key={option.id || option.name}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      onClick={() => {
                        setOpen(false);
                        onChange(option.name);
                      }}
                      className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[12px] font-medium transition ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-700 hover:bg-indigo-50 hover:text-indigo-900'
                      }`}
                    >
                      <span
                        className={`inline-flex h-2 w-2 shrink-0 rounded-full ${
                          isActive ? 'bg-white/90' : stageDotClass(option.name)
                        }`}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1 truncate">{option.name}</span>
                      {isActive ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
                    </button>
                  );
                })}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function stageDotClass(stage: string): string {
  const n = stage.toLowerCase();
  if (n.includes('reject')) return 'bg-rose-500';
  if (n.includes('hired') || n.includes('joined')) return 'bg-emerald-500';
  if (n.includes('offer')) return 'bg-amber-500';
  if (n.includes('shortlist') || n.includes('feedback')) return 'bg-sky-500';
  if (n.includes('interview') || n.includes('screen')) return 'bg-violet-500';
  if (n.includes('submit')) return 'bg-indigo-500';
  return 'bg-teal-500';
}

function TableCellContent({
  row,
  fieldId,
  showAvatar,
}: {
  row: ClientReviewBatchRow;
  fieldId: SubmitToClientFieldId;
  showAvatar: boolean;
}) {
  const value = resolveTableCell(row, fieldId);
  const body =
    value.kind === 'chips' ? (
      <div className="flex max-w-[16rem] flex-wrap gap-1">
        {value.chips.map((chip) => (
          <span
            key={chip}
            className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700"
          >
            {chip}
          </span>
        ))}
      </div>
    ) : value.kind === 'score' ? (
      <span className="text-slate-600">{value.score}</span>
    ) : value.kind === 'text' ? (
      <span className="block max-w-[14rem] truncate text-slate-600" title={value.text}>
        {value.text}
      </span>
    ) : (
      <span className="text-slate-400">—</span>
    );

  if (!showAvatar) return body;

  const nameText = value.kind === 'text' ? value.text : resolveClientReviewFullName(row) || 'Candidate';
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-sky-500 text-xs font-bold text-white">
        {initialsFor(row)}
      </span>
      <div className="min-w-0">{value.kind === 'empty' ? <span className="text-slate-400">—</span> : body}</div>
      {nameText ? <span className="sr-only">{nameText}</span> : null}
    </div>
  );
}

export function ClientReviewBatchTable({
  rows,
  onView,
  onFeedback,
  stageByMatchId,
  token,
  apiBase,
  onStageSubmitted,
}: Props) {
  const [savingMatchId, setSavingMatchId] = useState<string | null>(null);
  const [stageErrorByMatchId, setStageErrorByMatchId] = useState<Record<string, string>>({});

  const tableColumns = useMemo(() => assignedColumnsForRows(rows), [rows]);
  const leadNameField = tableColumns.find((fieldId) => NAME_FIELDS.has(fieldId)) ?? null;
  const viewEnabled = rows.some((row) => row.detail?.trackerOptions?.viewProfile !== false);
  const showStage = rows.some((row) => normalizeClientTrackerOptions(row.detail?.trackerOptions).changeStage);

  const saveStage = async (row: ClientReviewBatchRow, nextStage: string) => {
    const matchId = String(row.matchId || '').trim();
    const stage = String(nextStage || '').trim();
    if (!matchId || !stage || !token || !apiBase) return;

    const current = String(
      stageByMatchId?.[matchId] || row.clientMarkedStage || row.detail?.clientMarkedStage || '',
    ).trim();
    if (current.toLowerCase() === stage.toLowerCase()) return;

    setSavingMatchId(matchId);
    setStageErrorByMatchId((prev) => {
      const next = { ...prev };
      delete next[matchId];
      return next;
    });

    try {
      const formData = new FormData();
      formData.append('stage', stage);
      formData.append('matchId', matchId);

      const response = await fetch(
        `${apiBase}/interviews/public/review/${encodeURIComponent(token)}/tag`,
        {
          method: 'POST',
          body: formData,
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || 'Unable to save stage');
      }
      const stageLabel = String(payload?.data?.stageLabel || stage).trim() || stage;
      onStageSubmitted?.(matchId, stageLabel);
    } catch (err: unknown) {
      setStageErrorByMatchId((prev) => ({
        ...prev,
        [matchId]: err instanceof Error ? err.message : 'Unable to save stage',
      }));
    } finally {
      setSavingMatchId((current) => (current === matchId ? null : current));
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-slate-100 px-4 py-4 sm:px-6 lg:px-8">
        <h2 className="text-base font-semibold tracking-tight text-slate-900">Submitted candidates</h2>
        <p className="mt-1 text-sm text-slate-500">
          Open the CV, view the profile
          {rows.some((row) =>
            clientTrackerAllowsResponse(normalizeClientTrackerOptions(row.detail?.trackerOptions)),
          )
            ? ', or leave feedback'
            : ''}
          {rows.some((row) => row.detail?.trackerOptions?.addRemarks !== false)
            ? ' and submit your decision'
            : ''}
          {showStage ? ', pick a stage' : ''}
          .
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur">
            <tr className="border-b border-slate-200 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              <th className="px-4 py-3.5 sm:px-6 lg:px-8">#</th>
              {tableColumns.map((fieldId) => (
                <th key={fieldId} className="px-4 py-3.5 sm:px-6">
                  {SUBMIT_TO_CLIENT_FIELD_LABELS[fieldId]}
                </th>
              ))}
              {showStage ? <th className="px-4 py-3.5 sm:px-6">Stage</th> : null}
              <th className="px-4 py-3.5 text-right sm:px-6 lg:px-8">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const cvUrl = resumeUrlOf(row);
              const cvAvailable = canOpenCv(row);
              const tracker = normalizeClientTrackerOptions(row.detail?.trackerOptions);
              const canPickStage = tracker.changeStage;
              const stageOptions = stageOptionsFor(row);
              const stage = String(
                stageByMatchId?.[row.matchId] ||
                  row.clientMarkedStage ||
                  row.detail?.clientMarkedStage ||
                  '',
              ).trim();
              const selectValue =
                stage &&
                stageOptions.some((option) => option.name.toLowerCase() === stage.toLowerCase())
                  ? stageOptions.find((option) => option.name.toLowerCase() === stage.toLowerCase())
                      ?.name || stage
                  : stage;
              const stageError = stageErrorByMatchId[row.matchId];
              const saving = savingMatchId === row.matchId;

              return (
                <tr
                  key={row.matchId}
                  className="cursor-pointer border-b border-slate-100 transition hover:bg-indigo-50/40"
                  onClick={() => onView(row)}
                >
                  <td className="px-4 py-4 text-slate-400 sm:px-6 lg:px-8">{index + 1}</td>
                  {tableColumns.map((fieldId) => (
                    <td key={fieldId} className="px-4 py-4 sm:px-6">
                      <TableCellContent
                        row={row}
                        fieldId={fieldId}
                        showAvatar={fieldId === leadNameField}
                      />
                    </td>
                  ))}
                  {showStage ? (
                    <td className="px-4 py-4 sm:px-6" onClick={(event) => event.stopPropagation()}>
                      {canPickStage && token && apiBase ? (
                        <div>
                          <StageSelectDropdown
                            value={selectValue}
                            options={
                              selectValue &&
                              !stageOptions.some(
                                (option) =>
                                  option.name.toLowerCase() === selectValue.toLowerCase(),
                              )
                                ? [{ id: selectValue, name: selectValue }, ...stageOptions]
                                : stageOptions
                            }
                            disabled={!stageOptions.length}
                            saving={saving}
                            ariaLabel={`Stage for ${row.candidateName || 'candidate'}`}
                            onChange={(next) => {
                              void saveStage(row, next);
                            }}
                          />
                          {stageError ? (
                            <p className="mt-1 text-[10px] font-medium text-rose-600">{stageError}</p>
                          ) : null}
                        </div>
                      ) : stage ? (
                        <span
                          className={`inline-flex max-w-[12rem] truncate rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${stageBadgeClass(stage)}`}
                          title={stage}
                        >
                          {stage}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  ) : null}
                  <td className="px-4 py-4 text-right sm:px-6 lg:px-8">
                    <div className="inline-flex flex-wrap items-center justify-end gap-2">
                      {cvAvailable ? (
                        <a
                          href={cvUrl}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(event) => event.stopPropagation()}
                          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <FileText size={14} />
                          CV
                        </a>
                      ) : null}
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onView(row);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
                      >
                        <Eye size={14} />
                        {viewEnabled ? 'View' : 'Open'}
                      </button>
                      {clientTrackerAllowsResponse(tracker) && onFeedback ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onFeedback(row);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                        >
                          <MessageSquareText size={14} />
                          Feedback
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
