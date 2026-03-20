'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Users,
  Briefcase,
  FileText,
  Mail,
  Plus,
  Search,
  Filter,
  Eye,
  Edit2,
  UserPlus,
  CheckCircle,
  XCircle,
  Phone,
  Building2,
  ExternalLink,
  Target,
  Trash2,
} from 'lucide-react';
import { ImageWithFallback } from '../../components/ImageWithFallback';
import { LeadDetailsDrawer } from '../../components/drawers/LeadDetailsDrawer';
import type { Lead, LeadStatus, Priority } from './types';
import { apiGetLeads, apiUpdateLead, apiDeleteLead, apiConvertLeadToClient, type BackendLead } from '../../lib/api';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

// --- Mock Data ---
const RECRUITERS = [
  { name: 'Alex Thompson', avatar: 'https://images.unsplash.com/photo-1701463387028-3947648f1337?q=80&w=150' },
  { name: 'Sarah Chen', avatar: 'https://images.unsplash.com/photo-1712168567859-e24cbc155219?q=80&w=150' },
  { name: 'Michael Ross', avatar: 'https://images.unsplash.com/photo-1719835491911-99dd30f3f2dc?q=80&w=150' },
];

const INITIAL_LEADS: Lead[] = [
  {
    id: '1',
    companyName: 'TechNova Solutions',
    type: 'Company',
    source: 'LinkedIn',
    contactPerson: 'David Miller',
    email: 'd.miller@technova.com',
    phone: '+1 (555) 123-4567',
    status: 'Qualified',
    assignedTo: RECRUITERS[0],
    lastFollowUp: '2026-02-01',
    nextFollowUp: '2026-02-10',
    priority: 'High',
    interestedNeeds: 'Full-stack developers, Product Managers',
    notes: 'Looking to hire a team of 5 in the next quarter.',
    activities: [
      {
        id: 'a1',
        type: 'Call',
        date: '2026-02-01',
        description: 'Initial discovery call. Discussed hiring plans.',
        title: 'Call Logged',
        outcome: 'Interested',
        duration: '5 minutes',
        notes: 'Client requested proposal',
      },
      { id: 'a2', type: 'Email', date: '2026-01-28', description: 'Sent agency brochure and case studies.', title: 'Email Sent' },
    ],
    industry: 'Technology',
    companySize: '51-200',
    website: 'https://technova.com',
    linkedIn: 'https://linkedin.com/company/technova',
    location: 'San Francisco, CA',
    designation: 'Head of Talent',
    country: 'United States',
    city: 'San Francisco',
    campaignName: 'Q1 2026 Outreach',
    createdDate: '2026-01-15',
    notesList: [
      { id: 'ln1', title: 'Discovery call summary', content: 'Looking to hire a team of 5 in the next quarter. Full-stack and PM roles.', tags: ['HR'], createdBy: { name: 'Alex Thompson', avatar: 'https://images.unsplash.com/photo-1701463387028-3947648f1337?q=80&w=150' }, createdAt: 'Jan 15, 2026, 10:00 AM', isPinned: true },
      { id: 'ln2', title: 'Budget and timeline', content: 'Budget approved for 5 roles. Target start April 2026.', tags: ['Finance', 'Contract'], createdBy: { name: 'Sarah Chen', avatar: 'https://images.unsplash.com/photo-1712168567859-e24cbc155219?q=80&w=150' }, createdAt: 'Jan 20, 2026, 2:30 PM', isPinned: false },
      { id: 'ln3', title: 'Feedback on proposal', content: 'David liked the SLA and fee structure. Wants to proceed with MSA.', tags: ['Feedback', 'Contract'], createdBy: { name: 'David Miller' }, createdAt: 'Feb 1, 2026, 5:00 PM', isPinned: true },
    ],
  },
  {
    id: '2',
    companyName: 'GreenHorizon Energy',
    type: 'Referral',
    source: 'Referral',
    contactPerson: 'Emma Watson',
    email: 'emma.w@greenhorizon.io',
    phone: '+1 (555) 987-6543',
    status: 'New',
    assignedTo: RECRUITERS[1],
    lastFollowUp: '2026-02-04',
    nextFollowUp: '2026-02-06',
    priority: 'Medium',
    interestedNeeds: 'Environmental Engineers',
    notes: 'Referred by John from SolarTech.',
    activities: []
  },
  {
    id: '3',
    companyName: 'BlueSky Logistics',
    type: 'Company',
    source: 'Website',
    contactPerson: 'Robert Brown',
    email: 'r.brown@bluesky.com',
    phone: '+1 (555) 456-7890',
    status: 'Contacted',
    assignedTo: RECRUITERS[2],
    lastFollowUp: '2026-02-03',
    nextFollowUp: '2026-02-07',
    priority: 'Low',
    interestedNeeds: 'Operations Managers',
    notes: 'Follow up after their board meeting next week.',
    activities: [
      { id: 'a3', type: 'Email', date: '2026-02-03', description: 'Follow-up email sent. No response yet.' }
    ]
  },
  {
    id: '4',
    companyName: 'Infinite AI',
    type: 'Company',
    source: 'Campaign',
    contactPerson: 'Sophia Garcia',
    email: 'sophia@infiniteai.tech',
    phone: '+1 (555) 222-3333',
    status: 'Converted',
    assignedTo: RECRUITERS[0],
    lastFollowUp: '2026-01-20',
    priority: 'High',
    interestedNeeds: 'Machine Learning Engineers',
    notes: 'Contract signed on Jan 20.',
    activities: [
      { id: 'a4', type: 'Meeting', date: '2026-01-15', description: 'Contract negotiation meeting.' }
    ]
  },
  {
    id: '5',
    companyName: 'Peak Performance',
    type: 'Individual',
    source: 'LinkedIn',
    contactPerson: 'James Wilson',
    email: 'james@peak.com',
    phone: '+1 (555) 888-9999',
    status: 'Lost',
    assignedTo: RECRUITERS[1],
    lastFollowUp: '2026-01-30',
    priority: 'Low',
    interestedNeeds: 'Sales Executives',
    notes: 'Went with a different agency due to pricing.',
    activities: [
      { id: 'a5', type: 'Call', date: '2026-01-30', description: 'Final rejection call.' }
    ]
  }
];

// --- Components ---

const StatusTag = ({ status }: { status: LeadStatus }) => {
  const styles = {
    New: 'bg-blue-50 text-blue-700 border-blue-100',
    Contacted: 'bg-yellow-50 text-yellow-700 border-yellow-100',
    Qualified: 'bg-purple-50 text-purple-700 border-purple-100',
    Converted: 'bg-green-50 text-green-700 border-green-100',
    Lost: 'bg-gray-50 text-gray-700 border-gray-100',
  };

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status]}`}>
      {status}
    </span>
  );
};

const PriorityTag = ({ priority }: { priority: Priority }) => {
  const styles = {
    High: 'text-red-600',
    Medium: 'text-orange-500',
    Low: 'text-blue-500',
  };
  return (
    <span className={`flex items-center gap-1 text-sm font-medium ${styles[priority]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${priority === 'High' ? 'bg-red-600' : priority === 'Medium' ? 'bg-orange-500' : 'bg-blue-500'}`} />
      {priority}
    </span>
  );
};

// Helper function to map backend lead to frontend format
function mapBackendLeadToFrontend(backendLead: BackendLead): Lead {
  return {
    id: backendLead.id,
    companyName: backendLead.companyName,
    type: backendLead.type,
    source: backendLead.source,
    contactPerson: backendLead.contactPerson,
    email: backendLead.email,
    phone: backendLead.phone || '',
    status: backendLead.status,
    assignedTo: backendLead.assignedTo ? {
      name: backendLead.assignedTo.name,
      avatar: backendLead.assignedTo.avatar || '',
    } : { name: 'Unassigned', avatar: '' },
    lastFollowUp: backendLead.lastFollowUp || '',
    nextFollowUp: backendLead.nextFollowUp || undefined,
    priority: backendLead.priority,
    interestedNeeds: backendLead.interestedNeeds || '',
    notes: backendLead.notes || '',
    activities: [], // Activities would come from a separate endpoint
    notesList: [], // Notes would come from a separate endpoint
    industry: backendLead.industry || undefined,
    companySize: backendLead.companySize || undefined,
    website: backendLead.website || undefined,
    linkedIn: backendLead.linkedIn || undefined,
    location: backendLead.location || undefined,
    designation: backendLead.designation || undefined,
    country: backendLead.country || undefined,
    city: backendLead.city || undefined,
    campaignName: backendLead.campaignName || undefined,
    createdDate: backendLead.createdAt ? new Date(backendLead.createdAt).toLocaleDateString() : undefined,
  };
}

export default function RecruitmentAgencyDashboard() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [addLeadDrawerOpen, setAddLeadDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'All'>('All');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null); // null = not checked yet
  
  const selectedLead = leads.find(l => l.id === selectedLeadId);

  // Check authentication status on client side only
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    setIsAuthenticated(!!token);
  }, []);

  // Fetch leads from API
  useEffect(() => {
    const fetchLeads = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Check if user is authenticated
        const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
        if (!token) {
          // No token - use mock data for now
          console.warn('No authentication token found. Using mock data.');
          setLeads(INITIAL_LEADS);
          setLoading(false);
          return;
        }
        
        // Ensure apiGetLeads is available
        if (typeof apiGetLeads !== 'function') {
          console.error('apiGetLeads is not a function');
          setError('API function not available');
          setLeads(INITIAL_LEADS);
          setLoading(false);
          return;
        }
        
        const response = await apiGetLeads({
          status: statusFilter !== 'All' ? statusFilter : undefined,
          search: searchQuery || undefined,
        });
        
        // Backend returns: { success: true, message: "...", data: { data: [...], pagination: {...} } }
        // So response.data is { data: [...], pagination: {...} }
        let backendLeads = [];
        if (response.data) {
          if (Array.isArray(response.data)) {
            // Direct array (unlikely but handle it)
            backendLeads = response.data;
          } else if (Array.isArray(response.data.data)) {
            // Paginated response: { data: [...], pagination: {...} }
            backendLeads = response.data.data;
          } else if (Array.isArray(response.data.items)) {
            // Alternative structure with items
            backendLeads = response.data.items;
          } else {
            console.warn('Unexpected response structure:', response.data);
            backendLeads = [];
          }
        }
        
        if (!Array.isArray(backendLeads)) {
          console.error('backendLeads is not an array:', backendLeads);
          backendLeads = [];
        }
        
        const mappedLeads = backendLeads.map(mapBackendLeadToFrontend);
        setLeads(mappedLeads);
      } catch (err: any) {
        console.error('Failed to fetch leads:', err);
        
        // If it's an auth error (401), use mock data and show a warning
        if (err.message?.includes('Authentication required') || 
            err.message?.includes('No token') ||
            err.message?.includes('401')) {
          console.warn('Authentication required. Using mock data. Please log in to access real data.');
          setLeads(INITIAL_LEADS);
          setError(null); // Don't show error for auth issues, just use mock data
        } else {
          setError(err.message || 'Failed to load leads');
          // Fallback to mock data on error
          setLeads(INITIAL_LEADS);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchLeads();
  }, [statusFilter, searchQuery]);

  const filteredLeads = useMemo(() => {
    // If we're using API, filtering is done server-side, but we can still filter client-side for search
    if (searchQuery) {
      return leads.filter(lead => {
        const matchesSearch = lead.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              lead.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              lead.contactPerson.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesSearch;
      });
    }
    return leads;
  }, [leads, searchQuery]);

  const stats = {
    New: leads.filter(l => l.status === 'New').length,
    Contacted: leads.filter(l => l.status === 'Contacted').length,
    Qualified: leads.filter(l => l.status === 'Qualified').length,
    Converted: leads.filter(l => l.status === 'Converted').length,
    Lost: leads.filter(l => l.status === 'Lost').length,
  };

  const handleConvert = async (id: string) => {
    try {
      const lead = leads.find(l => l.id === id);
      if (!lead) return;
      
      // Log the lead data being converted
      console.log('\n=== LEAD DATA BEING CONVERTED (Frontend) ===');
      console.log(JSON.stringify({
        id: lead.id,
        companyName: lead.companyName,
        industry: lead.industry,
        companySize: lead.companySize,
        website: lead.website,
        linkedIn: lead.linkedIn,
        location: lead.location,
        city: lead.city,
        country: lead.country,
        designation: lead.designation,
        contactPerson: lead.contactPerson,
        email: lead.email,
        phone: lead.phone,
        priority: lead.priority,
      }, null, 2));
      
      const convertData = {
        companyName: lead.companyName,
        industry: lead.industry,
        companySize: lead.companySize,
        website: lead.website,
        address: lead.location,
        linkedin: lead.linkedIn,
        location: lead.location || lead.city || lead.country,
        hiringLocations: lead.city && lead.country ? `${lead.city}, ${lead.country}` : lead.city || lead.country,
        priority: lead.priority ? lead.priority.charAt(0) + lead.priority.slice(1).toLowerCase() : undefined,
      };
      
      // Log the data being sent to backend
      console.log('\n=== DATA BEING SENT TO BACKEND (Frontend) ===');
      console.log(JSON.stringify(convertData, null, 2));
      
      const response = await apiConvertLeadToClient(id, convertData);
      
      // Log the response
      console.log('\n=== CONVERSION RESPONSE (Frontend) ===');
      console.log(JSON.stringify(response, null, 2));
      
      // Update local state
      setLeads(prev => prev.map(l => l.id === id ? { ...l, status: 'Converted' as LeadStatus } : l));
      
      // Navigate to clients page after successful conversion
      router.push('/client');
    } catch (err: any) {
      console.error('Failed to convert lead:', err);
      alert(err.message || 'Failed to convert lead');
    }
  };

  const [statusEdit, setStatusEdit] = useState<{
    leadId: string | null;
    newStatus: LeadStatus | null;
    remark: string;
  }>({
    leadId: null,
    newStatus: null,
    remark: '',
  });

  const handleInlineStatusChange = (id: string, newStatus: LeadStatus) => {
    // Optimistically update UI
    setLeads(prev => prev.map(l => (l.id === id ? { ...l, status: newStatus } : l)));
    // Open remark editor for this row
    setStatusEdit({
      leadId: id,
      newStatus,
      remark: '',
    });
  };

  const handleSaveStatusEdit = async () => {
    if (!statusEdit.leadId || !statusEdit.newStatus) return;

    try {
      await apiUpdateLead(statusEdit.leadId, {
        status: statusEdit.newStatus,
        statusRemark: statusEdit.remark || undefined,
      });
    } catch (err: any) {
      console.error('Failed to update lead status with remark:', err);
      alert(err.message || 'Failed to update lead status');
      // Revert by refreshing from backend
      try {
        await handleRefresh();
      } catch {
        // ignore
      }
    } finally {
      setStatusEdit({ leadId: null, newStatus: null, remark: '' });
    }
  };

  const handleCancelStatusEdit = async () => {
    setStatusEdit({ leadId: null, newStatus: null, remark: '' });
    // Reload to ensure UI matches backend
    try {
      await handleRefresh();
    } catch {
      // ignore
    }
  };

  const handleMarkLost = async (id: string, formData?: { lostReason?: string; notes?: string }) => {
    try {
      await apiUpdateLead(id, {
        status: 'Lost',
        lostReason: formData?.lostReason,
        notes: formData?.notes,
      });
      
      // Update local state
      setLeads(prev => prev.map(l => l.id === id ? { ...l, status: 'Lost' as LeadStatus } : l));
    } catch (err: any) {
      console.error('Failed to mark lead as lost:', err);
      alert(err.message || 'Failed to update lead');
    }
  };

  const handleDeleteLead = async (id: string) => {
    try {
      await apiDeleteLead(id);
      setLeads(prev => prev.filter(l => l.id !== id));
      if (selectedLeadId === id) {
        setSelectedLeadId(null);
      }
    } catch (err: any) {
      console.error('Failed to delete lead:', err);
      alert(err.message || 'Failed to delete lead');
    }
  };

  const handleRefresh = async () => {
    try {
      setLoading(true);
      const response = await apiGetLeads({
        status: statusFilter !== 'All' ? statusFilter : undefined,
        search: searchQuery || undefined,
      });
      
      // Backend returns: { success: true, message: "...", data: { data: [...], pagination: {...} } }
      // So response.data is { data: [...], pagination: {...} }
      let backendLeads = [];
      if (response.data) {
        if (Array.isArray(response.data)) {
          // Direct array (unlikely but handle it)
          backendLeads = response.data;
        } else if (Array.isArray(response.data.data)) {
          // Paginated response: { data: [...], pagination: {...} }
          backendLeads = response.data.data;
        } else if (Array.isArray(response.data.items)) {
          // Alternative structure with items
          backendLeads = response.data.items;
        } else {
          console.warn('Unexpected response structure:', response.data);
          backendLeads = [];
        }
      }
      
      if (!Array.isArray(backendLeads)) {
        console.error('backendLeads is not an array:', backendLeads);
        backendLeads = [];
      }
      
      const mappedLeads = backendLeads.map(mapBackendLeadToFrontend);
      setLeads(mappedLeads);
    } catch (err: any) {
      console.error('Failed to refresh leads:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-[#F8FAFC] overflow-hidden text-slate-900">
      {/* Main Content */}
      <main className="flex flex-col overflow-hidden relative">
        {/* Header */}
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 leading-tight">Leads</h1>
            <p className="text-sm text-slate-500">Track, manage, and convert potential clients into active hiring partners</p>
          </div>
          <div className="flex items-center gap-3">
            {isAuthenticated === false && (
              <a
                href="/login"
                className="text-sm text-slate-600 hover:text-blue-600 font-medium px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Log in
              </a>
            )}
            <button
              type="button"
              onClick={() => setAddLeadDrawerOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all shadow-sm active:scale-95"
            >
              <Plus size={18} />
              <span>Add Lead</span>
            </button>
          </div>
        </header>

        {/* Scrollable Area */}
        <div className="flex-1 overflow-y-auto p-8">
          {/* Summary Cards */}
          <div className="grid grid-cols-5 gap-6 mb-8">
            <SummaryCard label="New Leads" count={stats.New} color="blue" icon={<Plus size={16} />} />
            <SummaryCard label="Contacted" count={stats.Contacted} color="yellow" icon={<Phone size={16} />} />
            <SummaryCard label="Qualified" count={stats.Qualified} color="purple" icon={<Target size={16} />} />
            <SummaryCard label="Converted" count={stats.Converted} color="green" icon={<CheckCircle size={16} />} />
            <SummaryCard label="Lost" count={stats.Lost} color="gray" icon={<XCircle size={16} />} />
          </div>

          {/* Table Controls */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-6">
            <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100">
              <div className="relative w-full md:w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Search company, email, or contact..." 
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg">
                  <Filter size={14} className="text-slate-400" />
                  <span className="text-xs font-bold text-slate-500 uppercase">Filters:</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <select 
                    className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer hover:border-blue-300 transition-colors"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as LeadStatus | 'All')}
                  >
                    <option value="All">All Statuses</option>
                    <option value="New">New</option>
                    <option value="Contacted">Contacted</option>
                    <option value="Qualified">Qualified</option>
                    <option value="Converted">Converted</option>
                    <option value="Lost">Lost</option>
                  </select>

                  <select className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer hover:border-blue-300 transition-colors">
                    <option>All Sources</option>
                    <option>Website</option>
                    <option>LinkedIn</option>
                    <option>Email</option>
                    <option>Referral</option>
                    <option>Campaign</option>
                  </select>

                  <select className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer hover:border-blue-300 transition-colors">
                    <option>All Recruiters</option>
                    {RECRUITERS.map(r => <option key={r.name}>{r.name}</option>)}
                  </select>

                  <button 
                    className="text-sm text-slate-500 hover:text-red-600 font-medium px-2 py-1 flex items-center gap-1 transition-colors"
                    onClick={() => {
                      setSearchQuery('');
                      setStatusFilter('All');
                    }}
                  >
                    <XCircle size={14} />
                    Clear
                  </button>
                </div>
              </div>
            </div>

            {/* Leads Table */}
            <div className="overflow-x-auto">
              {loading && (
                <div className="p-8 text-center text-slate-500">Loading leads...</div>
              )}
              {error && !loading && (
                <div className="p-8 text-center text-red-500">Error: {error}</div>
              )}
              {!loading && !error && (
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 border-y border-slate-200 text-slate-500 uppercase text-[11px] font-bold tracking-wider">
                      <th className="px-6 py-4">Lead / Company</th>
                      <th className="px-6 py-4">Source</th>
                      <th className="px-6 py-4">Contact</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Assigned To</th>
                      <th className="px-6 py-4">Last Follow-up</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredLeads.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                          No leads found
                        </td>
                      </tr>
                    ) : (
                      filteredLeads.map(lead => (
                    <tr 
                      key={lead.id} 
                      className={`group hover:bg-slate-50 transition-colors cursor-pointer ${selectedLeadId === lead.id ? 'bg-blue-50/50' : ''}`}
                      onClick={() => setSelectedLeadId(lead.id)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-slate-900">{lead.companyName}</span>
                          <span className="text-xs text-slate-500">{lead.type}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-100 w-fit px-2 py-1 rounded-md">
                          <ExternalLink size={12} />
                          {lead.source}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm text-slate-700">{lead.contactPerson}</span>
                          <span className="text-xs text-slate-500">{lead.email}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-col gap-2">
                          <select
                            className="px-3 py-1 rounded-full border border-slate-300 bg-white text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
                            value={lead.status}
                            onChange={(e) =>
                              handleInlineStatusChange(lead.id, e.target.value as LeadStatus)
                            }
                          >
                            <option value="New">New</option>
                            <option value="Contacted">Contacted</option>
                            <option value="Qualified">Qualified</option>
                            <option value="Converted">Converted</option>
                            <option value="Lost">Lost</option>
                          </select>

                          {statusEdit.leadId === lead.id && (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                placeholder="Add remark for this status change"
                                className="flex-1 px-2 py-1 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                value={statusEdit.remark}
                                onChange={(e) =>
                                  setStatusEdit(prev => ({
                                    ...prev,
                                    remark: e.target.value,
                                  }))
                                }
                              />
                              <button
                                type="button"
                                className="px-2 py-1 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                                onClick={handleSaveStatusEdit}
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                className="px-2 py-1 text-xs font-medium text-slate-600 bg-slate-100 rounded-md hover:bg-slate-200"
                                onClick={handleCancelStatusEdit}
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <ImageWithFallback 
                            src={lead.assignedTo.avatar} 
                            alt={lead.assignedTo.name} 
                            className="w-7 h-7 rounded-full" 
                          />
                          <span className="text-sm text-slate-700">{lead.assignedTo.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm text-slate-700">{lead.lastFollowUp}</span>
                          {lead.nextFollowUp && (
                            <span className="text-[10px] text-blue-600 font-medium mt-0.5">Next: {lead.nextFollowUp}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md" title="View Details" onClick={() => setSelectedLeadId(lead.id)}>
                            <Eye size={18} />
                          </button>
                          <button className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md" title="Edit Lead">
                            <Edit2 size={18} />
                          </button>
                          <button 
                            className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-md" 
                            title="Convert to Client"
                            onClick={() => handleConvert(lead.id)}
                          >
                            <UserPlus size={18} />
                          </button>
                          <button 
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md" 
                            title="Delete Lead"
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (confirm(`Are you sure you want to delete ${lead.companyName}? This action cannot be undone.`)) {
                                await handleDeleteLead(lead.id);
                              }
                            }}
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {(selectedLead || addLeadDrawerOpen) && (
          <LeadDetailsDrawer
            lead={selectedLead ?? null}
            addLeadMode={addLeadDrawerOpen}
            onClose={() => {
              setSelectedLeadId(null);
              setAddLeadDrawerOpen(false);
            }}
            onAddLead={async (data) => {
              try {
                // The drawer will handle the API call, we just refresh the list
                await handleRefresh();
                setAddLeadDrawerOpen(false);
              } catch (err: any) {
                console.error('Failed to add lead:', err);
              }
            }}
            onConvert={handleConvert}
            onMarkLost={handleMarkLost}
            onDeleteLead={handleDeleteLead}
            onAssignLead={async (leadId, formData) => {
              try {
                await apiUpdateLead(leadId, {
                  assignedToId: formData.assignTo || undefined,
                  priority: formData.priority,
                });
                toast.success('Lead assigned successfully');
                await handleRefresh();
              } catch (err: any) {
                console.error('Failed to assign lead:', err);
                toast.error(err.message || 'Failed to assign lead');
              }
            }}
          />
        )}
      </main>
    </div>
  );
}

// --- Helper Components ---

const SummaryCard = ({ label, count, color, icon }: { label: string, count: number, color: string, icon: React.ReactNode }) => {
  const styles: any = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-700', iconBg: 'bg-blue-100', border: 'border-blue-100' },
    yellow: { bg: 'bg-yellow-50', text: 'text-yellow-700', iconBg: 'bg-yellow-100', border: 'border-yellow-100' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-700', iconBg: 'bg-purple-100', border: 'border-purple-100' },
    green: { bg: 'bg-green-50', text: 'text-green-700', iconBg: 'bg-green-100', border: 'border-green-100' },
    gray: { bg: 'bg-gray-50', text: 'text-gray-700', iconBg: 'bg-gray-100', border: 'border-gray-100' },
  };
  const s = styles[color] || styles.gray;
  return (
    <div className={`p-4 rounded-xl border shadow-sm transition-all hover:shadow-md cursor-pointer ${s.bg} ${s.border}`}>
      <div className="flex items-center justify-between mb-2">
        <div className={`p-2 rounded-lg ${s.iconBg} ${s.text}`}>{icon}</div>
        <span className={`text-2xl font-bold ${s.text}`}>{count}</span>
      </div>
      <p className={`text-xs font-bold uppercase tracking-wider opacity-70 ${s.text}`}>{label}</p>
    </div>
  );
};

