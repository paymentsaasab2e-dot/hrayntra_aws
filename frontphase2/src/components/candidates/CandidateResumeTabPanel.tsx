'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Download, Eye, FileText, Loader2 } from 'lucide-react';
import { ResumeInlinePreview } from './ResumeInlinePreview';
import { ResumePreviewModal } from './ResumePreviewModal';
import type { CandidateProfileDrawerData } from '../drawers/CandidateProfileDrawer';
import { apiUpdateCandidate, type BackendCandidate } from '../../lib/api';
import { extractApiData } from '../../lib/mapCandidateProfile';
import {
  buildResumeCvViewExtra,
  hasCustomCvEditorLayout,
  hasUpdatedCvFromEditor,
  listAvailableResumeCvModes,
  resolveDefaultResumeCvViewMode,
  type ResumeCvViewMode,
} from '../../lib/cvEditorMapping';
import { resolveCandidateResumeUrlFromSources } from '../../lib/phase1ProfileSnapshot';
import { buildFileHref } from '../../utils/cloudinaryUrls';
import { isResumeHttpUrl, normalizeResumeHref } from '../../lib/resumePreview';

export interface CandidateResumeCvEditorApi {
  backendCandidate: BackendCandidate | null;
  resumeHref: string;
  canEdit: boolean;
  busy: boolean;
  openEditor: () => void | Promise<void>;
  openStructuredPreview: () => void;
  refreshBackend: () => Promise<BackendCandidate | null>;
}

interface CandidateResumeTabPanelProps {
  candidate: CandidateProfileDrawerData;
  enabled?: boolean;
  cvEditor: CandidateResumeCvEditorApi;
  onCandidateUpdated?: () => void | Promise<void>;
  onToast?: (message: string) => void;
}

const MODE_LABELS: Record<ResumeCvViewMode, string> = {
  original: 'Original CV',
  updated: 'Updated CV',
  edited: 'Edited CV',
};

const MODE_HINTS: Record<ResumeCvViewMode, string> = {
  original: 'Uploaded resume file (PDF / Word)',
  updated: 'Structured CV saved from the editor',
  edited: 'Branded layout — logos, watermark, custom sections',
};

export function CandidateResumeTabPanel({
  candidate,
  enabled = true,
  cvEditor,
  onCandidateUpdated,
  onToast,
}: CandidateResumeTabPanelProps) {
  const { backendCandidate, resumeHref, canEdit, busy, openEditor, openStructuredPreview, refreshBackend } =
    cvEditor;

  const [loading, setLoading] = useState(false);
  const [resumePreviewOpen, setResumePreviewOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ResumeCvViewMode | null>(null);
  const [viewModeSaving, setViewModeSaving] = useState(false);

  const uploadsBase = useMemo(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1';
    return apiBase.replace(/\/api\/v1\/?$/, '');
  }, []);

  const resumeRaw =
    candidate.resumeUrl ||
    resolveCandidateResumeUrlFromSources(backendCandidate) ||
    resolveCandidateResumeUrlFromSources({
      resumeUrl: candidate.resumeUrl,
      resume: candidate.resumeUrl,
      extraData: candidate.extraData ?? null,
    }) ||
    resumeHref ||
    '';
  const effectiveResumeHref = useMemo(() => {
    const raw = String(resumeRaw || resumeHref || '').trim();
    if (!raw) return '';
    if (isResumeHttpUrl(raw)) return normalizeResumeHref(raw);
    return buildFileHref(raw, uploadsBase);
  }, [resumeRaw, resumeHref, uploadsBase]);

  useEffect(() => {
    if (!enabled || !candidate.id) return;
    setLoading(true);
    void refreshBackend().finally(() => setLoading(false));
  }, [enabled, candidate.id, refreshBackend]);

  const availableModes = useMemo(
    () => listAvailableResumeCvModes(backendCandidate, resumeHref || resumeRaw),
    [backendCandidate, resumeHref, resumeRaw]
  );

  useEffect(() => {
    setViewMode(resolveDefaultResumeCvViewMode(backendCandidate, resumeHref || resumeRaw));
  }, [backendCandidate, resumeHref, resumeRaw, availableModes.join(',')]);

  const persistViewMode = async (mode: ResumeCvViewMode) => {
    setViewMode(mode);
    if (!backendCandidate?.id) return;
    setViewModeSaving(true);
    try {
      const extraData = buildResumeCvViewExtra(backendCandidate.extraData ?? null, mode);
      const updatedRaw = await apiUpdateCandidate(backendCandidate.id, { extraData });
      extractApiData<BackendCandidate>(updatedRaw);
      await refreshBackend();
      await onCandidateUpdated?.();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to save CV view preference';
      if (!/candidate not found/i.test(message)) {
        onToast?.(message);
      }
    } finally {
      setViewModeSaving(false);
    }
  };

  const showOriginalPreview = viewMode === 'original' && Boolean(effectiveResumeHref);
  const showStructuredPreview =
    (viewMode === 'updated' && hasUpdatedCvFromEditor(backendCandidate)) ||
    (viewMode === 'edited' && hasCustomCvEditorLayout(backendCandidate));

  return (
    <>
      <div className="flex h-[calc(100vh-18rem)] min-h-[560px] flex-col gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-900">Resume versions</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Switch between uploaded and editor-saved CVs. Use Edit CV in the drawer header to update.
          </p>
          {viewModeSaving ? (
            <span className="mt-2 inline-flex items-center gap-1 text-xs text-slate-500">
              <Loader2 size={14} className="animate-spin" />
              Saving preference…
            </span>
          ) : null}
        </div>

        {availableModes.length > 0 ? (
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Resume version">
            {availableModes.map((mode) => {
              const active = viewMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => void persistViewMode(mode)}
                  disabled={busy}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60 ${
                    active
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {MODE_LABELS[mode]}
                </button>
              );
            })}
          </div>
        ) : null}

        {viewMode ? <p className="text-xs text-slate-500">{MODE_HINTS[viewMode]}</p> : null}

        <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-900">
              {viewMode ? MODE_LABELS[viewMode] : 'Resume Viewer'}
            </h3>
            <div className="flex flex-wrap gap-2">
              {viewMode === 'original' && effectiveResumeHref ? (
                <>
                  <button
                    type="button"
                    onClick={() => setResumePreviewOpen(true)}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Eye size={16} />
                    Preview
                  </button>
                  <a
                    href={effectiveResumeHref}
                    target="_blank"
                    rel="noreferrer"
                    download
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Download size={16} />
                    Download
                  </a>
                </>
              ) : null}
              {(viewMode === 'updated' || viewMode === 'edited') && showStructuredPreview ? (
                <button
                  type="button"
                  onClick={openStructuredPreview}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  <Eye size={16} />
                  Full preview
                </button>
              ) : null}
            </div>
          </div>

          <div className="relative min-h-0 flex-1 overflow-auto bg-slate-100 p-4">
            {loading && !backendCandidate ? (
              <div className="flex h-full min-h-[320px] items-center justify-center">
                <Loader2 className="size-8 animate-spin text-blue-600" />
              </div>
            ) : showOriginalPreview ? (
              <ResumeInlinePreview
                resumeUrl={effectiveResumeHref}
                candidateName={candidate.name}
                enabled={enabled && viewMode === 'original'}
                minHeightClass="h-full min-h-[520px]"
              />
            ) : showStructuredPreview ? (
              <div className="flex h-full min-h-[520px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
                <FileText className="size-10 text-blue-500" />
                <p className="mt-4 text-sm font-semibold text-slate-900">
                  {viewMode === 'edited' ? 'Edited CV ready' : 'Updated CV ready'}
                </p>
                <p className="mt-2 max-w-md text-sm text-slate-500">
                  {viewMode === 'edited'
                    ? 'This version includes your branded layout from the CV editor.'
                    : 'Structured profile from the CV editor — summary, experience, education, and skills.'}
                </p>
                <button
                  type="button"
                  onClick={openStructuredPreview}
                  className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  <Eye size={16} />
                  Open preview
                </button>
              </div>
            ) : (
              <div className="flex h-full min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center">
                <p className="text-sm text-slate-500">No resume available for this candidate.</p>
                {canEdit ? (
                  <p className="mt-2 text-xs text-slate-400">
                    Use <span className="font-medium text-slate-600">Edit CV</span> next to Edit Candidate to
                    create one.
                  </p>
                ) : null}
              </div>
            )}
          </div>
        </section>
      </div>

      <ResumePreviewModal
        isOpen={resumePreviewOpen}
        onClose={() => setResumePreviewOpen(false)}
        resumeUrl={effectiveResumeHref || null}
        candidateName={candidate.name}
      />
    </>
  );
}
