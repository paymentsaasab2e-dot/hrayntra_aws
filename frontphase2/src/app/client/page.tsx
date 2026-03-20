'use client';

import React, { useState, useEffect } from 'react';
import {
  Plus,
  Upload,
  RefreshCcw,
  MoreVertical,
  Search,
  Filter,
  Grid2X2,
  List,
  ChevronDown,
  Building2,
  AlertCircle,
  CheckSquare,
} from 'lucide-react';
import { ClientSummaryMetrics } from '../../components/ClientSummaryMetrics';
import { ClientTable } from '../../components/ClientTable';
import { ClientFilterDrawer } from '../../components/drawers/ClientFilterDrawer';
import { ClientBulkActionsBar } from '../../components/ClientBulkActionsBar';
import { ClientDetailsDrawer } from '../../components/drawers/ClientDetailsDrawer';
import { ClientImportDrawer } from '../../components/drawers/ClientImportDrawer';
import { CreateTaskModal } from '../../components/CreateTaskModal';
import { INITIAL_CLIENTS } from './types';
import type { Client } from './types';
import { apiGetClients, apiDeleteClient, type BackendClient } from '../../lib/api';

// Tab Component
const StatusTabs = ({ activeTab, onTabChange, clients }: { activeTab: string, onTabChange: (tab: string) => void, clients: Client[] }) => {
  const counts = {
    all: clients.length,
    active: clients.filter(c => c.stage === 'Active').length,
    prospects: clients.filter(c => c.stage === 'Prospect').length, // Note: stage is 'Prospect' not 'Prospects'
    'on-hold': clients.filter(c => c.stage === 'On Hold').length,
    inactive: clients.filter(c => c.stage === 'Inactive').length,
    hot: clients.filter(c => c.priority === 'High').length,
  };

  const tabs = [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'active', label: 'Active Clients', count: counts.active },
    { id: 'prospects', label: 'Prospects', count: counts.prospects },
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
  // Map status from backend enum to frontend (note: ClientTable uses 'Prospect' not 'Prospects')
  const statusMap: Record<string, Client['stage']> = {
    'ACTIVE': 'Active',
    'PROSPECT': 'Prospect', // ClientTable expects 'Prospect', not 'Prospects'
    'ON_HOLD': 'On Hold',
    'INACTIVE': 'Inactive',
  };
  // Note: 'Hot Clients 🔥' is a frontend-only stage that maps to 'ACTIVE' status in backend

  return {
    id: backendClient.id, // Use string ID directly to avoid collisions
    name: backendClient.companyName,
    industry: backendClient.industry || 'Not specified',
    location: backendClient.location || 'Not specified',
    openJobs: backendClient._count?.jobs || 0,
    activeCandidates: 0, // Would need to calculate from jobs/candidates
    placements: backendClient._count?.placements || 0,
    stage: statusMap[backendClient.status] || 'Prospect',
    owner: backendClient.assignedTo ? {
      name: backendClient.assignedTo.name,
      avatar: backendClient.assignedTo.avatar || '',
    } : { name: 'Unassigned', avatar: '' },
    lastActivity: backendClient.updatedAt ? new Date(backendClient.updatedAt).toLocaleDateString() : 'Never',
    logo: backendClient.logo || '',
    revenue: backendClient.revenueGenerated || undefined,
    companySize: backendClient.companySize || undefined,
    hiringLocations: backendClient.hiringLocations || undefined,
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
  };
}

export default function App() {
  const [activeTab, setActiveTab] = useState('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showAddClientDrawer, setShowAddClientDrawer] = useState(false);
  const [isEmpty, setIsEmpty] = useState(false);
  const [showImportDrawer, setShowImportDrawer] = useState(false);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  // Check authentication status on client side only
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    setIsAuthenticated(!!token);
  }, []);

  // Fetch clients from API
  useEffect(() => {
    const fetchClients = async () => {
      try {
        setLoading(true);
        setError(null);

        const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
        setIsAuthenticated(!!token);

        if (!token) {
          console.warn('No authentication token found. Using mock data. Please log in to access real data.');
          setClients(INITIAL_CLIENTS);
          setLoading(false);
          return;
        }

        // Map activeTab to status filter
        const statusMap: Record<string, string | undefined> = {
          'all': undefined,
          'active': 'ACTIVE',
          'prospects': 'PROSPECT',
          'on-hold': 'ON_HOLD',
          'inactive': 'INACTIVE',
        };

        const response = await apiGetClients({
          status: statusMap[activeTab],
          search: searchQuery || undefined,
        });

        // Backend returns: { success: true, message: "...", data: { data: [...], pagination: {...} } }
        let backendClients: BackendClient[] = [];
        if (response.data) {
          if (Array.isArray(response.data)) {
            backendClients = response.data;
          } else if (Array.isArray(response.data.data)) {
            backendClients = response.data.data;
          } else if (Array.isArray(response.data.items)) {
            backendClients = response.data.items;
          }
        }

        if (!Array.isArray(backendClients)) {
          console.error('Unexpected API response format: data is not an array.', response);
          setError('Unexpected API response format.');
          setClients(INITIAL_CLIENTS);
          return;
        }

        const mappedClients = backendClients.map(mapBackendClientToFrontend);
        
        // Deduplicate clients by ID to prevent duplicate key errors
        // Use Map to keep the last occurrence of each ID
        const clientMap = new Map<string, Client>();
        mappedClients.forEach(client => {
          // Ensure ID is always a string
          const id = String(client.id);
          clientMap.set(id, { ...client, id });
        });
        
        const uniqueClients = Array.from(clientMap.values());
        
        // Log if duplicates were found (for debugging)
        if (mappedClients.length !== uniqueClients.length) {
          console.warn(`Found ${mappedClients.length - uniqueClients.length} duplicate client(s), removed duplicates.`);
        }
        
        setClients(uniqueClients);
        setIsEmpty(uniqueClients.length === 0);
      } catch (err: any) {
        console.error('Failed to fetch clients:', err);

        if (err.message?.includes('Authentication required') ||
            err.message?.includes('No token') ||
            err.message?.includes('401')) {
          console.warn('Authentication required. Using mock data. Please log in to access real data.');
          setClients(INITIAL_CLIENTS);
          setError(null);
        } else {
          setError(err.message || 'Failed to load clients');
          setClients(INITIAL_CLIENTS);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchClients();
  }, [activeTab, searchQuery]);

  const handleRefresh = async () => {
    try {
      setLoading(true);
      const statusMap: Record<string, string | undefined> = {
        'all': undefined,
        'active': 'ACTIVE',
        'prospects': 'PROSPECT',
        'on-hold': 'ON_HOLD',
        'inactive': 'INACTIVE',
      };

      const response = await apiGetClients({
        status: statusMap[activeTab],
        search: searchQuery || undefined,
      });

      let backendClients: BackendClient[] = [];
      if (response.data) {
        if (Array.isArray(response.data)) {
          backendClients = response.data;
        } else if (Array.isArray(response.data.data)) {
          backendClients = response.data.data;
        } else if (Array.isArray(response.data.items)) {
          backendClients = response.data.items;
        }
      }

      const mappedClients = backendClients.map(mapBackendClientToFrontend);
      // Deduplicate clients by ID to prevent duplicate key errors
      // Use Map to keep the last occurrence of each ID
      const clientMap = new Map<string, Client>();
      mappedClients.forEach(client => {
        const id = String(client.id);
        clientMap.set(id, { ...client, id });
      });
      const uniqueClients = Array.from(clientMap.values());
      setClients(uniqueClients);
      setIsEmpty(uniqueClients.length === 0);
    } catch (err: any) {
      console.error('Failed to refresh clients:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClient = async (id: string) => {
    const client = clients.find(c => c.id === id);
    const name = client?.name || 'this client';
    if (!window.confirm(`Are you sure you want to delete ${name}? This action cannot be undone.`)) {
      return;
    }

    try {
      await apiDeleteClient(id);
      // Optimistically update list
      setClients(prev => prev.filter(c => c.id !== id));
      setSelectedClients(prev => prev.filter(cid => cid !== id));
      await handleRefresh();
    } catch (err: any) {
      console.error('Failed to delete client:', err);
      alert(err?.message || 'Failed to delete client');
    }
  };

  return (
    <div className="w-full min-h-screen bg-slate-50">
      <div className="p-8 max-w-7xl mx-auto w-full">
          {/* Page Header */}
          <div className="flex flex-col md:flex-row md:items-start justify-between mb-8 gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                Recruitment Hub / CRM
              </div>
              <h1 className="text-3xl font-bold text-slate-900">Clients</h1>
            </div>
            
            <div className="flex items-center gap-2 md:gap-3 flex-wrap">
              <button 
                onClick={handleRefresh}
                disabled={loading}
                className="p-2.5 bg-white border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-all shadow-sm disabled:opacity-50"
              >
                <RefreshCcw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => setShowImportDrawer(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-600 font-semibold hover:bg-slate-50 transition-all shadow-sm"
              >
                <Upload className="w-4 h-4" /> Import Clients
              </button>
              <button
                onClick={() => setCreateTaskOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-600 font-semibold hover:bg-slate-50 transition-all shadow-sm"
              >
                <CheckSquare className="w-4 h-4" /> Create Task
              </button>
              <button
                onClick={() => {
                  setSelectedClient(null);
                  setShowAddClientDrawer(true);
                }}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all"
              >
                <Plus className="w-5 h-5" /> Add Client
              </button>
              <button className="p-2.5 bg-white border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 transition-all shadow-sm">
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Search and Filters Bar */}
          <div className="flex flex-col lg:flex-row lg:items-center gap-4 mb-8">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search by client name, industry, location or owner..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              />
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsFilterOpen(true)}
                className="flex items-center gap-2 px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-600 font-semibold hover:bg-slate-50 transition-all shadow-sm"
              >
                <Filter className="w-5 h-5" /> Filters
              </button>
              <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
                <button className="p-2 rounded-lg bg-blue-50 text-blue-600">
                  <List className="w-5 h-5" />
                </button>
                <button className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all">
                  <Grid2X2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          <StatusTabs activeTab={activeTab} onTabChange={setActiveTab} clients={clients} />
          
          <ClientSummaryMetrics />

          {loading ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center text-slate-500">
              Loading clients...
            </div>
          ) : error && !loading ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center text-red-500">
              Error: {error}
            </div>
          ) : isEmpty ? (
            <EmptyState onImportClick={() => setShowImportDrawer(true)} />
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  <span>Showing <strong>{clients.length} {activeTab === 'all' ? 'Clients' : activeTab === 'active' ? 'Active Clients' : 'Clients'}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-tight">Sort by:</span>
                  <button className="flex items-center gap-1 text-sm font-semibold text-slate-700 hover:text-blue-600">
                    Last Activity <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <ClientTable
                clients={clients}
                selectedIds={selectedClients}
                onSelectionChange={setSelectedClients}
                onSelectClient={setSelectedClient}
                onDeleteClient={handleDeleteClient}
              />
            </>
          )}
        </div>

      <ClientDetailsDrawer
        client={selectedClient}
        isAddMode={showAddClientDrawer}
        onClose={() => {
          setSelectedClient(null);
          setShowAddClientDrawer(false);
        }}
        onDelete={(id) => { setSelectedClient(null); handleDeleteClient(id); }}
        onClientCreated={() => {
          setShowAddClientDrawer(false);
          handleRefresh();
        }}
        onJobCreated={() => {
          handleRefresh();
        }}
      />
      <ClientFilterDrawer isOpen={isFilterOpen} onClose={() => setIsFilterOpen(false)} />
      <ClientImportDrawer
        isOpen={showImportDrawer}
        onClose={() => setShowImportDrawer(false)}
        onImportComplete={() => { /* TODO: refresh client list */ }}
      />
      <CreateTaskModal
        isOpen={createTaskOpen}
        onClose={() => setCreateTaskOpen(false)}
        onSuccess={() => setCreateTaskOpen(false)}
        initialRelatedTo="Client"
      />
      <ClientBulkActionsBar 
        selectedCount={selectedClients.length} 
        onClear={() => setSelectedClients([])} 
      />
    </div>
  );
}
