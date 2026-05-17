'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import {
  Plus,
  Upload,
  Download,
  Search,
  Eye,
  Pencil,
  UserPlus,
  CheckCircle,
  XCircle,
  Phone,
  Target,
  Trash2,
  Check,
  BadgeCheck,
  X,
  Inbox,
} from 'lucide-react';
import { downloadCsv, csvDate } from '../../utils/csv';
import { formatDateDMY } from '../../utils/dateDisplay';
import { formatDirectorDisplay } from '../../constants/salutations';
import { formatContactListDisplay, normalizeContactList } from '../../lib/contact-channels';
import { AssigneeAvatars } from './AssigneeAvatars';
import { SourceCell } from './SourceCell';
import { LeadDetailsDrawer } from '../../components/drawers/LeadDetailsDrawer';
import { LeadImportDrawer } from '../../components/drawers/LeadImportDrawer';
import ModuleRecycleBinDrawer from '../../components/ModuleRecycleBinDrawer';
import PaginationAll from '../../components/PaginationAll';
import type { Lead, LeadSource, LeadStatus, Priority } from './types';
import {
  apiGetLeads,
  apiGetLead,
  apiUpdateLead,
  apiDeleteLead,
  apiConvertLeadToClient,
  type BackendLead,
  type BackendUser,
} from '../../lib/api';
import { getAllTeamMembersForAssign, teamMembersToBackendUsers } from '../../lib/api/teamApi';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Toaster, toast } from 'sonner';
import { splitDateTimeForDisplay } from '../../utils/formatLeadDateTime';
import { usePermissions } from '../../hooks/usePermissions';
import { usePageAutoRefresh } from '../../hooks/usePageAutoRefresh';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { SummaryCard, SummaryCardSkeleton, type SummaryCardColor } from '../../components/ui/SummaryCard';
import { TableBrandAvatar } from '../../components/ui/TableBrandAvatar';
import { TABLE_PAGE_SIZE_OPTIONS, type TablePageSize } from '../../constants/tablePagination';
import { requestError } from '../../lib/appDialog';

// Force CSR — every interactive bit on this tab is client-driven.
export const dynamic = 'force-dynamic';

const LEADS_FILTER_SELECT =
  'rounded-lg border border-indigo-100/90 bg-white/95 px-2.5 py-1.5 text-xs font-medium text-slate-800 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-300 cursor-pointer hover:border-indigo-200/90 hover:bg-indigo-50/40';

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
    <div className="flex flex-col gap-2 min-w-[9rem]">
      {last ? (
        <div className="rounded-xl bg-indigo-500/[0.06] px-2.5 py-2 ring-1 ring-indigo-500/10">
          <p className="text-[9px] font-bold text-indigo-600/90 uppercase tracking-[0.12em]">Last</p>
          <p className="text-xs font-semibold text-slate-800 leading-snug mt-0.5">{last.date}</p>
          <p className="text-[10px] text-slate-500 mt-1 tabular-nums">{last.time}</p>
        </div>
      ) : (
        <span className="inline-flex rounded-lg bg-slate-100/80 px-2 py-1 text-[11px] font-medium text-slate-400">—</span>
      )}
      {next && (
        <div className="rounded-xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 px-2.5 py-2 ring-1 ring-blue-400/15">
          <p className="text-[9px] font-bold text-blue-700 uppercase tracking-[0.12em]">Next</p>
          <p className="text-xs font-semibold text-blue-900 leading-snug mt-0.5">{next.date}</p>
          <p className="text-[10px] text-blue-700/90 mt-1 tabular-nums">{next.time}</p>
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
    New: 'bg-blue-500/10 text-blue-800 ring-1 ring-blue-500/20 shadow-sm shadow-blue-500/5',
    Contacted: 'bg-amber-500/10 text-amber-900 ring-1 ring-amber-500/20 shadow-sm',
    Qualified: 'bg-violet-500/10 text-violet-800 ring-1 ring-violet-500/20 shadow-sm',
    Converted: 'bg-emerald-500/10 text-emerald-800 ring-1 ring-emerald-500/20 shadow-sm',
    Lost: 'bg-slate-500/10 text-slate-700 ring-1 ring-slate-400/25',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-semibold tracking-wide ${styles[status]}`}>
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
    className={`flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded-md border-2 transition-all duration-200 ${
      checked
        ? 'border-indigo-600 bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-sm shadow-indigo-500/25'
        : 'border-slate-300/90 bg-white hover:border-indigo-400/60 hover:bg-indigo-50/50'
    }`}
  >
    {checked ? <Check className="h-3 w-3 text-white" strokeWidth={3} /> : null}
  </div>
);

// Helper function to map backend lead to frontend format
const VALID_LEAD_SOURCES: LeadSource[] = ['Website', 'LinkedIn', 'Email', 'Referral', 'Campaign'];

function mapBackendLeadToFrontend(backendLead: BackendLead): Lead {
  const rawSrc = backendLead.source;
  const source =
    rawSrc != null &&
    rawSrc !== '' &&
    VALID_LEAD_SOURCES.includes(rawSrc as LeadSource)
      ? (rawSrc as LeadSource)
      : undefined;

  return {
    id: backendLead.id,
    companyName: backendLead.companyName || '',
    type: backendLead.type,
    source,
    contactPerson: backendLead.contactPerson || '',
    directorSalutation: backendLead.directorSalutation || undefined,
    directorName: backendLead.directorName || undefined,
    email: backendLead.email || '',
    phone: backendLead.phone || '',
    emails: Array.isArray(backendLead.emails) && backendLead.emails.length > 0
      ? backendLead.emails
      : backendLead.email
        ? [backendLead.email]
        : [],
    phones: Array.isArray(backendLead.phones) && backendLead.phones.length > 0
      ? backendLead.phones
      : backendLead.phone
        ? [backendLead.phone]
        : [],
    status: backendLead.status,
    assignedTo: backendLead.assignedTo ? {
      id: backendLead.assignedTo.id,
      name: backendLead.assignedTo.name,
      avatar: backendLead.assignedTo.avatar || '',
    } : { name: 'Unassigned', avatar: '' },
    assignedToId: backendLead.assignedTo?.id,
    assignedToIds: Array.isArray(backendLead.assignedToIds) ? backendLead.assignedToIds : (backendLead.assignedTo?.id ? [backendLead.assignedTo.id] : []),
    assignedToUsers: Array.isArray(backendLead.assignedToUsers)
      ? backendLead.assignedToUsers.map((u) => ({ id: u.id, name: u.name, avatar: u.avatar || '', email: u.email }))
      : (backendLead.assignedTo ? [{ id: backendLead.assignedTo.id, name: backendLead.assignedTo.name, avatar: backendLead.assignedTo.avatar || '', email: backendLead.assignedTo.email }] : []),
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
    state: backendLead.state || undefined,
    latitude: typeof backendLead.latitude === 'number' ? backendLead.latitude : undefined,
    longitude: typeof backendLead.longitude === 'number' ? backendLead.longitude : undefined,
    campaignName: backendLead.campaignName || undefined,
    campaignLink: backendLead.campaignLink || undefined,
    referralName: backendLead.referralName || undefined,
    sourceWebsiteUrl: backendLead.sourceWebsiteUrl || undefined,
    sourceLinkedInUrl: backendLead.sourceLinkedInUrl || undefined,
    sourceEmail: backendLead.sourceEmail || undefined,
    otherDetails: Array.isArray(backendLead.otherDetails) ? backendLead.otherDetails : undefined,
    createdDate: backendLead.createdAt ? formatDateDMY(backendLead.createdAt) : undefined,
    agreementsFileName: backendLead.agreementsFileName || undefined,
    agreementsFileUrl: backendLead.agreementsFileUrl || undefined,
    agreementsUploadedAt: backendLead.agreementsUploadedAt || undefined,
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
  const router = useRouter();
  const pathname = usePathname();
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
  const [recycleBinDrawerOpen, setRecycleBinDrawerOpen] = useState(false);
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
  const [pageSize, setPageSize] = useState<TablePageSize>(10);
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
    // Only react when the URL parameter itself changes — without this guard,
    // closing the drawer (which clears `selectedLeadId`) used to re-fire and
    // immediately reopen the same lead.
    if (pendingDeepLinkLeadIdRef.current === leadId) {
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
  }, [leads, searchParams]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
        if (!token) return;
        const members = await getAllTeamMembersForAssign();
        setTeamMembers(teamMembersToBackendUsers(members));
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
          const total = INITIAL_LEADS.length;
          setTotalEntries(total);
          const offset = (currentPage - 1) * pageSize;
          setLeads(INITIAL_LEADS.slice(offset, offset + pageSize));
          setLoading(false);
          return;
        }
        
        // Ensure apiGetLeads is available
        if (typeof apiGetLeads !== 'function') {
          console.error('apiGetLeads is not a function');
          setError('API function not available');
          const total = INITIAL_LEADS.length;
          setTotalEntries(total);
          const offset = (currentPage - 1) * pageSize;
          setLeads(INITIAL_LEADS.slice(offset, offset + pageSize));
          setLoading(false);
          return;
        }
        
        const response = await apiGetLeads({
          status: statusFilter !== 'All' ? statusFilter : undefined,
          source: sourceFilter || undefined,
          assignedToId: recruiterFilter || undefined,
          search: searchQuery || undefined,
          page: currentPage,
          limit: pageSize,
        });
        
        // Backend returns: { success: true, message: "...", data: { data: [...], pagination: {...} } }
        // So response.data is { data: [...], pagination: {...} }
        const backendLeads = response.data ? extractBackendLeads(response.data) : [];
        const pagination = response.data?.pagination;
        
        if (!Array.isArray(backendLeads)) {
          console.error('backendLeads is not an array:', backendLeads);
          const total = INITIAL_LEADS.length;
          setTotalEntries(total);
          const offset = (currentPage - 1) * pageSize;
          setLeads(INITIAL_LEADS.slice(offset, offset + pageSize));
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
          const total = INITIAL_LEADS.length;
          setTotalEntries(total);
          const offset = (currentPage - 1) * pageSize;
          setLeads(INITIAL_LEADS.slice(offset, offset + pageSize));
          setError(null); // Don't show error for auth issues, just use mock data
        } else {
          setError(err.message || 'Failed to load leads');
          // Fallback to mock data on error
          const total = INITIAL_LEADS.length;
          setTotalEntries(total);
          const offset = (currentPage - 1) * pageSize;
          setLeads(INITIAL_LEADS.slice(offset, offset + pageSize));
        }
      } finally {
        setLoading(false);
      }
    };

    fetchLeads();
  }, [statusFilter, sourceFilter, searchQuery, currentPage, recruiterFilter, pageSize]);

  useEffect(() => {
    void loadLeadMetrics();
  }, []);

  // Reusable auto-refresh: polls while visible, refreshes on tab focus and on
  // `jobportal:leads-changed` (or jobs-changed). Same pattern as jobs page.
  const leadsAutoLoad = useCallback(
    async ({ silent }: { silent: boolean }) => {
      await handleRefresh({ silent });
    },
    // handleRefresh closure pulls latest filters via state — fine to omit deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  usePageAutoRefresh(leadsAutoLoad, {
    events: ['jobportal:leads-changed', 'jobportal:jobs-changed'],
  });

  const filteredLeads = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return leads.filter((lead) => {
      const matchesSearch =
        !query ||
        lead.companyName.toLowerCase().includes(query) ||
        lead.email.toLowerCase().includes(query) ||
        normalizeContactList(lead.emails, lead.email).some((value) => value.toLowerCase().includes(query)) ||
        normalizeContactList(lead.phones, lead.phone).some((value) => value.toLowerCase().includes(query)) ||
        lead.contactPerson.toLowerCase().includes(query) ||
        (lead.directorSalutation && String(lead.directorSalutation).toLowerCase().includes(query)) ||
        formatDirectorDisplay(lead.directorSalutation, lead.directorName || lead.contactPerson)
          .toLowerCase()
          .includes(query);
      const matchesRecruiter =
        !recruiterFilter
        || lead.assignedToId === recruiterFilter
        || lead.assignedTo?.id === recruiterFilter
        || (Array.isArray(lead.assignedToIds) && lead.assignedToIds.includes(recruiterFilter));
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

  /** Wide leads table: primary scroll hides its bar; synced dock shows a visible bar at the bottom of the view. */
  const leadsTableScrollRef = useRef<HTMLDivElement>(null);
  const leadsHScrollDockRef = useRef<HTMLDivElement>(null);
  const leadsHScrollProgrammatic = useRef(false);
  const [leadsHScrollSpanPx, setLeadsHScrollSpanPx] = useState(0);

  const measureLeadsHorizontalScroll = useCallback(() => {
    const el = leadsTableScrollRef.current;
    if (!el) {
      setLeadsHScrollSpanPx(0);
      return;
    }
    const sw = el.scrollWidth;
    const cw = el.clientWidth;
    const needs = sw > cw + 1;
    setLeadsHScrollSpanPx(needs ? sw : 0);
    const dock = leadsHScrollDockRef.current;
    if (dock && needs) {
      leadsHScrollProgrammatic.current = true;
      dock.scrollLeft = el.scrollLeft;
      leadsHScrollProgrammatic.current = false;
    }
  }, []);

  useLayoutEffect(() => {
    measureLeadsHorizontalScroll();
  }, [measureLeadsHorizontalScroll, loading, error, filteredLeads, currentPage]);

  useEffect(() => {
    const el = leadsTableScrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      measureLeadsHorizontalScroll();
    });
    ro.observe(el);
    window.addEventListener('resize', measureLeadsHorizontalScroll);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measureLeadsHorizontalScroll);
    };
  }, [measureLeadsHorizontalScroll]);

  const onLeadsTableHorizontalScroll = useCallback(() => {
    if (leadsHScrollProgrammatic.current) return;
    const el = leadsTableScrollRef.current;
    const dock = leadsHScrollDockRef.current;
    if (!el || !dock || leadsHScrollSpanPx <= 0) return;
    if (Math.abs(el.scrollLeft - dock.scrollLeft) < 1) return;
    leadsHScrollProgrammatic.current = true;
    dock.scrollLeft = el.scrollLeft;
    leadsHScrollProgrammatic.current = false;
  }, [leadsHScrollSpanPx]);

  const onLeadsHScrollDockScroll = useCallback(() => {
    if (leadsHScrollProgrammatic.current) return;
    const el = leadsTableScrollRef.current;
    const dock = leadsHScrollDockRef.current;
    if (!el || !dock || leadsHScrollSpanPx <= 0) return;
    if (Math.abs(el.scrollLeft - dock.scrollLeft) < 1) return;
    leadsHScrollProgrammatic.current = true;
    el.scrollLeft = dock.scrollLeft;
    leadsHScrollProgrammatic.current = false;
  }, [leadsHScrollSpanPx]);

  /** Export the currently filtered leads to a CSV that round-trips back into the importer. */
  const handleExportLeadsCsv = () => {
    if (filteredLeads.length === 0) {
      toast.message('No leads to export with current filters.');
      return;
    }
    downloadCsv<Lead>(
      `leads-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        { id: 'companyName', accessor: (l) => l.companyName },
        { id: 'directorSalutation', accessor: (l) => l.directorSalutation || '' },
        { id: 'contactPerson', accessor: (l) => formatDirectorDisplay(l.directorSalutation, l.directorName || l.contactPerson) },
        { id: 'email', accessor: (l) => l.email },
        { id: 'phone', accessor: (l) => l.phone },
        { id: 'type', accessor: (l) => l.type || '' },
        { id: 'source', accessor: (l) => l.source || '' },
        { id: 'status', accessor: (l) => l.status },
        { id: 'priority', accessor: (l) => l.priority || '' },
        { id: 'industry', accessor: (l) => l.industry || '' },
        { id: 'companySize', accessor: (l) => l.companySize || '' },
        { id: 'website', accessor: (l) => l.website || '' },
        { id: 'linkedIn', accessor: (l) => l.linkedIn || '' },
        { id: 'location', accessor: (l) => l.location || '' },
        { id: 'city', accessor: (l) => l.city || '' },
        { id: 'country', accessor: (l) => l.country || '' },
        { id: 'designation', accessor: (l) => l.designation || '' },
        { id: 'interestedNeeds', accessor: (l) => l.interestedNeeds || l.servicesNeeded || '' },
        { id: 'campaignName', accessor: (l) => l.campaignName || '' },
        { id: 'nextFollowUpDue', accessor: (l) => csvDate(l.nextFollowUp) },
        { id: 'notes', accessor: (l) => l.notes || '' },
        {
          id: 'assignedTo',
          accessor: (l) => Array.isArray(l.assignedToUsers) && l.assignedToUsers.length > 0
            ? l.assignedToUsers.map((u) => u.name).join('; ')
            : (l.assignedTo?.name || ''),
        },
        { id: 'lastFollowUp', accessor: (l) => csvDate(l.lastFollowUp) },
        { id: 'expectedBusinessValue', accessor: (l) => l.expectedBusinessValue || '' },
      ],
      filteredLeads,
    );
    toast.success(`Exported ${filteredLeads.length} lead${filteredLeads.length === 1 ? '' : 's'} to CSV`);
  };

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
    /** Status before the inline change (optimistic UI may already show `newStatus`). */
    previousStatus: LeadStatus | null;
  }>({
    leadId: null,
    newStatus: null,
    remark: '',
    previousStatus: null,
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
      previousStatus: previousLead?.status ?? null,
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
      if (
        statusEdit.newStatus === 'Converted' &&
        statusEdit.previousStatus &&
        statusEdit.previousStatus !== 'Converted'
      ) {
        toast.success(
          'Lead converted. A client record was created — open the Clients page to view it.',
          {
            action: {
              label: 'Open Clients',
              onClick: () => router.push('/client'),
            },
          }
        );
      }
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
      setStatusEdit({ leadId: null, newStatus: null, remark: '', previousStatus: null });
    }
  };

  const handleCancelStatusEdit = async () => {
    setStatusEdit({ leadId: null, newStatus: null, remark: '', previousStatus: null });
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
        assignedToId: recruiterFilter || undefined,
        search: searchQuery || undefined,
        page: currentPage,
        limit: pageSize,
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
      const newlyConvertedCount =
        updates.status === 'Converted'
          ? selectedLeadIds.filter((id) => {
              const row = leads.find((l) => l.id === id);
              return row && row.status !== 'Converted';
            }).length
          : 0;
      await Promise.all(selectedLeadIds.map((id) => apiUpdateLead(id, updates)));
      clearBulkSelection();
      await handleRefresh({ silent: true });
      if (newlyConvertedCount > 0) {
        toast.success(
          newlyConvertedCount === 1
            ? '1 lead was converted and added as a client.'
            : `${newlyConvertedCount} leads were converted and added as clients.`,
          {
            action: {
              label: 'Open Clients',
              onClick: () => router.push('/client'),
            },
          }
        );
      }
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
      : undefined;
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
      createdDate: base.createdAt ? formatDateDMY(base.createdAt) : undefined,
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
    <div className="w-full min-h-screen overflow-hidden text-slate-900">
      <Toaster
        position="top-right"
        richColors
        style={{ top: '5rem' }}
      />
      {/* Main Content */}
      <main className="flex flex-col overflow-hidden relative">
        {/* Header */}
        <header className="min-h-[4.5rem] flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3 shrink-0 border-b border-indigo-100/50 bg-white/80 backdrop-blur-md shadow-[inset_0_-1px_0_0_rgba(99,102,241,0.08)]">
          <div className="flex items-start gap-2.5 sm:gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 via-orange-500 to-amber-500 text-white shadow-lg shadow-rose-500/30 ring-1 ring-white/20">
              <Target className="h-5 w-5" strokeWidth={2.2} />
            </div>
            <div>
              <h1 className="text-xl sm:text-[1.35rem] font-bold tracking-tight text-slate-900 leading-tight">Leads</h1>
              <p className="text-xs text-slate-500 max-w-xl">Track, manage, and convert potential clients into active hiring partners</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canDeleteLead && (
              <button
                type="button"
                onClick={() => setRecycleBinDrawerOpen(true)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-indigo-200/80 bg-white text-indigo-700 shadow-[0_4px_14px_-4px_rgba(99,102,241,0.2)] transition-all hover:border-indigo-300 hover:bg-indigo-50/90 active:scale-[0.98]"
                title="Deleted leads"
              >
                <Inbox size={17} strokeWidth={2.25} />
              </button>
            )}
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
              onClick={handleExportLeadsCsv}
              className="bg-white hover:bg-indigo-50/90 text-indigo-900 px-3 py-2 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-all shadow-[0_4px_14px_-4px_rgba(99,102,241,0.25)] border border-indigo-200/70 hover:border-indigo-300 hover:shadow-[0_6px_20px_-4px_rgba(99,102,241,0.35)] active:scale-[0.98]"
              title="Export visible leads to CSV"
            >
              <Download size={16} className="text-indigo-600" strokeWidth={2.25} />
              <span>Export</span>
            </button>
            {canCreateLead && (
              <button
                type="button"
                onClick={() => setImportDrawerOpen(true)}
                className="bg-white hover:bg-indigo-50/90 text-indigo-900 px-3 py-2 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-all shadow-[0_4px_14px_-4px_rgba(99,102,241,0.25)] border border-indigo-200/70 hover:border-indigo-300 hover:shadow-[0_6px_20px_-4px_rgba(99,102,241,0.35)] active:scale-[0.98]"
              >
                <Upload size={16} className="text-indigo-600" strokeWidth={2.25} />
                <span>Import</span>
              </button>
            )}
            {canCreateLead && (
              <button
                type="button"
                onClick={() => setAddLeadDrawerOpen(true)}
                className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-700 hover:via-indigo-700 hover:to-violet-700 text-white px-3.5 py-2 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-all shadow-lg shadow-indigo-500/30 active:scale-[0.98]"
              >
                <Plus size={16} className="text-white" strokeWidth={2.5} />
                <span>Add Lead</span>
              </button>
            )}
          </div>
        </header>

        {/* Scrollable Area */}
        <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-5 sm:py-6 lg:px-6">
          {/* Summary Cards — show skeleton mirrors while the first fetch resolves. */}
          <div className="grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-3 lg:grid-cols-5 mb-5">
            {loading ? (
              (['blue', 'yellow', 'purple', 'green', 'gray'] as SummaryCardColor[]).map((c, i) => (
                <SummaryCardSkeleton key={i} color={c} />
              ))
            ) : (
              <>
                <SummaryCard
                  label="NEW LEADS"
                  count={metrics.NEW_LEADS}
                  color="blue"
                  icon={<Plus size={16} strokeWidth={2.35} />}
                  active={statusFilter === 'New'}
                  onClick={() => handleStatusCardClick('New')}
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
                  count={metrics.CONVERTED}
                  color="green"
                  icon={<CheckCircle size={16} strokeWidth={2.35} />}
                  active={statusFilter === 'Converted'}
                  onClick={() => handleStatusCardClick('Converted')}
                />
                <SummaryCard
                  label="LOST"
                  count={metrics.LOST}
                  color="gray"
                  icon={<XCircle size={16} strokeWidth={2.35} />}
                  active={statusFilter === 'Lost'}
                  onClick={() => handleStatusCardClick('Lost')}
                />
              </>
            )}
          </div>

          {/* Table Controls */}
          <div className="mb-4 overflow-hidden rounded-xl border border-indigo-100/60 bg-white/70 shadow-[0_12px_40px_-18px_rgba(59,130,246,0.18)] backdrop-blur-sm transition-shadow hover:shadow-[0_16px_48px_-14px_rgba(79,70,229,0.16)]">
            <div className="p-3 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-indigo-100/40 bg-gradient-to-br from-white via-indigo-50/25 to-violet-50/20">
              <div className="relative w-full lg:max-w-md lg:flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400" size={16} strokeWidth={2.25} />
                <input 
                  type="text" 
                  placeholder="Search company, email, or contact..." 
                  className="w-full h-9 pl-10 pr-3 bg-white/95 border border-indigo-100/90 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 transition-all [box-shadow:inset_0_1px_2px_rgba(15,23,42,0.04)]"
                  value={searchQuery}
                  onChange={(e) => {
                    setCurrentPage(1);
                    setSearchQuery(e.target.value);
                  }}
                />
              </div>
              
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <select 
                    className={LEADS_FILTER_SELECT}
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
                    className={LEADS_FILTER_SELECT}
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
                    className={LEADS_FILTER_SELECT}
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
                    type="button"
                    className="text-xs text-rose-600 hover:text-rose-700 font-semibold px-2 py-1.5 rounded-lg hover:bg-rose-50 flex items-center gap-1 transition-colors"
                    onClick={() => {
                    setCurrentPage(1);
                    setSearchQuery('');
                    setStatusFilter('All');
                    setSourceFilter('');
                    setRecruiterFilter('');
                  }}
                  >
                    <XCircle size={15} className="text-rose-500 shrink-0" strokeWidth={2.35} />
                    Clear
                  </button>
                </div>
              </div>
            </div>

            {/* Leads Table — horizontal scroll bar is shown in a sticky dock at the bottom of the view */}
            <div className="overflow-hidden flex flex-col">
              <div
                ref={leadsTableScrollRef}
                className="no-scrollbar overflow-x-auto overflow-y-visible"
                onScroll={onLeadsTableHorizontalScroll}
              >
                {loading && <TableSkeleton rows={8} columns={6} />}
                {error && !loading && (
                  <div className="p-10 text-center text-sm text-rose-600 font-medium">Error: {error}</div>
                )}
                {!loading && !error && (
                  <table id="leads-main-table" className="w-full min-w-[760px] text-left" aria-label="Leads">
                    <thead>
                      <tr className="bg-gradient-to-r from-slate-50/95 via-indigo-50/50 to-violet-50/40 border-b border-indigo-100/50 text-indigo-950/45 uppercase text-[9px] font-bold tracking-[0.12em]">
                        <th className="px-3 sm:px-4 py-2 w-10 first:pl-4">
                          <SelectionCheckbox
                            checked={allVisibleSelected}
                            onChange={toggleSelectAll}
                          />
                        </th>
                        <th className="px-3 sm:px-4 py-2">Lead</th>
                        <th className="px-3 sm:px-4 py-2">Source</th>
                        <th className="px-3 sm:px-4 py-2">Contact</th>
                        <th className="px-3 sm:px-4 py-2">Status</th>
                        <th className="px-3 sm:px-4 py-2">Assigned To</th>
                        <th className="px-3 sm:px-4 py-2">Last Follow-up</th>
                        <th className="px-3 sm:px-4 py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/80">
                      {filteredLeads.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-12 text-center">
                            <p className="text-xs font-medium text-slate-500">No leads match your filters</p>
                            <p className="mt-1 text-[11px] text-slate-400">Try adjusting search or clear filters</p>
                          </td>
                        </tr>
                      ) : (
                        filteredLeads.map((lead) => (
                          <tr
                            key={lead.id}
                            className={`group transition-colors duration-200 ${
                              highlightedRows.includes(lead.id)
                                ? 'bg-amber-50/90 hover:bg-amber-50'
                                : selectedLeadIds.includes(lead.id)
                                  ? 'bg-indigo-50/90 hover:bg-indigo-50/95'
                                  : selectedLeadId === lead.id
                                    ? 'bg-blue-50/70 hover:bg-blue-50/85'
                                    : 'even:bg-slate-50/35 hover:bg-indigo-50/45'
                            }`}
                          >
                            <td className="px-3 sm:px-4 py-2" onClick={(e) => e.stopPropagation()}>
                              <SelectionCheckbox
                                checked={selectedLeadIds.includes(lead.id)}
                                onChange={() => toggleLeadSelection(lead.id)}
                              />
                            </td>
                            <td className="px-3 sm:px-4 py-2">
                              <div className="flex items-start gap-2">
                                <span className="mt-0.5 shrink-0">
                                  <TableBrandAvatar
                                    name={lead.companyName}
                                    size="sm"
                                    showStatusDot={lead.status !== 'Lost'}
                                    statusDotTitle={`Lead: ${lead.status}`}
                                  />
                                </span>
                                <div className="min-w-0 flex flex-col gap-0.5">
                                <button
                                  type="button"
                                  className="text-left text-xs font-semibold text-slate-900 hover:text-indigo-700 transition-colors line-clamp-1"
                                  onClick={() => {
                                    setSelectedLeadDrawerMode('view');
                                    setSelectedLeadId(lead.id);
                                  }}
                                >
                                  {lead.companyName}
                                </button>
                                <span className="text-[10px] font-medium text-slate-500">{lead.type}</span>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 sm:px-4 py-2" onClick={(e) => e.stopPropagation()}>
                              <SourceCell lead={lead} />
                            </td>
                            <td className="px-3 sm:px-4 py-2">
                              <div className="flex flex-col gap-0.5">
                                <span className="text-xs font-medium text-slate-800">
                                  {formatDirectorDisplay(lead.directorSalutation, lead.directorName || lead.contactPerson)}
                                </span>
                                <span className="text-[10px] text-slate-500">
                                  {formatContactListDisplay(lead.emails, lead.email)}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 sm:px-4 py-2" onClick={(e) => e.stopPropagation()}>
                              <div className="flex flex-col gap-1.5">
                                {canUpdateLead ? (
                                  <select
                                    className="max-w-[10rem] rounded-full border-0 bg-slate-100/80 px-2 py-1 text-[11px] font-semibold text-slate-800 ring-1 ring-slate-200/90 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 cursor-pointer hover:bg-slate-100"
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
                            <td className="px-3 sm:px-4 py-2">
                              <AssigneeAvatars
                                lead={lead}
                              />
                            </td>
                            <td className="px-3 sm:px-4 py-2">
                              <LeadFollowUpTableCell
                                lastFollowUp={lead.lastFollowUp}
                                nextFollowUp={lead.nextFollowUp}
                              />
                            </td>
                            <td className="px-3 sm:px-4 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="inline-flex items-center justify-end gap-0.5 rounded-xl bg-slate-100/70 p-0.5 ring-1 ring-slate-200/60">
                                <button
                                  type="button"
                                  className="flex h-7 w-7 items-center justify-center rounded-lg text-blue-600 hover:bg-white hover:text-blue-700 hover:shadow-sm transition-all"
                                  title="View Details"
                                  onClick={() => {
                                    setSelectedLeadDrawerMode('view');
                                    setSelectedLeadId(lead.id);
                                  }}
                                >
                                  <Eye size={15} strokeWidth={2.35} />
                                </button>
                                <button
                                  type="button"
                                  className="flex h-7 w-7 items-center justify-center rounded-lg text-amber-600 hover:bg-white hover:text-amber-800 hover:shadow-sm transition-all"
                                  title="Edit Lead"
                                  onClick={() => {
                                    setSelectedLeadDrawerMode('edit');
                                    setSelectedLeadId(lead.id);
                                  }}
                                >
                                  <Pencil size={15} strokeWidth={2.35} />
                                </button>
                                {canConvertLead && (
                                  <button
                                    type="button"
                                    className="flex h-7 w-7 items-center justify-center rounded-lg text-emerald-600 hover:bg-white hover:text-emerald-800 hover:shadow-sm transition-all"
                                    title="Convert to Client"
                                    onClick={() => handleConvert(lead.id)}
                                  >
                                    <UserPlus size={15} strokeWidth={2.35} />
                                  </button>
                                )}
                                {canDeleteLead && (
                                  <button
                                    type="button"
                                    className="flex h-7 w-7 items-center justify-center rounded-lg text-rose-500 hover:bg-white hover:text-rose-800 hover:shadow-sm transition-all"
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
                                    <Trash2 size={15} strokeWidth={2.35} />
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
              {leadsHScrollSpanPx > 0 && !loading && !error && (
                <div className="leads-hscroll-dock-wrap sticky bottom-0 z-20 border-t border-indigo-100/60 bg-gradient-to-b from-white via-white to-indigo-50/30 shadow-[0_-10px_24px_-12px_rgba(49,46,129,0.14)]">
                  <div
                    ref={leadsHScrollDockRef}
                    role="region"
                    aria-label="Horizontal scroll for leads table"
                    aria-controls="leads-main-table"
                    tabIndex={0}
                    className="leads-hscroll-dock overflow-x-auto overflow-y-hidden px-1 pb-1 pt-0.5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500/35"
                    onScroll={onLeadsHScrollDockScroll}
                  >
                    <div className="h-2.5 min-h-[10px]" style={{ width: leadsHScrollSpanPx }} aria-hidden />
                  </div>
                </div>
              )}
            </div>
            {!loading && !error && (
              <div className="mt-0 w-full border-t border-indigo-100/50 bg-gradient-to-r from-slate-50/40 via-white to-indigo-50/25 px-3 py-2 sm:px-4">
                <PaginationAll
                  initialPage={currentPage}
                  totalPages={Math.max(1, Math.ceil(totalEntries / pageSize))}
                  totalCount={totalEntries}
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
              if (searchParams.get('leadId')) {
                const sp = new URLSearchParams(searchParams.toString());
                sp.delete('leadId');
                pendingDeepLinkLeadIdRef.current = null;
                const qs = sp.toString();
                router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
              }
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
                const mapped = updatedLead ? mapBackendLeadToFrontend(updatedLead) : null;
                const prevStatus = mapped ? leads.find((l) => l.id === mapped.id)?.status : undefined;
                if (mapped) {
                  replaceLeadOptimistically(mapped);
                }
                await handleRefresh({ silent: true });
                setSelectedLeadId(null);
                setSelectedLeadDrawerMode('view');
                if (
                  mapped?.status === 'Converted' &&
                  prevStatus &&
                  prevStatus !== 'Converted'
                ) {
                  toast.success(
                    'Lead converted. A client record was created — open the Clients page to view it.',
                    {
                      action: {
                        label: 'Open Clients',
                        onClick: () => router.push('/client'),
                      },
                    }
                  );
                } else {
                  toast.success('Lead updated successfully');
                }
              } catch (err: any) {
                console.error('Failed to update lead:', err);
              }
            }}
            onConvert={canConvertLead ? handleConvert : undefined}
            onMarkLost={canUpdateLead ? handleMarkLost : undefined}
            onDeleteLead={canDeleteLead ? handleDeleteLead : undefined}
            onAssignLead={canUpdateLead ? async (leadId, formData) => {
              try {
                const ids = formData.assignTos && formData.assignTos.length > 0
                  ? formData.assignTos
                  : (formData.assignTo ? [formData.assignTo] : []);
                await apiUpdateLead(leadId, {
                  assignedToId: ids[0] || undefined,
                  assignedToIds: ids,
                  priority: formData.priority,
                });
                toast.success(
                  ids.length > 1
                    ? `Lead assigned to ${ids.length} members`
                    : 'Lead assigned successfully'
                );
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
                  <p className="truncate text-xs text-slate-300/95">Use bulk actions to update or remove the selected leads.</p>
                </div>
              </div>

              <div className="flex flex-shrink-0 items-center gap-2">
                {canUpdateLead && (
                  <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2">
                    <UserPlus className="w-4 h-4 text-blue-500/85" />
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
                    <BadgeCheck className="w-4 h-4 text-emerald-500/85" />
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
        {canDeleteLead && (
          <ModuleRecycleBinDrawer
            isOpen={recycleBinDrawerOpen}
            onClose={() => setRecycleBinDrawerOpen(false)}
            kind="leads"
            onRestored={() => void handleRefresh({ silent: true })}
          />
        )}
      </main>
    </div>
  );
}
