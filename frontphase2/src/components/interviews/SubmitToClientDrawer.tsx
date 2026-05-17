'use client';

import React, { useEffect, useMemo, useState } from 'react';
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
import { resolveMatchIdForSubmit } from '../../lib/jobAppliedMatches';
import { extractApiData } from '../../lib/mapCandidateProfile';
import { parseClientsListFromResponse } from '../../lib/parseApiList';

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

interface CandidateFormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  linkedIn: string;
  currentTitle: string;
  currentCompany: string;
  experience: string;
  location: string;
  address: string;
  city: string;
  country: string;
  expectedSalary: string;
  noticePeriod: string;
  languages: string;
  education: string;
  certifications: string;
  skills: string;
  cvSummary: string;
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

const emptyForm: CandidateFormState = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  linkedIn: '',
  currentTitle: '',
  currentCompany: '',
  experience: '',
  location: '',
  address: '',
  city: '',
  country: '',
  expectedSalary: '',
  noticePeriod: '',
  languages: '',
  education: '',
  certifications: '',
  skills: '',
  cvSummary: '',
};

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

function toForm(candidate: BackendCandidate): CandidateFormState {
  const educationLines = (candidate.cvEducationEntries || [])
    .map((entry) =>
      [entry.degree, entry.institution, [entry.startYear, entry.endYear].filter(Boolean).join(' - ')]
        .filter(Boolean)
        .join(' | ')
    )
    .filter(Boolean);
  return {
    firstName: candidate.firstName || '',
    lastName: candidate.lastName || '',
    email: candidate.email || '',
    phone: candidate.phone || '',
    linkedIn: candidate.linkedIn || '',
    currentTitle: candidate.currentTitle || '',
    currentCompany: candidate.currentCompany || '',
    experience:
      typeof candidate.experience === 'number' && Number.isFinite(candidate.experience)
        ? String(candidate.experience)
        : '',
    location: candidate.location || '',
    address: candidate.address || '',
    city: candidate.city || '',
    country: candidate.country || '',
    expectedSalary:
      typeof candidate.expectedSalary === 'number' && Number.isFinite(candidate.expectedSalary)
        ? String(candidate.expectedSalary)
        : '',
    noticePeriod: candidate.noticePeriod || '',
    languages: (candidate.languages || []).join(', '),
    education: candidate.education || educationLines.join('\n'),
    certifications: (candidate.certifications || []).join(', '),
    skills: (candidate.skills || []).join(', '),
    cvSummary: candidate.cvSummary || '',
  };
}

function toFormFromInterview(interview: Interview): CandidateFormState {
  const parts = interview.candidate.name.trim().split(/\s+/).filter(Boolean);
  return {
    ...emptyForm,
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' '),
    email: interview.candidate.email || '',
    location: interview.job.client || '',
  };
}

function toFormFromDisplayName(name: string, email?: string): CandidateFormState {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    ...emptyForm,
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' '),
    email: email || '',
  };
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
  const activeSource: SubmitToClientSource | null =
    source ?? (interview ? { kind: 'interview', interview } : null);

  const candidateId =
    activeSource?.kind === 'interview'
      ? activeSource.interview.candidate.id
      : activeSource?.kind === 'match'
        ? activeSource.candidateId
        : '';

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
  const [form, setForm] = useState<CandidateFormState>(emptyForm);
  const [candidateStepSaved, setCandidateStepSaved] = useState(false);
  const [submissionType, setSubmissionType] = useState<SubmissionTypeValue | ''>('');
  const [submissionTypeError, setSubmissionTypeError] = useState<string | null>(null);

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
      onToast(error instanceof Error ? error.message : 'Unable to load client details');
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

  const fullName = useMemo(
    () => `${form.firstName} ${form.lastName}`.trim() || fallbackCandidateName || 'Candidate',
    [form.firstName, form.lastName, fallbackCandidateName],
  );

  useEffect(() => {
    if (!isOpen || activeSource?.kind !== 'match') {
      setMatchSubmitId(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const jobRaw = await apiGetJob(activeSource.jobId);
        const job = extractApiData<BackendJob>(jobRaw);
        if (cancelled) return;
        setResolvedClientId(activeSource.clientId || job.client?.id);
        setResolvedJobTitle(activeSource.jobTitle || job.title || '');
        const id = await resolveMatchIdForSubmit(
          activeSource.candidateId,
          activeSource.jobId,
          activeSource.matchScore ?? 0,
          activeSource.matchId,
        );
        if (!cancelled) setMatchSubmitId(id);
      } catch (error: unknown) {
        if (!cancelled) {
          onToast(error instanceof Error ? error.message : 'Unable to prepare match for submit');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, activeSource, onToast]);

  useEffect(() => {
    if (!isOpen || !candidateId) return;
    let cancelled = false;
    setActiveTab('candidate');
    setCandidateStepSaved(false);
    if (activeSource?.kind === 'interview') {
      setSubmissionType(inferSubmissionType(activeSource.interview));
      setResolvedJobTitle(activeSource.interview.job.title);
      setResolvedClientId(activeSource.interview.job.clientId);
    } else {
      setSubmissionType('INITIAL_REVIEW');
    }
    setSubmissionTypeError(null);
    setLoading(true);
    setCandidate((current) => current ?? ({ id: candidateId } as BackendCandidate));
    if (activeSource?.kind === 'interview') {
      setForm(toFormFromInterview(activeSource.interview));
    } else if (activeSource?.kind === 'match') {
      setForm(toFormFromDisplayName(activeSource.candidateName || '', undefined));
    }
    void (async () => {
      try {
        const raw = await apiGetCandidate(candidateId);
        const data = extractApiData<BackendCandidate>(raw);
        if (cancelled) return;
        setCandidate(data);
        setForm((current) => {
          const apiForm = toForm(data);
          return {
            ...current,
            ...apiForm,
            firstName: apiForm.firstName || current.firstName,
            lastName: apiForm.lastName || current.lastName,
            email: apiForm.email || current.email,
          };
        });
      } catch (error: unknown) {
        if (cancelled) return;
        onToast(error instanceof Error ? error.message : 'Unable to load candidate details');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, candidateId, activeSource, onToast]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedClients([]);
      setActiveClientId(null);
      setClientPickerOpen(false);
      setResumePreviewOpen(false);
      setCvEditorOpen(false);
      setCvEditorData(null);
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

    if (resolvedClientId) {
      const primarySlot = createClientSlot(resolvedClientId, true);
      setSelectedClients([primarySlot]);
      setActiveClientId(resolvedClientId);
      void loadClientSlot(resolvedClientId);
    } else {
      setSelectedClients([]);
      setActiveClientId(null);
    }

    return () => {
      cancelled = true;
    };
  }, [isOpen, resolvedClientId, onToast]);

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
  const hasEditedCv = hasEditedCvAvailable(candidate);
  const hasOriginalCv = Boolean(resumeHref);

  const cvFormOverrides = () => ({
    firstName: form.firstName,
    lastName: form.lastName,
    email: form.email,
    phone: form.phone,
    linkedIn: form.linkedIn,
    currentTitle: form.currentTitle,
    location: form.location,
    cvSummary: form.cvSummary,
    skills: form.skills,
  });

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
      setCvEditorData(candidateToCvEditorData(data, cvFormOverrides()));
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
    setCvViewData(candidateToCvEditorData(candidate, cvFormOverrides()));
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
    if (!candidate?.id) return;
    setSaving(true);
    try {
      const persist = await buildCvEditorPersistPatch(
        data,
        candidate.id,
        candidate.extraData ?? null
      );
      const patch = {
        ...cvEditorDataToCandidatePatch(data),
        ...persist,
      };
      const updatedRaw = await apiUpdateCandidate(candidate.id, patch);
      const updated = extractApiData<BackendCandidate>(updatedRaw);
      setCandidate(updated);
      setForm(toForm(updated));
      setCvEditorData(candidateToCvEditorData(updated, cvFormOverrides()));
      setCvViewData(candidateToCvEditorData(updated, cvFormOverrides()));
      if (hasEditedCvAvailable(updated)) {
        setCvShareMode('edited');
      }
      setCandidateStepSaved(true);
      onToast('CV updated');
      setCvEditorOpen(false);
    } catch (error: unknown) {
      onToast(error instanceof Error ? error.message : 'Unable to save CV');
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const saveDetails = async () => {
    if (!candidate) return;
    setSaving(true);
    try {
      const updatedRaw = await apiUpdateCandidate(candidate.id, {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        linkedIn: form.linkedIn.trim() || undefined,
        currentTitle: form.currentTitle.trim() || undefined,
        currentCompany: form.currentCompany.trim() || undefined,
        experience: form.experience.trim() ? Number(form.experience) : null,
        location: form.location.trim() || undefined,
        address: form.address.trim() || undefined,
        city: form.city.trim() || undefined,
        country: form.country.trim() || undefined,
        expectedSalary: form.expectedSalary.trim() ? Number(form.expectedSalary) : null,
        noticePeriod: form.noticePeriod.trim() || undefined,
        languages: form.languages
          .split(',')
          .map((part) => part.trim())
          .filter(Boolean),
        education: form.education.trim() || undefined,
        certifications: form.certifications
          .split(',')
          .map((part) => part.trim())
          .filter(Boolean),
        skills: form.skills
          .split(',')
          .map((part) => part.trim())
          .filter(Boolean),
        cvSummary: form.cvSummary.trim() || undefined,
      });
      const updated = extractApiData<BackendCandidate>(updatedRaw);
      setCandidate(updated);
      setForm(toForm(updated));
      setCandidateStepSaved(true);
      onToast('Candidate details updated');
    } catch (error: any) {
      onToast(error?.message || 'Unable to update candidate details');
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

              {activeTab === 'candidate' && !loading ? (
                <div className="space-y-6">
                  <section className="rounded-xl border border-[#E5E7EB] bg-white p-4">
                    <h3 className="text-sm font-semibold text-[#111827]">Personal Information</h3>
                    <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                      First Name
                      <input
                        value={form.firstName}
                        onChange={(e) => setForm((cur) => ({ ...cur, firstName: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm font-medium text-[#111827]"
                      />
                    </label>
                    <label className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                      Last Name
                      <input
                        value={form.lastName}
                        onChange={(e) => setForm((cur) => ({ ...cur, lastName: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm font-medium text-[#111827]"
                      />
                    </label>
                    <label className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                      Email
                      <input
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm((cur) => ({ ...cur, email: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm font-medium text-[#111827]"
                      />
                    </label>
                    <label className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                      Phone
                      <input
                        value={form.phone}
                        onChange={(e) => setForm((cur) => ({ ...cur, phone: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm font-medium text-[#111827]"
                      />
                    </label>
                    <label className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                      LinkedIn
                      <input
                        value={form.linkedIn}
                        onChange={(e) => setForm((cur) => ({ ...cur, linkedIn: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm font-medium text-[#111827]"
                      />
                    </label>
                    <label className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                      Current Title
                      <input
                        value={form.currentTitle}
                        onChange={(e) => setForm((cur) => ({ ...cur, currentTitle: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm font-medium text-[#111827]"
                      />
                    </label>
                    <label className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                      Current Company
                      <input
                        value={form.currentCompany}
                        onChange={(e) => setForm((cur) => ({ ...cur, currentCompany: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm font-medium text-[#111827]"
                      />
                    </label>
                    <label className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                      Experience (years)
                      <input
                        value={form.experience}
                        onChange={(e) => setForm((cur) => ({ ...cur, experience: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm font-medium text-[#111827]"
                      />
                    </label>
                    <label className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                      Expected Salary
                      <input
                        value={form.expectedSalary}
                        onChange={(e) => setForm((cur) => ({ ...cur, expectedSalary: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm font-medium text-[#111827]"
                      />
                    </label>
                    <label className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                      Location
                      <input
                        value={form.location}
                        onChange={(e) => setForm((cur) => ({ ...cur, location: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm font-medium text-[#111827]"
                      />
                    </label>
                    <label className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                      Notice Period
                      <input
                        value={form.noticePeriod}
                        onChange={(e) => setForm((cur) => ({ ...cur, noticePeriod: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm font-medium text-[#111827]"
                      />
                    </label>
                    <label className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                      Address
                      <input
                        value={form.address}
                        onChange={(e) => setForm((cur) => ({ ...cur, address: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm font-medium text-[#111827]"
                      />
                    </label>
                    <label className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                      City
                      <input
                        value={form.city}
                        onChange={(e) => setForm((cur) => ({ ...cur, city: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm font-medium text-[#111827]"
                      />
                    </label>
                    <label className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                      Country
                      <input
                        value={form.country}
                        onChange={(e) => setForm((cur) => ({ ...cur, country: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm font-medium text-[#111827]"
                      />
                    </label>
                  </div>
                  </section>

                  <section className="rounded-xl border border-[#E5E7EB] bg-white p-4">
                    <h3 className="text-sm font-semibold text-[#111827]">Summary</h3>
                    <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                      Candidate Summary
                      <textarea
                        value={form.cvSummary}
                        onChange={(e) => setForm((cur) => ({ ...cur, cvSummary: e.target.value }))}
                        rows={4}
                        className="mt-1 w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm text-[#111827]"
                      />
                    </label>
                  </section>

                  <section className="rounded-xl border border-[#E5E7EB] bg-white p-4">
                    <h3 className="text-sm font-semibold text-[#111827]">Education</h3>
                    <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                      Education Details
                      <textarea
                        value={form.education}
                        onChange={(e) => setForm((cur) => ({ ...cur, education: e.target.value }))}
                        rows={4}
                        className="mt-1 w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm text-[#111827]"
                      />
                    </label>
                    <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                      Certifications (comma separated)
                      <input
                        value={form.certifications}
                        onChange={(e) => setForm((cur) => ({ ...cur, certifications: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm font-medium text-[#111827]"
                      />
                    </label>
                  </section>

                  <section className="rounded-xl border border-[#E5E7EB] bg-white p-4">
                    <h3 className="text-sm font-semibold text-[#111827]">Skills & Languages</h3>
                    <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                      Skills (comma separated)
                      <input
                        value={form.skills}
                        onChange={(e) => setForm((cur) => ({ ...cur, skills: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm font-medium text-[#111827]"
                      />
                    </label>
                    <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                      Languages (comma separated)
                      <input
                        value={form.languages}
                        onChange={(e) => setForm((cur) => ({ ...cur, languages: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm font-medium text-[#111827]"
                      />
                    </label>
                  </section>

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
                    : loading || saving || submitting || !candidate
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
