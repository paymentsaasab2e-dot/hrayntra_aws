'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Loader2, Save, Send, X } from 'lucide-react';
import type { Interview } from '../../types/interview.types';
import {
  apiGetCandidate,
  apiGetContacts,
  apiGetClient,
  apiSubmitInterviewToClient,
  apiUpdateContact,
  apiUpdateClient,
  apiUpdateCandidate,
  type BackendCandidate,
  type BackendContact,
  type BackendClient,
} from '../../lib/api';

interface SubmitToClientDrawerProps {
  isOpen: boolean;
  interview: Interview | null;
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

function extractApiData<T>(response: { data?: T | { data?: T } } | T): T {
  if ((response as { data?: T | { data?: T } })?.data) {
    const payload = (response as { data?: T | { data?: T } }).data;
    if (payload && typeof payload === 'object' && 'data' in payload) {
      return (payload as { data?: T }).data as T;
    }
    return payload as T;
  }
  return response as T;
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
  interview,
  onClose,
  onToast,
}: SubmitToClientDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [clientLoading, setClientLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [candidate, setCandidate] = useState<BackendCandidate | null>(null);
  const [client, setClient] = useState<BackendClient | null>(null);
  const [activeTab, setActiveTab] = useState<'candidate' | 'client'>('candidate');
  const [form, setForm] = useState<CandidateFormState>(emptyForm);
  const [clientForm, setClientForm] = useState<ClientFormState>(emptyClientForm);
  const [clientContactsForm, setClientContactsForm] = useState<ClientContactFormState[]>([]);
  const [candidateStepSaved, setCandidateStepSaved] = useState(false);
  const [clientStepSaved, setClientStepSaved] = useState(false);
  const [submissionType, setSubmissionType] = useState<SubmissionTypeValue | ''>('');
  const [submissionTypeError, setSubmissionTypeError] = useState<string | null>(null);

  const loadClientContacts = async (clientId: string) => {
    const raw = await apiGetContacts({ clientId, limit: 100 });
    const payload = extractApiData<any>(raw);
    const contacts = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : [];
    setClientContactsForm(toClientContactFormFromBackendContacts(contacts as BackendContact[]));
  };

  const fullName = useMemo(
    () => `${form.firstName} ${form.lastName}`.trim() || interview?.candidate.name || 'Candidate',
    [form.firstName, form.lastName, interview?.candidate.name]
  );

  useEffect(() => {
    if (!isOpen || !interview?.candidate.id) return;
    let cancelled = false;
    setActiveTab('candidate');
    setCandidateStepSaved(false);
    setClientStepSaved(false);
    // Pre-fill the purpose from the interview state so the common case ("just
    // scheduled, share with client first") needs no extra clicks. We only
    // commit the inferred value here — the recruiter can still override.
    setSubmissionType(inferSubmissionType(interview));
    setSubmissionTypeError(null);
    setLoading(true);
    setCandidate((current) => current ?? ({ id: interview.candidate.id } as BackendCandidate));
    setForm(toFormFromInterview(interview));
    void (async () => {
      try {
        const raw = await apiGetCandidate(interview.candidate.id);
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
      } catch (error: any) {
        if (cancelled) return;
        onToast(error?.message || 'Unable to load candidate details');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, interview?.candidate.id, onToast]);

  useEffect(() => {
    if (!isOpen || !interview?.job.clientId) {
      setClient(null);
      return;
    }
    let cancelled = false;
    setClientLoading(true);
    void (async () => {
      try {
        const raw = await apiGetClient(interview.job.clientId as string);
        const data = extractApiData<BackendClient>(raw);
        if (cancelled) return;
        setClient(data);
        setClientForm(toClientForm(data));
        await loadClientContacts(interview.job.clientId as string);
      } catch (error: any) {
        if (cancelled) return;
        setClient(null);
        onToast(error?.message || 'Unable to load client details');
      } finally {
        if (!cancelled) setClientLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, interview?.job.clientId, onToast]);

  const resumeValue = candidate?.resume || '';
  const isResumeLink = /^https?:\/\//i.test(resumeValue);

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
    if (!client) return;
    if (!candidateStepSaved) {
      onToast('Please save candidate details first');
      return;
    }
    setSaving(true);
    try {
      const updatedRaw = await apiUpdateClient(client.id, {
        companyName: clientForm.companyName.trim(),
        industry: clientForm.industry.trim() || undefined,
        website: clientForm.website.trim() || undefined,
        location: clientForm.location.trim() || undefined,
        companySize: clientForm.companySize.trim() || undefined,
        hiringLocations: clientForm.hiringLocations.trim() || undefined,
        servicesNeeded: clientForm.servicesNeeded.trim() || undefined,
        expectedBusinessValue: clientForm.expectedBusinessValue.trim() || undefined,
        linkedin: clientForm.linkedin.trim() || undefined,
        priority: clientForm.priority.trim() || undefined,
      });
      const updated = extractApiData<BackendClient>(updatedRaw);
      await Promise.all(
        clientContactsForm.map((contact) =>
          apiUpdateContact(contact.id, {
            firstName: contact.firstName.trim(),
            lastName: contact.lastName.trim(),
            designation: contact.designation.trim() || undefined,
            email: contact.email.trim() || undefined,
            phone: contact.phone.trim() || undefined,
          })
        )
      );
      setClient(updated);
      setClientForm(toClientForm(updated));
      await loadClientContacts(client.id);
      setClientStepSaved(true);
      onToast('Client details and contacts updated');
    } catch (error: any) {
      onToast(error?.message || 'Unable to update client details');
    } finally {
      setSaving(false);
    }
  };

  const submitToClient = async () => {
    if (!interview) return;
    if (!candidateStepSaved) {
      onToast('Please save candidate details first');
      return;
    }
    if (!clientStepSaved) {
      onToast('Please save client details first');
      return;
    }
    if (!submissionType) {
      // Purpose is required so the public review page knows whether to ask the
      // client for an offer letter, just a tag, etc. We surface the error both
      // inline and as a toast since the field lives in the candidate tab.
      setSubmissionTypeError('Select what this submission is for');
      onToast('Please choose a submission purpose');
      return;
    }
    const recipient = clientContactsForm.find((contact) => contact.email.trim())?.email.trim() || '';
    if (!recipient) {
      onToast('Client contact email is missing');
      return;
    }

    setSubmitting(true);
    try {
      const purpose = SUBMISSION_TYPES.find((entry) => entry.value === submissionType)?.label || 'review';
      const response = await apiSubmitInterviewToClient(interview.id, {
        toEmail: recipient,
        message: `Please review the submitted candidate details for ${interview.job.title}. Purpose: ${purpose}.`,
        submissionType,
      });
      const reviewUrl =
        (response as any)?.reviewUrl ||
        (response as any)?.data?.reviewUrl ||
        '';
      onToast(reviewUrl ? 'Submitted and email sent to client' : 'Submitted to client');
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
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
            className="fixed right-0 top-0 z-[116] flex h-full w-full flex-col bg-white shadow-2xl sm:max-w-[620px]"
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

              <div className="mb-4 flex items-center gap-2 border-b border-[#E5E7EB] pb-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('candidate')}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                    activeTab === 'candidate' ? 'bg-[#EFF6FF] text-[#2563EB]' : 'text-[#6B7280] hover:bg-[#F9FAFB]'
                  }`}
                >
                  Candidate
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('client')}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                    activeTab === 'client' ? 'bg-[#EFF6FF] text-[#2563EB]' : 'text-[#6B7280] hover:bg-[#F9FAFB]'
                  }`}
                >
                  Client
                </button>
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

                  <section className="rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] px-4 py-3">
                    <h3 className="text-sm font-semibold text-[#111827]">Resume</h3>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Resume</p>
                    {resumeValue ? (
                      isResumeLink ? (
                        <a
                          href={resumeValue}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-flex text-sm font-semibold text-[#2563EB] hover:underline"
                        >
                          Open Resume
                        </a>
                      ) : (
                        <p className="mt-1 break-words text-sm text-[#374151]">{resumeValue}</p>
                      )
                    ) : (
                      <p className="mt-1 text-sm text-[#9CA3AF]">No resume available for this candidate.</p>
                    )}
                  </section>
                </div>
              ) : null}

              {activeTab === 'client' ? (
                clientLoading ? (
                  <div className="flex items-center gap-2 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 text-sm text-[#4B5563]">
                    <Loader2 className="size-4 animate-spin" />
                    Loading client details...
                  </div>
                ) : client ? (
                  <div className="space-y-6">
                    <section className="rounded-xl border border-[#E5E7EB] bg-white p-4">
                      <h3 className="text-sm font-semibold text-[#111827]">Client Information</h3>
                      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <label className="text-xs font-semibold uppercase text-[#6B7280]">Company Name<input value={clientForm.companyName} onChange={(e) => setClientForm((c) => ({ ...c, companyName: e.target.value }))} className="mt-1 w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm font-medium normal-case text-[#111827]" /></label>
                        <label className="text-xs font-semibold uppercase text-[#6B7280]">Industry<input value={clientForm.industry} onChange={(e) => setClientForm((c) => ({ ...c, industry: e.target.value }))} className="mt-1 w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm font-medium normal-case text-[#111827]" /></label>
                        <label className="text-xs font-semibold uppercase text-[#6B7280]">Website<input value={clientForm.website} onChange={(e) => setClientForm((c) => ({ ...c, website: e.target.value }))} className="mt-1 w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm font-medium normal-case text-[#111827]" /></label>
                        <label className="text-xs font-semibold uppercase text-[#6B7280]">Location<input value={clientForm.location} onChange={(e) => setClientForm((c) => ({ ...c, location: e.target.value }))} className="mt-1 w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm font-medium normal-case text-[#111827]" /></label>
                        <label className="text-xs font-semibold uppercase text-[#6B7280]">Company Size<input value={clientForm.companySize} onChange={(e) => setClientForm((c) => ({ ...c, companySize: e.target.value }))} className="mt-1 w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm font-medium normal-case text-[#111827]" /></label>
                        <label className="text-xs font-semibold uppercase text-[#6B7280]">Hiring Locations<input value={clientForm.hiringLocations} onChange={(e) => setClientForm((c) => ({ ...c, hiringLocations: e.target.value }))} className="mt-1 w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm font-medium normal-case text-[#111827]" /></label>
                        <label className="text-xs font-semibold uppercase text-[#6B7280]">Services Needed<input value={clientForm.servicesNeeded} onChange={(e) => setClientForm((c) => ({ ...c, servicesNeeded: e.target.value }))} className="mt-1 w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm font-medium normal-case text-[#111827]" /></label>
                        <div><p className="text-xs font-semibold uppercase text-[#6B7280]">Client Since</p><p className="mt-1 text-sm text-[#111827]">{client.clientSince || '-'}</p></div>
                        <label className="text-xs font-semibold uppercase text-[#6B7280]">Priority<input value={clientForm.priority} onChange={(e) => setClientForm((c) => ({ ...c, priority: e.target.value }))} className="mt-1 w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm font-medium normal-case text-[#111827]" /></label>
                        <label className="sm:col-span-2 text-xs font-semibold uppercase text-[#6B7280]">Expected Business Value<input value={clientForm.expectedBusinessValue} onChange={(e) => setClientForm((c) => ({ ...c, expectedBusinessValue: e.target.value }))} className="mt-1 w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm font-medium normal-case text-[#111827]" /></label>
                        <label className="sm:col-span-2 text-xs font-semibold uppercase text-[#6B7280]">LinkedIn<input value={clientForm.linkedin} onChange={(e) => setClientForm((c) => ({ ...c, linkedin: e.target.value }))} className="mt-1 w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm font-medium normal-case text-[#111827]" /></label>
                      </div>
                    </section>
                    <section className="rounded-xl border border-[#E5E7EB] bg-white p-4">
                      <h3 className="text-sm font-semibold text-[#111827]">Client Contacts</h3>
                      {clientContactsForm.length > 0 ? (
                        <div className="mt-3 space-y-3">
                          {clientContactsForm.map((contact, index) => (
                            <div key={contact.id} className="rounded-lg border border-[#F1F5F9] bg-[#FAFAFA] p-3">
                              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <label className="text-xs font-semibold uppercase text-[#6B7280]">First Name<input value={contact.firstName} onChange={(e) => setClientContactsForm((curr) => curr.map((item, i) => i === index ? { ...item, firstName: e.target.value } : item))} className="mt-1 w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm normal-case text-[#111827]" /></label>
                                <label className="text-xs font-semibold uppercase text-[#6B7280]">Last Name<input value={contact.lastName} onChange={(e) => setClientContactsForm((curr) => curr.map((item, i) => i === index ? { ...item, lastName: e.target.value } : item))} className="mt-1 w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm normal-case text-[#111827]" /></label>
                                <label className="text-xs font-semibold uppercase text-[#6B7280]">Designation<input value={contact.designation} onChange={(e) => setClientContactsForm((curr) => curr.map((item, i) => i === index ? { ...item, designation: e.target.value } : item))} className="mt-1 w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm normal-case text-[#111827]" /></label>
                                <label className="text-xs font-semibold uppercase text-[#6B7280]">Email<input value={contact.email} onChange={(e) => setClientContactsForm((curr) => curr.map((item, i) => i === index ? { ...item, email: e.target.value } : item))} className="mt-1 w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm normal-case text-[#111827]" /></label>
                                <label className="text-xs font-semibold uppercase text-[#6B7280] sm:col-span-2">Phone<input value={contact.phone} onChange={(e) => setClientContactsForm((curr) => curr.map((item, i) => i === index ? { ...item, phone: e.target.value } : item))} className="mt-1 w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm normal-case text-[#111827]" /></label>
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
                    ? clientLoading || saving || !client
                    : loading || saving || submitting || !candidate
                }
                className="inline-flex items-center gap-2 rounded-lg border border-[#D1D5DB] px-4 py-2 text-sm font-semibold text-[#111827] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save className="size-4" />
                {saving ? 'Saving...' : activeTab === 'client' ? 'Save Client Details' : 'Save Details'}
              </button>
              {activeTab === 'client' && candidateStepSaved && clientStepSaved ? (
                <button
                  type="button"
                  onClick={submitToClient}
                  disabled={saving || submitting}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Send className="size-4" />
                  {submitting ? 'Submitting...' : 'Submit to Client'}
                </button>
              ) : null}
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
