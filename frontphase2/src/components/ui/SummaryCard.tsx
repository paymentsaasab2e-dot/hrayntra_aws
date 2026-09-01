'use client';

import React from 'react';

/**
 * Standard KPI tile used across list pages (Leads, Clients, Jobs, Candidates,
 * Tasks, etc.). Visually matches the Leads page reference: pastel gradient
 * panel, frosted icon chip on the left, large right-aligned number, small caps
 * label below, and an optional `Active` ring/badge when the card is the
 * currently-selected status filter.
 *
 * The same component is reused so every tab feels cohesive — change colors or
 * behavior here and it propagates everywhere.
 */
export type SummaryCardColor = 'blue' | 'yellow' | 'purple' | 'green' | 'gray' | 'rose' | 'cyan' | 'orange' | 'indigo';

const STYLES: Record<
  SummaryCardColor,
  { panel: string; text: string; iconWrap: string; ring: string; activeRing: string }
> = {
  blue: {
    panel: 'bg-gradient-to-br from-blue-50 via-white to-indigo-50/90',
    text: 'text-blue-800',
    iconWrap: 'bg-blue-500/15 text-blue-600 ring-1 ring-blue-200/80 shadow-inner',
    ring: 'border-blue-200/90',
    activeRing: 'ring-2 ring-blue-400/35 shadow-ph2-card-hover',
  },
  yellow: {
    panel: 'bg-gradient-to-br from-amber-50 via-white to-yellow-50/80',
    text: 'text-amber-800',
    iconWrap: 'bg-amber-400/20 text-amber-700 ring-1 ring-amber-200/90 shadow-inner',
    ring: 'border-amber-200/90',
    activeRing: 'ring-2 ring-amber-400/40 shadow-ph2-card-hover',
  },
  purple: {
    panel: 'bg-gradient-to-br from-violet-50 via-white to-purple-50/80',
    text: 'text-violet-800',
    iconWrap: 'bg-violet-500/15 text-violet-700 ring-1 ring-violet-200/80 shadow-inner',
    ring: 'border-violet-200/90',
    activeRing: 'ring-2 ring-violet-400/35 shadow-ph2-card-hover',
  },
  green: {
    panel: 'bg-gradient-to-br from-emerald-50 via-white to-teal-50/70',
    text: 'text-emerald-800',
    iconWrap: 'bg-emerald-500/15 text-emerald-700 ring-1 ring-emerald-200/80 shadow-inner',
    ring: 'border-emerald-200/90',
    activeRing: 'ring-2 ring-emerald-400/35 shadow-ph2-card-hover',
  },
  gray: {
    panel: 'bg-gradient-to-br from-slate-50 via-white to-slate-100/70',
    text: 'text-slate-700',
    iconWrap: 'bg-slate-500/12 text-slate-600 ring-1 ring-slate-200 shadow-inner',
    ring: 'border-slate-200/95',
    activeRing: 'ring-2 ring-slate-400/30 shadow-ph2-card-hover',
  },
  rose: {
    panel: 'bg-gradient-to-br from-rose-50 via-white to-pink-50/80',
    text: 'text-rose-800',
    iconWrap: 'bg-rose-500/15 text-rose-600 ring-1 ring-rose-200/80 shadow-inner',
    ring: 'border-rose-200/90',
    activeRing: 'ring-2 ring-rose-400/35 shadow-ph2-card-hover',
  },
  cyan: {
    panel: 'bg-gradient-to-br from-cyan-50 via-white to-sky-50/80',
    text: 'text-cyan-800',
    iconWrap: 'bg-cyan-500/15 text-cyan-700 ring-1 ring-cyan-200/80 shadow-inner',
    ring: 'border-cyan-200/90',
    activeRing: 'ring-2 ring-cyan-400/35 shadow-ph2-card-hover',
  },
  orange: {
    panel: 'bg-gradient-to-br from-orange-50 via-white to-amber-50/80',
    text: 'text-orange-800',
    iconWrap: 'bg-orange-500/15 text-orange-600 ring-1 ring-orange-200/80 shadow-inner',
    ring: 'border-orange-200/90',
    activeRing: 'ring-2 ring-orange-400/35 shadow-ph2-card-hover',
  },
  indigo: {
    panel: 'bg-gradient-to-br from-indigo-50 via-white to-violet-50/80',
    text: 'text-indigo-800',
    iconWrap: 'bg-indigo-500/15 text-indigo-700 ring-1 ring-indigo-200/80 shadow-inner',
    ring: 'border-indigo-200/90',
    activeRing: 'ring-2 ring-indigo-400/35 shadow-ph2-card-hover',
  },
};

interface SummaryCardProps {
  label: string;
  count: number | string;
  color: SummaryCardColor;
  icon: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  /** Optional small text under the count (e.g. "+12% MoM"). */
  hint?: React.ReactNode;
}

export function SummaryCard({ label, count, color, icon, active = false, onClick, hint }: SummaryCardProps) {
  const s = STYLES[color] ?? STYLES.gray;
  const isInteractive = Boolean(onClick);
  const Element: any = isInteractive ? 'button' : 'div';
  return (
    <Element
      type={isInteractive ? 'button' : undefined}
      onClick={onClick}
      className={`group relative w-full min-w-0 overflow-hidden rounded-xl border p-2.5 sm:p-4 text-left shadow-[0_8px_30px_-12px_rgba(15,23,42,0.12)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-12px_rgba(59,130,246,0.22)] ${
        isInteractive ? 'cursor-pointer' : ''
      } ${s.panel} ${s.ring} ${active ? s.activeRing : ''}`}
      aria-pressed={isInteractive ? active : undefined}
    >
      <div className="pointer-events-none absolute -right-5 -top-5 h-20 w-20 rounded-full bg-white/40 blur-2xl" aria-hidden />
      <div className="relative flex items-start justify-between gap-2">
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105 sm:h-9 sm:w-9 ${s.iconWrap}`}
        >
          {icon}
        </div>
        <span className={`min-w-0 break-all text-xl font-semibold tabular-nums tracking-tight sm:text-2xl ${s.text}`}>{count}</span>
      </div>
      <div className="relative mt-2 flex items-end justify-between gap-2 sm:mt-3">
        <p className={`min-w-0 break-words text-[10px] font-bold uppercase tracking-[0.12em] leading-snug opacity-85 ${s.text}`}>{label}</p>
        {active ? (
          <span
            className={`shrink-0 rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shadow-sm ring-1 ring-black/5 ${s.text}`}
          >
            Active
          </span>
        ) : hint ? (
          <span className={`shrink-0 text-[10px] font-bold opacity-80 ${s.text}`}>{hint}</span>
        ) : null}
      </div>
    </Element>
  );
}

interface SummaryCardSkeletonProps {
  /** Optional tone — skeletons should mirror the same color slots as their loaded counterparts. */
  color?: SummaryCardColor;
}

/** Shimmering skeleton that mirrors the live `<SummaryCard />` layout. */
export function SummaryCardSkeleton({ color = 'gray' }: SummaryCardSkeletonProps) {
  const s = STYLES[color] ?? STYLES.gray;
  return (
    <div
      className={`relative w-full overflow-hidden rounded-xl border p-3 sm:p-4 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.12)] ${s.panel} ${s.ring}`}
      aria-hidden
    >
      <div className="pointer-events-none absolute -right-5 -top-5 h-20 w-20 rounded-full bg-white/40 blur-2xl" />
      <div className="relative flex items-start justify-between gap-2">
        <div className={`relative h-9 w-9 overflow-hidden rounded-xl ${s.iconWrap}`}>
          <span className="ph2-skel-shimmer" />
        </div>
        <div className="relative h-6 w-10 overflow-hidden rounded-md bg-white/70">
          <span className="ph2-skel-shimmer" />
        </div>
      </div>
      <div className="relative mt-3 h-2.5 w-2/3 overflow-hidden rounded-full bg-white/70">
        <span className="ph2-skel-shimmer" />
      </div>
      <style jsx>{`
        :global(.ph2-skel-shimmer) {
          position: absolute;
          inset: 0;
          background-image: linear-gradient(
            90deg,
            rgba(255, 255, 255, 0) 0%,
            rgba(255, 255, 255, 0.6) 50%,
            rgba(255, 255, 255, 0) 100%
          );
          animation: ph2-skel-shimmer 1.4s linear infinite;
          will-change: transform;
        }
        @keyframes ph2-skel-shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
