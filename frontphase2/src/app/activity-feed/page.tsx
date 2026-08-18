'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  Calendar,
  ChevronRight,
  History,
  Loader2,
  Minus,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  User,
  Users,
  Globe,
} from 'lucide-react';
import {
  apiGetActivityCapabilities,
  apiGetActivityFeed,
  apiGetActivityViewableDepartments,
  apiGetActivityViewableMembers,
  type ActivityViewableDepartment,
  type ActivityViewableMember,
  type ActivityVisibilityCapabilities,
  type BackendGlobalActivity,
} from '../../lib/api';
import { formatDateTimeDMY } from '../../utils/dateDisplay';
import {
  activityKindTone,
  activityModuleTone,
  formatActivityKindLabel,
  formatActivityModule,
  formatActivitySummary,
  resolveActivityKind,
  type PresentedActivity,
} from '../../lib/activityFeedPresentation';
import { PH2_TABLE_BODY_SCROLL_CLASS, PH2_TABLE_CARD_CLASS, PH2_TABLE_CARD_FOOTER_CLASS, PH2_TOOLBAR_ROW_CLASS } from '../../components/layout/Ph2ModulePageLayout';
import PaginationAll from '../../components/PaginationAll';
import { TABLE_PAGE_SIZE_OPTIONS, type TablePageSize } from '../../constants/tablePagination';

type ActivityTab = 'self' | 'all' | 'members' | 'departments';

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

function memberDisplayName(member: ActivityViewableMember): string {
  const full = `${member.firstName || ''} ${member.lastName || ''}`.trim();
  return member.name || full || member.email || 'Team member';
}

function performerName(row: BackendGlobalActivity): string {
  const p = row.performedBy;
  if (!p) return '—';
  const full = `${p.firstName || ''} ${p.lastName || ''}`.trim();
  return p.name || full || p.email || '—';
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

function activityKindIcon(kind: ReturnType<typeof resolveActivityKind>) {
  switch (kind) {
    case 'create':
      return Plus;
    case 'delete':
      return Trash2;
    case 'update':
      return RefreshCw;
    default:
      return Minus;
  }
}

function ActivityTimeline({
  rows,
  showPerformer = false,
}: {
  rows: PresentedActivity[];
  showPerformer?: boolean;
}) {
  return (
    <table className="w-full min-w-[960px] text-left" aria-label="Activity log">
      <thead className="sticky top-0 z-10">
        <tr className="border-b border-indigo-100/50 bg-gradient-to-r from-slate-50/95 via-indigo-50/50 to-violet-50/40 text-[9px] font-bold uppercase tracking-[0.12em] text-indigo-950/45 backdrop-blur-sm">
          {showPerformer ? <th className="px-3 py-2.5 sm:px-4">Actor</th> : null}
          <th className="px-3 py-2.5 sm:px-4 min-w-[18rem]">Activity</th>
          <th className="px-3 py-2.5 sm:px-4 whitespace-nowrap">Date / Time</th>
          <th className="px-3 py-2.5 sm:px-4">Module</th>
          <th className="px-3 py-2.5 sm:px-4">Action</th>
          <th className="px-3 py-2.5 sm:px-4">Related</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100/80">
        {rows.map((row) => {
          const moduleLabel = formatActivityModule(row);
          const kind = resolveActivityKind(row);
          const KindIcon = activityKindIcon(kind);
          const performer = performerName(row);
          const summary = formatActivitySummary(row);
          const kindLabel = formatActivityKindLabel(row);

          return (
            <tr
              key={row.id}
              className="transition-colors duration-200 even:bg-slate-50/35 hover:bg-indigo-50/45"
            >
              {showPerformer ? (
                <td className="px-3 py-2.5 align-middle sm:px-4">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600/10 text-[10px] font-bold text-indigo-700">
                      {getInitials(performer)}
                    </div>
                    <span className="max-w-[10rem] truncate text-xs font-semibold text-slate-900" title={performer}>
                      {performer}
                    </span>
                  </div>
                </td>
              ) : null}
              <td className="px-3 py-2.5 align-middle sm:px-4">
                <p className="text-xs font-medium leading-snug text-slate-900">{summary}</p>
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 align-middle text-[11px] text-slate-500 sm:px-4">
                {formatDateTimeDMY(row.createdAt)}
              </td>
              <td className="px-3 py-2.5 align-middle sm:px-4">
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${activityModuleTone(moduleLabel)}`}
                >
                  {moduleLabel}
                </span>
              </td>
              <td className="px-3 py-2.5 align-middle sm:px-4">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${activityKindTone(kind)}`}
                  title={kindLabel}
                >
                  <KindIcon className="h-3 w-3 shrink-0" aria-hidden />
                  {kindLabel}
                </span>
              </td>
              <td className="px-3 py-2.5 align-middle sm:px-4">
                <span className="line-clamp-2 max-w-[14rem] text-xs font-medium text-slate-600" title={row.relatedLabel || undefined}>
                  {row.relatedLabel || '—'}
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ActivityFilters({
  search,
  setSearch,
  entityType,
  setEntityType,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  todayYmd,
  yesterdayYmd,
}: {
  search: string;
  setSearch: (v: string) => void;
  entityType: string;
  setEntityType: (v: string) => void;
  dateFrom: string;
  setDateFrom: (v: string) => void;
  dateTo: string;
  setDateTo: (v: string) => void;
  todayYmd: string;
  yesterdayYmd: string;
}) {
  const datePreset =
    dateFrom === todayYmd && dateTo === todayYmd
      ? 'today'
      : dateFrom === yesterdayYmd && dateTo === yesterdayYmd
        ? 'yesterday'
        : dateFrom || dateTo
          ? 'custom'
          : 'all';

  return (
    <div className={`${PH2_TOOLBAR_ROW_CLASS} flex-wrap gap-2 p-3 sm:p-4`}>
      <div className="relative flex-1 min-w-[200px]">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search people, jobs, candidates, actions…"
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
          onClick={() => {
            setDateFrom(todayYmd);
            setDateTo(todayYmd);
          }}
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
          onClick={() => {
            setDateFrom(yesterdayYmd);
            setDateTo(yesterdayYmd);
          }}
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
            onClick={() => {
              setDateFrom('');
              setDateTo('');
            }}
            className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Clear dates
          </button>
        )}
      </div>
    </div>
  );
}

export default function ActivityFeedPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const tabFromUrl = (searchParams.get('tab') as ActivityTab) || 'self';
  const memberIdFromUrl = searchParams.get('memberId') || '';
  const departmentIdFromUrl = searchParams.get('departmentId') || '';

  const todayYmd = useMemo(() => toYmd(new Date()), []);
  const yesterdayYmd = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return toYmd(d);
  }, []);

  const [capabilities, setCapabilities] = useState<ActivityVisibilityCapabilities | null>(null);
  const [capabilitiesLoading, setCapabilitiesLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<ActivityTab>(tabFromUrl);
  const [members, setMembers] = useState<ActivityViewableMember[]>([]);
  const [departments, setDepartments] = useState<ActivityViewableDepartment[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [departmentsLoading, setDepartmentsLoading] = useState(false);
  const [listError, setListError] = useState('');
  const [memberSearch, setMemberSearch] = useState('');

  const [selectedMember, setSelectedMember] = useState<ActivityViewableMember | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<ActivityViewableDepartment | null>(null);

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

  const syncUrl = useCallback(
    (next: { tab?: ActivityTab; memberId?: string | null; departmentId?: string | null }) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next.tab) params.set('tab', next.tab);
      if (next.memberId) params.set('memberId', next.memberId);
      else params.delete('memberId');
      if (next.departmentId) params.set('departmentId', next.departmentId);
      else params.delete('departmentId');
      const qs = params.toString();
      router.replace(qs ? `/activity-feed?${qs}` : '/activity-feed', { scroll: false });
    },
    [router, searchParams],
  );

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setCapabilitiesLoading(true);
      try {
        const res = await apiGetActivityCapabilities();
        if (!cancelled) setCapabilities(res.data || null);
      } catch {
        if (!cancelled) setCapabilities(null);
      } finally {
        if (!cancelled) setCapabilitiesLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!capabilities) return;
    if (activeTab === 'all' && capabilities.level !== 'tenant') {
      setActiveTab('self');
      return;
    }
    if (!capabilities.canViewMembers && (activeTab === 'members' || activeTab === 'departments')) {
      setActiveTab('self');
      return;
    }
    if (!searchParams.get('tab')) {
      if (capabilities.level === 'tenant') {
        setActiveTab('all');
      } else if (capabilities.level === 'department' && capabilities.canViewMembers) {
        setActiveTab('members');
      }
    }
  }, [capabilities, activeTab, searchParams]);

  useEffect(() => {
    if (activeTab !== 'members' || !capabilities?.canViewMembers) return;
    if (selectedMember) return;
    let cancelled = false;
    const load = async () => {
      setMembersLoading(true);
      setListError('');
      try {
        const res = await apiGetActivityViewableMembers();
        if (!cancelled) setMembers(Array.isArray(res.data?.members) ? res.data.members : []);
      } catch (err: unknown) {
        if (!cancelled) {
          setListError(err instanceof Error ? err.message : 'Failed to load team members');
          setMembers([]);
        }
      } finally {
        if (!cancelled) setMembersLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [activeTab, capabilities?.canViewMembers, selectedMember]);

  useEffect(() => {
    if (activeTab !== 'departments' || !capabilities?.canViewDepartments) return;
    if (selectedDepartment) return;
    let cancelled = false;
    const load = async () => {
      setDepartmentsLoading(true);
      setListError('');
      try {
        const res = await apiGetActivityViewableDepartments();
        if (!cancelled) {
          setDepartments(Array.isArray(res.data?.departments) ? res.data.departments : []);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setListError(err instanceof Error ? err.message : 'Failed to load departments');
          setDepartments([]);
        }
      } finally {
        if (!cancelled) setDepartmentsLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [activeTab, capabilities?.canViewDepartments, selectedDepartment]);

  useEffect(() => {
    if (!members.length || !memberIdFromUrl) return;
    const found = members.find((m) => m.id === memberIdFromUrl);
    if (found) {
      setSelectedMember(found);
      setActiveTab('members');
    }
  }, [memberIdFromUrl, members]);

  useEffect(() => {
    if (!departments.length || !departmentIdFromUrl) return;
    const found = departments.find((d) => d.id === departmentIdFromUrl);
    if (found) {
      setSelectedDepartment(found);
      setActiveTab('departments');
    }
  }, [departmentIdFromUrl, departments]);

  const filteredMembers = useMemo(() => {
    const needle = memberSearch.trim().toLowerCase();
    if (!needle) return members;
    return members.filter((member) => {
      const hay = [
        memberDisplayName(member),
        member.email,
        member.designation,
        member.role?.roleName,
        member.department?.name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [members, memberSearch]);

  const showTabs = Boolean(capabilities?.canViewMembers || capabilities?.canViewDepartments);

  const isPickerMode =
    showTabs &&
    ((activeTab === 'members' && !selectedMember) ||
      (activeTab === 'departments' && !selectedDepartment));

  const feedMode = useMemo(() => {
    if (!capabilities) return null;
    if (!showTabs) return 'self' as const;
    if (activeTab === 'self') return 'self' as const;
    if (activeTab === 'all' && capabilities.level === 'tenant') return 'tenant' as const;
    if (activeTab === 'members' && selectedMember?.id) return 'member' as const;
    if (activeTab === 'departments' && selectedDepartment?.id) return 'department' as const;
    return null;
  }, [capabilities, showTabs, activeTab, selectedMember?.id, selectedDepartment?.id]);

  const loadActivity = useCallback(async () => {
    if (!feedMode) return;
    setActivityLoading(true);
    setActivityError('');
    try {
      const res = await apiGetActivityFeed({
        page,
        limit: pageSize,
        search: search.trim() || undefined,
        entityType: entityType || undefined,
        from: dateFrom ? toIsoDayStart(dateFrom) : undefined,
        to: dateTo ? toIsoDayEnd(dateTo) : undefined,
        ...(feedMode === 'self'
          ? { scope: 'self', mine: true }
          : feedMode === 'tenant'
            ? { scope: 'tenant' }
            : feedMode === 'member'
              ? { performedById: selectedMember?.id }
              : {
                  scope: 'department',
                  departmentId: selectedDepartment?.id,
                }),
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
  }, [
    feedMode,
    page,
    pageSize,
    search,
    entityType,
    dateFrom,
    dateTo,
    selectedMember?.id,
    selectedDepartment?.id,
  ]);

  useEffect(() => {
    if (!feedMode) return;
    void loadActivity();
  }, [loadActivity, feedMode]);

  useEffect(() => {
    setPage(1);
  }, [search, entityType, dateFrom, dateTo, pageSize, feedMode, selectedMember?.id, selectedDepartment?.id]);

  const switchTab = (tab: ActivityTab) => {
    setActiveTab(tab);
    setSelectedMember(null);
    setSelectedDepartment(null);
    setRows([]);
    setSearch('');
    setEntityType('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
    syncUrl({ tab, memberId: null, departmentId: null });
  };

  const openMember = (member: ActivityViewableMember) => {
    setSelectedMember(member);
    setSearch('');
    setEntityType('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
    syncUrl({ tab: 'members', memberId: member.id, departmentId: null });
  };

  const openDepartment = (department: ActivityViewableDepartment) => {
    setSelectedDepartment(department);
    setSearch('');
    setEntityType('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
    syncUrl({ tab: 'departments', departmentId: department.id, memberId: null });
  };

  const backFromDetail = () => {
    if (activeTab === 'members') {
      setSelectedMember(null);
      syncUrl({ tab: 'members', memberId: null });
    } else {
      setSelectedDepartment(null);
      syncUrl({ tab: 'departments', departmentId: null });
    }
    setRows([]);
  };

  const showPerformerInTimeline = feedMode === 'department' || feedMode === 'tenant';

  const tabBar = showTabs ? (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => {
          setSelectedMember(null);
          setSelectedDepartment(null);
          setActiveTab('self');
          setRows([]);
          syncUrl({ tab: 'self', memberId: null, departmentId: null });
        }}
        className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold ${
          activeTab === 'self'
            ? 'bg-indigo-600 text-white shadow-sm'
            : 'border border-indigo-100 bg-white text-slate-700 hover:bg-indigo-50/50'
        }`}
      >
        <User className="h-3.5 w-3.5" />
        My activity
      </button>
      {capabilities?.level === 'tenant' ? (
        <button
          type="button"
          onClick={() => {
            setSelectedMember(null);
            setSelectedDepartment(null);
            setActiveTab('all');
            setRows([]);
            setSearch('');
            setEntityType('');
            setDateFrom('');
            setDateTo('');
            setPage(1);
            syncUrl({ tab: 'all', memberId: null, departmentId: null });
          }}
          className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold ${
            activeTab === 'all'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'border border-indigo-100 bg-white text-slate-700 hover:bg-indigo-50/50'
          }`}
        >
          <Globe className="h-3.5 w-3.5" />
          All activity
        </button>
      ) : null}
      {capabilities?.canViewMembers ? (
        <button
          type="button"
          onClick={() => switchTab('members')}
          className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold ${
            activeTab === 'members'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'border border-indigo-100 bg-white text-slate-700 hover:bg-indigo-50/50'
          }`}
        >
          <Users className="h-3.5 w-3.5" />
          {capabilities.level === 'tenant' ? 'By member' : 'My team'}
        </button>
      ) : null}
      {capabilities?.canViewDepartments ? (
        <button
          type="button"
          onClick={() => switchTab('departments')}
          className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold ${
            activeTab === 'departments'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'border border-indigo-100 bg-white text-slate-700 hover:bg-indigo-50/50'
          }`}
        >
          <Building2 className="h-3.5 w-3.5" />
          By department
        </button>
      ) : null}
    </div>
  ) : null;

  if (capabilitiesLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading activity log…
      </div>
    );
  }

  const detailTitle =
    feedMode === 'tenant'
      ? 'All activity'
      : feedMode === 'member' && selectedMember
      ? memberDisplayName(selectedMember)
      : feedMode === 'department' && selectedDepartment
        ? selectedDepartment.name
        : 'My activity';

  const detailSubtitle =
    feedMode === 'tenant'
      ? 'See who did what across hiring, team, leads, and requests'
      : feedMode === 'member' && selectedMember
      ? `${selectedMember.email} — actions in plain language`
      : feedMode === 'department' && selectedDepartment
        ? `${selectedDepartment.memberCount} active member${selectedDepartment.memberCount === 1 ? '' : 's'} in this department`
        : capabilities?.level === 'self'
          ? 'Your recent actions in plain language'
          : 'Your personal activity timeline';

  if (feedMode) {
    return (
      <div className="ph2-page-shell flex h-[calc(100dvh-3.5rem)] w-full flex-col overflow-hidden">
        <div className="mx-auto flex min-h-0 w-full max-w-[1400px] flex-1 flex-col overflow-hidden px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        {feedMode !== 'self' ? (
          <button
            type="button"
            onClick={backFromDetail}
            className="mb-3 inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        ) : null}

        <div className="mb-4 shrink-0">{tabBar}</div>

        <div className="mb-4 shrink-0 rounded-2xl border border-indigo-100/80 bg-gradient-to-r from-indigo-50/60 via-white to-violet-50/40 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
                {feedMode === 'department' ? (
                  <Building2 className="h-5 w-5" />
                ) : feedMode === 'tenant' ? (
                  <Globe className="h-5 w-5" />
                ) : (
                  getInitials(detailTitle)
                )}
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">{detailTitle}</h1>
                <p className="text-sm text-slate-500">{detailSubtitle}</p>
              </div>
            </div>
          </div>
        </div>

        <div className={PH2_TABLE_CARD_CLASS}>
          <div className="shrink-0">
          <ActivityFilters
            search={search}
            setSearch={setSearch}
            entityType={entityType}
            setEntityType={setEntityType}
            dateFrom={dateFrom}
            setDateFrom={setDateFrom}
            dateTo={dateTo}
            setDateTo={setDateTo}
            todayYmd={todayYmd}
            yesterdayYmd={yesterdayYmd}
          />
          </div>

          <div className={PH2_TABLE_BODY_SCROLL_CLASS}>
          {activityError ? (
            <div className="p-6 text-sm text-rose-600">{activityError}</div>
          ) : activityLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading activity…
            </div>
          ) : rows.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-500">No activity found with these filters.</div>
          ) : (
            <ActivityTimeline rows={rows} showPerformer={showPerformerInTimeline} />
          )}
          </div>

          {!activityLoading && rows.length > 0 ? (
            <div className={PH2_TABLE_CARD_FOOTER_CLASS}>
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
      </div>
    );
  }

  if (!isPickerMode) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-6 text-sm text-slate-500">
        <div className="max-w-sm text-center">
          <p className="text-base font-semibold text-slate-800">Unable to connect right now</p>
          <p className="mt-1 text-sm text-slate-500">
            Please try again in a little while. Refresh the page if it continues.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="ph2-page-shell flex h-[calc(100dvh-3.5rem)] w-full flex-col overflow-hidden">
      <div className="mx-auto flex min-h-0 w-full max-w-[1400px] flex-1 flex-col overflow-hidden px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <div className="mb-4 shrink-0">
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <History size={22} className="text-indigo-600" />
          Activity log
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {capabilities?.level === 'tenant'
            ? 'View all company activity, any team member, or department-wide work.'
            : capabilities?.canViewTeam
              ? `View your activity or your team${capabilities.departmentName ? ` in ${capabilities.departmentName}` : ''}.`
              : 'View your personal activity across modules.'}
        </p>
      </div>

      <div className="mb-4 shrink-0">{tabBar}</div>

      {activeTab === 'members' && capabilities?.canViewMembers ? (
        <div className={PH2_TABLE_CARD_CLASS}>
          <div className={`${PH2_TOOLBAR_ROW_CLASS} p-3 sm:p-4`}>
            <div className="relative flex-1 min-w-[220px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Search team member…"
                className="h-9 w-full rounded-xl border border-indigo-100/90 bg-white pl-10 pr-3 text-xs text-slate-800"
              />
            </div>
            <span className="text-xs font-medium text-slate-500 whitespace-nowrap">
              {membersLoading ? 'Loading…' : `${filteredMembers.length} member${filteredMembers.length === 1 ? '' : 's'}`}
            </span>
          </div>

          <div className={PH2_TABLE_BODY_SCROLL_CLASS}>
          {listError ? (
            <div className="p-6 text-sm text-rose-600">{listError}</div>
          ) : membersLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading team…
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-500">No team members available for your scope.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filteredMembers.map((member) => {
                const name = memberDisplayName(member);
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
                        <p className="text-[11px] text-indigo-600 font-medium mt-0.5">
                          {[member.role?.roleName, member.department?.name].filter(Boolean).join(' · ')}
                        </p>
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
      ) : null}

      {activeTab === 'departments' && capabilities?.canViewDepartments ? (
        <div className={PH2_TABLE_CARD_CLASS}>
          <div className={PH2_TABLE_BODY_SCROLL_CLASS}>
          {listError ? (
            <div className="p-6 text-sm text-rose-600">{listError}</div>
          ) : departmentsLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading departments…
            </div>
          ) : departments.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-500">No departments found.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {departments.map((department) => (
                <li key={department.id}>
                  <button
                    type="button"
                    onClick={() => openDepartment(department)}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-indigo-50/40 sm:px-6"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-600/10 text-violet-700">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900">{department.name}</p>
                      <p className="text-xs text-slate-500">
                        {department.memberCount} active member{department.memberCount === 1 ? '' : 's'}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-slate-300" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          </div>
        </div>
      ) : null}
      </div>
    </div>
  );
}
