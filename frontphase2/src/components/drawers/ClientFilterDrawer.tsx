import React, { useEffect, useState } from 'react';
import { X, Filter, ChevronDown, Calendar, Search } from 'lucide-react';
import type { Client, ClientPriority, ClientStage } from '../../app/client/types';
import type { ClientPageFieldVisibility } from '../../lib/clientPageFieldVisibility';

/** Persisted filter state. `null` / empty / 'All' means "no filter for that field". */
export interface ClientFilters {
  industry: string;
  location: string;
  ownerScope: 'all' | 'me';
  openJobsMin: number | null;
  openJobsMax: number | null;
  lastActivity: 'any' | '24h' | '7d' | '30d' | 'over30d';
  priority: ClientPriority | 'All';
  stage: ClientStage | 'All';
}

export const DEFAULT_CLIENT_FILTERS: ClientFilters = {
  industry: 'All Industries',
  location: '',
  ownerScope: 'all',
  openJobsMin: null,
  openJobsMax: null,
  lastActivity: 'any',
  priority: 'All',
  stage: 'All',
};

interface ClientFilterDrawerProps {
  isOpen: boolean;
  /** Persisted filters from the parent. Drawer hydrates a draft from these on open. */
  value: ClientFilters;
  /** Industries discovered in the current data set, fed into the dropdown so the
   *  options stay relevant to what the user can actually pick. */
  industryOptions?: string[];
  /** Current logged-in user's display name — used to filter "Me only" */
  currentUserName?: string;
  fieldVisibility?: ClientPageFieldVisibility;
  onClose: () => void;
  onApply: (filters: ClientFilters) => void;
}

const FALLBACK_INDUSTRIES = [
  'Tech & Software',
  'Fintech',
  'Healthcare',
  'Creative & Design',
];

const LAST_ACTIVITY_OPTIONS: Array<{ value: ClientFilters['lastActivity']; label: string }> = [
  { value: 'any', label: 'Any time' },
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'over30d', label: 'Over 30 days' },
];

export function ClientFilterDrawer({
  isOpen,
  value,
  industryOptions,
  currentUserName,
  fieldVisibility,
  onClose,
  onApply,
}: ClientFilterDrawerProps) {
  const showStatusFilter = fieldVisibility?.status === true;
  const showInterestFilter = fieldVisibility?.interestLevel === true;
  const showOwnerFilter = fieldVisibility?.assignedTo === true;
  // Local draft so cancelling/discarding doesn't mutate parent state.
  const [draft, setDraft] = useState<ClientFilters>(value);

  useEffect(() => {
    if (isOpen) {
      setDraft(value);
    }
  }, [isOpen, value]);

  if (!isOpen) return null;

  const industries = (industryOptions && industryOptions.length
    ? industryOptions
    : FALLBACK_INDUSTRIES);

  const handleApply = () => {
    onApply(draft);
    onClose();
  };

  const handleReset = () => {
    setDraft(DEFAULT_CLIENT_FILTERS);
    onApply(DEFAULT_CLIENT_FILTERS);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      <div className="absolute inset-y-0 right-0 max-w-sm w-full bg-white shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out border-l border-slate-200">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-slate-900">Advanced Filters</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
            aria-label="Close filters"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Industry */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Industry</label>
            <div className="relative">
              <select
                value={draft.industry}
                onChange={(e) => setDraft((p) => ({ ...p, industry: e.target.value }))}
                className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm appearance-none focus:ring-2 focus:ring-blue-500 transition-all outline-none"
              >
                <option value="All Industries">All Industries</option>
                {industries.map((industry) => (
                  <option key={industry} value={industry}>
                    {industry}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {showStatusFilter ? (
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Stage</label>
              <div className="grid grid-cols-2 gap-2">
                {(['All', 'Active', 'On Hold', 'Inactive'] as const).map((option) => {
                  const isActive = draft.stage === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setDraft((p) => ({ ...p, stage: option as ClientFilters['stage'] }))}
                      className={`px-3 py-2 text-sm rounded-lg font-medium transition-colors border ${
                        isActive
                          ? 'border-blue-200 bg-blue-50 text-blue-700'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {showInterestFilter ? (
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Priority</label>
              <div className="grid grid-cols-4 gap-2">
                {(['All', 'High', 'Medium', 'Low'] as const).map((option) => {
                  const isActive = draft.priority === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setDraft((p) => ({ ...p, priority: option as ClientFilters['priority'] }))}
                      className={`px-3 py-2 text-sm rounded-lg font-medium transition-colors border ${
                        isActive
                          ? 'border-blue-200 bg-blue-50 text-blue-700'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* Location */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Location</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={draft.location}
                onChange={(e) => setDraft((p) => ({ ...p, location: e.target.value }))}
                placeholder="City, State or Country"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 transition-all outline-none"
              />
            </div>
          </div>

          {showOwnerFilter ? (
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Account Owner</label>
              <div className="grid grid-cols-2 gap-2">
                {(['all', 'me'] as const).map((scope) => {
                  const isActive = draft.ownerScope === scope;
                  return (
                    <button
                      key={scope}
                      type="button"
                      onClick={() => setDraft((p) => ({ ...p, ownerScope: scope }))}
                      className={`px-3 py-2 text-sm rounded-lg font-medium transition-colors border ${
                        isActive
                          ? 'border-blue-200 bg-blue-50 text-blue-700'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {scope === 'all' ? 'All' : currentUserName ? `Me only (${currentUserName})` : 'Me only'}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* Open Jobs Range */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Open Jobs Range</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                placeholder="Min"
                value={draft.openJobsMin ?? ''}
                onChange={(e) =>
                  setDraft((p) => ({
                    ...p,
                    openJobsMin: e.target.value === '' ? null : Math.max(0, Number(e.target.value)),
                  }))
                }
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <span className="text-slate-400">to</span>
              <input
                type="number"
                min={0}
                placeholder="Max"
                value={draft.openJobsMax ?? ''}
                onChange={(e) =>
                  setDraft((p) => ({
                    ...p,
                    openJobsMax: e.target.value === '' ? null : Math.max(0, Number(e.target.value)),
                  }))
                }
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          {/* Last Activity */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Last Activity</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <select
                value={draft.lastActivity}
                onChange={(e) => setDraft((p) => ({ ...p, lastActivity: e.target.value as ClientFilters['lastActivity'] }))}
                className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm appearance-none focus:ring-2 focus:ring-blue-500 transition-all outline-none"
              >
                {LAST_ACTIVITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50 flex gap-3">
          <button
            type="button"
            className="flex-1 py-2.5 px-4 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-all"
            onClick={handleReset}
          >
            Reset Filters
          </button>
          <button
            type="button"
            className="flex-1 py-2.5 px-4 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 shadow-md shadow-blue-200 transition-all"
            onClick={handleApply}
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Pure filtering function used by the page so the same logic powers both the
 * full list and live previews. Returns the array unchanged when filters are
 * at their default values.
 */
export function applyClientFilters(
  clients: Client[],
  filters: ClientFilters,
  currentUserName?: string,
  fieldVisibility?: ClientPageFieldVisibility,
): Client[] {
  const showStatusFilter = fieldVisibility?.status === true;
  const showInterestFilter = fieldVisibility?.interestLevel === true;
  const showOwnerFilter = fieldVisibility?.assignedTo === true;

  return clients.filter((client) => {
    if (filters.industry && filters.industry !== 'All Industries') {
      if ((client.industry || '').toLowerCase() !== filters.industry.toLowerCase()) return false;
    }
    if (showStatusFilter && filters.stage !== 'All' && client.stage !== filters.stage) return false;
    if (showInterestFilter && filters.priority !== 'All' && client.priority !== filters.priority) return false;
    if (filters.location.trim()) {
      const haystack = `${client.location || ''} ${client.hiringLocations || ''}`.toLowerCase();
      if (!haystack.includes(filters.location.trim().toLowerCase())) return false;
    }
    if (showOwnerFilter && filters.ownerScope === 'me') {
      if (!currentUserName || client.owner?.name !== currentUserName) return false;
    }
    if (filters.openJobsMin !== null && client.openJobs < filters.openJobsMin) return false;
    if (filters.openJobsMax !== null && client.openJobs > filters.openJobsMax) return false;
    if (filters.lastActivity !== 'any') {
      const parsed = client.lastActivity ? new Date(client.lastActivity) : null;
      if (parsed && !Number.isNaN(parsed.getTime())) {
        const ageMs = Date.now() - parsed.getTime();
        const day = 24 * 60 * 60 * 1000;
        switch (filters.lastActivity) {
          case '24h':
            if (ageMs > day) return false;
            break;
          case '7d':
            if (ageMs > 7 * day) return false;
            break;
          case '30d':
            if (ageMs > 30 * day) return false;
            break;
          case 'over30d':
            if (ageMs <= 30 * day) return false;
            break;
        }
      }
      // If lastActivity isn't parseable (e.g. "2 hours ago" string), don't drop the row.
    }
    return true;
  });
}

export function isClientFilterActive(
  filters: ClientFilters,
  fieldVisibility?: ClientPageFieldVisibility,
): boolean {
  const showStatusFilter = fieldVisibility?.status === true;
  const showInterestFilter = fieldVisibility?.interestLevel === true;
  const showOwnerFilter = fieldVisibility?.assignedTo === true;

  return (
    (filters.industry && filters.industry !== 'All Industries') ||
    (showStatusFilter && filters.stage !== 'All') ||
    (showInterestFilter && filters.priority !== 'All') ||
    filters.location.trim() !== '' ||
    (showOwnerFilter && filters.ownerScope !== 'all') ||
    filters.openJobsMin !== null ||
    filters.openJobsMax !== null ||
    filters.lastActivity !== 'any'
  );
}
