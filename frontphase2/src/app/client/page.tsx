'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  Plus,
  Upload,
  Download,
  RefreshCcw,
  MoreVertical,
  Search,
  Filter,
  Grid2x2,
  List,
  Building2,
  AlertCircle,
  X,
  Trash2,
  UserPlus,
  BadgeCheck,
  Users,
  Briefcase,
  BadgeInfo,
  Flame,
  FolderOpen,
} from 'lucide-react';
import { downloadCsv, csvDate } from '../../utils/csv';
import { formatDateDMY } from '../../utils/dateDisplay';
import { ClientTable } from '../../components/ClientTable';
import {
  ClientFilterDrawer,
  DEFAULT_CLIENT_FILTERS,
  applyClientFilters,
  isClientFilterActive,
  type ClientFilters,
} from '../../components/drawers/ClientFilterDrawer';
import { ClientDetailsDrawer } from '../../components/drawers/ClientDetailsDrawer';
import { ClientImportDrawer } from '../../components/drawers/ClientImportDrawer';
import { CreateJobDrawer } from '../../components/drawers/CreateJobDrawer';
import PaginationAll from '../../components/PaginationAll';
import { INITIAL_CLIENTS } from './types';
import type { Client } from './types';
import { apiGetClients, apiGetClient, apiDeleteClient, apiUpdateClient, type BackendClient, type BackendUser, type UpdateClientData } from '../../lib/api';
import { getAllTeamMembersForAssign, teamMembersToBackendUsers } from '../../lib/api/teamApi';
import { requestConfirm } from '../../lib/appDialog';
import { usePermissions } from '../../hooks/usePermissions';
import { usePageAutoRefresh } from '../../hooks/usePageAutoRefresh';
import { SummaryCard, SummaryCardSkeleton, type SummaryCardColor } from '../../components/ui/SummaryCard';
import { TableSkeleton } from '../../components/ui/Skeleton';

// Force client-side render so the page hydrates skeletons before the data fetch
// resolves — every interactive bit on this tab is client-driven anyway.
export const dynamic = 'force-dynamic';

function filterClientsByTab(clients: Client[], activeTab: string): Client[] {
  switch (activeTab) {
    case 'active':
      return clients.filter((client) => client.stage === 'Active');
    case 'on-hold':
      return clients.filter((client) => client.stage === 'On Hold');
    case 'inactive':
      return clients.filter((client) => client.stage === 'Inactive');
    case 'hot':
      return clients.filter((client) => client.priority === 'High');
    case 'all':
    default:
      return clients;
  }
}

/**
 * KPI strip — same modern Leads-style tiles (pastel gradient panel + frosted
 * icon chip + large number + small caps label). Reuses the shared
 * `<SummaryCard />` so all sidebar tabs share one design language.
 */
const StatusCards = ({
  activeTab,
  onTabChange,
  counts,
}: {
  activeTab: string;
  onTabChange: (tab: string) => void;
  counts: { all: number; active: number; 'on-hold': number; inactive: number; hot: number };
}) => {
  const cards: Array<{
    id: string;
    label: string;
    count: number;
    color: SummaryCardColor;
    icon: React.ReactNode;
  }> = [
    { id: 'all', label: 'All Clients', count: counts.all, color: 'indigo', icon: <FolderOpen size={18} strokeWidth={2.35} /> },
    { id: 'active', label: 'Active', count: counts.active, color: 'blue', icon: <Users size={18} strokeWidth={2.35} /> },
    { id: 'on-hold', label: 'On Hold', count: counts['on-hold'], color: 'orange', icon: <Briefcase size={18} strokeWidth={2.35} /> },
    { id: 'inactive', label: 'Inactive', count: counts.inactive, color: 'gray', icon: <BadgeInfo size={18} strokeWidth={2.35} /> },
    { id: 'hot', label: 'Hot', count: counts.hot, color: 'purple', icon: <Flame size={18} strokeWidth={2.35} /> },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 mb-6 sm:grid-cols-3 lg:grid-cols-5 lg:gap-4">
      {cards.map((card) => (
        <SummaryCard
          key={card.id}
          label={card.label}
          count={card.count}
          color={card.color}
          icon={card.icon}
          active={activeTab === card.id}
          onClick={() => onTabChange(card.id)}
        />
      ))}
    </div>
  );
};

/** Skeleton mirror of the StatusCards strip — used while clients fetch. */
const StatusCardsSkeleton = () => (
  <div className="grid grid-cols-2 gap-3 mb-6 sm:grid-cols-3 lg:grid-cols-5 lg:gap-4">
    {(['indigo', 'blue', 'orange', 'gray', 'purple'] as SummaryCardColor[]).map((color, i) => (
      <SummaryCardSkeleton key={i} color={color} />
    ))}
  </div>
);

// Empty State Component
const EmptyState = ({
  onImportClick,
  onCreateClick,
}: {
  onImportClick?: () => void;
  onCreateClick?: () => void;
}) => (
  <div className="rounded-xl border border-dashed border-slate-200 bg-white p-16 sm:p-20 flex flex-col items-center justify-center text-center shadow-sm">
    <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-blue-500/20 text-blue-600">
      <Building2 className="h-10 w-10" strokeWidth={2} />
    </div>
    <h3 className="text-xl font-bold text-slate-900 mb-2">No clients added yet</h3>
    <p className="text-slate-500 max-w-sm mb-8 text-sm">
      Start building your agency pipeline by adding your first client or importing them from a CSV file.
    </p>
    <div className="flex flex-wrap items-center justify-center gap-3">
      <button
        type="button"
        onClick={onCreateClick}
        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
      >
        <Plus className="h-4 w-4" strokeWidth={2.5} /> Create Client
      </button>
      <button
        type="button"
        onClick={onImportClick}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
      >
        <Upload className="h-4 w-4 text-slate-600" strokeWidth={2} /> Import Clients
      </button>
    </div>
  </div>
);

// Helper function to map backend client to frontend format
function mapBackendClientToFrontend(backendClient: BackendClient): Client {
  const statusMap: Record<string, Client['stage']> = {
    'ACTIVE': 'Active',
    'PROSPECT': 'Active',
    'ON_HOLD': 'On Hold',
    'INACTIVE': 'Inactive',
  };

  return {
    id: backendClient.id,
    name: backendClient.companyName,
    industry: backendClient.industry || 'Not specified',
    location: backendClient.location || 'Not specified',
    openJobs: backendClient._count?.jobs || 0,
    activeCandidates: 0,
    placements: backendClient._count?.placements || 0,
    stage: statusMap[backendClient.status] || 'Active',
    owner: backendClient.assignedTo ? {
      name: backendClient.assignedTo.name,
      avatar: backendClient.assignedTo.avatar || '',
    } : { name: 'Unassigned', avatar: '' },
    lastActivity: backendClient.updatedAt ? formatDateDMY(backendClient.updatedAt) : 'Never',
    logo: backendClient.logo || '',
    revenue: backendClient.revenueGenerated || undefined,
    companySize: backendClient.companySize || undefined,
    hiringLocations: backendClient.hiringLocations || undefined,
    servicesNeeded: backendClient.servicesNeeded || undefined,
    expectedBusinessValue: backendClient.expectedBusinessValue || undefined,
    leadStatus: backendClient.leadStatus || undefined,
    website: backendClient.website || undefined,
    linkedin: backendClient.linkedin || undefined,
    timezone: backendClient.timezone || undefined,
    clientSince: backendClient.clientSince ? formatDateDMY(backendClient.clientSince) : undefined,
    priority: backendClient.priority as Client['priority'] || undefined,
    sla: backendClient.sla || undefined,
    nextFollowUpDue: backendClient.nextFollowUpDue ? formatDateDMY(backendClient.nextFollowUpDue) : undefined,
    agreementsFileName: backendClient.agreementsFileName || undefined,
    agreementsFileUrl: backendClient.agreementsFileUrl || undefined,
    agreementsUploadedAt: backendClient.agreementsUploadedAt || undefined,
    city: backendClient.city || undefined,
    state: backendClient.state || undefined,
    country: backendClient.country || undefined,
    latitude: typeof backendClient.latitude === 'number' ? backendClient.latitude : undefined,
    longitude: typeof backendClient.longitude === 'number' ? backendClient.longitude : undefined,
    directorSalutation: backendClient.directorSalutation || undefined,
    leadStatusValue: backendClient.leadStatus || undefined,
    avgTimeToFill: backendClient.avgTimeToFill || undefined,
    healthStatus: backendClient.healthStatus as Client['healthStatus'] || undefined,
    billingTotalRevenue: backendClient.billingTotalRevenue || undefined,
    billingOutstanding: backendClient.billingOutstanding || undefined,
    billingPaid: backendClient.billingPaid || undefined,
    contacts: Array.isArray(backendClient.contacts)
      ? backendClient.contacts.map((contact, index) => {
          const fullName = [contact.firstName, contact.lastName].filter(Boolean).join(' ').trim();
          const lastContacted = contact.lastContacted
            ? formatDateDMY(contact.lastContacted)
            : contact.createdAt
              ? formatDateDMY(contact.createdAt)
              : 'Never';
          const normalizedDepartment = ['HR', 'Hiring', 'Hiring Manager', 'Finance', 'Other'].includes(
            String(contact.department || '')
          )
            ? String(contact.department)
            : 'Other';

          return {
            id: contact.id,
            name: fullName || 'Unknown Contact',
            designation: contact.designation || 'Not specified',
            department: normalizedDepartment as 'HR' | 'Hiring' | 'Hiring Manager' | 'Finance' | 'Other',
            email: contact.email || '',
            phone: contact.phone || '',
            isPrimary: index === 0,
            lastContacted,
          };
        })
      : undefined,
  };
}

function extractBackendClients(responseData: unknown): BackendClient[] {
  if (Array.isArray(responseData)) return responseData as BackendClient[];
  if (responseData && typeof responseData === 'object') {
    const payload = responseData as { data?: unknown; items?: unknown };
    if (Array.isArray(payload.data)) return payload.data as BackendClient[];
    if (Array.isArray(payload.items)) return payload.items as BackendClient[];
  }
  return [];
}

export default function App() {
  const DISPLAY_PAGE_SIZE = 10;
  const FETCH_LIMIT = 500;
  const SEARCH_DEBOUNCE_MS = 350;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { hasAnyPermission } = usePermissions();
  const canCreateJob = hasAnyPermission(['jobs_create', 'create_job']);
  const [activeTab, setActiveTab] = useState('all');
  const [clientNameSortOrder, setClientNameSortOrder] = useState<'asc' | 'desc'>('asc');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<ClientFilters>(DEFAULT_CLIENT_FILTERS);
  const currentUserName = useMemo(() => {
    if (typeof window === 'undefined') return '';
    try {
      const raw = localStorage.getItem('currentUser');
      if (!raw) return '';
      const parsed = JSON.parse(raw) as { name?: string; firstName?: string; lastName?: string };
      const composed = [parsed.firstName, parsed.lastName].filter(Boolean).join(' ').trim();
      return parsed.name || composed || '';
    } catch {
      return '';
    }
  }, []);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedClientDrawerMode, setSelectedClientDrawerMode] = useState<'view' | 'edit'>('view');
  const [showAddClientDrawer, setShowAddClientDrawer] = useState(false);
  const [showCreateJobDrawer, setShowCreateJobDrawer] = useState(false);
  const [clientIdForJob, setClientIdForJob] = useState<string | null>(null);
  const [isEmpty, setIsEmpty] = useState(false);
  const [showImportDrawer, setShowImportDrawer] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [teamMembers, setTeamMembers] = useState<BackendUser[]>([]);
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkAssignedTo, setBulkAssignedTo] = useState('');
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pendingDeepLinkClientIdRef = useRef<string | null>(null);

  const advancedFilteredClients = useMemo(
    () => applyClientFilters(clients, advancedFilters, currentUserName),
    [clients, advancedFilters, currentUserName]
  );
  const filteredClients = useMemo(
    () => filterClientsByTab(advancedFilteredClients, activeTab),
    [advancedFilteredClients, activeTab]
  );
  const sortedClients = useMemo(() => {
    const list = [...filteredClients];
    list.sort((a, b) => {
      const comparison = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      return clientNameSortOrder === 'asc' ? comparison : -comparison;
    });
    return list;
  }, [filteredClients, clientNameSortOrder]);
  const pagedClients = useMemo(() => {
    const start = (currentPage - 1) * DISPLAY_PAGE_SIZE;
    return sortedClients.slice(start, start + DISPLAY_PAGE_SIZE);
  }, [sortedClients, currentPage]);
  const tabCounts = useMemo(
    () => ({
      all: advancedFilteredClients.length,
      active: advancedFilteredClients.filter((c) => c.stage === 'Active').length,
      'on-hold': advancedFilteredClients.filter((c) => c.stage === 'On Hold').length,
      inactive: advancedFilteredClients.filter((c) => c.stage === 'Inactive').length,
      hot: advancedFilteredClients.filter((c) => c.priority === 'High').length,
    }),
    [advancedFilteredClients]
  );
  const industryOptions = useMemo(() => {
    const set = new Set<string>();
    clients.forEach((client) => {
      const industry = (client.industry || '').trim();
      if (industry && industry !== 'Not specified') set.add(industry);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [clients]);
  const filtersActive = isClientFilterActive(advancedFilters);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

  useEffect(() => {
    setCurrentPage(1);
  }, [advancedFilters]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(sortedClients.length / DISPLAY_PAGE_SIZE));
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, sortedClients.length]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
        if (!token) return;
        const members = await getAllTeamMembersForAssign();
        setTeamMembers(teamMembersToBackendUsers(members));
      } catch (err) {
        console.error('Failed to fetch users for bulk assignment:', err);
      }
    };

    fetchUsers();
  }, []);

  useEffect(() => {
    const clientId = searchParams.get('clientId');
    if (!clientId) {
      pendingDeepLinkClientIdRef.current = null;
      return;
    }
    // Only react when the URL parameter itself changes — without this guard,
    // closing the drawer (which clears `selectedClient`) used to re-fire and
    // immediately reopen the same client.
    if (pendingDeepLinkClientIdRef.current === clientId) {
      return;
    }
    pendingDeepLinkClientIdRef.current = clientId;

    let cancelled = false;
    void (async () => {
      try {
        const response = await apiGetClient(clientId);
        if (cancelled) return;
        const backendClient = (response as any).data?.data || (response as any).data || response;
        if (!backendClient) return;
        const mappedClient = mapBackendClientToFrontend(backendClient);
        setSelectedClient(mappedClient);
        setSelectedClientDrawerMode('view');
      } catch (error) {
        console.error('Failed to open client from search:', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  const fetchClients = useCallback(async (overrides?: { page?: number; search?: string }) => {
    try {
      setLoading(true);
      setError(null);

      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      if (!token) {
        setClients(INITIAL_CLIENTS);
        setIsEmpty(INITIAL_CLIENTS.length === 0);
        return;
      }

      const effectiveSearch = overrides?.search ?? debouncedSearchQuery;

      const response = await apiGetClients({
        search: effectiveSearch || undefined,
        page: 1,
        limit: FETCH_LIMIT,
        includeContacts: false,
        includeLeadFields: false,
      });

      const backendClients = response.data ? extractBackendClients(response.data) : [];

      if (!Array.isArray(backendClients)) {
        setError('Unexpected API response format.');
        setClients(INITIAL_CLIENTS);
        setIsEmpty(INITIAL_CLIENTS.length === 0);
        return;
      }

      const mappedClients = backendClients.map(mapBackendClientToFrontend);
      const clientMap = new Map<string, Client>();
      mappedClients.forEach((client) => {
        const id = String(client.id);
        clientMap.set(id, { ...client, id });
      });
      const uniqueClients = Array.from(clientMap.values());

      setClients(uniqueClients);
      setIsEmpty(uniqueClients.length === 0);
      setSelectedClients((prev) => prev.filter((id) => uniqueClients.some((c) => c.id === id)));
    } catch (err: any) {
      console.error('Failed to fetch clients:', err);
      setError(err?.message || 'Failed to fetch clients');
      setClients(INITIAL_CLIENTS);
      setIsEmpty(INITIAL_CLIENTS.length === 0);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearchQuery]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  // Reusable auto-refresh: poll while visible + refresh on focus + on
  // `jobportal:clients-changed` / `jobportal:jobs-changed`.
  const clientsAutoLoad = useCallback(
    () => {
      void fetchClients();
    },
    [fetchClients]
  );
  usePageAutoRefresh(clientsAutoLoad, {
    events: ['jobportal:clients-changed', 'jobportal:jobs-changed'],
  });

  const handleRefresh = useCallback(async () => {
    await fetchClients();
  }, [fetchClients]);

  const handleDeleteClient = async (id: string) => {
    const client = clients.find(c => c.id === id);
    if (!(await requestConfirm(`Are you sure you want to delete ${client?.name || 'this client'}?`))) return;

    try {
      await apiDeleteClient(id);
      setClients((prev) => prev.filter((c) => c.id !== id));
      setSelectedClients((prev) => prev.filter((selectedId) => selectedId !== id));
      void fetchClients();
    } catch (err: any) {
      console.error('Failed to delete client:', err);
    }
  };

  const clearBulkSelection = () => {
    setSelectedClients([]);
    setBulkStatus('');
    setBulkAssignedTo('');
  };

  const handleBulkDelete = async () => {
    if (selectedClients.length === 0) return;
    if (!(await requestConfirm(`Delete ${selectedClients.length} selected clients?`))) return;

    try {
      setBulkActionLoading(true);
      await Promise.all(selectedClients.map((id) => apiDeleteClient(id)));
      clearBulkSelection();
      await fetchClients();
    } catch (err: any) {
      console.error('Failed to bulk delete clients:', err);
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkUpdate = async (updates: UpdateClientData) => {
    if (selectedClients.length === 0) return;

    try {
      setBulkActionLoading(true);
      await Promise.all(selectedClients.map((id) => apiUpdateClient(id, updates)));
      clearBulkSelection();
      await fetchClients();
    } catch (err: any) {
      console.error('Failed to bulk update clients:', err);
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkStatusChange = async (status: string) => {
    setBulkStatus(status);
    if (status) await handleBulkUpdate({ status: status as UpdateClientData['status'] });
  };

  const handleBulkAssignChange = async (assignedToId: string) => {
    setBulkAssignedTo(assignedToId);
    if (assignedToId) await handleBulkUpdate({ assignedToId });
  };

  /** Export the currently filtered + sorted client list to a CSV the importer can read back. */
  const handleExportClientsCsv = () => {
    const rowsToExport = sortedClients;
    if (rowsToExport.length === 0) {
      toast.message('No clients to export with current filters.');
      return;
    }
    downloadCsv<Client>(
      `clients-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        { id: 'name', accessor: (c) => c.name },
        { id: 'industry', accessor: (c) => (c.industry === 'Not specified' ? '' : c.industry) },
        { id: 'location', accessor: (c) => (c.location === 'Not specified' ? '' : c.location) },
        { id: 'city', accessor: () => '' },
        { id: 'country', accessor: () => '' },
        { id: 'contactPerson', accessor: (c) => c.contacts?.find((ct) => ct.isPrimary)?.name || c.contacts?.[0]?.name || '' },
        { id: 'email', accessor: (c) => c.contacts?.find((ct) => ct.isPrimary)?.email || c.contacts?.[0]?.email || '' },
        { id: 'phone', accessor: (c) => c.contacts?.find((ct) => ct.isPrimary)?.phone || c.contacts?.[0]?.phone || '' },
        { id: 'companySize', accessor: (c) => c.companySize || '' },
        { id: 'servicesNeeded', accessor: (c) => c.servicesNeeded || '' },
        { id: 'leadStatus', accessor: (c) => c.leadStatus || c.stage },
        { id: 'priority', accessor: (c) => c.priority || '' },
        { id: 'expectedBusinessValue', accessor: (c) => c.expectedBusinessValue || '' },
        { id: 'nextFollowUpDue', accessor: (c) => csvDate(c.nextFollowUpDue) },
        { id: 'notes', accessor: () => '' },
        { id: 'owner', accessor: (c) => c.owner?.name || '' },
        { id: 'openJobs', accessor: (c) => c.openJobs ?? 0 },
        { id: 'placements', accessor: (c) => c.placements ?? 0 },
        { id: 'lastActivity', accessor: (c) => c.lastActivity || '' },
      ],
      rowsToExport,
    );
    toast.success(`Exported ${rowsToExport.length} client${rowsToExport.length === 1 ? '' : 's'} to CSV`);
  };

  return (
    <div className="w-full min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-7xl p-6 sm:p-8">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/20 text-blue-600 sm:h-12 sm:w-12">
              <Building2 className="h-6 w-6" strokeWidth={2.25} />
            </div>
            <div>
              <p className="mb-0.5 text-xs font-bold uppercase tracking-wider text-slate-400">Recruitment Hub / CRM</p>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Clients</h1>
              <p className="mt-1 max-w-lg text-sm text-slate-500">
                Manage your client relationships, track stages, and open roles in one place.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading}
              className="rounded-lg border border-slate-200 bg-white p-2.5 text-slate-600 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-60"
              title="Refresh"
            >
              <RefreshCcw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={handleExportClientsCsv}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
              title="Export visible clients to CSV"
            >
              <Download className="h-4 w-4 text-slate-600" strokeWidth={2} /> Export
            </button>
            <button
              type="button"
              onClick={() => setShowImportDrawer(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
            >
              <Upload className="h-4 w-4 text-slate-600" strokeWidth={2} /> Import
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedClient(null);
                setShowAddClientDrawer(true);
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
            >
              <Plus className="h-5 w-5" strokeWidth={2.5} /> Add Client
            </button>
          </div>
        </div>

        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" strokeWidth={2} />
            <input
              type="text"
              placeholder="Search by client name..."
              value={searchQuery}
              onChange={(e) => {
                setCurrentPage(1);
                setSearchQuery(e.target.value);
              }}
              className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <button
            type="button"
            onClick={() => setIsFilterOpen(true)}
            className={`inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold shadow-sm transition-colors ${
              filtersActive
                ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Filter className={`h-4 w-4 ${filtersActive ? 'text-blue-600' : 'text-slate-600'}`} strokeWidth={2} />
            Filter
            {filtersActive && (
              <span className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-600 px-1.5 text-[10px] font-bold text-white">
                ON
              </span>
            )}
          </button>
        </div>

        {loading ? <StatusCardsSkeleton /> : (
          <StatusCards activeTab={activeTab} onTabChange={setActiveTab} counts={tabCounts} />
        )}

        {loading ? (
          <TableSkeleton rows={8} columns={7} />
        ) : error && !loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm font-medium text-red-600 shadow-sm">
            Error: {error}
          </div>
        ) : isEmpty ? (
          <EmptyState
            onImportClick={() => setShowImportDrawer(true)}
            onCreateClick={() => {
              setSelectedClient(null);
              setShowAddClientDrawer(true);
            }}
          />
        ) : (
          <>
           
            
            <ClientTable
              clients={pagedClients}
              selectedIds={selectedClients}
              onSelectionChange={setSelectedClients}
              onSelectClient={(client) => {
                setSelectedClientDrawerMode('view');
                setSelectedClient(client);
              }}
              onEditClient={(client) => {
                setSelectedClientDrawerMode('edit');
                setSelectedClient(client);
              }}
              onDeleteClient={handleDeleteClient}
              onLogoUpdated={handleRefresh}
              canCreateJob={canCreateJob}
              onCreateJob={(client) => {
                if (!canCreateJob) {
                  toast.error("You don't have permission to create jobs.");
                  return;
                }
                setClientIdForJob(client.id);
                setShowCreateJobDrawer(true);
              }}
              clientNameSortOrder={clientNameSortOrder}
              onToggleClientNameSortOrder={() => {
                setClientNameSortOrder((current) => (current === 'asc' ? 'desc' : 'asc'));
              }}
            />

            <div className="mt-4 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <PaginationAll
                initialPage={currentPage}
                totalPages={Math.max(1, Math.ceil(sortedClients.length / DISPLAY_PAGE_SIZE))}
                totalCount={sortedClients.length}
                pageSize={DISPLAY_PAGE_SIZE}
                itemLabel="clients"
                onPageChange={setCurrentPage}
              />
            </div>
          </>
        )}
      </div>

      <ClientDetailsDrawer
        client={selectedClient}
        isAddMode={showAddClientDrawer}
        initialMode={selectedClientDrawerMode}
        onClose={() => {
          setSelectedClient(null);
          setSelectedClientDrawerMode('view');
          setShowAddClientDrawer(false);
          if (searchParams.get('clientId')) {
            const sp = new URLSearchParams(searchParams.toString());
            sp.delete('clientId');
            pendingDeepLinkClientIdRef.current = null;
            const qs = sp.toString();
            router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
          }
        }}
        onDelete={(id) => { setSelectedClient(null); handleDeleteClient(id); }}
        onClientCreated={() => {
          setShowAddClientDrawer(false);
          setSelectedClient(null);
          setActiveTab('all');
          setSelectedClients([]);
          setSearchQuery('');
          setDebouncedSearchQuery('');
          setCurrentPage(1);
          void fetchClients({ page: 1, search: '' });
        }}
        onJobCreated={handleRefresh}
      />
      <CreateJobDrawer
        isOpen={showCreateJobDrawer}
        onClose={() => { setShowCreateJobDrawer(false); setClientIdForJob(null); }}
        onJobCreated={() => { setShowCreateJobDrawer(false); setClientIdForJob(null); handleRefresh(); }}
        defaultClientId={clientIdForJob}
      />
      <ClientFilterDrawer
        isOpen={isFilterOpen}
        value={advancedFilters}
        industryOptions={industryOptions}
        currentUserName={currentUserName}
        onApply={(next) => setAdvancedFilters(next)}
        onClose={() => setIsFilterOpen(false)}
      />
      <ClientImportDrawer
        isOpen={showImportDrawer}
        onClose={() => setShowImportDrawer(false)}
        onImportComplete={(result) => {
          setActiveTab('all');
          setSelectedClients([]);
          setSearchQuery('');
          setDebouncedSearchQuery('');
          setCurrentPage(1);
          void fetchClients({ page: 1, search: '' });
          const created = result.created || 0;
          const updated = result.updated || 0;
          const skipped = result.skipped || 0;
          const failed = result.failed || 0;
          const parts = [];
          if (created > 0) parts.push(`${created} created`);
          if (updated > 0) parts.push(`${updated} updated`);
          if (skipped > 0) parts.push(`${skipped} skipped`);
          if (failed > 0) parts.push(`${failed} failed`);
          toast.success(
            parts.length > 0
              ? `Clients imported successfully (${parts.join(', ')})`
              : 'Clients imported successfully'
          );
        }}
      />

      {selectedClients.length > 0 && (
        <div className="fixed bottom-6 left-1/2 z-40 w-[min(94vw,980px)] -translate-x-1/2 rounded-2xl border border-slate-800 bg-slate-950/95 px-4 py-3 text-white shadow-2xl backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <BadgeCheck className="w-5 h-5 text-blue-300" />
              <div>
                <p className="text-sm font-semibold">{selectedClients.length} selected</p>
                <p className="text-xs text-slate-400">Use bulk actions</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={bulkAssignedTo}
                onChange={(e) => handleBulkAssignChange(e.target.value)}
                disabled={bulkActionLoading}
                className="bg-slate-900 text-slate-100 text-sm p-2 rounded-lg border border-slate-700"
                style={{ WebkitTextFillColor: '#f1f5f9' }}
              >
                <option value="" className="text-slate-900 bg-white">Assign To</option>
                {teamMembers.map(u => <option key={u.id} value={u.id} className="text-slate-900 bg-white">{u.name}</option>)}
              </select>
              <select
                value={bulkStatus}
                onChange={(e) => handleBulkStatusChange(e.target.value)}
                disabled={bulkActionLoading}
                className="bg-slate-900 text-slate-100 text-sm p-2 rounded-lg border border-slate-700"
                style={{ WebkitTextFillColor: '#f1f5f9' }}
              >
                <option value="" className="text-slate-900 bg-white">Status</option>
                <option value="ACTIVE" className="text-slate-900 bg-white">Active</option>
                <option value="ON_HOLD" className="text-slate-900 bg-white">On Hold</option>
                <option value="INACTIVE" className="text-slate-900 bg-white">Inactive</option>
              </select>
              <button onClick={handleBulkDelete} disabled={bulkActionLoading} className="bg-red-600 px-4 py-2 rounded-lg text-sm font-semibold">Delete</button>
              <button onClick={clearBulkSelection} disabled={bulkActionLoading} className="bg-slate-800 px-4 py-2 rounded-lg text-sm font-semibold">Clear</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
