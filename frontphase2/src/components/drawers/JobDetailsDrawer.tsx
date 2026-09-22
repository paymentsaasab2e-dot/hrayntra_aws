'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { usePageDrawerLifecycle } from '../../lib/pageDrawerEvents';
import { useDrawerUnsavedGuard } from '../../hooks/useDrawerUnsavedGuard';
import {
  CandidateTable,
  type Candidate as JobDrawerTableCandidate,
} from '../../app/candidate/components/CandidateTable';
import {
  AddToPipelineModal,
  type CandidatePipelineJobOption,
  type CandidatePipelineRecruiterOption,
  type CandidateProfileDrawerData,
} from './CandidateProfileDrawer';
import { jobCandidateItemToMoveStageProfile } from '../../lib/candidateTableToProfileStub';
import { buildFileHref } from '../../utils/cloudinaryUrls';
import { motion, AnimatePresence } from 'motion/react';
import { DetailsModalShell } from './DetailsModalShell';
import { DrawerTabBar } from './DrawerTabBar';
import { requestCornerAlert, requestConfirm, requestError, requestInfo } from '../../lib/appDialog';
import { ApiRequestError } from '../../lib/apiNetworkErrors';
import { isValidObjectId } from '../../lib/mapCandidateProfile';
import { RECYCLE_BIN_SYNC_EVENT } from '../../constants/recycleBin';
import { invalidateEmployerCandidatesCache } from '../../lib/employerPageCache';
import {
  isInterviewPipelineStage,
  isOfferPipelineStage,
} from '../../lib/candidateSubmitToClient';
import { orEmpty, startAsyncLoad } from '../../lib/asyncLoadGuard';
import { matchesQuickSearch, buildQuickSearchHaystack } from '../../lib/quickSearch';
import {
  X,
  Pencil,
  SquarePen,
  LayoutGrid,
  Users,
  GitBranch,
  Calendar,
  UserCheck,
  FileText,
  Activity,
  StickyNote,
  Paperclip,
  MapPin,
  Briefcase,
  Banknote,
  Send,
  Copy,
  ExternalLink,
  Link2,
  Share2,
  Archive,
  ChevronDown,
  ChevronRight,
  ListChecks,
  Award,
  GraduationCap,
  Heart,
  Eye,
  GripVertical,
  Plus,
  Trash2,
  Clock,
  BarChart2,
  Timer,
  TrendingUp,
  UserCog,
  Pin,
  Upload,
  Download,
  User,
  FileCheck,
  Sparkles,
  Loader2,
  ClipboardList,
  MessageSquare,
  Search,
  Building2,
} from 'lucide-react';
import {
  apiCreateMatch,
  apiGetInterviews,
  apiGetMatches,
  apiGetCandidate,
  apiGetJobApplyLink,
  resolveJobApplyUrlFromResponse,
  apiGetPlacements,
  apiToggleSavedMatch,
  apiGetJobStatusCatalog,
  apiAppendJobStatus,
  apiRemoveJobStatus,
  apiGetPipelineStages,
  apiMoveCandidateStage,
  apiParseCandidateResume,
  apiCreateCandidateFromDrawer,
  apiUploadCandidateResumeFile,
  apiAddCandidateToPipeline,
  apiDeleteCandidate,
  apiRemoveCandidateFromPipeline,
  filesApiGet,
  type BackendCandidate,
  type BackendInterviewListItem,
  type AddCandidatePayload,
  type ImportedProfileData,
} from '../../lib/api';
import {
  hasEditedCvAvailable,
  resolveDefaultCvShareMode,
  type CvShareMode,
} from '../../lib/cvEditorMapping';
import { resolveSaasaCvPreviewUrl } from '../../lib/saasaCvAnnotations';
import {
  DEFAULT_JOB_STATUS_OPTIONS,
  isProtectedJobStatus,
  jobStatusPillClass,
  mapJobStatusLabelToBackend,
  mergeJobStatusOptions,
  filterJobStatusOptionsForCurrent,
  isDraftJobStatus,
  canRevertJobToDraft,
} from '../../lib/jobStatus';
import { useDrawerPortalDropdownPosition } from './drawerFormUi';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { useAssignableMembers } from '../../hooks/useAssignableMembers';
import { AssignCompanySelect } from '../assign/AssignCompanySelect';
import { getCurrentUserRequestIdentity } from '../../lib/api/teamApi';
import { getActiveOrgUnitId } from '../../lib/org/orgWorkspaceStorage';
import {
  formatAssigneeDisplayName,
  formatAssigneeOptionLabel,
  getStoredCurrentUserId,
} from '../../lib/assigneeDisplay';
import type { Placement } from '../../types/placement';
import {
  extractApplicationsJobCandidateItems,
  loadJobAppliedCandidates,
  mergeJobCandidateSeeds,
  parseJobCandidateScore,
  resolveJobCandidateDisplayStage,
  unwrapMatchRows,
} from '../../lib/jobAppliedMatches';
import { mapBackendMatch } from '../../lib/mapBackendMatch';
import MatchCandidateTable from '../matches/MatchCandidateTable';
import {
  AI_SCORE_TIERS,
  computeAiTierStats,
  displayMatchBand,
  type MatchCandidate,
} from '../matches/types';
import { useSubmitToClientModal } from '../../hooks/useSubmitToClientModal';
import { useSaasaCvAnnotations } from '../../hooks/useSaasaCvAnnotations';
import { ResumePreviewModal } from '../candidates/ResumePreviewModal';
import { ImageWithFallback } from '../ImageWithFallback';
import { NotesService } from '../NotesService';
import {
  apiGetContacts,
  apiGetJobActivities,
  apiGetJobClientRemarks,
  apiUpdateJob,
  apiResetJobPipelineToOrgTemplate,
  type BackendActivity,
  type BackendUser,
  type JobClientRemarkCandidate,
  type JobClientRemarksPayload,
  getCachedOrgRecruitmentMode,
  ORG_RECRUITMENT_CACHE_EVENT,
} from '../../lib/api';
import { useFiles } from '../../hooks/useFiles';
import { DocumentUploadButton } from '../import/documentUploadUi';
import { formatDateDMY, formatDateTimeDMY, formatTime12hEnGb } from '../../utils/dateDisplay';
import {
  buildInterviewRoundNumberById,
  formatInterviewDateInTimezone,
  formatInterviewTimeInTimezone,
} from '../../lib/interview-schedule-helpers';
import { formatTimezoneDisplay, resolveIanaFromTimezoneValue } from '../../utils/inferTimezone';
import type { AuditMeta } from '../../types/audit';
import { EntityAuditSummary } from '../table/TableAuditCell';
import { DrawerEntityChatTab } from './DrawerEntityChatTab';
import { extractAuditMeta } from '../../utils/auditMeta';
import { JobOverviewTabContent } from './JobOverviewTabContent';
import { formatJobSalaryDisplay } from '../../constants/jobSalary';
import { EntityWorkspaceAlertsPanel } from '../ai/EntityWorkspaceAlertsPanel';
import { JobAssessmentsTabContent } from '../jobs/JobAssessmentsTabContent';
import { JobClientRemarksTab } from '../jobs/JobClientRemarksTab';
import { InterviewDetailHost } from '../interviews/InterviewDetailHost';
import { InterviewRoundTabs } from '../interviews/InterviewRoundTabs';
import { TableColumnsMenu } from '../table/TableColumnsMenu';
import { usePersistedColumnVisibility } from '../../hooks/usePersistedColumnVisibility';
import {
  CANDIDATE_TABLE_COLUMNS,
  MATCH_TABLE_COLUMNS,
} from '../../lib/tableColumns/moduleTableColumns';
import PaginationAll from '../PaginationAll';
import { TABLE_PAGE_SIZE_OPTIONS, type TablePageSize } from '../../constants/tablePagination';
import {
  PH2_TABLE_BODY_SCROLL_CLASS,
  PH2_TABLE_CARD_CLASS,
  PH2_TABLE_CARD_FOOTER_CLASS,
} from '../layout/Ph2ModulePageLayout';
import { extractApiData } from '../../lib/mapCandidateProfile';
import { BULK_CV_ACCEPT_INPUT, BULK_CV_FORMAT_LABEL } from '../../lib/bulkCvFileTypes';
import { filterBulkCvFiles } from '../../lib/bulkCvCollect';
import { normalizeCandidateEmailInput } from '../../lib/candidateEmailValidation';
import {
  DrawerSectionCard,
  DRAWER_FORM_SCROLL_BG,
  DRAWER_LIST_SHELL,
  DRAWER_TABLE_ACTIONS,
  DRAWER_TABLE_BODY,
  DRAWER_TABLE_HEAD_ROW,
  DRAWER_TABLE_SCROLL,
  DRAWER_TABLE_SHELL,
  DRAWER_TABLE_TD,
  DRAWER_TABLE_TH,
  DRAWER_TABLE_TR,
} from './drawerFormUi';

/** Render salary with only the job's selected currency symbol (never a default $). */
function formatJobSalaryRange(job: {
  salaryRange?: string;
  salaryCurrency?: string;
  salaryCurrencySymbol?: string;
  minSalary?: number;
  maxSalary?: number;
}): string {
  return formatJobSalaryDisplay({
    currency: job.salaryCurrency,
    currencySymbol: job.salaryCurrencySymbol,
    min: job.minSalary,
    max: job.maxSalary,
    salaryRange: job.salaryRange,
  });
}

const MAX_JOB_CV_FILE_BYTES = 25 * 1024 * 1024;

function identityFromParsedCv(parsed: ImportedProfileData, file: File) {
  let firstName = String(parsed.firstName || '').trim();
  let lastName = String(parsed.lastName || '').trim();
  const looksLikePersonName = (value: string) => {
    const cleaned = String(value || '').replace(/\s+/g, ' ').trim();
    if (!cleaned || /[@\d]/.test(cleaned)) return false;
    if (
      /\b(?:copy\s*\d*|certificate|certificates|obtained|curriculum|vitae|resume|cv|manager|operations|school|university|college|lusaka|zambia)\b/i.test(
        cleaned,
      )
    ) {
      return false;
    }
    const parts = cleaned.split(' ').filter(Boolean);
    if (parts.length < 2 || parts.length > 4) return false;
    return parts.every((part) => /^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ.'-]*$/.test(part));
  };
  const full = [firstName, lastName].filter(Boolean).join(' ').trim();
  if (!firstName || !lastName || !looksLikePersonName(full)) {
    const base = String(file.name || '')
      .replace(/\.[^.]+$/, '')
      .replace(/^[0-9_,\-\s]+/, '')
      .replace(/\bcopy\s*\d*\b/gi, ' ')
      .replace(/(^|\s)(cv|resume|curriculum|vitae|certificate|certificates|obtained)\b/gi, ' ')
      .replace(/[_,\-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const tokens = base.split(' ').filter(Boolean);
    if (looksLikePersonName(tokens.join(' '))) {
      firstName = tokens[0] || 'Unknown';
      lastName = tokens.slice(1).join(' ') || 'Candidate';
    } else {
      firstName = 'Unknown';
      lastName = 'Candidate';
    }
  }
  const email =
    normalizeCandidateEmailInput(parsed.email, { firstName, lastName }) || null;
  return { firstName, lastName, email };
}

function payloadFromParsedJobCv(
  parsed: ImportedProfileData,
  file: File,
  jobId: string,
  recruiterId?: string,
): AddCandidatePayload {
  const identity = identityFromParsedCv(parsed, file);
  const location =
    String(parsed.location || '').trim() ||
    [parsed.city, parsed.country].filter(Boolean).join(', ') ||
    undefined;
  const skills = Array.isArray(parsed.skills) ? parsed.skills.slice(0, 20) : undefined;
  return {
    firstName: identity.firstName,
    lastName: identity.lastName,
    email: identity.email,
    phone: parsed.phone ? String(parsed.phone).trim() : undefined,
    currentCompany: parsed.currentCompany || undefined,
    designation: parsed.currentDesignation || parsed.designation || undefined,
    currentDesignation: parsed.currentDesignation || parsed.designation || undefined,
    experience:
      parsed.experience === '' || parsed.experience == null ? 0 : Number(parsed.experience) || 0,
    location,
    linkedinUrl: parsed.linkedinUrl || undefined,
    jobId,
    stage: 'Applied',
    recruiterId: recruiterId || undefined,
    source: 'Resume',
    priority: parsed.priority || 'Medium',
    tags: ['New'],
    skills,
    expectedSalary: parsed.expectedSalary == null ? undefined : Number(parsed.expectedSalary),
    currentSalary: parsed.currentSalary == null ? undefined : Number(parsed.currentSalary),
    currency: parsed.currency || undefined,
    portfolioUrl: parsed.portfolioUrl || undefined,
    education: String(parsed.education || '').trim() || undefined,
    certifications: Array.isArray(parsed.certifications) ? parsed.certifications : undefined,
    languages: Array.isArray(parsed.languages) ? parsed.languages : undefined,
    notes: parsed.summary || undefined,
    cvSummary: parsed.summary || undefined,
    cvEducationEntries: Array.isArray(parsed.educationEntries) ? parsed.educationEntries : undefined,
    cvWorkExperienceEntries: Array.isArray(parsed.workExperienceEntries)
      ? parsed.workExperienceEntries
      : undefined,
    city: parsed.city || undefined,
    country: parsed.country || undefined,
    preferredLocation: location,
    resume: parsed.resumeUrl || undefined,
    duplicateAction: 'create',
  };
}

export type JobDrawerStatus = string;

export interface JobForDrawer {
  id: string;
  title: string;
  client: string;
  /** CRM client id — required for scheduling interviews from the job drawer */
  clientId?: string;
  location: string;
  status: JobDrawerStatus;
  employmentType?: string;
  salaryRange?: string;
  postedDate?: string;
  recruiter?: string;
  /** Lead assignee user id */
  assignedToId?: string | null;
  hiringManager?: string;
  hiringManagerId?: string | null;
  /** Reporting manager for Assignment Rules (Jobs) */
  managerId?: string | null;
  applied: number;
  interviewed: number;
  offered: number;
  joined: number;
  openings: number;
  owner: string;
  createdDate: string;
  orgUnitId?: string | null;
  jobCategory?: string;
  jobLocationType?: string;
  salaryType?: string;
  salaryCurrency?: string;
  salaryCurrencySymbol?: string;
  minSalary?: number;
  maxSalary?: number;
   department?: string;
  applicationFormEnabled?: boolean;
  applicationFormLogo?: string;
  applicationFormQuestions?: string[];
  applicationFormNote?: string;
  preScreenAssessments?: Array<{
    id?: string;
    assessmentId?: string;
    sortOrder?: number;
    required?: boolean;
    timing?: string;
    assessment?: { id?: string; title?: string; type?: string; durationMinutes?: number };
  }>;
  applyUrl?: string | null;
  applyLinkToken?: string | null;
  applications?: JobApplicationSubmission[];
  overview?: string;
  keyResponsibilities?: string[];
  requiredSkills?: string[];
  preferredSkills?: string[];
  experienceRequired?: string;
  education?: string;
  benefits?: string[];
  description?: string;
  requirements?: string[];
  candidateRequirements?: string[];
  nationality?: string;
  country?: string;
  state?: string;
  city?: string;
  priority?: string;
  languages?: Array<{ language: string; proficiency: string }>;
  workMode?: string;
  expectedClosureDate?: string;
  jdFileName?: string;
  videoMediaLink?: string;
  forecastRevenue?: string;
  hot?: boolean;
  aiMatch?: boolean;
  noCandidates?: boolean;
  slaRisk?: boolean;
  managerName?: string;
  visibility?: string;
  showClientNamePublicly?: boolean;
  supportingRecruiters?: string[];
  auditMeta?: AuditMeta;
}

function currentUserAsBackendUser(): BackendUser | null {
  const me = getCurrentUserRequestIdentity();
  if (!me.id) return null;
  return {
    id: me.id,
    name: me.name || 'You',
    email: me.email || '',
    role: '',
    isActive: true,
    createdAt: '',
  };
}

function withCurrentUserFirst(users: BackendUser[], currentUserId: string): BackendUser[] {
  if (!currentUserId) return users;
  const self = users.find((user) => user.id === currentUserId);
  if (!self) return users;
  return [self, ...users.filter((user) => user.id !== currentUserId)];
}

function unwrapApiList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object') {
    const root = payload as { data?: unknown };
    if (Array.isArray(root.data)) return root.data as T[];
    if (root.data && typeof root.data === 'object' && Array.isArray((root.data as { data?: T[] }).data)) {
      return (root.data as { data: T[] }).data;
    }
  }
  return [];
}

function formatInterviewListStatus(status: string): string {
  const normalized = String(status || '').trim().toUpperCase();
  if (normalized === 'COMPLETED') return 'Completed';
  if (normalized === 'CANCELLED' || normalized === 'CANCELED') return 'Cancelled';
  if (normalized === 'NO_SHOW') return 'No show';
  if (normalized === 'RESCHEDULED') return 'Rescheduled';
  return 'Scheduled';
}

function interviewListStatusBadgeClass(statusLabel: string): string {
  switch (statusLabel) {
    case 'Completed':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'Cancelled':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'No show':
      return 'bg-slate-100 text-slate-600 border-slate-200';
    case 'Rescheduled':
      return 'bg-orange-50 text-orange-700 border-orange-200';
    default:
      return 'bg-blue-50 text-blue-700 border-blue-200';
  }
}

function formatInterviewTypeLabel(item: BackendInterviewListItem): string {
  const type = String(item.type || '')
    .trim()
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
  const mode = String(item.mode || '')
    .trim()
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
  if (type && mode) return `${type} · ${mode}`;
  return type || mode || 'Interview';
}

function panelNamesFromInterview(item: BackendInterviewListItem): string {
  const names = (item.panel || [])
    .map((member) => String(member.user?.name || '').trim())
    .filter(Boolean);
  return names.length ? names.join(', ') : '—';
}

function formatPlacementStatusLabel(status: string): string {
  return String(status || '')
    .trim()
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function candidateNameFromInterview(item: BackendInterviewListItem): string {
  return `${item.candidate?.firstName || ''} ${item.candidate?.lastName || ''}`.trim() || 'Candidate';
}

function candidateNameFromPlacement(item: Placement): string {
  return `${item.candidate?.firstName || ''} ${item.candidate?.lastName || ''}`.trim() || 'Candidate';
}

export interface JobApplicationSubmission {
  id: string;
  candidateId: string;
  status?: string;
  appliedAt?: string;
  screeningAnswers?: Record<string, unknown> | null;
  candidate?: {
    id?: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
  } | null;
}

/** Pipeline stage for Job Pipeline Configuration */
export interface JobPipelineStage {
  id: string;
  name: string;
  sla?: string;
  /** Backend lifecycle bucket (APPLIED, INTERVIEW, …) for standalone tenant pipeline sync */
  systemRole?: string | null;
}

const DEFAULT_PIPELINE_STAGE_NAMES = ['Apply', 'Interview', 'Reject', 'Placed'] as const;
const DEFAULT_PIPELINE_STAGE_IDS: Record<(typeof DEFAULT_PIPELINE_STAGE_NAMES)[number], string> = {
  Apply: 'default-apply-stage',
  Interview: 'default-interview-stage',
  Reject: 'default-reject-stage',
  Placed: 'default-placed-stage',
};
const DEFAULT_PIPELINE_STAGE_ID_SET = new Set(Object.values(DEFAULT_PIPELINE_STAGE_IDS));

const PIPELINE_SYSTEM_ROLE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Auto / unset' },
  { value: 'APPLIED', label: 'Applied' },
  { value: 'SCREENING', label: 'Screening' },
  { value: 'INTERVIEW', label: 'Interview' },
  { value: 'OFFER', label: 'Offer' },
  { value: 'HIRED', label: 'Hired' },
  { value: 'REJECTED', label: 'Rejected' },
];

const getDefaultPipelineStageNameById = (id: string): (typeof DEFAULT_PIPELINE_STAGE_NAMES)[number] | null => {
  const found = DEFAULT_PIPELINE_STAGE_NAMES.find((defaultName) => DEFAULT_PIPELINE_STAGE_IDS[defaultName] === id);
  return found ?? null;
};

const getDefaultPipelineStageName = (name: string): (typeof DEFAULT_PIPELINE_STAGE_NAMES)[number] | null => {
  const trimmed = String(name || '').trim().toLowerCase();
  const found = DEFAULT_PIPELINE_STAGE_NAMES.find((defaultName) => defaultName.toLowerCase() === trimmed);
  return found ?? null;
};

const normalizeStageLabel = (value: string) =>
  String(value || '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const canonicalStageLabel = (value: string) => {
  const normalized = normalizeStageLabel(value);
  const tokenAliases: Record<string, string> = {
    applied: 'apply',
    application: 'apply',
    interviewed: 'interview',
    interviewing: 'interview',
    rejected: 'reject',
    offered: 'offer',
  };
  const direct = tokenAliases[normalized];
  if (direct) return direct;
  return normalized;
};

type PipelineStageMatchMeta = {
  id: string;
  rawName: string;
  normalized: string;
  canonical: string;
};

function buildPipelineStageMatchMeta(stages: JobPipelineStage[]): PipelineStageMatchMeta[] {
  return (Array.isArray(stages) ? stages : []).map((stage) => {
    const rawName = String(stage?.name || '').trim();
    return {
      id: stage.id,
      rawName,
      normalized: normalizeStageLabel(rawName),
      canonical: canonicalStageLabel(rawName),
    };
  });
}

function resolveCandidateStageId(
  candidateStageRaw: string,
  stageMeta: PipelineStageMatchMeta[],
): string | null {
  const candidateStageNormalized = normalizeStageLabel(candidateStageRaw);
  if (!candidateStageNormalized || stageMeta.length === 0) return null;

  const normalizedStageMap = new Map(stageMeta.map((s) => [s.normalized, s.id]));
  const canonicalStageMap = new Map(stageMeta.map((s) => [s.canonical, s.id]));

  let stageId =
    normalizedStageMap.get(candidateStageNormalized) ||
    canonicalStageMap.get(canonicalStageLabel(candidateStageRaw)) ||
    null;

  if (!stageId) {
    const prefixMatch = stageMeta.find(
      (stage) =>
        candidateStageNormalized.startsWith(`${stage.normalized} `) ||
        stage.normalized.startsWith(`${candidateStageNormalized} `),
    );
    stageId = prefixMatch?.id || null;
  }

  return stageId;
}

function normalizePipelineStages(stages?: JobPipelineStage[] | null): JobPipelineStage[] {
  const input = Array.isArray(stages) ? stages : [];
  const normalizedInput = input
    .map((stage) => ({
      id: String(stage?.id || `s-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
      name: String(stage?.name || '').trim(),
      sla: stage?.sla || '',
      systemRole:
        stage?.systemRole != null && String(stage.systemRole).trim() !== ''
          ? String(stage.systemRole).trim()
          : undefined,
    }))
    .filter((stage) => stage.name.length > 0);

  if (normalizedInput.length === 0) {
    // Last-resort fallback for jobs that have no configured pipeline yet.
    // Rare fallback when a job has no pipeline rows yet (repair runs on next jobs list load).
    return DEFAULT_PIPELINE_STAGE_NAMES.map((defaultName) => ({
      id: DEFAULT_PIPELINE_STAGE_IDS[defaultName],
      name: defaultName,
      sla: '',
      systemRole: undefined,
    }));
  }

  const deduped = (() => {
    const hasAppliedLike = normalizedInput.some(
      (s) =>
        String(s.systemRole || '').toUpperCase() === 'APPLIED' ||
        /^applied$/i.test(String(s.name || '').trim())
    );
    if (!hasAppliedLike) return normalizedInput;
    return normalizedInput.filter((s) => String(s.name || '').trim().toLowerCase() !== 'apply');
  })();

  // Respect whatever the backend returned. Previously this function appended any of the four
  // legacy defaults (Apply/Interview/Reject/Placed) that weren't already present, which caused
  // standalone tenants — whose org template uses Applied/Screening/Interviewing/Offer/Hired/Rejected —
  // to see an extra "Apply" / "Interview" / "Reject" / "Placed" tail glued onto every job's pipeline.
  return deduped;
}

/** Candidate row for Job Candidates list (Candidates tab) */
export interface JobCandidateItem {
  id: string;
  candidateName: string;
  email?: string;
  avatar?: string | null;
  designation?: string;
  company?: string;
  experience?: number;
  location?: string;
  phone?: string;
  currentStage: string;
  score: string | number;
  recruiter: string;
  interviewStatus: string;
  lastActivity: string;
  /** True when linked via apply/assign and CRM stage is Applied */
  isJobAppliedCandidate?: boolean;
}

type PickerResumeVersion = {
  id: string;
  fileUrl: string;
  fileName: string;
  isPrimary?: boolean;
};

type PickerCvMeta = {
  hasOriginal: boolean;
  hasSaasa: boolean;
  hasEdited: boolean;
  originalUrl: string | null;
  saasaUrl: string | null;
  resumeVersions: PickerResumeVersion[];
};

function normalizePickerResumeUrl(url: string): string {
  const raw = String(url || '').trim();
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    return `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, '').toLowerCase();
  } catch {
    return raw.split('?')[0]?.replace(/\/+$/, '').toLowerCase() || '';
  }
}

function isPickerResumeFile(file: {
  fileType?: string;
  fileUrl?: string | null;
  fileName?: string;
}): boolean {
  const type = String(file.fileType || '').trim();
  if (/^SAASA_CV$/i.test(type)) return false;
  const name = String(file.fileName || file.fileUrl || '');
  if (/(?:SAASA|HRYantra|HRYANTRA)[\s_-]*CV/i.test(name)) return false;
  if (/^resume$/i.test(type) || /^cv$/i.test(type)) return true;
  const url = String(file.fileUrl || '');
  if (/\/resumes\/|\/cv-files\//i.test(url)) return true;
  return /\.(pdf|docx?)($|[?#])/i.test(url) || /\.(pdf|docx?)$/i.test(name);
}

function isRealResumeFileId(id: string): boolean {
  return /^[a-f\d]{24}$/i.test(String(id || '').trim());
}

function buildPickerResumeVersions(
  candidate: BackendCandidate | null | undefined,
  files: Array<{
    id: string;
    fileUrl?: string | null;
    fileType?: string;
    fileName?: string;
    uploadDate?: string;
    createdAt?: string;
  }> = [],
): PickerResumeVersion[] {
  const extra =
    candidate?.extraData && typeof candidate.extraData === 'object' && !Array.isArray(candidate.extraData)
      ? (candidate.extraData as Record<string, unknown>)
      : {};
  const primary = String(
    candidate?.resumeUrl || candidate?.resume || extra.originalResumeUrl || '',
  ).trim();
  const primaryKey = normalizePickerResumeUrl(primary);
  const originalKey =
    primaryKey || normalizePickerResumeUrl(String(extra.firstOriginalResumeUrl || '').trim());

  const fileByUrl = new Map<string, PickerResumeVersion & { uploadDate?: string }>();
  for (const file of files) {
    if (!isPickerResumeFile(file)) continue;
    const raw = String(file.fileUrl || '').trim();
    const key = normalizePickerResumeUrl(raw);
    if (!key) continue;
    fileByUrl.set(key, {
      id: file.id,
      fileUrl: raw,
      fileName: file.fileName || 'Resume',
      isPrimary: Boolean(primaryKey && key === primaryKey),
      uploadDate: file.uploadDate || file.createdAt,
    });
  }

  const stored = Array.isArray(extra.resumeVersions) ? extra.resumeVersions : [];
  const fromStored: Array<PickerResumeVersion & { uploadDate?: string }> = stored
    .map((row, index) => {
      if (!row || typeof row !== 'object') return null;
      const item = row as {
        id?: string | null;
        fileUrl?: string | null;
        fileName?: string | null;
        uploadedAt?: string | null;
        isPrimary?: boolean;
      };
      const raw = String(item.fileUrl || '').trim();
      const key = normalizePickerResumeUrl(raw);
      if (!raw || !key) return null;
      const matchedFile = fileByUrl.get(key);
      return {
        id: String(item.id || '').trim() || matchedFile?.id || `stored-${index}-${key}`,
        fileUrl: raw,
        fileName: String(item.fileName || matchedFile?.fileName || '').trim() || 'Resume',
        isPrimary:
          Boolean(item.isPrimary) || Boolean(primaryKey && key === primaryKey),
        uploadDate: item.uploadedAt || matchedFile?.uploadDate || undefined,
      };
    })
    .filter(Boolean) as Array<PickerResumeVersion & { uploadDate?: string }>;

  // Prefer stored resumeVersions so deleted/replaced CVs are not resurrected from files.
  // When files are present, drop stored URLs that no longer have a file (except current primary).
  let versions: Array<PickerResumeVersion & { uploadDate?: string }>;
  if (fromStored.length > 0) {
    versions = fromStored.filter((row) => {
      const key = normalizePickerResumeUrl(row.fileUrl);
      if (primaryKey && key === primaryKey) return true;
      if (fileByUrl.size === 0) return true;
      return fileByUrl.has(key);
    });
  } else {
    versions = Array.from(fileByUrl.values());
  }

  if (primary && !versions.some((row) => normalizePickerResumeUrl(row.fileUrl) === primaryKey)) {
    versions.unshift({
      id: '__primary_resume__',
      fileUrl: primary,
      fileName: String(extra.originalResumeFileName || '').trim() || 'Original CV',
      isPrimary: true,
    });
  }

  versions.sort((a, b) => {
    const aIsOriginal =
      Boolean(originalKey) && normalizePickerResumeUrl(a.fileUrl) === originalKey;
    const bIsOriginal =
      Boolean(originalKey) && normalizePickerResumeUrl(b.fileUrl) === originalKey;
    if (aIsOriginal && !bIsOriginal) return -1;
    if (!aIsOriginal && bIsOriginal) return 1;
    if (a.isPrimary && !b.isPrimary) return -1;
    if (!a.isPrimary && b.isPrimary) return 1;
    const aHas = Boolean(a.uploadDate && Date.parse(String(a.uploadDate)));
    const bHas = Boolean(b.uploadDate && Date.parse(String(b.uploadDate)));
    if (!aHas && bHas) return -1;
    if (aHas && !bHas) return 1;
    const ta = Date.parse(String(a.uploadDate || '')) || 0;
    const tb = Date.parse(String(b.uploadDate || '')) || 0;
    if (ta !== tb) return ta - tb;
    return String(a.fileName || '').localeCompare(String(b.fileName || ''));
  });

  const seen = new Set<string>();
  const unique: PickerResumeVersion[] = [];
  for (const row of versions) {
    const key = normalizePickerResumeUrl(row.fileUrl) || row.id;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({
      id: row.id,
      fileUrl: row.fileUrl,
      fileName: row.fileName,
      isPrimary: row.isPrimary,
    });
  }
  return unique;
}

function buildPickerCvMeta(
  candidate: BackendCandidate | null | undefined,
  files: Array<{
    id: string;
    fileUrl?: string | null;
    fileType?: string;
    fileName?: string;
    uploadDate?: string;
    createdAt?: string;
  }> = [],
): PickerCvMeta {
  const resumeVersions = buildPickerResumeVersions(candidate, files);
  const originalUrl =
    resumeVersions[0]?.fileUrl ||
    String(candidate?.resumeUrl || candidate?.resume || '').trim() ||
    null;
  const saasaUrl =
    resolveSaasaCvPreviewUrl(
      (candidate?.extraData as Record<string, unknown> | null | undefined) || null,
    ) || null;
  return {
    hasOriginal: Boolean(originalUrl) || resumeVersions.length > 0,
    hasSaasa: Boolean(saasaUrl),
    hasEdited: hasEditedCvAvailable(candidate ?? null),
    originalUrl,
    saasaUrl,
    resumeVersions,
  };
}

export interface JobDetailsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  job: JobForDrawer | null;
  /** Candidates applied/sourced for the current job (for Candidates tab) */
  jobCandidates?: JobCandidateItem[];
  /** Custom pipeline stages for this job (for Pipeline tab config). If not provided, default stages are used. */
  pipelineStages?: JobPipelineStage[];
  /** Called when pipeline stages are reordered, added, or removed */
  onPipelineStagesChange?: (stages: JobPipelineStage[]) => void;
  /** Called when user clicks "Save pipeline" */
  onSavePipelineStages?: (stages: JobPipelineStage[]) => void;
  onEdit?: (job: JobForDrawer) => void;
  onPublish?: (job: JobForDrawer) => void;
  onClone?: (job: JobForDrawer) => void;
  onCloseJob?: (job: JobForDrawer) => void;
  onMoveStage?: (candidateId: string, jobId: string) => void;
  /** Same flow as candidate profile drawer Move Stage (AddToPipelineModal). */
  onAddToPipeline?: (payload: {
    candidateId: string;
    jobId: string;
    stage: string;
    recruiterId?: string;
    priority: 'High' | 'Medium' | 'Low';
    notes?: string;
  }) => void | Promise<void>;
  onRemoveFromPipeline?: (payload: { candidateId: string; jobId: string }) => void | Promise<void>;
  pipelineRecruiters?: CandidatePipelineRecruiterOption[];
  onScheduleInterview?: (
    candidateId: string,
    jobId: string,
    pendingStage?: { stageId: string; stageName: string },
    bulkCandidateIds?: string[],
  ) => void;
  /** Open create-placement flow when Offer stage is selected in the candidates table. */
  onCreatePlacement?: (
    candidateId: string,
    jobId: string,
    pendingStage?: { stageId: string; stageName: string },
  ) => void;
  onRejectCandidate?: (candidateId: string, jobId: string) => void;
  onViewCandidateProfile?: (candidate: JobDrawerTableCandidate) => void;
  onEditCandidate?: (candidate: JobDrawerTableCandidate) => void;
  /** Sync scored candidates back to the job page after Run AI Applied Matches */
  onJobCandidatesChange?: (candidates: JobCandidateItem[]) => void;
  /** Called after status is changed from the drawer header */
  onStatusUpdated?: (jobId: string, status: string) => void;
  /** Called after assignment fields are saved from the Assignment tab */
  onAssignmentUpdated?: (jobId: string) => void | Promise<void>;
  /** When true, show Upload CV on the Candidates tab */
  canAddCandidate?: boolean;
  /** `main` fills the page beside the sidenav. `modal` is a centered overlay. */
  layout?: 'main' | 'modal';
}

const TAB_CONFIG = [
  { id: 'overview' as const, label: 'Overview', icon: LayoutGrid },
  { id: 'assessments' as const, label: 'Assessments', icon: ClipboardList },
  { id: 'candidates' as const, label: 'Candidates', icon: Users },
  { id: 'client' as const, label: 'Client', icon: Building2 },
  { id: 'pipeline' as const, label: 'Pipeline', icon: GitBranch },
  { id: 'analytics' as const, label: 'Analytics', icon: BarChart2 },
  { id: 'assignment' as const, label: 'Assignment', icon: UserCog },
  { id: 'interviews' as const, label: 'Interviews', icon: Calendar },
  { id: 'placements' as const, label: 'Placements', icon: UserCheck },
  { id: 'activity' as const, label: 'Activity', icon: Activity },
  { id: 'chat' as const, label: 'Chat', icon: MessageSquare },
  { id: 'notes' as const, label: 'Remarks', icon: StickyNote },
  { id: 'files' as const, label: 'Files', icon: Paperclip },
];
/** Analytics is only opened via header button, not shown in tab bar */
const TABS_VISIBLE_IN_BAR = TAB_CONFIG.filter((t) => t.id !== 'analytics');

/** Job note (same shape as client notes, job-related tags) */
export type JobNoteTag = 'JD' | 'Requirements' | 'Feedback' | 'Hiring' | 'Other';
export interface JobNote {
  id: string;
  title: string;
  content?: string;
  tags: JobNoteTag[];
  createdBy: { name: string; avatar?: string };
  createdAt: string;
  isPinned?: boolean;
}

/** Job file (documents attached to job) */
export type JobFileType = 'JD' | 'Contract' | 'Offer Letter' | 'Policy' | 'Resume' | 'Other';
export interface JobFile {
  id: string;
  fileName: string;
  fileType: JobFileType;
  uploadedBy: { name: string; avatar?: string };
  uploadDate: string;
}

const JOB_NOTE_TAG_STYLES: Record<JobNoteTag, string> = {
  JD: 'bg-blue-100 text-blue-700 border-blue-200',
  Requirements: 'bg-violet-100 text-violet-700 border-violet-200',
  Feedback: 'bg-amber-100 text-amber-700 border-amber-200',
  Hiring: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Other: 'bg-slate-100 text-slate-600 border-slate-200',
};

const JOB_FILE_TYPE_BADGE_STYLES: Record<JobFileType, string> = {
  JD: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  Contract: 'bg-blue-100 text-blue-700 border-blue-200',
  'Offer Letter': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Policy: 'bg-amber-100 text-amber-700 border-amber-200',
  Resume: 'bg-slate-100 text-slate-700 border-slate-200',
  Other: 'bg-slate-100 text-slate-600 border-slate-200',
};

/** Mock notes per job id */
const MOCK_JOB_NOTES: Record<string, JobNote[]> = {
  default: [
    { id: 'jn1', title: 'JD review with hiring manager', content: 'Clarified must-have vs nice-to-have skills. Remote OK.', tags: ['JD', 'Requirements'], createdBy: { name: 'Alex Thompson', avatar: 'https://images.unsplash.com/photo-1701463387028-3947648f1337?q=80&w=150' }, createdAt: 'Mar 5, 2026, 10:30 AM', isPinned: true },
    { id: 'jn2', title: 'Feedback on shortlisted candidates', content: 'Tech lead liked 2 of 5. Requested one more round.', tags: ['Feedback'], createdBy: { name: 'Sarah Chen' }, createdAt: 'Mar 4, 2026, 2:00 PM', isPinned: false },
    { id: 'jn3', title: 'Offer approval', content: 'Comp approved. Start date aligned to Apr 1.', tags: ['Hiring'], createdBy: { name: 'Alex Thompson', avatar: 'https://images.unsplash.com/photo-1701463387028-3947648f1337?q=80&w=150' }, createdAt: 'Mar 3, 2026, 5:00 PM', isPinned: true },
  ],
};

function mapJobCandidateToTableRow(
  candidate: JobCandidateItem,
  jobTitle?: string | null,
  jobId?: string | null,
): JobDrawerTableCandidate {
  const matchScore = parseJobCandidateScore(candidate.score);
  return {
    id: candidate.id,
    name: candidate.candidateName,
    avatar: candidate.avatar ?? null,
    designation: candidate.designation || '—',
    company: candidate.company || '—',
    experience: candidate.experience ?? 0,
    location: candidate.location || '—',
    assignedJobs: jobTitle ? [jobTitle] : [],
    stage: resolveJobCandidateDisplayStage(candidate.currentStage),
    isJobAppliedCandidate:
      candidate.isJobAppliedCandidate ??
      resolveJobCandidateDisplayStage(candidate.currentStage) === 'Applied',
    owner: candidate.recruiter || 'Unassigned',
    lastActivity: candidate.lastActivity || '—',
    hotlist: false,
    phone: candidate.phone || '',
    email: candidate.email || '',
    skills: [],
    noticePeriod: '',
    salary: { current: '', expected: '' },
    source: '',
    rating: 0,
    pipelineJobId: jobId || undefined,
    matchScore: matchScore > 0 ? matchScore : undefined,
    matchScoreBand: matchScore > 0 ? displayMatchBand(matchScore) : undefined,
  };
}

function matchCandidateToJobTableRow(
  match: MatchCandidate,
  jobTitle?: string | null,
  jobId?: string | null,
): JobDrawerTableCandidate {
  return {
    id: match.id,
    name: match.name,
    avatar: match.photo || null,
    designation: match.currentTitle || '—',
    company: match.currentCompany || '—',
    experience: match.experience ?? 0,
    location: match.location || '—',
    assignedJobs: jobTitle ? [jobTitle] : [],
    stage: match.status || 'New',
    owner: '—',
    lastActivity: '—',
    hotlist: false,
    phone: match.phone || '',
    email: match.email || '',
    skills: match.skills || [],
    noticePeriod: match.noticePeriod || '',
    salary: {
      current: '',
      expected: match.salary?.amount ? String(match.salary.amount) : '',
    },
    source: match.matchSource || '',
    rating: match.matchRating ?? 0,
    pipelineJobId: jobId || undefined,
    matchScore: match.score,
    matchId: match.matchId,
    matchScoreBand: match.score > 0 ? displayMatchBand(match.score) : undefined,
  };
}

const STATUS_STYLES: Record<string, string> = {
  Draft: 'bg-slate-100 text-slate-700 border-slate-200',
  Active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'On Hold': 'bg-amber-100 text-amber-700 border-amber-200',
  Closed: 'bg-gray-100 text-gray-600 border-gray-200',
  'Closed Won': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  'Closed not Won': 'bg-gray-100 text-gray-700 border-gray-200',
  Duplicate: 'bg-rose-50 text-rose-700 border-rose-200',
};

function statusStyleFor(status: string): string {
  return STATUS_STYLES[status] || jobStatusPillClass(status);
}

const JobDrawerStatusDropdown = ({
  value,
  options,
  onSelect,
  onDelete,
  deleting,
}: {
  value: string;
  options: string[];
  onSelect: (status: string) => void;
  onDelete: (status: string) => void;
  deleting: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const closeMenu = useCallback(() => setOpen(false), []);
  const { triggerRef, menuRef, menuPosition } = useDrawerPortalDropdownPosition(open, false, closeMenu);

  const menu =
    open && menuPosition && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            className="fixed z-[1200] max-h-64 overflow-auto rounded-xl border border-slate-200 bg-white shadow-2xl"
            style={{
              left: menuPosition.left,
              width: Math.max(menuPosition.width, 240),
              ...(menuPosition.placement === 'top'
                ? { bottom: menuPosition.bottom }
                : { top: menuPosition.top }),
            }}
          >
            {options.map((status) => {
              const isActive = String(value || '') === String(status || '');
              const canDelete = !isProtectedJobStatus(status);
              return (
                <div
                  key={status}
                  className={`flex w-full items-center gap-1 px-1.5 py-0.5 ${
                    isActive ? 'bg-blue-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(status);
                      setOpen(false);
                    }}
                    className={`min-w-0 flex-1 rounded-lg px-2 py-1.5 text-left text-sm ${
                      isActive ? 'text-blue-700 font-semibold' : 'text-slate-800'
                    }`}
                  >
                    {status}
                  </button>
                  {canDelete ? (
                    <button
                      type="button"
                      title={`Delete ${status}`}
                      aria-label={`Delete ${status}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onDelete(status);
                      }}
                      disabled={deleting}
                      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-1.5 py-1 text-[10px] font-bold text-rose-600 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Trash2 className="h-3 w-3" />
                      Delete
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${statusStyleFor(value)} hover:opacity-90`}
      >
        <span>{value}</span>
        <ChevronDown size={12} className="opacity-70" />
      </button>
      {menu}
    </div>
  );
};

type JobCandidateMatchMode = 'applied' | 'ai';

function JobCandidateMatchModeToggle({
  mode,
  onChange,
}: {
  mode: JobCandidateMatchMode;
  onChange: (mode: JobCandidateMatchMode) => void;
}) {
  return (
    <div className="inline-flex rounded-xl border border-[#E5E7EB] bg-white p-0.5">
      <button
        type="button"
        onClick={() => onChange('applied')}
        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
          mode === 'applied'
            ? 'bg-[#2563EB] text-white shadow-sm'
            : 'text-slate-600 hover:bg-slate-50'
        }`}
      >
        <Users size={16} />
        AI Applied Matches
      </button>
      <button
        type="button"
        onClick={() => onChange('ai')}
        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
          mode === 'ai'
            ? 'bg-[#2563EB] text-white shadow-sm'
            : 'text-slate-600 hover:bg-slate-50'
        }`}
      >
        <Sparkles size={16} />
        AI Matches
      </button>
    </div>
  );
}

interface JobDrawerAiMatchesTabProps {
  job: JobForDrawer;
  aiMatchCandidates: MatchCandidate[];
  sortedAiMatchCandidates: MatchCandidate[];
  aiTierStats: ReturnType<typeof computeAiTierStats>;
  aiMatchesLoading: boolean;
  aiPipelineRunning: boolean;
  aiMatchesError: string | null;
  aiMatchSelectedIds: string[];
  aiSavedMatches: string[];
  aiExpandedAnalysis: string | null;
  onRunAiMatches: () => void | Promise<void>;
  onToggleSelect: (candidateId: string) => void;
  onToggleSelectAll: () => void;
  onToggleSave: (candidateId: string) => void;
  onToggleAnalysis: (candidateId: string) => void;
  onViewProfile: (candidateId: string) => void;
  onOpenSubmit: (candidateId: string) => void;
  isColumnVisible?: (columnId: string) => boolean;
  columnsMenu?: React.ReactNode;
}

function JobDrawerAiMatchesTab({
  job,
  aiMatchCandidates,
  sortedAiMatchCandidates,
  aiTierStats,
  aiMatchesLoading,
  aiPipelineRunning,
  aiMatchesError,
  aiMatchSelectedIds,
  aiSavedMatches,
  aiExpandedAnalysis,
  onRunAiMatches,
  onToggleSelect,
  onToggleSelectAll,
  onToggleSave,
  onToggleAnalysis,
  onViewProfile,
  onOpenSubmit,
  isColumnVisible,
  columnsMenu,
}: JobDrawerAiMatchesTabProps) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<TablePageSize>(50);
  const totalPages = Math.max(1, Math.ceil(sortedAiMatchCandidates.length / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const pagedCandidates = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return sortedAiMatchCandidates.slice(start, start + pageSize);
  }, [sortedAiMatchCandidates, safePage, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [job?.id, pageSize, sortedAiMatchCandidates.length]);

  return (
    <DrawerSectionCard
      title="AI Matches"
      subtitle={`4-pass AI pipeline for ${job.title}`}
      icon={Sparkles}
      accent="violet"
      headerRight={columnsMenu}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {aiMatchCandidates.length > 0 ? (
            <p className="text-[11px] font-medium text-indigo-700/80">
              {AI_SCORE_TIERS.map((t) => `${t.label}: ${aiTierStats[t.id]}`).join(' · ')}
            </p>
          ) : (
            <p className="text-xs text-slate-500">
              Switch to AI Matches to run the 4-pass pipeline, or click Run AI Matches to refresh scores.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => void onRunAiMatches()}
          disabled={!job?.id || aiMatchesLoading || aiPipelineRunning}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:from-violet-700 hover:via-indigo-700 hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          title="Run the 4-pass AI matching pipeline for this job"
        >
          <Sparkles size={16} className={aiPipelineRunning ? 'animate-spin' : ''} strokeWidth={2.25} />
          {aiPipelineRunning ? 'Running AI matches…' : 'Run AI Matches'}
        </button>
      </div>

      {aiMatchesError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {aiMatchesError}
        </div>
      ) : null}

      {aiMatchesLoading || aiPipelineRunning ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
          <Loader2 className="size-5 animate-spin text-indigo-600" />
          {aiPipelineRunning ? 'Running AI matching pipeline…' : 'Loading matches…'}
        </div>
      ) : aiMatchCandidates.length === 0 ? (
        <div className="py-12 text-center">
          <Sparkles size={32} className="mx-auto mb-3 text-indigo-200" />
          <p className="text-sm text-slate-500">No AI matches yet. Run the pipeline to score candidates.</p>
        </div>
      ) : sortedAiMatchCandidates.length === 0 ? (
        <div className="py-12 text-center">
          <Search size={28} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm text-slate-500">No AI matches match your search.</p>
        </div>
      ) : (
        <>
        <div className="no-scrollbar -mx-1 overflow-x-auto">
          <MatchCandidateTable
              candidates={pagedCandidates}
            activeView="internal"
            selectedCandidates={aiMatchSelectedIds}
            savedMatches={aiSavedMatches}
            expandedAnalysis={aiExpandedAnalysis}
            showMatchScore
              isColumnVisible={isColumnVisible}
            onToggleSelect={onToggleSelect}
              onToggleSelectAll={() => {
                const pageIds = pagedCandidates.map((row) => row.id);
                const allPageSelected =
                  pageIds.length > 0 && pageIds.every((id) => aiMatchSelectedIds.includes(id));
                if (allPageSelected) {
                  pageIds.forEach((id) => {
                    if (aiMatchSelectedIds.includes(id)) onToggleSelect(id);
                  });
                  return;
                }
                pageIds.forEach((id) => {
                  if (!aiMatchSelectedIds.includes(id)) onToggleSelect(id);
                });
              }}
            onToggleSave={onToggleSave}
            onToggleAnalysis={onToggleAnalysis}
            onViewProfile={onViewProfile}
            onOpenPipeline={() => {
              void requestInfo('Use the Pipeline tab or Matches page to add candidates to the pipeline.');
            }}
            onOpenSubmit={onOpenSubmit}
            onOpenReject={() => {
              void requestInfo('Use the Matches page to reject AI match rows.');
            }}
            onRateMatch={() => undefined}
          />
        </div>
          <div className={PH2_TABLE_CARD_FOOTER_CLASS}>
            <PaginationAll
              initialPage={safePage}
              totalPages={totalPages}
              totalCount={sortedAiMatchCandidates.length}
              pageSize={pageSize}
              pageSizeOptions={[...TABLE_PAGE_SIZE_OPTIONS]}
              onPageSizeChange={(n) => {
                if (!(TABLE_PAGE_SIZE_OPTIONS as readonly number[]).includes(n)) return;
                setPageSize(n as TablePageSize);
                setPage(1);
              }}
              itemLabel="matches"
              onPageChange={setPage}
            />
          </div>
        </>
      )}
    </DrawerSectionCard>
  );
}

export function JobDetailsDrawer({
  isOpen,
  onClose,
  job,
  onEdit,
  onPublish,
  onClone,
  onCloseJob,
  jobCandidates: jobCandidatesProp,
  pipelineStages: initialPipelineStages,
  onPipelineStagesChange,
  onSavePipelineStages,
  onMoveStage,
  onAddToPipeline,
  onRemoveFromPipeline,
  pipelineRecruiters: pipelineRecruitersProp,
  onScheduleInterview,
  onCreatePlacement,
  onRejectCandidate,
  onViewCandidateProfile,
  onEditCandidate,
  onJobCandidatesChange,
  onStatusUpdated,
  onAssignmentUpdated,
  canAddCandidate = false,
  layout = 'main',
}: JobDetailsDrawerProps) {
  usePageDrawerLifecycle(isOpen);
  const jobCandidates = orEmpty(jobCandidatesProp);
  const pipelineRecruiters = orEmpty(pipelineRecruitersProp);
  const [pipelineStages, setPipelineStages] = useState<JobPipelineStage[]>(normalizePipelineStages(initialPipelineStages));
  const [draggedStageId, setDraggedStageId] = useState<string | null>(null);
  const [pipelineDirty, setPipelineDirty] = useState(false);
  const {
    panelRef: jobDrawerPanelRef,
    requestClose: requestJobDrawerClose,
  } = useDrawerUnsavedGuard<HTMLDivElement>({
    isOpen,
    onClose,
    isDirty: pipelineDirty,
  });
  const [pipelineValidationError, setPipelineValidationError] = useState('');
  const [orgRecruitmentMode, setOrgRecruitmentMode] = useState<'agency' | 'standalone'>(() =>
    typeof window !== 'undefined' ? getCachedOrgRecruitmentMode() : 'agency'
  );
  const [jobPipelineCustomized, setJobPipelineCustomized] = useState(false);
  const isOwnPipelineEditRef = useRef(false);

  useEffect(() => {
    const on = () => setOrgRecruitmentMode(getCachedOrgRecruitmentMode());
    window.addEventListener(ORG_RECRUITMENT_CACHE_EVENT, on);
    return () => window.removeEventListener(ORG_RECRUITMENT_CACHE_EVENT, on);
  }, []);

  useEffect(() => {
    setJobPipelineCustomized(false);
  }, [job?.id]);

  useEffect(() => {
    if (job) {
      if (isOwnPipelineEditRef.current) {
        // Local edit already updated state; avoid re-normalizing and losing drag order.
      } else {
        const normalized = normalizePipelineStages(initialPipelineStages);
        setPipelineStages(normalized);
      }
      if (!isOwnPipelineEditRef.current) {
        // Never auto-mark dirty just because the backend returned no stages —
        // doing so caused the four fallback stages (Apply/Interview/Reject/Placed)
        // to silently get saved on the next user-triggered save, polluting jobs
        // that should have been using the org pipeline template instead.
        setPipelineDirty(false);
      }
      setPipelineValidationError('');
      isOwnPipelineEditRef.current = false;
    }
  }, [job?.id, initialPipelineStages]);

  const notifyPipelineChange = (stages: JobPipelineStage[]) => {
    isOwnPipelineEditRef.current = true;
    onPipelineStagesChange?.(stages);
  };

  const pipelineConfigLocked = !jobPipelineCustomized;

  const [activeTab, setActiveTab] = useState<(typeof TAB_CONFIG)[number]['id']>('overview');
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [displayJobCandidates, setDisplayJobCandidates] = useState<JobCandidateItem[]>(jobCandidates);
  const [clientRemarkCandidates, setClientRemarkCandidates] = useState<JobClientRemarkCandidate[]>([]);
  const [clientRemarksClientName, setClientRemarksClientName] = useState('');
  const [clientRemarksCount, setClientRemarksCount] = useState(0);
  const [loadingClientRemarks, setLoadingClientRemarks] = useState(false);
  const [clientRemarksError, setClientRemarksError] = useState('');
  const [appliedPipelineRunning, setAppliedPipelineRunning] = useState(false);
  const [appliedCandidatesLoading, setAppliedCandidatesLoading] = useState(false);
  const [candidateMatchMode, setCandidateMatchMode] = useState<JobCandidateMatchMode>('applied');
  const candidateColumnVisibility = usePersistedColumnVisibility(
    'candidates.visibleColumns',
    CANDIDATE_TABLE_COLUMNS,
  );
  const matchColumnVisibility = usePersistedColumnVisibility(
    'matches.visibleColumns',
    MATCH_TABLE_COLUMNS,
  );
  const [candidatesPage, setCandidatesPage] = useState(1);
  const [candidatesPageSize, setCandidatesPageSize] = useState<TablePageSize>(50);
  const [jobCandidatesSearch, setJobCandidatesSearch] = useState('');
  /** Pipeline stage chip filter on Candidates tab (`all` = every stage). */
  const [candidatesStageFilterId, setCandidatesStageFilterId] = useState<string>('all');
  const prevCandidatesTabJobIdRef = useRef<string | null>(null);
  const wasOnCandidatesTabRef = useRef(false);
  const [showMatchScores, setShowMatchScores] = useState(false);
  const [submitClientRowId, setSubmitClientRowId] = useState<string | null>(null);
  const [deletingCandidateId, setDeletingCandidateId] = useState<string | null>(null);
  const [removingFromJobCandidateId, setRemovingFromJobCandidateId] = useState<string | null>(null);
  const [submitCandidatePickerOpen, setSubmitCandidatePickerOpen] = useState(false);
  const [scheduleCandidatePickerOpen, setScheduleCandidatePickerOpen] = useState(false);
  const [schedulePickerSelectedIds, setSchedulePickerSelectedIds] = useState<string[]>([]);
  const [schedulePickerSearch, setSchedulePickerSearch] = useState('');
  const [pickerSelectedIds, setPickerSelectedIds] = useState<string[]>([]);
  const [pickerSearch, setPickerSearch] = useState('');
  /** When set, picker only lists these candidates (table selection). Null = show all job candidates. */
  const [pickerScopeIds, setPickerScopeIds] = useState<string[] | null>(null);
  const [pickerCvModeById, setPickerCvModeById] = useState<Record<string, CvShareMode>>({});
  const [pickerResumeFileIdById, setPickerResumeFileIdById] = useState<Record<string, string>>({});
  const [pickerCvMetaById, setPickerCvMetaById] = useState<Record<string, PickerCvMeta>>({});
  const [pickerCvMetaLoading, setPickerCvMetaLoading] = useState(false);
  const pickerCvMetaByIdRef = useRef<Record<string, PickerCvMeta>>({});
  const pickerCvMetaInFlightRef = useRef<Set<string>>(new Set());
  pickerCvMetaByIdRef.current = pickerCvMetaById;
  const [pickerSaasaTarget, setPickerSaasaTarget] = useState<{
    id: string;
    name: string;
    resumeUrl: string | null;
    extraData: Record<string, unknown> | null;
  } | null>(null);
  const [pickerSaasaOpenToken, setPickerSaasaOpenToken] = useState(0);
  const [pickerResumePreview, setPickerResumePreview] = useState<{
    url: string;
    name: string;
  } | null>(null);
  const {
    openFromJobDrawerRow,
    openSubmit,
    openBulkSubmit,
    submitModalElement: submitToClientModal,
  } = useSubmitToClientModal({
    onClosed: () => setSubmitClientRowId(null),
  });

  const applyPickerCvMeta = useCallback((
    candidateId: string,
    candidate: BackendCandidate | null,
    files: Array<{
      id: string;
      fileUrl?: string | null;
      fileType?: string;
      fileName?: string;
      uploadDate?: string;
      createdAt?: string;
    }> = [],
  ) => {
    const meta = buildPickerCvMeta(candidate, files);
    setPickerCvMetaById((prev) => ({ ...prev, [candidateId]: meta }));
    const defaultVersion =
      meta.resumeVersions.find((row) => row.isPrimary) || meta.resumeVersions[0] || null;
    if (defaultVersion?.id) {
      setPickerResumeFileIdById((prev) => ({ ...prev, [candidateId]: defaultVersion.id }));
    }
    const mode = resolveDefaultCvShareMode(candidate, meta.hasOriginal, meta.hasSaasa);
    if (mode === 'original' || mode === 'saasa') {
      setPickerCvModeById((prev) => ({ ...prev, [candidateId]: mode }));
    } else if (meta.hasOriginal) {
      setPickerCvModeById((prev) => ({ ...prev, [candidateId]: 'original' }));
    } else if (meta.hasSaasa) {
      setPickerCvModeById((prev) => ({ ...prev, [candidateId]: 'saasa' }));
    }
    return meta;
  }, []);

  const refreshPickerCvMetaForCandidate = useCallback(async (candidateId: string) => {
    try {
      const [candidateRaw, filesRaw] = await Promise.all([
        apiGetCandidate(candidateId),
        filesApiGet('candidate', candidateId).catch(() => null),
      ]);
      const candidate = extractApiData<BackendCandidate>(candidateRaw);
      const files = extractApiData(filesRaw) ?? [];
      applyPickerCvMeta(
        candidateId,
        candidate,
        files.map((f) => ({
          id: f.id,
          fileUrl: f.fileUrl,
          fileType: f.fileType,
          fileName: f.fileName,
          uploadDate: f.uploadDate,
          createdAt: (f as { createdAt?: string }).createdAt,
        })),
      );
    } catch {
      /* keep prior meta */
    }
  }, [applyPickerCvMeta]);

  /** Fetch CV options and paint as each finishes (don't wait for the whole list). */
  const loadPickerCvMetaForIds = useCallback(
    async (ids: string[], options?: { force?: boolean }) => {
      const uniqueIds = Array.from(new Set(ids.map((id) => String(id || '').trim()).filter(Boolean)));
      const toFetch = uniqueIds.filter((id) => {
        if (!options?.force && pickerCvMetaByIdRef.current[id]) return false;
        if (pickerCvMetaInFlightRef.current.has(id)) return false;
        return true;
      });
      if (!toFetch.length) {
        setPickerCvMetaLoading(false);
        return;
      }

      setPickerCvMetaLoading(true);
      toFetch.forEach((id) => pickerCvMetaInFlightRef.current.add(id));
      let pending = toFetch.length;

      await Promise.all(
        toFetch.map(async (id) => {
          try {
            const [candidateRaw, filesRaw] = await Promise.all([
              apiGetCandidate(id),
              filesApiGet('candidate', id).catch(() => null),
            ]);
            const candidate = extractApiData<BackendCandidate>(candidateRaw);
            const files = extractApiData(filesRaw) ?? [];
            applyPickerCvMeta(
              id,
              candidate,
              files.map((f) => ({
                id: f.id,
                fileUrl: f.fileUrl,
                fileType: f.fileType,
                fileName: f.fileName,
                uploadDate: f.uploadDate,
                createdAt: (f as { createdAt?: string }).createdAt,
              })),
            );
          } catch {
            setPickerCvMetaById((prev) => ({
              ...prev,
              [id]: {
                hasOriginal: false,
                hasSaasa: false,
                hasEdited: false,
                originalUrl: null,
                saasaUrl: null,
                resumeVersions: [],
              },
            }));
          } finally {
            pickerCvMetaInFlightRef.current.delete(id);
            pending -= 1;
            if (pending <= 0) setPickerCvMetaLoading(false);
          }
        }),
      );
      setPickerCvMetaLoading(false);
    },
    [applyPickerCvMeta],
  );

  const ensurePickerCvMeta = useCallback(
    (candidateId: string) => {
      const id = String(candidateId || '').trim();
      if (!id) return;
      void loadPickerCvMetaForIds([id]);
    },
    [loadPickerCvMetaForIds],
  );

  const pickerSaasaCv = useSaasaCvAnnotations({
    candidateId: pickerSaasaTarget?.id || null,
    candidateName: pickerSaasaTarget?.name || 'Candidate',
    resumeUrl: pickerSaasaTarget?.resumeUrl || null,
    extraData: pickerSaasaTarget?.extraData || null,
    enabled: Boolean(pickerSaasaTarget?.id),
    canEdit: true,
    onToast: (message) => {
      if (message) toast.error(message);
    },
    onCandidateUpdated: async () => {
      const id = pickerSaasaTarget?.id;
      if (!id) return;
      await refreshPickerCvMetaForCandidate(id);
      setPickerCvModeById((prev) => ({ ...prev, [id]: 'saasa' }));
    },
    onViewModeChange: (mode) => {
      const id = pickerSaasaTarget?.id;
      if (!id || mode !== 'saasa') return;
      setPickerCvModeById((prev) => ({ ...prev, [id]: 'saasa' }));
      void refreshPickerCvMetaForCandidate(id);
    },
  });

  useEffect(() => {
    if (!pickerSaasaTarget?.id || !pickerSaasaOpenToken) return;
    const timer = window.setTimeout(() => {
      pickerSaasaCv.openModal();
    }, 200);
    return () => window.clearTimeout(timer);
    // Only re-open when the user explicitly requests the editor for a candidate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickerSaasaTarget?.id, pickerSaasaOpenToken]);

  const openPickerUpdatedCvEditor = useCallback(
    async (candidateId: string, candidateName: string) => {
      try {
        const candidate = extractApiData<BackendCandidate>(await apiGetCandidate(candidateId));
        const resumeUrl = String(candidate?.resumeUrl || candidate?.resume || '').trim();
        if (!resumeUrl) {
          toast.error('No original resume on file — upload a CV before editing Updated / HRYantra CV.');
          return;
        }
        const extraData =
          candidate?.extraData &&
          typeof candidate.extraData === 'object' &&
          !Array.isArray(candidate.extraData)
            ? (candidate.extraData as Record<string, unknown>)
            : null;
        setPickerSaasaTarget({
          id: candidateId,
          name: candidateName || 'Candidate',
          resumeUrl,
          extraData,
        });
        setPickerSaasaOpenToken((n) => n + 1);
        // Ensure the row stays selected while editing.
        setPickerSelectedIds((prev) => (prev.includes(candidateId) ? prev : [...prev, candidateId]));
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : 'Could not open HRYantra CV editor');
      }
    },
    [],
  );

  const [moveStageModalOpen, setMoveStageModalOpen] = useState(false);
  const [moveStageCandidate, setMoveStageCandidate] = useState<CandidateProfileDrawerData | null>(null);
  const [inlineStageOptionsByJobId, setInlineStageOptionsByJobId] = useState<
    Record<string, Array<{ id: string; name: string }>>
  >({});
  const [inlineStageOptionsLoadingJobId, setInlineStageOptionsLoadingJobId] = useState<string | null>(
    null,
  );
  const [inlineStageUpdatingCandidateId, setInlineStageUpdatingCandidateId] = useState<string | null>(
    null,
  );
  const [aiMatchCandidates, setAiMatchCandidates] = useState<MatchCandidate[]>([]);
  const [aiMatchesLoading, setAiMatchesLoading] = useState(false);
  const [aiPipelineRunning, setAiPipelineRunning] = useState(false);
  const [aiMatchesError, setAiMatchesError] = useState<string | null>(null);
  const [aiMatchSelectedIds, setAiMatchSelectedIds] = useState<string[]>([]);
  const [aiSavedMatches, setAiSavedMatches] = useState<string[]>([]);
  const [aiExpandedAnalysis, setAiExpandedAnalysis] = useState<string | null>(null);
  const prevAiTabJobIdRef = useRef<string | null>(null);
  const prevOnAiTabRef = useRef(false);
  const [uploadingJobCv, setUploadingJobCv] = useState(false);
  const [jobCvUploadProgress, setJobCvUploadProgress] = useState<{ done: number; total: number } | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSubmitClientRowId(null);
    setSubmitCandidatePickerOpen(false);
    setPickerSelectedIds([]);
    setPickerScopeIds(null);
    setPickerSearch('');
    setPickerCvModeById({});
    setPickerCvMetaById({});
    setPickerCvMetaLoading(false);
    setPickerSaasaTarget(null);
    setPickerSaasaOpenToken(0);
    setPickerResumePreview(null);
  }, [job?.id, isOpen]);

  useEffect(() => {
    setInlineStageOptionsByJobId({});
    setInlineStageOptionsLoadingJobId(null);
    setInlineStageUpdatingCandidateId(null);
  }, [job?.id, isOpen]);

  useEffect(() => {
    setDisplayJobCandidates(jobCandidates);
    const hasScores = jobCandidates.some((row) => parseJobCandidateScore(row.score) > 0);
    setShowMatchScores(hasScores);
  }, [jobCandidates, job?.id]);

  const jobTableCandidates = useMemo(
    () => displayJobCandidates.map((row) => mapJobCandidateToTableRow(row, job?.title, job?.id)),
    [displayJobCandidates, job?.id, job?.title],
  );

  const candidatesStageMatchMeta = useMemo(
    () => buildPipelineStageMatchMeta(pipelineStages),
    [pipelineStages],
  );

  const filteredJobTableCandidates = useMemo(() => {
    const query = jobCandidatesSearch.trim().toLowerCase();
    return jobTableCandidates.filter((row) => {
      if (candidatesStageFilterId !== 'all') {
        const stageId = resolveCandidateStageId(String(row.stage || ''), candidatesStageMatchMeta);
        if (stageId !== candidatesStageFilterId) return false;
      }
      if (!query) return true;
      return matchesQuickSearch(
        buildQuickSearchHaystack(
          row.name,
          row.email,
          row.designation,
          row.company,
          row.location,
          row.stage,
          ...(Array.isArray(row.assignedJobs) ? row.assignedJobs : []),
        ),
        query,
      );
    });
  }, [
    jobTableCandidates,
    jobCandidatesSearch,
    candidatesStageFilterId,
    candidatesStageMatchMeta,
  ]);

  const candidatesTotalPages = Math.max(
    1,
    Math.ceil(filteredJobTableCandidates.length / candidatesPageSize),
  );
  const safeCandidatesPage = Math.min(Math.max(candidatesPage, 1), candidatesTotalPages);
  const pagedJobTableCandidates = useMemo(() => {
    const start = (safeCandidatesPage - 1) * candidatesPageSize;
    return filteredJobTableCandidates.slice(start, start + candidatesPageSize);
  }, [filteredJobTableCandidates, safeCandidatesPage, candidatesPageSize]);

  useEffect(() => {
    setCandidatesPage(1);
  }, [job?.id, candidatesPageSize, jobCandidatesSearch, candidatesStageFilterId]);

  useEffect(() => {
    if (candidatesPage > candidatesTotalPages) {
      setCandidatesPage(candidatesTotalPages);
    }
  }, [candidatesPage, candidatesTotalPages]);

  useEffect(() => {
    setJobCandidatesSearch('');
    setCandidatesStageFilterId('all');
  }, [job?.id, isOpen]);

  const pipelineJobOptions = useMemo((): CandidatePipelineJobOption[] => {
    if (!job?.id) return [];
    return [
      {
        id: job.id,
        title: job.title,
        department: job.department || job.clientName || null,
        clientId: job.clientId ?? null,
        clientName: job.clientName ?? null,
      },
    ];
  }, [job?.clientId, job?.clientName, job?.department, job?.id, job?.title]);

  const openMoveStageFromTable = useCallback(
    (row: JobDrawerTableCandidate) => {
      if (!job?.id || !onAddToPipeline) return;
      const source = displayJobCandidates.find((c) => c.id === row.id);
      if (!source) return;
      setMoveStageCandidate(
        jobCandidateItemToMoveStageProfile(source, {
          id: job.id,
          title: job.title,
          department: job.department,
          clientId: job.clientId,
          clientName: job.clientName,
        }),
      );
      setMoveStageModalOpen(true);
    },
    [displayJobCandidates, job, onAddToPipeline],
  );

  const pickerCandidates = useMemo(() => {
    const query = pickerSearch.trim().toLowerCase();
    let list = Array.isArray(displayJobCandidates) ? displayJobCandidates.filter((row) => row?.id) : [];
    if (pickerScopeIds?.length) {
      const scope = new Set(pickerScopeIds);
      list = list.filter((row) => scope.has(row.id));
    }
    if (!query) return list;
    return list.filter((row) =>
      matchesQuickSearch(
        buildQuickSearchHaystack(row.candidateName, row.email, row.currentStage),
        query,
      ),
    );
  }, [displayJobCandidates, pickerScopeIds, pickerSearch]);

  const openSubmitCandidatePicker = useCallback(() => {
    if (!job?.id) return;
    const list = Array.isArray(displayJobCandidates) ? displayJobCandidates.filter((row) => row?.id) : [];
    if (!list.length) {
      setActiveTab('candidates');
      void requestError('Add a candidate to this job before submitting to the client.');
      return;
    }
    const preselected = selectedCandidateIds.filter((id) => list.some((row) => row.id === id));
    // Table selection → only show those candidates. Header submit (none selected) → show all.
    if (preselected.length) {
      setPickerScopeIds(preselected);
      setPickerSelectedIds(preselected);
    } else {
      setPickerScopeIds(null);
      setPickerSelectedIds(list.length === 1 ? [list[0].id] : []);
    }
    setPickerSearch('');
    setPickerCvModeById({});
    setPickerResumeFileIdById({});
    setPickerCvMetaById({});
    pickerCvMetaByIdRef.current = {};
    pickerCvMetaInFlightRef.current.clear();
    setSubmitCandidatePickerOpen(true);

    const priorityIds = preselected.length
      ? preselected
      : list.length === 1
        ? [list[0].id]
        : list.slice(0, 3).map((row) => row.id);
    void loadPickerCvMetaForIds(priorityIds);
  }, [displayJobCandidates, job?.id, loadPickerCvMetaForIds, selectedCandidateIds]);

  const confirmSubmitCandidatePicker = useCallback(() => {
    if (!job?.id) return;
    const rows = (Array.isArray(displayJobCandidates) ? displayJobCandidates : []).filter((row) =>
      pickerSelectedIds.includes(row.id),
    );
    if (!rows.length) {
      void requestError('Choose at least one candidate to submit to the client.');
      return;
    }
    const missingMode = rows.find((row) => !pickerCvModeById[row.id]);
    if (missingMode) {
      void requestError(
        `Choose which CV to send for ${missingMode.candidateName || 'each selected candidate'} — a resume version (v1, v2, …) or HRYantra CV.`,
      );
      return;
    }
    setSubmitCandidatePickerOpen(false);
    openBulkSubmit(
      Array.from(
        new Map(
          rows.map((row) => {
            const mode = pickerCvModeById[row.id];
            const resumeFileId =
              mode === 'original' ? pickerResumeFileIdById[row.id] : undefined;
            return [
              row.id,
              {
        candidateId: row.id,
        jobId: job.id,
        candidateName: row.candidateName,
        jobTitle: job.title,
        clientId: job.clientId ?? undefined,
        matchScore: parseJobCandidateScore(row.score),
                cvShareMode: mode,
                resumeFileId:
                  resumeFileId && isRealResumeFileId(resumeFileId) ? resumeFileId : undefined,
              },
            ];
          }),
        ).values(),
      ),
    );
    setSelectedCandidateIds([]);
    setPickerSelectedIds([]);
    setPickerScopeIds(null);
    setPickerCvModeById({});
    setPickerResumeFileIdById({});
    setPickerCvMetaById({});
  }, [
    displayJobCandidates,
    job,
    openBulkSubmit,
    pickerCvModeById,
    pickerResumeFileIdById,
    pickerSelectedIds,
  ]);

  const openBulkSubmitToClient = useCallback(() => {
    // Same flow as the header button: CV picker (Original vs HRYantra) then submit.
    openSubmitCandidatePicker();
  }, [openSubmitCandidatePicker]);

  const openBulkScheduleInterview = useCallback(() => {
    const jobId = String(job?.id || '').trim();
    if (!jobId) {
      toast.error('No job selected.');
      return;
    }
    if (!onScheduleInterview) {
      toast.error('Schedule Interview is not available');
      return;
    }
    const ids = selectedCandidateIds.filter(Boolean);
    if (!ids.length) {
      toast.error('Select at least one candidate to schedule an interview.');
      return;
    }
    onScheduleInterview(ids[0]!, jobId, undefined, ids.length > 1 ? ids : undefined);
  }, [job?.id, onScheduleInterview, selectedCandidateIds]);

  const schedulePickerCandidates = useMemo(() => {
    const query = schedulePickerSearch.trim().toLowerCase();
    const list = Array.isArray(displayJobCandidates) ? displayJobCandidates.filter((row) => row?.id) : [];
    if (!query) return list;
    return list.filter((row) =>
      matchesQuickSearch(
        buildQuickSearchHaystack(row.candidateName, row.email, row.currentStage),
        query,
      ),
    );
  }, [displayJobCandidates, schedulePickerSearch]);

  /** When rows are checked, only the selection-bar Submit shows — avoids two CTAs. */
  const showHeaderSubmitToClient =
    Boolean(job?.id) && selectedCandidateIds.length === 0;

  const stageOptionsFromJobPipeline = useMemo(() => {
    if (!job?.id) return {} as Record<string, Array<{ id: string; name: string }>>;
    // Only keep real DB stage ids — fake defaults (`default-*-stage` / `s-*`) break POST /pipeline/.../move.
    const mapped = (Array.isArray(pipelineStages) ? pipelineStages : [])
      .map((stage) => ({
        id: String(stage?.id || '').trim(),
        name: String(stage?.name || '').trim(),
      }))
      .filter((stage) => stage.id && stage.name && isValidObjectId(stage.id));
    return mapped.length ? { [job.id]: mapped } : {};
  }, [job?.id, pipelineStages]);

  const inlineStageOptionsMerged = useMemo(
    () => ({
      ...stageOptionsFromJobPipeline,
      ...inlineStageOptionsByJobId,
    }),
    [inlineStageOptionsByJobId, stageOptionsFromJobPipeline],
  );

  const loadInlineStageOptionsForCandidate = useCallback(
    async (candidate: JobDrawerTableCandidate) => {
      const jobId = candidate.pipelineJobId || job?.id;
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
          : Array.isArray((payload as { data?: unknown })?.data)
            ? (payload as { data: unknown[] }).data
            : [];

        const mappedStages = stages
          .map((stage: { id?: string; name?: string }) => ({
            id: String(stage.id || ''),
            name: String(stage.name || '').trim(),
          }))
          .filter((stage) => stage.id && stage.name && isValidObjectId(stage.id));

        if (mappedStages.length) {
          setInlineStageOptionsByJobId((prev) => ({ ...prev, [jobId]: mappedStages }));
        }
      } catch (stageError: unknown) {
        const message =
          stageError instanceof Error ? stageError.message : 'Failed to load stages';
        console.error('Failed to load pipeline stages for job candidate row:', stageError);
        toast.error(message);
      } finally {
        setInlineStageOptionsLoadingJobId((prev) => (prev === jobId ? null : prev));
      }
    },
    [inlineStageOptionsByJobId, job?.id],
  );

  const recruiterFallbackForJob = useMemo(
    () => (job as { assignedTo?: { name?: string }; recruiter?: string })?.assignedTo?.name || job?.recruiter || 'Unassigned',
    [job],
  );

  const refreshAppliedJobCandidates = useCallback(
    async (opts?: { runPipeline?: boolean; refresh?: boolean }) => {
      if (!job?.id) {
        setDisplayJobCandidates([]);
        return [] as JobCandidateItem[];
      }
      const loadingPipeline = Boolean(opts?.runPipeline);
      if (loadingPipeline) {
        setAppliedPipelineRunning(true);
      } else {
        setAppliedCandidatesLoading(true);
      }
      try {
        const merged = await loadJobAppliedCandidates(job.id, {
          runPipeline: opts?.runPipeline,
          refresh: opts?.refresh,
          pipelineSeed: jobCandidates,
          fallbackRecruiter: recruiterFallbackForJob,
        });
        setDisplayJobCandidates(merged);
        setShowMatchScores(merged.some((row) => parseJobCandidateScore(row.score) > 0));
        onJobCandidatesChange?.(merged);
        return merged;
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Unable to load applied candidates for this job';
        void requestError(message);
        return [] as JobCandidateItem[];
      } finally {
        if (loadingPipeline) {
          setAppliedPipelineRunning(false);
        } else {
          setAppliedCandidatesLoading(false);
        }
      }
    },
    [job?.id, job?.applications, jobCandidates, onJobCandidatesChange, recruiterFallbackForJob],
  );

  const openScheduleInterviewCandidatePicker = useCallback(async () => {
    const jobId = String(job?.id || '').trim();
    if (!jobId) {
      toast.error('No job selected.');
      return;
    }
    if (!onScheduleInterview) {
      toast.error('Schedule Interview is not available');
      return;
    }

    let list = Array.isArray(displayJobCandidates) ? displayJobCandidates.filter((row) => row?.id) : [];
    if (!list.length) {
      const merged = await refreshAppliedJobCandidates({ runPipeline: false, refresh: true });
      list = Array.isArray(merged) ? merged.filter((row) => row?.id) : [];
    }
    if (!list.length) {
      setActiveTab('candidates');
      void requestError('Add or assign a candidate to this job before scheduling an interview.');
      return;
    }

    setSchedulePickerSearch('');
    setSchedulePickerSelectedIds(list.length === 1 ? [list[0]!.id] : []);
    setScheduleCandidatePickerOpen(true);
  }, [displayJobCandidates, job?.id, onScheduleInterview, refreshAppliedJobCandidates]);

  const confirmScheduleInterviewCandidatePicker = useCallback(() => {
    const jobId = String(job?.id || '').trim();
    if (!jobId || !onScheduleInterview) return;
    const ids = schedulePickerSelectedIds.filter(Boolean);
    if (!ids.length) {
      toast.error('Select at least one candidate to schedule an interview.');
      return;
    }
    setScheduleCandidatePickerOpen(false);
    onScheduleInterview(ids[0]!, jobId, undefined, ids.length > 1 ? ids : undefined);
  }, [job?.id, onScheduleInterview, schedulePickerSelectedIds]);

  const handleJobCvFileSelected = useCallback(
    async (fileList: FileList | File[] | null | undefined) => {
      if (!job?.id) return;
      const rawFiles = Array.from(fileList || []);
      if (!rawFiles.length) return;

      const files = filterBulkCvFiles(rawFiles);
      if (!files.length) {
        const message = `Select CV files (${BULK_CV_FORMAT_LABEL}).`;
        toast.error(message);
        void requestError(message);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      const oversized = files.filter((file) => file.size > MAX_JOB_CV_FILE_BYTES);
      const validFiles = files.filter((file) => file.size <= MAX_JOB_CV_FILE_BYTES);
      if (oversized.length) {
        toast.error(
          oversized.length === 1
            ? `${oversized[0].name} is larger than 25MB and was skipped.`
            : `${oversized.length} files larger than 25MB were skipped.`,
        );
      }
      if (!validFiles.length) {
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      let recruiterId = '';
      try {
        const raw = localStorage.getItem('currentUser');
        if (raw) {
          const user = JSON.parse(raw) as { id?: string; _id?: string };
          recruiterId = String(user.id || user._id || '').trim();
        }
      } catch {
        recruiterId = '';
      }

      setUploadingJobCv(true);
      setJobCvUploadProgress({ done: 0, total: validFiles.length });

      let createdCount = 0;
      let linkedCount = 0;
      let failedCount = 0;
      const failedNames: string[] = [];

      const processOne = async (file: File) => {
        const parsedRes = await apiParseCandidateResume(file);
        const parsed = parsedRes.data || {};

        const attachResume = async (candidateId: string) => {
          const resumeAlreadyRemote = /^https?:\/\//i.test(String(parsed.resumeUrl || '').trim());
          if (!candidateId || resumeAlreadyRemote) return;
          try {
            await apiUploadCandidateResumeFile(candidateId, file);
          } catch (uploadError) {
            console.error('Resume upload failed after candidate creation:', uploadError);
          }
        };

        const addExistingToJob = async (candidateId: string) => {
          const pipelinePayload = {
            candidateId,
            jobId: job.id,
            stage: 'Applied',
            recruiterId: recruiterId || undefined,
            priority: 'Medium' as const,
          };
          if (onAddToPipeline) {
            await onAddToPipeline(pipelinePayload);
          } else {
            await apiAddCandidateToPipeline(candidateId, {
              jobId: job.id,
              stage: 'Applied',
              recruiterId: recruiterId || undefined,
              priority: 'Medium',
            });
          }
          await attachResume(candidateId);
        };

        const payload = payloadFromParsedJobCv(parsed, file, job.id, recruiterId || undefined);
        try {
          const createdRes = await apiCreateCandidateFromDrawer(payload);
          const created = createdRes.data || {};
          const candidateId = String(created.id || (created as { _id?: string })._id || '').trim();
          await attachResume(candidateId);
          createdCount += 1;
        } catch (createError) {
          if (createError instanceof ApiRequestError && createError.status === 409) {
            const dupData = (createError.data || {}) as {
              existingCandidate?: { _id?: string; id?: string; name?: string };
            };
            const existing = dupData.existingCandidate;
            const existingId = String(existing?._id || existing?.id || '').trim();
            if (existingId) {
              await addExistingToJob(existingId);
              linkedCount += 1;
              return;
            }
          }
          throw createError;
        }
      };

      try {
        for (let index = 0; index < validFiles.length; index += 1) {
          const file = validFiles[index];
          try {
            await processOne(file);
          } catch (error) {
            failedCount += 1;
            failedNames.push(file.name);
            console.error(`Job CV upload failed for ${file.name}:`, error);
          } finally {
            setJobCvUploadProgress({ done: index + 1, total: validFiles.length });
          }
        }

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('jobportal:candidates-changed'));
        }
        await refreshAppliedJobCandidates({ runPipeline: false, refresh: true });

        const successTotal = createdCount + linkedCount;
        if (successTotal > 0 && failedCount === 0) {
          const message =
            validFiles.length === 1
              ? createdCount
                ? 'Candidate created successfully'
                : 'Existing candidate linked to this job'
              : `${createdCount} candidate${createdCount === 1 ? '' : 's'} created${
                  linkedCount ? `, ${linkedCount} existing linked` : ''
                }`;
          toast.success(message);
          void requestCornerAlert(message, { tone: 'success', priority: 'high' });
        } else if (successTotal > 0 && failedCount > 0) {
          const message = `${successTotal} succeeded, ${failedCount} failed.`;
          toast.success(message);
          void requestCornerAlert(message, { tone: 'success', priority: 'high' });
          toast.error(
            failedNames.length <= 3
              ? `Failed: ${failedNames.join(', ')}`
              : `${failedCount} CVs could not be processed.`,
          );
        } else {
          const message =
            failedNames.length === 1
              ? `Could not create a candidate from ${failedNames[0]}.`
              : 'Could not create candidates from the selected CVs.';
          toast.error(message);
          void requestError(message);
        }
      } finally {
        setUploadingJobCv(false);
        setJobCvUploadProgress(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [job?.id, onAddToPipeline, refreshAppliedJobCandidates],
  );

  useEffect(() => {
    if (!isOpen || !job?.id) return;
    const onCandidatesChanged = () => {
      void refreshAppliedJobCandidates();
    };
    window.addEventListener('jobportal:candidates-changed', onCandidatesChanged);
    return () => window.removeEventListener('jobportal:candidates-changed', onCandidatesChanged);
  }, [isOpen, job?.id, refreshAppliedJobCandidates]);

  const handleInlineCandidateStageChange = useCallback(
    async (candidate: JobDrawerTableCandidate, stageId: string) => {
      const jobId = candidate.pipelineJobId || job?.id;
      if (!jobId) {
        toast.error('No job found for this candidate');
        return;
      }

      let resolvedStageId = String(stageId || '').trim();
      let nextStageName =
        inlineStageOptionsMerged[jobId]?.find((stage) => stage.id === resolvedStageId)?.name ||
        candidate.stage;

      // Resolve fake / local ids (`default-*-stage`, `s-*`) to real DB pipeline stage ids.
      if (!isValidObjectId(resolvedStageId)) {
        try {
          const response = await apiGetPipelineStages(jobId);
          const payload = response.data;
          const stages = Array.isArray(payload)
            ? payload
            : Array.isArray((payload as { data?: unknown })?.data)
              ? (payload as { data: unknown[] }).data
              : [];
          const mappedStages = stages
            .map((stage: { id?: string; name?: string }) => ({
              id: String(stage.id || ''),
              name: String(stage.name || '').trim(),
            }))
            .filter((stage) => stage.id && stage.name && isValidObjectId(stage.id));
          if (mappedStages.length) {
            setInlineStageOptionsByJobId((prev) => ({ ...prev, [jobId]: mappedStages }));
          }
          const wanted = normalizeStageLabel(nextStageName);
          const match =
            mappedStages.find((stage) => normalizeStageLabel(stage.name) === wanted) ||
            mappedStages.find((stage) => canonicalStageLabel(stage.name) === canonicalStageLabel(nextStageName));
          if (!match) {
            toast.error('Pipeline stage not found. Save the job pipeline, then try again.');
            return;
          }
          resolvedStageId = match.id;
          nextStageName = match.name;
        } catch (stageError: unknown) {
          const message =
            stageError instanceof Error ? stageError.message : 'Failed to load pipeline stages';
          toast.error(message);
          return;
        }
      }

      // Interviewing: open Schedule Interview popup only — stage updates after schedule succeeds.
      if (isInterviewPipelineStage(nextStageName)) {
        if (onScheduleInterview) {
          onScheduleInterview(candidate.id, jobId, {
            stageId: resolvedStageId,
            stageName: nextStageName,
          });
        } else {
          toast.error('Schedule Interview is not available');
        }
        return;
      }

      // Offer: open placement flow only — stage updates after placement is created.
      if (isOfferPipelineStage(nextStageName)) {
        if (onCreatePlacement) {
          onCreatePlacement(candidate.id, jobId, {
            stageId: resolvedStageId,
            stageName: nextStageName,
          });
        } else {
          toast.error('Create Placement is not available');
        }
        return;
      }

      try {
        setInlineStageUpdatingCandidateId(candidate.id);
        await apiMoveCandidateStage(jobId, {
          candidateId: candidate.id,
          stageId: resolvedStageId,
        });

        setDisplayJobCandidates((prev) =>
          prev.map((item) =>
            item.id === candidate.id
              ? {
                  ...item,
                  currentStage: nextStageName,
                  isJobAppliedCandidate:
                    resolveJobCandidateDisplayStage(nextStageName) === 'Applied',
                }
              : item,
          ),
        );

        await refreshAppliedJobCandidates({ runPipeline: false, refresh: true });
        toast.success(`Stage updated to ${nextStageName}`);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to update candidate stage';
        console.error('Failed to update candidate stage from job drawer:', error);
        toast.error(message);
      } finally {
        setInlineStageUpdatingCandidateId((prev) => (prev === candidate.id ? null : prev));
      }
    },
    [
      inlineStageOptionsMerged,
      job?.id,
      onCreatePlacement,
      onScheduleInterview,
      refreshAppliedJobCandidates,
    ],
  );

  const handleDeleteJobCandidate = useCallback(
    async (candidate: JobDrawerTableCandidate) => {
      if (!isValidObjectId(candidate.id)) {
        toast.error('This candidate cannot be deleted (invalid id).');
        return;
      }
      if (
        !(await requestConfirm(
          `Move ${candidate.name || 'this candidate'} to the Recycle Bin? You can restore them later from Recycle Bin.`,
        ))
      ) {
        return;
      }
      try {
        setDeletingCandidateId(candidate.id);
        await apiDeleteCandidate(candidate.id);
        invalidateEmployerCandidatesCache();
        setDisplayJobCandidates((prev) => {
          const next = prev.filter((row) => row.id !== candidate.id);
          onJobCandidatesChange?.(next);
          return next;
        });
        setSelectedCandidateIds((prev) => prev.filter((id) => id !== candidate.id));
        toast.success('Candidate moved to Recycle Bin');
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent(RECYCLE_BIN_SYNC_EVENT));
          window.dispatchEvent(new CustomEvent('jobportal:candidates-changed'));
        }
        await refreshAppliedJobCandidates({ runPipeline: false, refresh: true });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to delete candidate';
        toast.error(message);
      } finally {
        setDeletingCandidateId((prev) => (prev === candidate.id ? null : prev));
      }
    },
    [onJobCandidatesChange, refreshAppliedJobCandidates],
  );

  const handleRemoveJobCandidate = useCallback(
    async (candidate: JobDrawerTableCandidate) => {
      const jobId = String(job?.id || '').trim();
      if (!jobId) {
        toast.error('No job selected.');
        return;
      }
      if (!isValidObjectId(candidate.id)) {
        toast.error('This candidate cannot be removed (invalid id).');
        return;
      }
      if (
        !(await requestConfirm(
          `Remove ${candidate.name || 'this candidate'} from this job? The candidate record will stay in Candidates.`,
        ))
      ) {
        return;
      }
      try {
        setRemovingFromJobCandidateId(candidate.id);
        await apiRemoveCandidateFromPipeline(candidate.id, jobId);
        setDisplayJobCandidates((prev) => {
          const next = prev.filter((row) => row.id !== candidate.id);
          onJobCandidatesChange?.(next);
          return next;
        });
        setSelectedCandidateIds((prev) => prev.filter((id) => id !== candidate.id));
        toast.success('Candidate removed from this job');
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('jobportal:candidates-changed'));
        }
        await refreshAppliedJobCandidates({ runPipeline: false, refresh: true });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to remove candidate from job';
        toast.error(message);
      } finally {
        setRemovingFromJobCandidateId((prev) => (prev === candidate.id ? null : prev));
      }
    },
    [job?.id, onJobCandidatesChange, refreshAppliedJobCandidates],
  );

  useEffect(() => {
    if (!isOpen || activeTab !== 'candidates' || !job?.id) {
      if (activeTab !== 'candidates') wasOnCandidatesTabRef.current = false;
        return;
      }
    const switchedToCandidatesTab = !wasOnCandidatesTabRef.current;
    const jobChanged = prevCandidatesTabJobIdRef.current !== job.id;
    wasOnCandidatesTabRef.current = true;
    prevCandidatesTabJobIdRef.current = job.id;
    if (switchedToCandidatesTab || jobChanged) {
      void refreshAppliedJobCandidates();
      void loadInlineStageOptionsForCandidate({
        id: '__prefetch__',
        pipelineJobId: job.id,
      } as JobDrawerTableCandidate);
    }
  }, [
    isOpen,
    activeTab,
    job?.id,
    refreshAppliedJobCandidates,
    loadInlineStageOptionsForCandidate,
  ]);

  const refreshAiMatches = useCallback(
    async (opts?: { runPipeline?: boolean; refresh?: boolean }) => {
      if (!job?.id) {
        setAiMatchCandidates([]);
        return [] as MatchCandidate[];
      }
      setAiMatchesLoading(true);
      setAiMatchesError(null);
      try {
        const runPipeline = Boolean(opts?.runPipeline);
        const response = await apiGetMatches({
          jobId: job.id,
          source: 'ai',
          limit: 100,
          ...(runPipeline ? { runPipeline: '1' } : {}),
          ...(opts?.refresh ? { refresh: '1' } : {}),
        });
        const matchRows = unwrapMatchRows(response);
        const merged = matchRows.map(mapBackendMatch);
        setAiMatchCandidates(merged);
        setAiSavedMatches(
          merged.filter((candidate) => Boolean(candidate.savedAt)).map((candidate) => candidate.id),
        );
        return merged;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unable to load AI matches';
        setAiMatchesError(message);
        setAiMatchCandidates([]);
        return [] as MatchCandidate[];
      } finally {
        setAiMatchesLoading(false);
      }
    },
    [job?.id],
  );

  const handleRunAiMatches = useCallback(async () => {
    if (!job?.id) return;
    setAiPipelineRunning(true);
    setAiMatchesError(null);
    try {
      const list = await refreshAiMatches({ runPipeline: true, refresh: true });
      const sorted = [...list].sort((a, b) => b.score - a.score);
      const top = sorted[0];
      const stats = computeAiTierStats(list);
      const phase1Count = list.filter((c) => c.isPhase1Candidate).length;
      if (top) {
        const summary = AI_SCORE_TIERS.map((t) => `${t.label}: ${stats[t.id]}`).join(' · ');
        const phase1Note = phase1Count ? ` · ${phase1Count} Phase 1` : '';
        void requestInfo(
          `AI complete — ${list.length} scored. Top: ${top.name} (${top.score}%). ${summary}${phase1Note}`,
        );
      } else {
        void requestInfo('AI matching complete — no scored candidates yet for this job.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to run AI matching';
      setAiMatchesError(message);
      void requestError(message);
    } finally {
      setAiPipelineRunning(false);
    }
  }, [job?.id, refreshAiMatches]);

  const updateAiMatchCandidate = useCallback(
    (candidateId: string, updater: (candidate: MatchCandidate) => MatchCandidate) => {
      setAiMatchCandidates((prev) =>
        prev.map((candidate) => (candidate.id === candidateId ? updater(candidate) : candidate)),
      );
    },
    [],
  );

  const ensureAiMatchId = useCallback(
    async (candidate: MatchCandidate): Promise<string | null> => {
      if (candidate.matchId) return candidate.matchId;
      if (!job?.id) return null;
      try {
        const response = await apiCreateMatch({
          candidateId: candidate.id,
          jobId: job.id,
          score: candidate.score,
          status: 'SUGGESTED',
        });
        const newMatchId = response?.data?.id;
        if (newMatchId) {
          updateAiMatchCandidate(candidate.id, (current) => ({
            ...current,
            matchId: newMatchId,
            isAppliedCandidate: false,
          }));
          return newMatchId;
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unable to create match record';
        void requestError(message);
      }
      return null;
    },
    [job?.id, updateAiMatchCandidate],
  );

  const sortedAiMatchCandidates = useMemo(
    () => [...aiMatchCandidates].sort((a, b) => b.score - a.score),
    [aiMatchCandidates],
  );

  const filteredSortedAiMatchCandidates = useMemo(() => {
    const query = jobCandidatesSearch.trim().toLowerCase();
    if (!query) return sortedAiMatchCandidates;
    return sortedAiMatchCandidates.filter((row) =>
      matchesQuickSearch(
        buildQuickSearchHaystack(
          row.name,
          row.email,
          row.currentTitle,
          row.currentCompany,
          row.location,
        ),
        query,
      ),
    );
  }, [sortedAiMatchCandidates, jobCandidatesSearch]);

  const aiTierStats = useMemo(
    () => computeAiTierStats(filteredSortedAiMatchCandidates),
    [filteredSortedAiMatchCandidates],
  );
  useEffect(() => {
    if (!isOpen || !job?.id) {
      prevAiTabJobIdRef.current = null;
      prevOnAiTabRef.current = false;
      return;
    }
    if (activeTab !== 'candidates' || candidateMatchMode !== 'ai') {
      prevOnAiTabRef.current = false;
      return;
    }
    const jobChanged = prevAiTabJobIdRef.current !== job.id;
    const switchedToAi = !prevOnAiTabRef.current;
    prevAiTabJobIdRef.current = job.id;
    prevOnAiTabRef.current = true;
    if (switchedToAi || jobChanged) {
      void refreshAiMatches();
    }
  }, [activeTab, candidateMatchMode, refreshAiMatches, isOpen, job?.id]);

  useEffect(() => {
    if (!isOpen) {
      setAiMatchCandidates([]);
      setAiMatchesError(null);
      setAiMatchSelectedIds([]);
      setAiSavedMatches([]);
      setAiExpandedAnalysis(null);
      prevAiTabJobIdRef.current = null;
      prevOnAiTabRef.current = false;
      setCandidateMatchMode('applied');
    }
  }, [isOpen]);

  useEffect(() => {
    setAiMatchCandidates([]);
    setAiMatchesError(null);
    setAiMatchSelectedIds([]);
    setAiSavedMatches([]);
    setAiExpandedAnalysis(null);
    prevAiTabJobIdRef.current = null;
    prevOnAiTabRef.current = false;
    setCandidateMatchMode('applied');
  }, [job?.id]);

  useEffect(() => {
    if (!isOpen) setSelectedCandidateIds([]);
  }, [isOpen]);

  useEffect(() => {
    setSelectedCandidateIds([]);
  }, [job?.id]);

  const [notesTagFilter, setNotesTagFilter] = useState<JobNoteTag | 'All'>('All');
  const [pinnedNoteIds, setPinnedNoteIds] = useState<Set<string>>(new Set());
  const [filesTypeFilter, setFilesTypeFilter] = useState<JobFileType | 'All'>('All');
  const [jobActivities, setJobActivities] = useState<BackendActivity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [activityFilter, setActivityFilter] = useState<'All' | 'Jobs' | 'Candidates' | 'Interviews' | 'Notes' | 'Files'>('All');
  const [jobInterviews, setJobInterviews] = useState<BackendInterviewListItem[]>([]);
  const [selectedJobInterview, setSelectedJobInterview] = useState<BackendInterviewListItem | null>(null);
  const [jobInterviewDetailOpen, setJobInterviewDetailOpen] = useState(false);
  const [selectedInterviewRound, setSelectedInterviewRound] = useState<number | 'all'>(1);
  const [jobPlacements, setJobPlacements] = useState<Placement[]>([]);
  const [loadingJobInterviews, setLoadingJobInterviews] = useState(false);
  const [loadingJobPlacements, setLoadingJobPlacements] = useState(false);
  const [assignmentMemberIds, setAssignmentMemberIds] = useState<string[]>([]);
  const [assignmentManagerId, setAssignmentManagerId] = useState('');
  const [assignmentContacts, setAssignmentContacts] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [assignmentHiringManagerId, setAssignmentHiringManagerId] = useState('');
  const [assignmentHiringManagerName, setAssignmentHiringManagerName] = useState('');
  const [loadingAssignmentMeta, setLoadingAssignmentMeta] = useState(false);
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [assignmentDirty, setAssignmentDirty] = useState(false);
  const [assignmentRecruiterOpen, setAssignmentRecruiterOpen] = useState(false);
  const closeAssignmentRecruiterMenu = useCallback(() => setAssignmentRecruiterOpen(false), []);
  const {
    triggerRef: assignmentRecruiterTriggerRef,
    menuRef: assignmentRecruiterMenuRef,
    menuPosition: assignmentRecruiterMenuPosition,
  } = useDrawerPortalDropdownPosition(
    assignmentRecruiterOpen,
    true,
    closeAssignmentRecruiterMenu,
  );

  const assignmentTabActive = isOpen && activeTab === 'assignment';
  const assignmentSeedOrgId = useMemo(() => {
    const fromJob = String(job?.orgUnitId || '').trim();
    if (fromJob) return fromJob;
    return getActiveOrgUnitId();
  }, [job?.orgUnitId]);
  const assignable = useAssignableMembers(assignmentTabActive, 'Jobs', {
    initialCompanyId: assignmentSeedOrgId,
  });
  const assignmentCurrentUserId = getStoredCurrentUserId();
  const assignmentRecruiterUsers = assignable.users;
  const loadingAssignmentRecruiters = assignable.loading;

  const assignmentManagerUsers = useMemo(() => {
    const byId = new Map<string, BackendUser>();
    for (const user of assignmentRecruiterUsers) byId.set(user.id, user);
    const me =
      assignmentRecruiterUsers.find((user) => user.id === assignmentCurrentUserId) ||
      currentUserAsBackendUser();
    if (me) byId.set(me.id, me);
    const sorted = Array.from(byId.values()).sort((a, b) =>
      String(a.name || '').localeCompare(String(b.name || '')),
    );
    return withCurrentUserFirst(sorted, assignmentCurrentUserId);
  }, [assignmentCurrentUserId, assignmentRecruiterUsers]);

  const needsAssignmentOrganizationFirst =
    assignable.canSelectCompany && !assignable.companyId && assignable.companiesReady;
  const needsAssignmentManagerFirst = !assignmentManagerId;

  const filteredAssignmentRecruiters = useMemo(() => {
    // Keep existing assignees visible even before a manager is chosen.
    if (!assignmentManagerId) {
      if (!assignmentMemberIds.length) return [];
      const byId = new Map(assignmentRecruiterUsers.map((user) => [user.id, user]));
      return assignmentMemberIds
        .map((id) => byId.get(id))
        .filter(Boolean) as BackendUser[];
    }
    const managerId = String(assignmentManagerId).trim();
    const byId = new Map(assignmentRecruiterUsers.map((user) => [user.id, user]));
    const managerUser =
      assignmentManagerUsers.find((user) => user.id === managerId) ||
      assignmentRecruiterUsers.find((user) => user.id === managerId);
    if (managerUser && !byId.has(managerUser.id)) byId.set(managerUser.id, managerUser);
    const me =
      assignmentRecruiterUsers.find((user) => user.id === assignmentCurrentUserId) ||
      assignmentManagerUsers.find((user) => user.id === assignmentCurrentUserId) ||
      currentUserAsBackendUser();
    if (me && !byId.has(me.id)) byId.set(me.id, me);
    return withCurrentUserFirst(Array.from(byId.values()), assignmentCurrentUserId);
  }, [
    assignmentCurrentUserId,
    assignmentManagerId,
    assignmentManagerUsers,
    assignmentMemberIds,
    assignmentRecruiterUsers,
  ]);

  const selectedAssignmentAssignees = useMemo(() => {
    const leadLabel = String(job?.recruiter || job?.owner || '').trim();
    return assignmentMemberIds.map((id, index) => {
      const fromFiltered = filteredAssignmentRecruiters.find((u) => u.id === id);
      if (fromFiltered) return fromFiltered;
      const fromAll = assignmentRecruiterUsers.find((u) => u.id === id);
      if (fromAll) return fromAll;
      const fallbackName =
        index === 0 && leadLabel && !/^(-|—|unassigned)$/i.test(leadLabel)
          ? leadLabel
          : 'Assigned member';
      return {
        id,
        name: fallbackName,
        email: '',
        role: '',
        isActive: true,
        createdAt: '',
      } as BackendUser;
    });
  }, [
    assignmentMemberIds,
    assignmentRecruiterUsers,
    filteredAssignmentRecruiters,
    job?.owner,
    job?.recruiter,
  ]);

  // Once assignable members load, fill missing manager / org from the primary assignee.
  useEffect(() => {
    if (!assignmentTabActive || loadingAssignmentRecruiters) return;
    if (!assignmentMemberIds.length) return;

    const primaryId = assignmentMemberIds[0];
    const primaryMember = assignable.members.find((row) => row.id === primaryId);
    if (!primaryMember) return;

    if (!assignmentManagerId) {
      const inferred =
        String(primaryMember.manager?.id || primaryMember.managerId || '').trim();
      if (inferred) setAssignmentManagerId(inferred);
    }

    if (!assignable.companyId) {
      const memberOrg = String(
        (primaryMember as { assignCompanyId?: string | null }).assignCompanyId ||
          primaryMember.orgUnitId ||
          primaryMember.orgUnit?.id ||
          '',
      ).trim();
      if (memberOrg) assignable.setCompanyId(memberOrg);
    }
  }, [
    assignmentTabActive,
    assignmentManagerId,
    assignmentMemberIds,
    assignable.companyId,
    assignable.members,
    assignable.setCompanyId,
    loadingAssignmentRecruiters,
  ]);

  const applyAssignmentMemberIds = useCallback(
    (ids: string[]) => {
      const unique = [...new Set(ids.map((id) => String(id || '').trim()).filter(Boolean))];
      const primary = unique[0] || '';
      const primaryMember = assignable.members.find((row) => row.id === primary);
      const inferredManagerId =
        primaryMember?.manager?.id || primaryMember?.managerId || '';
      setAssignmentMemberIds(unique);
      if (inferredManagerId && !assignmentManagerId) {
        setAssignmentManagerId(inferredManagerId);
      }
      setAssignmentDirty(true);
    },
    [assignable.members, assignmentManagerId],
  );

  const selectAssignmentManager = (userId: string) => {
    setAssignmentManagerId(userId);
    if (assignmentMemberIds.length) {
      const allowedIds = new Set(assignmentRecruiterUsers.map((user) => user.id));
      if (assignmentCurrentUserId) allowedIds.add(assignmentCurrentUserId);
      if (userId) allowedIds.add(userId);
      const kept = assignmentMemberIds.filter((id) => allowedIds.has(id));
      if (kept.length !== assignmentMemberIds.length) {
        setAssignmentMemberIds(kept);
      }
    }
    setAssignmentDirty(true);
  };

  const [showStatusChange, setShowStatusChange] = useState(false);
  const [jobStatusCatalog, setJobStatusCatalog] = useState<string[]>([...DEFAULT_JOB_STATUS_OPTIONS]);
  const [localJobStatus, setLocalJobStatus] = useState<string>('Active');
  const [showAddJobStatusInput, setShowAddJobStatusInput] = useState(false);
  const [newJobStatusValue, setNewJobStatusValue] = useState('');
  const [savingJobStatus, setSavingJobStatus] = useState(false);
  const [deletingJobStatus, setDeletingJobStatus] = useState(false);
  const [updatingJobStatus, setUpdatingJobStatus] = useState(false);
  const [applyUrl, setApplyUrl] = useState<string | null>(null);
  const [applyLinkLoading, setApplyLinkLoading] = useState(false);
  const [applyLinkCopied, setApplyLinkCopied] = useState(false);
  const [applyShareOpen, setApplyShareOpen] = useState(false);
  const closeApplyShare = useCallback(() => setApplyShareOpen(false), []);
  const {
    triggerRef: applyShareTriggerRef,
    menuRef: applyShareMenuRef,
    menuPosition: applyShareMenuPosition,
  } = useDrawerPortalDropdownPosition(applyShareOpen, false, closeApplyShare);

  useEffect(() => {
    setShowStatusChange(false);
    setShowAddJobStatusInput(false);
    setNewJobStatusValue('');
    setLocalJobStatus(job?.status || 'Active');
  }, [job?.id, job?.status]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const load = async () => {
      try {
        const response = await apiGetJobStatusCatalog();
        if (cancelled) return;
        setJobStatusCatalog(
          mergeJobStatusOptions(response?.data?.statuses, job?.status || localJobStatus),
        );
      } catch {
        if (cancelled) return;
        setJobStatusCatalog(mergeJobStatusOptions(undefined, job?.status || localJobStatus));
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [isOpen, job?.id, job?.status, localJobStatus]);

  const drawerStatusOptions = useMemo(
    () =>
      filterJobStatusOptionsForCurrent(
        mergeJobStatusOptions(jobStatusCatalog, localJobStatus),
        localJobStatus,
      ),
    [jobStatusCatalog, localJobStatus],
  );

  const applyJobStatusChange = async (status: string) => {
    if (!job?.id) return;
    if (isDraftJobStatus(status) && !canRevertJobToDraft(localJobStatus)) {
      toast.error('Once a job is Active, it cannot be set back to Draft.');
      return;
    }
    const previous = localJobStatus;
    setLocalJobStatus(status);
    setUpdatingJobStatus(true);
    try {
      await apiUpdateJob(job.id, {
        status: mapJobStatusLabelToBackend(status),
        statusLabel: status,
      } as any);
      onStatusUpdated?.(job.id, status);
      setShowStatusChange(false);
      setShowAddJobStatusInput(false);
      toast.success(`Status updated to "${status}".`);
    } catch (error: any) {
      setLocalJobStatus(previous);
      void requestError(error?.message || 'Failed to update job status');
    } finally {
      setUpdatingJobStatus(false);
    }
  };

  const addJobStatusOption = async () => {
    const status = String(newJobStatusValue || '').trim();
    if (!status) {
      toast.error('Enter a status name first.');
      return;
    }
    setSavingJobStatus(true);
    try {
      const response = await apiAppendJobStatus(status);
      const next = mergeJobStatusOptions(response?.data?.statuses, status);
      setJobStatusCatalog(next);
      setNewJobStatusValue('');
      setShowAddJobStatusInput(false);
      await applyJobStatusChange(status);
    } catch (error: any) {
      void requestError(error?.message || 'Failed to add status');
    } finally {
      setSavingJobStatus(false);
    }
  };

  const deleteJobStatusOption = async (status: string) => {
    setDeletingJobStatus(true);
    try {
      const response = await apiRemoveJobStatus(status);
      const next = mergeJobStatusOptions(response?.data?.statuses, localJobStatus);
      setJobStatusCatalog(next);
      if (localJobStatus === status) {
        const fallback = next[0] || 'Active';
        await applyJobStatusChange(fallback);
      }
      toast.success(`Status "${status}" removed.`);
    } catch (error: any) {
      void requestError(error?.message || 'Failed to remove status');
    } finally {
      setDeletingJobStatus(false);
    }
  };

  useEffect(() => {
        setApplyShareOpen(false);
  }, [job?.id]);

  const shareApplyLink = useCallback(async () => {
    if (!applyUrl) return;
    const title = job?.title ? `Apply: ${job.title}` : 'Job apply link';
    const text = job?.title
      ? `Check out this job opportunity: ${job.title}`
      : 'Check out this job opportunity';
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({ title, text, url: applyUrl });
        setApplyShareOpen(false);
        return;
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') return;
    }
    setApplyShareOpen((open) => !open);
  }, [applyUrl, job?.title]);

  const openApplyShareTarget = useCallback(
    (platform: 'whatsapp' | 'linkedin' | 'x' | 'facebook' | 'email' | 'telegram') => {
      if (!applyUrl) return;
      const title = job?.title ? String(job.title) : 'this role';
      const text = `Check out this job opportunity: ${title}`;
      const encodedUrl = encodeURIComponent(applyUrl);
      const encodedText = encodeURIComponent(text);
      const encodedSubject = encodeURIComponent(job?.title ? `Job: ${job.title}` : 'Job opportunity');
      const encodedBody = encodeURIComponent(`${text}\n\n${applyUrl}`);
      const hrefByPlatform: Record<string, string> = {
        whatsapp: `https://wa.me/?text=${encodeURIComponent(`${text}\n${applyUrl}`)}`,
        linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
        x: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`,
        facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
        email: `mailto:?subject=${encodedSubject}&body=${encodedBody}`,
        telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
      };
      const href = hrefByPlatform[platform];
      if (!href) return;
      if (platform === 'email') {
        window.location.href = href;
      } else {
        window.open(href, '_blank', 'noopener,noreferrer,width=640,height=640');
      }
      setApplyShareOpen(false);
    },
    [applyUrl, job?.title],
  );

  const fetchApplyLink = useCallback(async (jobId: string, fallbackToken?: string | null) => {
    const res = await apiGetJobApplyLink(jobId);
    return resolveJobApplyUrlFromResponse(res, fallbackToken);
  }, []);

  useEffect(() => {
    if (!job?.id) {
      setApplyUrl(null);
      setApplyLinkLoading(false);
      return;
    }

    const jobId = job.id;
    const seeded =
      String(job.applyUrl || '').trim() ||
      resolveJobApplyUrlFromResponse(null, job.applyLinkToken) ||
      null;
    setApplyUrl(seeded);

    let cancelled = false;
    setApplyLinkLoading(true);
    void fetchApplyLink(jobId, job.applyLinkToken)
      .then((url) => {
        if (cancelled) return;
        if (url) setApplyUrl(url);
        else if (!seeded) setApplyUrl(null);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Failed to load job apply link:', err);
        if (!seeded) setApplyUrl(null);
      })
      .finally(() => {
        if (!cancelled) setApplyLinkLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [job?.id, job?.applyUrl, job?.applyLinkToken, fetchApplyLink]);

  const openApplyShareMenu = useCallback(async () => {
    if (!job?.id) return;
    if (applyUrl) {
      setApplyShareOpen((open) => !open);
      return;
    }
    if (applyLinkLoading) return;
    setApplyLinkLoading(true);
    try {
      const url = await fetchApplyLink(job.id, job.applyLinkToken);
      if (url) {
        setApplyUrl(url);
        setApplyShareOpen(true);
        return;
      }
      void requestError('Apply link not available yet. Try publishing the job or refresh and retry.');
    } catch (err: any) {
      console.error('Failed to load job apply link:', err);
      void requestError(err?.message || 'Could not load apply link. Please try again.');
    } finally {
      setApplyLinkLoading(false);
    }
  }, [applyLinkLoading, applyUrl, fetchApplyLink, job?.applyLinkToken, job?.id]);

  const {
    files: jobFiles,
    loading: filesLoading,
    uploading: filesUploading,
    uploadSuccess: filesUploadSuccess,
    uploadPercent: filesUploadPercent,
    error: filesError,
    uploadFile,
    deleteFile,
  } = useFiles('job', job?.id);
  // Fetch job activities when activity tab is active
  useEffect(() => {
    if (!job?.id || activeTab !== 'activity') {
      setLoadingActivities(false);
      return;
    }

    const load = startAsyncLoad(setLoadingActivities);
    const fetchActivities = async () => {
      try {
        const response = await apiGetJobActivities(job.id);
        if (!load.isActive()) return;
        setJobActivities(response.data || []);
      } catch (error: any) {
        console.warn('Job activities endpoint may not be available:', error.message);
        if (load.isActive()) setJobActivities([]);
      } finally {
        load.finish();
      }
    };

    void fetchActivities();
    return () => load.abort();
  }, [job?.id, activeTab]);

  useEffect(() => {
    if (!isOpen || !job?.id) {
      setClientRemarkCandidates([]);
      setClientRemarksCount(0);
      setClientRemarksError('');
      setLoadingClientRemarks(false);
      return;
    }

    const load = startAsyncLoad(setLoadingClientRemarks);
    setClientRemarksError('');
    void (async () => {
      try {
        const response = await apiGetJobClientRemarks(job.id);
        if (!load.isActive()) return;
        const data = extractApiData<JobClientRemarksPayload>(response);
        setClientRemarkCandidates(Array.isArray(data?.candidates) ? data.candidates : []);
        setClientRemarksCount(Number(data?.remarkCount || 0));
        setClientRemarksClientName(String(data?.clientName || job.client || 'Client'));
      } catch (error: unknown) {
        if (!load.isActive()) return;
        setClientRemarksError(error instanceof Error ? error.message : 'Unable to load client remarks');
        setClientRemarkCandidates([]);
        setClientRemarksCount(0);
      } finally {
        load.finish();
      }
    })();
    return () => load.abort();
  }, [isOpen, job?.id, job?.client, activeTab === 'client']);

  useEffect(() => {
    setJobInterviews([]);
    setJobPlacements([]);
    setAssignmentMemberIds([]);
    setAssignmentManagerId('');
    setAssignmentHiringManagerId('');
    setAssignmentHiringManagerName('');
    setAssignmentDirty(false);
    setAssignmentRecruiterOpen(false);
    setSelectedJobInterview(null);
    setJobInterviewDetailOpen(false);
    setSelectedInterviewRound(1);
    setScheduleCandidatePickerOpen(false);
    setSchedulePickerSelectedIds([]);
    setSchedulePickerSearch('');
  }, [job?.id]);

  useEffect(() => {
    if (!isOpen || !job?.id || activeTab !== 'assignment') return;

    const supportingIds = Array.isArray(job.supportingRecruiters)
      ? job.supportingRecruiters.map((id) => String(id || '').trim()).filter(Boolean)
      : [];
    const leadId = String(job.assignedToId || '').trim();
    const memberIds = leadId
      ? [leadId, ...supportingIds.filter((id) => id !== leadId)]
      : supportingIds;
    const hiringId = String(job.hiringManagerId || '').trim();
    const hiringLabel = String(job.hiringManager || '').trim();
    const managerId = String(job.managerId || '').trim();

    setAssignmentMemberIds(memberIds);
    setAssignmentManagerId(managerId);
    setAssignmentHiringManagerId(hiringId);
    setAssignmentHiringManagerName(
      hiringLabel && !/^(-|—)$/i.test(hiringLabel) ? hiringLabel : '',
    );
    setAssignmentDirty(false);

    const orgId =
      String(job.orgUnitId || '').trim() ||
      assignmentSeedOrgId ||
      '';
    if (orgId && orgId !== assignable.companyId) {
      assignable.setCompanyId(orgId);
    }

    const load = startAsyncLoad(setLoadingAssignmentMeta);
    void (async () => {
      try {
        const contactsRes = await apiGetContacts(
          job.clientId ? { companyId: job.clientId } : undefined,
        ).catch(() => null);
        if (!load.isActive()) return;

        const contacts = Array.isArray(contactsRes?.data) ? contactsRes.data : [];
        const contactOptions = contacts
          .map((row: { id?: string; firstName?: string; lastName?: string; name?: string; email?: string }) => {
            const id = String(row?.id || '').trim();
            if (!id) return null;
            const name =
              formatAssigneeDisplayName(row) ||
              `${row?.firstName || ''} ${row?.lastName || ''}`.trim() ||
              String(row?.name || '').trim() ||
              String(row?.email || '').trim() ||
              id;
            return { id, name };
          })
          .filter((row): row is { id: string; name: string } => Boolean(row));
        setAssignmentContacts(contactOptions);

        if (hiringId && !hiringLabel) {
          const fromContact = contactOptions.find((c) => c.id === hiringId)?.name;
          if (fromContact) setAssignmentHiringManagerName(fromContact);
        } else if (!hiringId && hiringLabel) {
          const matched = contactOptions.find(
            (c) => c.name.toLowerCase() === hiringLabel.toLowerCase(),
          );
          if (matched) {
            setAssignmentHiringManagerId(matched.id);
            setAssignmentHiringManagerName(matched.name);
          }
        }
      } catch {
        if (load.isActive()) setAssignmentContacts([]);
      } finally {
        load.finish();
      }
    })();

    return () => {
      load.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeTab,
    isOpen,
    job?.id,
    job?.clientId,
    job?.orgUnitId,
    job?.assignedToId,
    job?.managerId,
    job?.hiringManager,
    job?.hiringManagerId,
    assignmentSeedOrgId,
    Array.isArray(job?.supportingRecruiters) ? job.supportingRecruiters.join(',') : '',
  ]);

  const saveAssignment = async () => {
    if (!job?.id) return;
    const ids = assignmentMemberIds.map((id) => String(id || '').trim()).filter(Boolean);
    const primaryId = ids[0] || null;
    const supporting = ids.slice(1);
    const hiringId = String(assignmentHiringManagerId || '').trim();
    const hiringName = String(assignmentHiringManagerName || '').trim();
    const managerId = String(assignmentManagerId || '').trim();

    setSavingAssignment(true);
    try {
      await apiUpdateJob(job.id, {
        assignedToId: primaryId,
        supportingRecruiters: supporting,
        managerId: managerId || null,
        orgUnitId: assignable.companyId || job.orgUnitId || undefined,
        hiringManagerId: hiringId || undefined,
        hiringManager: hiringName || undefined,
      } as any);
      setAssignmentDirty(false);
      toast.success('Assignment updated.');
      await Promise.resolve(onAssignmentUpdated?.(job.id));
    } catch (error: any) {
      void requestError(error?.message || 'Failed to update assignment');
    } finally {
      setSavingAssignment(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !job?.id || activeTab !== 'interviews') {
      setLoadingJobInterviews(false);
      return;
    }

    const load = startAsyncLoad(setLoadingJobInterviews);
    void apiGetInterviews({ jobId: job.id, page: 1, limit: 100 })
      .then((response) => {
        if (!load.isActive()) return;
        setJobInterviews(unwrapApiList<BackendInterviewListItem>(response.data));
      })
      .catch((error) => {
        console.warn('Failed to load job interviews:', error);
        if (load.isActive()) setJobInterviews([]);
      })
      .finally(() => {
        load.finish();
      });

    // Prefetch assigned candidates so Schedule Interview picker is ready.
    if (!displayJobCandidates.length) {
      void refreshAppliedJobCandidates({ runPipeline: false, refresh: false });
    }

    return () => {
      load.abort();
    };
  }, [activeTab, isOpen, job?.id]);

  const refreshJobInterviews = useCallback(() => {
    if (!job?.id) return;
    void apiGetInterviews({ jobId: job.id, page: 1, limit: 100 })
      .then((response) => {
        setJobInterviews(unwrapApiList<BackendInterviewListItem>(response.data));
      })
      .catch(() => {
        /* keep current rows */
      });
  }, [job?.id]);

  const jobInterviewRoundById = useMemo(() => {
    const jobId = String(job?.id || '').trim();
    if (!jobId) return {} as Record<string, number>;
    const rows = jobInterviews
      .map((item) => {
        const candidateId = String(item.candidate?.id || '').trim();
        const interviewJobId = String(item.job?.id || jobId).trim();
        if (!candidateId || !interviewJobId) return null;
        return {
          id: item.id,
          candidate: { id: candidateId },
          job: { id: interviewJobId },
          scheduledAt: item.scheduledAt,
          status: item.status,
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));
    return buildInterviewRoundNumberById(rows);
  }, [job?.id, jobInterviews]);

  const visibleJobInterviews = useMemo(
    () =>
      jobInterviews.filter((item) => formatInterviewListStatus(item.status) !== 'Cancelled'),
    [jobInterviews],
  );

  const jobInterviewRoundNumbers = useMemo(() => {
    const rounds = new Set<number>();
    for (const item of visibleJobInterviews) {
      rounds.add(jobInterviewRoundById[item.id] || 1);
    }
    return [...rounds].sort((a, b) => a - b);
  }, [jobInterviewRoundById, visibleJobInterviews]);

  const jobInterviewCountsByRound = useMemo(() => {
    const byRound = new Map<number, Set<string>>();
    for (const item of visibleJobInterviews) {
      const round = jobInterviewRoundById[item.id] || 1;
      const set = byRound.get(round) || new Set<string>();
      const candidateId = String(item.candidate?.id || '').trim();
      if (candidateId) set.add(candidateId);
      byRound.set(round, set);
    }
    const out: Record<number, number> = {};
    for (const [round, candidates] of byRound) {
      out[round] = candidates.size;
    }
    return out;
  }, [jobInterviewRoundById, visibleJobInterviews]);

  const jobInterviewAllCandidateCount = useMemo(() => {
    const ids = new Set<string>();
    for (const item of visibleJobInterviews) {
      const candidateId = String(item.candidate?.id || '').trim();
      if (candidateId) ids.add(candidateId);
    }
    return ids.size;
  }, [visibleJobInterviews]);

  const filteredJobInterviews = useMemo(() => {
    if (selectedInterviewRound === 'all') return visibleJobInterviews;
    return visibleJobInterviews.filter(
      (item) => (jobInterviewRoundById[item.id] || 1) === selectedInterviewRound,
    );
  }, [jobInterviewRoundById, selectedInterviewRound, visibleJobInterviews]);

  useEffect(() => {
    if (selectedInterviewRound === 'all') return;
    if (jobInterviewRoundNumbers.length === 0) return;
    if (!jobInterviewRoundNumbers.includes(selectedInterviewRound)) {
      setSelectedInterviewRound(jobInterviewRoundNumbers[0] ?? 1);
    }
  }, [jobInterviewRoundNumbers, selectedInterviewRound]);

  useEffect(() => {
    if (!isOpen || !job?.id || activeTab !== 'placements') {
      setLoadingJobPlacements(false);
      return;
    }

    const load = startAsyncLoad(setLoadingJobPlacements);
    void apiGetPlacements({ jobId: job.id, page: 1, limit: 100, sortBy: 'offerDate', sortOrder: 'desc' })
      .then((response) => {
        if (!load.isActive()) return;
        setJobPlacements(unwrapApiList<Placement>(response.data));
      })
      .catch((error) => {
        console.warn('Failed to load job placements:', error);
        if (load.isActive()) setJobPlacements([]);
      })
      .finally(() => {
        load.finish();
      });

    return () => {
      load.abort();
    };
  }, [activeTab, isOpen, job?.id]);

  const handlePipelineReorder = (fromIndex: number, toIndex: number) => {
    if (pipelineConfigLocked) return;
    if (fromIndex === toIndex) return;
    const next = [...pipelineStages];
    const [removed] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, removed);
    setPipelineStages(next);
    notifyPipelineChange(next);
    setPipelineDirty(true);
    setPipelineValidationError('');
  };

  const handleAddStage = () => {
    if (pipelineConfigLocked) return;
    const next = [...pipelineStages, { id: `s-${Date.now()}`, name: 'New stage', sla: '' }];
    setPipelineStages(next);
    notifyPipelineChange(next);
    setPipelineDirty(true);
    setPipelineValidationError('');
  };

  const handleRemoveStage = (id: string) => {
    if (pipelineConfigLocked) return;
    const next = pipelineStages.filter((s) => s.id !== id);
    const normalized = normalizePipelineStages(next);
    setPipelineStages(normalized);
    notifyPipelineChange(normalized);
    setPipelineDirty(true);
    setPipelineValidationError('');
  };

  const handleStageNameChange = (id: string, name: string) => {
    if (pipelineConfigLocked) return;
    const stage = pipelineStages.find((s) => s.id === id);
    if (!stage) return;

    const next = pipelineStages.map((s) => (s.id === id ? { ...s, name } : s));
    setPipelineStages(next);
    notifyPipelineChange(next);
    setPipelineDirty(true);
    setPipelineValidationError('');
  };

  const handleStageSlaChange = (id: string, sla: string) => {
    if (pipelineConfigLocked) return;
    const next = pipelineStages.map((s) => (s.id === id ? { ...s, sla } : s));
    setPipelineStages(next);
    notifyPipelineChange(next);
    setPipelineDirty(true);
    setPipelineValidationError('');
  };

  const handleStageSystemRoleChange = (id: string, systemRole: string) => {
    const value = String(systemRole || '').trim();
    const next = pipelineStages.map((s) =>
      s.id === id ? { ...s, systemRole: value || undefined } : s
    );
    setPipelineStages(next);
    notifyPipelineChange(next);
    setPipelineDirty(true);
    setPipelineValidationError('');
  };

  const isDefaultPipelineStage = (stage: JobPipelineStage) => DEFAULT_PIPELINE_STAGE_ID_SET.has(String(stage.id || ''));
  const pipelineStageCountCards = useMemo(() => {
    const stageList = Array.isArray(pipelineStages) ? pipelineStages : [];
    const stageMeta = buildPipelineStageMatchMeta(stageList);
    const countsByStageId = new Map<string, number>();

    (Array.isArray(displayJobCandidates) ? displayJobCandidates : []).forEach((candidate) => {
      const stageId = resolveCandidateStageId(String(candidate?.currentStage || ''), stageMeta);
      if (!stageId) return;
      countsByStageId.set(stageId, (countsByStageId.get(stageId) || 0) + 1);
    });

    return stageList.map((stage) => {
      return {
        id: stage.id,
        name: String(stage?.name || '').trim() || 'Untitled',
        count: countsByStageId.get(stage.id) || 0,
      };
    });
  }, [pipelineStages, displayJobCandidates]);

  useEffect(() => {
    if (candidatesStageFilterId === 'all') return;
    const stillExists = pipelineStageCountCards.some((stage) => stage.id === candidatesStageFilterId);
    if (!stillExists) setCandidatesStageFilterId('all');
  }, [candidatesStageFilterId, pipelineStageCountCards]);

  return (
    <>
    <AnimatePresence>
      {isOpen ? (
      <DetailsModalShell
        key="job-detail-drawer"
        panelRef={jobDrawerPanelRef}
        onBackdropClick={() => void requestJobDrawerClose()}
        size="lg"
        zIndexClass="z-50"
        dialogTitleId="job-detail-modal-title"
        variant={layout === 'main' ? 'main' : 'centered'}
      >
        {/* Header — overflow visible so apply-link menu can sit above the tab bar */}
        <div className="relative z-20 shrink-0 border-b border-indigo-100/60 bg-gradient-to-br from-white via-indigo-50/45 to-violet-50/35 px-4 pb-2.5 pt-3 sm:px-5">
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(99,102,241,0.12),_transparent_55%)]" />
          </div>
          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {job ? (
                <>
                  <h2
                    id="job-detail-modal-title"
                    className="truncate text-lg font-bold tracking-tight text-slate-900 sm:text-xl"
                  >
                    {job.title}
                  </h2>
                  <div className="mt-2 flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto text-sm text-slate-600 [scrollbar-width:thin]">
                    <span className="inline-flex shrink-0 items-center gap-1.5">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
                        <Briefcase size={12} />
                      </span>
                      {job.client}
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1.5">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-50 text-violet-600 ring-1 ring-violet-100">
                        <MapPin size={12} />
                      </span>
                      {job.location}
                    </span>
                    {job.employmentType && (
                      <span className="shrink-0 rounded-full border border-slate-200/90 bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-slate-600 shadow-sm">
                        {job.employmentType}
                      </span>
                    )}
                    {!showStatusChange ? (
                      <button
                        type="button"
                        onClick={() => setShowStatusChange(true)}
                        className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold transition-opacity hover:opacity-80 ${statusStyleFor(localJobStatus || job.status)}`}
                        title="Change status"
                      >
                        {localJobStatus || job.status}
                      </button>
                    ) : (
                      <div className="flex min-w-[12rem] shrink-0 items-center gap-2">
                          <JobDrawerStatusDropdown
                            value={localJobStatus || job.status}
                            options={drawerStatusOptions}
                            deleting={deletingJobStatus || updatingJobStatus}
                            onSelect={(status) => {
                              void applyJobStatusChange(status);
                            }}
                            onDelete={(status) => {
                              void deleteJobStatusOption(status);
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setShowAddJobStatusInput((prev) => !prev);
                              setNewJobStatusValue('');
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 hover:text-indigo-800"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Add status
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowStatusChange(false);
                              setShowAddJobStatusInput(false);
                              setNewJobStatusValue('');
                              setLocalJobStatus(job.status);
                            }}
                            className="text-[11px] font-semibold text-slate-500 hover:text-slate-700"
                          >
                            Cancel
                          </button>
                        {showAddJobStatusInput ? (
                          <>
                            <input
                              value={newJobStatusValue}
                              onChange={(e) => setNewJobStatusValue(e.target.value)}
                              className="rounded-lg border border-indigo-200 px-2 py-1 text-xs text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              placeholder="Enter new status"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => void addJobStatusOption()}
                              disabled={savingJobStatus}
                              className="rounded-lg bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-2.5 py-1 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-60"
                            >
                              {savingJobStatus ? 'Adding…' : 'Add'}
                            </button>
                          </>
                        ) : null}
                      </div>
                    )}
                    {job.jobLocationType && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700">
                        <UserCheck size={12} />
                        {job.jobLocationType}
                      </span>
                    )}
                    {(() => {
                      const salaryLabel = formatJobSalaryRange(job);
                      return salaryLabel ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-200/90 bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-slate-600 shadow-sm">
                        <Banknote size={12} />
                        {salaryLabel}
                      </span>
                      ) : null;
                    })()}
                    <span className="shrink-0 rounded-full border border-slate-200/90 bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-slate-600 shadow-sm">
                      {formatDateDMY(job.postedDate ?? job.createdDate) || '—'}
                    </span>
                  </div>
                </>
              ) : (
                <h2 className="text-lg font-bold text-slate-900">Job Details</h2>
              )}
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2">
              {job && onEdit ? (
                <button
                  type="button"
                  onClick={() => onEdit(job)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-100 bg-white/90 px-2.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-800 sm:px-3"
                  title="Edit Job"
                >
                  <Pencil size={14} />
                  <span className="hidden sm:inline">Edit Job</span>
                </button>
              ) : null}
              {job?.status === 'Draft' && onPublish ? (
                <button
                  type="button"
                  onClick={() => onPublish(job)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-2.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:brightness-110 sm:px-3"
                  title="Publish Job"
                >
                  <Send size={14} />
                  <span className="hidden sm:inline">Publish</span>
                </button>
              ) : null}
              {job && onClone ? (
                <button
                  type="button"
                  onClick={() => onClone(job)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-100 bg-white/90 px-2.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-800 sm:px-3"
                  title="Clone Job"
                >
                  <Copy size={14} />
                  <span className="hidden sm:inline">Clone Job</span>
                </button>
              ) : null}
              {job && onCloseJob ? (
                <button
                  type="button"
                  onClick={() => onCloseJob(job)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 sm:px-3"
                  title="Close Job"
                >
                  <Archive size={14} />
                  <span className="hidden sm:inline">Close Job</span>
                </button>
              ) : null}
              {showHeaderSubmitToClient ? (
                <button
                  type="button"
                  onClick={openSubmitCandidatePicker}
                  className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-800 shadow-sm transition hover:bg-indigo-100"
                  aria-label="Submit to Client"
                  title="Choose a candidate and submit to the client"
                >
                  <Send size={16} strokeWidth={2.25} />
                  <span className="hidden md:inline">Submit to Client</span>
                </button>
              ) : null}
              {job?.id ? (
                <div className="relative">
                  <button
                    ref={applyShareTriggerRef}
                    type="button"
                    onClick={() => {
                      void openApplyShareMenu();
                    }}
                    disabled={applyLinkLoading && !applyUrl}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-indigo-100 bg-white/90 text-indigo-700 shadow-sm transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Candidate apply link"
                    title={
                      applyLinkLoading && !applyUrl
                        ? 'Loading apply link…'
                        : applyUrl
                          ? 'Candidate apply link'
                          : 'Click to load apply link'
                    }
                  >
                    {applyLinkLoading ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Link2 size={16} strokeWidth={2.25} />
                    )}
                  </button>
                  {applyShareOpen && applyUrl && applyShareMenuPosition && typeof document !== 'undefined'
                    ? createPortal(
                        <div
                          ref={applyShareMenuRef}
                          className="fixed z-[1200] max-h-72 w-44 overflow-y-auto rounded-xl border border-indigo-100 bg-white py-1 shadow-xl shadow-indigo-500/10"
                          style={{
                            width: 176,
                            left: Math.max(
                              8,
                              applyShareMenuPosition.left + applyShareMenuPosition.width - 176,
                            ),
                            ...(applyShareMenuPosition.placement === 'top'
                              ? { bottom: applyShareMenuPosition.bottom }
                              : { top: applyShareMenuPosition.top }),
                          }}
                        >
                      <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-indigo-400">
                        Apply link
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard.writeText(applyUrl).then(() => {
                            setApplyLinkCopied(true);
                            setApplyShareOpen(false);
                            window.setTimeout(() => setApplyLinkCopied(false), 2000);
                            requestInfo('Apply link copied');
                          });
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-900"
                      >
                        <Copy size={14} />
                        {applyLinkCopied ? 'Copied' : 'Copy'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setApplyShareOpen(false);
                          void shareApplyLink();
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-900"
                      >
                        <Share2 size={14} />
                        Share
                      </button>
                      {(
                        [
                          { id: 'whatsapp', label: 'WhatsApp' },
                          { id: 'linkedin', label: 'LinkedIn' },
                          { id: 'x', label: 'X / Twitter' },
                          { id: 'facebook', label: 'Facebook' },
                          { id: 'telegram', label: 'Telegram' },
                          { id: 'email', label: 'Email' },
                        ] as const
                      ).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            openApplyShareTarget(item.id);
                            setApplyShareOpen(false);
                          }}
                          className="flex w-full px-3 py-2 pl-9 text-left text-xs font-semibold text-slate-600 hover:bg-indigo-50 hover:text-indigo-900"
                        >
                          {item.label}
                        </button>
                      ))}
                      <a
                        href={applyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setApplyShareOpen(false)}
                        className="flex w-full items-center gap-2 border-t border-indigo-50 px-3 py-2 text-left text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
                      >
                        <ExternalLink size={14} />
                        Open
                      </a>
                        </div>,
                        document.body,
                      )
                    : null}
                </div>
              ) : null}
              {job && (
                <button
                  type="button"
                  onClick={() => setActiveTab('analytics')}
                  className="inline-flex items-center gap-2 rounded-xl border border-indigo-100 bg-white/90 px-3 py-2 text-xs font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-50"
                  aria-label="View analytics"
                >
                  <BarChart2 size={16} /> Analytics
                </button>
              )}
              <button
                type="button"
                onClick={() => void requestJobDrawerClose()}
                className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-indigo-50 hover:text-indigo-700"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
          </div>
        </div>

        {job ? (
          <>
            <DrawerTabBar
              ariaLabel="Job sections"
              tabs={TABS_VISIBLE_IN_BAR.map((tab) =>
                tab.id === 'client' ? { ...tab, badge: clientRemarksCount || undefined } : tab,
              )}
              activeId={activeTab}
              onChange={setActiveTab}
              compact
            />

            {/* Tab content */}
            {activeTab === 'candidates' ? (
            <div className={`flex min-h-0 flex-1 flex-col overflow-hidden ${DRAWER_FORM_SCROLL_BG}`}>
                  <div className="flex shrink-0 flex-col gap-2 px-3 pt-3 pb-2 lg:flex-row lg:items-center lg:justify-between">
                    <JobCandidateMatchModeToggle
                      mode={candidateMatchMode}
                      onChange={setCandidateMatchMode}
                    />
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                      <div className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
                        <Search
                          size={15}
                          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                        <input
                          type="search"
                          value={jobCandidatesSearch}
                          onChange={(event) => setJobCandidatesSearch(event.target.value)}
                          placeholder="Search candidates…"
                          className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-9 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/20"
                          aria-label="Search candidates on this job"
                        />
                        {jobCandidatesSearch.trim() ? (
                          <button
                            type="button"
                            onClick={() => setJobCandidatesSearch('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                            aria-label="Clear candidate search"
                          >
                            <X size={14} />
                          </button>
                        ) : null}
                      </div>
                      {candidateMatchMode === 'applied' && canAddCandidate && job?.id ? (
                        <>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept={BULK_CV_ACCEPT_INPUT}
                            multiple
                            className="hidden"
                            onChange={(event) => {
                              void handleJobCvFileSelected(event.target.files);
                            }}
                          />
                      <button
                        type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploadingJobCv}
                            className="inline-flex h-8 shrink-0 items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-white px-3 text-sm font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
                            title={`Upload one or more CVs (${BULK_CV_FORMAT_LABEL}) to create candidates for this job`}
                          >
                            {uploadingJobCv ? (
                              <Loader2 size={16} className="animate-spin" strokeWidth={2.25} />
                            ) : (
                        <Upload size={16} strokeWidth={2.25} />
                            )}
                            {uploadingJobCv
                              ? jobCvUploadProgress
                                ? `Creating ${jobCvUploadProgress.done}/${jobCvUploadProgress.total}…`
                                : 'Creating candidates…'
                              : 'Upload CV'}
                      </button>
                        </>
                    ) : null}
                    </div>
                  </div>

                  {candidateMatchMode === 'applied' ? (
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-3">
                {pipelineStageCountCards.length > 0 ? (
                  <div className="mb-2 flex shrink-0 gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
                    <button
                      type="button"
                      onClick={() => setCandidatesStageFilterId('all')}
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                        candidatesStageFilterId === 'all'
                          ? 'border-indigo-300 bg-indigo-600 text-white shadow-sm'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700'
                      }`}
                    >
                      All
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                          candidatesStageFilterId === 'all'
                            ? 'bg-white/20 text-white'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {displayJobCandidates.length}
                      </span>
                    </button>
                    {pipelineStageCountCards.map((stage) => {
                      const active = candidatesStageFilterId === stage.id;
                      return (
                        <button
                          key={stage.id}
                          type="button"
                          onClick={() => setCandidatesStageFilterId(stage.id)}
                          title={`Show ${stage.name} candidates`}
                          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                            active
                              ? 'border-indigo-300 bg-indigo-600 text-white shadow-sm'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700'
                          }`}
                        >
                          <span className="max-w-[9rem] truncate">{stage.name}</span>
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                              active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {stage.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
                <div className={PH2_TABLE_CARD_CLASS}>
                  <div className="flex shrink-0 items-center justify-between gap-3 border-b border-indigo-100/50 px-3 py-2">
                    <p className="text-sm font-semibold text-slate-800">
                      Candidates
                      {filteredJobTableCandidates.length ? (
                        <span className="ml-1.5 text-xs font-medium text-slate-400">
                          {filteredJobTableCandidates.length}
                        </span>
                      ) : null}
                      {candidatesStageFilterId !== 'all' ? (
                        <span className="ml-1.5 text-xs font-medium text-indigo-500">
                          ·{' '}
                          {pipelineStageCountCards.find((s) => s.id === candidatesStageFilterId)?.name ||
                            'Stage'}
                        </span>
                      ) : null}
                    </p>
                    <TableColumnsMenu
                      columns={CANDIDATE_TABLE_COLUMNS}
                      isVisible={candidateColumnVisibility.isVisible}
                      onToggle={candidateColumnVisibility.toggle}
                      onReset={candidateColumnVisibility.resetToDefault}
                      unlockedVisibleCount={candidateColumnVisibility.unlockedVisibleCount}
                    />
                  </div>
                  {selectedCandidateIds.length > 0 && job?.id ? (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50/80 px-3 py-2.5">
                      <p className="text-sm font-semibold text-indigo-900">
                        {selectedCandidateIds.length} candidate
                        {selectedCandidateIds.length === 1 ? '' : 's'} selected
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        {onScheduleInterview ? (
                          <button
                            type="button"
                            onClick={openBulkScheduleInterview}
                            className="inline-flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-700"
                            title="Schedule interview for selected candidates"
                          >
                            <Calendar size={14} strokeWidth={2.25} />
                            Schedule Interview
                            {selectedCandidateIds.length > 1
                              ? ` (${selectedCandidateIds.length})`
                              : ''}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={openBulkSubmitToClient}
                          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                          title="Choose CV type, then submit selected candidates to the client"
                        >
                          <Send size={14} strokeWidth={2.25} />
                          Submit {selectedCandidateIds.length} to Client
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedCandidateIds([])}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50"
                        >
                          <X size={14} />
                          Clear
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {appliedCandidatesLoading || appliedPipelineRunning ? (
                    <div className="flex min-h-0 flex-1 items-center justify-center gap-2 p-10 text-sm text-slate-500">
                      <Loader2 size={18} className="animate-spin text-emerald-600" />
                      {appliedPipelineRunning
                        ? 'Running AI applied matching…'
                        : 'Loading job-linked candidates…'}
                    </div>
                  ) : jobTableCandidates.length === 0 ? (
                    <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-8 text-center">
                      <Users size={32} className="mx-auto mb-3 text-slate-300" />
                      <p className="text-sm text-slate-500">
                        No candidates applied, assigned, or in the pipeline for this job yet.
                      </p>
                      {canAddCandidate && job?.id ? (
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingJobCv}
                          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {uploadingJobCv ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                          <Upload size={16} />
                          )}
                          {uploadingJobCv
                            ? jobCvUploadProgress
                              ? `Creating ${jobCvUploadProgress.done}/${jobCvUploadProgress.total}…`
                              : 'Creating candidates…'
                            : 'Upload CVs to add candidates'}
                        </button>
                      ) : null}
                    </div>
                  ) : filteredJobTableCandidates.length === 0 ? (
                    <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-8 text-center">
                      <Search size={28} className="mx-auto mb-3 text-slate-300" />
                      <p className="text-sm text-slate-500">
                        {candidatesStageFilterId !== 'all' && !jobCandidatesSearch.trim()
                          ? `No candidates in “${
                              pipelineStageCountCards.find((s) => s.id === candidatesStageFilterId)
                                ?.name || 'this stage'
                            }” yet.`
                          : `No candidates match “${jobCandidatesSearch.trim()}”.`}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
                        {candidatesStageFilterId !== 'all' ? (
                          <button
                            type="button"
                            onClick={() => setCandidatesStageFilterId('all')}
                            className="text-sm font-semibold text-indigo-600 hover:text-indigo-700"
                          >
                            Show all stages
                          </button>
                        ) : null}
                        {jobCandidatesSearch.trim() ? (
                          <button
                            type="button"
                            onClick={() => setJobCandidatesSearch('')}
                            className="text-sm font-semibold text-indigo-600 hover:text-indigo-700"
                          >
                            Clear search
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <>
                    <div className={PH2_TABLE_BODY_SCROLL_CLASS}>
                    <CandidateTable
                        candidates={pagedJobTableCandidates}
                        showMatchScore={showMatchScores}
                        compact
                        fillScrollParent
                        selectedIds={selectedCandidateIds}
                        onToggleSelect={(id) =>
                          setSelectedCandidateIds((prev) =>
                            prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
                          )
                        }
                        onToggleSelectAll={() =>
                          setSelectedCandidateIds((prev) => {
                            const pageIds = pagedJobTableCandidates.map((row) => row.id);
                            const allPageSelected =
                              pageIds.length > 0 && pageIds.every((id) => prev.includes(id));
                            if (allPageSelected) {
                              return prev.filter((id) => !pageIds.includes(id));
                            }
                            return [...new Set([...prev, ...pageIds])];
                          })
                        }
                        onViewProfile={onViewCandidateProfile}
                        onEditCandidate={onEditCandidate}
                        stageOptionsByJobId={inlineStageOptionsMerged}
                        stageOptionsLoadingJobId={inlineStageOptionsLoadingJobId}
                        movingCandidateId={inlineStageUpdatingCandidateId}
                        onLoadStageOptions={
                          job?.id ? loadInlineStageOptionsForCandidate : undefined
                        }
                        onChangeCandidateStage={
                          job?.id ? handleInlineCandidateStageChange : undefined
                        }
                        onMoveStage={
                          onAddToPipeline && job?.id ? openMoveStageFromTable : undefined
                        }
                        onRemoveFromJob={job?.id ? handleRemoveJobCandidate : undefined}
                        removingFromJobCandidateId={removingFromJobCandidateId}
                        onDeleteCandidate={handleDeleteJobCandidate}
                        deletingCandidateId={deletingCandidateId}
                        isColumnVisible={candidateColumnVisibility.isVisible}
                      />
                    </div>
                    <div className={PH2_TABLE_CARD_FOOTER_CLASS}>
                      <PaginationAll
                        initialPage={safeCandidatesPage}
                        totalPages={candidatesTotalPages}
                        totalCount={filteredJobTableCandidates.length}
                        pageSize={candidatesPageSize}
                        pageSizeOptions={[...TABLE_PAGE_SIZE_OPTIONS]}
                        onPageSizeChange={(n) => {
                          if (!(TABLE_PAGE_SIZE_OPTIONS as readonly number[]).includes(n)) return;
                          setCandidatesPageSize(n as TablePageSize);
                          setCandidatesPage(1);
                        }}
                        itemLabel="candidates"
                        onPageChange={setCandidatesPage}
                      />
                    </div>
                    </>
                  )}
                </div>
                </div>
                  ) : job ? (
                <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
                <JobDrawerAiMatchesTab
                  job={job}
                  aiMatchCandidates={aiMatchCandidates}
                  sortedAiMatchCandidates={filteredSortedAiMatchCandidates}
                  aiTierStats={aiTierStats}
                  aiMatchesLoading={aiMatchesLoading}
                  aiPipelineRunning={aiPipelineRunning}
                  aiMatchesError={aiMatchesError}
                  aiMatchSelectedIds={aiMatchSelectedIds}
                  aiSavedMatches={aiSavedMatches}
                  aiExpandedAnalysis={aiExpandedAnalysis}
                  onRunAiMatches={handleRunAiMatches}
                  onToggleSelect={(candidateId) =>
                    setAiMatchSelectedIds((prev) =>
                      prev.includes(candidateId)
                        ? prev.filter((id) => id !== candidateId)
                        : [...prev, candidateId],
                    )
                  }
                  onToggleSelectAll={() =>
                    setAiMatchSelectedIds((prev) =>
                      prev.length === filteredSortedAiMatchCandidates.length
                        ? []
                        : filteredSortedAiMatchCandidates.map((row) => row.id),
                    )
                  }
                  onToggleSave={(candidateId) => {
                    const candidate = aiMatchCandidates.find((item) => item.id === candidateId);
                    if (!candidate) return;
                    const nextSaved = !aiSavedMatches.includes(candidateId);
                    void (async () => {
                      const matchId = await ensureAiMatchId(candidate);
                      if (!matchId) return;
                      await apiToggleSavedMatch(matchId, nextSaved);
                      setAiSavedMatches((previous) =>
                        nextSaved
                          ? [...previous, candidateId]
                          : previous.filter((id) => id !== candidateId),
                      );
                      updateAiMatchCandidate(candidateId, (current) => ({
                        ...current,
                        matchId,
                        savedAt: nextSaved ? new Date().toISOString() : null,
                      }));
                    })();
                  }}
                  onToggleAnalysis={(candidateId) =>
                    setAiExpandedAnalysis((previous) =>
                      previous === candidateId ? null : candidateId,
                    )
                  }
                  onViewProfile={(candidateId) => {
                    const match = aiMatchCandidates.find((item) => item.id === candidateId);
                    if (!match || !onViewCandidateProfile) return;
                    onViewCandidateProfile(matchCandidateToJobTableRow(match, job.title, job.id));
                  }}
                  onOpenSubmit={(candidateId) => {
                    const candidate = aiMatchCandidates.find((item) => item.id === candidateId);
                    if (!candidate || !job?.id) return;
                    setSubmitClientRowId(candidateId);
                    void (async () => {
                      const matchId = await ensureAiMatchId(candidate);
                      openSubmit({
                        candidateId: candidate.id,
                        jobId: job.id,
                        candidateName: candidate.name,
                        jobTitle: job.title,
                        clientId: job.clientId,
                        matchScore: candidate.score,
                        matchId: matchId || undefined,
                      });
                    })();
                  }}
                  isColumnVisible={matchColumnVisibility.isVisible}
                  columnsMenu={
                    <TableColumnsMenu
                      columns={MATCH_TABLE_COLUMNS}
                      isVisible={matchColumnVisibility.isVisible}
                      onToggle={matchColumnVisibility.toggle}
                      onReset={matchColumnVisibility.resetToDefault}
                      unlockedVisibleCount={matchColumnVisibility.unlockedVisibleCount}
                    />
                  }
                />
                </div>
                  ) : null}
            </div>
            ) : (
            <div className={`flex-1 overflow-y-auto ${DRAWER_FORM_SCROLL_BG}`}>
              <div className="space-y-5 p-5 sm:p-6">
              {activeTab === 'overview' && job && (
                <div className="space-y-5">
                  <EntityWorkspaceAlertsPanel
                    entityType="JOB"
                    entityId={job.id}
                    entityLabel={job.title || 'Job'}
                  />
                  <JobOverviewTabContent job={job} />
                </div>
              )}

              {activeTab === 'assessments' && job && (
                <JobAssessmentsTabContent job={job} />
              )}

              {activeTab === 'client' && (
                <DrawerSectionCard
                  title="Client"
                  subtitle={`Submitted candidates for ${clientRemarksClientName || job.client || 'the client'}. Click a name to see comments and uploads.`}
                  icon={Building2}
                  accent="violet"
                >
                  <JobClientRemarksTab
                    loading={loadingClientRemarks}
                    error={clientRemarksError}
                    clientName={clientRemarksClientName || job.client}
                    candidates={clientRemarkCandidates}
                    onViewCandidate={
                      onViewCandidateProfile
                        ? (candidateId) => {
                            const fromJob = displayJobCandidates.find((row) => row.id === candidateId);
                            if (fromJob) {
                              onViewCandidateProfile(
                                mapJobCandidateToTableRow(fromJob, job.title, job.id),
                              );
                              return;
                            }
                            const fromRemarks = clientRemarkCandidates.find(
                              (row) => row.candidateId === candidateId,
                            );
                            onViewCandidateProfile(
                              mapJobCandidateToTableRow(
                                {
                                  id: candidateId,
                                  candidateName: fromRemarks?.candidateName || 'Candidate',
                                  email: fromRemarks?.email || undefined,
                                  avatar: fromRemarks?.avatar || null,
                                  currentStage: '',
                                  score: '',
                                  recruiter: '',
                                  interviewStatus: '',
                                  lastActivity: '',
                                },
                                job.title,
                                job.id,
                              ),
                            );
                          }
                        : undefined
                    }
                  />
                </DrawerSectionCard>
              )}

              {activeTab === 'pipeline' && (
                <div className="space-y-5">
                  <DrawerSectionCard
                    title="Stage Counts"
                    subtitle="Candidates per pipeline stage"
                    icon={GitBranch}
                    accent="emerald"
                  >
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                      {pipelineStageCountCards.map((stage) => (
                        <div key={stage.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
                          <p className="truncate text-[10px] font-bold uppercase text-slate-400" title={stage.name}>
                            {stage.name}
                          </p>
                          <p className="mt-1 text-xl font-bold text-slate-900">{stage.count}</p>
                        </div>
                      ))}
                    </div>
                  </DrawerSectionCard>

                  <DrawerSectionCard
                    title="Pipeline Configuration"
                    subtitle={
                      pipelineConfigLocked
                        ? 'Organization default pipeline from Settings'
                        : 'Custom hiring pipeline for this job'
                    }
                    icon={GitBranch}
                    accent="indigo"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-slate-500">
                          {pipelineConfigLocked
                            ? 'Use “Customize pipeline” to define stages for this job only.'
                            : 'Drag to reorder, add or remove stages.'}
                        </p>
                        <p className="mt-1 text-[11px] text-amber-600">Note: SLA values are currently display-only and are not persisted yet.</p>
                      </div>
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          {job?.id && (
                            <button
                              type="button"
                              onClick={async () => {
                                const ok = await requestConfirm(
                                  'Reset this job\'s pipeline to the organization default template? This wipes the current stages and any candidates already on them.',
                                  {
                                    tone: 'warning',
                                    confirmLabel: 'Reset pipeline',
                                    cancelLabel: 'Cancel',
                                  }
                                );
                                if (!ok) return;
                                try {
                                  const res = await apiResetJobPipelineToOrgTemplate(job.id);
                                  const stages = res.data?.stages || [];
                                  const mapped = stages.map((s) => ({
                                    id: String(s.id),
                                    name: String(s.name || ''),
                                    sla: '',
                                    systemRole: s.systemRole || undefined,
                                  }));
                                  setPipelineStages(mapped);
                                  notifyPipelineChange(mapped);
                                  setPipelineDirty(false);
                                  setJobPipelineCustomized(false);
                                  void requestInfo('Pipeline reset to org default');
                                } catch (err: any) {
                                  void requestError(err?.message || 'Failed to reset pipeline');
                                }
                              }}
                              className="px-3 py-2 rounded-lg text-xs font-bold border border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors"
                              title="Replace this job's stages with the saved org template"
                            >
                              Reset to org default
                            </button>
                          )}
                          {pipelineConfigLocked ? (
                            <button
                              type="button"
                              onClick={() => setJobPipelineCustomized(true)}
                              className="px-3 py-2 rounded-lg text-xs font-bold border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
                            >
                              Customize pipeline
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setJobPipelineCustomized(false);
                                setPipelineDirty(false);
                              }}
                              className="px-3 py-2 rounded-lg text-xs font-bold border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 transition-colors"
                            >
                              Use org default
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              if (pipelineConfigLocked) return;
                              const hasEmptyStageName = pipelineStages.some(
                                (stage) => String(stage.name || '').trim().length === 0
                              );
                              if (hasEmptyStageName) {
                                setPipelineValidationError('Please enter a stage name for all pipeline stages before saving.');
                                return;
                              }
                              const stagesForSave = pipelineStages.map((stage) => ({
                                ...stage,
                                name: String(stage.name || '').trim(),
                                systemRole: stage.systemRole && String(stage.systemRole).trim()
                                  ? String(stage.systemRole).trim()
                                  : undefined,
                              }));
                              setPipelineStages(stagesForSave);
                              notifyPipelineChange(stagesForSave);
                              onSavePipelineStages?.(stagesForSave);
                              setPipelineValidationError('');
                              setPipelineDirty(false);
                            }}
                            disabled={!pipelineDirty || pipelineConfigLocked}
                            className={`px-3 py-2 rounded-lg text-xs font-bold border transition-colors ${
                              pipelineDirty && !pipelineConfigLocked
                                ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                                : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                            }`}
                          >
                            Save pipeline
                          </button>
                        </div>
                      </div>
                      {!pipelineConfigLocked && (
                        <button
                          type="button"
                          onClick={handleAddStage}
                          className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-100 transition-colors"
                        >
                          <Plus size={14} /> Add stage
                        </button>
                      )}
                      {pipelineValidationError ? (
                        <p className="mt-3 text-xs font-medium text-red-600">{pipelineValidationError}</p>
                      ) : null}
                    <div className={`mt-4 ${DRAWER_LIST_SHELL}`}>
                      {pipelineStages.length === 0 ? (
                        <div className="px-4 py-8 text-center text-sm text-slate-500">
                          No stages yet. Click &quot;+ Add stage&quot; to build your pipeline, then &quot;Save pipeline&quot; when done.
                        </div>
                      ) : (
                        pipelineStages.map((stage, index) => (
                          <div
                            key={stage.id}
                            draggable={!pipelineConfigLocked}
                            onDragStart={() => {
                              if (pipelineConfigLocked) return;
                              setDraggedStageId(stage.id);
                            }}
                            onDragOver={(e) => {
                              if (pipelineConfigLocked) return;
                              e.preventDefault();
                            }}
                            onDrop={(e) => {
                              if (pipelineConfigLocked) return;
                              e.preventDefault();
                              if (!draggedStageId || draggedStageId === stage.id) return;
                              const from = pipelineStages.findIndex((s) => s.id === draggedStageId);
                              const to = index;
                              if (from >= 0 && to >= 0) handlePipelineReorder(from, to);
                              setDraggedStageId(null);
                            }}
                            onDragEnd={() => setDraggedStageId(null)}
                            className={`flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-indigo-50/50 ${
                              draggedStageId === stage.id ? 'opacity-50' : ''
                            }`}
                          >
                            <span
                              className={`shrink-0 ${pipelineConfigLocked ? 'text-slate-200' : 'cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600'}`}
                              aria-label="Drag to reorder"
                            >
                              <GripVertical size={18} />
                            </span>
                            <span className="text-sm font-medium text-slate-500 w-8 shrink-0">{index + 1}</span>
                            {pipelineConfigLocked ? (
                              <span className="flex-1 min-w-0 text-sm font-medium text-slate-900">{stage.name}</span>
                            ) : (
                              <input
                                type="text"
                                value={stage.name}
                                onChange={(e) => handleStageNameChange(stage.id, e.target.value)}
                                className="flex-1 min-w-[120px] rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                placeholder="Stage name"
                              />
                            )}
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[10px] font-bold text-slate-400 uppercase whitespace-nowrap">Role</span>
                              {pipelineConfigLocked ? (
                                <span className="text-xs font-medium text-slate-600 min-w-[100px]">
                                  {PIPELINE_SYSTEM_ROLE_OPTIONS.find((o) => o.value === (stage.systemRole || ''))?.label ||
                                    stage.systemRole ||
                                    '—'}
                                </span>
                              ) : (
                                <select
                                  value={stage.systemRole || ''}
                                  onChange={(e) => handleStageSystemRoleChange(stage.id, e.target.value)}
                                  className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-800 min-w-[128px]"
                                >
                                  {PIPELINE_SYSTEM_ROLE_OPTIONS.map((o) => (
                                    <option key={o.value || 'unset'} value={o.value}>
                                      {o.label}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0 w-28">
                              <Clock size={14} className="text-slate-400 shrink-0" />
                              <input
                                type="text"
                                value={stage.sla ?? ''}
                                onChange={(e) => handleStageSlaChange(stage.id, e.target.value)}
                                placeholder="e.g. 2 days"
                                disabled
                                title="SLA persistence is not enabled yet"
                                className="w-full rounded-lg border border-slate-200 bg-slate-100 px-2 py-1.5 text-xs text-slate-500 cursor-not-allowed"
                              />
                            </div>
                            {!pipelineConfigLocked && (
                              <button
                                type="button"
                                onClick={() => handleRemoveStage(stage.id)}
                                disabled={isDefaultPipelineStage(stage)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
                                aria-label="Remove stage"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </DrawerSectionCard>
                </div>
              )}
              {activeTab === 'analytics' && (
                <DrawerSectionCard
                  title="Job Analytics"
                  subtitle="Stats dashboard for job performance and hiring effectiveness"
                  icon={BarChart2}
                  accent="amber"
                >
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Applications received</p>
                          <p className="text-xl font-bold text-slate-900 mt-1">{job.applied}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Candidates screened</p>
                          <p className="text-xl font-bold text-slate-900 mt-1">{job.interviewed}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Interviews scheduled</p>
                          <p className="text-xl font-bold text-slate-900 mt-1">{job.interviewed}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Offers made</p>
                          <p className="text-xl font-bold text-slate-900 mt-1">{job.offered}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center flex flex-col items-center justify-center">
                          <p className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                            <Timer size={10} /> Time-to-fill
                          </p>
                          <p className="text-xl font-bold text-slate-900 mt-1">18 days</p>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center flex flex-col items-center justify-center">
                          <p className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                            <TrendingUp size={10} /> Source performance
                          </p>
                          <p className="text-xl font-bold text-slate-900 mt-1">—</p>
                        </div>
                      </div>
                </DrawerSectionCard>
              )}
              {activeTab === 'assignment' && (
                <DrawerSectionCard
                  title="Job Assignment"
                  subtitle="Assignment Rules for Jobs — organization, manager, and team ownership"
                  icon={UserCog}
                  accent="sky"
                  headerRight={
                    <button
                      type="button"
                      onClick={() => void saveAssignment()}
                      disabled={
                        !assignmentDirty ||
                        savingAssignment ||
                        loadingAssignmentMeta ||
                        loadingAssignmentRecruiters
                      }
                      className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold shadow-sm transition ${
                        assignmentDirty &&
                        !savingAssignment &&
                        !loadingAssignmentMeta &&
                        !loadingAssignmentRecruiters
                          ? 'border border-sky-200 bg-sky-600 text-white hover:bg-sky-700'
                          : 'border border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      {savingAssignment ? <Loader2 size={14} className="animate-spin" /> : null}
                      Save assignment
                    </button>
                  }
                >
                    <div className="space-y-4">
                      {assignable.canSelectCompany ? (
                      <div>
                          <AssignCompanySelect
                            companies={assignable.companies}
                            value={assignable.companyId}
                            label="Organization"
                            onChange={(id) => {
                              assignable.setCompanyId(id);
                              if (id !== assignable.companyId) {
                                setAssignmentMemberIds([]);
                                setAssignmentManagerId('');
                                setAssignmentDirty(true);
                              }
                            }}
                          />
                          <p className="mt-1 text-[11px] text-slate-400">
                            Assignment organization (who owns this job).
                          </p>
                        </div>
                      ) : null}

                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                          Manager
                        </label>
                        <select
                          value={assignmentManagerId}
                          disabled={
                            savingAssignment ||
                            loadingAssignmentRecruiters ||
                            needsAssignmentOrganizationFirst
                          }
                          onChange={(e) => selectAssignmentManager(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 disabled:bg-slate-50 disabled:text-slate-400"
                        >
                          <option value="">
                            {!assignable.companiesReady || loadingAssignmentRecruiters
                              ? 'Loading…'
                              : needsAssignmentOrganizationFirst
                                ? 'Select an organization first'
                                : 'Select manager'}
                          </option>
                          {assignmentManagerId &&
                          !assignmentManagerUsers.some((u) => u.id === assignmentManagerId) ? (
                            <option value={assignmentManagerId}>
                              {String(job?.managerName || '').trim() || 'Current manager'}
                            </option>
                          ) : null}
                          {assignmentManagerUsers.map((user) => (
                            <option key={user.id} value={user.id}>
                              {formatAssigneeOptionLabel(user, assignmentCurrentUserId)}
                            </option>
                          ))}
                        </select>
                        <p className="mt-1 text-[11px] text-slate-400">
                          You can assign this job to anyone Assignment Rules allow, including yourself.
                        </p>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                          Recruiters / Team members
                        </label>
                        {selectedAssignmentAssignees.length > 0 ? (
                          <div className="mb-2 flex flex-wrap gap-1.5">
                            {selectedAssignmentAssignees.map((user, index) => (
                              <span
                                key={user.id}
                                className="inline-flex items-center gap-1 rounded-full border border-sky-100 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-800"
                              >
                                <span className="max-w-[180px] truncate">
                                  {formatAssigneeOptionLabel(user, assignmentCurrentUserId)}
                            </span>
                                {index === 0 ? (
                                  <span className="rounded bg-sky-100 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-sky-600">
                                    Primary
                                  </span>
                                ) : null}
                                <button
                                  type="button"
                                  aria-label={`Remove ${formatAssigneeOptionLabel(user, assignmentCurrentUserId)}`}
                                  disabled={savingAssignment}
                                  onClick={() =>
                                    applyAssignmentMemberIds(
                                      assignmentMemberIds.filter((id) => id !== user.id),
                                    )
                                  }
                                  className="rounded-full p-0.5 text-sky-500 hover:bg-sky-100 hover:text-sky-700"
                                >
                                  <X size={12} />
                                </button>
                              </span>
                            ))}
                          </div>
                        ) : null}
                        <div className="relative">
                          <button
                            ref={assignmentRecruiterTriggerRef}
                            type="button"
                            disabled={savingAssignment}
                            onClick={() => setAssignmentRecruiterOpen((open) => !open)}
                            className="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-left text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 disabled:bg-slate-50"
                          >
                            <span
                              className={
                                selectedAssignmentAssignees.length ? 'text-slate-700' : 'text-slate-400'
                              }
                            >
                              {selectedAssignmentAssignees.length
                                ? `${selectedAssignmentAssignees.length} selected — add more`
                                : !assignable.companiesReady || loadingAssignmentRecruiters
                                  ? 'Loading team…'
                                  : needsAssignmentOrganizationFirst
                                    ? 'Select an organization first'
                                    : needsAssignmentManagerFirst
                                      ? 'Select a manager first'
                                      : filteredAssignmentRecruiters.length === 0
                                        ? 'No people in Assignment Rules for Jobs'
                                        : 'Select people Assignment Rules allow'}
                            </span>
                            <ChevronDown size={16} className="text-slate-400 shrink-0" />
                          </button>
                          {assignmentRecruiterOpen &&
                          assignmentRecruiterMenuPosition &&
                          typeof document !== 'undefined'
                            ? createPortal(
                                <div
                                  ref={assignmentRecruiterMenuRef}
                                  className="fixed z-[1200] max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-2xl"
                                  style={{
                                    left: assignmentRecruiterMenuPosition.left,
                                    width: assignmentRecruiterMenuPosition.width,
                                    ...(assignmentRecruiterMenuPosition.placement === 'top'
                                      ? { bottom: assignmentRecruiterMenuPosition.bottom }
                                      : { top: assignmentRecruiterMenuPosition.top }),
                                  }}
                                >
                                  <ul>
                                    {loadingAssignmentRecruiters ? (
                                      <li className="px-4 py-2 text-sm text-slate-500">Loading team…</li>
                                    ) : needsAssignmentOrganizationFirst ? (
                                      <li className="px-4 py-2 text-sm text-slate-500">
                                        Select an organization to see members
                                      </li>
                                    ) : needsAssignmentManagerFirst ? (
                                      <li className="px-4 py-2 text-sm text-slate-500">
                                        Select a manager to see their team
                                      </li>
                                    ) : filteredAssignmentRecruiters.length === 0 ? (
                                      <li className="px-4 py-2 text-sm text-slate-500">
                                        No people in Assignment Rules for Jobs
                                      </li>
                                    ) : (
                                      <>
                                        <li>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              applyAssignmentMemberIds([]);
                                              closeAssignmentRecruiterMenu();
                                            }}
                                            className="w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 text-slate-700"
                                          >
                                            Clear all
                                          </button>
                                        </li>
                                        {filteredAssignmentRecruiters.map((user) => {
                                          const checked = assignmentMemberIds.includes(user.id);
                                          const isPrimary = assignmentMemberIds[0] === user.id;
                                          return (
                                            <li key={user.id}>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const next = checked
                                                    ? assignmentMemberIds.filter((id) => id !== user.id)
                                                    : [...assignmentMemberIds, user.id];
                                                  applyAssignmentMemberIds(next);
                                                }}
                                                className={`w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 ${
                                                  checked
                                                    ? 'bg-sky-50 text-sky-700 font-medium'
                                                    : 'text-slate-700'
                                                }`}
                                              >
                                                <span className="flex items-start gap-2">
                                                  <span
                                                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                                                      checked
                                                        ? 'border-sky-500 bg-sky-500 text-white'
                                                        : 'border-slate-300 bg-white'
                                                    }`}
                                                  >
                                                    {checked ? '✓' : ''}
                                                  </span>
                                                  <span className="min-w-0 flex-1">
                                                    <span className="block font-medium">
                                                      {formatAssigneeOptionLabel(
                                                        user,
                                                        assignmentCurrentUserId,
                                                      )}
                                                      {isPrimary ? (
                                                        <span className="ml-1 text-[10px] font-bold uppercase text-sky-500">
                                                          Primary
                                                        </span>
                                                      ) : null}
                                                    </span>
                                                    {user.email ? (
                                                      <span className="block text-xs text-slate-500 truncate">
                                                        {user.email}
                                                      </span>
                                                    ) : null}
                                                  </span>
                                                </span>
                                              </button>
                                            </li>
                                          );
                                        })}
                                      </>
                                    )}
                                  </ul>
                                </div>,
                                document.body,
                              )
                            : null}
                        </div>
                        <p className="mt-1 text-[11px] text-slate-400">
                          Assign to anyone Assignment Rules allow for Jobs. First selected is the
                          primary recruiter; others are supporting.
                        </p>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                          Hiring manager
                        </label>
                        <select
                          value={assignmentHiringManagerId}
                          disabled={loadingAssignmentMeta || savingAssignment}
                          onChange={(e) => {
                            const nextId = e.target.value;
                            const contact = assignmentContacts.find((c) => c.id === nextId);
                            setAssignmentHiringManagerId(nextId);
                            setAssignmentHiringManagerName(contact?.name || '');
                            setAssignmentDirty(true);
                          }}
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 disabled:bg-slate-50 disabled:text-slate-400"
                        >
                          <option value="">
                            {assignmentHiringManagerName && !assignmentHiringManagerId
                              ? assignmentHiringManagerName
                              : 'None'}
                          </option>
                          {assignmentHiringManagerId &&
                          !assignmentContacts.some((c) => c.id === assignmentHiringManagerId) ? (
                            <option value={assignmentHiringManagerId}>
                              {assignmentHiringManagerName || 'Current hiring manager'}
                            </option>
                          ) : null}
                          {assignmentContacts.map((contact) => (
                            <option key={contact.id} value={contact.id}>
                              {contact.name}
                            </option>
                          ))}
                        </select>
                        {assignmentHiringManagerName && !assignmentHiringManagerId ? (
                          <p className="text-[11px] text-slate-500 mt-1">
                            Saved as “{assignmentHiringManagerName}”. Pick a contact to link an ID.
                          </p>
                        ) : null}
                        {!job?.clientId ? (
                          <p className="text-[11px] text-amber-600 mt-1">
                            Link a client to this job to choose from client contacts.
                          </p>
                        ) : null}
                      </div>
                    </div>
                </DrawerSectionCard>
              )}
              {activeTab === 'interviews' && (
                <DrawerSectionCard
                  title="Interviews"
                  subtitle="Scheduled and completed interviews for this job"
                  icon={Calendar}
                  accent="amber"
                  headerRight={
                    onScheduleInterview ? (
                      <button
                        type="button"
                        onClick={() => void openScheduleInterviewCandidatePicker()}
                        className="inline-flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-700"
                        title="Schedule interview for candidates assigned to this job"
                      >
                        <Calendar size={14} strokeWidth={2.25} />
                        Schedule Interview
                      </button>
                    ) : null
                  }
                >
                  <div className="space-y-3">
                    {!loadingJobInterviews && jobInterviews.length > 0 ? (
                      <InterviewRoundTabs
                        rounds={jobInterviewRoundNumbers}
                        active={selectedInterviewRound}
                        onChange={setSelectedInterviewRound}
                        countsByRound={jobInterviewCountsByRound}
                        allCount={jobInterviewAllCandidateCount}
                      />
                    ) : null}
                    <div className={DRAWER_TABLE_SHELL}>
                    <div className={DRAWER_TABLE_SCROLL}>
                      <table className="w-full min-w-[780px] border-collapse text-left">
                        <thead>
                          <tr className={DRAWER_TABLE_HEAD_ROW}>
                            <th className={`${DRAWER_TABLE_TH} first:pl-4 sm:first:pl-5`}>Candidate</th>
                            <th className={DRAWER_TABLE_TH}>Date &amp; time</th>
                            <th className={DRAWER_TABLE_TH}>Round</th>
                            <th className={DRAWER_TABLE_TH}>Type</th>
                            <th className={DRAWER_TABLE_TH}>Panel</th>
                            <th className={`${DRAWER_TABLE_TH} sm:pr-5`}>Status</th>
                          </tr>
                        </thead>
                        <tbody className={DRAWER_TABLE_BODY}>
                      {loadingJobInterviews ? (
                            <tr>
                              <td
                                colSpan={6}
                                className={`${DRAWER_TABLE_TD} py-12 text-center text-sm text-slate-500`}
                              >
                                <span className="inline-flex items-center gap-2">
                                  <Loader2 size={16} className="animate-spin text-indigo-500" />
                          Loading interviews…
                                </span>
                              </td>
                            </tr>
                      ) : jobInterviews.length === 0 ? (
                            <tr>
                              <td
                                colSpan={6}
                                className={`${DRAWER_TABLE_TD} py-12 text-center text-sm text-slate-500`}
                              >
                                <p>No interviews scheduled for this job yet.</p>
                                {onScheduleInterview ? (
                                  <button
                                    type="button"
                                    onClick={() => void openScheduleInterviewCandidatePicker()}
                                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
                                  >
                                    <Calendar size={16} />
                                    Schedule Interview
                                  </button>
                                ) : null}
                              </td>
                            </tr>
                          ) : filteredJobInterviews.length === 0 ? (
                            <tr>
                              <td
                                colSpan={6}
                                className={`${DRAWER_TABLE_TD} py-12 text-center text-sm text-slate-500`}
                              >
                                <p className="font-medium text-slate-700">No candidates in this round</p>
                                <p className="mt-1 text-xs text-slate-500">
                                  Schedule an interview for this job, or switch to another round tab.
                                </p>
                              </td>
                            </tr>
                          ) : (
                            filteredJobInterviews.map((item) => {
                          const statusLabel = formatInterviewListStatus(item.status);
                              const candidateEmail = String(item.candidate?.email || '').trim();
                              const timezoneLabel = item.timezone
                                ? formatTimezoneDisplay(resolveIanaFromTimezoneValue(item.timezone))
                                : '';
                              const roundNumber = jobInterviewRoundById[item.id] || 1;
                              const roundType = String(item.round || '').trim() || 'Screening';
                          return (
                                <tr
                              key={item.id}
                                  className={`${DRAWER_TABLE_TR} cursor-pointer`}
                                  onClick={() => {
                                    setSelectedJobInterview(item);
                                    setJobInterviewDetailOpen(true);
                                  }}
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                      event.preventDefault();
                                      setSelectedJobInterview(item);
                                      setJobInterviewDetailOpen(true);
                                    }
                                  }}
                                  tabIndex={0}
                                  role="button"
                                  aria-label={`Open interview for ${candidateNameFromInterview(item)}`}
                                >
                                  <td className={`${DRAWER_TABLE_TD} first:pl-4 sm:first:pl-5`}>
                                    <p className="max-w-[200px] truncate text-sm font-semibold text-slate-900">
                                      {candidateNameFromInterview(item)}
                                    </p>
                                    {candidateEmail ? (
                                      <p className="max-w-[200px] truncate text-[11px] text-slate-500">
                                        {candidateEmail}
                                      </p>
                                    ) : null}
                                  </td>
                                  <td className={DRAWER_TABLE_TD}>
                                    <p className="text-sm font-medium text-slate-800">
                                      {formatInterviewDateInTimezone(item.scheduledAt, item.timezone)}
                                    </p>
                                <p className="text-[11px] text-slate-500">
                                  {formatInterviewTimeInTimezone(item.scheduledAt, item.timezone)}
                                      {timezoneLabel ? ` · ${timezoneLabel}` : ''}
                                      {item.duration ? ` · ${item.duration} min` : ''}
                                    </p>
                                  </td>
                                  <td className={DRAWER_TABLE_TD}>
                                    <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                                      R{roundNumber}
                                      <span className="font-medium text-indigo-500/80">·</span>
                                      <span className="font-medium text-slate-700">{roundType}</span>
                              </span>
                                  </td>
                                  <td className={`${DRAWER_TABLE_TD} text-sm text-slate-700`}>
                                    {formatInterviewTypeLabel(item)}
                                  </td>
                                  <td className={`${DRAWER_TABLE_TD} max-w-[180px]`}>
                                    <p className="truncate text-sm text-slate-600" title={panelNamesFromInterview(item)}>
                                      {panelNamesFromInterview(item)}
                                    </p>
                                  </td>
                                  <td className={`${DRAWER_TABLE_TD} sm:pr-5`}>
                              <span
                                      className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${interviewListStatusBadgeClass(statusLabel)}`}
                              >
                                {statusLabel}
                              </span>
                                  </td>
                                </tr>
                          );
                        })
                      )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                    </div>
                </DrawerSectionCard>
              )}
              {activeTab === 'placements' && (
                <DrawerSectionCard
                  title="Placements"
                  subtitle="Successful hires for this job"
                  icon={UserCheck}
                  accent="emerald"
                >
                    {loadingJobPlacements ? (
                      <div className="flex items-center justify-center gap-2 p-8 text-sm text-slate-500">
                        <Loader2 size={18} className="animate-spin text-indigo-500" />
                        Loading placements…
                      </div>
                    ) : jobPlacements.length === 0 ? (
                      <div className="p-8 text-center">
                        <UserCheck size={32} className="mx-auto text-slate-300 mb-3" />
                        <p className="text-sm text-slate-500">No placements yet for this job.</p>
                      </div>
                    ) : (
                      <div className={DRAWER_LIST_SHELL}>
                        {jobPlacements.map((placement) => {
                          const joinedDate =
                            placement.actualJoiningDate ||
                            placement.joiningDate ||
                            placement.offerDate ||
                            placement.createdAt;
                          const statusLabel = formatPlacementStatusLabel(placement.status);
                          const isJoined = placement.status === 'JOINED';
                          return (
                            <div
                              key={placement.id}
                              className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-indigo-50/50"
                            >
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 ring-2 ring-white shadow-sm shadow-emerald-500/10">
                                <UserCheck size={16} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-slate-900">{candidateNameFromPlacement(placement)}</p>
                                <p className="text-[11px] text-slate-500">
                                  {joinedDate ? formatDateDMY(joinedDate) : '—'} · {placement.job?.title || job.title}
                                </p>
                              </div>
                              <span
                                className={`text-[11px] font-medium px-2 py-0.5 rounded ${
                                  isJoined ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {statusLabel}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                </DrawerSectionCard>
              )}
              {activeTab === 'activity' && (() => {
                const ACTIVITY_TIMELINE_FILTERS: Array<'All' | 'Jobs' | 'Candidates' | 'Interviews' | 'Notes' | 'Files'> = ['All', 'Jobs', 'Candidates', 'Interviews', 'Notes', 'Files'];
                
                const activities = jobActivities.filter(
                  (a) => activityFilter === 'All' || a.action.toLowerCase().includes(activityFilter.toLowerCase())
                );
                
                // Sort activities by timestamp (newest first)
                const sortedActivities = [...activities].sort((a, b) => {
                  const dateA = new Date(a.createdAt).getTime();
                  const dateB = new Date(b.createdAt).getTime();
                  return dateB - dateA;
                });
                
                const CategoryIcon = ({ category }: { category: string }) => {
                  const catLower = category.toLowerCase();
                  if (catLower.includes('job')) return <Briefcase size={16} className="text-blue-600" />;
                  if (catLower.includes('candidate')) return <User size={16} className="text-emerald-600" />;
                  if (catLower.includes('interview')) return <Calendar size={16} className="text-amber-600" />;
                  if (catLower.includes('note')) return <StickyNote size={16} className="text-slate-600" />;
                  if (catLower.includes('file')) return <Paperclip size={16} className="text-slate-600" />;
                  return <Activity size={16} className="text-slate-500" />;
                };
                
                return (
                  <div className="space-y-5">
                    <EntityAuditSummary
                      audit={job?.auditMeta ?? extractAuditMeta(job as Record<string, unknown> | undefined)}
                    />
                    <DrawerSectionCard
                      title="Activity Filters"
                      subtitle="Filter timeline by category"
                      icon={Activity}
                      accent="indigo"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        {ACTIVITY_TIMELINE_FILTERS.map((f) => (
                          <button
                            key={f}
                            type="button"
                            onClick={() => setActivityFilter(f)}
                            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${activityFilter === f ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                          >
                            {f}
                          </button>
                        ))}
                      </div>
                    </DrawerSectionCard>
                    <DrawerSectionCard
                      title="Activity Timeline"
                      subtitle={`${sortedActivities.length} events`}
                      icon={Activity}
                      accent="blue"
                    >
                      <div className="max-h-[420px] overflow-y-auto">
                        {loadingActivities ? (
                          <div className="py-8 text-center">
                            <p className="text-sm text-slate-500">Loading activities...</p>
                          </div>
                        ) : sortedActivities.length === 0 ? (
                          <div className="py-8 text-center">
                            <Activity size={24} className="mx-auto text-slate-300 mb-2" />
                            <p className="text-sm text-slate-500">No activity for this filter.</p>
                          </div>
                        ) : (
                          <div className="relative border-l-2 border-slate-200 pl-6 space-y-0">
                            {sortedActivities.map((item: BackendActivity, idx: number) => {
                              const prevItem = idx > 0 ? sortedActivities[idx - 1] : null;
                              const currentDate = new Date(item.createdAt).toDateString();
                              const prevDate = prevItem ? new Date(prevItem.createdAt).toDateString() : '';
                              const showDateSeparator = idx === 0 || currentDate !== prevDate;
                              
                              const date = new Date(item.createdAt);
                              const now = new Date();
                              const isToday = date.toDateString() === now.toDateString();
                              const isYesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toDateString() === date.toDateString();
                              
                              let dateLabel = '';
                              if (isToday) dateLabel = 'Today';
                              else if (isYesterday) dateLabel = 'Yesterday';
                              else {
                                dateLabel = formatDateDMY(date);
                              }

                              const timeLabel = formatTime12hEnGb(date);
                              
                              return (
                                <div key={item.id}>
                                  {showDateSeparator && idx > 0 && (
                                    <div className="my-4 border-t border-slate-200"></div>
                                  )}
                                  {showDateSeparator && (
                                    <div className="mb-3 -ml-6">
                                      <span className="inline-block px-3 py-1 bg-slate-100 text-slate-600 text-xs font-semibold rounded-full">
                                        {dateLabel}
                                      </span>
                                    </div>
                                  )}
                                  <div className="relative pb-6 last:pb-0">
                                    {/* Timeline dot + icon */}
                                    <div className="absolute -left-[1.625rem] top-0 w-8 h-8 rounded-full border-2 border-white shadow-sm flex items-center justify-center bg-slate-100">
                                      <CategoryIcon category={item.action} />
                                    </div>
                                    {/* Event card */}
                                    <div className="bg-slate-50/80 rounded-xl border border-slate-200 p-3 hover:border-slate-300 transition-colors">
                                      <p className="text-sm font-semibold text-slate-900">{item.action}</p>
                                      {item.description && <p className="text-xs text-slate-600 mt-1">{item.description}</p>}
                                      <div className="flex items-center justify-between gap-2 mt-2 flex-wrap">
                                        <div className="flex items-center gap-2 min-w-0">
                                          {item.user?.avatar ? (
                                            <ImageWithFallback src={item.user.avatar} alt={item.user.name} className="w-6 h-6 rounded-full border border-slate-200 shrink-0" />
                                          ) : (
                                            <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center shrink-0"><User size={12} className="text-slate-500" /></div>
                                          )}
                                          <span className="text-xs font-medium text-slate-700 truncate">{item.user?.name || 'System'}</span>
                                        </div>
                                        <span className="text-[11px] text-slate-500 shrink-0">{timeLabel}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </DrawerSectionCard>
                  </div>
                );
              })()}
              {activeTab === 'notes' ? (
                job?.id ? (
                  <DrawerSectionCard
                    title="Notes"
                    subtitle="Calls, WhatsApp, and email notes for this job"
                    icon={StickyNote}
                    accent="rose"
                  >
                    <NotesService
                      entityType="job"
                      entityId={job.id}
                      availableTags={['Calls', 'WhatsApp', 'Emails']}
                      onNoteCreated={() => {
                        // Optionally refresh job data or show notification
                      }}
                      onNoteUpdated={() => {
                        // Optionally refresh job data or show notification
                      }}
                      onNoteDeleted={() => {
                        // Optionally refresh job data or show notification
                      }}
                    />
                  </DrawerSectionCard>
                ) : (
                  <div className="py-8 text-center text-sm text-slate-500">
                    No job selected
                  </div>
                )
              ) : null}
              {activeTab === 'files' && (() => {
                const JOB_FILE_TYPE_OPTIONS: (JobFileType | 'All')[] = ['All', 'JD', 'Contract', 'Offer Letter', 'Policy', 'Resume', 'Other'];
                const allFiles = jobFiles;
                const filteredFiles = filesTypeFilter === 'All' ? allFiles : allFiles.filter((f) => f.fileType === filesTypeFilter);
                const uploadsBase = (typeof window !== 'undefined' ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1') : 'http://localhost:5001/api/v1').replace(/\/api\/v1\/?$/, '');
                const toFileHref = (fileUrl?: string | null) => buildFileHref(fileUrl, uploadsBase);
                const FileTypeIcon = ({ type }: { type: string }) => {
                  switch (type) {
                    case 'JD': return <Briefcase size={14} className="text-indigo-600 shrink-0" />;
                    case 'Contract': return <FileText size={14} className="text-blue-600 shrink-0" />;
                    case 'Offer Letter': return <FileCheck size={14} className="text-emerald-600 shrink-0" />;
                    case 'Policy': return <FileText size={14} className="text-amber-600 shrink-0" />;
                    case 'Resume': return <FileText size={14} className="text-slate-600 shrink-0" />;
                    case 'Other': return <Paperclip size={14} className="text-slate-500 shrink-0" />;
                    default: return <Paperclip size={14} className="text-slate-500 shrink-0" />;
                  }
                };
                const formatUploadDate = (d: string) => {
                  if (!d) return '—';
                  try {
                    return formatDateDMY(d) || d;
                  } catch {
                    return d;
                  }
                };
                return (
                  <DrawerSectionCard
                    title="Files"
                    subtitle={`${filesLoading ? 'Loading…' : `${filteredFiles.length} files`}`}
                    icon={Paperclip}
                    accent="indigo"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <DocumentUploadButton
                        disabled={!job?.id}
                        isUploading={filesUploading}
                        uploadSuccess={filesUploadSuccess}
                        uploadPercent={filesUploadPercent}
                        label="Upload File"
                        onFilesSelected={async (files) => {
                          await uploadFile(files[0], 'JD');
                        }}
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        {JOB_FILE_TYPE_OPTIONS.map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => setFilesTypeFilter(type)}
                            className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${filesTypeFilter === type ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>
                    {filesError && <p className="text-sm text-red-600">{filesError}</p>}
                    <div className={DRAWER_TABLE_SHELL}>
                      <div className={DRAWER_TABLE_SCROLL}>
                        <table className="w-full min-w-[640px] border-collapse text-left">
                          <thead>
                            <tr className={DRAWER_TABLE_HEAD_ROW}>
                              <th className={`${DRAWER_TABLE_TH} first:pl-4 sm:first:pl-5`}>File name</th>
                              <th className={DRAWER_TABLE_TH}>Type</th>
                              <th className={DRAWER_TABLE_TH}>Uploaded by</th>
                              <th className={DRAWER_TABLE_TH}>Upload date</th>
                              <th className={`${DRAWER_TABLE_TH} w-32 text-right sm:pr-5`}>Actions</th>
                            </tr>
                          </thead>
                          <tbody className={DRAWER_TABLE_BODY}>
                            {filesLoading && filteredFiles.length === 0 ? (
                              <tr>
                                <td colSpan={5} className={`${DRAWER_TABLE_TD} py-12 text-center text-sm text-slate-500`}>
                                  Loading files…
                                </td>
                              </tr>
                            ) : filteredFiles.length === 0 ? (
                              <tr>
                                <td colSpan={5} className={`${DRAWER_TABLE_TD} py-12 text-center text-sm text-slate-500`}>
                                  No files for this type.
                                </td>
                              </tr>
                            ) : (
                              filteredFiles.map((file) => (
                                <tr key={file.id} className={DRAWER_TABLE_TR}>
                                  <td className={`${DRAWER_TABLE_TD} first:pl-4 sm:first:pl-5`}>
                                    <p className="max-w-[200px] truncate text-sm font-semibold text-slate-900">
                                      {file.fileName}
                                    </p>
                                  </td>
                                  <td className={DRAWER_TABLE_TD}>
                                    <span
                                      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold shadow-sm ${JOB_FILE_TYPE_BADGE_STYLES[file.fileType as JobFileType] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}
                                    >
                                      <FileTypeIcon type={file.fileType} />
                                      {file.fileType}
                                    </span>
                                  </td>
                                  <td className={DRAWER_TABLE_TD}>
                                    <div className="flex min-w-0 items-center gap-2">
                                      {file.uploadedBy?.avatar ? (
                                        <ImageWithFallback
                                          src={file.uploadedBy.avatar}
                                          alt={file.uploadedBy.name}
                                          className="h-6 w-6 shrink-0 rounded-full border border-indigo-100 shadow-sm"
                                        />
                                      ) : (
                                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-50 ring-1 ring-indigo-100">
                                          <User size={12} className="text-indigo-500" />
                                        </div>
                                      )}
                                      <span className="truncate text-sm text-slate-600">
                                        {file.uploadedBy?.name ?? '—'}
                                      </span>
                                    </div>
                                  </td>
                                  <td className={`${DRAWER_TABLE_TD} text-sm text-slate-600`}>
                                    {formatUploadDate(file.uploadDate)}
                                  </td>
                                  <td className={`${DRAWER_TABLE_TD} text-right sm:pr-5`}>
                                    <div className="flex items-center justify-end">
                                      <div className={DRAWER_TABLE_ACTIONS}>
                                        {file.fileUrl ? (
                                          <a
                                            href={toFileHref(file.fileUrl)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex h-8 w-8 items-center justify-center rounded-xl text-indigo-600 transition-all hover:bg-white hover:text-indigo-800 hover:shadow-sm"
                                            title="Download"
                                          >
                                            <Download size={14} />
                                          </a>
                                        ) : null}
                                        {file.fileUrl ? (
                                          <a
                                            href={toFileHref(file.fileUrl)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex h-8 w-8 items-center justify-center rounded-xl text-emerald-600 transition-all hover:bg-white hover:text-emerald-800 hover:shadow-sm"
                                            title="Preview"
                                          >
                                            <Eye size={14} />
                                          </a>
                                        ) : null}
                                        <button
                                          type="button"
                                          onClick={() => deleteFile(file.id)}
                                          className="flex h-8 w-8 items-center justify-center rounded-xl text-rose-500 transition-all hover:bg-white hover:text-rose-700 hover:shadow-sm"
                                          title="Delete"
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </DrawerSectionCard>
                );
              })()}
              {activeTab === 'chat' && job ? (
                <DrawerSectionCard
                  title="Chat"
                  subtitle={`Messages for ${job.title}`}
                  icon={MessageSquare}
                  accent="blue"
                >
                  <DrawerEntityChatTab
                    entityType="JOB"
                    entityId={job.id}
                    entityLabel={job.title}
                    isActive={activeTab === 'chat'}
                    isOpen={isOpen}
                  />
                </DrawerSectionCard>
              ) : null}
              </div>
            </div>
            )}

          </>
        ) : (
          <div className="flex-1 flex items-center justify-center p-8 text-slate-500 text-sm">
            Select a job to view details.
          </div>
        )}
      </DetailsModalShell>
      ) : null}
    </AnimatePresence>

    <AddToPipelineModal
      isOpen={moveStageModalOpen}
      candidate={moveStageCandidate}
      jobs={pipelineJobOptions}
      recruiters={pipelineRecruiters}
      initialJobId={job?.id ?? null}
      lockJobToInitial
      onClose={() => {
        setMoveStageModalOpen(false);
        setMoveStageCandidate(null);
      }}
      onSubmit={
        onAddToPipeline
          ? async (payload) => {
              await onAddToPipeline(payload);
              await refreshAppliedJobCandidates({ runPipeline: false, refresh: true });
              setMoveStageModalOpen(false);
              setMoveStageCandidate(null);
            }
          : undefined
      }
      onRemoveFromPipeline={
        onRemoveFromPipeline
          ? async (payload) => {
              await onRemoveFromPipeline(payload);
              await refreshAppliedJobCandidates({ runPipeline: false, refresh: true });
              setMoveStageModalOpen(false);
              setMoveStageCandidate(null);
            }
          : undefined
      }
      onRequestSubmitToClient={
        job?.id
          ? ({ candidateId, jobId }) => {
              const source = displayJobCandidates.find((c) => c.id === candidateId);
              if (!source) return;
              // Keep Move stage open so Cancel on Submit to client returns here.
              setSubmitClientRowId(candidateId);
              openFromJobDrawerRow(source, jobId, job.title, job.clientId);
            }
          : undefined
      }
      onRequestScheduleInterview={
        onScheduleInterview
          ? ({ candidateId, jobId, stage, stageId }) => {
              // Keep Move stage open so Cancel on Schedule Interview returns here.
              onScheduleInterview(candidateId, jobId, {
                stageId: stageId || '',
                stageName: stage,
              });
            }
          : undefined
      }
      onRequestOfferPlacement={
        onCreatePlacement
          ? ({ candidateId, jobId, stage, stageId }) => {
              // Keep Move stage open so Cancel on Placement returns here.
              onCreatePlacement(candidateId, jobId, {
                stageId: stageId || '',
                stageName: stage,
              });
            }
          : undefined
      }
    />

    {scheduleCandidatePickerOpen ? (
      <DetailsModalShell
        size="md"
        zIndexClass="z-[120]"
        panelClassName="!h-auto max-h-[min(85vh,720px)]"
        onBackdropClick={() => setScheduleCandidatePickerOpen(false)}
        dialogTitleId="schedule-interview-candidate-picker-title"
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex items-start justify-between gap-3 border-b border-violet-100 px-5 py-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-600">
                Schedule Interview
              </p>
              <h2
                id="schedule-interview-candidate-picker-title"
                className="mt-1 text-lg font-bold text-slate-900"
              >
                Choose candidate
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Select who is assigned to {job?.title || 'this job'}, then continue to schedule.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setScheduleCandidatePickerOpen(false)}
              className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
          <div className="border-b border-slate-100 px-5 py-3">
            <div className="relative">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={schedulePickerSearch}
                onChange={(event) => setSchedulePickerSearch(event.target.value)}
                placeholder="Search candidate name…"
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-violet-300 focus:bg-white focus:ring-2 focus:ring-violet-500/20"
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
            {schedulePickerCandidates.length === 0 ? (
              <p className="px-2 py-8 text-center text-sm text-slate-500">
                No candidates assigned to this job match this search.
              </p>
            ) : (
              <ul className="space-y-1">
                {schedulePickerCandidates.map((row) => {
                  const checked = schedulePickerSelectedIds.includes(row.id);
                  return (
                    <li key={row.id}>
                      <label
                        className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition ${
                          checked ? 'bg-violet-50 ring-1 ring-violet-200' : 'hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setSchedulePickerSelectedIds((prev) =>
                              prev.includes(row.id)
                                ? prev.filter((id) => id !== row.id)
                                : [...prev, row.id],
                            )
                          }
                          className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                        />
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">
                          {(row.candidateName || 'C')
                            .split(/\s+/)
                            .map((part) => part[0])
                            .filter(Boolean)
                            .slice(0, 2)
                            .join('')
                            .toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-slate-900">
                            {row.candidateName || 'Unnamed candidate'}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-slate-500">
                            {[row.currentStage, row.email].filter(Boolean).join(' · ') ||
                              'Job candidate'}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/80 px-5 py-3">
            <p className="text-xs text-slate-500">
              {schedulePickerSelectedIds.length
                ? `${schedulePickerSelectedIds.length} selected`
                : 'Select one or more candidates'}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setScheduleCandidatePickerOpen(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmScheduleInterviewCandidatePicker}
                disabled={!schedulePickerSelectedIds.length}
                className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Calendar size={16} />
                Continue
              </button>
            </div>
          </div>
        </div>
      </DetailsModalShell>
    ) : null}

    {submitCandidatePickerOpen ? (
      <DetailsModalShell
        size="md"
        zIndexClass="z-[120]"
        panelClassName="!h-auto max-h-[min(85vh,720px)]"
        onBackdropClick={() => {
          setSubmitCandidatePickerOpen(false);
          setPickerScopeIds(null);
        }}
        dialogTitleId="submit-candidate-picker-title"
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex items-start justify-between gap-3 border-b border-indigo-100 px-5 py-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-600">
                Submit to Client
              </p>
              <h2 id="submit-candidate-picker-title" className="mt-1 text-lg font-bold text-slate-900">
                Choose candidate
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {pickerScopeIds?.length
                  ? `Review CV choice for the ${pickerScopeIds.length} selected candidate${pickerScopeIds.length === 1 ? '' : 's'}, then continue.`
                  : `Select who to submit for ${job?.title || 'this job'}, then choose a CV version (v1, v2, …) or HRYantra CV for each.`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSubmitCandidatePickerOpen(false);
                setPickerScopeIds(null);
              }}
              className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
          <div className="border-b border-slate-100 px-5 py-3">
            <div className="relative">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={pickerSearch}
                onChange={(event) => setPickerSearch(event.target.value)}
                placeholder="Search candidate name…"
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
            {pickerCvMetaLoading ? (
              <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-slate-500">
                <Loader2 size={12} className="animate-spin" />
                Loading CV options…
              </p>
            ) : (
              <p className="mt-2 text-[11px] text-slate-500">
                Choose a resume version (<strong>v1 · original</strong>, <strong>v2</strong>, …) or{' '}
                <strong>HRYantra CV</strong>. Use View / Preview to open the file; Edit opens the
                HRYantra editor.
              </p>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
            {pickerCandidates.length === 0 ? (
              <p className="px-2 py-8 text-center text-sm text-slate-500">
                No candidates match this search.
              </p>
            ) : (
              <ul className="space-y-1">
                {pickerCandidates.map((row) => {
                  const checked = pickerSelectedIds.includes(row.id);
                  const meta = pickerCvMetaById[row.id];
                  const mode = pickerCvModeById[row.id];
                  const hasOriginal = meta?.hasOriginal;
                  const hasSaasa = meta?.hasSaasa;
                  const resumeVersions = meta?.resumeVersions || [];
                  const selectedResumeId =
                    pickerResumeFileIdById[row.id] ||
                    resumeVersions.find((v) => v.isPrimary)?.id ||
                    resumeVersions[0]?.id ||
                    '';
                  const selectedVersion =
                    resumeVersions.find((v) => v.id === selectedResumeId) ||
                    resumeVersions[0] ||
                    null;
                  return (
                    <li key={row.id}>
                      <div
                        className={`rounded-xl px-3 py-2.5 transition ${
                          checked ? 'bg-indigo-50 ring-1 ring-indigo-200' : 'hover:bg-slate-50'
                        }`}
                      >
                        <label className="flex cursor-pointer items-center gap-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                              setPickerSelectedIds((prev) => {
                                if (prev.includes(row.id)) {
                                  return prev.filter((id) => id !== row.id);
                                }
                                ensurePickerCvMeta(row.id);
                                return [...prev, row.id];
                              })
                          }
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                          {(row.candidateName || 'C')
                            .split(/\s+/)
                            .map((part) => part[0])
                            .filter(Boolean)
                            .slice(0, 2)
                            .join('')
                            .toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-slate-900">
                            {row.candidateName || 'Unnamed candidate'}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-slate-500">
                              {[row.currentStage, row.email].filter(Boolean).join(' · ') ||
                                'Job candidate'}
                          </span>
                        </span>
                      </label>
                        {checked ? (
                          <div
                            className="mt-2 ml-7 flex flex-col gap-2"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                CV
                              </span>
                              {!meta ? (
                                <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
                                  <Loader2 size={12} className="animate-spin" />
                                  Loading CV options…
                                </span>
                              ) : null}
                              {resumeVersions.length > 0
                                ? resumeVersions.map((version, index) => {
                                    const active =
                                      mode === 'original' && version.id === selectedResumeId;
                                    const label =
                                      index === 0 ? `v${index + 1} · original` : `v${index + 1}`;
                                    return (
                                      <button
                                        key={version.id}
                                        type="button"
                                        title={version.fileName}
                                        onClick={() => {
                                          setPickerCvModeById((prev) => ({
                                            ...prev,
                                            [row.id]: 'original',
                                          }));
                                          setPickerResumeFileIdById((prev) => ({
                                            ...prev,
                                            [row.id]: version.id,
                                          }));
                                        }}
                                        className={`rounded-lg border px-2 py-1 text-[11px] font-semibold transition ${
                                          active
                                            ? 'border-indigo-500 bg-indigo-600 text-white'
                                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                        }`}
                                      >
                                        {label}
                                      </button>
                                    );
                                  })
                                : null}
                              {!resumeVersions.length && hasOriginal ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPickerCvModeById((prev) => ({
                                      ...prev,
                                      [row.id]: 'original',
                                    }))
                                  }
                                  className={`rounded-lg border px-2 py-1 text-[11px] font-semibold transition ${
                                    mode === 'original'
                                      ? 'border-indigo-500 bg-indigo-600 text-white'
                                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                  }`}
                                >
                                  Original CV
                                </button>
                              ) : null}
                              {hasOriginal || hasSaasa ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (hasSaasa) {
                                      setPickerCvModeById((prev) => ({
                                        ...prev,
                                        [row.id]: 'saasa',
                                      }));
                                      return;
                                    }
                                    void openPickerUpdatedCvEditor(
                                      row.id,
                                      row.candidateName || 'Candidate',
                                    );
                                  }}
                                  className={`rounded-lg border px-2 py-1 text-[11px] font-semibold transition ${
                                    mode === 'saasa'
                                      ? 'border-amber-500 bg-amber-500 text-white'
                                      : 'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100'
                                  }`}
                                >
                                  {pickerSaasaCv.busy && pickerSaasaTarget?.id === row.id
                                    ? 'Saving…'
                                    : 'HRYantra CV'}
                                </button>
                              ) : null}
                              {meta && !hasOriginal && !hasSaasa ? (
                                <span className="text-[11px] text-rose-600">
                                  No CV on file — add a resume first
                                </span>
                              ) : null}
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {mode === 'original' && selectedVersion?.fileUrl ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPickerResumePreview({
                                      url: selectedVersion.fileUrl,
                                      name: `${row.candidateName || 'Candidate'} — ${
                                        resumeVersions.findIndex((v) => v.id === selectedVersion.id) ===
                                        0
                                          ? 'v1 · original'
                                          : selectedVersion.fileName || 'Resume'
                                      }`,
                                    })
                                  }
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50"
                                >
                                  <Eye size={12} />
                                  View selected
                                </button>
                              ) : null}
                              {mode !== 'original' && hasOriginal && meta?.originalUrl ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPickerResumePreview({
                                      url: meta.originalUrl!,
                                      name: `${row.candidateName || 'Candidate'} — Original CV`,
                                    })
                                  }
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50"
                                >
                                  <Eye size={12} />
                                  View original
                                </button>
                              ) : null}
                              {hasSaasa && meta?.saasaUrl ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPickerResumePreview({
                                      url: meta.saasaUrl!,
                                      name: `${row.candidateName || 'Candidate'} — HRYantra CV`,
                                    })
                                  }
                                  className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-900 transition hover:bg-amber-100"
                                >
                                  <Eye size={12} />
                                  Preview HRYantra
                                </button>
                              ) : null}
                              {hasOriginal ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    void openPickerUpdatedCvEditor(
                                      row.id,
                                      row.candidateName || 'Candidate',
                                    )
                                  }
                                  className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2 py-1 text-[11px] font-semibold text-sky-900 transition hover:bg-sky-100"
                                >
                                  <SquarePen size={12} />
                                  Edit HRYantra
                                </button>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
            <p className="text-xs font-medium text-slate-500">
              {pickerSelectedIds.length} selected
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSubmitCandidatePickerOpen(false);
                  setPickerScopeIds(null);
                }}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmSubmitCandidatePicker}
                disabled={pickerSelectedIds.length === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send size={15} strokeWidth={2.25} />
                Continue
              </button>
            </div>
          </div>
        </div>
      </DetailsModalShell>
    ) : null}

    {submitToClientModal}
    {pickerSaasaCv.modals}
    <ResumePreviewModal
      isOpen={Boolean(pickerResumePreview?.url)}
      onClose={() => setPickerResumePreview(null)}
      resumeUrl={pickerResumePreview?.url || null}
      candidateName={pickerResumePreview?.name || 'Candidate'}
    />
    <InterviewDetailHost
      interviewItem={selectedJobInterview}
      isOpen={jobInterviewDetailOpen}
      onClose={() => {
        setJobInterviewDetailOpen(false);
        setSelectedJobInterview(null);
      }}
      onChanged={refreshJobInterviews}
      zIndexClass="z-[120]"
    />
    </>
  );
}

