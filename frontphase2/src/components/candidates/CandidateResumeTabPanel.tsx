'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, Eye, Loader2, Pencil, Trash2 } from 'lucide-react';
import { ResumeInlinePreview } from './ResumeInlinePreview';
import { ResumePreviewModal } from './ResumePreviewModal';
import { SaasaCvSavedPreview } from './SaasaCvSavedPreview';
import type { CandidateProfileDrawerData } from '../drawers/CandidateProfileDrawer';
import { filesApiGet, type BackendCandidate } from '../../lib/api';
import { extractApiData } from '../../lib/mapCandidateProfile';
import CVEditorModal from '../CVEditorModal';
import {
  candidateToCvEditorData,
  hasResumeTabUpdatedCv,
  listAvailableResumeCvModes,
  mergeResumeTabCandidateSource,
  readCvEditorLayout,
  resolveDefaultResumeCvViewMode,
  type ResumeCvViewMode,
} from '../../lib/cvEditorMapping';
import {
  pickLatestResumeFileUrl,
  resolveCandidateResumeUrlFromSources,
} from '../../lib/phase1ProfileSnapshot';
import {
  readSaasaCvAnnotations,
  resolveSaasaCvPreviewUrl,
  type SaasaCvFileRef,
} from '../../lib/saasaCvAnnotations';
import { buildFileHref } from '../../utils/cloudinaryUrls';
import { getResumeExtension, isResumeHttpUrl, normalizeResumeHref } from '../../lib/resumePreview';
import { triggerFileDownload } from '../../utils/triggerFileDownload';
import { requestConfirm, SYSTEM_ALERT_TITLE } from '../../lib/appDialog';
import { downloadCvEditorPlainText, printCvEditorAsPdf } from '../../lib/cvEditorExport';

export interface CandidateResumeCvEditorApi {
  backendCandidate: BackendCandidate | null;
  resumeHref: string;
  canEdit: boolean;
  busy: boolean;
  openEditor: () => void | Promise<void>;
  openStructuredPreview: () => void | Promise<void>;
  refreshBackend: () => Promise<BackendCandidate | null>;
  deleteEditedCv?: () => Promise<boolean>;
  deleteUpdatedCv?: () => Promise<boolean>;
  preferredResumeViewMode?: ResumeCvViewMode | null;
}

interface CandidateResumeTabPanelProps {
  candidate: CandidateProfileDrawerData;
  enabled?: boolean;
  cvEditor: CandidateResumeCvEditorApi;
  /** Latest saved SAASA file URL (from hook after save) */
  saasaSavedFileUrl?: string | null;
  /** After SAASA save, show SAASA CV tab without hiding Updated CV */
  preferredResumeViewMode?: ResumeCvViewMode | null;
  onCandidateUpdated?: () => void | Promise<void>;
  onToast?: (message: string) => void;
  onOpenSaasaCv?: () => void;
}

const MODE_LABELS: Record<ResumeCvViewMode, string> = {
  original: 'Original CV',
  saasa: 'SAASA CV',
  updated: 'Updated CV',
  edited: 'Edited CV',
};

export function CandidateResumeTabPanel({
  candidate,
  enabled = true,
  cvEditor,
  onCandidateUpdated,
  onToast,
  onOpenSaasaCv,
  saasaSavedFileUrl = null,
  preferredResumeViewMode: preferredResumeViewModeProp = null,
}: CandidateResumeTabPanelProps) {
  const {
    backendCandidate,
    resumeHref,
    canEdit,
    busy,
    openEditor,
    openStructuredPreview,
    refreshBackend,
    deleteUpdatedCv,
    preferredResumeViewMode: preferredResumeViewModeFromEditor = null,
  } = cvEditor;

  const preferredResumeViewMode =
    preferredResumeViewModeProp ?? preferredResumeViewModeFromEditor;

  const resumeSourceCandidate = useMemo(
    () => mergeResumeTabCandidateSource(backendCandidate, candidate),
    [backendCandidate, candidate],
  );

  const structuredCvData = useMemo(() => {
    if (!resumeSourceCandidate) return null;
    return candidateToCvEditorData(resumeSourceCandidate);
  }, [resumeSourceCandidate]);

  const [loading, setLoading] = useState(false);
  const [resumePreviewOpen, setResumePreviewOpen] = useState(false);
  const [saasaPreviewOpen, setSaasaPreviewOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ResumeCvViewMode | null>(null);
  const [filesResumeUrl, setFilesResumeUrl] = useState<string | null>(null);
  const [candidateFiles, setCandidateFiles] = useState<SaasaCvFileRef[]>([]);
  const [portalReady, setPortalReady] = useState(false);
  const [downloadingResume, setDownloadingResume] = useState(false);
  const [downloadingSaasa, setDownloadingSaasa] = useState(false);
  const [downloadingUpdated, setDownloadingUpdated] = useState(false);
  const [exportingUpdatedPdf, setExportingUpdatedPdf] = useState(false);

  const canDeleteUpdatedCv =
    canEdit && Boolean(deleteUpdatedCv) && hasResumeTabUpdatedCv(resumeSourceCandidate);

  const handleDeleteUpdatedCv = async () => {
    if (busy || !deleteUpdatedCv || !canDeleteUpdatedCv) return;
    const confirmed = await requestConfirm(
      'Remove the updated CV? The Original CV will remain. You can edit and save again anytime.',
      {
        title: SYSTEM_ALERT_TITLE,
        tone: 'warning',
        confirmLabel: 'Remove',
        cancelLabel: 'Cancel',
      }
    );
    if (!confirmed) return;
    await deleteUpdatedCv();
  };

  useEffect(() => {
    setPortalReady(true);
  }, []);

  const uploadsBase = useMemo(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1';
    return apiBase.replace(/\/api\/v1\/?$/, '');
  }, []);

  const saasaStored = useMemo(
    () => readSaasaCvAnnotations(backendCandidate?.extraData ?? candidate.extraData ?? null),
    [backendCandidate?.extraData, candidate.extraData]
  );

  const originalResumeRaw = useMemo(() => {
    const fromRow = String(
      backendCandidate?.resumeUrl ||
        backendCandidate?.resume ||
        candidate.resumeUrl ||
        ''
    ).trim();
    if (fromRow) return fromRow;

    const fromSaasaSource = String(saasaStored?.resumeUrl || '').trim();
    if (fromSaasaSource) return fromSaasaSource;

    return (
      resolveCandidateResumeUrlFromSources(backendCandidate, { filesResumeUrl }) ||
      resolveCandidateResumeUrlFromSources(
        {
          resumeUrl: candidate.resumeUrl,
          resume: candidate.resumeUrl,
          extraData: candidate.extraData ?? null,
        },
        { filesResumeUrl }
      ) ||
      resumeHref ||
      ''
    );
  }, [
    backendCandidate,
    candidate.resumeUrl,
    candidate.extraData,
    saasaStored?.resumeUrl,
    filesResumeUrl,
    resumeHref,
  ]);

  const effectiveResumeHref = useMemo(() => {
    const raw = String(originalResumeRaw || '').trim();
    if (!raw) return '';
    if (isResumeHttpUrl(raw)) return normalizeResumeHref(raw);
    return buildFileHref(raw, uploadsBase);
  }, [originalResumeRaw, uploadsBase]);

  const saasaPreviewRaw = useMemo(() => {
    const fromExtra = resolveSaasaCvPreviewUrl(
      backendCandidate?.extraData ?? candidate.extraData ?? null,
      candidateFiles
    );
    const fromStored = saasaStored?.fileUrl ?? null;
    const fromProp = saasaSavedFileUrl ?? null;
    return fromExtra || fromStored || fromProp || null;
  }, [
    backendCandidate?.extraData,
    candidate.extraData,
    candidateFiles,
    saasaStored?.fileUrl,
    saasaSavedFileUrl,
  ]);

  const effectiveSaasaPreviewHref = useMemo(() => {
    const raw = String(saasaPreviewRaw || saasaStored?.fileUrl || saasaSavedFileUrl || '').trim();
    if (!raw) return '';
    if (isResumeHttpUrl(raw)) return normalizeResumeHref(raw);
    return buildFileHref(raw, uploadsBase);
  }, [saasaPreviewRaw, saasaStored?.fileUrl, saasaSavedFileUrl, uploadsBase]);

  const saasaBaseResumeHref = useMemo(() => {
    const raw = String(saasaStored?.resumeUrl || effectiveResumeHref || '').trim();
    if (!raw) return '';
    if (isResumeHttpUrl(raw)) return normalizeResumeHref(raw);
    return buildFileHref(raw, uploadsBase);
  }, [saasaStored?.resumeUrl, effectiveResumeHref, uploadsBase]);

  useEffect(() => {
    if (!enabled || !candidate.id) return;
    setLoading(true);
    setFilesResumeUrl(null);
    setCandidateFiles([]);

    const load = async () => {
      try {
        const [filesRaw] = await Promise.all([
          filesApiGet('candidate', candidate.id).catch(() => null),
          refreshBackend(),
        ]);
        const files = extractApiData(filesRaw) ?? [];
        setCandidateFiles(
          files.map((f) => ({
            id: f.id,
            fileUrl: f.fileUrl ?? null,
            fileType: f.fileType,
            fileName: f.fileName,
          }))
        );
        const latest = pickLatestResumeFileUrl(files);
        if (latest) setFilesResumeUrl(latest);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [enabled, candidate.id, refreshBackend]);

  useEffect(() => {
    if (!enabled || viewMode !== 'saasa' || !candidate.id) return;
    void (async () => {
      try {
        const filesRaw = await filesApiGet('candidate', candidate.id).catch(() => null);
        const files = extractApiData(filesRaw) ?? [];
        setCandidateFiles(
          files.map((f) => ({
            id: f.id,
            fileUrl: f.fileUrl ?? null,
            fileType: f.fileType,
            fileName: f.fileName,
          }))
        );
        await refreshBackend();
      } catch {
        /* ignore */
      }
    })();
  }, [enabled, viewMode, candidate.id, refreshBackend]);

  const availableModes = useMemo(
    () => listAvailableResumeCvModes(resumeSourceCandidate, originalResumeRaw || resumeHref),
    [resumeSourceCandidate, originalResumeRaw, resumeHref],
  );

  useEffect(() => {
    if (
      preferredResumeViewMode &&
      availableModes.includes(preferredResumeViewMode)
    ) {
      setViewMode(preferredResumeViewMode);
      return;
    }
    const fallback = resolveDefaultResumeCvViewMode(
      resumeSourceCandidate,
      originalResumeRaw || resumeHref,
    );
    setViewMode((current) => {
      if (current && availableModes.includes(current)) return current;
      return fallback;
    });
  }, [
    resumeSourceCandidate,
    originalResumeRaw,
    resumeHref,
    availableModes.join(','),
    preferredResumeViewMode,
  ]);

  const selectViewMode = (mode: ResumeCvViewMode) => {
    setViewMode(mode);
  };

  const buildResumeFilename = (sourceUrl: string, label: string) => {
    const ext = getResumeExtension(sourceUrl);
    const base = String(candidate.name || 'candidate').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'candidate';
    return ext ? `${base}-${label}.${ext}` : `${base}-${label}.pdf`;
  };

  const handleDownloadResume = async () => {
    const source = originalResumeRaw || effectiveResumeHref;
    if (!source || downloadingResume) return;
    setDownloadingResume(true);
    try {
      await triggerFileDownload(source, {
        uploadsBase,
        filename: buildResumeFilename(source, 'resume'),
      });
    } catch (error) {
      onToast?.(error instanceof Error ? error.message : 'Failed to download resume');
    } finally {
      setDownloadingResume(false);
    }
  };

  const handleDownloadUpdatedText = () => {
    if (!structuredCvData || downloadingUpdated) return;
    setDownloadingUpdated(true);
    try {
      downloadCvEditorPlainText(structuredCvData, candidate.name);
    } catch (error) {
      onToast?.(error instanceof Error ? error.message : 'Failed to download updated CV');
    } finally {
      setDownloadingUpdated(false);
    }
  };

  const handleExportUpdatedPdf = () => {
    if (!structuredCvData || exportingUpdatedPdf) return;
    setExportingUpdatedPdf(true);
    try {
      printCvEditorAsPdf(structuredCvData, candidate.name);
    } catch (error) {
      onToast?.(error instanceof Error ? error.message : 'Failed to export updated CV as PDF');
    } finally {
      window.setTimeout(() => setExportingUpdatedPdf(false), 600);
    }
  };

  const handleDownloadSaasaCv = async () => {
    const source = saasaPreviewRaw || saasaStored?.fileUrl || saasaSavedFileUrl || effectiveSaasaPreviewHref;
    if (!source || downloadingSaasa) return;
    setDownloadingSaasa(true);
    try {
      const namedFile = candidateFiles.find((file) => file.fileUrl && file.fileUrl === source);
      await triggerFileDownload(source, {
        uploadsBase,
        filename: namedFile?.fileName || buildResumeFilename(source, 'saasa-cv'),
      });
    } catch (error) {
      onToast?.(error instanceof Error ? error.message : 'Failed to download SAASA CV');
    } finally {
      setDownloadingSaasa(false);
    }
  };

  const showOriginalPreview = viewMode === 'original' && Boolean(effectiveResumeHref);
  /** Resume tab SAASA mode: only the saved export (never live annotation overlay). */
  const showSaasaSavedFile = viewMode === 'saasa' && Boolean(effectiveSaasaPreviewHref);
  const showSaasaEmpty =
    viewMode === 'saasa' && !effectiveSaasaPreviewHref && Boolean(onOpenSaasaCv);
  const showStructuredPreview =
    viewMode === 'updated' && hasResumeTabUpdatedCv(resumeSourceCandidate);

  const showOriginalToolbar = viewMode === 'original' && Boolean(effectiveResumeHref);
  const showSaasaToolbar = viewMode === 'saasa' && Boolean(saasaBaseResumeHref || effectiveSaasaPreviewHref);
  const showStructuredToolbar = viewMode === 'updated' && showStructuredPreview;
  const showResumeToolbar =
    availableModes.length > 0 || showOriginalToolbar || showSaasaToolbar || showStructuredToolbar;

  const structuredCvPreviewKey = useMemo(() => {
    const layout = readCvEditorLayout(resumeSourceCandidate);
    const extra = resumeSourceCandidate?.extraData;
    const savedAt =
      extra && typeof extra === 'object' && !Array.isArray(extra)
        ? String((extra as Record<string, unknown>).cvEditorContentSavedAt || '')
        : '';
    return [
      resumeSourceCandidate?.id,
      layout?.updatedAt,
      savedAt,
      structuredCvData?.name,
      structuredCvData?.candidatePhotoUrl,
      structuredCvData?.companyLogoUrl,
      structuredCvData?.summary,
      structuredCvData?.experiences?.map((e) => `${e.role}|${e.company}|${e.desc}`).join(';'),
      structuredCvData?.education?.map((e) => `${e.degree}|${e.school}`).join(';'),
      structuredCvData?.skills?.join(','),
    ].join('|');
  }, [resumeSourceCandidate, structuredCvData]);

  return (
    <>
      <div className="flex h-[calc(100vh-18rem)] min-h-[560px] flex-col">
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
          {showResumeToolbar ? (
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2">
              {availableModes.length > 0 ? (
                <div
                  className="flex min-w-0 flex-wrap items-center gap-2"
                  role="tablist"
                  aria-label="Resume version"
                >
                  {availableModes.map((mode) => {
                    const active = viewMode === mode;
                    const deletable = mode === 'updated' && canDeleteUpdatedCv;
                    return (
                      <div
                        key={mode}
                        className={`inline-flex items-stretch overflow-hidden rounded-full text-sm font-semibold transition-colors ${
                          active
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'border border-slate-200 bg-white text-slate-700'
                        }`}
                      >
                        <button
                          type="button"
                          role="tab"
                          aria-selected={active}
                          onClick={() => selectViewMode(mode)}
                          disabled={busy}
                          className={`px-4 py-2 transition-colors disabled:opacity-60 ${
                            active ? '' : 'hover:bg-slate-50'
                          }`}
                        >
                          {MODE_LABELS[mode]}
                        </button>
                        {deletable ? (
                          <button
                            type="button"
                            title={`Delete ${MODE_LABELS[mode]}`}
                            aria-label={`Delete ${MODE_LABELS[mode]}`}
                            disabled={busy}
                            onClick={() => void handleDeleteUpdatedCv()}
                            className={`inline-flex items-center border-l px-2.5 py-2 transition-colors disabled:opacity-60 ${
                              active
                                ? 'border-blue-500 hover:bg-blue-700'
                                : 'border-slate-200 hover:bg-red-50 hover:text-red-700'
                            }`}
                          >
                            {busy && active ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Trash2 size={14} />
                            )}
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="min-w-0 flex-1" />
              )}

              <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                {showOriginalToolbar ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setResumePreviewOpen(true)}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Eye size={16} />
                      Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDownloadResume()}
                      disabled={downloadingResume}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    >
                      {downloadingResume ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                      Download
                    </button>
                  </>
                ) : showSaasaToolbar ? (
                  <>
                    {onOpenSaasaCv ? (
                      <button
                        type="button"
                        onClick={onOpenSaasaCv}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <Pencil size={16} />
                        Edit SAASA CV
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setSaasaPreviewOpen(true)}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Eye size={16} />
                      Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDownloadSaasaCv()}
                      disabled={downloadingSaasa}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    >
                      {downloadingSaasa ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                      Download
                    </button>
                  </>
                ) : showStructuredToolbar ? (
                  <>
                    {canDeleteUpdatedCv ? (
                      <button
                        type="button"
                        onClick={() => void handleDeleteUpdatedCv()}
                        disabled={busy}
                        className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                      >
                        {busy ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                        Delete
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={openStructuredPreview}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Eye size={16} />
                      Preview
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadUpdatedText}
                      disabled={downloadingUpdated}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    >
                      {downloadingUpdated ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Download size={16} />
                      )}
                      TXT
                    </button>
                    <button
                      type="button"
                      onClick={handleExportUpdatedPdf}
                      disabled={exportingUpdatedPdf}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    >
                      {exportingUpdatedPdf ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Download size={16} />
                      )}
                      PDF
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="relative min-h-0 flex-1 overflow-hidden">
            {loading && !backendCandidate ? (
              <div className="flex h-full min-h-[320px] items-center justify-center">
                <Loader2 className="size-8 animate-spin text-blue-600" />
              </div>
            ) : showOriginalPreview ? (
              <ResumeInlinePreview
                resumeUrl={effectiveResumeHref}
                candidateName={candidate.name}
                enabled={enabled && viewMode === 'original'}
                minHeightClass="h-full min-h-0"
                className="h-full"
              />
            ) : showSaasaSavedFile ? (
              <SaasaCvSavedPreview
                fileUrl={effectiveSaasaPreviewHref}
                cacheKey={saasaStored?.updatedAt ?? saasaStored?.fileId ?? null}
                candidateName={candidate.name}
                enabled={enabled && viewMode === 'saasa'}
                minHeightClass="h-full min-h-0"
                className="h-full"
                preferNativePdfEmbed
              />
            ) : showSaasaEmpty ? (
              <div className="flex h-full min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center">
                <p className="text-sm text-slate-600">No SAASA CV saved yet.</p>
                <button
                  type="button"
                  onClick={onOpenSaasaCv}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  <Pencil size={16} />
                  Create SAASA CV
                </button>
              </div>
            ) : showStructuredPreview && structuredCvData ? (
              <div className="h-full min-h-0 overflow-auto bg-slate-200/80 p-3 sm:p-4">
                <CVEditorModal
                  key={structuredCvPreviewKey}
                  initialData={structuredCvData}
                  readOnly
                  embedded
                />
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

      {portalReady && saasaPreviewOpen && (effectiveSaasaPreviewHref || saasaBaseResumeHref)
        ? createPortal(
            <div className="fixed inset-0 z-[220] flex flex-col bg-slate-950/60 p-2 sm:p-4">
              <div className="mx-auto flex h-[calc(100vh-1rem)] w-[calc(100vw-1rem)] max-w-[min(96vw,1400px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:h-[calc(100vh-2rem)] sm:w-[calc(100vw-2rem)]">
                <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3">
                  <h3 className="text-base font-semibold text-slate-900">{candidate.name} — SAASA CV</h3>
                  <button
                    type="button"
                    onClick={() => setSaasaPreviewOpen(false)}
                    className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
                  >
                    Close
                  </button>
                </div>
                <div className="min-h-0 flex-1">
                  {effectiveSaasaPreviewHref ? (
                    <SaasaCvSavedPreview
                      fileUrl={effectiveSaasaPreviewHref}
                      cacheKey={saasaStored?.updatedAt ?? saasaStored?.fileId ?? null}
                      candidateName={candidate.name}
                      enabled={saasaPreviewOpen}
                      minHeightClass="h-full min-h-0"
                      className="h-full"
                    />
                  ) : null}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
