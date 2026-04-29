'use client';

import React from 'react';
import { CheckSquare, Square, Pencil, Trash2, MessageSquare } from 'lucide-react';
import { ImageWithFallback } from '../ImageWithFallback';
import PaginationAll from '../PaginationAll';
import type { BackendContact } from '../../lib/api';
import { ContactTypeBadge } from './ContactTypeBadge';
import { OwnerAvatar } from './OwnerAvatar';

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
  const allSelected = contacts.length > 0 && contacts.every((contact) => selectedIds.has(contact.id));
  const someSelected = contacts.some((contact) => selectedIds.has(contact.id));

  const handleSelectAll = () => {
    if (allSelected) {
      onSelectIds(new Set());
    } else {
      onSelectIds(new Set(contacts.map((contact) => contact.id)));
    }
  };

  const handleSelect = (contactId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(selectedIds);
    if (next.has(contactId)) {
      next.delete(contactId);
    } else {
      next.add(contactId);
    }
    onSelectIds(next);
  };

  const getInitials = (contact: BackendContact) => {
    const first = contact.firstName?.[0] || '';
    const last = contact.lastName?.[0] || '';
    return `${first}${last}`.toUpperCase();
  };

  const openWhatsApp = (contact: BackendContact) => {
    const rawPhone = contact.phone?.replace(/[^\d+]/g, '').trim();
    if (!rawPhone) {
      window.alert('No phone number is available for this contact.');
      return;
    }

    const phone = rawPhone.startsWith('+') ? rawPhone.slice(1) : rawPhone;
    const message = encodeURIComponent(`Hi ${contact.firstName} ${contact.lastName},`);
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank', 'noopener,noreferrer');
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
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="p-8 text-center text-gray-500">Loading contacts...</div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="overflow-x-auto overflow-y-visible">
        {contacts.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-gray-500 mb-2">No contacts found</div>
            <div className="text-sm text-gray-400">Try adjusting your filters or add a new contact</div>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-4 w-12">
                  <button onClick={handleSelectAll} className="flex items-center justify-center w-5 h-5">
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
                        className="text-sm font-medium text-blue-600 hover:underline"
                      >
                        {contact.company.companyName}
                      </a>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-700">{contact.designation || '-'}</span>
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
                      <span className="text-sm text-gray-400">-</span>
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
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onEdit(contact)}
                        className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                        aria-label="Edit contact"
                        title="Edit"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => openWhatsApp(contact)}
                        className="p-2 rounded-lg text-blue-500 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                        aria-label="Send message"
                        title="Send Message"
                      >
                        <MessageSquare size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(contact.id)}
                        className="p-2 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors"
                        aria-label="Delete contact"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="border-t border-gray-200 bg-gray-50 px-6 py-4">
        <PaginationAll
          initialPage={pagination.page}
          totalPages={Math.max(1, pagination.totalPages)}
          onPageChange={onPageChange}
          totalCount={pagination.total}
          pageSize={pagination.limit}
          itemLabel="contacts"
        />
      </div>
    </div>
  );
}
