'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { History, Loader2, Search } from 'lucide-react';
import { apiGetActivityFeed, type BackendGlobalActivity } from '../../lib/api';
import { formatDateTimeDMY } from '../../utils/dateDisplay';
import { PH2_TABLE_CARD_CLASS, PH2_TOOLBAR_ROW_CLASS } from '../../components/layout/Ph2ModulePageLayout';
import PaginationAll from '../../components/PaginationAll';
import { TABLE_PAGE_SIZE_OPTIONS, type TablePageSize } from '../../constants/tablePagination';

const ENTITY_OPTIONS = [
  { value: '', label: 'All modules' },
  { value: 'CANDIDATE', label: 'Candidates' },
  { value: 'JOB', label: 'Jobs' },
  { value: 'CLIENT', label: 'Clients' },
  { value: 'LEAD', label: 'Leads' },
  { value: 'INTERVIEW', label: 'Interviews' },
  { value: 'PLACEMENT', label: 'Placements' },
  { value: 'TASK', label: 'Tasks' },
  { value: 'CONTACT', label: 'Contacts' },
  { value: 'USER', label: 'Team' },
];

const CATEGORY_OPTIONS = [
  { value: '', label: 'All categories' },
  { value: 'Team', label: 'Team' },
  { value: 'Candidates', label: 'Candidates' },
  { value: 'Jobs', label: 'Jobs' },
  { value: 'Placements', label: 'Placements' },
  { value: 'General', label: 'General' },
];

function performerLabel(row: BackendGlobalActivity) {
  const u = row.performedBy;
  if (!u?.name && !u?.email) return 'System';
  return u.name || u.email || 'Unknown';
}

export default function ActivityFeedPage() {
  const [rows, setRows] = useState<BackendGlobalActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [entityType, setEntityType] = useState('');
  const [category, setCategory] = useState('');
  const [mineOnly, setMineOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<TablePageSize>(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiGetActivityFeed({
        page,
        limit: pageSize,
        search: search.trim() || undefined,
        entityType: entityType || undefined,
        category: category || undefined,
        mine: mineOnly,
      });
      const payload = res.data as {
        data?: BackendGlobalActivity[];
        pagination?: { totalPages?: number; total?: number };
      };
      setRows(Array.isArray(payload?.data) ? payload.data : []);
      setTotalPages(Math.max(payload?.pagination?.totalPages ?? 1, 1));
      setTotalCount(payload?.pagination?.total ?? payload?.data?.length ?? 0);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load activity feed');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, entityType, category, mineOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [search, entityType, category, mineOnly, pageSize]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <History size={22} className="text-indigo-600" />
            Company activity log
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Who did what across your tenant — creates, updates, team changes, and more.
          </p>
        </div>
      </div>

      <div className={PH2_TABLE_CARD_CLASS}>
        <div className={`${PH2_TOOLBAR_ROW_CLASS} flex-wrap gap-2 p-3 sm:p-4`}>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search action or description…"
              className="h-9 w-full rounded-xl border border-indigo-100/90 bg-white pl-10 pr-3 text-xs text-slate-800"
            />
          </div>
          <select
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            className="h-9 rounded-xl border border-indigo-100/90 bg-white px-2 text-xs text-slate-800"
          >
            {ENTITY_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-9 rounded-xl border border-indigo-100/90 bg-white px-2 text-xs text-slate-800"
          >
            {CATEGORY_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <label className="inline-flex h-9 items-center gap-2 rounded-xl border border-indigo-100/90 bg-white px-3 text-xs font-medium text-slate-700">
            <input
              type="checkbox"
              checked={mineOnly}
              onChange={(e) => setMineOnly(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600"
            />
            My actions only
          </label>
        </div>

        {error ? (
          <div className="p-6 text-sm text-rose-600">{error}</div>
        ) : loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading activity…
          </div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-500">No activity matches your filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-left">
              <thead>
                <tr className="border-b border-indigo-100/50 bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">Who</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Module</th>
                  <th className="px-4 py-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-indigo-50/30">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                      {formatDateTimeDMY(row.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-slate-900">{performerLabel(row)}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-800">{row.action}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {row.category || row.entityType || '—'}
                    </td>
                    <td className="max-w-md px-4 py-3 text-xs text-slate-600 truncate" title={row.description || ''}>
                      {row.description || row.relatedLabel || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && rows.length > 0 ? (
          <div className="border-t border-indigo-100/50 px-4 py-3">
            <PaginationAll
              initialPage={page}
              totalPages={totalPages}
              totalCount={totalCount}
              pageSize={pageSize}
              pageSizeOptions={[...TABLE_PAGE_SIZE_OPTIONS]}
              onPageSizeChange={(n) => {
                if ((TABLE_PAGE_SIZE_OPTIONS as readonly number[]).includes(n)) {
                  setPageSize(n as TablePageSize);
                }
              }}
              itemLabel="events"
              onPageChange={setPage}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
