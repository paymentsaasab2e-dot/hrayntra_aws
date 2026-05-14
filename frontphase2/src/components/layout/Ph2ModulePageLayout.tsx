'use client';

import React from 'react';

/** Shared `<select>` styling — Leads / Client toolbar (indigo). */
export const PH2_TOOLBAR_SELECT_CLASS =
  'rounded-lg border border-indigo-100/90 bg-white/95 px-2.5 py-1.5 text-xs font-medium text-slate-800 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-300 cursor-pointer hover:border-indigo-200/90 hover:bg-indigo-50/40';

/** Frosted table / panel wrapper — Leads / Client list card. */
export const PH2_TABLE_CARD_CLASS =
  'mb-4 overflow-hidden rounded-xl border border-indigo-100/60 bg-white/70 shadow-[0_12px_40px_-18px_rgba(59,130,246,0.18)] backdrop-blur-sm transition-shadow hover:shadow-[0_16px_48px_-14px_rgba(79,70,229,0.16)]';

/** Top row inside table card (search + filters). */
export const PH2_TOOLBAR_ROW_CLASS =
  'p-3 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-indigo-100/40 bg-gradient-to-br from-white via-indigo-50/25 to-violet-50/20';

export const PH2_TABLE_CARD_FOOTER_CLASS =
  'mt-0 w-full border-t border-indigo-100/50 bg-gradient-to-r from-slate-50/40 via-white to-indigo-50/25 px-3 py-2 sm:px-4';

type Ph2ModulePageLayoutProps = {
  title: string;
  subtitle?: string;
  /** Icon inside the gradient tile (already sized, e.g. `<Briefcase className="h-5 w-5" />`). */
  icon: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  /** Portals/drawers that should live inside `<main>` after the scroll region. */
  belowScroll?: React.ReactNode;
};

/**
 * Shared shell for CRM modules (Leads / Client pattern): full-height column, indigo header,
 * scroll body with consistent horizontal padding.
 */
export function Ph2ModulePageLayout({
  title,
  subtitle,
  icon,
  actions,
  children,
  belowScroll,
}: Ph2ModulePageLayoutProps) {
  return (
    <div className="w-full min-h-screen overflow-hidden text-slate-900">
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="min-h-[4.5rem] flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3 shrink-0 border-b border-indigo-100/50 bg-white/80 backdrop-blur-md shadow-[inset_0_-1px_0_0_rgba(99,102,241,0.08)]">
          <div className="flex items-start gap-2.5 sm:gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/30 ring-1 ring-white/20">
              {icon}
            </div>
            <div>
              <h1 className="text-xl sm:text-[1.35rem] font-bold tracking-tight text-slate-900 leading-tight">{title}</h1>
              {subtitle ? <p className="mt-0.5 max-w-xl text-xs text-slate-500">{subtitle}</p> : null}
            </div>
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </header>
        <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-5 sm:py-6 lg:px-6">{children}</div>
        {belowScroll}
      </main>
    </div>
  );
}
