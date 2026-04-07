'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Upload,
  ChevronRight,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { apiImportClients, apiPreviewClientImport } from '../../lib/api';

export interface ClientImportDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: () => void;
}

const CRM_FIELDS = [
  { id: 'name', label: 'Company Name', required: true },
  { id: 'industry', label: 'Industry', required: false },
  { id: 'location', label: 'Location', required: false },
  { id: 'city', label: 'City', required: false },
  { id: 'country', label: 'Country', required: false },
  { id: 'contactPerson', label: 'Contact Person', required: false },
  { id: 'email', label: 'Email', required: false },
  { id: 'phone', label: 'Phone', required: false },
  { id: 'companySize', label: 'Team Name', required: false },
  { id: 'servicesNeeded', label: 'Services Needed', required: false },
  { id: 'leadStatus', label: 'Status', required: false },
  { id: 'priority', label: 'Interest Level', required: false },
  { id: 'expectedBusinessValue', label: 'Expected Business Value', required: false },
  { id: 'nextFollowUpDue', label: 'Next Follow-up Date', required: false },
  { id: 'notes', label: 'Notes', required: false },
];

const DUPLICATE_OPTIONS = [
  { id: 'skip', label: 'Skip duplicates' },
  { id: 'update', label: 'Update existing' },
  { id: 'create', label: 'Create anyway' },
];

export function ClientImportDrawer({
  isOpen,
  onClose,
  onImportComplete,
}: ClientImportDrawerProps) {
  const [step, setStep] = useState(1);
  const [fileName, setFileName] = useState('');
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>(
    CRM_FIELDS.reduce((acc, f) => ({ ...acc, [f.id]: '' }), {})
  );
  const [duplicateRule, setDuplicateRule] = useState('skip');
  const [validationErrors] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<Record<string, string | number | boolean | null>[]>([]);
  const [fileColumns, setFileColumns] = useState<string[]>([]);
  const [columnStats, setColumnStats] = useState<Record<string, number>>({});
  const [sheetName, setSheetName] = useState('');
  const [totalRows, setTotalRows] = useState(0);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [parseError, setParseError] = useState('');

  const reset = () => {
    setStep(1);
    setFileName('');
    setColumnMapping(CRM_FIELDS.reduce((acc, f) => ({ ...acc, [f.id]: '' }), {}));
    setDuplicateRule('skip');
    setPreviewRows([]);
    setFileColumns([]);
    setColumnStats({});
    setSheetName('');
    setTotalRows(0);
    setIsParsing(false);
    setIsImporting(false);
    setParseError('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleImport = async () => {
    try {
      setIsImporting(true);
      await apiImportClients({
        rows: previewRows,
        mapping: columnMapping,
        duplicateRule,
      });
      onImportComplete?.();
      handleClose();
    } catch (error: any) {
      setParseError(error.message || 'Failed to import clients');
    } finally {
      setIsImporting(false);
    }
  };

  const handleFileChange = async (file?: File) => {
    if (!file) return;

    setFileName(file.name);
    setParseError('');
    setIsParsing(true);

    try {
      const response = await apiPreviewClientImport(file);
      const preview = response.data;
      setSheetName(preview.sheetName);
      setFileColumns(preview.columns || []);
      setColumnStats(preview.columnStats || {});
      setPreviewRows(preview.previewRows || []);
      setTotalRows(preview.totalRows || 0);
      setColumnMapping(
        CRM_FIELDS.reduce(
          (acc, field) => ({ ...acc, [field.id]: preview.suggestedMapping?.[field.id] || '' }),
          {}
        )
      );
    } catch (error: any) {
      setParseError(error.message || 'Failed to read the import file');
      setFileColumns([]);
      setColumnStats({});
      setPreviewRows([]);
      setTotalRows(0);
    } finally {
      setIsParsing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="import-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleClose}
        className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[2px] pointer-events-auto"
      />
      <motion.div
        key="import-panel"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed right-0 top-0 h-full w-1/2 max-w-2xl bg-white shadow-2xl z-50 pointer-events-auto border-l border-slate-200 flex flex-col"
      >
        {/* Header */}
        <div className="shrink-0 border-b border-slate-200 p-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Import Clients</h2>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Stepper */}
        <div className="shrink-0 px-5 pt-4 pb-2">
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((s) => (
              <React.Fragment key={s}>
                <div
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
                    step === s ? 'bg-blue-600 text-white' : step > s ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {step > s ? <CheckCircle size={16} /> : null}
                  <span>Step {s}</span>
                </div>
                {s < 3 && <ChevronRight size={16} className="text-slate-300" />}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Content — same card-based layout as client drawer tabs */}
        <div className="flex-1 overflow-y-auto bg-slate-50/30 p-5">
          {step === 1 && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Upload file</h4>
                <p className="text-sm text-slate-600 mb-4">Upload a CSV or Excel file containing your client data.</p>
                <label className="relative flex rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-8 cursor-pointer hover:border-slate-300 hover:bg-slate-50/80 transition-colors">
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    className="sr-only"
                    onChange={(e) => handleFileChange(e.target.files?.[0])}
                  />
                  <div className="flex flex-col items-center justify-center gap-2 w-full">
                    <Upload size={32} className="text-slate-400" />
                    <span className="text-sm font-medium text-slate-600">
                      {fileName || 'Click or drag CSV / XLSX file'}
                    </span>
                    <span className="text-xs text-slate-400">CSV, XLSX up to 10MB</span>
                  </div>
                </label>
                {parseError ? <p className="mt-3 text-sm text-red-600">{parseError}</p> : null}
                {sheetName ? (
                  <p className="mt-3 text-sm text-slate-500">
                    Parsed sheet: <span className="font-medium text-slate-700">{sheetName}</span> with{' '}
                    <span className="font-medium text-slate-700">{totalRows}</span> rows
                  </p>
                ) : null}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Map columns</h4>
                <p className="text-sm text-slate-600 mb-4">AI extracted the uploaded sheet columns below and suggested the CRM field match for each one.</p>
                <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Detected columns</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {fileColumns.length > 0 ? (
                      fileColumns.map((column) => (
                        <span key={column} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                          {column}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-slate-400">{isParsing ? 'Reading file columns…' : 'Upload a file in step 1 to see columns here.'}</span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {fileColumns.length > 0 ? (
                    fileColumns.map((column) => {
                      const matchedField = CRM_FIELDS.find((field) => columnMapping[field.id] === column);
                      return (
                        <div key={column} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Excel Column</p>
                          <p className="mt-2 text-sm font-semibold text-slate-900">{column}</p>
                          <p className="mt-3 text-xs font-bold uppercase tracking-wider text-slate-400">Total Data</p>
                          <p className="mt-2 text-sm text-slate-700">{columnStats[column] ?? 0} values</p>
                          {matchedField ? (
                            <>
                              <p className="mt-3 text-xs font-bold uppercase tracking-wider text-slate-400">Mapped To</p>
                              <p className="mt-2 text-sm text-slate-700">{matchedField.label}</p>
                            </>
                          ) : null}
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-400">
                      Upload a file in step 1 to see the extracted Excel columns here.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Preview</h4>
                  <p className="text-xs text-slate-500 mt-0.5">First rows from your uploaded file</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        {fileColumns.map((column) => (
                          <th key={column} className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase">{column}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {previewRows.map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50/80">
                          {fileColumns.map((column) => (
                            <td key={`${i}-${column}`} className="px-4 py-3 text-slate-600">
                              {String(row[column] ?? '—')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Duplicate handling</h4>
                <div className="space-y-2">
                  {DUPLICATE_OPTIONS.map((opt) => (
                    <label key={opt.id} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="duplicate-rule"
                        checked={duplicateRule === opt.id}
                        onChange={() => setDuplicateRule(opt.id)}
                        className="text-blue-600 focus:ring-blue-500/20"
                      />
                      <span className="text-sm font-medium text-slate-700">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {validationErrors.length > 0 && (
                <div className="bg-amber-50 rounded-xl border border-amber-200 shadow-sm p-5">
                  <h4 className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <AlertCircle size={14} /> Validation errors
                  </h4>
                  <ul className="space-y-1 text-sm text-amber-800">
                    {validationErrors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                  <p className="text-xs text-amber-700 mt-2">Fix in file or import anyway; invalid rows will be skipped.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer — Back | Continue / Import */}
        <div className="shrink-0 border-t border-slate-200 p-5 flex items-center justify-between bg-white">
          <div>
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-2"
              >
                Back
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                disabled={(step === 1 && (!fileName || isParsing || !!parseError)) || (step === 2 && fileColumns.length === 0)}
                className="px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            ) : (
              <button
                type="button"
                onClick={handleImport}
                disabled={isImporting || previewRows.length === 0}
                className="px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isImporting ? 'Importing…' : 'Import'}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
