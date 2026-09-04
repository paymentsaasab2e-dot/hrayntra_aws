'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePageDrawerLifecycle } from '../../lib/pageDrawerEvents';
import { useDrawerUnsavedGuard } from '../../hooks/useDrawerUnsavedGuard';
import { AnimatePresence, motion } from 'motion/react';
import { Loader2, Plus, Save, Send, X } from 'lucide-react';
import { ClientCvSelectionPanel } from './ClientCvSelectionPanel';
import { ResumePreviewModal } from '../candidates/ResumePreviewModal';
import {
  buildCvSubmissionExtra,
  resolveDefaultCvShareMode,
  type CvShareMode,
} from '../../lib/cvEditorMapping';
import { isResumeHttpUrl, normalizeResumeHref } from '../../lib/resumePreview';
import { useSaasaCvAnnotations } from '../../hooks/useSaasaCvAnnotations';
import { resolveSaasaCvPreviewUrl } from '../../lib/saasaCvAnnotations';
import type { Interview } from '../../types/interview.types';
import {
  apiGetCandidate,
  apiGetClients,
  apiGetContacts,
  apiGetClient,
  apiGetJob,
  apiGetJobs,
  apiSubmitInterviewToClient,
  apiSubmitMatch,
  apiUpdateContact,
  apiUpdateClient,
  apiUpdateCandidate,
  type BackendCandidate,
  type BackendContact,
  type BackendClient,
  type BackendJob,
} from '../../lib/api';
import { CandidatePhase1SubmitEditSections } from '../candidates/CandidatePhase1SubmitEditSections';
import {
  buildCandidateEditForm,
  CandidateEditAtsSections,
  validateEditFormStructured,
  type CandidateEditFormState,
} from '../candidates/CandidateEditAtsSections';
import {
  enrichBackendCandidateFromPhase1Snapshot,
  isPhase1PortalCandidate,
  type Phase1ProfileSnapshot,
} from '../../lib/phase1ProfileSnapshot';
import {
  buildClientPresentationExtraDataForPhase1,
  resolveSubmitPhase1SectionVisibility,
  resolveSubmitPhase1Snapshot,
} from '../../lib/phase1ClientPresentation';
import {
  DEFAULT_PHASE1_CLIENT_SECTION_VISIBILITY,
  type Phase1ClientSectionId,
  type Phase1ClientSectionVisibility,
} from '../../lib/phase1ClientPresentationSections';
import { mapCandidateProfile } from '../../lib/mapCandidateProfile';
import {
  buildClientPresentationExtraData,
  readClientPresentation,
  resolveSubmitToClientEditForm,
} from '../../lib/clientPresentationDraft';
import {
  DEFAULT_CLIENT_SECTION_VISIBILITY,
  normalizeClientSectionVisibility,
  type ClientPresentationSectionId,
  type ClientSectionVisibility,
} from '../../lib/clientPresentationSections';
import { ClientOfferLetterCard } from '../candidates/ClientOfferLetterCard';
import { useFiles } from '../../hooks/useFiles';
import type { CandidateProfileDrawerData } from '../drawers/CandidateProfileDrawer';
import { resolveMatchIdForSubmit } from '../../lib/jobAppliedMatches';
import { resolveSubmitJobIdFromBackend } from '../../lib/candidateSubmitToClient';
import { extractApiData, isValidObjectId } from '../../lib/mapCandidateProfile';
import { parseClientsListFromResponse, parseJobsListFromResponse } from '../../lib/parseApiList';
import { startAsyncLoad } from '../../lib/asyncLoadGuard';
import { mapUniqueClientOptions } from '../../lib/companyNameKey';
import { SubmitToClientClientDetailsPanel } from './SubmitToClientClientDetailsPanel';
import {
  clientToSubmitForm,
  emptySubmitToClientClientForm,
  submitFormToDirectorContactPatch,
  submitFormToUpdatePayload,
  type SubmitToClientClientFormState,
} from '../../lib/submitToClientClientForm';
import { validateCandidateEmail } from '../../lib/candidateEmailValidation';

export type BulkSubmitCandidateEntry = {
  candidateId: string;
  jobId: string;
  matchId?: string;
  candidateName?: string;
  jobTitle?: string;
  clientId?: string;
  matchScore?: number;
};

export type SubmitToClientSource =
  | { kind: 'interview'; interview: Interview }
  | {
      kind: 'match';
      candidateId: string;
      jobId: string;
      matchId?: string;
      candidateName?: string;
      jobTitle?: string;
      clientId?: string;
      matchScore?: number;
    }
  | {
      kind: 'bulkMatch';
      candidates: BulkSubmitCandidateEntry[];
    };

interface SubmitToClientDrawerProps {
  isOpen: boolean;
  /** Legacy: interview-based submit (Interviews page) */
  interview?: Interview | null;
  /** Candidate + job submit (Job drawer, Candidates page) */
  source?: SubmitToClientSource | null;
  onClose: () => void;
  onToast: (message: string) => void;
  onSubmitted?: () => void;
}

// Each option maps a recruiter-friendly purpose to a stable code we send to the
// backend. We intentionally keep the list small so it's easy to extend later
// without breaking saved tokens / emails.
export const SUBMISSION_TYPES = [
  {
    value: 'INITIAL_REVIEW',
    label: 'Initial review – ask client to screen the candidate',
    description: "Use right after applying / before scheduling — let the client confirm they want to interview.",
  },
  {
    value: 'INTERIM_REVIEW',
    label: 'Mid-cycle review – between interview rounds',
    description: 'Share interim feedback so the client can decide on next steps before the next round.',
  },
  {
    value: 'OFFER_CONFIRMATION',
    label: 'Offer / final clarification – upload offer letter',
    description: 'Final hand-off before placement. Client will be asked to attach the signed offer letter.',
  },
] as const;

type SubmissionTypeValue = (typeof SUBMISSION_TYPES)[number]['value'];

type SubmitMatchResult = {
  reviewUrl?: string | null;
  emailSent?: boolean;
  emailError?: string | null;
};

function readSubmitMatchResult(raw: unknown): SubmitMatchResult {
  const envelope = (raw && typeof raw === 'object' ? raw : {}) as {
    data?: SubmitMatchResult;
    emailSent?: boolean;
    emailError?: string | null;
    reviewUrl?: string | null;
  };
  const nested =
    envelope.data && typeof envelope.data === 'object' ? envelope.data : envelope;
  const reviewUrlRaw = nested.reviewUrl || envelope.reviewUrl;
  const emailErrorRaw = nested.emailError || envelope.emailError;
  return {
    reviewUrl: typeof reviewUrlRaw === 'string' && reviewUrlRaw.trim() ? reviewUrlRaw.trim() : null,
    emailSent: nested.emailSent === true || envelope.emailSent === true,
    emailError: typeof emailErrorRaw === 'string' && emailErrorRaw.trim() ? emailErrorRaw.trim() : null,
  };
}

function buildSubmitToast(opts: {
  candidateCount: number;
  clientCount: number;
  emailSent?: boolean;
  emailError?: string | null;
}): string {
  const submitted =
    opts.candidateCount > 1
      ? `Submitted ${opts.candidateCount} candidates to the client`
      : 'Submitted to client';
  if (opts.emailSent) {
    const emailed =
      opts.clientCount > 1
        ? ` Email sent to ${opts.clientCount} clients.`
        : ' Email sent to the client.';
    return `${submitted}.${emailed} Open Client view in the candidate drawer to see what the client sees.`;
  }
  const fail = opts.emailError
    ? ` Email was not delivered (${opts.emailError}).`
    : ' Email was not delivered.';
  return `${submitted}.${fail} Open Client view in the candidate drawer to copy and share the review link.`;
}

// Best-guess mapping from interview state → purpose, used as a starting value
// and to flag when we can't infer it confidently (we then force the recruiter
// to pick).
function inferSubmissionType(interview: Interview | null): SubmissionTypeValue | '' {
  if (!interview) return '';
  const completedFeedback = (interview.feedbackEntries || []).filter(
    (entry) => entry?.recommendation && String(entry.recommendation).trim().length > 0
  );
  if (interview.status === 'Completed' && completedFeedback.length > 0) {
    const last = completedFeedback[completedFeedback.length - 1];
    if (last?.recommendation === 'Pass') return 'OFFER_CONFIRMATION';
    return 'INTERIM_REVIEW';
  }
  if (interview.status === 'Scheduled' && completedFeedback.length === 0) {
    return 'INITIAL_REVIEW';
  }
  return '';
}

interface ClientSlotState {
  clientId: string;
  companyName: string;
  isPrimary: boolean;
  client: BackendClient | null;
  clientForm: SubmitToClientClientFormState;
  saved: boolean;
  loading: boolean;
}

function createClientSlot(clientId: string, isPrimary: boolean, companyName = ''): ClientSlotState {
  return {
    clientId,
    companyName,
    isPrimary,
    client: null,
    clientForm: emptySubmitToClientClientForm(),
    saved: false,
    loading: false,
  };
}

async function resolveClientContacts(
  clientId: string,
  embedded?: BackendClient['contacts'],
): Promise<BackendContact[]> {
  try {
    const contactsRaw = await apiGetContacts({ clientId, limit: 100 });
    const contactsPayload = extractApiData<any>(contactsRaw);
    const contacts = Array.isArray(contactsPayload)
      ? contactsPayload
      : Array.isArray(contactsPayload?.data)
        ? contactsPayload.data
        : [];
    if (contacts.length > 0) {
      return contacts as BackendContact[];
    }
  } catch {
    // Fall back to contacts embedded on the client record.
  }
  return (embedded || []) as BackendContact[];
}

function seedProfile(partial: {
  id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  name?: string;
  location?: string;
}): CandidateProfileDrawerData {
  const name =
    partial.name?.trim() ||
    `${partial.firstName || ''} ${partial.lastName || ''}`.trim() ||
    partial.email?.trim() ||
    'Candidate';
  return {
    id: partial.id || '',
    name,
    firstName: partial.firstName,
    lastName: partial.lastName,
    email: partial.email,
    location: partial.location,
  } as CandidateProfileDrawerData;
}

function editFormFromInterview(interview: Interview): CandidateEditFormState {
  const parts = interview.candidate.name.trim().split(/\s+/).filter(Boolean);
  return buildCandidateEditForm(
    seedProfile({
      id: interview.candidate.id,
      firstName: parts[0] || '',
      lastName: parts.slice(1).join(' '),
      email: interview.candidate.email,
      name: interview.candidate.name,
      location: interview.job.client || '',
    }),
  );
}

function editFormFromDisplayName(name: string, email?: string): CandidateEditFormState {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return buildCandidateEditForm(
    seedProfile({
      firstName: parts[0] || '',
      lastName: parts.slice(1).join(' '),
      email: email || '',
      name,
    }),
  );
}

function notifyCandidateSubmitted() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('jobportal:candidates-changed'));
  window.dispatchEvent(new CustomEvent('jobportal:jobs-changed'));
  window.dispatchEvent(new CustomEvent('jobportal:interviews-changed'));
}

export function SubmitToClientDrawer({
  isOpen,
  interview = null,
  source = null,
  onClose,
  onToast,
  onSubmitted,
}: SubmitToClientDrawerProps) {
  usePageDrawerLifecycle(isOpen);
  const { panelRef, requestClose, markClean } = useDrawerUnsavedGuard<HTMLElement>({
    isOpen,
    onClose,
  });
  const onToastRef = useRef(onToast);
  onToastRef.current = onToast;
  const toast = useCallback((message: string) => {
    onToastRef.current(message);
  }, []);

  const activeSource: SubmitToClientSource | null = useMemo(() => {
    if (source) return source;
    if (interview) return { kind: 'interview', interview };
    return null;
  }, [source, interview]);

  const bulkCandidates = useMemo(
    () => (activeSource?.kind === 'bulkMatch' ? activeSource.candidates : []),
    [activeSource],
  );
  const isBulkMode = bulkCandidates.length > 0;
  const [activeBulkIndex, setActiveBulkIndex] = useState(0);
  const [bulkSavedMap, setBulkSavedMap] = useState<Record<string, boolean>>({});
  const bulkCandidateCacheRef = useRef<
    Map<
      string,
      {
        candidate: BackendCandidate | null;
        editForm: CandidateEditFormState | null;
        phase1Snapshot: Phase1ProfileSnapshot | null;
        clientSectionVisibility: ClientSectionVisibility;
        phase1ClientSectionVisibility: Phase1ClientSectionVisibility;
        cvShareMode: CvShareMode | null;
        candidateStepSaved: boolean;
      }
    >
  >(new Map());

  const activeBulkEntry = isBulkMode ? (bulkCandidates[activeBulkIndex] ?? null) : null;

  const candidateId =
    activeSource?.kind === 'interview'
      ? activeSource.interview.candidate.id
      : activeSource?.kind === 'match'
        ? activeSource.candidateId
        : activeBulkEntry?.candidateId ?? '';

  const matchJobId =
    activeSource?.kind === 'match'
      ? activeSource.jobId
      : activeSource?.kind === 'bulkMatch'
        ? activeBulkEntry?.jobId ?? ''
        : '';
  const matchClientId =
    activeSource?.kind === 'match'
      ? activeSource.clientId
      : activeSource?.kind === 'bulkMatch'
        ? activeBulkEntry?.clientId
        : undefined;
  const matchRecordId =
    activeSource?.kind === 'match'
      ? activeSource.matchId
      : activeSource?.kind === 'bulkMatch'
        ? activeBulkEntry?.matchId
        : undefined;
  const matchScore =
    activeSource?.kind === 'match'
      ? activeSource.matchScore
      : activeSource?.kind === 'bulkMatch'
        ? activeBulkEntry?.matchScore
        : undefined;
  const matchCandidateName =
    activeSource?.kind === 'match'
      ? activeSource.candidateName
      : activeSource?.kind === 'bulkMatch'
        ? activeBulkEntry?.candidateName
        : '';
  const matchJobTitleSeed =
    activeSource?.kind === 'match'
      ? activeSource.jobTitle
      : activeSource?.kind === 'bulkMatch'
        ? activeBulkEntry?.jobTitle
        : '';

  const loadedCandidateIdRef = useRef<string | null>(null);
  const candidateSetupIdRef = useRef<string | null>(null);
  const primaryClientLoadedRef = useRef<string | null>(null);

  const [matchSubmitId, setMatchSubmitId] = useState<string | null>(null);
  const [resolvedClientId, setResolvedClientId] = useState<string | undefined>(
    activeSource?.kind === 'interview'
      ? activeSource.interview.job.clientId
      : activeSource?.kind === 'match'
        ? activeSource.clientId
        : undefined,
  );
  const [resolvedJobTitle, setResolvedJobTitle] = useState('');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [candidate, setCandidate] = useState<BackendCandidate | null>(null);
  const [activeTab, setActiveTab] = useState<'candidate' | 'client'>('candidate');
  const [activeClientId, setActiveClientId] = useState<string | null>(null);
  const [selectedClients, setSelectedClients] = useState<ClientSlotState[]>([]);
  const [clientCatalog, setClientCatalog] = useState<Array<{ id: string; companyName: string }>>([]);
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [phase1Snapshot, setPhase1Snapshot] = useState<Phase1ProfileSnapshot | null>(null);
  const [editForm, setEditForm] = useState<CandidateEditFormState | null>(null);
  const [editError, setEditError] = useState('');
  const [pipelineJobs, setPipelineJobs] = useState<Array<{ id: string; title: string; department?: string | null }>>(
    [],
  );
  const [candidateStepSaved, setCandidateStepSaved] = useState(false);
  const [submissionType, setSubmissionType] = useState<SubmissionTypeValue | ''>('');
  const [submissionTypeError, setSubmissionTypeError] = useState<string | null>(null);
  const [clientSectionVisibility, setClientSectionVisibility] = useState<ClientSectionVisibility>(
    DEFAULT_CLIENT_SECTION_VISIBILITY,
  );
  const [phase1ClientSectionVisibility, setPhase1ClientSectionVisibility] =
    useState<Phase1ClientSectionVisibility>(DEFAULT_PHASE1_CLIENT_SECTION_VISIBILITY);
  const [cvShareMode, setCvShareMode] = useState<CvShareMode | null>(null);

  const uploadsBase = useMemo(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1';
    return apiBase.replace(/\/api\/v1\/?$/, '');
  }, []);

  const { files: candidateFiles, loading: candidateFilesLoading, refresh: refreshCandidateFiles } = useFiles(
    'candidate',
    isOpen ? candidateId : null,
  );

  const isPhase1Candidate = useMemo(
    () => (candidate ? isPhase1PortalCandidate(candidate) : false),
    [candidate],
  );

  const phase1ProfileStub = useMemo((): CandidateProfileDrawerData | null => {
    if (!candidate) return null;
    return mapCandidateProfile(enrichBackendCandidateFromPhase1Snapshot(candidate));
  }, [candidate]);

  const activeClientSlot = useMemo(
    () => selectedClients.find((slot) => slot.clientId === activeClientId) ?? null,
    [selectedClients, activeClientId],
  );

  const allClientsSaved =
    selectedClients.length > 0 && selectedClients.every((slot) => slot.saved);

  const allBulkCandidatesSaved =
    !isBulkMode || bulkCandidates.every((entry) => bulkSavedMap[entry.candidateId]);

  const bulkSavedCount = useMemo(
    () => bulkCandidates.filter((entry) => bulkSavedMap[entry.candidateId]).length,
    [bulkCandidates, bulkSavedMap],
  );

  const stashCurrentBulkCandidate = useCallback(() => {
    if (!isBulkMode || !candidateId) return;
    bulkCandidateCacheRef.current.set(candidateId, {
      candidate,
      editForm,
      phase1Snapshot,
      clientSectionVisibility,
      phase1ClientSectionVisibility,
      cvShareMode,
      candidateStepSaved: bulkSavedMap[candidateId] ?? candidateStepSaved,
    });
  }, [
    isBulkMode,
    candidateId,
    candidate,
    editForm,
    phase1Snapshot,
    clientSectionVisibility,
    phase1ClientSectionVisibility,
    cvShareMode,
    bulkSavedMap,
    candidateStepSaved,
  ]);

  const goToBulkCandidate = useCallback(
    (index: number) => {
      if (!isBulkMode || index < 0 || index >= bulkCandidates.length) return;
      if (index === activeBulkIndex) return;
      stashCurrentBulkCandidate();
      loadedCandidateIdRef.current = null;
      candidateSetupIdRef.current = null;
      setActiveBulkIndex(index);
      const nextId = bulkCandidates[index]?.candidateId;
      if (!nextId) return;
      const cached = bulkCandidateCacheRef.current.get(nextId);
      if (cached) {
        loadedCandidateIdRef.current = nextId;
        candidateSetupIdRef.current = nextId;
        setCandidate(cached.candidate);
        setEditForm(cached.editForm);
        setPhase1Snapshot(cached.phase1Snapshot);
        setClientSectionVisibility(cached.clientSectionVisibility);
        setPhase1ClientSectionVisibility(cached.phase1ClientSectionVisibility);
        setCvShareMode(cached.cvShareMode);
        setCandidateStepSaved(cached.candidateStepSaved || Boolean(bulkSavedMap[nextId]));
        setLoading(false);
      }
    },
    [activeBulkIndex, bulkCandidates, isBulkMode, stashCurrentBulkCandidate],
  );

  const loadClientSlot = async (clientId: string) => {
    setSelectedClients((prev) =>
      prev.map((slot) => (slot.clientId === clientId ? { ...slot, loading: true } : slot)),
    );
    try {
      const raw = await apiGetClient(clientId);
      const data = extractApiData<BackendClient>(raw);
      const contacts = await resolveClientContacts(clientId, data.contacts);
      setSelectedClients((prev) =>
        prev.map((slot) =>
          slot.clientId === clientId
            ? {
                ...slot,
                client: data,
                companyName: data.companyName || slot.companyName,
                clientForm: clientToSubmitForm(data, contacts),
                loading: false,
              }
            : slot,
        ),
      );
    } catch (error: unknown) {
      setSelectedClients((prev) =>
        prev.map((slot) => (slot.clientId === clientId ? { ...slot, loading: false } : slot)),
      );
      toast(error instanceof Error ? error.message : 'Unable to load client details');
    }
  };

  const addClientSlot = (clientId: string) => {
    if (!clientId || selectedClients.some((slot) => slot.clientId === clientId)) return;
    const catalogClient = clientCatalog.find((item) => item.id === clientId);
    setSelectedClients((prev) => [
      ...prev,
      createClientSlot(clientId, false, catalogClient?.companyName || 'Client'),
    ]);
    setActiveClientId(clientId);
    setActiveTab('client');
    setClientPickerOpen(false);
    void loadClientSlot(clientId);
  };

  const removeClientSlot = (clientId: string) => {
    setSelectedClients((prev) => {
      const target = prev.find((slot) => slot.clientId === clientId);
      if (!target || target.isPrimary) return prev;
      const next = prev.filter((slot) => slot.clientId !== clientId);
      if (activeClientId === clientId) {
        const fallback = next.find((slot) => slot.isPrimary) ?? next[0] ?? null;
        setActiveClientId(fallback?.clientId ?? null);
      }
      return next;
    });
  };

  const patchActiveClientForm = (patch: Partial<SubmitToClientClientFormState>) => {
    if (!activeClientId) return;
    setSelectedClients((prev) =>
      prev.map((slot) =>
        slot.clientId === activeClientId
          ? { ...slot, clientForm: { ...slot.clientForm, ...patch }, saved: false }
          : slot,
      ),
    );
  };

  const fallbackCandidateName =
    activeSource?.kind === 'interview'
      ? activeSource.interview.candidate.name
      : activeSource?.kind === 'match' || activeSource?.kind === 'bulkMatch'
        ? matchCandidateName || ''
        : '';

  const fullName = useMemo(() => {
    if (phase1Snapshot?.personalInfo) {
      const fromPhase1 = `${phase1Snapshot.personalInfo.firstName || ''} ${phase1Snapshot.personalInfo.lastName || ''}`.trim();
      if (fromPhase1) return fromPhase1;
    }
    if (editForm) {
      const fromForm = `${editForm.firstName} ${editForm.lastName}`.trim();
      if (fromForm) return fromForm;
    }
    return fallbackCandidateName || 'Candidate';
  }, [editForm, fallbackCandidateName, phase1Snapshot]);

  const updatePhase1Snapshot = (next: Phase1ProfileSnapshot) => {
    setPhase1Snapshot(next);
    setCandidateStepSaved(false);
  };

  const updateEditField = <K extends keyof CandidateEditFormState>(
    field: K,
    value: CandidateEditFormState[K],
  ) => {
    setEditForm((prev) => (prev ? { ...prev, [field]: value } : prev));
    setCandidateStepSaved(false);
  };

  const toggleClientSectionVisibility = (sectionId: ClientPresentationSectionId) => {
    setClientSectionVisibility((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
    setCandidateStepSaved(false);
  };

  const togglePhase1ClientSectionVisibility = (sectionId: Phase1ClientSectionId) => {
    setPhase1ClientSectionVisibility((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
    setCandidateStepSaved(false);
  };

  useEffect(() => {
    if (
      !isOpen ||
      (activeSource?.kind !== 'match' && activeSource?.kind !== 'bulkMatch') ||
      !matchJobId ||
      !candidateId
    ) {
      setMatchSubmitId(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const jobRaw = await apiGetJob(matchJobId);
        const job = extractApiData<BackendJob>(jobRaw);
        if (cancelled) return;
        setResolvedClientId((prev) => matchClientId || job.client?.id || prev);
        setResolvedJobTitle(matchJobTitleSeed || job.title || '');
        const { matchId: id } = await resolveMatchIdForSubmit(
          candidateId,
          matchJobId,
          matchScore ?? 0,
          matchRecordId,
        );
        if (!cancelled) setMatchSubmitId(id);
      } catch (error: unknown) {
        if (!cancelled) {
          toast(error instanceof Error ? error.message : 'Unable to prepare match for submit');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    isOpen,
    activeSource?.kind,
    candidateId,
    matchJobId,
    matchClientId,
    matchRecordId,
    matchScore,
    matchJobTitleSeed,
    toast,
  ]);

  useEffect(() => {
    if (!isOpen || !candidateId) {
      loadedCandidateIdRef.current = null;
      candidateSetupIdRef.current = null;
      setLoading(false);
      return;
    }

    if (candidateSetupIdRef.current !== candidateId) {
      candidateSetupIdRef.current = candidateId;
    setActiveTab('candidate');
    setCandidateStepSaved(bulkSavedMap[candidateId] ?? false);
    setSubmissionTypeError(null);
      if (activeSource?.kind === 'interview') {
        setSubmissionType(inferSubmissionType(activeSource.interview));
        setResolvedJobTitle(activeSource.interview.job.title);
        setResolvedClientId(activeSource.interview.job.clientId);
        setEditForm(editFormFromInterview(activeSource.interview));
      } else {
        if (activeSource?.kind === 'bulkMatch' && !submissionType) {
          setSubmissionType('INITIAL_REVIEW');
        } else if (activeSource?.kind === 'match') {
          setSubmissionType('INITIAL_REVIEW');
        }
        if (activeSource?.kind === 'match' || activeSource?.kind === 'bulkMatch') {
          setEditForm(editFormFromDisplayName(matchCandidateName || '', undefined));
        }
      }
    }

    if (loadedCandidateIdRef.current === candidateId) {
      setLoading(false);
      return;
    }

    const load = startAsyncLoad(setLoading);
    void (async () => {
      try {
        const raw = await apiGetCandidate(candidateId);
        const data = extractApiData<BackendCandidate>(raw);
        if (!load.isActive()) return;
        loadedCandidateIdRef.current = candidateId;
        const enriched = enrichBackendCandidateFromPhase1Snapshot(data);
        setCandidate(enriched);
        if (isPhase1PortalCandidate(enriched)) {
          setPhase1Snapshot(resolveSubmitPhase1Snapshot(enriched));
          setPhase1ClientSectionVisibility(resolveSubmitPhase1SectionVisibility(enriched));
          setEditForm(null);
        } else {
          setPhase1Snapshot(null);
          setPhase1ClientSectionVisibility(DEFAULT_PHASE1_CLIENT_SECTION_VISIBILITY);
          setEditForm((current) => resolveSubmitToClientEditForm(enriched, current));
        }
        const savedPresentation = readClientPresentation(enriched.extraData);
        setClientSectionVisibility(
          normalizeClientSectionVisibility(savedPresentation?.visibleSections),
        );
        if (savedPresentation) {
          setCandidateStepSaved(true);
        }
      } catch (error: unknown) {
        if (!load.isActive()) return;
        toast(error instanceof Error ? error.message : 'Unable to load candidate details');
      } finally {
        load.finish();
      }
    })();
    return () => {
      load.abort();
    };
  }, [isOpen, candidateId, toast]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    void (async () => {
      try {
        const jobsRaw = await apiGetJobs({ page: 1, limit: 500 });
        const jobs = parseJobsListFromResponse(jobsRaw);
        if (cancelled) return;
        setPipelineJobs(
          jobs.map((job) => ({
            id: job.id,
            title: job.title || 'Untitled job',
            department: job.department ?? null,
          })),
        );
      } catch {
        if (!cancelled) setPipelineJobs([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedClients([]);
      setActiveClientId(null);
      setClientPickerOpen(false);
      setResumePreviewOpen(false);
      setCvEditorOpen(false);
      setCvEditorData(null);
      setClientCatalog([]);
      setEditForm(null);
      setPhase1Snapshot(null);
      setPhase1ClientSectionVisibility(DEFAULT_PHASE1_CLIENT_SECTION_VISIBILITY);
      setActiveBulkIndex(0);
      setBulkSavedMap({});
      bulkCandidateCacheRef.current.clear();
      setEditError('');
      setPipelineJobs([]);
      primaryClientLoadedRef.current = null;
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const clientsRaw = await apiGetClients({ page: 1, limit: 500, includeContacts: true });
        const clients = parseClientsListFromResponse(clientsRaw);
        if (cancelled) return;
        setClientCatalog(mapUniqueClientOptions(clients));
      } catch {
        if (!cancelled) setClientCatalog([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !resolvedClientId) {
      if (!isOpen) {
        primaryClientLoadedRef.current = null;
      }
      return;
    }
    if (primaryClientLoadedRef.current === resolvedClientId) {
      return;
    }
    primaryClientLoadedRef.current = resolvedClientId;
    const primarySlot = createClientSlot(resolvedClientId, true);
    setSelectedClients([primarySlot]);
    setActiveClientId(resolvedClientId);
    void loadClientSlot(resolvedClientId);
  }, [isOpen, resolvedClientId]);

  const resumeValue = String(candidate?.resume || '').trim();
  const resumeHref = resumeValue && isResumeHttpUrl(resumeValue) ? normalizeResumeHref(resumeValue) : '';
  const hasOriginalCv = Boolean(resumeHref);
  const [saasaPreviewOpen, setSaasaPreviewOpen] = useState(false);
  const [cvShareSaving, setCvShareSaving] = useState(false);

  const saasaCv = useSaasaCvAnnotations({
    candidateId: isOpen ? candidateId : null,
    candidateName: fullName,
    resumeUrl: resumeHref || candidate?.resume || null,
    extraData:
      candidate?.extraData && typeof candidate.extraData === 'object' && !Array.isArray(candidate.extraData)
        ? (candidate.extraData as Record<string, unknown>)
        : null,
    enabled: isOpen && Boolean(candidateId),
    canEdit: true,
    onCandidateUpdated: async () => {
      if (!candidateId) return;
      const raw = await apiGetCandidate(candidateId);
      setCandidate(extractApiData<BackendCandidate>(raw));
    },
    onFilesRefresh: () => refreshCandidateFiles(),
    onToast,
    onViewModeChange: (mode) => {
      if (mode === 'saasa') setCvShareMode('saasa');
    },
  });

  const saasaCvPreviewUrl = useMemo(
    () =>
      resolveSaasaCvPreviewUrl(
        candidate?.extraData && typeof candidate.extraData === 'object' && !Array.isArray(candidate.extraData)
          ? (candidate.extraData as Record<string, unknown>)
          : null,
        candidateFiles.map((file) => ({
          id: file.id,
          fileUrl: file.fileUrl,
          fileType: file.fileType,
          fileName: file.fileName,
        })),
      ),
    [candidate?.extraData, candidateFiles],
  );

  const hasSaasaCvExport = Boolean(saasaCvPreviewUrl);
  const canOpenSaasaCv = Boolean(resumeHref || candidate?.resume?.trim());
  const saasaCvFileName =
    saasaCv.stored?.fileName ||
    candidateFiles.find((file) => file.fileType === 'SAASA_CV')?.fileName ||
    (hasSaasaCvExport ? `HRYantra CV — ${fullName}` : '');

  useEffect(() => {
    if (!candidate) {
      setCvShareMode(null);
      return;
    }
    setCvShareMode(resolveDefaultCvShareMode(candidate, hasOriginalCv, hasSaasaCvExport));
  }, [candidate, hasOriginalCv, hasSaasaCvExport]);

  const persistCvShareMode = async (mode: CvShareMode) => {
    if (!candidate?.id) return;
    setCvShareMode(mode);
    setCvShareSaving(true);
    try {
      const extraData = buildCvSubmissionExtra(candidate.extraData ?? null, {
        shareMode: mode,
        updatedAt: new Date().toISOString(),
      });
      const updatedRaw = await apiUpdateCandidate(candidate.id, { extraData });
      setCandidate(extractApiData<BackendCandidate>(updatedRaw));
    } catch (error: unknown) {
      onToast(error instanceof Error ? error.message : 'Unable to save CV selection');
    } finally {
      setCvShareSaving(false);
    }
  };

  const clientCvSelectionPanelProps = {
    candidate,
    cvShareMode,
    cvShareSaving,
    hasEditedCv: false,
    hasOriginalCv: false,
    hasSaasaCv: hasSaasaCvExport,
    canOpenSaasaCv,
    saasaCvFileName,
    saasaAnnotationCount: saasaCv.annotationCount,
    saasaCvPreviewUrl: saasaCvPreviewUrl || '',
    resumeHref,
    cvEditorLoading: false,
    saasaCvBusy: saasaCv.busy,
    loading,
    onSelectMode: (mode: CvShareMode) => void persistCvShareMode(mode),
    onExcludeVersion: () => undefined,
    onEditCv: () => undefined,
    onPreviewEdited: () => undefined,
    onPreviewOriginal: () => undefined,
    onOpenSaasaCv: () => saasaCv.openModal(),
    onPreviewSaasaCv: () => {
      if (saasaCvPreviewUrl) setSaasaPreviewOpen(true);
    },
    showEditedOption: false,
    showOriginalOption: false,
  };

  const saveDetails = async () => {
    if (!candidate) return;
    setSaving(true);
    setEditError('');
    try {
      let extraData: Record<string, unknown>;
      if (isPhase1Candidate) {
        if (!phase1Snapshot) return;
        extraData = buildClientPresentationExtraDataForPhase1(
          phase1Snapshot,
          candidate,
          candidate.extraData ?? null,
          { phase1VisibleSections: phase1ClientSectionVisibility },
        );
      } else {
        if (!editForm) return;
        validateEditFormStructured(editForm);
        extraData = buildClientPresentationExtraData(editForm, candidate.extraData ?? null, {
          visibleSections: clientSectionVisibility,
        });
      }
      const updatedRaw = await apiUpdateCandidate(candidate.id, { extraData });
      const updated = extractApiData<BackendCandidate>(updatedRaw);
      setCandidate(updated);
      const saved = readClientPresentation(updated.extraData);
      if (isPhase1Candidate) {
        if (saved?.phase1Snapshot) setPhase1Snapshot(saved.phase1Snapshot);
        if (saved?.phase1VisibleSections) {
          setPhase1ClientSectionVisibility(saved.phase1VisibleSections);
        }
      } else if (editForm) {
        setEditForm(saved?.editForm ?? editForm);
        if (saved?.visibleSections) {
          setClientSectionVisibility(saved.visibleSections);
        }
      }
      setBulkSavedMap((prev) => ({ ...prev, [candidate.id]: true }));
      setCandidateStepSaved(true);
      stashCurrentBulkCandidate();
      onToast('Client presentation saved (overview unchanged)');
      const allSavedNow = bulkCandidates.every(
        (entry) => entry.candidateId === candidate.id || bulkSavedMap[entry.candidateId],
      );
      if (isBulkMode && !allSavedNow) {
        const nextIndex = bulkCandidates.findIndex(
          (entry) => entry.candidateId !== candidate.id && !bulkSavedMap[entry.candidateId],
        );
        if (nextIndex >= 0) {
          goToBulkCandidate(nextIndex);
        }
      } else {
        setActiveTab('client');
        const clientTabId =
          activeClientId ??
          selectedClients.find((slot) => slot.isPrimary)?.clientId ??
          selectedClients[0]?.clientId ??
          resolvedClientId ??
          null;
        if (clientTabId) {
          setActiveClientId(clientTabId);
          const slot = selectedClients.find((item) => item.clientId === clientTabId);
          if (slot && !slot.client) void loadClientSlot(clientTabId);
        }
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to update candidate details';
      setEditError(message);
      onToast(message);
    } finally {
      setSaving(false);
    }
  };

  const saveClientDetails = async () => {
    if (!activeClientSlot?.client) return;
    if (isBulkMode ? !allBulkCandidatesSaved : !candidateStepSaved) {
      onToast(
        isBulkMode
          ? 'Please save presentation for every candidate before saving client details'
          : 'Please save candidate details first',
      );
      return;
    }
    const slotId = activeClientSlot.clientId;
    setSaving(true);
    try {
      const { clientForm } = activeClientSlot;
      const updatedRaw = await apiUpdateClient(
        activeClientSlot.client.id,
        submitFormToUpdatePayload(clientForm),
      );
      const updated = extractApiData<BackendClient>(updatedRaw);
      const directorPatch = submitFormToDirectorContactPatch(clientForm);
      if (clientForm.directorContactId && directorPatch) {
        try {
          await apiUpdateContact(clientForm.directorContactId, directorPatch);
        } catch {
          // Client-level save already succeeded; contact sync is best-effort.
        }
      }
      const contacts = await resolveClientContacts(slotId, updated.contacts);
      setSelectedClients((prev) =>
        prev.map((slot) =>
          slot.clientId === slotId
            ? {
                ...slot,
                client: updated,
                companyName: updated.companyName || slot.companyName,
                clientForm: clientToSubmitForm(updated, contacts),
                saved: true,
              }
            : slot,
        ),
      );
      onToast(`${updated.companyName || 'Client'} details saved`);
    } catch (error: unknown) {
      onToast(error instanceof Error ? error.message : 'Unable to update client details');
    } finally {
      setSaving(false);
    }
  };

  const submitToClient = async () => {
    if (!activeSource) return;
    stashCurrentBulkCandidate();
    if (isBulkMode) {
      if (!allBulkCandidatesSaved) {
        onToast('Please save presentation for every candidate first');
        return;
      }
    } else if (!candidateStepSaved) {
      onToast('Please save candidate details first');
      return;
    }
    if (!allClientsSaved) {
      onToast('Please save details for each selected client first');
      return;
    }
    if (!submissionType) {
      setSubmissionTypeError('Select what this submission is for');
      onToast('Please choose a submission purpose');
      return;
    }

    const clientRecipients = selectedClients.map((slot) => {
      const toEmail = slot.clientForm.directorEmail.trim();
      return { clientId: slot.clientId, companyName: slot.companyName, toEmail };
    });
    const missingEmail = clientRecipients.find((item) => !item.toEmail);
    if (missingEmail) {
      onToast(`Client contact email is missing for ${missingEmail.companyName || 'a client'}`);
      return;
    }
    const invalidEmail = clientRecipients.find((item) => !validateCandidateEmail(item.toEmail).valid);
    if (invalidEmail) {
      const check = validateCandidateEmail(invalidEmail.toEmail);
      onToast(
        `Client contact email is invalid for ${invalidEmail.companyName || 'a client'}${
          check.message ? `: ${check.message}` : ''
        }`,
      );
      return;
    }

    const primaryRecipient =
      clientRecipients.find((item) =>
        selectedClients.find((slot) => slot.clientId === item.clientId)?.isPrimary,
      ) ?? clientRecipients[0];
    const additionalClients = clientRecipients
      .filter((item) => item.clientId !== primaryRecipient?.clientId)
      .map((item) => ({ clientId: item.clientId, toEmail: item.toEmail }));

    const purpose = SUBMISSION_TYPES.find((entry) => entry.value === submissionType)?.label || 'review';

    setSubmitting(true);
    try {
      if (activeSource.kind === 'bulkMatch') {
        const prepared: Array<{
          entry: (typeof activeSource.candidates)[number];
          matchId: string;
          message: string;
          entryCvShareMode: CvShareMode | '';
          resolvedJobId: string;
        }> = [];

        for (const entry of activeSource.candidates) {
          const cached = bulkCandidateCacheRef.current.get(entry.candidateId);
          const raw = await apiGetCandidate(entry.candidateId);
          const data = extractApiData<BackendCandidate>(raw);
          const entryResume = String(data.resume || '').trim();
          const entryHasOriginalCv = Boolean(
            entryResume && isResumeHttpUrl(entryResume),
          );
          const entryHasSaasaCv = Boolean(
            resolveSaasaCvPreviewUrl(
              data.extraData && typeof data.extraData === 'object' && !Array.isArray(data.extraData)
                ? (data.extraData as Record<string, unknown>)
                : null,
            ),
          );
          const entryCvShareMode =
            cached?.cvShareMode ??
            resolveDefaultCvShareMode(data, entryHasOriginalCv, entryHasSaasaCv);

          let mergedExtra: Record<string, unknown> =
            data.extraData && typeof data.extraData === 'object' && !Array.isArray(data.extraData)
              ? { ...(data.extraData as Record<string, unknown>) }
              : {};

          if (cached?.phase1Snapshot) {
            mergedExtra = buildClientPresentationExtraDataForPhase1(
              cached.phase1Snapshot,
              data,
              mergedExtra,
              { phase1VisibleSections: cached.phase1ClientSectionVisibility },
            );
          } else if (cached?.editForm) {
            mergedExtra = buildClientPresentationExtraData(cached.editForm, mergedExtra, {
              visibleSections: cached.clientSectionVisibility,
            });
          }

          if (entryCvShareMode) {
            mergedExtra = buildCvSubmissionExtra(mergedExtra, {
              shareMode: entryCvShareMode,
              updatedAt: new Date().toISOString(),
            });
          }

          if (cached?.phase1Snapshot || cached?.editForm || entryCvShareMode) {
            await apiUpdateCandidate(entry.candidateId, { extraData: mergedExtra });
          }

          let jobTitle = entry.jobTitle || '';
          const resolvedJobId =
            entry.jobId && isValidObjectId(entry.jobId)
              ? entry.jobId
              : resolveSubmitJobIdFromBackend(data);
          if (!resolvedJobId) {
            onToast(
              `Unable to resolve job for ${entry.candidateName || 'a candidate'}. Assign them to a job first.`,
            );
            return;
          }
          if (!jobTitle && resolvedJobId) {
            try {
              const jobRaw = await apiGetJob(resolvedJobId);
              jobTitle = extractApiData<BackendJob>(jobRaw).title || '';
            } catch {
              jobTitle = '';
            }
          }
          const message = `Please review the submitted candidate details for ${jobTitle || 'this role'}. Purpose: ${purpose}.`;
          const { matchId, error: matchError } = await resolveMatchIdForSubmit(
            entry.candidateId,
            resolvedJobId,
            entry.matchScore ?? 0,
            entry.matchId,
          );
          if (!matchId) {
            onToast(
              matchError ||
                `Unable to create match record for ${entry.candidateName || 'a candidate'}`,
            );
            return;
          }
          prepared.push({
            entry,
            matchId,
            message,
            entryCvShareMode: entryCvShareMode || '',
            resolvedJobId,
          });
        }

        const batchMatchIds = prepared.map((item) => item.matchId);
        let firstResult: SubmitMatchResult | null = null;

        for (let index = 0; index < prepared.length; index += 1) {
          const item = prepared[index]!;
          const submittedRaw = await apiSubmitMatch(item.matchId, {
            message: item.message,
            notifyClient: index === 0,
            submissionType,
            cvShareMode: item.entryCvShareMode || undefined,
            toEmail: index === 0 ? primaryRecipient?.toEmail : undefined,
            additionalClients: index === 0 ? additionalClients : undefined,
            batchMatchIds: batchMatchIds.length > 1 ? batchMatchIds : undefined,
          });
          if (index === 0) firstResult = readSubmitMatchResult(submittedRaw);
        }
        onToast(
          buildSubmitToast({
            candidateCount: activeSource.candidates.length,
            clientCount: clientRecipients.length,
            emailSent: firstResult?.emailSent,
            emailError: firstResult?.emailError,
          }),
        );
        markClean();
        notifyCandidateSubmitted();
        onSubmitted?.();
        onClose();
        return;
      }

      if (candidate?.id && cvShareMode && (editForm || phase1Snapshot)) {
        let presentationExtra =
          isPhase1Candidate && phase1Snapshot
            ? buildClientPresentationExtraDataForPhase1(
                phase1Snapshot,
                candidate,
                candidate.extraData ?? null,
                { phase1VisibleSections: phase1ClientSectionVisibility },
              )
            : buildClientPresentationExtraData(editForm!, candidate.extraData ?? null, {
                visibleSections: clientSectionVisibility,
              });
        const extraData = buildCvSubmissionExtra(presentationExtra, {
          shareMode: cvShareMode,
          updatedAt: new Date().toISOString(),
        });
        const updatedRaw = await apiUpdateCandidate(candidate.id, { extraData });
        setCandidate(extractApiData<BackendCandidate>(updatedRaw));
      }

      const title =
        resolvedJobTitle ||
        (activeSource.kind === 'interview' ? activeSource.interview.job.title : '') ||
        'this role';
      const message = `Please review the submitted candidate details for ${title}. Purpose: ${purpose}.`;

      if (activeSource.kind === 'interview') {
        let interviewEmailSent = false;
        let interviewEmailError: string | null = null;
        for (const recipient of clientRecipients) {
          const submittedRaw = await apiSubmitInterviewToClient(activeSource.interview.id, {
            toEmail: recipient.toEmail,
            message,
        submissionType,
            cvShareMode: cvShareMode || undefined,
          });
          const submitted = extractApiData<{
            reviewUrl?: string;
            emailSent?: boolean;
            emailError?: string | null;
          }>(submittedRaw);
          if (submitted?.emailSent) interviewEmailSent = true;
          if (submitted?.emailError) interviewEmailError = submitted.emailError;
        }
        onToast(
          buildSubmitToast({
            candidateCount: 1,
            clientCount: clientRecipients.length,
            emailSent: interviewEmailSent,
            emailError: interviewEmailError,
          }),
        );
      } else if (activeSource.kind === 'match') {
        let matchId = matchSubmitId;
        let matchResolveError: string | undefined;
        if (!matchId) {
          const resolved = await resolveMatchIdForSubmit(
            activeSource.candidateId,
            activeSource.jobId,
            activeSource.matchScore ?? 0,
            activeSource.matchId,
          );
          matchId = resolved.matchId;
          matchResolveError = resolved.error;
        }
        if (!matchId) {
          onToast(matchResolveError || 'Unable to create match record for this candidate');
          return;
        }

        const submittedRaw = await apiSubmitMatch(matchId, {
          message,
          notifyClient: true,
          submissionType,
          cvShareMode: cvShareMode || undefined,
          toEmail: primaryRecipient?.toEmail,
          additionalClients,
        });
        const submitted = readSubmitMatchResult(submittedRaw);
        onToast(
          buildSubmitToast({
            candidateCount: 1,
            clientCount: clientRecipients.length,
            emailSent: submitted.emailSent,
            emailError: submitted.emailError,
          }),
        );
      }
      markClean();
      notifyCandidateSubmitted();
      onSubmitted?.();
      onClose();
    } catch (error: unknown) {
      onToast(error instanceof Error ? error.message : 'Unable to submit to client');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
    <AnimatePresence>
      {isOpen ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => void requestClose()}
            className="fixed inset-0 z-[155] bg-slate-900/45"
            data-drawer-skip-dirty="true"
          />
          <motion.aside
            ref={panelRef}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.25 }}
            className="fixed right-0 top-0 z-[160] flex h-full w-3/4 max-w-6xl flex-col bg-white shadow-2xl border-l border-slate-200"
          >
            <div className="flex items-center justify-between border-b border-[#E5E7EB] px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-[#111827]">Submit to Client</h2>
                {isBulkMode ? (
                  <p className="text-sm text-[#6B7280]">
                    {bulkCandidates.length} candidate{bulkCandidates.length === 1 ? '' : 's'} ·{' '}
                    {bulkSavedCount}/{bulkCandidates.length} saved · reviewing {fullName}
                  </p>
                ) : (
                  <p className="text-sm text-[#6B7280]">{fullName}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => void requestClose()}
                className="rounded-lg p-2 text-[#6B7280] hover:bg-[#F3F4F6]"
                aria-label="Close submit to client drawer"
                data-drawer-skip-dirty="true"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <section
                className={`mb-4 rounded-xl border p-4 ${
                  submissionTypeError
                    ? 'border-red-300 bg-red-50'
                    : 'border-[#E5E7EB] bg-[#F9FAFB]'
                }`}
              >
                <label className="block text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                  Submission Purpose*
                </label>
                <select
                  value={submissionType}
                  onChange={(event) => {
                    const next = event.target.value as SubmissionTypeValue | '';
                    setSubmissionType(next);
                    if (next) setSubmissionTypeError(null);
                  }}
                  className={`mt-2 w-full rounded-lg border bg-white px-3 py-2 text-sm font-medium text-[#111827] ${
                    submissionTypeError ? 'border-red-400' : 'border-[#D1D5DB]'
                  }`}
                >
                  <option value="">Select why you're submitting to the client…</option>
                  {SUBMISSION_TYPES.map((entry) => (
                    <option key={entry.value} value={entry.value}>
                      {entry.label}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-[#6B7280]">
                  {submissionType
                    ? SUBMISSION_TYPES.find((entry) => entry.value === submissionType)?.description
                    : 'The client form changes based on this — pick the closest match.'}
                </p>
                {submissionTypeError ? (
                  <p className="mt-1 text-xs font-medium text-red-600">{submissionTypeError}</p>
                ) : null}
              </section>

              <div className="mb-4 space-y-2 border-b border-[#E5E7EB] pb-3">
                {isBulkMode ? (
                  <div className="mb-3 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                        Candidates in this submission
                      </p>
                      <p className="text-xs text-[#6B7280]">
                        Save each profile before submitting to the client
                      </p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {bulkCandidates.map((entry, index) => {
                        const saved = bulkSavedMap[entry.candidateId];
                        const isActive = index === activeBulkIndex;
                        return (
                          <button
                            key={entry.candidateId}
                            type="button"
                            onClick={() => goToBulkCandidate(index)}
                            className={`inline-flex max-w-full items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                              isActive
                                ? 'border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB]'
                                : saved
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                                  : 'border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F9FAFB]'
                            }`}
                            title={entry.candidateName || entry.candidateId}
                          >
                            <span className="truncate">{entry.candidateName || `Candidate ${index + 1}`}</span>
                            <span
                              className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                                saved ? 'bg-emerald-600 text-white' : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {saved ? 'Saved' : 'Pending'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        disabled={activeBulkIndex <= 0}
                        onClick={() => goToBulkCandidate(activeBulkIndex - 1)}
                        className="rounded-lg border border-[#D1D5DB] px-3 py-1.5 text-xs font-semibold text-[#374151] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <p className="text-xs text-[#6B7280]">
                        Candidate {activeBulkIndex + 1} of {bulkCandidates.length}
                      </p>
                      <button
                        type="button"
                        disabled={activeBulkIndex >= bulkCandidates.length - 1}
                        onClick={() => goToBulkCandidate(activeBulkIndex + 1)}
                        className="rounded-lg border border-[#D1D5DB] px-3 py-1.5 text-xs font-semibold text-[#374151] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                ) : null}
                <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('candidate')}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                      activeTab === 'candidate'
                        ? 'bg-[#EFF6FF] text-[#2563EB]'
                        : 'text-[#6B7280] hover:bg-[#F9FAFB]'
                  }`}
                >
                  Candidate
                </button>
                  {selectedClients.map((slot) => {
                    const isActive = activeTab === 'client' && activeClientId === slot.clientId;
                    return (
                      <div
                        key={slot.clientId}
                        className={`inline-flex items-center gap-1 rounded-lg border ${
                          isActive
                            ? 'border-[#BFDBFE] bg-[#EFF6FF]'
                            : 'border-transparent bg-[#F9FAFB]'
                        }`}
                      >
                <button
                  type="button"
                          onClick={() => {
                            setActiveTab('client');
                            setActiveClientId(slot.clientId);
                            if (!slot.client) void loadClientSlot(slot.clientId);
                          }}
                          className={`max-w-[11rem] truncate rounded-lg px-3 py-1.5 text-sm font-semibold ${
                            isActive ? 'text-[#2563EB]' : 'text-[#6B7280] hover:text-[#111827]'
                          }`}
                          title={slot.companyName || 'Client'}
                        >
                          {slot.companyName || 'Client'}
                          {slot.isPrimary ? ' *' : ''}
                </button>
                        {!slot.isPrimary ? (
                          <button
                            type="button"
                            onClick={() => removeClientSlot(slot.clientId)}
                            className="mr-1 rounded-md p-1 text-[#9CA3AF] hover:bg-white hover:text-[#EF4444]"
                            aria-label={`Remove ${slot.companyName || 'client'}`}
                          >
                            <X className="size-3.5" />
                          </button>
                        ) : null}
              </div>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setClientPickerOpen((open) => !open)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#D1D5DB] bg-white text-[#2563EB] hover:bg-[#EFF6FF]"
                    title="Add another client"
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
                {clientPickerOpen ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      defaultValue=""
                      onChange={(event) => {
                        const nextId = event.target.value;
                        if (nextId) addClientSlot(nextId);
                        event.target.value = '';
                      }}
                      className="min-w-[14rem] flex-1 rounded-lg border border-[#D1D5DB] bg-white px-3 py-2 text-sm text-[#111827]"
                    >
                      <option value="">Choose another client…</option>
                      {clientCatalog
                        .filter((item) => !selectedClients.some((slot) => slot.clientId === item.id))
                        .map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.companyName}
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setClientPickerOpen(false)}
                      className="rounded-lg px-3 py-2 text-sm font-medium text-[#6B7280] hover:bg-[#F3F4F6]"
                    >
                      Cancel
                    </button>
                  </div>
                ) : null}
                <p className="text-xs text-[#6B7280]">
                  * Assigned client for this job. Use + to send the same profile to more clients.
                </p>
              </div>
              {activeTab === 'candidate' && loading ? (
                <div className="flex items-center gap-2 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 text-sm text-[#4B5563]">
                  <Loader2 className="size-4 animate-spin" />
                  Loading candidate details...
                </div>
              ) : null}

              {activeTab === 'candidate' && !loading && !editForm && !phase1Snapshot ? (
                <div className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 text-sm text-[#6B7280]">
                  Candidate details could not be loaded. Close and try again.
                </div>
              ) : null}

              {activeTab === 'candidate' && !loading && isPhase1Candidate && phase1Snapshot && phase1ProfileStub ? (
                <div className="space-y-6">
                  <p className="text-sm text-[#6B7280]">
                    Same sections and fields as the Phase 1 candidate profile drawer. Edit what the client will see,
                    then save. Use Visible / Hidden on each section header to control the client review link.
                  </p>
                  {editError ? (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {editError}
                    </div>
                  ) : null}
                  <CandidatePhase1SubmitEditSections
                    candidate={phase1ProfileStub}
                    snapshot={phase1Snapshot}
                    onChange={updatePhase1Snapshot}
                    showClientSectionVisibility
                    clientSectionVisibility={phase1ClientSectionVisibility}
                    onToggleClientSectionVisibility={togglePhase1ClientSectionVisibility}
                  />

                  <ClientCvSelectionPanel {...clientCvSelectionPanelProps} />
                </div>
              ) : null}

              {activeTab === 'candidate' && !loading && !isPhase1Candidate && editForm ? (
                <div className="space-y-6">
                  <p className="text-sm text-[#6B7280]">
                    Same sections and fields as the candidate profile drawer. Edit what the client will see,
                    then save. Use Visible / Hidden on each section header to control the client review link.
                  </p>
                  {editError ? (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {editError}
                    </div>
                  ) : null}
                  <CandidateEditAtsSections
                    form={editForm}
                    onChange={updateEditField}
                    recruiters={[]}
                    jobs={pipelineJobs}
                    variant="clientSubmit"
                    showClientSectionVisibility
                    clientSectionVisibility={clientSectionVisibility}
                    onToggleClientSectionVisibility={toggleClientSectionVisibility}
                  />

                  <ClientCvSelectionPanel {...clientCvSelectionPanelProps} />
                </div>
              ) : null}

              {activeTab === 'client' ? (
                !activeClientSlot ? (
                  <div className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 text-sm text-[#6B7280]">
                    Select a client tab or use + to add a client.
                  </div>
                ) : activeClientSlot.loading ? (
                  <div className="flex items-center gap-2 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 text-sm text-[#4B5563]">
                    <Loader2 className="size-4 animate-spin" />
                    Loading client details...
                  </div>
                ) : activeClientSlot.client ? (
                  <div className="space-y-6">
                    <p className="text-sm text-[#6B7280]">
                      Same client details as the client drawer. Review and update before submitting.
                    </p>
                    <ClientOfferLetterCard
                      files={candidateFiles}
                      uploadsBase={uploadsBase}
                      loading={candidateFilesLoading}
                    />
                    <SubmitToClientClientDetailsPanel
                      client={activeClientSlot.client}
                      form={activeClientSlot.clientForm}
                      onPatchForm={patchActiveClientForm}
                    />
                  </div>
                ) : (
                  <div className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 text-sm text-[#6B7280]">
                    Client details are not available for this interview/job.
                  </div>
                )
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-[#E5E7EB] px-6 py-4">
              <button
                type="button"
                onClick={activeTab === 'client' ? saveClientDetails : saveDetails}
                disabled={
                  activeTab === 'client'
                    ? activeClientSlot?.loading || saving || !activeClientSlot?.client
                    : loading ||
                      saving ||
                      submitting ||
                      !candidate ||
                      (isPhase1Candidate ? !phase1Snapshot : !editForm)
                }
                className="inline-flex items-center gap-2 rounded-lg border border-[#D1D5DB] px-4 py-2 text-sm font-semibold text-[#111827] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save className="size-4" />
                {saving ? 'Saving...' : activeTab === 'client' ? 'Save Client Details' : 'Save Details'}
              </button>
              {activeTab === 'client' &&
              (isBulkMode ? allBulkCandidatesSaved : candidateStepSaved) &&
              allClientsSaved ? (
                <button
                  type="button"
                  onClick={submitToClient}
                  disabled={saving || submitting}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Send className="size-4" />
                  {submitting
                    ? 'Submitting...'
                    : selectedClients.length > 1
                      ? `Submit to ${selectedClients.length} Clients`
                      : 'Submit to Client'}
                </button>
              ) : null}
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
    {saasaCv.modals}
    <ResumePreviewModal
      isOpen={saasaPreviewOpen}
      onClose={() => setSaasaPreviewOpen(false)}
      resumeUrl={saasaCvPreviewUrl || null}
      candidateName={`HRYantra CV — ${fullName}`}
    />
    </>
  );
}
