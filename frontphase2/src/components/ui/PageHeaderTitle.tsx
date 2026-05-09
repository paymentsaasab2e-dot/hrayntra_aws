'use client';

import React from 'react';

/**
 * Standard page-title block used across list pages (Leads, Jobs, Candidates,
 * Clients, Contacts, Tasks, Interviews, Placements, Pipeline, Matches, Inbox,
 * Reports, Billing, etc.).
 *
 * Visual reference: the Leads page header — a chunky gradient icon chip on
 * the left, a tight H1 + grey subtitle stack on the right. We expose the
 * gradient as a prop so each tab gets its own brand color (orange/rose for
 * Leads, blue for Candidates, indigo for Jobs, etc.) while sharing the same
 * geometry, ring, and shadow recipe so the bar feels uniform across the app.
 */
export type PageHeaderGradient =
  | 'orange'
  | 'blue'
  | 'indigo'
  | 'emerald'
  | 'cyan'
  | 'violet'
  | 'rose'
  | 'amber'
  | 'teal'
  | 'fuchsia'
  | 'slate';

const GRADIENTS: Record<
  PageHeaderGradient,
  { bg: string; shadow: string }
> = {
  orange: {
    bg: 'bg-gradient-to-br from-rose-500 via-orange-500 to-amber-500',
    shadow: 'shadow-rose-500/30',
  },
  blue: {
    bg: 'bg-gradient-to-br from-sky-500 via-blue-500 to-indigo-500',
    shadow: 'shadow-blue-500/30',
  },
  indigo: {
    bg: 'bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500',
    shadow: 'shadow-indigo-500/30',
  },
  emerald: {
    bg: 'bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500',
    shadow: 'shadow-emerald-500/30',
  },
  cyan: {
    bg: 'bg-gradient-to-br from-cyan-500 via-sky-500 to-blue-500',
    shadow: 'shadow-cyan-500/30',
  },
  violet: {
    bg: 'bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500',
    shadow: 'shadow-violet-500/30',
  },
  rose: {
    bg: 'bg-gradient-to-br from-rose-500 via-pink-500 to-fuchsia-500',
    shadow: 'shadow-rose-500/30',
  },
  amber: {
    bg: 'bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500',
    shadow: 'shadow-amber-500/30',
  },
  teal: {
    bg: 'bg-gradient-to-br from-teal-500 via-emerald-500 to-green-500',
    shadow: 'shadow-teal-500/30',
  },
  fuchsia: {
    bg: 'bg-gradient-to-br from-fuchsia-500 via-pink-500 to-rose-500',
    shadow: 'shadow-fuchsia-500/30',
  },
  slate: {
    bg: 'bg-gradient-to-br from-slate-700 via-slate-600 to-slate-500',
    shadow: 'shadow-slate-500/30',
  },
};

interface PageHeaderTitleProps {
  /** Primary heading text (e.g. "Jobs"). */
  title: React.ReactNode;
  /** One-line description rendered under the title. */
  subtitle?: React.ReactNode;
  /** Lucide-style icon node (already sized). */
  icon: React.ReactNode;
  /** Brand gradient slot for the icon chip. */
  gradient?: PageHeaderGradient;
  /** Optional smaller H1 (uses xl instead of 2xl). Useful inside narrow modals. */
  compact?: boolean;
  /** Optional extra classes on the outer wrapper. */
  className?: string;
}

export function PageHeaderTitle({
  title,
  subtitle,
  icon,
  gradient = 'blue',
  compact = false,
  className = '',
}: PageHeaderTitleProps) {
  const g = GRADIENTS[gradient] ?? GRADIENTS.blue;
  return (
    <div className={`flex items-start gap-3 sm:gap-4 ${className}`}>
      <div
        className={`mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg ring-1 ring-white/20 ${g.bg} ${g.shadow}`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <h1
          className={`${
            compact
              ? 'text-xl sm:text-2xl'
              : 'text-2xl sm:text-[1.65rem]'
          } font-bold tracking-tight text-slate-900 leading-tight`}
        >
          {title}
        </h1>
        {subtitle ? (
          <p className="text-sm text-slate-500 max-w-xl">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}
