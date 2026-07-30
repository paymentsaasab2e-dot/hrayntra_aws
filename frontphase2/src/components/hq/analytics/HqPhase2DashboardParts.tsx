'use client';

import { motion } from 'motion/react';
import {
  Bell,
  Building2,
  Calendar,
  CreditCard,
  Database,
  Download,
  FileText,
  HardDrive,
  Mail,
  MessageSquare,
  Moon,
  RefreshCcw,
  Search,
  Server,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react';
import { HqBrandLogo } from '../HqBrandLogo';

export function HqPhase2Card({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      whileHover={{ y: -1 }}
      transition={{ duration: 0.15 }}
      className={`rounded-[18px] border border-slate-200/80 bg-white p-6 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.03)] ${className}`}
    >
      {children}
    </motion.div>
  );
}

export function HqPhase2Title({
  title,
  right,
}: {
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h3 className="text-sm font-semibold text-[#111827]">{title}</h3>
      {right}
    </div>
  );
}

export function HqPhase2Navbar() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur">
      <div className="flex h-[72px] w-full items-center gap-4 px-6 xl:px-8">
        <div className="flex min-w-[210px] items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white">
            <HqBrandLogo className="h-8 w-8 object-contain" alt="HRYANTRA" variant="mark" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-bold tracking-tight">HRYANTRA HQ</div>
            <div className="text-[11px] text-[#6B7280]">Phase 2 · Employers</div>
          </div>
        </div>

        <div className="mx-auto w-full max-w-xl flex-1">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Search across platform..."
              className="h-11 w-full rounded-full border border-slate-200 bg-slate-50 pl-10 pr-14 text-sm text-slate-700 outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-100"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">
              ⌘K
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className="hidden h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 shadow-sm lg:inline-flex"
          >
            <Calendar className="h-3.5 w-3.5" /> Calendar
          </button>
          <button
            type="button"
            className="hidden h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 shadow-sm md:inline-flex"
          >
            <Download className="h-3.5 w-3.5" /> Export
          </button>
          <button
            type="button"
            className="hidden h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 shadow-sm xl:inline-flex"
          >
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            01 May 2025 - 31 May 2025
          </button>
          <button
            type="button"
            className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500"
          >
            <Bell className="h-[18px] w-[18px]" />
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
              12
            </span>
          </button>
          <button
            type="button"
            className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500"
          >
            <MessageSquare className="h-[18px] w-[18px]" />
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-500 px-1 text-[9px] font-bold text-white">
              5
            </span>
          </button>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500"
          >
            <Moon className="h-[18px] w-[18px]" />
          </button>
          <div className="ml-1 flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-slate-100 ring-2 ring-white">
            <img
              src="/profile-circle-svgrepo-com.svg"
              alt="Super Admin"
              width={40}
              height={40}
              className="h-10 w-10 object-cover"
            />
          </div>
        </div>
      </div>
    </header>
  );
}

export function HqPhase2PageHeader({
  updatedLabel,
  loading,
  onRefresh,
}: {
  updatedLabel: string;
  loading?: boolean;
  onRefresh?: () => void;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[32px] font-bold tracking-tight text-[#111827]">Phase 2 Dashboard</h1>
        <p className="mt-1 text-sm text-[#6B7280]">Business & Platform Overview</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          Live
        </span>
        <span className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-[#6B7280] ring-1 ring-slate-200">
          Last Updated: {updatedLabel}
        </span>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#111827] px-3.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
        >
          <RefreshCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>
    </div>
  );
}

export function HqPhase2HealthGauge({
  score,
  startColor = '#4F46E5',
  endColor = '#7C3AED',
}: {
  score: number;
  startColor?: string;
  endColor?: string;
}) {
  const r = 70;
  const c = 2 * Math.PI * r;
  const half = c / 2;
  const pct = Math.min(100, Math.max(0, score)) / 100;
  const offset = half * (1 - pct);
  return (
    <div className="relative mx-auto flex h-[160px] w-[200px] items-end justify-center">
      <svg viewBox="0 0 200 120" className="h-full w-full">
        <path
          d="M 30 110 A 70 70 0 0 1 170 110"
          fill="none"
          stroke="#E2E8F0"
          strokeWidth="16"
          strokeLinecap="round"
        />
        <path
          d="M 30 110 A 70 70 0 0 1 170 110"
          fill="none"
          stroke="url(#gaugeGrad)"
          strokeWidth="16"
          strokeLinecap="round"
          strokeDasharray={`${half} ${c}`}
          strokeDashoffset={offset}
        />
        <defs>
          <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={startColor} />
            <stop offset="100%" stopColor={endColor} />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute bottom-2 text-center">
        <div className="text-3xl font-bold text-[#111827]">{score}</div>
        <div className="text-[11px] font-medium text-[#6B7280]">/ 100</div>
      </div>
    </div>
  );
}

export function HqPhase2ActivityFeed({
  activities,
}: {
  activities: Array<{ text: string; time: string; color: string }>;
}) {
  return (
    <div className="max-h-[260px] space-y-0 overflow-y-auto">
      {activities.map((a) => (
        <div
          key={a.text}
          className="flex gap-3 border-b border-slate-50 px-6 py-3.5 last:border-0 hover:bg-slate-50/60"
        >
          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: a.color }} />
          <div className="min-w-0">
            <p className="text-sm text-slate-700">{a.text}</p>
            <p className="mt-0.5 text-[11px] text-slate-400">{a.time}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function HqPhase2SystemHealth() {
  const items = [
    { label: 'Server', value: 'Operational', icon: Server, warn: false },
    { label: 'Database', value: 'Operational', icon: Database, warn: false },
    { label: 'API', value: 'Operational', icon: Zap, warn: false },
    { label: 'Storage', value: '82%', icon: HardDrive, warn: true },
    { label: 'AI Matching', value: '14 queued', icon: Sparkles, warn: false },
    { label: 'Email', value: '3 queued', icon: Mail, warn: false },
    { label: 'Background', value: '8 jobs', icon: FileText, warn: false },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-4">
      {items.map((s) => {
        const Icon = s.icon;
        return (
          <div key={s.label} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
            <div className="mb-2 flex items-center justify-between">
              <Icon className="h-4 w-4 text-slate-400" />
              <span className={`h-2 w-2 rounded-full ${s.warn ? 'bg-amber-400' : 'bg-emerald-500'}`} />
            </div>
            <p className="text-[10px] font-medium text-[#6B7280]">{s.label}</p>
            <p className={`mt-0.5 text-xs font-bold ${s.warn ? 'text-amber-600' : 'text-emerald-700'}`}>
              {s.value}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export function HqPhase2QuickActions({
  INDIGO,
  PURPLE,
  TEAL,
  ORANGE,
  BLUE,
  SUCCESS,
}: {
  INDIGO: string;
  PURPLE: string;
  TEAL: string;
  ORANGE: string;
  BLUE: string;
  SUCCESS: string;
}) {
  const actions = [
    { label: 'Create Tenant', icon: Building2, color: INDIGO },
    { label: 'Add User', icon: Users, color: PURPLE },
    { label: 'Create Plan', icon: CreditCard, color: TEAL },
    { label: 'Send Email', icon: Mail, color: ORANGE },
    { label: 'System Logs', icon: FileText, color: BLUE },
    { label: 'Generate Report', icon: Download, color: SUCCESS },
  ];
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-2">
      {actions.map((a) => {
        const Icon = a.icon;
        return (
          <button
            key={a.label}
            type="button"
            className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-4 text-center transition hover:border-indigo-200 hover:bg-indigo-50/40 hover:shadow-sm"
          >
            <span
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ background: `${a.color}14`, color: a.color }}
            >
              <Icon className="h-4 w-4" />
            </span>
            <span className="text-[11px] font-semibold leading-tight text-slate-700">{a.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function HqPhase2Footer({ updatedLabel }: { updatedLabel: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-slate-200/80 bg-white px-6 py-3.5 text-xs text-[#6B7280] shadow-sm">
      <span>© 2025 PRANAVI INFOTECH · AI Recruitment Platform</span>
      <div className="flex flex-wrap items-center gap-4">
        <span>
          Platform <strong className="text-[#111827]">v2.4.1</strong>
        </span>
        <span>
          API <strong className="text-[#111827]">v1.8.3</strong>
        </span>
        <span>
          Last Sync <strong className="text-[#111827]">{updatedLabel}</strong>
        </span>
        <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          Realtime
        </span>
      </div>
    </div>
  );
}
