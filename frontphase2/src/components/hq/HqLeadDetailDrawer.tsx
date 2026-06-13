'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarClock, ChevronDown, LayoutGrid, MessageSquare, Pencil, X } from 'lucide-react';
import { HqPrimaryButton, HqSecondaryButton } from './hqUi';
import { apiHqAddLeadFollowUp, apiHqAddLeadRemark } from '@/lib/api';
import {
  HQ_LEAD_FOLLOW_UP_TYPES,
  HQ_LEAD_INDUSTRY_OPTIONS,
  HQ_LEAD_MODULE_OPTIONS,
  HQ_LEAD_SOURCE_OPTIONS,
  HQ_LEAD_STAGE_LABELS,
  HQ_LEAD_STAGE_STYLES,
  HQ_LEAD_TABS,
  defaultNextFollowUpLocal,
  formatNextFollowUpDisplay,
  toDatetimeLocalValue,
  type HqLeadDrawerTab,
  type HqLeadRow,
  type HqLeadScore,
  type HqLeadStage,
} from '@/app/hq/leads/hqLeadsData';

const DRAWER_TABS: { id: HqLeadDrawerTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'details', label: 'Details', icon: LayoutGrid },
  { id: 'followup', label: 'Follow-up', icon: CalendarClock },
  { id: 'remarks', label: 'Remarks', icon: MessageSquare },
];

export type EditHqLeadFormValues = {
  contactName: string;
  companyName: string;
  email: string;
  phone: string;
  industry: string;
  country: string;
  expectedUsers: string;
  estimatedDealValue: string;
  leadOwner: string;
  leadSource: string;
  nextFollowUpAt: string;
  interestedModules: string[];
  initialNotes: string;
  stage: HqLeadStage;
};

const VALUE_CLASS =
  'w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 text-sm text-slate-800';

const INPUT_CLASS =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200';

function leadToFormValues(lead: HqLeadRow): EditHqLeadFormValues {
  return {
    contactName: lead.name,
    companyName: lead.company,
    email: lead.email || '',
    phone: lead.phone || '',
    industry: lead.industry,
    country: lead.country || '',
    expectedUsers: String(lead.users ?? ''),
    estimatedDealValue: String(lead.estimatedDealValue ?? ''),
    leadOwner: lead.owner,
    leadSource: lead.leadSource || '',
    nextFollowUpAt:
      toDatetimeLocalValue(lead.nextFollowUpAt) || defaultNextFollowUpLocal(),
    interestedModules: [...(lead.interestedModules ?? [])],
    initialNotes: lead.initialNotes || '',
    stage: lead.stage,
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

function ScoreBadge({ score }: { score: HqLeadScore }) {
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

function StageBadge({ stage }: { stage: HqLeadStage }) {
  const label = HQ_LEAD_STAGE_LABELS[stage].toUpperCase();
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-black tracking-wide ring-1 ${HQ_LEAD_STAGE_STYLES[stage]}`}
    >
      {label}
    </span>
  );
}

function formatCreatedAt(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function HqLeadDetailDrawer({
  open,
  lead,
  onClose,
  onSave,
  onLeadUpdated,
}: {
  open: boolean;
  lead: HqLeadRow | null;
  onClose: () => void;
  onSave: (leadId: string, values: EditHqLeadFormValues) => Promise<void>;
  onLeadUpdated: (lead: HqLeadRow) => void;
}) {
  const [activeTab, setActiveTab] = useState<HqLeadDrawerTab>('details');
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<EditHqLeadFormValues | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [followUpForm, setFollowUpForm] = useState({
    type: 'Call',
    scheduledAt: defaultNextFollowUpLocal(),
    notes: '',
  });
  const [remarkText, setRemarkText] = useState('');
  const [followUpSubmitting, setFollowUpSubmitting] = useState(false);
  const [remarkSubmitting, setRemarkSubmitting] = useState(false);
  const [tabError, setTabError] = useState<string | null>(null);

  const leadId = lead?.id ?? null;

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
    if (!open || !lead) return;
    setForm(leadToFormValues(lead));
    setIsEditing(false);
    setActiveTab('details');
    setError(null);
    setTabError(null);
    setSubmitting(false);
    setFollowUpForm({
      type: 'Call',
      scheduledAt: toDatetimeLocalValue(lead.nextFollowUpAt) || defaultNextFollowUpLocal(),
      notes: '',
    });
    setRemarkText('');
  }, [open, leadId]);

  useEffect(() => {
    if (!lead || isEditing) return;
    setForm(leadToFormValues(lead));
  }, [lead, isEditing]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isEditing) {
          setIsEditing(false);
          if (lead) setForm(leadToFormValues(lead));
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
  }, [open, onClose, isEditing, lead]);

  if (!mounted || !open || !lead || !form) return null;

  const selectedModules = new Set(isEditing ? form.interestedModules : (lead.interestedModules ?? []));

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
    setForm(leadToFormValues(lead));
    setError(null);
    setIsEditing(false);
  };

  const handleTabChange = (tab: HqLeadDrawerTab) => {
    if (isEditing) {
      setForm(leadToFormValues(lead));
      setIsEditing(false);
      setError(null);
    }
    setTabError(null);
    setActiveTab(tab);
  };

  const handleScheduleFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setTabError(null);
    if (!followUpForm.scheduledAt.trim()) {
      setTabError('Follow-up date and time is required.');
      return;
    }
    setFollowUpSubmitting(true);
    try {
      const result = await apiHqAddLeadFollowUp(lead.id, followUpForm);
      const updated = result.data?.lead;
      if (updated) {
        onLeadUpdated(updated);
        setFollowUpForm({
          type: 'Call',
          scheduledAt: toDatetimeLocalValue(updated.nextFollowUpAt) || defaultNextFollowUpLocal(),
          notes: '',
        });
      }
    } catch (err) {
      setTabError(err instanceof Error ? err.message : 'Failed to schedule follow-up');
    } finally {
      setFollowUpSubmitting(false);
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
      const result = await apiHqAddLeadRemark(lead.id, { text: remarkText.trim() });
      const updated = result.data?.lead;
      if (updated) {
        onLeadUpdated(updated);
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

    if (!form.contactName.trim() || !form.companyName.trim() || !form.email.trim()) {
      setError('Contact name, company name, and email are required.');
      return;
    }
    if (!form.industry || !form.country.trim() || !form.expectedUsers.trim() || !form.estimatedDealValue.trim()) {
      setError('Please fill in all required fields.');
      return;
    }
    if (!form.leadOwner.trim() || !form.leadSource) {
      setError('Lead owner and lead source are required.');
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
      await onSave(lead.id, form);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update lead');
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[1200]">
      <button
        type="button"
        aria-label="Close lead drawer backdrop"
        className="absolute inset-0 z-0 bg-slate-900/40 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="hq-lead-detail-title"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        className="absolute right-0 top-0 z-10 flex h-full w-full max-w-2xl flex-col border-l border-slate-200 bg-white shadow-2xl pointer-events-auto"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div>
            <h2 id="hq-lead-detail-title" className="text-2xl font-bold text-slate-900">
              {activeTab === 'followup'
                ? 'Follow-up'
                : activeTab === 'remarks'
                  ? 'Remarks'
                  : isEditing
                    ? 'Edit Lead'
                    : 'Lead Details'}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {activeTab === 'followup'
                ? `Schedule and track follow-ups for ${lead.name}.`
                : activeTab === 'remarks'
                  ? `Add internal remarks and notes for ${lead.name}.`
                  : isEditing
                    ? 'Update the prospective client details below and save to your CRM.'
                    : `Full CRM profile for ${lead.name} at ${lead.company}.`}
            </p>
            {!isEditing ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <StageBadge stage={lead.stage} />
                <ScoreBadge score={lead.score} />
                <span className="text-xs text-slate-500">
                  Next follow-up: {formatNextFollowUpDisplay(lead.nextFollowUpAt) || lead.nextFollowUp}
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

        <div className="flex gap-1 border-b border-slate-100 px-4 py-2">
          {DRAWER_TABS.map((tab) => {
            const Icon = tab.icon;
            const selected = activeTab === tab.id;
            const count =
              tab.id === 'followup'
                ? (lead.followUps?.length ?? 0)
                : tab.id === 'remarks'
                  ? (lead.remarks?.length ?? 0)
                  : 0;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  selected
                    ? 'bg-slate-100 text-slate-900'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
                {count > 0 ? (
                  <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-600 ring-1 ring-slate-200">
                    {count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {error && activeTab === 'details' ? (
              <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </p>
            ) : null}
            {tabError && activeTab !== 'details' ? (
              <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {tabError}
              </p>
            ) : null}

            {activeTab === 'details' ? (
              <div className="space-y-6">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <FieldLabel required={isEditing}>Contact Name</FieldLabel>
                {isEditing ? (
                  <input
                    className={INPUT_CLASS}
                    value={form.contactName}
                    onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                  />
                ) : (
                  <DetailValue value={lead.name} />
                )}
              </div>
              <div>
                <FieldLabel required={isEditing}>Company Name</FieldLabel>
                {isEditing ? (
                  <input
                    className={INPUT_CLASS}
                    value={form.companyName}
                    onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                  />
                ) : (
                  <DetailValue value={lead.company} />
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
                  <DetailValue value={lead.email} />
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
                  <DetailValue value={lead.phone} />
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
                      {HQ_LEAD_INDUSTRY_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  </div>
                ) : (
                  <DetailValue value={lead.industry} />
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
                  <DetailValue value={lead.country} />
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
                  <DetailValue value={lead.users} />
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
                      lead.estimatedDealValue !== undefined && lead.estimatedDealValue !== null
                        ? lead.estimatedDealValue.toLocaleString()
                        : undefined
                    }
                  />
                )}
              </div>
              <div>
                <FieldLabel required={isEditing}>Lead Owner</FieldLabel>
                {isEditing ? (
                  <input
                    className={INPUT_CLASS}
                    value={form.leadOwner}
                    onChange={(e) => setForm({ ...form, leadOwner: e.target.value })}
                  />
                ) : (
                  <DetailValue value={lead.owner} />
                )}
              </div>
              <div>
                <FieldLabel required={isEditing}>Lead Source</FieldLabel>
                {isEditing ? (
                  <div className="relative">
                    <select
                      className={`${INPUT_CLASS} appearance-none pr-10`}
                      value={form.leadSource}
                      onChange={(e) => setForm({ ...form, leadSource: e.target.value })}
                    >
                      <option value="">Select source</option>
                      {HQ_LEAD_SOURCE_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  </div>
                ) : (
                  <DetailValue value={lead.leadSource} />
                )}
              </div>
              <div>
                <FieldLabel required={isEditing}>Stage</FieldLabel>
                {isEditing ? (
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
                ) : (
                  <div className="pt-1">
                    <StageBadge stage={lead.stage} />
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
                    value={formatNextFollowUpDisplay(lead.nextFollowUpAt) || lead.nextFollowUp}
                  />
                )}
              </div>
              {!isEditing ? (
                <div>
                  <FieldLabel>Created</FieldLabel>
                  <DetailValue value={formatCreatedAt(lead.createdAt)} />
                </div>
              ) : null}
            </div>

            <div className="mt-6 border-t border-slate-100 pt-6">
              <FieldLabel required={isEditing}>Interested Modules</FieldLabel>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {HQ_LEAD_MODULE_OPTIONS.map((module) => {
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
                  {lead.initialNotes?.trim() ? lead.initialNotes : '—'}
                </div>
              )}
            </div>
              </div>
            ) : activeTab === 'followup' ? (
              <div className="space-y-6">
                <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Next scheduled</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {formatNextFollowUpDisplay(lead.nextFollowUpAt) || lead.nextFollowUp || '—'}
                  </p>
                </section>

                <section className="rounded-2xl border border-slate-200 p-4">
                  <h3 className="text-sm font-bold text-slate-900">Schedule Follow-up</h3>
                  <form onSubmit={handleScheduleFollowUp} className="mt-4 space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <FieldLabel required>Type</FieldLabel>
                        <div className="relative">
                          <select
                            className={`${INPUT_CLASS} appearance-none pr-10`}
                            value={followUpForm.type}
                            onChange={(e) => setFollowUpForm({ ...followUpForm, type: e.target.value })}
                          >
                            {HQ_LEAD_FOLLOW_UP_TYPES.map((type) => (
                              <option key={type} value={type}>
                                {type}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        </div>
                      </div>
                      <div>
                        <FieldLabel required>Date & Time</FieldLabel>
                        <input
                          type="datetime-local"
                          className={INPUT_CLASS}
                          value={followUpForm.scheduledAt}
                          onChange={(e) =>
                            setFollowUpForm({ ...followUpForm, scheduledAt: e.target.value })
                          }
                        />
                      </div>
                    </div>
                    <div>
                      <FieldLabel>Notes</FieldLabel>
                      <textarea
                        rows={3}
                        className={`${INPUT_CLASS} min-h-[80px] resize-y`}
                        placeholder="What to discuss on the follow-up..."
                        value={followUpForm.notes}
                        onChange={(e) => setFollowUpForm({ ...followUpForm, notes: e.target.value })}
                      />
                    </div>
                    <div className="flex justify-end">
                      <HqPrimaryButton type="submit" disabled={followUpSubmitting}>
                        {followUpSubmitting ? 'Scheduling…' : 'Schedule Follow-up'}
                      </HqPrimaryButton>
                    </div>
                  </form>
                </section>

                <section>
                  <h3 className="mb-3 text-sm font-bold text-slate-900">Follow-up History</h3>
                  {(lead.followUps?.length ?? 0) === 0 ? (
                    <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                      No follow-ups scheduled yet.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {lead.followUps?.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-slate-900">{item.type}</span>
                            <span className="text-xs font-medium text-slate-500">
                              {formatNextFollowUpDisplay(item.scheduledAt)}
                            </span>
                          </div>
                          {item.notes ? (
                            <p className="mt-2 text-sm text-slate-600 whitespace-pre-wrap">{item.notes}</p>
                          ) : null}
                          <p className="mt-2 text-[11px] text-slate-400">
                            Logged {formatCreatedAt(item.createdAt)}
                            {item.createdByEmail ? ` · ${item.createdByEmail}` : ''}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            ) : (
              <div className="space-y-6">
                <section className="rounded-2xl border border-slate-200 p-4">
                  <h3 className="text-sm font-bold text-slate-900">Add Remark</h3>
                  <form onSubmit={handleAddRemark} className="mt-4 space-y-4">
                    <textarea
                      rows={4}
                      className={`${INPUT_CLASS} min-h-[100px] resize-y`}
                      placeholder="Write an internal remark about this lead..."
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
                  {(lead.remarks?.length ?? 0) === 0 ? (
                    <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                      No remarks yet.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {lead.remarks?.map((item) => (
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
                    Edit Lead
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
