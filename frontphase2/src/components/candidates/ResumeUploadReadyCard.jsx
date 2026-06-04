'use client';

import React from 'react';
import { Check, FileText } from 'lucide-react';

export function formatResumeFileSize(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n < 0) return '';
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)}KB`;
  return `${(n / (1024 * 1024)).toFixed(1)}MB`;
}

export function formatResumeUploadDate(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return 'today';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Shown after a resume file is selected — blue status badge + file metadata (job-portal style).
 */
export function ResumeUploadReadyCard({
  file,
  badgeLabel = 'Resume ready to save',
  uploadedAt,
  hint = 'Use the upload area above to replace this file.',
  parsedNote,
  onRemove,
}) {
  if (!file?.name) return null;

  const uploadedLabel = uploadedAt
    ? `Uploaded on ${formatResumeUploadDate(uploadedAt)}`
    : `Uploaded on ${formatResumeUploadDate(file.lastModified ? new Date(file.lastModified) : new Date())}`;

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="inline-flex items-center gap-2 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-100">
          <Check size={14} className="shrink-0 text-blue-600" strokeWidth={2.5} />
          <span>{badgeLabel}</span>
        </div>
        {onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="shrink-0 text-xs font-semibold text-blue-600 hover:text-blue-800"
          >
            Remove
          </button>
        ) : null}
      </div>
      <div className="flex items-start gap-3">
        <div className="shrink-0 rounded-lg bg-slate-100 p-2.5">
          <FileText size={22} className="text-slate-500" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="truncate text-sm font-semibold text-slate-900" title={file.name}>
            {file.name}
          </p>
          <p className="text-xs text-slate-500">{uploadedLabel}</p>
          {file.size ? (
            <p className="text-xs text-slate-500">Size: {formatResumeFileSize(file.size)}</p>
          ) : null}
          {parsedNote ? <p className="text-xs font-medium text-blue-600">{parsedNote}</p> : null}
          <p className="text-xs text-slate-400">{hint}</p>
        </div>
      </div>
    </div>
  );
}
