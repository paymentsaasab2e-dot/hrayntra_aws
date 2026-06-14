'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import { SHOW_TABLE_ROW_EDIT_ICON } from '../../constants/tableUi';
import {
  Plus,
  Upload,
  Download,
  Search,
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
  Loader2,
  RefreshCcw,
} from 'lucide-react';
import {
  buildLeadSearchHaystack,
  buildLeadsListApiParams,
  LEAD_SMART_SEARCH_FIELD_GUIDE,
  LEADS_SMART_SEARCH_EXAMPLES,
  parseLeadsSmartSearchPrompt,
} from './leadsSmartSearch';
import {
  SmartSearchPromptPanel,
  SmartSearchToggleButton,
} from '../../components/smart-search/SmartSearchToolbar';
import { useSmartSearch } from '../../hooks/useSmartSearch';
import { mapAiToLeadsResult, parseSmartSearchWithAi } from '../../lib/smart-search/aiParser';
import { keywordChipClass } from '../../lib/smart-search/core';
import { downloadCsv } from '../../utils/csv';
import { buildLeadsCsvColumns, LEADS_EXPORT_COLUMNS } from '../../lib/leadsExportColumns';
import { ExportColumnsModal } from '../../components/export/ExportColumnsModal';
import { formatDateDMY } from '../../utils/dateDisplay';
import { extractAuditMeta } from '../../utils/auditMeta';
import { TableAuditColumnHeader, TableAuditCell } from '../../components/table/TableAuditCell';
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
  apiGetLeadStatusCatalog,
  apiUpdateLead,
  apiDeleteLead,
  apiConvertLeadToClient,
  apiSubmitLeadConversionRequest,
  apiGetLeadConversionCapabilities,
  apiGetLeadAssignableMembers,
  type BackendLead,
  type BackendUser,
  type ConvertLeadToClientData,
  type CrmAssignableMember,
} from '../../lib/api';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Toaster, toast } from 'sonner';
import { splitDateTimeForDisplay } from '../../utils/formatLeadDateTime';
import { usePermissions } from '../../hooks/usePermissions';
import { useLeadConversionStatuses } from '../../hooks/useLeadConversionStatuses';
import { canInitiateSentRequest } from '../../lib/sentRequestStatus';
import { usePageAutoRefresh } from '../../hooks/usePageAutoRefresh';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { SummaryCard, SummaryCardSkeleton, type SummaryCardColor } from '../../components/ui/SummaryCard';
import { TableBrandAvatar } from '../../components/ui/TableBrandAvatar';
import { TABLE_PAGE_SIZE_OPTIONS, type TablePageSize } from '../../constants/tablePagination';
import { requestError } from '../../lib/appDialog';
import type { CsvColumn } from '../../utils/csv';

// Force CSR — every interactive bit on this tab is client-driven.
export const dynamic = 'force-dynamic';

const LEADS_FILTER_SELECT =
  'rounded-lg border border-indigo-100/90 bg-white/95 px-2.5 py-1.5 text-xs font-medium text-slate-800 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-300 cursor-pointer hover:border-indigo-200/90 hover:bg-indigo-50/40';
const LEADS_DYNAMIC_COLUMNS_STORAGE_KEY = 'leads.dynamicColumns';

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
          <p className="text-xs font-semibold text-blue-900 leading-snug">{next.date}</p>
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
  const styles: Record<string, string> = {
    New: 'bg-blue-500/10 text-blue-800 ring-1 ring-blue-500/20 shadow-sm shadow-blue-500/5',
    Contacted: 'bg-amber-500/10 text-amber-900 ring-1 ring-amber-500/20 shadow-sm',
    Qualified: 'bg-violet-500/10 text-violet-800 ring-1 ring-violet-500/20 shadow-sm',
    Converted: 'bg-emerald-500/10 text-emerald-800 ring-1 ring-emerald-500/20 shadow-sm',
    Lost: 'bg-slate-500/10 text-slate-700 ring-1 ring-slate-400/25',
  };
  const badgeClass =
    styles[String(status || '').trim()] ||
    'bg-indigo-500/10 text-indigo-800 ring-1 ring-indigo-500/20 shadow-sm';

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-semibold tracking-wide ${badgeClass}`}>
      {status}
    </span>
  );
};

const DEFAULT_LEAD_STATUS_OPTIONS: LeadStatus[] = ['New', 'Contacted', 'Qualified', 'Converted', 'Lost'];

function mergeLeadStatusOptions(
  savedStatuses: string[] | null | undefined,
  currentStatuses: Array<string | null | undefined> = [],
) {
  const seen = new Set<string>();
  const merged: LeadStatus[] = [];
  const push = (value: string | null | undefined) => {
    const normalized = String(value || '').trim();
    if (!normalized) return;
    const key = normalized.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(normalized as LeadStatus);
  };

  DEFAULT_LEAD_STATUS_OPTIONS.forEach(push);
  (savedStatuses || []).forEach(push);
  currentStatuses.forEach(push);

  return merged;
}

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
    convertedToClientId: backendLead.convertedToClientId || backendLead.client?.id || undefined,
    convertedClientName: backendLead.client?.companyName || undefined,
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
    teamMemberDesignation: backendLead.teamMemberDesignation || undefined,
    teamMemberEmail: backendLead.teamMemberEmail || undefined,
    teamMemberPhone: backendLead.teamMemberPhone || undefined,
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
    agreementTotalPayment: backendLead.agreementTotalPayment || undefined,
    agreementLevel: backendLead.agreementLevel || undefined,
    agreementServiceChargePercent: backendLead.agreementServiceChargePercent || undefined,
    agreementContractValidity: backendLead.agreementContractValidity || undefined,
    agreementContractStartDate: backendLead.agreementContractStartDate || undefined,
    agreementContractEndDate: backendLead.agreementContractEndDate || undefined,
    agreementTimePeriod: backendLead.agreementTimePeriod || undefined,
    agreementAdvancePaymentPercent: backendLead.agreementAdvancePaymentPercent || undefined,
    agreementFreeReplacementValue:
      typeof backendLead.agreementFreeReplacementValue === 'number'
        ? backendLead.agreementFreeReplacementValue
        : undefined,
    agreementFreeReplacementUnit: backendLead.agreementFreeReplacementUnit || undefined,
    auditMeta: extractAuditMeta(backendLead as Record<string, unknown>),
  };
}

/** Client-side filters applied on top of API results (search + recruiter). */
function applyLeadClientFilters(
  list: Lead[],
  searchQuery: string,
  recruiterFilter: string,
  recruiterNameById: Map<string, string> = new Map(),
): Lead[] {
  const query = searchQuery.trim().toLowerCase();
  return list.filter((lead) => {
    const matchesSearch =
      !query || buildLeadSearchHaystack(lead, recruiterNameById).includes(query);
    const matchesRecruiter =
      !recruiterFilter ||
      lead.assignedToId === recruiterFilter ||
      lead.assignedTo?.id === recruiterFilter ||
      (Array.isArray(lead.assignedToIds) && lead.assignedToIds.includes(recruiterFilter));
    return matchesSearch && matchesRecruiter;
  });
}

function getLeadDynamicFieldValue(
  lead: Lead,
  label: string,
): string {
  if (!Array.isArray(lead.otherDetails)) return '';
  const target = String(label || '').trim().toLowerCase();
  const match = lead.otherDetails.find(
    (item) => String(item?.label || '').trim().toLowerCase() === target
  );
  return String(match?.value || '').trim();
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
  const canConvertLead = hasPermission('leads_update');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [selectedLeadDrawerMode, setSelectedLeadDrawerMode] = useState<'view' | 'edit'>('view');
  const [addLeadDrawerOpen, setAddLeadDrawerOpen] = useState(false);
  const [importDrawerOpen, setImportDrawerOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportLeads, setExportLeads] = useState<Lead[]>([]);
  const [exportLeadsLoading, setExportLeadsLoading] = useState(false);
  const [recycleBinDrawerOpen, setRecycleBinDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'All'>('All');
  const [leadStatusOptions, setLeadStatusOptions] = useState<LeadStatus[]>(DEFAULT_LEAD_STATUS_OPTIONS);
  const [sourceFilter, setSourceFilter] = useState('');
  const [recruiterFilter, setRecruiterFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [smartSearchLeadIds, setSmartSearchLeadIds] = useState<string[]>([]);
  const [selectedDynamicColumnLabels, setSelectedDynamicColumnLabels] = useState<string[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null); // null = not checked yet
  const [teamMembers, setTeamMembers] = useState<BackendUser[]>([]);
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkAssignedTo, setBulkAssignedTo] = useState('');
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [canDirectConvertLead, setCanDirectConvertLead] = useState(false);
  const { getStatusForLead, refresh: refreshConversionStatuses } = useLeadConversionStatuses();
  const [conversionRemarkModal, setConversionRemarkModal] = useState<{
    leadId: string;
    form?: {
      companyName: string;
      primaryContact: string;
      email: string;
      phone: string;
      industry: string;
      companySize: string;
      accountManager: string;
      createJobRequirement: boolean;
    };
  } | null>(null);
  const [conversionRemark, setConversionRemark] = useState('');
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
  const availableDynamicColumnLabels = useMemo(() => {
    const seen = new Set<string>();
    const labels: string[] = [];
    for (const lead of leads) {
      for (const item of lead.otherDetails || []) {
        const label = String(item?.label || '').trim();
        const key = label.toLowerCase();
        if (!label || seen.has(key)) continue;
        seen.add(key);
        labels.push(label);
      }
    }
    return labels.sort((a, b) => a.localeCompare(b));
  }, [leads]);

  // Check authentication status on client side only
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    setIsAuthenticated(!!token);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LEADS_DYNAMIC_COLUMNS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setSelectedDynamicColumnLabels(
          parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        );
      }
    } catch {
      /* ignore invalid persisted dynamic columns */
    }
  }, []);

  useEffect(() => {
    setSelectedDynamicColumnLabels((previous) =>
      previous.filter((label) =>
        availableDynamicColumnLabels.some((option) => option.toLowerCase() === label.toLowerCase())
      )
    );
  }, [availableDynamicColumnLabels]);

  useEffect(() => {
    localStorage.setItem(
      LEADS_DYNAMIC_COLUMNS_STORAGE_KEY,
      JSON.stringify(selectedDynamicColumnLabels)
    );
  }, [selectedDynamicColumnLabels]);

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
        const response = await apiGetLeadAssignableMembers();
        const members = Array.isArray(response.data) ? response.data : [];
        setTeamMembers(
          members.map((m: CrmAssignableMember) => ({
            id: m.id,
            name: m.name || `${m.firstName || ''} ${m.lastName || ''}`.trim() || m.email || 'User',
            email: m.email,
          })),
        );
      } catch (err) {
        console.error('Failed to fetch users for bulk lead assignment:', err);
      }
    };

    const fetchConversionCapabilities = async () => {
      try {
        const response = await apiGetLeadConversionCapabilities();
        setCanDirectConvertLead(Boolean(response.data?.canDirectConvert));
      } catch {
        setCanDirectConvertLead(false);
      }
    };

    void fetchUsers();
    void fetchConversionCapabilities();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchLeadStatusCatalog = async () => {
      try {
        const response = await apiGetLeadStatusCatalog();
        if (cancelled) return;
        setLeadStatusOptions(
          mergeLeadStatusOptions(
            response?.data?.statuses,
            leads.map((lead) => lead.status),
          ),
        );
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to load lead status catalog:', err);
        setLeadStatusOptions(
          mergeLeadStatusOptions(undefined, leads.map((lead) => lead.status)),
        );
      }
    };

    void fetchLeadStatusCatalog();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setLeadStatusOptions((current) =>
      mergeLeadStatusOptions(current as string[], leads.map((lead) => lead.status)),
    );
  }, [leads]);

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
        
        const response = await apiGetLeads(
          buildLeadsListApiParams({
            statusFilter,
            sourceFilter,
            recruiterFilter,
            priorityFilter,
            searchQuery,
            matchingLeadIds: smartSearchLeadIds,
            currentPage,
            pageSize,
          }),
        );
        
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
  }, [statusFilter, sourceFilter, searchQuery, currentPage, recruiterFilter, priorityFilter, smartSearchLeadIds, pageSize]);

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

  const recruiterNameById = useMemo(
    () => new Map(teamMembers.map((member) => [member.id, member.name])),
    [teamMembers],
  );

  const smartSearchRecruiters = useMemo(
    () => teamMembers.map((member) => ({ id: member.id, name: member.name })),
    [teamMembers],
  );

  const leadsSmartSearch = useSmartSearch({
    parsePrompt: (text) =>
      parseLeadsSmartSearchPrompt(text, {
        statuses: leadStatusOptions,
        recruiters: smartSearchRecruiters,
      }),
    parsePromptWithAi: (text) =>
      parseSmartSearchWithAi('leads', text, { useTenantDatabase: true }, mapAiToLeadsResult),
    applyParsed: (parsed) => {
      setCurrentPage(1);
      setStatusFilter((parsed.status as LeadStatus | null) ?? 'All');
      setSourceFilter(parsed.source ?? '');
      setRecruiterFilter(parsed.recruiterId ?? '');
      setPriorityFilter(parsed.priority ?? '');
      setSearchQuery(parsed.searchText);
      setSmartSearchLeadIds(
        parsed.matchingLeadIds && parsed.matchingLeadIds.length > 0 ? parsed.matchingLeadIds : [],
      );
    },
    onRemoveKeyword: (removed, remaining) => {
      setCurrentPage(1);
      if (removed.kind === 'status') setStatusFilter('All');
      if (removed.kind === 'source') setSourceFilter('');
      if (removed.kind === 'recruiter') setRecruiterFilter('');
      if (removed.kind === 'priority') setPriorityFilter('');
      if (removed.kind === 'text') {
        setSearchQuery(
          remaining
            .filter((item) => item.kind === 'text')
            .map((item) => item.value)
            .join(' '),
        );
      }
    },
    examples: LEADS_SMART_SEARCH_EXAMPLES,
  });

  // Rows come from GET /leads — filters (status, source, recruiter, priority, search) run in the database.
  const filteredLeads = leads;

  const hasActiveTableFilters =
    statusFilter !== 'All' ||
    !!sourceFilter ||
    !!recruiterFilter ||
    !!priorityFilter ||
    smartSearchLeadIds.length > 0 ||
    !!searchQuery.trim() ||
    leadsSmartSearch.activeKeywords.length > 0;

  const activeFilterChips = useMemo(() => {
    const chips = leadsSmartSearch.activeKeywords.map((keyword) => ({
      id: keyword.id,
      label: keyword.label,
      kind: keyword.kind,
      onRemove: () => leadsSmartSearch.removeKeyword(keyword.id),
    }));

    if (
      statusFilter !== 'All' &&
      !chips.some((chip) => chip.kind === 'status' && chip.label === statusFilter)
    ) {
      chips.unshift({
        id: 'manual-status',
        label: statusFilter,
        kind: 'status' as const,
        onRemove: () => {
          setCurrentPage(1);
          setStatusFilter('All');
        },
      });
    }

    if (
      sourceFilter &&
      !chips.some((chip) => chip.kind === 'source' && chip.label === sourceFilter)
    ) {
      chips.push({
        id: 'manual-source',
        label: sourceFilter,
        kind: 'source' as const,
        onRemove: () => {
          setCurrentPage(1);
          setSourceFilter('');
        },
      });
    }

    if (
      recruiterFilter &&
      !chips.some((chip) => chip.kind === 'recruiter' && chip.id.includes(recruiterFilter))
    ) {
      const recruiterName = recruiterNameById.get(recruiterFilter) || 'Recruiter';
      chips.push({
        id: 'manual-recruiter',
        label: recruiterName,
        kind: 'recruiter' as const,
        onRemove: () => {
          setCurrentPage(1);
          setRecruiterFilter('');
        },
      });
    }

    if (
      priorityFilter &&
      !chips.some((chip) => chip.kind === 'priority' && chip.label.toLowerCase().includes(priorityFilter.toLowerCase()))
    ) {
      chips.push({
        id: 'manual-priority',
        label: `${priorityFilter} interest`,
        kind: 'priority' as const,
        onRemove: () => {
          setCurrentPage(1);
          setPriorityFilter('');
        },
      });
    }

    if (
      searchQuery.trim() &&
      !leadsSmartSearch.activeKeywords.some(
        (item) => item.kind === 'text' && item.value === searchQuery.trim(),
      )
    ) {
      chips.push({
        id: 'manual-search',
        label: searchQuery.trim(),
        kind: 'text' as const,
        onRemove: () => {
          setCurrentPage(1);
          setSearchQuery('');
        },
      });
    }

    return chips;
  }, [
    leadsSmartSearch.activeKeywords,
    leadsSmartSearch.removeKeyword,
    statusFilter,
    sourceFilter,
    recruiterFilter,
    priorityFilter,
    searchQuery,
    recruiterNameById,
  ]);

  const clearAllTableFilters = useCallback(() => {
    setCurrentPage(1);
    setSearchQuery('');
    leadsSmartSearch.clearSmartSearch();
    setStatusFilter('All');
    setSourceFilter('');
    setRecruiterFilter('');
    setPriorityFilter('');
    setSmartSearchLeadIds([]);
    setSelectedDynamicColumnLabels([]);
  }, [leadsSmartSearch]);

  const fetchAllLeadsForExport = useCallback(async (): Promise<Lead[]> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (!token) {
      return applyLeadClientFilters(INITIAL_LEADS, searchQuery, recruiterFilter, recruiterNameById);
    }

    const batchSize = 500;
    let page = 1;
    let totalPages = 1;
    let collected: Lead[] = [];

    while (page <= totalPages) {
      const response = await apiGetLeads(
        buildLeadsListApiParams({
          statusFilter,
          sourceFilter,
          recruiterFilter,
          priorityFilter,
          searchQuery,
          matchingLeadIds: smartSearchLeadIds,
          currentPage: page,
          pageSize: batchSize,
        }),
      );

      const backendLeads = response.data ? extractBackendLeads(response.data) : [];
      collected = [...collected, ...backendLeads.map(mapBackendLeadToFrontend)];

      const pagination = !Array.isArray(response.data) ? response.data?.pagination : undefined;
      totalPages =
        pagination?.totalPages || Math.max(1, Math.ceil((pagination?.total || collected.length) / batchSize));

      if (backendLeads.length < batchSize) break;
      page += 1;
    }

    return collected;
  }, [statusFilter, sourceFilter, recruiterFilter, priorityFilter, smartSearchLeadIds, searchQuery]);

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

  const openLeadDrawerWithFreshData = useCallback(
    async (lead: Lead, mode: 'view' | 'edit') => {
      try {
        const response = await apiGetLead(lead.id);
        const backendLead = (response as any).data?.data || (response as any).data || response;
        const mappedLead = backendLead ? mapBackendLeadToFrontend(backendLead) : lead;
        if (leads.some((item) => item.id === mappedLead.id)) {
          replaceLeadOptimistically(mappedLead);
        } else {
          mergeLeadOptimistically(mappedLead);
        }
        setSelectedLeadId(mappedLead.id);
        setSelectedLeadDrawerMode(mode);
      } catch (error) {
        console.error(`Failed to fetch lead ${lead.id} before opening drawer:`, error);
        setSelectedLeadId(lead.id);
        setSelectedLeadDrawerMode(mode);
      }
    },
    [leads, mergeLeadOptimistically, replaceLeadOptimistically]
  );

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

  const openExportModal = async () => {
    setExportLeadsLoading(true);
    setExportModalOpen(true);
    try {
      const all = await fetchAllLeadsForExport();
      setExportLeads(all);
      if (all.length === 0) {
        toast.message('No leads to export with current filters.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load leads for export';
      toast.error(message);
      setExportModalOpen(false);
      setExportLeads([]);
    } finally {
      setExportLeadsLoading(false);
    }
  };

  const handleExportLeadsCsv = (selectedColumnIds: string[]) => {
    const baseColumns = buildLeadsCsvColumns(
      selectedColumnIds.filter((id) => !id.startsWith('dynamic:'))
    );
    const selectedDynamic = exportColumns
      .filter((col) => col.id.startsWith('dynamic:') && selectedColumnIds.includes(col.id))
      .map(({ id, accessor }) => ({ id, accessor })) as CsvColumn<Lead>[];
    const columns = [...baseColumns, ...selectedDynamic];
    if (columns.length === 0) {
      toast.message('Select at least one column to export.');
      return;
    }
    const rowsToExport = exportLeads.length > 0 ? exportLeads : filteredLeads;
    downloadCsv<Lead>(
      `leads-${new Date().toISOString().slice(0, 10)}.csv`,
      columns,
      rowsToExport,
    );
    toast.success(`Exported ${rowsToExport.length} lead${rowsToExport.length === 1 ? '' : 's'} to CSV`);
  };

  const exportDynamicColumns = useMemo(() => {
    const source = exportLeads.length > 0 ? exportLeads : filteredLeads;
    const seen = new Set<string>();
    const labels: string[] = [];
    for (const lead of source) {
      for (const item of lead.otherDetails || []) {
        const label = String(item?.label || '').trim();
        if (!label) continue;
        const key = label.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        labels.push(label);
      }
    }
    labels.sort((a, b) => a.localeCompare(b));
    return labels.map((label) => ({
      id: `dynamic:${label}`,
      label,
      accessor: (l: Lead) => {
        if (!Array.isArray(l.otherDetails)) return '';
        const target = label.trim().toLowerCase();
        const match = l.otherDetails.find(
          (item) => String(item?.label || '').trim().toLowerCase() === target
        );
        return String(match?.value || '').trim();
      },
    }));
  }, [exportLeads, filteredLeads]);

  const exportColumns = useMemo(
    () => [...LEADS_EXPORT_COLUMNS, ...exportDynamicColumns],
    [exportDynamicColumns]
  );

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

  const handleConvert = async (
    id: string,
    form?: {
      companyName: string;
      primaryContact: string;
      email: string;
      phone: string;
      industry: string;
      companySize: string;
      accountManager: string;
      createJobRequirement: boolean;
    },
    requestNote?: string,
  ) => {
    try {
      const lead = leads.find(l => l.id === id);
      if (!lead) return;

      if (lead.status === 'Converted' || lead.convertedToClientId) {
        const clientLabel = lead.convertedClientName ? ` (${lead.convertedClientName})` : '';
        void requestError(
          `This lead has already been converted to a client${clientLabel}. A duplicate client will not be created.`,
        );
        return;
      }

      if (!canDirectConvertLead && !String(requestNote || '').trim()) {
        setConversionRemarkModal({ leadId: id, form });
        setConversionRemark('');
        return;
      }

      const resolvedAssignedToId =
        (form?.accountManager
          ? teamMembers.find((member) => member.name === form.accountManager)?.id
          : undefined) ||
        lead.assignedToId ||
        lead.assignedTo?.id;

      const locationParts = [lead.city, lead.state, lead.country].filter(Boolean);
      const directorName =
        form?.primaryContact?.trim() || lead.directorName || lead.contactPerson || '';
      const convertData: ConvertLeadToClientData = {
        companyName: form?.companyName?.trim() || lead.companyName,
        industry: form?.industry || lead.industry,
        companySize: form?.companySize || lead.companySize,
        website: lead.website,
        address: lead.location,
        linkedin: lead.linkedIn,
        location: lead.location || locationParts.join(', ') || undefined,
        city: lead.city,
        state: lead.state,
        country: lead.country,
        latitude: typeof lead.latitude === 'number' ? lead.latitude : undefined,
        longitude: typeof lead.longitude === 'number' ? lead.longitude : undefined,
        hiringLocations: locationParts.join(', ') || lead.city || lead.country,
        priority: lead.priority
          ? lead.priority.charAt(0) + lead.priority.slice(1).toLowerCase()
          : undefined,
        servicesNeeded: lead.servicesNeeded || lead.interestedNeeds,
        expectedBusinessValue: lead.expectedBusinessValue || lead.notes,
        assignedToId: resolvedAssignedToId,
        directorSalutation: lead.directorSalutation,
        directorName: directorName || undefined,
        contactPerson: directorName || undefined,
        email: form?.email?.trim() || lead.email,
        phone: form?.phone?.trim() || lead.phone,
        emails: lead.emails,
        phones: lead.phones,
        teamMemberDesignation: lead.teamMemberDesignation || null,
        teamMemberEmail: lead.teamMemberEmail || null,
        teamMemberPhone: lead.teamMemberPhone || null,
        otherDetails: lead.otherDetails,
        nextFollowUpDue: lead.nextFollowUp || null,
        agreementsFileName: lead.agreementsFileName || null,
        agreementsFileUrl: lead.agreementsFileUrl || null,
        agreementsUploadedAt: lead.agreementsUploadedAt || null,
        agreementLevel: lead.agreementLevel || null,
        agreementServiceChargePercent: lead.agreementServiceChargePercent || null,
        agreementContractValidity: lead.agreementContractValidity || null,
        agreementContractStartDate: lead.agreementContractStartDate || null,
        agreementContractEndDate: lead.agreementContractEndDate || null,
        agreementTimePeriod: lead.agreementTimePeriod || null,
        agreementAdvancePaymentPercent: lead.agreementAdvancePaymentPercent || null,
        agreementFreeReplacementValue: lead.agreementFreeReplacementValue ?? null,
        agreementFreeReplacementUnit: lead.agreementFreeReplacementUnit || null,
        requestNote: requestNote?.trim() || undefined,
      };

      const response = canDirectConvertLead
        ? await apiConvertLeadToClient(id, convertData)
        : await apiSubmitLeadConversionRequest(id, convertData);
      
      // Log the response
      console.log('\n=== CONVERSION RESPONSE (Frontend) ===');
      console.log(JSON.stringify(response, null, 2));
      
      const convertedClient = canDirectConvertLead ? response.data : null;

      if (!canDirectConvertLead) {
        toast.success('Conversion request sent to your department head for approval');
        void refreshConversionStatuses();
        setConversionRemarkModal(null);
        setConversionRemark('');
        return;
      }

      // Update local state
      setLeads(prev => prev.map(l => l.id === id ? {
        ...l,
        status: 'Converted' as LeadStatus,
        convertedToClientId: convertedClient?.id || l.convertedToClientId,
        convertedClientName: convertedClient?.companyName || l.convertedClientName,
      } : l));
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
    const previousLead = leads.find((lead) => lead.id === id);
    if (
      newStatus === 'Converted' &&
      previousLead &&
      (previousLead.status === 'Converted' || previousLead.convertedToClientId)
    ) {
      const clientLabel = previousLead.convertedClientName ? ` (${previousLead.convertedClientName})` : '';
      void requestError(
        `This lead has already been converted to a client${clientLabel}. A duplicate client will not be created.`,
      );
      return;
    }
    // Optimistically update UI
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
      const response = await apiGetLeads(
        buildLeadsListApiParams({
          statusFilter,
          sourceFilter,
          recruiterFilter,
          priorityFilter,
          searchQuery,
          matchingLeadIds: smartSearchLeadIds,
          currentPage,
          pageSize,
        }),
      );
      
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
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 via-orange-500 to-amber-500 text-white shadow-lg shadow-rose-500/30 ring-1 ring-white/20">
              <Target className="h-5 w-5" strokeWidth={2.2} />
            </div>
            <div>
              <h1 className="text-xl sm:text-[1.35rem] font-bold tracking-tight text-slate-900 leading-none">Leads</h1>
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
              onClick={openExportModal}
              className="bg-white hover:bg-indigo-50/90 text-indigo-900 px-3 py-2 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-all shadow-[0_4px_14px_-4px_rgba(99,102,241,0.25)] border border-indigo-200/70 hover:border-indigo-300 hover:shadow-[0_6px_20px_-4px_rgba(99,102,241,0.35)] active:scale-[0.98]"
              title="Choose columns and export visible leads to CSV"
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
                <SmartSearchToggleButton
                  open={leadsSmartSearch.open}
                  onToggle={() => leadsSmartSearch.setOpen((value) => !value)}
                />
                <div className="flex flex-wrap items-center gap-1.5">
                  <select 
                    className={LEADS_FILTER_SELECT}
                    value={statusFilter}
                    onChange={(e) => {
                      setCurrentPage(1);
                      setStatusFilter(e.target.value as LeadStatus | 'All');
                    }}
                  >
                    <option value="All">All Status</option>
                    {leadStatusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
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

                  {availableDynamicColumnLabels.length > 0 ? (
                    <details className="relative">
                      <summary className={`${LEADS_FILTER_SELECT} list-none`}>
                        Dynamic Columns
                        {selectedDynamicColumnLabels.length > 0 ? ` (${selectedDynamicColumnLabels.length})` : ''}
                      </summary>
                      <div className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-indigo-100/90 bg-white p-3 shadow-xl">
                        <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          Show in table
                        </p>
                        <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                          {availableDynamicColumnLabels.map((label) => {
                            const checked = selectedDynamicColumnLabels.some(
                              (item) => item.toLowerCase() === label.toLowerCase()
                            );
                            return (
                              <label key={label} className="flex items-center gap-2 text-xs text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() =>
                                    setSelectedDynamicColumnLabels((previous) =>
                                      checked
                                        ? previous.filter((item) => item.toLowerCase() !== label.toLowerCase())
                                        : [...previous, label]
                                    )
                                  }
                                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/25"
                                />
                                <span className="truncate">{label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </details>
                  ) : null}

                  <button 
                    type="button"
                    className="text-xs text-rose-600 hover:text-rose-700 font-semibold px-2 py-1.5 rounded-lg hover:bg-rose-50 flex items-center gap-1 transition-colors"
                    onClick={() => {
                    clearAllTableFilters();
                    leadsSmartSearch.setOpen(false);
                  }}
                  >
                    <XCircle size={15} className="text-rose-500 shrink-0" strokeWidth={2.35} />
                    Clear
                  </button>
                </div>
              </div>
            </div>

            {leadsSmartSearch.open ? (
              <SmartSearchPromptPanel
                prompt={leadsSmartSearch.prompt}
                onPromptChange={leadsSmartSearch.setPrompt}
                onApply={leadsSmartSearch.handleApply}
                previewKeywords={leadsSmartSearch.previewKeywords}
                examples={leadsSmartSearch.examples}
                onExampleClick={leadsSmartSearch.handleExample}
                entityLabel="leads"
                applying={leadsSmartSearch.applying}
                placeholder={`Searches your lead database by ${LEAD_SMART_SEARCH_FIELD_GUIDE} — e.g. high interest technology leads in California company Acme`}
              />
            ) : null}

            {hasActiveTableFilters ? (
              <div className="flex flex-wrap items-center gap-2 border-b border-indigo-100/40 bg-slate-50/60 px-3 py-2 sm:px-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Active keywords
                </span>
                {activeFilterChips.map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={chip.onRemove}
                    className={`inline-flex items-center gap-1 rounded-full border pl-2.5 pr-1.5 py-0.5 text-[11px] font-medium shadow-sm transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-800 ${keywordChipClass(chip.kind)}`}
                    title={`Remove keyword ${chip.label}`}
                  >
                    <span className="max-w-[200px] truncate">{chip.label}</span>
                    <X size={12} strokeWidth={2.5} className="shrink-0 opacity-60" />
                  </button>
                ))}
                <button
                  type="button"
                  onClick={clearAllTableFilters}
                  className="text-[11px] font-semibold text-rose-600 hover:text-rose-700"
                >
                  Clear all
                </button>
                {!loading && !error ? (
                  <span className="ml-auto text-[11px] font-medium text-slate-500">
                    {totalEntries} matching lead{totalEntries === 1 ? '' : 's'} in database
                  </span>
                ) : null}
              </div>
            ) : null}

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
                        <th className="px-3 sm:px-4 py-2 min-w-[11rem]">Lead</th>
                        <th className="px-3 sm:px-4 py-2">Source</th>
                        <th className="px-3 sm:px-4 py-2">Contact</th>
                        {selectedDynamicColumnLabels.map((label) => (
                          <th key={label} className="px-3 sm:px-4 py-2">
                            {label}
                          </th>
                        ))}
                        <th className="px-3 sm:px-4 py-2">Status</th>
                        <th className="px-3 sm:px-4 py-2">Assigned To</th>
                        <th className="px-3 sm:px-4 py-2">Last Follow-up</th>
                        <TableAuditColumnHeader />
                        <th className="px-3 sm:px-4 py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/80">
                      {filteredLeads.length === 0 ? (
                        <tr>
                          <td colSpan={9 + selectedDynamicColumnLabels.length} className="px-4 py-12 text-center">
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
                            <td className="px-3 sm:px-4 py-2 min-w-[11rem] align-middle">
                              <div className="flex items-center gap-2">
                                <span className="shrink-0">
                                  <TableBrandAvatar
                                    name={lead.companyName}
                                    size="sm"
                                    showStatusDot={lead.status !== 'Lost'}
                                    statusDotTitle={`Lead: ${lead.status}`}
                                  />
                                </span>
                                <div className="flex min-w-[8rem] flex-col justify-center gap-0.5">
                                <button
                                  type="button"
                                  className="text-left text-xs font-semibold leading-snug text-slate-900 hover:text-indigo-700 transition-colors whitespace-normal break-words"
                                  onClick={() => {
                                    void openLeadDrawerWithFreshData(lead, 'view');
                                  }}
                                >
                                  {lead.companyName}
                                </button>
                                {(() => {
                                  const conversion = getStatusForLead(lead.id);
                                  if (conversion.status === 'pending') {
                                    return (
                                      <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-amber-200/80">
                                        Conversion pending
                                      </span>
                                    );
                                  }
                                  if (conversion.status === 'accepted') {
                                    return (
                                      <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 ring-1 ring-emerald-200/80">
                                        Conversion approved
                                      </span>
                                    );
                                  }
                                  if (conversion.status === 'rejected') {
                                    return (
                                      <span
                                        className="inline-flex max-w-full truncate rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-800 ring-1 ring-rose-200/80"
                                        title={conversion.reviewNote || 'Conversion request was rejected'}
                                      >
                                        Conversion rejected
                                      </span>
                                    );
                                  }
                                  return null;
                                })()}
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
                            {selectedDynamicColumnLabels.map((label) => {
                              const value = getLeadDynamicFieldValue(lead, label);
                              return (
                                <td key={`${lead.id}-${label}`} className="px-3 sm:px-4 py-2">
                                  <span className="line-clamp-2 text-xs text-slate-700">
                                    {value || '—'}
                                  </span>
                                </td>
                              );
                            })}
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
                                    {mergeLeadStatusOptions(leadStatusOptions, [lead.status]).map((status) => (
                                      <option key={status} value={status}>
                                        {status}
                                      </option>
                                    ))}
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
                            <TableAuditCell audit={lead.auditMeta} hideUnchangedUpdated />
                            <td className="px-3 sm:px-4 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="inline-flex items-center justify-end gap-0.5 rounded-xl bg-slate-100/70 p-0.5 ring-1 ring-slate-200/60">
                                {SHOW_TABLE_ROW_EDIT_ICON ? (
                                  <button
                                    type="button"
                                    className="flex h-7 w-7 items-center justify-center rounded-lg text-amber-600 hover:bg-white hover:text-amber-800 hover:shadow-sm transition-all"
                                    title="Edit Lead"
                                    onClick={() => {
                                      void openLeadDrawerWithFreshData(lead, 'edit');
                                    }}
                                  >
                                    <Pencil size={15} strokeWidth={2.35} />
                                  </button>
                                ) : null}
                                {canConvertLead && lead.status !== 'Converted' && !lead.convertedToClientId && (
                                  (() => {
                                    const conversion = getStatusForLead(lead.id);
                                    const canSend = canInitiateSentRequest(conversion);
                                    const isResend = conversion.status === 'rejected';

                                    if (isResend) {
                                      return (
                                        <button
                                          type="button"
                                          className="flex h-7 w-7 items-center justify-center rounded-lg text-emerald-600 hover:bg-white hover:text-emerald-800 hover:shadow-sm transition-all"
                                          title="Resend conversion request"
                                          onClick={() => void handleConvert(lead.id)}
                                        >
                                          <RefreshCcw size={15} strokeWidth={2.35} />
                                        </button>
                                      );
                                    }

                                    return (
                                      <button
                                        type="button"
                                        disabled={!canSend}
                                        className={`flex h-7 w-7 items-center justify-center rounded-lg transition-all ${
                                          canSend
                                            ? 'text-emerald-600 hover:bg-white hover:text-emerald-800 hover:shadow-sm'
                                            : 'cursor-not-allowed text-slate-300'
                                        }`}
                                        title={
                                          conversion.status === 'pending'
                                            ? 'Conversion request is pending approval'
                                            : conversion.status === 'accepted'
                                              ? 'Conversion request already approved'
                                              : 'Convert to Client'
                                        }
                                        aria-disabled={!canSend}
                                        onClick={() => {
                                          if (!canSend) return;
                                          void handleConvert(lead.id);
                                        }}
                                      >
                                        <UserPlus size={15} strokeWidth={2.35} />
                                      </button>
                                    );
                                  })()
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
            onOpenExistingLead={(leadId) => {
              setAddLeadDrawerOpen(false);
              setSelectedLeadDrawerMode('view');
              setSelectedLeadId(leadId);
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
            onImportComplete={async () => {
              setImportDrawerOpen(false);
              await handleRefresh({ silent: true });
            }}
          />
        )}
        <ExportColumnsModal
          isOpen={exportModalOpen}
          onClose={() => {
            setExportModalOpen(false);
            setExportLeads([]);
          }}
          title="Export leads"
          rowCount={exportLeads.length}
          rowLabelSingular="lead"
          rowLabelPlural="leads"
        columns={exportColumns}
          rows={exportLeads}
          isLoading={exportLeadsLoading}
          getRowKey={(lead) => lead.id}
          onExport={handleExportLeadsCsv}
        />
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
                      {leadStatusOptions.map((status) => (
                        <option key={status} value={status} className="text-slate-900 bg-white">
                          {status}
                        </option>
                      ))}
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
        {conversionRemarkModal ? (
          <div
            className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/45 p-4"
            onClick={() => setConversionRemarkModal(null)}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-emerald-100 bg-white p-5 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-base font-bold text-slate-900">Conversion request remark</h3>
              <p className="mt-1 text-sm text-slate-500">
                Add a remark for your department head before sending this lead conversion for approval.
              </p>
              <textarea
                value={conversionRemark}
                onChange={(e) => setConversionRemark(e.target.value)}
                rows={3}
                placeholder="Remark (required)"
                className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm resize-none"
              />
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConversionRemarkModal(null)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!conversionRemark.trim()}
                  onClick={() => {
                    if (!conversionRemarkModal) return;
                    void handleConvert(
                      conversionRemarkModal.leadId,
                      conversionRemarkModal.form,
                      conversionRemark.trim(),
                    );
                  }}
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                >
                  Send request
                </button>
              </div>
            </div>
          </div>
        ) : null}
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
