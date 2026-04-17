'use client';

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X, Upload, FileText, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

interface ImportContactsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ImportContactsDrawer({ isOpen, onClose, onSuccess }: ImportContactsDrawerProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      // Parse CSV preview (simplified)
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const lines = text.split('\n').slice(0, 11); // First 10 rows + header
        const headers = lines[0].split(',');
        const rows = lines.slice(1).map(line => {
          const values = line.split(',');
          return headers.reduce((obj, header, idx) => {
            obj[header.trim()] = values[idx]?.trim() || '';
            return obj;
          }, {} as any);
        });
        setPreviewData(rows);
        setStep(2);
      };
      reader.readAsText(selectedFile);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setIsImporting(true);
    try {
      // TODO: Implement actual import API call
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate API call
      toast.success(`${previewData.length} contacts imported successfully`);
      setStep(3);
    } catch (error: any) {
      toast.error(error.message || 'Failed to import contacts');
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setFile(null);
    setPreviewData([]);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 z-[90] bg-slate-900/40"
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.25 }}
            className="fixed right-0 top-0 z-[100] flex h-full w-full flex-col bg-white shadow-2xl sm:max-w-[600px]"
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Import Contacts</h2>
              <button
                onClick={handleClose}
                className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {/* Step 1: Upload */}
              {step === 1 && (
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center">
                    <Upload size={48} className="mx-auto text-gray-400 mb-4" />
                    <p className="text-sm font-medium text-gray-700 mb-2">
                      Drag and drop CSV file here, or click to browse
                    </p>
                    <p className="text-xs text-gray-500 mb-4">CSV or Excel files only</p>
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="file-upload"
                    />
                    <label
                      htmlFor="file-upload"
                      className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium cursor-pointer hover:bg-blue-700"
                    >
                      Choose File
                    </label>
                  </div>
                  <div className="text-center">
                    <a
                      href="/api/contacts/import-template"
                      download
                      className="text-sm text-blue-600 hover:underline"
                    >
                      Download CSV template
                    </a>
                  </div>
                </div>
              )}

              {/* Step 2: Preview */}
              {step === 2 && (
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-green-700">
                      <CheckCircle size={20} />
                      <span className="text-sm font-medium">
                        {previewData.length} contacts ready to import
                      </span>
                    </div>
                  </div>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Name</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Email</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Company</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {previewData.slice(0, 10).map((row, idx) => (
                            <tr key={idx}>
                              <td className="px-4 py-2">{row.firstName || row.name || '—'}</td>
                              <td className="px-4 py-2">{row.email || '—'}</td>
                              <td className="px-4 py-2">{row.company || '—'}</td>
                              <td className="px-4 py-2">
                                <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                                  Ready
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Complete */}
              {step === 3 && (
                <div className="text-center py-12">
                  <CheckCircle size={64} className="mx-auto text-green-500 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Import Complete!</h3>
                  <p className="text-sm text-gray-500">
                    {previewData.length} contacts have been imported successfully.
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
              {step === 1 && (
                <>
                  <button
                    onClick={handleClose}
                    className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </>
              )}
              {step === 2 && (
                <>
                  <button
                    onClick={() => setStep(1)}
                    className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={isImporting}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isImporting ? 'Importing...' : `Import ${previewData.length} Contacts`}
                  </button>
                </>
              )}
              {step === 3 && (
                <button
                  onClick={handleClose}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
                >
                  Done
                </button>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
