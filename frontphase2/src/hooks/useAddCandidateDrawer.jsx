'use client';

import { AddCandidateIsCenteredPopupBlock } from '../components/candidates/addCandidateTabs/IsCenteredPopup';
import { AddCandidateBulkResumeBlock } from '../components/candidates/addCandidateTabs/BulkResume';
import { AddCandidateCsvBlock } from '../components/candidates/addCandidateTabs/Csv';
import { AddCandidateShowAiChatStageBlock } from '../components/candidates/addCandidateTabs/ShowAiChatStage';
import { AddCandidateDuplicateDecisionBlock } from '../components/candidates/addCandidateTabs/DuplicateDecision';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePageDrawerLifecycle } from '../lib/pageDrawerEvents';
import { useBulkCvLeaveGuard, useBulkCvLeaveGuardRegistration } from '../contexts/BulkCvLeaveGuardContext';
import { AlertCircle, Check, ChevronDown, ChevronRight, Download, FileSpreadsheet, FileText, Loader2, Plus, Sparkles, StopCircle, Upload, UserRound, X, ArrowLeft, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { apiBulkCvDownloadStoredFile, apiBulkCvExpandZip, apiBulkCvProcessFile, apiBulkCvReleaseZip, apiBulkCvResolveFailedResumes, apiBulkCvSaveFailedResumes, apiBulkImportCandidates, apiCheckCandidateDuplicate, apiCreateCandidateFromDrawer, apiGetCandidateTagSuggestions, apiGetJobs, apiGetUsers, apiParseCandidateResumeQueued, apiUploadCandidateAvatar, apiUploadCandidateResumeFile } from '@/lib/api';
import { bulkCvPoolSize, getBulkCvApiNode, pickAlternateBulkCvNode, pickBulkCvNodeForWorkItem, pickBulkCvZipNode, resolveBulkCvApiPool } from '@/lib/bulkCvApiPool';
import { getApiErrorMessage, isRetryableApiError, sleep, withApiRetry } from '@/lib/apiNetworkErrors';
import { resolveBulkCvConcurrency, resolveBulkCvInterFileDelayMs, resolveBulkCvMaxRetries, resolveBulkCvRetryBaseDelayMs, resolveBulkCvWorkerStaggerMs } from '@/lib/bulkCvRuntime';
import { EMPTY_EDUCATION_ENTRY, buildEducationSummaryFromCvEntries, educationRowToCvEntry, isGarbageEducationSummary, formatEducationRowSummary, mapParsedEducationToRow } from '@/lib/candidateEducation';
import { MY_JOBS_LIST_PARAMS } from '@/lib/myJobsListParams';
import { addFailedBulkResumeRecordsWithFiles, removeFailedBulkResumesByFileName } from '@/lib/failedBulkResumesStore';
import { AddCandidateFormSections, CANDIDATE_FORM_STEPS, CandidatePhotoUpload } from '../components/candidates/AddCandidateFormSections';
import { CandidateAiChatDrawer } from '../components/candidates/CandidateAiChatDrawer';
import { CANDIDATE_AI_STRING_KEYS } from '@/lib/candidateAiHelpers';
import { appendBulkCvTokenRecord, beginBulkCvTokenSession, getBulkCvTokenSession, normalizeTokenUsageFromApi, stripCvParseMetaFromCandidate, logBulkCvSessionReport } from '@/lib/bulkCvTokensStore';
import { collectBulkCvFilesFromDataTransfer, filterBulkCvFiles } from '@/lib/bulkCvCollect';
import { BULK_CV_ACCEPT_INPUT, BULK_CV_FORMAT_LABEL } from '@/lib/bulkCvFileTypes';
import { releaseScreenWakeLock, requestScreenWakeLock } from '@/lib/screenWakeLock';
import { normalizeCandidateEmailInput, validateCandidateEmail } from '@/lib/candidateEmailValidation';
import { formatDateTimeDMY } from '@/utils/dateDisplay';
import { AddCandidateAiFlowProgress, BROWSER_FILE_PICKER_SOFT_CAP, BULK_CV_DUPLICATE_POLICY_OPTIONS, BULK_CV_DUPLICATE_POLICY_STORAGE_KEY, BULK_CV_PREVIEW_NAME_LIMIT, CURRENCY_OPTIONS, DEFAULT_FORM_DATA, DRAWER_DESCRIPTIONS, DRAWER_TITLES, LINKEDIN_REGEX, MARITAL_STATUS_OPTIONS, MAX_AVATAR_FILE_BYTES, MAX_BULK_CV_FILES_PER_SESSION, MAX_RESUME_FILE_BYTES, MAX_RESUME_FILE_LABEL, METHOD_TABS, PIPELINE_STAGES, PROFICIENCY_OPTIONS, SOURCE_OPTIONS, StepProgress, buildBulkCvWorkItems, extractItems, isPersistableRemoteResumeUrl, mergeBulkCvFiles, normalizeAutoFilledFields, notifyCandidatesChanged, parseCsvContent, readStoredBulkCvDuplicatePolicy, stripDigits, validateNoDigits } from '../components/candidates/addCandidateShared';

export function useAddCandidateDrawer(props) {
  const {
  isOpen,
  onClose,
  onSuccess,
  currentUser,
  initialTab = 'manual',
  defaultJobId = '',
  lockJobSelection = false,
  showMethodTabs = true,
  /** When set (e.g. from Failed resumes → Retry), opens Bulk CV with these files once. */
  pendingBulkRetryFile = null,
  pendingBulkRetryFiles = null,
  /** Server FailedBulkResume ids paired with pendingBulkRetryFiles (same order). */
  pendingBulkRetryServerIds = null,
  onBulkRetryFileConsumed,
  /** Inline bulk CV panel (e.g. /demoAi) — same parse pipeline, no drawer overlay. */
  embeddedBulkCv = false,
  /** Open Create with AI chat first, then continue to the review form. */
  createWithAi = false,
} = props;

usePageDrawerLifecycle(isOpen);
const drawerActive = isOpen || embeddedBulkCv;
const [portalMounted, setPortalMounted] = useState(false);
const [activeTab, setActiveTab] = useState(embeddedBulkCv ? 'bulkResume' : initialTab);
const [aiFlowStage, setAiFlowStage] = useState(null);
const [candidateAiChatHistory, setCandidateAiChatHistory] = useState([]);
useEffect(() => {
    setPortalMounted(true);
  }, []);
const [currentStep, setCurrentStep] = useState(1);
const [avatarFile, setAvatarFile] = useState(null);
const [avatarPreview, setAvatarPreview] = useState('');
const avatarPreviewRef = useRef('');
const [formData, setFormData] = useState(DEFAULT_FORM_DATA);
const validateEmail = useCallback(
    (email) =>
      validateCandidateEmail(email, {
        firstName: formData.firstName,
        lastName: formData.lastName,
      }),
    [formData.firstName, formData.lastName]
  );
const [errors, setErrors] = useState({});
const [parsedResumeFile, setParsedResumeFile] = useState(null);
const [manualResumeFile, setManualResumeFile] = useState(null);
const [parsedData, setParsedData] = useState(null);
const [resumeAnalysis, setResumeAnalysis] = useState(null);
const [autoFilledFields, setAutoFilledFields] = useState({});
const [isLoading, setIsLoading] = useState(false);
const [isSaving, setIsSaving] = useState(false);
const [duplicateWarning, setDuplicateWarning] = useState(null);
const [csvPhase, setCsvPhase] = useState('upload');
const [csvRows, setCsvRows] = useState([]);
const [csvResult, setCsvResult] = useState(null);
const [csvFile, setCsvFile] = useState(null);
const [csvImportProgress, setCsvImportProgress] = useState({ current: 0, total: 0 });
const [jobs, setJobs] = useState([]);
const [recruiters, setRecruiters] = useState([]);
const [tagSuggestions, setTagSuggestions] = useState([]);
const [dataLoaded, setDataLoaded] = useState(false);
const [saveBanner, setSaveBanner] = useState(null);
const [duplicateDecision, setDuplicateDecision] = useState(null);
const [inlineSuccess, setInlineSuccess] = useState('');
const [entryError, setEntryError] = useState('');
const [csvExpanded, setCsvExpanded] = useState(false);
const [bulkResumeFiles, setBulkResumeFiles] = useState([]);
const [bulkCvStoredEntries, setBulkCvStoredEntries] = useState([]);
const [bulkZipExpanding, setBulkZipExpanding] = useState(false);
const [bulkDropActive, setBulkDropActive] = useState(false);
const [bulkResumePhase, setBulkResumePhase] = useState('upload');
const [bulkResumeProgress, setBulkResumeProgress] = useState({ current: 0, total: 0 });
const [bulkResumeResults, setBulkResumeResults] = useState([]);
const [bulkCvSummary, setBulkCvSummary] = useState(null);
const [bulkResumeStopRequested, setBulkResumeStopRequested] = useState(false);
const bulkResumeStopRequestedRef = useRef(false);
const leaveGuard = useBulkCvLeaveGuard();
const stopBulkParsingRef = useRef(() => {});
const bulkResumeAbortRef = useRef(null);
const bulkRetryServerIdsRef = useRef([]);
const bulkCvSocketRef = useRef(null);
const bulkCvSocketsRef = useRef([]);
const bulkCvZipNodeIndexRef = useRef(null);
const bulkCvFileNodeIndexRef = useRef(new Map());
const bulkCvSessionIdRef = useRef('');
const bulkCvCurrentFileIndexRef = useRef(-1);
const bulkCvDupQueueRef = useRef([]);
const bulkCvDupShowingRef = useRef(false);
const bulkCvDupAwaitingIndicesRef = useRef(new Set());
const bulkCvAddMoreInputRef = useRef(null);
const bulkCvFolderInputRef = useRef(null);
const bulkCvZipInputRef = useRef(null);
const [bulkDuplicateModal, setBulkDuplicateModal] = useState(null);
const [bulkCvDuplicatePolicy, setBulkCvDuplicatePolicy] = useState(readStoredBulkCvDuplicatePolicy);
const bulkCvDuplicatePolicyRef = useRef(bulkCvDuplicatePolicy);
const fieldRefs = useRef({});
const importProgressRef = useRef(null);
const resumeFileRef = useRef(null);
const formScrollRef = useRef(null);
const normalizedDefaultJobId = String(defaultJobId || '').trim();
useEffect(() => {
    bulkCvDuplicatePolicyRef.current = bulkCvDuplicatePolicy;
  }, [bulkCvDuplicatePolicy]);
const setBulkCvDuplicatePolicyPersisted = (policyId) => {
    if (!BULK_CV_DUPLICATE_POLICY_OPTIONS.some((opt) => opt.id === policyId)) return;
    setBulkCvDuplicatePolicy(policyId);
    try {
      window.localStorage.setItem(BULK_CV_DUPLICATE_POLICY_STORAGE_KEY, policyId);
    } catch {
      /* ignore */
    }
  };
const emitBulkCvDuplicateDecision = (fileIndex, decision) => {
    const sid = bulkCvSessionIdRef.current;
    if (!sid || fileIndex === undefined || fileIndex === null) return;
    const nodeIndex = bulkCvFileNodeIndexRef.current.get(fileIndex) ?? 0;
    const socket = bulkCvSocketsRef.current[nodeIndex] || bulkCvSocketRef.current;
    try {
      socket?.emit('duplicate_decision', { sessionId: sid, fileIndex, decision });
    } catch {
      /* ignore */
    }
  };
const autoRespondBulkDuplicate = (payload, decision) => {
    const fileIndex = payload?.fileIndex;
    if (fileIndex !== undefined && fileIndex !== null) {
      bulkCvDupAwaitingIndicesRef.current.delete(fileIndex);
    }
    emitBulkCvDuplicateDecision(fileIndex, decision);
  };
const handleBulkCvDuplicateFound = (payload) => {
    const policy = bulkCvDuplicatePolicyRef.current;
    if (policy && policy !== 'ask') {
      autoRespondBulkDuplicate(payload, policy);
      return;
    }
    if (payload?.fileIndex !== undefined && payload?.fileIndex !== null) {
      bulkCvDupAwaitingIndicesRef.current.add(payload.fileIndex);
    }
    if (!bulkCvDupShowingRef.current) {
      bulkCvDupShowingRef.current = true;
      setBulkDuplicateModal(payload);
    } else {
      bulkCvDupQueueRef.current.push(payload);
    }
  };
useEffect(() => {
    const node = formScrollRef.current;
    if (!node || typeof node.scrollTo !== 'function') return;
    node.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentStep, activeTab]);
useEffect(() => {
    resumeFileRef.current = manualResumeFile || parsedResumeFile;
  }, [manualResumeFile, parsedResumeFile]);
const selectedJob = useMemo(() => jobs.find((job) => job.id === formData.jobId) || null, [jobs, formData.jobId]);
const selectedRecruiter = useMemo(
    () => recruiters.find((recruiter) => recruiter.id === formData.recruiterId) || null,
    [recruiters, formData.recruiterId]
  );
useEffect(() => {
    if (!drawerActive) {
      setDataLoaded(false);
    }
  }, [drawerActive]);
useEffect(() => {
    if (!drawerActive) return;
    if (embeddedBulkCv) {
      setActiveTab('bulkResume');
      return;
    }
    setActiveTab(initialTab || 'manual');
  }, [initialTab, drawerActive, embeddedBulkCv]);
useEffect(() => {
    if (!drawerActive) {
      setAiFlowStage(null);
      setCandidateAiChatHistory([]);
      return;
    }
    if (createWithAi && !embeddedBulkCv && (initialTab || 'manual') === 'manual') {
      setAiFlowStage((prev) => prev || 'chat');
      return;
    }
    setAiFlowStage(null);
  }, [drawerActive, createWithAi, initialTab, embeddedBulkCv]);
useEffect(() => {
    if (!drawerActive) return;
    const multi =
      Array.isArray(pendingBulkRetryFiles) && pendingBulkRetryFiles.length
        ? pendingBulkRetryFiles.filter((f) => f instanceof File)
        : null;
    const single = pendingBulkRetryFile instanceof File ? [pendingBulkRetryFile] : null;
    const files = multi?.length ? multi : single;
    if (!files?.length) return;
    const serverIds = Array.isArray(pendingBulkRetryServerIds) ? pendingBulkRetryServerIds : [];
    bulkRetryServerIdsRef.current = serverIds.filter(Boolean);
    setEntryError('');
    setActiveTab('bulkResume');
    setBulkResumeFiles(files);
    setBulkCvStoredEntries([]);
    setBulkResumePhase('preview');
    setBulkResumeResults([]);
    setBulkCvSummary(null);
    setBulkResumeProgress({ current: 0, total: files.length });
    if (typeof onBulkRetryFileConsumed === 'function') {
      onBulkRetryFileConsumed();
    }
  }, [
    drawerActive,
    pendingBulkRetryFile,
    pendingBulkRetryFiles,
    pendingBulkRetryServerIds,
    onBulkRetryFileConsumed,
  ]);
useEffect(() => {
    if (!drawerActive || !normalizedDefaultJobId) return;
    setFormData((prev) => ({ ...prev, jobId: normalizedDefaultJobId }));
  }, [drawerActive, normalizedDefaultJobId]);
useEffect(() => {
    if (!drawerActive || dataLoaded) return;

    let ignore = false;
    async function loadOptions() {
      try {
        const [jobsRes, recruitersRes, tagsRes] = await Promise.all([
          apiGetJobs(MY_JOBS_LIST_PARAMS),
          apiGetUsers({ role: 'RECRUITER', isActive: true, limit: 100 }),
          apiGetCandidateTagSuggestions(),
        ]);

        if (ignore) return;
        setJobs(extractItems(jobsRes.data).map((job) => ({
          id: job.id,
          title: job.title,
          department: job.department || job.client?.companyName || 'General',
        })));
        setRecruiters(extractItems(recruitersRes.data).map((user) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
        })));
        setTagSuggestions(extractItems(tagsRes.data));
        setDataLoaded(true);
      } catch (loadError) {
        console.error('Failed to load add-candidate options:', loadError);
      }
    }

    loadOptions();
    return () => {
      ignore = true;
    };
  }, [dataLoaded, isOpen]);
useEffect(() => {
    if (!formData.recruiterId && currentUser?._id) {
      setFormData((prev) => ({ ...prev, recruiterId: currentUser._id }));
    }
  }, [currentUser, formData.recruiterId]);
useEffect(() => {
    if (!drawerActive) {
      clearInterval(importProgressRef.current);
    }
  }, [drawerActive]);
const resetForNext = (nextTab = activeTab) => {
    setCurrentStep(1);
    if (avatarPreviewRef.current) {
      URL.revokeObjectURL(avatarPreviewRef.current);
      avatarPreviewRef.current = '';
    }
    setAvatarFile(null);
    setAvatarPreview('');
    setFormData({
      ...DEFAULT_FORM_DATA,
      recruiterId: currentUser?._id || '',
      jobId: normalizedDefaultJobId || '',
    });
    setErrors({});
    setParsedResumeFile(null);
    setManualResumeFile(null);
    resumeFileRef.current = null;
    setParsedData(null);
    setResumeAnalysis(null);
    setAutoFilledFields({});
    setDuplicateWarning(null);
    setSaveBanner(null);
    setDuplicateDecision(null);
    setInlineSuccess('');
    setEntryError('');
    setCsvPhase('upload');
    setCsvRows([]);
    setCsvResult(null);
    setCsvFile(null);
    setCsvExpanded(false);
    setCsvImportProgress({ current: 0, total: 0 });
    setBulkResumeFiles([]);
    setBulkCvStoredEntries([]);
    setBulkZipExpanding(false);
    setBulkDropActive(false);
    const zipSession = bulkCvSessionIdRef.current;
    if (zipSession) {
      apiBulkCvReleaseZip(zipSession).catch(() => {});
    }
    setBulkResumePhase('upload');
    setBulkResumeProgress({ current: 0, total: 0 });
    setBulkResumeResults([]);
    setBulkResumeStopRequested(false);
    bulkResumeStopRequestedRef.current = false;
    // Abort any leftover in-flight import (defensive: resetForNext is also called
    // on tab change / close, and we don't want a stale controller to silently keep
    // running on the network).
    try {
      bulkResumeAbortRef.current?.abort();
    } catch (_abortError) {
      // ignore
    }
    bulkResumeAbortRef.current = null;
    for (const socket of bulkCvSocketsRef.current || []) {
      try {
        socket?.disconnect();
      } catch (_e) {
        /* ignore */
      }
    }
    bulkCvSocketsRef.current = [];
    bulkCvSocketRef.current = null;
    bulkCvZipNodeIndexRef.current = null;
    bulkCvFileNodeIndexRef.current.clear();
    bulkCvSessionIdRef.current = '';
    bulkCvCurrentFileIndexRef.current = -1;
    bulkCvDupQueueRef.current = [];
    bulkCvDupShowingRef.current = false;
    bulkCvDupAwaitingIndicesRef.current.clear();
    setBulkDuplicateModal(null);
    if (nextTab) setActiveTab(nextTab);
  };
const isBulkResumeBusy = activeTab === 'bulkResume' && bulkResumePhase === 'importing';
const stopBulkResumeParsing = useCallback(() => {
    if (!bulkResumeStopRequestedRef.current) {
      bulkResumeStopRequestedRef.current = true;
      setBulkResumeStopRequested(true);
    }
    const indices = new Set(bulkCvDupAwaitingIndicesRef.current);
    const modalIdx = bulkDuplicateModal?.fileIndex;
    if (modalIdx !== undefined && modalIdx !== null) indices.add(modalIdx);
    bulkCvDupQueueRef.current.forEach((p) => {
      if (p?.fileIndex !== undefined && p?.fileIndex !== null) indices.add(p.fileIndex);
    });
    for (const fileIndex of indices) {
      emitBulkCvDuplicateDecision(fileIndex, 'cancel');
    }
    bulkCvDupAwaitingIndicesRef.current.clear();
    bulkCvDupQueueRef.current = [];
    bulkCvDupShowingRef.current = false;
    setBulkDuplicateModal(null);
    try {
      bulkResumeAbortRef.current?.abort();
    } catch (_abortError) {
      /* ignore */
    }
  }, [bulkDuplicateModal?.fileIndex]);
stopBulkParsingRef.current = stopBulkResumeParsing;
useBulkCvLeaveGuardRegistration(
    isBulkResumeBusy
      ? {
          active: true,
          progress: bulkResumeProgress,
          onStop: () => stopBulkParsingRef.current(),
        }
      : null
  );
useEffect(() => {
    if (!isBulkResumeBusy || typeof navigator === 'undefined') return undefined;

    let cancelled = false;
    let sentinel = null;

    const acquire = async () => {
      if (cancelled || document.visibilityState !== 'visible') return;
      await releaseScreenWakeLock(sentinel);
      sentinel = await requestScreenWakeLock();
      if (cancelled) {
        await releaseScreenWakeLock(sentinel);
        sentinel = null;
      }
    };

    void acquire();

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void acquire();
    };

    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      void releaseScreenWakeLock(sentinel);
      sentinel = null;
    };
  }, [isBulkResumeBusy]);
const completeDrawerClose = () => {
    resetForNext(embeddedBulkCv ? 'bulkResume' : activeTab);
    if (embeddedBulkCv) {
      onSuccess?.(null);
      return;
    }
    onClose();
  };
const handleDrawerClose = () => {
    if (isBulkResumeBusy) {
      leaveGuard.requestLeave({
        leaveActionLabel: 'close',
        onConfirmed: completeDrawerClose,
      });
      return;
    }
    completeDrawerClose();
  };
const handleStopBulkResume = () => {
    if (!isBulkResumeBusy || bulkResumeStopRequestedRef.current) return;
    stopBulkResumeParsing();
  };
const handleTabChange = (nextTab) => {
    if (nextTab === activeTab) return;
    if (isBulkResumeBusy) {
      leaveGuard.requestLeave({
        leaveActionLabel: 'switch tabs',
        onConfirmed: () => resetForNext(nextTab),
      });
      return;
    }
    resetForNext(nextTab);
  };
const handleDownloadCsvTemplate = async () => {
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '') || 'http://localhost:5001/api/v1';
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      const response = await fetch(`${apiBase}/candidates/bulk-import/template`, {
        method: 'GET',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (!response.ok) {
        throw new Error(`Failed to download template (${response.status})`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'candidate_import_template.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error?.message || 'Failed to download CSV template');
    }
  };
const updateFormData = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    setAutoFilledFields((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
    setErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
    setInlineSuccess('');
  };
const applyCandidateAiPatch = (generated) => {
    if (!generated || typeof generated !== 'object') return;
    setFormData((prev) => {
      const next = { ...prev };
      CANDIDATE_AI_STRING_KEYS.forEach((key) => {
        const val = generated[key];
        if (val != null && String(val).trim()) next[key] = String(val).trim();
      });
      if (Array.isArray(generated.skills) && generated.skills.length) {
        next.skills = generated.skills.map((item) => String(item).trim()).filter(Boolean);
      }
      if (!String(next.location || '').trim() && next.cityState) {
        next.location = next.cityState;
      }
      return next;
    });
    setAutoFilledFields((prev) => ({ ...prev, ...normalizeAutoFilledFields(generated) }));
  };
const scrollToField = (fieldName) => {
    const node = fieldRefs.current[fieldName];
    if (node && typeof node.scrollIntoView === 'function') {
      node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (typeof node.focus === 'function') node.focus();
    }
  };
const validateForm = () => {
    const nextErrors = {};
    const firstNameCheck = validateNoDigits(formData.firstName, 'First name');
    if (!firstNameCheck.valid) nextErrors.firstName = firstNameCheck.message;

    const lastNameCheck = validateNoDigits(formData.lastName, 'Last name');
    if (!lastNameCheck.valid) nextErrors.lastName = lastNameCheck.message;

    if (!formData.email.trim()) {
      nextErrors.email = 'Email is required';
    } else {
      const result = validateEmail(formData.email.trim());
      if (!result.valid) {
        nextErrors.email = result.message;
      }
    }

    const companyCheck = validateNoDigits(formData.currentCompany, 'Current company');
    if (formData.currentCompany.trim() && !companyCheck.valid) {
      nextErrors.currentCompany = companyCheck.message;
    }
    if (formData.phone && !/^\d{7,15}$/.test(formData.phone.trim())) {
      nextErrors.phone = 'Phone must be 7-15 digits';
    }
    const experience = Number(formData.experience);
    if (formData.experience !== '' && !Number.isNaN(experience) && (experience < 0 || experience > 50)) {
      nextErrors.experience = 'Experience must be between 0 and 50';
    }
    if (formData.linkedinUrl && !LINKEDIN_REGEX.test(formData.linkedinUrl.trim())) {
      nextErrors.linkedinUrl = 'Enter a valid LinkedIn URL';
    }
    if (!formData.source) {
      nextErrors.source = 'Source is required';
    }
    if (formData.expectedSalary && Number(formData.expectedSalary) <= 0) {
      nextErrors.expectedSalary = 'Salary must be a positive number';
    }
    if (formData.website && !/^https?:\/\//i.test(formData.website.trim())) {
      nextErrors.website = 'Website URL must start with http:// or https://';
    }
    if (formData.skills.length > 10) {
      nextErrors.skills = 'Maximum 10 skills allowed';
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      const firstKey = Object.keys(nextErrors)[0];
      scrollToField(firstKey);
      return false;
    }
    return true;
  };
const validateStep = (step) => {
    if (step === 5) {
      return validateForm();
    }

    const nextErrors = {};

    if (step === 1) {
      const firstNameCheck = validateNoDigits(formData.firstName, 'First name');
      if (!firstNameCheck.valid) nextErrors.firstName = firstNameCheck.message;

      const lastNameCheck = validateNoDigits(formData.lastName, 'Last name');
      if (!lastNameCheck.valid) nextErrors.lastName = lastNameCheck.message;

      if (!formData.email.trim()) {
        nextErrors.email = 'Email is required';
      } else {
        const result = validateEmail(formData.email.trim());
        if (!result.valid) {
          nextErrors.email = result.message;
        }
      }
      if (formData.phone && !/^\d{7,15}$/.test(formData.phone.trim())) {
        nextErrors.phone = 'Phone must be 7-15 digits';
      }
    }

    if (step === 3) {
      const companyCheck = validateNoDigits(formData.currentCompany, 'Current company');
      if (formData.currentCompany.trim() && !companyCheck.valid) {
        nextErrors.currentCompany = companyCheck.message;
      }
      const experience = Number(formData.experience);
      if (formData.experience !== '' && !Number.isNaN(experience) && (experience < 0 || experience > 50)) {
        nextErrors.experience = 'Experience must be between 0 and 50';
      }
      if (!formData.source) {
        nextErrors.source = 'Source is required';
      }
      if (formData.expectedSalary && Number(formData.expectedSalary) <= 0) {
        nextErrors.expectedSalary = 'Salary must be a positive number';
      }
    }

    if (step === 4) {
      if (formData.linkedinUrl && !LINKEDIN_REGEX.test(formData.linkedinUrl.trim())) {
        nextErrors.linkedinUrl = 'Enter a valid LinkedIn URL';
      }
      if (formData.website && !/^https?:\/\//i.test(formData.website.trim())) {
        nextErrors.website = 'Website URL must start with http:// or https://';
      }
    }

    setErrors(nextErrors);
    const firstError = Object.keys(nextErrors)[0];
    if (firstError) {
      scrollToField(firstError);
      return false;
    }
    return true;
  };
const handleAvatarFile = (file) => {
    if (!file) return;
    if (file.size > MAX_AVATAR_FILE_BYTES) {
      toast.error('Photo must be 5MB or smaller.');
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file.');
      return;
    }
    if (avatarPreviewRef.current) {
      URL.revokeObjectURL(avatarPreviewRef.current);
    }
    const preview = URL.createObjectURL(file);
    avatarPreviewRef.current = preview;
    setAvatarPreview(preview);
    setAvatarFile(file);
  };
const clearAvatarFile = () => {
    if (avatarPreviewRef.current) {
      URL.revokeObjectURL(avatarPreviewRef.current);
      avatarPreviewRef.current = '';
    }
    setAvatarPreview('');
    setAvatarFile(null);
    updateFormData('avatar', '');
  };
const uploadCandidateAvatar = async (candidateId, file) => {
    const response = await apiUploadCandidateAvatar(candidateId, file);
    const data = response?.data;
    return (
      (typeof data === 'object' && data?.fileUrl) ||
      (typeof data === 'string' ? data : null) ||
      null
    );
  };
const handleDuplicateCheck = async (field) => {
    if (field !== 'email') return;
    const value = formData.email.trim();
    if (!value) return;
    if (!validateEmail(value).valid) return;

    try {
      const response = await apiCheckCandidateDuplicate({ email: value });
      const payload = response.data;
      if (payload?.isDuplicate) {
        setDuplicateWarning({ field: 'email', ...payload });
        setDuplicateDecision({
          field: 'email',
          source: 'field',
          mode: 'save',
          candidate: payload.candidate || null,
          message: 'A candidate with this email address already exists (exact match, ignoring case and spaces).',
          canUpdate: true,
          canCreateAnyway: true,
        });
      } else if (duplicateWarning?.field === 'email') {
        setDuplicateWarning(null);
      }
    } catch (error) {
      console.error('Duplicate check failed:', error);
    }
  };
const applyImportedData = (data, sourceType, file = null) => {
    const derivedLocation =
      data.location ||
      [data.city, data.country]
        .map((value) => String(value || '').trim())
        .filter(Boolean)
        .join(', ');
    const importedSummary = String(data.summary || '').trim();

    const nextData = {
      firstName: data.firstName || '',
      lastName: data.lastName || '',
      email:
        normalizeCandidateEmailInput(data.email, {
          firstName: data.firstName,
          lastName: data.lastName,
        }) || '',
      phone: String(data.phone || '').replace(/[^\d]/g, ''),
      currentCompany: data.currentCompany || '',
      currentDesignation: data.currentDesignation || data.designation || '',
      experience: data.experience ?? '',
      cityState: derivedLocation,
      location: derivedLocation,
      address: data.address || '',
      linkedinUrl: data.linkedinUrl || '',
      website: data.website || data.portfolioUrl || '',
      portfolioUrl: data.portfolioUrl || '',
      educationEntries: Array.isArray(data.educationEntries) && data.educationEntries.length
        ? data.educationEntries.map((entry) => mapParsedEducationToRow(entry))
        : data.education
          ? [{ ...EMPTY_EDUCATION_ENTRY, qualification: data.education }]
          : [{ ...EMPTY_EDUCATION_ENTRY }],
      summary: importedSummary,
      workHistory: Array.isArray(data.workExperienceEntries)
        ? data.workExperienceEntries
            .map((entry) =>
              [entry.title, entry.company, entry.startDate, entry.endDate].filter(Boolean).join(' · ')
            )
            .join('\n')
        : '',
      educationHistory: Array.isArray(data.educationEntries)
        ? data.educationEntries
            .map((entry) => formatEducationRowSummary(mapParsedEducationToRow(entry)))
            .filter(Boolean)
            .join('\n')
        : '',
      certificates: Array.isArray(data.certifications) ? data.certifications.slice(0, 15) : [],
      languageEntries: Array.isArray(data.languages)
        ? data.languages.slice(0, 10).map((lang) => {
            const text = String(lang);
            const match = text.match(/^(.+?)\s*\((.+)\)$/);
            return match
              ? { language: match[1].trim(), proficiency: match[2].trim() }
              : { language: text, proficiency: 'Conversational' };
          })
        : [],
      source: data.source || 'Other',
      priority: data.priority || 'Medium',
      expectedSalary: data.expectedSalary || '',
      currency: data.currency || 'INR',
      noticePeriod: data.noticePeriod || 'Immediate',
      skills: Array.isArray(data.skills) ? data.skills.slice(0, 10) : [],
      tags: Array.isArray(data.tags) ? data.tags.slice(0, 10) : [],
      initialNote: importedSummary,
      avatar:
        typeof data.profilePhotoUrl === 'string' && data.profilePhotoUrl.trim()
          ? data.profilePhotoUrl.trim()
          : typeof data.avatar === 'string' && data.avatar.trim()
            ? data.avatar.trim()
            : '',
    };

    setFormData((prev) => ({
      ...prev,
      ...nextData,
      source: prev.source || nextData.source,
      initialNote: prev.initialNote || nextData.initialNote,
    }));
    const importedAvatar = nextData.avatar;
    if (importedAvatar && /^https?:\/\//i.test(importedAvatar)) {
      if (avatarPreviewRef.current && avatarPreviewRef.current.startsWith('blob:')) {
        URL.revokeObjectURL(avatarPreviewRef.current);
      }
      avatarPreviewRef.current = '';
      setAvatarPreview(importedAvatar);
      setAvatarFile(null);
    }
    setParsedData(data);
    setResumeAnalysis(null);
    setAutoFilledFields(normalizeAutoFilledFields(nextData));
    if (file) {
      resumeFileRef.current = file;
      setParsedResumeFile(file);
    }
    // Skip the AI score / extracted-data review — jump straight to the editable form.
    if (!embeddedBulkCv) {
      setActiveTab('manual');
      setCurrentStep(1);
    }
  };
const handleResumeFile = async (file) => {
    if (!file) return;
    if (file.size > MAX_RESUME_FILE_BYTES) {
      setEntryError(`Resume must be ${MAX_RESUME_FILE_LABEL} or smaller.`);
      return;
    }

    setIsLoading(true);
    setEntryError('');
    try {
      const response = await apiParseCandidateResumeQueued(file);
      applyImportedData(response.data, 'resume', file);
    } catch (error) {
      setEntryError(error.message || 'Could not parse resume. Try again.');
    } finally {
      setIsLoading(false);
    }
  };
const handleCsvSelected = async (file) => {
    if (!file) return;
    const content = await file.text();
    const rows = parseCsvContent(content);
    setCsvFile(file);

    const previewRows = await Promise.all(
      rows.map(async (row, index) => {
        const missingRequired = !String(row.firstName || '').trim() || !String(row.email || '').trim();
        if (missingRequired) {
          return { ...row, __index: index + 1, __status: 'Missing fields' };
        }

        try {
          const duplicateRes = await apiCheckCandidateDuplicate({ email: row.email });
          if (duplicateRes.data?.isDuplicate) {
            return { ...row, __index: index + 1, __status: 'Duplicate' };
          }
        } catch (error) {
          console.error('Duplicate preview check failed:', error);
        }

        return { ...row, __index: index + 1, __status: 'Ready' };
      })
    );

    setCsvRows(previewRows);
    setCsvPhase('preview');
  };
const handleBulkImport = async () => {
    if (!csvFile) return;
    const readyCount = csvRows.filter((row) => row.__status === 'Ready').length;
    setCsvPhase('importing');
    setCsvImportProgress({ current: 0, total: readyCount });

    importProgressRef.current = window.setInterval(() => {
      setCsvImportProgress((prev) => ({
        ...prev,
        current: prev.current < prev.total ? prev.current + 1 : prev.current,
      }));
    }, 120);

    try {
      const response = await apiBulkImportCandidates(csvFile);
      clearInterval(importProgressRef.current);
      setCsvImportProgress({ current: readyCount, total: readyCount });
      setCsvResult(response.data);
      setCsvPhase('complete');
      toast.success(`${response.data.created} candidates imported successfully`);
      notifyCandidatesChanged();
      onSuccess?.(null);
    } catch (error) {
      clearInterval(importProgressRef.current);
      setCsvPhase('preview');
      setEntryError(error.message || 'Bulk import failed');
    }
  };
const looksLikePersonNameClient = (value) => {
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
const deriveBulkResumeIdentity = (parsed, file) => {
    let firstName = String(parsed?.firstName || '').trim();
    let lastName = String(parsed?.lastName || '').trim();
    const trimmedEmail = normalizeCandidateEmailInput(parsed?.email, { firstName, lastName });
    const identity = {
      firstName,
      lastName,
      email: trimmedEmail || null,
      syntheticName: false,
    };

    const full = [identity.firstName, identity.lastName].filter(Boolean).join(' ').trim();
    if (!identity.firstName || !identity.lastName || !looksLikePersonNameClient(full)) {
      const base = String(file?.name || '')
        .replace(/\.[^.]+$/, '')
        .replace(/^[0-9_,\-\s]+/, '')
        .replace(/\bcopy\s*\d*\b/gi, ' ')
        .replace(/(^|\s)(cv|resume|curriculum|vitae|certificate|certificates|obtained)\b/gi, ' ')
        .replace(/[_,\-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const tokens = base.split(' ').filter(Boolean);
      const fromFile = tokens.join(' ');
      if (looksLikePersonNameClient(fromFile)) {
        identity.firstName = tokens[0] || 'Unknown';
        identity.lastName = tokens.slice(1).join(' ') || 'Candidate';
      } else {
        identity.firstName = 'Unknown';
        identity.lastName = 'Candidate';
      }
      identity.syntheticName = true;
    }

    return identity;
  };
const buildBulkResumePayload = (parsedCandidate) => {
    const candidate = stripCvParseMetaFromCandidate(parsedCandidate || {});
    const preferredLocation =
      candidate.location ||
      [candidate.city, candidate.country].filter(Boolean).join(', ') ||
      undefined;

    const rawEmail = candidate.email;
    const trimmedEmail =
      rawEmail === undefined || rawEmail === null
        ? ''
        : normalizeCandidateEmailInput(rawEmail, {
            firstName: candidate.firstName,
            lastName: candidate.lastName,
          });

    const pipelineExtra =
      candidate.extraData?.pipeline && typeof candidate.extraData.pipeline === 'object'
        ? candidate.extraData.pipeline
        : null;

    return {
      firstName: candidate.firstName || '',
      lastName: candidate.lastName || '',
      email: trimmedEmail === '' ? null : trimmedEmail,
      phone: candidate.phone ? String(candidate.phone).trim() : undefined,
      address: candidate.address || candidate.addressLine || undefined,
      city: candidate.city || undefined,
      country: candidate.country || undefined,
      currentCompany: candidate.currentCompany || undefined,
      currentDesignation: candidate.currentDesignation || candidate.designation || undefined,
      designation: candidate.currentDesignation || candidate.designation || undefined,
      experience:
        candidate.experience === '' || candidate.experience == null
          ? 0
          : Number(candidate.experience) || 0,
      location: preferredLocation || undefined,
      linkedinUrl: candidate.linkedinUrl || undefined,
      website: candidate.website || candidate.githubUrl || undefined,
      rating: candidate.rating ?? candidate.score?.overall ?? undefined,
      // Bulk CV: pool-only — no job, owner, or pipeline stage until assigned later.
      source: 'Bulk CV Upload',
      priority: candidate.priority || 'Medium',
      tags: ['New'],
      expectedSalary:
        candidate.expectedSalary == null || candidate.expectedSalary === ''
          ? undefined
          : Number(candidate.expectedSalary),
      currentSalary:
        candidate.currentSalary == null || candidate.currentSalary === ''
          ? undefined
          : Number(candidate.currentSalary),
      currency: candidate.currency || undefined,
      portfolioUrl: candidate.portfolioUrl || undefined,
      education: (() => {
        const fromEntries = buildEducationSummaryFromCvEntries(candidate.educationEntries);
        if (fromEntries) return fromEntries;
        const raw = String(candidate.education || '').trim();
        return raw && !isGarbageEducationSummary(raw) ? raw : undefined;
      })(),
      certifications: Array.isArray(candidate.certifications) ? candidate.certifications : undefined,
      languages: Array.isArray(candidate.languages) ? candidate.languages : undefined,
      notes: candidate.summary || undefined,
      cvSummary: candidate.summary || undefined,
      cvEducationEntries: Array.isArray(candidate.educationEntries) ? candidate.educationEntries : undefined,
      cvWorkExperienceEntries: Array.isArray(candidate.workExperienceEntries)
        ? candidate.workExperienceEntries
        : undefined,
      cvPortfolioLinks: (() => {
        const raw = Array.isArray(candidate.portfolioLinks) ? [...candidate.portfolioLinks] : [];
        if (candidate.githubUrl && !raw.some((l) => String(l?.url || '').includes('github.com'))) {
          raw.push({ type: 'GitHub', url: candidate.githubUrl });
        }
        return raw.length ? raw : undefined;
      })(),
      extraData:
        candidate.extraData && typeof candidate.extraData === 'object' && !Array.isArray(candidate.extraData)
          ? {
              ...candidate.extraData,
              pipeline: pipelineExtra || candidate.extraData.pipeline,
            }
          : pipelineExtra
            ? { pipeline: pipelineExtra }
            : undefined,
      preferredLocation,
      noticePeriod: candidate.noticePeriod || undefined,
      skills: Array.isArray(candidate.skills) ? candidate.skills.slice(0, 10) : undefined,
      resume: candidate.resumeUrl || undefined,
      avatar: (() => {
        const u = String(candidate.profilePhotoUrl || candidate.avatar || '').trim();
        return /^https?:\/\//i.test(u) ? u : undefined;
      })(),
      duplicateAction: 'create',
    };
  };
const applyBulkCvFileSelection = (fileList, { append = false, clearZip = false } = {}) => {
    const incoming = filterBulkCvFiles(Array.from(fileList || []).filter(Boolean));
    if (!incoming.length) return;

    const storedBase = append && !clearZip ? bulkCvStoredEntries : clearZip ? [] : bulkCvStoredEntries;
    if (clearZip && bulkCvStoredEntries.length && bulkCvSessionIdRef.current) {
      const zipNode =
        bulkCvZipNodeIndexRef.current != null
          ? getBulkCvApiNode(bulkCvZipNodeIndexRef.current)
          : pickBulkCvZipNode();
      apiBulkCvReleaseZip(bulkCvSessionIdRef.current, { apiBase: zipNode.apiBase }).catch(() => {});
      bulkCvSessionIdRef.current = '';
      bulkCvZipNodeIndexRef.current = null;
    }
    if (clearZip) setBulkCvStoredEntries([]);

    const base = append ? bulkResumeFiles : [];
    const { merged, added, skippedDup, skippedLarge } = mergeBulkCvFiles(base, incoming);
    const totalCount = storedBase.length + merged.length;

    if (!totalCount) {
      setEntryError(
        skippedLarge
          ? `All selected files exceed ${MAX_RESUME_FILE_LABEL} each.`
          : `No valid CV files selected (${BULK_CV_FORMAT_LABEL}).`
      );
      return;
    }

    if (totalCount > MAX_BULK_CV_FILES_PER_SESSION) {
      setEntryError(
        `Maximum ${MAX_BULK_CV_FILES_PER_SESSION} CVs per session (you have ${totalCount}). Remove some or split into multiple runs.`
      );
      const allowedLocal = Math.max(0, MAX_BULK_CV_FILES_PER_SESSION - storedBase.length);
      setBulkResumeFiles(merged.slice(0, allowedLocal));
      setBulkCvStoredEntries(storedBase);
      setBulkResumePhase('preview');
      setBulkResumeProgress({ current: 0, total: MAX_BULK_CV_FILES_PER_SESSION });
      return;
    }

    const parts = [];
    if (skippedLarge) {
      parts.push(`${skippedLarge} skipped (over ${MAX_RESUME_FILE_LABEL})`);
    }
    if (skippedDup) {
      parts.push(`${skippedDup} duplicate(s) skipped`);
    }
    if (!append && incoming.length >= BROWSER_FILE_PICKER_SOFT_CAP) {
      parts.push(
        `Browser may cap one picker at ~${BROWSER_FILE_PICKER_SOFT_CAP} files — use “Add more CVs” in preview to add another batch`
      );
    }
    if (append && added === 0 && !skippedLarge) {
      parts.push('No new files added (already in list)');
    }

    setEntryError(parts.length ? parts.join(' · ') : '');
    setBulkCvStoredEntries(storedBase);
    setBulkResumeFiles(merged);
    setBulkResumePhase('preview');
    setBulkResumeResults([]);
    setBulkCvSummary(null);
    setBulkResumeProgress({ current: 0, total: totalCount });

    if (append && added > 0) {
      toast.success(`Added ${added} more CV${added === 1 ? '' : 's'} (${totalCount} total)`);
    }
  };
const handleBulkResumeSelected = (fileList) => {
    applyBulkCvFileSelection(fileList, { append: false, clearZip: true });
  };
const handleBulkResumeAddMore = (fileList) => {
    applyBulkCvFileSelection(fileList, { append: true });
    if (bulkCvAddMoreInputRef.current) {
      bulkCvAddMoreInputRef.current.value = '';
    }
  };
const handleBulkResumeFolderSelected = (fileList) => {
    applyBulkCvFileSelection(fileList, { append: false, clearZip: true });
    if (bulkCvFolderInputRef.current) bulkCvFolderInputRef.current.value = '';
  };
const handleBulkResumeZipSelected = async (fileList) => {
    const zip = Array.from(fileList || []).find((f) => /\.zip$/i.test(f?.name || ''));
    if (!zip) {
      setEntryError(`Please choose a .zip archive containing ${BULK_CV_FORMAT_LABEL} files.`);
      return;
    }
    setBulkZipExpanding(true);
    setEntryError('');
    try {
      if (bulkCvSessionIdRef.current) {
        const prevZipNode =
          bulkCvZipNodeIndexRef.current != null
            ? getBulkCvApiNode(bulkCvZipNodeIndexRef.current)
            : pickBulkCvZipNode();
        await apiBulkCvReleaseZip(bulkCvSessionIdRef.current, { apiBase: prevZipNode.apiBase }).catch(
          () => {}
        );
      }
      const sessionId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
      bulkCvSessionIdRef.current = sessionId;
      const zipNode = pickBulkCvZipNode();
      bulkCvZipNodeIndexRef.current = zipNode.index;
      const res = await apiBulkCvExpandZip(zip, sessionId, { apiBase: zipNode.apiBase });
      const data = res.data || {};
      const files = Array.isArray(data.files) ? data.files : [];
      setBulkResumeFiles([]);
      setBulkCvStoredEntries(files);
      setBulkResumePhase('preview');
      setBulkResumeResults([]);
      setBulkCvSummary(null);
      setBulkResumeProgress({ current: 0, total: files.length });
      const skipped = Number(data.skipped) || 0;
      toast.success(
        `ZIP ready: ${files.length} CV${files.length === 1 ? '' : 's'}${skipped ? ` (${skipped} entries skipped)` : ''}`
      );
      if (files.length >= 500) {
        setEntryError(
          `Large batch (${files.length} files). Processing may take hours — keep this tab open. OpenAI/Mistral quota applies.`
        );
      }
    } catch (err) {
      setEntryError(err?.message || 'Failed to extract ZIP');
    } finally {
      setBulkZipExpanding(false);
      if (bulkCvZipInputRef.current) bulkCvZipInputRef.current.value = '';
    }
  };
const handleBulkResumeDrop = async (event) => {
    event.preventDefault();
    setBulkDropActive(false);
    try {
      const files = await collectBulkCvFilesFromDataTransfer(event.dataTransfer);
      if (!files.length) {
        setEntryError(`No ${BULK_CV_FORMAT_LABEL} files found in drop.`);
        return;
      }
      applyBulkCvFileSelection(files, { append: bulkResumePhase === 'preview', clearZip: bulkResumePhase !== 'preview' });
    } catch (err) {
      setEntryError(err?.message || 'Could not read dropped files');
    }
  };
const handleBulkResumeImport = async () => {
    const workItems = buildBulkCvWorkItems(bulkCvStoredEntries, bulkResumeFiles);
    if (!workItems.length) return;

    bulkResumeStopRequestedRef.current = false;
    setBulkResumeStopRequested(false);
    bulkResumeAbortRef.current = new AbortController();
    const abortSignal = bulkResumeAbortRef.current.signal;

    setBulkResumePhase('importing');
    setBulkResumeProgress({ current: 0, total: workItems.length });
    setBulkCvSummary(null);
    const initialBulkRows = workItems.map((item) => ({
      fileName: item.name,
      status: 'processing',
      message: 'Queued…',
    }));
    setBulkResumeResults(initialBulkRows);

    const batchStart = Date.now();
    let createdCount = 0;
    let stoppedEarly = false;
    const backgroundUploads = [];

    const isAbortError = (err) =>
      !!err && (err.name === 'AbortError' || /aborted|abort/i.test(String(err?.message || '')));

    const bumpProgress = () => {
      setBulkResumeProgress((prev) => ({
        current: Math.min(prev.total, prev.current + 1),
        total: prev.total,
      }));
    };

    const BULK_CV_CONCURRENCY = resolveBulkCvConcurrency();
    const BULK_CV_MAX_RETRIES = resolveBulkCvMaxRetries();
    const BULK_CV_INTER_FILE_DELAY_MS = resolveBulkCvInterFileDelayMs();
    const BULK_CV_WORKER_STAGGER_MS = resolveBulkCvWorkerStaggerMs();
    /** fileIndex → active API node for parse retries / duplicate socket routing */
    const activeApiNodes = new Map();

    const runBulkCvStep = async (index, label, operation) =>
      withApiRetry(operation, {
        maxAttempts: BULK_CV_MAX_RETRIES,
        baseDelayMs: resolveBulkCvRetryBaseDelayMs(),
        signal: abortSignal,
        onRetry: (attempt, retryError) => {
          const wi = workItems[index];
          const current = activeApiNodes.get(index);
          if (
            wi?.kind !== 'stored' &&
            isRetryableApiError(retryError) &&
            bulkCvPoolSize() > 1 &&
            current
          ) {
            const alt = pickAlternateBulkCvNode(current.index, index);
            activeApiNodes.set(index, alt);
            bulkCvFileNodeIndexRef.current.set(index, alt.index);
          }
          setBulkResumeResults((prev) => {
            const next = [...prev];
            const nodeLabel =
              bulkCvPoolSize() > 1 && activeApiNodes.get(index)
                ? ` · API ${activeApiNodes.get(index).index + 1}/${bulkCvPoolSize()}`
                : '';
            next[index] = {
              ...next[index],
              status: 'processing',
              message: `${label} — retry ${attempt + 1}/${BULK_CV_MAX_RETRIES}${nodeLabel} (${getApiErrorMessage(retryError)})`,
            };
            return next;
          });
        },
      });

    const sessionId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
    bulkCvSessionIdRef.current = sessionId;
    beginBulkCvTokenSession(sessionId);

    const bulkCvApiPool = resolveBulkCvApiPool();
    let sockets = [];
    try {
      const { io } = await import('socket.io-client');
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      const tenantDbName =
        typeof window !== 'undefined' ? String(localStorage.getItem('tenantDbName') || '').trim() : '';
      if (!token) {
        throw new Error('Not logged in — cannot run bulk CV with duplicate detection.');
      }

      sockets = await Promise.all(
        bulkCvApiPool.map(async (node) => {
          const socket = io(node.socketOrigin, {
            auth: { token, ...(tenantDbName ? { tenantDbName } : {}) },
            transports: ['websocket', 'polling'],
          });
          await new Promise((resolve, reject) => {
            socket.once('connect', () => resolve());
            socket.once('connect_error', (err) => reject(err));
          });
          socket.emit('bulk_cv_join', { sessionId });
          socket.on('duplicate_found', handleBulkCvDuplicateFound);
          return socket;
        })
      );

      bulkCvSocketsRef.current = sockets;
      bulkCvSocketRef.current = sockets[0] || null;

      if (bulkCvApiPool.length > 1) {
        console.log(
          `[bulk-cv] load pool: ${bulkCvApiPool.length} API nodes`,
          bulkCvApiPool.map((n) => n.apiBase)
        );
      }
    } catch (socketErr) {
      console.error('[bulk-cv] Socket init failed', socketErr);
      setBulkResumePhase('preview');
      setEntryError(
        socketErr?.message ||
          'Could not connect for duplicate detection. Check that bulk CV API nodes are running and Socket.IO is enabled.'
      );
      for (const socket of sockets) {
        try {
          socket?.disconnect();
        } catch (_e) {
          /* ignore */
        }
      }
      bulkCvSocketsRef.current = [];
      bulkCvSocketRef.current = null;
      bulkCvSessionIdRef.current = '';
      return;
    }

    const fileCount = workItems.length;
    const outcomes = new Array(fileCount).fill(null);
    let nextFileIndex = 0;

    const markFinalRow = (index, row) => {
      outcomes[index] = row;
      setBulkResumeResults((prev) => {
        const next = [...prev];
        next[index] = row;
        return next;
      });
      bumpProgress();
    };

    const processIndex = async (index) => {
      const item = workItems[index];
      const displayName = item.name;

      if (bulkResumeStopRequestedRef.current) {
        stoppedEarly = true;
        markFinalRow(index, {
          fileName: displayName,
          status: 'failed',
          message: 'Stopped by user',
        });
        return;
      }

      setBulkResumeResults((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], status: 'processing', message: 'Parsing CV…' };
        return next;
      });

      const isStoredZipFile = item.kind === 'stored';
      const apiNode = pickBulkCvNodeForWorkItem({
        fileIndex: index,
        zipPinnedNodeIndex: bulkCvZipNodeIndexRef.current,
        isStoredZipFile,
      });
      activeApiNodes.set(index, apiNode);
      bulkCvFileNodeIndexRef.current.set(index, apiNode.index);

      try {
        const parsedResponse = await runBulkCvStep(index, 'Parsing CV', () => {
          const node = activeApiNodes.get(index) || apiNode;
          return apiBulkCvProcessFile(
            isStoredZipFile ? { storedFileId: item.storedFileId } : { file: item.file },
            sessionId,
            index,
            { signal: abortSignal, apiBase: node.apiBase }
          );
        });
        const envelope = parsedResponse.data || {};

        if (envelope?.skipped) {
          appendBulkCvTokenRecord(
            displayName,
            'skipped',
            normalizeTokenUsageFromApi(envelope.tokenUsage)
          );
          markFinalRow(index, {
            fileName: displayName,
            status: 'skipped',
            message: 'Skipped — duplicate (you chose not to import this CV)',
          });
          return;
        }

        const parsedCandidate = envelope.normalized || {};
        const tokenUsage = normalizeTokenUsageFromApi(envelope.tokenUsage);
        const duplicateResolution = envelope.duplicateResolution || null;
        const updateExistingCandidateId = envelope.updateExistingCandidateId || null;
        const identity = deriveBulkResumeIdentity(
          parsedCandidate,
          item.kind === 'local' ? item.file : { name: displayName }
        );
        const enrichedCandidate = {
          ...parsedCandidate,
          firstName: identity.firstName,
          lastName: identity.lastName,
          email: identity.email,
        };

        let createResponse;
        const bulkSavePayload = {
          ...buildBulkResumePayload(enrichedCandidate),
          ...(duplicateResolution === 'updated' ? { duplicateAction: 'updateExisting' } : {}),
        };
        try {
          createResponse = await runBulkCvStep(index, 'Saving candidate', () =>
            apiCreateCandidateFromDrawer(bulkSavePayload, { signal: abortSignal })
          );
        } catch (createError) {
          const dupExisting =
            createError?.data?.existingCandidate || createError?.raw?.data?.existingCandidate;
          const canCreateAnyway =
            createError?.data?.canCreateAnyway === true ||
            createError?.raw?.data?.canCreateAnyway === true;
          if (
            canCreateAnyway &&
            dupExisting &&
            String(getApiErrorMessage(createError) || '').toLowerCase().includes('already exists')
          ) {
            createResponse = await runBulkCvStep(index, 'Saving candidate', () =>
              apiCreateCandidateFromDrawer(
                {
                  ...buildBulkResumePayload(enrichedCandidate),
                  duplicateAction: 'create_anyway',
                },
                { signal: abortSignal }
              )
            );
          } else {
            throw createError;
          }
        }
        const candidate = createResponse.data;
        const savedFirst = String(candidate?.firstName || enrichedCandidate.firstName || '').trim();
        const savedLast = String(candidate?.lastName || enrichedCandidate.lastName || '').trim();

        const bulkCandidateId = candidate.id || candidate._id;
        if (
          item.kind === 'local' &&
          item.file &&
          bulkCandidateId &&
          !isPersistableRemoteResumeUrl(parsedCandidate?.resumeUrl)
        ) {
          backgroundUploads.push(
            apiUploadCandidateResumeFile(bulkCandidateId, item.file, { signal: abortSignal }).catch((uploadError) => {
              if (!isAbortError(uploadError)) {
                console.error('Resume upload failed after candidate creation:', uploadError);
              }
            })
          );
        }

        const placeholderParts = [];
        if (identity.syntheticName) placeholderParts.push('name');
        let successMessage = placeholderParts.length
          ? `Created — placeholder ${placeholderParts.join(' & ')} added (please update)`
          : 'Candidate created successfully';
        if (duplicateResolution === 'replaced') {
          successMessage = 'Replaced — existing candidate removed; new profile saved';
        } else if (duplicateResolution === 'updated') {
          successMessage = updateExistingCandidateId
            ? 'Updated — existing candidate profile merged with this CV'
            : 'Updated — existing candidate profile merged with this CV';
        } else if (duplicateResolution === 'create_anyway') {
          successMessage = 'Saved as copy — same email as CV, distinct last name';
        }

        createdCount += 1;
        removeFailedBulkResumesByFileName(displayName);
        appendBulkCvTokenRecord(displayName, 'created', tokenUsage);
        markFinalRow(index, {
          fileName: displayName,
          status: 'created',
          duplicateResolution,
          candidateName:
            `${savedFirst} ${savedLast}`.trim() ||
            candidate.email ||
            enrichedCandidate.email ||
            'Candidate',
          message: successMessage,
        });
      } catch (error) {
        if (isAbortError(error) || bulkResumeStopRequestedRef.current) {
          stoppedEarly = true;
          appendBulkCvTokenRecord(displayName, 'failed', null);
          markFinalRow(index, {
            fileName: displayName,
            status: 'failed',
            message: 'Stopped by user',
          });
        } else {
          appendBulkCvTokenRecord(displayName, 'failed', null);
          const dupExisting = error?.data?.existingCandidate || error?.raw?.data?.existingCandidate;
          const dupLabel = dupExisting
            ? `${dupExisting.name || [dupExisting.firstName, dupExisting.lastName].filter(Boolean).join(' ') || 'Existing profile'}${dupExisting.email ? ` (${dupExisting.email})` : ''}`
            : null;
          markFinalRow(index, {
            fileName: displayName,
            status: 'failed',
            message: dupLabel
              ? `Candidate already exists — ${dupLabel}. Remove that profile from Candidates or Recycle Bin, then retry.`
              : getApiErrorMessage(error) || 'Failed to create candidate',
          });
        }
      }
    };

    async function poolWorker(workerId) {
      if (workerId > 0 && BULK_CV_WORKER_STAGGER_MS > 0) {
        await sleep(workerId * BULK_CV_WORKER_STAGGER_MS);
      }
      while (true) {
        const index = nextFileIndex++;
        if (index >= fileCount) return;
        await processIndex(index);
        if (
          BULK_CV_INTER_FILE_DELAY_MS > 0 &&
          !bulkResumeStopRequestedRef.current &&
          nextFileIndex < fileCount
        ) {
          await sleep(BULK_CV_INTER_FILE_DELAY_MS);
        }
      }
    }

    try {
      const poolSize = Math.min(BULK_CV_CONCURRENCY, fileCount);
      await Promise.all(Array.from({ length: poolSize }, (_, workerId) => poolWorker(workerId)));

      for (let i = 0; i < fileCount; i += 1) {
        if (outcomes[i] != null) continue;
        const wi = workItems[i];
        stoppedEarly = stoppedEarly || bulkResumeStopRequestedRef.current;
        markFinalRow(i, {
          fileName: wi.name,
          status: 'failed',
          message: bulkResumeStopRequestedRef.current ? 'Stopped by user' : 'Not processed',
        });
      }
    } finally {
      // Persist failed CVs for Retry without re-upload BEFORE releasing the ZIP session.
      const slotResults = workItems.map((wi, i) =>
        outcomes[i] != null
          ? outcomes[i]
          : { fileName: wi.name, status: 'failed', message: 'Not processed' }
      );
      const failureIndexes = slotResults
        .map((item, i) => (item.status === 'failed' ? i : -1))
        .filter((i) => i >= 0);

      if (failureIndexes.length) {
        const zipNodeForDownload =
          bulkCvZipNodeIndexRef.current != null
            ? getBulkCvApiNode(bulkCvZipNodeIndexRef.current)
            : pickBulkCvZipNode();
        const failureInputs = [];
        for (const i of failureIndexes) {
          const wi = workItems[i];
          const result = slotResults[i];
          let file = wi.kind === 'local' && wi.file instanceof File ? wi.file : null;
          if (!file && wi.kind === 'stored' && wi.storedFileId && sessionId) {
            try {
              file = await apiBulkCvDownloadStoredFile(sessionId, wi.storedFileId, {
                apiBase: zipNodeForDownload.apiBase,
              });
            } catch (_downloadErr) {
              file = null;
            }
          }
          failureInputs.push({
            fileName: result.fileName || wi.name,
            reason: result.message || 'Unknown error',
            file,
          });
        }
        try {
          await addFailedBulkResumeRecordsWithFiles(failureInputs);
        } catch (_persistErr) {
          /* metadata fallback skipped — store already best-effort */
        }
        // Durable server copy for one-click reparse from any browser.
        const withFiles = failureInputs.filter((item) => item.file);
        for (let offset = 0; offset < withFiles.length; offset += 20) {
          const chunk = withFiles.slice(offset, offset + 20);
          try {
            await apiBulkCvSaveFailedResumes(
              chunk.map((item) => ({
                file: item.file,
                fileName: item.fileName,
                reason: item.reason,
              }))
            );
          } catch (serverSaveErr) {
            console.warn('[bulk-cv] server failed-resume save skipped', serverSaveErr?.message || serverSaveErr);
          }
        }
      }

      if (bulkCvStoredEntries.length) {
        const zipNode =
          bulkCvZipNodeIndexRef.current != null
            ? getBulkCvApiNode(bulkCvZipNodeIndexRef.current)
            : pickBulkCvZipNode();
        apiBulkCvReleaseZip(sessionId, { apiBase: zipNode.apiBase }).catch(() => {});
      }
      bulkCvDupQueueRef.current = [];
      bulkCvDupAwaitingIndicesRef.current.clear();
      bulkCvDupShowingRef.current = false;
      setBulkDuplicateModal(null);
      bulkCvCurrentFileIndexRef.current = -1;
      for (const socket of bulkCvSocketsRef.current || []) {
        try {
          socket?.disconnect();
        } catch (_e) {
          /* ignore */
        }
      }
      bulkCvSocketsRef.current = [];
      bulkCvSocketRef.current = null;
      bulkCvZipNodeIndexRef.current = null;
      bulkCvFileNodeIndexRef.current.clear();
      bulkCvSessionIdRef.current = '';
    }

    const slotResults = workItems.map((wi, i) =>
      outcomes[i] != null
        ? outcomes[i]
        : { fileName: wi.name, status: 'failed', message: 'Not processed' }
    );
    const elapsed = Date.now() - batchStart;
    const succeeded = slotResults.filter((item) => item.status === 'created').length;
    const failed = slotResults.filter((item) => item.status === 'failed').length;
    const skipped = slotResults.filter((item) => item.status === 'skipped').length;
    const failures = slotResults
      .filter((item) => item.status === 'failed')
      .map((item) => ({ fileName: item.fileName, reason: item.message }));

    setBulkCvStoredEntries([]);
    setBulkCvSummary({
      totalReceived: workItems.length,
      succeeded,
      failed,
      skipped,
      failures,
      durationMs: elapsed,
    });
    console.log(
      `[bulk-cv] done in ${elapsed}ms | files=${workItems.length} ok=${succeeded} skip=${skipped} fail=${failed}`
    );
    logBulkCvSessionReport(getBulkCvTokenSession());

    // Clear server-stored failed rows that succeeded on this retry.
    const retryServerIds = bulkRetryServerIdsRef.current || [];
    if (retryServerIds.length) {
      const resolvedIds = [];
      for (let i = 0; i < slotResults.length; i += 1) {
        const status = slotResults[i]?.status;
        if ((status === 'created' || status === 'skipped') && retryServerIds[i]) {
          resolvedIds.push(retryServerIds[i]);
        }
      }
      if (resolvedIds.length) {
        apiBulkCvResolveFailedResumes(resolvedIds).catch(() => {});
      }
      bulkRetryServerIdsRef.current = [];
    }

    setBulkResumePhase('complete');
    setBulkResumeStopRequested(false);
    bulkResumeStopRequestedRef.current = false;
    bulkResumeAbortRef.current = null;

    if (createdCount > 0) {
      const suffix = stoppedEarly ? ' (stopped early)' : '';
      toast.success(
        `${createdCount} candidate${createdCount === 1 ? '' : 's'} created from CV upload${suffix}`
      );
      notifyCandidatesChanged();
      onSuccess?.(null);
    } else if (stoppedEarly) {
      toast.info('Bulk CV parsing stopped');
    }
    void Promise.allSettled(backgroundUploads).then(() => {
      notifyCandidatesChanged();
    });
  };
const buildCandidatePayload = (duplicateAction = 'create') => {
    const cityStateParts = String(formData.cityState || '')
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    const languageLabels = (formData.languageEntries || [])
      .filter((row) => row.language?.trim())
      .map((row) => `${row.language.trim()} (${row.proficiency || 'Conversational'})`);
    const filledEducation = (formData.educationEntries || []).filter(
      (row) =>
        row.qualification?.trim() ||
        row.instituteName?.trim() ||
        row.educationLevel?.trim()
    );
    const educationSummary = filledEducation
      .map((row) => formatEducationRowSummary(row))
      .filter(Boolean)
      .join('; ');
    const noticePeriod =
      formData.noticePeriodDays?.trim() !== ''
        ? `${formData.noticePeriodDays} days`
        : formData.noticePeriod;

    return {
      firstName: formData.firstName,
      lastName: formData.lastName,
      email:
        normalizeCandidateEmailInput(formData.email, {
          firstName: formData.firstName,
          lastName: formData.lastName,
        }) || formData.email,
      phone: formData.phone || undefined,
      currentCompany: formData.currentCompany || undefined,
      designation: formData.currentDesignation,
      currentDesignation: formData.currentDesignation,
      experience: formData.experience === '' ? 0 : Number(formData.experience),
      location: formData.cityState || formData.location || undefined,
      linkedinUrl: formData.linkedinUrl || undefined,
      jobId: formData.jobId || undefined,
      stage: formData.stage,
      recruiterId: formData.recruiterId || undefined,
      source: formData.source || 'Other',
      sourceUrl: formData.sourceUrl || undefined,
      referrerName: formData.referrerName || undefined,
      agencyName: formData.agencyName || undefined,
      priority: formData.priority,
      tags: formData.tags,
      expectedSalary: formData.expectedSalary ? Number(formData.expectedSalary) : undefined,
      currency: formData.currency,
      noticePeriod,
      availabilityStatus: formData.availabilityStatus,
      portfolioUrl: formData.portfolioUrl || formData.website || undefined,
      website: formData.website || undefined,
      skills: formData.skills,
      currentSalary: formData.currentSalary
        ? Number(formData.currentSalary)
        : parsedData?.currentSalary
          ? Number(parsedData.currentSalary)
          : undefined,
      education: educationSummary || formData.educationHistory || parsedData?.education || undefined,
      cvEducationEntries:
        filledEducation.length > 0
          ? filledEducation.map((row) => educationRowToCvEntry(row))
          : Array.isArray(parsedData?.educationEntries)
            ? parsedData.educationEntries
            : undefined,
      certifications:
        formData.certificates?.length > 0
          ? formData.certificates
          : Array.isArray(parsedData?.certifications)
            ? parsedData.certifications
            : undefined,
      languages:
        languageLabels.length > 0
          ? languageLabels
          : Array.isArray(parsedData?.languages)
            ? parsedData.languages
            : undefined,
      notes:
        [formData.remarks, formData.initialNote, parsedData?.summary]
          .filter(Boolean)
          .join('\n\n') || undefined,
      cvSummary: formData.summary || parsedData?.summary || undefined,
      cvWorkExperienceEntries: Array.isArray(parsedData?.workExperienceEntries)
        ? parsedData.workExperienceEntries
        : undefined,
      cvPortfolioLinks: Array.isArray(parsedData?.portfolioLinks) ? parsedData.portfolioLinks : undefined,
      city: cityStateParts[0] || parsedData?.city || undefined,
      country: cityStateParts.slice(1).join(', ') || parsedData?.country || undefined,
      address: formData.address || undefined,
      preferredLocation: formData.cityState || parsedData?.location || formData.location || undefined,
      resume: parsedData?.resumeUrl || undefined,
      avatar: [formData.avatar, parsedData?.profilePhotoUrl, parsedData?.avatar]
        .map((x) => String(x || '').trim())
        .find((x) => /^https?:\/\//i.test(x)),
      extraData: {
        age: formData.age || undefined,
        candidateScore: formData.candidateScore || undefined,
        zip: formData.zip || undefined,
        nationality: formData.nationality || undefined,
        currentCompanyWebsite: formData.currentCompanyWebsite || undefined,
        maritalStatus: formData.maritalStatus || undefined,
        birthDate: formData.birthDate || undefined,
        passportNumber: formData.passportNumber || undefined,
        instituteName: formData.instituteName || undefined,
        currentBenefits: formData.currentBenefits || undefined,
        currentSalaryCurrency: formData.currentSalaryCurrency || undefined,
        expectedBenefits: formData.expectedBenefits || undefined,
        noticePeriodDays: formData.noticePeriodDays || undefined,
        courses: formData.courses || undefined,
        extracurricularActivities: formData.extracurricularActivities || undefined,
        volunteers: formData.volunteers || undefined,
        twitter: formData.twitter || undefined,
        xing: formData.xing || undefined,
        skypeId: formData.skypeId || undefined,
        facebook: formData.facebook || undefined,
        stackOverflow: formData.stackOverflow || undefined,
        workHistoryText: formData.workHistory || undefined,
        educationHistoryText: formData.educationHistory || undefined,
        honoursAwards: formData.honoursAwards || undefined,
        languageEntries: formData.languageEntries?.length ? formData.languageEntries : undefined,
        referralCampaign: formData.referralCampaign === 'Yes',
      },
      duplicateAction,
    };
  };
const openDuplicateDecision = ({
    field = 'email',
    mode = 'save',
    source = 'save',
    candidate = null,
    message,
    canUpdate,
    canCreateAnyway,
  }) => {
    setDuplicateDecision({
      field,
      mode,
      source,
      candidate,
      message:
        message ||
        'A candidate with this email address already exists (exact match, ignoring case and spaces).',
      canUpdate: canUpdate ?? true,
      canCreateAnyway: canCreateAnyway ?? true,
    });
  };
const closeDuplicateDecision = () => {
    setDuplicateDecision(null);
  };
const handleSave = async (mode, duplicateAction = 'create') => {
    if (!validateForm()) return;
    if (duplicateAction === 'create' && duplicateWarning) {
      openDuplicateDecision({
        field: duplicateWarning.field,
        source: 'save',
        mode,
        candidate: duplicateWarning.candidate || null,
        canUpdate: true,
        canCreateAnyway: true,
      });
      return;
    }

    setIsSaving(true);
    setSaveBanner(null);
    try {
      const payload = buildCandidatePayload(duplicateAction);

      const response = await apiCreateCandidateFromDrawer(payload);
      let candidate = response?.data || {};
      // Prisma + Mongo always projects `id`, but tolerate `_id` from any future
      // serializer change so the resume upload doesn't silently fail and the
      // user doesn't see "Candidate not found" after a successful create.
      const candidateId = candidate.id || candidate._id || null;
      // Prefer manual attachment (step 3) over parsed file; ref mirrors state
      // so the File is still available at save time.
      const uploadFile = resumeFileRef.current || manualResumeFile || parsedResumeFile;
      const parsedResumeRemote = isPersistableRemoteResumeUrl(parsedData?.resumeUrl);
      // Upload when we have a file and either (a) user picked a manual file, or
      // (b) parse did not yield a storable remote URL (Cloudinary failed, temp path, etc.).
      // Skip only when parse already produced https/http and the file came from that parse.
      const shouldUploadResume =
        Boolean(candidateId && uploadFile) &&
        (Boolean(manualResumeFile) || !parsedResumeRemote);

      // Await the resume upload BEFORE we close the drawer / refresh the
      // parent list so the candidate row reflects the resume in the same
      // refresh cycle (otherwise the parent fetched the row before `resume`
      // was set on the backend and the file appeared "missing").
      let resumeUploadFailed = false;
      if (shouldUploadResume) {
        if (!candidateId) {
          resumeUploadFailed = true;
          console.error('Cannot upload resume: created candidate is missing an id', candidate);
          toast.error('Candidate saved, but resume upload could not start (missing candidate id).');
        } else {
          try {
            const uploadResponse = await apiUploadCandidateResumeFile(candidateId, uploadFile);
            const updated = uploadResponse?.data;
            if (updated && typeof updated === 'object') {
              candidate = { ...candidate, ...updated };
            }
          } catch (uploadError) {
            resumeUploadFailed = true;
            console.error('Resume upload failed after candidate creation:', uploadError);
            toast.error(uploadError?.message || 'Candidate saved, but resume upload failed');
          }
        }
      }

      if (candidateId && avatarFile) {
        try {
          const photoUrl = await uploadCandidateAvatar(candidateId, avatarFile);
          if (photoUrl) {
            candidate = { ...candidate, avatar: photoUrl };
          }
        } catch (photoError) {
          console.error('Candidate photo upload failed:', photoError);
          toast.error(photoError?.message || 'Candidate saved, but photo upload failed');
        }
      }

      toast.success(
        duplicateAction === 'updateExisting'
          ? `${formData.firstName} ${formData.lastName} updated successfully`
          : `${formData.firstName} ${formData.lastName} added successfully`
      );

      if (mode === 'saveAndAddAnother') {
        resetForNext(activeTab);
        setInlineSuccess(
          resumeUploadFailed
            ? 'Candidate saved (resume upload failed). Fill in the next one.'
            : 'Candidate saved! Fill in the next one.'
        );
      } else {
        onSuccess?.(candidate);
        notifyCandidatesChanged();
        resetForNext(activeTab);
        onClose();
      }
    } catch (error) {
      if (String(error.message || '').toLowerCase().includes('already exists')) {
        const duplicateData = error?.data || error?.raw?.data || {};
        openDuplicateDecision({
          field: 'email',
          source: 'save',
          mode,
          candidate: duplicateData.existingCandidate || null,
          message: 'A candidate with this email already exists.',
          canUpdate: duplicateData.canUpdate !== false,
          canCreateAnyway: duplicateData.canCreateAnyway === true,
        });
        setSaveBanner({
          type: 'duplicate',
          message: 'A candidate with this email already exists.',
          existingCandidate: duplicateData.existingCandidate || null,
          canUpdate: duplicateData.canUpdate !== false,
          canCreateAnyway: duplicateData.canCreateAnyway === true,
        });
      } else {
        setSaveBanner({ type: 'error', message: error.message || 'Something went wrong. Try again.' });
      }
    } finally {
      setIsSaving(false);
    }
  };
const renderDuplicateWarning = (field) => {
    if (!duplicateWarning || duplicateWarning.field !== field) return null;
    const existing = duplicateWarning.candidate;
    return (
      <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        <div className="flex items-start gap-2">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <div className="space-y-2">
            <p className="font-medium">A candidate with this {field} already exists:</p>
            <p className="text-xs text-amber-800">
              {existing?.name} - {existing?.designation || 'Candidate'} at {existing?.currentCompany || 'Unknown Company'} ({existing?.stage || 'Applied'})
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => window.open(`/candidate?candidateId=${existing?._id}`, '_blank', 'noopener,noreferrer')}
                className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 border border-amber-300"
              >
                View Existing Candidate ↗
              </button>
              <button
                type="button"
                onClick={() => setDuplicateWarning(null)}
                className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white"
              >
                Continue Anyway
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };
const renderCandidateConflict = (field) => {
    if (!duplicateWarning || duplicateWarning.field !== field) return null;
    const existing = duplicateWarning.candidate;
    const isEmailDuplicate = field === 'email';

    return (
      <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        <div className="flex items-start gap-2">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <div className="space-y-2">
            <p className="font-medium">
              {isEmailDuplicate
                ? 'This email already belongs to an existing candidate.'
                : 'This phone number matches an existing candidate.'}
            </p>
            <p className="text-xs text-amber-800">
              {existing?.name} - {existing?.designation || 'Candidate'} at {existing?.currentCompany || 'Unknown Company'} ({existing?.stage || 'Applied'})
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => window.open(`/candidate?candidateId=${existing?._id}`, '_blank', 'noopener,noreferrer')}
                className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900"
              >
                View Existing Candidate
              </button>
              {isEmailDuplicate ? (
                <button
                  type="button"
                  onClick={() => {
                    setDuplicateWarning(null);
                    handleSave('save', 'updateExisting');
                  }}
                  className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Update Existing
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setDuplicateWarning(null)}
                  className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Create Anyway
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };
const entryBanner = parsedData ? (
    <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
      Fields below were auto-filled from resume parsing. Review and edit before saving.
    </div>
  ) : null;
const csvSummary = useMemo(() => {
    const ready = csvRows.filter((row) => row.__status === 'Ready').length;
    const duplicates = csvRows.filter((row) => row.__status === 'Duplicate').length;
    const errorsCount = csvRows.filter((row) => row.__status === 'Missing fields').length;
    return { ready, duplicates, errorsCount };
  }, [csvRows]);
const drawerTitle = DRAWER_TITLES[activeTab] || DRAWER_TITLES.manual;
const drawerDescription = DRAWER_DESCRIPTIONS[activeTab] || DRAWER_DESCRIPTIONS.manual;
const formatExistingCandidateDate = (value) => {
    if (value == null || value === '') return '—';
    const formatted = formatDateTimeDMY(value);
    return formatted || '—';
  };
const bulkDuplicateQueueSize =
    (bulkDuplicateModal ? 1 : 0) + (bulkCvDupQueueRef.current?.length || 0);
const renderBulkCvDuplicatePolicySection = () => {
    const active = BULK_CV_DUPLICATE_POLICY_OPTIONS.find((opt) => opt.id === bulkCvDuplicatePolicy);
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          When a duplicate email is found
        </p>
        <p className="mt-1 text-sm text-slate-600">
          Choose once before you start — the same rule applies to every duplicate CV in this batch (no
          pop-up per file).
        </p>
        <div className="mt-3 grid gap-2">
          {BULK_CV_DUPLICATE_POLICY_OPTIONS.map((opt) => {
            const selected = bulkCvDuplicatePolicy === opt.id;
            const accent =
              opt.id === 'create_anyway'
                ? selected
                  ? 'border-amber-400 bg-amber-50 ring-1 ring-amber-200'
                  : 'border-slate-200 hover:border-amber-200 hover:bg-amber-50/40'
                : opt.id === 'cancel'
                  ? selected
                    ? 'border-slate-400 bg-slate-50 ring-1 ring-slate-300'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  : selected
                    ? 'border-slate-800 bg-slate-900/5 ring-1 ring-slate-400'
                    : 'border-slate-200 hover:border-slate-400 hover:bg-slate-50';
            return (
              <label
                key={opt.id}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 transition ${accent} ${
                  isBulkResumeBusy ? 'pointer-events-none opacity-60' : ''
                }`}
              >
                <input
                  type="radio"
                  name="bulkCvDuplicatePolicy"
                  value={opt.id}
                  checked={selected}
                  disabled={isBulkResumeBusy}
                  onChange={() => setBulkCvDuplicatePolicyPersisted(opt.id)}
                  className="mt-1 h-4 w-4 shrink-0 border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="min-w-0 text-left">
                  <span className="text-sm font-semibold text-slate-900">{opt.title}</span>
                  <span className="mt-0.5 block text-xs text-slate-500">{opt.description}</span>
                </span>
              </label>
            );
          })}
        </div>
        {active ? (
          <p className="mt-3 text-xs font-medium text-blue-700">
            Selected: {active.title} — used for all duplicates in this upload.
          </p>
        ) : null}
      </div>
    );
  };
const renderBulkDuplicatePanel = () => {
    if (!bulkDuplicateModal) return null;
    const modal = bulkDuplicateModal;
    const canCreateAnyway = modal.canCreateAnyway !== false;
    const canUpdate = modal.canUpdate !== false;

    return (
      <div
        className="absolute inset-0 z-30 flex items-center justify-center bg-slate-900/50 px-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-dup-title"
      >
        <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-amber-100 p-2 text-amber-700">
              <AlertCircle size={18} />
            </div>
            <div className="flex-1">
              <h3 id="bulk-dup-title" className="text-base font-semibold text-slate-900">
                Duplicate candidate found
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                A candidate with this email already exists (exact match). Parsing is paused until you
                choose.
              </p>
              {bulkDuplicateQueueSize > 1 ? (
                <p className="mt-1 text-xs font-medium text-amber-700">
                  {bulkDuplicateQueueSize} duplicate{bulkDuplicateQueueSize === 1 ? '' : 's'} waiting
                  — resolve this file first.
                </p>
              ) : null}
              <p className="mt-1 text-xs text-slate-500">
                File: <span className="font-medium text-slate-700">{modal.fileName}</span>
              </p>
            </div>
          </div>

          {modal.existingCandidate ? (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <p className="font-medium text-slate-900">
                {(modal.existingCandidate.firstName || '').trim()}{' '}
                {(modal.existingCandidate.lastName || '').trim()}
              </p>
              <p className="mt-1 text-xs text-slate-500">{modal.existingCandidate.email || '—'}</p>
              <p className="mt-1 text-xs text-slate-500">
                {modal.existingCandidate.designation || modal.existingCandidate.currentTitle || 'Candidate'}{' '}
                · Added {formatExistingCandidateDate(modal.existingCandidate.createdAt)}
              </p>
            </div>
          ) : null}

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-blue-100 bg-blue-50/80 p-3 text-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">From this CV</p>
              <p className="mt-2 font-medium text-slate-900">
                {(modal.newCandidate?.firstName || '').trim()}{' '}
                {(modal.newCandidate?.lastName || '').trim()}
              </p>
              <p className="mt-1 text-xs text-slate-600">{modal.newCandidate?.email || '—'}</p>
            </div>
            <div className="rounded-xl border border-amber-100 bg-amber-50/80 p-3 text-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">In database</p>
              <p className="mt-2 font-medium text-slate-900">
                {(modal.existingCandidate?.firstName || '').trim()}{' '}
                {(modal.existingCandidate?.lastName || '').trim()}
              </p>
              <p className="mt-1 text-xs text-slate-600">{modal.existingCandidate?.email || '—'}</p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-2">
            <button
              type="button"
              disabled={!canCreateAnyway}
              onClick={() => emitBulkDuplicateDecision('create_anyway')}
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${
                canCreateAnyway
                  ? 'bg-amber-500 text-white hover:bg-amber-600'
                  : 'cursor-not-allowed bg-slate-100 text-slate-400'
              }`}
            >
              Create anyway
            </button>
            <button
              type="button"
              onClick={() => emitBulkDuplicateDecision('cancel')}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Duplicate found — still continue
            </button>
            <button
              type="button"
              disabled={!canUpdate}
              onClick={() => emitBulkDuplicateDecision('update_existing')}
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${
                canUpdate
                  ? 'bg-slate-900 text-white hover:bg-slate-800'
                  : 'cursor-not-allowed bg-slate-100 text-slate-400'
              }`}
            >
              Update existing
            </button>
          </div>

          <p className="mt-3 text-xs text-slate-500">
            Create anyway saves a copy with the same email from the CV. Still continue skips this CV. Update existing
            merges parsed CV data into the profile already in your database.
          </p>
        </div>
      </div>
    );
  };
const emitBulkDuplicateDecision = (decision) => {
    const modal = bulkDuplicateModal;
    if (!modal) return;
    const sid = bulkCvSessionIdRef.current;
    if (modal.fileIndex !== undefined && modal.fileIndex !== null) {
      bulkCvDupAwaitingIndicesRef.current.delete(modal.fileIndex);
    }
    emitBulkCvDuplicateDecision(modal.fileIndex, decision);
    const next = bulkCvDupQueueRef.current.shift();
    if (next) {
      setBulkDuplicateModal(next);
    } else {
      bulkCvDupShowingRef.current = false;
      setBulkDuplicateModal(null);
    }
  };
const bulkResumeResultRowClass = (result) => {
    if (result.status === 'created') {
      if (result.duplicateResolution === 'replaced') {
        return 'border border-violet-200 bg-white text-violet-800';
      }
      if (result.duplicateResolution === 'updated') {
        return 'border border-indigo-200 bg-white text-indigo-800';
      }
      if (result.duplicateResolution === 'create_anyway') {
        return 'border border-sky-200 bg-white text-sky-800';
      }
      return 'border border-emerald-200 bg-white text-emerald-700';
    }
    if (result.status === 'skipped') {
      return 'border border-slate-200 bg-white text-slate-700';
    }
    if (result.status === 'processing') {
      return 'border border-amber-200 bg-white text-amber-800';
    }
    return 'border border-red-200 bg-white text-red-700';
  };
const bulkResumeCompleteCardClass = (result) => {
    if (result.status === 'created') {
      if (result.duplicateResolution === 'replaced') return 'border-violet-200 bg-violet-50';
      if (result.duplicateResolution === 'updated') return 'border-indigo-200 bg-indigo-50';
      if (result.duplicateResolution === 'create_anyway') return 'border-sky-200 bg-sky-50';
      return 'border-emerald-200 bg-emerald-50';
    }
    if (result.status === 'skipped') return 'border-slate-200 bg-slate-50';
    if (result.status === 'processing') return 'border-amber-200 bg-amber-50';
    return 'border-red-200 bg-red-50';
  };
const bulkResumeStatusPill = (result) => {
    if (result.status === 'skipped') {
      return { label: 'skipped', className: 'bg-slate-100 text-slate-700' };
    }
    if (result.status === 'created' && result.duplicateResolution === 'replaced') {
      return { label: 'replaced', className: 'bg-violet-100 text-violet-800' };
    }
    if (result.status === 'created' && result.duplicateResolution === 'updated') {
      return { label: 'updated', className: 'bg-indigo-100 text-indigo-800' };
    }
    if (result.status === 'created' && result.duplicateResolution === 'create_anyway') {
      return { label: 'saved as copy', className: 'bg-sky-100 text-sky-800' };
    }
    if (result.status === 'created') {
      return { label: 'created', className: 'bg-emerald-100 text-emerald-700' };
    }
    if (result.status === 'failed') {
      return { label: 'Failed', className: 'bg-red-100 text-red-700' };
    }
    return { label: result.status, className: 'bg-red-100 text-red-700' };
  };
const showAiChatStage = Boolean(!embeddedBulkCv && activeTab === 'manual' && aiFlowStage === 'chat');
const showAiFormStage = Boolean(!embeddedBulkCv && activeTab === 'manual' && aiFlowStage === 'form');
const isCenteredPopup = false;
const embeddedShellClass =
    'relative mb-6 flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm';
const drawerPanelClass = isCenteredPopup
    ? 'relative z-10 flex h-[min(92vh,920px)] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] border-0 bg-white shadow-[0_40px_120px_-24px_rgba(15,23,42,0.45)] ring-1 ring-white/70'
    : 'relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-white';
const drawerBody = (
    <div className={embeddedBulkCv ? embeddedShellClass : drawerPanelClass}>
        {isCenteredPopup ? (
          <>
            <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-[radial-gradient(ellipse_at_top_right,_rgba(32,152,200,0.18),_transparent_55%),radial-gradient(ellipse_at_top_left,_rgba(32,152,200,0.12),_transparent_50%)]" />
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.4]"
              style={{
                backgroundImage: 'radial-gradient(rgba(15,23,42,0.055) 1px, transparent 1px)',
                backgroundSize: '18px 18px',
                maskImage: 'linear-gradient(to bottom, black 0%, transparent 40%)',
              }}
              aria-hidden
            />
          </>
        ) : null}
        <div
          className={`relative flex items-center justify-between gap-3 border-b ${
            isCenteredPopup
              ? 'border-[#2098C8]/20 px-5 pb-4 pt-5 sm:px-7 sm:pt-6'
              : `border-slate-200/90 bg-gradient-to-r from-white via-indigo-50/40 to-white ${embeddedBulkCv ? 'px-5 py-4' : 'px-6 py-4'}`
          }`}
        >
          <div className="flex min-w-0 items-center gap-3">
            {<AddCandidateIsCenteredPopupBlock drawerDescription={drawerDescription} drawerTitle={drawerTitle} embeddedBulkCv={embeddedBulkCv} inlineSuccess={inlineSuccess} isBulkResumeBusy={isBulkResumeBusy} isCenteredPopup={isCenteredPopup} showAiChatStage={showAiChatStage} showAiFormStage={showAiFormStage} />}
          </div>
          {!embeddedBulkCv ? (
            <button
              type="button"
              onClick={handleDrawerClose}
              title={isBulkResumeBusy ? 'Stop parsing or confirm close' : 'Close'}
              className="rounded-full border border-slate-200/90 bg-white/90 p-2 text-slate-400 shadow-sm transition hover:border-slate-300 hover:text-slate-700"
            >
              <X size={18} />
            </button>
          ) : null}
        </div>

        {showAiChatStage || showAiFormStage ? <AddCandidateAiFlowProgress stage={aiFlowStage} /> : null}

        <div
          ref={formScrollRef}
          className={
            showAiChatStage
              ? 'relative flex min-h-0 flex-1 flex-col overflow-hidden'
              : embeddedBulkCv
                ? 'max-h-[min(70vh,640px)] overflow-y-auto px-5 py-5'
                : isCenteredPopup
                  ? 'relative min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7'
                  : 'flex-1 overflow-y-auto px-6 py-5'
          }
        >
          {showAiChatStage ? (
            <CandidateAiChatDrawer
              isOpen
              stageMode
              onClose={handleDrawerClose}
              onContinue={() => {
                setAiFlowStage('form');
                setCurrentStep(1);
              }}
              form={formData}
              onApplyGenerated={(generated) => applyCandidateAiPatch(generated)}
              onResumeParsed={(data, file) => applyImportedData(data, 'resume', file)}
              chatHistory={candidateAiChatHistory}
              onChatHistoryChange={setCandidateAiChatHistory}
            />
          ) : null}

          {!showAiChatStage && entryError && embeddedBulkCv ? (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {entryError}
            </div>
          ) : null}

          {!showAiChatStage && !embeddedBulkCv && showMethodTabs ? (
            <div className="mb-5 rounded-2xl bg-slate-100/95 p-1.5 ring-1 ring-slate-200/80">
              <div className="flex flex-wrap gap-1">
                {METHOD_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => handleTabChange(tab.key)}
                    className={`inline-flex min-w-[7rem] flex-1 items-center justify-center whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200 ${
                      activeTab === tab.key
                        ? 'bg-white text-indigo-700 shadow-md shadow-indigo-500/10 ring-1 ring-indigo-100'
                        : 'bg-white/70 text-slate-700 hover:bg-white hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {!showAiChatStage && !embeddedBulkCv && saveBanner ? (
            <div
              className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
                saveBanner.type === 'duplicate'
                  ? 'border-amber-200 bg-amber-50 text-amber-900'
                  : 'border-red-200 bg-red-50 text-red-700'
              }`}
            >
              {saveBanner.type === 'duplicate' ? (
                <div className="space-y-3">
                  <p className="font-medium">{saveBanner.message}</p>
                  {saveBanner.existingCandidate ? (
                    <p className="text-xs text-amber-800">
                      {saveBanner.existingCandidate.name} - {saveBanner.existingCandidate.currentTitle || 'Candidate'} at{' '}
                      {saveBanner.existingCandidate.currentCompany || 'Unknown Company'} ({saveBanner.existingCandidate.stage || 'Applied'})
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    {saveBanner.existingCandidate ? (
                      <button
                        type="button"
                        onClick={() =>
                          window.open(
                            `/candidate?candidateId=${saveBanner.existingCandidate?._id}`,
                            '_blank',
                            'noopener,noreferrer'
                          )
                        }
                        className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900"
                      >
                        View Existing Candidate
                      </button>
                    ) : null}
                    {saveBanner.canUpdate ? (
                      <button
                        type="button"
                        onClick={() => handleSave('save', 'updateExisting')}
                        className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        Update Existing
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <span>{saveBanner.message}</span>
                </div>
              )}
            </div>
          ) : null}

          {!embeddedBulkCv && activeTab === 'resume' ? (
            <div className="mb-5 space-y-4">
              {!parsedResumeFile ? (
                <>
                  <CandidatePhotoUpload
                    preview={avatarPreview || formData.avatar}
                    onSelectFile={handleAvatarFile}
                    onRemove={clearAvatarFile}
                    compact
                  />
                  <label
                    className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/40 px-6 py-8 text-center transition-colors hover:border-blue-400 hover:bg-blue-50"
                  >
                    <Upload size={24} className="mb-3 text-blue-500" />
                    <p className="text-sm font-medium text-slate-700">
                      Drag resume here or click to browse
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{BULK_CV_FORMAT_LABEL} · Max {MAX_RESUME_FILE_LABEL}</p>
                    <input
                      type="file"
                      accept={BULK_CV_ACCEPT_INPUT}
                      className="hidden"
                      onChange={(event) => handleResumeFile(event.target.files?.[0])}
                    />
                  </label>
                </>
              ) : null}
              {isLoading ? (
                <div className="mt-3 flex items-center gap-2 text-sm text-blue-600">
                  <Loader2 size={16} className="animate-spin" />
                  AI is reading the resume...
                </div>
              ) : null}
              {entryError ? (
                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <div className="flex items-center justify-between gap-3">
                    <span>{entryError}</span>
                    <button type="button" onClick={() => setEntryError('')} className="text-xs font-semibold">
                      Retry
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {<AddCandidateBulkResumeBlock activeTab={activeTab} bulkCvAddMoreInputRef={bulkCvAddMoreInputRef} bulkCvFolderInputRef={bulkCvFolderInputRef} bulkCvStoredEntries={bulkCvStoredEntries} bulkCvSummary={bulkCvSummary} bulkCvZipInputRef={bulkCvZipInputRef} bulkDropActive={bulkDropActive} bulkResumeCompleteCardClass={bulkResumeCompleteCardClass} bulkResumeFiles={bulkResumeFiles} bulkResumePhase={bulkResumePhase} bulkResumeProgress={bulkResumeProgress} bulkResumeResultRowClass={bulkResumeResultRowClass} bulkResumeResults={bulkResumeResults} bulkResumeStatusPill={bulkResumeStatusPill} bulkResumeStopRequested={bulkResumeStopRequested} bulkZipExpanding={bulkZipExpanding} embeddedBulkCv={embeddedBulkCv} handleBulkResumeAddMore={handleBulkResumeAddMore} handleBulkResumeDrop={handleBulkResumeDrop} handleBulkResumeFolderSelected={handleBulkResumeFolderSelected} handleBulkResumeSelected={handleBulkResumeSelected} handleBulkResumeZipSelected={handleBulkResumeZipSelected} handleStopBulkResume={handleStopBulkResume} renderBulkCvDuplicatePolicySection={renderBulkCvDuplicatePolicySection} setBulkDropActive={setBulkDropActive} />}

          {<AddCandidateCsvBlock activeTab={activeTab} autoFilledFields={autoFilledFields} avatarPreview={avatarPreview} clearAvatarFile={clearAvatarFile} csvExpanded={csvExpanded} csvImportProgress={csvImportProgress} csvPhase={csvPhase} csvResult={csvResult} csvRows={csvRows} csvSummary={csvSummary} currentStep={currentStep} embeddedBulkCv={embeddedBulkCv} errors={errors} fieldRefs={fieldRefs} formData={formData} handleAvatarFile={handleAvatarFile} handleCsvSelected={handleCsvSelected} handleDownloadCsvTemplate={handleDownloadCsvTemplate} handleDuplicateCheck={handleDuplicateCheck} jobs={jobs} lockJobSelection={lockJobSelection} manualResumeFile={manualResumeFile} parsedResumeFile={parsedResumeFile} recruiters={recruiters} renderCandidateConflict={renderCandidateConflict} resumeFileRef={resumeFileRef} selectedJob={selectedJob} setCsvExpanded={setCsvExpanded} setManualResumeFile={setManualResumeFile} showAiChatStage={showAiChatStage} updateFormData={updateFormData} validateEmail={validateEmail} />}
        </div>

        {<AddCandidateShowAiChatStageBlock activeTab={activeTab} bulkCvStoredEntries={bulkCvStoredEntries} bulkResumeFiles={bulkResumeFiles} bulkResumePhase={bulkResumePhase} bulkResumeStopRequested={bulkResumeStopRequested} csvPhase={csvPhase} csvSummary={csvSummary} currentStep={currentStep} embeddedBulkCv={embeddedBulkCv} handleBulkImport={handleBulkImport} handleBulkResumeImport={handleBulkResumeImport} handleDrawerClose={handleDrawerClose} handleSave={handleSave} handleStopBulkResume={handleStopBulkResume} isBulkResumeBusy={isBulkResumeBusy} isCenteredPopup={isCenteredPopup} isSaving={isSaving} onClose={onClose} onSuccess={onSuccess} resetForNext={resetForNext} setAiFlowStage={setAiFlowStage} setCurrentStep={setCurrentStep} showAiChatStage={showAiChatStage} showAiFormStage={showAiFormStage} validateStep={validateStep} />}

        {bulkCvDuplicatePolicy === 'ask' ? renderBulkDuplicatePanel() : null}

        {<AddCandidateDuplicateDecisionBlock closeDuplicateDecision={closeDuplicateDecision} duplicateDecision={duplicateDecision} handleSave={handleSave} />}
    </div>
  );

  return { drawerActive, drawerBody, handleDrawerClose, isCenteredPopup, portalMounted };
}