'use client';

import React from 'react';

/** Shared `<select>` styling — Leads / Client toolbar (indigo). */
export const PH2_TOOLBAR_SELECT_CLASS =
  'rounded-lg border border-indigo-100/90 bg-white/95 px-2.5 py-1.5 text-xs font-medium text-slate-800 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-300 cursor-pointer hover:border-indigo-200/90 hover:bg-indigo-50/40';

/** Frosted table / panel wrapper — viewport-locked list card (fills remaining height). */
export const PH2_TABLE_CARD_CLASS =
  'mb-0 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-indigo-100/60 bg-white/70 shadow-[0_12px_40px_-18px_rgba(59,130,246,0.18)] backdrop-blur-sm transition-shadow hover:shadow-[0_16px_48px_-14px_rgba(79,70,229,0.16)]';

/** Top row inside table card (search + filters). */
export const PH2_TOOLBAR_ROW_CLASS =
  'shrink-0 p-3 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-indigo-100/40 bg-gradient-to-br from-white via-indigo-50/25 to-violet-50/20';

export const PH2_TABLE_CARD_FOOTER_CLASS =
  'mt-0 w-full shrink-0 border-t border-indigo-100/50 bg-gradient-to-r from-slate-50/40 via-white to-indigo-50/25 px-3 py-2 sm:px-4';

/** Scroll region for table rows inside a PH2 table card. */
export const PH2_TABLE_BODY_SCROLL_CLASS =
  'ph2-table-body-scroll min-h-0 flex-1 overflow-auto';

/** Icon + page title row in module headers (vertically centered). */
export const PH2_PAGE_HEADER_BRAND_CLASS = 'flex items-center gap-2.5 sm:gap-3';

export const PH2_PAGE_HEADER_ICON_TILE_CLASS =
  'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/30 ring-1 ring-white/20';

export const PH2_PAGE_HEADER_TITLE_CLASS =
  'text-xl sm:text-[1.35rem] font-bold tracking-tight text-slate-900 leading-none';

type Ph2ModulePageLayoutProps = {
  title: string;
  /** Icon inside the gradient tile (already sized, e.g. `<Briefcase className="h-5 w-5" />`). */
  icon: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  /** Portals/drawers that should live inside `<main>` after the scroll region. */
  belowScroll?: React.ReactNode;
};

/**
 * Shared shell for CRM modules: viewport-locked column, indigo header,
 * content area that does not page-scroll (tables scroll inside their card).
 */
export function Ph2ModulePageLayout({
  title,
  icon,
  actions,
  children,
  belowScroll,
}: Ph2ModulePageLayoutProps) {
  return (
    <div className="ph2-page-shell flex h-[calc(100dvh-3.5rem)] w-full flex-col overflow-hidden text-slate-900">
      <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="min-h-[4.5rem] flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3 shrink-0 border-b border-indigo-100/50 bg-white/80 backdrop-blur-md shadow-[inset_0_-1px_0_0_rgba(99,102,241,0.08)]">
          <div className={PH2_PAGE_HEADER_BRAND_CLASS}>
            <div className={PH2_PAGE_HEADER_ICON_TILE_CLASS}>{icon}</div>
            <h1 className={PH2_PAGE_HEADER_TITLE_CLASS}>{title}</h1>
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </header>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 py-4 sm:px-5 sm:py-6 lg:px-6">
          {children}
        </div>
        {belowScroll}
      </main>
    </div>
  );
}
