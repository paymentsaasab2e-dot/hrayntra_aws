'use client';

import Link from 'next/link';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Briefcase,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ListTodo,
  RefreshCw,
  Users,
  Video,
} from 'lucide-react';
import {
  apiGetUnifiedCalendar,
  type UnifiedCalendarEvent,
  type UnifiedCalendarEventType,
  type UnifiedCalendarResponse,
} from '../../lib/api';

const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const typeLabels: Record<UnifiedCalendarEventType, string> = {
  JOB_CREATED: 'Job Created',
  TASK: 'Task',
  INTERVIEW: 'Interview',
  CLIENT_MEETING: 'Client Meeting',
  CLIENT_FOLLOW_UP: 'Client Follow-up',
};

const typeStyles: Record<UnifiedCalendarEventType, string> = {
  JOB_CREATED: 'bg-sky-50 text-sky-700 border-sky-200',
  TASK: 'bg-amber-50 text-amber-700 border-amber-200',
  INTERVIEW: 'bg-violet-50 text-violet-700 border-violet-200',
  CLIENT_MEETING: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CLIENT_FOLLOW_UP: 'bg-rose-50 text-rose-700 border-rose-200',
};

const typeIcons: Record<UnifiedCalendarEventType, React.ElementType> = {
  JOB_CREATED: Briefcase,
  TASK: ListTodo,
  INTERVIEW: Video,
  CLIENT_MEETING: Users,
  CLIENT_FOLLOW_UP: CalendarDays,
};

function getMonthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getMonthEnd(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function getGridStart(date: Date) {
  const monthStart = getMonthStart(date);
  const day = monthStart.getDay();
  const mondayOffset = day === 0 ? 6 : day - 1;
  const value = new Date(monthStart);
  value.setDate(monthStart.getDate() - mondayOffset);
  value.setHours(0, 0, 0, 0);
  return value;
}

function getGridEnd(date: Date) {
  const monthEnd = getMonthEnd(date);
  const day = monthEnd.getDay();
  const sundayOffset = day === 0 ? 0 : 7 - day;
  const value = new Date(monthEnd);
  value.setDate(monthEnd.getDate() + sundayOffset);
  value.setHours(23, 59, 59, 999);
  return value;
}

function formatDayKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isSameDay(left: Date, right: Date) {
  return formatDayKey(left) === formatDayKey(right);
}

function formatEventTime(event: UnifiedCalendarEvent) {
  if (event.allDay) return 'All day';
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(event.start));
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function formatHtmlContent(value?: string | null) {
  if (!value) return null;

  const normalized = value
    .replace(/<\/(p|div|h1|h2|h3|h4|h5|h6|li|ul|ol)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li>/gi, '- ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ');

  const decoded = decodeHtmlEntities(normalized)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');

  return decoded || value;
}

function prettifyLabel(value: string) {
  return value
    .replace(/([A-Z])/g, ' $1')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function parseDescriptionSections(value?: string | null) {
  const formatted = formatHtmlContent(value);
  if (!formatted) return [];

  const headingSet = new Set([
    'Key Responsibilities',
    'Qualifications and Experience',
    'Compensation & Benefits',
    'Requirements',
    'Responsibilities',
    'Benefits',
    'Summary',
    'Overview',
  ]);

  const lines = formatted
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const sections: Array<{ heading?: string; items: string[] }> = [];
  let currentSection: { heading?: string; items: string[] } = { items: [] };

  lines.forEach((line, index) => {
    const normalizedLine = line.replace(/:$/, '');
    const isBullet = normalizedLine.startsWith('- ');
    const isHeading =
      !isBullet &&
      (headingSet.has(normalizedLine) ||
        (/^[A-Z][A-Za-z&/\s]{3,}$/.test(normalizedLine) &&
          index > 0));

    if (isHeading) {
      if (currentSection.items.length || currentSection.heading) {
        sections.push(currentSection);
      }
      currentSection = { heading: normalizedLine, items: [] };
      return;
    }

    currentSection.items.push(normalizedLine);
  });

  if (currentSection.items.length || currentSection.heading) {
    sections.push(currentSection);
  }

  return sections;
}

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [calendarData, setCalendarData] = useState<UnifiedCalendarResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTypes, setActiveTypes] = useState<UnifiedCalendarEventType[]>([
    'JOB_CREATED',
    'TASK',
    'INTERVIEW',
    'CLIENT_MEETING',
    'CLIENT_FOLLOW_UP',
  ]);

  const rangeStart = useMemo(() => getGridStart(currentMonth), [currentMonth]);
  const rangeEnd = useMemo(() => getGridEnd(currentMonth), [currentMonth]);

  useEffect(() => {
    let ignore = false;

    async function loadCalendar() {
      setLoading(true);
      setError(null);
      try {
        const response = await apiGetUnifiedCalendar({
          start: rangeStart.toISOString(),
          end: rangeEnd.toISOString(),
          mineOnly: true,
        });
        if (!ignore) {
          setCalendarData(response.data);
        }
      } catch (loadError: any) {
        if (!ignore) {
          setError(loadError.message || 'Unable to load calendar');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadCalendar();
    return () => {
      ignore = true;
    };
  }, [rangeEnd, rangeStart]);

  const gridDays = useMemo(() => {
    const days: Date[] = [];
    const cursor = new Date(rangeStart);
    while (cursor <= rangeEnd) {
      days.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
  }, [rangeEnd, rangeStart]);

  const filteredEvents = useMemo(() => {
    const events = calendarData?.events || [];
    return events.filter((event) => activeTypes.includes(event.type));
  }, [activeTypes, calendarData?.events]);

  const eventsByDay = useMemo(() => {
    const grouped = new Map<string, UnifiedCalendarEvent[]>();
    filteredEvents.forEach((event) => {
      const key = formatDayKey(new Date(event.start));
      const current = grouped.get(key) || [];
      current.push(event);
      grouped.set(key, current);
    });
    return grouped;
  }, [filteredEvents]);

  const selectedDayEvents = useMemo(() => {
    const key = formatDayKey(selectedDate);
    return (eventsByDay.get(key) || []).slice().sort((a, b) => {
      return new Date(a.start).getTime() - new Date(b.start).getTime();
    });
  }, [eventsByDay, selectedDate]);

  const toggleType = (type: UnifiedCalendarEventType) => {
    setActiveTypes((current) =>
      current.includes(type) ? current.filter((item) => item !== type) : [...current, type]
    );
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentMonth(today);
    setSelectedDate(today);
  };

  const monthLabel = new Intl.DateTimeFormat(undefined, {
    month: 'long',
    year: 'numeric',
  }).format(currentMonth);

  const selectedDayLabel = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(selectedDate);

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-6 md:p-8">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Recruiter Calendar</h1>
            <p className="mt-1 text-sm text-slate-500">
              Jobs created, interviews, client follow-ups, meetings, and task due dates in one place.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={goToToday}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setCurrentMonth((value) => new Date(value))}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm"
            >
              <RefreshCw className="size-4" />
              Refresh
            </button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Total</div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{calendarData?.summary.total ?? 0}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Interviews</div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{calendarData?.summary.interviews ?? 0}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Tasks</div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{calendarData?.summary.tasks ?? 0}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Client Actions</div>
            <div className="mt-2 text-2xl font-bold text-slate-900">
              {(calendarData?.summary.meetings ?? 0) + (calendarData?.summary.followUps ?? 0)}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Jobs Created</div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{calendarData?.summary.jobs ?? 0}</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(Object.keys(typeLabels) as UnifiedCalendarEventType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => toggleType(type)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                activeTypes.includes(type)
                  ? typeStyles[type]
                  : 'border-slate-200 bg-white text-slate-500'
              }`}
            >
              {typeLabels[type]}
            </button>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(340px,0.9fr)]">
          <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{monthLabel}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Click any day to inspect jobs, follow-ups, meetings, and scheduled work.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentMonth((value) => new Date(value.getFullYear(), value.getMonth() - 1, 1))}
                  className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 shadow-sm transition hover:bg-slate-50"
                  aria-label="Previous month"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentMonth((value) => new Date(value.getFullYear(), value.getMonth() + 1, 1))}
                  className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 shadow-sm transition hover:bg-slate-50"
                  aria-label="Next month"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
              {weekdayLabels.map((label) => (
                <div key={label} className="px-3 py-3 text-center text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                  {label}
                </div>
              ))}
            </div>

            {loading ? (
              <div className="grid grid-cols-7">
                {Array.from({ length: 35 }).map((_, index) => (
                  <div key={index} className="min-h-[130px] border-b border-r border-slate-100 p-3">
                    <div className="h-4 w-8 animate-pulse rounded bg-slate-100" />
                    <div className="mt-4 space-y-2">
                      <div className="h-5 animate-pulse rounded bg-slate-100" />
                      <div className="h-5 animate-pulse rounded bg-slate-100" />
                    </div>
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="p-8 text-center">
                <div className="text-lg font-semibold text-red-700">Unable to load calendar</div>
                <p className="mt-1 text-sm text-red-500">{error}</p>
              </div>
            ) : (
              <div className="grid grid-cols-7">
                {gridDays.map((day) => {
                  const key = formatDayKey(day);
                  const dayEvents = eventsByDay.get(key) || [];
                  const inCurrentMonth = day.getMonth() === currentMonth.getMonth();
                  const selected = isSameDay(day, selectedDate);
                  const today = isSameDay(day, new Date());

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedDate(day)}
                      className={`min-h-[140px] border-b border-r border-slate-100 p-3 text-left align-top transition ${
                        selected ? 'bg-blue-50/60' : 'bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`grid h-8 w-8 place-items-center rounded-full text-sm font-semibold ${
                            today
                              ? 'bg-blue-600 text-white'
                              : inCurrentMonth
                                ? 'text-slate-800'
                                : 'text-slate-300'
                          }`}
                        >
                          {day.getDate()}
                        </span>
                        {dayEvents.length > 0 ? (
                          <span className="text-xs font-semibold text-slate-400">{dayEvents.length}</span>
                        ) : null}
                      </div>

                      <div className="mt-3 space-y-2">
                        {dayEvents.slice(0, 3).map((event) => {
                          const Icon = typeIcons[event.type];
                          return (
                            <div
                              key={event.id}
                              className={`rounded-xl border px-2.5 py-2 text-xs font-medium ${typeStyles[event.type]}`}
                            >
                              <div className="flex items-center gap-1.5">
                                <Icon className="size-3.5 shrink-0" />
                                <span className="truncate">{event.title}</span>
                              </div>
                              <div className="mt-1 truncate text-[11px] opacity-80">{formatEventTime(event)}</div>
                            </div>
                          );
                        })}
                        {dayEvents.length > 3 ? (
                          <div className="text-xs font-semibold text-slate-400">+{dayEvents.length - 3} more</div>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <aside className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="space-y-3">
              {selectedDayEvents.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                  No scheduled items for this day.
                </div>
              ) : (
                selectedDayEvents.map((event) => {
                  const Icon = typeIcons[event.type];
                  const descriptionSections = parseDescriptionSections(event.description);
                  const metadataEntries = Object.entries(event.metadata).filter(([, value]) => value !== null && value !== '');

                  return (
                    <div key={event.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className={`rounded-2xl border p-3 ${typeStyles[event.type]}`}>
                            <Icon className="size-5" />
                          </div>
                          <div>
                            <div className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${typeStyles[event.type]}`}>
                              {typeLabels[event.type]}
                            </div>
                            <h3 className="mt-2 text-base font-bold text-slate-900">{event.title}</h3>
                            {event.subtitle ? <p className="mt-1 text-sm text-slate-500">{event.subtitle}</p> : null}
                          </div>
                        </div>

                        <Link
                          href={event.route}
                          className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
                        >
                          Open
                        </Link>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5">
                          <Clock3 className="size-3.5" />
                          {formatEventTime(event)}
                        </span>
                        {event.status ? (
                          <span className="rounded-full bg-slate-100 px-3 py-1.5">{event.status}</span>
                        ) : null}
                        {event.priority ? (
                          <span className="rounded-full bg-slate-100 px-3 py-1.5">{event.priority}</span>
                        ) : null}
                      </div>

                      {descriptionSections.length > 0 ? (
                        <div className="mt-4 space-y-4 rounded-2xl bg-slate-50 p-4">
                          {descriptionSections.map((section, index) => (
                            <div key={`${event.id}-section-${index}`} className="space-y-2">
                              {section.heading ? (
                                <h4 className="text-sm font-bold text-slate-900">{section.heading}</h4>
                              ) : null}
                              <div className="space-y-2">
                                {section.items.map((item, itemIndex) => {
                                  const isBullet = item.startsWith('- ');
                                  return isBullet ? (
                                    <div key={`${event.id}-item-${itemIndex}`} className="flex gap-2 text-sm text-slate-600">
                                      <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                                      <span>{item.replace(/^- /, '')}</span>
                                    </div>
                                  ) : (
                                    <p key={`${event.id}-item-${itemIndex}`} className="text-sm leading-6 text-slate-600">
                                      {item}
                                    </p>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {metadataEntries.length > 0 ? (
                        <div className="mt-4 grid gap-2 sm:grid-cols-2">
                          {metadataEntries.map(([key, value]) => (
                            <div key={key} className="rounded-2xl bg-slate-50 px-3 py-2">
                              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                                {prettifyLabel(key)}
                              </div>
                              <div className="mt-1 text-sm font-medium text-slate-700">{String(value)}</div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
