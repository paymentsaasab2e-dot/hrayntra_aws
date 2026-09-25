'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Briefcase } from 'lucide-react';
import type { UpdateCandidatePayload } from '@/lib/api';
import type { CandidateProfileDrawerData } from '../drawers/candidateProfileDrawerData';
import { DrawerSectionCard } from '../drawers/drawerFormUi';
import type { CandidateEditFormState } from './CandidateEditAtsSections';
import { formatIsoDateOnlyForDisplay } from '@/utils/dateDisplay';

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

function resolveAssignedJobLabel(candidate: CandidateProfileDrawerData): string {
  const primary = display(candidate.assignedJob);
  if (primary) return primary;
  const pipelineJobs = (candidate.assignedJobs || [])
    .map((job) => display(job.title))
    .filter(Boolean);
  return pipelineJobs.join(', ');
}

type HiringOverviewProps = {
  candidate: CandidateProfileDrawerData;
  /** Opens assign / pipeline job modal when Assigned job is clicked. */
  onAssignJob?: () => void;
};

export function CandidateHiringOverview({ candidate, onAssignJob }: HiringOverviewProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [candidate.id]);

  const assignedJob = useMemo(() => resolveAssignedJobLabel(candidate), [candidate]);
  const pipelineSummary = useMemo(() => {
    const rows = candidate.assignedJobs || [];
    if (!rows.length) return '';
    return rows
      .map((job) => {
        const title = display(job.title);
        const stage = display(job.stage);
        return stage ? `${title} (${stage})` : title;
      })
      .filter(Boolean)
      .join('; ');
  }, [candidate.assignedJobs]);

  const filledCount = [
    assignedJob,
    candidate.stage,
    candidate.status,
    candidate.recruiter,
    candidate.source,
    candidate.availability,
    candidate.totalNoOfExperience,
  ].filter((value) => display(value)).length;

  return (
    <DrawerSectionCard
      title="Hiring & assignment"
      subtitle={`${filledCount}/7 fields set${assignedJob ? ` · ${assignedJob}` : ''}`}
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
            className="rounded-xl border border-indigo-200 bg-indigo-50/70 px-3 py-2.5 text-left transition-colors hover:border-indigo-300 hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            title={assignedJob ? 'Change or assign job' : 'Assign job'}
          >
            <p className="text-[10px] font-bold uppercase tracking-wide text-indigo-500">Assigned job</p>
            {assignedJob ? (
              <p className="mt-1 break-words text-sm font-medium text-indigo-950">{assignedJob}</p>
            ) : (
              <p className="mt-1 text-sm font-semibold text-indigo-700">Click to assign a job</p>
            )}
          </button>
        ) : (
          <OverviewField label="Assigned job" value={assignedJob} />
        )}
        <OverviewField label="Pipeline stage" value={candidate.stage} />
        <OverviewField label="Status" value={candidate.status} />
        <OverviewField label="Assigned recruiter" value={candidate.recruiter} />
        <OverviewField label="Source" value={candidate.source} />
        <OverviewField label="Availability" value={candidate.availability} />
        <OverviewField
          label="Total No. of Experience"
          value={
            candidate.totalNoOfExperience != null ? String(candidate.totalNoOfExperience) : ''
          }
        />
      </div>
      {pipelineSummary ? (
        <div className="rounded-xl border border-indigo-100 bg-slate-50/80 px-3 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Pipeline jobs</p>
          <p className="mt-1 text-sm text-slate-700">{pipelineSummary}</p>
        </div>
      ) : null}
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

type HiringEditProps = {
  form: CandidateEditFormState;
  onChange: <K extends keyof CandidateEditFormState>(field: K, value: CandidateEditFormState[K]) => void;
  recruiters: Array<{ id: string; name: string }>;
  jobs: Array<{ id: string; title: string; department?: string | null }>;
};

export function CandidateHiringEditSection({ form, onChange, recruiters, jobs }: HiringEditProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/80">
      <div className="flex items-center gap-2 border-b border-slate-200/80 bg-white/60 px-4 py-3">
        <span className="rounded-lg bg-white p-2 text-indigo-600 shadow-sm ring-1 ring-slate-200/80">
          <Briefcase size={16} />
        </span>
        <h4 className="text-sm font-bold text-slate-900">Hiring &amp; assignment</h4>
      </div>
      <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
        <EditField label="Source" value={form.source} onChange={(v) => onChange('source', v)} />
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
        <EditSelect
          label="Assigned job"
          value={form.assignedJobId}
          options={jobs.map((job) => ({
            label: `${job.title}${job.department ? ` · ${job.department}` : ''}`,
            value: job.id,
          }))}
          onChange={(v) => {
            const nextJobId = String(v || '').trim();
            const prevJobId = String(form.assignedJobId || '').trim();
            onChange('assignedJobId', v);
            // New job assignment starts at Applied unless the user then picks another stage.
            if (nextJobId && nextJobId !== prevJobId) {
              onChange('stage', 'Applied');
            } else if (!nextJobId) {
              const stage = String(form.stage || '').trim().toLowerCase();
              if (!stage || stage === 'applied' || stage === 'new') onChange('stage', '');
            }
          }}
          placeholder="Search and select a job"
        />
        <EditSelect
          label="Availability"
          value={form.availability}
          options={CANDIDATE_AVAILABILITY_OPTIONS.map((value) => ({ label: value, value }))}
          onChange={(v) => onChange('availability', v)}
        />
        <EditSelect
          label="Salary currency (default)"
          value={form.salaryCurrency}
          options={SALARY_CURRENCY_OPTIONS.map((value) => ({ label: value, value }))}
          onChange={(v) => onChange('salaryCurrency', v)}
        />
        <EditField
          label="Total No. of Experience"
          value={form.experience}
          onChange={(v) => onChange('experience', v)}
          placeholder="e.g. 5"
        />
      </div>
    </section>
  );
}

export function applyHiringFieldsFromEditForm(
  payload: UpdateCandidatePayload,
  editForm: CandidateEditFormState,
  previousAssignedJobId?: string | null,
): UpdateCandidatePayload {
  const nextJobId = String(editForm.assignedJobId || '').trim();
  const prevJobId = String(previousAssignedJobId || '').trim();
  const jobChanged = Boolean(nextJobId && nextJobId !== prevJobId);
  const formStage = editForm.stage.trim();

  return {
    ...payload,
    assignedToId: editForm.recruiterId || null,
    assignedJobs: nextJobId ? [nextJobId] : [],
    stage: jobChanged
      ? formStage && formStage.toLowerCase() !== 'new'
        ? formStage
        : 'Applied'
      : !nextJobId &&
          (!formStage || formStage.toLowerCase() === 'applied' || formStage.toLowerCase() === 'new')
        ? null
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
