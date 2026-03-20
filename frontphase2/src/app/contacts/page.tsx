'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Upload, Download, CheckSquare, MoreVertical } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import {
  apiGetContacts,
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

export default function ContactsPage() {
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
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });

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
      limit: Number(searchParams.get('limit')) || 20,
    };
  }, [searchParams]);

  // Fetch contacts and stats
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [contactsRes, statsRes] = await Promise.all([
          apiGetContacts(filters),
          apiGetContactStats(),
        ]);

        if (contactsRes.data) {
          const contactsData = Array.isArray(contactsRes.data) ? contactsRes.data : contactsRes.data.data || [];
          setContacts(contactsData);
          if (contactsRes.pagination) {
            setPagination(contactsRes.pagination);
          }
        }

        if (statsRes.data) {
          setStats(statsRes.data);
        }
      } catch (error: any) {
        console.error('Failed to fetch contacts:', error);
        toast.error(error.message || 'Failed to load contacts');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [filters]);

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
    if (!confirm('Are you sure you want to delete this contact?')) return;
    try {
      await apiDeleteContact(contactId);
      toast.success('Contact deleted successfully');
      // Refresh contacts
      const response = await apiGetContacts(filters);
      if (response.data) {
        const contactsData = Array.isArray(response.data) ? response.data : response.data.data || [];
        setContacts(contactsData);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete contact');
    }
  };

  const handleBulkAction = async (action: string, payload?: any) => {
    if (selectedContactIds.size === 0) return;

    try {
      await apiBulkActionContacts(action, Array.from(selectedContactIds), payload);
      toast.success(`Bulk action completed: ${action}`);
      setSelectedContactIds(new Set());
      // Refresh contacts
      const response = await apiGetContacts(filters);
      if (response.data) {
        const contactsData = Array.isArray(response.data) ? response.data : response.data.data || [];
        setContacts(contactsData);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to perform bulk action');
    }
  };

  const handleExport = async () => {
    try {
      const response = await apiGetContacts({ ...filters, limit: 10000 });
      const contactsData = Array.isArray(response.data) ? response.data : response.data?.data || [];
      
      // Convert to CSV
      const headers = ['Name', 'Email', 'Phone', 'Company', 'Designation', 'Contact Type', 'Status', 'Location'];
      const rows = contactsData.map((c: BackendContact) => [
        `${c.firstName} ${c.lastName}`,
        c.email || '',
        c.phone || '',
        c.company?.companyName || '',
        c.designation || '',
        c.contactType,
        c.status,
        c.location || '',
      ]);
      
      const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `contacts-export-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      
      toast.success('Contacts exported successfully');
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
          onPageChange={(page) => updateFilters({ page })}
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
        onSuccess={async () => {
          setIsAddDrawerOpen(false);
          toast.success('Contact created successfully');
          const response = await apiGetContacts(filters);
          if (response.data) {
            const contactsData = Array.isArray(response.data) ? response.data : response.data.data || [];
            setContacts(contactsData);
          }
        }}
      />

      <EditContactDrawer
        contact={selectedContact}
        isOpen={isEditDrawerOpen}
        onClose={() => {
          setIsEditDrawerOpen(false);
          setSelectedContact(null);
        }}
        onSuccess={async () => {
          setIsEditDrawerOpen(false);
          setSelectedContact(null);
          toast.success('Contact updated successfully');
          const response = await apiGetContacts(filters);
          if (response.data) {
            const contactsData = Array.isArray(response.data) ? response.data : response.data.data || [];
            setContacts(contactsData);
          }
        }}
      />

      <ImportContactsDrawer
        isOpen={isImportDrawerOpen}
        onClose={() => setIsImportDrawerOpen(false)}
        onSuccess={async () => {
          setIsImportDrawerOpen(false);
          toast.success('Contacts imported successfully');
          const response = await apiGetContacts(filters);
          if (response.data) {
            const contactsData = Array.isArray(response.data) ? response.data : response.data.data || [];
            setContacts(contactsData);
          }
        }}
      />

      <MergeContactsDrawer
        isOpen={isMergeDrawerOpen}
        onClose={() => setIsMergeDrawerOpen(false)}
        onSuccess={async () => {
          setIsMergeDrawerOpen(false);
          toast.success('Contacts merged successfully');
          const response = await apiGetContacts(filters);
          if (response.data) {
            const contactsData = Array.isArray(response.data) ? response.data : response.data.data || [];
            setContacts(contactsData);
          }
        }}
      />
    </div>
  );
}
