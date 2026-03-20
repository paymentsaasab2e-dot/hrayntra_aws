'use client';

import React, { useState, useEffect } from 'react';
import { StickyNote, Pin, Pencil, Trash2, User, Plus, X } from 'lucide-react';
import { ImageWithFallback } from './ImageWithFallback';
import {
  apiGetClientNotes,
  apiCreateClientNote,
  apiUpdateClientNote,
  apiDeleteClientNote,
  apiGetLeadNotes,
  apiCreateLeadNote,
  apiUpdateLeadNote,
  apiDeleteLeadNote,
  apiGetJobNotes,
  apiCreateJobNote,
  apiUpdateJobNote,
  apiDeleteJobNote,
  type BackendClientNote,
  type BackendLeadNote,
  type BackendJobNote,
  type CreateClientNoteData,
  type UpdateClientNoteData,
  type CreateLeadNoteData,
  type UpdateLeadNoteData,
  type CreateJobNoteData,
  type UpdateJobNoteData,
} from '../lib/api';

export type NoteTag = 'HR' | 'Finance' | 'Contract' | 'Feedback';

export interface Note {
  id: string;
  title: string;
  content?: string;
  tags: NoteTag[];
  createdBy: { name: string; avatar?: string };
  createdAt: string;
  isPinned?: boolean;
}

export interface NotesServiceProps {
  entityType: 'client' | 'lead' | 'job';
  entityId: string;
  availableTags?: string[];
  onNoteCreated?: () => void;
  onNoteUpdated?: () => void;
  onNoteDeleted?: () => void;
}

const DEFAULT_TAGS: NoteTag[] = ['HR', 'Finance', 'Contract', 'Feedback'];

const NOTE_TAG_STYLES: Record<string, string> = {
  HR: 'bg-blue-100 text-blue-700 border-blue-200',
  Finance: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Contract: 'bg-amber-100 text-amber-700 border-amber-200',
  Feedback: 'bg-violet-100 text-violet-700 border-violet-200',
  JD: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  Requirements: 'bg-purple-100 text-purple-700 border-purple-200',
  Hiring: 'bg-green-100 text-green-700 border-green-200',
  Other: 'bg-slate-100 text-slate-700 border-slate-200',
};

const getTagStyle = (tag: string): string => {
  return NOTE_TAG_STYLES[tag] || 'bg-slate-100 text-slate-700 border-slate-200';
};

function mapBackendNoteToFrontend(backendNote: BackendClientNote | BackendLeadNote | BackendJobNote): Note {
  return {
    id: backendNote.id,
    title: backendNote.title,
    content: backendNote.content || undefined,
    tags: (backendNote.tags || []) as NoteTag[],
    createdBy: {
      name: backendNote.createdBy.name || backendNote.createdBy.email,
      avatar: backendNote.createdBy.avatar || undefined,
    },
    createdAt: new Date(backendNote.createdAt).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
    isPinned: backendNote.isPinned,
  };
}

export function NotesService({
  entityType,
  entityId,
  availableTags = DEFAULT_TAGS,
  onNoteCreated,
  onNoteUpdated,
  onNoteDeleted,
}: NotesServiceProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [tagFilter, setTagFilter] = useState<string | 'All'>('All');
  const [pinnedNoteIds, setPinnedNoteIds] = useState<Set<string>>(new Set());
  const [showAddNoteForm, setShowAddNoteForm] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteForm, setNoteForm] = useState({
    title: '',
    content: '',
    tags: [] as string[],
  });

  // Fetch notes when entity changes
  useEffect(() => {
    if (!entityId) return;

    const fetchNotes = async () => {
      setLoading(true);
      try {
        let response;
        if (entityType === 'client') {
          response = await apiGetClientNotes(entityId);
        } else if (entityType === 'lead') {
          response = await apiGetLeadNotes(entityId);
        } else if (entityType === 'job') {
          response = await apiGetJobNotes(entityId);
        } else {
          setLoading(false);
          return;
        }
        
        const mappedNotes = (response.data || []).map(mapBackendNoteToFrontend);
        setNotes(mappedNotes);
        // Initialize pinned notes
        const pinned = new Set(
          mappedNotes.filter((n) => n.isPinned).map((n) => n.id)
        );
        setPinnedNoteIds(pinned);
      } catch (error) {
        console.error('Failed to fetch notes:', error);
        setNotes([]);
      } finally {
        setLoading(false);
      }
    };

    fetchNotes();
  }, [entityId, entityType]);

  const handleCreateNote = async () => {
    if (!noteForm.title.trim()) {
      alert('Please enter a note title');
      return;
    }

    if (!entityId) {
      alert(`No ${entityType} selected`);
      return;
    }

    try {
      let response;
      if (entityType === 'client') {
        const noteData: CreateClientNoteData = {
          title: noteForm.title,
          content: noteForm.content || undefined,
          tags: noteForm.tags,
        };
        await apiCreateClientNote(entityId, noteData);
        response = await apiGetClientNotes(entityId);
      } else if (entityType === 'lead') {
        const noteData: CreateLeadNoteData = {
          title: noteForm.title,
          content: noteForm.content || undefined,
          tags: noteForm.tags,
        };
        await apiCreateLeadNote(entityId, noteData);
        response = await apiGetLeadNotes(entityId);
      } else if (entityType === 'job') {
        const noteData: CreateJobNoteData = {
          title: noteForm.title,
          content: noteForm.content || undefined,
          tags: noteForm.tags,
        };
        await apiCreateJobNote(entityId, noteData);
        response = await apiGetJobNotes(entityId);
      } else {
        return;
      }
      
      // Refresh notes
      const mappedNotes = (response.data || []).map(mapBackendNoteToFrontend);
      setNotes(mappedNotes);

      // Reset form
      setNoteForm({ title: '', content: '', tags: [] });
      setShowAddNoteForm(false);
      onNoteCreated?.();
    } catch (error: any) {
      console.error('Failed to create note:', error);
      alert(error.message || 'Failed to create note');
    }
  };

  const handleUpdateNote = async (noteId: string) => {
    if (!noteForm.title.trim()) {
      alert('Please enter a note title');
      return;
    }

    if (!entityId) return;

    try {
      let response;
      if (entityType === 'client') {
        const updateData: UpdateClientNoteData = {
          title: noteForm.title,
          content: noteForm.content || undefined,
          tags: noteForm.tags,
        };
        await apiUpdateClientNote(entityId, noteId, updateData);
        response = await apiGetClientNotes(entityId);
      } else if (entityType === 'lead') {
        const updateData: UpdateLeadNoteData = {
          title: noteForm.title,
          content: noteForm.content || undefined,
          tags: noteForm.tags,
        };
        await apiUpdateLeadNote(entityId, noteId, updateData);
        response = await apiGetLeadNotes(entityId);
      } else if (entityType === 'job') {
        const updateData: UpdateJobNoteData = {
          title: noteForm.title,
          content: noteForm.content || undefined,
          tags: noteForm.tags,
        };
        await apiUpdateJobNote(entityId, noteId, updateData);
        response = await apiGetJobNotes(entityId);
      } else {
        return;
      }
      
      // Refresh notes
      const mappedNotes = (response.data || []).map(mapBackendNoteToFrontend);
      setNotes(mappedNotes);

      // Reset form
      setNoteForm({ title: '', content: '', tags: [] });
      setEditingNoteId(null);
      onNoteUpdated?.();
    } catch (error: any) {
      console.error('Failed to update note:', error);
      alert(error.message || 'Failed to update note');
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Are you sure you want to delete this note?')) return;
    if (!entityId) return;

    try {
      let response;
      if (entityType === 'client') {
        await apiDeleteClientNote(entityId, noteId);
        response = await apiGetClientNotes(entityId);
      } else if (entityType === 'lead') {
        await apiDeleteLeadNote(entityId, noteId);
        response = await apiGetLeadNotes(entityId);
      } else if (entityType === 'job') {
        await apiDeleteJobNote(entityId, noteId);
        response = await apiGetJobNotes(entityId);
      } else {
        return;
      }
      
      // Refresh notes
      const mappedNotes = (response.data || []).map(mapBackendNoteToFrontend);
      setNotes(mappedNotes);
      onNoteDeleted?.();
    } catch (error: any) {
      console.error('Failed to delete note:', error);
      alert(error.message || 'Failed to delete note');
    }
  };

  const handleTogglePin = async (noteId: string) => {
    if (!entityId) return;

    const note = notes.find((n) => n.id === noteId);
    if (!note) return;

    try {
      let response;
      if (entityType === 'client') {
        await apiUpdateClientNote(entityId, noteId, {
          isPinned: !note.isPinned,
        });
        response = await apiGetClientNotes(entityId);
      } else if (entityType === 'lead') {
        await apiUpdateLeadNote(entityId, noteId, {
          isPinned: !note.isPinned,
        });
        response = await apiGetLeadNotes(entityId);
      } else if (entityType === 'job') {
        await apiUpdateJobNote(entityId, noteId, {
          isPinned: !note.isPinned,
        });
        response = await apiGetJobNotes(entityId);
      } else {
        return;
      }
      
      // Refresh notes
      const mappedNotes = (response.data || []).map(mapBackendNoteToFrontend);
      setNotes(mappedNotes);
      
      // Update pinned set
      const pinned = new Set(
        mappedNotes.filter((n) => n.isPinned).map((n) => n.id)
      );
      setPinnedNoteIds(pinned);
    } catch (error: any) {
      console.error('Failed to toggle pin:', error);
      alert(error.message || 'Failed to toggle pin');
    }
  };

  const startEdit = (note: Note) => {
    setEditingNoteId(note.id);
    setNoteForm({
      title: note.title,
      content: note.content || '',
      tags: note.tags,
    });
    setShowAddNoteForm(true);
  };

  const cancelEdit = () => {
    setEditingNoteId(null);
    setNoteForm({ title: '', content: '', tags: [] });
    setShowAddNoteForm(false);
  };

  const toggleTag = (tag: string) => {
    setNoteForm((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter((t) => t !== tag)
        : [...prev.tags, tag],
    }));
  };

  const filteredNotes = notes.filter((note) =>
    tagFilter === 'All' ? true : note.tags.includes(tagFilter)
  );

  const isPinned = (note: Note) => note.isPinned || pinnedNoteIds.has(note.id);

  const sortedNotes = [...filteredNotes].sort((a, b) =>
    isPinned(b) && !isPinned(a) ? 1 : isPinned(a) && !isPinned(b) ? -1 : 0
  );

  const NOTE_TAG_OPTIONS: (string | 'All')[] = ['All', ...availableTags];

  return (
    <div className="space-y-4">
      {/* Top bar: Add Note + tag filters */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              setShowAddNoteForm(true);
              setEditingNoteId(null);
              setNoteForm({ title: '', content: '', tags: [] });
            }}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <StickyNote size={16} />
            Add Note
          </button>
          <div className="flex flex-wrap items-center gap-2">
            {NOTE_TAG_OPTIONS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setTagFilter(tag)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  tagFilter === tag
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Add/Edit Note Form */}
      {showAddNoteForm && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900">
              {editingNoteId ? 'Edit Note' : 'Add Note'}
            </h3>
            <button
              type="button"
              onClick={cancelEdit}
              className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
          <div>
            <label htmlFor="note-title" className="block text-sm font-medium text-slate-700 mb-2">
              Title *
            </label>
            <input
              id="note-title"
              type="text"
              value={noteForm.title}
              onChange={(e) => setNoteForm((p) => ({ ...p, title: e.target.value }))}
              placeholder="Enter note title..."
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          <div>
            <label htmlFor="note-content" className="block text-sm font-medium text-slate-700 mb-2">
              Content
            </label>
            <textarea
              id="note-content"
              rows={4}
              value={noteForm.content}
              onChange={(e) => setNoteForm((p) => ({ ...p, content: e.target.value }))}
              placeholder="Enter note content..."
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Tags</label>
            <div className="flex flex-wrap gap-2">
              {availableTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                    noteForm.tags.includes(tag)
                      ? getTagStyle(tag)
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {tag}
                  {noteForm.tags.includes(tag) && ' ✓'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={cancelEdit}
              className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() =>
                editingNoteId ? handleUpdateNote(editingNoteId) : handleCreateNote()
              }
              className="px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors"
            >
              {editingNoteId ? 'Update Note' : 'Create Note'}
            </button>
          </div>
        </div>
      )}

      {/* Notes list */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Notes</h4>
          <p className="text-xs text-slate-500">{sortedNotes.length} {sortedNotes.length === 1 ? 'note' : 'notes'}</p>
        </div>
        <div className="p-4 max-h-[500px] overflow-y-auto space-y-3">
          {loading ? (
            <div className="py-8 text-center text-sm text-slate-500">Loading notes...</div>
          ) : sortedNotes.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              {tagFilter === 'All'
                ? 'No notes yet. Click "Add Note" to create one.'
                : `No notes for ${tagFilter} filter.`}
            </p>
          ) : (
            sortedNotes.map((note) => (
              <div
                key={note.id}
                className={`rounded-xl border p-3 transition-colors ${
                  isPinned(note)
                    ? 'border-amber-200 bg-amber-50/50'
                    : 'border-slate-200 bg-slate-50/80 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900 flex-1 min-w-0">
                    {note.title}
                  </p>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleTogglePin(note.id)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        isPinned(note)
                          ? 'text-amber-600 bg-amber-100 hover:bg-amber-200'
                          : 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                      }`}
                      title={isPinned(note) ? 'Unpin' : 'Pin note'}
                    >
                      <Pin size={14} className={isPinned(note) ? 'fill-current' : ''} />
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(note)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteNote(note.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                {note.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {note.tags.map((t) => (
                      <span
                        key={t}
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium border ${getTagStyle(t)}`}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                {note.content && (
                  <p className="text-xs text-slate-600 mt-2 line-clamp-3">{note.content}</p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  {note.createdBy.avatar ? (
                    <ImageWithFallback
                      src={note.createdBy.avatar}
                      alt={note.createdBy.name}
                      className="w-5 h-5 rounded-full border border-slate-200 shrink-0"
                    />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                      <User size={10} className="text-slate-500" />
                    </div>
                  )}
                  <span className="text-[11px] font-medium text-slate-600">
                    {note.createdBy.name}
                  </span>
                  <span className="text-[11px] text-slate-400">·</span>
                  <span className="text-[11px] text-slate-500">{note.createdAt}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
