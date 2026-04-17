'use client';

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, Filter, Search, SlidersHorizontal, X } from 'lucide-react';
import type { PlacementFilters } from '../../types/placement';

interface FiltersBarProps {
  filters: PlacementFilters;
  searchValue: string;
  clientOptions: Array<{ id: string; companyName: string }>;
  recruiterOptions: Array<{ id: string; name: string; email: string }>;
  onSearchChange: (value: string) => void;
  onFilterChange: (patch: Partial<PlacementFilters>) => void;
  onReset: () => void;
}

const statusOptions = [
  { value: '', label: 'All Status' },
  { value: 'OFFER_ACCEPTED', label: 'Offer Accepted' },
  { value: 'JOINING_SCHEDULED', label: 'Joining Scheduled' },
  { value: 'JOINED', label: 'Joined' },
  { value: 'NO_SHOW', label: 'No Show' },
  { value: 'WITHDRAWN', label: 'Withdrawn' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'REPLACEMENT_REQUIRED', label: 'Replacement Required' },
] as const;

const typeOptions = [
  { value: '', label: 'All Types' },
  { value: 'PERMANENT', label: 'Permanent' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'FREELANCE', label: 'Freelance' },
] as const;

function Select({
  value,
  onChange,
  options,
  className = '',
}: {
  value?: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <select
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full appearance-none rounded-xl border border-[#D1D5DB] bg-white px-3 pr-9 text-sm text-[#111827] outline-none focus:border-[#2563EB]"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
    </div>
  );
}

export function FiltersBar({
  filters,
  searchValue,
  clientOptions,
  recruiterOptions,
  onSearchChange,
  onFilterChange,
  onReset,
}: FiltersBarProps) {
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 xl:grid-cols-[minmax(280px,1.4fr)_repeat(4,minmax(150px,1fr))_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
            <input
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search candidate, company or job..."
              className="h-11 w-full rounded-xl border border-[#D1D5DB] bg-white pl-10 pr-4 text-sm outline-none focus:border-[#2563EB]"
            />
          </div>

          <Select value={filters.status} onChange={(value) => onFilterChange({ status: value as any })} options={statusOptions as any} />

          <div className="relative">
            <select
              value={filters.companyId || ''}
              onChange={(event) => onFilterChange({ companyId: event.target.value })}
              className="h-11 w-full appearance-none rounded-xl border border-[#D1D5DB] bg-white px-3 pr-9 text-sm outline-none focus:border-[#2563EB]"
            >
              <option value="">All Clients</option>
              {clientOptions.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.companyName}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
          </div>

          <Select
            value={filters.employmentType}
            onChange={(value) => onFilterChange({ employmentType: value as any })}
            options={typeOptions as any}
          />

          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={filters.offerDateFrom || ''}
              onChange={(event) => onFilterChange({ offerDateFrom: event.target.value })}
              className="h-11 rounded-xl border border-[#D1D5DB] px-3 text-sm outline-none focus:border-[#2563EB]"
            />
            <input
              type="date"
              value={filters.offerDateTo || ''}
              onChange={(event) => onFilterChange({ offerDateTo: event.target.value })}
              className="h-11 rounded-xl border border-[#D1D5DB] px-3 text-sm outline-none focus:border-[#2563EB]"
            />
          </div>

          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#D1D5DB] px-4 text-sm font-medium text-[#374151] hover:bg-[#F9FAFB]"
          >
            <SlidersHorizontal className="h-4 w-4" />
            More Filters
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
            <Filter className="h-4 w-4" />
            Filters
          </div>
          <button
            type="button"
            onClick={onReset}
            className="text-sm font-medium text-[#2563EB] hover:text-[#1D4ED8]"
          >
            Reset Filters
          </button>
        </div>
      </div>

      <AnimatePresence>
        {moreOpen ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-slate-900/40"
              onClick={() => setMoreOpen(false)}
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.22 }}
              className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-[#E5E7EB] px-5 py-4">
                <div>
                  <h3 className="text-lg font-semibold text-[#111827]">More Filters</h3>
                  <p className="text-sm text-[#6B7280]">Refine placements using recruiter, fee, revenue, and joining date.</p>
                </div>
                <button type="button" onClick={() => setMoreOpen(false)} className="rounded-full p-2 hover:bg-slate-100">
                  <X className="h-4 w-4 text-[#6B7280]" />
                </button>
              </div>

              <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[#111827]">Recruiter</label>
                  <div className="relative">
                    <select
                      value={filters.recruiterId || ''}
                      onChange={(event) => onFilterChange({ recruiterId: event.target.value })}
                      className="h-11 w-full appearance-none rounded-xl border border-[#D1D5DB] bg-white px-3 pr-9 text-sm outline-none focus:border-[#2563EB]"
                    >
                      <option value="">All Recruiters</option>
                      {recruiterOptions.map((recruiter) => (
                        <option key={recruiter.id} value={recruiter.id}>
                          {recruiter.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[#111827]">Revenue Range</label>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="number"
                      placeholder="Min"
                      value={filters.revenueMin || ''}
                      onChange={(event) => onFilterChange({ revenueMin: event.target.value })}
                      className="h-11 rounded-xl border border-[#D1D5DB] px-3 text-sm outline-none focus:border-[#2563EB]"
                    />
                    <input
                      type="number"
                      placeholder="Max"
                      value={filters.revenueMax || ''}
                      onChange={(event) => onFilterChange({ revenueMax: event.target.value })}
                      className="h-11 rounded-xl border border-[#D1D5DB] px-3 text-sm outline-none focus:border-[#2563EB]"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[#111827]">Placement Fee Range</label>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="number"
                      placeholder="Min"
                      value={filters.feeMin || ''}
                      onChange={(event) => onFilterChange({ feeMin: event.target.value })}
                      className="h-11 rounded-xl border border-[#D1D5DB] px-3 text-sm outline-none focus:border-[#2563EB]"
                    />
                    <input
                      type="number"
                      placeholder="Max"
                      value={filters.feeMax || ''}
                      onChange={(event) => onFilterChange({ feeMax: event.target.value })}
                      className="h-11 rounded-xl border border-[#D1D5DB] px-3 text-sm outline-none focus:border-[#2563EB]"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[#111827]">Joining Date Range</label>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="date"
                      value={filters.joiningDateFrom || ''}
                      onChange={(event) => onFilterChange({ joiningDateFrom: event.target.value })}
                      className="h-11 rounded-xl border border-[#D1D5DB] px-3 text-sm outline-none focus:border-[#2563EB]"
                    />
                    <input
                      type="date"
                      value={filters.joiningDateTo || ''}
                      onChange={(event) => onFilterChange({ joiningDateTo: event.target.value })}
                      className="h-11 rounded-xl border border-[#D1D5DB] px-3 text-sm outline-none focus:border-[#2563EB]"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-[#E5E7EB] px-5 py-4">
                <button
                  type="button"
                  onClick={onReset}
                  className="rounded-xl border border-[#D1D5DB] px-4 py-2 text-sm font-medium text-[#374151] hover:bg-[#F9FAFB]"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => setMoreOpen(false)}
                  className="rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1D4ED8]"
                >
                  Apply Filters
                </button>
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}
