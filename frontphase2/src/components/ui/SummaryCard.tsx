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
  { panel: string; text: string; count: string; iconWrap: string; ring: string; activeRing: string }
> = {
  blue: {
    panel: 'bg-[#eef4ff]',
    text: 'text-blue-500',
    count: 'text-blue-700',
    iconWrap: 'bg-white/80 text-blue-500 shadow-sm',
    ring: 'border-blue-100/80',
    activeRing: 'ring-2 ring-blue-400/40 shadow-[0_12px_28px_-16px_rgba(56,103,255,0.55)]',
  },
  yellow: {
    panel: 'bg-[#fff6e8]',
    text: 'text-amber-500',
    count: 'text-amber-700',
    iconWrap: 'bg-white/80 text-amber-500 shadow-sm',
    ring: 'border-amber-100/90',
    activeRing: 'ring-2 ring-amber-400/40 shadow-[0_12px_28px_-16px_rgba(245,158,11,0.45)]',
  },
  purple: {
    panel: 'bg-[#f3eeff]',
    text: 'text-violet-500',
    count: 'text-violet-700',
    iconWrap: 'bg-white/80 text-violet-500 shadow-sm',
    ring: 'border-violet-100/90',
    activeRing: 'ring-2 ring-violet-400/40 shadow-[0_12px_28px_-16px_rgba(120,100,255,0.5)]',
  },
  green: {
    panel: 'bg-[#e9fbf4]',
    text: 'text-emerald-500',
    count: 'text-emerald-700',
    iconWrap: 'bg-white/80 text-emerald-500 shadow-sm',
    ring: 'border-emerald-100/90',
    activeRing: 'ring-2 ring-emerald-400/40 shadow-[0_12px_28px_-16px_rgba(16,185,129,0.45)]',
  },
  gray: {
    panel: 'bg-[#f4f6f8]',
    text: 'text-slate-400',
    count: 'text-slate-600',
    iconWrap: 'bg-white text-slate-400 shadow-sm',
    ring: 'border-slate-200/80',
    activeRing: 'ring-2 ring-slate-300/50',
  },
  rose: {
    panel: 'bg-[#fff1f4]',
    text: 'text-rose-500',
    count: 'text-rose-700',
    iconWrap: 'bg-white/80 text-rose-500 shadow-sm',
    ring: 'border-rose-100/90',
    activeRing: 'ring-2 ring-rose-400/40',
  },
  cyan: {
    panel: 'bg-[#e9f9fc]',
    text: 'text-cyan-500',
    count: 'text-cyan-700',
    iconWrap: 'bg-white/80 text-cyan-500 shadow-sm',
    ring: 'border-cyan-100/90',
    activeRing: 'ring-2 ring-cyan-400/40',
  },
  orange: {
    panel: 'bg-[#fff4ea]',
    text: 'text-orange-500',
    count: 'text-orange-700',
    iconWrap: 'bg-white/80 text-orange-500 shadow-sm',
    ring: 'border-orange-100/90',
    activeRing: 'ring-2 ring-orange-400/40',
  },
  indigo: {
    panel: 'bg-[#eef0ff]',
    text: 'text-indigo-500',
    count: 'text-indigo-700',
    iconWrap: 'bg-white/80 text-indigo-500 shadow-sm',
    ring: 'border-indigo-100/90',
    activeRing: 'ring-2 ring-indigo-400/40',
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
      className={`group relative w-full min-w-0 overflow-hidden rounded-2xl border px-3 py-3 text-left shadow-[0_10px_28px_-18px_rgba(16,27,53,0.22)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_36px_-18px_rgba(56,103,255,0.28)] sm:px-4 sm:py-3.5 ${
        isInteractive ? 'cursor-pointer' : ''
      } ${s.panel} ${s.ring} ${active ? s.activeRing : ''}`}
      aria-pressed={isInteractive ? active : undefined}
    >
      <div className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-white/50 blur-2xl" aria-hidden />
      <div className="relative flex items-start justify-between gap-2">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105 [&_svg]:h-4 [&_svg]:w-4 ${s.iconWrap}`}
        >
          {icon}
        </div>
        <span className={`min-w-0 break-all text-2xl font-semibold tabular-nums tracking-tight leading-none ${s.count}`}>{count}</span>
      </div>
      <div className="relative mt-3 flex items-end justify-between gap-2">
        <p className={`min-w-0 break-words text-[11px] font-semibold uppercase tracking-[0.08em] leading-snug ${s.text}`}>{label}</p>
        {active ? (
          <span
            className={`hidden sm:inline-flex shrink-0 rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shadow-sm ring-1 ring-black/5 ${s.text}`}
          >
            Active
          </span>
        ) : hint ? (
          <span className={`hidden sm:inline shrink-0 text-[10px] font-bold opacity-80 ${s.text}`}>{hint}</span>
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
      className={`relative w-full overflow-hidden rounded-2xl border px-3 py-3 shadow-[0_10px_28px_-18px_rgba(16,27,53,0.22)] sm:px-4 sm:py-3.5 ${s.panel} ${s.ring}`}
      aria-hidden
    >
      <div className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-white/50 blur-2xl" />
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
