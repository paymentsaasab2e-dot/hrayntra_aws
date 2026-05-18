'use client';

import React, { useId, useRef } from 'react';
import { FileText, Paperclip, Trash2, Upload } from 'lucide-react';
import { buildFileHref } from '../../utils/cloudinaryUrls';
import { formatDateDMY } from '../../utils/dateDisplay';
import type { EntityFile } from '../../lib/api';
import { KYC_FILE_ACCEPT } from '../../lib/kycDocuments';

export type KycDocumentsFieldProps = {
  pendingFiles: File[];
  onPendingFilesChange: (files: File[]) => void;
  storedFiles?: EntityFile[];
  onRemoveStored?: (fileId: string) => void;
  disabled?: boolean;
  uploading?: boolean;
  uploadsBase?: string;
};

export function KycDocumentsField({
  pendingFiles,
  onPendingFilesChange,
  storedFiles = [],
  onRemoveStored,
  disabled,
  uploading,
  uploadsBase = '',
}: KycDocumentsFieldProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const addPending = (list: FileList | null) => {
    if (!list?.length) return;
    const next = [...pendingFiles];
    for (const file of Array.from(list)) {
      if (!next.some((f) => f.name === file.name && f.size === file.size)) {
        next.push(file);
      }
    }
    onPendingFilesChange(next);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div>
      <label
        htmlFor={inputId}
        className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1"
      >
        KYC Documents
      </label>
      <p className="text-xs text-slate-500 mb-2">
        Upload identity or compliance documents (PDF, DOC, DOCX, JPG, PNG). Up to 10MB each. You can
        add multiple files.
      </p>

      <input
        id={inputId}
        ref={inputRef}
        type="file"
        multiple
        accept={KYC_FILE_ACCEPT}
        disabled={disabled || uploading}
        onChange={(e) => addPending(e.target.files)}
        className="hidden"
      />

      {(storedFiles.length > 0 || pendingFiles.length > 0) && (
        <ul className="mb-2 space-y-2">
          {storedFiles.map((file) => {
            const href = buildFileHref(file.fileUrl || '', uploadsBase);
            return (
              <li
                key={file.id}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900"
              >
                <Paperclip size={14} className="shrink-0 text-slate-500" />
                {href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-w-0 flex-1 truncate hover:underline"
                  >
                    {file.fileName}
                  </a>
                ) : (
                  <span className="min-w-0 flex-1 truncate">{file.fileName}</span>
                )}
                {file.uploadDate && (
                  <span className="shrink-0 text-xs text-slate-500">
                    {formatDateDMY(file.uploadDate)}
                  </span>
                )}
                {onRemoveStored ? (
                  <button
                    type="button"
                    onClick={() => onRemoveStored(file.id)}
                    disabled={disabled || uploading}
                    className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-red-600 disabled:opacity-50"
                    aria-label={`Remove ${file.fileName}`}
                  >
                    <Trash2 size={14} />
                  </button>
                ) : null}
              </li>
            );
          })}
          {pendingFiles.map((file, index) => (
            <li
              key={`pending-${file.name}-${file.size}-${index}`}
              className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900"
            >
              <FileText size={14} className="shrink-0 text-blue-600" />
              <span className="min-w-0 flex-1 truncate">{file.name}</span>
              <span className="shrink-0 text-xs text-blue-700">Pending upload</span>
              <button
                type="button"
                onClick={() =>
                  onPendingFilesChange(pendingFiles.filter((_, i) => i !== index))
                }
                disabled={disabled || uploading}
                className="shrink-0 text-xs font-semibold text-blue-700 hover:text-blue-900 disabled:opacity-50"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || uploading}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-60"
      >
        <Upload size={14} className="text-slate-500" />
        {uploading ? 'Uploading…' : 'Upload KYC documents'}
      </button>
    </div>
  );
}

/** Read-only list for overview view mode */
export function KycDocumentsView({
  files,
  uploadsBase = '',
}: {
  files: EntityFile[];
  uploadsBase?: string;
}) {
  if (files.length === 0) return null;

  return (
    <div>
      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
        KYC Documents
      </div>
      <ul className="space-y-2">
        {files.map((file) => {
          const href = buildFileHref(file.fileUrl || '', uploadsBase);
          return (
            <li key={file.id}>
              <a
                href={href || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full max-w-md items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 hover:bg-slate-100 transition-colors"
              >
                <Paperclip size={14} className="shrink-0 text-slate-500" />
                <span className="min-w-0 flex-1 truncate">{file.fileName}</span>
                {file.uploadDate ? (
                  <span className="shrink-0 text-xs text-slate-400">
                    {formatDateDMY(file.uploadDate)}
                  </span>
                ) : null}
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
