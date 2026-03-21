'use client';

import React from 'react';
import { MoreVertical, ExternalLink, CheckSquare, Square } from 'lucide-react';
import { ImageWithFallback } from '../ImageWithFallback';
import type { BackendContact } from '../../lib/api';
import { ContactTypeBadge } from './ContactTypeBadge';
import { OwnerAvatar } from './OwnerAvatar';
// Date formatting utility

interface ContactsTableProps {
  contacts: BackendContact[];
  loading: boolean;
  selectedIds: Set<string>;
  onSelectIds: (ids: Set<string>) => void;
  onRowClick: (contact: BackendContact) => void;
  onEdit: (contact: BackendContact) => void;
  onDelete: (contactId: string) => void;
  pagination: { page: number; limit: number; total: number; totalPages: number };
  onPageChange: (page: number) => void;
}

export function ContactsTable({
  contacts,
  loading,
  selectedIds,
  onSelectIds,
  onRowClick,
  onEdit,
  onDelete,
  pagination,
  onPageChange,
}: ContactsTableProps) {
  const allSelected = contacts.length > 0 && contacts.every(c => selectedIds.has(c.id));
  const someSelected = contacts.some(c => selectedIds.has(c.id));

  const handleSelectAll = () => {
    if (allSelected) {
      onSelectIds(new Set());
    } else {
      onSelectIds(new Set(contacts.map(c => c.id)));
    }
  };

  const handleSelect = (contactId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSet = new Set(selectedIds);
    if (newSet.has(contactId)) {
      newSet.delete(contactId);
    } else {
      newSet.add(contactId);
    }
    onSelectIds(newSet);
  };

  const getInitials = (contact: BackendContact) => {
    return `${contact.firstName[0]}${contact.lastName[0]}`.toUpperCase();
  };

  const formatLastContact = (dateString?: string | null) => {
    if (!dateString) return 'Never';
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMinutes = Math.floor(diffMs / (1000 * 60));

      if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
      if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
      if (diffMinutes > 0) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
      return 'Just now';
    } catch {
      return 'Never';
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
        <div className="text-gray-500">Loading contacts...</div>
      </div>
    );
  }

  if (contacts.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
        <div className="text-gray-500 mb-2">No contacts found</div>
        <div className="text-sm text-gray-400">Try adjusting your filters or add a new contact</div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-6 py-4 w-12">
                <button
                  onClick={handleSelectAll}
                  className="flex items-center justify-center w-5 h-5"
                >
                  {allSelected ? (
                    <CheckSquare size={18} className="text-blue-600" />
                  ) : someSelected ? (
                    <div className="w-5 h-5 border-2 border-blue-600 bg-blue-50 rounded" />
                  ) : (
                    <Square size={18} className="text-gray-400" />
                  )}
                </button>
              </th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Contact Name
              </th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Company
              </th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Designation
              </th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Contact Type
              </th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">
                Jobs
              </th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Owner
              </th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Last Contact
              </th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {contacts.map((contact) => (
              <tr
                key={contact.id}
                onClick={() => onRowClick(contact)}
                className="hover:bg-gray-50 transition-colors cursor-pointer group"
              >
                <td className="px-6 py-4" onClick={(e) => handleSelect(contact.id, e)}>
                  {selectedIds.has(contact.id) ? (
                    <CheckSquare size={18} className="text-blue-600" />
                  ) : (
                    <Square size={18} className="text-gray-400 group-hover:text-gray-600" />
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <ImageWithFallback
                      src={contact.avatarUrl}
                      alt={`${contact.firstName} ${contact.lastName}`}
                      className="w-9 h-9 rounded-full object-cover ring-2 ring-white shadow-sm"
                      fallback={
                        <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold text-sm">
                          {getInitials(contact)}
                        </div>
                      }
                    />
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {contact.firstName} {contact.lastName}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{contact.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  {contact.company ? (
                    <a
                      href={`/client/${contact.company.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline"
                    >
                      {contact.company.companyName}
                      <ExternalLink size={14} />
                    </a>
                  ) : (
                    <span className="text-sm text-gray-400">—</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-gray-700">{contact.designation || '—'}</span>
                </td>
                <td className="px-6 py-4">
                  <ContactTypeBadge type={contact.contactType} />
                </td>
                <td className="px-6 py-4 text-center">
                  <span className="text-sm font-medium text-gray-700">
                    {contact.associatedJobIds?.length || 0}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {contact.owner ? (
                    <OwnerAvatar owner={contact.owner} />
                  ) : (
                    <span className="text-sm text-gray-400">—</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <span className="text-xs text-gray-500">{formatLastContact(contact.lastContacted)}</span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        contact.status === 'ACTIVE' ? 'bg-green-500' : 'bg-gray-400'
                      }`}
                    />
                    <span className="text-xs text-gray-600 capitalize">{contact.status.toLowerCase()}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                  <button className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors">
                    <MoreVertical size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
          <div className="text-sm text-gray-500">
            Showing <span className="font-semibold text-gray-900">{((pagination.page - 1) * pagination.limit) + 1}</span> to{' '}
            <span className="font-semibold text-gray-900">
              {Math.min(pagination.page * pagination.limit, pagination.total)}
            </span>{' '}
            of <span className="font-semibold text-gray-900">{pagination.total}</span> results
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                const page = i + 1;
                return (
                  <button
                    key={page}
                    onClick={() => onPageChange(page)}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium ${
                      pagination.page === page
                        ? 'bg-blue-600 text-white'
                        : 'hover:bg-gray-100 text-gray-600'
                    }`}
                  >
                    {page}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
