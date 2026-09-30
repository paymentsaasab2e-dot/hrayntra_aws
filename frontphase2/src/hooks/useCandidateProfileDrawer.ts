import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CandidateProfileDrawerData, CandidateScheduledInterview, CandidateTagItem } from '../components/drawers/candidateProfileDrawerData';
import type { CandidateEditFormState } from '../components/candidates/CandidateEditAtsSections';
import { buildCandidateEditForm, buildUpdatePayloadFromEditForm, validateEditFormStructured } from '../components/candidates/CandidateEditAtsSections';
import { buildUpdatePayloadFromPhase1EditSnapshot, initPhase1EditSnapshotFromProfile } from '../lib/phase1ClientPresentation';
import { isPhase1PortalCandidate, type Phase1ProfileSnapshot, pickLatestResumeFileUrl, resolveCandidateResumeUrlFromSources, isCandidateResumeFileRow } from '../lib/phase1ProfileSnapshot';
import { hasSaasaCvSaved, readSaasaCvAnnotations, SAASA_CV_FILE_TYPE } from '../lib/saasaCvAnnotations';
import { collectCandidateWorkEntries, formatCandidateExperienceForTable, resolveCandidateExperienceYears } from '../lib/candidateExperience';
import { formatTimelineDateLabel, MAX_EDIT_AVATAR_FILE_BYTES, type DrawerTab, TABS } from '../components/drawers/candidateProfileShared';
import { useFiles } from './useFiles';
import { useCandidateCvEditor } from './useCandidateCvEditor';
import { useSaasaCvAnnotations } from './useSaasaCvAnnotations';
import { apiUploadCandidateAvatar } from '../lib/api';
import { toast } from 'sonner';
import { isSubmittedToClientStage } from '../lib/candidateSubmitToClient';
import type { ResumeCvViewMode } from '../lib/cvEditorMapping';

export interface UseCandidateProfileDrawerProps {
  candidate: CandidateProfileDrawerData | null;
  isOpen: boolean;
  onClose: () => void;
  openEditDirectly?: boolean;
  loadingCandidateProfile?: boolean;
  currentUser?: { id: string; name: string; avatar?: string | null } | null;
  availableTags?: CandidateTagItem[];
  jobs?: Array<{ id: string; title: string; department?: string | null; stage?: string | null }>;
  recruiters?: Array<{ id: string; name: string; email?: string | null; avatar?: string | null }>;
  interviewers?: Array<{ id: string; name: string; email?: string | null; avatar?: string | null }>;
  existingInterviews?: CandidateScheduledInterview[];
  editModalOpenToken?: number | null;
  onAction?: (action: string, candidate: CandidateProfileDrawerData) => void;
  onUpdateCandidate?: (id: string, updates: Partial<CandidateProfileDrawerData> | Record<string, unknown>) => Promise<unknown> | void;
  onRefreshCandidate?: (id: string) => Promise<unknown> | void;
}

export function useCandidateProfileDrawer({
  candidate,
  isOpen,
  onClose,
  openEditDirectly = false,
  loadingCandidateProfile = false,
  currentUser,
  jobs = [],
  interviewers = [],
  existingInterviews = [],
  editModalOpenToken = null,
  onAction,
  onUpdateCandidate,
  onRefreshCandidate,
}: UseCandidateProfileDrawerProps) {
  // Speed performance timer
  const [speedMs, setSpeedMs] = useState<number | null>(null);
  const openTimestampRef = useRef<number>(0);

  useEffect(() => {
    if (isOpen && candidate) {
      openTimestampRef.current = performance.now();
      // Calculate elapsed render cycle time
      const raf = requestAnimationFrame(() => {
        const elapsed = Math.round(performance.now() - openTimestampRef.current);
        setSpeedMs(elapsed);
      });
      return () => cancelAnimationFrame(raf);
    } else {
      setSpeedMs(null);
    }
  }, [isOpen, candidate?.id]);

  const [activeTab, setActiveTab] = useState<DrawerTab>('Overview');
  const [showAddToPipelineModal, setShowAddToPipelineModal] = useState(false);
  const [showScheduleInterviewModal, setShowScheduleInterviewModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectModalJobId, setRejectModalJobId] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [totalExperienceDraft, setTotalExperienceDraft] = useState('');
  const [totalExperienceFocused, setTotalExperienceFocused] = useState(false);
  const [phase1EditSnapshot, setPhase1EditSnapshot] = useState<Phase1ProfileSnapshot | null>(null);
  const [editForm, setEditForm] = useState<CandidateEditFormState | null>(null);
  const [editAvatarFile, setEditAvatarFile] = useState<File | null>(null);
  const [editAvatarPreview, setEditAvatarPreview] = useState('');
  const editAvatarPreviewRef = useRef('');
  const [editError, setEditError] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const activityContainerRef = useRef<HTMLDivElement | null>(null);
  const lastEditModalOpenTokenRef = useRef<number | null>(null);
  const [editInterview, setEditInterview] = useState<CandidateScheduledInterview | null>(null);
  const candidateFileInputRef = useRef<HTMLInputElement>(null);
  const isDirectEditLaunch = openEditDirectly && Boolean(editModalOpenToken);
  const [drawerPortalMounted, setDrawerPortalMounted] = useState(false);

  useEffect(() => {
    setDrawerPortalMounted(true);
  }, []);

  const {
    files: candidateFiles,
    loading: candidateFilesLoading,
    uploading: candidateFilesUploading,
    uploadSuccess: candidateFilesUploadSuccess,
    uploadPercent: candidateFilesUploadPercent,
    error: candidateFilesError,
    uploadFile: uploadCandidateFile,
    deleteFile: deleteCandidateFile,
    refresh: refreshCandidateFiles,
  } = useFiles('candidate', candidate?.id);

  const handleCvToast = useCallback((message: string) => {
    setToastMessage(message);
  }, []);

  const [resumeTabViewPreference, setResumeTabViewPreference] =
    useState<ResumeCvViewMode | null>(null);

  useEffect(() => {
    setResumeTabViewPreference(null);
  }, [candidate?.id]);

  const handleCvCandidateUpdated = useCallback(async () => {
    if (!candidate?.id || !onRefreshCandidate) return;
    await Promise.resolve(onRefreshCandidate(candidate.id));
  }, [candidate?.id, onRefreshCandidate]);

  const cvEditor = useCandidateCvEditor({
    candidateId: candidate?.id,
    resumeUrl: candidate?.resumeUrl,
    enabled: isOpen && Boolean(candidate?.id),
    canEdit: Boolean(onUpdateCandidate),
    onCandidateUpdated: onRefreshCandidate ? handleCvCandidateUpdated : undefined,
    onToast: handleCvToast,
    onViewModeChange: (mode) => {
      if (mode) {
        setResumeTabViewPreference(null);
        window.setTimeout(() => setResumeTabViewPreference(mode), 0);
      }
      if (mode === 'updated' || mode === 'ai') setActiveTab('Resume');
    },
  });

  const handleSaasaCandidateUpdated = useCallback(async () => {
    await handleCvCandidateUpdated();
    await cvEditor.refreshBackend();
  }, [handleCvCandidateUpdated, cvEditor.refreshBackend]);

  const saasaCv = useSaasaCvAnnotations({
    candidateId: candidate?.id,
    candidateName: candidate?.name,
    resumeUrl: candidate?.resumeUrl,
    extraData: candidate?.extraData ?? null,
    enabled: isOpen && Boolean(candidate?.id),
    canEdit: Boolean(onUpdateCandidate),
    onCandidateUpdated: onRefreshCandidate ? handleSaasaCandidateUpdated : undefined,
    onFilesRefresh: refreshCandidateFiles,
    onToast: handleCvToast,
    onViewModeChange: (mode) => {
      if (mode) {
        setResumeTabViewPreference(null);
        window.setTimeout(() => setResumeTabViewPreference(mode), 0);
      }
      if (mode === 'saasa') setActiveTab('Resume');
    },
  });

  const saasaCvStored = useMemo(
    () => readSaasaCvAnnotations(candidate?.extraData ?? null),
    [candidate?.extraData]
  );

  const saasaCvFileEntry = useMemo(() => {
    if (!saasaCvStored || !hasSaasaCvSaved(saasaCvStored)) return null;
    const fromList = saasaCvStored.fileId
      ? candidateFiles.find((f) => f.id === saasaCvStored.fileId)
      : candidateFiles.find((f) => f.fileType === SAASA_CV_FILE_TYPE);
    return {
      id: fromList?.id ?? saasaCvStored.fileId,
      fileName:
        fromList?.fileName ?? saasaCvStored.fileName ?? `HRYantra CV - ${candidate?.name || 'Candidate'}`,
      fileUrl: fromList?.fileUrl ?? saasaCvStored.fileUrl ?? null,
      markCount: saasaCvStored.items.length,
      updatedAt: saasaCvStored.updatedAt,
    };
  }, [saasaCvStored, candidateFiles, candidate?.name]);

  const originalResumeFileUrl = useMemo(() => {
    return (
      resolveCandidateResumeUrlFromSources(
        {
          resumeUrl: candidate?.resumeUrl,
          resume: candidate?.resumeUrl,
          extraData: (candidate as { extraData?: Record<string, unknown> | null } | null)?.extraData ?? null,
        },
        { filesResumeUrl: pickLatestResumeFileUrl(candidateFiles) },
      ) || null
    );
  }, [candidate, candidateFiles]);

  const candidateFilesOther = useMemo(() => {
    const cvUrls = new Set(
      [originalResumeFileUrl, saasaCvFileEntry?.fileUrl]
        .map((url) => String(url || '').trim())
        .filter(Boolean)
    );
    return candidateFiles.filter((f) => {
      if (isCandidateResumeFileRow(f)) return false;
      if (f.fileType === SAASA_CV_FILE_TYPE) return false;
      if (f.id && f.id === saasaCvStored?.fileId) return false;
      const url = String(f.fileUrl || '').trim();
      if (url && cvUrls.has(url)) return false;
      return true;
    });
  }, [candidateFiles, saasaCvStored?.fileId, originalResumeFileUrl, saasaCvFileEntry?.fileUrl]);

  const handleViewResumeTabFromFiles = useCallback(
    (mode: ResumeCvViewMode) => {
      setResumeTabViewPreference(mode);
      setActiveTab('Resume');
    },
    []
  );

  const linkedJob = useMemo(() => {
    const jobId = candidate?.assignedJobId || null;
    if (!jobId) return { title: '', company: '' };
    const job = jobs.find((j) => j.id === jobId);
    if (!job) {
      const fallbackTitle =
        candidate?.assignedJob && candidate.assignedJob !== '—' ? String(candidate.assignedJob) : '';
      return { title: fallbackTitle, company: '' };
    }
    return {
      title: job.title || '',
      company: job.department || '',
    };
  }, [candidate?.assignedJob, candidate?.assignedJobId, jobs]);

  const linkedJobTitle = linkedJob.title;
  const linkedJobCompany = linkedJob.company;
  const preferredAssessmentJobId = useMemo(
    () => candidate?.assignedJobId || jobs[0]?.id || null,
    [candidate?.assignedJobId, jobs],
  );
  const linkedJobLabel = useMemo(() => {
    if (!linkedJobTitle) return '';
    return linkedJobCompany ? `${linkedJobTitle} · ${linkedJobCompany}` : linkedJobTitle;
  }, [linkedJobTitle, linkedJobCompany]);

  const experienceDisplay = useMemo(() => {
    if (!candidate) return '—';
    const work = collectCandidateWorkEntries(candidate);
    const years = resolveCandidateExperienceYears(candidate);
    return formatCandidateExperienceForTable(years, work.length);
  }, [candidate]);

  useEffect(() => {
    if (totalExperienceFocused || showEditModal) return;
    setTotalExperienceDraft(
      candidate?.totalNoOfExperience != null ? String(candidate.totalNoOfExperience) : '',
    );
  }, [candidate?.totalNoOfExperience, candidate?.id, totalExperienceFocused, showEditModal]);

  const persistTotalExperience = useCallback(
    async (raw: string) => {
      if (!candidate || !onUpdateCandidate) return;
      const trimmed = String(raw || '').trim();
      let next: number | null;
      if (!trimmed) {
        next = null;
      } else {
        const parsed = Number.parseInt(trimmed, 10);
        if (!Number.isFinite(parsed) || parsed < 0) {
          setTotalExperienceDraft(
            candidate.totalNoOfExperience != null ? String(candidate.totalNoOfExperience) : '',
          );
          return;
        }
        next = parsed;
      }
      if ((candidate.totalNoOfExperience ?? null) === next) return;
      await Promise.resolve(
        onUpdateCandidate(candidate.id, { experience: next, experienceYears: next }),
      );
      if (onRefreshCandidate) {
        await Promise.resolve(onRefreshCandidate(candidate.id));
      }
    },
    [candidate, onUpdateCandidate, onRefreshCandidate],
  );

  const titleLine = useMemo(() => {
    if (!candidate) return '—';
    const role =
      candidate.currentTitle && candidate.currentCompany
        ? `${candidate.currentTitle} · ${candidate.currentCompany}`
        : candidate.currentTitle || candidate.currentCompany || '—';
    const exp =
      experienceDisplay && experienceDisplay !== '—' ? ` · ${experienceDisplay} exp (CV)` : '';
    return `${role}${exp}`;
  }, [candidate, experienceDisplay]);

  const startOverviewEdit = useCallback(() => {
    if (!candidate) return;
    if (!onUpdateCandidate) {
      setToastMessage('You do not have permission to edit this candidate.');
      return;
    }
    setActiveTab('Overview');
    setEditError('');
    setEditForm(buildCandidateEditForm(candidate));
    if (isPhase1PortalCandidate(candidate)) {
      setPhase1EditSnapshot(initPhase1EditSnapshotFromProfile(candidate));
    } else {
      setPhase1EditSnapshot(null);
    }
    setShowEditModal(true);
  }, [candidate, onUpdateCandidate]);

  const cancelOverviewEdit = useCallback(() => {
    setEditError('');
    if (editAvatarPreviewRef.current) {
      URL.revokeObjectURL(editAvatarPreviewRef.current);
      editAvatarPreviewRef.current = '';
    }
    setEditAvatarFile(null);
    setEditAvatarPreview('');
    if (candidate) {
      setEditForm(buildCandidateEditForm(candidate));
      if (isPhase1PortalCandidate(candidate)) {
        setPhase1EditSnapshot(initPhase1EditSnapshotFromProfile(candidate));
      }
    }
    if (openEditDirectly) {
      onClose();
    } else {
      setShowEditModal(false);
    }
  }, [candidate, onClose, openEditDirectly]);

  const handleAction = (
    action: 'move-stage' | 'schedule-interview' | 'more' | 'edit'
  ) => {
    if (action === 'move-stage') {
      setShowAddToPipelineModal(true);
      return;
    }
    if (action === 'schedule-interview') {
      setShowScheduleInterviewModal(true);
      return;
    }
    if (action === 'edit') {
      startOverviewEdit();
      return;
    }
    if (candidate) onAction?.(action, candidate);
  };

  const clientReplies = candidate?.clientReplies || [];
  const clientSubmissions = candidate?.clientSubmissions || [];

  const groupedActivity = useMemo(() => {
    const items = [...(candidate?.activity || [])].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const groups: Array<{
      label: string;
      items: typeof items;
    }> = [];

    for (const item of items) {
      const label = formatTimelineDateLabel(item.timestamp);
      const existing = groups.find((group) => group.label === label);
      if (existing) {
        existing.items.push(item);
      } else {
        groups.push({ label, items: [item] });
      }
    }

    return groups;
  }, [candidate?.activity]);

  const latestClientReview = useMemo(() => {
    const items = [...(candidate?.activity || [])].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
    const fromActivity = items.find((item) => String(item.reviewUrl || '').trim());
    const extraUrl = String(
      (candidate?.extraData as { cvSubmission?: { reviewUrl?: string } } | null | undefined)?.cvSubmission
        ?.reviewUrl || '',
    ).trim();
    const reviewUrl = String(fromActivity?.reviewUrl || extraUrl || '').trim();
    if (!reviewUrl) return null;
    return {
      reviewUrl,
      clientName: fromActivity?.clientName || clientSubmissions[0]?.clientName || null,
    };
  }, [candidate?.activity, candidate?.extraData, clientSubmissions]);

  const showClientTab = useMemo(() => {
    if (clientReplies.length || clientSubmissions.length) return true;
    if (latestClientReview?.reviewUrl) return true;
    if (isSubmittedToClientStage(candidate?.stage)) return true;
    if ((candidate?.assignedJobs || []).some((job) => isSubmittedToClientStage(job.stage))) return true;
    return (candidate?.activity || []).some((item) => {
      const title = String(item.title || '').toLowerCase();
      return Boolean(String(item.reviewUrl || '').trim()) || title.includes('submitted');
    });
  }, [
    candidate?.activity,
    candidate?.assignedJobs,
    candidate?.stage,
    clientReplies.length,
    clientSubmissions.length,
    latestClientReview?.reviewUrl,
  ]);

  const visibleTabs = useMemo(() => {
    if (!showClientTab) return TABS;
    return [
      TABS[0],
      {
        id: 'Client' as const,
        label: 'Client',
        badge: clientReplies.length || undefined,
      },
      ...TABS.slice(1),
    ];
  }, [clientReplies.length, showClientTab]);

  useEffect(() => {
    if (activeTab === 'Client' && !showClientTab) {
      setActiveTab('Overview');
    }
  }, [activeTab, showClientTab]);

  const openClientReviewLink = useCallback((url: string) => {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

  const overviewContentKey = useMemo(() => {
    if (!candidate) return 'overview-empty';
    const extra = candidate.extraData ?? null;
    const snap =
      extra && typeof extra === 'object' && !Array.isArray(extra)
        ? (extra as Record<string, unknown>).phase1ProfileSnapshot
        : null;
    const snapMeta =
      snap && typeof snap === 'object' && !Array.isArray(snap)
        ? String(
            (snap as Record<string, unknown>)._phase1SnapshotSavedAt ||
              (snap as Record<string, unknown>)._savedAt ||
              '',
          )
        : '';
    return [
      candidate.id,
      candidate.currentTitle,
      candidate.currentCompany,
      candidate.phone,
      candidate.email,
      candidate.location,
      snapMeta,
      JSON.stringify(extra),
    ].join('|');
  }, [candidate]);

  useEffect(() => {
    if (isOpen && activeTab === 'Activity' && activityContainerRef.current) {
      activityContainerRef.current.scrollTop = activityContainerRef.current.scrollHeight;
    }
  }, [activeTab, isOpen, groupedActivity]);

  useEffect(() => {
    if (!toastMessage) return undefined;
    const timeout = window.setTimeout(() => setToastMessage(''), 3000);
    return () => window.clearTimeout(timeout);
  }, [toastMessage]);

  useEffect(() => {
    if (!candidate) {
      setEditForm(null);
      setPhase1EditSnapshot(null);
      return;
    }
    if (showEditModal || isSavingEdit) return;
    setEditForm(buildCandidateEditForm(candidate));
    if (isPhase1PortalCandidate(candidate)) {
      setPhase1EditSnapshot(initPhase1EditSnapshotFromProfile(candidate));
    } else {
      setPhase1EditSnapshot(null);
    }
    setEditError('');
  }, [candidate, showEditModal, isSavingEdit]);

  useEffect(() => {
    if (!candidate || !editModalOpenToken || loadingCandidateProfile) return;
    if (lastEditModalOpenTokenRef.current === editModalOpenToken) return;
    lastEditModalOpenTokenRef.current = editModalOpenToken;
    startOverviewEdit();
  }, [candidate, editModalOpenToken, loadingCandidateProfile, startOverviewEdit]);

  const updateEditField = <K extends keyof CandidateEditFormState>(
    field: K,
    value: CandidateEditFormState[K]
  ) => {
    setEditForm((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const handleEditAvatarFile = (file: File) => {
    if (!file) return;
    if (file.size > MAX_EDIT_AVATAR_FILE_BYTES) {
      toast.error('Photo must be 5MB or smaller.');
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file.');
      return;
    }
    if (editAvatarPreviewRef.current) {
      URL.revokeObjectURL(editAvatarPreviewRef.current);
    }
    const nextUrl = URL.createObjectURL(file);
    editAvatarPreviewRef.current = nextUrl;
    setEditAvatarFile(file);
    setEditAvatarPreview(nextUrl);
  };

  const handleRemoveEditAvatar = () => {
    if (editAvatarPreviewRef.current) {
      URL.revokeObjectURL(editAvatarPreviewRef.current);
      editAvatarPreviewRef.current = '';
    }
    setEditAvatarFile(null);
    setEditAvatarPreview('');
    setEditForm((prev) => (prev ? { ...prev, avatar: '' } : prev));
  };

  const saveOverviewEdit = async () => {
    if (!candidate || !onUpdateCandidate) return;
    const isPhase1Edit = isPhase1PortalCandidate(candidate) && phase1EditSnapshot;
    if (!isPhase1Edit && !editForm) return;

    setIsSavingEdit(true);
    setEditError('');

    try {
      if (!isPhase1Edit && editForm) {
        validateEditFormStructured(editForm);
      }

      let payload = isPhase1Edit
        ? buildUpdatePayloadFromPhase1EditSnapshot(candidate, phase1EditSnapshot!)
        : buildUpdatePayloadFromEditForm(editForm!, (candidate as { extraData?: unknown }).extraData);

      if (editAvatarFile) {
        try {
          const uploadResponse = await apiUploadCandidateAvatar(candidate.id, editAvatarFile);
          const data = uploadResponse?.data;
          const photoUrl =
            (typeof data === 'object' && data?.fileUrl) ||
            (typeof data === 'string' ? data : null);
          if (photoUrl) {
            payload.avatar = photoUrl;
          }
        } catch (photoError: unknown) {
          const message =
            photoError instanceof Error ? photoError.message : 'Photo upload failed';
          setEditError(message);
          return;
        }
      }

      await Promise.resolve(onUpdateCandidate(candidate.id, payload));
      if (onRefreshCandidate) {
        await Promise.resolve(onRefreshCandidate(candidate.id));
      }

      if (editAvatarPreviewRef.current) {
        URL.revokeObjectURL(editAvatarPreviewRef.current);
        editAvatarPreviewRef.current = '';
      }
      setEditAvatarFile(null);
      setEditAvatarPreview('');
      toast.success('Candidate profile updated successfully');

      if (openEditDirectly) {
        onClose();
      } else {
        setShowEditModal(false);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update candidate details.';
      setEditError(msg);
      toast.error(msg);
    } finally {
      setIsSavingEdit(false);
    }
  };

  return {
    speedMs,
    activeTab,
    setActiveTab,
    showAddToPipelineModal,
    setShowAddToPipelineModal,
    showScheduleInterviewModal,
    setShowScheduleInterviewModal,
    showRejectModal,
    setShowRejectModal,
    rejectModalJobId,
    setRejectModalJobId,
    showEditModal,
    setShowEditModal,
    totalExperienceDraft,
    setTotalExperienceDraft,
    totalExperienceFocused,
    setTotalExperienceFocused,
    persistTotalExperience,
    phase1EditSnapshot,
    setPhase1EditSnapshot,
    editForm,
    setEditForm,
    updateEditField,
    editAvatarFile,
    editAvatarPreview,
    handleEditAvatarFile,
    handleRemoveEditAvatar,
    editError,
    isSavingEdit,
    toastMessage,
    setToastMessage,
    activityContainerRef,
    editInterview,
    setEditInterview,
    candidateFileInputRef,
    isDirectEditLaunch,
    drawerPortalMounted,
    candidateFiles,
    candidateFilesLoading,
    candidateFilesUploading,
    candidateFilesUploadSuccess,
    candidateFilesUploadPercent,
    candidateFilesError,
    uploadCandidateFile,
    deleteCandidateFile,
    refreshCandidateFiles,
    resumeTabViewPreference,
    setResumeTabViewPreference,
    cvEditor,
    saasaCv,
    saasaCvStored,
    saasaCvFileEntry,
    originalResumeFileUrl,
    candidateFilesOther,
    handleViewResumeTabFromFiles,
    linkedJob,
    linkedJobTitle,
    linkedJobCompany,
    preferredAssessmentJobId,
    linkedJobLabel,
    experienceDisplay,
    titleLine,
    startOverviewEdit,
    cancelOverviewEdit,
    saveOverviewEdit,
    handleAction,
    clientReplies,
    clientSubmissions,
    groupedActivity,
    latestClientReview,
    showClientTab,
    visibleTabs,
    openClientReviewLink,
    overviewContentKey,
  };
}
