'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarClock, ChevronDown, LayoutGrid, MessageSquare, Pencil, X } from 'lucide-react';
import { HqPrimaryButton, HqSecondaryButton } from './hqUi';
import { apiHqAddCompanyFollowUp, apiHqAddCompanyRemark, apiHqCompleteCompanyFollowUp, apiHqDeleteCompanyFollowUp, apiHqUpdateCompanyFollowUp } from '@/lib/api';
import { HqFollowUpTabPanel } from './HqFollowUpTabPanel';
import { DrawerTabBar } from '../drawers/DrawerTabBar';
import {
  defaultNextFollowUpLocal,
  formatNextFollowUpDisplay,
  HQ_COMPANY_FOLLOW_UP_TYPES,
  HQ_COMPANY_INDUSTRY_OPTIONS,
  HQ_COMPANY_MODULE_OPTIONS,
  HQ_COMPANY_SOURCE_OPTIONS,
  HQ_COMPANY_STATUS_LABELS,
  HQ_COMPANY_STATUS_STYLES,
  HQ_COMPANY_TABS,
  toDatetimeLocalValue,
  type HqCompanyDrawerTab,
  type HqCompanyRow,
  type HqCompanyScore,
  type HqCompanyStatus,
} from '@/app/hq/company/hqCompaniesData';

const DRAWER_TABS: { id: HqCompanyDrawerTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'details', label: 'Details', icon: LayoutGrid },
  { id: 'followup', label: 'Follow-up', icon: CalendarClock },
  { id: 'remarks', label: 'Remarks', icon: MessageSquare },
];

export type EditHqCompanyFormValues = {
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
  status: HqCompanyStatus;
};

const VALUE_CLASS =
  'w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 text-sm text-slate-800';

const INPUT_CLASS =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200';

function normalizeHqModules(values: string[] | null | undefined, productLine?: string | null): string[] {
  const allowed = HQ_COMPANY_MODULE_OPTIONS;
  const keys = new Set(
    (values || []).map((item) => String(item || '').trim().toLowerCase()).filter(Boolean),
  );
  const line = String(productLine || '').toLowerCase();
  if (line.includes('crm')) keys.add('crm');
  if (line.includes('recruitment')) keys.add('recruitment');
  return allowed.filter((module) => keys.has(module.toLowerCase()));
}

function companyToFormValues(company: HqCompanyRow): EditHqCompanyFormValues {
  return {
    companyName: company.name,
    primaryContactName: company.contact,
    email: company.email || '',
    phone: company.phone || '',
    website: company.website || '',
    industry: company.industry,
    country: company.country || '',
    expectedUsers: String(company.users ?? ''),
    estimatedDealValue: String(company.estimatedDealValue ?? ''),
    accountOwner: company.owner,
    companySource: company.companySource || '',
    nextFollowUpAt: toDatetimeLocalValue(company.nextFollowUpAt) || defaultNextFollowUpLocal(),
    interestedModules: normalizeHqModules(company.interestedModules, company.hqProductLine),
    initialNotes: company.initialNotes || '',
    status: company.status,
  };
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <p className="mb-1.5 text-sm font-medium text-slate-800">
      {children}
      {required ? <span className="ml-0.5 text-rose-500">*</span> : null}
    </p>
  );
}

function DetailValue({ value, placeholder = '—' }: { value?: string | number | null; placeholder?: string }) {
  const text =
    value === null || value === undefined || String(value).trim() === ''
      ? placeholder
      : String(value);
  return <div className={VALUE_CLASS}>{text}</div>;
}

function ScoreBadge({ score }: { score: HqCompanyScore }) {
  if (score === 'Hot') {
    return (
      <span className="inline-flex rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-bold text-rose-700 ring-1 ring-rose-200">
        Hot
      </span>
    );
  }
  if (score === 'Warm') {
    return (
      <span className="inline-flex rounded-full bg-slate-900 px-2.5 py-0.5 text-[11px] font-bold text-white">
        Warm
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-600 ring-1 ring-slate-200">
      Cold
    </span>
  );
}

function StatusBadge({ status }: { status: HqCompanyStatus }) {
  const label = HQ_COMPANY_STATUS_LABELS[status].toUpperCase();
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-black tracking-wide ring-1 ${HQ_COMPANY_STATUS_STYLES[status]}`}
    >
      {label}
    </span>
  );
}

function formatCreatedAt(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function HqCompanyDetailDrawer({
  open,
  company,
  onClose,
  onSave,
  onCompanyUpdated,
  onCreateTenant,
}: {
  open: boolean;
  company: HqCompanyRow | null;
  onClose: () => void;
  onSave: (companyId: string, values: EditHqCompanyFormValues) => Promise<void>;
  onCompanyUpdated: (company: HqCompanyRow) => void;
  /** Open Create Tenant prefilled from this company (Lead → Client → Company → Tenant). */
  onCreateTenant?: (company: HqCompanyRow) => void;
}) {
  const [activeTab, setActiveTab] = useState<HqCompanyDrawerTab>('details');
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<EditHqCompanyFormValues | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [remarkText, setRemarkText] = useState('');
  const [remarkSubmitting, setRemarkSubmitting] = useState(false);
  const [tabError, setTabError] = useState<string | null>(null);

  const companyId = company?.id ?? null;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setIsEditing(false);
      setActiveTab('details');
      setError(null);
      setTabError(null);
      setSubmitting(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !company) return;
    setForm(companyToFormValues(company));
    setIsEditing(false);
    setActiveTab('details');
    setError(null);
    setTabError(null);
    setSubmitting(false);
    setRemarkText('');
  }, [open, companyId]);

  useEffect(() => {
    if (!company || isEditing) return;
    setForm(companyToFormValues(company));
  }, [company, isEditing]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isEditing) {
          setIsEditing(false);
          if (company) setForm(companyToFormValues(company));
          setError(null);
        } else {
          onClose();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose, isEditing, company]);

  if (!mounted || !open || !company || !form) return null;

  const selectedModules = new Set(
    isEditing
      ? form.interestedModules
      : normalizeHqModules(company.interestedModules, company.hqProductLine),
  );

  const toggleModule = (module: string) => {
    setForm((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        interestedModules: prev.interestedModules.includes(module)
          ? prev.interestedModules.filter((m) => m !== module)
          : [...prev.interestedModules, module],
      };
    });
  };

  const handleCancelEdit = () => {
    setForm(companyToFormValues(company));
    setError(null);
    setIsEditing(false);
  };

  const handleTabChange = (tab: HqCompanyDrawerTab) => {
    if (isEditing) {
      setForm(companyToFormValues(company));
      setIsEditing(false);
      setError(null);
    }
    setTabError(null);
    setActiveTab(tab);
  };

  const handleCompanyFollowUpUpdated = (updated: HqCompanyRow) => {
    onCompanyUpdated(updated);
  };

  const handleScheduleFollowUp = async (values: {
    type: string;
    scheduledAt: string;
    notes: string;
  }) => {
    try {
      const result = await apiHqAddCompanyFollowUp(company.id, values);
      const updated = result.data?.company;
      if (updated) handleCompanyFollowUpUpdated(updated);
    } catch (err) {
      setTabError(err instanceof Error ? err.message : 'Failed to schedule follow-up');
      throw err;
    }
  };

  const handleUpdateFollowUp = async (
    followUpId: string,
    values: { type: string; scheduledAt: string; notes: string }
  ) => {
    try {
      const result = await apiHqUpdateCompanyFollowUp(company.id, followUpId, values);
      const updated = result.data?.company;
      if (updated) handleCompanyFollowUpUpdated(updated);
    } catch (err) {
      setTabError(err instanceof Error ? err.message : 'Failed to update follow-up');
      throw err;
    }
  };

  const handleCompleteFollowUp = async (followUpId: string) => {
    try {
      const result = await apiHqCompleteCompanyFollowUp(company.id, followUpId);
      const updated = result.data?.company;
      if (updated) handleCompanyFollowUpUpdated(updated);
    } catch (err) {
      setTabError(err instanceof Error ? err.message : 'Failed to complete follow-up');
      throw err;
    }
  };

  const handleDeleteFollowUp = async (followUpId: string) => {
    try {
      const result = await apiHqDeleteCompanyFollowUp(company.id, followUpId);
      const updated = result.data?.company;
      if (updated) handleCompanyFollowUpUpdated(updated);
    } catch (err) {
      setTabError(err instanceof Error ? err.message : 'Failed to delete follow-up');
      throw err;
    }
  };

  const handleAddRemark = async (e: React.FormEvent) => {
    e.preventDefault();
    setTabError(null);
    if (!remarkText.trim()) {
      setTabError('Remark text is required.');
      return;
    }
    setRemarkSubmitting(true);
    try {
      const result = await apiHqAddCompanyRemark(company.id, { text: remarkText.trim() });
      const updated = result.data?.company;
      if (updated) {
        onCompanyUpdated(updated);
        setRemarkText('');
      }
    } catch (err) {
      setTabError(err instanceof Error ? err.message : 'Failed to add remark');
    } finally {
      setRemarkSubmitting(false);
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
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
      await onSave(company.id, form);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update company');
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[1200]">
      <button
        type="button"
        aria-label="Close company drawer backdrop"
        className="absolute inset-0 z-0 bg-slate-900/40 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="hq-company-detail-title"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        className="absolute right-0 top-0 z-10 flex h-full w-full max-w-2xl flex-col border-l border-slate-200 bg-white shadow-2xl pointer-events-auto"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div>
            <h2 id="hq-company-detail-title" className="text-2xl font-bold text-slate-900">
              {activeTab === 'followup'
                ? 'Follow-up'
                : activeTab === 'remarks'
                  ? 'Remarks'
                  : isEditing
                    ? 'Edit Company'
                    : 'Company Details'}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {activeTab === 'followup'
                ? `Schedule and track follow-ups for ${company.name}.`
                : activeTab === 'remarks'
                  ? `Add internal remarks and notes for ${company.name}.`
                  : isEditing
                    ? 'Update company details below and save to your CRM.'
                    : `Full CRM profile for ${company.name}.`}
            </p>
            {!isEditing ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <StatusBadge status={company.status} />
                <ScoreBadge score={company.score} />
                <span className="text-xs text-slate-500">
                  Next follow-up: {formatNextFollowUpDisplay(company.nextFollowUpAt) || company.nextFollowUp}
                </span>
              </div>
            ) : null}
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

        <DrawerTabBar
          ariaLabel="HQ company sections"
          tabs={DRAWER_TABS.map((tab) => ({
            ...tab,
            badge:
              tab.id === 'followup'
                ? (company.followUps?.length ?? 0)
                : tab.id === 'remarks'
                  ? (company.remarks?.length ?? 0)
                  : 0,
          }))}
          activeId={activeTab}
          onChange={handleTabChange}
        />

        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {error && activeTab === 'details' ? (
              <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </p>
            ) : null}
            {tabError && activeTab === 'remarks' ? (
              <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {tabError}
              </p>
            ) : null}

            {activeTab === 'details' ? (
              <div className="space-y-6">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <FieldLabel required={isEditing}>Company Name</FieldLabel>
                    {isEditing ? (
                      <input
                        className={INPUT_CLASS}
                        value={form.companyName}
                        onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                      />
                    ) : (
                      <DetailValue value={company.name} />
                    )}
                  </div>
                  <div>
                    <FieldLabel required={isEditing}>Primary Contact</FieldLabel>
                    {isEditing ? (
                      <input
                        className={INPUT_CLASS}
                        value={form.primaryContactName}
                        onChange={(e) => setForm({ ...form, primaryContactName: e.target.value })}
                      />
                    ) : (
                      <DetailValue value={company.contact} />
                    )}
                  </div>
                  <div>
                    <FieldLabel required={isEditing}>Email</FieldLabel>
                    {isEditing ? (
                      <input
                        type="email"
                        className={INPUT_CLASS}
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                      />
                    ) : (
                      <DetailValue value={company.email} />
                    )}
                  </div>
                  <div>
                    <FieldLabel>Phone</FieldLabel>
                    {isEditing ? (
                      <input
                        type="tel"
                        className={INPUT_CLASS}
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      />
                    ) : (
                      <DetailValue value={company.phone} />
                    )}
                  </div>
                  <div className="sm:col-span-2">
                    <FieldLabel>Website</FieldLabel>
                    {isEditing ? (
                      <input
                        type="url"
                        className={INPUT_CLASS}
                        value={form.website}
                        onChange={(e) => setForm({ ...form, website: e.target.value })}
                      />
                    ) : (
                      <DetailValue value={company.website} />
                    )}
                  </div>
                  <div>
                    <FieldLabel required={isEditing}>Industry</FieldLabel>
                    {isEditing ? (
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
                    ) : (
                      <DetailValue value={company.industry} />
                    )}
                  </div>
                  <div>
                    <FieldLabel required={isEditing}>Country</FieldLabel>
                    {isEditing ? (
                      <input
                        className={INPUT_CLASS}
                        value={form.country}
                        onChange={(e) => setForm({ ...form, country: e.target.value })}
                      />
                    ) : (
                      <DetailValue value={company.country} />
                    )}
                  </div>
                  <div>
                    <FieldLabel required={isEditing}>Expected Users</FieldLabel>
                    {isEditing ? (
                      <input
                        type="number"
                        min={1}
                        className={INPUT_CLASS}
                        value={form.expectedUsers}
                        onChange={(e) => setForm({ ...form, expectedUsers: e.target.value })}
                      />
                    ) : (
                      <DetailValue value={company.users} />
                    )}
                  </div>
                  <div>
                    <FieldLabel required={isEditing}>Estimated Deal Value ($)</FieldLabel>
                    {isEditing ? (
                      <input
                        type="number"
                        min={0}
                        className={INPUT_CLASS}
                        value={form.estimatedDealValue}
                        onChange={(e) => setForm({ ...form, estimatedDealValue: e.target.value })}
                      />
                    ) : (
                      <DetailValue
                        value={
                          company.estimatedDealValue !== undefined && company.estimatedDealValue !== null
                            ? company.estimatedDealValue.toLocaleString()
                            : undefined
                        }
                      />
                    )}
                  </div>
                  <div>
                    <FieldLabel required={isEditing}>Account Owner</FieldLabel>
                    {isEditing ? (
                      <input
                        className={INPUT_CLASS}
                        value={form.accountOwner}
                        onChange={(e) => setForm({ ...form, accountOwner: e.target.value })}
                      />
                    ) : (
                      <DetailValue value={company.owner} />
                    )}
                  </div>
                  <div>
                    <FieldLabel required={isEditing}>Company Source</FieldLabel>
                    {isEditing ? (
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
                    ) : (
                      <DetailValue value={company.companySource} />
                    )}
                  </div>
                  <div>
                    <FieldLabel required={isEditing}>Status</FieldLabel>
                    {isEditing ? (
                      <div className="relative">
                        <select
                          className={`${INPUT_CLASS} appearance-none pr-10`}
                          value={form.status}
                          onChange={(e) => setForm({ ...form, status: e.target.value as HqCompanyStatus })}
                        >
                          {HQ_COMPANY_TABS.filter((tab) => tab.id !== 'all').map((tab) => (
                            <option key={tab.id} value={tab.id}>
                              {tab.label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      </div>
                    ) : (
                      <div className="pt-1">
                        <StatusBadge status={company.status} />
                      </div>
                    )}
                  </div>
                  <div className="sm:col-span-2">
                    <FieldLabel required={isEditing}>Next Follow-up (Date & Time)</FieldLabel>
                    {isEditing ? (
                      <input
                        type="datetime-local"
                        className={INPUT_CLASS}
                        value={form.nextFollowUpAt}
                        onChange={(e) => setForm({ ...form, nextFollowUpAt: e.target.value })}
                      />
                    ) : (
                      <DetailValue
                        value={formatNextFollowUpDisplay(company.nextFollowUpAt) || company.nextFollowUp}
                      />
                    )}
                  </div>
                  {!isEditing ? (
                    <div>
                      <FieldLabel>Created</FieldLabel>
                      <DetailValue value={formatCreatedAt(company.createdAt)} />
                    </div>
                  ) : null}
                </div>

                <div className="mt-6 border-t border-slate-100 pt-6">
                  <FieldLabel required={isEditing}>Interested Modules</FieldLabel>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {HQ_COMPANY_MODULE_OPTIONS.map((module) => {
                      const checked = selectedModules.has(module);
                      if (isEditing) {
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
                      }
                      return (
                        <div
                          key={module}
                          className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm ${
                            checked
                              ? 'border-slate-300 bg-slate-100 text-slate-900'
                              : 'border-slate-100 bg-slate-50/40 text-slate-400'
                          }`}
                        >
                          <span
                            className={`flex h-4 w-4 items-center justify-center rounded border text-[10px] font-bold ${
                              checked
                                ? 'border-slate-900 bg-slate-900 text-white'
                                : 'border-slate-200 bg-white text-transparent'
                            }`}
                            aria-hidden
                          >
                            ✓
                          </span>
                          {module}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-6 border-t border-slate-100 pt-6">
                  <FieldLabel>Initial Notes</FieldLabel>
                  {isEditing ? (
                    <textarea
                      rows={4}
                      className={`${INPUT_CLASS} min-h-[100px] resize-y`}
                      value={form.initialNotes}
                      onChange={(e) => setForm({ ...form, initialNotes: e.target.value })}
                    />
                  ) : (
                    <div className={`${VALUE_CLASS} min-h-[100px] whitespace-pre-wrap`}>
                      {company.initialNotes?.trim() ? company.initialNotes : '—'}
                    </div>
                  )}
                </div>
              </div>
            ) : activeTab === 'followup' ? (
              <HqFollowUpTabPanel
                key={company.id}
                nextFollowUpAt={company.nextFollowUpAt}
                nextFollowUpLabel={company.nextFollowUp}
                followUps={company.followUps ?? []}
                followUpTypes={HQ_COMPANY_FOLLOW_UP_TYPES}
                tabError={tabError}
                onClearError={() => setTabError(null)}
                onSchedule={handleScheduleFollowUp}
                onUpdate={handleUpdateFollowUp}
                onComplete={handleCompleteFollowUp}
                onDelete={handleDeleteFollowUp}
              />
            ) : (
              <div className="space-y-6">
                <section className="rounded-2xl border border-slate-200 p-4">
                  <h3 className="text-sm font-bold text-slate-900">Add Remark</h3>
                  <form onSubmit={handleAddRemark} className="mt-4 space-y-4">
                    <textarea
                      rows={4}
                      className={`${INPUT_CLASS} min-h-[100px] resize-y`}
                      placeholder="Write an internal remark about this company..."
                      value={remarkText}
                      onChange={(e) => setRemarkText(e.target.value)}
                    />
                    <div className="flex justify-end">
                      <HqPrimaryButton type="submit" disabled={remarkSubmitting}>
                        {remarkSubmitting ? 'Adding…' : 'Add Remark'}
                      </HqPrimaryButton>
                    </div>
                  </form>
                </section>

                <section>
                  <h3 className="mb-3 text-sm font-bold text-slate-900">Remarks History</h3>
                  {(company.remarks?.length ?? 0) === 0 ? (
                    <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                      No remarks yet.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {company.remarks?.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-xl border border-slate-200 bg-slate-50/70 p-4"
                        >
                          <p className="text-sm text-slate-800 whitespace-pre-wrap">{item.text}</p>
                          <p className="mt-2 text-[11px] text-slate-400">
                            {formatCreatedAt(item.createdAt)}
                            {item.createdByEmail ? ` · ${item.createdByEmail}` : ''}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
            {activeTab === 'details' && isEditing ? (
              <>
                <HqSecondaryButton type="button" onClick={handleCancelEdit} disabled={submitting}>
                  Cancel
                </HqSecondaryButton>
                <HqPrimaryButton type="button" onClick={() => void handleSave()} disabled={submitting}>
                  {submitting ? 'Saving…' : 'Save Changes'}
                </HqPrimaryButton>
              </>
            ) : (
              <>
                <HqSecondaryButton type="button" onClick={onClose}>
                  Close
                </HqSecondaryButton>
                {activeTab === 'details' && onCreateTenant && company && !company.tenantDbName ? (
                  <HqSecondaryButton
                    type="button"
                    onClick={() => {
                      onCreateTenant(company);
                    }}
                  >
                    Create tenant
                  </HqSecondaryButton>
                ) : null}
                {activeTab === 'details' && company?.tenantDbName ? (
                  <span className="mr-auto text-xs font-semibold text-emerald-700">
                    Tenant: {company.tenantDbName}
                  </span>
                ) : null}
                {activeTab === 'details' ? (
                  <HqPrimaryButton
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsEditing(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                    Edit Company
                  </HqPrimaryButton>
                ) : null}
              </>
            )}
          </div>
        </div>
      </aside>
    </div>,
    document.body
  );
}
