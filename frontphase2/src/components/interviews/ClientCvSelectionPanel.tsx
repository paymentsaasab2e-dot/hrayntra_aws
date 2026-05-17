'use client';

import React from 'react';
import { Eye, FileText, Loader2, SquarePen, Trash2 } from 'lucide-react';
import type { BackendCandidate } from '../../lib/api';
import { readCvSubmission, type CvShareMode } from '../../lib/cvEditorMapping';

interface ClientCvSelectionPanelProps {
  candidate: BackendCandidate | null;
  cvShareMode: CvShareMode | null;
  cvShareSaving: boolean;
  hasEditedCv: boolean;
  hasOriginalCv: boolean;
  resumeHref: string;
  cvEditorLoading: boolean;
  loading: boolean;
  onSelectMode: (mode: CvShareMode) => void;
  onExcludeVersion: (mode: CvShareMode) => void;
  onEditCv: () => void;
  onPreviewEdited: () => void;
  onPreviewOriginal: () => void;
}

export function ClientCvSelectionPanel({
  candidate,
  cvShareMode,
  cvShareSaving,
  hasEditedCv,
  hasOriginalCv,
  resumeHref,
  cvEditorLoading,
  loading,
  onSelectMode,
  onExcludeVersion,
  onEditCv,
  onPreviewEdited,
  onPreviewOriginal,
}: ClientCvSelectionPanelProps) {
  return (
    <section className="rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[#111827]">CV for client</h3>
          <p className="mt-0.5 text-xs text-[#6B7280]">
            Choose which CV the client receives. Only the selected version is shared on submit.
          </p>
        </div>
        {cvShareSaving ? (
          <span className="inline-flex items-center gap-1 text-xs text-[#6B7280]">
            <Loader2 size={14} className="animate-spin" />
            Saving…
          </span>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        {hasEditedCv ? (
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
              {hasOriginalCv ? (
                <button
                  type="button"
                  onClick={() => onExcludeVersion('edited')}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-2.5 py-1 text-xs font-semibold text-[#B91C1C] hover:bg-[#FEE2E2]"
                >
                  <Trash2 size={13} />
                  Use original only
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {hasOriginalCv ? (
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
                  onChange={() => onSelectMode('original')}
                  className="mt-1"
                />
                <div>
                  <p className="text-sm font-semibold text-[#111827]">Original resume</p>
                  <p className="text-xs text-[#6B7280]">Uploaded file (PDF / Word)</p>
                </div>
              </label>
              {cvShareMode === 'original' ? (
                <span className="shrink-0 rounded-full bg-[#EFF6FF] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#2563EB]">
                  Selected
                </span>
              ) : null}
            </div>
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
                href={resumeHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-[#D1D5DB] px-2.5 py-1 text-xs font-medium text-[#374151] hover:bg-[#F9FAFB]"
              >
                Open in tab
              </a>
              {hasEditedCv ? (
                <button
                  type="button"
                  onClick={() => onExcludeVersion('original')}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-2.5 py-1 text-xs font-semibold text-[#B91C1C] hover:bg-[#FEE2E2]"
                >
                  <Trash2 size={13} />
                  Use updated only
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {!hasEditedCv && !hasOriginalCv ? (
        <p className="mt-3 text-sm text-[#9CA3AF]">
          No CV available. Edit a CV or upload a resume before submitting.
        </p>
      ) : (
        <p className="mt-3 text-xs text-[#6B7280]">
          {cvShareMode === 'edited'
            ? 'The client will see your updated CV from the editor.'
            : cvShareMode === 'original'
              ? 'The client will see the original uploaded resume file only.'
              : 'Select which CV to send before submitting to the client.'}
          {readCvSubmission(candidate)?.shareMode ? (
            <span className="ml-1 text-[#9CA3AF]">(preference saved)</span>
          ) : null}
        </p>
      )}
    </section>
  );
}
