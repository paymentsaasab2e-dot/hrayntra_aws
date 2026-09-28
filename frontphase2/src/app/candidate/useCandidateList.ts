// AUTO-SPLIT from page.tsx — moved code, no behavior change.
'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef, Suspense } from 'react';
import { CandidateTable, Candidate } from './components/CandidateTable';
import {
  CandidateTableFilters,
  type CandidateTableColumnFilters,
  EMPTY_CANDIDATE_TABLE_COLUMN_FILTERS,
} from './components/CandidateTableFilters';
import { BulkActions } from './components/BulkActions';

import type { CreatePlacementPayload } from '../../types/placement';
import {
  combineInterviewDateAndTimeToIso,
  mapInterviewUiTypeToBackend,
} from '../../lib/interview-schedule-helpers';
import type {
  InterviewCandidate,
  InterviewJob,
  InterviewPanelMember,
  ScheduleInterviewPayload,
} from '../../types/interview.types';

import { BULK_CV_TOKENS_CHANGED, getBulkCvTokenSession } from '../../lib/bulkCvTokensStore';

import {
  SmartSearchActiveKeywordsBar,
  SmartSearchPromptPanel,
  SmartSearchToggleButton,
} from '../../components/smart-search/SmartSearchToolbar';
import { useSmartSearch } from '../../hooks/useSmartSearch';
import { mapAiToCandidatesResult, parseSmartSearchWithAi } from '../../lib/smart-search/aiParser';
import { buildCandidatesListApiParams } from '../../lib/smart-search/entitySmartSearch';
import {
  CANDIDATES_SMART_SEARCH_EXAMPLES,
  candidateMatchesSmartKeywordChips,
  mergeCandidatesSmartSearchResult,
  parseCandidatesSmartSearchPrompt,
} from '../../lib/smart-search/parsers';
import {
  FAILED_BULK_RESUMES_CHANGED,
  getActiveFailedBulkResumes,
} from '../../lib/failedBulkResumesStore';
import type {
  CandidateInterviewerOption,
  CandidateProfileDrawerData,
  CandidateScheduledInterview,
  CandidatePipelineJobOption,
  CandidatePipelineRecruiterOption,
  CandidateTagItem,
} from '../../components/drawers/CandidateProfileDrawer';

import { useSubmitToClientModal } from '../../hooks/useSubmitToClientModal';
import {
  Plus,
  Upload,
  FileSpreadsheet,
  FileText,
  Download,
  Search,
  AlertCircle,
  Inbox,
  RefreshCcw,
  XCircle,
  Users,
  Coins,
  Sparkles,
  Lock,
} from 'lucide-react';
import { downloadCsv } from '../../utils/csv';
import { extractAuditMeta } from '../../utils/auditMeta';
import { formatDateDMY } from '../../utils/dateDisplay';
import { displayCandidateEmail, parseBulkCopyLabel } from '../../lib/bulkCvEmail';
import {
  collectCandidateWorkEntries,
  formatCandidateExperienceForTable,
  resolveCandidateExperienceYears,
} from '../../lib/candidateExperience';
import { ExportColumnsModal } from '../../components/export/ExportColumnsModal';
import { buildCandidatesCsvColumns, CANDIDATES_EXPORT_COLUMNS } from '../../lib/export/candidatesExportColumns';
import { TableColumnsMenu } from '../../components/table/TableColumnsMenu';
import { usePersistedColumnVisibility } from '../../hooks/usePersistedColumnVisibility';
import { CANDIDATE_TABLE_COLUMNS } from '../../lib/tableColumns/moduleTableColumns';
import { fetchAllPaginated, totalPagesFromPagination } from '../../lib/export/fetchAllPaginated';
import { CreateTaskModal } from '../../components/CreateTaskModal';
import { Toaster, toast } from 'sonner';
import PaginationAll from '../../components/PaginationAll';
import { TABLE_PAGE_SIZE_OPTIONS, type TablePageSize } from '../../constants/tablePagination';
import { requestConfirm, requestError, requestPrompt } from '../../lib/appDialog';
import { RECYCLE_BIN_SYNC_EVENT } from '../../constants/recycleBin';
import { parseClientsListFromResponse, parseJobsListFromResponse } from '../../lib/parseApiList';
import { dedupeCompanyNameLabels } from '../../lib/companyNameKey';
import { resolveCountryFilterLabel, getCscCountryOptions } from '../../lib/cscData';
import {
  apiAddCandidateNote,
  apiAddCandidateTag,
  apiAddCandidateToPipeline,
  apiRemoveCandidateFromPipeline,
  apiBulkActionCandidates,
  apiBulkCvListFailedResumes,
  apiDeleteCandidate,
  apiDeleteCandidateNote,
  apiGetCandidate,
  apiGetCandidates,
  apiGetClients,
  apiGetJobs,
  apiGetPipelineStages,
  apiMoveCandidateStage,
  apiPinCandidateNote,
  apiRejectCandidate,
  apiRemoveCandidateTag,
  apiCreateInterview,
  apiCreatePlacement,
  apiScheduleCandidateInterview,
  emitNotificationsUpdated,
  apiUpdateCandidate,
  apiUpdateCandidateInterview,
  apiUpdateCandidateNote,
  type BackendCandidate,
  type BackendJob,
  getCachedPhase1CommonPoolEnabled,
  ORG_RECRUITMENT_CACHE_EVENT,
} from '../../lib/api';
import { shouldIncludePhase1CommonPool } from '../../lib/phase1CommonPoolAccess';
import { getAllTeamMembersForAssign } from '../../lib/api/teamApi';
import { getActiveOrgUnitId } from '../../lib/org/orgWorkspaceStorage';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { usePermissions } from '../../hooks/usePermissions';
import { usePageAutoRefresh } from '../../hooks/usePageAutoRefresh';
import {
  isCandidatesListCacheFresh,
  readCandidatesListCache,
  writeCandidatesListCache,
  invalidateEmployerCandidatesCache,
} from '../../lib/employerPageCache';
import { effectiveCandidateSearchQuery } from '../../lib/candidateSearchGate';
import { useWorkspaceEntityAlerts } from '../../hooks/useWorkspaceEntityAlerts';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { AiCoinLockBadge, useAiCoinGate } from '../../components/coins/AiCoinGate';
import {
  PH2_TABLE_BODY_SCROLL_CLASS,
  PH2_TABLE_CARD_CLASS,
  PH2_TABLE_CARD_FOOTER_CLASS,
  PH2_TOOLBAR_FILTERS_CLASS,
  PH2_TOOLBAR_ROW_CLASS,
} from '../../components/layout/Ph2ModulePageLayout';
import {
  candidateShowsAppliedTag,
  resolveCandidateAssignedJobTitles,
  resolveCandidateListStage,
} from '../../lib/candidateListMapping';
import { normalizeCandidateSkillLabels } from '../../lib/normalizeCandidateSkills';
import {
  enrichBackendCandidateFromPhase1Snapshot,
  isPhase1PortalCandidate,
} from '../../lib/phase1ProfileSnapshot';
import {
  extractApiData,
  getTagColor,
  isValidObjectId,
  mapCandidateProfile,
  resolveCandidateDisplayName,
} from '../../lib/mapCandidateProfile';
import {
  candidateRowCanSubmitToClient,
  isInterviewPipelineStage,
  isOfferPipelineStage,
  isSubmitToClientStageOption,
  profileCanSubmitToClient,
  resolveSubmitJobIdForProfile,
  resolveSubmitJobIdForRow,
  resolveSubmitJobIdFromBackend,
  SUBMIT_TO_CLIENT_STAGE_OPTION_LABEL,
  SUBMIT_TO_CLIENT_STAGE_OPTION_VALUE,
} from '../../lib/candidateSubmitToClient';

'use client';


type CandidateListTab = 'all' | 'mine';

const CANDIDATE_LOCATION_COUNTRY_OPTIONS = getCscCountryOptions().map((row) => row.label);

export const CANDIDATE_TABLE_TAB_CLASS =
  'px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap';

const CANDIDATE_STAGE_API_MAP: Record<string, string> = {
  new: 'New',
  applied: 'Applied',
  longlist: 'Longlist',
  shortlist: 'Shortlist',
  screening: 'Screening',
  submitted: 'Submitted',
  'submit to client': 'Submit to Client',
  'submit-to-client': 'Submit to Client',
  interviewing: 'Interviewing',
  offered: 'Offered',
  hired: 'Hired',
  rejected: 'Rejected',
};

function readColumnFiltersFromSearchParams(
  searchParams: URLSearchParams,
): CandidateTableColumnFilters {
  return {
    company: searchParams.get('company') || '',
    experienceRange: searchParams.get('experienceRange') || '',
    location: searchParams.get('location') || '',
    jobId: searchParams.get('jobId') || '',
    stage: searchParams.get('tableStage') || '',
  };
}

function normalizeFilterOption(value?: string | null): string {
  const trimmed = String(value || '').trim();
  if (!trimmed || trimmed === '—') return '';
  return trimmed;
}

function extractBackendCandidatesList(
  payload: BackendCandidate[] | { data?: BackendCandidate[]; items?: BackendCandidate[]; pagination?: any } | undefined,
): BackendCandidate[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.items)) return payload.items;
  return [];
}

function extractCandidatesPaginationTotal(
  payload: { pagination?: { total?: number } } | BackendCandidate[] | undefined,
  fallbackLength: number,
): number {
  if (!payload || Array.isArray(payload)) return fallbackLength;
  const total = Number(payload.pagination?.total);
  return Number.isFinite(total) && total >= 0 ? total : fallbackLength;
}

/** Parallel warm batches: ~75–100 rows × 2–3 requests (same All/My filters). */
const CANDIDATE_WARM_BATCH_SIZE = 75;
const CANDIDATE_WARM_PARALLEL_BATCHES = 3;

function cacheCandidateUiPagesFromBatch(opts: {
  mapped: Candidate[];
  total: number;
  apiPage: number;
  batchSize: number;
  pageSize: number;
  tab: CandidateListTab;
  search: string;
  filterSig: string;
}) {
  const { mapped, total, apiPage, batchSize, pageSize, tab, search, filterSig } = opts;
  if (!mapped.length || pageSize <= 0) return;
  const baseIndex = (apiPage - 1) * batchSize;
  const pageCount = Math.ceil(mapped.length / pageSize);
  for (let i = 0; i < pageCount; i++) {
    const slice = mapped.slice(i * pageSize, (i + 1) * pageSize);
    if (!slice.length) continue;
    const uiPage = Math.floor(baseIndex / pageSize) + i + 1;
    writeCandidatesListCache({
      tab,
      page: uiPage,
      pageSize,
      search,
      filterSig,
      totalEntries: total,
      candidates: slice,
    });
  }
}

/** Location filter is country-only — never raw CV/location free text. */
function buildLocationFilterOptions(
  candidates: Candidate[],
  backendRows: BackendCandidate[],
  existingLocations: string[],
) {
  const countries = new Set<string>();

  const addCountry = (country?: string | null, location?: string | null) => {
    const label = resolveCountryFilterLabel({ country, location });
    if (label) countries.add(label);
  };

  for (const row of candidates) {
    addCountry(row.country, row.location);
  }

  for (const row of backendRows) {
    addCountry(row.country, row.location);
  }

  // Keep previously selected countries that are still valid CSC names
  for (const existing of existingLocations) {
    addCountry(existing, existing);
  }

  return Array.from(countries).sort((a, b) => a.localeCompare(b));
}

type CandidateJobFilterOption = { id: string; title: string };

function toJobFilterOptions(jobs: BackendJob[]): CandidateJobFilterOption[] {
  return jobs
    .filter((job) => job.id)
    .map((job) => ({
      id: String(job.id),
      title: String(job.title || 'Untitled job').trim() || 'Untitled job',
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

function clientNamesFromApiResponse(res: { data?: unknown }): string[] {
  return dedupeCompanyNameLabels(
    parseClientsListFromResponse(res)
      .map((client) => String(client.companyName || '').trim())
      .filter(Boolean),
  );
}

function flattenCandidateJsonForSearch(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(flattenCandidateJsonForSearch).join(' ');
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).map(flattenCandidateJsonForSearch).join(' ');
  }
  return '';
}

function mapBackendCandidate(raw: BackendCandidate): Candidate {
  const c = enrichBackendCandidateFromPhase1Snapshot(raw);
  const name = resolveCandidateDisplayName(c, { alreadyEnriched: true });
  const basicFullName = `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim();
  const assignedJobsFromAssignedTitles = resolveCandidateAssignedJobTitles(c);
  const workEntries = collectCandidateWorkEntries(c);
  // Never fall back to raw API experience — it can be ISO codes (e.g. 27001) or calendar years.
  const experienceYears = resolveCandidateExperienceYears(c) ?? 0;
  const skillLabels = normalizeCandidateSkillLabels(c.skills ?? (c as { recruiterSkills?: unknown }).recruiterSkills);

  return {
    id: c.id,
    name,
    avatar: (c.avatar && String(c.avatar).trim()) || '',
    designation: c.currentTitle || '',
    company: c.currentCompany || '',
    experience: experienceYears,
    experienceLabel: formatCandidateExperienceForTable(experienceYears, workEntries.length),
    location: c.location || '—',
    city: c.city || undefined,
    country: c.country || undefined,
    assignedJobs: assignedJobsFromAssignedTitles,
    stage: resolveCandidateListStage(c),
    owner: c.assignedTo?.name || 'Unassigned',
    lastActivity: (c.updatedAt || c.createdAt)
      ? formatDateDMY(c.updatedAt || c.createdAt)
      : '',
    hotlist: c.hotlist,
    phone: c.phone || '',
    email: c.email ?? '',
    skills: skillLabels,
    noticePeriod: '',
    salary: { current: '', expected: '' },
    source: c.source || '',
    rating: c.rating ?? 0,
    pipelineJobId: resolveSubmitJobIdFromBackend(c),
    isPhase1Candidate: isPhase1PortalCandidate(c),
    isNewCandidate: Boolean(c.isNewCandidate),
    isJobAppliedCandidate: c.isJobAppliedCandidate === true || candidateShowsAppliedTag(c),
    bulkCopyLabel: parseBulkCopyLabel(c.lastName || basicFullName),
    auditMeta: extractAuditMeta(c as unknown as Record<string, unknown>),
    assignedToId: c.assignedTo?.id || undefined,
    backendStatus: c.status || undefined,
    cvSummary: c.cvSummary || undefined,
    education: c.education || undefined,
    languagesList: c.languages || undefined,
    certificationsList: c.certifications || undefined,
    availability: c.availability || undefined,
    linkedIn: c.linkedIn || undefined,
    portfolio: c.portfolio || undefined,
    preferredLocation: c.preferredLocation || undefined,
    workExperienceText: flattenCandidateJsonForSearch(c.cvWorkExperienceEntries),
    projectsText: flattenCandidateJsonForSearch(c.cvPortfolioLinks),
  };
}



export function useCandidateList() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { hasPermission, hasAnyPermission } = usePermissions();
  const canCreateCandidate = hasAnyPermission(['candidates_create', 'add_candidate']);
  const canUpdateCandidate = hasAnyPermission(['candidates_update', 'edit_candidate', 'move_pipeline', 'submit_candidate']);
  const canSubmitToClient = hasAnyPermission(['submit_candidate', 'candidates_update', 'edit_candidate']);
  const canDeleteCandidate = hasAnyPermission(['candidates_delete', 'delete_candidate']);
  const canScheduleInterview = hasAnyPermission([
    'interviews_create',
    'candidates_update',
    'edit_candidate',
  ]);
  const canExportCandidate = hasPermission('export_data');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [isAddCandidateOpen, setIsAddCandidateOpen] = useState(false);
  const [candidateDrawerInitialTab, setCandidateDrawerInitialTab] = useState('manual');
  const [createCandidateMode, setCreateCandidateMode] = useState<'ai' | 'manual'>('manual');
  const candidateAiGate = useAiCoinGate('ai.candidate_chat');
  const [failedResumesDrawerOpen, setFailedResumesDrawerOpen] = useState(false);
  const [tokensDrawerOpen, setTokensDrawerOpen] = useState(false);
  const [repairNamesDrawerOpen, setRepairNamesDrawerOpen] = useState(false);
  const [bulkCvTokenResumeCount, setBulkCvTokenResumeCount] = useState(0);
  const [pendingBulkRetryFile, setPendingBulkRetryFile] = useState<File | null>(null);
  const [pendingBulkRetryFiles, setPendingBulkRetryFiles] = useState<File[] | null>(null);
  const [pendingBulkRetryServerIds, setPendingBulkRetryServerIds] = useState<string[] | null>(null);
  const [failedBulkResumeCount, setFailedBulkResumeCount] = useState(0);
  const [recycleBinModuleOpen, setRecycleBinModuleOpen] = useState(false);
  const [phase1CommonPoolEnabled, setPhase1CommonPoolEnabled] = useState(() =>
    typeof window !== 'undefined' ? getCachedPhase1CommonPoolEnabled() : true,
  );
  const [listTab, setListTab] = useState<CandidateListTab>(() => {
    const wantsMine = searchParams.get('tab') === 'mine';
    const phase1On =
      typeof window !== 'undefined' ? getCachedPhase1CommonPoolEnabled() : true;
    if (wantsMine || !phase1On) return 'mine';
    return 'all';
  });
  const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
    status: searchParams.get('status') || '',
  });
  const [candidates, setCandidates] = useState<Candidate[]>(() => {
    const tab = searchParams.get('tab') === 'mine' ? 'mine' : 'all';
    const cached = readCandidatesListCache(tab, 1, 50, searchParams.get('search') || '');
    return Array.isArray(cached?.data?.candidates) ? (cached.data.candidates as Candidate[]) : [];
  });
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportCandidates, setExportCandidates] = useState<Candidate[]>([]);
  const [exportCandidatesLoading, setExportCandidatesLoading] = useState(false);
  const [loading, setLoading] = useState(() => {
    const tab = searchParams.get('tab') === 'mine' ? 'mine' : 'all';
    const cached = readCandidatesListCache(tab, 1, 50, searchParams.get('search') || '');
    return !cached?.data?.candidates?.length;
  });
  const [tableLoading, setTableLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedCandidatesOnceRef = useRef(
    (() => {
      const tab = searchParams.get('tab') === 'mine' ? 'mine' : 'all';
      const cached = readCandidatesListCache(tab, 1, 50, searchParams.get('search') || '');
      return Boolean(cached?.data?.candidates?.length);
    })(),
  );
  const [columnFilters, setColumnFilters] = useState<CandidateTableColumnFilters>(() =>
    readColumnFiltersFromSearchParams(searchParams),
  );
  const [debouncedColumnFilters, setDebouncedColumnFilters] =
    useState<CandidateTableColumnFilters>(columnFilters);
  const [smartSearchCandidateIds, setSmartSearchCandidateIds] = useState<string[]>([]);
  const candidateColumnVisibility = usePersistedColumnVisibility(
    'candidates.visibleColumns',
    CANDIDATE_TABLE_COLUMNS,
  );

  useEffect(() => {
    // Discrete filters (stage / job / experience) apply immediately.
    // Debounce only while typing company or location.
    const textFieldsChanging =
      columnFilters.company !== debouncedColumnFilters.company ||
      columnFilters.location !== debouncedColumnFilters.location;
    const delay = textFieldsChanging ? 300 : 0;
    const timer = window.setTimeout(() => setDebouncedColumnFilters(columnFilters), delay);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when columnFilters change
  }, [columnFilters]);

  const [debouncedSearch, setDebouncedSearch] = useState(
    () => effectiveCandidateSearchQuery(searchParams.get('search') || ''),
  );
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(effectiveCandidateSearchQuery(filters.search));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [filters.search]);

  useEffect(() => {
    const syncPhase1Access = () => {
      setPhase1CommonPoolEnabled(getCachedPhase1CommonPoolEnabled());
    };
    syncPhase1Access();
    window.addEventListener(ORG_RECRUITMENT_CACHE_EVENT, syncPhase1Access);
    return () => window.removeEventListener(ORG_RECRUITMENT_CACHE_EVENT, syncPhase1Access);
  }, []);

  const [selectedCandidateProfile, setSelectedCandidateProfile] = useState<CandidateProfileDrawerData | null>(null);
  const [candidateDrawerOpen, setCandidateDrawerOpen] = useState(false);
  const [candidateDrawerMode, setCandidateDrawerMode] = useState<'view' | 'edit'>('view');
  const [candidateEditOpenToken, setCandidateEditOpenToken] = useState<number | null>(null);
  const pendingDeepLinkCandidateIdRef = useRef<string | null>(null);
  const loadCandidatesRequestIdRef = useRef(0);
  const loadCandidatesAbortRef = useRef<AbortController | null>(null);
  const candidatePrefetchGenRef = useRef(0);
  const [loadingCandidateProfile, setLoadingCandidateProfile] = useState(false);
  const [availableDrawerTags, setAvailableDrawerTags] = useState<CandidateTagItem[]>([]);
  const [pipelineJobs, setPipelineJobs] = useState<CandidatePipelineJobOption[]>([]);
  const [jobFilterOptions, setJobFilterOptions] = useState<CandidateJobFilterOption[]>([]);
  const [pipelineRecruiters, setPipelineRecruiters] = useState<CandidatePipelineRecruiterOption[]>([]);
  const [companyFilterOptions, setCompanyFilterOptions] = useState<string[]>([]);
  const [locationFilterOptions, setLocationFilterOptions] = useState<string[]>(
    () => CANDIDATE_LOCATION_COUNTRY_OPTIONS,
  );
  const companyFilterOptionsRef = useRef<string[]>([]);
  const locationFilterOptionsRef = useRef<string[]>([]);
  const [submitClientRowId, setSubmitClientRowId] = useState<string | null>(null);
  const { openSubmit, openBulkSubmit, submitModalElement } = useSubmitToClientModal({
    onClosed: () => setSubmitClientRowId(null),
  });
  /** Canonical job filter list from /jobs — not rebuilt from paginated candidate rows. */
  const jobFilterOptionsRef = useRef<CandidateJobFilterOption[]>([]);
  useEffect(() => {
    companyFilterOptionsRef.current = companyFilterOptions;
  }, [companyFilterOptions]);

  useEffect(() => {
    locationFilterOptionsRef.current = locationFilterOptions;
  }, [locationFilterOptions]);

  useEffect(() => {
    const selected = columnFilters.location.trim();
    if (!selected) return;
    const resolved = resolveCountryFilterLabel({ country: selected, location: selected });
    if (!resolved || resolved !== selected) {
      setColumnFilters((prev) => ({ ...prev, location: resolved || '' }));
    }
  }, [locationFilterOptions, columnFilters.location]);

  const [interviewPanelMembers, setInterviewPanelMembers] = useState<CandidateInterviewerOption[]>([]);
  const [bulkScheduleInterviewOpen, setBulkScheduleInterviewOpen] = useState(false);
  const [bulkScheduleCandidateIds, setBulkScheduleCandidateIds] = useState<string[]>([]);
  const [bulkSchedulePrefillJobId, setBulkSchedulePrefillJobId] = useState<string | null>(null);
  const [bulkScheduleJobs, setBulkScheduleJobs] = useState<InterviewJob[]>([]);
  /** Centered Schedule Interview popup (stage → Interviewing). */
  const [stageScheduleOpen, setStageScheduleOpen] = useState(false);
  const [stageScheduleCandidate, setStageScheduleCandidate] = useState<{
    id: string;
    name: string;
    phone: string | null;
    stage: string | null;
    assignedJob: string | null;
    assignedJobId: string | null;
  } | null>(null);
  const [stageScheduleJobId, setStageScheduleJobId] = useState<string | null>(null);
  /** Stage move deferred until Schedule Interview / Placement succeeds. */
  const [pendingStageAfterWorkflow, setPendingStageAfterWorkflow] = useState<{
    candidateIds: string[];
    jobId: string;
    stageId: string;
    stageName: string;
    kind: 'interview' | 'offer';
  } | null>(null);
  const [placementDrawerOpen, setPlacementDrawerOpen] = useState(false);
  const [placementSubmitting, setPlacementSubmitting] = useState(false);
  const [placementPrefill, setPlacementPrefill] = useState<{
    candidateId?: string;
    jobId?: string;
    companyId?: string;
    recruiterId?: string;
  } | null>(null);
  const [bulkMoveStageOpen, setBulkMoveStageOpen] = useState(false);
  const [bulkMoveStageJobId, setBulkMoveStageJobId] = useState('');
  const [bulkMoveStageStageId, setBulkMoveStageStageId] = useState('');
  const [bulkMoveStageNote, setBulkMoveStageNote] = useState('');
  const [bulkMoveStageOptions, setBulkMoveStageOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [bulkMoveStageLoading, setBulkMoveStageLoading] = useState(false);
  const [bulkMoveStageSaving, setBulkMoveStageSaving] = useState(false);
  const [bulkAssignJobOpen, setBulkAssignJobOpen] = useState(false);
  const [bulkAssignJobJobId, setBulkAssignJobJobId] = useState('');
  const [bulkAssignJobStageId, setBulkAssignJobStageId] = useState('');
  const [bulkAssignJobNote, setBulkAssignJobNote] = useState('');
  const [bulkAssignJobOptions, setBulkAssignJobOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [bulkAssignJobLoading, setBulkAssignJobLoading] = useState(false);
  const [bulkAssignJobSaving, setBulkAssignJobSaving] = useState(false);
  const [deletingCandidateId, setDeletingCandidateId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<TablePageSize>(25);
  const [totalEntries, setTotalEntries] = useState(() => {
    const tab = searchParams.get('tab') === 'mine' ? 'mine' : 'all';
    const cached = readCandidatesListCache(tab, 1, 50, searchParams.get('search') || '');
    return typeof cached?.data?.totalEntries === 'number' ? cached.data.totalEntries : 0;
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  const candidatesFilterSig = useMemo(() => {
    const stageKey = debouncedColumnFilters.stage
      ? debouncedColumnFilters.stage.toLowerCase()
      : '';
    return [
      `company=${debouncedColumnFilters.company || ''}`,
      `location=${debouncedColumnFilters.location || ''}`,
      `jobId=${debouncedColumnFilters.jobId || ''}`,
      `experience=${debouncedColumnFilters.experienceRange || ''}`,
      `stage=${stageKey || ''}`,
      `status=${!debouncedColumnFilters.stage && filters.status ? filters.status : ''}`,
      `common=${listTab === 'all' && shouldIncludePhase1CommonPool() ? '1' : '0'}`,
      `smart=${(smartSearchCandidateIds || []).join(',')}`,
    ].join('&');
  }, [
    debouncedColumnFilters,
    filters.status,
    listTab,
    smartSearchCandidateIds,
  ]);
  const [inlineStageOptionsByJobId, setInlineStageOptionsByJobId] = useState<
    Record<string, Array<{ id: string; name: string }>>
  >({});
  const [inlineStageOptionsLoadingJobId, setInlineStageOptionsLoadingJobId] = useState<string | null>(null);
  const [inlineStageUpdatingCandidateId, setInlineStageUpdatingCandidateId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{
    _id: string;
    name: string;
    email: string;
    role?: string;
  } | null>(null);
  const currentDrawerUser = useMemo(
    () => ({
      id: 'current-user',
      name: selectedCandidateProfile?.recruiter || 'You',
      avatar: null as string | null,
    }),
    [selectedCandidateProfile?.recruiter]
  );

  const openCandidateDrawer = useCallback((tab: 'manual' | 'resume' | 'csv' | 'bulkResume') => {
    setCandidateDrawerInitialTab(tab);
    setIsAddCandidateOpen(true);
  }, []);

  const refreshFailedBulkResumeCount = useCallback(() => {
    if (typeof window === 'undefined') return;
    const localCount = getActiveFailedBulkResumes().length;
    setFailedBulkResumeCount(localCount);
    void apiBulkCvListFailedResumes()
      .then((listed) => {
        const serverCount = Number(listed.count || listed.items?.length || 0);
        // Prefer server count when available; keep local-only leftovers in the max.
        setFailedBulkResumeCount(Math.max(serverCount, localCount));
      })
      .catch(() => {
        /* keep local count */
      });
  }, []);

  const refreshBulkCvTokenCount = useCallback(() => {
    if (typeof window === 'undefined') return;
    const session = getBulkCvTokenSession();
    setBulkCvTokenResumeCount(session?.records?.length ?? 0);
  }, []);

  useEffect(() => {
    refreshFailedBulkResumeCount();
    refreshBulkCvTokenCount();
  }, [refreshFailedBulkResumeCount, refreshBulkCvTokenCount]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onFailedBulkChanged = () => refreshFailedBulkResumeCount();
    window.addEventListener(FAILED_BULK_RESUMES_CHANGED, onFailedBulkChanged);
    return () => window.removeEventListener(FAILED_BULK_RESUMES_CHANGED, onFailedBulkChanged);
  }, [refreshFailedBulkResumeCount]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onTokensChanged = () => refreshBulkCvTokenCount();
    window.addEventListener(BULK_CV_TOKENS_CHANGED, onTokensChanged);
    return () => window.removeEventListener(BULK_CV_TOKENS_CHANGED, onTokensChanged);
  }, [refreshBulkCvTokenCount]);

  const handleBulkRetryFileConsumed = useCallback(() => {
    setPendingBulkRetryFile(null);
    setPendingBulkRetryFiles(null);
    setPendingBulkRetryServerIds(null);
  }, []);

  const handleFailedResumeReupload = useCallback((file: File) => {
    setPendingBulkRetryFiles(null);
    setPendingBulkRetryServerIds(null);
    setPendingBulkRetryFile(file);
    setFailedResumesDrawerOpen(false);
    setCandidateDrawerInitialTab('bulkResume');
    setIsAddCandidateOpen(true);
  }, []);

  const handleFailedResumeRetryFiles = useCallback((files: File[], serverIds?: string[]) => {
    if (!files.length) return;
    setPendingBulkRetryFile(null);
    setPendingBulkRetryFiles(files);
    setPendingBulkRetryServerIds(Array.isArray(serverIds) ? serverIds : null);
    setFailedResumesDrawerOpen(false);
    setCandidateDrawerInitialTab('bulkResume');
    setIsAddCandidateOpen(true);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const storedUser = localStorage.getItem('currentUser');
      if (!storedUser) return;
      const parsed = JSON.parse(storedUser);
      setCurrentUser({
        _id: parsed.id || parsed._id || '',
        name: parsed.name || 'You',
        email: parsed.email || '',
        role: parsed.role,
      });
    } catch (storageError) {
      console.error('Failed to parse current user from storage:', storageError);
    }
  }, []);

  const syncCandidateCard = useCallback((profile: CandidateProfileDrawerData) => {
    const profileStage = String(profile.stage || '').trim();
    const appliedForJob =
      profileStage.toLowerCase() === 'applied' ||
      (Array.isArray(profile.assignedJobs) && profile.assignedJobs.length > 0);
    setCandidates((prev) =>
      prev.map((candidate) =>
        candidate.id === profile.id
          ? {
              ...candidate,
              name: profile.name || candidate.name,
              stage: profile.stage || candidate.stage,
              owner: profile.recruiter || candidate.owner,
              isJobAppliedCandidate: appliedForJob,
              isNewCandidate: !appliedForJob && profileStage.toLowerCase() === 'new',
              assignedJobs:
                Array.isArray(profile.assignedJobs) && profile.assignedJobs.length
                  ? profile.assignedJobs.map((row) => row.title).filter(Boolean)
                  : profile.assignedJob && profile.assignedJob !== '—'
                    ? [profile.assignedJob]
                    : [],
              designation: profile.designation || candidate.designation,
              company: profile.currentCompany || candidate.company,
              experience: profile.experience ?? candidate.experience,
              experienceLabel: formatCandidateExperienceForTable(
                profile.experience ?? candidate.experience,
                profile.cvWorkExperienceEntries?.length ?? 0,
              ),
              location: profile.location || candidate.location,
              phone: profile.phone || candidate.phone,
              email: profile.email || candidate.email,
              source: profile.source || candidate.source,
              lastActivity: formatDateDMY(new Date()),
            }
          : candidate
      )
    );
  }, []);

  const loadCandidateProfile = useCallback(
    async (candidateId: string) => {
      if (!isValidObjectId(candidateId)) {
        // Demo or invalid ID – don't call API (backend expects MongoDB ObjectID)
        return null;
      }
      const backendCandidate = extractApiData<BackendCandidate>(await apiGetCandidate(candidateId));
      const mappedProfile = mapCandidateProfile(backendCandidate);
      setSelectedCandidateProfile(mappedProfile);
      syncCandidateCard(mappedProfile);
      return mappedProfile;
    },
    [syncCandidateCard]
  );

  useEffect(() => {
    const onCandidatesChanged = () => {
      const openId = selectedCandidateProfile?.id;
      if (!openId || !isValidObjectId(openId)) return;
      void loadCandidateProfile(openId);
    };
    window.addEventListener('jobportal:candidates-changed', onCandidatesChanged);
    return () => window.removeEventListener('jobportal:candidates-changed', onCandidatesChanged);
  }, [loadCandidateProfile, selectedCandidateProfile?.id]);

  useEffect(() => {
    const candidateId = searchParams.get('candidateId');
    if (!candidateId) {
      pendingDeepLinkCandidateIdRef.current = null;
      return;
    }
    // Only react when the URL parameter itself changes. Without this guard,
    // closing the drawer used to re-fire this effect (because the drawer-open
    // and selected-profile state both reset) and immediately reopen it.
    if (pendingDeepLinkCandidateIdRef.current === candidateId) {
      return;
    }
    pendingDeepLinkCandidateIdRef.current = candidateId;

    let cancelled = false;
    void (async () => {
      try {
        const profile = await loadCandidateProfile(candidateId);
        if (cancelled || !profile) return;
        setCandidateDrawerMode('view');
        setCandidateDrawerOpen(true);
      } catch (error) {
        console.error('Failed to open candidate from search:', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadCandidateProfile, searchParams]);

  const loadCandidates = useCallback(async (opts?: {
    silent?: boolean;
    /** Use when switching tabs before React state has flushed */
    tab?: CandidateListTab;
    page?: number;
  }) => {
    const silent = opts?.silent === true;
    const activeListTab = opts?.tab ?? listTab;
    const activePage = opts?.page ?? currentPage;
    const isFirstLoad = !hasLoadedCandidatesOnceRef.current;
    const requestId = ++loadCandidatesRequestIdRef.current;
    loadCandidatesAbortRef.current?.abort();
    const abortController = new AbortController();
    loadCandidatesAbortRef.current = abortController;
    // Cancel in-flight progressive prefetch on user-visible reloads (tab/filter/page).
    const prefetchGen = ++candidatePrefetchGenRef.current;
    try {
      if (!silent) {
        if (isFirstLoad) {
          setLoading(true);
          setError(null);
        } else {
          setTableLoading(true);
        }
      }

      const stageKey = debouncedColumnFilters.stage
        ? debouncedColumnFilters.stage.toLowerCase()
        : '';
      const listFilterBits = {
        search: debouncedSearch || undefined,
        company: debouncedColumnFilters.company || undefined,
        location: debouncedColumnFilters.location || undefined,
        jobId: debouncedColumnFilters.jobId || undefined,
        experienceRange: debouncedColumnFilters.experienceRange || undefined,
        stage: stageKey
          ? CANDIDATE_STAGE_API_MAP[stageKey] || debouncedColumnFilters.stage
          : undefined,
        status: !debouncedColumnFilters.stage && filters.status ? filters.status : undefined,
        // Keep All vs My scope on every batch.
        mine: activeListTab === 'mine',
        ...(activeListTab === 'all' && shouldIncludePhase1CommonPool()
          ? { includeCommonPool: true }
          : { includeCommonPool: false }),
        matchingCandidateIds: smartSearchCandidateIds,
      };

      const useWarmParallel =
        !smartSearchCandidateIds?.length &&
        activePage === 1 &&
        pageSize <= CANDIDATE_WARM_BATCH_SIZE;

      const paintPage = (
        mapped: Candidate[],
        backendRows: BackendCandidate[],
        total: number,
      ) => {
        if (requestId !== loadCandidatesRequestIdRef.current) return;
        setCandidates(mapped);
        hasLoadedCandidatesOnceRef.current = true;
        setTotalEntries(total);
        writeCandidatesListCache({
          tab: activeListTab,
          page: activePage,
          pageSize,
          search: debouncedSearch || '',
          filterSig: candidatesFilterSig,
          totalEntries: total,
          candidates: mapped,
        });
        setLocationFilterOptions((prev) =>
          buildLocationFilterOptions(mapped, backendRows, prev),
        );
        if (!silent) {
          setLoading(false);
          setTableLoading(false);
        }
      };

      if (useWarmParallel) {
        // 2–3 parallel batches (~75 each). Paint UI page 1 as soon as batch 1 returns;
        // remaining batches warm page cache for instant next/prev.
        const batchSize = CANDIDATE_WARM_BATCH_SIZE;
        const batchCount = CANDIDATE_WARM_PARALLEL_BATCHES;
        const batchPromises = Array.from({ length: batchCount }, (_, idx) => {
          const apiPage = idx + 1;
          const queryParams = buildCandidatesListApiParams({
            page: apiPage,
            limit: batchSize,
            ...listFilterBits,
          });
          return apiGetCandidates(queryParams, { signal: abortController.signal })
            .then((res) => {
              const payload = res.data as
                | BackendCandidate[]
                | { data?: BackendCandidate[]; items?: BackendCandidate[]; pagination?: any }
                | undefined;
              const backendCandidates = extractBackendCandidatesList(payload);
              const mapped = backendCandidates.map(mapBackendCandidate);
              const total = extractCandidatesPaginationTotal(payload as any, mapped.length);
              return { apiPage, mapped, backendCandidates, total };
            })
            // Always attach a handler so abort of sibling batches never becomes an
            // unhandled rejection (Next.js Runtime ApiRequestError overlay).
            .catch((err: unknown) => {
              const kind = (err as { kind?: string } | null)?.kind;
              const name = (err as { name?: string } | null)?.name;
              if (
                abortController.signal.aborted ||
                kind === 'abort' ||
                name === 'AbortError'
              ) {
                return null;
              }
              throw err;
            });
        });

        const settled = await Promise.allSettled(batchPromises);
        if (requestId !== loadCandidatesRequestIdRef.current) return;

        const firstOk = settled.find(
          (row): row is PromiseFulfilledResult<{
            apiPage: number;
            mapped: Candidate[];
            backendCandidates: BackendCandidate[];
            total: number;
          } | null> =>
            row.status === 'fulfilled' && row.value != null && row.value.apiPage === 1,
        );
        const first =
          firstOk?.value ||
          settled.find(
            (row): row is PromiseFulfilledResult<{
              apiPage: number;
              mapped: Candidate[];
              backendCandidates: BackendCandidate[];
              total: number;
            } | null> => row.status === 'fulfilled' && row.value != null,
          )?.value;

        if (!first) {
          const rejected = settled.find((row) => row.status === 'rejected') as
            | PromiseRejectedResult
            | undefined;
          if (rejected?.reason) throw rejected.reason;
          return;
        }

        const uiSlice = first.mapped.slice(0, pageSize);
        paintPage(uiSlice, first.backendCandidates.slice(0, pageSize), first.total);
        cacheCandidateUiPagesFromBatch({
          mapped: first.mapped,
          total: first.total,
          apiPage: first.apiPage,
          batchSize,
          pageSize,
          tab: activeListTab,
          search: debouncedSearch || '',
          filterSig: candidatesFilterSig,
        });

        for (const result of settled) {
          if (result.status !== 'fulfilled' || !result.value) continue;
          if (result.value.apiPage === first.apiPage) continue;
          if (prefetchGen !== candidatePrefetchGenRef.current) break;
          cacheCandidateUiPagesFromBatch({
            mapped: result.value.mapped,
            total: result.value.total || first.total,
            apiPage: result.value.apiPage,
            batchSize,
            pageSize,
            tab: activeListTab,
            search: debouncedSearch || '',
            filterSig: candidatesFilterSig,
          });
        }
        return;
      }

      // Non–page-1 (or smart-search ids): current page + parallel warm of ±1 neighbor.
      const queryParams = buildCandidatesListApiParams({
        page: activePage,
        limit: pageSize,
        ...listFilterBits,
      });
      const res = await apiGetCandidates(queryParams, { signal: abortController.signal });
      const payload = res.data as
        | BackendCandidate[]
        | { data?: BackendCandidate[]; items?: BackendCandidate[]; pagination?: any }
        | undefined;
      const backendCandidates = extractBackendCandidatesList(payload);
      if (!Array.isArray(backendCandidates)) {
        if (requestId !== loadCandidatesRequestIdRef.current) return;
        if (!silent) {
          setError('Unexpected API response format.');
          setCandidates([]);
          setTotalEntries(0);
        }
        return;
      }
      const mapped = backendCandidates.map(mapBackendCandidate);
      const total = extractCandidatesPaginationTotal(payload as any, mapped.length);
      paintPage(mapped, backendCandidates, total);

      if (!smartSearchCandidateIds?.length) {
        const neighbors = [activePage - 1, activePage + 1].filter((p) => p >= 1);
        void Promise.allSettled(
          neighbors.map((p) => {
            const qp = buildCandidatesListApiParams({
              page: p,
              limit: pageSize,
              ...listFilterBits,
            });
            return apiGetCandidates(qp, { signal: abortController.signal })
              .then((warmRes) => {
                const warmPayload = warmRes.data as
                  | BackendCandidate[]
                  | { data?: BackendCandidate[]; items?: BackendCandidate[]; pagination?: any }
                  | undefined;
                const warmBackend = extractBackendCandidatesList(warmPayload);
                const warmMapped = warmBackend.map(mapBackendCandidate);
                const warmTotal = extractCandidatesPaginationTotal(warmPayload as any, total);
                if (
                  requestId !== loadCandidatesRequestIdRef.current ||
                  prefetchGen !== candidatePrefetchGenRef.current
                ) {
                  return;
                }
                writeCandidatesListCache({
                  tab: activeListTab,
                  page: p,
                  pageSize,
                  search: debouncedSearch || '',
                  filterSig: candidatesFilterSig,
                  totalEntries: warmTotal,
                  candidates: warmMapped,
                });
              })
              .catch(() => null);
          }),
        );
      }
    } catch (err: any) {
      if (requestId !== loadCandidatesRequestIdRef.current) return;
      if (
        abortController.signal.aborted ||
        err?.name === 'AbortError' ||
        err?.kind === 'abort' ||
        /request was cancelled/i.test(String(err?.message || ''))
      ) {
        return;
      }
      const message = err?.message || 'Failed to load candidates.';
      if (!silent) {
        if (!hasLoadedCandidatesOnceRef.current) {
          setError(message);
          setCandidates([]);
          setTotalEntries(0);
        }
      }
      toast.error(message);
    } finally {
      // Only the latest request may clear spinners. Always clear both flags so a
      // newer silent refresh cannot leave tableLoading stuck from an older call.
      if (requestId !== loadCandidatesRequestIdRef.current) return;
      setLoading(false);
      setTableLoading(false);
    }
  }, [debouncedSearch, filters.status, debouncedColumnFilters, currentPage, pageSize, listTab, smartSearchCandidateIds, candidatesFilterSig]);

  const handleRepairBadNames = useCallback(() => {
    setRepairNamesDrawerOpen(true);
  }, []);

  const switchListTab = useCallback(
    (tab: CandidateListTab) => {
      const nextTab = tab === 'all' && !shouldIncludePhase1CommonPool() ? 'mine' : tab;
      if (nextTab === listTab && currentPage === 1) return;

      // Show cached rows immediately so the tab feels instant; the loadCandidates
      // effect (driven by listTab/currentPage) performs a single network refresh.
      const cached = readCandidatesListCache(
        nextTab,
        1,
        pageSize,
        debouncedSearch || '',
        candidatesFilterSig,
      );
      const cachedRows = cached?.data?.candidates;
      if (cached && Array.isArray(cachedRows) && cachedRows.length > 0) {
        setCandidates(cachedRows as Candidate[]);
        setTotalEntries(cached.data?.totalEntries || cachedRows.length);
        setTableLoading(false);
        setLoading(false);
      } else {
        setTableLoading(true);
      }

      setListTab(nextTab);
      setCurrentPage(1);
    },
    [listTab, currentPage, pageSize, debouncedSearch, candidatesFilterSig],
  );

  useEffect(() => {
    if (!phase1CommonPoolEnabled && listTab === 'all') {
      switchListTab('mine');
    }
  }, [phase1CommonPoolEnabled, listTab, switchListTab]);

  const refreshJobFilterOptions = useCallback(async () => {
    try {
      const res = await apiGetJobs({ page: 1, limit: 100 });
      const jobs = toJobFilterOptions(parseJobsListFromResponse(res));
      if (jobs.length > 0 || jobFilterOptionsRef.current.length === 0) {
        jobFilterOptionsRef.current = jobs;
        setJobFilterOptions(jobs);
      }
    } catch (err) {
      console.error('Failed to refresh job filter options:', err);
    }
  }, []);

  useEffect(() => {
    const cached = readCandidatesListCache(
      listTab,
      currentPage,
      pageSize,
      debouncedSearch || '',
      candidatesFilterSig,
    );
    const cachedRows = cached?.data?.candidates;
    if (Array.isArray(cachedRows) && cachedRows.length > 0) {
      setCandidates(cachedRows as Candidate[]);
      if (typeof cached?.data?.totalEntries === 'number') {
        setTotalEntries(cached.data.totalEntries);
      }
      setLoading(false);
      setTableLoading(false);
    }
    void loadCandidates({ silent: Boolean(cachedRows?.length) });
  }, [loadCandidates]);

  // Reusable auto-refresh: polls while visible, refreshes on tab focus and on
  // candidate / job-pipeline change events.
  const candidatesAutoLoad = useCallback(
    ({ silent }: { silent: boolean }) => loadCandidates({ silent }),
    [loadCandidates],
  );
  usePageAutoRefresh(candidatesAutoLoad, {
    events: ['jobportal:candidates-changed', 'jobportal:jobs-changed'],
    intervalMs: 45_000,
    shouldSkip: () =>
      isCandidatesListCacheFresh(
        readCandidatesListCache(
          listTab,
          currentPage,
          pageSize,
          debouncedSearch || '',
          candidatesFilterSig,
        ),
      ),
  });

  useEffect(() => {
    const onJobsChanged = () => {
      void refreshJobFilterOptions();
    };
    window.addEventListener('jobportal:jobs-changed', onJobsChanged);
    return () => {
      window.removeEventListener('jobportal:jobs-changed', onJobsChanged);
    };
  }, [refreshJobFilterOptions]);

  const hasTableColumnFilters = Boolean(
    columnFilters.company.trim() ||
      columnFilters.location.trim() ||
      columnFilters.experienceRange ||
      columnFilters.jobId ||
      columnFilters.stage,
  );

  const candidateSmartSearchOptions = useMemo(
    () => ({
      jobs: jobFilterOptions.map((job) => ({ id: job.id, name: job.title })),
      recruiters: pipelineRecruiters.map((recruiter) => ({ id: recruiter.id, name: recruiter.name })),
      companies: companyFilterOptions,
    }),
    [companyFilterOptions, jobFilterOptions, pipelineRecruiters],
  );

  const candidateSmartSearch = useSmartSearch({
    parsePrompt: (text) => parseCandidatesSmartSearchPrompt(text, candidateSmartSearchOptions),
    parsePromptWithAi: async (text) => {
      const local = parseCandidatesSmartSearchPrompt(text, candidateSmartSearchOptions);
      const ai = await parseSmartSearchWithAi('candidates', text, { useTenantDatabase: true }, mapAiToCandidatesResult);
      if (!ai) return null;
      return mergeCandidatesSmartSearchResult(local, ai);
    },
    applyParsed: (parsed) => {
      setCurrentPage(1);
      const stageChip = parsed.keywords.find((chip) => chip.kind === 'stage');
      const statusChip = parsed.keywords.find((chip) => chip.kind === 'status');
      const jobChip = parsed.keywords.find((chip) => chip.kind === 'client');
      setFilters((prev) => ({
        ...prev,
        search: [parsed.searchText, parsed.source].filter(Boolean).join(' ').trim(),
        status: parsed.status || statusChip?.value || '',
      }));
      setColumnFilters({
        stage: parsed.stage || stageChip?.value || '',
        company: parsed.company || '',
        location: parsed.location || '',
        jobId: parsed.jobId || jobChip?.value || '',
        experienceRange: parsed.experienceRange || '',
      });
      setSmartSearchCandidateIds(
        parsed.matchingCandidateIds && parsed.matchingCandidateIds.length > 0
          ? parsed.matchingCandidateIds
          : [],
      );
    },
    onRemoveKeyword: (removed, remaining) => {
      setCurrentPage(1);
      if (removed.kind === 'stage') {
        setColumnFilters((prev) => ({ ...prev, stage: '' }));
      }
      if (removed.kind === 'status') {
        setFilters((prev) => ({ ...prev, status: '' }));
      }
      if (removed.kind === 'client') {
        setColumnFilters((prev) => ({ ...prev, jobId: '' }));
      }
      if (removed.kind === 'text') {
        setColumnFilters((prev) => {
          const next = { ...prev };
          if (removed.value === prev.company) next.company = '';
          if (removed.value === prev.location) next.location = '';
          if (removed.value === prev.experienceRange) next.experienceRange = '';
          return next;
        });
        const text = remaining
          .filter((keyword) => keyword.kind === 'text')
          .map((keyword) => keyword.value)
          .join(' ');
        setFilters((prev) => ({ ...prev, search: text }));
      }
    },
    examples: CANDIDATES_SMART_SEARCH_EXAMPLES,
  });

  const hasToolbarFilters = Boolean(
    smartSearchCandidateIds.length > 0 ||
    filters.search.trim() ||
      filters.status ||
      hasTableColumnFilters ||
      candidateSmartSearch.activeKeywords.length > 0,
  );

  const handleClearToolbar = useCallback(() => {
    setFilters({ search: '', status: '' });
    setColumnFilters(EMPTY_CANDIDATE_TABLE_COLUMN_FILTERS);
    setSmartSearchCandidateIds([]);
    candidateSmartSearch.clearSmartSearch();
    setCurrentPage(1);
  }, [candidateSmartSearch]);

  const handleColumnFiltersChange = useCallback((next: CandidateTableColumnFilters) => {
    setCurrentPage(1);
    setColumnFilters(next);
    if (next.stage) {
      setFilters((prev) => ({ ...prev, status: '' }));
    }
  }, []);

  // Update URL params when filters or stage change
  useEffect(() => {
    const params = new URLSearchParams();
    if (listTab === 'mine') params.set('tab', 'mine');
    if (filters.search) params.set('search', filters.search);
    if (filters.status) params.set('status', filters.status);
    if (columnFilters.company) params.set('company', columnFilters.company);
    if (columnFilters.location) params.set('location', columnFilters.location);
    if (columnFilters.experienceRange) params.set('experienceRange', columnFilters.experienceRange);
    if (columnFilters.jobId) params.set('jobId', columnFilters.jobId);
    if (columnFilters.stage) params.set('tableStage', columnFilters.stage);
    router.replace(`/candidate?${params.toString()}`, { scroll: false });
  }, [listTab, filters, columnFilters, router]);

  useEffect(() => {
    let cancelled = false;

    async function loadPipelineOptions() {
      try {
        const [allJobsRes, clientsRes, candidateMembers, interviewMembers] = await Promise.all([
          apiGetJobs({ page: 1, limit: 100 }),
          apiGetClients({ page: 1, limit: 100, recruitmentEnabled: true }),
          getAllTeamMembersForAssign(getActiveOrgUnitId() || undefined, 'Candidates'),
          getAllTeamMembersForAssign(getActiveOrgUnitId() || undefined, 'Interviews'),
        ]);
        if (cancelled) return;

        const allJobsParsed = parseJobsListFromResponse(allJobsRes);
        const allJobsForFilter = toJobFilterOptions(allJobsParsed);
        const clientNames = clientNamesFromApiResponse(clientsRes);

        const memberName = (m: (typeof candidateMembers)[number]) =>
          [m.firstName, m.lastName].filter(Boolean).join(' ').trim() || m.email;
        const memberAvatar = (m: (typeof candidateMembers)[number]) => (m as { avatar?: string | null }).avatar || null;

        setPipelineJobs(
          allJobsParsed
            .filter((job) => job.id)
            .map((job) => ({
              id: String(job.id),
              title: String(job.title || 'Untitled job').trim() || 'Untitled job',
              department: job.department || job.client?.companyName || null,
              clientId: job.client?.id || (job as { clientId?: string }).clientId || null,
              clientName: job.client?.companyName || null,
            }))
            .sort((a, b) => a.title.localeCompare(b.title)),
        );

        if (allJobsForFilter.length > 0 || jobFilterOptionsRef.current.length === 0) {
          jobFilterOptionsRef.current = allJobsForFilter;
          setJobFilterOptions(allJobsForFilter);
        }
        // Only real CRM clients — never candidate currentCompany / employer text.
        setCompanyFilterOptions(clientNames);

        setPipelineRecruiters(
          candidateMembers.map((m) => ({
            id: m.id,
            name: memberName(m),
            avatar: memberAvatar(m),
          }))
        );

        setInterviewPanelMembers(
          interviewMembers.map((m) => ({
            id: m.id,
            name: memberName(m),
            role: m.role?.roleName || '',
            department: m.department?.name || '',
            avatar: memberAvatar(m),
          }))
        );
      } catch (optionError) {
        console.error('Failed to load pipeline options:', optionError);
      }
    }

    loadPipelineOptions();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredCandidates = useMemo(() => {
    if (candidateSmartSearch.activeKeywords.length === 0) return candidates;
    return candidates.filter((candidate) =>
      candidateMatchesSmartKeywordChips(
        {
          name: candidate.name,
          email: candidate.email,
          phone: candidate.phone,
          designation: candidate.designation,
          company: candidate.company,
          experience: candidate.experience,
          location: candidate.location,
          city: candidate.city,
          country: candidate.country,
          stage: candidate.stage,
          owner: candidate.owner,
          assignedToId: candidate.assignedToId,
          source: candidate.source,
          backendStatus: candidate.backendStatus,
          skills: candidate.skills,
          availability: candidate.availability,
          noticePeriod: candidate.noticePeriod,
          education: candidate.education,
          cvSummary: candidate.cvSummary,
          languages: candidate.languagesList,
          certifications: candidate.certificationsList,
          linkedIn: candidate.linkedIn,
          portfolio: candidate.portfolio,
          preferredLocation: candidate.preferredLocation,
          assignedJobs: candidate.assignedJobs,
          jobId: candidate.pipelineJobId,
          workExperienceText: candidate.workExperienceText,
          projectsText: candidate.projectsText,
        },
        candidateSmartSearch.activeKeywords,
      ),
    );
  }, [candidates, candidateSmartSearch.activeKeywords]);
  const { alertsByEntityId: workspaceAlertsByEntityId } = useWorkspaceEntityAlerts(
    'CANDIDATE',
    filteredCandidates.map((candidate) => candidate.id),
  );

  const buildCandidatesExportQueryParams = useCallback(
    (page: number, limit: number): Record<string, string | number | boolean> => {
      const queryParams: Record<string, string | number | boolean> = { page, limit };
      if (debouncedSearch) queryParams.search = debouncedSearch;
      if (debouncedColumnFilters.company) queryParams.company = debouncedColumnFilters.company;
      if (debouncedColumnFilters.location) queryParams.location = debouncedColumnFilters.location;
      if (debouncedColumnFilters.jobId) queryParams.jobId = debouncedColumnFilters.jobId;
      if (debouncedColumnFilters.experienceRange) {
        queryParams.experienceRange = debouncedColumnFilters.experienceRange;
      }
      if (debouncedColumnFilters.stage) {
        const stageKey = debouncedColumnFilters.stage.toLowerCase();
        queryParams.stage = CANDIDATE_STAGE_API_MAP[stageKey] || debouncedColumnFilters.stage;
      } else if (filters.status) {
        queryParams.status = filters.status;
      }
      queryParams.includeCommonPool =
        listTab === 'all' && shouldIncludePhase1CommonPool() ? true : false;
      return queryParams;
    },
    [debouncedColumnFilters, filters.search, filters.status, listTab, phase1CommonPoolEnabled],
  );

  const fetchAllCandidatesForExport = useCallback(async (): Promise<Candidate[]> => {
    return fetchAllPaginated({
      fetchPage: async (page, limit) => {
        const res = await apiGetCandidates(buildCandidatesExportQueryParams(page, limit));
        let backendCandidates: BackendCandidate[] = [];
        const payload = res.data as
          | BackendCandidate[]
          | { data?: BackendCandidate[]; items?: BackendCandidate[]; pagination?: { totalPages?: number; total?: number } }
          | undefined;
        if (payload) {
          if (Array.isArray(payload)) {
            backendCandidates = payload;
          } else if (Array.isArray(payload.data)) {
            backendCandidates = payload.data;
          } else if (Array.isArray(payload.items)) {
            backendCandidates = payload.items;
          }
        }
        const pagination =
          payload && typeof payload === 'object' && !Array.isArray(payload) ? payload.pagination : undefined;
        return {
          items: backendCandidates.map(mapBackendCandidate),
          totalPages: totalPagesFromPagination(pagination, backendCandidates.length, limit),
        };
      },
    });
  }, [buildCandidatesExportQueryParams]);

  const openExportModal = async () => {
    if (!canExportCandidate) return;
    setExportCandidatesLoading(true);
    setExportModalOpen(true);
    try {
      const all = await fetchAllCandidatesForExport();
      setExportCandidates(all);
      if (all.length === 0) {
        toast.message('No candidates to export with current filters.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load candidates for export';
      toast.error(message);
      setExportModalOpen(false);
      setExportCandidates([]);
    } finally {
      setExportCandidatesLoading(false);
    }
  };

  const handleExportCandidatesCsv = (selectedColumnIds: string[]) => {
    const columns = buildCandidatesCsvColumns(selectedColumnIds);
    if (columns.length === 0) {
      toast.message('Select at least one column to export.');
      return;
    }
    const rowsToExport = exportCandidates.length > 0 ? exportCandidates : filteredCandidates;
    downloadCsv<Candidate>(
      `candidates-${new Date().toISOString().slice(0, 10)}.csv`,
      columns,
      rowsToExport,
    );
    toast.success(
      `Exported ${rowsToExport.length} candidate${rowsToExport.length === 1 ? '' : 's'} to CSV`,
    );
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.length === filteredCandidates.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredCandidates.map(c => c.id));
    }
  };

  const loadBulkMoveStageOptions = useCallback(async (jobId: string) => {
    if (!jobId) {
      setBulkMoveStageOptions([]);
      setBulkMoveStageStageId('');
      return;
    }

    try {
      setBulkMoveStageLoading(true);
      const response = await apiGetPipelineStages(jobId);
      const payload = response.data;
      const stages = Array.isArray(payload)
        ? payload
        : Array.isArray((payload as any)?.data)
          ? (payload as any).data
          : [];

      const mappedStages = stages.map((stage: any) => ({
        id: String(stage.id),
        name: String(stage.name),
      }));

      setBulkMoveStageOptions(mappedStages);
      setBulkMoveStageStageId(mappedStages[0]?.id || '');
    } catch (stageError: any) {
      console.error('Failed to load pipeline stages for bulk move:', stageError);
      setBulkMoveStageOptions([]);
      setBulkMoveStageStageId('');
      toast.error(stageError?.message || 'Failed to load stages');
    } finally {
      setBulkMoveStageLoading(false);
    }
  }, []);

  const loadInlineStageOptionsForCandidate = useCallback(
    async (candidate: Candidate) => {
      const jobId = candidate.pipelineJobId;
      if (!jobId) return;
      const existing = inlineStageOptionsByJobId[jobId];
      const hasRealIds =
        Array.isArray(existing) &&
        existing.length > 0 &&
        existing.every((stage) => isValidObjectId(String(stage.id || '')));
      if (hasRealIds) return;

      try {
        setInlineStageOptionsLoadingJobId(jobId);
        const response = await apiGetPipelineStages(jobId);
        const payload = response.data;
        const stages = Array.isArray(payload)
          ? payload
          : Array.isArray((payload as any)?.data)
            ? (payload as any).data
            : [];

        const mappedStages = stages
          .map((stage: any) => ({
            id: String(stage.id || ''),
            name: String(stage.name || '').trim(),
          }))
          .filter((stage: { id: string; name: string }) => stage.id && stage.name && isValidObjectId(stage.id));

        setInlineStageOptionsByJobId((prev) => ({ ...prev, [jobId]: mappedStages }));
      } catch (stageError: any) {
        console.error('Failed to load pipeline stages for candidate row:', stageError);
        toast.error(stageError?.message || 'Failed to load stages');
      } finally {
        setInlineStageOptionsLoadingJobId((prev) => (prev === jobId ? null : prev));
      }
    },
    [inlineStageOptionsByJobId]
  );

  const openScheduleInterviewForCandidate = useCallback(
    async (
      candidate: Candidate,
      preferredJobId?: string,
      pendingStage?: { stageId: string; stageName: string },
    ) => {
      const jobId = preferredJobId || resolveSubmitJobIdForRow(candidate) || '';
      const job = pipelineJobs.find((row) => row.id === jobId);
      if (pendingStage && jobId) {
        setPendingStageAfterWorkflow({
          candidateIds: [candidate.id],
          jobId,
          stageId: pendingStage.stageId,
          stageName: pendingStage.stageName,
          kind: 'interview',
        });
      } else {
        setPendingStageAfterWorkflow(null);
      }
      setStageScheduleCandidate({
        id: candidate.id,
        name: candidate.name,
        phone: candidate.phone || null,
        stage: candidate.stage || null,
        assignedJob: job?.title || candidate.assignedJobs?.[0] || null,
        assignedJobId: jobId || null,
      });
      setStageScheduleJobId(jobId || null);
      setStageScheduleOpen(true);
    },
    [pipelineJobs],
  );

  const closeStageScheduleInterview = useCallback(() => {
    setStageScheduleOpen(false);
    setStageScheduleCandidate(null);
    setStageScheduleJobId(null);
    setPendingStageAfterWorkflow((prev) => (prev?.kind === 'interview' ? null : prev));
  }, []);

  const openPlacementForCandidate = useCallback(
    (
      candidate: Candidate,
      preferredJobId?: string,
      pendingStage?: { stageId: string; stageName: string },
    ) => {
      const jobId = preferredJobId || resolveSubmitJobIdForRow(candidate) || '';
      const job = pipelineJobs.find((row) => row.id === jobId);
      if (pendingStage && jobId) {
        setPendingStageAfterWorkflow({
          candidateIds: [candidate.id],
          jobId,
          stageId: pendingStage.stageId,
          stageName: pendingStage.stageName,
          kind: 'offer',
        });
      } else {
        setPendingStageAfterWorkflow(null);
      }
      setPlacementPrefill({
        candidateId: candidate.id,
        jobId: jobId || undefined,
        companyId: job?.clientId || undefined,
        recruiterId: currentUser?._id || undefined,
      });
      setPlacementDrawerOpen(true);
    },
    [currentUser?._id, pipelineJobs],
  );

  const applyPendingStageAfterWorkflow = useCallback(async () => {
    const pending = pendingStageAfterWorkflow;
    if (!pending) return;
    try {
      await Promise.all(
        pending.candidateIds.map((candidateId) =>
          apiMoveCandidateStage(pending.jobId, {
            candidateId,
            stageId: pending.stageId,
          }),
        ),
      );
      setCandidates((prev) =>
        prev.map((item) =>
          pending.candidateIds.includes(item.id)
            ? { ...item, stage: pending.stageName }
            : item,
        ),
      );
    } catch (error: any) {
      console.error('Failed to apply stage after workflow:', error);
      toast.error(error?.message || 'Interview scheduled, but stage could not be updated');
    } finally {
      setPendingStageAfterWorkflow(null);
    }
  }, [pendingStageAfterWorkflow]);

  const handleStageScheduleInterview = useCallback(
    async (interviewData: CandidateScheduledInterview) => {
      const payload = {
        jobId: interviewData.jobId,
        clientId: interviewData.clientId || undefined,
        type: interviewData.type,
        round: interviewData.round,
        date: interviewData.date,
        time: interviewData.time,
        duration: interviewData.duration,
        timezone: interviewData.timezone,
        mode: interviewData.mode,
        platform:
          interviewData.platform === 'Google Meet'
            ? 'GOOGLE_MEET'
            : interviewData.platform === 'Zoom'
              ? 'ZOOM'
              : null,
        meetingLink: interviewData.meetingLink,
        location: interviewData.location,
        phoneNumber: interviewData.phoneNumber,
        interviewers: interviewData.interviewers,
        notes: interviewData.notes,
        sendCandidateInvite: interviewData.sendCandidateInvite,
        sendInterviewerInvite: interviewData.sendInterviewerInvite,
        status: interviewData.status,
      };
      await apiScheduleCandidateInterview(interviewData.candidateId, payload as any);
      toast.success('Interview scheduled successfully');
      emitNotificationsUpdated();
      await applyPendingStageAfterWorkflow();
      await loadCandidates({ silent: true });
    },
    [applyPendingStageAfterWorkflow, loadCandidates],
  );

  const handleInlineCandidateStageChange = useCallback(
    async (candidate: Candidate, stageId: string) => {
      const jobId = candidate.pipelineJobId;
      if (!jobId) {
        toast.error('No applied job found for this candidate');
        return;
      }

      let resolvedStageId = String(stageId || '').trim();
      let nextStageName =
        inlineStageOptionsByJobId[jobId]?.find((stage) => stage.id === resolvedStageId)?.name || '';

      if (!isValidObjectId(resolvedStageId)) {
        try {
          const response = await apiGetPipelineStages(jobId);
          const payload = response.data;
          const stages = Array.isArray(payload)
            ? payload
            : Array.isArray((payload as any)?.data)
              ? (payload as any).data
              : [];
          const mappedStages = stages
            .map((stage: any) => ({
              id: String(stage.id || ''),
              name: String(stage.name || '').trim(),
            }))
            .filter((stage: { id: string; name: string }) => stage.id && stage.name && isValidObjectId(stage.id));
          if (mappedStages.length) {
            setInlineStageOptionsByJobId((prev) => ({ ...prev, [jobId]: mappedStages }));
          }
          const wanted = String(nextStageName || candidate.stage || '')
            .toLowerCase()
            .replace(/[_-]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          const match = mappedStages.find(
            (stage: { id: string; name: string }) =>
              String(stage.name || '')
                .toLowerCase()
                .replace(/[_-]+/g, ' ')
                .replace(/\s+/g, ' ')
                .trim() === wanted,
          );
          if (!match) {
            toast.error('Pipeline stage not found. Save the job pipeline, then try again.');
            return;
          }
          resolvedStageId = match.id;
          nextStageName = match.name;
        } catch (stageError: any) {
          toast.error(stageError?.message || 'Failed to load pipeline stages');
          return;
        }
      }

      // Interviewing: open Schedule Interview popup only — stage updates after schedule succeeds.
      if (isInterviewPipelineStage(nextStageName)) {
        if (!canScheduleInterview) {
          toast.error('You do not have permission to schedule interviews');
          return;
        }
        await openScheduleInterviewForCandidate(candidate, jobId, {
          stageId: resolvedStageId,
          stageName: nextStageName,
        });
        return;
      }

      // Offer: open placement popup only — stage updates after placement is created.
      if (isOfferPipelineStage(nextStageName)) {
        openPlacementForCandidate(candidate, jobId, {
          stageId: resolvedStageId,
          stageName: nextStageName,
        });
        return;
      }

      try {
        setInlineStageUpdatingCandidateId(candidate.id);
        await apiMoveCandidateStage(jobId, {
          candidateId: candidate.id,
          stageId: resolvedStageId,
        });

        const resolvedName = nextStageName || candidate.stage;

        setCandidates((prev) =>
          prev.map((item) =>
            item.id === candidate.id
              ? {
                  ...item,
                  stage: resolvedName,
                }
              : item
          )
        );

        if (selectedCandidateProfile?.id === candidate.id) {
          await loadCandidateProfile(candidate.id);
        }

        await loadCandidates({ silent: true });
        toast.success(`Stage updated to ${resolvedName}`);
      } catch (error: any) {
        console.error('Failed to update candidate stage from table:', error);
        toast.error(error?.message || 'Failed to update candidate stage');
      } finally {
        setInlineStageUpdatingCandidateId((prev) => (prev === candidate.id ? null : prev));
      }
    },
    [
      canScheduleInterview,
      inlineStageOptionsByJobId,
      loadCandidateProfile,
      loadCandidates,
      openPlacementForCandidate,
      openScheduleInterviewForCandidate,
      selectedCandidateProfile?.id,
    ]
  );

  const openBulkMoveStageModal = useCallback(async () => {
    const firstJobId = pipelineJobs[0]?.id || '';
    setBulkMoveStageJobId(firstJobId);
    setBulkMoveStageStageId('');
    setBulkMoveStageNote('');
    setBulkMoveStageOpen(true);

    if (firstJobId) {
      await loadBulkMoveStageOptions(firstJobId);
    } else {
      setBulkMoveStageOptions([]);
    }
  }, [loadBulkMoveStageOptions, pipelineJobs]);

  const closeBulkMoveStageModal = useCallback(() => {
    if (bulkMoveStageSaving) return;
    setBulkMoveStageOpen(false);
    setBulkMoveStageJobId('');
    setBulkMoveStageStageId('');
    setBulkMoveStageNote('');
    setBulkMoveStageOptions([]);
  }, [bulkMoveStageSaving]);

  const loadBulkAssignJobOptions = useCallback(async (jobId: string) => {
    if (!jobId) {
      setBulkAssignJobOptions([]);
      setBulkAssignJobStageId('');
      return;
    }

    try {
      setBulkAssignJobLoading(true);
      const response = await apiGetPipelineStages(jobId);
      const payload = response.data;
      const stages = Array.isArray(payload)
        ? payload
        : Array.isArray((payload as any)?.data)
          ? (payload as any).data
          : [];

      const mappedStages = stages
        .map((stage: any) => ({
          id: String(stage.id || ''),
          name: String(stage.name || '').trim(),
        }))
        .filter((stage: { id: string; name: string }) => stage.id && stage.name);

      setBulkAssignJobOptions(mappedStages);
      setBulkAssignJobStageId(mappedStages[0]?.id || '');
    } catch (stageError: any) {
      console.error('Failed to load pipeline stages for bulk assign job:', stageError);
      setBulkAssignJobOptions([]);
      setBulkAssignJobStageId('');
      toast.error(stageError?.message || 'Failed to load stages');
    } finally {
      setBulkAssignJobLoading(false);
    }
  }, []);

  const openBulkAssignJobModal = useCallback(async () => {
    const firstJobId = pipelineJobs[0]?.id || '';
    setBulkAssignJobJobId(firstJobId);
    setBulkAssignJobStageId('');
    setBulkAssignJobNote('');
    setBulkAssignJobOpen(true);

    if (firstJobId) {
      await loadBulkAssignJobOptions(firstJobId);
    } else {
      setBulkAssignJobOptions([]);
    }
  }, [loadBulkAssignJobOptions, pipelineJobs]);

  const closeBulkAssignJobModal = useCallback(() => {
    if (bulkAssignJobSaving) return;
    setBulkAssignJobOpen(false);
    setBulkAssignJobJobId('');
    setBulkAssignJobStageId('');
    setBulkAssignJobNote('');
    setBulkAssignJobOptions([]);
  }, [bulkAssignJobSaving]);

  const submitBulkAssignJob = useCallback(async () => {
    if (!bulkAssignJobJobId || !bulkAssignJobStageId || selectedIds.length === 0) return;

    const stageName =
      bulkAssignJobOptions.find((stage) => stage.id === bulkAssignJobStageId)?.name || '';
    if (!stageName) {
      toast.error('Select a pipeline stage for this job');
      return;
    }

    try {
      setBulkAssignJobSaving(true);
      const results = await Promise.allSettled(
        selectedIds.map((candidateId) =>
          apiAddCandidateToPipeline(candidateId, {
            jobId: bulkAssignJobJobId,
            stage: stageName,
            priority: 'Medium',
            notes: bulkAssignJobNote.trim() || undefined,
          }),
        ),
      );

      const succeeded = results.filter((result) => result.status === 'fulfilled').length;
      const failed = results.length - succeeded;
      const jobTitle =
        pipelineJobs.find((job) => job.id === bulkAssignJobJobId)?.title || 'selected job';

      if (succeeded > 0) {
        toast.success(
          `Assigned ${succeeded} candidate${succeeded === 1 ? '' : 's'} to ${jobTitle} (${stageName})`,
        );
      }
      if (failed > 0) {
        toast.error(`Failed to assign ${failed} candidate${failed === 1 ? '' : 's'}`);
      }

      setBulkAssignJobOpen(false);
      setBulkAssignJobJobId('');
      setBulkAssignJobStageId('');
      setBulkAssignJobNote('');
      setBulkAssignJobOptions([]);
      setSelectedIds([]);
      await loadCandidates({ silent: true });
    } catch (error: any) {
      console.error('Failed to bulk assign job:', error);
      toast.error(error?.message || 'Failed to assign job');
    } finally {
      setBulkAssignJobSaving(false);
    }
  }, [
    bulkAssignJobJobId,
    bulkAssignJobNote,
    bulkAssignJobOptions,
    bulkAssignJobStageId,
    loadCandidates,
    pipelineJobs,
    selectedIds,
  ]);

  const bulkScheduleCandidates = useMemo<InterviewCandidate[]>(() => {
    const selected = new Set(bulkScheduleCandidateIds);
    return candidates
      .filter((row) => selected.has(row.id))
      .map((row) => ({
        id: row.id,
        name: row.name?.trim() || 'Unnamed',
        email: row.email || '',
        stage: row.stage || null,
        status: row.stage || null,
      }));
  }, [bulkScheduleCandidateIds, candidates]);

  const bulkScheduleInterviewers = useMemo<InterviewPanelMember[]>(
    () =>
      interviewPanelMembers.map((member) => ({
        id: member.id,
        userId: member.id,
        name: member.name,
        role: 'Technical' as const,
        department: member.department || 'General',
        email: '',
        phone: '-',
        avatar:
          member.avatar ||
          member.name
            .split(/\s+/)
            .map((part) => part[0])
            .join('')
            .slice(0, 2)
            .toUpperCase() ||
          'NA',
      })),
    [interviewPanelMembers],
  );

  const openBulkSubmitToClient = useCallback(
    (ids: string[]) => {
      if (!ids.length) return;
      const rows = candidates.filter((row) => ids.includes(row.id));
      const eligible = rows.filter((row) => Boolean(resolveSubmitJobIdForRow(row)));
      const skipped = rows.length - eligible.length;
      if (skipped > 0) {
        toast.warning(
          `${skipped} selected candidate${skipped === 1 ? '' : 's'} skipped — assign to a job first.`,
        );
      }
      if (!eligible.length) {
        void requestError(
          'None of the selected candidates can be submitted. Assign them to a job first.',
        );
        return;
      }
      openBulkSubmit(
        eligible.map((row) => {
          const jobId = resolveSubmitJobIdForRow(row)!;
          return {
            candidateId: row.id,
            jobId,
            candidateName: row.name,
            matchScore: row.matchScore,
            matchId: row.matchId,
          };
        }),
      );
      setSelectedIds([]);
    },
    [candidates, openBulkSubmit],
  );

  const openBulkScheduleInterview = useCallback(
    async (
      ids: string[],
      pendingStage?: { jobId: string; stageId: string; stageName: string },
    ) => {
      if (!ids.length) return;

      // Single candidate → centered Confirm Schedule popup (not the side drawer).
      if (ids.length === 1) {
        const row = candidates.find((item) => item.id === ids[0]);
        if (row) {
          await openScheduleInterviewForCandidate(
            row,
            pendingStage?.jobId || resolveSubmitJobIdForRow(row) || undefined,
            pendingStage
              ? { stageId: pendingStage.stageId, stageName: pendingStage.stageName }
              : undefined,
          );
          return;
        }
      }

      setBulkScheduleCandidateIds(ids);
      setBulkSchedulePrefillJobId(pendingStage?.jobId || null);
      if (pendingStage) {
        setPendingStageAfterWorkflow({
          candidateIds: ids,
          jobId: pendingStage.jobId,
          stageId: pendingStage.stageId,
          stageName: pendingStage.stageName,
          kind: 'interview',
        });
      } else {
        setPendingStageAfterWorkflow(null);
      }
      try {
        const jobsRes = await apiGetJobs({ page: 1, limit: 100 });
        const parsed = parseJobsListFromResponse(jobsRes);
        setBulkScheduleJobs(
          parsed
            .filter((job) => job.id)
            .map((job) => ({
              id: String(job.id),
              title: String(job.title || 'Untitled job').trim() || 'Untitled job',
              client: job.client?.companyName || job.department || 'Client',
              clientId: job.client?.id || (job as { clientId?: string }).clientId,
            })),
        );
      } catch {
        setBulkScheduleJobs(
          pipelineJobs.map((job) => ({
            id: job.id,
            title: job.title,
            client: job.clientName || job.department || 'Client',
            clientId: job.clientId || undefined,
          })),
        );
      }
      setBulkScheduleInterviewOpen(true);
    },
    [candidates, openScheduleInterviewForCandidate, pipelineJobs],
  );

  const closeBulkScheduleInterview = useCallback(() => {
    setBulkScheduleInterviewOpen(false);
    setBulkScheduleCandidateIds([]);
    setBulkSchedulePrefillJobId(null);
    // Cancel without scheduling — do not change stage.
    setPendingStageAfterWorkflow((prev) => (prev?.kind === 'interview' ? null : prev));
  }, []);

  const handleBulkScheduleInterview = useCallback(
    async (payload: ScheduleInterviewPayload) => {
      const job = bulkScheduleJobs.find((item) => item.id === payload.jobId);
      const clientId = job?.clientId || payload.clientId;
      if (!clientId) {
        toast.error('Select a job linked to a client before scheduling.');
        throw new Error('Missing client');
      }

      const targetIds =
        bulkScheduleCandidateIds.length > 0 ? bulkScheduleCandidateIds : [payload.candidateId];
      const createPayload = {
        jobId: payload.jobId,
        clientId,
        round: payload.round.toUpperCase(),
        type: mapInterviewUiTypeToBackend(payload.type),
        mode: (payload.mode === 'Online' ? 'ONLINE' : 'OFFLINE') as 'ONLINE' | 'OFFLINE',
        date: combineInterviewDateAndTimeToIso(payload.date, payload.time, payload.timezone),
        duration: payload.duration,
        timezone: payload.timezone,
        meetingPlatform: (
          payload.mode === 'Online'
            ? payload.meetingPlatform === 'Google Meet'
              ? 'GOOGLE_MEET'
              : payload.meetingPlatform === 'MS Teams'
                ? 'MS_TEAMS'
                : 'ZOOM'
            : null
        ) as 'GOOGLE_MEET' | 'ZOOM' | 'MS_TEAMS' | null,
        location: payload.mode === 'Offline' ? payload.location : undefined,
        panelUserIds: payload.panelIds,
        panelRoles: Object.fromEntries(
          payload.panelIds.map((id) => [id, 'TECHNICAL' as const]),
        ) as Record<string, 'HR' | 'TECHNICAL' | 'CLIENT' | 'HIRING_MANAGER'>,
        notes: payload.notes,
        sendCalendarInvite: payload.sendCalendarInvite,
        sendEmailNotification: payload.sendEmailNotification,
        sendWhatsappReminder: payload.sendWhatsAppReminder,
      };

      let succeeded = 0;
      let failed = 0;
      for (const candidateId of targetIds) {
        try {
          await apiCreateInterview({ ...createPayload, candidateId });
          succeeded += 1;
        } catch {
          failed += 1;
        }
      }

      if (succeeded > 0) {
        toast.success(
          `Scheduled ${succeeded} interview${succeeded === 1 ? '' : 's'} successfully`,
        );
        emitNotificationsUpdated();
        setSelectedIds([]);
        // Apply Interviewing stage only after the interview is actually scheduled.
        await applyPendingStageAfterWorkflow();
        closeBulkScheduleInterview();
        await loadCandidates({ silent: true });
      }
      if (failed > 0) {
        toast.error(
          failed === targetIds.length
            ? 'Could not schedule interviews for the selected candidates.'
            : `${failed} candidate${failed === 1 ? '' : 's'} could not be scheduled.`,
        );
      }
      if (succeeded === 0) {
        throw new Error('Schedule failed');
      }
    },
    [
      applyPendingStageAfterWorkflow,
      bulkScheduleCandidateIds,
      bulkScheduleJobs,
      closeBulkScheduleInterview,
      loadCandidates,
    ],
  );

  const submitBulkMoveStage = useCallback(async () => {
    if (!bulkMoveStageJobId || !bulkMoveStageStageId || selectedIds.length === 0) return;

    if (isSubmitToClientStageOption(bulkMoveStageStageId)) {
      closeBulkMoveStageModal();
      openBulkSubmitToClient(selectedIds);
      return;
    }

    const selectedStageName =
      bulkMoveStageOptions.find((stage) => stage.id === bulkMoveStageStageId)?.name || '';

    if (isInterviewPipelineStage(selectedStageName)) {
      if (!canScheduleInterview) {
        toast.error('You do not have permission to schedule interviews');
        return;
      }
      const ids = [...selectedIds];
      closeBulkMoveStageModal();
      setSelectedIds([]);
      await openBulkScheduleInterview(ids, {
        jobId: bulkMoveStageJobId,
        stageId: bulkMoveStageStageId,
        stageName: selectedStageName,
      });
      return;
    }

    if (isOfferPipelineStage(selectedStageName)) {
      if (selectedIds.length !== 1) {
        toast.error('Select a single candidate to create a placement from Offer stage');
        return;
      }
      const row = candidates.find((item) => item.id === selectedIds[0]);
      if (!row) {
        toast.error('Candidate not found');
        return;
      }
      closeBulkMoveStageModal();
      setSelectedIds([]);
      openPlacementForCandidate(row, bulkMoveStageJobId, {
        stageId: bulkMoveStageStageId,
        stageName: selectedStageName,
      });
      return;
    }

    try {
      setBulkMoveStageSaving(true);
      await Promise.all(
        selectedIds.map((candidateId) =>
          apiMoveCandidateStage(bulkMoveStageJobId, {
            candidateId,
            stageId: bulkMoveStageStageId,
            notes: bulkMoveStageNote.trim() || undefined,
          })
        )
      );

      toast.success(`Moved ${selectedIds.length} candidate(s) to ${selectedStageName || 'selected stage'}`);
      setBulkMoveStageOpen(false);
      setBulkMoveStageJobId('');
      setBulkMoveStageStageId('');
      setBulkMoveStageNote('');
      setBulkMoveStageOptions([]);
      setSelectedIds([]);
      await loadCandidates({ silent: true });
    } catch (moveError: any) {
      console.error('Failed to move candidates to stage:', moveError);
      toast.error(moveError?.message || 'Failed to move candidates');
    } finally {
      setBulkMoveStageSaving(false);
    }
  }, [
    bulkMoveStageJobId,
    bulkMoveStageNote,
    bulkMoveStageOptions,
    bulkMoveStageStageId,
    canScheduleInterview,
    candidates,
    closeBulkMoveStageModal,
    loadCandidates,
    openBulkScheduleInterview,
    openBulkSubmitToClient,
    openPlacementForCandidate,
    selectedIds,
  ]);

  const handleDeleteCandidate = useCallback(
    async (candidate: Candidate) => {
      if (!isValidObjectId(candidate.id)) {
        toast.error('This candidate cannot be deleted (invalid id).');
        return;
      }
      if (
        !(await requestConfirm(
          'Move this candidate to the Recycle Bin? You can restore them later from Recycle Bin.'
        ))
      ) {
        return;
      }
      try {
        setDeletingCandidateId(candidate.id);
        await apiDeleteCandidate(candidate.id);
        invalidateEmployerCandidatesCache();
        setCandidates((prev) => prev.filter((c) => c.id !== candidate.id));
        toast.success('Candidate moved to Recycle Bin');
        setSelectedIds((prev) => prev.filter((id) => id !== candidate.id));
        if (selectedCandidateProfile?.id === candidate.id) {
          setCandidateDrawerOpen(false);
          setSelectedCandidateProfile(null);
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent(RECYCLE_BIN_SYNC_EVENT));
        }
        await loadCandidates({ silent: true });
      } catch (err: unknown) {
        await loadCandidates({ silent: true });
        const msg = err instanceof Error ? err.message : 'Failed to delete candidate';
        toast.error(msg);
      } finally {
        setDeletingCandidateId(null);
      }
    },
    [loadCandidates, selectedCandidateProfile?.id]
  );

  const handleViewProfile = async (candidate: Candidate) => {
    setCandidateDrawerMode('view');
    setCandidateEditOpenToken(null);
    setCandidateDrawerOpen(true);
    setLoadingCandidateProfile(true);

    setSelectedCandidateProfile({
      id: candidate.id,
      name: candidate.name,
      currentTitle: candidate.designation,
      currentCompany: candidate.company,
      designation: candidate.designation,
      stage: candidate.stage,
      experience: candidate.experience,
      location: candidate.location,
      email: candidate.email,
      phone: candidate.phone,
      expectedSalary: candidate.salary.expected || '—',
      noticePeriod: candidate.noticePeriod || '—',
      assignedJob: candidate.assignedJobs[0] || '—',
      recruiter: candidate.owner,
      source: candidate.source,
      availability: 'limited',
      summary: null,
      resumeUrl: null,
      tags: normalizeCandidateSkillLabels(candidate.skills).map((tag) => ({
        id: `tag-${tag.toLowerCase().replace(/\s+/g, '-')}`,
        label: tag,
        color: getTagColor(tag),
      })),
      notes: [],
      files: [],
      assignedJobId: null,
      scheduledInterviews: [],
      activity: [],
    });

    try {
      await loadCandidateProfile(candidate.id);
    } catch (profileError) {
      console.error('Failed to load candidate profile:', profileError);
    } finally {
      setLoadingCandidateProfile(false);
    }
  };

  const handleEditCandidate = async (candidate: Candidate) => {
    const editToken = Date.now();
    setCandidateDrawerMode('edit');
    setCandidateEditOpenToken(editToken);
    setCandidateDrawerOpen(true);
    setLoadingCandidateProfile(true);

    setSelectedCandidateProfile({
      id: candidate.id,
      name: candidate.name,
      currentTitle: candidate.designation,
      currentCompany: candidate.company,
      designation: candidate.designation,
      stage: candidate.stage,
      experience: candidate.experience,
      location: candidate.location,
      email: candidate.email,
      phone: candidate.phone,
      expectedSalary: candidate.salary.expected || '-',
      noticePeriod: candidate.noticePeriod || '-',
      assignedJob: candidate.assignedJobs[0] || '-',
      recruiter: candidate.owner,
      source: candidate.source,
      availability: 'limited',
      summary: null,
      resumeUrl: null,
      tags: normalizeCandidateSkillLabels(candidate.skills).map((tag) => ({
        id: `tag-${tag.toLowerCase().replace(/\s+/g, '-')}`,
        label: tag,
        color: getTagColor(tag),
      })),
      notes: [],
      files: [],
      assignedJobId: null,
      scheduledInterviews: [],
      activity: [],
    });

    try {
      await loadCandidateProfile(candidate.id);
    } catch (error) {
      console.error('Failed to load candidate profile for edit:', error);
      setCandidateEditOpenToken(null);
      setCandidateDrawerOpen(false);
      toast.error('Unable to open the edit drawer right now.');
    } finally {
      setLoadingCandidateProfile(false);
    }
  };

  const handleWhatsAppCandidate = useCallback((candidate: Candidate) => {
    const rawPhone = String(candidate.phone || '').trim();
    const phoneDigits = rawPhone.replace(/\D/g, '');

    if (!phoneDigits) {
      toast.error(`No phone number found for ${candidate.name}.`);
      return;
    }

    const whatsappUrl = `https://wa.me/${phoneDigits}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  }, []);

  return {
    router,
    pathname,
    searchParams,
    hasPermission,
    hasAnyPermission,
    canCreateCandidate,
    canUpdateCandidate,
    canSubmitToClient,
    canDeleteCandidate,
    canScheduleInterview,
    canExportCandidate,
    selectedIds,
    setSelectedIds,
    createTaskOpen,
    setCreateTaskOpen,
    isAddCandidateOpen,
    setIsAddCandidateOpen,
    candidateDrawerInitialTab,
    setCandidateDrawerInitialTab,
    createCandidateMode,
    setCreateCandidateMode,
    candidateAiGate,
    failedResumesDrawerOpen,
    setFailedResumesDrawerOpen,
    tokensDrawerOpen,
    setTokensDrawerOpen,
    repairNamesDrawerOpen,
    setRepairNamesDrawerOpen,
    bulkCvTokenResumeCount,
    setBulkCvTokenResumeCount,
    pendingBulkRetryFile,
    setPendingBulkRetryFile,
    pendingBulkRetryFiles,
    setPendingBulkRetryFiles,
    pendingBulkRetryServerIds,
    setPendingBulkRetryServerIds,
    failedBulkResumeCount,
    setFailedBulkResumeCount,
    recycleBinModuleOpen,
    setRecycleBinModuleOpen,
    phase1CommonPoolEnabled,
    setPhase1CommonPoolEnabled,
    listTab,
    setListTab,
    filters,
    setFilters,
    candidates,
    setCandidates,
    exportModalOpen,
    setExportModalOpen,
    exportCandidates,
    setExportCandidates,
    exportCandidatesLoading,
    setExportCandidatesLoading,
    loading,
    setLoading,
    tableLoading,
    setTableLoading,
    error,
    setError,
    hasLoadedCandidatesOnceRef,
    columnFilters,
    setColumnFilters,
    debouncedColumnFilters,
    setDebouncedColumnFilters,
    smartSearchCandidateIds,
    setSmartSearchCandidateIds,
    candidateColumnVisibility,
    debouncedSearch,
    setDebouncedSearch,
    selectedCandidateProfile,
    setSelectedCandidateProfile,
    candidateDrawerOpen,
    setCandidateDrawerOpen,
    candidateDrawerMode,
    setCandidateDrawerMode,
    candidateEditOpenToken,
    setCandidateEditOpenToken,
    pendingDeepLinkCandidateIdRef,
    loadCandidatesRequestIdRef,
    loadCandidatesAbortRef,
    candidatePrefetchGenRef,
    loadingCandidateProfile,
    setLoadingCandidateProfile,
    availableDrawerTags,
    setAvailableDrawerTags,
    pipelineJobs,
    setPipelineJobs,
    jobFilterOptions,
    setJobFilterOptions,
    pipelineRecruiters,
    setPipelineRecruiters,
    companyFilterOptions,
    setCompanyFilterOptions,
    locationFilterOptions,
    setLocationFilterOptions,
    companyFilterOptionsRef,
    locationFilterOptionsRef,
    submitClientRowId,
    setSubmitClientRowId,
    openSubmit,
    openBulkSubmit,
    submitModalElement,
    jobFilterOptionsRef,
    interviewPanelMembers,
    setInterviewPanelMembers,
    bulkScheduleInterviewOpen,
    setBulkScheduleInterviewOpen,
    bulkScheduleCandidateIds,
    setBulkScheduleCandidateIds,
    bulkSchedulePrefillJobId,
    setBulkSchedulePrefillJobId,
    bulkScheduleJobs,
    setBulkScheduleJobs,
    stageScheduleOpen,
    setStageScheduleOpen,
    stageScheduleCandidate,
    setStageScheduleCandidate,
    stageScheduleJobId,
    setStageScheduleJobId,
    pendingStageAfterWorkflow,
    setPendingStageAfterWorkflow,
    placementDrawerOpen,
    setPlacementDrawerOpen,
    placementSubmitting,
    setPlacementSubmitting,
    placementPrefill,
    setPlacementPrefill,
    bulkMoveStageOpen,
    setBulkMoveStageOpen,
    bulkMoveStageJobId,
    setBulkMoveStageJobId,
    bulkMoveStageStageId,
    setBulkMoveStageStageId,
    bulkMoveStageNote,
    setBulkMoveStageNote,
    bulkMoveStageOptions,
    setBulkMoveStageOptions,
    bulkMoveStageLoading,
    setBulkMoveStageLoading,
    bulkMoveStageSaving,
    setBulkMoveStageSaving,
    bulkAssignJobOpen,
    setBulkAssignJobOpen,
    bulkAssignJobJobId,
    setBulkAssignJobJobId,
    bulkAssignJobStageId,
    setBulkAssignJobStageId,
    bulkAssignJobNote,
    setBulkAssignJobNote,
    bulkAssignJobOptions,
    setBulkAssignJobOptions,
    bulkAssignJobLoading,
    setBulkAssignJobLoading,
    bulkAssignJobSaving,
    setBulkAssignJobSaving,
    deletingCandidateId,
    setDeletingCandidateId,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    totalEntries,
    setTotalEntries,
    candidatesFilterSig,
    inlineStageOptionsByJobId,
    setInlineStageOptionsByJobId,
    inlineStageOptionsLoadingJobId,
    setInlineStageOptionsLoadingJobId,
    inlineStageUpdatingCandidateId,
    setInlineStageUpdatingCandidateId,
    currentUser,
    setCurrentUser,
    currentDrawerUser,
    openCandidateDrawer,
    refreshFailedBulkResumeCount,
    refreshBulkCvTokenCount,
    handleBulkRetryFileConsumed,
    handleFailedResumeReupload,
    handleFailedResumeRetryFiles,
    syncCandidateCard,
    loadCandidateProfile,
    loadCandidates,
    handleRepairBadNames,
    switchListTab,
    refreshJobFilterOptions,
    candidatesAutoLoad,
    hasTableColumnFilters,
    candidateSmartSearchOptions,
    candidateSmartSearch,
    hasToolbarFilters,
    handleClearToolbar,
    handleColumnFiltersChange,
    filteredCandidates,
    workspaceAlertsByEntityId,
    buildCandidatesExportQueryParams,
    fetchAllCandidatesForExport,
    openExportModal,
    handleExportCandidatesCsv,
    handleToggleSelect,
    handleToggleSelectAll,
    loadBulkMoveStageOptions,
    loadInlineStageOptionsForCandidate,
    openScheduleInterviewForCandidate,
    closeStageScheduleInterview,
    openPlacementForCandidate,
    applyPendingStageAfterWorkflow,
    handleStageScheduleInterview,
    handleInlineCandidateStageChange,
    openBulkMoveStageModal,
    closeBulkMoveStageModal,
    loadBulkAssignJobOptions,
    openBulkAssignJobModal,
    closeBulkAssignJobModal,
    submitBulkAssignJob,
    bulkScheduleCandidates,
    bulkScheduleInterviewers,
    openBulkSubmitToClient,
    openBulkScheduleInterview,
    closeBulkScheduleInterview,
    handleBulkScheduleInterview,
    submitBulkMoveStage,
    handleDeleteCandidate,
    handleViewProfile,
    handleEditCandidate,
    handleWhatsAppCandidate,
  };
}
