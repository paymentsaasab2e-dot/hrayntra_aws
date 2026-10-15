'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Briefcase, Check, ChevronDown, X } from 'lucide-react';
import { apiGetJobs, type UpdateCandidatePayload } from '@/lib/api';
import { parseJobsListFromResponse } from '@/lib/parseApiList';
import type { CandidateProfileDrawerData } from '../drawers/candidateProfileDrawerData';
import { DrawerSectionCard } from '../drawers/drawerFormUi';
import type { CandidateEditFormState } from './CandidateEditAtsSections';
import { formatIsoDateOnlyForDisplay } from '@/utils/dateDisplay';
import {
  isCandidateEditFieldVisible,
  type CandidateEditFieldVisibility,
} from '@/lib/candidateEditFieldVisibility';
import { useCandidateEditFieldVisibility } from '@/hooks/useCandidateEditFieldVisibility';

type HiringJobOption = { id: string; title: string; department?: string | null };

const ASSIGNED_JOBS_DROPDOWN_MAX_HEIGHT = 280;
const ASSIGNED_JOBS_DROPDOWN_GAP = 6;

const CANDIDATE_STATUS_OPTIONS = ['NEW', 'ACTIVE', 'PLACED', 'INACTIVE', 'BLACKLISTED'];
const CANDIDATE_STAGE_OPTIONS = [
  'Applied',
  'Shortlisted',
  'Screening',
  'Submit to Client',
  'Interviewing',
  'Offered',
  'Hired',
  'Rejected',
];
const CANDIDATE_AVAILABILITY_OPTIONS = ['available', 'limited', 'unavailable'];
const SALARY_CURRENCY_OPTIONS = ['INR', 'USD', 'EUR', 'GBP', 'AED'];

function display(value: unknown): string {
  if (value === undefined || value === null) return '';
  const text = String(value).trim();
  if (!text || text === '—') return '';
  return formatIsoDateOnlyForDisplay(text);
}

function OverviewField({ label, value }: { label: string; value?: unknown }) {
  const text = display(value);
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      {text ? (
        <p className="mt-1 break-words text-sm font-medium text-slate-800">{text}</p>
      ) : (
        <p className="mt-1 text-sm italic text-slate-400">Not assigned</p>
      )}
    </div>
  );
}

type HiringOverviewProps = {
  candidate: CandidateProfileDrawerData;
  /** Opens assign / pipeline job modal when Assigned job is clicked. */
  onAssignJob?: () => void;
};

export function CandidateHiringOverview({ candidate, onAssignJob }: HiringOverviewProps) {
  const [open, setOpen] = useState(false);
  const fieldVisibility = useCandidateEditFieldVisibility();
  const show = (id: keyof CandidateEditFieldVisibility) =>
    isCandidateEditFieldVisible(fieldVisibility, id);

  useEffect(() => {
    setOpen(false);
  }, [candidate.id]);

  /** One pill per assigned job id (never collapse by title — same title can be different jobs). */
  const assignedJobPills = useMemo(() => {
    const byId = new Map<
      string,
      { key: string; title: string; stage?: string; department?: string }
    >();
    const upsert = (raw: {
      id?: string | null;
      title?: string | null;
      stage?: string | null;
      department?: string | null;
    }) => {
      const title = display(raw.title);
      if (!title) return;
      const id = String(raw.id || '').trim();
      const key = id || `title:${title.toLowerCase()}`;
      const existing = byId.get(key);
      byId.set(key, {
        key,
        title: existing?.title || title,
        stage: existing?.stage || display(raw.stage) || undefined,
        department: existing?.department || display(raw.department) || undefined,
      });
    };

    for (const job of candidate.assignedJobs || []) {
      upsert(job);
    }
    // Fallback when assignedJobs rows are empty but primary assignment exists.
    if (byId.size === 0) {
      upsert({
        id: candidate.assignedJobId,
        title: candidate.assignedJob,
      });
    }
    return Array.from(byId.values());
  }, [candidate]);
  const filledCount = [
    assignedJobPills.length ? 'jobs' : '',
    candidate.stage,
    candidate.status,
    candidate.recruiter,
    show('hiringSource') ? candidate.source : '',
    show('hiringAvailability') ? candidate.availability : '',
    show('experience') ? candidate.totalNoOfExperience : '',
  ].filter((value) => display(value)).length;

  const pillsNode =
    assignedJobPills.length > 0 ? (
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {assignedJobPills.map((job) => (
          <span
            key={job.key}
            className="inline-flex max-w-full items-center gap-1 rounded-lg bg-white/80 px-2 py-0.5 text-xs font-semibold text-indigo-950 ring-1 ring-indigo-200"
            title={job.department ? `${job.title} · ${job.department}` : job.title}
          >
            <span className="truncate">{job.title}</span>
            {job.stage ? (
              <span className="shrink-0 rounded bg-indigo-100 px-1 py-px text-[9px] font-bold uppercase tracking-wide text-indigo-700">
                {job.stage}
              </span>
            ) : null}
          </span>
        ))}
      </div>
    ) : null;

  return (
    <DrawerSectionCard
      title="Hiring & assignment"
      subtitle={`${filledCount} fields set${
        assignedJobPills.length
          ? ` · ${assignedJobPills.length} job${assignedJobPills.length === 1 ? '' : 's'}`
          : ''
      }`}
      icon={Briefcase}
      accent="indigo"
      collapsible
      open={open}
      onOpenChange={() => setOpen((prev) => !prev)}
    >
      <div className="grid gap-2 sm:grid-cols-2">
        {onAssignJob ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onAssignJob();
            }}
            className="rounded-xl border border-indigo-200 bg-indigo-50/70 px-3 py-2.5 text-left transition-colors hover:border-indigo-300 hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-200 sm:col-span-2"
            title={assignedJobPills.length ? 'Change or assign jobs' : 'Assign job'}
          >
            <p className="text-[10px] font-bold uppercase tracking-wide text-indigo-500">
              Assigned job
              {assignedJobPills.length > 0 ? ` (${assignedJobPills.length})` : ''}
            </p>
            {pillsNode || (
              <p className="mt-1 text-sm font-semibold text-indigo-700">Click to assign jobs</p>
            )}
          </button>
        ) : (
          <div className="rounded-xl border border-slate-200/80 bg-white px-3 py-2.5 sm:col-span-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              Assigned job
              {assignedJobPills.length > 0 ? ` (${assignedJobPills.length})` : ''}
            </p>
            {pillsNode ? (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {assignedJobPills.map((job) => (
                  <span
                    key={job.key}
                    className="inline-flex max-w-full items-center gap-1 rounded-lg bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-800 ring-1 ring-slate-200"
                    title={job.department ? `${job.title} · ${job.department}` : job.title}
                  >
                    <span className="truncate">{job.title}</span>
                    {job.stage ? (
                      <span className="shrink-0 rounded bg-slate-200/80 px-1 py-px text-[9px] font-bold uppercase tracking-wide text-slate-600">
                        {job.stage}
                      </span>
                    ) : null}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-sm italic text-slate-400">Not assigned</p>
            )}
          </div>
        )}
        <OverviewField label="Pipeline stage" value={candidate.stage} />
        <OverviewField label="Status" value={candidate.status} />
        <OverviewField label="Assigned recruiter" value={candidate.recruiter} />
        {show('hiringSource') ? <OverviewField label="Source" value={candidate.source} /> : null}
        {show('hiringAvailability') ? (
          <OverviewField label="Availability" value={candidate.availability} />
        ) : null}
        {show('experience') ? (
          <OverviewField
            label="Total No. of Experience"
            value={
              candidate.totalNoOfExperience != null ? String(candidate.totalNoOfExperience) : ''
            }
          />
        ) : null}
      </div>
    </DrawerSectionCard>
  );
}

function EditField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        inputMode="decimal"
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
      />
    </label>
  );
}

function EditSelect({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select',
}: {
  label: string;
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function AssignedJobsMultiSelect({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select one or more jobs',
  loading = false,
}: {
  label: string;
  value: string[];
  options: Array<{ label: string; value: string }>;
  onChange: (next: string[]) => void;
  placeholder?: string;
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [menuPosition, setMenuPosition] = useState<{
    left: number;
    width: number;
    top?: number;
    bottom?: number;
    placement: 'top' | 'bottom';
    maxHeight: number;
  } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const closeMenu = useCallback(() => {
    setOpen(false);
    setQuery('');
  }, []);

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUpward =
      spaceBelow < ASSIGNED_JOBS_DROPDOWN_MAX_HEIGHT + ASSIGNED_JOBS_DROPDOWN_GAP &&
      spaceAbove > spaceBelow;
    const available = openUpward ? spaceAbove : spaceBelow;
    const maxHeight = Math.max(
      160,
      Math.min(ASSIGNED_JOBS_DROPDOWN_MAX_HEIGHT, available - ASSIGNED_JOBS_DROPDOWN_GAP - 8),
    );

    if (openUpward) {
      setMenuPosition({
        left: rect.left,
        width: rect.width,
        placement: 'top',
        bottom: window.innerHeight - rect.top + ASSIGNED_JOBS_DROPDOWN_GAP,
        maxHeight,
      });
      return;
    }

    setMenuPosition({
      left: rect.left,
      width: rect.width,
      placement: 'bottom',
      top: rect.bottom + ASSIGNED_JOBS_DROPDOWN_GAP,
      maxHeight,
    });
  }, []);

  useEffect(() => {
    if (!open) {
      setMenuPosition(null);
      return;
    }
    updateMenuPosition();
    const onReposition = () => updateMenuPosition();
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [open, updateMenuPosition, value.length, options.length]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      closeMenu();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, closeMenu]);

  const selectedSet = useMemo(() => new Set(value), [value]);
  const selectedOptions = useMemo(
    () => options.filter((option) => selectedSet.has(option.value)),
    [options, selectedSet],
  );
  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((option) => option.label.toLowerCase().includes(q));
  }, [options, query]);

  const toggle = (jobId: string) => {
    if (selectedSet.has(jobId)) {
      onChange(value.filter((id) => id !== jobId));
      return;
    }
    onChange([...value, jobId]);
  };

  const remove = (jobId: string) => {
    onChange(value.filter((id) => id !== jobId));
  };

  const menu =
    open && menuPosition && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            style={{
              position: 'fixed',
              left: menuPosition.left,
              width: menuPosition.width,
              top: menuPosition.top,
              bottom: menuPosition.bottom,
              zIndex: 600,
              maxHeight: menuPosition.maxHeight,
            }}
            className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl ring-1 ring-slate-100"
          >
            <div className="shrink-0 border-b border-slate-100 p-2">
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search jobs…"
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                autoFocus
              />
            </div>
            <ul
              className="min-h-0 flex-1 overflow-y-auto py-1"
              role="listbox"
              aria-multiselectable
            >
              {loading && filteredOptions.length === 0 ? (
                <li className="px-3 py-2.5 text-sm text-slate-400">Loading jobs…</li>
              ) : filteredOptions.length === 0 ? (
                <li className="px-3 py-2.5 text-sm text-slate-400">No jobs match</li>
              ) : (
                filteredOptions.map((option) => {
                  const checked = selectedSet.has(option.value);
                  return (
                    <li key={option.value}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={checked}
                        onClick={() => toggle(option.value)}
                        className={`flex w-full items-start gap-2.5 px-3 py-2 text-left text-sm transition hover:bg-indigo-50 ${
                          checked ? 'bg-indigo-50/70 text-indigo-950' : 'text-slate-700'
                        }`}
                      >
                        <span
                          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                            checked
                              ? 'border-indigo-500 bg-indigo-600 text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {checked ? <Check size={11} strokeWidth={3} /> : null}
                        </span>
                        <span className="min-w-0 flex-1 break-words">{option.label}</span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
            {selectedOptions.length > 0 ? (
              <div className="flex shrink-0 items-center justify-between border-t border-slate-100 bg-slate-50/80 px-3 py-2">
                <span className="text-[11px] font-medium text-slate-500">
                  {selectedOptions.length} job{selectedOptions.length === 1 ? '' : 's'} selected
                </span>
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="text-[11px] font-semibold text-slate-600 hover:text-rose-600"
                >
                  Clear all
                </button>
              </div>
            ) : null}
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="block md:col-span-2">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full min-h-[2.75rem] items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
          {selectedOptions.length === 0 ? (
            <span className="text-slate-400">{placeholder}</span>
          ) : (
            selectedOptions.map((option) => (
              <span
                key={option.value}
                className="inline-flex max-w-full items-center gap-1 rounded-lg bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-800 ring-1 ring-indigo-200"
              >
                <span className="truncate">{option.label}</span>
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={`Remove ${option.label}`}
                  className="rounded p-0.5 text-indigo-500 hover:bg-indigo-100 hover:text-indigo-800"
                  onClick={(event) => {
                    event.stopPropagation();
                    remove(option.value);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      event.stopPropagation();
                      remove(option.value);
                    }
                  }}
                >
                  <X size={12} />
                </span>
              </span>
            ))
          )}
        </div>
        <ChevronDown
          size={16}
          className={`shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {menu}
      <p className="mt-1.5 text-[11px] text-slate-400">
        Select one or more jobs to assign. Save to update the candidate pipeline.
      </p>
    </div>
  );
}

type HiringEditProps = {
  form: CandidateEditFormState;
  onChange: <K extends keyof CandidateEditFormState>(field: K, value: CandidateEditFormState[K]) => void;
  recruiters: Array<{ id: string; name: string }>;
  jobs: Array<{ id: string; title: string; department?: string | null }>;
  fieldVisibility?: Partial<CandidateEditFieldVisibility> | null;
};

function mergeHiringJobOptions(
  seed: HiringJobOption[],
  fetched: HiringJobOption[],
): HiringJobOption[] {
  const byId = new Map<string, HiringJobOption>();
  for (const job of [...seed, ...fetched]) {
    const id = String(job?.id || '').trim();
    if (!id) continue;
    const title = String(job.title || '').trim() || 'Untitled job';
    const existing = byId.get(id);
    byId.set(id, {
      id,
      title: title || existing?.title || 'Untitled job',
      department: job.department || existing?.department || null,
    });
  }
  return Array.from(byId.values()).sort((a, b) => a.title.localeCompare(b.title));
}

export function CandidateHiringEditSection({
  form,
  onChange,
  recruiters,
  jobs,
  fieldVisibility,
}: HiringEditProps) {
  const show = (id: keyof CandidateEditFieldVisibility) =>
    isCandidateEditFieldVisible(fieldVisibility, id);
  const seedJobs = jobs || [];
  const seedJobsKey = useMemo(
    () =>
      seedJobs
        .map((job) => String(job?.id || '').trim())
        .filter(Boolean)
        .sort()
        .join('|'),
    [seedJobs],
  );
  const seedJobsRef = useRef(seedJobs);
  seedJobsRef.current = seedJobs;

  const [allJobs, setAllJobs] = useState<HiringJobOption[]>(() =>
    mergeHiringJobOptions(seedJobs, []),
  );
  const [jobsLoading, setJobsLoading] = useState(false);
  const [catalogLoaded, setCatalogLoaded] = useState(false);

  // Merge parent-provided jobs whenever their ids change.
  useEffect(() => {
    setAllJobs((prev) => mergeHiringJobOptions(seedJobsRef.current, prev));
  }, [seedJobsKey]);

  // Load full job catalog once.
  useEffect(() => {
    if (catalogLoaded) return;
    let cancelled = false;
    setJobsLoading(true);
    void apiGetJobs({ page: 1, limit: 500 })
      .then((res) => {
        if (cancelled) return;
        const fetched = parseJobsListFromResponse(res)
          .filter((job) => job?.id)
          .map((job) => ({
            id: String(job.id),
            title: String(job.title || 'Untitled job').trim() || 'Untitled job',
            department: job.department || job.client?.companyName || null,
          }));
        setAllJobs((prev) => mergeHiringJobOptions(seedJobsRef.current, [...prev, ...fetched]));
        setCatalogLoaded(true);
      })
      .catch(() => {
        // Keep seed jobs from parent if fetch fails.
        if (!cancelled) setCatalogLoaded(true);
      })
      .finally(() => {
        if (!cancelled) setJobsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [catalogLoaded]);

  const jobOptions = useMemo(
    () =>
      allJobs.map((job) => ({
        label: `${job.title}${job.department ? ` · ${job.department}` : ''}`,
        value: job.id,
      })),
    [allJobs],
  );

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/80">
      <div className="flex items-center gap-2 border-b border-slate-200/80 bg-white/60 px-4 py-3">
        <span className="rounded-lg bg-white p-2 text-indigo-600 shadow-sm ring-1 ring-slate-200/80">
          <Briefcase size={16} />
        </span>
        <h4 className="text-sm font-bold text-slate-900">Hiring &amp; assignment</h4>
      </div>
      <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
        {show('hiringSource') ? (
          <EditField label="Source" value={form.source} onChange={(v) => onChange('source', v)} />
        ) : null}
        <EditSelect
          label="Stage"
          value={form.stage}
          options={Array.from(
            new Set([...CANDIDATE_STAGE_OPTIONS, form.stage].map((value) => String(value || '').trim()).filter(Boolean)),
          ).map((value) => ({ label: value, value }))}
          onChange={(v) => onChange('stage', v)}
        />
        <EditSelect
          label="Status"
          value={form.status}
          options={CANDIDATE_STATUS_OPTIONS.map((value) => ({ label: value, value }))}
          onChange={(v) => onChange('status', v)}
        />
        <EditSelect
          label="Assigned recruiter"
          value={form.recruiterId}
          options={recruiters.map((recruiter) => ({ label: recruiter.name, value: recruiter.id }))}
          onChange={(v) => onChange('recruiterId', v)}
          placeholder="Select recruiter"
        />
        <AssignedJobsMultiSelect
          label="Assigned job"
          value={
            Array.isArray(form.assignedJobIds) && form.assignedJobIds.length
              ? form.assignedJobIds
              : form.assignedJobId
                ? [form.assignedJobId]
                : []
          }
          options={jobOptions}
          loading={jobsLoading}
          onChange={(nextIds) => {
            const unique = [...new Set(nextIds.map((id) => String(id || '').trim()).filter(Boolean))];
            const prevIds = Array.isArray(form.assignedJobIds)
              ? form.assignedJobIds
              : form.assignedJobId
                ? [form.assignedJobId]
                : [];
            const prevSet = new Set(prevIds);
            const added = unique.filter((id) => !prevSet.has(id));
            // Keep primary + list in sync; stage resets when a new job is added.
            onChange('assignedJobIds', unique);
            onChange('assignedJobId', unique[0] || '');
            if (added.length > 0) {
              onChange('stage', 'Applied');
            }
          }}
          placeholder={jobsLoading ? 'Loading jobs…' : 'Select one or more jobs'}
        />
        {show('hiringAvailability') ? (
          <EditSelect
            label="Availability"
            value={form.availability}
            options={CANDIDATE_AVAILABILITY_OPTIONS.map((value) => ({ label: value, value }))}
            onChange={(v) => onChange('availability', v)}
          />
        ) : null}
        {show('hiringSalaryCurrency') ? (
          <EditSelect
            label="Salary currency (default)"
            value={form.salaryCurrency}
            options={SALARY_CURRENCY_OPTIONS.map((value) => ({ label: value, value }))}
            onChange={(v) => onChange('salaryCurrency', v)}
          />
        ) : null}
        {show('experience') ? (
          <EditField
            label="Total No. of Experience"
            value={form.experience}
            onChange={(v) => onChange('experience', v)}
            placeholder="e.g. 5"
          />
        ) : null}
      </div>
    </section>
  );
}

export function applyHiringFieldsFromEditForm(
  payload: UpdateCandidatePayload,
  editForm: CandidateEditFormState,
  previousAssignedJobId?: string | null,
  previousAssignedJobIds?: string[] | null,
): UpdateCandidatePayload {
  const nextIds = Array.isArray(editForm.assignedJobIds)
    ? [...new Set(editForm.assignedJobIds.map((id) => String(id || '').trim()).filter(Boolean))]
    : String(editForm.assignedJobId || '').trim()
      ? [String(editForm.assignedJobId).trim()]
      : [];
  const prevIds = Array.isArray(previousAssignedJobIds)
    ? previousAssignedJobIds.map((id) => String(id || '').trim()).filter(Boolean)
    : String(previousAssignedJobId || '').trim()
      ? [String(previousAssignedJobId).trim()]
      : [];
  const prevSet = new Set(prevIds);
  const addedJobs = nextIds.filter((id) => !prevSet.has(id));
  const jobChanged = addedJobs.length > 0 || nextIds.join('|') !== prevIds.join('|');
  const formStage = editForm.stage.trim();

  return {
    ...payload,
    assignedToId: editForm.recruiterId || null,
    assignedJobs: nextIds,
    stage: jobChanged && addedJobs.length > 0
      ? formStage && formStage.toLowerCase() !== 'new'
        ? formStage
        : 'Applied'
      : formStage || undefined,
    status: editForm.status.trim() || undefined,
    source: editForm.source.trim() || undefined,
    availability: editForm.availability.trim() || undefined,
    salary: {
      currency: editForm.salaryCurrency || payload.salary?.currency || 'INR',
      min: payload.salary?.min ?? null,
      max: payload.salary?.max ?? null,
    },
    experience: parseTotalExperienceYears(editForm.experience),
    experienceYears: parseTotalExperienceYears(editForm.experience),
  };
}

function parseTotalExperienceYears(value: string): number | null {
  const trimmed = String(value || '').trim();
  if (!trimmed) return null;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}
