'use client';

import Link from 'next/link';
import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Bell,
  Briefcase,
  CalendarCheck2,
  CheckSquare,
  Clock3,
  Users,
  X,
} from 'lucide-react';
import { apiGetUnifiedCalendar, type UnifiedCalendarEvent } from '../lib/api';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DailyNotification {
  id: string;
  title: string;
  message: string;
  href: string;
  timeLabel: string;
  icon: React.ElementType;
  accentClass: string;
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfToday() {
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  return date;
}

function formatTimeLabel(dateString: string, allDay?: boolean) {
  if (allDay) return 'Today';
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(dateString));
}

function buildDailyNotification(event: UnifiedCalendarEvent): DailyNotification {
  const clientName = String(event.metadata.clientName || event.subtitle || '').trim();
  const candidateName = String(event.metadata.candidateName || event.title || '').trim();
  const jobTitle = String(event.metadata.jobTitle || event.title || '').trim();

  switch (event.type) {
    case 'INTERVIEW':
      return {
        id: event.id,
        title: 'Interview Today',
        message: `Today you have an interview with ${candidateName || 'the candidate'}${jobTitle ? ` for ${jobTitle}` : ''}.`,
        href: '/interviews',
        timeLabel: formatTimeLabel(event.start, event.allDay),
        icon: CalendarCheck2,
        accentClass: 'bg-violet-50 text-violet-700 border-violet-200',
      };
    case 'TASK':
      return {
        id: event.id,
        title: 'Assigned Task',
        message: `Today you have a task${event.title ? `: ${event.title}` : ''}.`,
        href: '/Task&Activites',
        timeLabel: formatTimeLabel(event.start, event.allDay),
        icon: CheckSquare,
        accentClass: 'bg-amber-50 text-amber-700 border-amber-200',
      };
    case 'CLIENT_MEETING':
      return {
        id: event.id,
        title: 'Client Follow-up',
        message: `${event.metadata.meetingType || 'Meeting'} scheduled today${clientName ? ` with ${clientName}` : ''}.`,
        href: '/client',
        timeLabel: formatTimeLabel(event.start, event.allDay),
        icon: Users,
        accentClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      };
    case 'CLIENT_FOLLOW_UP':
      return {
        id: event.id,
        title: 'Client Action Due',
        message: `Today you need to follow up${clientName ? ` with ${clientName}` : ' with a client'}.`,
        href: '/client',
        timeLabel: formatTimeLabel(event.start, event.allDay),
        icon: Clock3,
        accentClass: 'bg-rose-50 text-rose-700 border-rose-200',
      };
    case 'JOB_CREATED':
    default:
      return {
        id: event.id,
        title: 'New Requirement',
        message: `A new client requirement was added today${clientName ? ` for ${clientName}` : ''}${jobTitle ? `: ${jobTitle}` : ''}.`,
        href: '/job',
        timeLabel: formatTimeLabel(event.start, event.allDay),
        icon: Briefcase,
        accentClass: 'bg-sky-50 text-sky-700 border-sky-200',
      };
  }
}

export function NotificationDrawer({ isOpen, onClose }: NotificationDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<DailyNotification[]>([]);

  useEffect(() => {
    if (!isOpen) return;

    let ignore = false;

    async function loadNotifications() {
      setLoading(true);
      setError(null);
      try {
        const response = await apiGetUnifiedCalendar({
          start: startOfToday().toISOString(),
          end: endOfToday().toISOString(),
          mineOnly: true,
        });

        if (ignore) return;

        const items = response.data.events
          .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
          .map(buildDailyNotification);

        setNotifications(items);
      } catch (loadError: any) {
        if (!ignore) {
          setError(loadError.message || 'Unable to load notifications');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadNotifications();

    return () => {
      ignore = true;
    };
  }, [isOpen]);

  const count = useMemo(() => notifications.length, [notifications]);

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
            className="fixed right-5 top-16 z-[80] flex h-[calc(100vh-88px)] w-full max-w-[420px] flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                  <Bell className="size-3.5" />
                  Daily Notifications
                </div>
                <h2 className="mt-3 text-xl font-bold text-slate-900">Today’s Updates</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Interviews, tasks, client actions, and new requirements for today.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="rounded-3xl border border-slate-100 p-4">
                      <div className="h-4 w-28 animate-pulse rounded bg-slate-100" />
                      <div className="mt-3 h-3 w-full animate-pulse rounded bg-slate-100" />
                      <div className="mt-2 h-3 w-4/5 animate-pulse rounded bg-slate-100" />
                    </div>
                  ))}
                </div>
              ) : error ? (
                <div className="rounded-3xl border border-red-100 bg-red-50 p-5 text-sm text-red-700">{error}</div>
              ) : notifications.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                  <p className="text-base font-semibold text-slate-700">No notifications for today</p>
                  <p className="mt-2 text-sm text-slate-500">You’re all caught up on today’s scheduled work.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {notifications.map((item) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      onClick={onClose}
                      className="block rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`rounded-2xl border p-3 ${item.accentClass}`}>
                          <item.icon className="size-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <h3 className="truncate text-sm font-bold text-slate-900">{item.title}</h3>
                            <span className="shrink-0 text-xs font-semibold text-slate-400">{item.timeLabel}</span>
                          </div>
                          <p className="mt-1 text-sm leading-6 text-slate-600">{item.message}</p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
