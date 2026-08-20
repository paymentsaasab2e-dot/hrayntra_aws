'use client';

/**
 * HQ Leads — Phase 2 lead drawer (HQ-only CRM/Recruitment section) + HQ APIs.
 * Data stored only in headquarters DB via /hq/leads.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  CalendarClock,
  CheckCircle,
  Download,
  KeyRound,
  Lock,
  Phone,
  Plus,
  RefreshCcw,
  Search,
  Sparkles,
  Target,
  Trash2,
  Upload,
  UserPlus,
  XCircle,
} from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { LeadDetailsDrawer } from '@/components/drawers/LeadDetailsDrawer';
import { HqCrmEmbed } from '@/components/hq/HqCrmEmbed';
import {
  HqLeadProductLineBadges,
  resolveHqLeadProductLines,
} from '@/components/hq/HqProductLinePicker';
import { SummaryCard, SummaryCardSkeleton, type SummaryCardColor } from '@/components/ui/SummaryCard';
import { TableBrandAvatar } from '@/components/ui/TableBrandAvatar';
import { AssigneeAvatars } from '@/app/leads/AssigneeAvatars';
import { SourceCell } from '@/app/leads/SourceCell';
import PaginationAll from '@/components/PaginationAll';
import { TABLE_PAGE_SIZE_OPTIONS, type TablePageSize } from '@/constants/tablePagination';
import { formatDirectorDisplay } from '@/constants/salutations';
import { formatContactListDisplay } from '@/lib/contact-channels';
import { isValidFollowUpInstant, splitDateTimeForDisplay } from '@/utils/formatLeadDateTime';
import { AiCoinLockBadge, useAiCoinGate } from '@/components/coins/AiCoinGate';
import {
  BOOK_A_DEMO_TAG_CLASS,
  formatDemoTryFreeAccessLabel,
  getDemoTryFreeAccessStatus,
  HQ_DEMO_STATUS_LABELS,
  HQ_DEMO_STATUS_STYLES,
  HQ_LEAD_STAGE_LABELS,
  formatHqLeadSourceDisplay,
  isBookADemoLead,
  type HqDemoRequestRow,
  type HqLeadStage,
} from './hqLeadsData';
import type { Lead, LeadSource, LeadStatus, Priority } from '@/app/leads/types';
import {
  apiHqConvertLeadToCompany,
  apiHqCreateLead,
  apiHqDeleteDemoRequest,
  apiHqDeleteLead,
  apiHqGrantDemoTrial,
  apiHqListDemoRequests,
  apiHqListLeads,
  apiHqUpdateLead,
  type BackendLead,
  type CreateLeadData,
  type HqDemoStats,
  type HqLeadApiRow,
  type HqLeadStats,
  type HqLeadStorageInfo,
} from '@/lib/api';

type StatusFilter = 'All' | 'New' | 'Demo' | 'Contacted' | 'Qualified' | 'Converted' | 'Lost' | 'Demos';

const STAGE_BY_FILTER: Record<Exclude<StatusFilter, 'All' | 'Demos'>, HqLeadStage> = {
  New: 'new',
  Demo: 'demo',
  Contacted: 'contacted',
  Qualified: 'qualified',
  Converted: 'converted',
  Lost: 'lost',
};

const STAGE_TO_STATUS: Record<HqLeadStage, string> = {
  new: 'New',
  demo: 'Demo',
  contacted: 'Contacted',
  qualified: 'Qualified',
  converted: 'Converted',
  lost: 'Lost',
};

function pickHqNextFollowUp(row: HqLeadApiRow): string | undefined {
  const pendingDates = (row.followUps || [])
    .filter((item) => {
      const status = String(item.status || '').toLowerCase();
      return status !== 'completed' && status !== 'done' && status !== 'cancelled';
    })
    .map((item) => item.scheduledAt)
    .filter((value): value is string => isValidFollowUpInstant(value))
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  if (pendingDates[0]) return pendingDates[0];
  const fallback = row.nextFollowUpAt || row.nextFollowUp || '';
  return isValidFollowUpInstant(fallback) ? String(fallback) : undefined;
}

function LeadFollowUpTableCell({
  lastFollowUp,
  nextFollowUp,
}: {
  lastFollowUp: string;
  nextFollowUp?: string;
}) {
  const last = splitDateTimeForDisplay(lastFollowUp);
  const next = splitDateTimeForDisplay(nextFollowUp);
  return (
    <div className="flex min-w-[9rem] flex-col gap-2">
      {last ? (
        <div className="rounded-xl bg-indigo-500/[0.06] px-2.5 py-2 ring-1 ring-indigo-500/10">
          <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-indigo-600/90">Last</p>
          <p className="mt-0.5 text-xs font-semibold leading-snug text-slate-800">{last.date}</p>
          <p className="mt-1 text-[10px] tabular-nums text-slate-500">{last.time}</p>
        </div>
      ) : (
        <span className="inline-flex rounded-lg bg-slate-100/80 px-2 py-1 text-[11px] font-medium text-slate-400">—</span>
      )}
      {next ? (
        <div className="rounded-xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 px-2.5 py-2 ring-1 ring-blue-400/15">
          <p className="text-xs font-semibold leading-snug text-blue-900">{next.date}</p>
          <p className="mt-1 text-[10px] tabular-nums text-blue-700/90">{next.time}</p>
        </div>
      ) : null}
    </div>
  );
}

function BookADemoTag() {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-black tracking-wide ring-1 ${BOOK_A_DEMO_TAG_CLASS}`}
    >
      BOOK A DEMO
    </span>
  );
}

const EMPTY_STATS: HqLeadStats = {
  total: 0,
  newLeads: 0,
  followUpsToday: 0,
  converted: 0,
  lost: 0,
  conversionRate: 0,
};

const EMPTY_DEMO_STATS: HqDemoStats = {
  total: 0,
  verified: 0,
  pending: 0,
  expired: 0,
};

function mapHqLeadToFrontend(row: HqLeadApiRow): Lead {
  const status = (row.status || STAGE_TO_STATUS[row.stage] || HQ_LEAD_STAGE_LABELS[row.stage] || 'New') as LeadStatus;
  const source = (row.source || row.leadSource || null) as LeadSource | null;
  const completedFollowUps = (row.followUps || []).filter((item) => {
    const value = String(item.status || '').toLowerCase();
    return value === 'completed' || value === 'done';
  });
  const lastCompleted = [...completedFollowUps].sort(
    (a, b) =>
      new Date(b.completedAt || b.scheduledAt || b.createdAt || 0).getTime() -
      new Date(a.completedAt || a.scheduledAt || a.createdAt || 0).getTime(),
  )[0];
  return {
    id: row.id,
    companyName: row.company || '',
    type: (row.type as Lead['type']) || 'Company',
    source,
    contactPerson: row.contactPerson || row.name || '',
    directorSalutation: row.directorSalutation || undefined,
    directorName: row.directorName || row.name || '',
    email: row.email || '',
    phone: row.phone || '',
    emails: row.emails || (row.email ? [row.email] : []),
    phones: row.phones || (row.phone ? [row.phone] : []),
    status,
    convertedToClientId: row.convertedToCompanyId || undefined,
    assignedTo: {
      id: row.assignedToId || undefined,
      name:
        (Array.isArray(row.assignedToUsers) && row.assignedToUsers.length > 0
          ? row.assignedToUsers.map((u) => u.name).filter(Boolean).join(', ')
          : '') ||
        row.owner ||
        'Unassigned',
      avatar: '',
    },
    assignedToId: row.assignedToId || undefined,
    assignedToIds: row.assignedToIds || [],
    assignedToUsers: (row.assignedToUsers || []).map((user) => ({
      id: user.id,
      name: user.name,
      avatar: '',
      email: user.email,
    })),
    lastFollowUp: lastCompleted?.completedAt || lastCompleted?.scheduledAt || lastCompleted?.createdAt || '',
    nextFollowUp: pickHqNextFollowUp(row),
    priority: (row.priority as Priority) || 'Medium',
    interestedNeeds: row.interestedNeeds || row.interestedModules?.join(', ') || '',
    servicesNeeded: row.servicesNeeded || undefined,
    notes: row.notes || row.initialNotes || '',
    expectedBusinessValue: row.expectedBusinessValue || String(row.estimatedDealValue || ''),
    activities: [],
    notesList: (row.remarks || []).map((remark) => ({
      id: remark.id,
      title: String(remark.text || 'Remark').slice(0, 48),
      content: remark.text,
      tags: [],
      createdBy: { name: remark.createdByEmail || 'HQ' },
      createdAt: remark.createdAt || '',
    })),
    hqFollowUps: row.followUps || [],
    hqRemarks: row.remarks || [],
    industry: row.industry || '',
    website: row.website || undefined,
    linkedIn: row.linkedIn || undefined,
    location: row.location || undefined,
    designation: row.designation || undefined,
    country: row.country || undefined,
    city: row.city || undefined,
    state: row.state || undefined,
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    campaignName: row.campaignName || undefined,
    campaignLink: row.campaignLink || undefined,
    referralName: row.referralName || undefined,
    sourceWebsiteUrl: row.sourceWebsiteUrl || undefined,
    sourceLinkedInUrl: row.sourceLinkedInUrl || undefined,
    sourceEmail: row.sourceEmail || undefined,
    teamMemberDesignation: row.teamMemberDesignation || undefined,
    teamMemberEmail: row.teamMemberEmail || undefined,
    teamMemberPhone: row.teamMemberPhone || undefined,
    otherDetails: row.otherDetails || [],
  };
}

function mapHqLeadToBackendLead(row: HqLeadApiRow): BackendLead {
  return {
    id: row.id,
    companyName: row.company || null,
    contactPerson: row.contactPerson || row.name || null,
    directorName: row.directorName || row.name || null,
    directorSalutation: row.directorSalutation || null,
    email: row.email || null,
    phone: row.phone || null,
    emails: row.emails || [],
    phones: row.phones || [],
    type: (row.type as BackendLead['type']) || 'Company',
    source: (row.source || row.leadSource || 'Website') as BackendLead['source'],
    status: (row.status || HQ_LEAD_STAGE_LABELS[row.stage] || 'New') as BackendLead['status'],
    convertedToClientId: row.convertedToCompanyId || null,
    priority: (row.priority as BackendLead['priority']) || 'Medium',
    interestedNeeds: row.interestedNeeds || null,
    notes: row.notes || row.initialNotes || null,
    industry: row.industry || null,
    website: row.website || null,
    linkedIn: row.linkedIn || null,
    location: row.location || null,
    country: row.country || null,
    city: row.city || null,
    state: row.state || null,
    nextFollowUp: row.nextFollowUpAt || null,
    assignedToId: row.assignedToId || null,
    assignedToIds: row.assignedToIds || [],
    assignedTo: {
      id: row.assignedToId || '',
      name:
        (Array.isArray(row.assignedToUsers) && row.assignedToUsers.length > 0
          ? row.assignedToUsers.map((u) => u.name).filter(Boolean).join(', ')
          : '') ||
        row.owner ||
        'Unassigned',
      email: row.assignedToUsers?.[0]?.email || null,
      avatar: null,
    },
    assignedToUsers: row.assignedToUsers || [],
  };
}

export default function HqLeadsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const highlightLeadId = searchParams.get('leadId') || searchParams.get('lead');
  const leadAiGate = useAiCoinGate('ai.lead_chat');

  const [leads, setLeads] = useState<HqLeadApiRow[]>([]);
  const [stats, setStats] = useState<HqLeadStats>(EMPTY_STATS);
  const [storage, setStorage] = useState<HqLeadStorageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [demos, setDemos] = useState<HqDemoRequestRow[]>([]);
  const [demoStats, setDemoStats] = useState<HqDemoStats>(EMPTY_DEMO_STATS);
  const [demosLoading, setDemosLoading] = useState(false);
  const [grantDemo, setGrantDemo] = useState<HqDemoRequestRow | null>(null);
  const [grantTrialDays, setGrantTrialDays] = useState(5);
  const [grantNote, setGrantNote] = useState('');
  const [grantSubmitting, setGrantSubmitting] = useState(false);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [sourceFilter, setSourceFilter] = useState('');
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState<TablePageSize>(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [addLeadDrawerOpen, setAddLeadDrawerOpen] = useState(false);
  const [addLeadWithAi, setAddLeadWithAi] = useState(false);
  const [createLeadMode, setCreateLeadMode] = useState<'ai' | 'manual'>('manual');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [selectedLeadDrawerMode, setSelectedLeadDrawerMode] = useState<'view' | 'edit'>('view');

  const isDemosTab = statusFilter === 'Demos';

  const loadLeads = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await apiHqListLeads();
      const d = result.data;
      setLeads(d?.leads ?? []);
      setStats(d?.stats ?? EMPTY_STATS);
      setStorage(d?.storage ?? null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load HQ leads');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDemos = useCallback(async () => {
    setDemosLoading(true);
    try {
      const result = await apiHqListDemoRequests();
      const d = result.data;
      setDemos((d?.demos as HqDemoRequestRow[]) ?? []);
      setDemoStats(d?.stats ?? EMPTY_DEMO_STATS);
    } catch {
      setDemos([]);
      setDemoStats(EMPTY_DEMO_STATS);
    } finally {
      setDemosLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLeads();
    void loadDemos();
  }, [loadLeads, loadDemos]);

  useEffect(() => {
    if (isDemosTab) void loadDemos();
  }, [isDemosTab, loadDemos]);

  useEffect(() => {
    if (!highlightLeadId || loading || leads.length === 0) return;
    const match = leads.find((lead) => lead.id === highlightLeadId);
    if (match) {
      setAddLeadDrawerOpen(false);
      setSelectedLeadDrawerMode('view');
      setSelectedLeadId(match.id);
      const sp = new URLSearchParams(searchParams.toString());
      sp.delete('leadId');
      sp.delete('lead');
      const qs = sp.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }
  }, [highlightLeadId, loading, leads, router, pathname, searchParams]);

  const metrics = useMemo(() => {
    const counts = { NEW_LEADS: 0, DEMO: 0, CONTACTED: 0, QUALIFIED: 0, CONVERTED: 0, LOST: 0 };
    for (const lead of leads) {
      if (isBookADemoLead(lead) || lead.stage === 'demo') counts.DEMO += 1;
      else if (lead.stage === 'new') counts.NEW_LEADS += 1;
      else if (lead.stage === 'contacted') counts.CONTACTED += 1;
      else if (lead.stage === 'qualified') counts.QUALIFIED += 1;
      else if (lead.stage === 'converted') counts.CONVERTED += 1;
      else if (lead.stage === 'lost') counts.LOST += 1;
    }
    return counts;
  }, [leads]);

  const filteredLeads = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((lead) => {
      if (statusFilter !== 'All' && statusFilter !== 'Demos') {
        if (statusFilter === 'Demo') {
          if (lead.stage !== 'demo' && !isBookADemoLead(lead)) return false;
        } else if (lead.stage !== STAGE_BY_FILTER[statusFilter]) {
          return false;
        }
      }
      if (sourceFilter) {
        const source = String(lead.source || lead.leadSource || '');
        if (source.toLowerCase() !== sourceFilter.toLowerCase()) return false;
      }
      if (!q) return true;
      return (
        (lead.name || '').toLowerCase().includes(q) ||
        (lead.company || '').toLowerCase().includes(q) ||
        (lead.email || '').toLowerCase().includes(q) ||
        (lead.contactPerson || '').toLowerCase().includes(q) ||
        (lead.owner || '').toLowerCase().includes(q) ||
        (lead.leadSource || '').toLowerCase().includes(q) ||
        (lead.phone || '').toLowerCase().includes(q)
      );
    });
  }, [statusFilter, sourceFilter, search, leads]);

  const pagedLeads = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLeads.slice(start, start + pageSize);
  }, [filteredLeads, currentPage, pageSize]);

  const filteredDemos = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return demos;
    return demos.filter(
      (d) =>
        d.fullName.toLowerCase().includes(q) ||
        d.email.toLowerCase().includes(q) ||
        d.organizationName.toLowerCase().includes(q),
    );
  }, [demos, search]);

  const selectedLeadRow = useMemo(() => {
    if (!selectedLeadId) return null;
    return leads.find((l) => l.id === selectedLeadId) ?? null;
  }, [selectedLeadId, leads]);

  const selectedLead = useMemo(() => {
    return selectedLeadRow ? mapHqLeadToFrontend(selectedLeadRow) : null;
  }, [selectedLeadRow]);

  const clearDrawerQuery = useCallback(() => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete('leadId');
    sp.delete('lead');
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [router, pathname, searchParams]);

  const handleStatusCardClick = (status: StatusFilter) => {
    setCurrentPage(1);
    setStatusFilter((prev) => (prev === status ? 'All' : status));
  };

  const handleCreateLeadOverride = async (data: CreateLeadData) => {
    const result = await apiHqCreateLead({
      ...data,
      formSchema: 'phase2',
      hqProductLine: (data as CreateLeadData & { hqProductLine?: string }).hqProductLine,
      hqProductLines: (data as CreateLeadData & { hqProductLines?: string[] }).hqProductLines,
    } as CreateLeadData & { formSchema?: string; hqProductLine?: string });
    const created = result.data?.lead;
    if (!created) return null;
    return mapHqLeadToBackendLead(created);
  };

  const handleUpdateLeadOverride = async (leadId: string, data: Record<string, unknown>) => {
    const result = await apiHqUpdateLead(leadId, { ...data, formSchema: 'phase2' });
    const updated = result.data?.lead;
    if (!updated) return null;
    setLeads((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    return mapHqLeadToBackendLead(updated);
  };

  const handleConvert = async (
    id: string,
    _form?: {
      companyName: string;
      primaryContact: string;
      email: string;
      phone: string;
      industry: string;
      companySize: string;
      accountManager: string;
      createJobRequirement: boolean;
    },
  ) => {
    try {
      const result = await apiHqConvertLeadToCompany(id);
      const company = result.data?.company;
      const updatedLead = result.data?.lead;
      if (updatedLead) {
        setLeads((prev) => prev.map((item) => (item.id === updatedLead.id ? updatedLead : item)));
      } else {
        await loadLeads();
      }
      setSelectedLeadId(null);
      setAddLeadDrawerOpen(false);
      toast.success(
        company?.name
          ? `Converted “${company.name}” to Client — also listed under Companies`
          : 'Lead converted to HQ Client / Company',
        {
          action: company?.id
            ? {
                label: 'Open Client',
                onClick: () =>
                  router.push(`/hq/clients?clientId=${encodeURIComponent(company.id)}`),
              }
            : undefined,
          cancel: company?.id
            ? {
                label: 'Companies',
                onClick: () =>
                  router.push(`/hq/company?company=${encodeURIComponent(company.id)}`),
              }
            : undefined,
        },
      );
      if (company?.id) {
        router.push(`/hq/clients?clientId=${encodeURIComponent(company.id)}`);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to convert lead');
    }
  };

  const handleDeleteLead = async (id: string) => {
    if (!window.confirm('Delete this HQ lead? This cannot be undone.')) return;
    try {
      await apiHqDeleteLead(id);
      setSelectedLeadId(null);
      setAddLeadDrawerOpen(false);
      setAddLeadWithAi(false);
      await loadLeads();
      toast.success('Lead deleted');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete lead');
    }
  };

  const handleMarkLost = async (id: string) => {
    try {
      await apiHqUpdateLead(id, { stage: 'lost', status: 'Lost', formSchema: 'phase2' });
      await loadLeads();
      toast.success('Lead marked as lost');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to mark lead lost');
    }
  };

  const handleAssignLead = async (
    leadId: string,
    formData: { assignTo: string; assignTos?: string[]; priority: 'High' | 'Medium' | 'Low' },
  ) => {
    try {
      const ids =
        formData.assignTos && formData.assignTos.length > 0
          ? formData.assignTos
          : formData.assignTo
            ? [formData.assignTo]
            : [];
      await apiHqUpdateLead(leadId, {
        assignedToId: ids[0] || null,
        assignedToIds: ids,
        priority: formData.priority,
        formSchema: 'phase2',
      });
      toast.success(ids.length > 1 ? `Lead assigned to ${ids.length} members` : 'Lead assigned');
      await loadLeads();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to assign lead');
    }
  };

  const handleInlineStatusChange = async (leadId: string, status: string) => {
    const stage = (Object.entries(STAGE_TO_STATUS).find(([, label]) => label === status)?.[0] ||
      status.toLowerCase()) as HqLeadStage;
    try {
      await apiHqUpdateLead(leadId, { status, stage, formSchema: 'phase2' });
      await loadLeads();
      toast.success(`Status updated to ${status}`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update status');
    }
  };

  const handleDeleteDemo = async (demoId: string) => {
    if (!window.confirm('Delete this landing signup?')) return;
    await apiHqDeleteDemoRequest(demoId);
      await loadDemos();
  };

  const openGrantTrialModal = (demo: HqDemoRequestRow) => {
    setGrantDemo(demo);
    setGrantTrialDays(Number(demo.trialDays) > 0 ? Number(demo.trialDays) : 5);
    setGrantNote('');
  };

  const handleGrantTrial = async () => {
    if (!grantDemo) return;
    const days = Math.max(1, Math.min(365, Number(grantTrialDays) || 5));
    setGrantSubmitting(true);
    try {
      const result = await apiHqGrantDemoTrial(grantDemo.id, {
        trialDays: days,
        note: grantNote.trim() || undefined,
      });
      const data = result.data;
      if (data?.credentialEmailSent === false && data?.credentialEmailError) {
        toast.warning(data.message || 'Access granted, but credential email failed.');
      } else if (data?.alreadyProvisioned) {
        toast.success(data.message || 'Trial dates refreshed for existing tenant.');
      } else {
        toast.success(
          data?.credentialEmailSent
            ? `Try-free access granted (${days} days). Credentials emailed.`
            : `Try-free access granted (${days} days).`
        );
      }
      setGrantDemo(null);
      await loadDemos();
      await loadLeads();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to grant try-free access');
    } finally {
      setGrantSubmitting(false);
    }
  };

  const exportCsv = () => {
    const rows = isDemosTab ? filteredDemos : filteredLeads;
    if (rows.length === 0) {
      toast.error('Nothing to export');
      return;
    }
    let csv: string;
    if (isDemosTab) {
      const header = ['Name', 'Email', 'Company', 'Kind', 'Status', 'Try-free', 'Submitted'];
      const body = filteredDemos.map((d) =>
        [
          d.fullName,
          d.email,
          d.organizationName,
          d.requestKind,
          d.status,
          formatDemoTryFreeAccessLabel(d),
          d.submittedAt,
        ]
          .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
          .join(','),
      );
      csv = [header.join(','), ...body].join('\n');
    } else {
      const header = [
        'Lead',
        'Company',
        'Email',
        'Phone',
        'Source',
        'Interested in',
        'Stage',
        'Owner',
        'Next Follow-up',
      ];
      const body = filteredLeads.map((l) =>
        [
          l.name,
          l.company,
          l.email || '',
          l.phone || '',
          formatHqLeadSourceDisplay(l.leadSource, l.leadSourceDetail),
          resolveHqLeadProductLines(l)
            .map((line) => (line === 'recruitment' ? 'Recruitment' : 'CRM'))
            .join(' + ') || '',
          HQ_LEAD_STAGE_LABELS[l.stage],
          l.owner || '',
          l.nextFollowUp || '',
        ]
          .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
          .join(','),
      );
      csv = [header.join(','), ...body].join('\n');
    }
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hq-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Exported CSV');
  };

  return (
    <HqCrmEmbed>
      <div className="ph2-page-shell flex h-[100dvh] w-full flex-col overflow-hidden text-slate-900">
        <Toaster position="top-right" richColors style={{ top: '5rem' }} />

        {(selectedLead || addLeadDrawerOpen) && (
          <LeadDetailsDrawer
            lead={addLeadDrawerOpen ? null : selectedLead}
            addLeadMode={addLeadDrawerOpen}
            initialOpenAiChat={addLeadWithAi}
            initialMode={selectedLeadDrawerMode}
            onClose={() => {
              setAddLeadDrawerOpen(false);
              setAddLeadWithAi(false);
              setSelectedLeadId(null);
              setSelectedLeadDrawerMode('view');
              clearDrawerQuery();
            }}
            createLeadOverride={handleCreateLeadOverride}
            updateLeadOverride={handleUpdateLeadOverride}
            onAddLead={async (_data, createdLead) => {
              setAddLeadDrawerOpen(false);
              setAddLeadWithAi(false);
              await loadLeads();
              toast.success(
                createdLead?.companyName
                  ? `Lead created for ${createdLead.companyName}`
                  : 'HQ lead created successfully',
              );
              if (createdLead?.id) {
                setSelectedLeadDrawerMode('view');
                setSelectedLeadId(createdLead.id);
              }
            }}
            onUpdateLead={async () => {
              await loadLeads();
            }}
            onConvert={handleConvert}
            onMarkLost={handleMarkLost}
            onAssignLead={handleAssignLead}
            onDeleteLead={handleDeleteLead}
            onOpenExistingLead={(leadId) => {
              setAddLeadDrawerOpen(false);
              setAddLeadWithAi(false);
              setSelectedLeadDrawerMode('view');
              setSelectedLeadId(leadId);
            }}
          />
        )}

        <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          <header className="min-h-[4.5rem] flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3 shrink-0 border-b border-indigo-100/50 bg-white/80 backdrop-blur-md shadow-[inset_0_-1px_0_0_rgba(99,102,241,0.08)]">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 via-orange-500 to-amber-500 text-white shadow-lg shadow-rose-500/30 ring-1 ring-white/20">
                <Target className="h-5 w-5" strokeWidth={2.2} />
              </div>
              <div>
                <h1 className="text-xl sm:text-[1.35rem] font-bold tracking-tight text-slate-900 leading-none">
                  Leads
                </h1>
                {storage ? (
                  <p className="mt-1 text-[10px] font-medium text-slate-400">
                    HQ · {storage.database}/{storage.collection} · convert → Client + Company
                  </p>
                ) : (
                  <p className="mt-1 text-[10px] font-medium text-slate-400">
                    Convert a lead to create the Client / Company record
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
            <button
              type="button"
                onClick={() => void (isDemosTab ? loadDemos() : loadLeads())}
                disabled={loading || demosLoading}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-indigo-200/80 bg-white text-indigo-700 shadow-[0_4px_14px_-4px_rgba(99,102,241,0.2)] transition-all hover:border-indigo-300 hover:bg-indigo-50/90 active:scale-[0.98] disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCcw
                  size={16}
                  strokeWidth={2.25}
                  className={loading || demosLoading ? 'animate-spin' : ''}
                />
            </button>
            <button
              type="button"
                onClick={exportCsv}
                className="bg-white hover:bg-indigo-50/90 text-indigo-900 px-3 py-2 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-all shadow-[0_4px_14px_-4px_rgba(99,102,241,0.25)] border border-indigo-200/70 hover:border-indigo-300 hover:shadow-[0_6px_20px_-4px_rgba(99,102,241,0.35)] active:scale-[0.98]"
            >
                <Download size={16} className="text-indigo-600" strokeWidth={2.25} />
                <span>Export</span>
            </button>
            <button
              type="button"
                onClick={() => toast.message('CSV import for HQ leads is coming soon')}
                className="bg-white hover:bg-indigo-50/90 text-indigo-900 px-3 py-2 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-all shadow-[0_4px_14px_-4px_rgba(99,102,241,0.25)] border border-indigo-200/70 hover:border-indigo-300 hover:shadow-[0_6px_20px_-4px_rgba(99,102,241,0.35)] active:scale-[0.98]"
              >
                <Upload size={16} className="text-indigo-600" strokeWidth={2.25} />
                <span>Import</span>
              </button>
              <div
                role="group"
                aria-label="Create lead"
                className="inline-flex items-center rounded-lg border border-slate-200/90 bg-slate-100/90 p-0.5 shadow-[0_4px_14px_-4px_rgba(99,102,241,0.18)]"
              >
                <button
                  type="button"
                  aria-pressed={createLeadMode === 'ai'}
                  onClick={() => {
                    if (leadAiGate.locked) {
                      leadAiGate.confirmAndUnlock();
                      return;
                    }
                    setCreateLeadMode('ai');
                    setAddLeadWithAi(true);
                    setSelectedLeadId(null);
                    setAddLeadDrawerOpen(true);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                    leadAiGate.locked
                      ? 'text-amber-800 hover:bg-amber-50'
                      : createLeadMode === 'ai'
                        ? 'bg-white text-violet-800 shadow-sm ring-1 ring-violet-200/70'
                        : 'text-slate-500 hover:bg-white/60 hover:text-violet-700'
                  }`}
                  title={
                    leadAiGate.locked
                      ? `Locked — needs ${leadAiGate.cost} coins (you have ${leadAiGate.coins})`
                      : `Create a lead with AI (${leadAiGate.cost} coins per chat message)`
                  }
                >
                  {leadAiGate.locked ? (
                    <Lock size={14} className="text-amber-600" strokeWidth={2.25} />
                  ) : (
                    <Sparkles size={14} className="text-violet-600" strokeWidth={2.25} />
                  )}
                  <span>Create with AI</span>
                  <AiCoinLockBadge featureId="ai.lead_chat" />
                </button>
                <button
                  type="button"
                  aria-pressed={createLeadMode === 'manual'}
                  onClick={() => {
                    setCreateLeadMode('manual');
                    setAddLeadWithAi(false);
                    setSelectedLeadId(null);
                    setAddLeadDrawerOpen(true);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                    createLeadMode === 'manual'
                      ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white shadow-sm'
                      : 'text-slate-500 hover:bg-white/60 hover:text-indigo-700'
                  }`}
                  title="Create a lead manually"
                >
                  <Plus
                    size={14}
                    className={createLeadMode === 'manual' ? 'text-white' : 'text-indigo-500'}
                    strokeWidth={2.5}
                  />
                  <span>Create Manually</span>
            </button>
          </div>
            </div>
          </header>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 py-4 sm:px-5 sm:py-6 lg:px-6">
            {loadError ? (
              <div className="mb-4 shrink-0 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                {loadError}
            <button
              type="button"
                  onClick={() => void loadLeads()}
              className="ml-2 font-semibold underline"
            >
                  Retry
            </button>
          </div>
        ) : null}

            <div className="mb-5 grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 xl:grid-cols-7">
              {loading ? (
                (['blue', 'yellow', 'purple', 'orange', 'green', 'gray', 'blue'] as SummaryCardColor[]).map((c, i) => (
                  <SummaryCardSkeleton key={i} color={c} />
                ))
          ) : (
            <>
                  <SummaryCard
                    label="NEW LEADS"
                    count={metrics.NEW_LEADS || stats.newLeads}
                    color="blue"
                    icon={<Plus size={16} strokeWidth={2.35} />}
                    active={statusFilter === 'New'}
                    onClick={() => handleStatusCardClick('New')}
                  />
                  <SummaryCard
                    label="DEMO"
                    count={metrics.DEMO}
                    color="orange"
                    icon={<Target size={16} strokeWidth={2.35} />}
                    active={statusFilter === 'Demo'}
                    onClick={() => handleStatusCardClick('Demo')}
                  />
                  <SummaryCard
                    label="CONTACTED"
                    count={metrics.CONTACTED}
                    color="yellow"
                    icon={<Phone size={16} strokeWidth={2.35} />}
                    active={statusFilter === 'Contacted'}
                    onClick={() => handleStatusCardClick('Contacted')}
                  />
                  <SummaryCard
                    label="QUALIFIED"
                    count={metrics.QUALIFIED}
                    color="purple"
                    icon={<Target size={16} strokeWidth={2.35} />}
                    active={statusFilter === 'Qualified'}
                    onClick={() => handleStatusCardClick('Qualified')}
                  />
                  <SummaryCard
                    label="CONVERTED"
                    count={metrics.CONVERTED || stats.converted}
                    color="green"
                    icon={<CheckCircle size={16} strokeWidth={2.35} />}
                    active={statusFilter === 'Converted'}
                    onClick={() => handleStatusCardClick('Converted')}
                  />
                  <SummaryCard
                    label="LOST"
                    count={metrics.LOST || stats.lost}
                    color="gray"
                    icon={<XCircle size={16} strokeWidth={2.35} />}
                    active={statusFilter === 'Lost'}
                    onClick={() => handleStatusCardClick('Lost')}
                  />
                  <SummaryCard
                    label="LANDING SIGNUPS"
                    count={demoStats.total || demos.length}
                    color="blue"
                    icon={<CalendarClock size={16} strokeWidth={2.35} />}
                    active={statusFilter === 'Demos'}
                    onClick={() => handleStatusCardClick('Demos')}
                  />
            </>
          )}
          </div>

            <div className="mb-0 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-indigo-100/60 bg-white/70 shadow-[0_12px_40px_-18px_rgba(59,130,246,0.18)] backdrop-blur-sm transition-shadow hover:shadow-[0_16px_48px_-14px_rgba(79,70,229,0.16)]">
              <div className="flex shrink-0 items-center gap-2 overflow-x-auto ph2-invisible-scrollbar border-b border-indigo-100/40 bg-gradient-to-br from-white via-indigo-50/25 to-violet-50/20 p-3 sm:p-4">
                <div className="relative min-w-[14rem] max-w-md shrink-0 grow basis-[14rem] sm:basis-[18rem]">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400"
                    size={16}
                    strokeWidth={2.25}
                  />
              <input
                    type="text"
                placeholder={
                  isDemosTab
                        ? 'Search signups by name, email, or company...'
                        : 'Search company, email, or contact...'
                    }
                    className="h-9 w-full rounded-xl border border-indigo-100/90 bg-white/95 pl-10 pr-3 text-xs text-slate-800 placeholder:text-slate-400 transition-all focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 [box-shadow:inset_0_1px_2px_rgba(15,23,42,0.04)]"
                    value={search}
                    onChange={(e) => {
                      setCurrentPage(1);
                      setSearch(e.target.value);
                    }}
              />
            </div>
                <select
                  className="h-9 shrink-0 rounded-lg border border-indigo-100/90 bg-white/95 px-2.5 py-1.5 text-xs font-medium text-slate-800 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-300 cursor-pointer hover:border-indigo-200/90 hover:bg-indigo-50/40"
                  value={statusFilter}
                  onChange={(e) => {
                    setCurrentPage(1);
                    setStatusFilter(e.target.value as StatusFilter);
                  }}
                >
                  <option value="All">All Status</option>
                  <option value="New">New</option>
                  <option value="Demo">Demo</option>
                  <option value="Contacted">Contacted</option>
                  <option value="Qualified">Qualified</option>
                  <option value="Converted">Converted</option>
                  <option value="Lost">Lost</option>
                  <option value="Demos">Landing signups ({demoStats.total || demos.length})</option>
                </select>
                {!isDemosTab ? (
                  <select
                    className="h-9 shrink-0 rounded-lg border border-indigo-100/90 bg-white/95 px-2.5 py-1.5 text-xs font-medium text-slate-800 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-300 cursor-pointer hover:border-indigo-200/90 hover:bg-indigo-50/40"
                    value={sourceFilter}
                    onChange={(e) => {
                      setCurrentPage(1);
                      setSourceFilter(e.target.value);
                    }}
                  >
                    <option value="">All Sources</option>
                    <option value="Website">Website</option>
                    <option value="LinkedIn">LinkedIn</option>
                    <option value="Email">Email</option>
                    <option value="Referral">Referral</option>
                    <option value="Campaign">Campaign</option>
                  </select>
                ) : null}
          </div>

              <div className="ph2-table-body-scroll min-h-0 flex-1 overflow-auto">
            {isDemosTab ? (
                  <>
                  {filteredDemos.length > 0 && (
                    <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 bg-slate-50/50">
                      <p className="text-xs text-slate-500">
                        {filteredDemos.length} landing signup{filteredDemos.length !== 1 ? 's' : ''} — these are form submissions from your website / landing page
                      </p>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!window.confirm(`Delete all ${filteredDemos.length} landing signups? This cannot be undone.`)) return;
                          for (const d of filteredDemos) {
                            try { await apiHqDeleteDemoRequest(d.id); } catch {}
                          }
                          await loadDemos();
                          toast.success('All signups deleted');
                        }}
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                      >
                        <Trash2 size={12} /> Delete All
                      </button>
                    </div>
                  )}
                  <table className="w-full min-w-[860px] text-left" aria-label="Landing signups">
                    <thead className="sticky top-0 z-10">
                      <tr>
                        <th>Contact</th>
                        <th>Company</th>
                        <th>Kind</th>
                        <th>Status</th>
                        <th>Try-free</th>
                        <th>Submitted</th>
                        <th className="text-right">Actions</th>
                  </tr>
                </thead>
                    <tbody className="divide-y divide-slate-100/80">
                  {demosLoading ? (
                    <tr>
                          <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500">
                            Loading landing signups…
                      </td>
                    </tr>
                  ) : filteredDemos.length === 0 ? (
                    <tr>
                          <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500">
                            No landing signups found.
                      </td>
                    </tr>
                  ) : (
                        filteredDemos.map((demo) => {
                          const accessStatus = getDemoTryFreeAccessStatus(demo);
                          const canGrant = demo.status === 'VERIFIED';
                          return (
                      <tr
                        key={demo.id}
                            className="even:bg-slate-50/35 hover:bg-indigo-50/45 transition-colors"
                          >
                            <td className="px-3 sm:px-4 py-2">
                              <div className="font-semibold text-slate-900 text-xs">{demo.fullName}</div>
                              <div className="text-[11px] text-slate-400">{demo.email}</div>
                            </td>
                            <td className="px-3 sm:px-4 py-2 text-xs text-slate-600">
                              {demo.organizationName}
                            </td>
                            <td className="px-3 sm:px-4 py-2 text-xs capitalize text-slate-600">
                              {demo.requestKind}
                            </td>
                            <td className="px-3 sm:px-4 py-2">
                              <div className="flex flex-wrap items-center gap-1.5">
                                {demo.requestKind === 'demo' ? <BookADemoTag /> : null}
                          <span
                                  className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-black tracking-wide ring-1 ${HQ_DEMO_STATUS_STYLES[demo.status]}`}
                          >
                                  {HQ_DEMO_STATUS_LABELS[demo.status]}
                          </span>
                              </div>
                        </td>
                            <td className="px-3 sm:px-4 py-2">
                              <span
                                className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-wide ring-1 ${
                                  accessStatus === 'active'
                                    ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                                    : accessStatus === 'expired'
                                      ? 'bg-rose-50 text-rose-700 ring-rose-200'
                                      : 'bg-slate-100 text-slate-600 ring-slate-200'
                                }`}
                              >
                                {formatDemoTryFreeAccessLabel(demo)}
                              </span>
                              {demo.trialLoginId ? (
                                <div className="mt-1 text-[10px] text-slate-400">{demo.trialLoginId}</div>
                          ) : null}
                        </td>
                            <td className="px-3 sm:px-4 py-2 text-xs text-slate-600">
                              {demo.submittedAt}
                        </td>
                            <td className="px-3 sm:px-4 py-2 text-right">
                              <div className="inline-flex items-center gap-1">
                                {canGrant ? (
                          <button
                            type="button"
                                    onClick={() => openGrantTrialModal(demo)}
                                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-emerald-50 hover:text-emerald-700"
                                    aria-label={`Grant try-free access to ${demo.fullName}`}
                                    title="Grant try-free access"
                                  >
                                    <KeyRound className="h-4 w-4" />
                          </button>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteDemo(demo.id)}
                                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                                  aria-label={`Delete ${demo.fullName}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                        </td>
                      </tr>
                          );
                        })
                  )}
                </tbody>
              </table>
                  </>
                ) : (
                  <table className="w-full min-w-[1080px] text-left" aria-label="Leads">
                    <thead className="sticky top-0 z-10">
                      <tr>
                        <th className="min-w-[11rem]">Lead</th>
                        <th>Source</th>
                        <th>Interested in</th>
                        <th>Contact</th>
                        <th>Status</th>
                        <th>Assigned To</th>
                        <th>Follow-up</th>
                        <th className="text-right">Actions</th>
                </tr>
              </thead>
                    <tbody className="divide-y divide-slate-100/80">
                {loading ? (
                  <tr>
                          <td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-500">
                            Loading HQ leads…
                    </td>
                  </tr>
                ) : filteredLeads.length === 0 ? (
                  <tr>
                          <td colSpan={8} className="px-4 py-12 text-center">
                            <p className="text-xs font-medium text-slate-500">
                      {leads.length === 0
                                ? 'No leads yet. Use Create with AI or Create Manually.'
                                : 'No leads match your filters'}
                            </p>
                            <p className="mt-1 text-[11px] text-slate-400">
                              Try adjusting search or clear filters
                            </p>
                    </td>
                  </tr>
                ) : (
                        pagedLeads.map((lead) => {
                          const mapped = mapHqLeadToFrontend(lead);
                          const productLines = resolveHqLeadProductLines(lead);
                          return (
                    <tr
                      key={lead.id}
                            onClick={() => {
                              setAddLeadDrawerOpen(false);
                              setAddLeadWithAi(false);
                              setSelectedLeadDrawerMode('view');
                              setSelectedLeadId(lead.id);
                            }}
                            className={`cursor-pointer group transition-colors duration-200 ${
                              selectedLeadId === lead.id
                                ? 'bg-blue-50/70 hover:bg-blue-50/85'
                                : 'even:bg-slate-50/35 hover:bg-indigo-50/45'
                            }`}
                          >
                            <td className="px-3 sm:px-4 py-2 min-w-[11rem] align-middle">
                              <div className="flex items-center gap-2">
                                <TableBrandAvatar
                                  name={lead.company || lead.name}
                                  size="sm"
                                  showStatusDot={lead.stage !== 'lost'}
                                  statusDotTitle={`Lead: ${mapped.status}`}
                                />
                                <div className="flex min-w-[8rem] flex-col justify-center gap-0.5">
                                  <span className="text-xs font-semibold text-slate-900 whitespace-normal break-words">
                                    {lead.company || lead.name}
                                  </span>
                                  <span className="text-[10px] font-medium text-slate-500">
                                    {mapped.type}
                                  </span>
                                </div>
                              </div>
                      </td>
                            <td className="px-3 sm:px-4 py-2" onClick={(e) => e.stopPropagation()}>
                              <SourceCell lead={mapped} />
                      </td>
                            <td className="px-3 sm:px-4 py-2">
                              <HqLeadProductLineBadges lines={productLines} />
                            </td>
                            <td className="px-3 sm:px-4 py-2">
                              <div className="flex flex-col gap-0.5">
                                <span className="text-xs font-medium text-slate-800">
                                  {formatDirectorDisplay(mapped.directorSalutation, mapped.directorName || mapped.contactPerson)}
                                </span>
                                <span className="text-[10px] text-slate-500">
                                  {formatContactListDisplay(mapped.emails, mapped.email)}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 sm:px-4 py-2" onClick={(e) => e.stopPropagation()}>
                              <div className="flex flex-col gap-1.5">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <select
                                    className="max-w-[10rem] cursor-pointer rounded-full border-0 bg-slate-100/80 px-2 py-1 text-[11px] font-semibold text-slate-800 shadow-sm ring-1 ring-slate-200/90 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                                    value={mapped.status}
                                    onChange={(e) => void handleInlineStatusChange(lead.id, e.target.value)}
                                  >
                                    {Object.values(STAGE_TO_STATUS).map((status) => (
                                      <option key={status} value={status}>
                                        {status}
                                      </option>
                                    ))}
                                    {!Object.values(STAGE_TO_STATUS).includes(String(mapped.status)) ? (
                                      <option value={mapped.status}>{mapped.status}</option>
                                    ) : null}
                                  </select>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 sm:px-4 py-2">
                              <AssigneeAvatars lead={mapped} />
                            </td>
                            <td className="px-3 sm:px-4 py-2">
                              <LeadFollowUpTableCell
                                lastFollowUp={mapped.lastFollowUp}
                                nextFollowUp={mapped.nextFollowUp}
                              />
                            </td>
                            <td className="px-3 sm:px-4 py-2">
                              <div className="flex items-center justify-end gap-1">
                                {lead.employerDemoRequestId ? (
                          <button
                            type="button"
                                    title="Grant try-free access"
                            onClick={(e) => {
                              e.stopPropagation();
                                      openGrantTrialModal({
                                        id: lead.employerDemoRequestId as string,
                                        fullName: lead.contactPerson || lead.name || 'Lead',
                                        email: lead.email || '',
                                        organizationName: lead.company || '—',
                                        countryCode: '',
                                        dialCode: '',
                                        phoneNumber: lead.phone || '',
                                        companySize: '—',
                                        outcome: '',
                                        requestKind: 'demo',
                                        trialProvisioned: false,
                                        trialTenantDbName: '',
                                        trialLoginId: '',
                                        trialStartsAt: null,
                                        trialEndsAt: null,
                                        trialLoginUrl: '',
                                        status: 'VERIFIED',
                                        emailVerifiedAt: null,
                                        createdAt: null,
                                        submittedAt: '',
                                      });
                                    }}
                                    className="rounded-lg p-1.5 text-emerald-600 transition hover:bg-emerald-50"
                                  >
                                    <KeyRound className="h-4 w-4" />
                          </button>
                                ) : null}
                                {lead.stage !== 'converted' && lead.stage !== 'lost' ? (
                          <button
                            type="button"
                                    title="Convert to Client"
                            onClick={(e) => {
                              e.stopPropagation();
                                      void handleConvert(lead.id);
                            }}
                                    className="rounded-lg p-1.5 text-emerald-600 transition hover:bg-emerald-50"
                          >
                                    <UserPlus className="h-4 w-4" />
                          </button>
                                ) : null}
                        <button
                          type="button"
                                  title="Delete"
                          onClick={(e) => {
                            e.stopPropagation();
                                    void handleDeleteLead(lead.id);
                          }}
                                  className="rounded-lg p-1.5 text-rose-500 transition hover:bg-rose-50"
                        >
                                  <Trash2 className="h-4 w-4" />
                        </button>
                        </div>
                      </td>
                    </tr>
                          );
                        })
                )}
              </tbody>
            </table>
            )}
          </div>
              {!isDemosTab && !loading && !loadError ? (
                <div className="mt-0 w-full shrink-0 border-t border-indigo-100/50 bg-gradient-to-r from-slate-50/40 via-white to-indigo-50/25 px-3 py-2 sm:px-4">
                  <PaginationAll
                    initialPage={currentPage}
                    totalPages={Math.max(1, Math.ceil(filteredLeads.length / pageSize))}
                    totalCount={filteredLeads.length}
                    pageSize={pageSize}
                    pageSizeOptions={[...TABLE_PAGE_SIZE_OPTIONS]}
                    onPageSizeChange={(n) => {
                      if (!(TABLE_PAGE_SIZE_OPTIONS as readonly number[]).includes(n)) return;
                      setPageSize(n as TablePageSize);
                      setCurrentPage(1);
                    }}
                    itemLabel="leads"
                    onPageChange={setCurrentPage}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </main>

        {grantDemo ? (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="grant-try-free-title"
              className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-slate-200"
            >
              <h2 id="grant-try-free-title" className="text-lg font-bold text-slate-900">
                Grant try-free access
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Email credentials to <span className="font-medium text-slate-700">{grantDemo.email || grantDemo.fullName}</span>{' '}
                for the try-free login page. The password you email is their final login password — they will not be forced to reset it on first sign-in.
              </p>
              <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Trial days
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={grantTrialDays}
                  onChange={(e) => setGrantTrialDays(Number(e.target.value) || 5)}
                  className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </label>
              <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Note (optional)
                <textarea
                  value={grantNote}
                  onChange={(e) => setGrantNote(e.target.value)}
                  rows={3}
                  placeholder="Internal note for this grant"
                  className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </label>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={grantSubmitting}
                  onClick={() => setGrantDemo(null)}
                  className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={grantSubmitting}
                  onClick={() => void handleGrantTrial()}
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {grantSubmitting ? 'Granting…' : 'Grant & email credentials'}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </HqCrmEmbed>
  );
}
