'use client';

/**
 * HQ-only Add Lead drawer — CRM / Recruitment selector + sectioned form.
 * Does not modify Phase 2 LeadDetailsDrawer.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Building2,
  ChevronDown,
  ChevronRight,
  MapPin,
  MessageSquare,
  Target,
  UserRound,
  Wallet,
  X,
} from 'lucide-react';
import { HqPrimaryButton, HqSecondaryButton } from './hqUi';
import { HqLeadSourceFields, validateHqLeadSourceFields } from './HqLeadSourceFields';
import {
  HQ_LEAD_INDUSTRY_OPTIONS,
  HQ_LEAD_MODULE_OPTIONS,
  HQ_LEAD_STAGE_LABELS,
  defaultNextFollowUpLocal,
  type HqLeadStage,
} from '@/app/hq/leads/hqLeadsData';
import {
  HqProductLineSelect,
  hqProductLineLabel,
  type HqProductLine,
} from './HqProductLinePicker';
import { apiHqCreateLead, type HqLeadApiRow } from '@/lib/api';

export type HqAddLeadFormValues = {
  hqProductLine: HqProductLine;
  contactName: string;
  companyName: string;
  email: string;
  phone: string;
  industry: string;
  country: string;
  state: string;
  city: string;
  expectedUsers: string;
  estimatedDealValue: string;
  leadSource: string;
  leadSourceDetail: string;
  stage: HqLeadStage;
  nextFollowUpAt: string;
  interestedModules: string[];
  initialNotes: string;
};

type SectionId = 'workspace' | 'company' | 'contact' | 'commercial' | 'source' | 'notes';

const SECTIONS: Array<{
  id: SectionId;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
}> = [
  { id: 'workspace', label: 'Workspace', hint: 'CRM or Recruitment', icon: Target },
  { id: 'company', label: 'Company', hint: 'Organization details', icon: Building2 },
  { id: 'contact', label: 'Contact', hint: 'Primary person', icon: UserRound },
  { id: 'commercial', label: 'Commercial', hint: 'Users, value, stage', icon: Wallet },
  { id: 'source', label: 'Source', hint: 'How they found you', icon: MapPin },
  { id: 'notes', label: 'Notes', hint: 'Context & modules', icon: MessageSquare },
];

const EMPTY_FORM: HqAddLeadFormValues = {
  hqProductLine: 'crm',
  contactName: '',
  companyName: '',
  email: '',
  phone: '',
  industry: '',
  country: '',
  state: '',
  city: '',
  expectedUsers: '',
  estimatedDealValue: '',
  leadSource: '',
  leadSourceDetail: '',
  stage: 'new',
  nextFollowUpAt: '',
  interestedModules: [],
  initialNotes: '',
};

const INPUT_CLASS =
  'w-full rounded-xl border border-indigo-100/90 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/25';

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="mb-1.5 block text-sm font-medium text-slate-800">
      {children}
      {required ? <span className="ml-0.5 text-rose-500">*</span> : null}
    </label>
  );
}

function SectionCard({
  id,
  label,
  hint,
  icon: Icon,
  open,
  onToggle,
  children,
}: {
  id: SectionId;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-indigo-100/70 bg-white shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 bg-gradient-to-r from-slate-50/90 via-indigo-50/30 to-white px-4 py-3 text-left transition hover:from-indigo-50/50"
        aria-expanded={open}
        aria-controls={`hq-add-lead-section-${id}`}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 ring-1 ring-indigo-200/70">
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-slate-900">{label}</span>
          <span className="block text-[11px] text-slate-500">{hint}</span>
        </span>
        {open ? (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronRight className="h-4 w-4 text-slate-400" />
        )}
      </button>
      {open ? (
        <div id={`hq-add-lead-section-${id}`} className="border-t border-indigo-50 px-4 py-4">
          {children}
        </div>
      ) : null}
    </section>
  );
}

function syncModulesForProductLine(
  modules: string[],
  line: HqProductLine,
): string[] {
  const label = hqProductLineLabel(line);
  const cleaned = modules.filter(
    (m) => m.toLowerCase() !== 'crm' && m.toLowerCase() !== 'recruitment',
  );
  return label ? [label, ...cleaned.filter((m) => m !== label)] : cleaned;
}

export function HqAddLeadDrawer({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (lead: HqLeadApiRow) => void | Promise<void>;
}) {
  const [form, setForm] = useState<HqAddLeadFormValues>(EMPTY_FORM);
  const [openSections, setOpenSections] = useState<Record<SectionId, boolean>>({
    workspace: true,
    company: true,
    contact: true,
    commercial: true,
    source: false,
    notes: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setForm({
      ...EMPTY_FORM,
      hqProductLine: 'crm',
      nextFollowUpAt: defaultNextFollowUpLocal(),
      interestedModules: ['CRM'],
    });
    setOpenSections({
      workspace: true,
      company: true,
      contact: true,
      commercial: true,
      source: false,
      notes: false,
    });
    setError(null);
    setSubmitting(false);
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

  const moduleOptions = useMemo(() => {
    const base = [...HQ_LEAD_MODULE_OPTIONS];
    if (form.hqProductLine === 'crm' && !base.includes('CRM' as (typeof base)[number])) {
      return ['CRM', ...base.filter((m) => m !== 'Recruitment'), 'Recruitment'];
    }
    return base;
  }, [form.hqProductLine]);

  const toggleSection = (id: SectionId) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const setProductLine = (line: HqProductLine) => {
    setForm((prev) => ({
      ...prev,
      hqProductLine: line,
      interestedModules: syncModulesForProductLine(prev.interestedModules, line),
    }));
  };

  const toggleModule = (module: string) => {
    setForm((prev) => {
      const next = prev.interestedModules.includes(module)
        ? prev.interestedModules.filter((m) => m !== module)
        : [...prev.interestedModules, module];
      return {
        ...prev,
        interestedModules: syncModulesForProductLine(next, prev.hqProductLine),
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.hqProductLine) {
      setError('Select CRM or Recruitment.');
      setOpenSections((s) => ({ ...s, workspace: true }));
      return;
    }
    if (!form.companyName.trim()) {
      setError('Company name is required.');
      setOpenSections((s) => ({ ...s, company: true }));
      return;
    }
    if (!form.contactName.trim()) {
      setError('Contact name is required.');
      setOpenSections((s) => ({ ...s, contact: true }));
      return;
    }
    if (!form.email.trim() && !form.phone.trim()) {
      setError('Email or phone is required.');
      setOpenSections((s) => ({ ...s, contact: true }));
      return;
    }
    if (!form.country.trim()) {
      setError('Country is required.');
      setOpenSections((s) => ({ ...s, company: true }));
      return;
    }
    const sourceError = form.leadSource
      ? validateHqLeadSourceFields(form.leadSource, form.leadSourceDetail)
      : null;
    if (sourceError) {
      setError(sourceError);
      setOpenSections((s) => ({ ...s, source: true }));
      return;
    }

    setSubmitting(true);
    try {
      const modules = syncModulesForProductLine(form.interestedModules, form.hqProductLine);
      const result = await apiHqCreateLead({
        contactName: form.contactName.trim(),
        contactPerson: form.contactName.trim(),
        directorName: form.contactName.trim(),
        companyName: form.companyName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        emails: form.email.trim() ? [form.email.trim()] : [],
        phones: form.phone.trim() ? [form.phone.trim()] : [],
        industry: form.industry,
        country: form.country.trim(),
        state: form.state.trim(),
        city: form.city.trim(),
        expectedUsers: form.expectedUsers || 0,
        estimatedDealValue: form.estimatedDealValue || 0,
        expectedBusinessValue: form.estimatedDealValue || '',
        leadSource: form.leadSource || 'Website',
        source: form.leadSource || 'Website',
        leadSourceDetail: form.leadSourceDetail,
        stage: form.stage,
        status: HQ_LEAD_STAGE_LABELS[form.stage],
        nextFollowUpAt: form.nextFollowUpAt || undefined,
        interestedModules: modules,
        interestedNeeds: modules.join(', '),
        initialNotes: form.initialNotes,
        notes: form.initialNotes,
        hqProductLine: form.hqProductLine,
        formSchema: 'phase2',
      } as Parameters<typeof apiHqCreateLead>[0] & {
        contactPerson?: string;
        directorName?: string;
        emails?: string[];
        phones?: string[];
        state?: string;
        city?: string;
        source?: string;
        status?: string;
        expectedBusinessValue?: string;
        interestedNeeds?: string;
        notes?: string;
        hqProductLine?: HqProductLine;
        formSchema?: string;
      });

      const created = result.data?.lead;
      if (!created) throw new Error('Lead was not created');
      await onCreated(created);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create lead');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70]">
      <button
        type="button"
        aria-label="Close drawer backdrop"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="hq-add-lead-title"
        className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col overflow-hidden border-l border-indigo-100/80 bg-white shadow-2xl"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-indigo-100/70 bg-gradient-to-r from-rose-50/90 via-orange-50/40 to-white px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 via-orange-500 to-amber-500 text-white shadow-lg shadow-rose-500/25">
              <Target className="h-5 w-5" strokeWidth={2.2} />
            </div>
            <div className="min-w-0">
              <h2 id="hq-add-lead-title" className="text-lg font-bold tracking-tight text-slate-900">
                Add Lead
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                HQ form with CRM / Recruitment sections
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-5">
            {error ? (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </p>
            ) : null}

            <SectionCard
              id="workspace"
              label={SECTIONS[0].label}
              hint={SECTIONS[0].hint}
              icon={SECTIONS[0].icon}
              open={openSections.workspace}
              onToggle={() => toggleSection('workspace')}
            >
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Product line
              </p>
              <HqProductLineSelect
                value={form.hqProductLine}
                onChange={setProductLine}
              />
            </SectionCard>

            <SectionCard
              id="company"
              label={SECTIONS[1].label}
              hint={SECTIONS[1].hint}
              icon={SECTIONS[1].icon}
              open={openSections.company}
              onToggle={() => toggleSection('company')}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <FieldLabel required>Company name</FieldLabel>
                  <input
                    className={INPUT_CLASS}
                    value={form.companyName}
                    onChange={(e) => setForm((p) => ({ ...p, companyName: e.target.value }))}
                    placeholder="Acme Corp"
                  />
                </div>
                <div>
                  <FieldLabel>Industry</FieldLabel>
                  <div className="relative">
                    <select
                      className={`${INPUT_CLASS} appearance-none pr-10`}
                      value={form.industry}
                      onChange={(e) => setForm((p) => ({ ...p, industry: e.target.value }))}
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
                </div>
                <div>
                  <FieldLabel required>Country</FieldLabel>
                  <input
                    className={INPUT_CLASS}
                    value={form.country}
                    onChange={(e) => setForm((p) => ({ ...p, country: e.target.value }))}
                    placeholder="India"
                  />
                </div>
                <div>
                  <FieldLabel>State</FieldLabel>
                  <input
                    className={INPUT_CLASS}
                    value={form.state}
                    onChange={(e) => setForm((p) => ({ ...p, state: e.target.value }))}
                    placeholder="Maharashtra"
                  />
                </div>
                <div>
                  <FieldLabel>City</FieldLabel>
                  <input
                    className={INPUT_CLASS}
                    value={form.city}
                    onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
                    placeholder="Mumbai"
                  />
                </div>
              </div>
            </SectionCard>

            <SectionCard
              id="contact"
              label={SECTIONS[2].label}
              hint={SECTIONS[2].hint}
              icon={SECTIONS[2].icon}
              open={openSections.contact}
              onToggle={() => toggleSection('contact')}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <FieldLabel required>Contact name</FieldLabel>
                  <input
                    className={INPUT_CLASS}
                    value={form.contactName}
                    onChange={(e) => setForm((p) => ({ ...p, contactName: e.target.value }))}
                    placeholder="Jane Doe"
                  />
                </div>
                <div>
                  <FieldLabel>Email</FieldLabel>
                  <input
                    type="email"
                    className={INPUT_CLASS}
                    value={form.email}
                    onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                    placeholder="jane@acme.com"
                  />
                </div>
                <div>
                  <FieldLabel>Phone</FieldLabel>
                  <input
                    className={INPUT_CLASS}
                    value={form.phone}
                    onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                    placeholder="+91 98765 43210"
                  />
                </div>
              </div>
            </SectionCard>

            <SectionCard
              id="commercial"
              label={SECTIONS[3].label}
              hint={SECTIONS[3].hint}
              icon={SECTIONS[3].icon}
              open={openSections.commercial}
              onToggle={() => toggleSection('commercial')}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel>Expected users</FieldLabel>
                  <input
                    type="number"
                    min={0}
                    className={INPUT_CLASS}
                    value={form.expectedUsers}
                    onChange={(e) => setForm((p) => ({ ...p, expectedUsers: e.target.value }))}
                    placeholder="50"
                  />
                </div>
                <div>
                  <FieldLabel>Estimated deal value</FieldLabel>
                  <input
                    className={INPUT_CLASS}
                    value={form.estimatedDealValue}
                    onChange={(e) => setForm((p) => ({ ...p, estimatedDealValue: e.target.value }))}
                    placeholder="25000"
                  />
                </div>
                <div>
                  <FieldLabel>Stage</FieldLabel>
                  <div className="relative">
                    <select
                      className={`${INPUT_CLASS} appearance-none pr-10`}
                      value={form.stage}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, stage: e.target.value as HqLeadStage }))
                      }
                    >
                      {(Object.keys(HQ_LEAD_STAGE_LABELS) as HqLeadStage[])
                        .filter((s) => s !== 'converted')
                        .map((stage) => (
                          <option key={stage} value={stage}>
                            {HQ_LEAD_STAGE_LABELS[stage]}
                          </option>
                        ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>
                <div>
                  <FieldLabel>Next follow-up</FieldLabel>
                  <input
                    type="datetime-local"
                    className={INPUT_CLASS}
                    value={form.nextFollowUpAt}
                    onChange={(e) => setForm((p) => ({ ...p, nextFollowUpAt: e.target.value }))}
                  />
                </div>
              </div>
            </SectionCard>

            <SectionCard
              id="source"
              label={SECTIONS[4].label}
              hint={SECTIONS[4].hint}
              icon={SECTIONS[4].icon}
              open={openSections.source}
              onToggle={() => toggleSection('source')}
            >
              <HqLeadSourceFields
                leadSource={form.leadSource}
                leadSourceDetail={form.leadSourceDetail}
                onChange={(patch) => setForm((p) => ({ ...p, ...patch }))}
              />
            </SectionCard>

            <SectionCard
              id="notes"
              label={SECTIONS[5].label}
              hint={SECTIONS[5].hint}
              icon={SECTIONS[5].icon}
              open={openSections.notes}
              onToggle={() => toggleSection('notes')}
            >
              <div className="space-y-4">
                <div>
                  <FieldLabel>Interested modules</FieldLabel>
                  <div className="flex flex-wrap gap-2">
                    {moduleOptions.map((module) => {
                      const checked = form.interestedModules.includes(module);
                      return (
                        <button
                          key={module}
                          type="button"
                          onClick={() => toggleModule(module)}
                          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                            checked
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {module}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <FieldLabel>Initial notes</FieldLabel>
                  <textarea
                    className={`${INPUT_CLASS} min-h-[96px] resize-y`}
                    value={form.initialNotes}
                    onChange={(e) => setForm((p) => ({ ...p, initialNotes: e.target.value }))}
                    placeholder="Context, pain points, next steps…"
                  />
                </div>
              </div>
            </SectionCard>
          </div>

          <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-indigo-100/70 bg-slate-50/80 px-4 py-3 sm:px-5">
            <HqSecondaryButton type="button" onClick={onClose} disabled={submitting}>
              Cancel
            </HqSecondaryButton>
            <HqPrimaryButton type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : `Create ${hqProductLineLabel(form.hqProductLine)} lead`}
            </HqPrimaryButton>
          </footer>
        </form>
      </aside>
    </div>,
    document.body,
  );
}
