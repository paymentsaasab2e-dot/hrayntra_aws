'use client';

import React, { useCallback, useId, useRef, useState } from 'react';
import { CheckCircle, FileText, Loader2, Paperclip, X } from 'lucide-react';
import { toast } from 'sonner';
import { buildFileHref } from '../../utils/cloudinaryUrls';
import { formatDateDMY } from '../../utils/dateDisplay';
import type { EntityFile } from '../../lib/api';
import { apiParseKycDocument } from '../../lib/api';
import {
  isKycParseableFile,
  KYC_FILE_ACCEPT,
} from '../../lib/kycDocuments';
import {
  emptyPostServiceKycForm,
  mergeExtractedPostServiceKycForm,
  postServiceKycFormFromParseResponse,
  type PostServiceKycFormValues,
} from '../../lib/clientKycForm';
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
  label?: string;
  description?: string;
  /** When set, PDF/DOC/DOCX/XLS/XLSX text is parsed and merged into the KYC form. */
  onFormExtracted?: (values: PostServiceKycFormValues) => void;
  currentForm?: PostServiceKycFormValues;
  isExtracting?: boolean;
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
  label = 'KYC Documents',
  description = 'Upload identity or compliance documents (PDF, DOC, DOCX, XLS, XLSX, JPG, PNG). Up to 10MB each. Filled KYC forms auto-fill fields below.',
  onFormExtracted,
  currentForm,
  isExtracting: isExtractingProp,
}: KycDocumentsFieldProps) {
  const inputId = useId();
  const [isExtractingLocal, setIsExtractingLocal] = useState(false);
  const extractAbortRef = useRef<AbortController | null>(null);
  const isExtracting = isExtractingProp ?? isExtractingLocal;

  const runExtract = useCallback(
    async (file: File) => {
      if (!onFormExtracted || !isKycParseableFile(file)) return;

      extractAbortRef.current?.abort();
      const controller = new AbortController();
      extractAbortRef.current = controller;

      setIsExtractingLocal(true);
      try {
        const data = await apiParseKycDocument(file, { signal: controller.signal });
        if (data?.message && (data.filledCount ?? 0) === 0) {
          toast.info(data.message);
          return;
        }

        const parsed = postServiceKycFormFromParseResponse(data?.form);
        const merged = mergeExtractedPostServiceKycForm(
          currentForm ?? emptyPostServiceKycForm(),
          parsed,
        );
        onFormExtracted(merged);

        const filled = data?.filledCount ?? 0;
        const total = data?.totalExtractable;
        if (filled > 0) {
          toast.success(
            total != null
              ? `Filled ${filled} of ${total} KYC fields from the document`
              : `Filled ${filled} KYC field${filled === 1 ? '' : 's'} from the document`,
          );
        } else {
          toast.info('Document added. Could not detect KYC fields automatically — enter them manually.');
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        const message = err instanceof Error ? err.message : 'Could not read KYC document';
        toast.error(message);
      } finally {
        if (extractAbortRef.current === controller) {
          setIsExtractingLocal(false);
        }
      }
    },
    [currentForm, onFormExtracted],
  );

  const handleFilesSelected = useCallback(
    (files: FileList | File[]) => {
      const list = Array.isArray(files) ? files : Array.from(files);
      const next = [...pendingFiles];
      for (const file of list) {
        if (!next.some((f) => f.name === file.name && f.size === file.size)) {
          next.push(file);
        }
      }
      onPendingFilesChange(next);

      const parseable = list.find(isKycParseableFile);
      if (parseable) {
        void runExtract(parseable);
      }
    },
    [onPendingFilesChange, pendingFiles, runExtract],
  );

  return (
    <div>
      <label
        htmlFor={inputId}
        className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1"
      >
        {label}
      </label>
      <p className="text-xs text-slate-500 mb-2">{description}</p>

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
                    disabled={disabled || uploading || isExtracting}
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
              <span className="shrink-0 text-xs text-emerald-700">
                {isExtracting && isKycParseableFile(file) ? 'Reading document…' : 'Ready to upload'}
              </span>
              <button
                type="button"
                onClick={() => {
                  extractAbortRef.current?.abort();
                  onPendingFilesChange(pendingFiles.filter((_, i) => i !== index));
                }}
                disabled={disabled || uploading || isExtracting}
                className="shrink-0 rounded-lg p-1 text-red-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                aria-label={`Remove ${file.name}`}
              >
                <X size={16} strokeWidth={2.25} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {isExtracting ? (
        <div className="mb-2 flex items-center gap-2 text-xs text-slate-500">
          <Loader2 size={14} className="animate-spin text-blue-500" />
          Extracting KYC fields from document…
        </div>
      ) : null}

      <DocumentUploadButton
        disabled={disabled || isExtracting}
        isUploading={Boolean(uploading)}
        uploadSuccess={uploadSuccess}
        uploadPercent={uploadPercent}
        accept={KYC_FILE_ACCEPT}
        multiple
        variant="secondary"
        label="Upload KYC documents"
        uploadingLabel="Uploading"
        onFilesSelected={handleFilesSelected}
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
