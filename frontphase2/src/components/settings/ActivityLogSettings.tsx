'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Calendar,
  Eye,
  History,
  Loader2,
  LogIn,
  LogOut,
  Search,
  Shield,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { usePermissions } from '../../hooks/usePermissions';
import {
  PH2_TABLE_CARD_CLASS,
  PH2_TOOLBAR_ROW_CLASS,
} from '../layout/Ph2ModulePageLayout';
import { DRAWER_PANEL_WIDTH_CLASS } from '../drawers/drawerLayout';
import {
  apiGetMemberAuditOverview,
  apiGetMemberAuditTimeline,
  type MemberAuditOverviewItem,
  type MemberAuditTimelineItem,
} from '../../lib/api/memberAuditApi';
import { formatDateDMY, formatDateTimeDMY } from '../../utils/dateDisplay';
import {
  formatActivityLogBrowser,
  formatActivityLogDetails,
  formatActivityLogIp,
} from '../../utils/authActivityDisplay';

const TABLE_HEAD_ROW =
  'border-b border-indigo-100/50 bg-gradient-to-r from-slate-50/90 via-indigo-50/30 to-violet-50/20 text-[10px] font-bold uppercase tracking-wider text-slate-500';
const TH = 'px-3 py-2.5 text-left first:pl-4 sm:px-4 sm:first:pl-6 sm:py-3 whitespace-nowrap';
const TR = 'transition-colors hover:bg-indigo-50/30';

function toYmd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

function sourceBadge(item: MemberAuditTimelineItem) {
  if (item.kind === 'login') {
    return item.outcome === 'SUCCESS' ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700">
        <LogIn className="h-3 w-3" /> Login
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">
        <LogIn className="h-3 w-3" /> {item.outcome || 'Auth'}
      </span>
    );
  }
  if (item.title === 'Logged out') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
        <LogOut className="h-3 w-3" /> Logout
      </span>
    );
  }
  if (item.source === 'crm') {
    return (
      <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold uppercase text-indigo-700">
        CRM
      </span>
    );
  }
  return (
    <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold uppercase text-violet-700">
      {item.module || 'Team'}
    </span>
  );
}

function statusPill(status?: string | null) {
  const normalized = (status || 'ACTIVE').toUpperCase();
  const active = normalized === 'ACTIVE';
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
        active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
      }`}
    >
      {active ? 'Active' : normalized}
    </span>
  );
}

export function ActivityLogSettings() {
  const { isSuperAdmin } = usePermissions();
  const superAdmin = isSuperAdmin();

  const todayYmd = useMemo(() => toYmd(new Date()), []);
  const yesterdayYmd = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return toYmd(d);
  }, []);

  const [selectedDate, setSelectedDate] = useState(todayYmd);
  const [search, setSearch] = useState('');
  const [members, setMembers] = useState<MemberAuditOverviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<MemberAuditOverviewItem | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineItems, setTimelineItems] = useState<MemberAuditTimelineItem[]>([]);
  const [summary, setSummary] = useState<{
    total: number;
    logins: number;
    loginFailures: number;
    logouts: number;
    crm: number;
    team: number;
  } | null>(null);
  const [portalMounted, setPortalMounted] = useState(false);

  const datePreset = selectedDate === todayYmd ? 'today' : selectedDate === yesterdayYmd ? 'yesterday' : 'custom';

  useEffect(() => {
    setPortalMounted(true);
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDrawer();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [drawerOpen]);

  const loadOverview = useCallback(async () => {
    if (!superAdmin) return;
    setLoading(true);
    try {
      const res = await apiGetMemberAuditOverview({
        date: selectedDate,
        search: search.trim() || undefined,
      });
      setMembers(res.data?.members ?? []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load team activity');
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [superAdmin, selectedDate, search]);

  const loadTimeline = useCallback(
    async (memberId: string) => {
      setTimelineLoading(true);
      try {
        const res = await apiGetMemberAuditTimeline(memberId, { date: selectedDate });
        const data = res.data;
        setTimelineItems(data?.items ?? []);
        setSummary(data?.summary ?? null);
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Failed to load member activity');
        setTimelineItems([]);
        setSummary(null);
      } finally {
        setTimelineLoading(false);
      }
    },
    [selectedDate]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadOverview();
    }, search.trim() ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [loadOverview, search]);

  useEffect(() => {
    if (drawerOpen && selectedMember) {
      void loadTimeline(selectedMember.id);
    }
  }, [selectedDate, drawerOpen, selectedMember?.id, loadTimeline]);

  const openMemberDrawer = (member: MemberAuditOverviewItem) => {
    setSelectedMember(member);
    setDrawerOpen(true);
    void loadTimeline(member.id);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedMember(null);
  };

  if (!superAdmin) {
    return (
      <div className="rounded-2xl border border-amber-100 bg-amber-50/80 p-8 text-center">
        <Shield className="mx-auto h-10 w-10 text-amber-600" />
        <h3 className="mt-4 text-lg font-bold text-slate-900">Super Admin only</h3>
        <p className="mt-2 text-sm text-slate-600 max-w-md mx-auto">
          Team activity logs are available only to Super Admin accounts so you can review every
          member&apos;s sign-ins, sign-outs, and CRM actions.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 -mx-2 sm:mx-0 max-w-none">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <History className="h-5 w-5 text-[#2b7fff]" />
            Team activity log
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            All team members for{' '}
            <span className="font-semibold text-slate-700">{formatDateDMY(selectedDate)}</span>.
            Click a row to view the full activity table for that member.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedDate(todayYmd)}
            className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
              datePreset === 'today'
                ? 'bg-[#2b7fff] text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setSelectedDate(yesterdayYmd)}
            className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
              datePreset === 'yesterday'
                ? 'bg-[#2b7fff] text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Yesterday
          </button>
          <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">
            <Calendar className="h-4 w-4 text-slate-400" />
            <input
              type="date"
              value={selectedDate}
              max={todayYmd}
              onChange={(e) => setSelectedDate(e.target.value || todayYmd)}
              className="border-0 bg-transparent p-0 text-slate-800 focus:outline-none focus:ring-0"
            />
          </label>
        </div>
      </div>

      <div className={PH2_TABLE_CARD_CLASS}>
        <div className={PH2_TOOLBAR_ROW_CLASS}>
          <div className="relative w-full lg:max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-indigo-400" />
            <input
              type="search"
              placeholder="Search name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full rounded-xl border border-indigo-100/90 bg-white/95 pl-10 pr-3 text-xs text-slate-800 shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>
          <span className="text-[11px] font-medium text-slate-500 whitespace-nowrap">
            {loading ? 'Loading…' : `${members.length} member${members.length === 1 ? '' : 's'}`}
          </span>
        </div>

        <div className="overflow-hidden">
          <div className="no-scrollbar overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-slate-400">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : members.length === 0 ? (
              <div className="px-4 py-16 text-center text-sm text-slate-500">
                No team members or no activity on this date.
              </div>
            ) : (
              <table className="w-full min-w-[960px] text-left">
                <thead>
                  <tr className={TABLE_HEAD_ROW}>
                    <th className={TH}>Member</th>
                    <th className={TH}>Role</th>
                    <th className={TH}>Email</th>
                    <th className={TH}>Status</th>
                    <th className={TH}>Events</th>
                    <th className={TH}>Logins</th>
                    <th className={TH}>CRM</th>
                    <th className={TH}>Team</th>
                    <th className={TH}>Last activity</th>
                    <th className={`${TH} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/80">
                  {members.map((member) => (
                    <tr
                      key={member.id}
                      className={`${TR} cursor-pointer`}
                      onClick={() => openMemberDrawer(member)}
                    >
                      <td className="px-3 py-3 sm:px-4 sm:py-3.5">
                        <div className="flex items-center gap-3">
                          {member.avatar ? (
                            <img
                              src={member.avatar}
                              alt=""
                              className="h-9 w-9 rounded-full object-cover"
                            />
                          ) : (
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2b7fff]/10 text-xs font-bold text-[#2b7fff]">
                              {getInitials(member.name)}
                            </div>
                          )}
                          <span className="text-xs font-semibold text-slate-900">{member.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-600 sm:px-4">
                        {member.roleName || '—'}
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-500 sm:px-4 max-w-[180px] truncate">
                        {member.email}
                      </td>
                      <td className="px-3 py-3 sm:px-4">{statusPill(member.status)}</td>
                      <td className="px-3 py-3 text-xs font-semibold text-slate-800 sm:px-4">
                        {member.eventCount}
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-600 sm:px-4">{member.loginCount}</td>
                      <td className="px-3 py-3 text-xs text-indigo-600 sm:px-4">
                        {member.crmActionCount}
                      </td>
                      <td className="px-3 py-3 text-xs text-violet-600 sm:px-4">
                        {member.teamActionCount}
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-500 sm:px-4 whitespace-nowrap">
                        {member.lastActivityAt
                          ? formatDateTimeDMY(member.lastActivityAt)
                          : 'No activity'}
                      </td>
                      <td className="px-3 py-3 text-right sm:px-4">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openMemberDrawer(member);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-indigo-100 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-indigo-700 shadow-sm hover:bg-indigo-50"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View log
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {portalMounted && typeof document !== 'undefined'
        ? createPortal(
            <AnimatePresence>
              {drawerOpen && selectedMember ? (
                <>
                  <motion.div
                    key="activity-log-backdrop"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={closeDrawer}
                    className="fixed inset-0 z-[1000] bg-slate-900/40 backdrop-blur-[2px] pointer-events-auto"
                  />
                  <motion.div
                    key="activity-log-panel"
                    initial={{ x: '100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '100%' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    onClick={(e) => e.stopPropagation()}
                    className={`fixed right-0 top-0 z-[1010] flex h-full ${DRAWER_PANEL_WIDTH_CLASS} flex-col overflow-hidden border-l border-slate-200 bg-white shadow-2xl pointer-events-auto`}
                  >
                    <div className="shrink-0 border-b border-slate-200 p-5 flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          Member activity
                        </p>
                        <h2 className="mt-0.5 truncate text-lg font-bold text-slate-900">
                          {selectedMember.name}
                        </h2>
                        <p className="mt-1 truncate text-xs text-slate-500">
                          {selectedMember.email} · {formatDateDMY(selectedDate)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={closeDrawer}
                        className="shrink-0 rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                        aria-label="Close"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>

                    <div className="shrink-0 flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/50 px-5 py-3">
                      <button
                        type="button"
                        onClick={() => setSelectedDate(todayYmd)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                          selectedDate === todayYmd
                            ? 'bg-[#2b7fff] text-white'
                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        Today
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedDate(yesterdayYmd)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                          selectedDate === yesterdayYmd
                            ? 'bg-[#2b7fff] text-white'
                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        Yesterday
                      </button>
                      <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        <input
                          type="date"
                          value={selectedDate}
                          max={todayYmd}
                          onChange={(e) => setSelectedDate(e.target.value || todayYmd)}
                          className="border-0 bg-transparent p-0 text-slate-800 focus:outline-none focus:ring-0"
                        />
                      </label>
                    </div>

                    {summary ? (
                      <div className="shrink-0 grid grid-cols-3 gap-2 border-b border-slate-100 px-5 py-3 text-center text-[10px] font-bold uppercase tracking-wide text-slate-400 sm:grid-cols-6">
                        <div className="rounded-lg bg-slate-50 py-2">
                          <p className="text-lg font-bold text-slate-900">{summary.total}</p>
                          Total
                        </div>
                        <div className="rounded-lg bg-emerald-50 py-2">
                          <p className="text-lg font-bold text-emerald-700">{summary.logins}</p>
                          Logins
                        </div>
                        <div className="rounded-lg bg-amber-50 py-2">
                          <p className="text-lg font-bold text-amber-700">{summary.loginFailures}</p>
                          Failed
                        </div>
                        <div className="rounded-lg bg-slate-50 py-2">
                          <p className="text-lg font-bold text-slate-700">{summary.logouts}</p>
                          Logouts
                        </div>
                        <div className="rounded-lg bg-indigo-50 py-2">
                          <p className="text-lg font-bold text-indigo-700">{summary.crm}</p>
                          CRM
                        </div>
                        <div className="rounded-lg bg-violet-50 py-2">
                          <p className="text-lg font-bold text-violet-700">{summary.team}</p>
                          Team
                        </div>
                      </div>
                    ) : null}

                    <div className="min-h-0 flex-1 overflow-y-auto">
                      {timelineLoading ? (
                        <div className="flex items-center justify-center py-16">
                          <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
                        </div>
                      ) : timelineItems.length === 0 ? (
                        <p className="py-16 text-center text-sm text-slate-500">
                          No recorded activity for this date.
                        </p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[880px] text-left">
                            <thead className="sticky top-0 z-10 bg-white shadow-sm">
                              <tr className={TABLE_HEAD_ROW}>
                                <th className={TH}>Time</th>
                                <th className={TH}>Type</th>
                                <th className={TH}>Action</th>
                                <th className={TH}>IP address</th>
                                <th className={TH}>Browser</th>
                                <th className={TH}>Details</th>
                                <th className={TH}>Module</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100/80">
                              {timelineItems.map((item) => {
                                const isAuth =
                                  item.kind === 'login' ||
                                  item.source === 'auth' ||
                                  item.module === 'Auth';
                                return (
                                <tr key={item.id} className={TR}>
                                  <td className="whitespace-nowrap px-3 py-2.5 text-[11px] text-slate-500 sm:px-4">
                                    {formatDateTimeDMY(item.at)}
                                  </td>
                                  <td className="px-3 py-2.5 sm:px-4">{sourceBadge(item)}</td>
                                  <td className="px-3 py-2.5 text-xs font-semibold text-slate-900 sm:px-4">
                                    {item.title}
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-slate-700 sm:px-4">
                                    {isAuth ? formatActivityLogIp(item) : '—'}
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-2.5 text-xs text-slate-600 sm:px-4">
                                    {isAuth ? formatActivityLogBrowser(item) : '—'}
                                  </td>
                                  <td className="max-w-[280px] px-3 py-2.5 text-xs text-slate-500 sm:px-4">
                                    {isAuth ? '—' : formatActivityLogDetails(item)}
                                  </td>
                                  <td className="px-3 py-2.5 text-[11px] text-slate-400 sm:px-4">
                                    {[item.module, item.entityType].filter(Boolean).join(' · ') || '—'}
                                  </td>
                                </tr>
                              );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </motion.div>
                </>
              ) : null}
            </AnimatePresence>,
            document.body
          )
        : null}
    </div>
  );
}
