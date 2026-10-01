'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import type {
  JobCandidateItem,
  JobForDrawer,
  JobPipelineStage,
} from '../components/drawers/JobDetailsDrawer';
import type { Candidate as JobDrawerTableCandidate } from '../app/candidate/components/CandidateTable';
import {
  AI_SCORE_TIERS,
  computeAiTierStats,
  displayMatchBand,
  type MatchCandidate,
} from '../components/matches/types';
import {
  apiCreateCandidateFromDrawer,
  apiCreateMatch,
  apiDeleteCandidate,
  apiGetMatches,
  apiGetPipelineStages,
  apiMoveCandidateStage,
  apiParseCandidateResumeQueued,
  apiAddCandidateToPipeline,
  apiRemoveCandidateFromPipeline,
  apiToggleSavedMatch,
  apiUploadCandidateResumeFile,
  type AddCandidatePayload,
  type ImportedProfileData,
} from '../lib/api';
import { ApiRequestError } from '../lib/apiNetworkErrors';
import { orEmpty } from '../lib/asyncLoadGuard';
import { BULK_CV_ACCEPT_INPUT, BULK_CV_FORMAT_LABEL } from '../lib/bulkCvFileTypes';
import { filterBulkCvFiles } from '../lib/bulkCvCollect';
import { normalizeCandidateEmailInput } from '../lib/candidateEmailValidation';
import { isInterviewPipelineStage, isOfferPipelineStage } from '../lib/candidateSubmitToClient';
import { RECYCLE_BIN_SYNC_EVENT } from '../constants/recycleBin';
import { invalidateEmployerCandidatesCache } from '../lib/employerPageCache';
import {
  loadJobAppliedCandidates,
  parseJobCandidateScore,
  resolveJobCandidateDisplayStage,
  unwrapMatchRows,
} from '../lib/jobAppliedMatches';
import { isValidObjectId } from '../lib/mapCandidateProfile';
import { mapBackendMatch } from '../lib/mapBackendMatch';
import { matchesQuickSearch, buildQuickSearchHaystack } from '../lib/quickSearch';
import { requestConfirm, requestCornerAlert, requestError, requestInfo } from '../lib/appDialog';
import { TABLE_PAGE_SIZE_OPTIONS, type TablePageSize } from '../constants/tablePagination';

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

function normalizeStageLabel(value: string) {
  return String(value || '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function canonicalStageLabel(value: string) {
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
}

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

export interface UseJobCandidatesTabOptions {
  isOpen: boolean;
  job: JobForDrawer | null;
  jobCandidates: JobCandidateItem[];
  pipelineStages: JobPipelineStage[];
  activeTab: string;
  onAddToPipeline?: (payload: {
    candidateId: string;
    jobId: string;
    stage: string;
    recruiterId?: string;
    priority: 'High' | 'Medium' | 'Low';
    notes?: string;
  }) => void | Promise<void>;
  onScheduleInterview?: (
    candidateId: string,
    jobId: string,
    pendingStage?: { stageId: string; stageName: string },
    bulkCandidateIds?: string[],
  ) => void;
  onCreatePlacement?: (
    candidateId: string,
    jobId: string,
    pendingStage?: { stageId: string; stageName: string },
  ) => void;
  onJobCandidatesChange?: (candidates: JobCandidateItem[]) => void;
  onViewCandidateProfile?: (candidate: JobDrawerTableCandidate) => void;
  openSubmit?: (payload: {
    candidateId: string;
    jobId: string;
    candidateName: string;
    jobTitle: string;
    clientId?: string;
    matchScore?: number;
    matchId?: string;
  }) => void;
  setSubmitClientRowId?: (id: string | null) => void;
  mapJobCandidateToTableRow: (
    candidate: JobCandidateItem,
    jobTitle?: string | null,
    jobId?: string | null,
  ) => JobDrawerTableCandidate;
  matchCandidateToJobTableRow: (
    match: MatchCandidate,
    jobTitle?: string | null,
    jobId?: string | null,
  ) => JobDrawerTableCandidate;
}

export type JobCandidateMatchMode = 'applied' | 'ai';
export type UseJobCandidatesTabReturn = ReturnType<typeof useJobCandidatesTab>;

export function useJobCandidatesTab(options: UseJobCandidatesTabOptions) {
  const jobId = options.job?.id;
  const seed = useMemo(() => orEmpty(options.jobCandidates), [options.jobCandidates]);

  const [displayJobCandidates, setDisplayJobCandidates] = useState<JobCandidateItem[]>(seed);
  const displayJobCandidatesRef = useRef<JobCandidateItem[]>(seed);
  displayJobCandidatesRef.current = displayJobCandidates;
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [candidateMatchMode, setCandidateMatchMode] = useState<JobCandidateMatchMode>('applied');
  const [candidatesPage, setCandidatesPage] = useState(1);
  const [candidatesPageSize, setCandidatesPageSize] = useState<TablePageSize>(50);
  const [jobCandidatesSearch, setJobCandidatesSearch] = useState('');
  const [candidatesStageFilterId, setCandidatesStageFilterId] = useState<string>('all');
  const [showMatchScores, setShowMatchScores] = useState(false);

  const [appliedPipelineRunning, setAppliedPipelineRunning] = useState(false);
  const [appliedCandidatesLoading, setAppliedCandidatesLoading] = useState(false);

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
  const [uploadingJobCv, setUploadingJobCv] = useState(false);
  const [jobCvUploadProgress, setJobCvUploadProgress] = useState<{ done: number; total: number } | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [deletingCandidateId, setDeletingCandidateId] = useState<string | null>(null);
  const [removingFromJobCandidateId, setRemovingFromJobCandidateId] = useState<string | null>(null);

  const prevCandidatesTabJobIdRef = useRef<string | null>(null);
  const wasOnCandidatesTabRef = useRef(false);
  const prevAiTabJobIdRef = useRef<string | null>(null);
  const prevOnAiTabRef = useRef(false);

  useEffect(() => {
    setDisplayJobCandidates(seed);
    const hasScores = seed.some((row) => parseJobCandidateScore(row.score) > 0);
    setShowMatchScores(hasScores);
  }, [seed, jobId]);

  useEffect(() => {
    setSelectedCandidateIds([]);
  }, [jobId]);

  useEffect(() => {
    if (!options.isOpen) setSelectedCandidateIds([]);
  }, [options.isOpen]);

  useEffect(() => {
    setJobCandidatesSearch('');
    setCandidatesStageFilterId('all');
  }, [jobId, options.isOpen]);

  useEffect(() => {
    setCandidatesPage(1);
  }, [jobId, candidatesPageSize, jobCandidatesSearch, candidatesStageFilterId]);

  useEffect(() => {
    setCandidateMatchMode('applied');
  }, [jobId, options.isOpen]);

  useEffect(() => {
    setInlineStageOptionsByJobId({});
    setInlineStageOptionsLoadingJobId(null);
    setInlineStageUpdatingCandidateId(null);
  }, [jobId, options.isOpen]);

  useEffect(() => {
    if (!options.isOpen) {
      setAiMatchCandidates([]);
      setAiMatchesError(null);
      setAiMatchSelectedIds([]);
      setAiSavedMatches([]);
      setAiExpandedAnalysis(null);
      prevAiTabJobIdRef.current = null;
      prevOnAiTabRef.current = false;
      setCandidateMatchMode('applied');
    }
  }, [options.isOpen]);

  useEffect(() => {
    setAiMatchCandidates([]);
    setAiMatchesError(null);
    setAiMatchSelectedIds([]);
    setAiSavedMatches([]);
    setAiExpandedAnalysis(null);
    prevAiTabJobIdRef.current = null;
    prevOnAiTabRef.current = false;
    setCandidateMatchMode('applied');
  }, [jobId]);

  const recruiterFallbackForJob = useMemo(
    () =>
      (options.job as { assignedTo?: { name?: string }; recruiter?: string })?.assignedTo?.name ||
      options.job?.recruiter ||
      'Unassigned',
    [options.job],
  );

  const candidatesStageMatchMeta = useMemo(
    () => buildPipelineStageMatchMeta(options.pipelineStages),
    [options.pipelineStages],
  );

  const jobTableCandidates = useMemo(
    () => displayJobCandidates.map((row) => options.mapJobCandidateToTableRow(row, options.job?.title, jobId)),
    [displayJobCandidates, jobId, options.job?.title, options.mapJobCandidateToTableRow],
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
  }, [jobTableCandidates, jobCandidatesSearch, candidatesStageFilterId, candidatesStageMatchMeta]);

  const candidatesTotalPages = Math.max(
    1,
    Math.ceil(filteredJobTableCandidates.length / candidatesPageSize),
  );
  const safeCandidatesPage = Math.min(Math.max(candidatesPage, 1), candidatesTotalPages);

  useEffect(() => {
    if (candidatesPage > candidatesTotalPages) {
      setCandidatesPage(candidatesTotalPages);
    }
  }, [candidatesPage, candidatesTotalPages]);

  const pagedJobTableCandidates = useMemo(() => {
    const start = (safeCandidatesPage - 1) * candidatesPageSize;
    return filteredJobTableCandidates.slice(start, start + candidatesPageSize);
  }, [filteredJobTableCandidates, safeCandidatesPage, candidatesPageSize]);

  const stageOptionsFromJobPipeline = useMemo(() => {
    if (!jobId) return {} as Record<string, Array<{ id: string; name: string }>>;
    const mapped = (Array.isArray(options.pipelineStages) ? options.pipelineStages : [])
      .map((stage) => ({
        id: String(stage?.id || '').trim(),
        name: String(stage?.name || '').trim(),
      }))
      .filter((stage) => stage.id && stage.name && isValidObjectId(stage.id));
    return mapped.length ? { [jobId]: mapped } : {};
  }, [jobId, options.pipelineStages]);

  const inlineStageOptionsMerged = useMemo(
    () => ({
      ...stageOptionsFromJobPipeline,
      ...inlineStageOptionsByJobId,
    }),
    [inlineStageOptionsByJobId, stageOptionsFromJobPipeline],
  );

  const pipelineStageCountCards = useMemo(() => {
    const stageList = Array.isArray(options.pipelineStages) ? options.pipelineStages : [];
    const stageMeta = buildPipelineStageMatchMeta(stageList);
    const countsByStageId = new Map<string, number>();

    (Array.isArray(displayJobCandidates) ? displayJobCandidates : []).forEach((candidate) => {
      const stageId = resolveCandidateStageId(String(candidate?.currentStage || ''), stageMeta);
      if (!stageId) return;
      countsByStageId.set(stageId, (countsByStageId.get(stageId) || 0) + 1);
    });

    return stageList.map((stage) => ({
      id: stage.id,
      name: String(stage?.name || '').trim() || 'Untitled',
      count: countsByStageId.get(stage.id) || 0,
    }));
  }, [options.pipelineStages, displayJobCandidates]);

  useEffect(() => {
    if (candidatesStageFilterId === 'all') return;
    const stillExists = pipelineStageCountCards.some((stage) => stage.id === candidatesStageFilterId);
    if (!stillExists) setCandidatesStageFilterId('all');
  }, [candidatesStageFilterId, pipelineStageCountCards]);

  const refreshAppliedJobCandidates = useCallback(
    async (opts?: { runPipeline?: boolean; refresh?: boolean; silent?: boolean; seedOverride?: JobCandidateItem[] }) => {
      if (!jobId) {
        setDisplayJobCandidates([]);
        displayJobCandidatesRef.current = [];
        return [] as JobCandidateItem[];
      }
      const loadingPipeline = Boolean(opts?.runPipeline);
      const isSilent = Boolean(opts?.silent) || displayJobCandidatesRef.current.length > 0;
      if (loadingPipeline) {
        setAppliedPipelineRunning(true);
      } else if (!isSilent) {
        setAppliedCandidatesLoading(true);
      }
      try {
        const activeSeed = opts?.seedOverride || displayJobCandidatesRef.current || seed;
        const merged = await loadJobAppliedCandidates(jobId, {
          runPipeline: opts?.runPipeline,
          refresh: opts?.refresh,
          silent: isSilent,
          pipelineSeed: activeSeed,
          fallbackRecruiter: recruiterFallbackForJob,
        });
        displayJobCandidatesRef.current = merged;
        setDisplayJobCandidates(merged);
        setShowMatchScores(merged.some((row) => parseJobCandidateScore(row.score) > 0));
        options.onJobCandidatesChange?.(merged);
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
    [jobId, seed, options.onJobCandidatesChange, recruiterFallbackForJob],
  );

  const loadInlineStageOptionsForCandidate = useCallback(
    async (candidate: JobDrawerTableCandidate) => {
      const candidateJobId = candidate.pipelineJobId || jobId;
      if (!candidateJobId) return;
      const existing = inlineStageOptionsByJobId[candidateJobId];
      const hasRealIds =
        Array.isArray(existing) &&
        existing.length > 0 &&
        existing.every((stage) => isValidObjectId(String(stage.id || '')));
      if (hasRealIds) return;

      try {
        setInlineStageOptionsLoadingJobId(candidateJobId);
        const response = await apiGetPipelineStages(candidateJobId);
        const payload = response.data;
        const stages = Array.isArray(payload)
          ? payload
          : Array.isArray((payload as { data?: unknown })?.data)
            ? (payload as { data: unknown[] }).data
            : [];

        const mappedStages = (stages as { id?: string; name?: string }[])
          .map((stage) => ({
            id: String(stage.id || ''),
            name: String(stage.name || '').trim(),
          }))
          .filter((stage) => stage.id && stage.name && isValidObjectId(stage.id));

        if (mappedStages.length) {
          setInlineStageOptionsByJobId((prev) => ({ ...prev, [candidateJobId]: mappedStages }));
        }
      } catch (stageError: unknown) {
        const message =
          stageError instanceof Error ? stageError.message : 'Failed to load stages';
        console.error('Failed to load pipeline stages for job candidate row:', stageError);
        toast.error(message);
      } finally {
        setInlineStageOptionsLoadingJobId((prev) => (prev === candidateJobId ? null : prev));
      }
    },
    [inlineStageOptionsByJobId, jobId],
  );

  const handleInlineCandidateStageChange = useCallback(
    async (candidate: JobDrawerTableCandidate, stageId: string) => {
      const candidateJobId = candidate.pipelineJobId || jobId;
      if (!candidateJobId) {
        toast.error('No job found for this candidate');
        return;
      }

      let resolvedStageId = String(stageId || '').trim();
      let nextStageName =
        inlineStageOptionsMerged[candidateJobId]?.find((stage) => stage.id === resolvedStageId)?.name ||
        candidate.stage;

      if (!isValidObjectId(resolvedStageId)) {
        try {
          const response = await apiGetPipelineStages(candidateJobId);
          const payload = response.data;
          const stages = Array.isArray(payload)
            ? payload
            : Array.isArray((payload as { data?: unknown })?.data)
              ? (payload as { data: unknown[] }).data
              : [];
          const mappedStages = (stages as { id?: string; name?: string }[])
            .map((stage) => ({
              id: String(stage.id || ''),
              name: String(stage.name || '').trim(),
            }))
            .filter((stage) => stage.id && stage.name && isValidObjectId(stage.id));
          if (mappedStages.length) {
            setInlineStageOptionsByJobId((prev) => ({ ...prev, [candidateJobId]: mappedStages }));
          }
          const wanted = normalizeStageLabel(nextStageName);
          const match =
            mappedStages.find((stage) => normalizeStageLabel(stage.name) === wanted) ||
            mappedStages.find(
              (stage) => canonicalStageLabel(stage.name) === canonicalStageLabel(nextStageName),
            );
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

      if (isInterviewPipelineStage(nextStageName)) {
        if (options.onScheduleInterview) {
          options.onScheduleInterview(candidate.id, candidateJobId, {
            stageId: resolvedStageId,
            stageName: nextStageName,
          });
        } else {
          toast.error('Schedule Interview is not available');
        }
        return;
      }

      if (isOfferPipelineStage(nextStageName)) {
        if (options.onCreatePlacement) {
          options.onCreatePlacement(candidate.id, candidateJobId, {
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
        await apiMoveCandidateStage(candidateJobId, {
          candidateId: candidate.id,
          stageId: resolvedStageId,
        });

        const nextStage = nextStageName || candidate.stage;
        const currentList = displayJobCandidatesRef.current.length
          ? displayJobCandidatesRef.current
          : displayJobCandidates;
        const updated = currentList.map((item) =>
          item.id === candidate.id
            ? {
                ...item,
                currentStage: nextStage,
                isJobAppliedCandidate:
                  resolveJobCandidateDisplayStage(nextStage) === 'Applied',
              }
            : item,
        );

        displayJobCandidatesRef.current = updated;
        setDisplayJobCandidates(updated);
        options.onJobCandidatesChange?.(updated);

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('jobportal:candidates-changed'));
        }

        await refreshAppliedJobCandidates({
          runPipeline: false,
          refresh: false,
          silent: true,
          seedOverride: updated,
        });
        toast.success(`Stage updated to ${nextStage}`);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to update candidate stage';
        console.error('Failed to update candidate stage from job drawer:', error);
        toast.error(message);
      } finally {
        setInlineStageUpdatingCandidateId((prev) => (prev === candidate.id ? null : prev));
      }
    },
    [inlineStageOptionsMerged, jobId, options.onCreatePlacement, options.onScheduleInterview, options.onJobCandidatesChange, refreshAppliedJobCandidates],
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
          options.onJobCandidatesChange?.(next);
          return next;
        });
        setSelectedCandidateIds((prev) => prev.filter((id) => id !== candidate.id));
        toast.success('Candidate moved to Recycle Bin');
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent(RECYCLE_BIN_SYNC_EVENT));
          window.dispatchEvent(new CustomEvent('jobportal:candidates-changed'));
        }
        await refreshAppliedJobCandidates({ runPipeline: false, refresh: false, silent: true });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to delete candidate';
        toast.error(message);
      } finally {
        setDeletingCandidateId((prev) => (prev === candidate.id ? null : prev));
      }
    },
    [options.onJobCandidatesChange, refreshAppliedJobCandidates],
  );

  const handleRemoveJobCandidate = useCallback(
    async (candidate: JobDrawerTableCandidate) => {
      const candidateJobId = String(jobId || '').trim();
      if (!candidateJobId) {
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
        await apiRemoveCandidateFromPipeline(candidate.id, candidateJobId);
        setDisplayJobCandidates((prev) => {
          const next = prev.filter((row) => row.id !== candidate.id);
          options.onJobCandidatesChange?.(next);
          return next;
        });
        setSelectedCandidateIds((prev) => prev.filter((id) => id !== candidate.id));
        toast.success('Candidate removed from this job');
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('jobportal:candidates-changed'));
        }
        await refreshAppliedJobCandidates({ runPipeline: false, refresh: false, silent: true });
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Failed to remove candidate from job';
        toast.error(message);
      } finally {
        setRemovingFromJobCandidateId((prev) => (prev === candidate.id ? null : prev));
      }
    },
    [jobId, options.onJobCandidatesChange, refreshAppliedJobCandidates],
  );

  const handleJobCvFileSelected = useCallback(
    async (fileList: FileList | File[] | null | undefined) => {
      if (!jobId) return;
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
        const parsedRes = await apiParseCandidateResumeQueued(file);
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
            jobId,
            stage: 'Applied',
            recruiterId: recruiterId || undefined,
            priority: 'Medium' as const,
          };
          if (options.onAddToPipeline) {
            await options.onAddToPipeline(pipelinePayload);
          } else {
            await apiAddCandidateToPipeline(candidateId, {
              jobId,
              stage: 'Applied',
              recruiterId: recruiterId || undefined,
              priority: 'Medium',
            });
          }
          await attachResume(candidateId);
        };

        const payload = payloadFromParsedJobCv(parsed, file, jobId, recruiterId || undefined);
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
        await refreshAppliedJobCandidates({ runPipeline: false, refresh: false, silent: true });

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
    [jobId, options.onAddToPipeline, refreshAppliedJobCandidates],
  );

  useEffect(() => {
    if (!options.isOpen || !jobId) return;
    const onCandidatesChanged = () => {
      void refreshAppliedJobCandidates();
    };
    window.addEventListener('jobportal:candidates-changed', onCandidatesChanged);
    return () => window.removeEventListener('jobportal:candidates-changed', onCandidatesChanged);
  }, [options.isOpen, jobId, refreshAppliedJobCandidates]);

  useEffect(() => {
    if (!options.isOpen || options.activeTab !== 'candidates' || !jobId) {
      if (options.activeTab !== 'candidates') wasOnCandidatesTabRef.current = false;
      return;
    }
    const switchedToCandidatesTab = !wasOnCandidatesTabRef.current;
    const jobChanged = prevCandidatesTabJobIdRef.current !== jobId;
    wasOnCandidatesTabRef.current = true;
    prevCandidatesTabJobIdRef.current = jobId;
    if (switchedToCandidatesTab || jobChanged) {
      void refreshAppliedJobCandidates();
      void loadInlineStageOptionsForCandidate({
        id: '__prefetch__',
        pipelineJobId: jobId,
      } as JobDrawerTableCandidate);
    }
  }, [options.isOpen, options.activeTab, jobId, refreshAppliedJobCandidates, loadInlineStageOptionsForCandidate]);

  const refreshAiMatches = useCallback(
    async (opts?: { runPipeline?: boolean; refresh?: boolean }) => {
      if (!jobId) {
        setAiMatchCandidates([]);
        return [] as MatchCandidate[];
      }
      setAiMatchesLoading(true);
      setAiMatchesError(null);
      try {
        const runPipeline = Boolean(opts?.runPipeline);
        const response = await apiGetMatches({
          jobId,
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
    [jobId],
  );

  const handleRunAiMatches = useCallback(async () => {
    if (!jobId) return;
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
  }, [jobId, refreshAiMatches]);

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
      if (!jobId) return null;
      try {
        const response = await apiCreateMatch({
          candidateId: candidate.id,
          jobId,
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
    [jobId, updateAiMatchCandidate],
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
    if (!options.isOpen || !jobId) {
      prevAiTabJobIdRef.current = null;
      prevOnAiTabRef.current = false;
      return;
    }
    if (options.activeTab !== 'candidates' || candidateMatchMode !== 'ai') {
      prevOnAiTabRef.current = false;
      return;
    }
    const jobChanged = prevAiTabJobIdRef.current !== jobId;
    const switchedToAi = !prevOnAiTabRef.current;
    prevAiTabJobIdRef.current = jobId;
    prevOnAiTabRef.current = true;
    if (switchedToAi || jobChanged) {
      void refreshAiMatches();
    }
  }, [options.activeTab, candidateMatchMode, refreshAiMatches, options.isOpen, jobId]);

  const onToggleAiSelect = useCallback(
    (candidateId: string) => {
      setAiMatchSelectedIds((prev) =>
        prev.includes(candidateId)
          ? prev.filter((id) => id !== candidateId)
          : [...prev, candidateId],
      );
    },
    [],
  );

  const onToggleAiSelectAll = useCallback(() => {
    setAiMatchSelectedIds((prev) =>
      prev.length === filteredSortedAiMatchCandidates.length
        ? []
        : filteredSortedAiMatchCandidates.map((row) => row.id),
    );
  }, [filteredSortedAiMatchCandidates]);

  const onToggleAiSave = useCallback(
    (candidateId: string) => {
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
    },
    [aiMatchCandidates, aiSavedMatches, ensureAiMatchId, updateAiMatchCandidate],
  );

  const onToggleAiAnalysis = useCallback(
    (candidateId: string) => {
      setAiExpandedAnalysis((previous) =>
        previous === candidateId ? null : candidateId,
      );
    },
    [],
  );

  const onViewAiProfile = useCallback(
    (candidateId: string) => {
      const match = aiMatchCandidates.find((item) => item.id === candidateId);
      if (!match || !options.onViewCandidateProfile || !options.job) return;
      options.onViewCandidateProfile(
        options.matchCandidateToJobTableRow(match, options.job.title, options.job.id),
      );
    },
    [aiMatchCandidates, options.job, options.onViewCandidateProfile, options.matchCandidateToJobTableRow],
  );

  const onOpenAiSubmit = useCallback(
    (candidateId: string) => {
      const candidate = aiMatchCandidates.find((item) => item.id === candidateId);
      if (!candidate || !options.job || !options.setSubmitClientRowId || !options.openSubmit) return;
      const job = options.job;
      const openSubmit = options.openSubmit;
      const setSubmitClientRowId = options.setSubmitClientRowId;
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
    },
    [aiMatchCandidates, ensureAiMatchId, options.job, options.openSubmit, options.setSubmitClientRowId],
  );

  return {
    candidateMatchMode,
    setCandidateMatchMode,
    jobCandidatesSearch,
    setJobCandidatesSearch,
    candidatesStageFilterId,
    setCandidatesStageFilterId,
    candidatesPage,
    setCandidatesPage,
    candidatesPageSize,
    setCandidatesPageSize,
    selectedCandidateIds,
    setSelectedCandidateIds,
    displayJobCandidates,
    setDisplayJobCandidates,
    showMatchScores,
    setShowMatchScores,
    appliedCandidatesLoading,
    setAppliedCandidatesLoading,
    appliedPipelineRunning,
    setAppliedPipelineRunning,
    jobTableCandidates,
    filteredJobTableCandidates,
    pagedJobTableCandidates,
    candidatesTotalPages,
    safeCandidatesPage,
    pipelineStageCountCards,
    inlineStageOptionsByJobId,
    setInlineStageOptionsByJobId,
    inlineStageOptionsMerged,
    inlineStageOptionsLoadingJobId,
    setInlineStageOptionsLoadingJobId,
    inlineStageUpdatingCandidateId,
    setInlineStageUpdatingCandidateId,
    onLoadStageOptions: loadInlineStageOptionsForCandidate,
    onChangeCandidateStage: handleInlineCandidateStageChange,
    deletingCandidateId,
    setDeletingCandidateId,
    onDeleteCandidate: handleDeleteJobCandidate,
    removingFromJobCandidateId,
    setRemovingFromJobCandidateId,
    onRemoveFromJob: handleRemoveJobCandidate,
    uploadingJobCv,
    setUploadingJobCv,
    jobCvUploadProgress,
    setJobCvUploadProgress,
    fileInputRef,
    onJobCvFileSelected: handleJobCvFileSelected,
    aiMatchCandidates,
    setAiMatchCandidates,
    sortedAiMatchCandidates,
    filteredSortedAiMatchCandidates,
    aiTierStats,
    aiMatchesLoading,
    setAiMatchesLoading,
    aiPipelineRunning,
    setAiPipelineRunning,
    aiMatchesError,
    setAiMatchesError,
    aiMatchSelectedIds,
    setAiMatchSelectedIds,
    aiSavedMatches,
    setAiSavedMatches,
    aiExpandedAnalysis,
    setAiExpandedAnalysis,
    onRunAiMatches: handleRunAiMatches,
    onToggleAiSelect,
    onToggleAiSelectAll,
    onToggleAiSave,
    onToggleAiAnalysis,
    onViewAiProfile,
    onOpenAiSubmit,
    refreshAppliedJobCandidates,
    recruiterFallbackForJob,
  };
}
