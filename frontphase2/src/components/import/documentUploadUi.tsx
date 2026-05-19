'use client';

import React, { useId, useRef } from 'react';
import { motion } from 'motion/react';
import { CheckCircle, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { ImportProgressBar, useSimulatedProgress } from './importDrawerUi';

export function formatDocumentUploadSuccessToast(fileName?: string) {
  return fileName ? `"${fileName}" uploaded successfully` : 'Document uploaded successfully';
}

export function useDocumentUploadFeedback(isUploading: boolean) {
  const [uploadSuccess, setUploadSuccess] = React.useState(false);
  const progress = useSimulatedProgress(isUploading);

  const markSuccess = React.useCallback(
    (fileName?: string) => {
      progress.finish();
      setUploadSuccess(true);
      toast.success(formatDocumentUploadSuccessToast(fileName));
      window.setTimeout(() => setUploadSuccess(false), 2800);
    },
    [progress]
  );

  const markError = React.useCallback(
    (message: string) => {
      progress.reset();
      setUploadSuccess(false);
      toast.error(message);
    },
    [progress]
  );

  const reset = React.useCallback(() => {
    progress.reset();
    setUploadSuccess(false);
  }, [progress]);

  return {
    uploadSuccess,
    uploadPercent: progress.percent,
    markSuccess,
    markError,
    reset,
  };
}

export type DocumentUploadButtonProps = {
  disabled?: boolean;
  isUploading: boolean;
  uploadSuccess?: boolean;
  uploadPercent?: number;
  accept?: string;
  multiple?: boolean;
  label?: string;
  uploadingLabel?: string;
  variant?: 'primary' | 'secondary';
  className?: string;
  onFilesSelected: (files: File[]) => void | Promise<void>;
};

export function DocumentUploadButton({
  disabled,
  isUploading,
  uploadSuccess = false,
  uploadPercent = 0,
  accept,
  multiple,
  label = 'Upload File',
  uploadingLabel = 'Uploading',
  variant = 'primary',
  className = '',
  onFilesSelected,
}: DocumentUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const baseBtn =
    variant === 'primary'
      ? 'inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60'
      : 'inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-60';

  return (
    <div className={`space-y-2 ${className}`}>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={accept}
        multiple={multiple}
        disabled={disabled || isUploading}
        onChange={async (e) => {
          const files = Array.from(e.target.files || []);
          if (!files.length) return;
          await onFilesSelected(files);
          e.target.value = '';
        }}
      />
      <button
        type="button"
        disabled={disabled || isUploading}
        onClick={() => inputRef.current?.click()}
        className={baseBtn}
      >
        {isUploading ? (
          <Loader2 size={16} className="animate-spin shrink-0" />
        ) : uploadSuccess ? (
          <CheckCircle size={16} className="shrink-0 text-emerald-500" strokeWidth={2.25} />
        ) : (
          <Upload size={16} className={variant === 'secondary' ? 'text-slate-500 shrink-0' : 'shrink-0'} />
        )}
        {isUploading
          ? `${uploadingLabel}… ${uploadPercent}%`
          : uploadSuccess
            ? 'Uploaded'
            : label}
      </button>
      {isUploading ? (
        <ImportProgressBar label="Uploading document…" percent={uploadPercent} />
      ) : null}
      {uploadSuccess && !isUploading ? (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
        >
          <CheckCircle size={16} className="shrink-0 text-emerald-600" />
          <span className="font-medium">Upload complete</span>
        </motion.div>
      ) : null}
    </div>
  );
}

export type DocumentUploadDropzoneProps = {
  inputId?: string;
  disabled?: boolean;
  isUploading?: boolean;
  uploadSuccess?: boolean;
  uploadPercent?: number;
  selectedFileName?: string;
  placeholder?: string;
  hint?: string;
  accept?: string;
  className?: string;
  onFileSelect: (file: File) => void;
};

export function DocumentUploadDropzone({
  inputId: inputIdProp,
  disabled,
  isUploading = false,
  uploadSuccess = false,
  uploadPercent = 0,
  selectedFileName,
  placeholder = 'Click or drag to upload',
  hint,
  accept,
  className = '',
  onFileSelect,
}: DocumentUploadDropzoneProps) {
  const autoId = useId();
  const inputId = inputIdProp || autoId;
  const showSuccess = uploadSuccess || Boolean(selectedFileName && !isUploading);

  return (
    <div className={`space-y-2 ${className}`}>
      <label
        htmlFor={inputId}
        className={`relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 p-6 text-center transition-colors ${
          isUploading
            ? 'border-solid border-blue-400 bg-blue-50/80'
            : showSuccess
              ? 'border-solid border-emerald-500 bg-emerald-50/80 hover:border-emerald-600'
              : 'border-dashed border-slate-300 bg-slate-50/80 hover:border-blue-400 hover:bg-blue-50/40'
        }`}
      >
        <input
          id={inputId}
          type="file"
          className="sr-only"
          accept={accept}
          disabled={disabled || isUploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFileSelect(file);
            e.target.value = '';
          }}
        />
        {isUploading ? (
          <Loader2 size={28} className="animate-spin text-blue-600" />
        ) : showSuccess ? (
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100"
          >
            <CheckCircle size={26} className="text-emerald-600" strokeWidth={2.25} />
          </motion.div>
        ) : (
          <Upload size={24} className="text-slate-400" />
        )}
        <span
          className={`text-sm font-medium ${
            showSuccess ? 'text-emerald-900' : isUploading ? 'text-blue-900' : 'text-slate-600'
          }`}
        >
          {isUploading ? 'Uploading document…' : selectedFileName || placeholder}
        </span>
        {hint ? (
          <span className={`text-xs ${showSuccess ? 'text-emerald-800/90' : 'text-slate-400'}`}>{hint}</span>
        ) : null}
      </label>
      {isUploading ? <ImportProgressBar label="Uploading document…" percent={uploadPercent} /> : null}
    </div>
  );
}

