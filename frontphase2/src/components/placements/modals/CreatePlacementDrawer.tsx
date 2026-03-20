'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Upload, X } from 'lucide-react';
import type { CreatePlacementPayload, EmploymentType } from '../../../types/placement';
import { calculatePlacementFee } from '../../../utils/placements';

interface CreatePlacementDrawerProps {
  isOpen: boolean;
  isSubmitting: boolean;
  currentUserId?: string;
  candidates: Array<{ id: string; name: string; email: string }>;
  jobs: Array<{ id: string; title: string; clientId?: string; clientName: string }>;
  recruiters: Array<{ id: string; name: string; email: string }>;
  prefill?: Partial<Pick<CreatePlacementPayload, 'candidateId' | 'jobId' | 'companyId' | 'recruiterId'>>;
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
  offerDate: '',
  expectedJoiningDate: '',
  employmentType: 'PERMANENT' as EmploymentType,
  notes: '',
};

export function CreatePlacementDrawer({
  isOpen,
  isSubmitting,
  currentUserId,
  candidates,
  jobs,
  recruiters,
  prefill,
  onClose,
  onSubmit,
}: CreatePlacementDrawerProps) {
  const [form, setForm] = useState(initialState);
  const [offerLetter, setOfferLetter] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [feeEditedManually, setFeeEditedManually] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setForm({
        ...initialState,
        recruiterId: currentUserId || '',
        offerDate: new Date().toISOString().slice(0, 10),
        ...(prefill?.candidateId ? { candidateId: prefill.candidateId } : null),
        ...(prefill?.jobId ? { jobId: prefill.jobId } : null),
        ...(prefill?.recruiterId ? { recruiterId: prefill.recruiterId } : null),
      });
      setOfferLetter(null);
      setErrors({});
      setFeeEditedManually(false);
    }
  }, [isOpen, currentUserId, prefill?.candidateId, prefill?.jobId, prefill?.recruiterId]);

  const selectedJob = useMemo(() => jobs.find((job) => job.id === form.jobId) || null, [jobs, form.jobId]);

  useEffect(() => {
    const salary = Number(form.offerSalary || 0);
    if (salary > 0 && !feeEditedManually) {
      setForm((current) => ({
        ...current,
        placementFee: String(Math.round(calculatePlacementFee(salary, 10))),
      }));
    }
  }, [form.offerSalary, feeEditedManually]);

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!form.candidateId) nextErrors.candidateId = 'Candidate is required';
    if (!form.jobId) nextErrors.jobId = 'Job is required';
    if (!form.offerSalary || Number(form.offerSalary) <= 0) nextErrors.offerSalary = 'Offer salary is required';
    if (!form.placementFee || Number(form.placementFee) <= 0) nextErrors.placementFee = 'Placement fee is required';
    if (!form.offerDate) nextErrors.offerDate = 'Offer date is required';
    if (!form.employmentType) nextErrors.employmentType = 'Employment type is required';
    setErrors(nextErrors);
    return !Object.keys(nextErrors).length;
  };

  return (
    <AnimatePresence>
      {isOpen ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] bg-slate-900/40"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.25 }}
            className="fixed right-0 top-0 z-[100] flex h-full w-full flex-col bg-white shadow-2xl sm:max-w-[520px]"
          >
            <div className="flex items-center justify-between border-b border-[#E5E7EB] px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-[#111827]">Add Manual Placement</h2>
                <p className="text-sm text-[#6B7280]">Create a placement and optionally upload the offer letter.</p>
              </div>
              <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#111827]">Candidate*</label>
                <select
                  value={form.candidateId}
                  onChange={(event) => setForm((current) => ({ ...current, candidateId: event.target.value }))}
                  className="h-11 w-full rounded-xl border border-[#D1D5DB] px-3 text-sm outline-none focus:border-[#2563EB]"
                >
                  <option value="">Select candidate</option>
                  {candidates.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name} • {candidate.email}
                    </option>
                  ))}
                </select>
                {errors.candidateId ? <p className="mt-1 text-xs text-red-600">{errors.candidateId}</p> : null}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#111827]">Job*</label>
                <select
                  value={form.jobId}
                  onChange={(event) => setForm((current) => ({ ...current, jobId: event.target.value }))}
                  className="h-11 w-full rounded-xl border border-[#D1D5DB] px-3 text-sm outline-none focus:border-[#2563EB]"
                >
                  <option value="">Select job</option>
                  {jobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.title} • {job.clientName}
                    </option>
                  ))}
                </select>
                {errors.jobId ? <p className="mt-1 text-xs text-red-600">{errors.jobId}</p> : null}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#111827]">Company</label>
                <input
                  value={selectedJob?.clientName || ''}
                  readOnly
                  className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-3 text-sm text-[#6B7280]"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#111827]">Recruiter</label>
                <select
                  value={form.recruiterId}
                  onChange={(event) => setForm((current) => ({ ...current, recruiterId: event.target.value }))}
                  className="h-11 w-full rounded-xl border border-[#D1D5DB] px-3 text-sm outline-none focus:border-[#2563EB]"
                >
                  <option value="">Select recruiter</option>
                  {recruiters.map((recruiter) => (
                    <option key={recruiter.id} value={recruiter.id}>
                      {recruiter.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#111827]">Offer Salary*</label>
                <input
                  type="number"
                  value={form.offerSalary}
                  onChange={(event) => setForm((current) => ({ ...current, offerSalary: event.target.value }))}
                  className="h-11 w-full rounded-xl border border-[#D1D5DB] px-3 text-sm outline-none focus:border-[#2563EB]"
                />
                {errors.offerSalary ? <p className="mt-1 text-xs text-red-600">{errors.offerSalary}</p> : null}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#111827]">Placement Fee*</label>
                <input
                  type="number"
                  value={form.placementFee}
                  onChange={(event) => {
                    setFeeEditedManually(true);
                    setForm((current) => ({ ...current, placementFee: event.target.value }));
                  }}
                  className="h-11 w-full rounded-xl border border-[#D1D5DB] px-3 text-sm outline-none focus:border-[#2563EB]"
                />
                {errors.placementFee ? <p className="mt-1 text-xs text-red-600">{errors.placementFee}</p> : null}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#111827]">Commission %</label>
                <input
                  type="number"
                  value={form.commissionPercentage}
                  onChange={(event) => setForm((current) => ({ ...current, commissionPercentage: event.target.value }))}
                  className="h-11 w-full rounded-xl border border-[#D1D5DB] px-3 text-sm outline-none focus:border-[#2563EB]"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#111827]">Offer Date*</label>
                <input
                  type="date"
                  value={form.offerDate}
                  onChange={(event) => setForm((current) => ({ ...current, offerDate: event.target.value }))}
                  className="h-11 w-full rounded-xl border border-[#D1D5DB] px-3 text-sm outline-none focus:border-[#2563EB]"
                />
                {errors.offerDate ? <p className="mt-1 text-xs text-red-600">{errors.offerDate}</p> : null}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#111827]">Expected Joining Date</label>
                <input
                  type="date"
                  value={form.expectedJoiningDate}
                  onChange={(event) => setForm((current) => ({ ...current, expectedJoiningDate: event.target.value }))}
                  className="h-11 w-full rounded-xl border border-[#D1D5DB] px-3 text-sm outline-none focus:border-[#2563EB]"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#111827]">Employment Type*</label>
                <select
                  value={form.employmentType}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, employmentType: event.target.value as EmploymentType }))
                  }
                  className="h-11 w-full rounded-xl border border-[#D1D5DB] px-3 text-sm outline-none focus:border-[#2563EB]"
                >
                  {employmentTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-[#111827]">Upload Offer Letter (PDF)</label>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-[#D1D5DB] px-4 py-4 hover:bg-slate-50">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-[#2563EB]">
                    <Upload className="h-4 w-4" />
                  </div>
                  <div className="text-sm">
                    <p className="font-medium text-[#111827]">{offerLetter?.name || 'Choose PDF file'}</p>
                    <p className="text-[#6B7280]">Upload offer letter as PDF</p>
                  </div>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(event) => setOfferLetter(event.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="md:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-[#111827]">Notes</label>
                <textarea
                  rows={4}
                  value={form.notes}
                  onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                  className="w-full rounded-xl border border-[#D1D5DB] px-3 py-3 text-sm outline-none focus:border-[#2563EB]"
                />
              </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-[#E5E7EB] px-6 py-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-[#D1D5DB] px-4 py-2 text-sm font-medium text-[#374151] hover:bg-[#F9FAFB]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={async () => {
                  if (!validate()) return;
                  await onSubmit(
                    {
                      candidateId: form.candidateId,
                      jobId: form.jobId,
                      companyId: selectedJob?.clientId,
                      recruiterId: form.recruiterId || currentUserId,
                      offerSalary: form.offerSalary,
                      placementFee: form.placementFee,
                      commissionPercentage: form.commissionPercentage,
                      offerDate: form.offerDate,
                      expectedJoiningDate: form.expectedJoiningDate || undefined,
                      employmentType: form.employmentType,
                      notes: form.notes || undefined,
                    },
                    offerLetter
                  );
                }}
                className="rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'Creating...' : 'Create Placement'}
              </button>
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
