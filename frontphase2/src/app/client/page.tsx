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
  Building2,
  BadgeCheck,
  Users,
  Briefcase,
  BadgeInfo,
  Flame,
  FolderOpen,
  Inbox,
  XCircle,
  Sparkles,
  Lock,
} from 'lucide-react';
import { AiCoinLockBadge, useAiCoinGate } from '../../components/coins/AiCoinGate';
import { downloadCsv } from '../../utils/csv';
import { formatDateDMY } from '../../utils/dateDisplay';
import { extractAuditMeta } from '../../utils/auditMeta';
import { ExportColumnsModal } from '../../components/export/ExportColumnsModal';
import { buildClientsCsvColumns, CLIENTS_EXPORT_COLUMNS } from '../../lib/export/clientsExportColumns';
import { fetchAllPaginated, totalPagesFromPagination } from '../../lib/export/fetchAllPaginated';
import { ClientTable } from '../../components/ClientTable';
import { TableColumnsMenu } from '../../components/table/TableColumnsMenu';
import {
  usePersistedColumnVisibility,
  useTenantScopedStringArray,
} from '../../hooks/usePersistedColumnVisibility';
import { CLIENT_TABLE_COLUMNS } from '../../lib/tableColumns/moduleTableColumns';
import { ClientHandoffModal } from '../../components/team/ClientHandoffModal';
import { SendToRecruitmentModal } from '../../components/clients/SendToRecruitmentModal';
import { ClientDetailsDrawer } from '../../components/drawers/ClientDetailsDrawer';
import { ClientImportDrawer } from '../../components/drawers/ClientImportDrawer';
import ModuleRecycleBinDrawer from '../../components/ModuleRecycleBinDrawer';
import {
  SmartSearchActiveKeywordsBar,
  SmartSearchPromptPanel,
  SmartSearchToggleButton,
} from '../../components/smart-search/SmartSearchToolbar';
import { useSmartSearch } from '../../hooks/useSmartSearch';
import { useClientPageFieldVisibility } from '../../hooks/useClientPageFieldVisibility';
import type { ClientPageFieldVisibility } from '../../lib/clientPageFieldVisibility';
import { mapAiToClientsResult, parseSmartSearchWithAi } from '../../lib/smart-search/aiParser';
import { buildClientsListApiParams } from '../../lib/smart-search/entitySmartSearch';
import {
  CLIENTS_SMART_SEARCH_EXAMPLES,
  clientMatchesSmartKeywordChips,
  mergeClientsSmartSearchResult,
  parseClientsSmartSearchPrompt,
} from '../../lib/smart-search/parsers';
import { CreateJobDrawer } from '../../components/drawers/CreateJobDrawer';
import { SearchableToolbarFilterSelect } from '../../components/forms/SearchableToolbarFilterSelect';
import PaginationAll from '../../components/PaginationAll';
import { TABLE_PAGE_SIZE_OPTIONS, type TablePageSize } from '../../constants/tablePagination';
import { INITIAL_CLIENTS } from './types';
import type { Client } from './types';
import {
  apiGetClients,
  apiGetClient,
  apiDeleteClient,
  apiUpdateClient,
  apiGetClientLeadStatusCatalog,
  apiGetClientAssignableMembers,
  apiSendClientToRecruitment,
  type BackendClient,
  type BackendUser,
  type UpdateClientData,
} from '../../lib/api';
import { getActiveOrgUnitId } from '../../lib/org/orgWorkspaceStorage';
import { requestConfirm, requestError } from '../../lib/appDialog';
import { usePermissions } from '../../hooks/usePermissions';
import { useCanHandoffClient } from '../../hooks/useCanHandoffClient';
import { useClientHandoffStatuses } from '../../hooks/useClientHandoffStatuses';
import { usePageAutoRefresh } from '../../hooks/usePageAutoRefresh';
import { SummaryCard, SummaryCardSkeleton, type SummaryCardColor } from '../../components/ui/SummaryCard';
import { TableSkeleton } from '../../components/ui/Skeleton';
import type { CsvColumn } from '../../utils/csv';
import { mergeCatalogOptions } from '../../components/forms/CatalogOptionDropdown';
import { useWorkspaceEntityAlerts } from '../../hooks/useWorkspaceEntityAlerts';
import {
  backendStatusToStage,
  clientStatusLabelToBackend,
  DEFAULT_CLIENT_STATUS_LABELS,
  resolveClientStatusLabel,
} from '../../lib/clientLifecycleStatus';

// Force client-side render so the page hydrates skeletons before the data fetch
// resolves — every interactive bit on this tab is client-driven anyway.
export const dynamic = 'force-dynamic';

/** Toolbar selects / filter chip — matches Leads page for one visual system. */
const CLIENT_TOOLBAR_SELECT =
  'rounded-lg border border-indigo-100/90 bg-white/95 px-2.5 py-1.5 text-xs font-medium text-slate-800 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-300 cursor-pointer hover:border-indigo-200/90 hover:bg-indigo-50/40';
const CLIENTS_DYNAMIC_COLUMNS_STORAGE_KEY = 'clients.dynamicColumns';

function getClientDynamicFieldValue(client: Client, label: string): string {
  if (!Array.isArray(client.otherDetails)) return '';
  const target = String(label || '').trim().toLowerCase();
  const match = client.otherDetails.find(
    (item) => String(item?.label || '').trim().toLowerCase() === target
  );
  return String(match?.value || '').trim();
}

function filterClientsByTab(clients: Client[], activeTab: string): Client[] {
  switch (activeTab) {
    case 'active':
      return clients.filter((client) => resolveClientStatusLabel(client) === 'Active');
    case 'on-hold':
      return clients.filter((client) => resolveClientStatusLabel(client) === 'On Hold');
    case 'inactive':
      return clients.filter((client) => resolveClientStatusLabel(client) === 'Inactive');
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
  fieldVisibility,
}: {
  activeTab: string;
  onTabChange: (tab: string) => void;
  counts: { all: number; active: number; 'on-hold': number; inactive: number; hot: number };
  fieldVisibility: ClientPageFieldVisibility;
}) => {
  const cards: Array<{
    id: string;
    label: string;
    count: number;
    color: SummaryCardColor;
    icon: React.ReactNode;
  }> = [
    { id: 'all', label: 'All Clients', count: counts.all, color: 'indigo', icon: <FolderOpen size={16} strokeWidth={2.35} /> },
    ...(fieldVisibility.status
      ? [
          { id: 'active', label: 'Active', count: counts.active, color: 'blue' as SummaryCardColor, icon: <Users size={16} strokeWidth={2.35} /> },
          { id: 'on-hold', label: 'On Hold', count: counts['on-hold'], color: 'orange' as SummaryCardColor, icon: <Briefcase size={16} strokeWidth={2.35} /> },
          { id: 'inactive', label: 'Inactive', count: counts.inactive, color: 'gray' as SummaryCardColor, icon: <BadgeInfo size={16} strokeWidth={2.35} /> },
        ]
      : []),
    ...(fieldVisibility.interestLevel
      ? [{ id: 'hot', label: 'Hot', count: counts.hot, color: 'purple' as SummaryCardColor, icon: <Flame size={16} strokeWidth={2.35} /> }]
      : []),
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
    assignedToId: backendClient.assignedTo?.id || undefined,
    lastActivity: backendClient.updatedAt ? formatDateDMY(backendClient.updatedAt) : 'Never',
    updatedAt: backendClient.updatedAt || backendClient.createdAt || undefined,
    createdAt: backendClient.createdAt || undefined,
    auditMeta: extractAuditMeta(backendClient as Record<string, unknown>),
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
    agreementContractValidity: backendClient.agreementContractValidity || undefined,
    agreementContractStartDate: backendClient.agreementContractStartDate || undefined,
    agreementContractEndDate: backendClient.agreementContractEndDate || undefined,
    postServiceKycForm: backendClient.postServiceKycForm || undefined,
    agreementLevel: backendClient.agreementLevel || undefined,
    agreementServiceChargePercent: backendClient.agreementServiceChargePercent || undefined,
    agreementTimePeriod: backendClient.agreementTimePeriod || undefined,
    agreementAdvancePaymentPercent: backendClient.agreementAdvancePaymentPercent || undefined,
    agreementFreeReplacementValue:
      backendClient.agreementFreeReplacementValue != null
        ? backendClient.agreementFreeReplacementValue
        : undefined,
    agreementFreeReplacementUnit: backendClient.agreementFreeReplacementUnit || undefined,
    city: backendClient.city || undefined,
    state: backendClient.state || undefined,
    country: backendClient.country || undefined,
    latitude: typeof backendClient.latitude === 'number' ? backendClient.latitude : undefined,
    longitude: typeof backendClient.longitude === 'number' ? backendClient.longitude : undefined,
    directorSalutation: backendClient.directorSalutation || undefined,
    emails: Array.isArray(backendClient.emails) && backendClient.emails.length > 0 ? backendClient.emails : undefined,
    phones: Array.isArray(backendClient.phones) && backendClient.phones.length > 0 ? backendClient.phones : undefined,
    leadStatusValue: backendClient.leadStatus || undefined,
    otherDetails: Array.isArray(backendClient.otherDetails) ? backendClient.otherDetails : undefined,
    recruitmentEnabled: backendClient.recruitmentEnabled === true,
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
  const { hasAnyPermission, hasPermission } = usePermissions();
  const canCreateJob = hasAnyPermission(['jobs_create', 'create_job']);
  const canUpdateClient = hasAnyPermission(['clients_update']);
  const isRecruitmentScope = searchParams.get('scope') === 'recruitment';
  const canSendToRecruitment =
    canUpdateClient || canCreateJob;
  const canHandoffFromServer = useCanHandoffClient();
  const canHandoffClient =
    canHandoffFromServer || hasPermission('clients_handoff');
  const { getStatusForClient, refresh: refreshHandoffStatuses } = useClientHandoffStatuses();
  const canOpenClientTrash = hasAnyPermission(['clients_delete']);
  const canViewClientAgreements = hasAnyPermission(['agreements_read', 'agreements_manage']);
  const clientFieldVisibility = useClientPageFieldVisibility();
  const [activeTab, setActiveTab] = useState('all');
  const [clientSortBy, setClientSortBy] = useState<'activity' | 'name'>('activity');
  const [clientNameSortOrder, setClientNameSortOrder] = useState<'asc' | 'desc'>('asc');
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
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedClientDrawerMode, setSelectedClientDrawerMode] = useState<'view' | 'edit'>('view');
  const [showAddClientDrawer, setShowAddClientDrawer] = useState(false);
  const [addClientWithAi, setAddClientWithAi] = useState(false);
  const [createClientMode, setCreateClientMode] = useState<'ai' | 'manual'>('manual');
  const clientAiGate = useAiCoinGate('ai.client_chat');
  const [showCreateJobDrawer, setShowCreateJobDrawer] = useState(false);
  const [clientIdForJob, setClientIdForJob] = useState<string | null>(null);
  const [sendingToRecruitmentIds, setSendingToRecruitmentIds] = useState<string[]>([]);
  const [recruitmentForwardClient, setRecruitmentForwardClient] = useState<Client | null>(null);
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
  const [smartSearchClientIds, setSmartSearchClientIds] = useState<string[]>([]);
  const [selectedDynamicColumnLabels, setSelectedDynamicColumnLabels] = useTenantScopedStringArray(
    CLIENTS_DYNAMIC_COLUMNS_STORAGE_KEY,
  );
  const clientColumnVisibility = usePersistedColumnVisibility(
    'clients.visibleColumns',
    CLIENT_TABLE_COLUMNS,
  );
  const [teamMembers, setTeamMembers] = useState<BackendUser[]>([]);
  const [teamMemberFilterId, setTeamMemberFilterId] = useState('');
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkAssignedTo, setBulkAssignedTo] = useState('');
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [handoffClient, setHandoffClient] = useState<Client | null>(null);
  const [clientStatusOptions, setClientStatusOptions] = useState<string[]>([
    ...DEFAULT_CLIENT_STATUS_LABELS,
  ]);
  const selectedClient = useMemo(
    () => (selectedClientId ? clients.find((client) => client.id === selectedClientId) ?? null : null),
    [clients, selectedClientId],
  );

  const patchClientInList = useCallback((id: string, patch: Partial<Client>) => {
    setClients((prev) => prev.map((client) => (client.id === id ? { ...client, ...patch } : client)));
  }, []);

  const mergeClientOptimistically = useCallback((incoming: Client) => {
    setClients((prev) => {
      const exists = prev.some((client) => client.id === incoming.id);
      if (exists) {
        return prev.map((client) => (client.id === incoming.id ? { ...client, ...incoming } : client));
      }
      return [incoming, ...prev];
    });
  }, []);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<TablePageSize>(10);
  const pendingDeepLinkClientIdRef = useRef<string | null>(null);
  const availableDynamicColumnLabels = useMemo(() => {
    const seen = new Set<string>();
    const labels: string[] = [];
    for (const client of clients) {
      for (const item of client.otherDetails || []) {
        const label = String(item?.label || '').trim();
        const key = label.toLowerCase();
        if (!label || seen.has(key)) continue;
        seen.add(key);
        labels.push(label);
      }
    }
    return labels.sort((a, b) => a.localeCompare(b));
  }, [clients]);

  useEffect(() => {
    setSelectedDynamicColumnLabels((previous) =>
      previous.filter((label) =>
        availableDynamicColumnLabels.some((option) => option.toLowerCase() === label.toLowerCase())
      )
    );
  }, [availableDynamicColumnLabels, setSelectedDynamicColumnLabels]);

  const filteredClients = useMemo(() => {
    let list = filterClientsByTab(clients, activeTab);
    if (teamMemberFilterId) {
      const selectedMember = teamMembers.find((member) => member.id === teamMemberFilterId);
      const selectedName = String(selectedMember?.name || '').trim().toLowerCase();
      list = list.filter((client) => {
        if (client.assignedToId) return client.assignedToId === teamMemberFilterId;
        if (!selectedName) return false;
        return String(client.owner?.name || '').trim().toLowerCase() === selectedName;
      });
    }
    return list;
  }, [clients, activeTab, teamMemberFilterId, teamMembers]);
  const clientSmartSearch = useSmartSearch({
    parsePrompt: parseClientsSmartSearchPrompt,
    parsePromptWithAi: async (text) => {
      const local = parseClientsSmartSearchPrompt(text);
      const ai = await parseSmartSearchWithAi('clients', text, { useTenantDatabase: true }, mapAiToClientsResult);
      if (!ai) return null;
      return mergeClientsSmartSearchResult(local, ai);
    },
    applyParsed: (parsed) => {
      setCurrentPage(1);
      const stageChip = parsed.keywords.find((chip) => chip.kind === 'stage');
      const recruiterChip = parsed.keywords.find((chip) => chip.kind === 'recruiter');
      const nextTab = parsed.activeTab || stageChip?.value || null;
      if (nextTab) setActiveTab(nextTab);
      if (recruiterChip?.value && recruiterChip.value !== 'me') {
        setTeamMemberFilterId(recruiterChip.value);
      } else if (parsed.ownerScope === 'me') {
        // Keep "me" scoped through smart-search chips; clear explicit member filter.
        setTeamMemberFilterId('');
      }
      setSearchQuery(parsed.searchText);
      setDebouncedSearchQuery(parsed.searchText);
      setSmartSearchClientIds(
        parsed.matchingClientIds && parsed.matchingClientIds.length > 0 ? parsed.matchingClientIds : [],
      );
    },
    onRemoveKeyword: (removed, remaining) => {
      setCurrentPage(1);
      if (removed.kind === 'stage') setActiveTab('all');
      if (removed.kind === 'recruiter') setTeamMemberFilterId('');
      if (removed.kind === 'text') {
        const text = remaining.filter((k) => k.kind === 'text').map((k) => k.value).join(' ');
        setSearchQuery(text);
        setDebouncedSearchQuery(text);
      }
    },
    examples: CLIENTS_SMART_SEARCH_EXAMPLES,
  });

  const sortedClients = useMemo(() => {
    let list = [...filteredClients];
    if (clientSmartSearch.activeKeywords.length > 0) {
      list = list.filter((client) =>
        clientMatchesSmartKeywordChips(client, clientSmartSearch.activeKeywords, currentUserName),
      );
    }
    list.sort((a, b) => {
      if (clientSortBy === 'name') {
        const comparison = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        return clientNameSortOrder === 'asc' ? comparison : -comparison;
      }
      const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return bTime - aTime;
    });
    return list;
  }, [filteredClients, clientSortBy, clientNameSortOrder, clientSmartSearch.activeKeywords, currentUserName]);
  const pagedClients = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedClients.slice(start, start + pageSize);
  }, [sortedClients, currentPage, pageSize]);
  const { alertsByEntityId: workspaceAlertsByEntityId } = useWorkspaceEntityAlerts(
    'CLIENT',
    pagedClients.map((client) => client.id),
  );
  const tabCounts = useMemo(
    () => ({
      all: clients.length,
      active: clients.filter((c) => resolveClientStatusLabel(c) === 'Active').length,
      'on-hold': clients.filter((c) => resolveClientStatusLabel(c) === 'On Hold').length,
      inactive: clients.filter((c) => resolveClientStatusLabel(c) === 'Inactive').length,
      hot: clients.filter((c) => c.priority === 'High').length,
    }),
    [clients]
  );

  useEffect(() => {
    if (activeTab === 'hot' && !clientFieldVisibility.interestLevel) {
      setActiveTab('all');
      return;
    }
    if (['active', 'on-hold', 'inactive'].includes(activeTab) && !clientFieldVisibility.status) {
      setActiveTab('all');
    }
  }, [activeTab, clientFieldVisibility.interestLevel, clientFieldVisibility.status]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

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
        const response = await apiGetClientAssignableMembers(getActiveOrgUnitId() || undefined);
        const members = Array.isArray(response.data) ? response.data : [];
        setTeamMembers(
          members.map((member) => ({
            id: member.id,
            name: member.name || `${member.firstName || ''} ${member.lastName || ''}`.trim() || member.email || 'User',
            email: member.email,
          })),
        );
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
    // closing the drawer (which clears `selectedClientId`) used to re-fire and
    // immediately reopen the same client.
    if (pendingDeepLinkClientIdRef.current === clientId) {
      return;
    }
    pendingDeepLinkClientIdRef.current = clientId;

    const existingClient = clients.find((client) => client.id === clientId);
    if (existingClient) {
      setSelectedClientId(clientId);
      setSelectedClientDrawerMode('view');
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const response = await apiGetClient(clientId);
        if (cancelled) return;
        const backendClient = (response as any).data?.data || (response as any).data || response;
        if (!backendClient) return;
        const mappedClient = mapBackendClientToFrontend(backendClient);
        mergeClientOptimistically(mappedClient);
        setSelectedClientId(mappedClient.id);
        setSelectedClientDrawerMode('view');
      } catch (error) {
        console.error('Failed to open client from search:', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clients, mergeClientOptimistically, searchParams]);

  const fetchClients = useCallback(async (overrides?: { page?: number; search?: string; matchingClientIds?: string[] }) => {
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

      const response = await apiGetClients(
        buildClientsListApiParams({
          search: effectiveSearch,
          page: 1,
          limit: FETCH_LIMIT,
          matchingClientIds: overrides?.matchingClientIds ?? smartSearchClientIds,
          includeContacts: false,
          includeLeadFields: false,
          recruitmentEnabled: isRecruitmentScope || undefined,
        }),
      );

      const backendClients = response.data ? extractBackendClients(response.data) : [];

      if (!Array.isArray(backendClients)) {
        setError('Unexpected API response format.');
        setClients(INITIAL_CLIENTS);
        setIsEmpty(INITIAL_CLIENTS.length === 0);
        return;
      }

      const mappedClients = backendClients.map(mapBackendClientToFrontend);
      const fromApi = new Map<string, Client>();
      mappedClients.forEach((client) => {
        const id = String(client.id);
        fromApi.set(id, { ...client, id });
      });
      setClients((prev) => {
        const clientMap = new Map(fromApi);
        prev.forEach((client) => {
          if (clientMap.has(client.id)) return;
          if (isRecruitmentScope && !client.recruitmentEnabled) return;
          clientMap.set(client.id, client);
        });
        const uniqueClients = Array.from(clientMap.values()).sort((a, b) => {
          const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
          const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
          return bTime - aTime;
        });
        setIsEmpty(uniqueClients.length === 0);
        return uniqueClients;
      });
      setSelectedClients((prev) => prev.filter((id) => fromApi.has(id)));
    } catch (err: any) {
      console.error('Failed to fetch clients:', err);
      setError(err?.message || 'Failed to fetch clients');
      setClients(INITIAL_CLIENTS);
      setIsEmpty(INITIAL_CLIENTS.length === 0);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearchQuery, smartSearchClientIds, isRecruitmentScope]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const fetchClientStatusCatalog = useCallback(async () => {
    try {
      const response = await apiGetClientLeadStatusCatalog();
      setClientStatusOptions(
        mergeCatalogOptions(
          DEFAULT_CLIENT_STATUS_LABELS,
          response?.data?.statuses,
          clients.map((client) => resolveClientStatusLabel(client)),
        ),
      );
    } catch (err) {
      console.error('Failed to load client status catalog:', err);
      setClientStatusOptions(
        mergeCatalogOptions(
          DEFAULT_CLIENT_STATUS_LABELS,
          undefined,
          clients.map((client) => resolveClientStatusLabel(client)),
        ),
      );
    }
  }, [clients]);

  useEffect(() => {
    void fetchClientStatusCatalog();
  }, [fetchClientStatusCatalog]);

  useEffect(() => {
    const handler = () => {
      void fetchClientStatusCatalog();
    };
    window.addEventListener('jobportal:client-catalog-changed', handler);
    return () => window.removeEventListener('jobportal:client-catalog-changed', handler);
  }, [fetchClientStatusCatalog]);

  useEffect(() => {
    setClientStatusOptions((current) =>
      mergeCatalogOptions(DEFAULT_CLIENT_STATUS_LABELS, current, [
        ...clients.map((client) => resolveClientStatusLabel(client)),
      ]),
    );
  }, [clients]);

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

  const ensureClientInRecruitment = useCallback(
    async (client: Client) => {
      if (client.recruitmentEnabled) return true;
      try {
        setSendingToRecruitmentIds((ids) => (ids.includes(client.id) ? ids : [...ids, client.id]));
        await apiSendClientToRecruitment(client.id);
        patchClientInList(client.id, { recruitmentEnabled: true });
        return true;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Could not send this client to Recruitment.';
        toast.error(message);
        return false;
      } finally {
        setSendingToRecruitmentIds((ids) => ids.filter((id) => id !== client.id));
      }
    },
    [patchClientInList],
  );

  const handleSendToRecruitment = useCallback((client: Client) => {
    setRecruitmentForwardClient(client);
  }, []);

  const handleCreateJobForClient = useCallback(
    async (client: Client) => {
      if (!canCreateJob) {
        toast.error("You don't have permission to create jobs.");
        return;
      }
      const ok = await ensureClientInRecruitment(client);
      if (!ok) return;
      setClientIdForJob(client.id);
      setShowCreateJobDrawer(true);
    },
    [canCreateJob, ensureClientInRecruitment],
  );

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

  const handleInlineClientStatusChange = useCallback(
    async (clientId: string, newStatusLabel: string) => {
      const previous = clients.find((client) => client.id === clientId);
      const normalized = String(newStatusLabel || '').trim();
      if (!normalized || resolveClientStatusLabel(previous || {}) === normalized) return;

      const nextStage = backendStatusToStage(clientStatusLabelToBackend(normalized));
      patchClientInList(clientId, {
        stage: nextStage,
        leadStatus: normalized,
        leadStatusValue: normalized,
      });
      try {
        await apiUpdateClient(clientId, {
          leadStatus: normalized,
          status: clientStatusLabelToBackend(normalized),
        });
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('jobportal:clients-changed'));
        }
        toast.success('Status updated');
      } catch (err: unknown) {
        console.error('Failed to update client status:', err);
        if (previous) {
          patchClientInList(clientId, {
            stage: previous.stage,
            leadStatus: previous.leadStatus,
            leadStatusValue: previous.leadStatusValue,
          });
        }
        void requestError(err instanceof Error ? err.message : 'Failed to update status');
      }
    },
    [clients, patchClientInList],
  );

  const handleBulkAssignChange = async (assignedToId: string) => {
    setBulkAssignedTo(assignedToId);
    if (assignedToId) await handleBulkUpdate({ assignedToId });
  };

  const applyExportClientFilters = useCallback(
    (source: Client[]) => {
      let filtered = filterClientsByTab(source, activeTab);
      if (teamMemberFilterId) {
        const selectedMember = teamMembers.find((member) => member.id === teamMemberFilterId);
        const selectedName = String(selectedMember?.name || '').trim().toLowerCase();
        filtered = filtered.filter((client) => {
          if (client.assignedToId) return client.assignedToId === teamMemberFilterId;
          if (!selectedName) return false;
          return String(client.owner?.name || '').trim().toLowerCase() === selectedName;
        });
      }
      const list = [...filtered];
      list.sort((a, b) => {
        if (clientSortBy === 'name') {
          const comparison = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
          return clientNameSortOrder === 'asc' ? comparison : -comparison;
        }
        const aTime = new Date(a.updatedAt || 0).getTime();
        const bTime = new Date(b.updatedAt || 0).getTime();
        return bTime - aTime;
      });
      return list;
    },
    [activeTab, clientSortBy, clientNameSortOrder, teamMemberFilterId, teamMembers],
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
          recruitmentEnabled: isRecruitmentScope || undefined,
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
  }, [applyExportClientFilters, debouncedSearchQuery, isRecruitmentScope]);

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

  const exportDynamicColumns = useMemo(() => {
    const source = exportClients.length > 0 ? exportClients : sortedClients;
    const seen = new Set<string>();
    const labels: string[] = [];
    for (const client of source) {
      for (const item of client.otherDetails || []) {
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
      accessor: (c: Client) => {
        if (!Array.isArray(c.otherDetails)) return '';
        const target = label.trim().toLowerCase();
        const match = c.otherDetails.find(
          (item) => String(item?.label || '').trim().toLowerCase() === target
        );
        return String(match?.value || '').trim();
      },
    }));
  }, [exportClients, sortedClients]);

  const exportKycColumns = useMemo(() => {
    const source = exportClients.length > 0 ? exportClients : sortedClients;
    const fieldSet = new Set<string>();

    const walk = (value: unknown, prefix: string) => {
      if (value == null) return;
      if (Array.isArray(value)) {
        if (value.length === 0) return;
        const allPrimitive = value.every(
          (item) =>
            item == null ||
            typeof item === 'string' ||
            typeof item === 'number' ||
            typeof item === 'boolean'
        );
        if (allPrimitive) {
          fieldSet.add(prefix);
          return;
        }
        value.forEach((item, index) => walk(item, `${prefix}.${index + 1}`));
        return;
      }
      if (typeof value === 'object') {
        const entries = Object.entries(value as Record<string, unknown>);
        if (entries.length === 0) return;
        entries.forEach(([key, nested]) => {
          const nextPrefix = prefix ? `${prefix}.${key}` : key;
          walk(nested, nextPrefix);
        });
        return;
      }
      fieldSet.add(prefix);
    };

    source.forEach((client) => walk(client.postServiceKycForm, 'kyc'));

    const fields = Array.from(fieldSet).sort((a, b) => a.localeCompare(b));
    return fields.map((fieldPath) => ({
      id: `kyc:${fieldPath}`,
      label: fieldPath
        .replace(/^kyc\./, '')
        .split('.')
        .map((part) => part.replace(/([a-z0-9])([A-Z])/g, '$1 $2'))
        .join(' / '),
      accessor: (c: Client) => {
        const root = c.postServiceKycForm as unknown;
        if (root == null) return '';
        const pathParts = fieldPath.replace(/^kyc\./, '').split('.');
        let cursor: unknown = root;
        for (const part of pathParts) {
          if (cursor == null) return '';
          if (Array.isArray(cursor)) {
            const idx = Number(part) - 1;
            if (!Number.isFinite(idx) || idx < 0 || idx >= cursor.length) return '';
            cursor = cursor[idx];
            continue;
          }
          if (typeof cursor !== 'object') return '';
          cursor = (cursor as Record<string, unknown>)[part];
        }
        if (cursor == null) return '';
        if (Array.isArray(cursor)) {
          return cursor
            .map((item) => String(item ?? '').trim())
            .filter(Boolean)
            .join('; ');
        }
        if (typeof cursor === 'object') {
          return JSON.stringify(cursor);
        }
        return String(cursor).trim();
      },
    }));
  }, [exportClients, sortedClients]);

  const exportColumns = useMemo(
    () => {
      const base = canViewClientAgreements
        ? CLIENTS_EXPORT_COLUMNS
        : CLIENTS_EXPORT_COLUMNS.filter((col) => !col.id.startsWith('agreement'));
      return [...base, ...exportKycColumns, ...exportDynamicColumns];
    },
    [canViewClientAgreements, exportDynamicColumns, exportKycColumns]
  );

  const handleExportClientsCsv = (selectedColumnIds: string[]) => {
    const baseColumns = buildClientsCsvColumns(
      selectedColumnIds.filter((id) => !id.startsWith('dynamic:'))
    );
    const selectedDynamic = exportColumns
      .filter(
        (col) =>
          (col.id.startsWith('dynamic:') || col.id.startsWith('kyc:')) &&
          selectedColumnIds.includes(col.id)
      )
      .map(({ id, accessor }) => ({ id, accessor })) as CsvColumn<Client>[];
    const columns = [...baseColumns, ...selectedDynamic];
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
    setSmartSearchClientIds([]);
    setTeamMemberFilterId('');
    setActiveTab('all');
    setSelectedDynamicColumnLabels([]);
    clientSmartSearch.clearSmartSearch();
  }, [clientSmartSearch]);

  return (
    <div className="ph2-page-shell flex h-[calc(100dvh-3.5rem)] w-full flex-col overflow-hidden text-slate-900">
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="min-h-[4.5rem] flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3 shrink-0 border-b border-indigo-100/50 bg-white/80 backdrop-blur-md shadow-[inset_0_-1px_0_0_rgba(99,102,241,0.08)]">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-lg ring-1 ring-white/20 ${
              isRecruitmentScope
                ? 'bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 shadow-amber-500/30'
                : 'bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 shadow-indigo-500/30'
            }`}>
              {isRecruitmentScope ? (
                <Briefcase className="h-5 w-5" strokeWidth={2.2} />
              ) : (
                <Building2 className="h-5 w-5" strokeWidth={2.2} />
              )}
            </div>
            <div>
              <h1 className="text-xl sm:text-[1.35rem] font-bold tracking-tight text-slate-900 leading-none">
                {isRecruitmentScope ? 'Recruitment Clients' : 'Clients'}
              </h1>
              {isRecruitmentScope ? (
                <p className="mt-1 text-xs font-medium text-slate-500">
                  Clients sent from CRM. Jobs are created under these accounts.
                </p>
              ) : null}
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
              title="Choose columns and export visible clients to CSV"
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
            <div
              role="group"
              aria-label="Create client"
              className="inline-flex items-center rounded-lg border border-slate-200/90 bg-slate-100/90 p-0.5 shadow-[0_4px_14px_-4px_rgba(99,102,241,0.18)]"
            >
              <button
                type="button"
                aria-pressed={createClientMode === 'ai'}
                onClick={() => {
                  if (clientAiGate.locked) {
                    clientAiGate.confirmAndUnlock();
                    return;
                  }
                  setCreateClientMode('ai');
                  setAddClientWithAi(true);
                  setSelectedClientId(null);
                  setShowAddClientDrawer(true);
                }}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                  clientAiGate.locked
                    ? 'text-amber-800 hover:bg-amber-50'
                    : createClientMode === 'ai'
                      ? 'bg-white text-violet-800 shadow-sm ring-1 ring-violet-200/70'
                      : 'text-slate-500 hover:bg-white/60 hover:text-violet-700'
                }`}
                title={
                  clientAiGate.locked
                    ? `Locked — needs ${clientAiGate.cost} coins (you have ${clientAiGate.coins})`
                    : `Create a client with AI (${clientAiGate.cost} coins per chat message)`
                }
              >
                {clientAiGate.locked ? (
                  <Lock size={14} className="text-amber-600" strokeWidth={2.25} />
                ) : (
                  <Sparkles size={14} className="text-violet-600" strokeWidth={2.25} />
                )}
                <span>Create with AI</span>
                <AiCoinLockBadge featureId="ai.client_chat" />
              </button>
              <button
                type="button"
                aria-pressed={createClientMode === 'manual'}
                onClick={() => {
                  setCreateClientMode('manual');
                  setAddClientWithAi(false);
                  setSelectedClientId(null);
                  setShowAddClientDrawer(true);
                }}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                  createClientMode === 'manual'
                    ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white shadow-sm'
                    : 'text-slate-500 hover:bg-white/60 hover:text-indigo-700'
                }`}
                title="Create a client manually"
              >
                <Plus
                  size={14}
                  className={createClientMode === 'manual' ? 'text-white' : 'text-indigo-500'}
                  strokeWidth={2.5}
                />
                <span>Create Manually</span>
              </button>
            </div>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 py-4 sm:px-5 sm:py-6 lg:px-6">
          {loading ? (
            <div className="mb-5 shrink-0">
              <StatusCardsSkeleton />
            </div>
          ) : (
            <div className="mb-5 shrink-0">
              <StatusCards
                activeTab={activeTab}
                onTabChange={setActiveTab}
                counts={tabCounts}
                fieldVisibility={clientFieldVisibility}
              />
            </div>
          )}

          {loading ? (
            <div className="mb-0 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-indigo-100/60 bg-white/70 shadow-[0_12px_40px_-18px_rgba(59,130,246,0.18)] backdrop-blur-sm">
              <div className="shrink-0 border-b border-indigo-100/40 bg-gradient-to-br from-white via-indigo-50/25 to-violet-50/20 p-3 sm:p-4">
                <div className="h-9 max-w-md rounded-xl bg-white/80 ring-1 ring-indigo-100/80 animate-pulse" />
              </div>
              <div className="ph2-table-body-scroll min-h-0 flex-1 overflow-auto">
                <TableSkeleton rows={8} columns={8} />
              </div>
            </div>
          ) : error && !loading ? (
            <div className="mb-0 flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-xl border border-rose-200/70 bg-white p-8 text-center text-xs font-medium text-rose-600 shadow-sm">
              Error: {error}
            </div>
          ) : isEmpty ? (
            <div className="min-h-0 flex-1 overflow-auto">
              <EmptyState
                onImportClick={() => setShowImportDrawer(true)}
                onCreateClick={() => {
                  setCreateClientMode('manual');
                  setAddClientWithAi(false);
                  setSelectedClientId(null);
                  setShowAddClientDrawer(true);
                }}
              />
            </div>
          ) : (
            <div className="mb-0 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-indigo-100/60 bg-white/70 shadow-[0_12px_40px_-18px_rgba(59,130,246,0.18)] backdrop-blur-sm transition-shadow hover:shadow-[0_16px_48px_-14px_rgba(79,70,229,0.16)]">
              <div className="shrink-0 p-3 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-indigo-100/40 bg-gradient-to-br from-white via-indigo-50/25 to-violet-50/20">
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
                  <SmartSearchToggleButton
                    open={clientSmartSearch.open}
                    onToggle={() => clientSmartSearch.setOpen((value) => !value)}
                  />
                  <select
                    className={CLIENT_TOOLBAR_SELECT}
                    value={activeTab}
                    onChange={(e) => {
                      setCurrentPage(1);
                      setActiveTab(e.target.value);
                    }}
                  >
                    <option value="all">All stages</option>
                    {clientFieldVisibility.status ? (
                      <>
                        <option value="active">Active</option>
                        <option value="on-hold">On hold</option>
                        <option value="inactive">Inactive</option>
                      </>
                    ) : null}
                    {clientFieldVisibility.interestLevel ? <option value="hot">Hot</option> : null}
                  </select>
                  {clientFieldVisibility.assignedTo ? (
                    <SearchableToolbarFilterSelect
                      value={teamMemberFilterId}
                      onChange={(next) => {
                        setCurrentPage(1);
                        setTeamMemberFilterId(next);
                      }}
                      options={teamMembers.map((member) => ({
                        value: member.id,
                        label: member.name,
                        searchText: member.email || member.id,
                      }))}
                      placeholder="All team members"
                      allLabel="All team members"
                      className="w-[11.75rem]"
                      ariaLabel="Filter by team member"
                      searchPlaceholder="Search team members…"
                    />
                  ) : null}
                  <TableColumnsMenu
                    columns={CLIENT_TABLE_COLUMNS}
                    isVisible={clientColumnVisibility.isVisible}
                    onToggle={clientColumnVisibility.toggle}
                    onReset={clientColumnVisibility.resetToDefault}
                    unlockedVisibleCount={clientColumnVisibility.unlockedVisibleCount}
                    summaryClassName={CLIENT_TOOLBAR_SELECT}
                    dynamicSection={
                      availableDynamicColumnLabels.length > 0
                        ? {
                            title: 'Custom fields',
                            labels: availableDynamicColumnLabels,
                            selectedLabels: selectedDynamicColumnLabels,
                            onToggleLabel: (label) => {
                              setSelectedDynamicColumnLabels((prev) => {
                                const exists = prev.some(
                                  (item) => item.toLowerCase() === label.toLowerCase(),
                                );
                                return exists
                                  ? prev.filter((item) => item.toLowerCase() !== label.toLowerCase())
                                  : [...prev, label];
                              });
                            },
                          }
                        : undefined
                    }
                  />
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

              {clientSmartSearch.open ? (
                <div className="shrink-0">
                  <SmartSearchPromptPanel
                    prompt={clientSmartSearch.prompt}
                    onPromptChange={clientSmartSearch.setPrompt}
                    onApply={clientSmartSearch.handleApply}
                    previewKeywords={clientSmartSearch.previewKeywords}
                    examples={clientSmartSearch.examples}
                    onExampleClick={clientSmartSearch.handleExample}
                    entityLabel="clients"
                    applying={clientSmartSearch.applying}
                  />
                </div>
              ) : null}

              <div className="shrink-0">
                <SmartSearchActiveKeywordsBar
                  chips={clientSmartSearch.activeChips}
                  onClearAll={handleClearToolbar}
                  resultCount={pagedClients.length}
                  showResultCount={!loading && !error}
                />
              </div>

              <div className="ph2-table-body-scroll min-h-0 flex-1 overflow-auto">
                <ClientTable
                    clients={pagedClients}
                    dynamicColumnLabels={selectedDynamicColumnLabels}
                    getDynamicFieldValue={getClientDynamicFieldValue}
                    isColumnVisible={clientColumnVisibility.isVisible}
                    selectedIds={selectedClients}
                    onSelectionChange={setSelectedClients}
                    onSelectClient={(client) => {
                      setSelectedClientDrawerMode('view');
                      setSelectedClientId(client.id);
                    }}
                    onEditClient={(client) => {
                      setSelectedClientDrawerMode('edit');
                      setSelectedClientId(client.id);
                    }}
                    onDeleteClient={handleDeleteClient}
                    onLogoUpdated={handleRefresh}
                    canCreateJob={canCreateJob}
                    canSendToRecruitment={canSendToRecruitment && !isRecruitmentScope}
                    sendingToRecruitmentIds={sendingToRecruitmentIds}
                    onSendToRecruitment={
                      canSendToRecruitment && !isRecruitmentScope
                        ? (client) => {
                            void handleSendToRecruitment(client);
                          }
                        : undefined
                    }
                    clientStatusOptions={clientStatusOptions}
                    canUpdateClientStatus={canUpdateClient && clientFieldVisibility.status}
                    showStatusColumn={clientFieldVisibility.status}
                    showRecruiterColumn={clientFieldVisibility.assignedTo}
                    onClientStatusChange={(clientId, newStatus) => {
                      void handleInlineClientStatusChange(clientId, newStatus);
                    }}
                    onCreateJob={(client) => {
                      void handleCreateJobForClient(client);
                    }}
                    onHandoffClient={
                      canHandoffClient
                        ? (client) => setHandoffClient(client)
                        : undefined
                    }
                    getClientHandoffStatus={canHandoffClient ? getStatusForClient : undefined}
                    clientNameSortOrder={clientNameSortOrder}
                    clientSortBy={clientSortBy}
                    onToggleClientNameSortOrder={() => {
                      if (clientSortBy !== 'name') {
                        setClientSortBy('name');
                        setClientNameSortOrder('asc');
                        return;
                      }
                      setClientNameSortOrder((current) => (current === 'asc' ? 'desc' : 'asc'));
                    }}
                    workspaceAlertsByEntityId={workspaceAlertsByEntityId}
                    fillScrollParent
                  />
              </div>

              <div className="mt-0 w-full shrink-0 border-t border-indigo-100/50 bg-gradient-to-r from-slate-50/40 via-white to-indigo-50/25 px-3 py-2 sm:px-4">
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

        <SendToRecruitmentModal
          isOpen={Boolean(recruitmentForwardClient)}
          clientId={recruitmentForwardClient?.id ?? null}
          clientName={recruitmentForwardClient?.name ?? 'Client'}
          onClose={() => setRecruitmentForwardClient(null)}
          onSent={() => {
            if (recruitmentForwardClient?.id) {
              patchClientInList(recruitmentForwardClient.id, { recruitmentEnabled: true });
            }
            void fetchClients();
          }}
        />

        <ClientHandoffModal
          isOpen={Boolean(handoffClient)}
          clientId={handoffClient?.id ?? null}
          clientName={handoffClient?.name ?? 'Client'}
          onClose={() => setHandoffClient(null)}
          onSent={() => void refreshHandoffStatuses()}
          submitLabel={
            handoffClient && getStatusForClient(handoffClient.id).status === 'rejected'
              ? 'Resend handoff request'
              : undefined
          }
        />

        <ClientDetailsDrawer
          client={selectedClient}
          isAddMode={showAddClientDrawer}
          initialOpenAiChat={addClientWithAi}
          initialMode={selectedClientDrawerMode}
          defaultRecruitmentEnabled={isRecruitmentScope}
          onSendToRecruitment={
            canSendToRecruitment && !isRecruitmentScope
              ? (client) => {
                  void handleSendToRecruitment(client);
                }
              : undefined
          }
          sendingToRecruitment={
            selectedClient ? sendingToRecruitmentIds.includes(selectedClient.id) : false
          }
          onClose={() => {
            setSelectedClientId(null);
            setSelectedClientDrawerMode('view');
            setShowAddClientDrawer(false);
            setAddClientWithAi(false);
            if (searchParams.get('clientId')) {
              const sp = new URLSearchParams(searchParams.toString());
              sp.delete('clientId');
              pendingDeepLinkClientIdRef.current = null;
              const qs = sp.toString();
              router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
            }
          }}
          onDelete={(id) => {
            setSelectedClientId(null);
            handleDeleteClient(id);
          }}
          onClientUpdated={(patch) => {
            patchClientInList(patch.id, patch);
          }}
          onClientCreated={(created) => {
            setShowAddClientDrawer(false);
            setAddClientWithAi(false);
            setSelectedClientId(null);
            setActiveTab('all');
            setSelectedClients([]);
            setSearchQuery('');
            setDebouncedSearchQuery('');
            setSmartSearchClientIds([]);
            setTeamMemberFilterId('');
            setCurrentPage(1);
            if (created?.id && created.companyName) {
              const mapped = mapBackendClientToFrontend(created);
              mergeClientOptimistically({
                ...mapped,
                recruitmentEnabled: isRecruitmentScope ? true : mapped.recruitmentEnabled,
              });
            }
            void fetchClients({ page: 1, search: '', matchingClientIds: [] });
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
        <ClientImportDrawer
          isOpen={showImportDrawer}
          onClose={() => setShowImportDrawer(false)}
          recruitmentEnabled={isRecruitmentScope}
          onImportComplete={() => {
            setActiveTab('all');
            setSelectedClients([]);
            setSearchQuery('');
            setDebouncedSearchQuery('');
            setTeamMemberFilterId('');
            setCurrentPage(1);
            setSmartSearchClientIds([]);
            void fetchClients({ page: 1, search: '', matchingClientIds: [] });
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
              {clientFieldVisibility.assignedTo ? (
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
              ) : null}
              {clientFieldVisibility.status ? (
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
              ) : null}
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
        description="Preview export data below. Click X on a column header to remove it from the file."
        rowCount={exportClients.length}
        rowLabelSingular="client"
        rowLabelPlural="clients"
        loadingText="Loading all clients for export…"
        columns={exportColumns}
        rows={exportClients}
        isLoading={exportClientsLoading}
        getRowKey={(client) => client.id}
        onExport={handleExportClientsCsv}
      />
    </div>
  );
}
