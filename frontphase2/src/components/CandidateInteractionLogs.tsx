'use client';

import React, { useState, useMemo } from 'react';
import {
  MessageCircle,
  Mail,
  Phone,
  UserCheck,
  Calendar,
  RotateCcw,
  Search,
  Users,
} from 'lucide-react';
import type {
  CandidateInteractionEntry,
  CandidateInteractionType,
  CandidateInteractionChannel,
} from '../app/Task&Activites/types';

export interface CandidateInteractionLogsProps {
  entries: CandidateInteractionEntry[];
  className?: string;
}

const TYPE_CONFIG: Record<CandidateInteractionType, { label: string; icon: React.ComponentType<{ size?: number; className?: string }>; iconBg: string }> = {
  whatsapp_sent: { label: 'WhatsApp', icon: MessageCircle as React.ComponentType<{ size?: number; className?: string }>, iconBg: 'bg-emerald-600 text-white' },
  email_sent: { label: 'Email', icon: Mail as React.ComponentType<{ size?: number; className?: string }>, iconBg: 'bg-amber-500 text-white' },
  call_attempted: { label: 'Call', icon: Phone as React.ComponentType<{ size?: number; className?: string }>, iconBg: 'bg-slate-500 text-white' },
  call_connected: { label: 'Call', icon: Phone as React.ComponentType<{ size?: number; className?: string }>, iconBg: 'bg-blue-600 text-white' },
  candidate_replied: { label: 'Response', icon: UserCheck as React.ComponentType<{ size?: number; className?: string }>, iconBg: 'bg-violet-500 text-white' },
  interview_reminder_sent: { label: 'Reminder', icon: Calendar as React.ComponentType<{ size?: number; className?: string }>, iconBg: 'bg-blue-600 text-white' },
  candidate_reschedule_request: { label: 'Request', icon: RotateCcw as React.ComponentType<{ size?: number; className?: string }>, iconBg: 'bg-amber-500 text-white' },
};

const CHANNEL_FILTERS: { id: CandidateInteractionChannel; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'email', label: 'Email' },
  { id: 'call', label: 'Call' },
];

function InteractionCard({ entry }: { entry: CandidateInteractionEntry }) {
  const config = TYPE_CONFIG[entry.type];
  const Icon = config.icon;
  const dateStr = entry.timestampDisplay ?? new Date(entry.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
  const isResponse = entry.direction === 'response';

  return (
    <div className="flex gap-4 items-start flex-shrink-0">
      <div className="w-12 flex justify-center shrink-0 relative z-10">
        <div className={`w-7 h-7 rounded-full border-2 border-white shadow-sm flex items-center justify-center ${config.iconBg}`}>
          <Icon size={14} className="text-white" />
        </div>
      </div>
      <div
        className={`flex-1 min-w-0 rounded-xl border p-4 transition-colors ${
          isResponse
            ? 'bg-violet-50/80 border-violet-200 hover:border-violet-300'
            : 'bg-slate-50/80 border-slate-200 hover:border-slate-300'
        }`}
      >
        <div className="flex items-start justify-between gap-3 mb-1">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{config.label}</p>
          <span className="text-[11px] font-medium text-slate-400 shrink-0">{dateStr}</span>
        </div>
        <p className="text-sm font-semibold text-slate-900 mt-0.5">{entry.title}</p>
        {(entry.duration || entry.channel) && (
          <p className="text-xs text-slate-600 mt-1">
            {entry.duration && <span>Duration: {entry.duration}</span>}
            {entry.duration && entry.channel && ' · '}
            {entry.channel && entry.channel !== 'all' && <span>Channel: {entry.channel}</span>}
          </p>
        )}
        <p className="text-[11px] text-slate-500 mt-1">by {entry.actor}</p>
        {entry.preview && (
          <p className="text-xs text-slate-600 mt-2 line-clamp-2">{entry.preview}</p>
        )}
      </div>
    </div>
  );
}

export function CandidateInteractionLogs({ entries, className = '' }: CandidateInteractionLogsProps) {
  const [channelFilter, setChannelFilter] = useState<CandidateInteractionChannel>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = useMemo(() => {
    let list = entries;
    if (channelFilter !== 'all') {
      list = list.filter((e) => e.channel === channelFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.actor.toLowerCase().includes(q) ||
          (e.preview && e.preview.toLowerCase().includes(q))
      );
    }
    return list;
  }, [entries, channelFilter, searchQuery]);

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [filtered]
  );

  if (entries.length === 0) {
    return null;
  }

  return (
    <div className={`bg-white rounded-xl border border-slate-200 border-l-4 border-l-violet-500 shadow-sm overflow-hidden ${className}`}>
      <div className="p-4 border-b border-violet-100 bg-violet-50/50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
            <Users size={16} className="text-violet-600" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-violet-700 uppercase tracking-wider">Candidate interaction logs</h4>
            <p className="text-xs text-slate-600 mt-0.5">Recruiter engagement and candidate responses</p>
          </div>
        </div>
        <div className="mt-3 flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search interactions..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {CHANNEL_FILTERS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setChannelFilter(opt.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  channelFilter === opt.id ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="p-4 max-h-[360px] overflow-y-auto">
        {sorted.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-slate-500">
              {entries.length === 0 ? 'No candidate interactions yet.' : 'No matching interactions.'}
            </p>
          </div>
        ) : (
          <div className="relative flex">
            <div className="absolute left-6 top-0 bottom-0 w-px bg-violet-200 z-0" aria-hidden />
            <div className="flex flex-col gap-5 flex-1 min-w-0">
              {sorted.map((entry) => (
                <InteractionCard key={entry.id} entry={entry} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
