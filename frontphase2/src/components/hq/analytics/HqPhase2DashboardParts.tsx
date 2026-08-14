'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  Bell,
  Briefcase,
  Building2,
  Calendar,
  CreditCard,
  Database,
  Download,
  FileText,
  Mail,
  MessageSquare,
  Moon,
  PieChart,
  RefreshCcw,
  Search,
  Sparkles,
  Ticket,
  Users,
  UserCheck,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { HqBrandLogo } from '../HqBrandLogo';

/** Info tip — indigo “i”; tooltip portals to body so it never clips under cards. */
export function HqInfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    place: 'above' | 'below';
  } | null>(null);
  const tipId = useId();
  const rootRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open || !rootRef.current) {
      setCoords(null);
      return;
    }

    const update = () => {
      const btn = rootRef.current?.getBoundingClientRect();
      if (!btn) return;
      const tipH = tipRef.current?.offsetHeight ?? 48;
      const tipW = Math.min(tipRef.current?.offsetWidth ?? 200, 240);
      const gap = 10;
      const place: 'above' | 'below' =
        btn.top < tipH + gap + 12 ? 'below' : 'above';
      const top = place === 'above' ? btn.top - gap : btn.bottom + gap;
      const half = tipW / 2;
      const left = Math.min(
        Math.max(btn.left + btn.width / 2, half + 8),
        window.innerWidth - half - 8,
      );
      setCoords({ top, left, place });
    };

    update();
    const raf = requestAnimationFrame(update);
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open, text]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <span
      ref={rootRef}
      className="relative inline-flex shrink-0 items-center justify-center"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label="About this metric"
        aria-expanded={open}
        aria-describedby={open ? tipId : undefined}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={`inline-flex h-4 min-w-[14px] items-center justify-center rounded-full px-1 text-[11px] font-bold leading-none outline-none ring-1 transition focus:outline-none focus-visible:outline-none ${
          open
            ? 'bg-indigo-100 text-indigo-700 ring-indigo-300'
            : 'bg-indigo-50 text-indigo-600 ring-indigo-200/90 hover:bg-indigo-100 hover:text-indigo-700'
        }`}
      >
        i
      </button>
      {open && mounted
        ? createPortal(
            <span
              ref={tipRef}
              id={tipId}
              role="tooltip"
              style={
                coords
                  ? {
                      position: 'fixed',
                      top: coords.top,
                      left: coords.left,
                      transform:
                        coords.place === 'above'
                          ? 'translate(-50%, -100%)'
                          : 'translate(-50%, 0)',
                      zIndex: 9999,
                      visibility: 'visible',
                    }
                  : {
                      position: 'fixed',
                      top: 0,
                      left: 0,
                      zIndex: -1,
                      visibility: 'hidden',
                    }
              }
              className="pointer-events-none w-max max-w-[240px] rounded-lg bg-slate-900 px-2.5 py-1.5 text-left text-[11px] font-medium leading-snug text-white shadow-lg"
            >
              {text}
              {coords ? (
                <span
                  aria-hidden
                  className={`absolute left-1/2 h-0 w-0 -translate-x-1/2 border-x-[5px] border-x-transparent ${
                    coords.place === 'above'
                      ? 'top-full border-t-[6px] border-t-slate-900'
                      : 'bottom-full border-b-[6px] border-b-slate-900'
                  }`}
                />
              ) : null}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}

export function HqPhase2Card({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className={`hq-dash-card relative overflow-visible rounded-2xl border border-white/80 bg-white/75 p-5 shadow-[0_1px_0_rgba(255,255,255,0.85)_inset,0_18px_48px_-24px_rgba(15,23,42,0.18)] backdrop-blur-xl sm:p-6 ${className}`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-indigo-300/60 to-transparent"
      />
      {children}
    </motion.div>
  );
}

export function HqPhase2Title({
  title,
  right,
  info,
}: {
  title: string;
  right?: React.ReactNode;
  /** Short sentence explaining the chart / stats */
  info?: string;
}) {
  return (
    <div className="relative z-[1] mb-4 flex items-center justify-between gap-3 overflow-visible">
      <div className="flex min-w-0 items-center gap-2">
        <span className="h-4 w-1 shrink-0 rounded-full bg-gradient-to-b from-slate-900 to-blue-900" />
        <h3 className="truncate text-[13px] font-semibold tracking-tight text-slate-800">{title}</h3>
        {info ? <HqInfoTip text={info} /> : null}
      </div>
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
  actions,
  ticketsHref = '/hq/tickets?audience=employer',
  ticketsLabel = 'Tickets',
}: {
  updatedLabel?: string;
  loading?: boolean;
  onRefresh?: () => void;
  /** Quick actions rendered above the pill action bar */
  actions?: React.ReactNode;
  ticketsHref?: string;
  ticketsLabel?: string;
}) {
  const dashBtnSecondary =
    'inline-flex h-10 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-800 shadow-[0_8px_20px_-12px_rgba(15,23,42,0.35)] transition hover:border-slate-300 hover:bg-slate-50';
  const dashBtnPrimary =
    'inline-flex h-10 items-center justify-center gap-2 rounded-full bg-slate-900 px-5 text-sm font-semibold text-white shadow-[0_10px_24px_-10px_rgba(15,23,42,0.55)] transition hover:bg-slate-800 disabled:opacity-50';

  return (
    <header className="hq-dash-card mb-5 flex flex-col gap-4 rounded-2xl border border-white/80 bg-white/75 px-4 py-5 shadow-[0_1px_0_rgba(255,255,255,0.85)_inset,0_18px_48px_-24px_rgba(15,23,42,0.16)] backdrop-blur-xl sm:px-6 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="inline-flex h-1.5 w-10 rounded-full bg-gradient-to-r from-slate-900 to-blue-900" />
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-200/80">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            Live
          </span>
        </div>
        <h1 className="hq-display text-[1.75rem] font-bold tracking-tight text-slate-900 sm:text-[2rem]">
          Employers dashboard
        </h1>
        <p className="mt-1.5 text-sm font-medium text-slate-500">
          HQ management · platform usage, monetization &amp; tenant health
        </p>
        {updatedLabel ? (
          <p className="mt-1 text-[11px] text-slate-400">Last updated: {updatedLabel}</p>
        ) : null}
      </div>
      <div className="flex w-full flex-col items-stretch gap-3 sm:w-auto sm:items-end">
        {actions}
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <Link href={ticketsHref} prefetch={false} className={dashBtnSecondary}>
            <Ticket className="h-4 w-4 text-violet-600" />
            {ticketsLabel}
          </Link>
          <button type="button" onClick={onRefresh} disabled={loading} className={dashBtnPrimary}>
            <RefreshCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>
    </header>
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
    <div className="relative mx-auto flex h-[118px] w-[168px] items-end justify-center">
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
      <div className="absolute bottom-1 text-center">
        <div className="text-2xl font-bold text-[#111827]">{score}</div>
        <div className="text-[10px] font-medium text-[#6B7280]">/ 100</div>
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

export function HqPhase2SystemHealth({
  items,
  compact = false,
}: {
  items?: Array<{ label: string; value: string; warn?: boolean }>;
  /** Slim top-strip layout */
  compact?: boolean;
}) {
  const rows =
    items && items.length
      ? items.map((s) => ({
          ...s,
          icon:
            s.label === 'Analytics'
              ? Zap
              : s.label === 'Tenants'
                ? Users
                : s.label === 'Open jobs'
                  ? Briefcase
                  : s.label === 'Apps (7d)'
                    ? FileText
                    : s.label === 'Database' || s.label === 'Paused'
                      ? Database
                      : s.label === 'Email' || s.label === 'Follow-ups today' || s.label === 'Paid accounts'
                        ? CreditCard
                        : s.label === 'AI Matching' || s.label === 'Interviews today' || s.label === 'Joined'
                          ? UserCheck
                          : s.label === 'Concentration'
                            ? PieChart
                            : FileText,
        }))
      : [
          { label: 'Analytics', value: 'Waiting', icon: Zap, warn: true },
          { label: 'Tenants', value: '—', icon: Users, warn: false },
        ];

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        {rows.map((s) => {
          const Icon = s.icon;
          const isLiveValue = /^live$/i.test(String(s.value || '').trim());
          return (
            <div
              key={s.label}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${
                s.warn
                  ? 'border-amber-200/80 bg-amber-50/90 text-amber-900'
                  : 'border-emerald-200/80 bg-emerald-50/70 text-slate-800'
              }`}
              title={`${s.label}: ${s.value}`}
            >
              <Icon
                className={`h-3 w-3 shrink-0 ${s.warn ? 'text-amber-600' : 'text-emerald-600'}`}
                strokeWidth={2.25}
              />
              <span className={`text-[10px] font-medium ${s.warn ? 'text-amber-700/80' : 'text-emerald-800/70'}`}>
                {s.label}
              </span>
              {isLiveValue && !s.warn ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                  <span className="h-1 w-1 animate-pulse rounded-full bg-emerald-200" />
                  Live
                </span>
              ) : (
                <span className={`text-[11px] font-bold ${s.warn ? 'text-amber-900' : 'text-emerald-900'}`}>
                  {s.value}
                </span>
              )}
              {s.warn ? (
                <AlertTriangle className="h-3 w-3 shrink-0 text-amber-500" strokeWidth={2.25} />
              ) : (
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-4">
      {rows.map((s) => {
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
  compact = false,
  header = false,
}: {
  INDIGO: string;
  PURPLE: string;
  TEAL: string;
  ORANGE: string;
  BLUE: string;
  SUCCESS: string;
  /** Horizontal quick-access strip */
  compact?: boolean;
  /** Grid beside Refresh in the page header — full names, 2 per row */
  header?: boolean;
}) {
  const actions = [
    { label: 'Create Tenant', icon: Building2, color: INDIGO },
    { label: 'Create Plan', icon: CreditCard, color: TEAL },
    { label: 'System Logs', icon: FileText, color: BLUE },
    { label: 'Generate Report', icon: Download, color: SUCCESS },
  ];

  if (header) {
    return (
      <div className="grid w-full grid-cols-2 gap-2 sm:w-[340px]">
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.label}
              type="button"
              title={a.label}
              aria-label={a.label}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-700 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50/60"
            >
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                style={{ background: `${a.color}18`, color: a.color }}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="truncate">{a.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  if (compact) {
    return (
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.label}
              type="button"
              title={a.label}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 py-2 text-[11px] font-semibold text-slate-700 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50/50"
            >
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md"
                style={{ background: `${a.color}18`, color: a.color }}
              >
                <Icon className="h-3 w-3" />
              </span>
              <span className="truncate">{a.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-2 lg:grid-cols-2">
      {actions.map((a) => {
        const Icon = a.icon;
        return (
          <button
            key={a.label}
            type="button"
            title={a.label}
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
