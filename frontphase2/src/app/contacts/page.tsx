'use client';

import React, { Suspense, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Plus, Upload, Download, RefreshCcw, BookUser } from 'lucide-react';
import { downloadCsv } from '../../utils/csv';
import { ExportColumnsModal } from '../../components/export/ExportColumnsModal';
import { buildContactsCsvColumns, CONTACTS_EXPORT_COLUMNS } from '../../lib/export/contactsExportColumns';
import { fetchAllPaginated, totalPagesFromPagination } from '../../lib/export/fetchAllPaginated';
import { Toaster, toast } from 'sonner';
import {
  apiGetContacts,
  apiGetContact,
  apiGetContactStats,
  apiDeleteContact,
  apiBulkActionContacts,
  type BackendContact,
  type ContactFilters,
  type ContactStats,
} from '../../lib/api';
import { ContactsKPICards } from '../../components/contacts/ContactsKPICards';
import { ContactsFilterBar } from '../../components/contacts/ContactsFilterBar';
import { ContactsTable } from '../../components/contacts/ContactsTable';
import { ContactDetailDrawer } from '../../components/contacts/ContactDetailDrawer';
import { AddContactDrawer } from '../../components/contacts/AddContactDrawer';
import { EditContactDrawer } from '../../components/contacts/EditContactDrawer';
import { ImportContactsDrawer } from '../../components/contacts/ImportContactsDrawer';
import { MergeContactsDrawer } from '../../components/contacts/MergeContactsDrawer';
import { BulkActionsBar } from '../../components/contacts/BulkActionsBar';
import { requestConfirm } from '../../lib/appDialog';
import { usePageAutoRefresh } from '../../hooks/usePageAutoRefresh';
import {
  Ph2ModulePageLayout,
  PH2_TABLE_CARD_CLASS,
} from '../../components/layout/Ph2ModulePageLayout';
import { coerceTablePageSize } from '../../constants/tablePagination';

export const dynamic = 'force-dynamic';

function ContactsPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  const [contacts, setContacts] = useState<BackendContact[]>([]);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportContacts, setExportContacts] = useState<BackendContact[]>([]);
  const [exportContactsLoading, setExportContactsLoading] = useState(false);
  const [stats, setStats] = useState<ContactStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedContact, setSelectedContact] = useState<BackendContact | null>(null);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [isAddDrawerOpen, setIsAddDrawerOpen] = useState(false);
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false);
  const [isImportDrawerOpen, setIsImportDrawerOpen] = useState(false);
  const [isMergeDrawerOpen, setIsMergeDrawerOpen] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const pendingDeepLinkContactIdRef = useRef<string | null>(null);

  // Get filters from URL
  const filters = useMemo<ContactFilters>(() => {
    return {
      contactType: searchParams.get('contactType') || undefined,
      companyId: searchParams.get('companyId') || undefined,
      location: searchParams.get('location') || undefined,
      tags: searchParams.get('tags')?.split(',') || undefined,
      ownerId: searchParams.get('ownerId') || undefined,
      status: searchParams.get('status') || undefined,
      recentlyContacted: (searchParams.get('recentlyContacted') as '7d' | '30d' | 'all') || undefined,
      search: searchParams.get('search') || undefined,
      page: Number(searchParams.get('page')) || 1,
      limit: coerceTablePageSize(searchParams.get('limit'), 10),
    };
  }, [searchParams]);

  const loadContactsData = useCallback(async (options?: { silent?: boolean }) => {
    try {
      if (!options?.silent) {
        setLoading(true);
      }
      const [contactsRes, statsRes] = await Promise.all([
        apiGetContacts(filters),
        apiGetContactStats(),
      ]);

      const contactsPayload = contactsRes?.data;
      const contactsData = Array.isArray(contactsPayload)
        ? contactsPayload
        : (contactsPayload as any)?.data || [];
      const contactsPagination = Array.isArray(contactsPayload)
        ? contactsRes.pagination
        : (contactsPayload as any)?.pagination || contactsRes.pagination;

      setContacts(contactsData);
      if (contactsPagination) {
        setPagination(contactsPagination);
      }

      if (statsRes.data) {
        setStats(statsRes.data);
      }
    } catch (error: any) {
      console.error('Failed to fetch contacts:', error);
      toast.error(error.message || 'Failed to load contacts');
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }, [filters]);

  useEffect(() => {
    const contactId = searchParams.get('contactId');
    if (!contactId) {
      pendingDeepLinkContactIdRef.current = null;
      return;
    }
    // Only react when the URL parameter itself changes. Without this guard,
    // closing the drawer (which clears `selectedContact`) used to re-fire
    // this effect and reopen the same drawer immediately.
    if (pendingDeepLinkContactIdRef.current === contactId) {
      return;
    }
    pendingDeepLinkContactIdRef.current = contactId;

    let cancelled = false;
    void (async () => {
      try {
        const response = await apiGetContact(contactId);
        if (cancelled) return;
        const backendContact = (response as any).data?.data || (response as any).data || response;
        if (!backendContact) return;
        setSelectedContact(backendContact);
      } catch (error) {
        console.error('Failed to open contact from search:', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  const contactMatchesFilters = useCallback(
    (contact: BackendContact) => {
      const search = filters.search?.trim().toLowerCase();
      if (search) {
        const haystack = [
          contact.salutation,
          contact.firstName,
          contact.lastName,
          contact.email,
          contact.phone,
          contact.designation,
          contact.department,
          contact.location,
          contact.company?.companyName,
          contact.status,
          contact.contactType,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(search)) return false;
      }

      if (filters.contactType && contact.contactType !== filters.contactType) return false;
      if (filters.status && contact.status !== filters.status) return false;
      if (filters.companyId && contact.companyId !== filters.companyId) return false;
      if (filters.ownerId && contact.ownerId !== filters.ownerId) return false;
      if (filters.location && String(contact.location || '').toLowerCase() !== filters.location.toLowerCase()) return false;
      return true;
    },
    [filters]
  );

  const applyOptimisticContact = useCallback((contact: BackendContact) => {
    setContacts((current) => [contact, ...current.filter((item) => item.id !== contact.id)]);

    setPagination((current) => {
      const nextTotal = current.total + 1;
      return {
        ...current,
        total: nextTotal,
        totalPages: Math.max(1, Math.ceil(nextTotal / current.limit)),
      };
    });

    setStats((current) => {
      if (!current) return current;
      const next = { ...current, total: current.total + 1 };
      if (contact.contactType === 'CANDIDATE') next.candidates += 1;
      if (contact.contactType === 'CLIENT') next.clientContacts += 1;
      if (contact.contactType === 'HIRING_MANAGER') next.hiringManagers += 1;
      return next;
    });
  }, []);

  const applyOptimisticContactUpdate = useCallback((updatedContact: BackendContact) => {
    setContacts((current) => current.map((contact) => (contact.id === updatedContact.id ? updatedContact : contact)));
    setSelectedContact((current) => (current?.id === updatedContact.id ? updatedContact : current));

    setStats((current) => {
      if (!current) return current;

      const previousType = selectedContact?.id === updatedContact.id ? selectedContact.contactType : undefined;
      const next = { ...current };

      if (previousType && previousType !== updatedContact.contactType) {
        if (previousType === 'CANDIDATE') next.candidates = Math.max(0, next.candidates - 1);
        if (previousType === 'CLIENT') next.clientContacts = Math.max(0, next.clientContacts - 1);
        if (previousType === 'HIRING_MANAGER') next.hiringManagers = Math.max(0, next.hiringManagers - 1);
      }

      if (updatedContact.contactType === 'CANDIDATE') next.candidates += 1;
      if (updatedContact.contactType === 'CLIENT') next.clientContacts += 1;
      if (updatedContact.contactType === 'HIRING_MANAGER') next.hiringManagers += 1;
      return next;
    });
  }, [selectedContact]);

  const applyOptimisticDelete = useCallback((contactId: string) => {
    let removedContact: BackendContact | undefined;

    setContacts((current) => {
      removedContact = current.find((contact) => contact.id === contactId);
      return current.filter((contact) => contact.id !== contactId);
    });

    setSelectedContact((current) => (current?.id === contactId ? null : current));

    setPagination((current) => {
      const nextTotal = Math.max(0, current.total - 1);
      return {
        ...current,
        total: nextTotal,
        totalPages: Math.max(1, Math.ceil(nextTotal / current.limit)),
      };
    });

    setStats((current) => {
      if (!current || !removedContact) return current;
      const next = { ...current, total: Math.max(0, current.total - 1) };
      if (removedContact.contactType === 'CANDIDATE') next.candidates = Math.max(0, next.candidates - 1);
      if (removedContact.contactType === 'CLIENT') next.clientContacts = Math.max(0, next.clientContacts - 1);
      if (removedContact.contactType === 'HIRING_MANAGER') next.hiringManagers = Math.max(0, next.hiringManagers - 1);
      return next;
    });
  }, []);

  // Fetch contacts and stats
  useEffect(() => {
    void loadContactsData();
  }, [loadContactsData]);

  // Reusable auto-refresh — same hook used across the app.
  usePageAutoRefresh(
    ({ silent }) => loadContactsData({ silent }),
    { events: ['jobportal:contacts-changed', 'jobportal:clients-changed'] }
  );

  const updateFilters = (newFilters: Partial<ContactFilters>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        params.delete(key);
      } else if (Array.isArray(value)) {
        params.set(key, value.join(','));
      } else {
        params.set(key, String(value));
      }
    });
    router.push(`/contacts?${params.toString()}`);
  };

  const handleRowClick = async (contact: BackendContact) => {
    setSelectedContact(contact);
  };

  const handleCloseDrawer = () => {
    setSelectedContact(null);
    // If the drawer was opened via a deep-link from the global search, drop
    // the query param so reloads don't reopen the drawer.
    if (searchParams.get('contactId')) {
      const sp = new URLSearchParams(searchParams.toString());
      sp.delete('contactId');
      pendingDeepLinkContactIdRef.current = null;
      const qs = sp.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }
  };

  const handleEdit = (contact: BackendContact) => {
    setSelectedContact(contact);
    setIsEditDrawerOpen(true);
  };

  const handleDelete = async (contactId: string) => {
    if (!(await requestConfirm('Are you sure you want to delete this contact?'))) return;
    applyOptimisticDelete(contactId);
    try {
      await apiDeleteContact(contactId);
      toast.success('Contact deleted successfully');
      void loadContactsData({ silent: true });
    } catch (error: any) {
      void loadContactsData({ silent: true });
      toast.error(error.message || 'Failed to delete contact');
    }
  };

  const handleBulkAction = async (action: string, payload?: any) => {
    if (selectedContactIds.size === 0) return;

    try {
      await apiBulkActionContacts(action, Array.from(selectedContactIds), payload);
      toast.success(`Bulk action completed: ${action}`);
      setSelectedContactIds(new Set());
      await loadContactsData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to perform bulk action');
    }
  };

  const exportFilters = useMemo(() => {
    const { page: _page, limit: _limit, ...rest } = filters;
    return rest;
  }, [filters]);

  const fetchAllContactsForExport = useCallback(async (): Promise<BackendContact[]> => {
    return fetchAllPaginated({
      fetchPage: async (page, limit) => {
        const response = await apiGetContacts({ ...exportFilters, page, limit });
        const payload = response.data;
        const contactsData: BackendContact[] = Array.isArray(payload)
          ? payload
          : (payload as { data?: BackendContact[] })?.data || [];
        const pagination = Array.isArray(payload)
          ? response.pagination
          : (payload as { pagination?: { totalPages?: number; total?: number } })?.pagination ||
            response.pagination;
        return {
          items: contactsData,
          totalPages: totalPagesFromPagination(pagination, contactsData.length, limit),
        };
      },
    });
  }, [exportFilters]);

  const openExportModal = async () => {
    setExportContactsLoading(true);
    setExportModalOpen(true);
    try {
      const all = await fetchAllContactsForExport();
      setExportContacts(all);
      if (all.length === 0) {
        toast.message('No contacts to export with current filters.');
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load contacts for export';
      toast.error(message);
      setExportModalOpen(false);
      setExportContacts([]);
    } finally {
      setExportContactsLoading(false);
    }
  };

  const handleExportContactsCsv = (selectedColumnIds: string[]) => {
    const columns = buildContactsCsvColumns(selectedColumnIds);
    if (columns.length === 0) {
      toast.message('Select at least one column to export.');
      return;
    }
    const rowsToExport = exportContacts.length > 0 ? exportContacts : contacts;
    if (rowsToExport.length === 0) {
      toast.message('No contacts to export with current filters.');
      return;
    }
    downloadCsv<BackendContact>(
      `contacts-export-${new Date().toISOString().split('T')[0]}.csv`,
      columns,
      rowsToExport,
    );
    toast.success(`Exported ${rowsToExport.length} contact${rowsToExport.length === 1 ? '' : 's'} to CSV`);
  };

  return (
    <>
      <Toaster position="top-right" richColors />
      <Ph2ModulePageLayout
        title="Contacts"
        subtitle="Manage client stakeholders, vendors, and hiring partners."
        icon={<BookUser className="h-5 w-5" strokeWidth={2.2} />}
        actions={
          <>
            <button
              type="button"
              onClick={() => void loadContactsData()}
              disabled={loading}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-indigo-200/80 bg-white text-indigo-700 shadow-[0_4px_14px_-4px_rgba(99,102,241,0.2)] transition-all hover:border-indigo-300 hover:bg-indigo-50/90 active:scale-[0.98] disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCcw size={16} strokeWidth={2.25} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              type="button"
              onClick={() => void openExportModal()}
              className="bg-white hover:bg-indigo-50/90 text-indigo-900 px-3 py-2 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-all shadow-[0_4px_14px_-4px_rgba(99,102,241,0.25)] border border-indigo-200/70 hover:border-indigo-300 hover:shadow-[0_6px_20px_-4px_rgba(99,102,241,0.35)] active:scale-[0.98]"
              title="Export contacts to CSV"
            >
              <Download size={16} className="text-indigo-600" strokeWidth={2.25} />
              <span>Export</span>
            </button>
            <button
              type="button"
              onClick={() => setIsImportDrawerOpen(true)}
              className="bg-white hover:bg-indigo-50/90 text-indigo-900 px-3 py-2 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-all shadow-[0_4px_14px_-4px_rgba(99,102,241,0.25)] border border-indigo-200/70 hover:border-indigo-300 hover:shadow-[0_6px_20px_-4px_rgba(99,102,241,0.35)] active:scale-[0.98]"
            >
              <Upload size={16} className="text-indigo-600" strokeWidth={2.25} />
              <span>Import</span>
            </button>
            <button
              type="button"
              onClick={() => setIsAddDrawerOpen(true)}
              className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-700 hover:via-indigo-700 hover:to-violet-700 text-white px-3.5 py-2 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-all shadow-lg shadow-indigo-500/30 active:scale-[0.98]"
            >
              <Plus size={16} className="text-white" strokeWidth={2.5} />
              <span>Add Contact</span>
            </button>
          </>
        }
        belowScroll={
          <>
            <ContactDetailDrawer
              contact={selectedContact}
              isOpen={Boolean(selectedContact) && !isEditDrawerOpen}
              onClose={handleCloseDrawer}
              onEdit={() => setIsEditDrawerOpen(true)}
              onDelete={handleDelete}
            />

            <AddContactDrawer
              isOpen={isAddDrawerOpen}
              onClose={() => setIsAddDrawerOpen(false)}
              onSuccess={async (contact) => {
                setIsAddDrawerOpen(false);
                if (contact && contactMatchesFilters(contact)) {
                  applyOptimisticContact(contact);
                }
                void loadContactsData({ silent: true });
              }}
            />

            <EditContactDrawer
              contact={selectedContact}
              isOpen={isEditDrawerOpen}
              onClose={() => {
                setIsEditDrawerOpen(false);
                setSelectedContact(null);
              }}
              onSuccess={async (contact) => {
                setIsEditDrawerOpen(false);
                toast.success('Contact updated successfully');
                if (contact) {
                  applyOptimisticContactUpdate(contact);
                }
                void loadContactsData({ silent: true });
              }}
            />

            <ImportContactsDrawer
              isOpen={isImportDrawerOpen}
              onClose={() => setIsImportDrawerOpen(false)}
              onSuccess={async () => {
                setIsImportDrawerOpen(false);
                await loadContactsData();
              }}
            />

            <MergeContactsDrawer
              isOpen={isMergeDrawerOpen}
              onClose={() => setIsMergeDrawerOpen(false)}
              onSuccess={async () => {
                setIsMergeDrawerOpen(false);
                toast.success('Contacts merged successfully');
                await loadContactsData();
              }}
            />
          </>
        }
      >
        {stats ? (
          <div className="mb-5">
            <ContactsKPICards stats={stats} />
          </div>
        ) : null}

        <div className={PH2_TABLE_CARD_CLASS}>
          <div className="border-b border-indigo-100/40 bg-gradient-to-br from-white via-indigo-50/25 to-violet-50/20 p-3 sm:p-4">
            <ContactsFilterBar
              embedded
              filters={filters}
              totalCount={pagination.total}
              onFilterChange={updateFilters}
              onClearFilters={() => router.push('/contacts')}
            />
          </div>

          <ContactsTable
            contacts={contacts}
            loading={loading}
            selectedIds={selectedContactIds}
            onSelectIds={setSelectedContactIds}
            onRowClick={handleRowClick}
            onEdit={handleEdit}
            onDelete={handleDelete}
            pagination={pagination}
            onPageChange={(page) => updateFilters({ page, limit: pagination.limit })}
            onPageSizeChange={(limit) => updateFilters({ page: 1, limit })}
          />
        </div>
      </Ph2ModulePageLayout>

      {selectedContactIds.size > 0 ? (
        <div className="fixed bottom-6 left-1/2 z-40 w-[min(94vw,980px)] max-h-[min(42vh,420px)] -translate-x-1/2 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950/95 px-4 py-3 text-white shadow-2xl backdrop-blur">
          <BulkActionsBar
            selectedCount={selectedContactIds.size}
            onBulkAction={handleBulkAction}
            onClearSelection={() => setSelectedContactIds(new Set())}
            variant="compact"
          />
        </div>
      ) : null}

      <ExportColumnsModal
        isOpen={exportModalOpen}
        onClose={() => {
          setExportModalOpen(false);
          setExportContacts([]);
        }}
        title="Export contacts"
        rowCount={exportContacts.length}
        rowLabelSingular="contact"
        rowLabelPlural="contacts"
        columns={CONTACTS_EXPORT_COLUMNS}
        rows={exportContacts}
        isLoading={exportContactsLoading}
        getRowKey={(contact) => contact.id}
        onExport={handleExportContactsCsv}
      />
    </>
  );
}

export default function ContactsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">Loading contacts...</div>}>
      <ContactsPageContent />
    </Suspense>
  );
}
