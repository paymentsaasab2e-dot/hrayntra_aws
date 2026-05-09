'use client';

import React, { Suspense, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Upload, Download, CheckSquare, MoreVertical } from 'lucide-react';
import { downloadCsv } from '../../utils/csv';
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

export const dynamic = 'force-dynamic';

function ContactsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [contacts, setContacts] = useState<BackendContact[]>([]);
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
      limit: Number(searchParams.get('limit')) || 10,
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
    if (pendingDeepLinkContactIdRef.current === contactId && selectedContact?.id === contactId) {
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
  }, [searchParams, selectedContact?.id]);

  const contactMatchesFilters = useCallback(
    (contact: BackendContact) => {
      const search = filters.search?.trim().toLowerCase();
      if (search) {
        const haystack = [
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

  const handleExport = async () => {
    try {
      const response = await apiGetContacts({ ...filters, limit: 10000 });
      const contactsData: BackendContact[] = Array.isArray(response.data)
        ? response.data
        : response.data?.data || [];

      if (contactsData.length === 0) {
        toast.message('No contacts to export with current filters.');
        return;
      }

      downloadCsv<BackendContact>(
        `contacts-export-${new Date().toISOString().split('T')[0]}.csv`,
        [
          { id: 'firstName', accessor: (c) => c.firstName || '' },
          { id: 'lastName', accessor: (c) => c.lastName || '' },
          { id: 'email', accessor: (c) => c.email || '' },
          { id: 'phone', accessor: (c) => c.phone || '' },
          { id: 'company', accessor: (c) => c.company?.companyName || '' },
          { id: 'designation', accessor: (c) => c.designation || '' },
          { id: 'contactType', accessor: (c) => c.contactType || '' },
          { id: 'status', accessor: (c) => c.status || '' },
          { id: 'location', accessor: (c) => c.location || '' },
        ],
        contactsData,
      );
      toast.success(`Exported ${contactsData.length} contact${contactsData.length === 1 ? '' : 's'} to CSV`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to export contacts');
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FB]">
      <Toaster position="top-right" richColors />
      
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
            <p className="text-sm text-gray-500 mt-1">Manage client stakeholders, vendors, and hiring partners.</p>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsImportDrawerOpen(true)}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors"
            >
              <Upload size={16} />
              Import
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors"
            >
              <Download size={16} />
              Export
            </button>
            <button
              onClick={() => setIsAddDrawerOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
            >
              <Plus size={18} />
              Add Contact
            </button>
          </div>
        </div>
      </div>

      <div className="p-8 space-y-6">
        {/* KPI Cards */}
        {stats && <ContactsKPICards stats={stats} />}

        {/* Filters */}
        <ContactsFilterBar
          filters={filters}
          totalCount={pagination.total}
          onFilterChange={updateFilters}
          onClearFilters={() => router.push('/contacts')}
        />

        {/* Bulk Actions Bar */}
        {selectedContactIds.size > 0 && (
          <BulkActionsBar
            selectedCount={selectedContactIds.size}
            onBulkAction={handleBulkAction}
            onClearSelection={() => setSelectedContactIds(new Set())}
          />
        )}

        {/* Table */}
        <ContactsTable
          contacts={contacts}
          loading={loading}
          selectedIds={selectedContactIds}
          onSelectIds={setSelectedContactIds}
          onRowClick={handleRowClick}
          onEdit={handleEdit}
          onDelete={handleDelete}
          pagination={pagination}
          onPageChange={(page) => updateFilters({ page, limit: 10 })}
        />
      </div>

      {/* Drawers */}
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
          toast.success('Contacts imported successfully');
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
    </div>
  );
}

export default function ContactsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F8F9FB] flex items-center justify-center text-gray-500">Loading contacts...</div>}>
      <ContactsPageContent />
    </Suspense>
  );
}
