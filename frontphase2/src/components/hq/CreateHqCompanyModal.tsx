'use client';

import React, { useEffect, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { HqPrimaryButton, HqSecondaryButton } from './hqUi';
import {
  defaultNextFollowUpLocal,
  HQ_COMPANY_INDUSTRY_OPTIONS,
  HQ_COMPANY_MODULE_OPTIONS,
  HQ_COMPANY_SOURCE_OPTIONS,
} from '@/app/hq/company/hqCompaniesData';

export type CreateHqCompanyFormValues = {
  companyName: string;
  primaryContactName: string;
  email: string;
  phone: string;
  website: string;
  industry: string;
  country: string;
  expectedUsers: string;
  estimatedDealValue: string;
  accountOwner: string;
  companySource: string;
  nextFollowUpAt: string;
  interestedModules: string[];
  initialNotes: string;
};

const EMPTY_FORM: CreateHqCompanyFormValues = {
  companyName: '',
  primaryContactName: '',
  email: '',
  phone: '',
  website: '',
  industry: '',
  country: '',
  expectedUsers: '',
  estimatedDealValue: '',
  accountOwner: '',
  companySource: '',
  nextFollowUpAt: '',
  interestedModules: [],
  initialNotes: '',
};

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

export function CreateHqCompanyModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (values: CreateHqCompanyFormValues) => Promise<void>;
}) {
  const [form, setForm] = useState<CreateHqCompanyFormValues>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({ ...EMPTY_FORM, nextFollowUpAt: defaultNextFollowUpLocal() });
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

    if (!form.companyName.trim() || !form.primaryContactName.trim() || !form.email.trim()) {
      setError('Company name, primary contact, and email are required.');
      return;
    }
    if (!form.industry || !form.country.trim() || !form.expectedUsers.trim() || !form.estimatedDealValue.trim()) {
      setError('Please fill in all required fields.');
      return;
    }
    if (!form.accountOwner.trim() || !form.companySource) {
      setError('Account owner and company source are required.');
      return;
    }
    if (!form.nextFollowUpAt.trim()) {
      setError('Next follow-up date and time is required.');
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
      setError(err instanceof Error ? err.message : 'Failed to create company');
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
        aria-labelledby="create-hq-company-title"
        className="relative my-4 w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5 sm:px-8">
          <div>
            <h2 id="create-hq-company-title" className="text-2xl font-bold text-slate-900">
              Create New Company
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Enter company details below to add them to your CRM pipeline.
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
              <FieldLabel required>Company Name</FieldLabel>
              <input
                className={INPUT_CLASS}
                placeholder="e.g. Acme Corp"
                value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
              />
            </div>
            <div>
              <FieldLabel required>Primary Contact</FieldLabel>
              <input
                className={INPUT_CLASS}
                placeholder="e.g. John Doe"
                value={form.primaryContactName}
                onChange={(e) => setForm({ ...form, primaryContactName: e.target.value })}
              />
            </div>
            <div>
              <FieldLabel required>Email</FieldLabel>
              <input
                type="email"
                className={INPUT_CLASS}
                placeholder="contact@example.com"
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
            <div className="sm:col-span-2">
              <FieldLabel>Website</FieldLabel>
              <input
                type="url"
                className={INPUT_CLASS}
                placeholder="https://example.com"
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
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
                  {HQ_COMPANY_INDUSTRY_OPTIONS.map((opt) => (
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
            <div>
              <FieldLabel required>Account Owner</FieldLabel>
              <input
                className={INPUT_CLASS}
                placeholder="e.g. Jane Admin"
                value={form.accountOwner}
                onChange={(e) => setForm({ ...form, accountOwner: e.target.value })}
              />
            </div>
            <div>
              <FieldLabel required>Company Source</FieldLabel>
              <div className="relative">
                <select
                  className={`${INPUT_CLASS} appearance-none pr-10`}
                  value={form.companySource}
                  onChange={(e) => setForm({ ...form, companySource: e.target.value })}
                >
                  <option value="">Select source</option>
                  {HQ_COMPANY_SOURCE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </div>
            <div className="sm:col-span-2">
              <FieldLabel required>Next Follow-up (Date & Time)</FieldLabel>
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
              {HQ_COMPANY_MODULE_OPTIONS.map((module) => {
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
              {submitting ? 'Creating…' : 'Create Company'}
            </HqPrimaryButton>
          </div>
        </form>
      </div>
    </div>
  );
}
