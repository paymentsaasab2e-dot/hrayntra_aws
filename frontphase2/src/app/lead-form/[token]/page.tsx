'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import {
  Loader2,
  Pencil,
  Phone,
  Plus,
  RefreshCcw,
  Search,
  Target,
  Trash2,
  CheckCircle,
  XCircle,
  X,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Toaster, toast } from 'sonner';
import {
  apiDeletePublicLeadFormLead,
  apiGetLead,
  apiGetPublicLeadForm,
  apiGetPublicLeadFormSubmissions,
  apiLogin,
  apiSubmitPublicLeadForm,
  apiUpdatePublicLeadFormLead,
  formatAuthErrorMessage,
  syncTenantDbName,
  type BackendLead,
  type CreateLeadData,
} from '../../../lib/api';
import { buildLoginDevicePayload } from '../../../lib/sessionAuth';
import { LeadDetailsDrawer } from '../../../components/drawers/LeadDetailsDrawer';
import type { Lead, LeadSource, LeadStatus, LeadType, Priority } from '../../leads/types';
import { isLeadSource, LEAD_SOURCE_OPTIONS } from '../../../components/drawers/LeadSourceFields';
import { formatDateDMY } from '../../../utils/dateDisplay';
import { formatContactListDisplay } from '../../../lib/contact-channels';
import { SummaryCard, type SummaryCardColor } from '../../../components/ui/SummaryCard';
import { TableBrandAvatar } from '../../../components/ui/TableBrandAvatar';
import { SourceCell } from '../../leads/SourceCell';
import { TableSkeleton } from '../../../components/ui/Skeleton';

const SESSION_IDS_KEY_PREFIX = 'ph2.publicLeadForm.myLeadIds.';
const LEAD_FORM_GATE_PREFIX = 'ph2.leadForm.unlocked.';

function leadFormGateKey(token: string) {
  return `${LEAD_FORM_GATE_PREFIX}${token}`;
}

function isLeadFormUnlocked(token: string) {
  if (!token || typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(leadFormGateKey(token)) === '1';
  } catch {
    return false;
  }
}

function unlockLeadForm(token: string) {
  if (!token) return;
  try {
    sessionStorage.setItem(leadFormGateKey(token), '1');
  } catch {
    /* ignore */
  }
}

function mapPublicLeadToFrontend(row: Record<string, unknown>): Lead {
  const source = isLeadSource(String(row.source || '')) ? (row.source as LeadSource) : undefined;
  const email = String(row.email || '');
  const phone = String(row.phone || '');
  const emails = Array.isArray(row.emails)
    ? (row.emails as string[]).filter(Boolean)
    : email
      ? [email]
      : [];
  const phones = Array.isArray(row.phones)
    ? (row.phones as string[]).filter(Boolean)
    : phone
      ? [phone]
      : [];

  return {
    id: String(row.id || ''),
    companyName: String(row.companyName || ''),
    type: (row.type === 'Individual' ? 'Individual' : 'Company') as LeadType,
    source,
    contactPerson: String(row.contactPerson || row.directorName || ''),
    directorName: row.directorName ? String(row.directorName) : undefined,
    email,
    phone,
    emails,
    phones,
    status: (String(row.status || 'New') || 'New') as LeadStatus,
    assignedTo: { name: 'Unassigned', avatar: '' },
    assignedToIds: [],
    assignedToUsers: [],
    lastFollowUp: '',
    priority: ((row.priority as Priority) || 'Medium') as Priority,
    interestedNeeds: String(row.interestedNeeds || ''),
    notes: String(row.notes || ''),
    activities: [],
    notesList: [],
    industry: row.industry ? String(row.industry) : undefined,
    website: row.website ? String(row.website) : undefined,
    linkedIn: row.linkedIn ? String(row.linkedIn) : undefined,
    location: row.location ? String(row.location) : undefined,
    designation: row.designation ? String(row.designation) : undefined,
    country: row.country ? String(row.country) : undefined,
    city: row.city ? String(row.city) : undefined,
    state: row.state ? String(row.state) : undefined,
    campaignName: row.campaignName ? String(row.campaignName) : undefined,
    campaignLink: row.campaignLink ? String(row.campaignLink) : undefined,
    sourceOther: row.sourceOther ? String(row.sourceOther) : undefined,
    otherDetails: Array.isArray(row.otherDetails)
      ? (row.otherDetails as Array<{ label: string; value: string }>)
      : undefined,
    createdDate: row.createdAt ? formatDateDMY(String(row.createdAt)) : undefined,
  };
}

function statusBadgeClass(status: string) {
  const key = status.toLowerCase();
  if (key === 'new') return 'bg-blue-50 text-blue-700 border-blue-200';
  if (key === 'contacted') return 'bg-amber-50 text-amber-800 border-amber-200';
  if (key === 'qualified') return 'bg-violet-50 text-violet-700 border-violet-200';
  if (key === 'converted') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (key === 'lost') return 'bg-rose-50 text-rose-700 border-rose-200';
  return 'bg-slate-50 text-slate-700 border-slate-200';
}

function readSessionLeadIds(token: string): string[] {
  try {
    const raw = localStorage.getItem(`${SESSION_IDS_KEY_PREFIX}${token}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function writeSessionLeadIds(token: string, ids: string[]) {
  try {
    localStorage.setItem(`${SESSION_IDS_KEY_PREFIX}${token}`, JSON.stringify(ids.slice(0, 200)));
  } catch {
    /* ignore */
  }
}

export default function PublicLeadFormPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const token = typeof params?.token === 'string' ? params.token : '';
  const tenantDbName =
    searchParams.get('tenantDbName')?.trim() || searchParams.get('tenant')?.trim() || '';

  const [pageTitle, setPageTitle] = useState('Leads');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'All'>('All');
  const [sourceFilter, setSourceFilter] = useState('');
  const [myLeadIds, setMyLeadIds] = useState<string[]>([]);
  const [onlyMine, setOnlyMine] = useState(false);

  const [addLeadDrawerOpen, setAddLeadDrawerOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [selectedLeadDrawerMode, setSelectedLeadDrawerMode] = useState<'view' | 'edit'>('view');
  const [authReady, setAuthReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginId, setLoginId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; companyName: string } | null>(
    null
  );
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  useEffect(() => {
    if (tenantDbName) syncTenantDbName(tenantDbName);
    // Never reuse the main Phase 2 accessToken. This emailed link must show login first.
    setIsAuthenticated(isLeadFormUnlocked(token));
    setAuthReady(true);
  }, [token, tenantDbName]);

  useEffect(() => {
    if (!token) return;
    setMyLeadIds(readSessionLeadIds(token));
  }, [token]);

  const loadSubmissions = useCallback(async () => {
    if (!token || !tenantDbName || !isAuthenticated) return;
    setLeadsLoading(true);
    try {
      const res = await apiGetPublicLeadFormSubmissions(token, tenantDbName);
      const payload =
        (res as { data?: { leads?: Array<Record<string, unknown>> } })?.data ?? res;
      const rows = Array.isArray((payload as { leads?: unknown }).leads)
        ? (payload as { leads: Array<Record<string, unknown>> }).leads
        : [];
      setLeads(rows.map(mapPublicLeadToFrontend).filter((lead) => Boolean(lead.id)));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load leads');
    } finally {
      setLeadsLoading(false);
    }
  }, [token, tenantDbName, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!token) {
      setError('Invalid lead form link');
      setLoading(false);
      return;
    }
    if (!tenantDbName) {
      setError('This lead form link is missing the tenant parameter');
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    void apiGetPublicLeadForm(token, tenantDbName)
      .then((res) => {
        if (cancelled) return;
        const payload = (res as { data?: { title?: string } })?.data ?? res;
        const data = payload as { title?: string };
        setPageTitle(data.title || 'Leads');
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load lead form');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      setLoading(false);
    };
  }, [token, tenantDbName, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !token || !tenantDbName || loading) return;
    void loadSubmissions();
  }, [token, tenantDbName, loading, loadSubmissions, isAuthenticated]);

  const metrics = useMemo(() => {
    const counts = {
      NEW_LEADS: 0,
      CONTACTED: 0,
      QUALIFIED: 0,
      CONVERTED: 0,
      LOST: 0,
    };
    for (const lead of leads) {
      const status = String(lead.status || '').toLowerCase();
      if (status === 'new') counts.NEW_LEADS += 1;
      else if (status === 'contacted') counts.CONTACTED += 1;
      else if (status === 'qualified') counts.QUALIFIED += 1;
      else if (status === 'converted') counts.CONVERTED += 1;
      else if (status === 'lost') counts.LOST += 1;
    }
    return counts;
  }, [leads]);

  const filteredLeads = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return leads.filter((lead) => {
      if (onlyMine && !myLeadIds.includes(lead.id)) return false;
      if (statusFilter !== 'All' && lead.status !== statusFilter) return false;
      if (sourceFilter && lead.source !== sourceFilter) return false;
      if (!q) return true;
      const haystack = [
        lead.companyName,
        lead.contactPerson,
        lead.email,
        lead.phone,
        ...(lead.emails || []),
        ...(lead.phones || []),
        lead.industry,
        lead.location,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [leads, searchQuery, statusFilter, sourceFilter, onlyMine, myLeadIds]);

  const openLeadDrawer = async (lead: Lead, mode: 'view' | 'edit' = 'view') => {
    setAddLeadDrawerOpen(false);
    setSelectedLeadDrawerMode(mode);
    if (isAuthenticated && lead.id) {
      try {
        const res = await apiGetLead(lead.id);
        const backend =
          ((res as { data?: BackendLead })?.data as BackendLead | undefined) ||
          (res as unknown as BackendLead);
        if (backend?.id) {
          setSelectedLead(mapPublicLeadToFrontend(backend as unknown as Record<string, unknown>));
          return;
        }
      } catch {
        /* use row data */
      }
    }
    setSelectedLead(lead);
  };

  const rememberMyLead = (leadId: string) => {
    if (!token || !leadId) return;
    setMyLeadIds((prev) => {
      const next = prev.includes(leadId) ? prev : [leadId, ...prev];
      writeSessionLeadIds(token, next);
      return next;
    });
  };

  const createLeadOverride = useCallback(
    async (data: CreateLeadData) => {
      let addedByName = '';
      let addedByEmail = '';
      let addedById = '';
      try {
        const raw = localStorage.getItem('currentUser');
        if (raw) {
          const user = JSON.parse(raw) as {
            id?: string;
            name?: string;
            firstName?: string;
            lastName?: string;
            email?: string;
          };
          addedByName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.name || '';
          addedByEmail = String(user.email || '').trim();
          addedById = String(user.id || '').trim();
        }
      } catch {
        /* ignore */
      }
      const res = await apiSubmitPublicLeadForm(
        token,
        {
          companyName: data.companyName,
          contactPerson: data.contactPerson || data.directorName,
          email: data.email,
          phone: data.phone,
          designation: data.designation,
          industry: data.industry || data.sector,
          website: data.website,
          linkedIn: data.linkedIn,
          location: data.location,
          country: data.country,
          city: data.city,
          state: data.state,
          type: data.type === 'Individual' ? 'Individual' : 'Company',
          source: data.source || 'Website',
          sourceOther: data.source === 'Other' ? String(data.sourceOther || '').trim() || undefined : undefined,
          interestedNeeds: data.interestedNeeds || data.servicesNeeded,
          notes: data.notes,
          addedByName,
          addedByEmail,
          addedById,
        },
        tenantDbName
      );
      const created =
        ((res as { data?: Record<string, unknown> })?.data as Record<string, unknown> | undefined) ||
        (res as unknown as Record<string, unknown>);
      if (!created?.id) {
        throw new Error('Lead was submitted but no id was returned');
      }
      return created as unknown as BackendLead;
    },
    [token, tenantDbName]
  );

  const updateLeadOverride = useCallback(
    async (leadId: string, data: Record<string, unknown>) => {
      const res = await apiUpdatePublicLeadFormLead(token, leadId, data, tenantDbName);
      const updated =
        ((res as { data?: BackendLead })?.data as BackendLead | undefined) ||
        (res as unknown as BackendLead);
      if (!updated?.id) {
        throw new Error('Lead was saved but no id was returned');
      }
      return updated;
    },
    [token, tenantDbName]
  );

  const requestDeleteLead = (lead: { id: string; companyName?: string }) => {
    if (!lead?.id) return;
    setDeleteConfirm({ id: lead.id, companyName: lead.companyName || 'this lead' });
  };

  const handleConfirmDeleteLead = async () => {
    if (!deleteConfirm?.id) return;
    setDeleteSubmitting(true);
    try {
      await apiDeletePublicLeadFormLead(token, deleteConfirm.id, tenantDbName);
      setLeads((prev) => prev.filter((row) => row.id !== deleteConfirm.id));
      setMyLeadIds((prev) => {
        const next = prev.filter((id) => id !== deleteConfirm.id);
        writeSessionLeadIds(token, next);
        return next;
      });
      if (selectedLead?.id === deleteConfirm.id) {
        setSelectedLead(null);
      }
      toast.success(`Lead "${deleteConfirm.companyName}" deleted`);
      setDeleteConfirm(null);
      void loadSubmissions();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete lead');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const handleStatusCardClick = (status: LeadStatus) => {
    setStatusFilter((prev) => (prev === status ? 'All' : status));
  };

  const handleLeadFormLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    const identifier = loginId.trim();
    const password = loginPassword.trim();
    if (!identifier || !password) {
      setLoginError('Login ID and password are required.');
      return;
    }
    if (tenantDbName) syncTenantDbName(tenantDbName);
    setLoginSubmitting(true);
    setLoginError('');
    try {
      const device = await buildLoginDevicePayload();
      let response = await apiLogin(identifier, password, device);
      if (response.data?.duplicateSession) {
        response = await apiLogin(identifier, password, {
          ...device,
          forceSessionTakeover: true,
        });
      }
      if (!localStorage.getItem('accessToken')) {
        throw new Error('Failed to store authentication token. Please try again.');
      }
      unlockLeadForm(token);
      setIsAuthenticated(true);
      setLoginPassword('');
      toast.success('Signed in. Opening the lead form…');
    } catch (err: unknown) {
      setLoginError(
        formatAuthErrorMessage(err as { message?: string }, 'Invalid login ID or password.')
      );
    } finally {
      setLoginSubmitting(false);
    }
  };

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-lg rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm">
          <p className="text-base font-semibold text-rose-700">Invalid lead form link</p>
        </div>
      </div>
    );
  }

  if (!tenantDbName) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-lg rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm">
          <p className="text-base font-semibold text-rose-700">This lead form link is missing the tenant parameter</p>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Ask for the full link that includes{' '}
            <span className="font-mono text-slate-800">?tenantDbName=…</span>.
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#f8fafc_0%,#eef2ff_48%,#f8fafc_100%)] px-4">
        <Toaster position="top-right" richColors />
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 px-6 py-5">
            <p className="text-lg font-semibold text-slate-900">Sign in to open this lead form</p>
            <p className="mt-1 text-xs text-slate-500">
              Use the login ID and password that were emailed with this link
              {tenantDbName ? (
                <>
                  {' '}
                  · <span className="font-mono">{tenantDbName}</span>
                </>
              ) : null}
            </p>
          </div>
          <form onSubmit={handleLeadFormLogin} className="space-y-3 px-6 py-5">
            {loginError ? (
              <p className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {loginError}
              </p>
            ) : null}
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold text-slate-700">
                Login ID / Gmail <span className="text-rose-500">*</span>
              </span>
              <input
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                placeholder="Login ID or email"
                autoComplete="username"
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold text-slate-700">
                Password <span className="text-rose-500">*</span>
              </span>
              <div className="relative">
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Password"
                  autoComplete="current-password"
                  data-writing-assist="off"
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 pr-10 text-sm outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-700"
                  aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                >
                  {showLoginPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>
            <button
              type="submit"
              disabled={loginSubmitting}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {loginSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Sign in
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600 [font-size:100%]">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
        <span className="ml-3 text-sm font-medium">Loading leads…</span>
      </div>
    );
  }

  if (error && leads.length === 0 && !addLeadDrawerOpen) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 [font-size:100%]">
        <div className="w-full max-w-lg rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm">
          <p className="text-base font-semibold text-rose-700">{error}</p>
          {!tenantDbName ? (
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Ask for the full link that includes{' '}
              <span className="font-mono text-slate-800">?tenantDbName=…</span>.
            </p>
          ) : (
            <p className="mt-3 text-sm text-slate-600">
              Workspace: <span className="font-medium text-slate-800">{tenantDbName}</span>
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="ph2-page-shell flex h-[100dvh] w-full flex-col overflow-hidden bg-[linear-gradient(180deg,#f8fafc_0%,#eef2ff_48%,#f8fafc_100%)] text-slate-900 [font-size:100%]">
      <Toaster position="top-right" richColors />

      <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="flex min-h-[4.5rem] shrink-0 flex-wrap items-center justify-between gap-3 border-b border-indigo-100/50 bg-white/80 px-4 py-3 shadow-[inset_0_-1px_0_0_rgba(99,102,241,0.08)] backdrop-blur-md sm:px-6">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 via-orange-500 to-amber-500 text-white shadow-lg shadow-rose-500/30 ring-1 ring-white/20">
              <Target className="h-5 w-5" strokeWidth={2.2} />
            </div>
            <div>
              <h1 className="text-xl font-bold leading-none tracking-tight text-slate-900 sm:text-[1.35rem]">
                {pageTitle || 'Leads'}
              </h1>
              {tenantDbName ? (
                <p className="mt-1 text-[11px] font-medium text-slate-500">
                  Public intake · {tenantDbName}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadSubmissions()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200/70 bg-white px-3 py-2 text-xs font-semibold text-indigo-900 shadow-[0_4px_14px_-4px_rgba(99,102,241,0.25)] transition-all hover:border-indigo-300 hover:bg-indigo-50/90"
              title="Refresh leads"
            >
              <RefreshCcw size={16} className={`text-indigo-600 ${leadsLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedLead(null);
                setAddLeadDrawerOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-500/30 transition-all hover:from-blue-700 hover:via-indigo-700 hover:to-violet-700 active:scale-[0.98]"
            >
              <Plus size={16} strokeWidth={2.5} />
              <span>Add Lead</span>
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 py-4 sm:px-5 sm:py-6 lg:px-6">
          <div className="mb-5 grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
            {(
              [
                { label: 'NEW LEADS', count: metrics.NEW_LEADS, color: 'blue' as SummaryCardColor, status: 'New' as LeadStatus, icon: <Plus size={16} strokeWidth={2.35} /> },
                { label: 'CONTACTED', count: metrics.CONTACTED, color: 'yellow' as SummaryCardColor, status: 'Contacted' as LeadStatus, icon: <Phone size={16} strokeWidth={2.35} /> },
                { label: 'QUALIFIED', count: metrics.QUALIFIED, color: 'purple' as SummaryCardColor, status: 'Qualified' as LeadStatus, icon: <Target size={16} strokeWidth={2.35} /> },
                { label: 'CONVERTED', count: metrics.CONVERTED, color: 'green' as SummaryCardColor, status: 'Converted' as LeadStatus, icon: <CheckCircle size={16} strokeWidth={2.35} /> },
                { label: 'LOST', count: metrics.LOST, color: 'gray' as SummaryCardColor, status: 'Lost' as LeadStatus, icon: <XCircle size={16} strokeWidth={2.35} /> },
              ] as const
            ).map((card) => (
              <SummaryCard
                key={card.label}
                label={card.label}
                count={card.count}
                color={card.color}
                icon={card.icon}
                active={statusFilter === card.status}
                onClick={() => handleStatusCardClick(card.status)}
              />
            ))}
          </div>

          <div className="mb-3 flex shrink-0 flex-col gap-2 rounded-xl border border-indigo-100/80 bg-white/90 p-3 shadow-sm sm:flex-row sm:items-center sm:px-4">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search company, email, or contact…"
                className="h-9 w-full rounded-lg border border-indigo-100 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none ring-indigo-500/20 placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as LeadStatus | 'All')}
              className="h-9 rounded-lg border border-indigo-100 bg-white px-3 text-xs font-semibold text-slate-700"
            >
              <option value="All">All Status</option>
              <option value="New">New</option>
              <option value="Contacted">Contacted</option>
              <option value="Qualified">Qualified</option>
              <option value="Converted">Converted</option>
              <option value="Lost">Lost</option>
            </select>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="h-9 rounded-lg border border-indigo-100 bg-white px-3 text-xs font-semibold text-slate-700"
            >
              <option value="">All Sources</option>
              {LEAD_SOURCE_OPTIONS.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setOnlyMine((prev) => !prev)}
              className={`h-9 rounded-lg border px-3 text-xs font-semibold transition ${
                onlyMine
                  ? 'border-teal-300 bg-teal-50 text-teal-800'
                  : 'border-indigo-100 bg-white text-slate-700 hover:bg-slate-50'
              }`}
              title="Show only leads you added in this browser"
            >
              {onlyMine ? 'Showing my entries' : 'My entries'}
            </button>
            {(searchQuery || statusFilter !== 'All' || sourceFilter || onlyMine) && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('All');
                  setSourceFilter('');
                  setOnlyMine(false);
                }}
                className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-rose-600 hover:bg-rose-50"
              >
                <X size={14} />
                Clear
              </button>
            )}
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-indigo-100/80 bg-white shadow-[0_12px_40px_-24px_rgba(49,46,129,0.35)]">
            <div className="ph2-table-body-scroll min-h-0 flex-1 overflow-auto">
              {leadsLoading && leads.length === 0 ? (
                <TableSkeleton rows={8} columns={6} />
              ) : (
                <table className="w-full min-w-[860px] text-left" aria-label="Public intake leads">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-indigo-100/50 bg-gradient-to-r from-slate-50/95 via-indigo-50/50 to-violet-50/40 text-[9px] font-bold uppercase tracking-[0.12em] text-indigo-950/45 backdrop-blur-sm">
                      <th className="px-3 py-2 sm:px-4">Lead</th>
                      <th className="px-3 py-2 sm:px-4">Source</th>
                      <th className="px-3 py-2 sm:px-4">Contact</th>
                      <th className="px-3 py-2 sm:px-4">Status</th>
                      <th className="px-3 py-2 sm:px-4">Location</th>
                      <th className="px-3 py-2 sm:px-4">Added</th>
                      <th className="px-3 py-2 text-right sm:px-4">Entered by</th>
                      <th className="px-3 py-2 text-right sm:px-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/80">
                    {filteredLeads.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-12 text-center">
                          <p className="text-xs font-medium text-slate-500">No leads match your filters</p>
                          <p className="mt-1 text-[11px] text-slate-400">
                            Click Add Lead to enter a new company through this form
                          </p>
                        </td>
                      </tr>
                    ) : (
                      filteredLeads.map((lead) => {
                        const mine = myLeadIds.includes(lead.id);
                        return (
                          <tr
                            key={lead.id}
                            className={`group cursor-pointer transition-colors duration-200 ${
                              mine
                                ? 'bg-teal-50/70 hover:bg-teal-50/90'
                                : 'even:bg-slate-50/35 hover:bg-indigo-50/45'
                            }`}
                            onClick={() => void openLeadDrawer(lead, 'view')}
                          >
                            <td className="px-3 py-2 align-middle sm:px-4">
                              <div className="flex items-center gap-2">
                                <TableBrandAvatar
                                  name={lead.companyName}
                                  size="sm"
                                  showStatusDot={lead.status !== 'Lost'}
                                  statusDotTitle={`Lead: ${lead.status}`}
                                />
                                <div className="min-w-0">
                                  <button
                                    type="button"
                                    className="truncate text-left text-sm font-semibold text-slate-900 hover:text-indigo-700"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void openLeadDrawer(lead, 'view');
                                    }}
                                  >
                                    {lead.companyName || '—'}
                                  </button>
                                  <p className="text-[11px] text-slate-500">{lead.type}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2 sm:px-4" onClick={(e) => e.stopPropagation()}>
                              <SourceCell lead={lead} />
                            </td>
                            <td className="px-3 py-2 sm:px-4">
                              <p className="text-sm font-medium text-slate-800">
                                {lead.contactPerson || '—'}
                              </p>
                              <p className="text-[11px] text-slate-500">
                                {formatContactListDisplay(lead.emails, lead.email) ||
                                  formatContactListDisplay(lead.phones, lead.phone) ||
                                  '—'}
                              </p>
                            </td>
                            <td className="px-3 py-2 sm:px-4">
                              <span
                                className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusBadgeClass(
                                  String(lead.status)
                                )}`}
                              >
                                {lead.status}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-sm text-slate-700 sm:px-4">
                              {lead.location ||
                                [lead.city, lead.state, lead.country].filter(Boolean).join(', ') ||
                                '—'}
                            </td>
                            <td className="px-3 py-2 text-sm text-slate-600 sm:px-4">
                              {lead.createdDate || '—'}
                            </td>
                            <td className="px-3 py-2 text-right sm:px-4">
                              {mine ? (
                                <span className="inline-flex rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-800">
                                  You
                                </span>
                              ) : (
                                <span className="text-[11px] font-medium text-slate-400">Form entry</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right sm:px-4" onClick={(e) => e.stopPropagation()}>
                              <div className="inline-flex items-center justify-end gap-0.5 rounded-xl bg-slate-100/70 p-0.5 ring-1 ring-slate-200/60">
                                {lead.status !== 'Converted' ? (
                                  <button
                                    type="button"
                                    className="flex h-7 w-7 items-center justify-center rounded-lg text-amber-600 hover:bg-white hover:text-amber-800 hover:shadow-sm transition-all"
                                    title="Edit Lead"
                                    onClick={() => void openLeadDrawer(lead, 'edit')}
                                  >
                                    <Pencil size={15} strokeWidth={2.35} />
                                  </button>
                                ) : null}
                                {lead.status !== 'Converted' ? (
                                  <button
                                    type="button"
                                    className="flex h-7 w-7 items-center justify-center rounded-lg text-rose-500 hover:bg-white hover:text-rose-800 hover:shadow-sm transition-all"
                                    title="Delete Lead"
                                    onClick={() => requestDeleteLead(lead)}
                                  >
                                    <Trash2 size={15} strokeWidth={2.35} />
                                  </button>
                                ) : null}
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
            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-indigo-100/60 bg-gradient-to-b from-white to-indigo-50/20 px-4 py-2.5 text-[11px] text-slate-500">
              <span>
                Showing {filteredLeads.length} of {leads.length} lead
                {leads.length === 1 ? '' : 's'}
                {myLeadIds.length > 0 ? ` · ${myLeadIds.length} entered by you` : ''}
              </span>
            </div>
          </div>
        </div>
      </main>

      {(selectedLead || addLeadDrawerOpen) && (
        <LeadDetailsDrawer
          lead={selectedLead}
          addLeadMode={addLeadDrawerOpen}
          initialMode={selectedLeadDrawerMode}
          createLeadOverride={createLeadOverride}
          updateLeadOverride={updateLeadOverride}
          onDeleteLead={(id) => {
            const row = leads.find((item) => item.id === id) || selectedLead;
            if (row) requestDeleteLead(row);
          }}
          onClose={() => {
            setSelectedLead(null);
            setAddLeadDrawerOpen(false);
          }}
          onAddLead={(_data, createdLead) => {
            setAddLeadDrawerOpen(false);
            if (createdLead?.id) {
              rememberMyLead(createdLead.id);
              const mapped = mapPublicLeadToFrontend(createdLead as unknown as Record<string, unknown>);
              setLeads((prev) => {
                if (prev.some((row) => row.id === mapped.id)) return prev;
                return [mapped, ...prev];
              });
              setSelectedLead(mapped);
              setSelectedLeadDrawerMode('view');
              toast.success('Lead added successfully');
            }
            void loadSubmissions();
          }}
          onUpdateLead={(updatedLead) => {
            if (!updatedLead?.id) {
              void loadSubmissions();
              return;
            }
            const mapped = mapPublicLeadToFrontend(updatedLead as unknown as Record<string, unknown>);
            setSelectedLead(mapped);
            setLeads((prev) => prev.map((row) => (row.id === mapped.id ? { ...row, ...mapped } : row)));
          }}
        />
      )}

      {deleteConfirm ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/50 p-4"
          onClick={() => {
            if (!deleteSubmitting) setDeleteConfirm(null);
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-rose-200 bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-medium text-slate-900">
              Are you sure you want to delete {deleteConfirm.companyName}?{' '}
              <span className="text-slate-500">This moves the lead to the recycle bin.</span>
            </p>
            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                disabled={deleteSubmitting}
                className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmDeleteLead()}
                disabled={deleteSubmitting}
                className="rounded-full bg-rose-600 px-6 py-2 text-sm font-bold text-white hover:bg-rose-500 disabled:opacity-60"
              >
                {deleteSubmitting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
