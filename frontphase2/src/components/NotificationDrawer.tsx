'use client';

import Link from 'next/link';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  Bell,
  Briefcase,
  CalendarCheck2,
  CheckCheck,
  CheckSquare,
  Clock3,
  Loader2,
  Mail,
  MailOpen,
  RefreshCw,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import {
  apiDeleteNotification,
  apiListNotifications,
  apiMarkAllNotificationsRead,
  apiMarkNotificationRead,
  NOTIFICATIONS_UPDATED_EVENT,
  type AppNotification,
  type AppNotificationCategory,
} from '../lib/api';
import { formatDateDMY } from '../utils/dateDisplay';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

type StatusTab = 'unread' | 'read' | 'alerts';

const STATUS_TABS: Array<{
  id: StatusTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'unread', label: 'Unread', icon: Mail },
  { id: 'read', label: 'Read', icon: MailOpen },
  { id: 'alerts', label: 'Alerts', icon: AlertTriangle },
];

const CATEGORY_FILTERS: { id: 'ALL' | AppNotificationCategory; label: string }[] = [
  { id: 'ALL', label: 'All' },
  { id: 'CANDIDATE', label: 'Candidates' },
  { id: 'INTERVIEW', label: 'Interviews' },
  { id: 'PLACEMENT', label: 'Placements' },
  { id: 'JOB', label: 'Jobs' },
  { id: 'TASK', label: 'Tasks' },
  { id: 'CLIENT', label: 'Clients' },
  { id: 'LEAD', label: 'Leads' },
  { id: 'SYSTEM', label: 'System' },
];

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const now = Date.now();
  const diffMs = now - date.getTime();
  const sec = Math.floor(diffMs / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (sec < 45) return 'Just now';
  if (min < 60) return `${min}m ago`;
  if (hr < 24) return `${hr}h ago`;
  if (day < 7) return `${day}d ago`;
  return formatDateDMY(date);
}

/** Alert-style notifications (scheduler overdue, system warnings, etc.). */
function isAlertNotification(n: AppNotification): boolean {
  if (n.category === 'SYSTEM') return true;
  const meta = n.metadata || {};
  const severity = String(meta.severity || meta.level || meta.alertType || '').toLowerCase();
  if (['high', 'critical', 'warning', 'alert', 'error'].includes(severity)) return true;
  if (meta.alert === true || meta.isAlert === true) return true;
  const blob = `${n.title || ''} ${n.description || ''} ${n.actionLabel || ''}`.toLowerCase();
  return (
    blob.includes('overdue') ||
    blob.includes('alert') ||
    blob.includes('warning') ||
    blob.includes('urgent') ||
    blob.includes('sla') ||
    blob.includes('at risk') ||
    blob.includes('follow-up overdue') ||
    blob.includes('followup overdue')
  );
}

function categoryAccent(category: string): { tile: string; bar: string } {
  switch (category) {
    case 'CANDIDATE':
      return { tile: 'bg-sky-50 text-sky-700 border-sky-200', bar: '#0ea5e9' };
    case 'INTERVIEW':
      return { tile: 'bg-violet-50 text-violet-700 border-violet-200', bar: '#7c3aed' };
    case 'PLACEMENT':
      return { tile: 'bg-emerald-50 text-emerald-700 border-emerald-200', bar: '#10b981' };
    case 'JOB':
      return { tile: 'bg-amber-50 text-amber-700 border-amber-200', bar: '#f59e0b' };
    case 'CLIENT':
      return { tile: 'bg-indigo-50 text-indigo-700 border-indigo-200', bar: '#6366f1' };
    case 'TASK':
      return { tile: 'bg-rose-50 text-rose-700 border-rose-200', bar: '#f43f5e' };
    case 'BILLING':
      return { tile: 'bg-teal-50 text-teal-700 border-teal-200', bar: '#14b8a6' };
    case 'LEAD':
      return { tile: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200', bar: '#d946ef' };
    case 'SYSTEM':
      return { tile: 'bg-amber-50 text-amber-800 border-amber-200', bar: '#f59e0b' };
    default:
      return { tile: 'bg-slate-50 text-slate-700 border-slate-200', bar: '#64748b' };
  }
}

function CategoryIcon({ category }: { category: string }) {
  const cls = 'size-4';
  switch (category) {
    case 'CANDIDATE':
      return <Users className={cls} />;
    case 'INTERVIEW':
      return <CalendarCheck2 className={cls} />;
    case 'PLACEMENT':
      return <CheckSquare className={cls} />;
    case 'JOB':
      return <Briefcase className={cls} />;
    case 'TASK':
      return <Clock3 className={cls} />;
    case 'SYSTEM':
      return <AlertTriangle className={cls} />;
    default:
      return <Bell className={cls} />;
  }
}

export function NotificationDrawer({ isOpen, onClose }: NotificationDrawerProps) {
  const [statusTab, setStatusTab] = useState<StatusTab>('unread');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | AppNotificationCategory>('ALL');
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiListNotifications({
        category: 'ALL',
        take: 100,
      });
      const list = res?.data?.notifications || [];
      setItems(list);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to load notifications';
      setError(message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    void load();
    const onUpdated = () => void load();
    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, onUpdated);
    return () => window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, onUpdated);
  }, [isOpen, load]);

  // Lock page scroll while the drawer is open — only the notification list may scroll.
  useEffect(() => {
    if (!isOpen) return;

    const body = document.body;
    const html = document.documentElement;
    const prevBodyOverflow = body.style.overflow;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyPaddingRight = body.style.paddingRight;
    const scrollbarGap = Math.max(0, window.innerWidth - html.clientWidth);

    body.style.overflow = 'hidden';
    html.style.overflow = 'hidden';
    if (scrollbarGap > 0) {
      body.style.paddingRight = `${scrollbarGap}px`;
    }

    const preventPageScroll = (event: WheelEvent | TouchEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) {
        event.preventDefault();
        return;
      }
      const list = document.getElementById('notification-drawer-scroll');
      if (list && list.contains(target)) {
        // Keep scrolling inside the list; stop page scroll-chaining at the edges.
        if (event instanceof WheelEvent) {
          const atTop = list.scrollTop <= 0 && event.deltaY < 0;
          const atBottom =
            list.scrollTop + list.clientHeight >= list.scrollHeight - 1 && event.deltaY > 0;
          if (atTop || atBottom) event.preventDefault();
        }
        return;
      }
      event.preventDefault();
    };

    window.addEventListener('wheel', preventPageScroll, { passive: false });
    window.addEventListener('touchmove', preventPageScroll, { passive: false });

    return () => {
      body.style.overflow = prevBodyOverflow;
      html.style.overflow = prevHtmlOverflow;
      body.style.paddingRight = prevBodyPaddingRight;
      window.removeEventListener('wheel', preventPageScroll);
      window.removeEventListener('touchmove', preventPageScroll);
    };
  }, [isOpen]);

  const counts = useMemo(() => {
    const unread = items.filter((n) => !n.isRead).length;
    const read = items.filter((n) => n.isRead).length;
    const alerts = items.filter((n) => isAlertNotification(n)).length;
    return { unread, read, alerts };
  }, [items]);

  const filtered = useMemo(() => {
    let list = items;
    if (statusTab === 'unread') list = list.filter((n) => !n.isRead);
    else if (statusTab === 'read') list = list.filter((n) => n.isRead);
    else list = list.filter((n) => isAlertNotification(n));

    if (categoryFilter !== 'ALL') {
      list = list.filter((n) => n.category === categoryFilter);
    }
    return list;
  }, [items, statusTab, categoryFilter]);

  const handleMarkRead = useCallback(async (n: AppNotification) => {
    if (n.isRead) return;
    setBusyId(n.id);
    setItems((prev) => prev.map((it) => (it.id === n.id ? { ...it, isRead: true } : it)));
    try {
      await apiMarkNotificationRead(n.id);
    } catch (e) {
      console.warn('mark-read failed', e);
    } finally {
      setBusyId(null);
    }
  }, []);

  const handleMarkAll = useCallback(async () => {
    setItems((prev) => prev.map((it) => ({ ...it, isRead: true })));
    try {
      await apiMarkAllNotificationsRead();
    } catch (e) {
      console.warn('mark-all-read failed', e);
    }
  }, []);

  const handleDelete = useCallback(async (n: AppNotification) => {
    setBusyId(n.id);
    setItems((prev) => prev.filter((it) => it.id !== n.id));
    try {
      await apiDeleteNotification(n.id);
    } catch (e) {
      console.warn('delete notification failed', e);
    } finally {
      setBusyId(null);
    }
  }, []);

  const emptyCopy = useMemo(() => {
    if (statusTab === 'unread') {
      return {
        title: 'No unread notifications',
        body: 'New activity will show up here until you mark it as read.',
      };
    }
    if (statusTab === 'read') {
      return {
        title: 'No read notifications',
        body: 'Items you open or mark as read will appear in this tab.',
      };
    }
    return {
      title: 'No alerts right now',
      body: 'Overdue follow-ups, SLA risks, and system warnings land in Alerts.',
    };
  }, [statusTab]);

  return (
    <AnimatePresence>
      {isOpen ? (
        <>
          <motion.button
            type="button"
            aria-label="Close notifications"
            className="fixed inset-0 z-[70] bg-slate-900/35 backdrop-blur-[1px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            initial={{ opacity: 0, x: 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 28 }}
            transition={{ duration: 0.18 }}
            className="fixed right-5 top-16 z-[80] flex h-[calc(100vh-88px)] w-full max-w-[460px] flex-col overflow-hidden overscroll-contain rounded-[28px] border border-slate-200 bg-white shadow-2xl"
          >
            <div className="shrink-0 border-b border-slate-100 px-6 py-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                    <Bell className="size-3.5" />
                    Notifications
                    {counts.unread > 0 ? (
                      <span className="ml-1 rounded-full bg-rose-500 px-2 text-[10px] font-bold text-white">
                        {counts.unread > 99 ? '99+' : counts.unread}
                      </span>
                    ) : null}
                  </div>
                  <h2 className="mt-3 text-xl font-bold text-slate-900">Activity feed</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Switch between unread, read, and alert notifications.
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => void load()}
                    className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50"
                    title="Refresh"
                  >
                    <RefreshCw className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50"
                    title="Close"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </div>

              {/* Primary tabs: Unread / Read / Alerts */}
              <div
                className="mt-4 grid grid-cols-3 gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-1"
                role="tablist"
                aria-label="Notification status"
              >
                {STATUS_TABS.map((tab) => {
                  const Icon = tab.icon;
                  const active = statusTab === tab.id;
                  const count =
                    tab.id === 'unread'
                      ? counts.unread
                      : tab.id === 'read'
                        ? counts.read
                        : counts.alerts;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setStatusTab(tab.id)}
                      className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-xs font-bold transition ${
                        active
                          ? tab.id === 'alerts'
                            ? 'bg-amber-500 text-white shadow-sm'
                            : 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <Icon className="size-3.5 shrink-0" />
                      <span>{tab.label}</span>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
                          active
                            ? tab.id === 'alerts'
                              ? 'bg-white/20 text-white'
                              : 'bg-slate-100 text-slate-600'
                            : 'bg-slate-200/70 text-slate-500'
                        }`}
                      >
                        {count > 99 ? '99+' : count}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 flex items-center justify-between gap-2">
                <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                  {CATEGORY_FILTERS.map((f) => {
                    const active = f.id === categoryFilter;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setCategoryFilter(f.id)}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                          active
                            ? 'bg-slate-900 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {f.label}
                      </button>
                    );
                  })}
                </div>
                {statusTab !== 'read' ? (
                  <button
                    type="button"
                    onClick={() => void handleMarkAll()}
                    disabled={counts.unread === 0}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md text-xs font-semibold text-sky-600 transition hover:text-sky-700 disabled:cursor-not-allowed disabled:text-slate-300"
                  >
                    <CheckCheck className="size-3.5" />
                    Mark all read
                  </button>
                ) : null}
              </div>
            </div>

            <div
              id="notification-drawer-scroll"
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5"
            >
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="size-7 animate-spin text-slate-400" />
                </div>
              ) : error ? (
                <div className="rounded-3xl border border-red-100 bg-red-50 p-5 text-sm text-red-700">
                  {error}
                </div>
              ) : filtered.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                  <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-white">
                    {statusTab === 'alerts' ? (
                      <AlertTriangle className="size-5 text-amber-500" />
                    ) : (
                      <Bell className="size-5 text-slate-400" />
                    )}
                  </div>
                  <p className="text-base font-semibold text-slate-700">{emptyCopy.title}</p>
                  <p className="mt-2 text-sm text-slate-500">{emptyCopy.body}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filtered.map((n) => {
                    const accent = categoryAccent(n.category);
                    const alertItem = isAlertNotification(n);
                    const Wrapper: React.ElementType = n.actionPath ? Link : 'div';
                    const wrapperProps: Record<string, unknown> = n.actionPath
                      ? {
                          href: n.actionPath,
                          onClick: () => {
                            void handleMarkRead(n);
                            onClose();
                          },
                        }
                      : {
                          onClick: () => void handleMarkRead(n),
                        };
                    return (
                      <Wrapper
                        key={n.id}
                        {...wrapperProps}
                        className={`relative block cursor-pointer rounded-2xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                          alertItem && statusTab === 'alerts'
                            ? 'border-amber-200 bg-amber-50/50'
                            : n.isRead
                              ? 'border-slate-200'
                              : 'border-sky-100 bg-sky-50/40'
                        }`}
                      >
                        <span
                          aria-hidden
                          className="absolute inset-y-2 left-0 w-1 rounded-r-full"
                          style={{ background: alertItem ? '#f59e0b' : accent.bar }}
                        />
                        <div className="flex items-start gap-3 pl-3">
                          <div
                            className={`rounded-xl border p-2.5 ${
                              alertItem ? 'border-amber-200 bg-amber-50 text-amber-700' : accent.tile
                            }`}
                          >
                            {alertItem ? (
                              <AlertTriangle className="size-4" />
                            ) : (
                              <CategoryIcon category={n.category} />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <h3 className="truncate text-sm font-bold text-slate-900">
                                  {n.title}
                                </h3>
                                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                  {!n.isRead ? (
                                    <span className="rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-700">
                                      Unread
                                    </span>
                                  ) : (
                                    <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                                      Read
                                    </span>
                                  )}
                                  {alertItem ? (
                                    <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">
                                      Alert
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                              <span className="shrink-0 text-[11px] font-semibold text-slate-400">
                                {formatTimestamp(n.createdAt)}
                              </span>
                            </div>
                            {n.description ? (
                              <p className="mt-1 text-sm leading-6 text-slate-600">
                                {n.description}
                              </p>
                            ) : null}
                            <div className="mt-2 flex items-center justify-between gap-2">
                              {n.actionLabel && n.actionPath ? (
                                <span className="text-xs font-semibold text-sky-600 hover:text-sky-700">
                                  {n.actionLabel} →
                                </span>
                              ) : (
                                <span />
                              )}
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  void handleDelete(n);
                                }}
                                disabled={busyId === n.id}
                                className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-rose-500"
                                title="Dismiss"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </Wrapper>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
