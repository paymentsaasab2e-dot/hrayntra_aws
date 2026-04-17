'use client';

import React, { useMemo } from 'react';
import {
  PlusCircle,
  Pencil,
  UserPlus,
  CheckCircle,
  Trash2,
  Paperclip,
  MessageSquare,
  Calendar,
  Clock,
  RotateCcw,
  Circle,
} from 'lucide-react';
import type { TaskActivityEvent, TaskActivityEventType } from '../app/Task&Activites/types';

export interface TaskActivityLogProps {
  events: TaskActivityEvent[];
  /** Optional class for the scrollable container */
  className?: string;
}

type IconComponent = React.ComponentType<{ size?: number; className?: string }>;
const ACTION_ICONS: Record<TaskActivityEventType, IconComponent> = {
  created: PlusCircle as IconComponent,
  edited: Pencil as IconComponent,
  assigned: UserPlus as IconComponent,
  priority_changed: Pencil as IconComponent,
  due_date_changed: Calendar as IconComponent,
  status_updated: Pencil as IconComponent,
  reminder_changed: Clock as IconComponent,
  attachment_uploaded: Paperclip as IconComponent,
  note_added: MessageSquare as IconComponent,
  completed: CheckCircle as IconComponent,
  reopened: RotateCcw as IconComponent,
  deleted: Trash2 as IconComponent,
};

function getDateGroupLabel(timestamp: string): string {
  const d = new Date(timestamp);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const dDay = new Date(d);
  dDay.setHours(0, 0, 0, 0);

  if (dDay.getTime() === today.getTime()) return 'Today';
  if (dDay.getTime() === yesterday.getTime()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function groupEventsByDate(events: TaskActivityEvent[]): { label: string; events: TaskActivityEvent[] }[] {
  const sorted = [...events].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const groups: Map<string, TaskActivityEvent[]> = new Map();
  for (const e of sorted) {
    const label = getDateGroupLabel(e.timestamp);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(e);
  }
  const order = ['Today', 'Yesterday'];
  const entries = Array.from(groups.entries()).map(([label, evs]) => ({
    label,
    events: evs,
    sortKey: evs[0] ? new Date(evs[0].timestamp).getTime() : 0,
  }));
  return entries
    .sort((a, b) => {
      const ai = order.indexOf(a.label);
      const bi = order.indexOf(b.label);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return b.sortKey - a.sortKey;
    })
    .map(({ label, events: evs }) => ({ label, events: evs }));
}

function formatTime(timestamp: string): string {
  const d = new Date(timestamp);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

export function TaskActivityLog({ events, className = '' }: TaskActivityLogProps) {
  const grouped = useMemo(() => groupEventsByDate(events), [events]);

  if (events.length === 0) {
    return (
      <div className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden ${className}`}>
        <div className="p-4 border-b border-slate-100">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Activity Log</h4>
          <p className="text-xs text-slate-500 mt-0.5">All system actions related to this task</p>
        </div>
        <div className="p-8 text-center">
          <MessageSquare size={32} className="mx-auto text-slate-300 mb-3" />
          <p className="text-sm text-slate-500">No activity recorded yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden ${className}`}>
      <div className="p-4 border-b border-slate-100">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Activity Log</h4>
        <p className="text-xs text-slate-500 mt-0.5">All system actions related to this task</p>
      </div>
      <div className="p-4 max-h-[calc(100vh-320px)] overflow-y-auto">
        <div className="relative flex">
          <div className="absolute left-6 top-0 bottom-0 w-px bg-slate-200 z-0" aria-hidden />
          <div className="flex flex-col gap-5 flex-1 min-w-0">
            {grouped.map(({ label, events: groupEvents }) => (
              <div key={label} className="space-y-3">
                <div className="pl-0">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
                </div>
                {groupEvents.map((event) => {
                  const Icon = ACTION_ICONS[event.actionType] ?? Circle;
                  const timeStr = event.timestampDisplay ?? formatTime(event.timestamp);
                  return (
                    <div key={event.id} className="flex gap-4 items-start flex-shrink-0">
                      <div className="w-12 flex justify-center shrink-0 relative z-10">
                        <div className="w-7 h-7 rounded-full border-2 border-white shadow-sm bg-slate-100 flex items-center justify-center">
                          <Icon size={14} className="text-slate-600" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0 bg-slate-50/80 rounded-xl border border-slate-200 p-4 hover:border-slate-300 transition-colors">
                        <div className="flex items-start justify-between gap-3 mb-1">
                          <p className="text-sm font-semibold text-slate-900">{event.title}</p>
                          <span className="text-[11px] font-medium text-slate-400 shrink-0">{timeStr}</span>
                        </div>
                        {event.metadata && (
                          <p className="text-xs text-slate-600 mb-2">{event.metadata}</p>
                        )}
                        <p className="text-[11px] text-slate-500">by {event.actorName}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
