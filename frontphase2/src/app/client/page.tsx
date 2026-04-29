'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  Plus,
  Upload,
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
import { ClientTable } from '../../components/ClientTable';
import { ClientFilterDrawer } from '../../components/drawers/ClientFilterDrawer';
import { ClientDetailsDrawer } from '../../components/drawers/ClientDetailsDrawer';
import { ClientImportDrawer } from '../../components/drawers/ClientImportDrawer';
import { CreateJobDrawer } from '../../components/drawers/CreateJobDrawer';
import PaginationAll from '../../components/PaginationAll';
import { INITIAL_CLIENTS } from './types';
import type { Client } from './types';
import { apiGetClients, apiGetClient, apiDeleteClient, apiGetUsers, apiUpdateClient, type BackendClient, type BackendUser, type UpdateClientData } from '../../lib/api';
import { requestConfirm } from '../../lib/appDialog';

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

// Status Card Component
const StatusCards = ({
  activeTab,
  onTabChange,
  counts,
}: {
  activeTab: string;
  onTabChange: (tab: string) => void;
  counts: { all: number; active: number; 'on-hold': number; inactive: number; hot: number };
}) => {
  const cards = [
    { id: 'all', label: 'All Clients', count: counts.all, icon: FolderOpen, accent: 'bg-slate-50 text-slate-600' },
    { id: 'active', label: 'Active Clients', count: counts.active, icon: Users, accent: 'bg-blue-50 text-blue-600' },
    { id: 'on-hold', label: 'On Hold', count: counts['on-hold'], icon: Briefcase, accent: 'bg-amber-50 text-amber-600' },
    { id: 'inactive', label: 'Inactive', count: counts.inactive, icon: BadgeInfo, accent: 'bg-slate-50 text-slate-500' },
    { id: 'hot', label: 'Hot Clients', count: counts.hot, icon: Flame, accent: 'bg-rose-50 text-rose-600' },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 mb-6 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map((card) => {
        const isActive = activeTab === card.id;
        const Icon = card.icon;
        return (
          <button
            key={card.id}
            onClick={() => onTabChange(card.id)}
            className={`rounded-xl border bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
              isActive ? 'border-blue-200 ring-2 ring-blue-100' : 'border-slate-200'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${card.accent}`}>
                <Icon className="h-5 w-5" />
              </div>
              {isActive ? <div className="mt-1 h-2 w-2 rounded-full bg-blue-600" /> : null}
            </div>
            <div className="mt-3 text-2xl font-bold text-slate-900">{card.count}</div>
            <div className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-500">{card.label}</div>
          </button>
        );
      })}
    </div>
  );
};

// Empty State Component
const EmptyState = ({ onImportClick }: { onImportClick?: () => void }) => (
  <div className="bg-white rounded-xl border border-dashed border-slate-300 p-20 flex flex-col items-center justify-center text-center shadow-sm">
    <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-6">
      <Building2 className="w-10 h-10 text-blue-500" />
    </div>
    <h3 className="text-xl font-bold text-slate-900 mb-2">No clients added yet</h3>
    <p className="text-slate-500 max-w-sm mb-8">
      Start building your agency pipeline by adding your first client or importing them from a CSV file.
    </p>
    <div className="flex items-center gap-3">
      <button className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all flex items-center gap-2">
        <Plus className="w-4 h-4" /> Create Client
      </button>
      <button
        onClick={onImportClick}
        className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-lg font-semibold hover:bg-slate-50 transition-all flex items-center gap-2"
      >
        <Upload className="w-4 h-4" /> Import Clients
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
    lastActivity: backendClient.updatedAt ? new Date(backendClient.updatedAt).toLocaleDateString() : 'Never',
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
    clientSince: backendClient.clientSince ? new Date(backendClient.clientSince).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : undefined,
    priority: backendClient.priority as Client['priority'] || undefined,
    sla: backendClient.sla || undefined,
    nextFollowUpDue: backendClient.nextFollowUpDue ? new Date(backendClient.nextFollowUpDue).toLocaleDateString() : undefined,
    avgTimeToFill: backendClient.avgTimeToFill || undefined,
    healthStatus: backendClient.healthStatus as Client['healthStatus'] || undefined,
    billingTotalRevenue: backendClient.billingTotalRevenue || undefined,
    billingOutstanding: backendClient.billingOutstanding || undefined,
    billingPaid: backendClient.billingPaid || undefined,
    contacts: Array.isArray(backendClient.contacts)
      ? backendClient.contacts.map((contact, index) => {
          const fullName = [contact.firstName, contact.lastName].filter(Boolean).join(' ').trim();
          const lastContacted = contact.lastContacted
            ? new Date(contact.lastContacted).toLocaleDateString()
            : contact.createdAt
              ? new Date(contact.createdAt).toLocaleDateString()
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
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState('all');
  const [clientNameSortOrder, setClientNameSortOrder] = useState<'asc' | 'desc'>('asc');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
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

  const filteredClients = useMemo(() => filterClientsByTab(clients, activeTab), [clients, activeTab]);
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
      all: clients.length,
      active: clients.filter((c) => c.stage === 'Active').length,
      'on-hold': clients.filter((c) => c.stage === 'On Hold').length,
      inactive: clients.filter((c) => c.stage === 'Inactive').length,
      hot: clients.filter((c) => c.priority === 'High').length,
    }),
    [clients]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

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
        const response = await apiGetUsers({ isActive: true, limit: 200 });
        const payload = response.data;
        const users = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
            ? payload.data
            : [];
        setTeamMembers(users);
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
    if (pendingDeepLinkClientIdRef.current === clientId && selectedClient?.id === clientId) {
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
  }, [searchParams, selectedClient?.id]);

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

  useEffect(() => {
    const handleClientsChanged = () => {
      void fetchClients();
    };

    window.addEventListener('jobportal:clients-changed', handleClientsChanged);
    return () => window.removeEventListener('jobportal:clients-changed', handleClientsChanged);
  }, [fetchClients]);

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

  return (
    <div className="w-full min-h-screen bg-slate-50">
      <div className="p-8 max-w-7xl mx-auto w-full">
        <div className="flex flex-col md:flex-row md:items-start justify-between mb-8 gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
              Recruitment Hub / CRM
            </div>
            <h1 className="text-3xl font-bold text-slate-900">Clients</h1>
          </div>
          <div className="flex items-center gap-2 md:gap-3 flex-wrap">
            <button onClick={handleRefresh} disabled={loading} className="p-2.5 bg-white border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 transition-all shadow-sm">
              <RefreshCcw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={() => setShowImportDrawer(true)} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-600 font-semibold hover:bg-slate-50 shadow-sm">
              <Upload className="w-4 h-4" /> Import
            </button>
            <button onClick={() => { setSelectedClient(null); setShowAddClientDrawer(true); }} className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all">
              <Plus className="w-5 h-5" /> Add Client
            </button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center gap-4 mb-8">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by client name..." 
              value={searchQuery}
              onChange={(e) => {
                setCurrentPage(1);
                setSearchQuery(e.target.value);
              }}
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>
        </div>

        <StatusCards activeTab={activeTab} onTabChange={setActiveTab} counts={tabCounts} />

        {loading ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center text-slate-500">Loading...</div>
        ) : error && !loading ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center text-red-500">Error: {error}</div>
        ) : isEmpty ? (
          <EmptyState onImportClick={() => setShowImportDrawer(true)} />
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
              onCreateJob={(client) => {
                setClientIdForJob(client.id);
                setShowCreateJobDrawer(true);
              }}
              clientNameSortOrder={clientNameSortOrder}
              onToggleClientNameSortOrder={() => {
                setClientNameSortOrder((current) => (current === 'asc' ? 'desc' : 'asc'));
              }}
            />

            <div className="mt-4 w-full">
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
        onClose={() => { setSelectedClient(null); setSelectedClientDrawerMode('view'); setShowAddClientDrawer(false); }}
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
      <ClientFilterDrawer isOpen={isFilterOpen} onClose={() => setIsFilterOpen(false)} />
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
