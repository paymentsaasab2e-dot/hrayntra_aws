'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Upload,
  ChevronRight,
  ChevronDown,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

export interface ClientImportDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: () => void;
}

const CRM_FIELDS = [
  { id: 'name', label: 'Company Name', required: true },
  { id: 'industry', label: 'Industry', required: false },
  { id: 'location', label: 'Location', required: false },
  { id: 'contactPerson', label: 'Contact Person', required: false },
  { id: 'email', label: 'Email', required: false },
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
  const [mappingDropdownOpen, setMappingDropdownOpen] = useState<string | null>(null);
  const [duplicateRule, setDuplicateRule] = useState('skip');
  const [validationErrors] = useState<string[]>([
    'Row 3: Email format invalid',
    'Row 7: Company name missing',
  ]);
  const [previewRows] = useState([
    { name: 'TechFlow Systems', industry: 'Software', location: 'San Francisco' },
    { name: 'GreenEnergy Co.', industry: 'Renewables', location: 'Austin' },
    { name: '—', industry: 'Fintech', location: 'Dublin' },
  ]);
  const fileColumns = ['Column A', 'Column B', 'Column C', 'Column D', 'Column E'];

  const reset = () => {
    setStep(1);
    setFileName('');
    setColumnMapping(CRM_FIELDS.reduce((acc, f) => ({ ...acc, [f.id]: '' }), {}));
    setDuplicateRule('skip');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleImport = () => {
    onImportComplete?.();
    handleClose();
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
                    onChange={(e) => setFileName(e.target.files?.[0]?.name ?? '')}
                  />
                  <div className="flex flex-col items-center justify-center gap-2 w-full">
                    <Upload size={32} className="text-slate-400" />
                    <span className="text-sm font-medium text-slate-600">
                      {fileName || 'Click or drag CSV / XLSX file'}
                    </span>
                    <span className="text-xs text-slate-400">CSV, XLSX up to 10MB</span>
                  </div>
                </label>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Map columns</h4>
                <p className="text-sm text-slate-600 mb-4">Match your spreadsheet columns to CRM fields.</p>
                <div className="space-y-3">
                  {CRM_FIELDS.map((field) => (
                    <div key={field.id} className="flex items-center gap-3">
                      <label className="w-36 text-sm font-medium text-slate-700 shrink-0">
                        {field.label}
                        {field.required && <span className="text-red-500 ml-0.5">*</span>}
                      </label>
                      <div className="relative flex-1">
                        <button
                          type="button"
                          onClick={() => setMappingDropdownOpen(mappingDropdownOpen === field.id ? null : field.id)}
                          className="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-left text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        >
                          <span className={columnMapping[field.id] ? 'text-slate-900' : 'text-slate-400'}>
                            {columnMapping[field.id] || 'Select column'}
                          </span>
                          <ChevronDown size={16} className="text-slate-400 shrink-0" />
                        </button>
                        {mappingDropdownOpen === field.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setMappingDropdownOpen(null)} aria-hidden />
                            <ul className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                              {fileColumns.map((col) => (
                                <li key={col}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setColumnMapping((prev) => ({ ...prev, [field.id]: col }));
                                      setMappingDropdownOpen(null);
                                    }}
                                    className={`w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 ${
                                      columnMapping[field.id] === col ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'
                                    }`}
                                  >
                                    {col}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </>
                        )}
                      </div>
                    </div>
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
                  <p className="text-xs text-slate-500 mt-0.5">First rows from your file</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase">Company</th>
                        <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase">Industry</th>
                        <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase">Location</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {previewRows.map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50/80">
                          <td className="px-4 py-3 font-medium text-slate-900">{row.name}</td>
                          <td className="px-4 py-3 text-slate-600">{row.industry}</td>
                          <td className="px-4 py-3 text-slate-600">{row.location}</td>
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
                disabled={step === 1 && !fileName}
                className="px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            ) : (
              <button
                type="button"
                onClick={handleImport}
                className="px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors"
              >
                Import
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
