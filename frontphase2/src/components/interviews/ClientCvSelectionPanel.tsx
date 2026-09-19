'use client';

import React from 'react';
import { Eye, FileText, Loader2, MessageSquare, SquarePen, Trash2 } from 'lucide-react';
import type { BackendCandidate } from '../../lib/api';
import { readCvSubmission, type CvShareMode } from '../../lib/cvEditorMapping';

export type ClientCvResumeVersion = {
  id: string;
  fileName: string;
  fileUrl: string;
  uploadDate?: string;
  isPrimary?: boolean;
};

interface ClientCvSelectionPanelProps {
  candidate: BackendCandidate | null;
  cvShareMode: CvShareMode | null;
  cvShareSaving: boolean;
  hasEditedCv: boolean;
  hasOriginalCv: boolean;
  hasSaasaCv: boolean;
  canOpenSaasaCv: boolean;
  saasaCvFileName?: string;
  saasaAnnotationCount?: number;
  saasaCvPreviewUrl?: string;
  resumeHref: string;
  /** All uploaded resume/CV file versions for this candidate. */
  resumeVersions?: ClientCvResumeVersion[];
  selectedResumeFileId?: string | null;
  cvEditorLoading: boolean;
  saasaCvBusy?: boolean;
  loading: boolean;
  onSelectMode: (mode: CvShareMode) => void;
  onSelectResumeVersion?: (fileId: string) => void;
  onExcludeVersion: (mode: CvShareMode) => void;
  onEditCv: () => void;
  onPreviewEdited: () => void;
  onPreviewOriginal: () => void;
  onPreviewResumeVersion?: (fileId: string) => void;
  onOpenSaasaCv: () => void;
  onPreviewSaasaCv: () => void;
  showEditedOption?: boolean;
  showOriginalOption?: boolean;
}

function formatUploadDate(value?: string): string {
  if (!value) return '';
  const ts = Date.parse(value);
  if (!Number.isFinite(ts)) return '';
  try {
    return new Date(ts).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

export function ClientCvSelectionPanel({
  candidate,
  cvShareMode,
  cvShareSaving,
  hasEditedCv,
  hasOriginalCv,
  hasSaasaCv,
  canOpenSaasaCv,
  saasaCvFileName,
  saasaAnnotationCount = 0,
  saasaCvPreviewUrl,
  resumeHref,
  resumeVersions = [],
  selectedResumeFileId = null,
  cvEditorLoading,
  saasaCvBusy = false,
  loading,
  onSelectMode,
  onSelectResumeVersion,
  onExcludeVersion,
  onEditCv,
  onPreviewEdited,
  onPreviewOriginal,
  onPreviewResumeVersion,
  onOpenSaasaCv,
  onPreviewSaasaCv,
  showEditedOption = true,
  showOriginalOption = true,
}: ClientCvSelectionPanelProps) {
  const showEdited = showEditedOption && hasEditedCv;
  const hasVersionList = resumeVersions.length > 0;
  const showOriginal = showOriginalOption && (hasOriginalCv || hasVersionList);
  const optionCount = [showEdited, showOriginal, hasSaasaCv || canOpenSaasaCv].filter(Boolean).length;
  const gridCols =
    optionCount >= 3 ? 'md:grid-cols-3' : optionCount === 2 ? 'md:grid-cols-2' : 'md:grid-cols-1';
  const activeResumeId =
    selectedResumeFileId ||
    resumeVersions.find((v) => v.isPrimary)?.id ||
    resumeVersions[0]?.id ||
    null;
  const selectedVersion =
    resumeVersions.find((v) => v.id === activeResumeId) || resumeVersions[0] || null;
  const previewHref = selectedVersion?.fileUrl || resumeHref;

  return (
    <section className="rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[#111827]">CV for client</h3>
          <p className="mt-0.5 text-xs text-[#6B7280]">
            Choose which CV version the client receives. Only the selected version is shared on
            submit.
          </p>
        </div>
        {cvShareSaving ? (
          <span className="inline-flex items-center gap-1 text-xs text-[#6B7280]">
            <Loader2 size={14} className="animate-spin" />
            Saving…
          </span>
        ) : null}
      </div>

      <div className={`mt-4 grid grid-cols-1 gap-3 ${gridCols}`}>
        {showEdited ? (
          <div
            className={`rounded-xl border bg-white p-4 transition-colors ${
              cvShareMode === 'edited'
                ? 'border-[#2563EB] ring-2 ring-[#2563EB]/20'
                : 'border-[#E5E7EB]'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <label className="flex cursor-pointer items-start gap-2">
                <input
                  type="radio"
                  name="client-cv-choice"
                  checked={cvShareMode === 'edited'}
                  onChange={() => onSelectMode('edited')}
                  className="mt-1"
                />
                <div>
                  <p className="text-sm font-semibold text-[#111827]">Updated CV</p>
                  <p className="text-xs text-[#6B7280]">
                    Edited profile — summary, experience, skills, photos
                  </p>
                </div>
              </label>
              {cvShareMode === 'edited' ? (
                <span className="shrink-0 rounded-full bg-[#EFF6FF] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#2563EB]">
                  Selected
                </span>
              ) : null}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onEditCv}
                disabled={!candidate?.id || loading || cvEditorLoading}
                className="inline-flex items-center gap-1 rounded-lg border border-[#D1D5DB] px-2.5 py-1 text-xs font-semibold text-[#374151] hover:bg-[#F9FAFB] disabled:opacity-60"
              >
                {cvEditorLoading ? <Loader2 size={13} className="animate-spin" /> : <SquarePen size={13} />}
                Edit
              </button>
              <button
                type="button"
                onClick={onPreviewEdited}
                className="inline-flex items-center gap-1 rounded-lg bg-[#2563EB] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#1D4ED8]"
              >
                <Eye size={13} />
                Preview
              </button>
              {hasOriginalCv || hasVersionList || hasSaasaCv ? (
                <button
                  type="button"
                  onClick={() => onExcludeVersion('edited')}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-2.5 py-1 text-xs font-semibold text-[#B91C1C] hover:bg-[#FEE2E2]"
                >
                  <Trash2 size={13} />
                  Exclude
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {showOriginal ? (
          <div
            className={`rounded-xl border bg-white p-4 transition-colors ${
              cvShareMode === 'original'
                ? 'border-[#2563EB] ring-2 ring-[#2563EB]/20'
                : 'border-[#E5E7EB]'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <label className="flex cursor-pointer items-start gap-2">
                <input
                  type="radio"
                  name="client-cv-choice"
                  checked={cvShareMode === 'original'}
                  onChange={() => {
                    onSelectMode('original');
                    if (activeResumeId && onSelectResumeVersion) {
                      onSelectResumeVersion(activeResumeId);
                    }
                  }}
                  className="mt-1"
                />
                <div>
                  <p className="text-sm font-semibold text-[#111827]">
                    {hasVersionList ? 'Uploaded CV versions' : 'Original resume'}
                  </p>
                  <p className="text-xs text-[#6B7280]">
                    {hasVersionList
                      ? 'Pick which uploaded file the client sees'
                      : 'Uploaded file (PDF / Word)'}
                  </p>
                </div>
              </label>
              {cvShareMode === 'original' ? (
                <span className="shrink-0 rounded-full bg-[#EFF6FF] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#2563EB]">
                  Selected
                </span>
              ) : null}
            </div>

            {hasVersionList ? (
              <div className="mt-3 space-y-2">
                {resumeVersions.map((version, index) => {
                  const selected =
                    cvShareMode === 'original' && version.id === activeResumeId;
                  const uploaded = formatUploadDate(version.uploadDate);
                  return (
                    <label
                      key={version.id}
                      className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 transition-colors ${
                        selected
                          ? 'border-[#2563EB] bg-[#EFF6FF]'
                          : 'border-[#E5E7EB] bg-[#FAFAFA] hover:bg-white'
                      }`}
                    >
                      <input
                        type="radio"
                        name="client-cv-version"
                        checked={selected}
                        onChange={() => {
                          onSelectMode('original');
                          onSelectResumeVersion?.(version.id);
                        }}
                        className="mt-1"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-[#111827]">
                          Version {index + 1}
                          {index === 0 ? ' · Original' : ''}
                          {version.isPrimary ? ' · Primary' : ''}
                        </p>
                        <p className="truncate text-xs text-[#6B7280]">{version.fileName}</p>
                        {uploaded ? (
                          <p className="text-[11px] text-[#9CA3AF]">{uploaded}</p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          onPreviewResumeVersion?.(version.id);
                        }}
                        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[#D1D5DB] px-2 py-1 text-[11px] font-semibold text-[#374151] hover:bg-white"
                      >
                        <Eye size={12} />
                        Preview
                      </button>
                    </label>
                  );
                })}
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onPreviewOriginal}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#D1D5DB] px-2.5 py-1 text-xs font-semibold text-[#374151] hover:bg-[#F9FAFB]"
                >
                  <FileText size={13} />
                  Preview
                </button>
                <a
                  href={previewHref}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border border-[#D1D5DB] px-2.5 py-1 text-xs font-medium text-[#374151] hover:bg-[#F9FAFB]"
                >
                  Open in tab
                </a>
              </div>
            )}

            {(hasEditedCv || hasSaasaCv) && !hasVersionList ? (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => onExcludeVersion('original')}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-2.5 py-1 text-xs font-semibold text-[#B91C1C] hover:bg-[#FEE2E2]"
                >
                  <Trash2 size={13} />
                  Exclude
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {hasSaasaCv || canOpenSaasaCv ? (
          <div
            className={`rounded-xl border bg-white p-4 transition-colors ${
              cvShareMode === 'saasa'
                ? 'border-amber-400 ring-2 ring-amber-200'
                : 'border-[#E5E7EB]'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <label
                className={`flex items-start gap-2 ${hasSaasaCv ? 'cursor-pointer' : 'cursor-not-allowed opacity-90'}`}
              >
                <input
                  type="radio"
                  name="client-cv-choice"
                  checked={cvShareMode === 'saasa'}
                  disabled={!hasSaasaCv}
                  onChange={() => {
                    if (hasSaasaCv) onSelectMode('saasa');
                  }}
                  className="mt-1"
                />
                <div>
                  <p className="text-sm font-semibold text-[#111827]">HRYantra CV</p>
                  <p className="text-xs text-[#6B7280]">
                    Annotated CV with highlights, comments, and branding
                  </p>
                </div>
              </label>
              {cvShareMode === 'saasa' ? (
                <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                  Selected
                </span>
              ) : null}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onOpenSaasaCv}
                disabled={!canOpenSaasaCv || loading || saasaCvBusy}
                className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-60"
              >
                {saasaCvBusy ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <MessageSquare size={13} />
                )}
                HRYantra CV
                {saasaAnnotationCount > 0 ? (
                  <span className="rounded-full bg-amber-200 px-1.5 py-0.5 text-[10px] font-bold tabular-nums">
                    {saasaAnnotationCount}
                  </span>
                ) : null}
              </button>
              {hasSaasaCv && saasaCvPreviewUrl ? (
                <button
                  type="button"
                  onClick={onPreviewSaasaCv}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#D1D5DB] px-2.5 py-1 text-xs font-semibold text-[#374151] hover:bg-[#F9FAFB]"
                >
                  <Eye size={13} />
                  Preview
                </button>
              ) : null}
              {hasSaasaCv && saasaCvPreviewUrl ? (
                <a
                  href={saasaCvPreviewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border border-[#D1D5DB] px-2.5 py-1 text-xs font-medium text-[#374151] hover:bg-[#F9FAFB]"
                >
                  Open in tab
                </a>
              ) : null}
              {hasSaasaCv && (hasEditedCv || hasOriginalCv || hasVersionList) ? (
                <button
                  type="button"
                  onClick={() => onExcludeVersion('saasa')}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-2.5 py-1 text-xs font-semibold text-[#B91C1C] hover:bg-[#FEE2E2]"
                >
                  <Trash2 size={13} />
                  Exclude
                </button>
              ) : null}
            </div>
            {saasaCvFileName ? (
              <p className="mt-2 truncate text-xs text-[#6B7280]">{saasaCvFileName}</p>
            ) : null}
            {!hasSaasaCv && canOpenSaasaCv ? (
              <p className="mt-2 text-xs text-amber-800">
                Open HRYantra CV, add annotations, and save to enable this option for the client.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {!hasEditedCv && !hasOriginalCv && !hasVersionList && !hasSaasaCv && !canOpenSaasaCv ? (
        <p className="mt-3 text-sm text-[#9CA3AF]">
          No CV available. Upload a resume version or create an HRYantra CV before submitting.
        </p>
      ) : (
        <p className="mt-3 text-xs text-[#6B7280]">
          {cvShareMode === 'edited'
            ? 'The client will see your updated CV from the editor.'
            : cvShareMode === 'original'
              ? selectedVersion
                ? `The client will see “${selectedVersion.fileName}”.`
                : 'The client will see the original uploaded resume file only.'
              : cvShareMode === 'saasa'
                ? 'The client will receive your saved HRYantra CV export.'
                : 'Select which CV to send before submitting to the client.'}
          {readCvSubmission(candidate)?.shareMode ? (
            <span className="ml-1 text-[#9CA3AF]">(preference saved)</span>
          ) : null}
        </p>
      )}
    </section>
  );
}
