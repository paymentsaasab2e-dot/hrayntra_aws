'use client';

/**
 * HQ-only Create Lead drawer for /hq/leads.
 * Sales CRM fields: pipeline, deal, qualification, lost reason, next follow-up.
 * Does not replace Phase 2 LeadDetailsDrawer.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Building2,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  MapPin,
  Package,
  Target,
  UserRound,
  Wallet,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { HqPrimaryButton, HqSecondaryButton } from './hqUi';
import { HqLeadSourceFields, validateHqLeadSourceFields } from './HqLeadSourceFields';
import {
  HqProductLineSelect,
  hqProductLineLabel,
  type HqProductLine,
} from './HqProductLinePicker';
import {
  HQ_CRM_COMPANY_SIZE_OPTIONS,
  HQ_CRM_LOST_REASON_OPTIONS,
  HQ_CRM_PIPELINE_STAGES,
  HQ_CRM_TIMELINE_OPTIONS,
  HQ_LEAD_INDUSTRY_OPTIONS,
  HQ_LEAD_STAGE_LABELS,
  defaultNextFollowUpLocal,
  type HqLeadStage,
} from '@/app/hq/leads/hqLeadsData';
import {
  apiHqCreateLead,
  apiHqListPackages,
  type HqLeadApiRow,
  type HqSubscriptionPackage,
} from '@/lib/api';

type SectionId = 'workspace' | 'company' | 'contact' | 'pipeline' | 'deal' | 'qualify' | 'source' | 'followup';

const SECTIONS: Array<{
  id: SectionId;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'workspace', label: 'Workspace', hint: 'CRM / Recruitment', icon: Target },
  { id: 'company', label: 'Company', hint: 'Org & size', icon: Building2 },
  { id: 'contact', label: 'Contact', hint: 'Decision contact', icon: UserRound },
  { id: 'pipeline', label: 'Pipeline', hint: 'Stage & priority', icon: ClipboardList },
  { id: 'deal', label: 'Deal', hint: 'Package & value', icon: Package },
  { id: 'qualify', label: 'Qualify', hint: 'Budget & timing', icon: Wallet },
  { id: 'source', label: 'Source', hint: 'How they found us', icon: MapPin },
  { id: 'followup', label: 'Next action', hint: 'Follow-up required', icon: CalendarClock },
];

type FormState = {
  hqProductLine: HqProductLine;
  companyName: string;
  industry: string;
  companySize: string;
  country: string;
  state: string;
  city: string;
  website: string;
  contactName: string;
  email: string;
  phone: string;
  designation: string;
  decisionMaker: string;
  stage: HqLeadStage;
  priority: 'High' | 'Medium' | 'Low';
  lostReason: string;
  interestedPackage: string;
  estimatedDealValue: string;
  expectedUsers: string;
  expectedJobs: string;
  budget: string;
  timeline: string;
  competitor: string;
  leadSource: string;
  leadSourceDetail: string;
  nextFollowUpAt: string;
  initialNotes: string;
};

const EMPTY: FormState = {
  hqProductLine: 'crm',
  companyName: '',
  industry: '',
  companySize: '',
  country: '',
  state: '',
  city: '',
  website: '',
  contactName: '',
  email: '',
  phone: '',
  designation: '',
  decisionMaker: '',
  stage: 'new',
  priority: 'Medium',
  lostReason: '',
  interestedPackage: '',
  estimatedDealValue: '',
  expectedUsers: '',
  expectedJobs: '',
  budget: '',
  timeline: '',
  competitor: '',
  leadSource: '',
  leadSourceDetail: '',
  nextFollowUpAt: '',
  initialNotes: '',
};

const INPUT =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20';

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
      {children}
      {required ? <span className="ml-0.5 text-rose-500">*</span> : null}
    </label>
  );
}

function Section({
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
  icon: React.ComponentType<{ className?: string }>;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_8px_24px_-16px_rgba(15,23,42,0.35)]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 bg-gradient-to-r from-slate-50 via-emerald-50/40 to-white px-4 py-3.5 text-left"
        aria-expanded={open}
        aria-controls={`hq-crm-lead-${id}`}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600/10 text-emerald-700 ring-1 ring-emerald-200/80">
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-slate-900">{label}</span>
          <span className="block text-[11px] text-slate-500">{hint}</span>
        </span>
        {open ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
      </button>
      {open ? (
        <div id={`hq-crm-lead-${id}`} className="space-y-3 border-t border-slate-100 px-4 py-4">
          {children}
        </div>
      ) : null}
    </section>
  );
}

export function HqCrmCreateLeadDrawer({
  open,
  onClose,
  onCreated,
  existingLeads = [],
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (lead: HqLeadApiRow) => void | Promise<void>;
  existingLeads?: Array<Pick<HqLeadApiRow, 'id' | 'company' | 'email' | 'phone'>>;
}) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [openSections, setOpenSections] = useState<Record<SectionId, boolean>>({
    workspace: true,
    company: true,
    contact: true,
    pipeline: true,
    deal: true,
    qualify: false,
    source: false,
    followup: true,
  });
  const [packages, setPackages] = useState<HqSubscriptionPackage[]>([]);
  const [error, setError] = useState('');
  const [dupWarning, setDupWarning] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    setForm({ ...EMPTY, nextFollowUpAt: defaultNextFollowUpLocal() });
    setError('');
    setDupWarning('');
    setSubmitting(false);
    setOpenSections({
      workspace: true,
      company: true,
      contact: true,
      pipeline: true,
      deal: true,
      qualify: false,
      source: false,
      followup: true,
    });
    void apiHqListPackages()
      .then((res) => setPackages(res.data?.packages || []))
      .catch(() => setPackages([]));

    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  const patch = (partial: Partial<FormState>) => setForm((f) => ({ ...f, ...partial }));

  const duplicateHint = useMemo(() => {
    const company = form.companyName.trim().toLowerCase();
    const email = form.email.trim().toLowerCase();
    if (!company && !email) return '';
    const hit = existingLeads.find((l) => {
      const sameCompany = company && String(l.company || '').trim().toLowerCase() === company;
      const sameEmail = email && String(l.email || '').trim().toLowerCase() === email;
      return Boolean(sameCompany || sameEmail);
    });
    if (!hit) return '';
    if (email && String(hit.email || '').trim().toLowerCase() === email) {
      return `A lead with email ${hit.email} already exists (${hit.company || 'company'}).`;
    }
    return `A lead for company “${hit.company}” already exists.`;
  }, [form.companyName, form.email, existingLeads]);

  useEffect(() => {
    setDupWarning(duplicateHint);
  }, [duplicateHint]);

  const needsFollowUp = form.stage !== 'lost' && form.stage !== 'converted';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.companyName.trim()) {
      setError('Company name is required.');
      setOpenSections((s) => ({ ...s, company: true }));
      return;
    }
    if (!form.country.trim() || !form.state.trim()) {
      setError('Country and state are required.');
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
    if (form.stage === 'lost' && !form.lostReason.trim()) {
      setError('Lost reason is required when stage is Lost.');
      setOpenSections((s) => ({ ...s, pipeline: true }));
      return;
    }
    if (needsFollowUp && !form.nextFollowUpAt) {
      setError('Next follow-up is required (sales next action).');
      setOpenSections((s) => ({ ...s, followup: true }));
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
      const productLabel = hqProductLineLabel(form.hqProductLine);
      const modules = productLabel ? [productLabel] : ['CRM'];
      const result = await apiHqCreateLead({
        formSchema: 'hq-crm',
        hqProductLine: form.hqProductLine,
        contactName: form.contactName.trim(),
        contactPerson: form.contactName.trim(),
        directorName: form.contactName.trim(),
        companyName: form.companyName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        emails: form.email.trim() ? [form.email.trim()] : [],
        phones: form.phone.trim() ? [form.phone.trim()] : [],
        designation: form.designation.trim(),
        industry: form.industry,
        companySize: form.companySize,
        country: form.country.trim(),
        state: form.state.trim(),
        city: form.city.trim(),
        website: form.website.trim(),
        stage: form.stage,
        status: HQ_LEAD_STAGE_LABELS[form.stage],
        priority: form.priority,
        lostReason: form.lostReason.trim() || undefined,
        interestedPackage: form.interestedPackage.trim() || undefined,
        estimatedDealValue: form.estimatedDealValue || 0,
        expectedBusinessValue: form.estimatedDealValue || '',
        expectedUsers: form.expectedUsers || 0,
        expectedJobs: form.expectedJobs ? Number(form.expectedJobs) : undefined,
        budget: form.budget.trim() || undefined,
        timeline: form.timeline || undefined,
        decisionMaker: form.decisionMaker.trim() || undefined,
        competitor: form.competitor.trim() || undefined,
        leadSource: form.leadSource || 'Website',
        source: form.leadSource || 'Website',
        leadSourceDetail: form.leadSourceDetail,
        nextFollowUpAt: form.nextFollowUpAt || undefined,
        interestedModules: modules,
        interestedNeeds: modules.join(', '),
        initialNotes: form.initialNotes.trim(),
        notes: form.initialNotes.trim(),
      } as Parameters<typeof apiHqCreateLead>[0] & Record<string, unknown>);

      if ((result.data as { alreadyExisted?: boolean })?.alreadyExisted) {
        toast.message('A lead with this company already exists — opened existing record.');
      } else {
        toast.success('HQ lead created');
      }
      await onCreated(result.data!.lead);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create lead');
    } finally {
      setSubmitting(false);
    }
  };

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[520] flex justify-end">
      <button type="button" className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]" onClick={onClose} aria-label="Close" />
      <aside className="relative flex h-full w-full max-w-xl flex-col border-l border-slate-200 bg-[#f7f8f6] shadow-2xl">
        <header className="shrink-0 border-b border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 px-5 py-5 text-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-200/90">HQ CRM</p>
              <h2 className="mt-1 text-xl font-bold tracking-tight">Create lead</h2>
              <p className="mt-1 text-sm text-slate-300">Sales pipeline form — HQ leads only.</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-white/10 p-2 text-white hover:bg-white/20"
              aria-label="Close drawer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {HQ_CRM_PIPELINE_STAGES.map((stage) => {
              const active = form.stage === stage;
              return (
                <button
                  key={stage}
                  type="button"
                  onClick={() => patch({ stage })}
                  className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition ${
                    active
                      ? 'bg-emerald-400 text-slate-900'
                      : 'bg-white/10 text-slate-200 hover:bg-white/20'
                  }`}
                >
                  {HQ_LEAD_STAGE_LABELS[stage]}
                </button>
              );
            })}
          </div>
        </header>

        <form onSubmit={(e) => void handleSubmit(e)} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {error ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</div>
            ) : null}
            {dupWarning ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {dupWarning}
              </div>
            ) : null}

            {SECTIONS.map((section) => (
              <Section
                key={section.id}
                {...section}
                open={openSections[section.id]}
                onToggle={() => setOpenSections((s) => ({ ...s, [section.id]: !s[section.id] }))}
              >
                {section.id === 'workspace' ? (
                  <HqProductLineSelect
                    value={form.hqProductLine}
                    onChange={(line) => patch({ hqProductLine: line })}
                  />
                ) : null}

                {section.id === 'company' ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <Label required>Company</Label>
                      <input className={INPUT} value={form.companyName} onChange={(e) => patch({ companyName: e.target.value })} placeholder="Acme Pvt Ltd" />
                    </div>
                    <div>
                      <Label>Industry</Label>
                      <select className={INPUT} value={form.industry} onChange={(e) => patch({ industry: e.target.value })}>
                        <option value="">Select</option>
                        {HQ_LEAD_INDUSTRY_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label>Company size</Label>
                      <select className={INPUT} value={form.companySize} onChange={(e) => patch({ companySize: e.target.value })}>
                        <option value="">Select</option>
                        {HQ_CRM_COMPANY_SIZE_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt} employees
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label required>Country</Label>
                      <input className={INPUT} value={form.country} onChange={(e) => patch({ country: e.target.value })} placeholder="India" />
                    </div>
                    <div>
                      <Label required>State</Label>
                      <input className={INPUT} value={form.state} onChange={(e) => patch({ state: e.target.value })} placeholder="Maharashtra" />
                    </div>
                    <div>
                      <Label>City</Label>
                      <input className={INPUT} value={form.city} onChange={(e) => patch({ city: e.target.value })} />
                    </div>
                    <div>
                      <Label>Website</Label>
                      <input className={INPUT} value={form.website} onChange={(e) => patch({ website: e.target.value })} placeholder="https://" />
                    </div>
                  </div>
                ) : null}

                {section.id === 'contact' ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <Label required>Contact name</Label>
                      <input className={INPUT} value={form.contactName} onChange={(e) => patch({ contactName: e.target.value })} />
                    </div>
                    <div>
                      <Label>Email</Label>
                      <input type="email" className={INPUT} value={form.email} onChange={(e) => patch({ email: e.target.value })} />
                    </div>
                    <div>
                      <Label>Phone</Label>
                      <input className={INPUT} value={form.phone} onChange={(e) => patch({ phone: e.target.value })} />
                    </div>
                    <div>
                      <Label>Designation</Label>
                      <input className={INPUT} value={form.designation} onChange={(e) => patch({ designation: e.target.value })} placeholder="HR Head" />
                    </div>
                    <div>
                      <Label>Decision maker</Label>
                      <input className={INPUT} value={form.decisionMaker} onChange={(e) => patch({ decisionMaker: e.target.value })} placeholder="Who signs off?" />
                    </div>
                  </div>
                ) : null}

                {section.id === 'pipeline' ? (
                  <div className="space-y-3">
                    <div>
                      <Label required>Stage</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {HQ_CRM_PIPELINE_STAGES.map((stage) => (
                          <button
                            key={stage}
                            type="button"
                            onClick={() => patch({ stage })}
                            className={`rounded-full px-3 py-1.5 text-xs font-bold ring-1 transition ${
                              form.stage === stage
                                ? 'bg-emerald-600 text-white ring-emerald-600'
                                : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            {HQ_LEAD_STAGE_LABELS[stage]}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label>Priority</Label>
                      <div className="flex gap-2">
                        {(['High', 'Medium', 'Low'] as const).map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => patch({ priority: p })}
                            className={`rounded-xl px-3 py-2 text-xs font-bold ring-1 ${
                              form.priority === p
                                ? p === 'High'
                                  ? 'bg-rose-600 text-white ring-rose-600'
                                  : p === 'Medium'
                                    ? 'bg-amber-500 text-white ring-amber-500'
                                    : 'bg-slate-700 text-white ring-slate-700'
                                : 'bg-white text-slate-600 ring-slate-200'
                            }`}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>
                    {form.stage === 'lost' ? (
                      <div>
                        <Label required>Lost reason</Label>
                        <select className={INPUT} value={form.lostReason} onChange={(e) => patch({ lostReason: e.target.value })}>
                          <option value="">Select reason</option>
                          {HQ_CRM_LOST_REASON_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {section.id === 'deal' ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <Label>Interested package</Label>
                      <select
                        className={INPUT}
                        value={form.interestedPackage}
                        onChange={(e) => patch({ interestedPackage: e.target.value })}
                      >
                        <option value="">Select HQ package</option>
                        {packages.map((pkg) => (
                          <option key={pkg.id} value={pkg.name}>
                            {pkg.displayName || pkg.name}
                            {pkg.price ? ` · $${pkg.price}/mo` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label>Deal value (₹ / $)</Label>
                      <input className={INPUT} value={form.estimatedDealValue} onChange={(e) => patch({ estimatedDealValue: e.target.value })} placeholder="e.g. 499" />
                    </div>
                    <div>
                      <Label>Expected users</Label>
                      <input type="number" min={0} className={INPUT} value={form.expectedUsers} onChange={(e) => patch({ expectedUsers: e.target.value })} />
                    </div>
                    <div>
                      <Label>Expected jobs</Label>
                      <input type="number" min={0} className={INPUT} value={form.expectedJobs} onChange={(e) => patch({ expectedJobs: e.target.value })} />
                    </div>
                  </div>
                ) : null}

                {section.id === 'qualify' ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label>Budget</Label>
                      <input className={INPUT} value={form.budget} onChange={(e) => patch({ budget: e.target.value })} placeholder="Approx budget" />
                    </div>
                    <div>
                      <Label>Timeline</Label>
                      <select className={INPUT} value={form.timeline} onChange={(e) => patch({ timeline: e.target.value })}>
                        <option value="">Select</option>
                        {HQ_CRM_TIMELINE_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <Label>Competitor</Label>
                      <input className={INPUT} value={form.competitor} onChange={(e) => patch({ competitor: e.target.value })} placeholder="Who else are they evaluating?" />
                    </div>
                    <div className="sm:col-span-2">
                      <Label>Notes</Label>
                      <textarea
                        rows={3}
                        className={`${INPUT} resize-none`}
                        value={form.initialNotes}
                        onChange={(e) => patch({ initialNotes: e.target.value })}
                        placeholder="Context for the sales team"
                      />
                    </div>
                  </div>
                ) : null}

                {section.id === 'source' ? (
                  <HqLeadSourceFields
                    leadSource={form.leadSource}
                    leadSourceDetail={form.leadSourceDetail}
                    onChange={(p) =>
                      patch({
                        ...(p.leadSource != null ? { leadSource: p.leadSource } : {}),
                        ...(p.leadSourceDetail != null ? { leadSourceDetail: p.leadSourceDetail } : {}),
                      })
                    }
                  />
                ) : null}

                {section.id === 'followup' ? (
                  <div>
                    <Label required={needsFollowUp}>Next follow-up</Label>
                    <input
                      type="datetime-local"
                      className={INPUT}
                      value={form.nextFollowUpAt}
                      onChange={(e) => patch({ nextFollowUpAt: e.target.value })}
                      disabled={!needsFollowUp}
                    />
                    <p className="mt-1.5 text-[11px] text-slate-500">
                      {needsFollowUp
                        ? 'Required so every open lead has a next sales action.'
                        : 'Not required for Won / Lost.'}
                    </p>
                  </div>
                ) : null}
              </Section>
            ))}
          </div>

          <footer className="shrink-0 border-t border-slate-200 bg-white px-4 py-3">
            <div className="flex items-center justify-end gap-2">
              <HqSecondaryButton type="button" onClick={onClose} disabled={submitting}>
                Cancel
              </HqSecondaryButton>
              <HqPrimaryButton type="submit" disabled={submitting}>
                {submitting ? (
                  'Saving…'
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Create HQ lead
                  </>
                )}
              </HqPrimaryButton>
            </div>
          </footer>
        </form>
      </aside>
    </div>,
    document.body,
  );
}
