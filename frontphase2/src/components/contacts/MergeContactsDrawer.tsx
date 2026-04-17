'use client';

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { apiMergeContacts, type BackendContact } from '../../lib/api';

interface MergeContactsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  primaryContact?: BackendContact | null;
  duplicateContact?: BackendContact | null;
}

export function MergeContactsDrawer({
  isOpen,
  onClose,
  onSuccess,
  primaryContact,
  duplicateContact,
}: MergeContactsDrawerProps) {
  const [selectedFields, setSelectedFields] = useState<Record<string, 'primary' | 'duplicate'>>({});
  const [isMerging, setIsMerging] = useState(false);

  React.useEffect(() => {
    if (primaryContact && duplicateContact) {
      // Default: keep primary for all fields
      const defaults: Record<string, 'primary'> = {};
      Object.keys(primaryContact).forEach(key => {
        defaults[key] = 'primary';
      });
      setSelectedFields(defaults);
    }
  }, [primaryContact, duplicateContact]);

  const handleMerge = async () => {
    if (!primaryContact || !duplicateContact) return;

    setIsMerging(true);
    try {
      await apiMergeContacts(primaryContact.id, duplicateContact.id);
      toast.success('Contacts merged successfully');
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to merge contacts');
    } finally {
      setIsMerging(false);
    }
  };

  if (!primaryContact || !duplicateContact) {
    return (
      <div className="text-center p-8">
        <p className="text-gray-500">Please select two contacts to merge</p>
      </div>
    );
  }

  const fields = [
    { key: 'firstName', label: 'First Name' },
    { key: 'lastName', label: 'Last Name' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'designation', label: 'Designation' },
    { key: 'department', label: 'Department' },
    { key: 'location', label: 'Location' },
    { key: 'linkedinUrl', label: 'LinkedIn' },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[90] bg-slate-900/40"
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.25 }}
            className="fixed right-0 top-0 z-[100] flex h-full w-full flex-col bg-white shadow-2xl sm:max-w-[800px]"
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Merge Contacts</h2>
              <button
                onClick={onClose}
                className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="grid grid-cols-2 gap-6">
                {/* Primary Contact */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">Primary Contact (Keep)</h3>
                  <div className="space-y-3">
                    {fields.map((field) => (
                      <div key={field.key}>
                        <label className="block text-xs font-medium text-gray-500 mb-1">{field.label}</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={field.key}
                            checked={selectedFields[field.key] === 'primary'}
                            onChange={() => setSelectedFields({ ...selectedFields, [field.key]: 'primary' })}
                            className="w-4 h-4 text-blue-600"
                          />
                          <span className="text-sm text-gray-700">
                            {(primaryContact as any)[field.key] || '—'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Duplicate Contact */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">Duplicate Contact (Merge)</h3>
                  <div className="space-y-3">
                    {fields.map((field) => (
                      <div key={field.key}>
                        <label className="block text-xs font-medium text-gray-500 mb-1">{field.label}</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={field.key}
                            checked={selectedFields[field.key] === 'duplicate'}
                            onChange={() => setSelectedFields({ ...selectedFields, [field.key]: 'duplicate' })}
                            className="w-4 h-4 text-blue-600"
                          />
                          <span className="text-sm text-gray-700">
                            {(duplicateContact as any)[field.key] || '—'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleMerge}
                disabled={isMerging}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
              >
                {isMerging ? 'Merging...' : 'Merge Contacts'}
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
