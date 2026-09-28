'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { matchesQuickSearch, buildQuickSearchHaystack } from '../../lib/quickSearch';
import { AnimatePresence, motion } from 'motion/react';
import { requestConfirm, requestSuccess } from '../../lib/appDialog';
import { orEmpty, startAsyncLoad } from '../../lib/asyncLoadGuard';
import { ArrowRightCircle, Briefcase, ChevronDown, LayoutGrid, Plus, Search, StickyNote, X } from 'lucide-react';
import { getCandidateStageBadgeClasses, getCandidateStageLabel } from '../../utils/candidateStage';
import { apiGetJob, apiGetJobs } from '../../lib/api';
import { parseJobsListFromResponse } from '../../lib/parseApiList';
import { isSubmitToClientStageOption, SUBMIT_TO_CLIENT_STAGE_OPTION_LABEL, SUBMIT_TO_CLIENT_STAGE_OPTION_VALUE, isInterviewPipelineStage, isOfferPipelineStage } from '../../lib/candidateSubmitToClient';
import type { CandidateProfileDrawerData } from './candidateProfileDrawerData';
import { AddToPipelineModalProps, CandidatePipelineJobOption, PIPELINE_REJECTED_STAGE, getAvatarInitials, isRejectedPipelineStage, mapJobsToPipelineOptions } from './candidateProfileShared';

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
        return;
      }
      setSelectedJobId(scopedJobId);
      setEditingJobId(null);
      setSelectedStage('');
      setStagePath([]);
      setNotes('');
      setSelectedRecruiterId(candidate?.recruiterId || '');
      setAddNewJobMode(true);
      return;
    }

    const preferred =
      pipelineRows.find((row) => row.id && candidate?.assignedJobId && row.id === candidate.assignedJobId) ||
      pipelineRows[0];

    if (preferred?.id) {
      setEditingJobId(String(preferred.id));
      const preferredStage = String(preferred.stage || '').trim();
      setSelectedJobId(String(preferred.id));
      setSelectedStage(preferredStage);
      setStagePath(preferredStage ? [preferredStage] : []);
      setNotes(String(preferred.notes || '').trim());
      setSelectedRecruiterId(candidate?.recruiterId || '');
      setAddNewJobMode(false);
      return;
    }

    setSelectedJobId('');
    setSelectedStage('');
    setStagePath([]);
    setSelectedRecruiterId(candidate?.recruiterId || '');
    setNotes('');
    setEditingJobId(null);
    setAddNewJobMode(true);
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

  useEffect(() => {
    if (!isOpen || !selectedJobId) {
      setJobStageOptions([]);
      setLoadingJobStages(false);
      return;
    }

    const load = startAsyncLoad(setLoadingJobStages);
    void (async () => {
      try {
        const response = await apiGetJob(selectedJobId);
        if (!load.isActive()) return;
        const backendJob = (response as any).data?.data || (response as any).data || response;
        const stages: Array<{ id: string; name: string }> = Array.isArray(backendJob?.pipelineStages)
          ? backendJob.pipelineStages
              .map((stage: any) => ({
                id: String(stage?.id || '').trim(),
                name: String(stage?.name || '').trim(),
              }))
              .filter((stage: { id: string; name: string }) => stage.name)
          : [];

        const withRejected = stages.some((stage) => isRejectedPipelineStage(stage.name))
          ? stages
          : [...stages, { id: '', name: PIPELINE_REJECTED_STAGE }];
        setJobStageOptions(withRejected);
      } catch (error) {
        console.error('Failed to load pipeline stages for selected job:', error);
        if (load.isActive()) setJobStageOptions([]);
      } finally {
        load.finish();
      }
    })();

    return () => {
      load.abort();
    };
  }, [isOpen, selectedJobId]);

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
  const currentStageOnEntry = String(existingEntryForSelectedJob?.stage || '').trim();
  const targetStage = stagePath[stagePath.length - 1] || selectedStage;
  const stageChanged =
    isMoveMode &&
    currentStageOnEntry &&
    targetStage &&
    targetStage !== currentStageOnEntry;

  const syncStageFromPath = (path: string[]) => {
    setStagePath(path);
    setSelectedStage(path[path.length - 1] || '');
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

  const resolveStageMeta = (stageName: string) => {
    const normalized = stageName.trim().toLowerCase();
    const match = jobStageOptions.find(
      (stage) => stage.name.trim().toLowerCase() === normalized,
    );
    return {
      stage: match?.name || stageName.trim(),
      stageId: match?.id || undefined,
    };
  };

  const openInterviewFlowForSelectedJob = (stageName: string) => {
    if (!candidate?.id || !onRequestScheduleInterview) return false;
    if (!selectedJobId) {
      setErrors((prev) => ({ ...prev, job: 'Select a job before scheduling an interview' }));
      return true;
    }
    const meta = resolveStageMeta(stageName);
    onRequestScheduleInterview({
      candidateId: candidate.id,
      jobId: selectedJobId,
      stage: meta.stage,
      stageId: meta.stageId,
    });
    return true;
  };

  const openOfferFlowForSelectedJob = (stageName: string) => {
    if (!candidate?.id || !onRequestOfferPlacement) return false;
    if (!selectedJobId) {
      setErrors((prev) => ({ ...prev, job: 'Select a job before creating a placement' }));
      return true;
    }
    const meta = resolveStageMeta(stageName);
    onRequestOfferPlacement({
      candidateId: candidate.id,
      jobId: selectedJobId,
      stage: meta.stage,
      stageId: meta.stageId,
    });
    return true;
  };

  const handleSelectStageFromDropdown = (stageName: string) => {
    if (!stageName) return;
    const normalized = stageName.trim();
    if (!normalized) return;
    if (isSubmitToClientStageOption(normalized)) {
      openSubmitToClientFlowForSelectedJob();
      return;
    }
    if (isRejectedPipelineStage(normalized)) {
      openRejectFlowForSelectedJob();
      return;
    }
    if (isInterviewPipelineStage(normalized)) {
      if (openInterviewFlowForSelectedJob(normalized)) return;
    }
    if (isOfferPipelineStage(normalized)) {
      if (openOfferFlowForSelectedJob(normalized)) return;
    }
    // Move mode: one target stage. Add mode: keep a simple selected stage.
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
    setAddNewJobMode(false);
    setEditingJobId(String(row.id));
    setSelectedJobId(String(row.id));
    syncStageFromPath(entryStage ? [entryStage] : []);
    setNotes(String(row.notes || '').trim());
    setSelectedRecruiterId(candidate?.recruiterId || '');
    setErrors({});
    setRecentlyUpdatedJobId(null);
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
    if (!selectedJobId) nextErrors.job = 'Job is required';
    if (!stagePath.length || !targetStage) nextErrors.stage = 'Select a pipeline stage';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!candidate) return;
    if (!validate()) return;

    if (isSubmitToClientStageOption(targetStage)) {
      openSubmitToClientFlowForSelectedJob();
      return;
    }

    if (isRejectedPipelineStage(targetStage)) {
      openRejectFlowForSelectedJob();
      return;
    }

    if (isInterviewPipelineStage(targetStage)) {
      if (openInterviewFlowForSelectedJob(targetStage)) return;
    }

    if (isOfferPipelineStage(targetStage)) {
      if (openOfferFlowForSelectedJob(targetStage)) return;
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
      } else {
        onClose();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const candidateInitials = getAvatarInitials(candidate?.name || 'Candidate');
  const showStageSection = (isMoveMode || addNewJobMode) && Boolean(selectedJobId);
  const canSubmitMove = !isMoveMode || Boolean(stageChanged);
  const primaryDisabled = submitting || (isMoveMode && !stageChanged);

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
                        {selectedJob?.title ? (
                          <span className="text-slate-400"> · {selectedJob.title}</span>
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
                      {existingPipelineEntries.length === 1 ? (
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
                              currentStageOnEntry.toLowerCase() === stageName.toLowerCase();
                            const isSelected =
                              targetStage?.toLowerCase() === stageName.toLowerCase();
                            const isTarget = isSelected && (!isCurrent || stageChanged);
                            return (
                              <button
                                key={stage.id || stageName}
                                type="button"
                                onClick={() => handleSelectStageFromDropdown(stageName)}
                                className={`rounded-full px-3.5 py-2 text-xs font-semibold transition-all ${
                                  isTarget
                                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30 ring-2 ring-indigo-200'
                                    : isCurrent
                                      ? 'bg-white text-slate-600 ring-1 ring-slate-200'
                                      : 'bg-white text-slate-700 ring-1 ring-slate-200/90 hover:ring-indigo-200 hover:text-indigo-700'
                                }`}
                              >
                                {stageName}
                                {isCurrent && !stageChanged ? (
                                  <span className="ml-1 text-[10px] font-medium opacity-70">now</span>
                                ) : null}
                              </button>
                            );
                          })}
                          {onRequestSubmitToClient ? (
                            <button
                              type="button"
                              onClick={() =>
                                handleSelectStageFromDropdown(SUBMIT_TO_CLIENT_STAGE_OPTION_VALUE)
                              }
                              className="rounded-full bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-200/90 transition-all hover:ring-indigo-200 hover:text-indigo-700"
                            >
                              {SUBMIT_TO_CLIENT_STAGE_OPTION_LABEL}
                            </button>
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
                  {isMoveMode
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
