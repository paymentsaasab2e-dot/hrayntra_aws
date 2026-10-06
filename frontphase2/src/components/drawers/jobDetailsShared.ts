// Shared helpers extracted from JobDetailsDrawer.tsx
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
  apiParseCandidateResumeQueued,
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
import { OverviewTab } from './tabs/Overview';
import { FilesTab } from './tabs/Files';
import CandidatesTab from './tabs/Candidates';
import { ClientTab } from './tabs/Client';
import { PipelineTab } from './tabs/Pipeline';
import { AnalyticsTab } from './tabs/Analytics';
import { AssignmentTab } from './tabs/Assignment';
import { InterviewsTab } from './tabs/Interviews';
import { PlacementsTab } from './tabs/Placements';
import { ActivityTab } from './tabs/Activity';
import { NotesTab } from './tabs/Notes';
import { ChatTab } from './tabs/Chat';
import { useJobCandidatesTab } from '../../hooks/useJobCandidatesTab';
import type { JobNoteTag } from './jobDetailsTypes';
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
import { formatJobSalaryDisplay } from '../../constants/jobSalary';
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

export function formatJobSalaryRange(job: {
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

export const MAX_JOB_CV_FILE_BYTES = 25 * 1024 * 1024;

export function identityFromParsedCv(parsed: ImportedProfileData, file: File) {
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

export function payloadFromParsedJobCv(
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
  clientName?: string;
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
  languages?: Array<{ language?: string; proficiency?: string }>;
  publicFieldVisibility?: Record<string, boolean> | null;
  createdAt?: string;
  updatedAt?: string;
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

export function currentUserAsBackendUser(): BackendUser | null {
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

export function withCurrentUserFirst(users: BackendUser[], currentUserId: string): BackendUser[] {
  if (!currentUserId) return users;
  const self = users.find((user) => user.id === currentUserId);
  if (!self) return users;
  return [self, ...users.filter((user) => user.id !== currentUserId)];
}

export function unwrapApiList<T>(payload: unknown): T[] {
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

export function formatInterviewListStatus(status: string): string {
  const normalized = String(status || '').trim().toUpperCase();
  if (normalized === 'COMPLETED') return 'Completed';
  if (normalized === 'CANCELLED' || normalized === 'CANCELED') return 'Cancelled';
  if (normalized === 'NO_SHOW') return 'No show';
  if (normalized === 'RESCHEDULED') return 'Rescheduled';
  return 'Scheduled';
}

export function interviewListStatusBadgeClass(statusLabel: string): string {
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

export function formatInterviewTypeLabel(item: BackendInterviewListItem): string {
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

export function panelNamesFromInterview(item: BackendInterviewListItem): string {
  const names = (item.panel || [])
    .map((member) => String(member.user?.name || '').trim())
    .filter(Boolean);
  return names.length ? names.join(', ') : '—';
}

export function formatPlacementStatusLabel(status: string): string {
  return String(status || '')
    .trim()
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function candidateNameFromInterview(item: BackendInterviewListItem): string {
  return `${item.candidate?.firstName || ''} ${item.candidate?.lastName || ''}`.trim() || 'Candidate';
}

export function candidateNameFromPlacement(item: Placement): string {
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

export interface JobPipelineStage {
  id: string;
  name: string;
  sla?: string;
  /** Backend lifecycle bucket (APPLIED, INTERVIEW, …) for standalone tenant pipeline sync */
  systemRole?: string | null;
}

export const DEFAULT_PIPELINE_STAGE_NAMES = ['Apply', 'Interview', 'Reject', 'Placed'] as const;

export const DEFAULT_PIPELINE_STAGE_IDS: Record<(typeof DEFAULT_PIPELINE_STAGE_NAMES)[number], string> = {
  Apply: 'default-apply-stage',
  Interview: 'default-interview-stage',
  Reject: 'default-reject-stage',
  Placed: 'default-placed-stage',
};

export const DEFAULT_PIPELINE_STAGE_ID_SET = new Set(Object.values(DEFAULT_PIPELINE_STAGE_IDS));

export const PIPELINE_SYSTEM_ROLE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Auto / unset' },
  { value: 'APPLIED', label: 'Applied' },
  { value: 'SCREENING', label: 'Screening' },
  { value: 'INTERVIEW', label: 'Interview' },
  { value: 'OFFER', label: 'Offer' },
  { value: 'HIRED', label: 'Hired' },
  { value: 'REJECTED', label: 'Rejected' },
];

export const getDefaultPipelineStageNameById = (id: string): (typeof DEFAULT_PIPELINE_STAGE_NAMES)[number] | null => {
  const found = DEFAULT_PIPELINE_STAGE_NAMES.find((defaultName) => DEFAULT_PIPELINE_STAGE_IDS[defaultName] === id);
  return found ?? null;
};

export const getDefaultPipelineStageName = (name: string): (typeof DEFAULT_PIPELINE_STAGE_NAMES)[number] | null => {
  const trimmed = String(name || '').trim().toLowerCase();
  const found = DEFAULT_PIPELINE_STAGE_NAMES.find((defaultName) => defaultName.toLowerCase() === trimmed);
  return found ?? null;
};

export const normalizeStageLabel = (value: string) =>
  String(value || '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const canonicalStageLabel = (value: string) => {
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

export type PipelineStageMatchMeta = {
  id: string;
  rawName: string;
  normalized: string;
  canonical: string;
};

export function buildPipelineStageMatchMeta(stages: JobPipelineStage[]): PipelineStageMatchMeta[] {
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

export function resolveCandidateStageId(
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

export function normalizePipelineStages(stages?: JobPipelineStage[] | null): JobPipelineStage[] {
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

export type PickerResumeVersion = {
  id: string;
  fileUrl: string;
  fileName: string;
  isPrimary?: boolean;
};

export type PickerCvMeta = {
  hasOriginal: boolean;
  hasSaasa: boolean;
  hasEdited: boolean;
  originalUrl: string | null;
  saasaUrl: string | null;
  resumeVersions: PickerResumeVersion[];
};

export function normalizePickerResumeUrl(url: string): string {
  const raw = String(url || '').trim();
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    return `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, '').toLowerCase();
  } catch {
    return raw.split('?')[0]?.replace(/\/+$/, '').toLowerCase() || '';
  }
}

export function isPickerResumeFile(file: {
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

export function isRealResumeFileId(id: string): boolean {
  return /^[a-f\d]{24}$/i.test(String(id || '').trim());
}

export function buildPickerResumeVersions(
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

export function buildPickerCvMeta(
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

export function mapJobCandidateToTableRow(
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

export function matchCandidateToJobTableRow(
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

export const STATUS_STYLES: Record<string, string> = {
  Draft: 'bg-slate-100 text-slate-700 border-slate-200',
  Active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'On Hold': 'bg-amber-100 text-amber-700 border-amber-200',
  Closed: 'bg-gray-100 text-gray-600 border-gray-200',
  'Closed Won': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  'Closed not Won': 'bg-gray-100 text-gray-700 border-gray-200',
  Duplicate: 'bg-rose-50 text-rose-700 border-rose-200',
};

export function statusStyleFor(status: string): string {
  return STATUS_STYLES[status] || jobStatusPillClass(status);
}

