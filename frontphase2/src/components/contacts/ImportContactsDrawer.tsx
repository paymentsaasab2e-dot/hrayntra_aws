'use client';

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X, Download, ChevronRight, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { apiImportContacts, apiPreviewContactImport } from '../../lib/api';
import { downloadSampleCsv } from '../../utils/csv';
import {
  formatImportSuccessToast,
  formatUploadSuccessToast,
  ImportDrawerFooter,
  ImportUploadSection,
  useSimulatedProgress,
} from '../import/importDrawerUi';

interface ImportContactsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CONTACT_FIELDS = [
  { id: 'firstName', label: 'First Name', required: true },
  { id: 'lastName', label: 'Last Name', required: true },
  { id: 'email', label: 'Email', required: false },
  { id: 'phone', label: 'Phone', required: false },
  { id: 'companyId', label: 'Company', required: false },
  { id: 'designation', label: 'Designation', required: false },
  { id: 'department', label: 'Department', required: false },
  { id: 'location', label: 'Location', required: false },
  { id: 'linkedinUrl', label: 'LinkedIn URL', required: false },
  { id: 'contactType', label: 'Contact Type', required: false },
  { id: 'status', label: 'Status', required: false },
  { id: 'ownerId', label: 'Owner', required: false },
  { id: 'avatarUrl', label: 'Avatar URL', required: false },
  { id: 'tags', label: 'Tags', required: false },
  { id: 'associatedJobIds', label: 'Associated Jobs', required: false },
  { id: 'isPrimary', label: 'Primary Contact', required: false },
  { id: 'preferredChannel', label: 'Preferred Channel', required: false },
  { id: 'notes', label: 'Notes', required: false },
];

const DUPLICATE_OPTIONS = [
  { id: 'skip', label: 'Skip duplicates' },
  { id: 'update', label: 'Update existing' },
  { id: 'create', label: 'Create anyway' },
];

export function ImportContactsDrawer({ isOpen, onClose, onSuccess }: ImportContactsDrawerProps) {
  const [step, setStep] = useState(1);
  const [fileName, setFileName] = useState('');
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>(
    CONTACT_FIELDS.reduce((acc, field) => ({ ...acc, [field.id]: '' }), {})
  );
  const [duplicateRule, setDuplicateRule] = useState('skip');
  const [previewRows, setPreviewRows] = useState<Record<string, string | number | boolean | null>[]>([]);
  const [importRows, setImportRows] = useState<Record<string, string | number | boolean | null>[]>([]);
  const [fileColumns, setFileColumns] = useState<string[]>([]);
  const [columnStats, setColumnStats] = useState<Record<string, number>>({});
  const [sheetName, setSheetName] = useState('');
  const [totalRows, setTotalRows] = useState(0);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [parseError, setParseError] = useState('');
  const [fileUploaded, setFileUploaded] = useState(false);

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
    setColumnMapping(CONTACT_FIELDS.reduce((acc, field) => ({ ...acc, [field.id]: '' }), {}));
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
    setFileUploaded(false);
    uploadProgress.reset();
    importProgress.reset();
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleDownloadTemplate = () => {
    downloadSampleCsv('contacts-import-sample.csv', CONTACT_FIELDS, {
      sample: {
        firstName: 'Sarah',
        lastName: 'Jenkins',
        email: 'sarah@example.com',
        phone: '+1 415 555 0100',
        companyId: 'Acme Corp',
        designation: 'Hiring Manager',
        department: 'HR',
        location: 'San Francisco, CA',
        linkedinUrl: 'https://linkedin.com/in/sarahjenkins',
        contactType: 'CLIENT',
        status: 'ACTIVE',
        ownerId: '',
        avatarUrl: '',
        tags: 'priority; warm',
        associatedJobIds: '',
        isPrimary: 'true',
        preferredChannel: 'Email',
        notes: 'Met at TalentCon 2026.',
      },
      blankRows: 2,
    });
  };

  const handleFileChange = async (file?: File) => {
    if (!file) return;

    setFileName(file.name);
    setParseError('');
    setFileUploaded(false);
    setIsParsing(true);
    uploadProgress.reset();

    try {
      const response = await apiPreviewContactImport(file);
      const preview = response.data;
      const rows = preview.previewRows || [];
      setSheetName(preview.sheetName || file.name);
      setFileColumns(preview.columns || []);
      setColumnStats(preview.columnStats || {});
      setPreviewRows(rows);
      setImportRows((preview as { rows?: typeof rows }).rows || rows);
      setTotalRows(preview.totalRows || 0);
      setColumnMapping(
        CONTACT_FIELDS.reduce(
          (acc, field) => ({
            ...acc,
            [field.id]: preview.suggestedMapping?.[field.id] || '',
          }),
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
    } finally {
      setIsParsing(false);
    }
  };

  const handleImport = async () => {
    const rows = importRows.length > 0 ? importRows : previewRows;
    if (rows.length === 0) return;

    setIsImporting(true);
    importProgress.reset();

    try {
      const response = await apiImportContacts({
        rows,
        mapping: columnMapping,
        duplicateRule,
      });

      importProgress.finish();
      const result = response.data;
      toast.success(formatImportSuccessToast('Contacts', result));
      onSuccess();
      await new Promise((r) => setTimeout(r, 400));
      handleClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to import contacts');
      importProgress.reset();
    } finally {
      setIsImporting(false);
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
        <div className="shrink-0 border-b border-slate-200 p-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Import Contacts</h2>
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
          <motion.div className="flex flex-wrap items-center justify-between gap-3">
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
              onClick={handleDownloadTemplate}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800"
            >
              <Download size={16} className="text-blue-600" />
              Download template
            </button>
          </motion.div>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50/30 p-5">
          {step === 1 && (
            <motion.div className="space-y-4">
              <ImportUploadSection
                inputId="contacts-import-file"
                uploadDescription="Upload a CSV or Excel file containing your contact data."
                fileName={fileName}
                isParsing={isParsing}
                isImporting={isImporting}
                fileUploaded={fileUploaded}
                hasParsedFile={hasParsedFile}
                parseError={parseError}
                sheetName={sheetName}
                totalRows={totalRows}
                entityLabel="contacts"
                uploadPercent={uploadProgress.percent}
                onFileSelect={handleFileChange}
              />
            </motion.div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Map columns</h4>
                <p className="text-sm text-slate-600 mb-4">
                  The uploaded columns are listed below with a suggested match for each contact field.
                </p>

                <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Detected columns</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {fileColumns.length > 0 ? (
                      fileColumns.map((column) => (
                        <div
                          key={column}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600"
                        >
                          {column}
                          <span className="ml-2 text-slate-400">({columnStats[column] ?? 0})</span>
                        </div>
                      ))
                    ) : (
                      <span className="text-sm text-slate-400">
                        {isParsing ? 'Reading file columns...' : 'Upload a file in step 1 to see columns here.'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {CONTACT_FIELDS.map((field) => (
                    <motion.div key={field.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{field.label}</p>
                        {field.required ? (
                          <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-rose-600">
                            Required
                          </span>
                        ) : null}
                      </div>
                      <select
                        value={columnMapping[field.id] || ''}
                        onChange={(e) => setColumnMapping((prev) => ({ ...prev, [field.id]: e.target.value }))}
                        className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      >
                        <option value="">Select column</option>
                        {fileColumns.map((column) => (
                          <option key={column} value={column}>
                            {column}
                          </option>
                        ))}
                      </select>
                      <p className="mt-3 text-xs text-slate-500">
                        {columnMapping[field.id]
                          ? `Mapped to ${columnMapping[field.id]}`
                          : 'No column selected yet.'}
                      </p>
                    </motion.div>
                  ))}
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
                          <th key={column} className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase">
                            {column}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {previewRows.map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50/80">
                          {fileColumns.map((column) => (
                            <td key={`${i}-${column}`} className="px-4 py-3 text-slate-600">
                              {String(row[column] ?? '-')}
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

              <div className="bg-amber-50 rounded-xl border border-amber-200 shadow-sm p-5">
                <h4 className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <AlertCircle size={14} /> Import note
                </h4>
                <p className="text-sm text-amber-800">
                  Contacts will be imported using the mappings you selected above. If a company name matches an
                  existing client, it will be linked automatically.
                </p>
              </div>
            </div>
          )}
        </div>

        <ImportDrawerFooter
          step={step}
          isImporting={isImporting}
          importPercent={importProgress.percent}
          importButtonLabel="Import Contacts"
          importProgressLabel="Importing contacts into CRM…"
          continueDisabled={
            (step === 1 && (!fileName || isParsing || !!parseError || !fileUploaded)) ||
            (step === 2 && fileColumns.length === 0)
          }
          importDisabled={isImporting || previewRows.length === 0}
          onBack={() => setStep((s) => s - 1)}
          onContinue={() => setStep((s) => s + 1)}
          onImport={handleImport}
        />
      </motion.div>
    </AnimatePresence>
  );
}
