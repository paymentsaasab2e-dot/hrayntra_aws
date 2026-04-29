'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  Plus,
  Upload,
  Search,
  Filter,
  Eye,
  Pencil,
  UserPlus,
  CheckCircle,
  XCircle,
  Phone,
  Building2,
  ExternalLink,
  Target,
  Trash2,
  Check,
  BadgeCheck,
  X,
} from 'lucide-react';
import { ImageWithFallback } from '../../components/ImageWithFallback';
import { LeadDetailsDrawer } from '../../components/drawers/LeadDetailsDrawer';
import { LeadImportDrawer } from '../../components/drawers/LeadImportDrawer';
import AriaChat from '../../components/AriaChat';
import PaginationAll from '../../components/PaginationAll';
import type { Lead, LeadStatus, Priority } from './types';
import {
  apiGetLeads,
  apiGetLead,
  apiUpdateLead,
  apiDeleteLead,
  apiConvertLeadToClient,
  apiGetUsers,
  type BackendLead,
  type BackendUser,
} from '../../lib/api';
import { useRouter, useSearchParams } from 'next/navigation';
import { Toaster, toast } from 'sonner';
import { splitDateTimeForDisplay } from '../../utils/formatLeadDateTime';
import { usePermissions } from '../../hooks/usePermissions';
import { requestError } from '../../lib/appDialog';

/** Last / next follow-up column: date + time on separate lines (not raw ISO). */
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
    <div className="flex flex-col gap-1.5 min-w-[9rem]">
      {last ? (
        <div>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Date</p>
          <p className="text-xs font-medium text-slate-800 leading-tight">{last.date}</p>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mt-1">Time</p>
          <p className="text-[10px] text-slate-600 leading-tight">{last.time}</p>
        </div>
      ) : (
        <span className="text-xs text-slate-400">—</span>
      )}
      {next && (
        <div className="pt-1.5 mt-0.5 border-t border-slate-100">
          <p className="text-[9px] font-bold text-blue-600 uppercase tracking-wide mb-0.5">Next</p>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Date</p>
          <p className="text-xs font-medium text-blue-700 leading-tight">{next.date}</p>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mt-1">Time</p>
          <p className="text-[10px] text-blue-600 leading-tight">{next.time}</p>
        </div>
      )}
    </div>
  );
}

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

const SelectionCheckbox = ({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) => (
  <div
    onClick={onChange}
    role="checkbox"
    aria-checked={checked}
    className={`flex h-4 w-4 cursor-pointer items-center justify-center rounded border transition-colors ${
      checked ? 'border-blue-600 bg-blue-600' : 'border-slate-300 bg-white'
    }`}
  >
    {checked ? <Check className="h-3 w-3 text-white" strokeWidth={4} /> : null}
  </div>
);

// Helper function to map backend lead to frontend format
function mapBackendLeadToFrontend(backendLead: BackendLead): Lead {
  return {
    id: backendLead.id,
    companyName: backendLead.companyName || '',
    type: backendLead.type,
    source: backendLead.source,
    contactPerson: backendLead.contactPerson || '',
    email: backendLead.email || '',
    phone: backendLead.phone || '',
    status: backendLead.status,
    assignedTo: backendLead.assignedTo ? {
      id: backendLead.assignedTo.id,
      name: backendLead.assignedTo.name,
      avatar: backendLead.assignedTo.avatar || '',
    } : { name: 'Unassigned', avatar: '' },
    assignedToId: backendLead.assignedTo?.id,
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
    campaignLink: backendLead.campaignLink || undefined,
    referralName: backendLead.referralName || undefined,
    sourceWebsiteUrl: backendLead.sourceWebsiteUrl || undefined,
    sourceLinkedInUrl: backendLead.sourceLinkedInUrl || undefined,
    sourceEmail: backendLead.sourceEmail || undefined,
    otherDetails: Array.isArray(backendLead.otherDetails) ? backendLead.otherDetails : undefined,
    createdDate: backendLead.createdAt ? new Date(backendLead.createdAt).toLocaleDateString() : undefined,
  };
}

function extractBackendLeads(
  responseData: { data: BackendLead[]; pagination?: any } | BackendLead[] | unknown
): BackendLead[] {
  if (Array.isArray(responseData)) return responseData as BackendLead[];
  if (responseData && typeof responseData === 'object') {
    const payload = responseData as { data?: unknown };
    if (Array.isArray(payload.data)) return payload.data as BackendLead[];
  }
  return [];
}

function buildLeadMetrics(leadList: Lead[]) {
  return leadList.reduce(
    (acc, lead) => {
      const status = String(lead.status || '').toLowerCase();
      if (status === 'new') acc.NEW_LEADS += 1;
      else if (status === 'contacted') acc.CONTACTED += 1;
      else if (status === 'qualified') acc.QUALIFIED += 1;
      else if (status === 'converted') acc.CONVERTED += 1;
      else if (status === 'lost') acc.LOST += 1;
      return acc;
    },
    {
      NEW_LEADS: 0,
      CONTACTED: 0,
      QUALIFIED: 0,
      CONVERTED: 0,
      LOST: 0,
    }
  );
}

export default function RecruitmentAgencyDashboard() {
  const PAGE_SIZE = 10;
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hasPermission, hasAnyPermission } = usePermissions();
  const canCreateLead = hasPermission('leads_create');
  const canUpdateLead = hasPermission('leads_update');
  const canDeleteLead = hasPermission('leads_delete');
  const canConvertLead = hasAnyPermission(['leads_update', 'clients_create']);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [selectedLeadDrawerMode, setSelectedLeadDrawerMode] = useState<'view' | 'edit'>('view');
  const [addLeadDrawerOpen, setAddLeadDrawerOpen] = useState(false);
  const [importDrawerOpen, setImportDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'All'>('All');
  const [sourceFilter, setSourceFilter] = useState('');
  const [recruiterFilter, setRecruiterFilter] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null); // null = not checked yet
  const [teamMembers, setTeamMembers] = useState<BackendUser[]>([]);
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkAssignedTo, setBulkAssignedTo] = useState('');
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [highlightedRows, setHighlightedRows] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalEntries, setTotalEntries] = useState(0);
  const [deleteConfirmState, setDeleteConfirmState] = useState<{
    mode: 'single' | 'bulk';
    leadId?: string;
    companyName?: string;
    count?: number;
  } | null>(null);
  const [deleteConfirmLoading, setDeleteConfirmLoading] = useState(false);
  const [metrics, setMetrics] = useState({
    NEW_LEADS: 0,
    CONTACTED: 0,
    QUALIFIED: 0,
    CONVERTED: 0,
    LOST: 0,
  });
  
  const selectedLead = leads.find(l => l.id === selectedLeadId);
  const pendingDeepLinkLeadIdRef = useRef<string | null>(null);

  // Check authentication status on client side only
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    setIsAuthenticated(!!token);
  }, []);

  useEffect(() => {
    const leadId = searchParams.get('leadId');
    if (!leadId) {
      pendingDeepLinkLeadIdRef.current = null;
      return;
    }
    if (pendingDeepLinkLeadIdRef.current === leadId && selectedLeadId === leadId) {
      return;
    }
    pendingDeepLinkLeadIdRef.current = leadId;

    const existingLead = leads.find((lead) => lead.id === leadId);
    if (existingLead) {
      setSelectedLeadId(leadId);
      setSelectedLeadDrawerMode('view');
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const response = await apiGetLead(leadId);
        if (cancelled) return;
        const backendLead = (response as any).data?.data || (response as any).data || response;
        if (!backendLead) return;
        const mappedLead = mapBackendLeadToFrontend(backendLead);
        mergeLeadOptimistically(mappedLead);
        setSelectedLeadId(mappedLead.id);
        setSelectedLeadDrawerMode('view');
      } catch (err) {
        console.error('Failed to open lead from search:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [leads, searchParams, selectedLeadId]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
        if (!token) return;
        const response = await apiGetUsers({ isActive: true, limit: 200, role: 'RECRUITER' });
        const payload = response.data;
        const users = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
            ? payload.data
            : [];
        setTeamMembers(users);
      } catch (err) {
        console.error('Failed to fetch users for bulk lead assignment:', err);
      }
    };

    fetchUsers();
  }, []);

  const loadLeadMetrics = async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      if (!token) {
        setMetrics(buildLeadMetrics(INITIAL_LEADS));
        return;
      }

      const pageSize = 500;
      let page = 1;
      let totalPages = 1;
      let collected: Lead[] = [];

      while (page <= totalPages) {
        const response = await apiGetLeads({
          page,
          limit: pageSize,
        });

        const backendLeads = response.data ? extractBackendLeads(response.data) : [];
        collected = [...collected, ...backendLeads.map(mapBackendLeadToFrontend)];

        const pagination = !Array.isArray(response.data) ? response.data?.pagination : undefined;
        totalPages = pagination?.totalPages || Math.max(1, Math.ceil((pagination?.total || collected.length) / pageSize));

        if (backendLeads.length < pageSize) break;
        page += 1;
      }

      setMetrics(buildLeadMetrics(collected));
    } catch (err) {
      console.error('Failed to load lead metrics:', err);
      setMetrics(buildLeadMetrics(INITIAL_LEADS));
    }
  };

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
          setTotalEntries(INITIAL_LEADS.length);
          setLoading(false);
          return;
        }
        
        // Ensure apiGetLeads is available
        if (typeof apiGetLeads !== 'function') {
          console.error('apiGetLeads is not a function');
          setError('API function not available');
          setLeads(INITIAL_LEADS);
          setTotalEntries(INITIAL_LEADS.length);
          setLoading(false);
          return;
        }
        
        const response = await apiGetLeads({
          status: statusFilter !== 'All' ? statusFilter : undefined,
          source: sourceFilter || undefined,
          assignedToId: recruiterFilter || undefined,
          search: searchQuery || undefined,
          page: currentPage,
          limit: PAGE_SIZE,
        });
        
        // Backend returns: { success: true, message: "...", data: { data: [...], pagination: {...} } }
        // So response.data is { data: [...], pagination: {...} }
        const backendLeads = response.data ? extractBackendLeads(response.data) : [];
        const pagination = response.data?.pagination;
        
        if (!Array.isArray(backendLeads)) {
          console.error('backendLeads is not an array:', backendLeads);
          setLeads(INITIAL_LEADS);
          setTotalEntries(INITIAL_LEADS.length);
          return;
        }
        
        const mappedLeads = backendLeads.map(mapBackendLeadToFrontend);
        setLeads(mappedLeads);
        if (pagination) {
          setTotalEntries(pagination.total || 0);
        } else {
          setTotalEntries(mappedLeads.length);
        }
      } catch (err: any) {
        console.error('Failed to fetch leads:', err);
        
        // If it's an auth error (401), use mock data and show a warning
        if (err.message?.includes('Authentication required') || 
            err.message?.includes('No token') ||
            err.message?.includes('401')) {
          console.warn('Authentication required. Using mock data. Please log in to access real data.');
          setLeads(INITIAL_LEADS);
          setTotalEntries(INITIAL_LEADS.length);
          setError(null); // Don't show error for auth issues, just use mock data
        } else {
          setError(err.message || 'Failed to load leads');
          // Fallback to mock data on error
          setLeads(INITIAL_LEADS);
          setTotalEntries(INITIAL_LEADS.length);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchLeads();
  }, [statusFilter, sourceFilter, searchQuery, currentPage, recruiterFilter]);

  useEffect(() => {
    void loadLeadMetrics();
  }, []);

  const filteredLeads = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return leads.filter((lead) => {
      const matchesSearch =
        !query ||
        lead.companyName.toLowerCase().includes(query) ||
        lead.email.toLowerCase().includes(query) ||
        lead.contactPerson.toLowerCase().includes(query);
      const matchesRecruiter =
        !recruiterFilter || lead.assignedToId === recruiterFilter || lead.assignedTo?.id === recruiterFilter;
      return matchesSearch && matchesRecruiter;
    });
  }, [leads, searchQuery, recruiterFilter]);

  const adjustLeadMetricCounts = useCallback((previousStatus?: LeadStatus, nextStatus?: LeadStatus) => {
    const getKey = (status?: LeadStatus) => {
      switch (status) {
        case 'New':
          return 'NEW_LEADS' as const;
        case 'Contacted':
          return 'CONTACTED' as const;
        case 'Qualified':
          return 'QUALIFIED' as const;
        case 'Converted':
          return 'CONVERTED' as const;
        case 'Lost':
          return 'LOST' as const;
        default:
          return null;
      }
    };

    const prevKey = getKey(previousStatus);
    const nextKey = getKey(nextStatus);

    if (!prevKey && !nextKey) return;

    setMetrics((current) => {
      const next = { ...current };
      if (prevKey) next[prevKey] = Math.max(0, next[prevKey] - 1);
      if (nextKey) next[nextKey] += 1;
      return next;
    });
  }, []);

  const mergeLeadOptimistically = useCallback((lead: Lead) => {
    setLeads((current) => [lead, ...current.filter((item) => item.id !== lead.id)]);
    setTotalEntries((current) => current + 1);
    adjustLeadMetricCounts(undefined, lead.status);
  }, [adjustLeadMetricCounts]);

  const replaceLeadOptimistically = useCallback((lead: Lead) => {
    const previousLead = leads.find((item) => item.id === lead.id);
    setLeads((current) => current.map((item) => (item.id === lead.id ? lead : item)));
    setSelectedLeadId((current) => (current === lead.id ? lead.id : current));
    if (previousLead && previousLead.status !== lead.status) {
      adjustLeadMetricCounts(previousLead.status, lead.status);
    }
  }, [adjustLeadMetricCounts, leads]);

  const removeLeadOptimistically = useCallback((leadId: string) => {
    const previousLead = leads.find((item) => item.id === leadId);
    setLeads((current) => current.filter((item) => item.id !== leadId));
    setSelectedLeadIds((current) => current.filter((id) => id !== leadId));
    setTotalEntries((current) => Math.max(0, current - 1));
    if (selectedLeadId === leadId) {
      setSelectedLeadId(null);
    }
    if (previousLead) {
      adjustLeadMetricCounts(previousLead.status, undefined);
    }
  }, [adjustLeadMetricCounts, leads, selectedLeadId]);

  const allVisibleSelected = filteredLeads.length > 0 && filteredLeads.every((lead) => selectedLeadIds.includes(lead.id));

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedLeadIds((prev) => prev.filter((id) => !filteredLeads.some((lead) => lead.id === id)));
      return;
    }
    setSelectedLeadIds((prev) => Array.from(new Set([...prev, ...filteredLeads.map((lead) => lead.id)])));
  };

  const toggleLeadSelection = (leadId: string) => {
    setSelectedLeadIds((prev) => (
      prev.includes(leadId) ? prev.filter((id) => id !== leadId) : [...prev, leadId]
    ));
  };

  const handleStatusCardClick = (nextStatus: LeadStatus | 'All') => {
    setCurrentPage(1);
    setStatusFilter((prev) => (prev === nextStatus ? 'All' : nextStatus));
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
        servicesNeeded: lead.servicesNeeded || lead.interestedNeeds,
        expectedBusinessValue: lead.expectedBusinessValue || lead.notes,
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
      const previousStatus = lead.status;
      if (previousStatus !== 'Converted') {
        adjustLeadMetricCounts(previousStatus, 'Converted');
      }
      
      // Navigate to clients page after successful conversion
      router.push('/client');
    } catch (err: any) {
      console.error('Failed to convert lead:', err);
      void requestError(err.message || 'Failed to convert lead');
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
    const previousLead = leads.find((lead) => lead.id === id);
    setLeads(prev => prev.map(l => (l.id === id ? { ...l, status: newStatus } : l)));
    if (previousLead && previousLead.status !== newStatus) {
      adjustLeadMetricCounts(previousLead.status, newStatus);
    }
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
      await handleRefresh({ silent: true });
    } catch (err: any) {
      console.error('Failed to update lead status with remark:', err);
      void requestError(err.message || 'Failed to update lead status');
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
      const previousLead = leads.find((lead) => lead.id === id);
      setLeads(prev => prev.map(l => l.id === id ? { ...l, status: 'Lost' as LeadStatus } : l));
      if (previousLead && previousLead.status !== 'Lost') {
        adjustLeadMetricCounts(previousLead.status, 'Lost');
      }
      await handleRefresh({ silent: true });
    } catch (err: any) {
      console.error('Failed to mark lead as lost:', err);
      void requestError(err.message || 'Failed to update lead');
    }
  };

  const handleDeleteLead = async (id: string) => {
    const leadToDelete = leads.find((lead) => lead.id === id);
    try {
      removeLeadOptimistically(id);
      await apiDeleteLead(id);
      await handleRefresh({ silent: true });
      toast.success(
        leadToDelete
          ? `Lead "${leadToDelete.companyName}" deleted successfully`
          : 'Lead deleted successfully'
      );
      return true;
    } catch (err: any) {
      console.error('Failed to delete lead:', err);
      await handleRefresh({ silent: true });
      void requestError(err.message || 'Failed to delete lead');
      return false;
    }
  };

  const handleRefresh = async (options?: { silent?: boolean }) => {
    try {
      if (!options?.silent) {
        setLoading(true);
      }
      const response = await apiGetLeads({
        status: statusFilter !== 'All' ? statusFilter : undefined,
        source: sourceFilter || undefined,
        search: searchQuery || undefined,
        page: currentPage,
        limit: PAGE_SIZE,
      });
      
      // Backend returns: { success: true, message: "...", data: { data: [...], pagination: {...} } }
      // So response.data is { data: [...], pagination: {...} }
      const backendLeads = response.data ? extractBackendLeads(response.data) : [];
      const pagination = response.data?.pagination;
      
      if (!Array.isArray(backendLeads)) {
        console.error('backendLeads is not an array:', backendLeads);
        return;
      }
      
      const mappedLeads = backendLeads.map(mapBackendLeadToFrontend);
      setLeads(mappedLeads);
      if (pagination) {
        setTotalEntries(pagination.total || 0);
      } else {
        setTotalEntries(mappedLeads.length);
      }
      void loadLeadMetrics();
    } catch (err: any) {
      console.error('Failed to refresh leads:', err);
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  };

  const clearBulkSelection = () => {
    setSelectedLeadIds([]);
    setBulkStatus('');
    setBulkAssignedTo('');
  };

  const executeBulkLeadDelete = async () => {
    try {
      setBulkActionLoading(true);
      const deletedCount = selectedLeadIds.length;
      await Promise.all(selectedLeadIds.map((id) => apiDeleteLead(id)));
      clearBulkSelection();
      await handleRefresh({ silent: true });
      toast.success(`Deleted ${deletedCount} lead${deletedCount === 1 ? '' : 's'} successfully`);
      return true;
    } catch (err: any) {
      console.error('Failed to bulk delete leads:', err);
      void requestError(err.message || 'Failed to delete selected leads');
      return false;
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkLeadDelete = () => {
    if (selectedLeadIds.length === 0) return;
    setDeleteConfirmState({
      mode: 'bulk',
      count: selectedLeadIds.length,
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmState) return;
    setDeleteConfirmLoading(true);
    let success = false;
    try {
      if (deleteConfirmState.mode === 'single' && deleteConfirmState.leadId) {
        success = await handleDeleteLead(deleteConfirmState.leadId);
      } else if (deleteConfirmState.mode === 'bulk') {
        success = await executeBulkLeadDelete();
      }
    } finally {
      setDeleteConfirmLoading(false);
      if (success) {
        setDeleteConfirmState(null);
      }
    }
  };

  const handleBulkLeadUpdate = async (updates: { status?: LeadStatus; assignedToId?: string }) => {
    if (selectedLeadIds.length === 0) return;

    try {
      setBulkActionLoading(true);
      await Promise.all(selectedLeadIds.map((id) => apiUpdateLead(id, updates)));
      clearBulkSelection();
      await handleRefresh({ silent: true });
    } catch (err: any) {
      console.error('Failed to bulk update leads:', err);
      void requestError(err.message || 'Failed to update selected leads');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkLeadStatusChange = async (status: string) => {
    setBulkStatus(status);
    if (!status) return;
    await handleBulkLeadUpdate({ status: status as LeadStatus });
  };

  const handleBulkLeadAssignChange = async (assignedToId: string) => {
    setBulkAssignedTo(assignedToId);
    if (!assignedToId) return;
    await handleBulkLeadUpdate({ assignedToId });
  };

  const mapUiLeadToFrontend = (raw: any): Lead => {
    const base = raw && typeof raw === 'object' ? raw : {};
    const source = ['Website', 'LinkedIn', 'Email', 'Referral', 'Campaign'].includes(base.source)
      ? base.source
      : 'Website';
    const type = ['Company', 'Individual', 'Referral'].includes(base.type)
      ? base.type
      : 'Company';
    const status = ['New', 'Contacted', 'Qualified', 'Converted', 'Lost'].includes(base.status)
      ? base.status
      : 'New';
    const priority = ['High', 'Medium', 'Low'].includes(base.priority)
      ? base.priority
      : 'Medium';

    return {
      id: String(base.id || `aria-${Date.now()}`),
      companyName: String(base.companyName || ''),
      type,
      source,
      contactPerson: String(base.contactPerson || base.contactName || ''),
      email: String(base.email || ''),
      phone: String(base.phone || ''),
      status,
      assignedTo: base.assignedTo
        ? { name: String(base.assignedTo.name || 'Unassigned'), avatar: String(base.assignedTo.avatar || '') }
        : { name: 'Unassigned', avatar: '' },
      lastFollowUp: String(base.lastFollowUp || ''),
      nextFollowUp: base.nextFollowUp ? String(base.nextFollowUp) : undefined,
      priority,
      interestedNeeds: String(base.interestedNeeds || ''),
      notes: String(base.notes || ''),
      activities: [],
      notesList: [],
      industry: base.industry || undefined,
      companySize: base.companySize || undefined,
      website: base.website || undefined,
      linkedIn: base.linkedIn || undefined,
      location: base.location || undefined,
      designation: base.designation || undefined,
      country: base.country || undefined,
      city: base.city || undefined,
      campaignName: base.campaignName || undefined,
      createdDate: base.createdAt ? new Date(base.createdAt).toLocaleDateString() : undefined,
    };
  };

  useEffect(() => {
    function handleAriaPayload(event: Event) {
      const customEvent = event as CustomEvent<any>;
      const payload = customEvent.detail;
      if (!payload || !payload.action) return;

      switch (payload.action) {
        case 'INSERT_ROW':
          if (payload.data) {
            const lead = mapUiLeadToFrontend(payload.data);
            setLeads((prev) => [lead, ...prev]);
          }
          break;
        case 'BULK_INSERT':
        case 'BULK_INSERT_ROWS':
          if (Array.isArray(payload.rows)) {
            const mappedRows = payload.rows.map(mapUiLeadToFrontend);
            setLeads((prev) => [...mappedRows, ...prev]);
          }
          break;
        case 'UPDATE_ROW':
          if (payload.data?.id) {
            const lead = mapUiLeadToFrontend(payload.data);
            setLeads((prev) => prev.map((item) => (item.id === lead.id ? { ...item, ...lead } : item)));
          }
          break;
        case 'DELETE_ROW':
          if (payload.data?.id) {
            setLeads((prev) => prev.filter((lead) => lead.id !== payload.data.id));
          } else if (payload.rowId) {
            setLeads((prev) => prev.filter((lead) => lead.id !== payload.rowId));
          }
          break;
        case 'BULK_DELETE_ROWS':
          if (Array.isArray(payload.rowIds)) {
            setLeads((prev) => prev.filter((lead) => !payload.rowIds.includes(lead.id)));
          }
          break;
        case 'REPLACE_TABLE':
          if (Array.isArray(payload.rows)) {
            setLeads(payload.rows.map(mapUiLeadToFrontend));
          } else {
            void handleRefresh();
          }
          break;
        case 'HIGHLIGHT_ROWS':
          if (Array.isArray(payload.highlightRows)) {
            setHighlightedRows(payload.highlightRows);
            setTimeout(() => setHighlightedRows([]), 3000);
          }
          break;
        case 'RESTORE_ROW':
          void handleRefresh();
          break;
        default:
          if (payload.type === 'REVERSE' && payload.action === 'DELETE_ROW' && payload.rowId) {
            setLeads((prev) => prev.filter((l) => l.id !== payload.rowId));
          }
          if (payload.type === 'REVERSE' && payload.action === 'BULK_DELETE_ROWS' && Array.isArray(payload.rowIds)) {
            setLeads((prev) => prev.filter((l) => !payload.rowIds.includes(l.id)));
          }
          break;
      }

      if (payload.metricsUpdate) {
        setMetrics((prev) => {
          const next = { ...prev };
          Object.entries(payload.metricsUpdate).forEach(([key, val]: [string, any]) => {
            if (val?.newTotal !== undefined) {
              next[key] = val.newTotal;
            } else if (val?.delta !== undefined) {
              next[key] = (next[key] || 0) + val.delta;
            }
          });
          return next;
        });
      }
    }

    window.addEventListener('aria-ui-payload', handleAriaPayload as EventListener);
    return () => window.removeEventListener('aria-ui-payload', handleAriaPayload as EventListener);
  }, []);

  return (
    <div className="w-full min-h-screen bg-[#F8FAFC] overflow-hidden text-slate-900">
      <Toaster
        position="top-right"
        richColors
        style={{ top: '5rem' }}
      />
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
            {canCreateLead && (
              <button
                type="button"
                onClick={() => setImportDrawerOpen(true)}
                className="bg-white hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all shadow-sm border border-slate-200 active:scale-95"
              >
                <Upload size={18} />
                <span>Import</span>
              </button>
            )}
            {canCreateLead && (
              <button
                type="button"
                onClick={() => setAddLeadDrawerOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all shadow-sm active:scale-95"
              >
                <Plus size={18} />
                <span>Add Lead</span>
              </button>
            )}
          </div>
        </header>

        {/* Scrollable Area */}
        <div className="flex-1 overflow-y-auto p-8">
          {/* Summary Cards */}
          <div className="grid grid-cols-5 gap-6 mb-8">
            <SummaryCard
              label="NEW LEADS"
              count={metrics.NEW_LEADS}
              color="blue"
              icon={<Plus size={16} />}
              active={statusFilter === 'New'}
              onClick={() => handleStatusCardClick('New')}
            />
            <SummaryCard
              label="CONTACTED"
              count={metrics.CONTACTED}
              color="yellow"
              icon={<Phone size={16} />}
              active={statusFilter === 'Contacted'}
              onClick={() => handleStatusCardClick('Contacted')}
            />
            <SummaryCard
              label="QUALIFIED"
              count={metrics.QUALIFIED}
              color="purple"
              icon={<Target size={16} />}
              active={statusFilter === 'Qualified'}
              onClick={() => handleStatusCardClick('Qualified')}
            />
            <SummaryCard
              label="CONVERTED"
              count={metrics.CONVERTED}
              color="green"
              icon={<CheckCircle size={16} />}
              active={statusFilter === 'Converted'}
              onClick={() => handleStatusCardClick('Converted')}
            />
            <SummaryCard
              label="LOST"
              count={metrics.LOST}
              color="gray"
              icon={<XCircle size={16} />}
              active={statusFilter === 'Lost'}
              onClick={() => handleStatusCardClick('Lost')}
            />
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
                  onChange={(e) => {
                    setCurrentPage(1);
                    setSearchQuery(e.target.value);
                  }}
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
                    onChange={(e) => {
                      setCurrentPage(1);
                      setStatusFilter(e.target.value as LeadStatus | 'All');
                    }}
                  >
                    <option value="All">All Statuses</option>
                    <option value="New">New</option>
                    <option value="Contacted">Contacted</option>
                    <option value="Qualified">Qualified</option>
                    <option value="Converted">Converted</option>
                    <option value="Lost">Lost</option>
                  </select>

                  <select
                    className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer hover:border-blue-300 transition-colors"
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

                  <select
                    className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer hover:border-blue-300 transition-colors"
                    value={recruiterFilter}
                    onChange={(e) => {
                      setCurrentPage(1);
                      setRecruiterFilter(e.target.value);
                    }}
                  >
                    <option value="">All Recruiters</option>
                    {teamMembers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </select>

                  <button 
                    className="text-sm text-slate-500 hover:text-red-600 font-medium px-2 py-1 flex items-center gap-1 transition-colors"
                    onClick={() => {
                    setCurrentPage(1);
                    setSearchQuery('');
                    setStatusFilter('All');
                    setSourceFilter('');
                    setRecruiterFilter('');
                  }}
                  >
                    <XCircle size={14} />
                    Clear
                  </button>
                </div>
              </div>
            </div>

            {/* Leads Table */}
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="no-scrollbar overflow-x-auto">
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
                        <th className="px-6 py-4 w-12">
                          <SelectionCheckbox
                            checked={allVisibleSelected}
                            onChange={toggleSelectAll}
                          />
                        </th>
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
                          <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                            No leads found
                          </td>
                        </tr>
                      ) : (
                        filteredLeads.map((lead) => (
                          <tr
                            key={lead.id}
                            className={`group transition-colors ${
                              highlightedRows.includes(lead.id)
                                ? 'bg-yellow-50 hover:bg-yellow-50'
                                : selectedLeadIds.includes(lead.id)
                                  ? 'bg-blue-50/80 hover:bg-blue-50/80'
                                  : selectedLeadId === lead.id
                                    ? 'bg-blue-50/50 hover:bg-blue-50/60'
                                    : 'hover:bg-blue-50/50'
                            }`}
                          >
                            <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                              <SelectionCheckbox
                                checked={selectedLeadIds.includes(lead.id)}
                                onChange={() => toggleLeadSelection(lead.id)}
                              />
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col">
                                <button
                                  type="button"
                                  className="text-left text-sm font-semibold text-slate-900 hover:text-blue-700 hover:underline"
                                  onClick={() => {
                                    setSelectedLeadDrawerMode('view');
                                    setSelectedLeadId(lead.id);
                                  }}
                                >
                                  {lead.companyName}
                                </button>
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
                                {canUpdateLead ? (
                                  <select
                                    className="px-3 py-1 rounded-full border border-slate-300 bg-white text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
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
                                ) : (
                                  <StatusTag status={lead.status} />
                                )}

                                {canUpdateLead && statusEdit.leadId === lead.id && (
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="text"
                                      placeholder="Add remark for this status change"
                                      className="flex-1 px-2 py-1 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                      value={statusEdit.remark}
                                      onChange={(e) =>
                                        setStatusEdit((prev) => ({
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
                              <LeadFollowUpTableCell
                                lastFollowUp={lead.lastFollowUp}
                                nextFollowUp={lead.nextFollowUp}
                              />
                            </td>
                            <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md"
                                  title="View Details"
                                  onClick={() => {
                                    setSelectedLeadDrawerMode('view');
                                    setSelectedLeadId(lead.id);
                                  }}
                                >
                                  <Eye size={18} />
                                </button>
                                <button
                                  className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-md"
                                  title="Edit Lead"
                                  onClick={() => {
                                    setSelectedLeadDrawerMode('edit');
                                    setSelectedLeadId(lead.id);
                                  }}
                                >
                                  <Pencil size={18} />
                                </button>
                                {canConvertLead && (
                                  <button
                                    className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-md"
                                    title="Convert to Client"
                                    onClick={() => handleConvert(lead.id)}
                                  >
                                    <UserPlus size={18} />
                                  </button>
                                )}
                                {canDeleteLead && (
                                  <button
                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md"
                                    title="Delete Lead"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeleteConfirmState({
                                        mode: 'single',
                                        leadId: lead.id,
                                        companyName: lead.companyName,
                                      });
                                    }}
                                  >
                                    <Trash2 size={18} />
                                  </button>
                                )}
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
            {!loading && !error && (
              <div className="mt-4 w-full">
                <PaginationAll
                  initialPage={currentPage}
                  totalPages={Math.ceil(totalEntries / PAGE_SIZE)}
                  totalCount={totalEntries}
                  pageSize={PAGE_SIZE}
                  itemLabel="leads"
                  onPageChange={setCurrentPage}
                />
              </div>
            )}
          </div>
        </div>

        {(selectedLead || addLeadDrawerOpen) && (
          <LeadDetailsDrawer
            lead={selectedLead ?? null}
            addLeadMode={addLeadDrawerOpen}
            initialMode={selectedLeadDrawerMode}
            onClose={() => {
              setSelectedLeadId(null);
              setSelectedLeadDrawerMode('view');
              setAddLeadDrawerOpen(false);
            }}
            onAddLead={async (_data, createdLead) => {
              try {
                if (createdLead) {
                  const mappedLead = mapBackendLeadToFrontend(createdLead);
                  mergeLeadOptimistically(mappedLead);
                } else {
                  await handleRefresh({ silent: true });
                }
                setStatusFilter('All');
                setSearchQuery('');
                setAddLeadDrawerOpen(false);
                toast.success('Lead created successfully');
              } catch (err: any) {
                console.error('Failed to add lead:', err);
              }
            }}
            onUpdateLead={async (updatedLead) => {
              try {
                if (updatedLead) {
                  replaceLeadOptimistically(mapBackendLeadToFrontend(updatedLead));
                }
                await handleRefresh({ silent: true });
                setSelectedLeadId(null);
                setSelectedLeadDrawerMode('view');
                toast.success('Lead updated successfully');
              } catch (err: any) {
                console.error('Failed to update lead:', err);
              }
            }}
            onConvert={canConvertLead ? handleConvert : undefined}
            onMarkLost={canUpdateLead ? handleMarkLost : undefined}
            onDeleteLead={canDeleteLead ? handleDeleteLead : undefined}
            onAssignLead={canUpdateLead ? async (leadId, formData) => {
              try {
                await apiUpdateLead(leadId, {
                  assignedToId: formData.assignTo || undefined,
                  priority: formData.priority,
                });
                toast.success('Lead assigned successfully');
                await handleRefresh({ silent: true });
              } catch (err: any) {
                console.error('Failed to assign lead:', err);
                toast.error(err.message || 'Failed to assign lead');
              }
            } : undefined}
          />
        )}
        {canCreateLead && (
          <LeadImportDrawer
            isOpen={importDrawerOpen}
            onClose={() => setImportDrawerOpen(false)}
            onImportComplete={async (result) => {
              setImportDrawerOpen(false);
              await handleRefresh({ silent: true });
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
                  ? `Leads imported successfully (${parts.join(', ')})`
                  : 'Leads imported successfully'
              );
            }}
          />
        )}
        {selectedLeadIds.length > 0 && (canUpdateLead || canDeleteLead) && (
          <div className="fixed bottom-6 left-1/2 z-40 w-[min(94vw,980px)] -translate-x-1/2 rounded-2xl border border-slate-800 bg-slate-950/95 px-4 py-3 text-white shadow-2xl shadow-slate-950/40 backdrop-blur">
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-300">
                  <BadgeCheck className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">
                    {selectedLeadIds.length} lead{selectedLeadIds.length > 1 ? 's' : ''} selected
                  </p>
                  <p className="truncate text-xs text-slate-400">Use bulk actions to update or remove the selected leads.</p>
                </div>
              </div>

              <div className="flex flex-shrink-0 items-center gap-2">
                {canUpdateLead && (
                  <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2">
                    <UserPlus className="w-4 h-4 text-slate-400" />
                    <select
                      value={bulkAssignedTo}
                      onChange={(e) => handleBulkLeadAssignChange(e.target.value)}
                      disabled={bulkActionLoading}
                      className="bg-transparent text-sm text-slate-100 outline-none"
                      style={{ WebkitTextFillColor: '#f1f5f9' }}
                    >
                      <option value="" className="text-slate-900 bg-white">Assign To</option>
                      {teamMembers.map((user) => (
                        <option key={user.id} value={user.id} className="text-slate-900 bg-white">
                          {user.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {canUpdateLead && (
                  <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2">
                    <BadgeCheck className="w-4 h-4 text-slate-400" />
                    <select
                      value={bulkStatus}
                      onChange={(e) => handleBulkLeadStatusChange(e.target.value)}
                      disabled={bulkActionLoading}
                      className="bg-transparent text-sm text-slate-100 outline-none"
                      style={{ WebkitTextFillColor: '#f1f5f9' }}
                    >
                      <option value="" className="text-slate-900 bg-white">Change Status</option>
                      <option value="New" className="text-slate-900 bg-white">New</option>
                      <option value="Contacted" className="text-slate-900 bg-white">Contacted</option>
                      <option value="Qualified" className="text-slate-900 bg-white">Qualified</option>
                      <option value="Converted" className="text-slate-900 bg-white">Converted</option>
                      <option value="Lost" className="text-slate-900 bg-white">Lost</option>
                    </select>
                  </div>
                )}

                {canDeleteLead && (
                  <button
                    type="button"
                    onClick={handleBulkLeadDelete}
                    disabled={bulkActionLoading}
                    className="flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                )}

                <button
                  type="button"
                  onClick={clearBulkSelection}
                  disabled={bulkActionLoading}
                  className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <X className="w-4 h-4" />
                  Clear
                </button>
              </div>
            </div>
          </div>
        )}
        {deleteConfirmState && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
            onClick={() => {
              if (!deleteConfirmLoading) {
                setDeleteConfirmState(null);
              }
            }}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-rose-300/40 bg-[#221218] p-5 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-sm font-medium text-white mb-6">
                {deleteConfirmState.mode === 'single'
                  ? `Are you sure you want to delete ${deleteConfirmState.companyName}?`
                  : `Are you sure you want to delete ${deleteConfirmState.count} selected lead${deleteConfirmState.count === 1 ? '' : 's'}?`}{' '}
                <span className="text-slate-300">This action cannot be undone.</span>
              </p>
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmState(null)}
                  disabled={deleteConfirmLoading}
                  className="rounded-full border border-rose-300/70 px-5 py-2 text-sm font-semibold text-rose-100 hover:bg-rose-300/10 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={deleteConfirmLoading}
                  className="rounded-full bg-rose-300 px-6 py-2 text-sm font-bold text-rose-900 hover:bg-rose-200 disabled:opacity-60"
                >
                  {deleteConfirmLoading ? 'Deleting...' : 'OK'}
                </button>
              </div>
            </div>
          </div>
        )}
        <AriaChat currentPage="leads" />
      </main>
    </div>
  );
}

// --- Helper Components ---

const SummaryCard = ({
  label,
  count,
  color,
  icon,
  active = false,
  onClick,
}: {
  label: string;
  count: number;
  color: string;
  icon: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}) => {
  const styles: any = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-700', iconBg: 'bg-blue-100', border: 'border-blue-100' },
    yellow: { bg: 'bg-yellow-50', text: 'text-yellow-700', iconBg: 'bg-yellow-100', border: 'border-yellow-100' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-700', iconBg: 'bg-purple-100', border: 'border-purple-100' },
    green: { bg: 'bg-green-50', text: 'text-green-700', iconBg: 'bg-green-100', border: 'border-green-100' },
    gray: { bg: 'bg-gray-50', text: 'text-gray-700', iconBg: 'bg-gray-100', border: 'border-gray-100' },
  };
  const s = styles[color] || styles.gray;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group w-full p-4 rounded-xl border shadow-sm text-left transition-all hover:shadow-md hover:-translate-y-0.5 cursor-pointer ${
        active ? `${s.bg} ${s.border} ring-2 ring-blue-500/20 shadow-md` : `${s.bg} ${s.border}`
      }`}
      aria-pressed={active}
    >
      <div className="flex items-center justify-between mb-2">
        <div className={`p-2 rounded-lg ${s.iconBg} ${s.text}`}>{icon}</div>
        <span className={`text-2xl font-bold ${s.text}`}>{count}</span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className={`text-xs font-bold uppercase tracking-wider opacity-70 ${s.text}`}>{label}</p>
        {active ? <span className={`text-[10px] font-bold uppercase tracking-[0.18em] ${s.text}`}>Active</span> : null}
      </div>
    </button>
  );
};

