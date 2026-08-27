'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Award, Briefcase, Calendar, IndianRupee, Upload, User } from 'lucide-react';
import type { CreatePlacementPayload, EmploymentType, PlacementStatus } from '../../../types/placement';
import {
  calculatePlacementFee,
  getPlacementStatusLabel,
  PLACEMENT_STATUS_OPTIONS,
} from '../../../utils/placements';
import { SUPPORTED_CURRENCIES, formatCurrencyAmount } from '../../../utils/currency';
import { DrawerFormShell, DrawerFormCancelButton } from '../../drawers/DrawerFormShell';
import {
  DrawerFieldLabel,
  DrawerSectionCard,
  DrawerSelectDropdown,
  DRAWER_FORM_INPUT,
} from '../../drawers/drawerFormUi';
import { useOrgCommissionSlabs } from '../../../lib/useOrgCommissionSlabs';
import { resolveCommissionPercent } from '../../../lib/commissionSlabs';

interface CreatePlacementDrawerProps {
  isOpen: boolean;
  isSubmitting: boolean;
  mode?: 'create' | 'edit' | 'resend';
  currentUserId?: string;
  candidates: Array<{ id: string; name: string; email: string }>;
  jobs: Array<{
    id: string;
    title: string;
    clientId?: string;
    clientName: string;
    minSalary?: number | null;
    maxSalary?: number | null;
    salaryAmount?: number | null;
  }>;
  recruiters: Array<{ id: string; name: string; email: string }>;
  prefill?: Partial<Pick<CreatePlacementPayload, 'candidateId' | 'jobId' | 'companyId' | 'recruiterId'>>;
  initialValues?: Partial<CreatePlacementPayload>;
  onClose: () => void;
  onSubmit: (payload: CreatePlacementPayload, offerLetter?: File | null) => Promise<void>;
}

const employmentTypes: EmploymentType[] = ['PERMANENT', 'CONTRACT', 'FREELANCE'];

const initialState = {
  candidateId: '',
  jobId: '',
  recruiterId: '',
  offerSalary: '',
  placementFee: '',
  commissionPercentage: '20',
  currency: 'USD',
  offerDate: '',
  expectedJoiningDate: '',
  employmentType: 'PERMANENT' as EmploymentType,
  status: 'OFFER_SENT' as PlacementStatus,
  notes: '',
};

export function CreatePlacementDrawer({
  isOpen,
  isSubmitting,
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
  const { settings: commissionSlabs } = useOrgCommissionSlabs();

  useEffect(() => {
    if (isOpen) {
      setForm({
        ...initialState,
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
        ...(initialValues?.currency ? { currency: String(initialValues.currency) } : null),
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

  const selectedJob = useMemo(() => jobs.find((job) => job.id === form.jobId) || null, [jobs, form.jobId]);
  const selectedCandidate = useMemo(
    () => candidates.find((candidate) => candidate.id === form.candidateId) || null,
    [candidates, form.candidateId]
  );
  const lockCandidate = Boolean(prefill?.candidateId || initialValues?.candidateId);
  const lockJob = Boolean(prefill?.jobId || initialValues?.jobId);

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
    setForm((current) => {
      const nextPct = String(resolved.percent);
      const nextFee = String(Math.round(resolved.fee || 0));
      const nextCcy = resolved.commissionCurrency || current.currency;
      if (
        current.commissionPercentage === nextPct &&
        current.placementFee === nextFee &&
        current.currency === nextCcy
      ) {
        return current;
      }
      return {
        ...current,
        commissionPercentage: nextPct,
        placementFee: nextFee,
        currency: nextCcy,
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <DrawerFieldLabel label="Candidate" icon={User} iconClassName="text-blue-500" required />
            {lockCandidate ? (
              <div className={`${DRAWER_FORM_INPUT} flex items-center bg-slate-50 font-medium`}>
                {selectedCandidate
                  ? `${selectedCandidate.name} • ${selectedCandidate.email}`
                  : 'Selected candidate'}
              </div>
            ) : (
              <DrawerSelectDropdown
                value={form.candidateId}
                preferUpward
                placeholder="Select candidate"
                error={Boolean(errors.candidateId)}
                options={[
                  { value: '', label: 'Select candidate' },
                  ...candidates.map((candidate) => ({
                    value: candidate.id,
                    label: `${candidate.name} • ${candidate.email}`,
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
                {selectedJob
                  ? `${selectedJob.title}${selectedJob.clientName ? ` • ${selectedJob.clientName}` : ''}`
                  : 'Selected job'}
              </div>
            ) : (
              <DrawerSelectDropdown
                value={form.jobId}
                preferUpward
                placeholder="Select job"
                error={Boolean(errors.jobId)}
                options={[
                  { value: '', label: 'Select job' },
                  ...jobs.map((job) => ({
                    value: job.id,
                    label: `${job.title} • ${job.clientName}${!job.clientId ? ' (assign client first)' : ''}`,
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
              placeholder="Select team member"
              options={[
                { value: '', label: 'Select team member' },
                ...recruiters.map((recruiter) => ({
                  value: recruiter.id,
                  label: recruiter.email ? `${recruiter.name} • ${recruiter.email}` : recruiter.name,
                })),
              ]}
              onChange={(recruiterId) => setForm((current) => ({ ...current, recruiterId }))}
            />
          </div>
        </div>
      </DrawerSectionCard>

      <DrawerSectionCard title="Compensation" subtitle="Salary, fee, and currency" icon={IndianRupee} accent="emerald">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <DrawerFieldLabel label="Currency" />
            <DrawerSelectDropdown
              value={form.currency}
              preferUpward
              options={SUPPORTED_CURRENCIES.map((code) => ({ value: code, label: code }))}
              onChange={(currency) => setForm((current) => ({ ...current, currency }))}
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
