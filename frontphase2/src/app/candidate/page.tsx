'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef, Suspense } from 'react';
import { CandidateTable, Candidate } from './components/CandidateTable';
import {
  CandidateTableFilters,
  type CandidateTableColumnFilters,
  EMPTY_CANDIDATE_TABLE_COLUMN_FILTERS,
} from './components/CandidateTableFilters';
import { BulkActions } from './components/BulkActions';
import { ScheduleInterviewModal } from '../../components/interviews/ScheduleInterviewModal';
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
import AddCandidateDrawer from '../../components/candidates/AddCandidateDrawer';
import FailedBulkResumesDrawer from '../../components/candidates/FailedBulkResumesDrawer';
import BulkCvTokensDrawer from '../../components/candidates/BulkCvTokensDrawer';
import { BULK_CV_TOKENS_CHANGED, getBulkCvTokenSession } from '../../lib/bulkCvTokensStore';
import ModuleRecycleBinDrawer from '../../components/ModuleRecycleBinDrawer';
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
import {
  CandidateProfileDrawer,
  type CandidateInterviewerOption,
  type CandidateProfileDrawerData,
  type CandidateScheduledInterview,
  type CandidatePipelineJobOption,
  type CandidatePipelineRecruiterOption,
  type CandidateTagItem,
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
import { fetchAllPaginated, totalPagesFromPagination } from '../../lib/export/fetchAllPaginated';
import { CreateTaskModal } from '../../components/CreateTaskModal';
import { Toaster, toast } from 'sonner';
import PaginationAll from '../../components/PaginationAll';
import { TABLE_PAGE_SIZE_OPTIONS, type TablePageSize } from '../../constants/tablePagination';
import { requestConfirm, requestError } from '../../lib/appDialog';
import { RECYCLE_BIN_SYNC_EVENT } from '../../constants/recycleBin';
import { parseClientsListFromResponse, parseJobsListFromResponse } from '../../lib/parseApiList';
import {
  apiAddCandidateNote,
  apiAddCandidateTag,
  apiAddCandidateToPipeline,
  apiRemoveCandidateFromPipeline,
  apiBulkActionCandidates,
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
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { usePermissions } from '../../hooks/usePermissions';
import { usePageAutoRefresh } from '../../hooks/usePageAutoRefresh';
import {
  isCandidatesListCacheFresh,
  readCandidatesListCache,
  writeCandidatesListCache,
  invalidateEmployerCandidatesCache,
} from '../../lib/employerPageCache';
import { useWorkspaceEntityAlerts } from '../../hooks/useWorkspaceEntityAlerts';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { AiCoinLockBadge, useAiCoinGate } from '../../components/coins/AiCoinGate';
import {
  PH2_TABLE_BODY_SCROLL_CLASS,
  PH2_TABLE_CARD_CLASS,
  PH2_TABLE_CARD_FOOTER_CLASS,
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
  isSubmitToClientStageOption,
  profileCanSubmitToClient,
  resolveSubmitJobIdForProfile,
  resolveSubmitJobIdForRow,
  resolveSubmitJobIdFromBackend,
  SUBMIT_TO_CLIENT_STAGE_OPTION_LABEL,
  SUBMIT_TO_CLIENT_STAGE_OPTION_VALUE,
} from '../../lib/candidateSubmitToClient';

export const dynamic = 'force-dynamic';

type CandidateListTab = 'all' | 'mine';

/** Full pool: tenant + job portal + Phase 1 common DB. */
const ALL_CANDIDATES_LIST_PARAMS = { page: 1, limit: 500, includeCommonPool: true };

const CANDIDATE_TABLE_TAB_CLASS =
  'px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap';

const CANDIDATE_STAGE_API_MAP: Record<string, string> = {
  new: 'New',
  applied: 'Applied',
  longlist: 'Longlist',
  shortlist: 'Shortlist',
  screening: 'Screening',
  submitted: 'Submitted',
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
    ownerId: searchParams.get('assignedToId') || '',
  };
}

function normalizeFilterOption(value?: string | null): string {
  const trimmed = String(value || '').trim();
  if (!trimmed || trimmed === '—') return '';
  return trimmed;
}

function extractBackendCandidatesList(
  payload: BackendCandidate[] | { data?: BackendCandidate[]; items?: BackendCandidate[] } | undefined,
): BackendCandidate[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.items)) return payload.items;
  return [];
}

/** Location options may come from candidate rows. Client filter options must NOT —
 * they come only from GET /clients (CRM clients), never from candidate employer names. */
function buildLocationFilterOptions(
  candidates: Candidate[],
  backendRows: BackendCandidate[],
  existingLocations: string[],
) {
  const locations = new Set(existingLocations);

  for (const row of candidates) {
    const location = normalizeFilterOption(row.location);
    if (location) locations.add(location);
  }

  for (const row of backendRows) {
    const location = normalizeFilterOption(row.location);
    if (location) locations.add(location);
  }

  return Array.from(locations).sort((a, b) => a.localeCompare(b));
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
  return parseClientsListFromResponse(res)
    .map((client) => String(client.companyName || '').trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
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
  const rawExperience = resolveCandidateExperienceYears(c) ?? c.experience ?? 0;
  const experienceYears =
    typeof rawExperience === 'number' && Number.isFinite(rawExperience)
      ? rawExperience
      : Number(rawExperience) || 0;
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
    auditMeta: extractAuditMeta(c as Record<string, unknown>),
    assignedToId: c.assignedTo?.id || undefined,
    backendStatus: c.status || undefined,
    city: c.city || undefined,
    country: c.country || undefined,
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


function CandidatesPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { hasPermission, hasAnyPermission } = usePermissions();
  const canCreateCandidate = hasAnyPermission(['candidates_create', 'add_candidate']);
  const canUpdateCandidate = hasAnyPermission(['candidates_update', 'edit_candidate', 'move_pipeline', 'submit_candidate']);
  const canSubmitToClient = hasAnyPermission(['submit_candidate', 'candidates_update', 'edit_candidate']);
  const canDeleteCandidate = hasAnyPermission(['candidates_delete', 'delete_candidate']);
  const canAssignCandidate = hasAnyPermission(['candidates_update', 'move_pipeline']);
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
  const [bulkCvTokenResumeCount, setBulkCvTokenResumeCount] = useState(0);
  const [pendingBulkRetryFile, setPendingBulkRetryFile] = useState<File | null>(null);
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
    const cached = readCandidatesListCache(tab, 1, 10, searchParams.get('search') || '');
    return Array.isArray(cached?.data?.candidates) ? (cached.data.candidates as Candidate[]) : [];
  });
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportCandidates, setExportCandidates] = useState<Candidate[]>([]);
  const [exportCandidatesLoading, setExportCandidatesLoading] = useState(false);
  const [loading, setLoading] = useState(() => {
    const tab = searchParams.get('tab') === 'mine' ? 'mine' : 'all';
    const cached = readCandidatesListCache(tab, 1, 10, searchParams.get('search') || '');
    return !cached?.data?.candidates?.length;
  });
  const [tableLoading, setTableLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedCandidatesOnceRef = useRef(
    (() => {
      const tab = searchParams.get('tab') === 'mine' ? 'mine' : 'all';
      const cached = readCandidatesListCache(tab, 1, 10, searchParams.get('search') || '');
      return Boolean(cached?.data?.candidates?.length);
    })(),
  );
  const [columnFilters, setColumnFilters] = useState<CandidateTableColumnFilters>(() =>
    readColumnFiltersFromSearchParams(searchParams),
  );
  const [debouncedColumnFilters, setDebouncedColumnFilters] =
    useState<CandidateTableColumnFilters>(columnFilters);
  const [smartSearchCandidateIds, setSmartSearchCandidateIds] = useState<string[]>([]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedColumnFilters(columnFilters), 400);
    return () => window.clearTimeout(timer);
  }, [columnFilters]);

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
  const [loadingCandidateProfile, setLoadingCandidateProfile] = useState(false);
  const [availableDrawerTags, setAvailableDrawerTags] = useState<CandidateTagItem[]>([]);
  const [pipelineJobs, setPipelineJobs] = useState<CandidatePipelineJobOption[]>([]);
  const [jobFilterOptions, setJobFilterOptions] = useState<CandidateJobFilterOption[]>([]);
  const [pipelineRecruiters, setPipelineRecruiters] = useState<CandidatePipelineRecruiterOption[]>([]);
  const [companyFilterOptions, setCompanyFilterOptions] = useState<string[]>([]);
  const [locationFilterOptions, setLocationFilterOptions] = useState<string[]>([]);
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
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiGetCandidates(ALL_CANDIDATES_LIST_PARAMS);
        if (cancelled) return;
        const rows = extractBackendCandidatesList(
          res.data as BackendCandidate[] | { data?: BackendCandidate[]; items?: BackendCandidate[] } | undefined,
        );
        const mapped = rows.map(mapBackendCandidate);
        setLocationFilterOptions(
          buildLocationFilterOptions(mapped, rows, locationFilterOptionsRef.current),
        );
      } catch {
        // Location options still accumulate from paginated list loads.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const [interviewPanelMembers, setInterviewPanelMembers] = useState<CandidateInterviewerOption[]>([]);
  const [bulkScheduleInterviewOpen, setBulkScheduleInterviewOpen] = useState(false);
  const [bulkScheduleCandidateIds, setBulkScheduleCandidateIds] = useState<string[]>([]);
  const [bulkScheduleJobs, setBulkScheduleJobs] = useState<InterviewJob[]>([]);
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [bulkAssignSaving, setBulkAssignSaving] = useState(false);
  const [bulkAssignRecruiterIds, setBulkAssignRecruiterIds] = useState<string[]>([]);
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
  const [pageSize, setPageSize] = useState<TablePageSize>(10);
  const [totalEntries, setTotalEntries] = useState(() => {
    const tab = searchParams.get('tab') === 'mine' ? 'mine' : 'all';
    const cached = readCandidatesListCache(tab, 1, 10, searchParams.get('search') || '');
    return typeof cached?.data?.totalEntries === 'number' ? cached.data.totalEntries : 0;
  });
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
    setFailedBulkResumeCount(getActiveFailedBulkResumes().length);
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
  }, []);

  const handleFailedResumeReupload = useCallback((file: File) => {
    setPendingBulkRetryFile(file);
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
      const queryParams = buildCandidatesListApiParams({
        page: activePage,
        limit: pageSize,
        search: filters.search || undefined,
        company: debouncedColumnFilters.company || undefined,
        location: debouncedColumnFilters.location || undefined,
        jobId: debouncedColumnFilters.jobId || undefined,
        experienceRange: debouncedColumnFilters.experienceRange || undefined,
        assignedToId: debouncedColumnFilters.ownerId || undefined,
        stage: stageKey
          ? CANDIDATE_STAGE_API_MAP[stageKey] || debouncedColumnFilters.stage
          : undefined,
        status: !debouncedColumnFilters.stage && filters.status ? filters.status : undefined,
        mine: activeListTab === 'mine',
        ...(shouldIncludePhase1CommonPool() ? { includeCommonPool: true } : {}),
        matchingCandidateIds: smartSearchCandidateIds,
      });

      const res = await apiGetCandidates(queryParams);

      let backendCandidates: BackendCandidate[] = [];
      let pagination: any = null;

      const payload = res.data as BackendCandidate[] | { data?: BackendCandidate[]; items?: BackendCandidate[]; pagination?: any } | undefined;
      if (payload) {
        if (Array.isArray(payload)) {
          backendCandidates = payload;
        } else if (Array.isArray(payload.data)) {
          backendCandidates = payload.data;
          pagination = payload.pagination;
        } else if (Array.isArray(payload.items)) {
          backendCandidates = payload.items;
        } else {
          console.warn('Unexpected response structure:', payload);
          backendCandidates = [];
        }
      }

      if (!Array.isArray(backendCandidates)) {
        console.error('Unexpected API response format: data is not an array.', res);
        if (requestId !== loadCandidatesRequestIdRef.current) return;
        if (!silent) {
          setError('Unexpected API response format.');
          setCandidates([]);
          setTotalEntries(0);
        }
        return;
      }

      if (requestId !== loadCandidatesRequestIdRef.current) return;
      const mapped = backendCandidates.map(mapBackendCandidate);
      setCandidates(mapped);
      hasLoadedCandidatesOnceRef.current = true;
      if (pagination) {
        setTotalEntries(pagination.total || 0);
      } else {
        setTotalEntries(mapped.length);
      }
      writeCandidatesListCache({
        tab: activeListTab,
        page: activePage,
        pageSize,
        search: filters.search || '',
        totalEntries: pagination?.total || mapped.length,
        candidates: mapped,
      });
    } catch (err: any) {
      if (requestId !== loadCandidatesRequestIdRef.current) return;
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
      if (requestId !== loadCandidatesRequestIdRef.current) return;
      if (!silent) {
        if (isFirstLoad) {
          setLoading(false);
        } else {
          setTableLoading(false);
        }
      }
    }
  }, [filters, debouncedColumnFilters, currentPage, pageSize, listTab, smartSearchCandidateIds]);

  const switchListTab = useCallback(
    (tab: CandidateListTab) => {
      const nextTab = tab === 'all' && !shouldIncludePhase1CommonPool() ? 'mine' : tab;
      setListTab(nextTab);
      setCurrentPage(1);
      void loadCandidates({
        tab: nextTab,
        page: 1,
        silent: nextTab === 'all' && hasLoadedCandidatesOnceRef.current,
      });
    },
    [loadCandidates],
  );

  useEffect(() => {
    if (!phase1CommonPoolEnabled && listTab === 'all') {
      switchListTab('mine');
    }
  }, [phase1CommonPoolEnabled, listTab, switchListTab]);

  const refreshJobFilterOptions = useCallback(async () => {
    try {
      const res = await apiGetJobs({ page: 1, limit: 500 });
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
    const cached = readCandidatesListCache(listTab, currentPage, pageSize, filters.search || '');
    void loadCandidates({ silent: Boolean(cached?.data?.candidates?.length) });
  }, [loadCandidates]);

  // Reusable auto-refresh: polls while visible, refreshes on tab focus and on
  // candidate / job-pipeline change events.
  const candidatesAutoLoad = useCallback(
    ({ silent }: { silent: boolean }) => loadCandidates({ silent }),
    [loadCandidates],
  );
  usePageAutoRefresh(candidatesAutoLoad, {
    events: ['jobportal:candidates-changed', 'jobportal:jobs-changed'],
    intervalMs: listTab === 'all' ? 20_000 : 45_000,
    shouldSkip: () =>
      isCandidatesListCacheFresh(
        readCandidatesListCache(listTab, currentPage, pageSize, filters.search || ''),
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
      columnFilters.stage ||
      columnFilters.ownerId,
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
      const recruiterChip = parsed.keywords.find((chip) => chip.kind === 'recruiter');
      const jobChip = parsed.keywords.find((chip) => chip.kind === 'client');
      setFilters((prev) => ({
        ...prev,
        search: [parsed.searchText, parsed.source].filter(Boolean).join(' ').trim(),
        status: parsed.status || statusChip?.value || '',
      }));
      setColumnFilters({
        stage: parsed.stage || stageChip?.value || '',
        ownerId: parsed.ownerId || recruiterChip?.value || '',
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
      if (removed.kind === 'recruiter') {
        setColumnFilters((prev) => ({ ...prev, ownerId: '' }));
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
    if (columnFilters.ownerId) params.set('assignedToId', columnFilters.ownerId);
    router.replace(`/candidate?${params.toString()}`, { scroll: false });
  }, [listTab, filters, columnFilters, router]);

  useEffect(() => {
    let cancelled = false;

    async function loadPipelineOptions() {
      try {
        const [allJobsRes, clientsRes, members] = await Promise.all([
          apiGetJobs({ page: 1, limit: 500 }),
          apiGetClients({ page: 1, limit: 500 }),
          getAllTeamMembersForAssign(),
        ]);
        if (cancelled) return;

        const allJobsParsed = parseJobsListFromResponse(allJobsRes);
        const allJobsForFilter = toJobFilterOptions(allJobsParsed);
        const clientNames = clientNamesFromApiResponse(clientsRes);

        const memberName = (m: (typeof members)[number]) =>
          [m.firstName, m.lastName].filter(Boolean).join(' ').trim() || m.email;
        const memberAvatar = (m: (typeof members)[number]) => (m as { avatar?: string | null }).avatar || null;

        setPipelineJobs(
          allJobsParsed
            .filter((job) => job.id)
            .map((job) => ({
              id: String(job.id),
              title: String(job.title || 'Untitled job').trim() || 'Untitled job',
            department: job.department || job.client?.companyName || null,
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
          members.map((m) => ({
            id: m.id,
            name: memberName(m),
            avatar: memberAvatar(m),
          }))
        );

        setInterviewPanelMembers(
          members.map((m) => ({
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
      if (filters.search) queryParams.search = filters.search;
      if (debouncedColumnFilters.company) queryParams.company = debouncedColumnFilters.company;
      if (debouncedColumnFilters.location) queryParams.location = debouncedColumnFilters.location;
      if (debouncedColumnFilters.jobId) queryParams.jobId = debouncedColumnFilters.jobId;
      if (debouncedColumnFilters.experienceRange) {
        queryParams.experienceRange = debouncedColumnFilters.experienceRange;
      }
      if (debouncedColumnFilters.ownerId) {
        queryParams.assignedToId = debouncedColumnFilters.ownerId;
      }
      if (debouncedColumnFilters.stage) {
        const stageKey = debouncedColumnFilters.stage.toLowerCase();
        queryParams.stage = CANDIDATE_STAGE_API_MAP[stageKey] || debouncedColumnFilters.stage;
      } else if (filters.status) {
        queryParams.status = filters.status;
      }
      queryParams.includeCommonPool = shouldIncludePhase1CommonPool() ? true : undefined;
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
      if (inlineStageOptionsByJobId[jobId]?.length) return;

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
          .filter((stage: { id: string; name: string }) => stage.id && stage.name);

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

  const handleInlineCandidateStageChange = useCallback(
    async (candidate: Candidate, stageId: string) => {
      const jobId = candidate.pipelineJobId;
      if (!jobId) {
        toast.error('No applied job found for this candidate');
        return;
      }

      try {
        setInlineStageUpdatingCandidateId(candidate.id);
        await apiMoveCandidateStage(jobId, {
          candidateId: candidate.id,
          stageId,
        });

        const nextStageName =
          inlineStageOptionsByJobId[jobId]?.find((stage) => stage.id === stageId)?.name || candidate.stage;

        setCandidates((prev) =>
          prev.map((item) =>
            item.id === candidate.id
              ? {
                  ...item,
                  stage: nextStageName,
                }
              : item
          )
        );

        if (selectedCandidateProfile?.id === candidate.id) {
          await loadCandidateProfile(candidate.id);
        }

        await loadCandidates({ silent: true });
        toast.success(`Stage updated to ${nextStageName}`);
      } catch (error: any) {
        console.error('Failed to update candidate stage from table:', error);
        toast.error(error?.message || 'Failed to update candidate stage');
      } finally {
        setInlineStageUpdatingCandidateId((prev) => (prev === candidate.id ? null : prev));
      }
    },
    [inlineStageOptionsByJobId, loadCandidateProfile, loadCandidates, selectedCandidateProfile?.id]
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

  const openBulkAssignModal = useCallback(() => {
    setBulkAssignRecruiterIds([]);
    setBulkAssignOpen(true);
  }, []);

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
    async (ids: string[]) => {
      if (!ids.length) return;
      setBulkScheduleCandidateIds(ids);
      try {
        const jobsRes = await apiGetJobs({ page: 1, limit: 500 });
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
            client: job.department || 'Client',
          })),
        );
      }
      setBulkScheduleInterviewOpen(true);
    },
    [pipelineJobs],
  );

  const closeBulkScheduleInterview = useCallback(() => {
    setBulkScheduleInterviewOpen(false);
    setBulkScheduleCandidateIds([]);
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
        mode: payload.mode === 'Online' ? 'ONLINE' : 'OFFLINE',
        date: combineInterviewDateAndTimeToIso(payload.date, payload.time),
        duration: payload.duration,
        timezone: payload.timezone,
        meetingPlatform:
          payload.mode === 'Online'
            ? payload.meetingPlatform === 'Google Meet'
              ? 'GOOGLE_MEET'
              : payload.meetingPlatform === 'MS Teams'
                ? 'MS_TEAMS'
                : 'ZOOM'
            : null,
        location: payload.mode === 'Offline' ? payload.location : undefined,
        panelUserIds: payload.panelIds,
        panelRoles: Object.fromEntries(payload.panelIds.map((id) => [id, 'TECHNICAL'])),
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
        closeBulkScheduleInterview();
        await loadCandidates();
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
    [bulkScheduleCandidateIds, bulkScheduleJobs, closeBulkScheduleInterview, loadCandidates],
  );

  const closeBulkAssignModal = useCallback(() => {
    if (bulkAssignSaving) return;
    setBulkAssignOpen(false);
    setBulkAssignRecruiterIds([]);
  }, [bulkAssignSaving]);

  const toggleBulkAssignRecruiter = useCallback((recruiterId: string) => {
    setBulkAssignRecruiterIds((prev) =>
      prev.includes(recruiterId)
        ? prev.filter((id) => id !== recruiterId)
        : [...prev, recruiterId]
    );
  }, []);

  const submitBulkAssignRecruiter = useCallback(async () => {
    if (!bulkAssignRecruiterIds.length || !selectedIds.length) return;

    try {
      setBulkAssignSaving(true);
      await apiBulkActionCandidates('assign_recruiter', selectedIds, {
        recruiterId: bulkAssignRecruiterIds[0],
        recruiterIds: bulkAssignRecruiterIds,
      });
      toast.success(`Assigned ${selectedIds.length} candidate(s) to ${bulkAssignRecruiterIds.length} team member(s)`);
      setSelectedIds([]);
      setBulkAssignOpen(false);
      setBulkAssignRecruiterIds([]);
      await loadCandidates();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to assign team member');
    } finally {
      setBulkAssignSaving(false);
    }
  }, [bulkAssignRecruiterIds, loadCandidates, selectedIds]);

  const submitBulkMoveStage = useCallback(async () => {
    if (!bulkMoveStageJobId || !bulkMoveStageStageId || selectedIds.length === 0) return;

    if (isSubmitToClientStageOption(bulkMoveStageStageId)) {
      closeBulkMoveStageModal();
      openBulkSubmitToClient(selectedIds);
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

      const selectedStageName =
        bulkMoveStageOptions.find((stage) => stage.id === bulkMoveStageStageId)?.name || 'selected stage';
      toast.success(`Moved ${selectedIds.length} candidate(s) to ${selectedStageName}`);
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
    closeBulkMoveStageModal,
    loadCandidates,
    openBulkSubmitToClient,
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

  return (
    <>
      <Toaster position="top-right" richColors style={{ top: '5rem' }} />
      <div className="ph2-page-shell flex h-[calc(100dvh-3.5rem)] w-full flex-col overflow-hidden text-slate-900">
        <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          <header className="flex min-h-[4.5rem] shrink-0 flex-wrap items-center justify-between gap-3 border-b border-indigo-100/50 bg-white/80 px-4 py-3 shadow-[inset_0_-1px_0_0_rgba(99,102,241,0.08)] backdrop-blur-md sm:px-6">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-600 text-white shadow-lg shadow-indigo-500/30 ring-1 ring-white/20">
                <Users className="h-5 w-5" strokeWidth={2.2} />
              </div>
              <div>
                <h1 className="text-xl font-bold leading-none tracking-tight text-slate-900 sm:text-[1.35rem]">
                  Candidates
                </h1>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  void loadCandidates();
                }}
                disabled={loading || tableLoading}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-indigo-200/80 bg-white text-indigo-700 shadow-[0_4px_14px_-4px_rgba(99,102,241,0.2)] transition-all hover:border-indigo-300 hover:bg-indigo-50/90 active:scale-[0.98] disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCcw
                  size={16}
                  strokeWidth={2.25}
                  className={loading || tableLoading ? 'animate-spin' : ''}
                />
              </button>
              {canDeleteCandidate ? (
                <button
                  type="button"
                  onClick={() => setRecycleBinModuleOpen(true)}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-indigo-200/80 bg-white text-indigo-700 shadow-[0_4px_14px_-4px_rgba(99,102,241,0.2)] transition-all hover:border-indigo-300 hover:bg-indigo-50/90 active:scale-[0.98]"
                  title="Deleted candidates"
                >
                  <Inbox size={17} strokeWidth={2.25} />
                </button>
              ) : null}
              {canCreateCandidate ? (
                <>
                  <button
                    type="button"
                    onClick={() => openCandidateDrawer('csv')}
                    className="flex items-center gap-1.5 rounded-lg border border-indigo-200/70 bg-white px-3 py-2 text-xs font-semibold text-indigo-900 shadow-[0_4px_14px_-4px_rgba(99,102,241,0.25)] transition-all hover:border-indigo-300 hover:bg-indigo-50/90 active:scale-[0.98]"
                  >
                    <FileSpreadsheet size={16} className="text-indigo-600" strokeWidth={2.25} />
                    <span>Bulk CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openCandidateDrawer('bulkResume')}
                    className="flex items-center gap-1.5 rounded-lg border border-indigo-200/70 bg-white px-3 py-2 text-xs font-semibold text-indigo-900 shadow-[0_4px_14px_-4px_rgba(99,102,241,0.25)] transition-all hover:border-indigo-300 hover:bg-indigo-50/90 active:scale-[0.98]"
                  >
                    <FileText size={16} className="text-indigo-600" strokeWidth={2.25} />
                    <span>Bulk CV</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFailedResumesDrawerOpen(true)}
                    className={`relative flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold shadow-[0_4px_14px_-4px_rgba(99,102,241,0.2)] transition-all active:scale-[0.98] ${
                      failedBulkResumeCount > 0
                        ? 'border-rose-200 bg-rose-50 text-rose-800 hover:border-rose-300 hover:bg-rose-100'
                        : 'border-indigo-200/70 bg-white text-indigo-900 hover:border-indigo-300 hover:bg-indigo-50/90'
                    }`}
                  >
                    <AlertCircle
                      size={16}
                      className={failedBulkResumeCount > 0 ? 'text-rose-600' : 'text-indigo-600'}
                      strokeWidth={2.25}
                    />
                    <span>Failed resumes</span>
                    {failedBulkResumeCount > 0 ? (
                      <span className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-bold text-white">
                        {failedBulkResumeCount > 99 ? '99+' : failedBulkResumeCount}
                      </span>
                    ) : null}
                  </button>
                </>
              ) : null}
              <button
                type="button"
                onClick={() => void openExportModal()}
                className="flex items-center gap-1.5 rounded-lg border border-indigo-200/70 bg-white px-3 py-2 text-xs font-semibold text-indigo-900 shadow-[0_4px_14px_-4px_rgba(99,102,241,0.25)] transition-all hover:border-indigo-300 hover:bg-indigo-50/90 hover:shadow-[0_6px_20px_-4px_rgba(99,102,241,0.35)] active:scale-[0.98]"
                title="Export candidates to CSV"
              >
                <Download size={16} className="text-indigo-600" strokeWidth={2.25} />
                <span>Export</span>
              </button>
              {canCreateCandidate ? (
                <button
                  type="button"
                  onClick={() => openCandidateDrawer('resume')}
                  className="flex items-center gap-1.5 rounded-lg border border-indigo-200/70 bg-white px-3 py-2 text-xs font-semibold text-indigo-900 shadow-[0_4px_14px_-4px_rgba(99,102,241,0.25)] transition-all hover:border-indigo-300 hover:bg-indigo-50/90 active:scale-[0.98]"
                >
                  <Upload size={16} className="text-indigo-600" strokeWidth={2.25} />
                  <span>Upload</span>
                </button>
              ) : null}
              {canCreateCandidate ? (
                <button
                  type="button"
                  onClick={() => setTokensDrawerOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-indigo-200/70 bg-white px-3 py-2 text-xs font-semibold text-indigo-900 shadow-[0_4px_14px_-4px_rgba(99,102,241,0.25)] transition-all hover:border-indigo-300 hover:bg-indigo-50/90 active:scale-[0.98]"
                  title="CV parse token usage (last bulk upload)"
                >
                  <Coins size={16} className="text-indigo-600" strokeWidth={2.25} />
                  <span>Tokens</span>
                  {bulkCvTokenResumeCount > 0 ? (
                    <span className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-600 px-1 text-[9px] font-bold text-white">
                      {bulkCvTokenResumeCount > 99 ? '99+' : bulkCvTokenResumeCount}
                    </span>
                  ) : null}
                </button>
              ) : null}
              {canCreateCandidate ? (
                <div
                  role="group"
                  aria-label="Create candidate"
                  className="inline-flex items-center rounded-lg border border-slate-200/90 bg-slate-100/90 p-0.5 shadow-[0_4px_14px_-4px_rgba(99,102,241,0.18)]"
                >
                  <button
                    type="button"
                    aria-pressed={createCandidateMode === 'ai'}
                    onClick={() => {
                      if (candidateAiGate.locked) {
                        candidateAiGate.confirmAndUnlock();
                        return;
                      }
                      setCreateCandidateMode('ai');
                      openCandidateDrawer('manual');
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                      candidateAiGate.locked
                        ? 'text-amber-800 hover:bg-amber-50'
                        : createCandidateMode === 'ai'
                          ? 'bg-white text-violet-800 shadow-sm ring-1 ring-violet-200/70'
                          : 'text-slate-500 hover:bg-white/60 hover:text-violet-700'
                    }`}
                    title={
                      candidateAiGate.locked
                        ? `Locked — needs ${candidateAiGate.cost} coins (you have ${candidateAiGate.coins})`
                        : `Create a candidate with AI (${candidateAiGate.cost} coins per chat message)`
                    }
                  >
                    {candidateAiGate.locked ? (
                      <Lock size={14} className="text-amber-600" strokeWidth={2.25} />
                    ) : (
                      <Sparkles size={14} className="text-violet-600" strokeWidth={2.25} />
                    )}
                    <span>Create with AI</span>
                    <AiCoinLockBadge featureId="ai.candidate_chat" />
                  </button>
                  <button
                    type="button"
                    aria-pressed={createCandidateMode === 'manual'}
                    onClick={() => {
                      setCreateCandidateMode('manual');
                      openCandidateDrawer('manual');
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                      createCandidateMode === 'manual'
                        ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white shadow-sm'
                        : 'text-slate-500 hover:bg-white/60 hover:text-indigo-700'
                    }`}
                    title="Create a candidate manually"
                  >
                    <Plus
                      size={14}
                      className={createCandidateMode === 'manual' ? 'text-white' : 'text-indigo-500'}
                      strokeWidth={2.5}
                    />
                    <span>Create Manually</span>
                  </button>
                </div>
              ) : null}
            </div>
          </header>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 py-4 sm:px-5 sm:py-6 lg:px-6">
            <div className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col overflow-hidden">

              <div className={PH2_TABLE_CARD_CLASS}>
                <div className="flex shrink-0 items-center gap-1 border-b border-indigo-100/80 bg-gradient-to-r from-indigo-50/90 via-white to-slate-50/80 px-4 sm:px-5">
                  {phase1CommonPoolEnabled ? (
                    <button
                      type="button"
                      onClick={() => switchListTab('all')}
                      className={`${CANDIDATE_TABLE_TAB_CLASS} ${
                        listTab === 'all'
                          ? 'border-indigo-600 text-indigo-700'
                          : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
                      }`}
                      aria-current={listTab === 'all' ? 'page' : undefined}
                    >
                      All candidates
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => switchListTab('mine')}
                    className={`${CANDIDATE_TABLE_TAB_CLASS} ${
                      listTab === 'mine'
                        ? 'border-indigo-600 text-indigo-700'
                        : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
                    }`}
                    aria-current={listTab === 'mine' ? 'page' : undefined}
                  >
                    My candidates
                  </button>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-indigo-100/50 px-4 py-2 sm:px-5">
                  <p className="text-xs text-slate-500">
                    {loading || tableLoading
                      ? 'Loading candidates…'
                      : listTab === 'mine'
                        ? `Showing ${totalEntries.toLocaleString()} candidate${totalEntries === 1 ? '' : 's'} you added or who applied to your jobs`
                        : phase1CommonPoolEnabled
                          ? `Showing ${totalEntries.toLocaleString()} candidate${totalEntries === 1 ? '' : 's'} — CRM + job portal + Phase 1 (candidatecommon)`
                          : `Showing ${totalEntries.toLocaleString()} candidate${totalEntries === 1 ? '' : 's'} — CRM + job portal`}
                  </p>
                </div>
                <div className={PH2_TOOLBAR_ROW_CLASS}>
                  <div className="flex w-full flex-col gap-2 xl:flex-row xl:items-center xl:gap-2">
                    <div className="relative w-full shrink-0 sm:w-48 lg:w-52">
                      <Search
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400"
                        size={16}
                        strokeWidth={2.25}
                      />
                      <input
                        type="text"
                        placeholder="Search name or email…"
                        value={filters.search}
                        onChange={(e) => {
                          setCurrentPage(1);
                          setFilters((prev) => ({ ...prev, search: e.target.value }));
                        }}
                        className="h-9 w-full rounded-xl border border-indigo-100/90 bg-white/95 pl-10 pr-3 text-xs text-slate-800 shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] placeholder:text-slate-400 transition-all focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                      />
            </div>
                    <SmartSearchToggleButton
                      open={candidateSmartSearch.open}
                      onToggle={() => candidateSmartSearch.setOpen((value) => !value)}
                    />
                    <CandidateTableFilters
                      filters={columnFilters}
                      onChange={handleColumnFiltersChange}
                      companyOptions={companyFilterOptions}
                      locationOptions={locationFilterOptions}
                      jobOptions={jobFilterOptions}
                      ownerOptions={pipelineRecruiters}
                    />
                    <div className="flex shrink-0 items-center self-end xl:ml-auto xl:self-center">
                      {hasToolbarFilters ? (
                <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50 hover:text-rose-700"
                          onClick={handleClearToolbar}
                        >
                          <XCircle size={15} className="shrink-0 text-rose-500" strokeWidth={2.35} />
                          Clear filters
                </button>
                      ) : null}
            </div>
          </div>
            </div>

                {candidateSmartSearch.open ? (
                  <SmartSearchPromptPanel
                    prompt={candidateSmartSearch.prompt}
                    onPromptChange={candidateSmartSearch.setPrompt}
                    onApply={candidateSmartSearch.handleApply}
                    previewKeywords={candidateSmartSearch.previewKeywords}
                    examples={candidateSmartSearch.examples}
                    onExampleClick={candidateSmartSearch.handleExample}
                    entityLabel="candidates"
                    applying={candidateSmartSearch.applying}
                    placeholder="e.g. React developers in Panvel interviewing on Accounts Assistant assigned to Himanshu"
                  />
                ) : null}

                <SmartSearchActiveKeywordsBar
                  chips={candidateSmartSearch.activeChips}
                  onClearAll={handleClearToolbar}
                  resultCount={filteredCandidates.length}
                  showResultCount={!loading && !error}
                />

                {error ? (
                  <div className="p-10 text-center text-sm font-medium text-rose-600">Error: {error}</div>
                ) : loading ? (
                  <div className={`${PH2_TABLE_BODY_SCROLL_CLASS} p-2`}>
                <TableSkeleton rows={8} columns={7} />
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <BulkActions
                  selectedIds={selectedIds}
                  onMoveStage={canUpdateCandidate ? openBulkMoveStageModal : undefined}
                  onAssignJob={canUpdateCandidate ? openBulkAssignJobModal : undefined}
                  onDelete={canDeleteCandidate ? async (ids) => {
                    if (
                      !(await requestConfirm(
                            `Move ${ids.length} candidate(s) to the Recycle Bin? You can restore them later from Recycle Bin.`,
                      ))
                    ) {
                      return;
                    }
                    try {
                      await Promise.all(ids.map((candidateId) => apiDeleteCandidate(candidateId)));
                      invalidateEmployerCandidatesCache();
                      toast.success(
                            `${ids.length} candidate${ids.length === 1 ? '' : 's'} moved to Recycle Bin`,
                      );
                      setSelectedIds([]);
                      if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent(RECYCLE_BIN_SYNC_EVENT));
                      }
                      await loadCandidates();
                    } catch (err: any) {
                      await loadCandidates({ silent: true });
                      toast.error(err?.message || 'Failed to delete candidates');
                    }
                  } : undefined}
                  onScheduleInterview={
                    canScheduleInterview ? openBulkScheduleInterview : undefined
                  }
                  onSubmitToClient={
                    canSubmitToClient ? openBulkSubmitToClient : undefined
                  }
                  onAssignRecruiter={canAssignCandidate ? openBulkAssignModal : undefined}
                  onSendEmail={async (ids) => {
                    toast.info(`Send email to ${ids.length} candidate(s) - Feature coming soon`);
                  }}
                  onAddTag={canUpdateCandidate ? async (ids) => {
                    const tag = prompt('Enter tag name:');
                    if (tag) {
                      try {
                        await apiBulkActionCandidates('add_tag', ids, { tag });
                        toast.success(`Added tag "${tag}" to ${ids.length} candidate(s)`);
                        setSelectedIds([]);
                        loadCandidates();
                      } catch (err: any) {
                        toast.error(err?.message || 'Failed to add tag');
                      }
                    }
                  } : undefined}
                  onExport={canExportCandidate ? async (ids) => {
                    try {
                      const res = await apiBulkActionCandidates('export', ids);
                      const candidates = res.data?.candidates || [];
                          const headers = [
                            'ID',
                            'First Name',
                            'Last Name',
                            'Email',
                            'Phone',
                            'Company',
                            'Title',
                            'Experience',
                            'Location',
                            'Status',
                            'Source',
                            'Created At',
                          ];
                      const rows = candidates.map((c: any) => [
                        c.id,
                        c.firstName || '',
                        c.lastName || '',
                        c.email || '',
                        c.phone || '',
                        c.currentCompany || '',
                        c.currentTitle || '',
                        c.experience || '',
                        c.location || '',
                        c.status || '',
                        c.source || '',
                        c.createdAt || '',
                      ]);
                      const csv = [headers, ...rows]
                        .map((r) =>
                              r.map((cell: unknown) => `"${String(cell).replace(/"/g, '""')}"`).join(','),
                        )
                        .join('\n');
                      const blob = new Blob([csv], { type: 'text/csv' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `candidates-export-${new Date().toISOString().split('T')[0]}.csv`;
                      a.click();
                      URL.revokeObjectURL(url);
                      toast.success(`Exported ${candidates.length} candidate(s)`);
                    } catch (err: any) {
                      toast.error(err?.message || 'Failed to export candidates');
                    }
                  } : undefined}
                  onReject={canUpdateCandidate ? async (ids) => {
                        if (!(await requestConfirm(`Are you sure you want to reject ${ids.length} candidate(s)?`)))
                          return;
                    const reason = prompt('Enter rejection reason (optional):') || 'Bulk rejection';
                    try {
                      await apiBulkActionCandidates('reject', ids, { reason });
                      toast.success(`Rejected ${ids.length} candidate(s)`);
                      setSelectedIds([]);
                      loadCandidates();
                    } catch (err: any) {
                      toast.error(err?.message || 'Failed to reject candidates');
                    }
                  } : undefined}
                  onDeselect={() => setSelectedIds([])}
                />
                    <div className={`relative min-h-0 flex-1 overflow-hidden`}>
                      {tableLoading ? (
                        <div
                          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-white/60 backdrop-blur-[1px]"
                          aria-hidden
                        >
                          <RefreshCcw size={22} className="animate-spin text-indigo-500" strokeWidth={2.25} />
                        </div>
                      ) : null}
                      <div className={PH2_TABLE_BODY_SCROLL_CLASS}>
                <CandidateTable
                  candidates={filteredCandidates}
                  selectedIds={selectedIds}
                  onToggleSelect={handleToggleSelect}
                  onToggleSelectAll={handleToggleSelectAll}
                  onViewProfile={handleViewProfile}
                  onWhatsAppCandidate={handleWhatsAppCandidate}
                  onEditCandidate={handleEditCandidate}
                  onDeleteCandidate={canDeleteCandidate ? handleDeleteCandidate : undefined}
                  deletingCandidateId={deletingCandidateId}
                  stageOptionsByJobId={inlineStageOptionsByJobId}
                  stageOptionsLoadingJobId={inlineStageOptionsLoadingJobId}
                  movingCandidateId={inlineStageUpdatingCandidateId}
                  onLoadStageOptions={canUpdateCandidate ? loadInlineStageOptionsForCandidate : undefined}
                  onChangeCandidateStage={canUpdateCandidate ? handleInlineCandidateStageChange : undefined}
                  onSubmitToClient={
                    canSubmitToClient
                      ? (row) => {
                          if (!candidateRowCanSubmitToClient(row)) return;
                          const jobId = resolveSubmitJobIdForRow(row);
                          if (!jobId) {
                            void requestError(
                              'This candidate must be assigned to, applied for, or in the pipeline of a job before submitting to the client.',
                            );
                            return;
                          }
                          setSubmitClientRowId(row.id);
                          void openSubmit({
                            candidateId: row.id,
                            jobId,
                            candidateName: row.name,
                            matchScore: row.matchScore,
                            matchId: row.matchId,
                          });
                        }
                      : undefined
                  }
                  canSubmitToClient={canSubmitToClient ? candidateRowCanSubmitToClient : undefined}
                  submittingToClientCandidateId={submitClientRowId}
                  workspaceAlertsByEntityId={workspaceAlertsByEntityId}
                  fillScrollParent
                />
                      </div>
                    </div>
                    <div className={PH2_TABLE_CARD_FOOTER_CLASS}>
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
                    itemLabel="candidates"
                    onPageChange={setCurrentPage}
                  />
                </div>
              </div>
            )}
            </div>
          </div>
        </div>
        </main>
      <CreateTaskModal
        isOpen={createTaskOpen}
        onClose={() => setCreateTaskOpen(false)}
        onSuccess={() => setCreateTaskOpen(false)}
        initialRelatedTo="Candidate"
      />

      <AddCandidateDrawer
        isOpen={canCreateCandidate && isAddCandidateOpen}
        onClose={() => {
          setIsAddCandidateOpen(false);
        }}
        onSuccess={() => {
          void loadCandidates({ silent: true });
        }}
        currentUser={currentUser || { _id: '', name: 'You', email: '', role: 'RECRUITER' }}
        initialTab={candidateDrawerInitialTab}
        createWithAi={createCandidateMode === 'ai' && candidateDrawerInitialTab === 'manual'}
        showMethodTabs={false}
        pendingBulkRetryFile={pendingBulkRetryFile}
        onBulkRetryFileConsumed={handleBulkRetryFileConsumed}
      />

      {canCreateCandidate ? (
        <FailedBulkResumesDrawer
          isOpen={failedResumesDrawerOpen}
          onClose={() => setFailedResumesDrawerOpen(false)}
          onReupload={handleFailedResumeReupload}
        />
      ) : null}

      {canCreateCandidate ? (
        <BulkCvTokensDrawer
          isOpen={tokensDrawerOpen}
          onClose={() => setTokensDrawerOpen(false)}
        />
      ) : null}

      {canDeleteCandidate && (
        <ModuleRecycleBinDrawer
          isOpen={recycleBinModuleOpen}
          onClose={() => setRecycleBinModuleOpen(false)}
          kind="candidates"
          onRestored={() => {
            void loadCandidates({ silent: true });
          }}
        />
      )}

      {canUpdateCandidate && bulkMoveStageOpen ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-slate-900/40" onClick={closeBulkMoveStageModal} />
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-100 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-lg font-bold text-slate-900">Move stage</div>
                  <div className="mt-1 text-xs text-slate-500">
                    Move {selectedIds.length} selected candidate{selectedIds.length === 1 ? '' : 's'} to another pipeline stage.
                  </div>
                </div>
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  onClick={closeBulkMoveStageModal}
                  disabled={bulkMoveStageSaving}
                >
                  Close
                </button>
              </div>
            </div>

            <div className="space-y-4 p-5">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500">Job</label>
                <select
                  value={bulkMoveStageJobId}
                  onChange={async (e) => {
                    const nextJobId = e.target.value;
                    setBulkMoveStageJobId(nextJobId);
                    await loadBulkMoveStageOptions(nextJobId);
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  disabled={bulkMoveStageSaving || pipelineJobs.length === 0}
                >
                  {pipelineJobs.length === 0 ? (
                    <option value="">No jobs available</option>
                  ) : (
                    pipelineJobs.map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.title}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500">Stage</label>
                <select
                  value={bulkMoveStageStageId}
                  onChange={(e) => setBulkMoveStageStageId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  disabled={
                    bulkMoveStageSaving ||
                    bulkMoveStageLoading ||
                    (bulkMoveStageOptions.length === 0 && !canSubmitToClient)
                  }
                >
                  {bulkMoveStageLoading ? (
                    <option value="">Loading stages...</option>
                  ) : bulkMoveStageOptions.length === 0 && !canSubmitToClient ? (
                    <option value="">No pipeline configured for this job</option>
                  ) : (
                    <>
                      {bulkMoveStageOptions.map((stage) => (
                        <option key={stage.id} value={stage.id}>
                          {stage.name}
                        </option>
                      ))}
                      {canSubmitToClient ? (
                        <option value={SUBMIT_TO_CLIENT_STAGE_OPTION_VALUE}>
                          {SUBMIT_TO_CLIENT_STAGE_OPTION_LABEL}
                        </option>
                      ) : null}
                    </>
                  )}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500">Note (optional)</label>
                <textarea
                  value={bulkMoveStageNote}
                  onChange={(e) => setBulkMoveStageNote(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="Add a short note for this move"
                  disabled={bulkMoveStageSaving}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 p-5">
              <button
                type="button"
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                onClick={closeBulkMoveStageModal}
                disabled={bulkMoveStageSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
                onClick={submitBulkMoveStage}
                disabled={
                  bulkMoveStageSaving ||
                  bulkMoveStageLoading ||
                  !bulkMoveStageJobId ||
                  !bulkMoveStageStageId ||
                  selectedIds.length === 0
                }
              >
                {bulkMoveStageSaving
                  ? 'Moving...'
                  : isSubmitToClientStageOption(bulkMoveStageStageId)
                    ? SUBMIT_TO_CLIENT_STAGE_OPTION_LABEL
                    : 'Move stage'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {canUpdateCandidate && bulkAssignJobOpen ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-slate-900/40" onClick={closeBulkAssignJobModal} />
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-100 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-lg font-bold text-slate-900">Assign the job</div>
                  <div className="mt-1 text-xs text-slate-500">
                    Assign {selectedIds.length} selected candidate
                    {selectedIds.length === 1 ? '' : 's'} to a job pipeline at once.
                  </div>
                </div>
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  onClick={closeBulkAssignJobModal}
                  disabled={bulkAssignJobSaving}
                >
                  Close
                </button>
              </div>
            </div>

            <div className="space-y-4 p-5">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500">Job</label>
                <select
                  value={bulkAssignJobJobId}
                  onChange={async (e) => {
                    const nextJobId = e.target.value;
                    setBulkAssignJobJobId(nextJobId);
                    await loadBulkAssignJobOptions(nextJobId);
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  disabled={bulkAssignJobSaving || pipelineJobs.length === 0}
                >
                  {pipelineJobs.length === 0 ? (
                    <option value="">No jobs available</option>
                  ) : (
                    pipelineJobs.map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.title}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500">Starting stage</label>
                <select
                  value={bulkAssignJobStageId}
                  onChange={(e) => setBulkAssignJobStageId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  disabled={
                    bulkAssignJobSaving ||
                    bulkAssignJobLoading ||
                    bulkAssignJobOptions.length === 0
                  }
                >
                  {bulkAssignJobLoading ? (
                    <option value="">Loading stages...</option>
                  ) : bulkAssignJobOptions.length === 0 ? (
                    <option value="">No pipeline configured for this job</option>
                  ) : (
                    bulkAssignJobOptions.map((stage) => (
                      <option key={stage.id} value={stage.id}>
                        {stage.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500">Note (optional)</label>
                <textarea
                  value={bulkAssignJobNote}
                  onChange={(e) => setBulkAssignJobNote(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="Add a short note for this assignment"
                  disabled={bulkAssignJobSaving}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 p-5">
              <button
                type="button"
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                onClick={closeBulkAssignJobModal}
                disabled={bulkAssignJobSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
                onClick={submitBulkAssignJob}
                disabled={
                  bulkAssignJobSaving ||
                  bulkAssignJobLoading ||
                  !bulkAssignJobJobId ||
                  !bulkAssignJobStageId ||
                  selectedIds.length === 0
                }
              >
                {bulkAssignJobSaving ? 'Assigning...' : 'Assign the job'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {canAssignCandidate && bulkAssignOpen ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-slate-900/40" onClick={closeBulkAssignModal} />
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-100 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-lg font-bold text-slate-900">Assign team members</div>
                  <div className="mt-1 text-xs text-slate-500">
                    Select one or more team members. The first selected team member becomes the primary assignee, and all selected team members receive the candidate details by email.
                  </div>
                </div>
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  onClick={closeBulkAssignModal}
                  disabled={bulkAssignSaving}
                >
                  Close
                </button>
              </div>
            </div>

            <div className="p-5">
              <div className="mb-3 text-xs font-bold uppercase text-slate-500">Team members</div>
              <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                {pipelineRecruiters.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                    No team members available.
                  </div>
                ) : (
                  pipelineRecruiters.map((recruiter) => {
                    const checked = bulkAssignRecruiterIds.includes(recruiter.id);
                    return (
                      <label
                        key={recruiter.id}
                        className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 transition-colors ${
                          checked
                            ? 'border-blue-200 bg-blue-50'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleBulkAssignRecruiter(recruiter.id)}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          disabled={bulkAssignSaving}
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900">{recruiter.name}</div>
                          <div className="text-xs text-slate-500">
                            {checked && bulkAssignRecruiterIds[0] === recruiter.id ? 'Primary assignee' : 'Will receive assignment email'}
                          </div>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-slate-100 p-5">
              <div className="text-xs text-slate-500">
                {bulkAssignRecruiterIds.length} team member{bulkAssignRecruiterIds.length === 1 ? '' : 's'} selected for {selectedIds.length} candidate{selectedIds.length === 1 ? '' : 's'}.
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                  onClick={closeBulkAssignModal}
                  disabled={bulkAssignSaving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
                  onClick={submitBulkAssignRecruiter}
                  disabled={bulkAssignSaving || bulkAssignRecruiterIds.length === 0 || selectedIds.length === 0}
                >
                  {bulkAssignSaving ? 'Assigning...' : 'Assign team members'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <ScheduleInterviewModal
        isOpen={bulkScheduleInterviewOpen}
        candidates={bulkScheduleCandidates}
        jobs={bulkScheduleJobs}
        interviewers={bulkScheduleInterviewers}
        bulkScheduleForCandidateIds={
          bulkScheduleCandidateIds.length > 1 ? bulkScheduleCandidateIds : undefined
        }
        prefillCandidateId={
          bulkScheduleCandidateIds.length === 1 ? bulkScheduleCandidateIds[0] : null
        }
        onClose={closeBulkScheduleInterview}
        onSchedule={handleBulkScheduleInterview}
      />

      <CandidateProfileDrawer
        key={`${selectedCandidateProfile?.id || 'candidate'}-${candidateDrawerMode}`}
        isOpen={candidateDrawerOpen}
        currentUser={currentDrawerUser}
        availableTags={availableDrawerTags}
        jobs={pipelineJobs}
        recruiters={pipelineRecruiters}
        interviewers={interviewPanelMembers}
        existingInterviews={selectedCandidateProfile?.scheduledInterviews || []}
        candidate={
          loadingCandidateProfile && selectedCandidateProfile
            ? {
                ...selectedCandidateProfile,
                summary: selectedCandidateProfile.summary || 'Loading candidate details...',
              }
            : selectedCandidateProfile
        }
        onClose={() => {
          setCandidateDrawerOpen(false);
          setSelectedCandidateProfile(null);
          setCandidateDrawerMode('view');
          setCandidateEditOpenToken(null);
          if (searchParams.get('candidateId')) {
            const sp = new URLSearchParams(searchParams.toString());
            sp.delete('candidateId');
            pendingDeepLinkCandidateIdRef.current = null;
            const qs = sp.toString();
            router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
          }
        }}
        onAction={(action, candidate) => {
          console.log('Candidate drawer action:', action, candidate.id);
        }}
        onRejectCandidate={canUpdateCandidate ? async (reason, feedback, sendEmail, showFeedbackToCandidate, jobId) => {
          if (!selectedCandidateProfile) return;
          await apiRejectCandidate(selectedCandidateProfile.id, {
            reason,
            feedback,
            sendEmail,
            showFeedbackToCandidate,
            jobId: jobId || selectedCandidateProfile.assignedJobId || undefined,
          });
          await loadCandidateProfile(selectedCandidateProfile.id);
        } : undefined}
        onScheduleInterview={canUpdateCandidate ? async (interviewData) => {
          const payload = {
            jobId: interviewData.jobId,
            clientId: interviewData.clientId || undefined,
            type: interviewData.type,
            round: interviewData.round,
            date: interviewData.date,
            time: interviewData.time,
            duration: interviewData.duration,
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

          // If ID looks like a real backend interview id, update; else schedule new.
          if (String(interviewData.id || '').length >= 12 && String(interviewData.id || '').includes('interview-') === false) {
            await apiUpdateCandidateInterview(interviewData.candidateId, interviewData.id, payload);
            toast.success('Interview updated successfully');
          } else {
            await apiScheduleCandidateInterview(interviewData.candidateId, payload as any);
            toast.success('Interview scheduled successfully');
          }
          emitNotificationsUpdated();
          await loadCandidateProfile(interviewData.candidateId);
        } : undefined}
        onAddNote={canUpdateCandidate ? async (candidateId, note) => {
          await apiAddCandidateNote(candidateId, note);
          await loadCandidateProfile(candidateId);
        } : undefined}
        onEditNote={canUpdateCandidate ? async (candidateId, noteId, updatedNote) => {
          await apiUpdateCandidateNote(candidateId, noteId, updatedNote);
          await loadCandidateProfile(candidateId);
        } : undefined}
        onDeleteNote={canUpdateCandidate ? async (candidateId, noteId) => {
          await apiDeleteCandidateNote(candidateId, noteId);
          await loadCandidateProfile(candidateId);
        } : undefined}
        onPinNote={canUpdateCandidate ? async (candidateId, noteId, isPinned) => {
          await apiPinCandidateNote(candidateId, noteId, isPinned);
          await loadCandidateProfile(candidateId);
        } : undefined}
        onAddTag={canUpdateCandidate ? async (candidateId, tag) => {
          await apiAddCandidateTag(candidateId, tag);
          await loadCandidateProfile(candidateId);
        } : undefined}
        onRemoveTag={canUpdateCandidate ? async (candidateId, tagId) => {
          await apiRemoveCandidateTag(candidateId, tagId);
          await loadCandidateProfile(candidateId);
        } : undefined}
        onCreateTag={(_, tagName) => {
          const newTag: CandidateTagItem = {
            id: `tag-${tagName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
            label: tagName,
            color: getTagColor(tagName),
          };
          setAvailableDrawerTags((prev) => {
            if (prev.some((tag) => tag.label.toLowerCase() === tagName.toLowerCase())) return prev;
            return [...prev, newTag];
          });
          return newTag;
        }}
        onAddToPipeline={canUpdateCandidate ? async ({ candidateId, jobId, stage, recruiterId, priority, notes }) => {
          await apiAddCandidateToPipeline(candidateId, {
            jobId,
            stage,
            recruiterId,
            priority,
            notes,
          });
          await loadCandidateProfile(candidateId);
        } : undefined}
        onRemoveFromPipeline={
          canUpdateCandidate
            ? async ({ candidateId, jobId }) => {
                await apiRemoveCandidateFromPipeline(candidateId, jobId);
                await loadCandidateProfile(candidateId);
                await loadCandidates({ silent: true });
              }
            : undefined
        }
        onSubmitToClient={
          canSubmitToClient
            ? (profile) => {
                if (!profileCanSubmitToClient(profile)) {
                  void requestError(
                    'Submit to Client is only available for candidates assigned to, applied for, or in a job pipeline.',
                  );
                  return;
                }
                const listRow = filteredCandidates.find((c) => c.id === profile.id);
                const jobId =
                  resolveSubmitJobIdForProfile(profile) ||
                  (listRow ? resolveSubmitJobIdForRow(listRow) : null);
                if (!jobId) {
                  void requestError(
                    'Assign this candidate to a job (or add them to a pipeline) before submitting to the client.',
                  );
                  return;
                }
                void openSubmit({
                  candidateId: profile.id,
                  jobId,
                  candidateName: profile.name,
                });
              }
            : undefined
        }
        showSubmitToClient={canSubmitToClient}
        onUpdateCandidate={canUpdateCandidate ? async (candidateId, payload) => {
          const response = await apiUpdateCandidate(candidateId, payload);
          const updated = extractApiData<BackendCandidate>(response);
          if (updated) {
            const mappedProfile = mapCandidateProfile(updated);
            setSelectedCandidateProfile(mappedProfile);
            syncCandidateCard(mappedProfile);
          }
          await loadCandidateProfile(candidateId);
        } : undefined}
        onRefreshCandidate={canUpdateCandidate ? loadCandidateProfile : undefined}
        openEditDirectly={Boolean(candidateEditOpenToken)}
        editModalOpenToken={candidateEditOpenToken}
        loadingCandidateProfile={loadingCandidateProfile}
      />

      {submitModalElement}
      <ExportColumnsModal
        isOpen={exportModalOpen}
        onClose={() => {
          setExportModalOpen(false);
          setExportCandidates([]);
        }}
        title="Export candidates"
        rowCount={exportCandidates.length}
        rowLabelSingular="candidate"
        rowLabelPlural="candidates"
        columns={CANDIDATES_EXPORT_COLUMNS}
        rows={exportCandidates}
        isLoading={exportCandidatesLoading}
        getRowKey={(candidate) => candidate.id}
        onExport={handleExportCandidatesCsv}
      />
    </div>
    </>
  );
}

export default function CandidatesPage() {
  return (
    <Suspense fallback={<div className="w-full min-h-screen bg-[#f8fafc] flex items-center justify-center">Loading...</div>}>
      <CandidatesPageContent />
    </Suspense>
  );
}
