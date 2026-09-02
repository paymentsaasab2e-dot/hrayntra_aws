'use client';

import React from 'react';
import { CheckSquare, Square, Pencil, Trash2 } from 'lucide-react';
import { SHOW_TABLE_ROW_EDIT_ICON } from '../../constants/tableUi';
import { ImageWithFallback } from '../ImageWithFallback';
import { WhatsAppIcon } from '../icons/WhatsAppIcon';
import PaginationAll from '../PaginationAll';
import { TABLE_PAGE_SIZE_OPTIONS } from '../../constants/tablePagination';
import type { BackendContact } from '../../lib/api';
import { ContactTypeBadge } from './ContactTypeBadge';
import { OwnerAvatar } from './OwnerAvatar';
import { formatDirectorDisplay } from '../../constants/salutations';
import { visibleContactEmail } from '../../lib/contactEmail';
import { PH2_TABLE_BODY_SCROLL_CLASS, PH2_TABLE_CARD_FOOTER_CLASS } from '../layout/Ph2ModulePageLayout';
import { extractAuditMeta } from '../../utils/auditMeta';
import { TableAuditColumnHeader, TableAuditCell } from '../table/TableAuditCell';

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
  onPageSizeChange?: (limit: number) => void;
  /** Persistable column visibility; locked columns (select/contact/actions) stay shown. */
  isColumnVisible?: (id: string) => boolean;
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
  onPageSizeChange,
  isColumnVisible = () => true,
}: ContactsTableProps) {
  const show = isColumnVisible;
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
    const message = encodeURIComponent(
      `Hi ${formatDirectorDisplay(contact.salutation, `${contact.firstName} ${contact.lastName}`.trim())},`
    );
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

  const formatCreatedAt = (dateString?: string | null) => {
    if (!dateString) return '—';
    try {
      const date = new Date(dateString);
      if (Number.isNaN(date.getTime())) return dateString;
      return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className={`${PH2_TABLE_BODY_SCROLL_CLASS} p-8 text-center text-sm font-medium text-slate-500`}>
          Loading contacts…
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className={PH2_TABLE_BODY_SCROLL_CLASS}>
        {contacts.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-slate-600 mb-2 font-medium">No contacts found</div>
            <div className="text-sm text-slate-400">Try adjusting your filters or add a new contact</div>
          </div>
        ) : (
          <table className="w-full min-w-[760px] text-left">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-indigo-100/50 bg-gradient-to-r from-slate-50/90 via-white to-indigo-50/30 backdrop-blur-sm">
                <th className="px-3 py-2.5 sm:px-4 w-12">
                  <button type="button" onClick={handleSelectAll} className="flex items-center justify-center w-5 h-5">
                    {allSelected ? (
                      <CheckSquare size={18} className="text-blue-600" />
                    ) : someSelected ? (
                      <div className="w-5 h-5 border-2 border-blue-600 bg-blue-50 rounded" />
                    ) : (
                      <Square size={18} className="text-gray-400" />
                    )}
                  </button>
                </th>
                <th className="px-3 py-2.5 sm:px-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Contact Name
                </th>
                {show('company') ? (
                  <th className="px-3 py-2.5 sm:px-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Company
                  </th>
                ) : null}
                {show('designation') ? (
                  <th className="px-3 py-2.5 sm:px-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Designation
                  </th>
                ) : null}
                {show('contactType') ? (
                  <th className="px-3 py-2.5 sm:px-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Contact Type
                  </th>
                ) : null}
                {show('jobs') ? (
                  <th className="px-3 py-2.5 sm:px-4 text-[11px] font-bold uppercase tracking-wider text-slate-500 text-center">
                    Jobs
                  </th>
                ) : null}
                {show('owner') ? (
                  <th className="px-3 py-2.5 sm:px-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Owner
                  </th>
                ) : null}
                {show('lastContact') ? (
                  <th className="px-3 py-2.5 sm:px-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Last Contact
                  </th>
                ) : null}
                {show('status') ? (
                  <th className="px-3 py-2.5 sm:px-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Status
                  </th>
                ) : null}
                {show('email') ? (
                  <th className="px-3 py-2.5 sm:px-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Email
                  </th>
                ) : null}
                {show('phone') ? (
                  <th className="px-3 py-2.5 sm:px-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Phone
                  </th>
                ) : null}
                {show('department') ? (
                  <th className="px-3 py-2.5 sm:px-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Department
                  </th>
                ) : null}
                {show('location') ? (
                  <th className="px-3 py-2.5 sm:px-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Location
                  </th>
                ) : null}
                {show('linkedin') ? (
                  <th className="px-3 py-2.5 sm:px-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    LinkedIn
                  </th>
                ) : null}
                {show('preferredChannel') ? (
                  <th className="px-3 py-2.5 sm:px-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Preferred channel
                  </th>
                ) : null}
                {show('tags') ? (
                  <th className="px-3 py-2.5 sm:px-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Tags
                  </th>
                ) : null}
                {show('isPrimary') ? (
                  <th className="px-3 py-2.5 sm:px-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Primary
                  </th>
                ) : null}
                {show('createdAt') ? (
                  <th className="px-3 py-2.5 sm:px-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Created
                  </th>
                ) : null}
                {show('audit') ? <TableAuditColumnHeader className="px-3 py-2.5 sm:px-4" /> : null}
                <th className="px-3 py-2.5 sm:px-4 text-[11px] font-bold uppercase tracking-wider text-slate-500 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-indigo-50/80 bg-white/40">
              {contacts.map((contact) => (
                <tr
                  key={contact.id}
                  onClick={() => onRowClick(contact)}
                  className="cursor-pointer transition-colors hover:bg-indigo-50/35 group"
                >
                  <td className="px-3 py-2.5 sm:px-4" onClick={(e) => handleSelect(contact.id, e)}>
                    {selectedIds.has(contact.id) ? (
                      <CheckSquare size={18} className="text-blue-600" />
                    ) : (
                      <Square size={18} className="text-gray-400 group-hover:text-gray-600" />
                    )}
                  </td>
                  <td className="px-3 py-2.5 sm:px-4">
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
                        <p className="text-sm font-semibold text-slate-900">
                          {formatDirectorDisplay(contact.salutation, `${contact.firstName} ${contact.lastName}`.trim())}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">{visibleContactEmail(contact.email, '—')}</p>
                      </div>
                    </div>
                  </td>
                  {show('company') ? (
                    <td className="px-3 py-2.5 sm:px-4">
                      {contact.company ? (
                        <a
                          href={`/client/${contact.company.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-sm font-medium text-indigo-600 hover:underline"
                        >
                          {contact.company.companyName}
                        </a>
                      ) : (
                        <span className="text-sm text-slate-400">-</span>
                      )}
                    </td>
                  ) : null}
                  {show('designation') ? (
                    <td className="px-3 py-2.5 sm:px-4">
                      <span className="text-sm text-slate-700">{contact.designation || '-'}</span>
                    </td>
                  ) : null}
                  {show('contactType') ? (
                    <td className="px-3 py-2.5 sm:px-4">
                      <ContactTypeBadge type={contact.contactType} />
                    </td>
                  ) : null}
                  {show('jobs') ? (
                    <td className="px-3 py-2.5 sm:px-4 text-center">
                      <span className="text-sm font-medium text-slate-700">
                        {contact.associatedJobIds?.length || 0}
                      </span>
                    </td>
                  ) : null}
                  {show('owner') ? (
                    <td className="px-3 py-2.5 sm:px-4">
                      {contact.owner ? (
                        <OwnerAvatar owner={contact.owner} />
                      ) : (
                        <span className="text-sm text-slate-400">-</span>
                      )}
                    </td>
                  ) : null}
                  {show('lastContact') ? (
                    <td className="px-3 py-2.5 sm:px-4">
                      <span className="text-xs text-slate-500">{formatLastContact(contact.lastContacted)}</span>
                    </td>
                  ) : null}
                  {show('status') ? (
                    <td className="px-3 py-2.5 sm:px-4">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            contact.status === 'ACTIVE' ? 'bg-green-500' : 'bg-gray-400'
                          }`}
                        />
                        <span className="text-xs text-slate-600 capitalize">{contact.status.toLowerCase()}</span>
                      </div>
                    </td>
                  ) : null}
                  {show('email') ? (
                    <td className="px-3 py-2.5 sm:px-4">
                      <span className="text-sm text-slate-700">{visibleContactEmail(contact.email, '—')}</span>
                    </td>
                  ) : null}
                  {show('phone') ? (
                    <td className="px-3 py-2.5 sm:px-4">
                      <span className="text-sm text-slate-700">{contact.phone || '—'}</span>
                    </td>
                  ) : null}
                  {show('department') ? (
                    <td className="px-3 py-2.5 sm:px-4">
                      <span className="text-sm text-slate-700">{contact.department || '—'}</span>
                    </td>
                  ) : null}
                  {show('location') ? (
                    <td className="px-3 py-2.5 sm:px-4">
                      <span className="text-sm text-slate-700">{contact.location || '—'}</span>
                    </td>
                  ) : null}
                  {show('linkedin') ? (
                    <td className="px-3 py-2.5 sm:px-4">
                      {contact.linkedinUrl ? (
                        <a
                          href={contact.linkedinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="block max-w-[10rem] truncate text-sm font-medium text-indigo-600 hover:underline"
                          title={contact.linkedinUrl}
                        >
                          {contact.linkedinUrl.replace(/^https?:\/\/(www\.)?linkedin\.com\/?/i, '') ||
                            contact.linkedinUrl}
                        </a>
                      ) : (
                        <span className="text-sm text-slate-400">—</span>
                      )}
                    </td>
                  ) : null}
                  {show('preferredChannel') ? (
                    <td className="px-3 py-2.5 sm:px-4">
                      <span className="text-sm text-slate-700">{contact.preferredChannel || '—'}</span>
                    </td>
                  ) : null}
                  {show('tags') ? (
                    <td className="px-3 py-2.5 sm:px-4">
                      <span className="text-sm text-slate-700">
                        {Array.isArray(contact.tags) && contact.tags.length > 0
                          ? contact.tags.join(', ')
                          : '—'}
                      </span>
                    </td>
                  ) : null}
                  {show('isPrimary') ? (
                    <td className="px-3 py-2.5 sm:px-4">
                      <span className="text-sm text-slate-700">{contact.isPrimary ? 'Yes' : 'No'}</span>
                    </td>
                  ) : null}
                  {show('createdAt') ? (
                    <td className="px-3 py-2.5 sm:px-4">
                      <span className="text-xs text-slate-500">{formatCreatedAt(contact.createdAt)}</span>
                    </td>
                  ) : null}
                  {show('audit') ? (
                    <TableAuditCell
                      audit={extractAuditMeta(contact as unknown as Record<string, unknown>)}
                      className="px-3 py-2.5 sm:px-4"
                    />
                  ) : null}
                  <td className="px-3 py-2.5 sm:px-4 text-right" onClick={(e) => e.stopPropagation()}>
                    {/* Colored action icons — keeps the row actions visually
                        identical to the Leads / Clients / Candidates tables. */}
                    <div className="inline-flex items-center justify-end gap-0.5 rounded-2xl bg-slate-100/70 p-0.5 ring-1 ring-slate-200/60">
                      {SHOW_TABLE_ROW_EDIT_ICON ? (
                        <button
                          type="button"
                          onClick={() => onEdit(contact)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-amber-600 hover:bg-white hover:text-amber-800 hover:shadow-sm transition-all"
                          aria-label="Edit contact"
                          title="Edit"
                        >
                          <Pencil size={15} strokeWidth={2.25} />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => openWhatsApp(contact)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-emerald-600 hover:bg-white hover:text-emerald-800 hover:shadow-sm transition-all"
                        aria-label="Send WhatsApp"
                        title="WhatsApp"
                      >
                        <WhatsAppIcon size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(contact.id)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-rose-500 hover:bg-white hover:text-rose-700 hover:shadow-sm transition-all"
                        aria-label="Delete contact"
                        title="Delete"
                      >
                        <Trash2 size={15} strokeWidth={2.25} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className={PH2_TABLE_CARD_FOOTER_CLASS}>
        <PaginationAll
          initialPage={pagination.page}
          totalPages={Math.max(1, pagination.totalPages)}
          onPageChange={onPageChange}
          totalCount={pagination.total}
          pageSize={pagination.limit}
          pageSizeOptions={onPageSizeChange ? [...TABLE_PAGE_SIZE_OPTIONS] : undefined}
          onPageSizeChange={onPageSizeChange}
          itemLabel="contacts"
        />
      </div>
    </div>
  );
}
