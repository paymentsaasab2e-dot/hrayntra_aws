'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Mail,
  Phone,
  MessageCircle,
  FileText,
  MessageSquare,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { TaskCommunicationEntry, TaskCommunicationType } from '../app/Task&Activites/types';

export interface TaskCommunicationHistoryProps {
  entries: TaskCommunicationEntry[];
  isLoading?: boolean;
  className?: string;
}

const TYPE_CONFIG: Record<TaskCommunicationType, { label: string; icon: React.ComponentType<{ size?: number; className?: string }>; iconBg: string }> = {
  email: { label: 'Email', icon: Mail as React.ComponentType<{ size?: number; className?: string }>, iconBg: 'bg-amber-500 text-white' },
  call: { label: 'Call', icon: Phone as React.ComponentType<{ size?: number; className?: string }>, iconBg: 'bg-blue-600 text-white' },
  whatsapp: { label: 'WhatsApp', icon: MessageCircle as React.ComponentType<{ size?: number; className?: string }>, iconBg: 'bg-emerald-600 text-white' },
  note: { label: 'Note', icon: FileText as React.ComponentType<{ size?: number; className?: string }>, iconBg: 'bg-slate-600 text-white' },
  comment: { label: 'Comment', icon: MessageSquare as React.ComponentType<{ size?: number; className?: string }>, iconBg: 'bg-violet-500 text-white' },
};

const FILTER_OPTIONS: { id: 'all' | TaskCommunicationType; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'email', label: 'Email' },
  { id: 'call', label: 'Call' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'note', label: 'Notes' },
];

function formatDate(timestamp: string): string {
  const d = new Date(timestamp);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function CommunicationEntryCard({ entry }: { entry: TaskCommunicationEntry }) {
  const [expanded, setExpanded] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const bodyRef = useRef<HTMLParagraphElement>(null);

  const config = TYPE_CONFIG[entry.type];
  const Icon = config.icon;
  const dateStr = entry.timestampDisplay ?? formatDate(entry.timestamp);

  // Detect if body text is truncated (needs Show more) based on actual size
  useEffect(() => {
    if (!entry.body) return;
    const el = bodyRef.current;
    if (!el) return;

    const checkOverflow = () => {
      if (expanded) {
        setIsOverflowing(true); // Keep toggle visible when expanded so user can collapse
        return;
      }
      // When collapsed with line-clamp, scrollHeight > clientHeight means content is truncated
      const truncated = el.scrollHeight > el.clientHeight;
      setIsOverflowing(truncated);
    };

    checkOverflow();
    const ro = new ResizeObserver(checkOverflow);
    ro.observe(el);
    return () => ro.disconnect();
  }, [entry.body, expanded]);

  return (
    <div className="flex gap-4 items-start flex-shrink-0">
      <div className="w-12 flex justify-center shrink-0 relative z-10">
        <div className={`w-7 h-7 rounded-full border-2 border-white shadow-sm flex items-center justify-center ${config.iconBg}`}>
          <Icon size={14} className="text-white" />
        </div>
      </div>
      <div className="flex-1 min-w-0 bg-slate-50/80 rounded-xl border border-slate-200 overflow-hidden hover:border-slate-300 transition-colors">
        <div className="p-4">
          <div className="flex items-start justify-between gap-3 mb-1">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{config.label}</p>
            <span className="text-[11px] font-medium text-slate-400 shrink-0">{dateStr}</span>
          </div>
          <p className="text-sm font-semibold text-slate-900 mt-0.5">{entry.title}</p>
          {(entry.subject || entry.duration) && (
            <p className="text-xs text-slate-600 mt-1">
              {entry.subject && `Subject: ${entry.subject}`}
              {entry.subject && entry.duration && ' · '}
              {entry.duration && `Duration: ${entry.duration}`}
            </p>
          )}
          {(entry.from || entry.to) && (
            <p className="text-[11px] text-slate-500 mt-1">
              {entry.from && <span>From: {entry.from}</span>}
              {entry.from && entry.to && ' · '}
              {entry.to && <span>To: {entry.to}</span>}
            </p>
          )}
          {entry.body ? (
            <>
              <p
                ref={bodyRef}
                className={`text-xs text-slate-600 mt-2 whitespace-pre-wrap ${expanded ? '' : 'line-clamp-2'}`}
              >
                {entry.body}
              </p>
              {isOverflowing && (
                <button
                  type="button"
                  onClick={() => setExpanded((e) => !e)}
                  className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 mt-2"
                >
                  {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  {expanded ? 'Show less' : 'Show more'}
                </button>
              )}
            </>
          ) : entry.preview ? (
            <p className="text-xs text-slate-600 mt-2 line-clamp-2">{entry.preview}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function TaskCommunicationHistory({ entries, isLoading = false, className = '' }: TaskCommunicationHistoryProps) {
  const [filter, setFilter] = useState<'all' | TaskCommunicationType>('all');

  const filtered = useMemo(() => {
    if (filter === 'all') return entries;
    return entries.filter((e) => e.type === filter);
  }, [entries, filter]);

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [filtered]
  );

  if (isLoading) {
    return (
      <div className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden ${className}`}>
        <div className="p-4 border-b border-slate-100">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Communication</h4>
          <p className="text-xs text-slate-500 mt-0.5">Emails, calls, WhatsApp, notes</p>
        </div>
        <div className="p-6 space-y-4">
          <div className="h-10 bg-slate-100 rounded-lg animate-pulse w-3/4" />
          <div className="h-24 bg-slate-100 rounded-xl animate-pulse" />
          <div className="h-24 bg-slate-100 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (entries.length === 0) {
    // When there is no external communication linked to the task,
    // don't render this block at all. The Communication tab will
    // only show the Internal Chat (and any other sections).
    return null;
  }

  return (
    <div className={`bg-white rounded-xl border border-slate-200 border-l-4 border-l-blue-500 shadow-sm overflow-hidden ${className}`}>
      <div className="p-4 border-b border-blue-100 bg-blue-50/40">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
            <MessageSquare size={16} className="text-blue-600" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-blue-700 uppercase tracking-wider">Task communication</h4>
            <p className="text-xs text-slate-600 mt-0.5">Emails, calls, WhatsApp, notes</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setFilter(opt.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === opt.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <div className="p-4 max-h-[calc(100vh-320px)] overflow-y-auto">
        {sorted.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-slate-500">No {filter === 'all' ? '' : filter} communication for this task.</p>
          </div>
        ) : (
          <div className="relative flex">
            <div className="absolute left-6 top-0 bottom-0 w-px bg-blue-200 z-0" aria-hidden />
            <div className="flex flex-col gap-5 flex-1 min-w-0">
              {sorted.map((entry) => (
                <CommunicationEntryCard key={entry.id} entry={entry} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
