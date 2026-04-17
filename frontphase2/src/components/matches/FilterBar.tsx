import React, { useState } from 'react';
import { ChevronDown, Clock3, DollarSign, Filter, MapPin } from 'lucide-react';
import type { MatchFilters } from './types';

interface FilterBarProps {
  filters: MatchFilters;
  onChange: (filters: MatchFilters) => void;
  onReset: () => void;
}

function FilterDropdown({
  trigger,
  children,
}: {
  trigger: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex min-w-[150px] items-center justify-between gap-3 rounded-xl border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm text-slate-700 transition hover:border-slate-300"
      >
        {trigger}
        <ChevronDown size={14} className="text-slate-400" />
      </button>
      {open ? (
        <div className="absolute left-0 top-[calc(100%+8px)] z-20 min-w-[220px] rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-xl">
          {children}
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
            >
              Done
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function FilterBar({ filters, onChange, onReset }: FilterBarProps) {
  return (
    <div className="border-b border-[#E5E7EB] bg-white px-6 py-4 sm:px-8">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-slate-400" />
          <span className="text-sm font-medium text-slate-700">Filters:</span>
        </div>

        <div className="min-w-[150px]">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
              Skill Match
            </span>
            <span className="text-[11px] font-bold text-[#2563EB]">{filters.skillMatch}%+</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={filters.skillMatch}
            onChange={(event) =>
              onChange({ ...filters, skillMatch: Number(event.target.value) })
            }
            className="h-1.5 w-full cursor-pointer appearance-none rounded-lg accent-[#2563EB]"
          />
        </div>

        <FilterDropdown
          trigger={
            <span className="flex items-center gap-2">
              <Clock3 size={14} className="text-slate-400" />
              Exp: {filters.expMin} - {filters.expMax} yrs
            </span>
          }
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Min</label>
              <input
                type="number"
                min={0}
                max={50}
                value={filters.expMin}
                onChange={(event) =>
                  onChange({ ...filters, expMin: Number(event.target.value || 0) })
                }
                className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#2563EB]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Max</label>
              <input
                type="number"
                min={0}
                max={50}
                value={filters.expMax}
                onChange={(event) =>
                  onChange({ ...filters, expMax: Number(event.target.value || 0) })
                }
                className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#2563EB]"
              />
            </div>
          </div>
        </FilterDropdown>

        <FilterDropdown
          trigger={
            <span className="flex items-center gap-2">
              <MapPin size={14} className="text-slate-400" />
              {filters.location || 'Location'}
            </span>
          }
        >
          <input
            value={filters.location}
            onChange={(event) => onChange({ ...filters, location: event.target.value })}
            placeholder="Search city or country..."
            className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#2563EB]"
          />
        </FilterDropdown>

        <FilterDropdown
          trigger={
            <span className="flex items-center gap-2">
              <DollarSign size={14} className="text-slate-400" />
              Salary
            </span>
          }
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Min</label>
              <input
                type="number"
                value={filters.salaryMin ?? ''}
                onChange={(event) =>
                  onChange({
                    ...filters,
                    salaryMin: event.target.value ? Number(event.target.value) : null,
                  })
                }
                className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#2563EB]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Max</label>
              <input
                type="number"
                value={filters.salaryMax ?? ''}
                onChange={(event) =>
                  onChange({
                    ...filters,
                    salaryMax: event.target.value ? Number(event.target.value) : null,
                  })
                }
                className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#2563EB]"
              />
            </div>
          </div>
        </FilterDropdown>

        <div className="flex flex-wrap gap-2">
          {[
            { label: 'Immediate', value: 'Immediate' },
            { label: '15d', value: '15d' },
            { label: '30d', value: '30d' },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() =>
                onChange({
                  ...filters,
                  noticePeriod:
                    filters.noticePeriod === option.value ? null : (option.value as MatchFilters['noticePeriod']),
                })
              }
              className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                filters.noticePeriod === option.value
                  ? 'border-[#2563EB] bg-blue-50 text-[#2563EB]'
                  : 'border-[#E5E7EB] bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onReset}
          className="ml-auto text-xs font-bold uppercase tracking-wider text-[#2563EB] transition hover:text-blue-800"
        >
          Reset Filters
        </button>
      </div>
    </div>
  );
}
