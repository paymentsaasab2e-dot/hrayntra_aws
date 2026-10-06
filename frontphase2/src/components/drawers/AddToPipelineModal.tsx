'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { matchesQuickSearch, buildQuickSearchHaystack } from '../../lib/quickSearch';
import { AnimatePresence, motion } from 'motion/react';
import { requestConfirm, requestSuccess } from '../../lib/appDialog';
import { orEmpty, startAsyncLoad } from '../../lib/asyncLoadGuard';
import { ArrowRightCircle, Briefcase, ChevronDown, LayoutGrid, Plus, Search, StickyNote, X } from 'lucide-react';
import { getCandidateStageBadgeClasses, getCandidateStageLabel } from '../../utils/candidateStage';
import { apiGetJob, apiGetJobs, apiGetPipelineStages } from '../../lib/api';
import { parseJobsListFromResponse } from '../../lib/parseApiList';
import { isSubmitToClientStageOption, SUBMIT_TO_CLIENT_STAGE_OPTION_LABEL, SUBMIT_TO_CLIENT_STAGE_OPTION_VALUE, isInterviewPipelineStage, isOfferPipelineStage } from '../../lib/candidateSubmitToClient';
import type { CandidateProfileDrawerData } from './candidateProfileDrawerData';
import { AddToPipelineModalProps, CandidatePipelineJobOption, PIPELINE_REJECTED_STAGE, getAvatarInitials, isRejectedPipelineStage, mapJobsToPipelineOptions } from './candidateProfileShared';
import { isValidObjectId } from '../../lib/mapCandidateProfile';

const jobStagesCache = new Map<string, Array<{ id: string; name: string }>>();
const DEFAULT_FALLBACK_STAGES: Array<{ id: string; name: string }> = [
  { id: '', name: 'Sourced' },
  { id: '', name: 'Screening' },
  { id: '', name: 'Interviewing' },
  { id: '', name: 'Offer' },
  { id: '', name: 'Hired' },
  { id: '', name: 'Rejected' },
];

export function AddToPipelineModal({
  isOpen,
  candidate,
  jobs: jobsList,
  recruiters: recruitersList,
  initialJobId,
  lockJobToInitial = false,
  onClose,
  onSubmit,
  onRemoveFromPipeline,
  onRequestReject,
  onRequestSubmitToClient,
  onRequestScheduleInterview,
  onRequestOfferPlacement,
}: AddToPipelineModalProps) {
  const jobs = orEmpty(jobsList);
  const recruiters = orEmpty(recruitersList);
  const [jobSearch, setJobSearch] = useState('');
  const [recruiterSearch, setRecruiterSearch] = useState('');
  const [pipelineJobOptions, setPipelineJobOptions] = useState<CandidatePipelineJobOption[]>(jobs);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [selectedStage, setSelectedStage] = useState('');
  const [stagePath, setStagePath] = useState<string[]>([]);
  const [stagePickerValue, setStagePickerValue] = useState('');
  const [selectedRecruiterId, setSelectedRecruiterId] = useState('');
  const [priority, setPriority] = useState<'High' | 'Medium' | 'Low'>('Medium');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<{ job?: string; stage?: string }>({});
  const [jobStageOptions, setJobStageOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingJobStages, setLoadingJobStages] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [jobDropdownOpen, setJobDropdownOpen] = useState(false);
  const [stageDropdownOpen, setStageDropdownOpen] = useState(false);
  const [recruiterDropdownOpen, setRecruiterDropdownOpen] = useState(false);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [recentlyUpdatedJobId, setRecentlyUpdatedJobId] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [addNewJobMode, setAddNewJobMode] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  /** Move-stage multi-select: which pipeline jobs are included in this move. */
  const [multiSelectedJobIds, setMultiSelectedJobIds] = useState<string[]>([]);
  /** Target stage per selected job (jobs can move to different stages). */
  const [targetStageByJobId, setTargetStageByJobId] = useState<Record<string, string>>({});
  /** Cached stage options keyed by job id for multi-select cards. */
  const [stagesByJobId, setStagesByJobId] = useState<Record<string, Array<{ id: string; name: string }>>>({});
  const [loadingStagesForJobIds, setLoadingStagesForJobIds] = useState<string[]>([]);

  const jobDropdownRef = useRef<HTMLDivElement | null>(null);
  const stageDropdownRef = useRef<HTMLDivElement | null>(null);
  const recruiterDropdownRef = useRef<HTMLDivElement | null>(null);
  const formSectionRef = useRef<HTMLDivElement | null>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      setJobSearch('');
      setRecruiterSearch('');
      setSelectedJobId('');
      setSelectedStage('');
      setStagePath([]);
      setStagePickerValue('');
      setSelectedRecruiterId('');
      setPriority('Medium');
      setNotes('');
      setErrors({});
      setJobStageOptions([]);
      setLoadingJobStages(false);
      setSubmitting(false);
      setJobDropdownOpen(false);
      setStageDropdownOpen(false);
      setRecruiterDropdownOpen(false);
      setEditingJobId(null);
      setRecentlyUpdatedJobId(null);
      setRemoving(false);
      setAddNewJobMode(false);
      setShowMoreOptions(false);
      setMultiSelectedJobIds([]);
      setTargetStageByJobId({});
      setStagesByJobId({});
      setLoadingStagesForJobIds([]);
      setPipelineJobOptions(jobs);
      setLoadingJobs(false);
      return;
    }

    if (wasOpenRef.current) return;
    wasOpenRef.current = true;

    setJobSearch('');
    setRecruiterSearch('');
    setPriority('Medium');
    setErrors({});
    setRecentlyUpdatedJobId(null);
    setJobDropdownOpen(false);
    setStageDropdownOpen(false);
    setRecruiterDropdownOpen(false);
    setStagesByJobId({});
    setLoadingStagesForJobIds([]);

    const pipelineRows = (candidate?.assignedJobs || [])
      .filter((row) => row.isPipelineEntry && String(row.title || '').trim())
      .sort((a, b) => {
        const aTime = a.movedAt ? new Date(a.movedAt).getTime() : 0;
        const bTime = b.movedAt ? new Date(b.movedAt).getTime() : 0;
        return bTime - aTime;
      });

    const scopedJobId = lockJobToInitial && initialJobId ? String(initialJobId) : '';

    if (scopedJobId) {
      const rowForJob = pipelineRows.find((row) => row.id && String(row.id) === scopedJobId);
      if (rowForJob) {
        setEditingJobId(scopedJobId);
        setSelectedJobId(scopedJobId);
        const entryStage = String(rowForJob.stage || '').trim();
        setSelectedStage(entryStage);
        setStagePath(entryStage ? [entryStage] : []);
        setNotes(String(rowForJob.notes || '').trim());
        setSelectedRecruiterId(candidate?.recruiterId || '');
        setAddNewJobMode(false);
        setMultiSelectedJobIds([scopedJobId]);
        setTargetStageByJobId({ [scopedJobId]: entryStage });
        return;
      }
      setSelectedJobId(scopedJobId);
      setEditingJobId(null);
      setSelectedStage('');
      setStagePath([]);
      setNotes('');
      setSelectedRecruiterId(candidate?.recruiterId || '');
      setAddNewJobMode(true);
      setMultiSelectedJobIds([]);
      setTargetStageByJobId({});
      return;
    }

    const preferred =
      pipelineRows.find((row) => row.id && candidate?.assignedJobId && row.id === candidate.assignedJobId) ||
      pipelineRows[0];

    if (preferred?.id) {
      const preferredId = String(preferred.id);
      setEditingJobId(preferredId);
      const preferredStage = String(preferred.stage || '').trim();
      setSelectedJobId(preferredId);
      setSelectedStage(preferredStage);
      setStagePath(preferredStage ? [preferredStage] : []);
      setNotes(String(preferred.notes || '').trim());
      setSelectedRecruiterId(candidate?.recruiterId || '');
      setAddNewJobMode(false);
      // Default-select every pipeline job so user can multi-move with different stages.
      const allIds = pipelineRows.map((row) => String(row.id)).filter(Boolean);
      const targets: Record<string, string> = {};
      for (const row of pipelineRows) {
        if (!row.id) continue;
        targets[String(row.id)] = String(row.stage || '').trim();
      }
      setMultiSelectedJobIds(allIds.length ? allIds : [preferredId]);
      setTargetStageByJobId(targets);
      return;
    }

    setSelectedJobId('');
    setSelectedStage('');
    setStagePath([]);
    setSelectedRecruiterId(candidate?.recruiterId || '');
    setNotes('');
    setEditingJobId(null);
    setAddNewJobMode(true);
    setMultiSelectedJobIds([]);
    setTargetStageByJobId({});
  }, [
    isOpen,
    jobs,
    candidate?.assignedJobs,
    candidate?.assignedJobId,
    candidate?.recruiterId,
    initialJobId,
    lockJobToInitial,
  ]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const load = startAsyncLoad(setLoadingJobs);
    const mergeJobLists = (...lists: CandidatePipelineJobOption[][]) => {
      const byId = new Map<string, CandidatePipelineJobOption>();
      for (const list of lists) {
        for (const job of list) {
          if (job.id) byId.set(job.id, job);
        }
      }
      return Array.from(byId.values()).sort((a, b) => a.title.localeCompare(b.title));
    };

    void (async () => {
      try {
        const res = await apiGetJobs({ page: 1, limit: 500 });
        if (!load.isActive()) return;
        const fetched = mapJobsToPipelineOptions(parseJobsListFromResponse(res));
        setPipelineJobOptions(mergeJobLists(jobs, fetched));
      } catch (error) {
        console.error('Failed to load jobs for pipeline modal:', error);
        if (load.isActive()) {
          setPipelineJobOptions(mergeJobLists(jobs));
        }
      } finally {
        load.finish();
      }
    })();

    return () => {
      load.abort();
    };
  }, [isOpen, jobs]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!jobDropdownRef.current?.contains(target)) setJobDropdownOpen(false);
      if (!stageDropdownRef.current?.contains(target)) setStageDropdownOpen(false);
      if (!recruiterDropdownRef.current?.contains(target)) setRecruiterDropdownOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [isOpen]);

  const normalizeStageList = (rawStages: Array<{ id: string; name: string }>) => {
    const seenNames = new Set<string>();
    const stages: Array<{ id: string; name: string }> = [];
    for (const st of rawStages) {
      const key = st.name.toLowerCase().trim().replace(/\s+/g, ' ');
      if (!key || seenNames.has(key)) continue;
      seenNames.add(key);
      stages.push(st);
    }
    if (stages.length === 0) return DEFAULT_FALLBACK_STAGES;
    if (stages.some((stage) => isRejectedPipelineStage(stage.name))) return stages;
    return [...stages, { id: '', name: PIPELINE_REJECTED_STAGE }];
  };

  const fetchStagesForJob = async (jobId: string): Promise<Array<{ id: string; name: string }>> => {
    if (jobStagesCache.has(jobId)) return jobStagesCache.get(jobId)!;
    let rawStages: Array<{ id: string; name: string }> = [];
    try {
      const res = await apiGetPipelineStages(jobId);
      const stageList = (res as { data?: unknown })?.data || res;
      if (Array.isArray(stageList) && stageList.length > 0) {
        rawStages = stageList
          .map((s: { id?: string; name?: string }) => ({
            id: String(s?.id || '').trim(),
            name: String(s?.name || '').trim(),
          }))
          .filter((s) => s.name);
      }
    } catch {
      /* fallback to apiGetJob */
    }
    if (rawStages.length === 0) {
      const response = await apiGetJob(jobId);
      const backendJob =
        (response as { data?: { data?: { pipelineStages?: unknown }; pipelineStages?: unknown } }).data
          ?.data ||
        (response as { data?: { pipelineStages?: unknown } }).data ||
        response;
      const pipelineStages = (backendJob as { pipelineStages?: unknown })?.pipelineStages;
      rawStages = Array.isArray(pipelineStages)
        ? pipelineStages
            .map((stage: { id?: string; name?: string }) => ({
              id: String(stage?.id || '').trim(),
              name: String(stage?.name || '').trim(),
            }))
            .filter((stage) => stage.name)
        : [];
    }
    const withRejected = normalizeStageList(rawStages);
    jobStagesCache.set(jobId, withRejected);
    return withRejected;
  };

  useEffect(() => {
    if (!isOpen || !selectedJobId) {
      setJobStageOptions([]);
      setLoadingJobStages(false);
      return;
    }

    if (jobStagesCache.has(selectedJobId)) {
      const cached = jobStagesCache.get(selectedJobId)!;
      setJobStageOptions(cached);
      setStagesByJobId((prev) => ({ ...prev, [selectedJobId]: cached }));
      setLoadingJobStages(false);
      return;
    }

    setJobStageOptions(DEFAULT_FALLBACK_STAGES);
    const load = startAsyncLoad(setLoadingJobStages);

    void (async () => {
      try {
        const withRejected = await fetchStagesForJob(selectedJobId);
        if (!load.isActive()) return;
        setJobStageOptions(withRejected);
        setStagesByJobId((prev) => ({ ...prev, [selectedJobId]: withRejected }));
      } catch (error) {
        console.error('Failed to load pipeline stages for selected job:', error);
        if (load.isActive()) setJobStageOptions(DEFAULT_FALLBACK_STAGES);
      } finally {
        load.finish();
      }
    })();

    return () => {
      load.abort();
    };
  }, [isOpen, selectedJobId]);

  // Prefetch stage options for every multi-selected job (per-job stage pills).
  useEffect(() => {
    if (!isOpen || addNewJobMode || multiSelectedJobIds.length === 0) return;
    let cancelled = false;
    const jobIds = [...multiSelectedJobIds];

    setStagesByJobId((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const id of jobIds) {
        if (!next[id] && jobStagesCache.has(id)) {
          next[id] = jobStagesCache.get(id)!;
          changed = true;
        }
      }
      return changed ? next : prev;
    });

    const missing = jobIds.filter((id) => !jobStagesCache.has(id));
    if (!missing.length) return;

    setLoadingStagesForJobIds((prev) => Array.from(new Set([...prev, ...missing])));
    void (async () => {
      for (const jobId of missing) {
        if (cancelled) return;
        try {
          const stages = await fetchStagesForJob(jobId);
          if (cancelled) return;
          setStagesByJobId((prev) => ({ ...prev, [jobId]: stages }));
        } catch (error) {
          console.error('Failed to load pipeline stages for job:', jobId, error);
          if (!cancelled) {
            setStagesByJobId((prev) => ({ ...prev, [jobId]: DEFAULT_FALLBACK_STAGES }));
          }
        } finally {
          if (!cancelled) {
            setLoadingStagesForJobIds((prev) => prev.filter((id) => id !== jobId));
          }
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, addNewJobMode, multiSelectedJobIds]);

  useEffect(() => {
    if (!selectedJobId) {
      setSelectedStage('');
      setStagePath([]);
    }
  }, [selectedJobId]);

  const filteredJobs = useMemo(() => {
    const q = jobSearch.trim();
    if (!q) return pipelineJobOptions;
    return pipelineJobOptions.filter((job) =>
      matchesQuickSearch(
        buildQuickSearchHaystack(job.title, job.department, job.clientName),
        q,
      ),
    );
  }, [pipelineJobOptions, jobSearch]);

  const filteredRecruiters = useMemo(() => {
    const q = recruiterSearch.trim();
    if (!q) return recruiters;
    return recruiters.filter((recruiter) => matchesQuickSearch(recruiter.name, q));
  }, [recruiters, recruiterSearch]);

  const selectedJob = pipelineJobOptions.find((job) => job.id === selectedJobId);
  const selectedRecruiter = recruiters.find((recruiter) => recruiter.id === selectedRecruiterId);

  type PipelineEntryRow = NonNullable<CandidateProfileDrawerData['assignedJobs']>[number];

  const existingPipelineEntries = useMemo(() => {
    const rows = candidate?.assignedJobs || [];
    return rows
      .filter((row) => row.isPipelineEntry && String(row.title || '').trim())
      .sort((a, b) => {
        const aTime = a.movedAt ? new Date(a.movedAt).getTime() : 0;
        const bTime = b.movedAt ? new Date(b.movedAt).getTime() : 0;
        return bTime - aTime;
      });
  }, [candidate?.assignedJobs]);

  const existingEntryForSelectedJob = useMemo(() => {
    if (!selectedJobId) return null;
    return (
      existingPipelineEntries.find((row) => row.id && String(row.id) === selectedJobId) || null
    );
  }, [existingPipelineEntries, selectedJobId]);

  const isUpdatingEntry = Boolean(existingEntryForSelectedJob);
  const isMoveMode = Boolean(editingJobId && isUpdatingEntry && !addNewJobMode);
  const useMultiJobMoveUi =
    isMoveMode && !lockJobToInitial && existingPipelineEntries.length > 0;
  const currentStageOnEntry = String(existingEntryForSelectedJob?.stage || '').trim();
  const targetStage = stagePath[stagePath.length - 1] || selectedStage;

  const multiMovePlans = useMemo(() => {
    if (!useMultiJobMoveUi) return [];
    return multiSelectedJobIds
      .map((jobId) => {
        const entry = existingPipelineEntries.find((row) => row.id && String(row.id) === jobId);
        if (!entry?.id) return null;
        const current = String(entry.stage || '').trim();
        const target = String(targetStageByJobId[jobId] || current).trim();
        const changed =
          Boolean(target) && target.trim().toLowerCase() !== current.trim().toLowerCase();
        return {
          jobId: String(entry.id),
          title: String(entry.title || 'Job'),
          current,
          target,
          changed,
        };
      })
      .filter(Boolean) as Array<{
      jobId: string;
      title: string;
      current: string;
      target: string;
      changed: boolean;
    }>;
  }, [
    useMultiJobMoveUi,
    multiSelectedJobIds,
    existingPipelineEntries,
    targetStageByJobId,
  ]);

  const multiChangedCount = multiMovePlans.filter((plan) => plan.changed).length;
  const stageChanged = useMultiJobMoveUi
    ? multiChangedCount > 0
    : isMoveMode &&
      Boolean(
        currentStageOnEntry &&
          targetStage &&
          targetStage.trim().toLowerCase() !== currentStageOnEntry.trim().toLowerCase(),
      );

  const syncStageFromPath = (path: string[]) => {
    setStagePath(path);
    setSelectedStage(path[path.length - 1] || '');
  };

  const setJobTargetStage = (jobId: string, stageName: string) => {
    const normalized = stageName.trim();
    setTargetStageByJobId((prev) => ({ ...prev, [jobId]: normalized }));
    setSelectedJobId(jobId);
    setEditingJobId(jobId);
    syncStageFromPath(normalized ? [normalized] : []);
    setErrors((prev) => ({ ...prev, stage: undefined, job: undefined }));
  };

  const toggleMultiJobSelected = (jobId: string, entryStage: string) => {
    setMultiSelectedJobIds((prev) => {
      if (prev.includes(jobId)) {
        if (prev.length <= 1) return prev;
        const next = prev.filter((id) => id !== jobId);
        const focusId = next[0] || '';
        setSelectedJobId(focusId);
        setEditingJobId(focusId || null);
        if (focusId) {
          const focusStage = String(targetStageByJobId[focusId] || '').trim();
          syncStageFromPath(focusStage ? [focusStage] : []);
        }
        return next;
      }
      setSelectedJobId(jobId);
      setEditingJobId(jobId);
      setTargetStageByJobId((targets) => ({
        ...targets,
        [jobId]: targets[jobId] || entryStage || '',
      }));
      syncStageFromPath(entryStage ? [entryStage] : []);
      return [...prev, jobId];
    });
    setErrors((prev) => ({ ...prev, job: undefined }));
  };

  const openRejectFlowForSelectedJob = () => {
    if (!candidate?.id || !onRequestReject) return false;
    if (!selectedJobId) {
      setErrors((prev) => ({ ...prev, job: 'Select a job before rejecting this candidate' }));
      return true;
    }
    onRequestReject({ candidateId: candidate.id, jobId: selectedJobId });
    return true;
  };

  const openSubmitToClientFlowForSelectedJob = () => {
    if (!candidate?.id || !onRequestSubmitToClient) return false;
    if (!selectedJobId) {
      setErrors((prev) => ({ ...prev, job: 'Select a job before submitting to the client' }));
      return true;
    }
    onRequestSubmitToClient({ candidateId: candidate.id, jobId: selectedJobId });
    return true;
  };

  const resolveStageMeta = (stageName: string, jobId?: string) => {
    const normalized = stageName.trim().toLowerCase();
    const options =
      (jobId && (stagesByJobId[jobId] || jobStagesCache.get(jobId))) || jobStageOptions;
    const match = options.find((stage) => stage.name.trim().toLowerCase() === normalized);
    const validId = match?.id && isValidObjectId(match.id) ? match.id : undefined;
    return {
      stage: match?.name || stageName.trim(),
      stageId: validId,
    };
  };

  const openInterviewFlowForSelectedJob = (stageName: string, jobId = selectedJobId) => {
    if (!candidate?.id || !onRequestScheduleInterview) return false;
    if (!jobId) {
      setErrors((prev) => ({ ...prev, job: 'Select a job before scheduling an interview' }));
      return true;
    }
    const meta = resolveStageMeta(stageName, jobId);
    onRequestScheduleInterview({
      candidateId: candidate.id,
      jobId,
      stage: meta.stage,
      stageId: meta.stageId,
    });
    return true;
  };

  const openOfferFlowForSelectedJob = (stageName: string, jobId = selectedJobId) => {
    if (!candidate?.id || !onRequestOfferPlacement) return false;
    if (!jobId) {
      setErrors((prev) => ({ ...prev, job: 'Select a job before creating a placement' }));
      return true;
    }
    const meta = resolveStageMeta(stageName, jobId);
    onRequestOfferPlacement({
      candidateId: candidate.id,
      jobId,
      stage: meta.stage,
      stageId: meta.stageId,
    });
    return true;
  };

  const handleSelectStageFromDropdown = (stageName: string) => {
    if (!stageName) return;
    const normalized = stageName.trim();
    if (!normalized) return;
    syncStageFromPath([normalized]);
    setErrors((prev) => ({ ...prev, stage: undefined }));
  };

  const handleRemoveStageFromPath = (index: number) => {
    const nextPath = stagePath.filter((_, i) => i !== index);
    syncStageFromPath(nextPath);
    setErrors((prev) => ({ ...prev, stage: undefined }));
  };

  const loadEntryIntoForm = (row: PipelineEntryRow) => {
    if (!row.id) return;
    const entryStage = String(row.stage || '').trim();
    const jobId = String(row.id);
    setAddNewJobMode(false);
    setEditingJobId(jobId);
    setSelectedJobId(jobId);
    syncStageFromPath(entryStage ? [entryStage] : []);
    setNotes(String(row.notes || '').trim());
    setSelectedRecruiterId(candidate?.recruiterId || '');
    setErrors({});
    setRecentlyUpdatedJobId(null);
    setMultiSelectedJobIds((prev) => (prev.includes(jobId) ? prev : [...prev, jobId]));
    setTargetStageByJobId((prev) => ({
      ...prev,
      [jobId]: prev[jobId] || entryStage,
    }));
  };

  const startAddNewJob = () => {
    setAddNewJobMode(true);
    setEditingJobId(null);
    setSelectedJobId('');
    syncStageFromPath([]);
    setNotes('');
    setSelectedRecruiterId(candidate?.recruiterId || '');
    setErrors({});
    setRecentlyUpdatedJobId(null);
    setMultiSelectedJobIds([]);
  };

  const handleRemoveFromPipeline = async () => {
    if (!candidate || !selectedJobId || !onRemoveFromPipeline) return;
    const jobTitle = existingEntryForSelectedJob?.title || selectedJob?.title || 'this job';
    const confirmed = await requestConfirm(
      `Remove this candidate from the pipeline for ${jobTitle}?`,
      { tone: 'warning', confirmLabel: 'Remove', cancelLabel: 'Cancel' }
    );
    if (!confirmed) return;

    try {
      setRemoving(true);
      await Promise.resolve(
        onRemoveFromPipeline({ candidateId: candidate.id, jobId: selectedJobId })
      );
      if (typeof window !== 'undefined') {
        void requestSuccess('Removed from pipeline.');
      }
      const remaining = existingPipelineEntries.filter((row) => row.id !== selectedJobId);
      if (remaining[0]?.id) {
        loadEntryIntoForm(remaining[0]);
      } else {
        startAddNewJob();
      }
    } finally {
      setRemoving(false);
    }
  };

  const validate = () => {
    const nextErrors: { job?: string; stage?: string } = {};
    if (useMultiJobMoveUi) {
      if (multiSelectedJobIds.length === 0) nextErrors.job = 'Select at least one job';
      else if (multiChangedCount === 0) nextErrors.stage = 'Choose a new stage for at least one job';
    } else {
      if (!selectedJobId) nextErrors.job = 'Job is required';
      if (!stagePath.length || !targetStage) nextErrors.stage = 'Select a pipeline stage';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!candidate) return;
    if (!validate()) return;

    if (useMultiJobMoveUi) {
      const changedPlans = multiMovePlans.filter((plan) => plan.changed);
      const isSpecialTarget = (stage: string) =>
        isSubmitToClientStageOption(stage) ||
        isRejectedPipelineStage(stage) ||
        isInterviewPipelineStage(stage) ||
        isOfferPipelineStage(stage);
      const normalPlans = changedPlans.filter((plan) => !isSpecialTarget(plan.target));
      const specialPlan = changedPlans.find((plan) => isSpecialTarget(plan.target));

      try {
        setSubmitting(true);
        for (const plan of normalPlans) {
          await Promise.resolve(
            onSubmit?.({
              candidateId: candidate.id,
              jobId: plan.jobId,
              stage: plan.target,
              priority,
              notes: notes.trim() || undefined,
            }),
          );
        }

        if (specialPlan) {
          setSelectedJobId(specialPlan.jobId);
          setEditingJobId(specialPlan.jobId);
          syncStageFromPath([specialPlan.target]);
          if (isSubmitToClientStageOption(specialPlan.target) && onRequestSubmitToClient) {
            onRequestSubmitToClient({ candidateId: candidate.id, jobId: specialPlan.jobId });
            return;
          }
          if (isRejectedPipelineStage(specialPlan.target) && onRequestReject) {
            onRequestReject({ candidateId: candidate.id, jobId: specialPlan.jobId });
            return;
          }
          if (isInterviewPipelineStage(specialPlan.target) && onRequestScheduleInterview) {
            openInterviewFlowForSelectedJob(specialPlan.target, specialPlan.jobId);
            return;
          }
          if (isOfferPipelineStage(specialPlan.target) && onRequestOfferPlacement) {
            openOfferFlowForSelectedJob(specialPlan.target, specialPlan.jobId);
            return;
          }
        }

        if (typeof window !== 'undefined') {
          void requestSuccess(
            normalPlans.length === 1
              ? 'Stage updated successfully.'
              : `Updated stages for ${normalPlans.length} jobs.`,
          );
        }
        onClose();
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (isSubmitToClientStageOption(targetStage) && onRequestSubmitToClient) {
      openSubmitToClientFlowForSelectedJob();
      return;
    }

    try {
      setSubmitting(true);
      await Promise.resolve(
        onSubmit?.({
          candidateId: candidate.id,
          jobId: selectedJobId,
          stage: targetStage,
          priority,
          notes: notes.trim() || undefined,
        })
      );
      if (typeof window !== 'undefined') {
        void requestSuccess(
          isMoveMode
            ? 'Stage updated successfully.'
            : isUpdatingEntry
              ? 'Pipeline entry updated successfully.'
              : 'Candidate added to pipeline successfully.'
        );
      }
      if (isMoveMode || isUpdatingEntry) {
        setRecentlyUpdatedJobId(selectedJobId);
        setEditingJobId(selectedJobId);
        setAddNewJobMode(false);
      }
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const candidateInitials = getAvatarInitials(candidate?.name || 'Candidate');
  const showStageSection =
    !useMultiJobMoveUi && (isMoveMode || addNewJobMode) && Boolean(selectedJobId);
  const canSubmitMove = !isMoveMode || Boolean(stageChanged);
  const primaryDisabled = submitting || (isMoveMode && !stageChanged);
  const headerJobLabel = useMultiJobMoveUi
    ? multiSelectedJobIds.length > 1
      ? `${multiSelectedJobIds.length} jobs selected`
      : selectedJob?.title || existingPipelineEntries[0]?.title || ''
    : selectedJob?.title || '';

  return (
    <AnimatePresence>
      {isOpen ? (
        <>
          <motion.div
            className="fixed inset-0 z-[130] bg-slate-950/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-0 z-[140] flex items-center justify-center p-4"
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 400, damping: 32 }}
          >
            <div
              className={`flex max-h-[min(92vh,860px)] w-full max-w-[720px] flex-col rounded-[22px] border border-white/60 bg-white shadow-[0_28px_80px_-28px_rgba(15,23,42,0.55)] ring-1 ring-slate-200/80 ${
                jobDropdownOpen ? 'overflow-visible' : 'overflow-hidden'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="relative shrink-0 overflow-hidden px-5 pb-4 pt-5">
                <div
                  className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_0%_0%,rgba(99,102,241,0.14),transparent_55%),linear-gradient(180deg,#f8fafc_0%,#ffffff_100%)]"
                  aria-hidden
                />
                <div
                  className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-indigo-500 via-sky-400 to-teal-400"
                  aria-hidden
                />
                <div className="relative flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="relative">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-[12px] font-bold tracking-wide text-white shadow-lg shadow-indigo-500/30">
                        {candidateInitials}
                      </div>
                      <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-500">
                        Pipeline
                      </p>
                      <h3 className="truncate text-[17px] font-semibold tracking-tight text-slate-900">
                        {isMoveMode ? 'Move stage' : 'Add to pipeline'}
                      </h3>
                      <p className="truncate text-sm text-slate-500">
                        {candidate?.name || 'Candidate'}
                        {headerJobLabel ? (
                          <span className="text-slate-400"> · {headerJobLabel}</span>
                        ) : null}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-xl bg-white/80 p-2 text-slate-400 shadow-sm ring-1 ring-slate-200/80 transition-colors hover:bg-white hover:text-slate-700"
                    aria-label="Close"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              <div
                ref={formSectionRef}
                className={`min-h-[22rem] flex-1 space-y-5 px-6 pb-6 ${
                  jobDropdownOpen ? 'overflow-visible' : 'min-h-0 overflow-y-auto'
                }`}
              >
                {/* Job */}
                <section>
                  <div className="mb-2.5 flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                      <Briefcase size={13} />
                    </span>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Job
                    </label>
                  </div>
                  {existingPipelineEntries.length > 0 && !addNewJobMode ? (
                    <div className="space-y-2">
                      {useMultiJobMoveUi ? (
                        <>
                          <p className="text-xs text-slate-500">
                            Select one or more jobs. Each job can move to a different stage.
                          </p>
                          <div className="space-y-2">
                            {existingPipelineEntries.map((row, idx) => {
                              const jobId = String(row.id || '');
                              if (!jobId) return null;
                              const checked = multiSelectedJobIds.includes(jobId);
                              const currentStage = String(row.stage || '').trim();
                              const jobTarget = String(
                                targetStageByJobId[jobId] || currentStage,
                              ).trim();
                              const stageOptions =
                                stagesByJobId[jobId] ||
                                jobStagesCache.get(jobId) ||
                                DEFAULT_FALLBACK_STAGES;
                              const stagesLoading = loadingStagesForJobIds.includes(jobId);
                              const jobChanged =
                                Boolean(jobTarget) &&
                                jobTarget.toLowerCase() !== currentStage.toLowerCase();
                              return (
                                <div
                                  key={row.pipelineEntryId || jobId || idx}
                                  className={`rounded-2xl border bg-white shadow-sm transition-colors ${
                                    checked
                                      ? 'border-indigo-300 ring-2 ring-indigo-100'
                                      : 'border-slate-200/80'
                                  }`}
                                >
                                  <label className="flex cursor-pointer items-start gap-3 px-3.5 py-3">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() =>
                                        toggleMultiJobSelected(jobId, currentStage)
                                      }
                                      className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-start justify-between gap-2">
                                        <p className="text-sm font-semibold text-slate-900">
                                          {row.title}
                                        </p>
                                        <span
                                          className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold ${getCandidateStageBadgeClasses(
                                            row.stage || row.status,
                                          )}`}
                                        >
                                          {currentStage || getCandidateStageLabel(row.status)}
                                        </span>
                                      </div>
                                      {checked && jobChanged ? (
                                        <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700">
                                          {currentStage || '—'}
                                          <ArrowRightCircle size={12} />
                                          {jobTarget}
                                        </p>
                                      ) : null}
                                    </div>
                                  </label>
                                  {checked ? (
                                    <div className="border-t border-slate-100 px-3.5 pb-3 pt-2">
                                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                        New stage for this job
                                      </p>
                                      {stagesLoading ? (
                                        <p className="text-xs text-slate-500">Loading stages…</p>
                                      ) : (
                                        <div className="flex flex-wrap gap-1.5">
                                          {stageOptions.map((stage) => {
                                            const stageName = stage.name;
                                            const isCurrent =
                                              Boolean(currentStage) &&
                                              currentStage.toLowerCase() ===
                                                stageName.trim().toLowerCase();
                                            const isSelected =
                                              Boolean(jobTarget) &&
                                              jobTarget.toLowerCase() ===
                                                stageName.trim().toLowerCase();
                                            return (
                                              <button
                                                key={`${jobId}-${stage.id || stageName}`}
                                                type="button"
                                                onClick={() =>
                                                  setJobTargetStage(jobId, stageName)
                                                }
                                                className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all ${
                                                  isSelected
                                                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/25'
                                                    : isCurrent
                                                      ? 'bg-slate-100 text-slate-700 ring-1 ring-slate-300'
                                                      : 'bg-slate-50 text-slate-700 ring-1 ring-slate-200 hover:ring-indigo-200 hover:text-indigo-700'
                                                }`}
                                              >
                                                {stageName}
                                                {isCurrent ? (
                                                  <span className="ml-1 text-[10px] opacity-70">
                                                    now
                                                  </span>
                                                ) : null}
                                              </button>
                                            );
                                          })}
                                          {onRequestSubmitToClient &&
                                          !stageOptions.some((s) =>
                                            isSubmitToClientStageOption(s.name),
                                          ) ? (
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setJobTargetStage(
                                                  jobId,
                                                  SUBMIT_TO_CLIENT_STAGE_OPTION_VALUE,
                                                )
                                              }
                                              className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all ${
                                                isSubmitToClientStageOption(jobTarget)
                                                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/25'
                                                  : 'bg-slate-50 text-slate-700 ring-1 ring-slate-200 hover:ring-indigo-200 hover:text-indigo-700'
                                              }`}
                                            >
                                              {SUBMIT_TO_CLIENT_STAGE_OPTION_LABEL}
                                            </button>
                                          ) : null}
                                        </div>
                                      )}
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                          {errors.job ? (
                            <p className="text-xs text-red-600">{errors.job}</p>
                          ) : null}
                          {errors.stage ? (
                            <p className="text-xs text-red-600">{errors.stage}</p>
                          ) : null}
                        </>
                      ) : existingPipelineEntries.length === 1 ? (
                        <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-50 to-white px-4 py-3.5 shadow-sm">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {existingPipelineEntries[0].title}
                            </p>
                            {currentStageOnEntry ? (
                              <p className="mt-1 text-xs text-slate-500">
                                Currently in{' '}
                                <span className="font-semibold text-slate-700">
                                  {currentStageOnEntry}
                                </span>
                              </p>
                            ) : null}
                          </div>
                          <span
                            className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold ${getCandidateStageBadgeClasses(
                              existingPipelineEntries[0].stage || existingPipelineEntries[0].status,
                            )}`}
                          >
                            {String(existingPipelineEntries[0].stage || '').trim() ||
                              getCandidateStageLabel(existingPipelineEntries[0].status)}
                          </span>
                        </div>
                      ) : (
                        <select
                          value={selectedJobId}
                          onChange={(e) => {
                            const row = existingPipelineEntries.find(
                              (item) => item.id && String(item.id) === e.target.value,
                            );
                            if (row) loadEntryIntoForm(row);
                          }}
                          className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 shadow-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/80"
                        >
                          {existingPipelineEntries.map((row, idx) => (
                            <option key={row.pipelineEntryId || row.id || idx} value={row.id || ''}>
                              {row.title}
                              {row.stage ? ` (${row.stage})` : ''}
                            </option>
                          ))}
                        </select>
                      )}
                      <button
                        type="button"
                        onClick={startAddNewJob}
                        className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-xs font-semibold text-indigo-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700"
                      >
                        <Plus size={13} />
                        Add another job
                      </button>
                    </div>
                  ) : null}

                  {addNewJobMode && !(lockJobToInitial && initialJobId) ? (
                    <div className="relative z-20" ref={jobDropdownRef}>
                      <button
                        type="button"
                        onClick={() => setJobDropdownOpen((prev) => !prev)}
                        className={`flex min-h-[3.5rem] w-full items-center justify-between gap-3 rounded-2xl border bg-white px-4 py-3.5 text-left text-sm shadow-sm transition-shadow ${
                          errors.job
                            ? 'border-red-300'
                            : 'border-slate-200 hover:border-slate-300 focus:ring-4 focus:ring-indigo-100/80'
                        }`}
                      >
                        <span className={`min-w-0 flex-1 ${selectedJob ? 'font-medium text-slate-800' : 'text-slate-400'}`}>
                          {selectedJob ? (
                            <span className="block">
                              <span className="block whitespace-normal break-words leading-5">{selectedJob.title}</span>
                              {selectedJob.department || selectedJob.clientName ? (
                                <span className="mt-0.5 block text-xs font-normal text-slate-500">
                                  {[selectedJob.clientName, selectedJob.department].filter(Boolean).join(' · ')}
                                </span>
                              ) : null}
                            </span>
                          ) : (
                            'Search and select job'
                          )}
                        </span>
                        <Search size={16} className="shrink-0 text-slate-400" />
                      </button>
                      {jobDropdownOpen ? (
                        <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-30 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl shadow-slate-300/40">
                          <input
                            value={jobSearch}
                            onChange={(e) => setJobSearch(e.target.value)}
                            placeholder="Search jobs by title, client, or department"
                            className="mb-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                          />
                          <div className="max-h-[min(22rem,46vh)] overflow-y-auto">
                            {loadingJobs ? (
                              <p className="px-2 py-3 text-sm text-slate-500">Loading…</p>
                            ) : filteredJobs.length === 0 ? (
                              <p className="px-2 py-3 text-sm text-slate-500">No jobs</p>
                            ) : (
                              filteredJobs.map((job) => (
                                <button
                                  key={job.id}
                                  type="button"
                                  onClick={() => {
                                    const existing = existingPipelineEntries.find(
                                      (row) => row.id && String(row.id) === job.id,
                                    );
                                    setSelectedJobId(job.id);
                                    setJobSearch('');
                                    setJobDropdownOpen(false);
                                    setErrors((prev) => ({ ...prev, job: undefined }));
                                    if (existing) {
                                      loadEntryIntoForm(existing);
                                    } else {
                                      setAddNewJobMode(true);
                                      setEditingJobId(null);
                                      syncStageFromPath([]);
                                      setNotes('');
                                    }
                                  }}
                                  className="flex w-full flex-col items-stretch rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-indigo-50"
                                >
                                  <span className="whitespace-normal break-words font-medium leading-5 text-slate-800">
                                    {job.title}
                                  </span>
                                  {job.department || job.clientName ? (
                                    <span className="mt-0.5 text-xs font-normal leading-4 text-slate-500">
                                      {[job.clientName, job.department].filter(Boolean).join(' · ')}
                                    </span>
                                  ) : null}
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      ) : null}
                      {errors.job ? <p className="mt-1 text-xs text-red-600">{errors.job}</p> : null}
                    </div>
                  ) : null}

                  {addNewJobMode && lockJobToInitial && initialJobId && selectedJob ? (
                    <div className="rounded-2xl border border-slate-200/80 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900">
                      {selectedJob.title}
                    </div>
                  ) : null}
                </section>

                {/* Stage */}
                {showStageSection ? (
                  <section>
                    <div className="mb-2.5 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                          <LayoutGrid size={13} />
                        </span>
                        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {isMoveMode ? 'New stage' : 'Stage'}
                        </label>
                      </div>
                      {isMoveMode && currentStageOnEntry && stageChanged ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700">
                          {currentStageOnEntry}
                          <ArrowRightCircle size={12} />
                          {targetStage}
                        </span>
                      ) : null}
                    </div>

                    {loadingJobStages ? (
                      <p className="text-sm text-slate-500">Loading stages…</p>
                    ) : jobStageOptions.length === 0 && !onRequestSubmitToClient ? (
                      <p className="text-sm text-slate-500">No pipeline stages for this job</p>
                    ) : (
                      <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3">
                        <div className="flex flex-wrap gap-2">
                          {jobStageOptions.map((stage) => {
                            const stageName = stage.name;
                            const isCurrent =
                              isMoveMode &&
                              Boolean(
                                currentStageOnEntry &&
                                currentStageOnEntry.trim().toLowerCase() === stageName.trim().toLowerCase()
                              );
                            const isSelected =
                              Boolean(
                                targetStage &&
                                targetStage.trim().toLowerCase() === stageName.trim().toLowerCase()
                              );
                            return (
                              <button
                                key={stage.id || stageName}
                                type="button"
                                onClick={() => handleSelectStageFromDropdown(stageName)}
                                className={`rounded-full px-3.5 py-2 text-xs font-semibold transition-all ${
                                  isSelected
                                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30 ring-2 ring-indigo-200'
                                    : isCurrent
                                      ? 'bg-slate-100 text-slate-700 ring-1 ring-slate-300 font-medium hover:bg-slate-200'
                                      : 'bg-white text-slate-700 ring-1 ring-slate-200/90 hover:ring-indigo-200 hover:text-indigo-700'
                                }`}
                              >
                                {stageName}
                                {isCurrent ? (
                                  <span
                                    className={`ml-1 text-[10px] font-medium ${
                                      isSelected ? 'text-indigo-100' : 'opacity-70 text-slate-500'
                                    }`}
                                  >
                                    now
                                  </span>
                                ) : null}
                              </button>
                            );
                          })}
                          {onRequestSubmitToClient &&
                          !jobStageOptions.some((s) => isSubmitToClientStageOption(s.name)) ? (
                            (() => {
                              const isSelected =
                                Boolean(
                                  targetStage &&
                                  isSubmitToClientStageOption(targetStage)
                                );
                              return (
                                <button
                                  key="submit-to-client-stage-pill"
                                  type="button"
                                  onClick={() =>
                                    handleSelectStageFromDropdown(SUBMIT_TO_CLIENT_STAGE_OPTION_VALUE)
                                  }
                                  className={`rounded-full px-3.5 py-2 text-xs font-semibold transition-all ${
                                    isSelected
                                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30 ring-2 ring-indigo-200'
                                      : 'bg-white text-slate-700 ring-1 ring-slate-200/90 hover:ring-indigo-200 hover:text-indigo-700'
                                  }`}
                                >
                                  {SUBMIT_TO_CLIENT_STAGE_OPTION_LABEL}
                                </button>
                              );
                            })()
                          ) : null}
                        </div>
                      </div>
                    )}
                    {errors.stage ? <p className="mt-1 text-xs text-red-600">{errors.stage}</p> : null}
                    {isMoveMode && !stageChanged ? (
                      <p className="mt-2 text-xs text-slate-400">
                        Tap a stage above to continue
                      </p>
                    ) : null}
                  </section>
                ) : null}

                {/* Optional note / priority */}
                {(isMoveMode || addNewJobMode) ? (
                  <section>
                    <button
                      type="button"
                      onClick={() => setShowMoreOptions((prev) => !prev)}
                      className="flex w-full items-center justify-between rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-3 text-left text-sm font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50"
                    >
                      <span className="inline-flex items-center gap-2">
                        <StickyNote size={16} className="text-slate-400" />
                        {addNewJobMode ? 'Note & priority' : 'Note'}
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                          Optional
                        </span>
                      </span>
                      <ChevronDown
                        size={16}
                        className={`text-slate-400 transition-transform ${showMoreOptions ? 'rotate-180' : ''}`}
                      />
                    </button>

                    {showMoreOptions ? (
                      <div className="mt-3 space-y-3 rounded-2xl border border-slate-200/80 bg-slate-50/50 p-3.5">
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold text-slate-500">
                            Note
                          </label>
                          <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={2}
                            placeholder="Optional note"
                            className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                          />
                        </div>

                        {addNewJobMode ? (
                          <div>
                            <label className="mb-1.5 block text-xs font-semibold text-slate-500">
                              Priority
                            </label>
                            <div className="flex gap-2">
                              {(['High', 'Medium', 'Low'] as const).map((option) => (
                                <button
                                  key={option}
                                  type="button"
                                  onClick={() => setPriority(option)}
                                  className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                                    priority === option
                                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/25'
                                      : 'bg-white text-slate-600 ring-1 ring-slate-200'
                                  }`}
                                >
                                  {option}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </section>
                ) : null}

                {isMoveMode && onRemoveFromPipeline ? (
                  <button
                    type="button"
                    onClick={handleRemoveFromPipeline}
                    disabled={removing || submitting}
                    className="text-xs font-semibold text-red-500 transition-colors hover:text-red-700 disabled:opacity-60"
                  >
                    {removing ? 'Removing…' : 'Remove from pipeline'}
                  </button>
                ) : null}
              </div>

              {/* Footer */}
              <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/90 px-5 py-3.5 backdrop-blur-sm">
                <p className="hidden min-w-0 truncate text-[11px] text-slate-400 sm:block">
                  {useMultiJobMoveUi
                    ? stageChanged
                      ? `Ready to update ${multiChangedCount} job${multiChangedCount === 1 ? '' : 's'}`
                      : 'Select jobs and choose a new stage for each'
                    : isMoveMode
                      ? stageChanged
                        ? `Ready to move to ${targetStage}`
                        : 'Select a new stage'
                      : 'Complete the fields, then confirm'}
                </p>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={primaryDisabled}
                    className="rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:from-indigo-500 hover:to-indigo-500 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none"
                  >
                    {submitting
                      ? isMoveMode
                        ? 'Moving…'
                        : isUpdatingEntry
                          ? 'Updating…'
                          : 'Adding…'
                      : useMultiJobMoveUi
                        ? canSubmitMove
                          ? multiChangedCount > 1
                            ? `Move ${multiChangedCount} jobs`
                            : `Move to ${multiMovePlans.find((p) => p.changed)?.target || 'stage'}`
                          : 'Move stage'
                        : isMoveMode
                          ? canSubmitMove
                            ? `Move to ${targetStage}`
                            : 'Move stage'
                          : isUpdatingEntry
                            ? 'Update entry'
                            : 'Add to Pipeline'}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
