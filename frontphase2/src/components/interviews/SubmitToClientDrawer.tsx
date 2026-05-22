'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Loader2, Plus, Save, Send, X } from 'lucide-react';
import CVEditorModal from '../CVEditorModal';
import { ClientCvSelectionPanel } from './ClientCvSelectionPanel';
import { ResumePreviewModal } from '../candidates/ResumePreviewModal';
import {
  buildCvEditorPersistPatch,
  buildCvSubmissionExtra,
  candidateToCvEditorData,
  cvEditorDataToCandidatePatch,
  hasEditedCvAvailable,
  resolveDefaultCvShareMode,
  type CVEditorData,
  type CvShareMode,
} from '../../lib/cvEditorMapping';
import { isResumeHttpUrl, normalizeResumeHref } from '../../lib/resumePreview';
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
import {
  buildCandidateEditForm,
  CandidateEditAtsSections,
  validateEditFormStructured,
  type CandidateEditFormState,
} from '../candidates/CandidateEditAtsSections';
import {
  buildClientPresentationExtraData,
  mergeBackendCandidateWithClientPresentation,
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
import { extractApiData } from '../../lib/mapCandidateProfile';
import { parseClientsListFromResponse, parseJobsListFromResponse } from '../../lib/parseApiList';

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
    };

interface SubmitToClientDrawerProps {
  isOpen: boolean;
  /** Legacy: interview-based submit (Interviews page) */
  interview?: Interview | null;
  /** Candidate + job submit (Job drawer, Candidates page) */
  source?: SubmitToClientSource | null;
  onClose: () => void;
  onToast: (message: string) => void;
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

interface ClientFormState {
  companyName: string;
  industry: string;
  website: string;
  location: string;
  companySize: string;
  hiringLocations: string;
  servicesNeeded: string;
  expectedBusinessValue: string;
  linkedin: string;
  priority: string;
}

interface ClientContactFormState {
  id: string;
  firstName: string;
  lastName: string;
  designation: string;
  email: string;
  phone: string;
}

interface ClientSlotState {
  clientId: string;
  companyName: string;
  isPrimary: boolean;
  client: BackendClient | null;
  clientForm: ClientFormState;
  contactsForm: ClientContactFormState[];
  saved: boolean;
  loading: boolean;
}

const emptyClientForm: ClientFormState = {
  companyName: '',
  industry: '',
  website: '',
  location: '',
  companySize: '',
  hiringLocations: '',
  servicesNeeded: '',
  expectedBusinessValue: '',
  linkedin: '',
  priority: '',
};

function createClientSlot(clientId: string, isPrimary: boolean, companyName = ''): ClientSlotState {
  return {
    clientId,
    companyName,
    isPrimary,
    client: null,
    clientForm: { ...emptyClientForm },
    contactsForm: [],
    saved: false,
    loading: false,
  };
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

function toClientForm(client: BackendClient): ClientFormState {
  return {
    companyName: client.companyName || '',
    industry: client.industry || '',
    website: client.website || '',
    location: client.location || '',
    companySize: client.companySize || '',
    hiringLocations: client.hiringLocations || '',
    servicesNeeded: client.servicesNeeded || '',
    expectedBusinessValue: client.expectedBusinessValue || '',
    linkedin: client.linkedin || '',
    priority: client.priority || '',
  };
}

function toClientContactForm(contacts: BackendClient['contacts']): ClientContactFormState[] {
  return (contacts || []).map((contact) => ({
    id: contact.id,
    firstName: contact.firstName || '',
    lastName: contact.lastName || '',
    designation: contact.designation || '',
    email: contact.email || '',
    phone: contact.phone || '',
  }));
}

function toClientContactFormFromBackendContacts(contacts: BackendContact[]): ClientContactFormState[] {
  return (contacts || []).map((contact) => ({
    id: contact.id,
    firstName: contact.firstName || '',
    lastName: contact.lastName || '',
    designation: contact.designation || '',
    email: contact.email || '',
    phone: contact.phone || '',
  }));
}

export function SubmitToClientDrawer({
  isOpen,
  interview = null,
  source = null,
  onClose,
  onToast,
}: SubmitToClientDrawerProps) {
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

  const candidateId =
    activeSource?.kind === 'interview'
      ? activeSource.interview.candidate.id
      : activeSource?.kind === 'match'
        ? activeSource.candidateId
        : '';

  const matchJobId = activeSource?.kind === 'match' ? activeSource.jobId : '';
  const matchClientId = activeSource?.kind === 'match' ? activeSource.clientId : undefined;
  const matchRecordId = activeSource?.kind === 'match' ? activeSource.matchId : undefined;
  const matchScore = activeSource?.kind === 'match' ? activeSource.matchScore : undefined;
  const matchCandidateName = activeSource?.kind === 'match' ? activeSource.candidateName : '';
  const matchJobTitleSeed = activeSource?.kind === 'match' ? activeSource.jobTitle : '';

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

  const uploadsBase = useMemo(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1';
    return apiBase.replace(/\/api\/v1\/?$/, '');
  }, []);

  const { files: candidateFiles, loading: candidateFilesLoading } = useFiles(
    'candidate',
    isOpen ? candidateId : null,
  );

  const activeClientSlot = useMemo(
    () => selectedClients.find((slot) => slot.clientId === activeClientId) ?? null,
    [selectedClients, activeClientId],
  );

  const allClientsSaved =
    selectedClients.length > 0 && selectedClients.every((slot) => slot.saved);

  const loadClientSlot = async (clientId: string) => {
    setSelectedClients((prev) =>
      prev.map((slot) => (slot.clientId === clientId ? { ...slot, loading: true } : slot)),
    );
    try {
      const raw = await apiGetClient(clientId);
      const data = extractApiData<BackendClient>(raw);
      const contactsRaw = await apiGetContacts({ clientId, limit: 100 });
      const contactsPayload = extractApiData<any>(contactsRaw);
      const contacts = Array.isArray(contactsPayload)
        ? contactsPayload
        : Array.isArray(contactsPayload?.data)
          ? contactsPayload.data
          : [];
      setSelectedClients((prev) =>
        prev.map((slot) =>
          slot.clientId === clientId
            ? {
                ...slot,
                client: data,
                companyName: data.companyName || slot.companyName,
                clientForm: toClientForm(data),
                contactsForm: toClientContactFormFromBackendContacts(contacts as BackendContact[]),
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

  const patchActiveClientForm = (patch: Partial<ClientFormState>) => {
    if (!activeClientId) return;
    setSelectedClients((prev) =>
      prev.map((slot) =>
        slot.clientId === activeClientId
          ? { ...slot, clientForm: { ...slot.clientForm, ...patch }, saved: false }
          : slot,
      ),
    );
  };

  const patchActiveClientContacts = (
    updater: (contacts: ClientContactFormState[]) => ClientContactFormState[],
  ) => {
    if (!activeClientId) return;
    setSelectedClients((prev) =>
      prev.map((slot) =>
        slot.clientId === activeClientId
          ? { ...slot, contactsForm: updater(slot.contactsForm), saved: false }
          : slot,
      ),
    );
  };

  const fallbackCandidateName =
    activeSource?.kind === 'interview'
      ? activeSource.interview.candidate.name
      : activeSource?.kind === 'match'
        ? activeSource.candidateName || ''
        : '';

  const fullName = useMemo(() => {
    if (editForm) {
      const fromForm = `${editForm.firstName} ${editForm.lastName}`.trim();
      if (fromForm) return fromForm;
    }
    return fallbackCandidateName || 'Candidate';
  }, [editForm, fallbackCandidateName]);

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

  useEffect(() => {
    if (!isOpen || activeSource?.kind !== 'match' || !matchJobId || !candidateId) {
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
        const id = await resolveMatchIdForSubmit(
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
      if (!isOpen) {
        loadedCandidateIdRef.current = null;
        candidateSetupIdRef.current = null;
        setLoading(false);
      }
      return;
    }

    if (candidateSetupIdRef.current !== candidateId) {
      candidateSetupIdRef.current = candidateId;
    setActiveTab('candidate');
    setCandidateStepSaved(false);
    setSubmissionTypeError(null);
      if (activeSource?.kind === 'interview') {
        setSubmissionType(inferSubmissionType(activeSource.interview));
        setResolvedJobTitle(activeSource.interview.job.title);
        setResolvedClientId(activeSource.interview.job.clientId);
        setEditForm(editFormFromInterview(activeSource.interview));
      } else {
        setSubmissionType('INITIAL_REVIEW');
        if (activeSource?.kind === 'match') {
          setEditForm(editFormFromDisplayName(matchCandidateName || '', undefined));
        }
      }
    }

    if (loadedCandidateIdRef.current === candidateId) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const raw = await apiGetCandidate(candidateId);
        const data = extractApiData<BackendCandidate>(raw);
        if (cancelled) return;
        loadedCandidateIdRef.current = candidateId;
        setCandidate(data);
        setEditForm((current) => resolveSubmitToClientEditForm(data, current));
        const savedPresentation = readClientPresentation(data.extraData);
        setClientSectionVisibility(
          normalizeClientSectionVisibility(savedPresentation?.visibleSections),
        );
      } catch (error: unknown) {
        if (cancelled) return;
        toast(error instanceof Error ? error.message : 'Unable to load candidate details');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
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
        setClientCatalog(
          clients.map((item) => ({
            id: item.id,
            companyName: item.companyName || 'Unnamed client',
          })),
        );
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

  const [resumePreviewOpen, setResumePreviewOpen] = useState(false);
  const [cvEditorOpen, setCvEditorOpen] = useState(false);
  const [cvViewOpen, setCvViewOpen] = useState(false);
  const [cvEditorData, setCvEditorData] = useState<CVEditorData | null>(null);
  const [cvViewData, setCvViewData] = useState<CVEditorData | null>(null);
  const [cvEditorLoading, setCvEditorLoading] = useState(false);
  const [cvShareMode, setCvShareMode] = useState<CvShareMode | null>(null);
  const [cvShareSaving, setCvShareSaving] = useState(false);
  const resumeValue = String(candidate?.resume || '').trim();
  const resumeHref = resumeValue && isResumeHttpUrl(resumeValue) ? normalizeResumeHref(resumeValue) : '';
  const presentationCandidate = useMemo(
    () => (candidate ? mergeBackendCandidateWithClientPresentation(candidate) : null),
    [candidate],
  );
  const hasEditedCv = hasEditedCvAvailable(presentationCandidate);
  const hasOriginalCv = Boolean(resumeHref);

  const cvFormOverrides = () => {
    if (!editForm) return {};
    return {
      firstName: editForm.firstName,
      lastName: editForm.lastName,
      email: editForm.email,
      phone: editForm.phone,
      linkedIn: editForm.linkedIn,
      currentTitle: editForm.currentTitle,
      location: editForm.location,
      cvSummary: editForm.cvSummary,
      skills: editForm.skills,
    };
  };

  const openCvEditor = async () => {
    if (!candidate?.id) {
      onToast('Candidate not loaded yet');
      return;
    }
    setCvEditorLoading(true);
    try {
      const raw = await apiGetCandidate(candidate.id);
      const data = extractApiData<BackendCandidate>(raw);
      setCandidate(data);
      const forClient = mergeBackendCandidateWithClientPresentation(data);
      setCvEditorData(candidateToCvEditorData(forClient, cvFormOverrides()));
      setCvEditorOpen(true);
    } catch (error: unknown) {
      onToast(error instanceof Error ? error.message : 'Unable to load CV data');
    } finally {
      setCvEditorLoading(false);
    }
  };

  const openCvView = () => {
    if (!candidate) {
      onToast('Candidate not loaded yet');
      return;
    }
    setCvViewData(
      candidateToCvEditorData(
        presentationCandidate ?? candidate,
        cvFormOverrides(),
      ),
    );
    setCvViewOpen(true);
  };

  useEffect(() => {
    if (!candidate) {
      setCvShareMode(null);
      return;
    }
    setCvShareMode(resolveDefaultCvShareMode(candidate, hasOriginalCv));
  }, [candidate, hasOriginalCv]);

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
      const updated = extractApiData<BackendCandidate>(updatedRaw);
      setCandidate(updated);
    } catch (error: unknown) {
      onToast(error instanceof Error ? error.message : 'Unable to save CV selection');
    } finally {
      setCvShareSaving(false);
    }
  };

  const excludeCvVersion = (mode: CvShareMode) => {
    if (mode === 'edited' && hasOriginalCv) {
      void persistCvShareMode('original');
      return;
    }
    if (mode === 'original' && hasEditedCv) {
      void persistCvShareMode('edited');
      return;
    }
    onToast('At least one CV version is required to submit to the client');
  };

  const handleCvEditorSave = async (data: CVEditorData) => {
    if (!candidate?.id || !editForm) return;
    setSaving(true);
    try {
      const presentationExtra = readClientPresentation(candidate.extraData)?.fields?.extraData ?? {};
      const persist = await buildCvEditorPersistPatch(
        data,
        candidate.id,
        presentationExtra as Record<string, unknown>
      );
      const cvPatch = cvEditorDataToCandidatePatch(data);
      const mergedForm: CandidateEditFormState = {
        ...editForm,
        cvSummary: cvPatch.cvSummary ?? editForm.cvSummary,
        cvEducationEntries: Array.isArray(cvPatch.cvEducationEntries)
          ? cvPatch.cvEducationEntries
              .map((entry) =>
                [
                  entry.degree || entry.qualification,
                  entry.institution || entry.instituteName,
                  entry.startYear,
                  entry.endYear,
                ]
                  .filter(Boolean)
                  .join(' | ')
              )
              .join('\n')
          : editForm.cvEducationEntries,
        cvWorkExperienceEntries: Array.isArray(cvPatch.cvWorkExperienceEntries)
          ? cvPatch.cvWorkExperienceEntries
              .map((entry) => {
                const header = [
                  entry.title,
                  entry.company,
                  entry.location,
                  entry.startDate,
                  entry.endDate,
                ]
                  .filter(Boolean)
                  .join(' | ');
                const responsibilities = (entry.responsibilities || []).join('; ');
                return [header, responsibilities].filter(Boolean).join('\n');
              })
              .join('\n\n')
          : editForm.cvWorkExperienceEntries,
        skills: Array.isArray(cvPatch.skills) ? cvPatch.skills.join(', ') : editForm.skills,
      };
      const layout =
        persist.extraData?.cvEditorLayout &&
        typeof persist.extraData.cvEditorLayout === 'object'
          ? (persist.extraData.cvEditorLayout as Record<string, unknown>)
          : null;
      const extraData = buildClientPresentationExtraData(mergedForm, candidate.extraData ?? null, {
        cvEditorLayout: layout,
        visibleSections: clientSectionVisibility,
      });
      const updatedRaw = await apiUpdateCandidate(candidate.id, { extraData });
      const updated = extractApiData<BackendCandidate>(updatedRaw);
      setCandidate(updated);
      const savedForm = readClientPresentation(updated.extraData)?.editForm ?? mergedForm;
      setEditForm(savedForm);
      const forClient = mergeBackendCandidateWithClientPresentation(updated);
      setCvEditorData(candidateToCvEditorData(forClient, cvFormOverrides()));
      setCvViewData(candidateToCvEditorData(forClient, cvFormOverrides()));
      setCvShareMode('edited');
      setCandidateStepSaved(true);
      onToast('Client CV saved (overview unchanged)');
      setCvEditorOpen(false);
    } catch (error: unknown) {
      onToast(error instanceof Error ? error.message : 'Unable to save CV');
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const saveDetails = async () => {
    if (!candidate || !editForm) return;
    setSaving(true);
    setEditError('');
    try {
      validateEditFormStructured(editForm);
      const extraData = buildClientPresentationExtraData(editForm, candidate.extraData ?? null, {
        visibleSections: clientSectionVisibility,
      });
      const updatedRaw = await apiUpdateCandidate(candidate.id, { extraData });
      const updated = extractApiData<BackendCandidate>(updatedRaw);
      setCandidate(updated);
      const saved = readClientPresentation(updated.extraData);
      setEditForm(saved?.editForm ?? editForm);
      if (saved?.visibleSections) {
        setClientSectionVisibility(saved.visibleSections);
      }
      setCandidateStepSaved(true);
      onToast('Client presentation saved (overview unchanged)');
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
    if (!candidateStepSaved) {
      onToast('Please save candidate details first');
      return;
    }
    const slotId = activeClientSlot.clientId;
    setSaving(true);
    try {
      const { clientForm, contactsForm } = activeClientSlot;
      const updatedRaw = await apiUpdateClient(activeClientSlot.client.id, {
        companyName: activeClientSlot.clientForm.companyName.trim(),
        industry: activeClientSlot.clientForm.industry.trim() || undefined,
        website: activeClientSlot.clientForm.website.trim() || undefined,
        location: activeClientSlot.clientForm.location.trim() || undefined,
        companySize: activeClientSlot.clientForm.companySize.trim() || undefined,
        hiringLocations: activeClientSlot.clientForm.hiringLocations.trim() || undefined,
        servicesNeeded: activeClientSlot.clientForm.servicesNeeded.trim() || undefined,
        expectedBusinessValue: activeClientSlot.clientForm.expectedBusinessValue.trim() || undefined,
        linkedin: activeClientSlot.clientForm.linkedin.trim() || undefined,
        priority: activeClientSlot.clientForm.priority.trim() || undefined,
      });
      const updated = extractApiData<BackendClient>(updatedRaw);
      await Promise.all(
        contactsForm.map((contact) =>
          apiUpdateContact(contact.id, {
            firstName: contact.firstName.trim(),
            lastName: contact.lastName.trim(),
            designation: contact.designation.trim() || undefined,
            email: contact.email.trim() || undefined,
            phone: contact.phone.trim() || undefined,
          }),
        ),
      );
      const contactsRaw = await apiGetContacts({ clientId: slotId, limit: 100 });
      const contactsPayload = extractApiData<any>(contactsRaw);
      const contacts = Array.isArray(contactsPayload)
        ? contactsPayload
        : Array.isArray(contactsPayload?.data)
          ? contactsPayload.data
          : [];
      setSelectedClients((prev) =>
        prev.map((slot) =>
          slot.clientId === slotId
            ? {
                ...slot,
                client: updated,
                companyName: updated.companyName || slot.companyName,
                clientForm: toClientForm(updated),
                contactsForm: toClientContactFormFromBackendContacts(contacts as BackendContact[]),
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
    if (!candidateStepSaved) {
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

    if ((hasEditedCv || hasOriginalCv) && !cvShareMode) {
      onToast('Select which CV to send to the client');
      return;
    }

    const clientRecipients = selectedClients.map((slot) => {
      const toEmail = slot.contactsForm.find((contact) => contact.email.trim())?.email.trim() || '';
      return { clientId: slot.clientId, companyName: slot.companyName, toEmail };
    });
    const missingEmail = clientRecipients.find((item) => !item.toEmail);
    if (missingEmail) {
      onToast(`Client contact email is missing for ${missingEmail.companyName || 'a client'}`);
      return;
    }

    setSubmitting(true);
    try {
      if (candidate?.id && cvShareMode && editForm) {
        let presentationExtra = buildClientPresentationExtraData(editForm, candidate.extraData ?? null, {
          visibleSections: clientSectionVisibility,
        });
        if (cvShareMode === 'edited' && cvEditorData) {
          const presentationPipeline = readClientPresentation(candidate.extraData)?.fields?.extraData ?? {};
          const persist = await buildCvEditorPersistPatch(
            cvEditorData,
            candidate.id,
            presentationPipeline as Record<string, unknown>,
          );
          const layout =
            persist.extraData?.cvEditorLayout &&
            typeof persist.extraData.cvEditorLayout === 'object'
              ? (persist.extraData.cvEditorLayout as Record<string, unknown>)
              : null;
          presentationExtra = buildClientPresentationExtraData(editForm, presentationExtra, {
            cvEditorLayout: layout,
          });
        }
        const extraData = buildCvSubmissionExtra(presentationExtra, {
          shareMode: cvShareMode,
          updatedAt: new Date().toISOString(),
        });
        const updatedRaw = await apiUpdateCandidate(candidate.id, { extraData });
        setCandidate(extractApiData<BackendCandidate>(updatedRaw));
      }

      const purpose = SUBMISSION_TYPES.find((entry) => entry.value === submissionType)?.label || 'review';
      const title =
        resolvedJobTitle ||
        (activeSource.kind === 'interview' ? activeSource.interview.job.title : '') ||
        'this role';
      const message = `Please review the submitted candidate details for ${title}. Purpose: ${purpose}.`;

      if (activeSource.kind === 'interview') {
        for (const recipient of clientRecipients) {
          await apiSubmitInterviewToClient(activeSource.interview.id, {
            toEmail: recipient.toEmail,
            message,
        submissionType,
            cvShareMode: cvShareMode || undefined,
          });
        }
        onToast(
          clientRecipients.length > 1
            ? `Submitted and emailed ${clientRecipients.length} clients`
            : 'Submitted and email sent to client',
        );
      } else {
        let matchId = matchSubmitId;
        if (!matchId) {
          matchId = await resolveMatchIdForSubmit(
            activeSource.candidateId,
            activeSource.jobId,
            activeSource.matchScore ?? 0,
            activeSource.matchId,
          );
        }
        if (!matchId) {
          onToast('Unable to create match record for this candidate');
          return;
        }
        const primary =
          clientRecipients.find((item) =>
            selectedClients.find((slot) => slot.clientId === item.clientId)?.isPrimary,
          ) ?? clientRecipients[0];
        const additionalClients = clientRecipients
          .filter((item) => item.clientId !== primary?.clientId)
          .map((item) => ({ clientId: item.clientId, toEmail: item.toEmail }));

        await apiSubmitMatch(matchId, {
          message,
          notifyClient: true,
          submissionType,
          cvShareMode: cvShareMode || undefined,
          additionalClients,
        });
        onToast(
          clientRecipients.length > 1
            ? `Submitted and emailed ${clientRecipients.length} clients`
            : 'Submitted and email sent to client',
        );
      }
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
            onClick={onClose}
            className="fixed inset-0 z-[115] bg-slate-900/45"
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.25 }}
            className="fixed right-0 top-0 z-[116] flex h-full w-3/4 max-w-6xl flex-col bg-white shadow-2xl border-l border-slate-200"
          >
            <div className="flex items-center justify-between border-b border-[#E5E7EB] px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-[#111827]">Submit to Client</h2>
                <p className="text-sm text-[#6B7280]">{fullName}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-2 text-[#6B7280] hover:bg-[#F3F4F6]"
                aria-label="Close submit to client drawer"
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

              {activeTab === 'candidate' && !loading && !editForm ? (
                <div className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 text-sm text-[#6B7280]">
                  Candidate details could not be loaded. Close and try again.
                </div>
              ) : null}

              {activeTab === 'candidate' && !loading && editForm ? (
                <div className="space-y-6">
                  <p className="text-sm text-[#6B7280]">
                    Edit the client-facing copy only. Saving here does not change the candidate Overview tab —
                    it is stored under the profile&apos;s Client tab. Use Visible / Hidden on each section to
                    control what appears on the client review link.
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
                    showClientSectionVisibility
                    clientSectionVisibility={clientSectionVisibility}
                    onToggleClientSectionVisibility={toggleClientSectionVisibility}
                  />

                  <ClientCvSelectionPanel
                    candidate={candidate}
                    cvShareMode={cvShareMode}
                    cvShareSaving={cvShareSaving}
                    hasEditedCv={hasEditedCv}
                    hasOriginalCv={hasOriginalCv}
                    resumeHref={resumeHref}
                    cvEditorLoading={cvEditorLoading}
                    loading={loading}
                    onSelectMode={(mode) => void persistCvShareMode(mode)}
                    onExcludeVersion={excludeCvVersion}
                    onEditCv={() => void openCvEditor()}
                    onPreviewEdited={openCvView}
                    onPreviewOriginal={() => setResumePreviewOpen(true)}
                  />
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
                    <ClientOfferLetterCard
                      files={candidateFiles}
                      uploadsBase={uploadsBase}
                      loading={candidateFilesLoading}
                    />
                    <section className="rounded-xl border border-[#E5E7EB] bg-white p-4">
                      <h3 className="text-sm font-semibold text-[#111827]">Client Information</h3>
                      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <label className="text-xs font-semibold uppercase text-[#6B7280]">Company Name<input value={activeClientSlot.clientForm.companyName} onChange={(e) => patchActiveClientForm({ companyName: e.target.value })} className="mt-1 w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm font-medium normal-case text-[#111827]" /></label>
                        <label className="text-xs font-semibold uppercase text-[#6B7280]">Industry<input value={activeClientSlot.clientForm.industry} onChange={(e) => patchActiveClientForm({ industry: e.target.value })} className="mt-1 w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm font-medium normal-case text-[#111827]" /></label>
                        <label className="text-xs font-semibold uppercase text-[#6B7280]">Website<input value={activeClientSlot.clientForm.website} onChange={(e) => patchActiveClientForm({ website: e.target.value })} className="mt-1 w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm font-medium normal-case text-[#111827]" /></label>
                        <label className="text-xs font-semibold uppercase text-[#6B7280]">Location<input value={activeClientSlot.clientForm.location} onChange={(e) => patchActiveClientForm({ location: e.target.value })} className="mt-1 w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm font-medium normal-case text-[#111827]" /></label>
                        <label className="text-xs font-semibold uppercase text-[#6B7280]">Company Size<input value={activeClientSlot.clientForm.companySize} onChange={(e) => patchActiveClientForm({ companySize: e.target.value })} className="mt-1 w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm font-medium normal-case text-[#111827]" /></label>
                        <label className="text-xs font-semibold uppercase text-[#6B7280]">Hiring Locations<input value={activeClientSlot.clientForm.hiringLocations} onChange={(e) => patchActiveClientForm({ hiringLocations: e.target.value })} className="mt-1 w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm font-medium normal-case text-[#111827]" /></label>
                        <label className="text-xs font-semibold uppercase text-[#6B7280]">Services Needed<input value={activeClientSlot.clientForm.servicesNeeded} onChange={(e) => patchActiveClientForm({ servicesNeeded: e.target.value })} className="mt-1 w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm font-medium normal-case text-[#111827]" /></label>
                        <div><p className="text-xs font-semibold uppercase text-[#6B7280]">Client Since</p><p className="mt-1 text-sm text-[#111827]">{activeClientSlot.client.clientSince || '-'}</p></div>
                        <label className="text-xs font-semibold uppercase text-[#6B7280]">Priority<input value={activeClientSlot.clientForm.priority} onChange={(e) => patchActiveClientForm({ priority: e.target.value })} className="mt-1 w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm font-medium normal-case text-[#111827]" /></label>
                        <label className="sm:col-span-2 text-xs font-semibold uppercase text-[#6B7280]">Expected Business Value<input value={activeClientSlot.clientForm.expectedBusinessValue} onChange={(e) => patchActiveClientForm({ expectedBusinessValue: e.target.value })} className="mt-1 w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm font-medium normal-case text-[#111827]" /></label>
                        <label className="sm:col-span-2 text-xs font-semibold uppercase text-[#6B7280]">LinkedIn<input value={activeClientSlot.clientForm.linkedin} onChange={(e) => patchActiveClientForm({ linkedin: e.target.value })} className="mt-1 w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm font-medium normal-case text-[#111827]" /></label>
                      </div>
                    </section>
                    <section className="rounded-xl border border-[#E5E7EB] bg-white p-4">
                      <h3 className="text-sm font-semibold text-[#111827]">Client Contacts</h3>
                      {activeClientSlot.contactsForm.length > 0 ? (
                        <div className="mt-3 space-y-3">
                          {activeClientSlot.contactsForm.map((contact, index) => (
                            <div key={contact.id} className="rounded-lg border border-[#F1F5F9] bg-[#FAFAFA] p-3">
                              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <label className="text-xs font-semibold uppercase text-[#6B7280]">First Name<input value={contact.firstName} onChange={(e) => patchActiveClientContacts((curr) => curr.map((item, i) => i === index ? { ...item, firstName: e.target.value } : item))} className="mt-1 w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm normal-case text-[#111827]" /></label>
                                <label className="text-xs font-semibold uppercase text-[#6B7280]">Last Name<input value={contact.lastName} onChange={(e) => patchActiveClientContacts((curr) => curr.map((item, i) => i === index ? { ...item, lastName: e.target.value } : item))} className="mt-1 w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm normal-case text-[#111827]" /></label>
                                <label className="text-xs font-semibold uppercase text-[#6B7280]">Designation<input value={contact.designation} onChange={(e) => patchActiveClientContacts((curr) => curr.map((item, i) => i === index ? { ...item, designation: e.target.value } : item))} className="mt-1 w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm normal-case text-[#111827]" /></label>
                                <label className="text-xs font-semibold uppercase text-[#6B7280]">Email<input value={contact.email} onChange={(e) => patchActiveClientContacts((curr) => curr.map((item, i) => i === index ? { ...item, email: e.target.value } : item))} className="mt-1 w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm normal-case text-[#111827]" /></label>
                                <label className="text-xs font-semibold uppercase text-[#6B7280] sm:col-span-2">Phone<input value={contact.phone} onChange={(e) => patchActiveClientContacts((curr) => curr.map((item, i) => i === index ? { ...item, phone: e.target.value } : item))} className="mt-1 w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm normal-case text-[#111827]" /></label>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-3 text-sm text-[#6B7280]">No contacts available for this client.</p>
                      )}
                    </section>
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
                    : loading || saving || submitting || !candidate || !editForm
                }
                className="inline-flex items-center gap-2 rounded-lg border border-[#D1D5DB] px-4 py-2 text-sm font-semibold text-[#111827] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save className="size-4" />
                {saving ? 'Saving...' : activeTab === 'client' ? 'Save Client Details' : 'Save Details'}
              </button>
              {activeTab === 'client' && candidateStepSaved && allClientsSaved ? (
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

    <ResumePreviewModal
      isOpen={resumePreviewOpen}
      onClose={() => setResumePreviewOpen(false)}
      resumeUrl={resumeHref || null}
      candidateName={fullName}
    />

    {cvEditorOpen && cvEditorData ? (
      <CVEditorModal
        initialData={cvEditorData}
        onClose={() => setCvEditorOpen(false)}
        onSave={handleCvEditorSave}
        primaryButtonLabel="Save CV"
      />
    ) : null}

    {cvViewOpen && cvViewData ? (
      <CVEditorModal
        initialData={cvViewData}
        readOnly
        onClose={() => setCvViewOpen(false)}
      />
    ) : null}
    </>
  );
}
