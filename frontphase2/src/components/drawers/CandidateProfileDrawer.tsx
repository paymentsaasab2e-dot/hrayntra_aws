'use client';



import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { usePageDrawerLifecycle } from '../../lib/pageDrawerEvents';

import { useDrawerUnsavedGuard } from '../../hooks/useDrawerUnsavedGuard';

import { AnimatePresence, motion } from 'motion/react';
import { SpeedMetricBadge } from '../common/SpeedMetricBadge';

import { DetailsModalShell } from './DetailsModalShell';

import { DrawerLinkActions } from './DrawerLinkActions';

import { DrawerTabBar } from './DrawerTabBar';

import { createPortal } from 'react-dom';

import { buildFileHref } from '../../utils/cloudinaryUrls';

import { CandidateResumeTabPanel } from '../candidates/CandidateResumeTabPanel';

import { CandidateAssessmentsTabPanel } from '../candidates/CandidateAssessmentsTabPanel';

import { CandidateCvFilesSection } from '../candidates/CandidateCvFilesSection';

import { buildCandidateEditForm, buildUpdatePayloadFromEditForm, CandidateEditAtsSections, validateEditFormStructured, type CandidateEditFormState } from '../candidates/CandidateEditAtsSections';

import { useCandidateCvEditor } from '../../hooks/useCandidateCvEditor';

import { useSaasaCvAnnotations } from '../../hooks/useSaasaCvAnnotations';

import type { ResumeCvViewMode } from '../../lib/cvEditorMapping';

import { pickLatestResumeFileUrl, resolveCandidateResumeUrlFromSources, isCandidateResumeFileRow } from '../../lib/phase1ProfileSnapshot';

import { hasSaasaCvSaved, readSaasaCvAnnotations, SAASA_CV_FILE_TYPE } from '../../lib/saasaCvAnnotations';

import { formatDateDMY, formatDateTimeDMY } from '../../utils/dateDisplay';

import { EntityAuditSummary } from '../table/TableAuditCell';

import { DrawerEntityChatTab } from './DrawerEntityChatTab';

import { DrawerSectionCard, DRAWER_FORM_SCROLL_BG } from './drawerFormUi';

import { extractAuditMeta } from '../../utils/auditMeta';

import { orEmpty } from '../../lib/asyncLoadGuard';

import { Briefcase, Calendar, ExternalLink, FileText, Loader2, MapPin, MessageSquare, MessageSquareText, Phone, SquarePen, Tag, Video, X, Activity, Paperclip, Building2 } from 'lucide-react';

import { ImageWithFallback, initialsFromDisplayName } from '../ImageWithFallback';

import { useFiles } from '../../hooks/useFiles';

import { DocumentUploadButton } from '../import/documentUploadUi';

import { apiUploadCandidateAvatar } from '../../lib/api';

import { toast } from 'sonner';

import { formatTimezoneDisplay, resolveIanaFromTimezoneValue } from '../../utils/inferTimezone';

import { isSubmittedToClientStage } from '../../lib/candidateSubmitToClient';

import { CandidateAtsExtractedOverview } from '../candidates/CandidateAtsExtractedOverview';

import { EntityWorkspaceAlertsPanel } from '../ai/EntityWorkspaceAlertsPanel';

import { CandidateClientRepliesTab } from './CandidateClientRepliesTab';

import { CandidatePhase1DetailSections } from '../candidates/CandidatePhase1DetailSections';

import { CandidatePhase1SubmitEditSections } from '../candidates/CandidatePhase1SubmitEditSections';

import { applyHiringFieldsFromEditForm, CandidateHiringEditSection } from '../candidates/CandidateHiringSection';

import { buildUpdatePayloadFromPhase1EditSnapshot, initPhase1EditSnapshotFromProfile } from '../../lib/phase1ClientPresentation';

import { isPhase1PortalCandidate, type Phase1ProfileSnapshot } from '../../lib/phase1ProfileSnapshot';

import { collectCandidateWorkEntries, formatCandidateExperienceForTable, resolveCandidateExperienceYears } from '../../lib/candidateExperience';

import type { CandidateScheduledInterview } from './candidateProfileDrawerData';
import { CandidateOverviewTab } from './candidateTabs/Overview';
import { CandidateClientTab } from './candidateTabs/Client';
import { CandidateResumeTab } from './candidateTabs/Resume';
import { CandidateInterviewsTab } from './candidateTabs/Interviews';
import { CandidateAssessmentsTab } from './candidateTabs/Assessments';
import { CandidateActivityTab } from './candidateTabs/Activity';
import { CandidateRemarksTab } from './candidateTabs/Remarks';
import { CandidateTagsTab } from './candidateTabs/Tags';
import { CandidateFilesTab } from './candidateTabs/Files';
import { CandidateChatTab } from './candidateTabs/Chat';

import { CandidateProfileDrawerProps, CandidateTagSystem, DrawerTab, InternalNotesSection, MAX_EDIT_AVATAR_FILE_BYTES, RejectCandidateModal, TABS, formatTimelineDateLabel, getAvatarInitials, getStageClasses, getTimelineConfig } from './candidateProfileShared';

import { ScheduleInterviewModal } from './ScheduleInterviewModal';

import { AddToPipelineModal } from './AddToPipelineModal';

export { ScheduleInterviewModal } from './ScheduleInterviewModal';

export { AddToPipelineModal } from './AddToPipelineModal';

export type { CandidatePipelineJobOption } from './candidateProfileShared';

export type { CandidatePipelineRecruiterOption } from './candidateProfileShared';

export type { CandidateInterviewerOption } from './candidateProfileShared';

export type { ScheduleInterviewCandidateOption } from './candidateProfileShared';

export type { AddToPipelineModalProps } from './candidateProfileShared';

export type {
  CandidateProfileDrawerData,
  CandidateScheduledInterview,
  CandidateTagItem,
} from './candidateProfileDrawerData';

export function CandidateProfileDrawer({
  candidate,
  isOpen,
  onClose,
  openEditDirectly = false,
  loadingCandidateProfile = false,
  currentUser,
  availableTags: availableTagsProp,
  jobs: jobsPropIn,
  recruiters: recruitersProp,
  interviewers: interviewersProp,
  existingInterviews: existingInterviewsProp,
  editModalOpenToken = null,
  onAction,
  onAddNote,
  onEditNote,
  onDeleteNote,
  onPinNote,
  onAddTag,
  onRemoveTag,
  onCreateTag,
  onAddToPipeline,
  onRemoveFromPipeline,
  onRejectCandidate,
  onScheduleInterview,
  onMoveStageScheduleInterview,
  onMoveStageCreatePlacement,
  onUpdateCandidate,
  onRefreshCandidate,
  stackAboveSiblingDrawers = false,
}: CandidateProfileDrawerProps) {
  const availableTags = orEmpty(availableTagsProp);
  const jobs = orEmpty(jobsPropIn);
  const recruiters = orEmpty(recruitersProp);
  const interviewers = orEmpty(interviewersProp);
  const existingInterviews = orEmpty(existingInterviewsProp);
  usePageDrawerLifecycle(isOpen);
  const {
    panelRef: candidateDrawerPanelRef,
    requestClose: requestCandidateDrawerClose,
  } = useDrawerUnsavedGuard<HTMLElement>({
    isOpen,
    onClose,
  });
  const layer = stackAboveSiblingDrawers
    ? {
        backdrop: 'z-[117]',
        panel: 'z-[118]',
        editBackdrop: 'z-[119]',
        editPanel: 'z-[120]',
        toast: 'z-[125]',
      }
    : {
        backdrop: 'z-40',
        panel: 'z-50',
        editBackdrop: 'z-[70]',
        editPanel: 'z-[75]',
        toast: 'z-[90]',
      };
  const [speedMs, setSpeedMs] = useState<number | null>(null);
  const openTimestampRef = useRef<number>(0);

  useEffect(() => {
    if (isOpen && candidate) {
      openTimestampRef.current = performance.now();
      const raf = requestAnimationFrame(() => {
        const elapsed = Math.max(1, Math.round(performance.now() - openTimestampRef.current));
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
        // Force re-apply even when the preference was already this mode (e.g. save again).
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
      // Resume / HRYantra CV belong on the Resume tab — never in Other documents.
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

  const uploadsBase = useMemo(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1';
    // remove trailing "/api/v1" (and possible trailing slash) to build absolute "/uploads/..." links
    return apiBase.replace(/\/api\/v1\/?$/, '');
  }, []);
  const toFileHref = (fileUrl?: string | null) => buildFileHref(fileUrl, uploadsBase);

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
  // Backwards-compatible label kept for downstream consumers (single-line).
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

  const fallbackCurrentUser = currentUser || {
    id: 'current-user',
    name: 'You',
    avatar: null,
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
        icon: Building2,
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
    // Never clobber in-progress Overview edits when parent refreshes the candidate.
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
    const preview = URL.createObjectURL(file);
    editAvatarPreviewRef.current = preview;
    setEditAvatarPreview(preview);
    setEditAvatarFile(file);
  };

  const clearEditAvatarFile = () => {
    if (editAvatarPreviewRef.current) {
      URL.revokeObjectURL(editAvatarPreviewRef.current);
      editAvatarPreviewRef.current = '';
    }
    setEditAvatarPreview('');
    setEditAvatarFile(null);
    updateEditField('avatar', '');
  };

  const handleEditSave = async () => {
    if (!candidate || !onUpdateCandidate) return;
    const isPhase1Edit = isPhase1PortalCandidate(candidate) && phase1EditSnapshot;
    if (!isPhase1Edit && !editForm) return;

    try {
      setIsSavingEdit(true);
      setEditError('');
      if (!isPhase1Edit && editForm) {
        validateEditFormStructured(editForm);
      }

      let payload = isPhase1Edit
        ? buildUpdatePayloadFromPhase1EditSnapshot(candidate, phase1EditSnapshot)
        : buildUpdatePayloadFromEditForm(editForm!, candidate.extraData);

      if (isPhase1Edit && editForm) {
        payload = applyHiringFieldsFromEditForm(payload, editForm, candidate.assignedJobId);
      } else if (editForm) {
        const nextJobId = String(editForm.assignedJobId || '').trim();
        const prevJobId = String(candidate.assignedJobId || '').trim();
        if (nextJobId && nextJobId !== prevJobId) {
          const previousStage = String(candidate.stage || '').trim().toLowerCase();
          const formStage = String(editForm.stage || payload.stage || '').trim();
          const formStageLower = formStage.toLowerCase();
          // Edit form often re-sends the old stage with a job change — reset to Applied.
          if (!formStage || formStageLower === 'new' || formStageLower === previousStage) {
            payload = { ...payload, stage: 'Applied' };
          }
        }
      }

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
      setPhase1EditSnapshot(null);
      if (openEditDirectly) {
        onClose();
      } else {
        setShowEditModal(false);
      }
      setToastMessage('Candidate updated successfully.');
    } catch (error: any) {
      setEditError(error?.message || 'Unable to update candidate right now.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const candidateEditFormSections =
    candidate && isPhase1PortalCandidate(candidate) && phase1EditSnapshot ? (
      <>
        {editForm ? (
          <CandidateHiringEditSection
            form={editForm}
            onChange={updateEditField}
            recruiters={recruiters}
            jobs={jobs}
          />
        ) : null}
        {candidate ? (
        <CandidatePhase1SubmitEditSections
          candidate={candidate}
          snapshot={phase1EditSnapshot}
          onChange={setPhase1EditSnapshot}
        />
        ) : null}
      </>
    ) : editForm ? (
      <CandidateEditAtsSections
        form={editForm}
        onChange={updateEditField}
        recruiters={recruiters}
        jobs={jobs}
        avatarPreview={editAvatarPreview}
        onAvatarFile={handleEditAvatarFile}
        onAvatarRemove={clearEditAvatarFile}
      />
    ) : null;

  const candidateEditFormActions = (
    <>
      <button
        type="button"
        onClick={cancelOverviewEdit}
        disabled={isSavingEdit}
        className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={() => void handleEditSave()}
        disabled={
          isSavingEdit ||
          (isPhase1PortalCandidate(candidate) ? !phase1EditSnapshot : !editForm)
        }
        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
      >
        <SquarePen size={16} />
        {isSavingEdit ? 'Saving...' : 'Save Candidate'}
      </button>
    </>
  );

  const candidateEditFormFooter = (
    <div className="sticky bottom-0 z-10 -mx-5 border-t border-slate-200 bg-slate-50/95 px-5 py-4 backdrop-blur sm:-mx-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-end gap-3">
        {candidateEditFormActions}
      </div>
    </div>
  );

  const drawerTree = (
    <AnimatePresence>
      {isOpen && candidate ? (
        <React.Fragment key="candidate-profile-drawer">
          <AnimatePresence>
            {toastMessage ? (
              <motion.div
                key="candidate-profile-toast"
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className={`fixed right-4 top-4 ${layer.toast} rounded-2xl border border-blue-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 shadow-xl`}
              >
                {toastMessage}
              </motion.div>
            ) : null}
          </AnimatePresence>
          <AddToPipelineModal
            isOpen={showAddToPipelineModal}
            candidate={candidate}
            jobs={jobs}
            recruiters={recruiters}
            onClose={() => setShowAddToPipelineModal(false)}
            onSubmit={onAddToPipeline}
            onRemoveFromPipeline={onRemoveFromPipeline}
            onRequestReject={
              onRejectCandidate
                ? ({ jobId }) => {
                    setRejectModalJobId(jobId);
                    setShowAddToPipelineModal(false);
                    setShowRejectModal(true);
                  }
                : undefined
            }
            onRequestScheduleInterview={
              onMoveStageScheduleInterview
                ? (payload) => {
                    // Keep Move stage open so Cancel on Schedule Interview returns here.
                    onMoveStageScheduleInterview(payload);
                  }
                : undefined
            }
            onRequestOfferPlacement={
              onMoveStageCreatePlacement
                ? (payload) => {
                    // Keep Move stage open so Cancel on Placement returns here.
                    onMoveStageCreatePlacement(payload);
                  }
                : undefined
            }
          />
          <ScheduleInterviewModal
            isOpen={showScheduleInterviewModal}
            candidate={candidate}
            linkedJobLabel={linkedJobLabel}
            linkedJobTitle={linkedJobTitle}
            linkedJobCompany={linkedJobCompany}
            initialJobId={candidate.assignedJobId}
            jobs={jobs}
            interviewers={interviewers}
            existingInterviews={existingInterviews.length ? existingInterviews : candidate.scheduledInterviews || []}
            onClose={() => {
              setShowScheduleInterviewModal(false);
              setEditInterview(null);
            }}
            onSchedule={onScheduleInterview}
            onUpdate={async (interviewId, payload) => {
              await Promise.resolve(onScheduleInterview?.({ ...payload, id: interviewId }));
            }}
            editInterview={editInterview}
            onScheduledSuccess={(message) => setToastMessage(message)}
          />
          <RejectCandidateModal
            isOpen={showRejectModal}
            candidate={candidate}
            onClose={() => setShowRejectModal(false)}
            onReject={onRejectCandidate}
          />
          {isDirectEditLaunch ? (
            <>
              <DetailsModalShell
                onBackdropClick={cancelOverviewEdit}
                size="md"
                variant="main"
                zIndexClass="z-[110]"
                dialogTitleId="candidate-edit-modal-title"
              >
                <div className="flex h-full w-full flex-col bg-slate-50">
                  <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
                    <div className="flex items-start justify-between gap-4 px-5 py-5 sm:px-6">
                      <div className="flex min-w-0 gap-4">
                        <ImageWithFallback
                          src={editAvatarPreview || candidate.avatar || ''}
                          fallbackInitials={initialsFromDisplayName(candidate.name)}
                          alt={candidate.name}
                          className="h-16 w-16 shrink-0 rounded-2xl object-cover text-lg ring-1 ring-slate-200"
                        />
                        <div className="min-w-0">
                          <div className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-blue-600">
                            <SquarePen size={16} />
                            Edit Candidate
                          </div>
                          <h2 className="mt-2 truncate text-2xl font-bold text-slate-900">{candidate.name}</h2>
                          <p className="mt-1 truncate text-sm text-slate-500">{titleLine}</p>
                        </div>
                      </div>
                      {!loadingCandidateProfile && onUpdateCandidate ? (
                        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                          {candidateEditFormActions}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={cancelOverviewEdit}
                          className="rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                          aria-label="Close edit candidate drawer"
                        >
                          <X size={20} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className={`flex-1 overflow-y-auto px-5 py-5 sm:px-6 ${DRAWER_FORM_SCROLL_BG}`}>
                    {loadingCandidateProfile ? (
                      <div className="flex min-h-[20rem] flex-col items-center justify-center gap-3 text-slate-500">
                        <Loader2 size={28} className="animate-spin text-blue-600" />
                        <p className="text-sm font-medium">Loading candidate details...</p>
                      </div>
                    ) : onUpdateCandidate ? (
                      <div className="space-y-5">
                        {editError ? (
                          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                            {editError}
                          </div>
                        ) : null}
                        {candidateEditFormSections}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">You do not have permission to edit this candidate.</p>
                    )}
                  </div>
                </div>
              </DetailsModalShell>
            </>
          ) : (
          <>
              <DetailsModalShell
                panelRef={candidateDrawerPanelRef}
                onBackdropClick={() => void requestCandidateDrawerClose()}
                size="lg"
                variant="main"
                zIndexClass="z-[100]"
                dialogTitleId="candidate-detail-modal-title"
              >
                <div className="flex h-full w-full flex-col bg-slate-50">
              <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
                <div className="flex items-start justify-between gap-3 px-5 pt-3 sm:px-6">
                  <div className="flex min-w-0 items-center gap-3">
                    <ImageWithFallback
                      src={candidate.avatar || ''}
                      fallbackInitials={initialsFromDisplayName(candidate.name)}
                      alt={candidate.name}
                      className="h-11 w-11 shrink-0 rounded-xl object-cover text-base ring-1 ring-slate-200"
                    />
                    <div className="min-w-0">
                      <h2 className="truncate text-lg font-bold text-slate-900">{candidate.name}</h2>
                      <p className="truncate text-xs text-slate-500">{titleLine}</p>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                    {onUpdateCandidate ? (
                      <button
                        type="button"
                        onClick={startOverviewEdit}
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
                          showEditModal
                            ? 'border-blue-200 bg-blue-50 text-blue-800'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <SquarePen size={13} />
                        {showEditModal ? 'Editing Overview' : 'Edit Candidate'}
                      </button>
                    ) : null}
                    {candidate?.resumeUrl?.trim() ? (
                      <button
                        type="button"
                        onClick={() => saasaCv.openModal()}
                        disabled={saasaCv.busy}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <MessageSquare size={13} />
                        HRYantra CV
                        {saasaCv.annotationCount > 0 ? (
                          <span className="rounded-full bg-amber-200 px-1.5 py-0.5 text-[10px] font-bold tabular-nums">
                            {saasaCv.annotationCount}
                          </span>
                        ) : null}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => handleAction('move-stage')}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Move Stage
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAction('schedule-interview')}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Schedule Interview
                    </button>
                    {latestClientReview?.reviewUrl ? (
                      <button
                        type="button"
                        onClick={() => openClientReviewLink(latestClientReview.reviewUrl)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-xs font-medium text-violet-800 hover:bg-violet-100"
                      >
                        <ExternalLink size={13} />
                        Client view
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void requestCandidateDrawerClose()}
                      className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                      aria-label="Close candidate profile"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>

                <div className="px-5 py-2 sm:px-6">
                  <div className="flex flex-nowrap items-center gap-2 overflow-x-auto text-sm [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                    {onAddToPipeline ? (
                      <button
                        type="button"
                        onClick={() => setShowAddToPipelineModal(true)}
                        title={
                          linkedJobLabel || candidate.assignedJob
                            ? 'Change or assign job'
                            : 'Assign job'
                        }
                        className="inline-flex shrink-0 items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs transition-colors hover:bg-indigo-100 hover:ring-2 hover:ring-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                      >
                        <span className="font-medium text-indigo-600">Assigned Job</span>
                        <span className="font-semibold text-indigo-900">
                          {linkedJobLabel || candidate.assignedJob || '—'}
                        </span>
                        <span className="ml-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-500">
                          {linkedJobLabel || candidate.assignedJob ? 'Edit' : 'Assign'}
                        </span>
                      </button>
                    ) : (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs">
                        <span className="font-medium text-indigo-600">Assigned Job</span>
                        <span className="font-semibold text-indigo-900">
                          {linkedJobLabel || candidate.assignedJob || '—'}
                        </span>
                      </span>
                    )}
                    <span
                      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${getStageClasses(
                        candidate.stage
                      )}`}
                    >
                      <span className="opacity-80">Stage</span>
                      <span>{candidate.stage || '—'}</span>
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs">
                      <span className="font-medium text-emerald-600">Team Member</span>
                      <span className="font-semibold text-emerald-900">{candidate.recruiter || '—'}</span>
                    </span>
                    <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      Quick Contact
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs">
                      <span className="font-medium text-blue-600">Email</span>
                      <span className="font-semibold text-blue-900">{candidate.email || '—'}</span>
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs">
                      <span className="font-medium text-amber-600">Phone</span>
                      <span className="font-semibold text-amber-900">{candidate.phone || '—'}</span>
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 text-xs">
                      <span className="font-medium text-violet-600">Location</span>
                      <span className="font-semibold text-violet-900">{candidate.location || '—'}</span>
                    </span>
                    <label className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-teal-50 px-2.5 py-1 text-xs">
                      <span className="font-medium text-teal-700">Total No. of Experience</span>
                      <input
                        value={
                          showEditModal && editForm
                            ? editForm.experience
                            : totalExperienceDraft
                        }
                        onChange={(event) => {
                          const next = event.target.value;
                          if (showEditModal && editForm) {
                            updateEditField('experience', next);
                            return;
                          }
                          setTotalExperienceDraft(next);
                        }}
                        onFocus={() => setTotalExperienceFocused(true)}
                        onBlur={(event) => {
                          setTotalExperienceFocused(false);
                          if (showEditModal) return;
                          void persistTotalExperience(event.currentTarget.value);
                        }}
                        placeholder="e.g. 5"
                        inputMode="decimal"
                        disabled={!onUpdateCandidate}
                        className="w-14 bg-transparent text-xs font-semibold text-teal-950 outline-none placeholder:font-normal placeholder:text-teal-400 disabled:cursor-default"
                        aria-label="Total No. of Experience"
                      />
                    </label>
                  </div>
                </div>

                <DrawerTabBar
                  ariaLabel="Candidate sections"
                  tabs={visibleTabs}
                  activeId={activeTab}
                  onChange={setActiveTab}
                  compact
                />
              </div>

              <div className={`flex-1 overflow-y-auto px-5 py-5 sm:px-6 ${DRAWER_FORM_SCROLL_BG}`}>
                {activeTab === 'Overview'  && <CandidateOverviewTab candidate={candidate} candidateEditFormFooter={candidateEditFormFooter} candidateEditFormSections={candidateEditFormSections} editError={editError} onAddToPipeline={onAddToPipeline} onUpdateCandidate={onUpdateCandidate} overviewContentKey={overviewContentKey} setShowAddToPipelineModal={setShowAddToPipelineModal} showEditModal={showEditModal} startOverviewEdit={startOverviewEdit} />}

                {activeTab === 'Client' && showClientTab && <CandidateClientTab clientReplies={clientReplies} clientSubmissions={clientSubmissions} latestClientReview={latestClientReview} uploadsBase={uploadsBase} />}

                {activeTab === 'Resume'  && <CandidateResumeTab activeTab={activeTab} candidate={candidate} cvEditor={cvEditor} onRefreshCandidate={onRefreshCandidate} resumeTabViewPreference={resumeTabViewPreference} saasaCv={saasaCv} setResumeTabViewPreference={setResumeTabViewPreference} setToastMessage={setToastMessage} />}

                {activeTab === 'Interviews'  && <CandidateInterviewsTab candidate={candidate} existingInterviews={existingInterviews} handleAction={handleAction} setEditInterview={setEditInterview} setShowScheduleInterviewModal={setShowScheduleInterviewModal} />}

                {activeTab === 'Assessments' && candidate?.id && <CandidateAssessmentsTab activeTab={activeTab} candidate={candidate} preferredAssessmentJobId={preferredAssessmentJobId} />}

                {activeTab === 'Activity'  && <CandidateActivityTab activityContainerRef={activityContainerRef} candidate={candidate} groupedActivity={groupedActivity} />}

                {activeTab === 'Remarks'  && <CandidateRemarksTab candidate={candidate} fallbackCurrentUser={fallbackCurrentUser} onAddNote={onAddNote} onDeleteNote={onDeleteNote} onEditNote={onEditNote} onPinNote={onPinNote} />}

                {activeTab === 'Tags'  && <CandidateTagsTab availableTags={availableTags} candidate={candidate} onAddTag={onAddTag} onCreateTag={onCreateTag} onRemoveTag={onRemoveTag} />}

                {activeTab === 'Files'  && <CandidateFilesTab candidate={candidate} candidateFilesError={candidateFilesError} candidateFilesLoading={candidateFilesLoading} candidateFilesOther={candidateFilesOther} candidateFilesUploadPercent={candidateFilesUploadPercent} candidateFilesUploadSuccess={candidateFilesUploadSuccess} candidateFilesUploading={candidateFilesUploading} cvEditor={cvEditor} deleteCandidateFile={deleteCandidateFile} handleCvToast={handleCvToast} handleViewResumeTabFromFiles={handleViewResumeTabFromFiles} onUpdateCandidate={onUpdateCandidate} originalResumeFileUrl={originalResumeFileUrl} saasaCv={saasaCv} saasaCvFileEntry={saasaCvFileEntry} toFileHref={toFileHref} uploadCandidateFile={uploadCandidateFile} uploadsBase={uploadsBase} />}

                {activeTab === 'Chat'  && <CandidateChatTab activeTab={activeTab} candidate={candidate} isOpen={isOpen} />}
              </div>
                </div>
              </DetailsModalShell>
          </>
          )}
          {cvEditor.modals}
          {saasaCv.modals}
        </React.Fragment>
      ) : null}
    </AnimatePresence>
  );

  if (!drawerPortalMounted) return null;
  return createPortal(drawerTree, document.body);
}
