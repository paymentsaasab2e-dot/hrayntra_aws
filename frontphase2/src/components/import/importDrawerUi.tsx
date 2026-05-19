'use client';

import React, { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { CheckCircle, Loader2, Upload } from 'lucide-react';

export function useSimulatedProgress(isActive: boolean) {
  const [percent, setPercent] = React.useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isActive) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      setPercent(0);
      return;
    }

    setPercent(5);
    intervalRef.current = setInterval(() => {
      setPercent((prev) => {
        if (prev >= 92) return prev;
        return Math.min(92, prev + 4 + Math.random() * 9);
      });
    }, 160);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [isActive]);

  const finish = () => setPercent(100);
  const reset = () => setPercent(0);

  return { percent: Math.round(percent), finish, reset };
}

export function ImportProgressBar({ label, percent }: { label: string; percent: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-4 space-y-2"
    >
      <div className="flex items-center justify-between text-xs font-medium">
        <span className="text-slate-600">{label}</span>
        <span className="tabular-nums text-blue-700">{percent}%</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-600"
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        />
      </div>
    </motion.div>
  );
}

export type ImportUploadSectionProps = {
  inputId: string;
  uploadDescription: string;
  fileName: string;
  isParsing: boolean;
  isImporting: boolean;
  fileUploaded: boolean;
  hasParsedFile: boolean;
  parseError: string;
  sheetName: string;
  totalRows: number;
  entityLabel: string;
  uploadPercent: number;
  onFileSelect: (file?: File) => void;
};

export function ImportUploadSection(props: ImportUploadSectionProps) {
  const {
    inputId,
    uploadDescription,
    fileName,
    isParsing,
    isImporting,
    fileUploaded,
    hasParsedFile,
    parseError,
    sheetName,
    totalRows,
    entityLabel,
    uploadPercent,
    onFileSelect,
  } = props;

  return (
    <motion.div
      className={`rounded-xl border p-5 shadow-sm transition-colors ${
        fileUploaded && hasParsedFile
          ? 'border-emerald-300 bg-emerald-50/50 ring-1 ring-emerald-200/90'
          : hasParsedFile
            ? 'border-blue-300 bg-blue-50/80 ring-1 ring-blue-200/90'
            : 'border-slate-200 bg-white'
      }`}
    >
      <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Upload file</h4>
      <p className="mb-4 text-sm text-slate-600">{uploadDescription}</p>
      <label
        htmlFor={inputId}
        className={`relative flex cursor-pointer rounded-xl border-2 p-8 transition-colors ${
          isParsing
            ? 'border-solid border-blue-400 bg-blue-50/80'
            : fileUploaded && hasParsedFile
              ? 'border-solid border-emerald-500 bg-emerald-50/80 hover:border-emerald-600 hover:bg-emerald-50'
              : hasParsedFile
                ? 'border-solid border-blue-500 bg-blue-100/50 hover:border-blue-600 hover:bg-blue-100/70'
                : 'border-dashed border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-slate-50/80'
        }`}
      >
        <input
          id={inputId}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="sr-only"
          disabled={isParsing || isImporting}
          onChange={(e) => {
            onFileSelect(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <div className="flex w-full flex-col items-center justify-center gap-2">
          {isParsing ? (
            <Loader2 size={36} className="animate-spin text-blue-600" />
          ) : fileUploaded && hasParsedFile ? (
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100"
            >
              <CheckCircle size={32} className="text-emerald-600" strokeWidth={2.25} />
            </motion.div>
          ) : (
            <Upload size={32} className={hasParsedFile ? 'text-blue-600' : 'text-slate-400'} />
          )}
          <span
            className={`text-sm font-medium ${
              fileUploaded && hasParsedFile
                ? 'text-emerald-900'
                : hasParsedFile
                  ? 'text-blue-900'
                  : 'text-slate-600'
            }`}
          >
            {isParsing ? 'Processing your file…' : fileName || 'Click or drag CSV / XLSX file'}
          </span>
          <span
            className={`text-xs ${
              fileUploaded && hasParsedFile
                ? 'text-emerald-800/90'
                : hasParsedFile
                  ? 'text-blue-800/90'
                  : 'text-slate-400'
            }`}
          >
            {fileUploaded && hasParsedFile
              ? 'Uploaded successfully — continue to map columns'
              : 'CSV, XLSX up to 10MB'}
          </span>
        </div>
      </label>

      {isParsing ? (
        <ImportProgressBar label="Uploading and reading file…" percent={uploadPercent} />
      ) : null}

      {parseError ? <p className="mt-3 text-sm text-red-600">{parseError}</p> : null}

      {fileUploaded && hasParsedFile && sheetName ? (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
        >
          <CheckCircle size={18} className="mt-0.5 shrink-0 text-emerald-600" />
          <div>
            <p className="font-semibold">File uploaded successfully</p>
            <p className="mt-0.5 text-emerald-800/90">
              Sheet <span className="font-medium">{sheetName}</span> —{' '}
              <span className="font-medium">{totalRows}</span> row
              {totalRows === 1 ? '' : 's'} ready to import as {entityLabel}
            </p>
          </div>
        </motion.div>
      ) : null}
    </motion.div>
  );
}

export type ImportDrawerFooterProps = {
  step: number;
  isImporting: boolean;
  importPercent: number;
  importButtonLabel: string;
  continueDisabled: boolean;
  importDisabled: boolean;
  importProgressLabel: string;
  onBack: () => void;
  onContinue: () => void;
  onImport: () => void;
};

export function ImportDrawerFooter({
  step,
  isImporting,
  importPercent,
  importButtonLabel,
  continueDisabled,
  importDisabled,
  importProgressLabel,
  onBack,
  onContinue,
  onImport,
}: ImportDrawerFooterProps) {
  return (
    <motion.div className="shrink-0 border-t border-slate-200 bg-white">
      {isImporting ? (
        <div className="border-b border-slate-100 px-5 pt-4">
          <ImportProgressBar label={importProgressLabel} percent={importPercent} />
        </div>
      ) : null}
      <div className="flex items-center justify-between p-5">
        <div>
          {step > 1 ? (
            <button
              type="button"
              onClick={onBack}
              disabled={isImporting}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Back
            </button>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          {step < 3 ? (
            <button
              type="button"
              onClick={onContinue}
              disabled={continueDisabled || isImporting}
              className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              onClick={onImport}
              disabled={importDisabled}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isImporting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Importing… {importPercent}%
                </>
              ) : (
                importButtonLabel
              )}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function formatImportSuccessToast(
  entityName: string,
  result: { created?: number; updated?: number; skipped?: number; failed?: number; imported?: number }
) {
  const parts: string[] = [];
  if (result.imported != null && result.imported > 0) parts.push(`${result.imported} imported`);
  if ((result.created ?? 0) > 0) parts.push(`${result.created} created`);
  if ((result.updated ?? 0) > 0) parts.push(`${result.updated} updated`);
  if ((result.skipped ?? 0) > 0) parts.push(`${result.skipped} skipped`);
  if ((result.failed ?? 0) > 0) parts.push(`${result.failed} failed`);

  return parts.length > 0
    ? `${entityName} imported successfully (${parts.join(', ')})`
    : `${entityName} imported successfully`;
}

export function formatUploadSuccessToast(rowCount: number) {
  return rowCount > 0
    ? `File uploaded successfully (${rowCount} row${rowCount === 1 ? '' : 's'} found)`
    : 'File uploaded successfully';
}
