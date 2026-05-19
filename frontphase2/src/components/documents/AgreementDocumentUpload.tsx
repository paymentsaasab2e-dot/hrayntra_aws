'use client';

import React from 'react';
import { CheckCircle, Paperclip, X } from 'lucide-react';
import { DocumentUploadButton } from '../import/documentUploadUi';
import { ImportProgressBar } from '../import/importDrawerUi';

const DEFAULT_ACCEPT =
  'application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.pdf,.doc,.docx';

export type AgreementDocumentUploadProps = {
  description: string;
  pendingFile: File | null;
  onPendingFileChange: (file: File | null) => void;
  isUploading?: boolean;
  uploadSuccess?: boolean;
  uploadPercent?: number;
  disabled?: boolean;
  accept?: string;
};

export function AgreementDocumentUpload({
  description,
  pendingFile,
  onPendingFileChange,
  isUploading = false,
  uploadSuccess = false,
  uploadPercent = 0,
  disabled,
  accept = DEFAULT_ACCEPT,
}: AgreementDocumentUploadProps) {
  return (
    <div>
      <p className="text-xs text-slate-500 mb-2">{description}</p>
      {pendingFile ? (
        <div className="mb-2 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <CheckCircle size={14} className="shrink-0 text-emerald-600" />
          <Paperclip size={14} className="shrink-0 text-emerald-600" />
          <span className="min-w-0 flex-1 truncate">{pendingFile.name}</span>
          <span className="shrink-0 text-xs text-emerald-700">Ready to upload</span>
          <button
            type="button"
            onClick={() => onPendingFileChange(null)}
            disabled={disabled || isUploading}
            className="shrink-0 rounded-lg p-1 text-red-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
            aria-label="Remove file"
          >
            <X size={16} strokeWidth={2.25} />
          </button>
        </div>
      ) : null}
      <DocumentUploadButton
        variant="secondary"
        label={pendingFile ? 'Replace file' : 'Upload file'}
        isUploading={isUploading}
        uploadSuccess={uploadSuccess && !pendingFile}
        uploadPercent={uploadPercent}
        accept={accept}
        disabled={disabled}
        onFilesSelected={(files) => onPendingFileChange(files[0] ?? null)}
      />
      {isUploading ? (
        <div className="mt-2">
          <ImportProgressBar label="Uploading agreement…" percent={uploadPercent} />
        </div>
      ) : null}
    </div>
  );
}
