'use client';

import React, { useCallback, useRef, useState } from 'react';
import { CheckCircle, Loader2, Paperclip, X } from 'lucide-react';
import { toast } from 'sonner';
import { DocumentUploadButton } from '../import/documentUploadUi';
import { ImportProgressBar } from '../import/importDrawerUi';
import { apiParseAgreementDocument } from '../../lib/api';
import {
  agreementTermsFromRecord,
  filledAgreementTermKeys,
  type AgreementTermsFormValues,
} from '../../lib/agreementTerms';

const DEFAULT_ACCEPT =
  'application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.pdf,.doc,.docx';

const EXTRACT_HINT =
  'Upload a PDF or Word agreement. Level, service charge, dates, payment terms, advance, and replacement fill in automatically.';

export type AgreementDocumentUploadProps = {
  description?: string;
  pendingFile: File | null;
  onPendingFileChange: (file: File | null) => void;
  /** When set, PDF/DOC/DOCX text is parsed and non-empty fields are merged into the form. */
  onTermsExtracted?: (values: AgreementTermsFormValues) => void;
  currentTerms?: AgreementTermsFormValues;
  isUploading?: boolean;
  isExtracting?: boolean;
  uploadSuccess?: boolean;
  uploadPercent?: number;
  disabled?: boolean;
  accept?: string;
};

export function AgreementDocumentUpload({
  description,
  pendingFile,
  onPendingFileChange,
  onTermsExtracted,
  isUploading = false,
  isExtracting: isExtractingProp,
  uploadSuccess = false,
  uploadPercent = 0,
  disabled,
  accept = DEFAULT_ACCEPT,
}: AgreementDocumentUploadProps) {
  const [isExtractingLocal, setIsExtractingLocal] = useState(false);
  const extractAbortRef = useRef<AbortController | null>(null);

  const isExtracting = isExtractingProp ?? isExtractingLocal;

  const runExtract = useCallback(
    async (file: File) => {
      if (!onTermsExtracted) return;

      extractAbortRef.current?.abort();
      const controller = new AbortController();
      extractAbortRef.current = controller;

      setIsExtractingLocal(true);
      try {
        const data = await apiParseAgreementDocument(file, { signal: controller.signal });
        const rawTerms =
          data && typeof data === 'object' && 'terms' in data && data.terms
            ? data.terms
            : data;
        const parsed = agreementTermsFromRecord(rawTerms as Parameters<typeof agreementTermsFromRecord>[0]);
        onTermsExtracted(parsed);

        const filledKeys = filledAgreementTermKeys(parsed);
        const filled = data?.filledCount ?? filledKeys.length;
        if (filled > 0) {
          toast.success(
            `Filled ${filled} field${filled === 1 ? '' : 's'} from the agreement document`,
          );
        } else {
          toast.info('Document added. Could not detect terms automatically — enter them manually.');
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        const message = err instanceof Error ? err.message : 'Could not read agreement document';
        toast.error(message);
      } finally {
        if (extractAbortRef.current === controller) {
          setIsExtractingLocal(false);
        }
      }
    },
    [onTermsExtracted],
  );

  const handleFilesSelected = useCallback(
    (files: FileList | File[]) => {
      const list = Array.isArray(files) ? files : Array.from(files || []);
      const file = list[0] ?? null;
      onPendingFileChange(file);
      if (file) {
        void runExtract(file);
      } else {
        extractAbortRef.current?.abort();
        setIsExtractingLocal(false);
      }
    },
    [onPendingFileChange, runExtract],
  );

  return (
    <div>
      <p className="mb-2 text-xs text-slate-500">{description?.trim() || EXTRACT_HINT}</p>
      {pendingFile ? (
        <div className="mb-2 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <CheckCircle size={14} className="shrink-0 text-emerald-600" />
          <Paperclip size={14} className="shrink-0 text-emerald-600" />
          <span className="min-w-0 flex-1 truncate">{pendingFile.name}</span>
          <button
            type="button"
            onClick={() => handleFilesSelected([])}
            disabled={disabled || isUploading || isExtracting}
            className="shrink-0 rounded-lg p-1 text-red-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
            aria-label="Remove file"
          >
            <X size={16} strokeWidth={2.25} />
          </button>
        </div>
      ) : null}
      {isExtracting ? (
        <div className="mb-2 flex items-center gap-2 text-xs font-medium text-blue-700">
          <Loader2 size={14} className="animate-spin text-blue-500" />
          Extracting terms and filling the form…
        </div>
      ) : null}
      <DocumentUploadButton
        variant="secondary"
        label={pendingFile ? 'Replace file' : 'Upload agreement'}
        isUploading={isUploading}
        uploadSuccess={uploadSuccess && !pendingFile}
        uploadPercent={uploadPercent}
        accept={accept}
        disabled={disabled || isExtracting}
        onFilesSelected={handleFilesSelected}
      />
      {isUploading ? (
        <div className="mt-2">
          <ImportProgressBar label="Uploading agreement…" percent={uploadPercent} />
        </div>
      ) : null}
    </div>
  );
}
