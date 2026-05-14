'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Upload,
  Download,
  ChevronRight,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { apiImportLeads, apiPreviewLeadImport } from '../../lib/api';
import { downloadSampleCsv } from '../../utils/csv';

export interface LeadImportDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: (result: {
    total: number;
    created: number;
    updated: number;
    skipped: number;
    failed: number;
    errors: string[];
  }) => void;
}

const CRM_FIELDS = [
  { id: 'companyName', label: 'Company Name', required: false },
  { id: 'contactPerson', label: 'Name (contact person)', required: false },
  { id: 'directorName', label: 'Director Name', required: false },
  { id: 'directorSalutation', label: 'Salutation (Mr, Ms, Dr…)', required: false },
  { id: 'email', label: 'Email', required: false },
  { id: 'phone', label: 'Phone', required: false },
  { id: 'type', label: 'Lead Type', required: false },
  { id: 'source', label: 'Source', required: false },
  { id: 'status', label: 'Status', required: false },
  { id: 'priority', label: 'Interest Level', required: false },
  { id: 'industry', label: 'Sector / Industry', required: false },
  { id: 'companySize', label: 'Team Name', required: false },
  { id: 'website', label: 'Website / Company Link', required: false },
  { id: 'linkedIn', label: 'LinkedIn', required: false },
  { id: 'location', label: 'Location', required: false },
  { id: 'city', label: 'City', required: false },
  { id: 'country', label: 'Country', required: false },
  { id: 'designation', label: 'Designation', required: false },
  { id: 'interestedNeeds', label: 'Services Needed', required: false },
  { id: 'campaignName', label: 'Campaign Name', required: false },
  { id: 'nextFollowUpDue', label: 'Next Follow-up Date', required: false },
  { id: 'expectedBusinessValue', label: 'Expected Business Value', required: false },
  { id: 'notes', label: 'Notes', required: false },
];

const DUPLICATE_OPTIONS = [
  { id: 'skip', label: 'Skip duplicates' },
  { id: 'update', label: 'Update existing' },
  { id: 'create', label: 'Create anyway' },
];

export function LeadImportDrawer({
  isOpen,
  onClose,
  onImportComplete,
}: LeadImportDrawerProps) {
  const [step, setStep] = useState(1);
  const [fileName, setFileName] = useState('');
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>(
    CRM_FIELDS.reduce((acc, f) => ({ ...acc, [f.id]: '' }), {})
  );
  const [duplicateRule, setDuplicateRule] = useState('skip');
  const [validationErrors] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<Record<string, string | number | boolean | null>[]>([]);
  const [importRows, setImportRows] = useState<Record<string, string | number | boolean | null>[]>([]);
  const [fileColumns, setFileColumns] = useState<string[]>([]);
  const [columnStats, setColumnStats] = useState<Record<string, number>>({});
  const [sheetName, setSheetName] = useState('');
  const [totalRows, setTotalRows] = useState(0);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [parseError, setParseError] = useState('');

  /** File was read successfully — blue-tinted cards and dropzone for clear contrast on white. */
  const hasParsedFile =
    Boolean(fileName) &&
    !parseError &&
    !isParsing &&
    (Boolean(sheetName) || fileColumns.length > 0 || totalRows > 0);

  const reset = () => {
    setStep(1);
    setFileName('');
    setColumnMapping(CRM_FIELDS.reduce((acc, f) => ({ ...acc, [f.id]: '' }), {}));
    setDuplicateRule('skip');
    setPreviewRows([]);
    setImportRows([]);
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

  /**
   * Sample CSV uses the same field ids the parser maps so users can fill rows
   * and re-upload without manual mapping.
   */
  const handleDownloadSample = () => {
    downloadSampleCsv('leads-import-sample.csv', CRM_FIELDS, {
      sample: {
        companyName: 'Acme Corporation',
        contactPerson: 'Jane Doe',
        directorName: 'John Smith',
        email: 'jane.doe@acme.com',
        phone: '+1 415 555 0100',
        type: 'Inbound',
        source: 'Website',
        status: 'New',
        priority: 'High',
        industry: 'Technology',
        companySize: '201-500',
        website: 'https://acme.com',
        linkedIn: 'https://linkedin.com/company/acme',
        location: 'San Francisco, CA',
        city: 'San Francisco',
        country: 'USA',
        designation: 'VP of Talent',
        interestedNeeds: 'Permanent placement',
        campaignName: 'Q4 Outreach',
        nextFollowUpDue: new Date().toISOString().slice(0, 10),
        expectedBusinessValue: '$25,000',
        notes: 'Met at conference; follow up next week.',
      },
      blankRows: 2,
    });
  };

  const handleImport = async () => {
    try {
      setIsImporting(true);
      const response = await apiImportLeads({
        rows: importRows.length > 0 ? importRows : previewRows,
        mapping: columnMapping,
        duplicateRule,
      });
      onImportComplete?.(response.data);
      handleClose();
    } catch (error: any) {
      setParseError(error.message || 'Failed to import leads');
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
      const response = await apiPreviewLeadImport(file);
      const preview = response.data;
      setSheetName(preview.sheetName);
      setFileColumns(preview.columns || []);
      setColumnStats(preview.columnStats || {});
      setPreviewRows(preview.previewRows || []);
      setImportRows(preview.rows || preview.previewRows || []);
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
      setImportRows([]);
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
        <div className="shrink-0 border-b border-slate-200 p-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Import Leads</h2>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="shrink-0 border-b border-slate-200 px-5 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {[1, 2, 3].map((s) => (
                <React.Fragment key={s}>
                  <div
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                      step === s
                        ? 'bg-blue-600 text-white'
                        : step > s
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {step > s ? <CheckCircle size={16} /> : null}
                    <span>Step {s}</span>
                  </div>
                  {s < 3 ? <ChevronRight size={16} className="shrink-0 text-slate-300" /> : null}
                </React.Fragment>
              ))}
            </div>
            <button
              type="button"
              onClick={handleDownloadSample}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800"
            >
              <Download size={16} className="text-blue-600" />
              Download template
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50/30 p-5">
          {step === 1 && (
            <div className="space-y-4">
              <div
                className={`rounded-xl border p-5 shadow-sm transition-colors ${
                  hasParsedFile
                    ? 'border-blue-300 bg-blue-50/80 ring-1 ring-blue-200/90'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Upload file</h4>
                <p className="text-sm text-slate-600 mb-4">Upload a CSV or Excel file containing your lead data.</p>
                <label
                  htmlFor="lead-import-file"
                  className={`relative flex cursor-pointer rounded-xl border-2 p-8 transition-colors ${
                    hasParsedFile
                      ? 'border-solid border-blue-500 bg-blue-100/50 hover:border-blue-600 hover:bg-blue-100/70'
                      : 'border-dashed border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-slate-50/80'
                  }`}
                >
                  <input
                    id="lead-import-file"
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    className="sr-only"
                    onChange={(e) => handleFileChange(e.target.files?.[0])}
                  />
                  <div className="flex flex-col items-center justify-center gap-2 w-full">
                    <Upload
                      size={32}
                      className={hasParsedFile ? 'text-blue-600' : 'text-slate-400'}
                    />
                    <span
                      className={`text-sm font-medium ${
                        hasParsedFile ? 'text-blue-900' : 'text-slate-600'
                      }`}
                    >
                      {fileName || 'Click or drag CSV / XLSX file'}
                    </span>
                    <span className={`text-xs ${hasParsedFile ? 'text-blue-800/90' : 'text-slate-400'}`}>
                      CSV, XLSX up to 10MB
                    </span>
                  </div>
                </label>
                {parseError ? <p className="mt-3 text-sm text-red-600">{parseError}</p> : null}
                {sheetName ? (
                  <div
                    className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
                      hasParsedFile
                        ? 'border-blue-200 bg-blue-50 text-blue-900'
                        : 'border-transparent bg-transparent text-slate-500'
                    }`}
                  >
                    Parsed sheet: <span className="font-semibold">{sheetName}</span> with{' '}
                    <span className="font-semibold">{totalRows}</span> rows
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Map columns</h4>
                <p className="text-sm text-slate-600 mb-4">The uploaded sheet columns are listed below with their suggested lead field mapping.</p>
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
                      <span className="text-sm text-slate-400">{isParsing ? 'Reading file columns...' : 'Upload a file in step 1 to see columns here.'}</span>
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
                              {String(row[column] ?? 'null')}
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
                <p className="mb-3 text-xs text-slate-500">
                  Leads in the Recycle Bin are not treated as duplicates. Re-importing after delete creates new leads unless the same email or company + contact still exists on an active lead.
                </p>
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
                  <p className="text-xs text-amber-700 mt-2">Blank Excel cells will be imported as null values.</p>
                </div>
              )}
            </div>
          )}
        </div>

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
                {isImporting ? 'Importing...' : 'Import Leads'}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
