'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronDown, Bell, Mail, MessageCircle } from 'lucide-react';
import { REMINDER_OPTIONS, REMINDER_CHANNEL_OPTIONS, type ReminderChannel } from '../app/Task&Activites/types';

/** Parsed custom reminder: value starts with "custom:" then ISO date-time, optionally ":channel" */
function parseCustomReminder(value: string): { date: string; time: string; channel: ReminderChannel } | null {
  if (!value || !value.startsWith('custom:')) return null;
  const rest = value.slice(7);
  const lastColon = rest.lastIndexOf(':');
  const dateTime = lastColon > -1 ? rest.slice(0, lastColon) : rest;
  const channelPart = lastColon > -1 ? rest.slice(lastColon + 1) : '';
  if (!dateTime) return null;
  const [date, time] = dateTime.includes('T') ? dateTime.split('T') : [dateTime, '09:00'];
  const validChannels: ReminderChannel[] = ['notification', 'email', 'whatsapp'];
  const channel = validChannels.includes(channelPart as ReminderChannel) ? (channelPart as ReminderChannel) : 'notification';
  return {
    date: date || '',
    time: (time || '09:00').slice(0, 5),
    channel,
  };
}

function formatReminderHuman(value: string): string {
  if (!value) return 'None';
  if (value === '15min') return '15 minutes before due';
  if (value === '1hr') return '1 hour before due';
  if (value === '1day') return '1 day before due';
  const custom = parseCustomReminder(value);
  if (!custom) return 'Custom';
  try {
    const d = new Date(`${custom.date}T${custom.time}`);
    if (isNaN(d.getTime())) return 'Custom';
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
  } catch {
    return 'Custom';
  }
}

function isReminderInPast(dateStr: string, timeStr: string): boolean {
  if (!dateStr) return false;
  const d = new Date(`${dateStr}T${timeStr || '00:00'}`);
  return !isNaN(d.getTime()) && d.getTime() < Date.now();
}

function isReminderAfterDue(reminderDate: string, reminderTime: string, dueDate: string, dueTime?: string): boolean {
  if (!dueDate) return false;
  const due = new Date(dueTime ? `${dueDate}T${dueTime}` : `${dueDate}T23:59:59`);
  const rem = new Date(`${reminderDate}T${reminderTime || '00:00'}`);
  return !isNaN(rem.getTime()) && rem.getTime() >= due.getTime();
}

export interface TaskReminderFieldProps {
  value: string;
  onChange: (value: string) => void;
  dueDate: string;
  dueTime?: string;
  label?: string;
  className?: string;
}

const CHANNEL_ICONS: Record<ReminderChannel, React.ComponentType<{ size?: number; className?: string }>> = {
  notification: Bell as React.ComponentType<{ size?: number; className?: string }>,
  email: Mail as React.ComponentType<{ size?: number; className?: string }>,
  whatsapp: MessageCircle as React.ComponentType<{ size?: number; className?: string }>,
};

export function TaskReminderField({
  value,
  onChange,
  dueDate,
  dueTime,
  label = 'Reminder',
  className = '',
}: TaskReminderFieldProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isCustom = value.startsWith('custom:') || value === 'custom';
  const customParsed = useMemo(() => parseCustomReminder(value), [value]);

  const [customDate, setCustomDate] = useState(customParsed?.date ?? '');
  const [customTime, setCustomTime] = useState(customParsed?.time ?? '09:00');
  const [customChannel, setCustomChannel] = useState<ReminderChannel>(customParsed?.channel ?? 'notification');

  useEffect(() => {
    if (customParsed) {
      setCustomDate(customParsed.date);
      setCustomTime(customParsed.time);
      setCustomChannel(customParsed.channel);
    } else if (!isCustom) {
      setCustomDate('');
      setCustomTime('09:00');
      setCustomChannel('notification');
    }
  }, [isCustom, customParsed?.date, customParsed?.time, customParsed?.channel]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayLabel = useMemo(() => {
    if (!value) return REMINDER_OPTIONS[0]?.label ?? 'None';
    if (value === 'custom') return 'Custom';
    const opt = REMINDER_OPTIONS.find((r) => r.id === value);
    if (opt) return opt.label;
    return formatReminderHuman(value);
  }, [value]);

  const noDueDateWarning = dueDate === '' && isCustom;
  const customPastWarning = isCustom && customParsed && isReminderInPast(customParsed.date, customParsed.time);
  const customAfterDueError = isCustom && customParsed && dueDate && isReminderAfterDue(customParsed.date, customParsed.time, dueDate, dueTime);

  const handleSelect = (id: string) => {
    if (id === 'custom') {
      onChange('custom');
    } else {
      onChange(id);
    }
    setOpen(false);
  };

  const commitCustom = () => {
    if (!customDate) {
      onChange('custom');
      return;
    }
    const channelPart = customChannel ? `:${customChannel}` : '';
    onChange(`custom:${customDate}T${customTime}${channelPart}`);
  };

  const handleCustomDateChange = (v: string) => {
    setCustomDate(v);
    if (v && customTime) onChange(`custom:${v}T${customTime}:${customChannel}`);
  };
  const handleCustomTimeChange = (v: string) => {
    setCustomTime(v);
    if (customDate && v) onChange(`custom:${customDate}T${v}:${customChannel}`);
  };
  const handleCustomChannelChange = (ch: ReminderChannel) => {
    setCustomChannel(ch);
    if (customDate && customTime) onChange(`custom:${customDate}T${customTime}:${ch}`);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <label className="block text-sm font-medium text-slate-700 mb-2">{label}</label>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-left text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
      >
        <span className={value ? 'text-slate-900' : 'text-slate-400'}>{displayLabel}</span>
        <ChevronDown size={16} className={`text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <ul className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white py-1 shadow-lg max-h-64 overflow-y-auto">
            {REMINDER_OPTIONS.map((opt) => {
              const isSelected = value === opt.id || (opt.id === '' && !value) || (opt.id === 'custom' && (value === 'custom' || value.startsWith('custom:')));
              return (
                <li key={opt.id || 'none'}>
                  <button
                    type="button"
                    onClick={() => handleSelect(opt.id)}
                    className={`w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 ${isSelected ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'}`}
                  >
                    {opt.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {/* Custom inline fields */}
      {isCustom && (
        <div className="mt-3 p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Reminder date</label>
              <input
                type="date"
                value={customDate}
                onChange={(e) => handleCustomDateChange(e.target.value)}
                onBlur={commitCustom}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Reminder time</label>
              <input
                type="time"
                value={customTime}
                onChange={(e) => handleCustomTimeChange(e.target.value)}
                onBlur={commitCustom}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Notify via</label>
            <div className="flex flex-wrap gap-2">
              {REMINDER_CHANNEL_OPTIONS.map((opt) => {
                const Icon = CHANNEL_ICONS[opt.id];
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleCustomChannelChange(opt.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      customChannel === opt.id ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {Icon && <Icon size={12} />}
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Warnings / errors */}
      {noDueDateWarning && (
        <p className="mt-1 text-xs text-amber-600 font-medium">Set due date first to validate reminder.</p>
      )}
      {customPastWarning && (
        <p className="mt-1 text-xs text-red-600 font-medium">This reminder time has already passed.</p>
      )}
      {customAfterDueError && (
        <p className="mt-1 text-xs text-red-600 font-medium">Reminder must be before the task due date.</p>
      )}
    </div>
  );
}
