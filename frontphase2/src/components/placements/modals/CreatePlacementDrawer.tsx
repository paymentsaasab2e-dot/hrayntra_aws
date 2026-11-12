'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Award, Banknote, Briefcase, Calendar, Loader2, Upload, User } from 'lucide-react';
import type { CreatePlacementPayload, EmploymentType, PlacementStatus } from '../../../types/placement';
import {
  calculatePlacementFee,
  getPlacementStatusLabel,
  PLACEMENT_STATUS_OPTIONS,
} from '../../../utils/placements';
import { formatCurrencyAmount } from '../../../utils/currency';
import { resolveOrgDefaultCurrency } from '../../../lib/invoiceCurrency';
import { CurrencySearchPicker } from '../../CurrencySearchPicker';
import { DrawerFormShell, DrawerFormCancelButton } from '../../drawers/DrawerFormShell';
import {
  DrawerFieldLabel,
  DrawerSectionCard,
  DrawerSelectDropdown,
  DRAWER_FORM_INPUT,
} from '../../drawers/drawerFormUi';
import { useOrgCommissionSlabs } from '../../../lib/useOrgCommissionSlabs';
import { resolveCommissionPercent } from '../../../lib/commissionSlabs';
import { formatAssigneeDisplayName } from '../../../lib/assigneeDisplay';
import {
  fetchAllAccessibleCandidatesForPlacementPicker,
  fetchAllAccessibleJobsForPlacementPicker,
} from '../../../lib/myJobsListParams';

type PlacementCandidateOption = { id: string; name: string; email: string };
type PlacementJobOption = {
  id: string;
  title: string;
  clientId?: string;
  clientName: string;
  minSalary?: number | null;
  maxSalary?: number | null;
  salaryAmount?: number | null;
};

function mapCandidateRows(rows: Array<{ id?: string; firstName?: string | null; lastName?: string | null; email?: string | null }>): PlacementCandidateOption[] {
  return rows
    .filter((row) => row?.id)
    .map((candidate) => ({
      id: String(candidate.id),
      name:
        [candidate.firstName, candidate.lastName]
          .map((part) => String(part ?? '').trim())
          .filter((part) => part && part.toLowerCase() !== 'null' && part.toLowerCase() !== 'undefined')
          .join(' ')
          .trim() || candidate.email || 'Candidate',
      email: String(candidate.email || ''),
    }));
}

function mapJobRows(rows: any[]): PlacementJobOption[] {
  return [...rows]
    .filter((job) => job?.id)
    .sort((a, b) =>
      String(a?.title || '').localeCompare(String(b?.title || ''), undefined, { sensitivity: 'base' }),
    )
    .map((job) => ({
      id: String(job.id),
      title: String(job.title || 'Untitled job'),
      clientId: job.client?.id || job.clientId || undefined,
      clientName: job.client?.companyName || 'No client linked',
      minSalary: job.salary?.min ?? job.minSalary ?? null,
      maxSalary: job.salary?.max ?? job.maxSalary ?? null,
      salaryAmount: job.salary?.amount ?? null,
    }));
}

interface CreatePlacementDrawerProps {
  isOpen: boolean;
  isSubmitting: boolean;
  /** True while candidate/job picker options are loading. */
  optionsLoading?: boolean;
  mode?: 'create' | 'edit' | 'resend';
  currentUserId?: string;
  candidates: PlacementCandidateOption[];
  jobs: PlacementJobOption[];
  recruiters: Array<{ id: string; name: string; email: string }>;
  prefill?: Partial<Pick<CreatePlacementPayload, 'candidateId' | 'jobId' | 'companyId' | 'recruiterId'>>;
  initialValues?: Partial<CreatePlacementPayload>;
  onClose: () => void;
  onSubmit: (payload: CreatePlacementPayload, offerLetter?: File | null) => Promise<void>;
}

function readCurrentUserDisplayName(userId?: string): string {
  if (typeof window === 'undefined') return '';
  try {
    const parsed = JSON.parse(localStorage.getItem('currentUser') || '{}') as {
      id?: string;
      name?: string;
      firstName?: string;
      lastName?: string;
      email?: string;
    };
    const id = String(parsed?.id || '').trim();
    if (userId && id && id !== userId) return '';
    return (
      formatAssigneeDisplayName({
        id,
        name: parsed?.name,
        firstName: parsed?.firstName,
        lastName: parsed?.lastName,
        email: parsed?.email,
      }) || String(parsed?.email || '').trim()
    );
  } catch {
    return '';
  }
}

const employmentTypes: EmploymentType[] = ['PERMANENT', 'CONTRACT', 'FREELANCE'];

const initialState = {
  candidateId: '',
  jobId: '',
  recruiterId: '',
  offerSalary: '',
  placementFee: '',
  commissionPercentage: '20',
  currency: resolveOrgDefaultCurrency(),
  offerDate: '',
  expectedJoiningDate: '',
  employmentType: 'PERMANENT' as EmploymentType,
  status: 'OFFER_SENT' as PlacementStatus,
  notes: '',
};

export function CreatePlacementDrawer({
  isOpen,
  isSubmitting,
  optionsLoading = false,
  mode = 'create',
  currentUserId,
  candidates,
  jobs,
  recruiters,
  prefill,
  initialValues,
  onClose,
  onSubmit,
}: CreatePlacementDrawerProps) {
  const isEditMode = mode === 'edit';
  const isResendMode = mode === 'resend';
  const [form, setForm] = useState(initialState);
  const [offerLetter, setOfferLetter] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pctEditedManually, setPctEditedManually] = useState(false);
  const [candidateChoices, setCandidateChoices] = useState<PlacementCandidateOption[]>(candidates);
  const [jobChoices, setJobChoices] = useState<PlacementJobOption[]>(jobs);
  const [searchingCandidates, setSearchingCandidates] = useState(false);
  const [searchingJobs, setSearchingJobs] = useState(false);
  const candidateSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const jobSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const candidateSearchAbort = useRef<AbortController | null>(null);
  const jobSearchAbort = useRef<AbortController | null>(null);
  const { settings: commissionSlabs } = useOrgCommissionSlabs();

  useEffect(() => {
    setCandidateChoices(candidates);
  }, [candidates]);

  useEffect(() => {
    setJobChoices(jobs);
  }, [jobs]);

  useEffect(() => {
    if (!isOpen) {
      if (candidateSearchTimer.current) clearTimeout(candidateSearchTimer.current);
      if (jobSearchTimer.current) clearTimeout(jobSearchTimer.current);
      candidateSearchAbort.current?.abort();
      jobSearchAbort.current?.abort();
      setSearchingCandidates(false);
      setSearchingJobs(false);
    }
  }, [isOpen]);

  const handleCandidateSearch = useCallback((query: string) => {
    if (candidateSearchTimer.current) clearTimeout(candidateSearchTimer.current);
    const q = query.trim();
    if (!q) {
      candidateSearchAbort.current?.abort();
      setCandidateChoices(candidates);
      setSearchingCandidates(false);
      return;
    }
    candidateSearchTimer.current = setTimeout(async () => {
      candidateSearchAbort.current?.abort();
      const controller = new AbortController();
      candidateSearchAbort.current = controller;
      setSearchingCandidates(true);
      try {
        const rows = await fetchAllAccessibleCandidatesForPlacementPicker(controller.signal, q);
        if (controller.signal.aborted) return;
        const mapped = mapCandidateRows(rows);
        const selected = candidates.find((row) => row.id === form.candidateId);
        const merged = selected && !mapped.some((row) => row.id === selected.id)
          ? [selected, ...mapped]
          : mapped;
        setCandidateChoices(merged);
      } catch {
        if (!controller.signal.aborted) setCandidateChoices(candidates);
      } finally {
        if (!controller.signal.aborted) setSearchingCandidates(false);
      }
    }, 220);
  }, [candidates, form.candidateId]);

  const handleJobSearch = useCallback((query: string) => {
    if (jobSearchTimer.current) clearTimeout(jobSearchTimer.current);
    const q = query.trim();
    if (!q) {
      jobSearchAbort.current?.abort();
      setJobChoices(jobs);
      setSearchingJobs(false);
      return;
    }
    jobSearchTimer.current = setTimeout(async () => {
      jobSearchAbort.current?.abort();
      const controller = new AbortController();
      jobSearchAbort.current = controller;
      setSearchingJobs(true);
      try {
        const rows = await fetchAllAccessibleJobsForPlacementPicker(controller.signal, q);
        if (controller.signal.aborted) return;
        const mapped = mapJobRows(rows);
        const selected = jobs.find((row) => row.id === form.jobId);
        const merged = selected && !mapped.some((row) => row.id === selected.id)
          ? [selected, ...mapped]
          : mapped;
        setJobChoices(merged);
      } catch {
        if (!controller.signal.aborted) setJobChoices(jobs);
      } finally {
        if (!controller.signal.aborted) setSearchingJobs(false);
      }
    }, 220);
  }, [form.jobId, jobs]);

  useEffect(() => {
    if (isOpen) {
      setForm({
        ...initialState,
        currency: resolveOrgDefaultCurrency(),
        recruiterId: currentUserId || '',
        offerDate: new Date().toISOString().slice(0, 10),
        ...(initialValues?.candidateId ? { candidateId: String(initialValues.candidateId) } : null),
        ...(initialValues?.jobId ? { jobId: String(initialValues.jobId) } : null),
        ...(initialValues?.recruiterId ? { recruiterId: String(initialValues.recruiterId) } : null),
        ...(initialValues?.offerSalary !== undefined ? { offerSalary: String(initialValues.offerSalary) } : null),
        ...(initialValues?.placementFee !== undefined ? { placementFee: String(initialValues.placementFee) } : null),
        ...(initialValues?.commissionPercentage !== undefined
          ? { commissionPercentage: String(initialValues.commissionPercentage) }
          : null),
        ...(initialValues?.currency ? { currency: String(initialValues.currency).toUpperCase() } : null),
        ...(initialValues?.offerDate ? { offerDate: String(initialValues.offerDate).slice(0, 10) } : null),
        ...(initialValues?.expectedJoiningDate
          ? { expectedJoiningDate: String(initialValues.expectedJoiningDate).slice(0, 10) }
          : null),
        ...(initialValues?.employmentType ? { employmentType: initialValues.employmentType } : null),
        ...(initialValues?.status ? { status: initialValues.status } : null),
        ...(initialValues?.notes !== undefined ? { notes: String(initialValues.notes || '') } : null),
        ...(prefill?.candidateId ? { candidateId: prefill.candidateId } : null),
        ...(prefill?.jobId ? { jobId: prefill.jobId } : null),
        ...(prefill?.recruiterId ? { recruiterId: prefill.recruiterId } : null),
      });
      setOfferLetter(null);
      setErrors({});
      setPctEditedManually(initialValues?.commissionPercentage !== undefined && initialValues?.commissionPercentage !== null);
    }
  }, [isOpen, currentUserId, initialValues, prefill?.candidateId, prefill?.jobId, prefill?.recruiterId]);

  const selectedJob = useMemo(
    () =>
      jobChoices.find((job) => job.id === form.jobId) ||
      jobs.find((job) => job.id === form.jobId) ||
      null,
    [form.jobId, jobChoices, jobs],
  );
  const selectedCandidate = useMemo(
    () =>
      candidateChoices.find((candidate) => candidate.id === form.candidateId) ||
      candidates.find((candidate) => candidate.id === form.candidateId) ||
      null,
    [candidateChoices, candidates, form.candidateId],
  );
  const teamMemberOptions = useMemo(() => {
    const byId = new Map<string, { id: string; name: string; email: string }>();
    for (const recruiter of recruiters) {
      const id = String(recruiter.id || '').trim();
      if (!id) continue;
      const name =
        formatAssigneeDisplayName({
          id,
          name: recruiter.name,
          email: recruiter.email,
        }) ||
        String(recruiter.name || '').trim() ||
        String(recruiter.email || '').trim();
      if (!name) continue;
      byId.set(id, { id, name, email: String(recruiter.email || '').trim() });
    }
    const selfId = String(currentUserId || form.recruiterId || '').trim();
    if (selfId && !byId.has(selfId)) {
      const selfName = readCurrentUserDisplayName(selfId);
      if (selfName) {
        byId.set(selfId, { id: selfId, name: selfName, email: '' });
      }
    }
    return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [recruiters, currentUserId, form.recruiterId]);

  const selectedTeamMember = useMemo(
    () => teamMemberOptions.find((member) => member.id === form.recruiterId) || null,
    [teamMemberOptions, form.recruiterId],
  );

  const lockCandidate = Boolean(prefill?.candidateId || initialValues?.candidateId);
  const lockJob = Boolean(prefill?.jobId || initialValues?.jobId);

  useEffect(() => {
    if (!isOpen) return;
    const recruiterId = String(form.recruiterId || '').trim();
    if (!recruiterId) return;
    if (teamMemberOptions.some((member) => member.id === recruiterId)) return;
    // Prefer a known named teammate over a bare id that cannot be displayed.
    const fallback = teamMemberOptions[0]?.id || '';
    if (fallback) {
      setForm((current) => ({ ...current, recruiterId: fallback }));
    } else {
      setForm((current) => ({ ...current, recruiterId: '' }));
    }
  }, [isOpen, form.recruiterId, teamMemberOptions]);

  // Slabs ON → lock currency to org commission currency.
  // Slabs OFF → keep whatever the recruiter selected.
  useEffect(() => {
    if (!isOpen || !commissionSlabs.enabled) return;
    const slabCurrency = String(commissionSlabs.commissionCurrency || '').trim().toUpperCase();
    if (!slabCurrency || slabCurrency.length !== 3) return;
    setForm((current) =>
      current.currency === slabCurrency ? current : { ...current, currency: slabCurrency },
    );
  }, [isOpen, commissionSlabs.enabled, commissionSlabs.commissionCurrency]);

  useEffect(() => {
    if (pctEditedManually || !commissionSlabs.enabled) return;
    const resolved = resolveCommissionPercent(commissionSlabs, {
      offerSalary: form.offerSalary,
      offerCurrency: commissionSlabs.salaryCurrency,
      jobSalary: {
        min: selectedJob?.minSalary,
        max: selectedJob?.maxSalary,
        amount: selectedJob?.salaryAmount,
      },
    });
    const nextPct = String(resolved.percent);
    const nextFee = String(Math.round(resolved.fee || 0));
    const nextCcy = String(
      resolved.commissionCurrency || commissionSlabs.commissionCurrency || '',
    )
      .trim()
      .toUpperCase();
    setForm((current) => {
      if (
        current.commissionPercentage === nextPct &&
        current.placementFee === nextFee &&
        (!nextCcy || current.currency === nextCcy)
      ) {
        return current;
      }
      return {
        ...current,
        commissionPercentage: nextPct,
        placementFee: nextFee,
        ...(nextCcy && nextCcy.length === 3 ? { currency: nextCcy } : null),
      };
    });
  }, [
    commissionSlabs,
    form.offerSalary,
    form.jobId,
    pctEditedManually,
    selectedJob?.minSalary,
    selectedJob?.maxSalary,
    selectedJob?.salaryAmount,
  ]);

  useEffect(() => {
    if (commissionSlabs.enabled && !pctEditedManually) return;
    const salary = Number(form.offerSalary || 0);
    const pct = Number(form.commissionPercentage || 0);
    if (salary > 0 && pct > 0) {
      setForm((current) => ({
        ...current,
        placementFee: String(Math.round(calculatePlacementFee(salary, pct))),
      }));
    }
  }, [form.offerSalary, form.commissionPercentage, commissionSlabs.enabled, pctEditedManually]);

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!form.candidateId) nextErrors.candidateId = 'Candidate is required';
    if (!form.jobId) nextErrors.jobId = 'Job is required';
    if (form.jobId && !selectedJob?.clientId) {
      nextErrors.jobId =
        'This job has no client company linked. Edit the job and assign a client before creating a placement.';
    }
    if (!form.offerSalary || Number(form.offerSalary) <= 0) nextErrors.offerSalary = 'Offer salary is required';
    if (!form.offerDate) nextErrors.offerDate = 'Offer date is required';
    if (!form.employmentType) nextErrors.employmentType = 'Employment type is required';
    if (!form.status) nextErrors.status = 'Status is required';
    if (form.status === 'JOINING_SCHEDULED' && !form.expectedJoiningDate) {
      nextErrors.expectedJoiningDate = 'Joining date is required for Joining Scheduled status';
    }
    if (!isEditMode && offerLetter) {
      const name = offerLetter.name.toLowerCase();
      const type = (offerLetter.type || '').toLowerCase();
      const isPdf =
        type === 'application/pdf' ||
        type === 'application/x-pdf' ||
        name.endsWith('.pdf') ||
        (type === 'application/octet-stream' && name.endsWith('.pdf'));
      if (!isPdf) {
        nextErrors.offerLetter = 'Offer letter must be a PDF file';
      }
    }
    setErrors(nextErrors);
    return !Object.keys(nextErrors).length;
  };

  const drawerTitle = isResendMode
    ? 'Resend offer letter'
    : isEditMode
      ? 'Edit Placement'
      : 'Add Manual Placement';
  const drawerSubtitle = isResendMode
    ? 'Upload a revised offer letter and send it back to the candidate on Phase 1.'
    : isEditMode
      ? 'Update placement details from the table action.'
      : 'Create a placement and optionally upload the offer letter.';

  const handleSave = async () => {
    if (!validate()) return;
    await onSubmit(
      {
        candidateId: form.candidateId,
        jobId: form.jobId,
        companyId: selectedJob?.clientId || undefined,
        recruiterId: form.recruiterId || currentUserId,
        offerSalary: form.offerSalary,
        placementFee: form.placementFee,
        commissionPercentage: form.commissionPercentage,
        currency: form.currency,
        commissionSource: pctEditedManually || !commissionSlabs.enabled ? 'manual' : 'slab',
        offerDate: form.offerDate,
        expectedJoiningDate: form.expectedJoiningDate || undefined,
        employmentType: form.employmentType,
        status: isResendMode ? 'OFFER_SENT' : form.status,
        notes: form.notes || undefined,
      },
      isResendMode || !isEditMode ? offerLetter : null,
    );
  };

  return (
    <DrawerFormShell
      isOpen={isOpen}
      onClose={onClose}
      title={drawerTitle}
      subtitle={drawerSubtitle}
      headerIcon={Award}
      zBackdrop={155}
      zPanel={160}
      footer={
        <>
          <DrawerFormCancelButton />
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => void handleSave()}
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting
              ? isResendMode
                ? 'Resending...'
                : isEditMode
                  ? 'Saving...'
                  : 'Creating...'
              : isResendMode
                ? 'Resend offer letter'
                : isEditMode
                  ? 'Save Changes'
                  : 'Create Placement'}
          </button>
        </>
      }
    >
      <DrawerSectionCard title="Placement Details" subtitle="Candidate, job, and team" icon={User} accent="blue">
        {optionsLoading || searchingCandidates || searchingJobs ? (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            {optionsLoading ? 'Loading candidates and jobs…' : 'Searching…'}
          </div>
        ) : null}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <DrawerFieldLabel label="Candidate" icon={User} iconClassName="text-blue-500" required />
            {lockCandidate ? (
              <div className={`${DRAWER_FORM_INPUT} flex items-center bg-slate-50 font-medium`}>
                {selectedCandidate?.name || 'Selected candidate'}
              </div>
            ) : (
              <DrawerSelectDropdown
                value={form.candidateId}
                preferUpward
                searchable
                searchPlaceholder="Search candidate…"
                placeholder="Select candidate"
                error={Boolean(errors.candidateId)}
                onSearchChange={handleCandidateSearch}
                options={[
                  { value: '', label: 'Select candidate' },
                  ...candidateChoices.map((candidate) => ({
                    value: candidate.id,
                    label: candidate.name,
                    searchText: `${candidate.name} ${candidate.email}`,
                  })),
                ]}
                onChange={(candidateId) => setForm((current) => ({ ...current, candidateId }))}
              />
            )}
            {errors.candidateId ? <p className="mt-1 text-xs text-red-600">{errors.candidateId}</p> : null}
          </div>

          <div>
            <DrawerFieldLabel label="Job" icon={Briefcase} iconClassName="text-blue-500" required />
            {lockJob ? (
              <div className={`${DRAWER_FORM_INPUT} flex items-center bg-slate-50 font-medium`}>
                {selectedJob?.title || 'Selected job'}
              </div>
            ) : (
              <DrawerSelectDropdown
                value={form.jobId}
                preferUpward
                searchable
                searchPlaceholder="Search job…"
                placeholder="Select job"
                error={Boolean(errors.jobId)}
                onSearchChange={handleJobSearch}
                options={[
                  { value: '', label: 'Select job' },
                  ...jobChoices.map((job) => ({
                    value: job.id,
                    label: job.clientId ? job.title : `${job.title} (assign client first)`,
                    searchText: `${job.title} ${job.clientName}`,
                  })),
                ]}
                onChange={(jobId) => setForm((current) => ({ ...current, jobId }))}
              />
            )}
            {errors.jobId ? <p className="mt-1 text-xs text-red-600">{errors.jobId}</p> : null}
          </div>

          <div>
            <DrawerFieldLabel label="Company" icon={Briefcase} iconClassName="text-blue-500" />
            <div
              className={`${DRAWER_FORM_INPUT} flex items-center font-medium ${
                selectedJob && !selectedJob.clientId
                  ? 'border-amber-300 bg-amber-50 text-amber-900'
                  : 'bg-slate-50 text-slate-900'
              }`}
            >
              {selectedJob
                ? selectedJob.clientId
                  ? selectedJob.clientName
                  : 'No client linked — assign a client on the job first'
                : 'Pick a job to see the company'}
            </div>
          </div>

          <div>
            <DrawerFieldLabel label="Team Member" />
            <DrawerSelectDropdown
              value={form.recruiterId}
              preferUpward
              searchable
              searchPlaceholder="Search team member…"
              placeholder="Select team member"
              options={[
                { value: '', label: 'Select team member' },
                ...teamMemberOptions.map((recruiter) => ({
                  value: recruiter.id,
                  label: recruiter.name,
                })),
              ]}
              onChange={(recruiterId) => setForm((current) => ({ ...current, recruiterId }))}
            />
            {form.recruiterId && !selectedTeamMember ? (
              <p className="mt-1 text-xs text-amber-700">Choose a team member from the list.</p>
            ) : null}
          </div>
        </div>
      </DrawerSectionCard>

      <DrawerSectionCard title="Compensation" subtitle="Salary, fee, and currency" icon={Banknote} accent="emerald">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <DrawerFieldLabel label="Currency" />
            <CurrencySearchPicker
              compact
              preferUpward
              disabled={commissionSlabs.enabled}
              value={form.currency}
              onChange={(currency) => setForm((current) => ({ ...current, currency }))}
              hint={
                commissionSlabs.enabled
                  ? `Locked to org commission slab currency (${commissionSlabs.commissionCurrency}). Ask Super Admin to turn slabs off if you need a different currency.`
                  : 'Search any world currency by code, name, or country.'
              }
            />
          </div>
          <div>
            <DrawerFieldLabel label={commissionSlabs.enabled ? `Offer Salary (${commissionSlabs.salaryCurrency})` : 'Offer Salary'} required />
            <input
              type="number"
              value={form.offerSalary}
              onChange={(event) => setForm((current) => ({ ...current, offerSalary: event.target.value }))}
              className={DRAWER_FORM_INPUT}
            />
            {Number(form.offerSalary) > 0 ? (
              <p className="mt-1 text-xs text-slate-500">
                {formatCurrencyAmount(
                  Number(form.offerSalary),
                  commissionSlabs.enabled ? commissionSlabs.salaryCurrency : form.currency,
                )}
              </p>
            ) : null}
            {errors.offerSalary ? <p className="mt-1 text-xs text-red-600">{errors.offerSalary}</p> : null}
          </div>
          <div>
            <DrawerFieldLabel label="Commission %" />
            <input
              type="number"
              value={form.commissionPercentage}
              onChange={(event) => {
                setPctEditedManually(true);
                setForm((current) => ({ ...current, commissionPercentage: event.target.value }));
              }}
              className={DRAWER_FORM_INPUT}
            />
            <p className="mt-1 text-xs text-slate-500">
              {commissionSlabs.enabled && !pctEditedManually
                ? `From org commission slabs (${commissionSlabs.basis === 'job_salary' ? 'job salary range' : 'offer salary'}). Change the % to override.`
                : 'Used to calculate placement fee from offer salary.'}
            </p>
          </div>
        </div>
      </DrawerSectionCard>

      <DrawerSectionCard title="Schedule & Status" subtitle="Dates, employment type, and workflow" icon={Calendar} accent="amber">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <DrawerFieldLabel label="Offer Date" required />
            <input
              type="date"
              value={form.offerDate}
              onChange={(event) => setForm((current) => ({ ...current, offerDate: event.target.value }))}
              className={DRAWER_FORM_INPUT}
            />
            {errors.offerDate ? <p className="mt-1 text-xs text-red-600">{errors.offerDate}</p> : null}
          </div>
          <div>
            <DrawerFieldLabel label="Expected Joining Date" />
            <input
              type="date"
              value={form.expectedJoiningDate}
              onChange={(event) => setForm((current) => ({ ...current, expectedJoiningDate: event.target.value }))}
              className={DRAWER_FORM_INPUT}
            />
            {errors.expectedJoiningDate ? (
              <p className="mt-1 text-xs text-red-600">{errors.expectedJoiningDate}</p>
            ) : form.status === 'JOINING_SCHEDULED' ? (
              <p className="mt-1 text-xs text-slate-500">Required when status is Joining Scheduled.</p>
            ) : null}
          </div>
          <div>
            <DrawerFieldLabel label="Employment Type" required />
            <DrawerSelectDropdown
              value={form.employmentType}
              preferUpward
              options={employmentTypes.map((type) => ({ value: type, label: type }))}
              onChange={(employmentType) =>
                setForm((current) => ({ ...current, employmentType: employmentType as EmploymentType }))
              }
            />
          </div>
          <div>
            <DrawerFieldLabel label="Status" required />
            {isResendMode ? (
              <div className={`${DRAWER_FORM_INPUT} flex items-center bg-slate-50 font-medium`}>Offer Sent</div>
            ) : (
              <DrawerSelectDropdown
                value={form.status}
                preferUpward
                options={PLACEMENT_STATUS_OPTIONS.map((status) => ({
                  value: status,
                  label: getPlacementStatusLabel(status),
                }))}
                onChange={(status) =>
                  setForm((current) => ({ ...current, status: status as PlacementStatus }))
                }
              />
            )}
            {errors.status ? <p className="mt-1 text-xs text-red-600">{errors.status}</p> : null}
            {!isEditMode && !isResendMode && form.status === 'OFFER_SENT' ? (
              <p className="mt-1 text-xs text-slate-500">
                Default when sending an offer letter to the candidate on Phase 1.
              </p>
            ) : null}
            {isResendMode ? (
              <p className="mt-1 text-xs text-slate-500">
                Status will move back to Offer Sent so the candidate can accept or reject again.
              </p>
            ) : null}
          </div>
        </div>
      </DrawerSectionCard>

      <DrawerSectionCard title="Documents & Notes" subtitle="Offer letter and internal notes" icon={Upload} accent="sky">
        {!isEditMode || isResendMode ? (
          <div className="mb-4 space-y-3 rounded-xl border border-dashed border-sky-200 bg-gradient-to-br from-white via-sky-50/40 to-indigo-50/20 p-4">
            <DrawerFieldLabel
              label={isResendMode ? 'Upload revised offer letter (PDF)' : 'Upload Offer Letter (PDF)'}
            />
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 transition-colors hover:border-sky-300 hover:bg-sky-50/40">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/20">
                <Upload className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-semibold text-slate-900">
                  {offerLetter?.name || 'Choose PDF file to upload'}
                </p>
                <p className="text-slate-500">PDF only · optional offer letter attachment</p>
              </div>
              <span className="shrink-0 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white">
                Browse
              </span>
              <input
                type="file"
                accept="application/pdf"
                onChange={(event) => setOfferLetter(event.target.files?.[0] || null)}
                className="hidden"
              />
            </label>
            {errors.offerLetter ? <p className="mt-1 text-xs text-red-600">{errors.offerLetter}</p> : null}
          </div>
        ) : null}
        <div>
          <DrawerFieldLabel label="Notes" />
          <textarea
            rows={4}
            value={form.notes}
            onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            className={`${DRAWER_FORM_INPUT} resize-none`}
            placeholder="Internal notes for this placement…"
          />
        </div>
      </DrawerSectionCard>
    </DrawerFormShell>
  );
}
