import React, { useEffect, useState } from 'react';
import { Activity, Check, Pencil, Send, StickyNote, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { MatchCandidate, MatchJob } from './types';
import {
  apiUpdateCandidate,
  apiUpdateClient,
  apiUpdateContact,
  apiUpdateJob,
  type UpdateCandidatePayload,
  type UpdateClientData,
  type UpdateJobData,
} from '../../lib/api';
import { SUBMISSION_TYPES } from '../interviews/SubmitToClientDrawer';

type SubmissionTypeValue = (typeof SUBMISSION_TYPES)[number]['value'];

interface SubmitModalProps {
  isOpen: boolean;
  candidate: MatchCandidate | null;
  selectedJob: MatchJob;
  onClose: () => void;
  onSubmit: (payload: {
    message: string;
    notifyClient: boolean;
    submissionType: SubmissionTypeValue;
  }) => Promise<void>;
  onUpdated?: () => Promise<void> | void;
}

type SectionKey = 'candidate' | 'job' | 'client';

function detailValue(value?: string | number | null, fallback = '-') {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value);
}

function compactId(value?: string | null) {
  const text = String(value || '').trim();
  if (!text) return '-';
  if (text.length <= 18) return text;
  return `${text.slice(0, 8)}...${text.slice(-6)}`;
}

function splitName(fullName: string) {
  const parts = String(fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' ') || '',
  };
}

function notifyDataChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('jobportal:candidates-changed'));
  window.dispatchEvent(new CustomEvent('jobportal:jobs-changed'));
  window.dispatchEvent(new CustomEvent('jobportal:clients-changed'));
}

export default function SubmitModal({
  isOpen,
  candidate,
  selectedJob,
  onClose,
  onSubmit,
  onUpdated,
}: SubmitModalProps) {
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savingSection, setSavingSection] = useState<SectionKey | null>(null);
  const [errorText, setErrorText] = useState('');
  const [mainTab, setMainTab] = useState<SectionKey>('candidate');
  const [editingSections, setEditingSections] = useState<Record<SectionKey, boolean>>({
    candidate: false,
    job: false,
    client: false,
  });
  const [candidateDraft, setCandidateDraft] = useState({
    name: '',
    email: '',
    phone: '',
    currentTitle: '',
    currentCompany: '',
    location: '',
    experience: '',
    skills: '',
  });
  const [jobDraft, setJobDraft] = useState({
    title: '',
    location: '',
  });
  const [clientDraft, setClientDraft] = useState({
    companyName: '',
    location: '',
    email: '',
    status: 'ACTIVE' as UpdateClientData['status'],
  });
  const [detailTab, setDetailTab] = useState<'notes' | 'activity'>('notes');
  const [noteText, setNoteText] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteSaving, setNoteSaving] = useState(false);
  const [submissionType, setSubmissionType] = useState<SubmissionTypeValue | ''>('');
  const [submissionTypeError, setSubmissionTypeError] = useState<string | null>(null);

  const clientEmail = selectedJob.clientContactId
    ? clientDraft.email || selectedJob.clientEmail || ''
    : selectedJob.clientEmail || '';
  const canSendClientEmail = Boolean(clientEmail.trim());

  const resetDrafts = () => {
    const candidateName = candidate?.name || '';
    setCandidateDraft({
      name: candidateName,
      email: candidate?.email || '',
      phone: candidate?.phone || '',
      currentTitle: candidate?.currentTitle || '',
      currentCompany: candidate?.currentCompany || '',
      location: candidate?.location || '',
      experience: candidate?.experience !== undefined && candidate?.experience !== null ? String(candidate.experience) : '',
      skills: (candidate?.skills || []).join(', '),
    });
    setJobDraft({
      title: selectedJob.title || '',
      location: selectedJob.location || '',
    });
    setClientDraft({
      companyName: selectedJob.client || '',
      location: selectedJob.clientLocation || '',
      email: selectedJob.clientEmail || '',
      status: 'ACTIVE',
    });
    setErrorText('');
    setMainTab('candidate');
    setEditingSections({ candidate: false, job: false, client: false });
  };

  useEffect(() => {
    if (!isOpen || !candidate) return;
    const intro = `Hi ${selectedJob.client || 'team'},`;
    const summary = `Sharing ${candidate.name} for ${selectedJob.title}.`;
    const strengths = candidate.skills.length
      ? `Key strengths: ${candidate.skills.slice(0, 4).join(', ')}.`
      : 'Key strengths: available on request.';
    const experience = `Experience: ${candidate.experience} years.`;
    setMessage([intro, '', summary, strengths, experience, '', 'Regards'].join('\n'));
    resetDrafts();
    // The default match flow shows the recruiter submitting a brand-new
    // candidate to the client for a first look, so we pre-pick the same
    // bucket the interview drawer uses on a freshly scheduled interview.
    // The recruiter can still flip it to OFFER_CONFIRMATION when the
    // submission is for the offer letter.
    setSubmissionType('INITIAL_REVIEW');
    setSubmissionTypeError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidate, isOpen, selectedJob.client, selectedJob.title]);

  const saveCandidate = async () => {
    if (!candidate?.id) throw new Error('Candidate is missing.');
    const { firstName, lastName } = splitName(candidateDraft.name);
    if (!firstName) throw new Error('Candidate name is required.');

    const payload: UpdateCandidatePayload = {
      firstName,
      lastName,
      email: candidateDraft.email.trim() || undefined,
      phone: candidateDraft.phone.trim() || undefined,
      currentTitle: candidateDraft.currentTitle.trim() || undefined,
      currentCompany: candidateDraft.currentCompany.trim() || undefined,
      location: candidateDraft.location.trim() || undefined,
      experience: candidateDraft.experience ? Number(candidateDraft.experience) : null,
      skills: candidateDraft.skills
        .split(',')
        .map((skill) => skill.trim())
        .filter(Boolean),
    };

    await apiUpdateCandidate(candidate.id, payload);
  };

  const saveJob = async () => {
    if (!selectedJob.id) throw new Error('Job is missing.');
    const payload: UpdateJobData = {
      id: selectedJob.id,
      title: jobDraft.title.trim() || selectedJob.title,
      location: jobDraft.location.trim() || selectedJob.location || undefined,
    } as UpdateJobData;
    await apiUpdateJob(selectedJob.id, payload);
  };

  const saveClient = async () => {
    if (!selectedJob.clientId) throw new Error('Client is missing.');
    const payload: UpdateClientData = {
      companyName: clientDraft.companyName.trim() || selectedJob.client,
      location: clientDraft.location.trim() || selectedJob.clientLocation || undefined,
      status: clientDraft.status,
    };
    await apiUpdateClient(selectedJob.clientId, payload);

    const email = clientDraft.email.trim();
    if (email && selectedJob.clientContactId) {
      await apiUpdateContact(selectedJob.clientContactId, { email });
      return;
    }

    if (email && !selectedJob.clientContactId) {
      window.alert('This client does not have a primary contact record, so the email could not be saved. The company details were updated.');
    }
  };

  const saveSection = async (section: SectionKey) => {
    try {
      setErrorText('');
      setSavingSection(section);
      if (section === 'candidate') await saveCandidate();
      if (section === 'job') await saveJob();
      if (section === 'client') await saveClient();
      notifyDataChanged();
      await Promise.resolve(onUpdated?.());
      setEditingSections((current) => ({ ...current, [section]: false }));
    } catch (sectionError: any) {
      const message = sectionError?.message || 'Unable to save changes.';
      setErrorText(message);
      window.alert(message);
    } finally {
      setSavingSection(null);
    }
  };

  const handleSend = async () => {
    if (!canSendClientEmail) {
      window.alert('Client email is not available for this job. Please edit the client first.');
      return;
    }

    if (!submissionType) {
      // The public review page renders different controls per purpose
      // (offer-letter upload for OFFER_CONFIRMATION, etc.), so we force the
      // recruiter to be explicit here just like in the interview drawer.
      setSubmissionTypeError('Pick what this submission is for');
      window.alert('Please choose a submission purpose before sending.');
      return;
    }

    try {
      setErrorText('');
      setIsSubmitting(true);
      if (editingSections.candidate) await saveCandidate();
      if (editingSections.job) await saveJob();
      if (editingSections.client) await saveClient();
      notifyDataChanged();
      await Promise.resolve(onUpdated?.());
      await onSubmit({ message, notifyClient: true, submissionType });
    } catch (sendError: any) {
      const message = sendError?.message || 'Unable to send client email.';
      setErrorText(message);
      window.alert(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleSection = (section: SectionKey) => {
    setEditingSections((current) => ({ ...current, [section]: !current[section] }));
  };

  const renderField = (label: string, value: string | number | null | undefined) => (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm text-slate-900">{detailValue(value)}</p>
    </div>
  );

  const renderTextareaField = (label: string, value: string | null | undefined) => (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-900">{detailValue(value)}</p>
    </div>
  );

  const formatTimestamp = (value?: string | null) => {
    if (!value) return '-';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value);
    return parsed.toLocaleString();
  };

  const startEditNote = (id: string, text: string) => {
    setEditingNoteId(id);
    setNoteText(text);
    setDetailTab('notes');
  };

  const cancelNoteEdit = () => {
    setEditingNoteId(null);
    setNoteText('');
  };

  const saveNote = async () => {
    setNoteSaving(false);
  };

  const deleteNote = async () => {
    setNoteSaving(false);
  };

  if (!candidate) return null;

  return (
    <AnimatePresence>
      {isOpen ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] bg-slate-900/40"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.25 }}
            className="fixed right-0 top-0 z-[100] flex h-full w-full flex-col bg-white shadow-2xl sm:max-w-[860px]"
          >
            <div className="border-b border-[#E5E7EB] px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold text-slate-900">Submit to Client</h3>
                  <p className="mt-1 text-sm text-[#6B7280]">
                    Review the candidate and job details, edit anything inline, then send the submission email to the client.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {errorText ? (
                <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {errorText}
                </div>
              ) : null}

              <div className="mb-4 inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
                {(['candidate', 'job', 'client'] as SectionKey[]).map((section) => (
                  <button
                    key={section}
                    type="button"
                    onClick={() => setMainTab(section)}
                    className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                      mainTab === section ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {section.charAt(0).toUpperCase() + section.slice(1)}
                  </button>
                ))}
              </div>

              {mainTab === 'candidate' ? (
                <section className="min-w-0 rounded-2xl border border-[#E5E7EB] bg-slate-50 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Candidate</p>
                    <button
                      type="button"
                      onClick={() => toggleSection('candidate')}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      <Pencil size={14} />
                      {editingSections.candidate ? 'Close Edit' : 'Edit Candidate'}
                    </button>
                  </div>

                  <div className="mt-4 min-w-0 space-y-4">
                    {editingSections.candidate ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="sm:col-span-2">
                          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Name</span>
                          <input
                            value={candidateDraft.name}
                            onChange={(event) => setCandidateDraft((current) => ({ ...current, name: event.target.value }))}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#2563EB]"
                          />
                        </label>
                        <label>
                          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Email</span>
                          <input
                            value={candidateDraft.email}
                            onChange={(event) => setCandidateDraft((current) => ({ ...current, email: event.target.value }))}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#2563EB]"
                          />
                        </label>
                        <label>
                          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Phone</span>
                          <input
                            value={candidateDraft.phone}
                            onChange={(event) => setCandidateDraft((current) => ({ ...current, phone: event.target.value }))}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#2563EB]"
                          />
                        </label>
                        <label>
                          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Current Title</span>
                          <input
                            value={candidateDraft.currentTitle}
                            onChange={(event) => setCandidateDraft((current) => ({ ...current, currentTitle: event.target.value }))}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#2563EB]"
                          />
                        </label>
                        <label>
                          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Current Company</span>
                          <input
                            value={candidateDraft.currentCompany}
                            onChange={(event) => setCandidateDraft((current) => ({ ...current, currentCompany: event.target.value }))}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#2563EB]"
                          />
                        </label>
                        <label>
                          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Location</span>
                          <input
                            value={candidateDraft.location}
                            onChange={(event) => setCandidateDraft((current) => ({ ...current, location: event.target.value }))}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#2563EB]"
                          />
                        </label>
                        <label className="sm:col-span-2">
                          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Experience</span>
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={candidateDraft.experience}
                            onChange={(event) => setCandidateDraft((current) => ({ ...current, experience: event.target.value }))}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#2563EB]"
                          />
                        </label>
                        <label className="sm:col-span-2">
                          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Skills</span>
                          <textarea
                            value={candidateDraft.skills}
                            onChange={(event) => setCandidateDraft((current) => ({ ...current, skills: event.target.value }))}
                            rows={3}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#2563EB]"
                            placeholder="Comma-separated skills"
                          />
                        </label>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-1">
                          <p className="text-xl font-semibold leading-tight text-slate-900">{candidateDraft.name || candidate.name}</p>
                          <p className="text-sm text-slate-600">{detailValue(candidateDraft.currentTitle || candidate.currentTitle, 'No current title')}</p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {renderField('Email', candidateDraft.email || candidate.email)}
                          {renderField('Phone', candidateDraft.phone || candidate.phone)}
                          {renderField('Location', candidateDraft.location || candidate.location)}
                          {renderField('Experience', `${detailValue(candidateDraft.experience || candidate.experience, 0)} years`)}
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white p-3">
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Skills</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {(candidateDraft.skills || candidate.skills.join(', ')) ? (
                              (candidateDraft.skills || candidate.skills.join(', '))
                                .split(',')
                                .map((skill) => skill.trim())
                                .filter(Boolean)
                                .slice(0, 8)
                                .map((skill) => (
                                  <span
                                    key={skill}
                                    className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"
                                  >
                                    {skill}
                                  </span>
                                ))
                            ) : (
                              <span className="text-sm text-slate-500">No skills listed</span>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => saveSection('candidate')}
                      disabled={savingSection === 'candidate'}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
                    >
                      <Check size={14} />
                      {savingSection === 'candidate' ? 'Saving...' : 'Save Candidate'}
                    </button>
                    <span className="text-xs text-slate-500">Edits update the candidate page after save.</span>
                  </div>

                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Candidate Data</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {renderField('Name', candidateDraft.name || candidate.name)}
                      {renderField('Email', candidateDraft.email || candidate.email)}
                      {renderField('Phone', candidateDraft.phone || candidate.phone)}
                      {renderField('Current Title', candidateDraft.currentTitle || candidate.currentTitle)}
                      {renderField('Current Company', candidateDraft.currentCompany || candidate.currentCompany)}
                      {renderField('Location', candidateDraft.location || candidate.location)}
                      {renderField('Experience', `${detailValue(candidateDraft.experience || candidate.experience, 0)} years`)}
                      {renderField('Match Score', candidate.score)}
                      {renderField('Match Rating', candidate.matchRating ?? '-')}
                      {renderField('Notice Period', candidate.noticePeriod)}
                      {renderField('Status', candidate.status)}
                      {renderField('Match Source', candidate.matchSource)}
                      {renderField('Resume', candidate.resumeName)}
                      {renderField('Portfolio', candidate.portfolioUrl || 'No portfolio')}
                      {renderField('Saved At', candidate.savedAt || 'Not saved')}
                      {renderField('Applied Candidate', candidate.isAppliedCandidate ? 'Yes' : 'No')}
                    </div>
                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Skills</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {(candidateDraft.skills || candidate.skills.join(', ')) ? (
                            (candidateDraft.skills || candidate.skills.join(', '))
                              .split(',')
                              .map((skill) => skill.trim())
                              .filter(Boolean)
                              .slice(0, 12)
                              .map((skill) => (
                                <span
                                  key={skill}
                                  className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700"
                                >
                                  {skill}
                                </span>
                              ))
                          ) : (
                            <span className="text-sm text-slate-500">No skills listed</span>
                          )}
                        </div>
                      </div>
                      <div className="grid gap-3">
                        {renderTextareaField('Matched Skills', candidate.explanation.matchedSkills.join(', ') || 'None')}
                        {renderTextareaField('Missing Skills', candidate.explanation.missingSkills.join(', ') || 'None')}
                        {renderTextareaField('Role Requirement', candidate.explanation.roleRequirement)}
                        {renderTextareaField('Explanation', candidate.explanation.text)}
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {renderField('Salary Expected', candidate.salary.expected)}
                      {renderField('Salary Amount', candidate.salary.amount)}
                      {renderField('Salary Currency', candidate.salary.currency)}
                      {renderField('Salary Fit', candidate.salary.fit)}
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {renderField(
                        'Submission History',
                        candidate.submittedHistory?.length
                          ? candidate.submittedHistory.map((entry) => `${entry.date} - ${entry.status}`).join(' | ')
                          : 'No history'
                      )}
                    </div>
                  </div>

                  <div className="hidden mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Notes & Activity</p>
                        <p className="mt-1 text-sm text-slate-600">Quick context from the candidate record before you send the submission.</p>
                      </div>
                      <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
                        <button
                          type="button"
                          onClick={() => setDetailTab('notes')}
                          className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                            detailTab === 'notes' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                          }`}
                        >
                          <StickyNote size={14} />
                          Notes
                        </button>
                        <button
                          type="button"
                          onClick={() => setDetailTab('activity')}
                          className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                            detailTab === 'activity' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                          }`}
                        >
                          <Activity size={14} />
                          Activity
                        </button>
                      </div>
                    </div>

                    <div className="mt-4">
                      {detailTab === 'notes' ? (
                        <div className="space-y-4">
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                              {editingNoteId ? 'Edit Note' : 'Add Note'}
                            </label>
                            <textarea
                              value={noteText}
                              onChange={(event) => setNoteText(event.target.value)}
                              rows={4}
                              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#2563EB]"
                              placeholder="Write a quick note for this candidate..."
                            />
                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                              <p className="text-xs text-slate-500">Notes are saved to the candidate record.</p>
                              <div className="flex items-center gap-2">
                                {editingNoteId ? (
                                  <button
                                    type="button"
                                    onClick={cancelNoteEdit}
                                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                                    disabled={noteSaving}
                                  >
                                    Cancel
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={saveNote}
                                  disabled={noteSaving}
                                  className="rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {noteSaving ? 'Saving...' : editingNoteId ? 'Update Note' : 'Add Note'}
                                </button>
                              </div>
                            </div>
                          </div>

                          {candidate.notes.length ? (
                            candidate.notes.map((note) => (
                              <div key={note.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                      <StickyNote size={14} />
                                      <span>{note.author}</span>
                                      <span>•</span>
                                      <span>{formatTimestamp(note.createdAt)}</span>
                                    </div>
                                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{note.text}</p>
                                  </div>
                                  <div className="flex shrink-0 items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => startEditNote(note.id, note.text)}
                                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                                      disabled={noteSaving}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => deleteNote(note.id)}
                                      className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                                      disabled={noteSaving}
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                              No notes available for this candidate.
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {candidate.activity.length ? (
                            candidate.activity.map((item) => (
                              <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                  <Activity size={14} />
                                  <span>{formatTimestamp(item.timestamp)}</span>
                                </div>
                                <p className="mt-2 text-sm font-semibold text-slate-900">{item.title}</p>
                                <p className="mt-1 text-sm text-slate-600">{item.description}</p>
                              </div>
                            ))
                          ) : (
                            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                              No activity available for this candidate.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              ) : null}

              {mainTab === 'job' ? (
                <section className="min-w-0 rounded-2xl border border-[#E5E7EB] bg-slate-50 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Job</p>
                    <button
                      type="button"
                      onClick={() => toggleSection('job')}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      <Pencil size={14} />
                      {editingSections.job ? 'Close Edit' : 'Edit Job'}
                    </button>
                  </div>

                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                    {editingSections.job ? (
                      <div className="grid gap-3">
                        <label>
                          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Title</span>
                          <input
                            value={jobDraft.title}
                            onChange={(event) => setJobDraft((current) => ({ ...current, title: event.target.value }))}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#2563EB]"
                          />
                        </label>
                        <label>
                          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Location</span>
                          <input
                            value={jobDraft.location}
                            onChange={(event) => setJobDraft((current) => ({ ...current, location: event.target.value }))}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#2563EB]"
                          />
                        </label>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-xl font-semibold leading-tight text-slate-900">{jobDraft.title || selectedJob.title}</p>
                        <p className="text-sm text-slate-600">{detailValue(jobDraft.location, 'No job location')}</p>
                        <p className="text-xs text-slate-400">Job ID: {compactId(selectedJob.id)}</p>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {renderField('Job Title', jobDraft.title || selectedJob.title)}
                    {renderField('Job Location', jobDraft.location || selectedJob.location)}
                    {renderField('Job Status', selectedJob.status)}
                    {renderField('Client Name', selectedJob.client)}
                    {renderField('Client Email', selectedJob.clientEmail || 'No client email')}
                    {renderField('Client Location', selectedJob.clientLocation || 'No client location')}
                  </div>

                  <div className="mt-5 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => saveSection('job')}
                      disabled={savingSection === 'job'}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
                    >
                      <Check size={14} />
                      {savingSection === 'job' ? 'Saving Job...' : 'Save Job'}
                    </button>
                  </div>
                </section>
              ) : null}

              {mainTab === 'client' ? (
                <section className="min-w-0 rounded-2xl border border-[#E5E7EB] bg-slate-50 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Client</p>
                    <button
                      type="button"
                      onClick={() => toggleSection('client')}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      <Pencil size={14} />
                      {editingSections.client ? 'Close Edit' : 'Edit Client'}
                    </button>
                  </div>

                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                    {editingSections.client ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="sm:col-span-2">
                          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Company Name</span>
                          <input
                            value={clientDraft.companyName}
                            onChange={(event) => setClientDraft((current) => ({ ...current, companyName: event.target.value }))}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#2563EB]"
                          />
                        </label>
                        <label className="sm:col-span-2">
                          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Client Email</span>
                          <input
                            value={clientDraft.email}
                            onChange={(event) => setClientDraft((current) => ({ ...current, email: event.target.value }))}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#2563EB]"
                            placeholder="Primary contact email"
                          />
                        </label>
                        <label>
                          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Location</span>
                          <input
                            value={clientDraft.location}
                            onChange={(event) => setClientDraft((current) => ({ ...current, location: event.target.value }))}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#2563EB]"
                          />
                        </label>
                        <label>
                          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Status</span>
                          <select
                            value={clientDraft.status}
                            onChange={(event) =>
                              setClientDraft((current) => ({ ...current, status: event.target.value as UpdateClientData['status'] }))
                            }
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#2563EB]"
                          >
                            <option value="ACTIVE">Active</option>
                            <option value="PROSPECT">Prospect</option>
                            <option value="ON_HOLD">On Hold</option>
                            <option value="INACTIVE">Inactive</option>
                          </select>
                        </label>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-xl font-semibold leading-tight text-slate-900">{clientDraft.companyName || selectedJob.client}</p>
                        <p className="text-sm text-slate-600">{detailValue(clientDraft.location, 'No client location')}</p>
                        <p className="text-sm text-slate-500">{clientDraft.email || selectedJob.clientEmail || 'No client email available'}</p>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {renderField('Company Name', clientDraft.companyName || selectedJob.client)}
                    {renderField('Client Email', clientDraft.email || selectedJob.clientEmail || 'No client email available')}
                    {renderField('Client Location', clientDraft.location || selectedJob.clientLocation || 'No client location')}
                    {renderField('Client Status', clientDraft.status)}
                    {renderField('Primary Contact', clientDraft.email || selectedJob.clientEmail || 'No primary contact email available')}
                  </div>

                  <div className="mt-5 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => saveSection('client')}
                      disabled={savingSection === 'client'}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
                    >
                      <Check size={14} />
                      {savingSection === 'client' ? 'Saving Client...' : 'Save Client'}
                    </button>
                  </div>
                </section>
              ) : null}

              <div className="mt-4 rounded-2xl border border-[#E5E7EB] bg-white p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Email to client</p>
                    <p className="mt-1 text-sm text-slate-600">
                      This message will be sent automatically to the client for this job.
                    </p>
                    <p className="mt-1 break-words text-xs text-slate-500">
                      Recipient: {clientEmail || 'No client email available'}
                    </p>
                  </div>
                  <span
                    className={`inline-flex shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                      canSendClientEmail ? 'bg-blue-50 text-[#2563EB]' : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {canSendClientEmail ? 'Enabled' : 'Missing Email'}
                  </span>
                </div>

                <div
                  className={`mt-4 rounded-xl border p-3 ${
                    submissionTypeError ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Submission Purpose*
                  </label>
                  <select
                    value={submissionType}
                    onChange={(event) => {
                      const next = event.target.value as SubmissionTypeValue | '';
                      setSubmissionType(next);
                      if (next) setSubmissionTypeError(null);
                    }}
                    className={`mt-2 w-full rounded-lg border bg-white px-3 py-2 text-sm font-medium text-slate-900 ${
                      submissionTypeError ? 'border-red-400' : 'border-slate-200'
                    }`}
                  >
                    <option value="">Select why you're submitting to the client…</option>
                    {SUBMISSION_TYPES.map((entry) => (
                      <option key={entry.value} value={entry.value}>
                        {entry.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-xs text-slate-500">
                    {submissionType
                      ? SUBMISSION_TYPES.find((entry) => entry.value === submissionType)?.description
                      : 'The client review page renders different controls per purpose (e.g., offer-letter upload for the offer flow).'}
                  </p>
                  {submissionTypeError ? (
                    <p className="mt-1 text-xs font-medium text-red-600">{submissionTypeError}</p>
                  ) : null}
                </div>

                <div className="mt-4">
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">Message</label>
                  <textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    rows={8}
                    className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-sm outline-none focus:border-[#2563EB]"
                    placeholder="Write the note the client will receive..."
                  />
                </div>
              </div>

              <div className="hidden mt-4 rounded-2xl border border-[#E5E7EB] bg-white p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Notes & Activity</p>
                    <p className="mt-1 text-sm text-slate-600">Quick context from the candidate record before you send the submission.</p>
                  </div>
                  <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
                    <button
                      type="button"
                      onClick={() => setDetailTab('notes')}
                      className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                        detailTab === 'notes' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      <StickyNote size={14} />
                      Notes
                    </button>
                    <button
                      type="button"
                      onClick={() => setDetailTab('activity')}
                      className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                        detailTab === 'activity' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      <Activity size={14} />
                      Activity
                    </button>
                  </div>
                </div>

                <div className="mt-4">
                  {detailTab === 'notes' ? (
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                          {editingNoteId ? 'Edit Note' : 'Add Note'}
                        </label>
                        <textarea
                          value={noteText}
                          onChange={(event) => setNoteText(event.target.value)}
                          rows={4}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#2563EB]"
                          placeholder="Write a quick note for this candidate..."
                        />
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs text-slate-500">Notes are saved to the candidate record.</p>
                          <div className="flex items-center gap-2">
                            {editingNoteId ? (
                              <button
                                type="button"
                                onClick={cancelNoteEdit}
                                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                                disabled={noteSaving}
                              >
                                Cancel
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={saveNote}
                              disabled={noteSaving}
                              className="rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {noteSaving ? 'Saving...' : editingNoteId ? 'Update Note' : 'Add Note'}
                            </button>
                          </div>
                        </div>
                      </div>

                      {candidate.notes.length ? (
                        candidate.notes.map((note) => (
                          <div key={note.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                  <StickyNote size={14} />
                                  <span>{note.author}</span>
                                  <span>•</span>
                                  <span>{formatTimestamp(note.createdAt)}</span>
                                </div>
                                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{note.text}</p>
                              </div>
                              <div className="flex shrink-0 items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => startEditNote(note.id, note.text)}
                                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                                  disabled={noteSaving}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteNote(note.id)}
                                  className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                                  disabled={noteSaving}
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                          No notes available for this candidate.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {candidate.activity.length ? (
                        candidate.activity.map((item) => (
                          <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <Activity size={14} />
                              <span>{formatTimestamp(item.timestamp)}</span>
                            </div>
                            <p className="mt-2 text-sm font-semibold text-slate-900">{item.title}</p>
                            <p className="mt-1 text-sm text-slate-600">{item.description}</p>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                          No activity available for this candidate.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-[#E5E7EB] bg-white px-6 py-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-[#E5E7EB] px-4 py-2 text-sm font-medium text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSend}
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Send size={16} />
                {isSubmitting ? 'Sending...' : 'Send Client Email'}
              </button>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
