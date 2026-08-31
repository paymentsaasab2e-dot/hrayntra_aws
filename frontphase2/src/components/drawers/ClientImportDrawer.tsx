'use client';

import React, { useState } from 'react';
import { usePageDrawerLifecycle } from '../../lib/pageDrawerEvents';
import { motion, AnimatePresence } from 'motion/react';
import { X, Download, ChevronRight, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  apiCheckClientImportDuplicates,
  apiImportClients,
  apiPreviewClientImport,
  type ClientImportDuplicateCheckResult,
  type ClientImportDuplicateField,
  type ClientImportDuplicateRecord,
} from '../../lib/api';
import { downloadSampleCsv } from '../../utils/csv';
import {
  formatImportSuccessToast,
  formatUploadSuccessToast,
  ImportDrawerFooter,
  ImportUploadSection,
  useSimulatedProgress,
} from '../import/importDrawerUi';

export interface ClientImportDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  /** When true, imported clients appear on Recruitment Clients (`/client?scope=recruitment`). */
  recruitmentEnabled?: boolean;
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

const FALLBACK_DUPLICATE_COMPARE_FIELDS: ClientImportDuplicateField[] = [
  { key: 'companyName', label: 'Company Name' },
  { key: 'industry', label: 'Industry' },
  { key: 'location', label: 'Location' },
  { key: 'city', label: 'City' },
  { key: 'country', label: 'Country' },
  { key: 'contactPerson', label: 'Contact Person' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'companySize', label: 'Team Name' },
  { key: 'servicesNeeded', label: 'Services Needed' },
  { key: 'leadStatus', label: 'Status' },
  { key: 'priority', label: 'Priority' },
  { key: 'expectedBusinessValue', label: 'Expected Business Value' },
  { key: 'notes', label: 'Notes' },
];

export function ClientImportDrawer({
  isOpen,
  onClose,
  onImportComplete,
  recruitmentEnabled = false,
}: ClientImportDrawerProps) {
  usePageDrawerLifecycle(isOpen);
  const [step, setStep] = useState(1);
  const [fileName, setFileName] = useState('');
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>(
    CRM_FIELDS.reduce((acc, f) => ({ ...acc, [f.id]: '' }), {})
  );
  const [validationErrors] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<Record<string, string | number | boolean | null>[]>([]);
  const [importRows, setImportRows] = useState<Record<string, string | number | boolean | null>[]>([]);
  const [fileColumns, setFileColumns] = useState<string[]>([]);
  const [columnStats, setColumnStats] = useState<Record<string, number>>({});
  const [sheetName, setSheetName] = useState('');
  const [totalRows, setTotalRows] = useState(0);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [parseError, setParseError] = useState('');
  const [fileUploaded, setFileUploaded] = useState(false);
  const [duplicateCheckResult, setDuplicateCheckResult] = useState<ClientImportDuplicateCheckResult | null>(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);

  const uploadProgress = useSimulatedProgress(isParsing);
  const importProgress = useSimulatedProgress(isImporting);

  const hasParsedFile =
    Boolean(fileName) &&
    !parseError &&
    !isParsing &&
    (Boolean(sheetName) || fileColumns.length > 0 || totalRows > 0);

  const reset = () => {
    setStep(1);
    setFileName('');
    setColumnMapping(CRM_FIELDS.reduce((acc, f) => ({ ...acc, [f.id]: '' }), {}));
    setPreviewRows([]);
    setImportRows([]);
    setFileColumns([]);
    setColumnStats({});
    setSheetName('');
    setTotalRows(0);
    setIsParsing(false);
    setIsImporting(false);
    setIsCheckingDuplicates(false);
    setParseError('');
    setFileUploaded(false);
    setDuplicateCheckResult(null);
    setShowDuplicateModal(false);
    uploadProgress.reset();
    importProgress.reset();
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleDownloadSample = () => {
    downloadSampleCsv('clients-import-sample.csv', CRM_FIELDS, {
      sample: {
        name: 'Acme Corporation',
        industry: 'Technology',
        location: 'San Francisco, CA',
        city: 'San Francisco',
        country: 'USA',
        contactPerson: 'Jane Doe',
        email: 'jane.doe@acme.com',
        phone: '+1 415 555 0100',
        companySize: '201-500',
        servicesNeeded: 'Permanent placement; Contract',
        leadStatus: 'Active',
        priority: 'High',
        expectedBusinessValue: '$25000',
        nextFollowUpDue: new Date().toISOString().slice(0, 10),
        notes: 'Met at conference – follow up in two weeks.',
      },
      blankRows: 2,
    });
  };

  const runDuplicateCheck = async () => {
    try {
      setIsCheckingDuplicates(true);
      const response = await apiCheckClientImportDuplicates({
        rows: importRows.length > 0 ? importRows : previewRows,
        mapping: columnMapping,
      });
      const result = response.data;
      setDuplicateCheckResult(result);
      if ((result?.duplicateCount ?? 0) > 0) {
        setShowDuplicateModal(true);
      }
      return result;
    } catch (error: any) {
      toast.error(error.message || 'Failed to compare imported clients');
      setParseError(error.message || 'Failed to compare imported clients');
      return null;
    } finally {
      setIsCheckingDuplicates(false);
    }
  };

  const handleImport = async (duplicateRule: 'create' | 'update') => {
    try {
      setParseError('');
      setIsImporting(true);
      importProgress.reset();
      setShowDuplicateModal(false);

      const response = await apiImportClients({
        rows: importRows.length > 0 ? importRows : previewRows,
        mapping: columnMapping,
        duplicateRule,
        recruitmentEnabled: recruitmentEnabled || undefined,
      });

      importProgress.finish();
      const result = response.data;
      const created = result?.created ?? 0;
      const updated = result?.updated ?? 0;
      const failed = result?.failed ?? 0;
      const total = result?.total ?? (importRows.length > 0 ? importRows.length : previewRows.length);
      if (created === 0 && updated === 0) {
        toast.error(
          failed
            ? `No clients appeared on the list (${failed} of ${total} rows failed)`
            : 'No clients were created. Check the file and try again.',
        );
      } else {
        toast.success(
          `${formatImportSuccessToast('Clients', result)} from ${total} Excel row${total === 1 ? '' : 's'}`,
        );
      }
      if (Array.isArray(result?.errors) && result.errors.length) {
        toast.error(result.errors.slice(0, 3).join('\n'));
      }
      onImportComplete?.(result);
      await new Promise((r) => setTimeout(r, 400));
      handleClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to import clients');
      setParseError(error.message || 'Failed to import clients');
      importProgress.reset();
    } finally {
      setIsImporting(false);
    }
  };

  const handleContinue = () => {
    if (step === 1) {
      setStep(2);
      return;
    }
    if (step === 2) {
      setStep(3);
      void runDuplicateCheck();
    }
  };

  const handleImportClick = () => {
    const duplicateCount = duplicateCheckResult?.duplicateCount ?? 0;
    if (duplicateCount > 0) {
      setShowDuplicateModal(true);
      return;
    }
    void handleImport('create');
  };

  const handleFileChange = async (file?: File) => {
    if (!file) return;

    setFileName(file.name);
    setParseError('');
    setFileUploaded(false);
    setIsParsing(true);
    uploadProgress.reset();

    try {
      const response = await apiPreviewClientImport(file);
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

      uploadProgress.finish();
      setFileUploaded(true);
      toast.success(formatUploadSuccessToast(preview.totalRows || 0));
    } catch (error: any) {
      setFileUploaded(false);
      uploadProgress.reset();
      toast.error(error.message || 'Failed to read the import file');
      setParseError(error.message || 'Failed to read the import file');
      setFileColumns([]);
      setColumnStats({});
      setPreviewRows([]);
      setImportRows([]);
      setTotalRows(0);
      setSheetName('');
      setDuplicateCheckResult(null);
      setShowDuplicateModal(false);
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
        className="fixed right-0 top-0 h-full w-3/4 max-w-6xl bg-white shadow-2xl z-50 pointer-events-auto border-l border-slate-200 flex flex-col"
      >
        <motion.div className="shrink-0 border-b border-slate-200 p-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Import Clients</h2>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </motion.div>

        <motion.div className="shrink-0 border-b border-slate-200 px-5 py-3">
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
        </motion.div>

        <div className="flex-1 overflow-y-auto bg-slate-50/30 p-5">
          {step === 1 && (
            <motion.div className="space-y-4">
              <ImportUploadSection
                inputId="client-import-file"
                uploadDescription="Upload a CSV or Excel file containing your client data."
                fileName={fileName}
                isParsing={isParsing}
                isImporting={isImporting}
                fileUploaded={fileUploaded}
                hasParsedFile={hasParsedFile}
                parseError={parseError}
                sheetName={sheetName}
                totalRows={totalRows}
                entityLabel="clients"
                uploadPercent={uploadProgress.percent}
                onFileSelect={handleFileChange}
              />
            </motion.div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Map columns</h4>
                <p className="text-sm text-slate-600 mb-4">AI extracted the uploaded sheet columns below and suggested the CRM field match for each one.</p>
                <p className="mb-4 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
                  Any Excel columns you do not map to the standard client fields will be saved as dynamic fields and shown in the client drawer. You can also choose those dynamic fields as extra table columns on the Clients page.
                </p>
                <motion.div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
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
                </motion.div>
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
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Duplicate review</h4>
                {isCheckingDuplicates ? (
                  <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                    <Loader2 size={16} className="animate-spin" />
                    Comparing imported clients with existing CRM clients...
                  </div>
                ) : (duplicateCheckResult?.duplicateCount ?? 0) > 0 ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                    <p className="text-sm font-semibold text-amber-900">
                      {duplicateCheckResult?.duplicateCount} duplicate
                      {(duplicateCheckResult?.duplicateCount ?? 0) === 1 ? '' : 's'} found
                    </p>
                    <p className="mt-1 text-xs text-amber-800">
                      Review the side-by-side comparison and choose whether to create anyway or replace existing clients.
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowDuplicateModal(true)}
                      className="mt-3 rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100"
                    >
                      Review duplicates
                    </button>
                  </div>
                ) : (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                    <p className="text-sm font-semibold text-emerald-900">No duplicates found</p>
                    <p className="mt-1 text-xs text-emerald-800">
                      The uploaded clients are ready to import as new records.
                    </p>
                  </div>
                )}
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

        <ImportDrawerFooter
          step={step}
          isImporting={isImporting}
          importPercent={importProgress.percent}
          importButtonLabel="Import Clients"
          importProgressLabel="Importing clients into CRM…"
          continueDisabled={
            isCheckingDuplicates ||
            (step === 1 && (!fileName || isParsing || !!parseError || !fileUploaded)) ||
            (step === 2 && fileColumns.length === 0)
          }
          importDisabled={isImporting || isCheckingDuplicates || previewRows.length === 0}
          onBack={() => setStep((s) => s - 1)}
          onContinue={handleContinue}
          onImport={handleImportClick}
        />

        <AnimatePresence>
          {showDuplicateModal ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/55 p-6"
              onClick={() => setShowDuplicateModal(false)}
            >
              <motion.div
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                className="max-h-[85vh] w-full max-w-6xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Duplicate clients found</h3>
                    <p className="mt-1 text-sm text-slate-600">
                      Compare each imported client against the existing CRM record, then choose how to continue.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDuplicateModal(false)}
                    className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    aria-label="Close duplicate review"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="max-h-[calc(85vh-148px)] overflow-y-auto px-6 py-5">
                  <div className="space-y-4">
                    {(duplicateCheckResult?.duplicates || []).map((duplicate: ClientImportDuplicateRecord) => (
                      <div key={`dup-${duplicate.rowIndex}-${duplicate.existing.id}`} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">Imported row {duplicate.rowIndex}</p>
                            <p className="text-xs text-slate-500">
                              Matched by {duplicate.matchedBy.join(', ')}
                            </p>
                          </div>
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                            Duplicate found
                          </span>
                        </div>

                        <div className="mt-4 grid gap-4 lg:grid-cols-2">
                          <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4">
                            <p className="text-xs font-bold uppercase tracking-wider text-blue-700">Imported client</p>
                            <div className="mt-3 space-y-2">
                              {(duplicateCheckResult?.compareFields || FALLBACK_DUPLICATE_COMPARE_FIELDS).map((field) => (
                                <div key={`incoming-${duplicate.rowIndex}-${field.key}`} className="grid grid-cols-[160px_minmax(0,1fr)] gap-3 text-sm">
                                  <span className="font-medium text-slate-500">{field.label}</span>
                                  <span className="break-words text-slate-900">{duplicate.imported[field.key] || '—'}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                            <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Existing client</p>
                            <div className="mt-3 space-y-2">
                              {(duplicateCheckResult?.compareFields || FALLBACK_DUPLICATE_COMPARE_FIELDS).map((field) => (
                                <div key={`existing-${duplicate.existing.id}-${field.key}`} className="grid grid-cols-[160px_minmax(0,1fr)] gap-3 text-sm">
                                  <span className="font-medium text-slate-500">{field.label}</span>
                                  <span className="break-words text-slate-900">{duplicate.existing[field.key] || '—'}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
                  <button
                    type="button"
                    onClick={() => setShowDuplicateModal(false)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleImport('create')}
                    className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-800 hover:bg-blue-100"
                  >
                    Create anyway
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleImport('update')}
                    className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    Replace existing
                  </button>
                </div>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
