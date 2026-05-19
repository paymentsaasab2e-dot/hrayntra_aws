'use client';

import React, { useId } from 'react';
import { CheckCircle, FileText, Paperclip, X } from 'lucide-react';
import { buildFileHref } from '../../utils/cloudinaryUrls';
import { formatDateDMY } from '../../utils/dateDisplay';
import type { EntityFile } from '../../lib/api';
import { KYC_FILE_ACCEPT } from '../../lib/kycDocuments';
import { DocumentUploadButton } from '../import/documentUploadUi';
import { ImportProgressBar } from '../import/importDrawerUi';

export type KycDocumentsFieldProps = {
  pendingFiles: File[];
  onPendingFilesChange: (files: File[]) => void;
  storedFiles?: EntityFile[];
  onRemoveStored?: (fileId: string) => void;
  disabled?: boolean;
  uploading?: boolean;
  uploadSuccess?: boolean;
  uploadPercent?: number;
  uploadsBase?: string;
};

export function KycDocumentsField({
  pendingFiles,
  onPendingFilesChange,
  storedFiles = [],
  onRemoveStored,
  disabled,
  uploading,
  uploadSuccess,
  uploadPercent = 0,
  uploadsBase = '',
}: KycDocumentsFieldProps) {
  const inputId = useId();

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
                    className="shrink-0 rounded-lg p-1 text-red-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    aria-label={`Remove ${file.fileName}`}
                  >
                    <X size={16} strokeWidth={2.25} />
                  </button>
                ) : null}
              </li>
            );
          })}
          {pendingFiles.map((file, index) => (
            <li
              key={`pending-${file.name}-${file.size}-${index}`}
              className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
            >
              <CheckCircle size={14} className="shrink-0 text-emerald-600" />
              <FileText size={14} className="shrink-0 text-emerald-600" />
              <span className="min-w-0 flex-1 truncate">{file.name}</span>
              <span className="shrink-0 text-xs text-emerald-700">Ready to upload</span>
              <button
                type="button"
                onClick={() =>
                  onPendingFilesChange(pendingFiles.filter((_, i) => i !== index))
                }
                disabled={disabled || uploading}
                className="shrink-0 rounded-lg p-1 text-red-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                aria-label={`Remove ${file.name}`}
              >
                <X size={16} strokeWidth={2.25} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <DocumentUploadButton
        disabled={disabled}
        isUploading={Boolean(uploading)}
        uploadSuccess={uploadSuccess}
        uploadPercent={uploadPercent}
        accept={KYC_FILE_ACCEPT}
        multiple
        variant="secondary"
        label="Upload KYC documents"
        uploadingLabel="Uploading"
        onFilesSelected={(files) => {
          const next = [...pendingFiles];
          for (const file of files) {
            if (!next.some((f) => f.name === file.name && f.size === file.size)) {
              next.push(file);
            }
          }
          onPendingFilesChange(next);
        }}
      />

      {uploading ? (
        <div className="mt-2">
          <ImportProgressBar label="Uploading KYC documents…" percent={uploadPercent} />
        </div>
      ) : null}
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
