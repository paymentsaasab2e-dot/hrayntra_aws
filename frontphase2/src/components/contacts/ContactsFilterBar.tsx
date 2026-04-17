'use client';

import React, { useState, useEffect } from 'react';
import { ChevronDown, X, Filter } from 'lucide-react';
import type { ContactFilters } from '../../lib/api';
import { apiGetClients, apiGetUsers } from '../../lib/api';

interface ContactsFilterBarProps {
  filters: ContactFilters;
  totalCount: number;
  onFilterChange: (filters: Partial<ContactFilters>) => void;
  onClearFilters: () => void;
}

export function ContactsFilterBar({ filters, totalCount, onFilterChange, onClearFilters }: ContactsFilterBarProps) {
  const [clients, setClients] = useState<Array<{ id: string; companyName: string }>>([]);
  const [owners, setOwners] = useState<Array<{ id: string; name: string }>>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState<string | null>(null);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [clientsRes, ownersRes] = await Promise.all([
          apiGetClients({ type: 'client' }),
          apiGetUsers({ role: 'RECRUITER' }),
        ]);

        if (clientsRes.data) {
          const clientsData = Array.isArray(clientsRes.data) ? clientsRes.data : clientsRes.data.data || [];
          setClients(clientsData.map((c: any) => ({ id: c.id, companyName: c.companyName || c.name })));
        }

        if (ownersRes.data) {
          const ownersData = Array.isArray(ownersRes.data) ? ownersRes.data : ownersRes.data.data || [];
          setOwners(ownersData.map((u: any) => ({ id: u.id, name: u.name })));
        }
      } catch (error) {
        console.error('Failed to fetch filter options:', error);
      }
    };

    fetchOptions();
  }, []);

  const contactTypes = [
    { value: 'CANDIDATE', label: 'Candidate' },
    { value: 'CLIENT', label: 'Client' },
    { value: 'HIRING_MANAGER', label: 'Hiring Manager' },
    { value: 'INTERVIEWER', label: 'Interviewer' },
    { value: 'VENDOR', label: 'Vendor' },
    { value: 'DECISION_MAKER', label: 'Decision Maker' },
    { value: 'FINANCE', label: 'Finance' },
  ];

  const statuses = [
    { value: 'ACTIVE', label: 'Active' },
    { value: 'INACTIVE', label: 'Inactive' },
  ];

  const recentlyContactedOptions = [
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' },
    { value: 'all', label: 'All Time' },
  ];

  const FilterDropdown = ({ label, value, options, onSelect }: {
    label: string;
    value?: string;
    options: Array<{ value: string; label: string }>;
    onSelect: (value: string) => void;
  }) => {
    const displayValue = options.find(o => o.value === value)?.label || 'All';
    const isOpen = isDropdownOpen === label;

    return (
      <div className="relative">
        <button
          onClick={() => setIsDropdownOpen(isOpen ? null : label)}
          className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-md text-xs font-medium text-gray-600 hover:border-gray-300 transition-colors"
        >
          <span className="text-gray-400 font-normal">{label}:</span>
          <span className="text-gray-900">{displayValue}</span>
          <ChevronDown size={14} className="text-gray-400" />
        </button>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setIsDropdownOpen(null)} />
            <div className="absolute top-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-20 min-w-[200px]">
              {options.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    onSelect(option.value);
                    setIsDropdownOpen(null);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 ${
                    value === option.value ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-gray-400 mr-2">
            <Filter size={14} className="text-gray-300" />
            <span className="text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">Filter By:</span>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            <FilterDropdown
              label="Company / Client"
              value={filters.companyId}
              options={[
                { value: '', label: 'All Companies' },
                ...clients.map(c => ({ value: c.id, label: c.companyName })),
              ]}
              onSelect={(value) => onFilterChange({ companyId: value || undefined })}
            />
            
            <FilterDropdown
              label="Contact Type"
              value={filters.contactType}
              options={[
                { value: '', label: 'All Types' },
                ...contactTypes,
              ]}
              onSelect={(value) => onFilterChange({ contactType: value || undefined })}
            />
            
            <FilterDropdown
              label="Status"
              value={filters.status}
              options={[
                { value: '', label: 'All Status' },
                ...statuses,
              ]}
              onSelect={(value) => onFilterChange({ status: value || undefined })}
            />
            
            <FilterDropdown
              label="Owner"
              value={filters.ownerId}
              options={[
                { value: '', label: 'All Owners' },
                ...owners.map(o => ({ value: o.id, label: o.name })),
              ]}
              onSelect={(value) => onFilterChange({ ownerId: value || undefined })}
            />
            
            <FilterDropdown
              label="Recently Contacted"
              value={filters.recentlyContacted}
              options={recentlyContactedOptions}
              onSelect={(value) => onFilterChange({ recentlyContacted: value as '7d' | '30d' | 'all' })}
            />
          </div>
        </div>
        
        <div className="flex items-center gap-4 shrink-0">
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">
            <span className="text-gray-900">{totalCount}</span> Contacts Found
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-gray-100 pt-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search by name, email, company..."
            value={filters.search || ''}
            onChange={(e) => {
              const timeout = setTimeout(() => {
                onFilterChange({ search: e.target.value || undefined });
              }, 300);
              return () => clearTimeout(timeout);
            }}
            className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-md text-xs w-64 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
          />
        </div>

        <button
          onClick={onClearFilters}
          className="flex items-center gap-1.5 px-3 py-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg text-xs font-semibold transition-all"
        >
          <X size={14} />
          Clear All
        </button>
      </div>
    </div>
  );
}
