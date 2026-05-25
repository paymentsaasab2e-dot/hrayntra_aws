'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  Plus,
  Upload,
  Download,
  RefreshCcw,
  Search,
  Filter,
  Building2,
  BadgeCheck,
  Users,
  Briefcase,
  BadgeInfo,
  Flame,
  FolderOpen,
  Inbox,
  XCircle,
} from 'lucide-react';
import { downloadCsv } from '../../utils/csv';
import { formatDateDMY } from '../../utils/dateDisplay';
import { ExportColumnsModal } from '../../components/export/ExportColumnsModal';
import { buildClientsCsvColumns, CLIENTS_EXPORT_COLUMNS } from '../../lib/export/clientsExportColumns';
import { fetchAllPaginated, totalPagesFromPagination } from '../../lib/export/fetchAllPaginated';
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
import ModuleRecycleBinDrawer from '../../components/ModuleRecycleBinDrawer';
import { CreateJobDrawer } from '../../components/drawers/CreateJobDrawer';
import PaginationAll from '../../components/PaginationAll';
import { TABLE_PAGE_SIZE_OPTIONS, type TablePageSize } from '../../constants/tablePagination';
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

/** Toolbar selects / filter chip — matches Leads page for one visual system. */
const CLIENT_TOOLBAR_SELECT =
  'rounded-lg border border-indigo-100/90 bg-white/95 px-2.5 py-1.5 text-xs font-medium text-slate-800 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-300 cursor-pointer hover:border-indigo-200/90 hover:bg-indigo-50/40';

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
    { id: 'all', label: 'All Clients', count: counts.all, color: 'indigo', icon: <FolderOpen size={16} strokeWidth={2.35} /> },
    { id: 'active', label: 'Active', count: counts.active, color: 'blue', icon: <Users size={16} strokeWidth={2.35} /> },
    { id: 'on-hold', label: 'On Hold', count: counts['on-hold'], color: 'orange', icon: <Briefcase size={16} strokeWidth={2.35} /> },
    { id: 'inactive', label: 'Inactive', count: counts.inactive, color: 'gray', icon: <BadgeInfo size={16} strokeWidth={2.35} /> },
    { id: 'hot', label: 'Hot', count: counts.hot, color: 'purple', icon: <Flame size={16} strokeWidth={2.35} /> },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-3 lg:grid-cols-5 mb-5">
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
  <div className="grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-3 lg:grid-cols-5 mb-5">
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
    teamMemberDesignation: backendClient.teamMemberDesignation || undefined,
    teamMemberEmail: backendClient.teamMemberEmail || undefined,
    teamMemberPhone: backendClient.teamMemberPhone || undefined,
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
    emails: Array.isArray(backendClient.emails) && backendClient.emails.length > 0 ? backendClient.emails : undefined,
    phones: Array.isArray(backendClient.phones) && backendClient.phones.length > 0 ? backendClient.phones : undefined,
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
  const FETCH_LIMIT = 500;
  const SEARCH_DEBOUNCE_MS = 350;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { hasAnyPermission } = usePermissions();
  const canCreateJob = hasAnyPermission(['jobs_create', 'create_job']);
  const canOpenClientTrash = hasAnyPermission(['clients_delete']);
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
  const [recycleBinDrawerOpen, setRecycleBinDrawerOpen] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportClients, setExportClients] = useState<Client[]>([]);
  const [exportClientsLoading, setExportClientsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [teamMembers, setTeamMembers] = useState<BackendUser[]>([]);
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkAssignedTo, setBulkAssignedTo] = useState('');
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<TablePageSize>(10);
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
    const start = (currentPage - 1) * pageSize;
    return sortedClients.slice(start, start + pageSize);
  }, [sortedClients, currentPage, pageSize]);
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
    const totalPages = Math.max(1, Math.ceil(sortedClients.length / pageSize));
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, sortedClients.length, pageSize]);

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

  const applyExportClientFilters = useCallback(
    (source: Client[]) => {
      const advanced = applyClientFilters(source, advancedFilters, currentUserName);
      const filtered = filterClientsByTab(advanced, activeTab);
      const list = [...filtered];
      list.sort((a, b) => {
        const comparison = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        return clientNameSortOrder === 'asc' ? comparison : -comparison;
      });
      return list;
    },
    [activeTab, advancedFilters, clientNameSortOrder, currentUserName],
  );

  const fetchAllClientsForExport = useCallback(async (): Promise<Client[]> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (!token) {
      return applyExportClientFilters(INITIAL_CLIENTS);
    }

    const all = await fetchAllPaginated({
      fetchPage: async (page, limit) => {
        const response = await apiGetClients({
          search: debouncedSearchQuery || undefined,
          page,
          limit,
          includeContacts: false,
          includeLeadFields: false,
        });
        const backendClients = response.data ? extractBackendClients(response.data) : [];
        const mappedClients = (Array.isArray(backendClients) ? backendClients : []).map(mapBackendClientToFrontend);
        const clientMap = new Map<string, Client>();
        mappedClients.forEach((client) => {
          const id = String(client.id);
          clientMap.set(id, { ...client, id });
        });
        const items = Array.from(clientMap.values());
        const pagination =
          response.data && typeof response.data === 'object' && !Array.isArray(response.data)
            ? (response.data as { pagination?: { totalPages?: number; total?: number } }).pagination
            : undefined;
        return {
          items,
          totalPages: totalPagesFromPagination(pagination, items.length, limit),
        };
      },
    });

    return applyExportClientFilters(all);
  }, [applyExportClientFilters, debouncedSearchQuery]);

  const openExportModal = async () => {
    setExportClientsLoading(true);
    setExportModalOpen(true);
    try {
      const all = await fetchAllClientsForExport();
      setExportClients(all);
      if (all.length === 0) {
        toast.message('No clients to export with current filters.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load clients for export';
      toast.error(message);
      setExportModalOpen(false);
      setExportClients([]);
    } finally {
      setExportClientsLoading(false);
    }
  };

  const handleExportClientsCsv = (selectedColumnIds: string[]) => {
    const columns = buildClientsCsvColumns(selectedColumnIds);
    if (columns.length === 0) {
      toast.message('Select at least one column to export.');
      return;
    }
    const rowsToExport = exportClients.length > 0 ? exportClients : sortedClients;
    if (rowsToExport.length === 0) {
      toast.message('No clients to export with current filters.');
      return;
    }
    downloadCsv<Client>(`clients-${new Date().toISOString().slice(0, 10)}.csv`, columns, rowsToExport);
    toast.success(`Exported ${rowsToExport.length} client${rowsToExport.length === 1 ? '' : 's'} to CSV`);
  };

  const handleClearToolbar = useCallback(() => {
    setCurrentPage(1);
    setSearchQuery('');
    setDebouncedSearchQuery('');
    setAdvancedFilters(DEFAULT_CLIENT_FILTERS);
    setActiveTab('all');
  }, []);

  return (
    <div className="w-full min-h-screen overflow-hidden text-slate-900">
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="min-h-[4.5rem] flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3 shrink-0 border-b border-indigo-100/50 bg-white/80 backdrop-blur-md shadow-[inset_0_-1px_0_0_rgba(99,102,241,0.08)]">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/30 ring-1 ring-white/20">
              <Building2 className="h-5 w-5" strokeWidth={2.2} />
            </div>
            <div>
              <h1 className="text-xl sm:text-[1.35rem] font-bold tracking-tight text-slate-900 leading-none">Clients</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canOpenClientTrash && (
              <button
                type="button"
                onClick={() => setRecycleBinDrawerOpen(true)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-indigo-200/80 bg-white text-indigo-700 shadow-[0_4px_14px_-4px_rgba(99,102,241,0.2)] transition-all hover:border-indigo-300 hover:bg-indigo-50/90 active:scale-[0.98]"
                title="Deleted clients"
              >
                <Inbox size={17} strokeWidth={2.25} />
              </button>
            )}
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-indigo-200/80 bg-white text-indigo-700 shadow-[0_4px_14px_-4px_rgba(99,102,241,0.2)] transition-all hover:border-indigo-300 hover:bg-indigo-50/90 active:scale-[0.98] disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCcw size={16} strokeWidth={2.25} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              type="button"
              onClick={() => void openExportModal()}
              className="bg-white hover:bg-indigo-50/90 text-indigo-900 px-3 py-2 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-all shadow-[0_4px_14px_-4px_rgba(99,102,241,0.25)] border border-indigo-200/70 hover:border-indigo-300 hover:shadow-[0_6px_20px_-4px_rgba(99,102,241,0.35)] active:scale-[0.98]"
              title="Export visible clients to CSV"
            >
              <Download size={16} className="text-indigo-600" strokeWidth={2.25} />
              <span>Export</span>
            </button>
            <button
              type="button"
              onClick={() => setShowImportDrawer(true)}
              className="bg-white hover:bg-indigo-50/90 text-indigo-900 px-3 py-2 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-all shadow-[0_4px_14px_-4px_rgba(99,102,241,0.25)] border border-indigo-200/70 hover:border-indigo-300 hover:shadow-[0_6px_20px_-4px_rgba(99,102,241,0.35)] active:scale-[0.98]"
            >
              <Upload size={16} className="text-indigo-600" strokeWidth={2.25} />
              <span>Import</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedClient(null);
                setShowAddClientDrawer(true);
              }}
              className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-700 hover:via-indigo-700 hover:to-violet-700 text-white px-3.5 py-2 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-all shadow-lg shadow-indigo-500/30 active:scale-[0.98]"
            >
              <Plus size={16} className="text-white" strokeWidth={2.5} />
              <span>Add Client</span>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-5 sm:py-6 lg:px-6">
          {loading ? <StatusCardsSkeleton /> : <StatusCards activeTab={activeTab} onTabChange={setActiveTab} counts={tabCounts} />}

          {loading ? (
            <div className="mb-4 overflow-hidden rounded-xl border border-indigo-100/60 bg-white/70 shadow-[0_12px_40px_-18px_rgba(59,130,246,0.18)] backdrop-blur-sm">
              <div className="border-b border-indigo-100/40 bg-gradient-to-br from-white via-indigo-50/25 to-violet-50/20 p-3 sm:p-4">
                <div className="h-9 max-w-md rounded-xl bg-white/80 ring-1 ring-indigo-100/80 animate-pulse" />
              </div>
              <TableSkeleton rows={8} columns={8} />
            </div>
          ) : error && !loading ? (
            <div className="mb-4 overflow-hidden rounded-xl border border-rose-200/70 bg-white p-8 text-center text-xs font-medium text-rose-600 shadow-sm">
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
            <div className="mb-4 overflow-hidden rounded-xl border border-indigo-100/60 bg-white/70 shadow-[0_12px_40px_-18px_rgba(59,130,246,0.18)] backdrop-blur-sm transition-shadow hover:shadow-[0_16px_48px_-14px_rgba(79,70,229,0.16)]">
              <div className="p-3 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-indigo-100/40 bg-gradient-to-br from-white via-indigo-50/25 to-violet-50/20">
                <div className="relative w-full lg:max-w-md lg:flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400" size={16} strokeWidth={2.25} />
                  <input
                    type="text"
                    placeholder="Search by client name..."
                    value={searchQuery}
                    onChange={(e) => {
                      setCurrentPage(1);
                      setSearchQuery(e.target.value);
                    }}
                    className="w-full h-9 pl-10 pr-3 bg-white/95 border border-indigo-100/90 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 transition-all [box-shadow:inset_0_1px_2px_rgba(15,23,42,0.04)]"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <select
                    className={CLIENT_TOOLBAR_SELECT}
                    value={activeTab}
                    onChange={(e) => {
                      setCurrentPage(1);
                      setActiveTab(e.target.value);
                    }}
                  >
                    <option value="all">All stages</option>
                    <option value="active">Active</option>
                    <option value="on-hold">On hold</option>
                    <option value="inactive">Inactive</option>
                    <option value="hot">Hot</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setIsFilterOpen(true)}
                    className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 font-semibold text-xs shadow-sm transition-colors ${
                      filtersActive
                        ? 'border-indigo-300 bg-indigo-100/70 text-indigo-900 hover:bg-indigo-100'
                        : 'border-indigo-100/90 bg-white/95 text-slate-800 hover:bg-indigo-50/40'
                    }`}
                  >
                    <Filter className={`h-3.5 w-3.5 shrink-0 ${filtersActive ? 'text-indigo-600' : 'text-slate-600'}`} strokeWidth={2.25} />
                    Filter
                    {filtersActive && (
                      <span className="inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-indigo-600 px-1 text-[9px] font-bold text-white">
                        ON
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    className="text-xs text-rose-600 hover:text-rose-700 font-semibold px-2 py-1.5 rounded-lg hover:bg-rose-50 flex items-center gap-1 transition-colors"
                    onClick={handleClearToolbar}
                  >
                    <XCircle size={15} className="text-rose-500 shrink-0" strokeWidth={2.35} />
                    Clear
                  </button>
                </div>
              </div>

              <div className="overflow-hidden">
                <div className="no-scrollbar overflow-x-auto">
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
                </div>
              </div>

              <div className="mt-0 w-full border-t border-indigo-100/50 bg-gradient-to-r from-slate-50/40 via-white to-indigo-50/25 px-3 py-2 sm:px-4">
                <PaginationAll
                  initialPage={currentPage}
                  totalPages={Math.max(1, Math.ceil(sortedClients.length / pageSize))}
                  totalCount={sortedClients.length}
                  pageSize={pageSize}
                  pageSizeOptions={[...TABLE_PAGE_SIZE_OPTIONS]}
                  onPageSizeChange={(n) => {
                    if (!(TABLE_PAGE_SIZE_OPTIONS as readonly number[]).includes(n)) return;
                    setPageSize(n as TablePageSize);
                    setCurrentPage(1);
                  }}
                  itemLabel="clients"
                  onPageChange={setCurrentPage}
                />
              </div>
            </div>
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
          onDelete={(id) => {
            setSelectedClient(null);
            handleDeleteClient(id);
          }}
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
          onClose={() => {
            setShowCreateJobDrawer(false);
            setClientIdForJob(null);
          }}
          onJobCreated={() => {
            setShowCreateJobDrawer(false);
            setClientIdForJob(null);
            handleRefresh();
          }}
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
          onImportComplete={() => {
            setActiveTab('all');
            setSelectedClients([]);
            setSearchQuery('');
            setDebouncedSearchQuery('');
            setCurrentPage(1);
            void fetchClients({ page: 1, search: '' });
          }}
        />

        {canOpenClientTrash && (
          <ModuleRecycleBinDrawer
            isOpen={recycleBinDrawerOpen}
            onClose={() => setRecycleBinDrawerOpen(false)}
            kind="clients"
            onRestored={() => void handleRefresh()}
          />
        )}

      </main>

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
      <ExportColumnsModal
        isOpen={exportModalOpen}
        onClose={() => {
          setExportModalOpen(false);
          setExportClients([]);
        }}
        title="Export clients"
        rowCount={exportClients.length}
        rowLabelSingular="client"
        rowLabelPlural="clients"
        columns={CLIENTS_EXPORT_COLUMNS}
        rows={exportClients}
        isLoading={exportClientsLoading}
        getRowKey={(client) => client.id}
        onExport={handleExportClientsCsv}
      />
    </div>
  );
}
