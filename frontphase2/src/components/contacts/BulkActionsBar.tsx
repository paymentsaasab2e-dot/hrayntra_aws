'use client';

import React, { useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { apiGetUsers } from '../../lib/api';
import { requestConfirm } from '../../lib/appDialog';

interface BulkActionsBarProps {
  selectedCount: number;
  onBulkAction: (action: string, payload?: any) => void;
  onClearSelection: () => void;
  /** Dark floating bar (matches Clients bulk strip). */
  variant?: 'default' | 'compact';
}

export function BulkActionsBar({
  selectedCount,
  onBulkAction,
  onClearSelection,
  variant = 'default',
}: BulkActionsBarProps) {
  const [showAssignOwner, setShowAssignOwner] = useState(false);
  const [owners, setOwners] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedOwnerId, setSelectedOwnerId] = useState('');

  React.useEffect(() => {
    const fetchOwners = async () => {
      try {
        const response = await apiGetUsers({ role: 'RECRUITER' });
        if (response.data) {
          const ownersData = Array.isArray(response.data) ? response.data : response.data.data || [];
          setOwners(ownersData.map((u: any) => ({ id: u.id, name: u.name })));
        }
      } catch (error) {
        console.error('Failed to fetch owners:', error);
      }
    };
    fetchOwners();
  }, []);

  const handleAssignOwner = () => {
    if (selectedOwnerId) {
      onBulkAction('assign_owner', { ownerId: selectedOwnerId });
      setShowAssignOwner(false);
      setSelectedOwnerId('');
    }
  };

  if (variant === 'compact') {
    return (
      <div className="text-white">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="text-sm font-semibold text-white/95">{selectedCount} selected</span>
            <button
              type="button"
              onClick={() => setShowAssignOwner(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/15"
            >
              <User size={14} />
              Assign owner
            </button>
            <button
              type="button"
              onClick={async () => {
                if (await requestConfirm(`Delete ${selectedCount} contacts?`)) {
                  onBulkAction('delete');
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500"
            >
              <Trash2 size={14} />
              Delete
            </button>
          </div>
          <button
            type="button"
            onClick={onClearSelection}
            className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white"
            aria-label="Clear selection"
          >
            <X size={18} />
          </button>
        </div>

        {showAssignOwner ? (
          <div className="mt-3 rounded-xl border border-white/15 bg-slate-900/80 p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <select
                value={selectedOwnerId}
                onChange={(e) => setSelectedOwnerId(e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-white/20 bg-slate-950/80 px-3 py-2 text-sm text-white"
              >
                <option value="">Select owner</option>
                {owners.map((owner) => (
                  <option key={owner.id} value={owner.id}>
                    {owner.name}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleAssignOwner}
                  className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
                >
                  Assign
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAssignOwner(false);
                    setSelectedOwnerId('');
                  }}
                  className="rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-white/90 hover:bg-white/10"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold text-gray-900">
            {selectedCount} selected
          </span>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAssignOwner(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <User size={16} />
              Assign Owner
            </button>
            
            <button
              onClick={async () => {
                if (await requestConfirm(`Delete ${selectedCount} contacts?`)) {
                  onBulkAction('delete');
                }
              }}
              className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100"
            >
              <Trash2 size={16} />
              Delete
            </button>
          </div>
        </div>

        <button
          onClick={onClearSelection}
          className="p-2 hover:bg-white rounded-lg text-gray-400 hover:text-gray-600"
        >
          <X size={18} />
        </button>
      </div>

      {/* Assign Owner Modal */}
      {showAssignOwner && (
        <div className="mt-4 p-4 bg-white border border-gray-200 rounded-lg">
          <div className="flex items-center gap-3">
            <select
              value={selectedOwnerId}
              onChange={(e) => setSelectedOwnerId(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
            >
              <option value="">Select owner</option>
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.name}
                </option>
              ))}
            </select>
            <button
              onClick={handleAssignOwner}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium"
            >
              Assign
            </button>
            <button
              onClick={() => {
                setShowAssignOwner(false);
                setSelectedOwnerId('');
              }}
              className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
