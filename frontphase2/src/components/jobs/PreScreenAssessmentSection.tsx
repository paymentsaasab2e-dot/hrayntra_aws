'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, GripVertical, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  listPreScreenAssessments,
  createPreScreenAssessment,
  updatePreScreenAssessment,
  deletePreScreenAssessment,
  replaceJobPreScreenAssessments,
} from '../../lib/api';
import { requestConfirm, requestError, requestInfo } from '../../lib/appDialog';
import { ASSESSMENT_TYPE_LABELS } from '../../lib/preScreenAssessmentTypes';
import type {
  JobPreScreenAssessmentLink,
  PreScreenAssessment,
  PreScreenAssessmentType,
} from '../../lib/preScreenAssessmentTypes';
import { unwrapApiEntity, unwrapApiList } from '../../lib/unwrapApiData';
import {
  AssessmentEditorPanel,
  assessmentToDraft,
  draftToPayload,
  newAssessmentDraft,
  type AssessmentDraft,
} from './AssessmentEditorPanel';

const TYPE_OPTIONS: PreScreenAssessmentType[] = ['MCQ', 'CODING', 'ESSAY', 'VIDEO'];

interface PreScreenAssessmentSectionProps {
  links: JobPreScreenAssessmentLink[];
  onChange: (links: JobPreScreenAssessmentLink[]) => void;
  jobId?: string;
  jobTitle?: string;
  skills?: string[];
  jobDescription?: string;
  disabled?: boolean;
}

function mapLinksForApi(links: JobPreScreenAssessmentLink[]) {
  return links.map((link, index) => ({
    assessmentId: link.assessmentId,
    sortOrder: index,
    required: link.required !== false,
    timing: link.timing || 'AFTER_APPLY',
    durationOverrideMinutes: link.durationOverrideMinutes ?? null,
    passScoreOverridePercent: link.passScoreOverridePercent ?? null,
  }));
}

function mapApiRowsToLinks(rows: unknown[]): JobPreScreenAssessmentLink[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row, index) => {
      if (!row || typeof row !== 'object') return null;
      const r = row as Record<string, unknown>;
      const assessment = r.assessment as PreScreenAssessment | undefined;
      const assessmentId = String(r.assessmentId || assessment?.id || '').trim();
      if (!assessmentId) return null;
      return {
        id: typeof r.id === 'string' ? r.id : undefined,
        assessmentId,
        sortOrder: typeof r.sortOrder === 'number' ? r.sortOrder : index,
        required: r.required !== false,
        timing: (r.timing as JobPreScreenAssessmentLink['timing']) || 'AFTER_APPLY',
        durationOverrideMinutes:
          typeof r.durationOverrideMinutes === 'number' ? r.durationOverrideMinutes : null,
        passScoreOverridePercent:
          typeof r.passScoreOverridePercent === 'number' ? r.passScoreOverridePercent : null,
        assessment,
      } satisfies JobPreScreenAssessmentLink;
    })
    .filter(Boolean) as JobPreScreenAssessmentLink[];
}

export function PreScreenAssessmentSection({
  links: linksProp,
  onChange,
  jobId,
  jobTitle = '',
  skills = [],
  jobDescription = '',
  disabled = false,
}: PreScreenAssessmentSectionProps) {
  const links = Array.isArray(linksProp) ? linksProp : [];
  const [library, setLibrary] = useState<PreScreenAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [creatingType, setCreatingType] = useState<PreScreenAssessmentType | null>(null);
  const [draft, setDraft] = useState<AssessmentDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingAssessmentId, setEditingAssessmentId] = useState<string | null>(null);
  const [persistingLinks, setPersistingLinks] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [deletingLibraryId, setDeletingLibraryId] = useState<string | null>(null);

  const loadLibrary = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listPreScreenAssessments();
      setLibrary(unwrapApiList<PreScreenAssessment>(res));
    } catch {
      setLibrary([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLibrary();
  }, [loadLibrary]);

  const persistJobLinks = useCallback(
    async (nextLinks: JobPreScreenAssessmentLink[], { silent = false } = {}) => {
      onChange(nextLinks);
      if (!jobId) return true;
      setPersistingLinks(true);
      try {
        const res = await replaceJobPreScreenAssessments(jobId, mapLinksForApi(nextLinks));
        const saved = mapApiRowsToLinks(unwrapApiList(res));
        if (saved.length > 0 || nextLinks.length === 0) {
          onChange(saved.length ? saved : nextLinks);
        }
        if (!silent) {
          void requestInfo('Pre-screen assessments saved for this job.');
        }
        return true;
      } catch (err) {
        void requestError(
          err instanceof Error ? err.message : 'Could not save assessments on this job.'
        );
        return false;
      } finally {
        setPersistingLinks(false);
      }
    },
    [jobId, onChange]
  );

  const attachAssessment = async (assessment: PreScreenAssessment) => {
    if (!assessment?.id || links.some((l) => l.assessmentId === assessment.id)) return;
    const next: JobPreScreenAssessmentLink[] = [
      ...links,
      {
        assessmentId: assessment.id,
        sortOrder: links.length,
        required: true,
        timing: 'AFTER_APPLY',
        assessment,
      },
    ];
    await persistJobLinks(next, { silent: !jobId });
  };

  const updateLink = async (index: number, patch: Partial<JobPreScreenAssessmentLink>) => {
    const next = links.map((row, i) => (i === index ? { ...row, ...patch } : row));
    await persistJobLinks(next, { silent: true });
  };

  const removeLink = async (index: number) => {
    const removed = links[index];
    if (removed && expandedId === removed.assessmentId) {
      setExpandedId(null);
      setDraft(null);
      setEditingAssessmentId(null);
    }
    const next = links
      .filter((_, i) => i !== index)
      .map((row, i) => ({ ...row, sortOrder: i }));
    await persistJobLinks(next, { silent: true });
  };

  const startCreate = (type: PreScreenAssessmentType) => {
    setCreatingType(type);
    setEditingAssessmentId(null);
    setExpandedId('__new__');
    setDraft(newAssessmentDraft(type));
  };

  const startEdit = (link: JobPreScreenAssessmentLink) => {
    const assessment = resolveAssessment(link);
    if (!assessment) return;
    setCreatingType(null);
    setEditingAssessmentId(assessment.id);
    setExpandedId(link.assessmentId);
    setDraft(assessmentToDraft(assessment));
  };

  const resolveAssessment = (link: JobPreScreenAssessmentLink): PreScreenAssessment | undefined => {
    if (link.assessment?.id) return link.assessment;
    return library.find((a) => a.id === link.assessmentId);
  };

  const closeEditor = () => {
    setExpandedId(null);
    setDraft(null);
    setCreatingType(null);
    setEditingAssessmentId(null);
  };

  const deleteLibraryAssessment = async (assessment: PreScreenAssessment) => {
    const id = String(assessment?.id || '').trim();
    if (!id || disabled) return;

    const attached = links.some((l) => l.assessmentId === id);
    const confirmed = await requestConfirm(
      attached
        ? `"${assessment.title}" is attached to this job. Delete it from the library and remove it from this job?`
        : `Delete "${assessment.title}" from the assessment library?`,
      { title: 'Delete library assessment', confirmLabel: 'Delete' },
    );
    if (!confirmed) return;

    setDeletingLibraryId(id);
    try {
      if (attached) {
        const next = links
          .filter((l) => l.assessmentId !== id)
          .map((row, i) => ({ ...row, sortOrder: i }));
        await persistJobLinks(next, { silent: true });
      }
      await deletePreScreenAssessment(id);
      if (editingAssessmentId === id || expandedId === id) {
        closeEditor();
      }
      await loadLibrary();
      void requestInfo('Assessment removed from library.');
    } catch (err) {
      void requestError(err instanceof Error ? err.message : 'Could not delete assessment.');
    } finally {
      setDeletingLibraryId(null);
    }
  };

  const saveDraft = async () => {
    if (!draft || !draft.title.trim()) return;
    setSaving(true);
    try {
      const payload = draftToPayload(draft);
      if (editingAssessmentId) {
        const res = await updatePreScreenAssessment(editingAssessmentId, payload);
        const updated = unwrapApiEntity<PreScreenAssessment>(res);
        await loadLibrary();
        if (updated?.id) {
          const next = links.map((link) =>
            link.assessmentId === updated.id ? { ...link, assessment: updated } : link
          );
          onChange(next);
        }
        closeEditor();
        void requestInfo('Assessment updated.');
        return;
      }

      const res = await createPreScreenAssessment(payload);
      const created = unwrapApiEntity<PreScreenAssessment>(res);
      if (!created?.id) {
        throw new Error('Assessment was created but no id was returned. Check API / database.');
      }
      await loadLibrary();
      await attachAssessment(created);
      closeEditor();
      void requestInfo('Assessment created and attached to this job.');
    } catch (err) {
      void requestError(err instanceof Error ? err.message : 'Failed to save assessment.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-violet-100 bg-violet-50/40 p-4 space-y-4">
      <div>
        <p className="text-sm font-semibold text-slate-900">Pre-screen assessments</p>
        <p className="text-xs text-slate-600 mt-0.5">
          Configure MCQ, coding, essay, or video tests.{' '}
          {jobId
            ? 'Changes are saved to this job when you attach or remove a test.'
            : 'Save the job to persist attached tests.'}
        </p>
        {persistingLinks ? (
          <p className="text-xs text-violet-700 mt-1 inline-flex items-center gap-1">
            <Loader2 className="size-3 animate-spin" /> Saving job assessments…
          </p>
        ) : null}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="size-4 animate-spin" /> Loading library…
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {TYPE_OPTIONS.map((type) => (
          <button
            key={type}
            type="button"
            disabled={disabled || saving || persistingLinks}
            onClick={() => startCreate(type)}
            className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-xs font-semibold text-violet-800 hover:bg-violet-50 disabled:opacity-50"
          >
            <Plus className="size-3.5" />
            {ASSESSMENT_TYPE_LABELS[type]} test
          </button>
        ))}
      </div>

      {expandedId === '__new__' && draft && creatingType ? (
        <AssessmentEditorPanel
          draft={draft}
          onChange={setDraft}
          onSave={() => void saveDraft()}
          onCancel={closeEditor}
          saving={saving}
          disabled={disabled}
          jobTitle={jobTitle}
          skills={skills}
          jobDescription={jobDescription}
        />
      ) : null}

      {links.length > 0 ? (
        <div className="space-y-2">
          {links.map((link, index) => {
            const assessment = resolveAssessment(link);
            const title = assessment?.title || 'Assessment';
            const type = assessment?.type || 'MCQ';
            const isExpanded = expandedId === link.assessmentId;

            return (
              <div
                key={`${link.assessmentId}-${index}`}
                className="rounded-lg border border-white bg-white/95 shadow-sm overflow-hidden"
              >
                <div className="flex flex-wrap items-center gap-2 px-3 py-2">
                  <GripVertical className="size-4 text-slate-300 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800 truncate">{title}</p>
                    <p className="text-[11px] text-slate-500">
                      {ASSESSMENT_TYPE_LABELS[type as PreScreenAssessmentType] || type} · Step{' '}
                      {index + 1}
                      {assessment?.durationMinutes ? ` · ${assessment.durationMinutes} min` : ''}
                    </p>
                  </div>
                  <label className="flex items-center gap-1 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={link.required !== false}
                      disabled={disabled || persistingLinks}
                      onChange={(e) => void updateLink(index, { required: e.target.checked })}
                    />
                    Required
                  </label>
                  <select
                    className="rounded border border-slate-200 px-2 py-1 text-xs"
                    value={link.timing || 'AFTER_APPLY'}
                    disabled={disabled || persistingLinks}
                    onChange={(e) =>
                      void updateLink(index, {
                        timing: e.target.value as JobPreScreenAssessmentLink['timing'],
                      })
                    }
                  >
                    <option value="AFTER_APPLY">After apply</option>
                    <option value="BEFORE_SUBMIT">Before submit</option>
                  </select>
                  <button
                    type="button"
                    disabled={disabled || !assessment}
                    onClick={() => (isExpanded ? closeEditor() : startEdit(link))}
                    className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    <Pencil className="size-3" />
                    {isExpanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                  </button>
                  <button
                    type="button"
                    disabled={disabled || persistingLinks}
                    onClick={() => void removeLink(index)}
                    className="rounded p-1 text-rose-500 hover:bg-rose-50"
                    aria-label="Remove"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>

                {isExpanded && draft && editingAssessmentId === link.assessmentId ? (
                  <div className="border-t border-slate-100 p-3">
                    <AssessmentEditorPanel
                      draft={draft}
                      onChange={setDraft}
                      onSave={() => void saveDraft()}
                      onCancel={closeEditor}
                      saving={saving}
                      disabled={disabled}
                      jobTitle={jobTitle}
                      skills={skills}
                      jobDescription={jobDescription}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-slate-500">No assessments attached yet. Add a test type above.</p>
      )}

      <div className="relative border-t border-violet-100 pt-3">
        <button
          type="button"
          disabled={disabled || persistingLinks}
          onClick={() => setLibraryOpen((open) => !open)}
          className="flex w-full min-w-[200px] items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 sm:w-auto sm:min-w-[280px]"
        >
          <span>Attach existing from library…</span>
          <ChevronDown
            className={`size-4 shrink-0 text-slate-400 transition ${libraryOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {libraryOpen ? (
          <div className="absolute left-0 right-0 z-20 mt-1 max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg sm:min-w-[320px]">
            {library.length === 0 ? (
              <p className="px-3 py-2 text-xs text-slate-500">Library is empty. Create a test above.</p>
            ) : (
              library.map((a) => {
                const isAttached = links.some((l) => l.assessmentId === a.id);
                const isDeleting = deletingLibraryId === a.id;
                return (
                  <div
                    key={a.id}
                    className="flex items-center gap-1 px-2 py-1.5 hover:bg-slate-50"
                  >
                    <button
                      type="button"
                      disabled={disabled || persistingLinks || isAttached || isDeleting}
                      onClick={() => {
                        void attachAssessment(a);
                        setLibraryOpen(false);
                      }}
                      className="min-w-0 flex-1 truncate text-left text-sm text-slate-800 disabled:cursor-not-allowed disabled:text-slate-400"
                      title={isAttached ? 'Already attached to this job' : 'Attach to job'}
                    >
                      {a.title}{' '}
                      <span className="text-slate-500">({ASSESSMENT_TYPE_LABELS[a.type]})</span>
                      {isAttached ? (
                        <span className="ml-1 text-[10px] font-medium text-violet-600">· attached</span>
                      ) : null}
                    </button>
                    <button
                      type="button"
                      disabled={disabled || persistingLinks || isDeleting}
                      onClick={(e) => {
                        e.stopPropagation();
                        void deleteLibraryAssessment(a);
                      }}
                      className="shrink-0 rounded p-1.5 text-rose-500 hover:bg-rose-50 disabled:opacity-50"
                      aria-label={`Delete ${a.title} from library`}
                      title="Delete from library"
                    >
                      {isDeleting ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Trash2 className="size-4" />
                      )}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
