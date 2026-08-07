'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowLeft,
  Briefcase,
  Building2,
  Calendar,
  CalendarClock,
  Check,
  CheckCircle2,
  DollarSign,
  ExternalLink,
  FileText,
  Folder,
  Globe,
  Home,
  Link2,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquare,
  Monitor,
  MoreHorizontal,
  Pencil,
  Phone,
  PhoneCall,
  Star,
  Tag,
  Trash2,
  User,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  apiHqAddLeadFollowUp,
  apiHqAddLeadRemark,
  apiHqCompleteLeadFollowUp,
  apiHqDeleteLeadFollowUp,
  apiHqUpdateLeadFollowUp,
  type HqLeadApiRow,
  type HqLeadFollowUp,
  type HqLeadRemark,
} from '@/lib/api';
import {
  HQ_LEAD_FOLLOW_UP_TYPES,
  HQ_LEAD_STAGE_LABELS,
  formatHqLeadSourceDisplay,
  toDatetimeLocalValue,
  type HqLeadStage,
} from '@/app/hq/leads/hqLeadsData';
import { isInternalLeadOtherDetailLabel } from '@/lib/leadInternalOtherDetails';

const PIPELINE_STAGES: { id: HqLeadStage; label: string }[] = [
  { id: 'new', label: 'New' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'demo', label: 'Demo' },
  { id: 'qualified', label: 'Qualified' },
  { id: 'converted', label: 'Won' },
];

function pipelineIndex(stage: HqLeadStage): number {
  if (stage === 'lost') return -1;
  const idx = PIPELINE_STAGES.findIndex((s) => s.id === stage);
  return idx >= 0 ? idx : 0;
}

function fmtDate(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric', year: 'numeric' });
}

function fmtFollowUpDate(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtFollowUpWeekday(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

function fmtTime(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function fmtTimestamp(value?: string | null) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, { month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function fmtDealValue(value?: number | string | null) {
  if (value == null || String(value).trim() === '' || Number.isNaN(Number(value))) return '—';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(value));
}

function isPending(fu: HqLeadFollowUp) {
  const s = String(fu.status || '').toLowerCase();
  return s !== 'done' && s !== 'completed' && s !== 'cancelled';
}

function isOverdue(at?: string | null) {
  if (!at) return false;
  const d = new Date(at);
  return !Number.isNaN(d.getTime()) && d.getTime() < Date.now();
}

type DetailTab = 'follow-up' | 'activities' | 'remarks' | 'chat' | 'files';

const DETAIL_TABS: { id: DetailTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'follow-up', label: 'Follow-up', icon: CalendarClock },
  { id: 'activities', label: 'Activities', icon: Star },
  { id: 'remarks', label: 'Remarks', icon: MessageSquare },
  { id: 'chat', label: 'Chat', icon: MessageCircle },
  { id: 'files', label: 'Files', icon: Folder },
];

type TimelineItem = {
  id: string;
  title: string;
  at: string | null;
  body: string;
  by: string;
  kind: 'remark' | 'followup' | 'created' | 'call' | 'email' | 'demo';
};

function timelineIcon(kind: TimelineItem['kind']) {
  switch (kind) {
    case 'email': return Mail;
    case 'call': return PhoneCall;
    case 'demo': return Monitor;
    case 'followup': return CalendarClock;
    case 'remark': return MessageSquare;
    default: return FileText;
  }
}

function timelineIconClass(kind: TimelineItem['kind']) {
  switch (kind) {
    case 'email': return 'bg-violet-100 text-violet-700';
    case 'call': return 'bg-sky-100 text-sky-700';
    case 'demo': return 'bg-orange-100 text-orange-700';
    case 'followup': return 'bg-amber-100 text-amber-800';
    case 'remark': return 'bg-indigo-100 text-indigo-700';
    default: return 'bg-slate-100 text-slate-600';
  }
}

function fuKind(type: string): TimelineItem['kind'] {
  const t = type.toLowerCase();
  if (t.includes('email')) return 'email';
  if (t.includes('call') || t.includes('phone') || t.includes('whatsapp')) return 'call';
  if (t.includes('demo')) return 'demo';
  return 'followup';
}

function InfoRow({ label, value, green, link }: { label: string; value?: string | number | null; green?: boolean; link?: boolean }) {
  const text = value == null || String(value).trim() === '' ? '—' : String(value);
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 py-2.5 last:border-0">
      <dt className="text-sm text-slate-500 shrink-0">{label}</dt>
      <dd className={`text-sm font-medium text-right break-all ${green ? 'text-emerald-600 font-bold' : 'text-slate-900'}`}>
        {link && text !== '—' ? (
          <a href={text.startsWith('http') ? text : `https://${text}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline">
            {text.length > 40 ? `${text.slice(0, 40)}…` : text}
            <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        ) : text}
      </dd>
    </div>
  );
}

function SectionCard({ title, subtitle, icon: Icon, children }: { title: string; subtitle?: string; icon?: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          {Icon ? <Icon className="h-4 w-4 text-slate-500" /> : null}
          {title}
        </div>
        {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function HqLeadDetailView({
  lead,
  onBack,
  onEdit,
  onConvert,
  onDelete,
  onLeadUpdated,
}: {
  lead: HqLeadApiRow;
  onBack: () => void;
  onEdit: () => void;
  onConvert: () => void;
  onDelete: () => void;
  onLeadUpdated: (lead: HqLeadApiRow) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<DetailTab>('follow-up');
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleBusy, setScheduleBusy] = useState(false);
  const [editingFollowUpId, setEditingFollowUpId] = useState<string | null>(null);
  const [scheduleForm, setScheduleForm] = useState({
    type: 'Call',
    scheduledAt: toDatetimeLocalValue(new Date(Date.now() + 24 * 60 * 60 * 1000)),
    notes: '',
  });
  const [remarkText, setRemarkText] = useState('');
  const [remarkBusy, setRemarkBusy] = useState(false);

  const companyTitle = lead.company?.trim() || lead.name || 'Lead';
  const contactName = lead.contactPerson || lead.name || '—';
  const directorName = lead.directorName || contactName;
  const stage = lead.stage;
  const activeIdx = pipelineIndex(stage);
  const stageLabel = HQ_LEAD_STAGE_LABELS[stage] || stage;

  const location = [lead.city, lead.state, lead.country].filter(Boolean).join(', ') || lead.location || lead.country || '—';
  const modules = lead.interestedModules?.filter(Boolean) || [];
  const companyLinks = lead.companyLinks?.filter(Boolean) || [];
  const assignedNames = (lead.assignedToUsers || []).map((u) => u.name).filter(Boolean).join(', ') || lead.owner || 'Unassigned';

  const followUps = useMemo(
    () => [...(lead.followUps || [])].sort((a, b) => new Date(b.scheduledAt || b.createdAt || 0).getTime() - new Date(a.scheduledAt || a.createdAt || 0).getTime()),
    [lead.followUps],
  );

  const nextFollowUp = useMemo(() => {
    const pending = followUps.filter(isPending).sort((a, b) => new Date(a.scheduledAt || 0).getTime() - new Date(b.scheduledAt || 0).getTime());
    if (pending[0]) return pending[0];
    if (lead.nextFollowUpAt) return { id: '__next__', type: 'Follow-up', scheduledAt: lead.nextFollowUpAt, notes: '', status: 'pending', createdAt: null } as HqLeadFollowUp;
    return null;
  }, [followUps, lead.nextFollowUpAt]);

  const overdue = nextFollowUp ? isOverdue(nextFollowUp.scheduledAt) : false;

  const timeline = useMemo(() => {
    const items: TimelineItem[] = [];
    for (const fu of lead.followUps || []) {
      items.push({ id: `fu-${fu.id}`, title: fu.type || 'Follow-up', at: fu.completedAt || fu.scheduledAt || fu.createdAt, body: fu.notes || `${fu.status || 'Scheduled'} ${fu.type || 'follow-up'}`, by: fu.createdByEmail || lead.owner || 'HQ', kind: fuKind(fu.type || '') });
    }
    for (const r of (lead.remarks || []) as HqLeadRemark[]) {
      items.push({ id: `rm-${r.id}`, title: 'Remark', at: r.createdAt, body: r.text || '', by: r.createdByEmail || lead.owner || 'HQ', kind: 'remark' });
    }
    if (lead.initialNotes?.trim()) {
      items.push({ id: 'notes', title: 'Initial notes', at: lead.createdAt, body: lead.initialNotes, by: lead.owner || 'HQ', kind: 'created' });
    }
    if (lead.createdAt) {
      items.push({ id: 'created', title: 'Lead created', at: lead.createdAt, body: `${companyTitle} added to HQ CRM`, by: lead.owner || 'HQ', kind: 'created' });
    }
    return items.filter((i) => i.body || i.title).sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime());
  }, [lead, companyTitle]);

  const openSchedule = (followUp?: HqLeadFollowUp | null) => {
    if (followUp && followUp.id !== '__next__') {
      setEditingFollowUpId(followUp.id);
      setScheduleForm({ type: followUp.type || 'Call', scheduledAt: toDatetimeLocalValue(followUp.scheduledAt) || scheduleForm.scheduledAt, notes: followUp.notes || '' });
    } else {
      setEditingFollowUpId(null);
      setScheduleForm({ type: 'Call', scheduledAt: toDatetimeLocalValue(lead.nextFollowUpAt || new Date(Date.now() + 24 * 60 * 60 * 1000)), notes: '' });
    }
    setScheduleOpen(true);
  };

  const submitSchedule = async () => {
    if (!scheduleForm.scheduledAt) { toast.error('Pick a date and time'); return; }
    setScheduleBusy(true);
    try {
      const iso = new Date(scheduleForm.scheduledAt).toISOString();
      const result = editingFollowUpId
        ? await apiHqUpdateLeadFollowUp(lead.id, editingFollowUpId, { type: scheduleForm.type, scheduledAt: iso, notes: scheduleForm.notes })
        : await apiHqAddLeadFollowUp(lead.id, { type: scheduleForm.type, scheduledAt: iso, notes: scheduleForm.notes });
      const updated = result.data?.lead;
      if (updated) onLeadUpdated(updated);
      toast.success(editingFollowUpId ? 'Follow-up updated' : 'Follow-up scheduled');
      setScheduleOpen(false);
    } catch (err: any) { toast.error(err?.message || 'Failed'); } finally { setScheduleBusy(false); }
  };

  const markDone = async () => {
    if (!nextFollowUp || nextFollowUp.id === '__next__') { openSchedule(); return; }
    try {
      const result = await apiHqCompleteLeadFollowUp(lead.id, nextFollowUp.id);
      if (result.data?.lead) onLeadUpdated(result.data.lead);
      toast.success('Follow-up marked done');
    } catch (err: any) { toast.error(err?.message || 'Failed'); }
  };

  const deleteFollowUp = async (fuId: string) => {
    if (!window.confirm('Delete this follow-up?')) return;
    try {
      const result = await apiHqDeleteLeadFollowUp(lead.id, fuId);
      if (result.data?.lead) onLeadUpdated(result.data.lead);
      toast.success('Follow-up deleted');
    } catch (err: any) { toast.error(err?.message || 'Failed'); }
  };

  const submitRemark = async () => {
    if (!remarkText.trim()) return;
    setRemarkBusy(true);
    try {
      const result = await apiHqAddLeadRemark(lead.id, { text: remarkText.trim() });
      if (result.data?.lead) onLeadUpdated(result.data.lead);
      setRemarkText('');
      toast.success('Remark added');
    } catch (err: any) { toast.error(err?.message || 'Failed'); } finally { setRemarkBusy(false); }
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[#f7f8fa] text-slate-900">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-6 lg:px-8">

          {/* Breadcrumb */}
          <nav className="mb-4 flex flex-wrap items-center gap-1.5 text-[12px] text-slate-500">
            <Link href="/hq" className="inline-flex items-center hover:text-slate-800"><Home className="h-3.5 w-3.5" /></Link>
            <span className="text-slate-300">/</span><span>Crm</span>
            <span className="text-slate-300">/</span>
            <button type="button" onClick={onBack} className="hover:text-slate-800">Leads</button>
            <span className="text-slate-300">/</span>
            <span className="truncate font-medium text-slate-700">{companyTitle}</span>
          </nav>

          {/* Header */}
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <button type="button" onClick={onBack} className="mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50" aria-label="Back">
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-bold tracking-tight text-slate-900 sm:text-[1.75rem]">{companyTitle}</h1>
                <p className="mt-1 text-sm text-slate-500">Lead managed by {lead.owner || 'Unassigned'} · Created on {fmtDate(lead.createdAt)}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 lg:pt-1">
              <button type="button" onClick={onEdit} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50">
                <Pencil className="h-4 w-4" /> Edit Lead
              </button>
              <button type="button" onClick={() => openSchedule()} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50">
                <Calendar className="h-4 w-4" /> Schedule
              </button>
              {stage !== 'converted' && stage !== 'lost' ? (
                <button type="button" onClick={onConvert} className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">Convert</button>
              ) : null}
              <div className="relative">
                <button type="button" onClick={() => setMenuOpen((v) => !v)} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50" aria-label="More">
                  <MoreHorizontal className="h-4 w-4" />
                </button>
                {menuOpen ? (
                  <>
                    <button type="button" className="fixed inset-0 z-20 cursor-default" onClick={() => setMenuOpen(false)} />
                    <div className="absolute right-0 z-30 mt-1 w-44 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                      <button type="button" onClick={() => { setMenuOpen(false); onDelete(); }} className="block w-full px-3.5 py-2 text-left text-sm font-medium text-rose-600 hover:bg-rose-50">Delete lead</button>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          {/* Pipeline */}
          <div className="mb-6 rounded-2xl border border-slate-200/80 bg-white px-4 py-5 shadow-sm sm:px-6">
            {stage === 'lost' ? <div className="flex items-center gap-2 text-sm font-semibold text-rose-600"><AlertCircle className="h-4 w-4" /> This lead is marked Lost</div> : null}
            <div className={`flex items-start justify-between gap-1 overflow-x-auto ${stage === 'lost' ? 'mt-4 opacity-60' : ''}`}>
              {PIPELINE_STAGES.map((step, idx) => {
                const done = activeIdx > idx;
                const current = activeIdx === idx;
                return (
                  <React.Fragment key={step.id}>
                    <div className="flex min-w-[4.5rem] flex-col items-center gap-2">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${done || current ? 'bg-slate-900 text-white' : 'border-2 border-slate-200 bg-white text-slate-400'}`}>
                        {done || current ? <Check className="h-4 w-4" strokeWidth={2.5} /> : idx + 1}
                      </div>
                      <span className={`text-center text-[11px] font-semibold sm:text-xs ${current ? 'text-slate-900' : 'text-slate-500'}`}>{step.label}</span>
                    </div>
                    {idx < PIPELINE_STAGES.length - 1 ? <div className={`mt-4 h-0.5 min-w-[1.25rem] flex-1 ${activeIdx > idx ? 'bg-slate-900' : 'bg-slate-200'}`} /> : null}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* ── ALL DETAIL SECTIONS (2 columns) ── */}
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">

            {/* LEFT COLUMN */}
            <div className="flex flex-col gap-5">

              {/* Company Details */}
              <SectionCard title="Company Details" subtitle="Organization name and online presence" icon={Building2}>
                <dl>
                  <InfoRow label="Company" value={lead.company} />
                  <InfoRow label="Website" value={lead.website} link />
                  <InfoRow label="LinkedIn" value={lead.linkedIn} link />
                  {companyLinks.length > 0 ? (
                    <div className="border-b border-slate-100 py-2.5 last:border-0">
                      <dt className="text-sm text-slate-500 mb-1">Company Links</dt>
                      <dd className="flex flex-col gap-1">
                        {companyLinks.map((url, i) => (
                          <a key={i} href={url.startsWith('http') ? url : `https://${url}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline break-all">
                            {url.length > 50 ? `${url.slice(0, 50)}…` : url}
                            <ExternalLink className="h-3 w-3 shrink-0" />
                          </a>
                        ))}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </SectionCard>

              {/* Location & Industry */}
              <SectionCard title="Location & Industry" subtitle="Where the company operates" icon={MapPin}>
                <dl>
                  <InfoRow label="Country" value={lead.country} />
                  <InfoRow label="State" value={lead.state} />
                  <InfoRow label="City" value={lead.city} />
                  <InfoRow label="Location" value={lead.location} />
                  <InfoRow label="Industry" value={lead.industry} />
                </dl>
              </SectionCard>

              {/* Contacts */}
              <SectionCard title="Contacts" subtitle="Director and team member details" icon={Users}>
                <div className="mb-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Director</p>
                  <dl>
                    {lead.directorSalutation ? <InfoRow label="Salutation" value={lead.directorSalutation} /> : null}
                    <InfoRow label="Director Name" value={directorName} />
                    <InfoRow label="Email" value={lead.email} />
                    <InfoRow label="Mobile" value={lead.phone} />
                    {lead.designation ? <InfoRow label="Designation" value={lead.designation} /> : null}
                  </dl>
                  {(lead.emails && lead.emails.length > 1) || (lead.phones && lead.phones.length > 1) ? (
                    <div className="mt-2 space-y-1">
                      {(lead.emails || []).filter((e, i) => i > 0 && e).map((e, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-slate-600"><Mail className="h-3.5 w-3.5 text-slate-400" />{e}</div>
                      ))}
                      {(lead.phones || []).filter((p, i) => i > 0 && p).map((p, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-slate-600"><Phone className="h-3.5 w-3.5 text-slate-400" />{p}</div>
                      ))}
                    </div>
                  ) : null}
                </div>
                {lead.teamMemberEmail || lead.teamMemberPhone || lead.teamMemberDesignation ? (
                  <div className="border-t border-slate-100 pt-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Team Member</p>
                    <dl>
                      {lead.teamMemberDesignation ? <InfoRow label="Designation" value={lead.teamMemberDesignation} /> : null}
                      <InfoRow label="Email" value={lead.teamMemberEmail} />
                      <InfoRow label="Mobile" value={lead.teamMemberPhone} />
                    </dl>
                  </div>
                ) : null}
              </SectionCard>

              {/* Source & Qualification */}
              <SectionCard title="Source & Qualification" subtitle="How you found this lead and its stage" icon={Tag}>
                <dl>
                  <InfoRow label="Source" value={formatHqLeadSourceDisplay(lead.leadSource || lead.source || undefined, lead.leadSourceDetail)} />
                  <InfoRow label="Website Link" value={lead.sourceWebsiteUrl} link />
                  <InfoRow label="LinkedIn URL" value={lead.sourceLinkedInUrl} link />
                  <InfoRow label="Source Email" value={lead.sourceEmail} />
                  <InfoRow label="Referral Name" value={lead.referralName} />
                  <InfoRow label="Campaign" value={lead.campaignName} />
                  {lead.campaignLink ? <InfoRow label="Campaign Link" value={lead.campaignLink} link /> : null}
                  <InfoRow label="Status" value={lead.status || stageLabel} />
                  <InfoRow label="Interest Level" value={lead.priority || 'Medium'} />
                  <InfoRow label="Lead Type" value={lead.type || 'Company'} />
                </dl>
              </SectionCard>
            </div>

            {/* RIGHT COLUMN */}
            <div className="flex flex-col gap-5">

              {/* Follow-up & Assignment */}
              <SectionCard title="Follow-up & Assignment" subtitle="Schedule the first follow-up and assign an owner" icon={CalendarClock}>
                {lead.preferredDemoDate ? (
                  <div className="rounded-xl bg-orange-50 border border-orange-200 px-4 py-3.5 mb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Monitor className="h-4 w-4 text-orange-600" />
                      <p className="text-sm font-bold text-orange-800">Demo Scheduled</p>
                    </div>
                    <p className="text-sm text-orange-700 font-semibold">{lead.preferredDemoDate}{lead.preferredDemoTime ? ` at ${lead.preferredDemoTime}` : ''}</p>
                  </div>
                ) : null}

                {nextFollowUp ? (
                  <div className="rounded-xl bg-slate-50 px-4 py-3.5 mb-4">
                    <div className="flex items-center justify-between mb-1">
                      <p className={`text-sm font-bold ${overdue ? 'text-rose-600' : 'text-slate-900'}`}>{fmtFollowUpWeekday(nextFollowUp.scheduledAt)}</p>
                      {overdue ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold uppercase text-rose-600 ring-1 ring-rose-200">
                          <AlertCircle className="h-3 w-3" /> Overdue
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm text-slate-600">{fmtTime(nextFollowUp.scheduledAt)}</p>
                    <p className="mt-2 text-sm text-slate-500">Assigned to: <span className="font-semibold text-slate-800">{assignedNames}</span></p>
                  </div>
                ) : (
                  <div className="rounded-xl bg-slate-50 px-4 py-6 mb-4 text-center text-sm text-slate-400">No follow-up scheduled</div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => openSchedule(nextFollowUp)} className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-800 transition hover:bg-slate-50">Reschedule</button>
                  <button type="button" onClick={() => void markDone()} disabled={!nextFollowUp} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-slate-900 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-40">
                    <CheckCircle2 className="h-4 w-4" /> Mark Done
                  </button>
                </div>
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <InfoRow label="Assigned To" value={assignedNames} />
                  {(lead.assignedToUsers || []).map((u) => (
                    <div key={u.id} className="flex items-center gap-2 py-1 text-sm text-slate-600">
                      <User className="h-3.5 w-3.5 text-slate-400" />
                      <span>{u.name}</span>
                      {u.email ? <span className="text-slate-400">({u.email})</span> : null}
                      {u.role ? <span className="ml-auto text-xs text-slate-400">{u.role}</span> : null}
                    </div>
                  ))}
                </div>
              </SectionCard>

              {/* Business Opportunity */}
              <SectionCard title="Business Opportunity" subtitle="Services and expected value" icon={Briefcase}>
                <dl>
                  <InfoRow label="Expected Users" value={lead.users} />
                  <InfoRow label="Est. Deal Value" value={fmtDealValue(lead.estimatedDealValue)} green />
                  <InfoRow label="Expected Business Value" value={lead.expectedBusinessValue} />
                  <InfoRow label="Services Needed" value={lead.servicesNeeded} />
                  <InfoRow label="Interested Needs" value={lead.interestedNeeds} />
                </dl>
                {modules.length > 0 ? (
                  <div className="mt-3 border-t border-slate-100 pt-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Interested Modules</p>
                    <div className="flex flex-wrap gap-2">
                      {modules.map((m) => (
                        <span key={m} className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200/80">{m}</span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </SectionCard>

              {/* Other / Notes */}
              {(() => {
                const publicOtherDetails = (lead.otherDetails || []).filter(
                  (d) => !isInternalLeadOtherDetailLabel(d.label),
                );
                if (!publicOtherDetails.length && !lead.notes && !lead.initialNotes) return null;
                return (
                <SectionCard title="Other Details" icon={FileText}>
                  {lead.notes ? <InfoRow label="Notes" value={lead.notes} /> : null}
                  {lead.initialNotes && lead.initialNotes !== lead.notes ? <InfoRow label="Initial Notes" value={lead.initialNotes} /> : null}
                  {publicOtherDetails.map((d, i) => (
                    <InfoRow key={i} label={d.label} value={d.value} />
                  ))}
                </SectionCard>
                );
              })()}
            </div>
          </div>

          {/* ── TABS ── */}
          <div className="mt-8">
            <div className="border-b border-slate-200">
              <nav className="flex gap-0 overflow-x-auto" aria-label="Detail tabs">
                {DETAIL_TABS.map((tab) => {
                  const Icon = tab.icon;
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`inline-flex items-center gap-2 whitespace-nowrap px-4 py-3 text-sm font-semibold transition border-b-2 ${
                        active ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="mt-5 pb-8">
              {/* Follow-up Tab */}
              {activeTab === 'follow-up' ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-900">Follow-up History</h3>
                    <button type="button" onClick={() => openSchedule()} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800">
                      + Add Follow-up
                    </button>
                  </div>
                  {followUps.length === 0 ? (
                    <p className="text-sm text-slate-400 py-6 text-center">No follow-ups yet. Click "Add Follow-up" to schedule one.</p>
                  ) : (
                    <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
                      {followUps.map((fu) => {
                        const pend = isPending(fu);
                        return (
                          <li key={fu.id} className="flex items-start justify-between gap-3 px-4 py-3">
                            <div className="flex min-w-0 items-start gap-2.5">
                              <span className={`mt-0.5 inline-flex shrink-0 rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide ${pend ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                {pend ? 'Pending' : 'Done'}
                              </span>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-800">{(fu.type || 'Follow-up').toUpperCase()}</p>
                                {fu.notes ? <p className="mt-0.5 text-sm text-slate-600 line-clamp-2">{fu.notes}</p> : null}
                                <p className="mt-1 text-xs text-slate-400">{fu.createdByEmail || '—'}</p>
                              </div>
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-1">
                              <span className="text-xs text-slate-400">{fmtFollowUpDate(fu.scheduledAt || fu.completedAt || fu.createdAt)}</span>
                              <div className="flex gap-1">
                                {pend ? (
                                  <button type="button" onClick={() => openSchedule(fu)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Reschedule">
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                ) : null}
                                <button type="button" onClick={() => void deleteFollowUp(fu.id)} className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="Delete">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              ) : null}

              {/* Activities Tab */}
              {activeTab === 'activities' ? (
                <div>
                  <h3 className="mb-4 text-sm font-semibold text-slate-900">Activity Timeline</h3>
                  {timeline.length === 0 ? (
                    <p className="text-sm text-slate-400 py-6 text-center">No activity yet</p>
                  ) : (
                    <ol className="relative space-y-5 border-l border-slate-200 pl-5 ml-3">
                      {timeline.map((item) => {
                        const Icon = timelineIcon(item.kind);
                        return (
                          <li key={item.id} className="relative">
                            <span className={`absolute -left-[1.7rem] flex h-7 w-7 items-center justify-center rounded-full ${timelineIconClass(item.kind)}`}>
                              <Icon className="h-3.5 w-3.5" />
                            </span>
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                              <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                              <span className="text-[11px] text-slate-400">{fmtTimestamp(item.at)}</span>
                            </div>
                            <p className="mt-1 text-sm leading-relaxed text-slate-600">{item.body}</p>
                            <p className="mt-1 text-xs text-slate-400">By {item.by}</p>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </div>
              ) : null}

              {/* Remarks Tab */}
              {activeTab === 'remarks' ? (
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <textarea
                      value={remarkText}
                      onChange={(e) => setRemarkText(e.target.value)}
                      rows={3}
                      placeholder="Add a remark…"
                      className="flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-200 resize-none"
                    />
                    <button type="button" disabled={remarkBusy || !remarkText.trim()} onClick={() => void submitRemark()} className="self-end h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
                      {remarkBusy ? 'Saving…' : 'Add'}
                    </button>
                  </div>
                  {(lead.remarks || []).length === 0 ? (
                    <p className="text-sm text-slate-400 py-6 text-center">No remarks yet</p>
                  ) : (
                    <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
                      {([...(lead.remarks || [])].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()) as HqLeadRemark[]).map((r) => (
                        <li key={r.id} className="px-4 py-3">
                          <p className="text-sm text-slate-800">{r.text}</p>
                          <p className="mt-1 text-xs text-slate-400">{r.createdByEmail || '—'} · {fmtTimestamp(r.createdAt)}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}

              {/* Chat Tab */}
              {activeTab === 'chat' ? (
                <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
                  <MessageCircle className="mx-auto h-10 w-10 text-slate-300" />
                  <p className="mt-3 text-sm font-semibold text-slate-600">Chat coming soon</p>
                  <p className="mt-1 text-xs text-slate-400">Live chat with this lead will be available here</p>
                </div>
              ) : null}

              {/* Files Tab */}
              {activeTab === 'files' ? (
                <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
                  <Folder className="mx-auto h-10 w-10 text-slate-300" />
                  <p className="mt-3 text-sm font-semibold text-slate-600">File storage not available yet</p>
                  <p className="mt-1 text-xs text-slate-400">HQ lead file attachments will appear here once enabled</p>
                </div>
              ) : null}
            </div>
          </div>

        </div>
      </div>

      {/* Schedule modal */}
      {scheduleOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">{editingFollowUpId ? 'Reschedule follow-up' : 'Schedule follow-up'}</h3>
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">Type</span>
                <select value={scheduleForm.type} onChange={(e) => setScheduleForm((f) => ({ ...f, type: e.target.value }))} className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-200">
                  {HQ_LEAD_FOLLOW_UP_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">When</span>
                <input type="datetime-local" value={scheduleForm.scheduledAt} onChange={(e) => setScheduleForm((f) => ({ ...f, scheduledAt: e.target.value }))} className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-200" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">Notes</span>
                <textarea value={scheduleForm.notes} onChange={(e) => setScheduleForm((f) => ({ ...f, notes: e.target.value }))} rows={3} className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-200 resize-none" placeholder="Optional note" />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setScheduleOpen(false)} className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
              <button type="button" disabled={scheduleBusy} onClick={() => void submitSchedule()} className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">{scheduleBusy ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
