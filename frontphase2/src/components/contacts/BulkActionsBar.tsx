'use client';

import React, { useState } from 'react';
import { Mail, Tag, User, Download, Trash2, X } from 'lucide-react';
import { apiGetUsers } from '../../lib/api';

interface BulkActionsBarProps {
  selectedCount: number;
  onBulkAction: (action: string, payload?: any) => void;
  onClearSelection: () => void;
}

export function BulkActionsBar({ selectedCount, onBulkAction, onClearSelection }: BulkActionsBarProps) {
  const [showAssignOwner, setShowAssignOwner] = useState(false);
  const [showAddTags, setShowAddTags] = useState(false);
  const [owners, setOwners] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedOwnerId, setSelectedOwnerId] = useState('');
  const [tagsInput, setTagsInput] = useState('');

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

  const handleAddTags = () => {
    if (tagsInput.trim()) {
      const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
      onBulkAction('add_tags', { tags });
      setShowAddTags(false);
      setTagsInput('');
    }
  };

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
              onClick={() => setShowAddTags(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Tag size={16} />
              Add Tag
            </button>
            
            <button
              onClick={() => onBulkAction('export')}
              className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Download size={16} />
              Export
            </button>
            
            <button
              onClick={() => {
                if (confirm(`Delete ${selectedCount} contacts?`)) {
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

      {/* Add Tags Modal */}
      {showAddTags && (
        <div className="mt-4 p-4 bg-white border border-gray-200 rounded-lg">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="Enter tags (comma-separated)"
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
            <button
              onClick={handleAddTags}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium"
            >
              Add
            </button>
            <button
              onClick={() => {
                setShowAddTags(false);
                setTagsInput('');
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
