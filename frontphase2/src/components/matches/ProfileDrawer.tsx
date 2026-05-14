import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Calendar, FileText, Plus, Pencil, Sparkles, StickyNote, Trash2, X } from 'lucide-react';
import { ImageWithFallback } from '../ImageWithFallback';
import { apiAddCandidateNote, apiDeleteCandidateNote, apiGetCandidate, apiUpdateCandidateNote } from '../../lib/api';
import { formatDateTimeDMY } from '../../utils/dateDisplay';
import type { MatchCandidate } from './types';

interface ProfileDrawerProps {
  isOpen: boolean;
  candidate: MatchCandidate | null;
  initialTab?: 'overview' | 'resume' | 'ai' | 'notes';
  onClose: () => void;
}

const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'resume', label: 'Resume' },
  { id: 'ai', label: 'AI Score' },
  { id: 'notes', label: 'Notes' },
] as const;

export default function ProfileDrawer({
  isOpen,
  candidate,
  initialTab = 'overview',
  onClose,
}: ProfileDrawerProps) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [notes, setNotes] = useState(candidate?.notes || []);
  const [noteText, setNoteText] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [initialTab, isOpen]);

  useEffect(() => {
    setNotes(candidate?.notes || []);
    setNoteText('');
    setEditingNoteId(null);
  }, [candidate]);

  useEffect(() => {
    if (!isOpen || !candidate?.id) return;
    void refreshCandidateData();
    // Reload from the backend each time the drawer opens so saved notes reappear.
  }, [candidate?.id, isOpen]);

  const startEditNote = (noteId: string, text: string) => {
    setEditingNoteId(noteId);
    setActiveTab('notes');
    setNoteText(text);
  };

  const cancelEditNote = () => {
    setEditingNoteId(null);
    setNoteText('');
  };

  const refreshCandidateData = async () => {
    if (!candidate?.id) return;
    const response = await apiGetCandidate(candidate.id);
    const backendCandidate = (response as any)?.data || (response as any);

    const nextNotes = Array.isArray(backendCandidate?.internalNotes)
      ? backendCandidate.internalNotes.map((note: any) => ({
          id: note.id,
          text: note.text || note.content || '',
          createdAt: formatDateTimeDMY(note.createdAt),
          author: note.recruiter?.name || 'You',
        }))
      : [];

    setNotes(nextNotes);
  };

  const handleSaveNote = async () => {
    if (!candidate?.id) return;
    const text = noteText.trim();
    if (!text) {
      window.alert('Please enter a note before saving.');
      return;
    }

    try {
      setIsSavingNote(true);
      if (editingNoteId) {
        await apiUpdateCandidateNote(candidate.id, editingNoteId, { text, tags: [] });
      } else {
        await apiAddCandidateNote(candidate.id, { text, tags: [] });
      }
      await refreshCandidateData();
      cancelEditNote();
    } catch (error: any) {
      window.alert(error?.message || 'Failed to save note.');
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!candidate?.id) return;
    if (!window.confirm('Delete this note?')) return;

    try {
      setIsSavingNote(true);
      await apiDeleteCandidateNote(candidate.id, noteId);
      await refreshCandidateData();
      if (editingNoteId === noteId) cancelEditNote();
    } catch (error: any) {
      window.alert(error?.message || 'Failed to delete note.');
    } finally {
      setIsSavingNote(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && candidate ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] bg-slate-900/30"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            className="fixed right-0 top-0 z-[100] flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#E5E7EB] px-6 py-4">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 overflow-hidden rounded-2xl bg-slate-100">
                  <ImageWithFallback src={candidate.photo} alt={candidate.name} className="h-full w-full object-cover" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{candidate.name}</h3>
                  <p className="mt-1 text-sm text-[#6B7280]">
                    {candidate.currentTitle} • {candidate.currentCompany}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="border-b border-[#E5E7EB] px-6">
              <div className="flex flex-wrap gap-2 py-3">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                      activeTab === tab.id
                        ? 'bg-[#2563EB] text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {activeTab === 'overview' ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {[
                    ['Email', candidate.email],
                    ['Phone', candidate.phone],
                    ['Location', candidate.location],
                    ['Experience', `${candidate.experience} years`],
                    ['Notice Period', candidate.noticePeriod],
                    ['Salary', candidate.salary.expected],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-[#E5E7EB] bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{value}</p>
                    </div>
                  ))}
                </div>
              ) : null}

              {activeTab === 'resume' ? (
                <div className="rounded-2xl border border-[#E5E7EB] p-5">
                  <div className="flex items-center gap-3">
                    <FileText size={18} className="text-[#2563EB]" />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{candidate.resumeName}</p>
                      <p className="text-xs text-[#6B7280]">Resume and profile summary attached for recruiter review.</p>
                    </div>
                  </div>
                </div>
              ) : null}

              {activeTab === 'ai' ? (
                <div className="space-y-4">
                  <div className="rounded-2xl bg-blue-50 p-5">
                    <div className="flex items-center gap-3">
                      <Sparkles size={18} className="text-[#2563EB]" />
                      <div>
                        <p className="text-sm font-semibold text-slate-900">AI Match Score</p>
                        <p className="text-3xl font-bold text-[#2563EB]">{candidate.score}%</p>
                      </div>
                    </div>
                    <p className="mt-4 text-sm text-slate-700">{candidate.explanation.text}</p>
                  </div>
                  <div className="rounded-2xl border border-[#E5E7EB] p-5">
                    <p className="text-sm font-semibold text-slate-900">Matched Skills</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {candidate.explanation.matchedSkills.map((skill) => (
                        <span
                          key={skill}
                          className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              {activeTab === 'notes' ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-[#E5E7EB] bg-slate-50 p-4">
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {editingNoteId ? 'Edit Note' : 'Add Note'}
                    </label>
                    <textarea
                      value={noteText}
                      onChange={(event) => setNoteText(event.target.value)}
                      rows={4}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#2563EB]"
                      placeholder="Write a note for this candidate..."
                    />
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <p className="text-xs text-slate-500">Saved to the candidate record.</p>
                      <div className="flex items-center gap-2">
                        {editingNoteId ? (
                          <button
                            type="button"
                            onClick={cancelEditNote}
                            disabled={isSavingNote}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
                          >
                            Cancel
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={handleSaveNote}
                          disabled={isSavingNote}
                          className="inline-flex items-center gap-2 rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                        >
                          <Plus size={14} />
                          {isSavingNote ? 'Saving...' : editingNoteId ? 'Update Note' : 'Add Note'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {notes.length ? (
                    notes.map((note) => (
                      <div key={note.id} className="rounded-2xl border border-[#E5E7EB] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <StickyNote size={14} />
                              <span>{note.author}</span>
                              <span>•</span>
                              <span>{note.createdAt}</span>
                            </div>
                            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{note.text}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              onClick={() => startEditNote(note.id, note.text)}
                              disabled={isSavingNote}
                              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                            >
                              <span className="inline-flex items-center gap-1">
                                <Pencil size={12} />
                                Edit
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteNote(note.id)}
                              disabled={isSavingNote}
                              className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                            >
                              <span className="inline-flex items-center gap-1">
                                <Trash2 size={12} />
                                Delete
                              </span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                      No notes yet. Add the first note above.
                    </div>
                  )}
                </div>
              ) : null}

            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
