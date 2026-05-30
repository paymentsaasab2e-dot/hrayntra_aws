'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Calendar,
  ChevronRight,
  History,
  Loader2,
  Search,
  Users,
} from 'lucide-react';
import { apiGetActivityFeed, type BackendGlobalActivity } from '../../lib/api';
import { getAllTeamMembersForDirectory } from '../../lib/api/teamApi';
import type { TeamMember } from '../../types/team';
import { formatDateTimeDMY } from '../../utils/dateDisplay';
import { PH2_TABLE_CARD_CLASS, PH2_TOOLBAR_ROW_CLASS } from '../../components/layout/Ph2ModulePageLayout';
import PaginationAll from '../../components/PaginationAll';
import { TABLE_PAGE_SIZE_OPTIONS, type TablePageSize } from '../../constants/tablePagination';

const MODULE_OPTIONS = [
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

const TABLE_HEAD_ROW =
  'border-b border-indigo-100/50 bg-gradient-to-r from-slate-50/90 via-indigo-50/30 to-violet-50/20 text-[10px] font-bold uppercase tracking-wider text-slate-500';

function teamMemberName(member: TeamMember): string {
  const full = `${member.firstName || ''} ${member.lastName || ''}`.trim();
  return full || member.email || 'Team member';
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

function toYmd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toIsoDayStart(ymd: string) {
  if (!ymd) return undefined;
  return new Date(`${ymd}T00:00:00`).toISOString();
}

function toIsoDayEnd(ymd: string) {
  if (!ymd) return undefined;
  return new Date(`${ymd}T23:59:59.999`).toISOString();
}

function formatActivityDetails(row: BackendGlobalActivity): string {
  const raw = row.description || row.relatedLabel || '';
  if (!raw) return '—';
  if (typeof raw === 'string') return raw;
  try {
    return JSON.stringify(raw);
  } catch {
    return '—';
  }
}

export default function ActivityFeedPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const memberIdFromUrl = searchParams.get('memberId') || '';

  const todayYmd = useMemo(() => toYmd(new Date()), []);
  const yesterdayYmd = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return toYmd(d);
  }, []);

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [membersError, setMembersError] = useState('');
  const [memberSearch, setMemberSearch] = useState('');

  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);

  const [rows, setRows] = useState<BackendGlobalActivity[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState('');
  const [search, setSearch] = useState('');
  const [entityType, setEntityType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<TablePageSize>(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const datePreset =
    dateFrom === todayYmd && dateTo === todayYmd
      ? 'today'
      : dateFrom === yesterdayYmd && dateTo === yesterdayYmd
        ? 'yesterday'
        : dateFrom || dateTo
          ? 'custom'
          : 'all';

  const loadTeamMembers = useCallback(async () => {
    setMembersLoading(true);
    setMembersError('');
    try {
      const members = await getAllTeamMembersForDirectory();
      const sorted = [...members].sort((a, b) =>
        teamMemberName(a).localeCompare(teamMemberName(b), undefined, { sensitivity: 'base' }),
      );
      setTeamMembers(sorted);
    } catch (err: unknown) {
      setMembersError(err instanceof Error ? err.message : 'Failed to load team members');
      setTeamMembers([]);
    } finally {
      setMembersLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTeamMembers();
  }, [loadTeamMembers]);

  useEffect(() => {
    if (!memberIdFromUrl || !teamMembers.length) return;
    const found = teamMembers.find((m) => m.id === memberIdFromUrl);
    if (found) setSelectedMember(found);
  }, [memberIdFromUrl, teamMembers]);

  const filteredMembers = useMemo(() => {
    const needle = memberSearch.trim().toLowerCase();
    if (!needle) return teamMembers;
    return teamMembers.filter((member) => {
      const hay = [
        teamMemberName(member),
        member.email,
        member.designation,
        member.role?.roleName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [teamMembers, memberSearch]);

  const loadActivity = useCallback(async () => {
    if (!selectedMember?.id) return;
    setActivityLoading(true);
    setActivityError('');
    try {
      const res = await apiGetActivityFeed({
        page,
        limit: pageSize,
        performedById: selectedMember.id,
        search: search.trim() || undefined,
        entityType: entityType || undefined,
        from: dateFrom ? toIsoDayStart(dateFrom) : undefined,
        to: dateTo ? toIsoDayEnd(dateTo) : undefined,
      });
      const payload = res.data as {
        data?: BackendGlobalActivity[];
        pagination?: { totalPages?: number; total?: number };
      };
      setRows(Array.isArray(payload?.data) ? payload.data : []);
      setTotalPages(Math.max(payload?.pagination?.totalPages ?? 1, 1));
      setTotalCount(payload?.pagination?.total ?? payload?.data?.length ?? 0);
    } catch (err: unknown) {
      setActivityError(err instanceof Error ? err.message : 'Failed to load activity');
      setRows([]);
    } finally {
      setActivityLoading(false);
    }
  }, [selectedMember?.id, page, pageSize, search, entityType, dateFrom, dateTo]);

  useEffect(() => {
    if (!selectedMember) return;
    void loadActivity();
  }, [loadActivity, selectedMember]);

  useEffect(() => {
    setPage(1);
  }, [search, entityType, dateFrom, dateTo, pageSize, selectedMember?.id]);

  const openMember = (member: TeamMember) => {
    setSelectedMember(member);
    setSearch('');
    setEntityType('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
    const params = new URLSearchParams(searchParams.toString());
    params.set('memberId', member.id);
    router.replace(`/activity-feed?${params.toString()}`, { scroll: false });
  };

  const backToMembers = () => {
    setSelectedMember(null);
    setRows([]);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('memberId');
    const qs = params.toString();
    router.replace(qs ? `/activity-feed?${qs}` : '/activity-feed', { scroll: false });
  };

  const applyToday = () => {
    setDateFrom(todayYmd);
    setDateTo(todayYmd);
  };

  const applyYesterday = () => {
    setDateFrom(yesterdayYmd);
    setDateTo(yesterdayYmd);
  };

  const clearDates = () => {
    setDateFrom('');
    setDateTo('');
  };

  if (selectedMember) {
    const memberName = teamMemberName(selectedMember);
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-4">
        <button
          type="button"
          onClick={backToMembers}
          className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to team
        </button>

        <div className="rounded-2xl border border-indigo-100/80 bg-gradient-to-r from-indigo-50/60 via-white to-violet-50/40 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
                {getInitials(memberName)}
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">{memberName}</h1>
                <p className="text-sm text-slate-500">{selectedMember.email}</p>
                {selectedMember.role?.roleName ? (
                  <p className="text-xs text-indigo-600 font-medium mt-0.5">
                    {selectedMember.role.roleName}
                  </p>
                ) : null}
              </div>
            </div>
            <p className="text-xs text-slate-500 max-w-sm">
              Activity log for this team member — filter by module and date range.
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
              aria-label="Module"
            >
              {MODULE_OPTIONS.map((o) => (
                <option key={o.value || 'all'} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={applyToday}
                className={`h-9 rounded-xl px-3 text-xs font-semibold ${
                  datePreset === 'today'
                    ? 'bg-indigo-600 text-white'
                    : 'border border-indigo-100/90 bg-white text-slate-700'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={applyYesterday}
                className={`h-9 rounded-xl px-3 text-xs font-semibold ${
                  datePreset === 'yesterday'
                    ? 'bg-indigo-600 text-white'
                    : 'border border-indigo-100/90 bg-white text-slate-700'
                }`}
              >
                Yesterday
              </button>
              <label className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-indigo-100/90 bg-white px-2 text-xs text-slate-600">
                <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span className="text-[10px] font-semibold uppercase text-slate-400">From</span>
                <input
                  type="date"
                  value={dateFrom}
                  max={dateTo || todayYmd}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="border-0 bg-transparent p-0 text-slate-800 focus:outline-none"
                />
              </label>
              <label className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-indigo-100/90 bg-white px-2 text-xs text-slate-600">
                <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span className="text-[10px] font-semibold uppercase text-slate-400">To</span>
                <input
                  type="date"
                  value={dateTo}
                  min={dateFrom || undefined}
                  max={todayYmd}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="border-0 bg-transparent p-0 text-slate-800 focus:outline-none"
                />
              </label>
              {(dateFrom || dateTo) && (
                <button
                  type="button"
                  onClick={clearDates}
                  className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Clear dates
                </button>
              )}
            </div>
          </div>

          {activityError ? (
            <div className="p-6 text-sm text-rose-600">{activityError}</div>
          ) : activityLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading activity…
            </div>
          ) : rows.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-500">
              No activity for {memberName} with these filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-left">
                <thead>
                  <tr className={TABLE_HEAD_ROW}>
                    <th className="px-4 py-3">When</th>
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
                      <td className="px-4 py-3 text-xs font-semibold text-slate-800">{row.action}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {row.category || row.entityType || '—'}
                      </td>
                      <td
                        className="max-w-md px-4 py-3 text-xs text-slate-600 truncate"
                        title={formatActivityDetails(row)}
                      >
                        {formatActivityDetails(row)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!activityLoading && rows.length > 0 ? (
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

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <History size={22} className="text-indigo-600" />
          Company activity log
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Select a team member to view their actions — creates, updates, and changes across modules.
        </p>
      </div>

      <div className={PH2_TABLE_CARD_CLASS}>
        <div className={`${PH2_TOOLBAR_ROW_CLASS} p-3 sm:p-4`}>
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              placeholder="Search team member name or email…"
              className="h-9 w-full rounded-xl border border-indigo-100/90 bg-white pl-10 pr-3 text-xs text-slate-800"
            />
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 whitespace-nowrap">
            <Users className="h-4 w-4 text-indigo-500" />
            {membersLoading
              ? 'Loading…'
              : `${filteredMembers.length} member${filteredMembers.length === 1 ? '' : 's'}`}
          </span>
        </div>

        {membersError ? (
          <div className="p-6 text-sm text-rose-600">{membersError}</div>
        ) : membersLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading team…
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-500">No team members match your search.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filteredMembers.map((member) => {
              const name = teamMemberName(member);
              return (
                <li key={member.id}>
                  <button
                    type="button"
                    onClick={() => openMember(member)}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-indigo-50/40 sm:px-6"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-600/10 text-xs font-bold text-indigo-700">
                      {getInitials(name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900 truncate">{name}</p>
                      <p className="text-xs text-slate-500 truncate">{member.email}</p>
                      {member.role?.roleName ? (
                        <p className="text-[11px] text-indigo-600 font-medium mt-0.5">
                          {member.role.roleName}
                        </p>
                      ) : null}
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-slate-300" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
