'use client';

import Link from 'next/link';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Bell,
  Briefcase,
  CalendarCheck2,
  CheckCheck,
  CheckSquare,
  Clock3,
  Loader2,
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

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const FILTERS: { id: 'ALL' | AppNotificationCategory; label: string }[] = [
  { id: 'ALL', label: 'All' },
  { id: 'CANDIDATE', label: 'Candidates' },
  { id: 'INTERVIEW', label: 'Interviews' },
  { id: 'PLACEMENT', label: 'Placements' },
  { id: 'JOB', label: 'Jobs' },
  { id: 'TASK', label: 'Tasks' },
  { id: 'CLIENT', label: 'Clients' },
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
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
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
    default:
      return <Bell className={cls} />;
  }
}

export function NotificationDrawer({ isOpen, onClose }: NotificationDrawerProps) {
  const [activeFilter, setActiveFilter] = useState<'ALL' | AppNotificationCategory>('ALL');
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiListNotifications({
        category: activeFilter,
        take: 50,
      });
      const list = res?.data?.notifications || [];
      setItems(list);
    } catch (e: any) {
      setError(e?.message || 'Failed to load notifications');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [activeFilter]);

  useEffect(() => {
    if (!isOpen) return;
    void load();
    const onUpdated = () => void load();
    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, onUpdated);
    return () => window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, onUpdated);
  }, [isOpen, load]);

  const filtered = useMemo(() => items, [items]);

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

  const unreadCount = items.filter((n) => !n.isRead).length;

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
            className="fixed right-5 top-16 z-[80] flex h-[calc(100vh-88px)] w-full max-w-[460px] flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl"
          >
            <div className="border-b border-slate-100 px-6 py-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                    <Bell className="size-3.5" />
                    Notifications
                    {unreadCount > 0 ? (
                      <span className="ml-1 rounded-full bg-rose-500 px-2 text-[10px] font-bold text-white">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    ) : null}
                  </div>
                  <h2 className="mt-3 text-xl font-bold text-slate-900">Activity feed</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Candidate applies, interview schedules, placements, and team toasts — all in one place.
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

              <div className="mt-4 flex items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1.5">
                  {FILTERS.map((f) => {
                    const active = f.id === activeFilter;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setActiveFilter(f.id)}
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
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
                <button
                  type="button"
                  onClick={() => void handleMarkAll()}
                  disabled={unreadCount === 0}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md text-xs font-semibold text-sky-600 transition hover:text-sky-700 disabled:cursor-not-allowed disabled:text-slate-300"
                >
                  <CheckCheck className="size-3.5" />
                  Mark all read
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
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
                    <Bell className="size-5 text-slate-400" />
                  </div>
                  <p className="text-base font-semibold text-slate-700">You&apos;re all caught up</p>
                  <p className="mt-2 text-sm text-slate-500">
                    Bell entries appear here whenever a candidate applies, you book an interview, or a placement is created.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filtered.map((n) => {
                    const accent = categoryAccent(n.category);
                    const Wrapper: React.ElementType = n.actionPath ? Link : 'div';
                    const wrapperProps: any = n.actionPath
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
                          n.isRead ? 'border-slate-200' : 'border-sky-100 bg-sky-50/40'
                        }`}
                      >
                        <span
                          aria-hidden
                          className="absolute inset-y-2 left-0 w-1 rounded-r-full"
                          style={{ background: accent.bar }}
                        />
                        <div className="flex items-start gap-3 pl-3">
                          <div className={`rounded-xl border p-2.5 ${accent.tile}`}>
                            <CategoryIcon category={n.category} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <h3 className="truncate text-sm font-bold text-slate-900">
                                {n.title}
                              </h3>
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
