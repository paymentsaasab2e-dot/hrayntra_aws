'use client';

import React, { useMemo, useState } from 'react';
import { Download, Eye, FileText, Loader2, Pencil, Trash2 } from 'lucide-react';
import type { CandidateProfileDrawerData } from '../drawers/CandidateProfileDrawer';
import type { CandidateResumeCvEditorApi } from './CandidateResumeTabPanel';
import {
  candidateToCvEditorData,
  hasResumeTabUpdatedCv,
  mergeResumeTabCandidateSource,
  type ResumeCvViewMode,
} from '../../lib/cvEditorMapping';
import { downloadCvEditorPlainText, printCvEditorAsPdf } from '../../lib/cvEditorExport';
import { getResumeExtension } from '../../lib/resumePreview';
import { triggerFileDownload } from '../../utils/triggerFileDownload';
import { requestConfirm, SYSTEM_ALERT_TITLE } from '../../lib/appDialog';

interface SaasaCvFileEntry {
  id?: string;
  fileName: string;
  fileUrl?: string | null;
  markCount?: number;
}

interface CandidateCvFilesSectionProps {
  candidate: CandidateProfileDrawerData;
  cvEditor: CandidateResumeCvEditorApi;
  saasaCv: {
    openModal: () => void;
    deleteSavedCv: () => Promise<boolean>;
    busy: boolean;
  };
  saasaCvFileEntry: SaasaCvFileEntry | null;
  originalResumeUrl?: string | null;
  uploadsBase: string;
  canEdit: boolean;
  onToast?: (message: string) => void;
  onViewResumeTab?: (mode: ResumeCvViewMode) => void;
}

function buildDownloadFilename(sourceUrl: string, candidateName: string, label: string): string {
  const ext = getResumeExtension(sourceUrl);
  const base = String(candidateName || 'candidate').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'candidate';
  return ext ? `${base}-${label}.${ext}` : `${base}-${label}.pdf`;
}

export function CandidateCvFilesSection({
  candidate,
  cvEditor,
  saasaCv,
  saasaCvFileEntry,
  originalResumeUrl = null,
  uploadsBase,
  canEdit,
  onToast,
  onViewResumeTab,
}: CandidateCvFilesSectionProps) {
  const {
    backendCandidate,
    busy: cvBusy,
    openStructuredPreview,
    deleteUpdatedCv,
  } = cvEditor;

  const [downloadingOriginal, setDownloadingOriginal] = useState(false);
  const [downloadingSaasa, setDownloadingSaasa] = useState(false);
  const [downloadingUpdated, setDownloadingUpdated] = useState(false);
  const [exportingUpdatedPdf, setExportingUpdatedPdf] = useState(false);

  const resumeSource = useMemo(
    () => mergeResumeTabCandidateSource(backendCandidate, candidate),
    [backendCandidate, candidate],
  );

  const hasUpdatedCv = hasResumeTabUpdatedCv(resumeSource);
  const updatedCvData = useMemo(
    () => (hasUpdatedCv ? candidateToCvEditorData(resumeSource) : null),
    [hasUpdatedCv, resumeSource],
  );

  const canDeleteUpdatedCv = canEdit && Boolean(deleteUpdatedCv) && hasUpdatedCv;

  const handleDownloadOriginal = async () => {
    const source = String(originalResumeUrl || '').trim();
    if (!source || downloadingOriginal) return;
    setDownloadingOriginal(true);
    try {
      await triggerFileDownload(source, {
        uploadsBase,
        filename: buildDownloadFilename(source, candidate.name, 'original-cv'),
      });
    } catch (error) {
      onToast?.(error instanceof Error ? error.message : 'Failed to download original CV');
    } finally {
      setDownloadingOriginal(false);
    }
  };

  const handleDownloadSaasa = async () => {
    const source = String(saasaCvFileEntry?.fileUrl || '').trim();
    if (!source || downloadingSaasa) return;
    setDownloadingSaasa(true);
    try {
      await triggerFileDownload(source, {
        uploadsBase,
        filename:
          saasaCvFileEntry?.fileName ||
          buildDownloadFilename(source, candidate.name, 'saasa-cv'),
      });
    } catch (error) {
      onToast?.(error instanceof Error ? error.message : 'Failed to download SAASA CV');
    } finally {
      setDownloadingSaasa(false);
    }
  };

  const handleDownloadUpdatedText = () => {
    if (!updatedCvData || downloadingUpdated) return;
    setDownloadingUpdated(true);
    try {
      downloadCvEditorPlainText(updatedCvData, candidate.name);
    } catch (error) {
      onToast?.(error instanceof Error ? error.message : 'Failed to download updated CV');
    } finally {
      setDownloadingUpdated(false);
    }
  };

  const handleExportUpdatedPdf = () => {
    if (!updatedCvData || exportingUpdatedPdf) return;
    setExportingUpdatedPdf(true);
    try {
      printCvEditorAsPdf(updatedCvData, candidate.name);
    } catch (error) {
      onToast?.(error instanceof Error ? error.message : 'Failed to export updated CV as PDF');
    } finally {
      window.setTimeout(() => setExportingUpdatedPdf(false), 600);
    }
  };

  const handleDeleteUpdatedCv = async () => {
    if (!deleteUpdatedCv || !canDeleteUpdatedCv || cvBusy) return;
    const confirmed = await requestConfirm(
      'Remove the updated CV? The Original CV will remain. You can edit and save again anytime.',
      {
        title: SYSTEM_ALERT_TITLE,
        tone: 'warning',
        confirmLabel: 'Remove',
        cancelLabel: 'Cancel',
      },
    );
    if (!confirmed) return;
    await deleteUpdatedCv();
  };

  const showOriginal = Boolean(String(originalResumeUrl || '').trim());
  const showSaasa = Boolean(saasaCvFileEntry);
  const showAnyCv = showOriginal || hasUpdatedCv || showSaasa;

  if (!showAnyCv) return null;

  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">CV versions</h4>
        <p className="mt-0.5 text-xs text-slate-500">
          Original upload, recruiter-edited CV, and SAASA export — same as the Resume tab.
        </p>
      </div>

      {showOriginal ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50/60 p-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <FileText size={16} className="shrink-0 text-blue-500" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">Original CV</p>
              <p className="mt-0.5 text-xs text-slate-500">Uploaded resume file</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {onViewResumeTab ? (
              <button
                type="button"
                onClick={() => onViewResumeTab('original')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <Eye size={14} />
                View
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void handleDownloadOriginal()}
              disabled={downloadingOriginal}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {downloadingOriginal ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Download size={14} />
              )}
              Download
            </button>
          </div>
        </div>
      ) : null}

      {hasUpdatedCv && updatedCvData ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <FileText size={16} className="shrink-0 text-emerald-600" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">Updated CV</p>
              <p className="mt-0.5 text-xs text-slate-500">Digitized CV from the editor</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {onViewResumeTab ? (
              <button
                type="button"
                onClick={() => onViewResumeTab('updated')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <Eye size={14} />
                View
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void openStructuredPreview()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <Eye size={14} />
              Preview
            </button>
            <button
              type="button"
              onClick={handleDownloadUpdatedText}
              disabled={downloadingUpdated}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {downloadingUpdated ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Download size={14} />
              )}
              TXT
            </button>
            <button
              type="button"
              onClick={handleExportUpdatedPdf}
              disabled={exportingUpdatedPdf}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {exportingUpdatedPdf ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Download size={14} />
              )}
              PDF
            </button>
            {canDeleteUpdatedCv ? (
              <button
                type="button"
                disabled={cvBusy}
                onClick={() => void handleDeleteUpdatedCv()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
              >
                <Trash2 size={14} />
                Delete
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {showSaasa && saasaCvFileEntry ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <FileText size={16} className="shrink-0 text-amber-600" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">{saasaCvFileEntry.fileName}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                SAASA CV · annotated
                {saasaCvFileEntry.markCount && saasaCvFileEntry.markCount > 0
                  ? ` · ${saasaCvFileEntry.markCount} mark${saasaCvFileEntry.markCount === 1 ? '' : 's'}`
                  : ''}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {onViewResumeTab ? (
              <button
                type="button"
                onClick={() => onViewResumeTab('saasa')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <Eye size={14} />
                View
              </button>
            ) : null}
            {canEdit ? (
              <button
                type="button"
                onClick={() => saasaCv.openModal()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <Pencil size={14} />
                Edit
              </button>
            ) : null}
            {saasaCvFileEntry.fileUrl ? (
              <button
                type="button"
                onClick={() => void handleDownloadSaasa()}
                disabled={downloadingSaasa}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                {downloadingSaasa ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Download size={14} />
                )}
                Download
              </button>
            ) : null}
            {canEdit ? (
              <button
                type="button"
                disabled={saasaCv.busy}
                onClick={() => void saasaCv.deleteSavedCv()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
              >
                <Trash2 size={14} />
                Delete
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
