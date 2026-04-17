'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';

export interface StatusChangeServiceProps<T extends string> {
  currentStatus: T;
  availableStatuses: T[];
  statusLabels?: Record<T, string>;
  onStatusChange: (newStatus: T, remark?: string) => Promise<void>;
  onCancel: () => void;
  title?: string;
  placeholder?: string;
}

export function StatusChangeService<T extends string>({
  currentStatus,
  availableStatuses,
  statusLabels,
  onStatusChange,
  onCancel,
  title = 'Change Status',
  placeholder = 'Add remark for this status change',
}: StatusChangeServiceProps<T>) {
  const [selectedStatus, setSelectedStatus] = useState<T>(currentStatus);
  const [remark, setRemark] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (selectedStatus === currentStatus && !remark.trim()) {
      onCancel();
      return;
    }

    try {
      setSaving(true);
      await onStatusChange(selectedStatus, remark.trim() || undefined);
      setRemark('');
    } catch (error: any) {
      console.error('Failed to change status:', error);
      alert(error.message || 'Failed to change status');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setSelectedStatus(currentStatus);
    setRemark('');
    onCancel();
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <button
          type="button"
          onClick={handleCancel}
          className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </div>
      
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-2">
          Status
        </label>
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value as T)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
        >
          {availableStatuses.map((status) => (
            <option key={status} value={status}>
              {statusLabels?.[status] || status}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-700 mb-2">
          Remark (Optional)
        </label>
        <input
          type="text"
          value={remark}
          onChange={(e) => setRemark(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
        />
      </div>

      <div className="flex items-center gap-2 pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={saving}
          className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
