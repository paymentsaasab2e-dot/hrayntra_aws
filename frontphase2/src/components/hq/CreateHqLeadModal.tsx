'use client';

import React, { useEffect, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { HqPrimaryButton, HqSecondaryButton } from './hqUi';
import { HQ_LEAD_TABS, type HqLeadStage } from '@/app/hq/leads/hqLeadsData';
import { HqLeadSourceFields, validateHqLeadSourceFields } from './HqLeadSourceFields';

export type CreateHqLeadFormValues = {
  contactName: string;
  companyName: string;
  email: string;
  phone: string;
  industry: string;
  country: string;
  expectedUsers: string;
  estimatedDealValue: string;
  leadSource: string;
  leadSourceDetail: string;
  stage: HqLeadStage;
  nextFollowUpAt: string;
  interestedModules: string[];
  initialNotes: string;
};

const EMPTY_FORM: CreateHqLeadFormValues = {
  contactName: '',
  companyName: '',
  email: '',
  phone: '',
  industry: '',
  country: '',
  expectedUsers: '',
  estimatedDealValue: '',
  leadSource: '',
  leadSourceDetail: '',
  stage: 'new',
  nextFollowUpAt: '',
  interestedModules: [],
  initialNotes: '',
};

const INDUSTRY_OPTIONS = [
  'IT Services',
  'Manufacturing',
  'Technology',
  'Consulting',
  'Media',
  'Security',
  'Real Estate',
  'Healthcare',
  'Staffing',
  'Design',
  'Agriculture',
  'Other',
];

const MODULE_OPTIONS = [
  'Recruitment',
  'Payroll',
  'Time & Attendance',
  'Employee Management',
  'Performance',
];

const INPUT_CLASS =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200';

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="mb-1.5 block text-sm font-medium text-slate-800">
      {children}
      {required ? <span className="ml-0.5 text-rose-500">*</span> : null}
    </label>
  );
}

export function CreateHqLeadModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (values: CreateHqLeadFormValues) => Promise<void>;
}) {
  const [form, setForm] = useState<CreateHqLeadFormValues>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({ ...EMPTY_FORM });
    setError(null);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const toggleModule = (module: string) => {
    setForm((prev) => ({
      ...prev,
      interestedModules: prev.interestedModules.includes(module)
        ? prev.interestedModules.filter((m) => m !== module)
        : [...prev.interestedModules, module],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.contactName.trim() || !form.companyName.trim() || !form.email.trim()) {
      setError('Contact name, company name, and email are required.');
      return;
    }
    if (!form.industry || !form.country.trim() || !form.expectedUsers.trim() || !form.estimatedDealValue.trim()) {
      setError('Please fill in all required fields.');
      return;
    }
    if (!form.leadSource) {
      setError('Lead source is required.');
      return;
    }
    const sourceError = validateHqLeadSourceFields(form.leadSource, form.leadSourceDetail);
    if (sourceError) {
      setError(sourceError);
      return;
    }
    if (form.interestedModules.length === 0) {
      setError('Select at least one interested module.');
      return;
    }

    setSubmitting(true);
    try {
      await onCreate(form);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create lead');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[500] flex items-start justify-center overflow-y-auto p-4 sm:p-6">
      <button
        type="button"
        aria-label="Close modal backdrop"
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-hq-lead-title"
        className="relative my-4 w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5 sm:px-8">
          <div>
            <h2 id="create-hq-lead-title" className="text-2xl font-bold text-slate-900">
              Create New Lead
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Enter the details of the prospective client below to add them to your CRM.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-6 sm:px-8">
          {error ? (
            <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          ) : null}

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <FieldLabel required>Contact Name</FieldLabel>
              <input
                className={INPUT_CLASS}
                placeholder="e.g. John Doe"
                value={form.contactName}
                onChange={(e) => setForm({ ...form, contactName: e.target.value })}
              />
            </div>
            <div>
              <FieldLabel required>Company Name</FieldLabel>
              <input
                className={INPUT_CLASS}
                placeholder="e.g. Acme Corp"
                value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
              />
            </div>
            <div>
              <FieldLabel required>Email</FieldLabel>
              <input
                type="email"
                className={INPUT_CLASS}
                placeholder="john@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <FieldLabel>Phone</FieldLabel>
              <input
                type="tel"
                className={INPUT_CLASS}
                placeholder="+1 (555) 000-0000"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div>
              <FieldLabel required>Industry</FieldLabel>
              <div className="relative">
                <select
                  className={`${INPUT_CLASS} appearance-none pr-10`}
                  value={form.industry}
                  onChange={(e) => setForm({ ...form, industry: e.target.value })}
                >
                  <option value="">Select industry</option>
                  {INDUSTRY_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </div>
            <div>
              <FieldLabel required>Country</FieldLabel>
              <input
                className={INPUT_CLASS}
                placeholder="e.g. United States"
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
              />
            </div>
            <div>
              <FieldLabel required>Expected Users</FieldLabel>
              <input
                type="number"
                min={1}
                className={INPUT_CLASS}
                placeholder="100"
                value={form.expectedUsers}
                onChange={(e) => setForm({ ...form, expectedUsers: e.target.value })}
              />
            </div>
            <div>
              <FieldLabel required>Estimated Deal Value ($)</FieldLabel>
              <input
                type="number"
                min={0}
                className={INPUT_CLASS}
                placeholder="5000"
                value={form.estimatedDealValue}
                onChange={(e) => setForm({ ...form, estimatedDealValue: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <HqLeadSourceFields
                leadSource={form.leadSource}
                leadSourceDetail={form.leadSourceDetail}
                onChange={(patch) => setForm({ ...form, ...patch })}
                required
              />
            </div>
            <div>
              <FieldLabel required>Stage</FieldLabel>
              <div className="relative">
                <select
                  className={`${INPUT_CLASS} appearance-none pr-10`}
                  value={form.stage}
                  onChange={(e) => setForm({ ...form, stage: e.target.value as HqLeadStage })}
                >
                  {HQ_LEAD_TABS.filter((tab) => tab.id !== 'all').map((tab) => (
                    <option key={tab.id} value={tab.id}>
                      {tab.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </div>
            <div className="sm:col-span-2">
              <FieldLabel>Next Follow-up (Date & Time)</FieldLabel>
              <input
                type="datetime-local"
                className={INPUT_CLASS}
                value={form.nextFollowUpAt}
                onChange={(e) => setForm({ ...form, nextFollowUpAt: e.target.value })}
              />
            </div>
          </div>

          <div className="mt-6 border-t border-slate-100 pt-6">
            <FieldLabel required>Interested Modules (Select one or more)</FieldLabel>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {MODULE_OPTIONS.map((module) => {
                const checked = form.interestedModules.includes(module);
                return (
                  <label
                    key={module}
                    className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleModule(module)}
                      className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-300"
                    />
                    {module}
                  </label>
                );
              })}
            </div>
          </div>

          <div className="mt-6 border-t border-slate-100 pt-6">
            <FieldLabel>Initial Notes</FieldLabel>
            <textarea
              rows={4}
              className={`${INPUT_CLASS} mt-1.5 resize-y min-h-[100px]`}
              placeholder="Any context or background information..."
              value={form.initialNotes}
              onChange={(e) => setForm({ ...form, initialNotes: e.target.value })}
            />
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-6">
            <HqSecondaryButton type="button" onClick={onClose}>
              Cancel
            </HqSecondaryButton>
            <HqPrimaryButton type="submit" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create Lead'}
            </HqPrimaryButton>
          </div>
        </form>
      </div>
    </div>
  );
}
