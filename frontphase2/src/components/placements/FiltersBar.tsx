'use client';

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, Filter, Search, SlidersHorizontal, X } from 'lucide-react';
import type { PlacementFilters } from '../../types/placement';
import { PH2_TOOLBAR_SELECT_CLASS } from '../layout/Ph2ModulePageLayout';
import { ALL_STATUS_LABEL } from '../../constants/filterLabels';

interface FiltersBarProps {
  filters: PlacementFilters;
  searchValue: string;
  clientOptions: Array<{ id: string; companyName: string }>;
  recruiterOptions: Array<{ id: string; name: string; email: string }>;
  onSearchChange: (value: string) => void;
  onFilterChange: (patch: Partial<PlacementFilters>) => void;
  onReset: () => void;
  /** Leads-style table card: transparent shell, compact controls, summary row. */
  embedded?: boolean;
  /** Shown in embedded footer next to reset (e.g. API total count). */
  totalCount?: number;
}

const statusOptions = [
  { value: '', label: ALL_STATUS_LABEL },
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
  embedded = false,
}: {
  value?: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  className?: string;
  embedded?: boolean;
}) {
  return (
    <div className={`relative ${className}`}>
      <select
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
        className={
          embedded
            ? `${PH2_TOOLBAR_SELECT_CLASS} h-9 w-full pr-8 text-xs`
            : 'h-11 w-full appearance-none rounded-xl border border-[#D1D5DB] bg-white px-3 pr-9 text-sm text-[#111827] outline-none focus:border-[#2563EB]'
        }
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className={`pointer-events-none absolute top-1/2 -translate-y-1/2 ${
          embedded ? 'right-2.5 h-3.5 w-3.5 text-indigo-400' : 'right-3 h-4 w-4 text-[#6B7280]'
        }`}
      />
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
  embedded = false,
  totalCount,
}: FiltersBarProps) {
  const [moreOpen, setMoreOpen] = useState(false);

  const hasActiveFilters = Boolean(
    (searchValue && searchValue.trim()) ||
      filters.status ||
      filters.companyId ||
      filters.recruiterId ||
      filters.employmentType ||
      filters.offerDateFrom ||
      filters.offerDateTo ||
      filters.joiningDateFrom ||
      filters.joiningDateTo ||
      filters.revenueMin ||
      filters.revenueMax ||
      filters.feeMin ||
      filters.feeMax
  );

  const shellClass = embedded
    ? 'space-y-3 border-0 bg-transparent p-0 shadow-none'
    : 'space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm';

  const searchInputClass = embedded
    ? 'h-9 w-full rounded-xl border border-indigo-100/90 bg-white/95 pl-10 pr-3 text-xs text-slate-800 shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] placeholder:text-slate-400 transition-all focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30'
    : 'h-11 w-full rounded-xl border border-[#D1D5DB] bg-white pl-10 pr-4 text-sm outline-none focus:border-[#2563EB]';

  const nativeSelectClass = embedded
    ? `${PH2_TOOLBAR_SELECT_CLASS} h-9 w-full appearance-none pr-8 text-xs`
    : 'h-11 w-full appearance-none rounded-xl border border-[#D1D5DB] bg-white px-3 pr-9 text-sm outline-none focus:border-[#2563EB]';

  const dateInputClass = embedded
    ? 'h-9 rounded-lg border border-indigo-100/90 bg-white/95 px-2.5 text-xs text-slate-800 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/20'
    : 'h-11 rounded-xl border border-[#D1D5DB] px-3 text-sm outline-none focus:border-[#2563EB]';

  const moreBtnClass =
    'inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#D1D5DB] px-4 text-sm font-medium text-[#374151] hover:bg-[#F9FAFB]';

  return (
    <>
      <div className={shellClass}>
        <div
          className={
            embedded
              ? 'grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1.3fr)_repeat(4,minmax(120px,1fr))]'
              : 'grid gap-3 xl:grid-cols-[minmax(280px,1.4fr)_repeat(4,minmax(150px,1fr))_auto]'
          }
        >
          <div className="relative">
            <Search
              className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${embedded ? 'h-4 w-4 text-indigo-400' : 'h-4 w-4 text-[#9CA3AF]'}`}
            />
            <input
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search candidate, company or job..."
              className={searchInputClass}
            />
          </div>

          <Select
            value={filters.status}
            onChange={(value) => onFilterChange({ status: value as any })}
            options={statusOptions as any}
            embedded={embedded}
          />

          <div className="relative">
            <select
              value={filters.companyId || ''}
              onChange={(event) => onFilterChange({ companyId: event.target.value })}
              className={nativeSelectClass}
            >
              <option value="">All Clients</option>
              {clientOptions.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.companyName}
                </option>
              ))}
            </select>
            <ChevronDown
              className={`pointer-events-none absolute top-1/2 -translate-y-1/2 ${
                embedded ? 'right-2.5 h-3.5 w-3.5 text-indigo-400' : 'right-3 h-4 w-4 text-[#6B7280]'
              }`}
            />
          </div>

          <Select
            value={filters.employmentType}
            onChange={(value) => onFilterChange({ employmentType: value as any })}
            options={typeOptions as any}
            embedded={embedded}
          />

          <div className={`grid gap-2 ${embedded ? 'grid-cols-2' : 'grid-cols-2 gap-2'}`}>
            <input
              type="date"
              value={filters.offerDateFrom || ''}
              onChange={(event) => onFilterChange({ offerDateFrom: event.target.value })}
              className={dateInputClass}
            />
            <input
              type="date"
              value={filters.offerDateTo || ''}
              onChange={(event) => onFilterChange({ offerDateTo: event.target.value })}
              className={dateInputClass}
            />
          </div>

          {!embedded ? (
            <button type="button" onClick={() => setMoreOpen(true)} className={moreBtnClass}>
              <SlidersHorizontal className="h-4 w-4" />
              More Filters
            </button>
          ) : null}
        </div>

        <div
          className={`flex items-center justify-between ${embedded ? 'pt-1' : ''}`}
        >
          {!embedded ? (
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
              <Filter className="h-4 w-4" />
              Filters
            </div>
          ) : (
            <span />
          )}
          <div className="flex flex-wrap items-center gap-2">
            {embedded && totalCount !== undefined ? (
              <span className="text-[11px] font-medium text-slate-500">
                Total: <span className="font-semibold text-slate-800">{totalCount.toLocaleString()}</span>
              </span>
            ) : null}
            {embedded && hasActiveFilters ? (
              <button
                type="button"
                onClick={onReset}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50 hover:text-rose-700"
              >
                <X className="h-3.5 w-3.5 shrink-0 text-rose-500" />
                Clear filters
              </button>
            ) : null}
            {!embedded ? (
              <button type="button" onClick={onReset} className="text-sm font-medium text-[#2563EB] hover:text-[#1D4ED8]">
                Reset Filters
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {!embedded ? (
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
                    <label className="mb-1.5 block text-sm font-medium text-[#111827]">Team Member</label>
                    <div className="relative">
                      <select
                        value={filters.recruiterId || ''}
                        onChange={(event) => onFilterChange({ recruiterId: event.target.value })}
                        className="h-11 w-full appearance-none rounded-xl border border-[#D1D5DB] bg-white px-3 pr-9 text-sm outline-none focus:border-[#2563EB]"
                      >
                        <option value="">All team members</option>
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
      ) : null}
    </>
  );
}
