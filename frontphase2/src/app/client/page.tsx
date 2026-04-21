'use client';

import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { ClientSummaryMetrics } from '../../components/ClientSummaryMetrics';
import { ClientTable } from '../../components/ClientTable';
import { ClientFilterDrawer } from '../../components/drawers/ClientFilterDrawer';
import { ClientDetailsDrawer } from '../../components/drawers/ClientDetailsDrawer';
import { ClientImportDrawer } from '../../components/drawers/ClientImportDrawer';
import { CreateJobDrawer } from '../../components/drawers/CreateJobDrawer';
import { Pagination } from '../../components/Pagination';
import { INITIAL_CLIENTS } from './types';
import type { Client } from './types';
import { apiGetClients, apiDeleteClient, apiGetUsers, apiUpdateClient, type BackendClient, type BackendUser, type UpdateClientData } from '../../lib/api';

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

// Tab Component
const StatusTabs = ({ activeTab, onTabChange, clients }: { activeTab: string, onTabChange: (tab: string) => void, clients: Client[] }) => {
  const counts = {
    all: clients.length,
    active: clients.filter(c => c.stage === 'Active').length,
    'on-hold': clients.filter(c => c.stage === 'On Hold').length,
    inactive: clients.filter(c => c.stage === 'Inactive').length,
    hot: clients.filter(c => c.priority === 'High').length,
  };

  const tabs = [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'active', label: 'Active Clients', count: counts.active },
    { id: 'on-hold', label: 'On Hold', count: counts['on-hold'] },
    { id: 'inactive', label: 'Inactive', count: counts.inactive },
    { id: 'hot', label: 'Hot Clients 🔥', count: counts.hot },
  ];

  return (
    <div className="flex items-center gap-1 border-b border-slate-200 mb-6 overflow-x-auto no-scrollbar">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`px-4 py-3 text-sm font-medium transition-all relative whitespace-nowrap ${
            activeTab === tab.id 
              ? 'text-blue-600' 
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <span className="flex items-center gap-2">
            {tab.label}
            <span className={`px-1.5 py-0.5 text-[10px] rounded-full font-bold ${
              activeTab === tab.id ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'
            }`}>
              {tab.count}
            </span>
          </span>
          {activeTab === tab.id && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full"></div>
          )}
        </button>
      ))}
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
  const [activeTab, setActiveTab] = useState('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showAddClientDrawer, setShowAddClientDrawer] = useState(false);
  const [showCreateJobDrawer, setShowCreateJobDrawer] = useState(false);
  const [clientIdForJob, setClientIdForJob] = useState<string | null>(null);
  const [isEmpty, setIsEmpty] = useState(false);
  const [showImportDrawer, setShowImportDrawer] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [teamMembers, setTeamMembers] = useState<BackendUser[]>([]);
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkAssignedTo, setBulkAssignedTo] = useState('');
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalEntries, setTotalEntries] = useState(0);

  const filteredClients = filterClientsByTab(clients, activeTab);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    setIsAuthenticated(!!token);
  }, []);

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
    const fetchClients = async () => {
      try {
        setLoading(true);
        setError(null);

        const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
        if (!token) {
          setClients(INITIAL_CLIENTS);
          setTotalEntries(INITIAL_CLIENTS.length);
          setLoading(false);
          return;
        }

        const response = await apiGetClients({
          search: searchQuery || undefined,
          page: currentPage,
          limit: pageSize,
        });

        const backendClients = response.data ? extractBackendClients(response.data) : [];
        const pagination = (response.data as any)?.pagination;

        if (!Array.isArray(backendClients)) {
          setError('Unexpected API response format.');
          setClients(INITIAL_CLIENTS);
          setTotalEntries(INITIAL_CLIENTS.length);
          return;
        }

        const mappedClients = backendClients.map(mapBackendClientToFrontend);
        const clientMap = new Map<string, Client>();
        mappedClients.forEach(client => {
          const id = String(client.id);
          clientMap.set(id, { ...client, id });
        });
        
        const uniqueClients = Array.from(clientMap.values());
        setClients(uniqueClients);
        if (pagination) {
          setTotalEntries(pagination.total || 0);
        } else {
          setTotalEntries(uniqueClients.length);
        }
        setIsEmpty(uniqueClients.length === 0 && totalEntries === 0);
      } catch (err: any) {
        console.error('Failed to fetch clients:', err);
        setClients(INITIAL_CLIENTS);
        setTotalEntries(INITIAL_CLIENTS.length);
      } finally {
        setLoading(false);
      }
    };

    fetchClients();
  }, [searchQuery, currentPage, pageSize]);

  const handleRefresh = async () => {
    try {
      setLoading(true);
      const response = await apiGetClients({
        search: searchQuery || undefined,
        page: currentPage,
        limit: pageSize,
      });

      const backendClients = response.data ? extractBackendClients(response.data) : [];
      const pagination = (response.data as any)?.pagination;

      const mappedClients = backendClients.map(mapBackendClientToFrontend);
      const clientMap = new Map<string, Client>();
      mappedClients.forEach(client => {
        const id = String(client.id);
        clientMap.set(id, { ...client, id });
      });
      const uniqueClients = Array.from(clientMap.values());
      setClients(uniqueClients);
      if (pagination) {
        setTotalEntries(pagination.total || 0);
      } else {
        setTotalEntries(uniqueClients.length);
      }
      setIsEmpty(uniqueClients.length === 0 && totalEntries === 0);
    } catch (err: any) {
      console.error('Failed to refresh clients:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClient = async (id: string) => {
    const client = clients.find(c => c.id === id);
    if (!window.confirm(`Are you sure you want to delete ${client?.name || 'this client'}?`)) return;

    try {
      await apiDeleteClient(id);
      setClients(prev => prev.filter(c => c.id !== id));
      await handleRefresh();
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
    if (!window.confirm(`Delete ${selectedClients.length} selected clients?`)) return;

    try {
      setBulkActionLoading(true);
      await Promise.all(selectedClients.map((id) => apiDeleteClient(id)));
      clearBulkSelection();
      await handleRefresh();
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
      await handleRefresh();
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
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>
        </div>

        <StatusTabs activeTab={activeTab} onTabChange={setActiveTab} clients={clients} />
        <ClientSummaryMetrics />

        {loading ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center text-slate-500">Loading...</div>
        ) : error && !loading ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center text-red-500">Error: {error}</div>
        ) : isEmpty ? (
          <EmptyState onImportClick={() => setShowImportDrawer(true)} />
        ) : (
          <>
            <div className="mb-4 flex items-center">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                <span>Showing <strong>{filteredClients.length}</strong> Clients</span>
              </div>
            </div>
            
            <ClientTable
              clients={filteredClients}
              selectedIds={selectedClients}
              onSelectionChange={setSelectedClients}
              onSelectClient={setSelectedClient}
              onDeleteClient={handleDeleteClient}
              onLogoUpdated={handleRefresh}
              onCreateJob={(client) => {
                setClientIdForJob(client.id);
                setShowCreateJobDrawer(true);
              }}
            />

            <Pagination
              currentPage={currentPage}
              totalPages={Math.ceil(totalEntries / pageSize)}
              onPageChange={setCurrentPage}
              pageSize={pageSize}
              onPageSizeChange={(newSize) => { setPageSize(newSize); setCurrentPage(1); }}
              totalEntries={totalEntries}
            />
          </>
        )}
      </div>

      <ClientDetailsDrawer
        client={selectedClient}
        isAddMode={showAddClientDrawer}
        onClose={() => { setSelectedClient(null); setShowAddClientDrawer(false); }}
        onDelete={(id) => { setSelectedClient(null); handleDeleteClient(id); }}
        onClientCreated={() => { setShowAddClientDrawer(false); handleRefresh(); }}
        onJobCreated={handleRefresh}
      />
      <CreateJobDrawer
        isOpen={showCreateJobDrawer}
        onClose={() => { setShowCreateJobDrawer(false); setClientIdForJob(null); }}
        onJobCreated={() => { setShowCreateJobDrawer(false); setClientIdForJob(null); handleRefresh(); }}
        defaultClientId={clientIdForJob}
      />
      <ClientFilterDrawer isOpen={isFilterOpen} onClose={() => setIsFilterOpen(false)} />
      <ClientImportDrawer isOpen={showImportDrawer} onClose={() => setShowImportDrawer(false)} onImportComplete={handleRefresh} />

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
              <select value={bulkAssignedTo} onChange={(e) => handleBulkAssignChange(e.target.value)} disabled={bulkActionLoading} className="bg-slate-900 text-sm p-2 rounded-lg border border-slate-700">
                <option value="">Assign To</option>
                {teamMembers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              <select value={bulkStatus} onChange={(e) => handleBulkStatusChange(e.target.value)} disabled={bulkActionLoading} className="bg-slate-900 text-sm p-2 rounded-lg border border-slate-700">
                <option value="">Status</option>
                <option value="ACTIVE">Active</option>
                <option value="ON_HOLD">On Hold</option>
                <option value="INACTIVE">Inactive</option>
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
