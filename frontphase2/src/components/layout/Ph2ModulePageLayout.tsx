'use client';

import React from 'react';

/** Shared `<select>` styling — Leads-style glass pills. */
export const PH2_TOOLBAR_SELECT_CLASS =
  'h-9 min-h-9 shrink-0 appearance-none bg-none rounded-full border border-white/70 bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#3867FF]/25 focus:border-[#3867FF]/40 cursor-pointer hover:border-[#7864FF]/30 hover:bg-white';

/** Opaque table panel — Leads table shell. */
export const PH2_TABLE_CARD_CLASS =
  'hry-table-shell mb-0 flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col overflow-hidden rounded-2xl';

/** Search + filters row — floating glass capsule above the table (Leads). */
export const PH2_TOOLBAR_ROW_CLASS =
  'hry-filter-bar no-scrollbar mb-3 shrink-0 min-w-0 p-2.5 sm:p-3 flex flex-row flex-nowrap items-center gap-2 overflow-x-auto overflow-y-hidden rounded-2xl';

export const PH2_CLEAR_FILTER_CLASS =
  'flex h-9 shrink-0 items-center gap-1 rounded-full px-3 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50 hover:text-rose-700';

export const PH2_LIST_STACK_CLASS =
  'mb-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden';

/** Filter chips/selects sitting on the same toolbar row. */
export const PH2_TOOLBAR_FILTERS_CLASS =
  'flex w-max min-w-max shrink-0 flex-nowrap items-center gap-1.5 sm:gap-2';

export const PH2_TABLE_CARD_FOOTER_CLASS =
  'mt-0 w-full min-w-0 shrink-0 border-t border-slate-100/80 bg-white/80 px-2.5 py-2 sm:px-4';

/** KPI / status tiles — stay in one row and shrink on small screens. */
export const PH2_KPI_ROW_CLASS =
  'mb-3 sm:mb-4 grid shrink-0 grid-cols-[repeat(auto-fit,minmax(0,1fr))] gap-2 sm:gap-3';

/** Scroll region for table rows inside a PH2 table card. */
export const PH2_TABLE_BODY_SCROLL_CLASS =
  'ph2-table-body-scroll min-h-0 min-w-0 max-w-full flex-1 overflow-x-auto overflow-y-auto';

/** Wide list tables keep column width and scroll horizontally on small screens. */
export const PH2_TABLE_CLASS = 'w-max min-w-full border-collapse text-left';

/** Icon + page title row in module headers (vertically centered). */
export const PH2_PAGE_HEADER_BRAND_CLASS = 'flex min-w-0 items-center gap-2.5 sm:gap-3';

export const PH2_PAGE_HEADER_ICON_TILE_CLASS =
  'hry-title-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-white ring-1 ring-white/30 sm:h-11 sm:w-11';

export const PH2_PAGE_HEADER_TITLE_CLASS =
  'text-xl sm:text-[1.4rem] font-semibold tracking-tight text-[#101B35] leading-none';

export const PH2_PAGE_HEADER_CLASS =
  'no-scrollbar flex min-h-0 shrink-0 flex-nowrap items-center justify-between gap-2 overflow-x-auto bg-transparent px-2 py-2 sm:gap-3 sm:px-4 sm:py-2.5 lg:px-5';

export const PH2_HEADER_PILL =
  'hry-btn-glass inline-flex h-8 w-8 sm:h-9 sm:w-auto shrink-0 items-center justify-center gap-1.5 rounded-full px-0 sm:px-3.5 text-xs font-semibold active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50';

export const PH2_HEADER_PILL_ICON =
  'hry-btn-glass inline-flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full text-slate-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50';

export const PH2_HEADER_PILL_PRIMARY =
  'hry-btn-primary inline-flex h-8 w-8 sm:h-9 sm:w-auto shrink-0 items-center justify-center gap-1.5 rounded-full px-0 sm:px-4 text-xs font-semibold text-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50';

export const PH2_HEADER_PILL_AI =
  'hry-btn-ai inline-flex h-8 w-8 sm:h-9 sm:w-auto shrink-0 items-center justify-center gap-1.5 rounded-full px-0 sm:px-3.5 text-xs font-semibold active:scale-[0.98]';

/** Filter capsule above an opaque table — same stack as Leads. */
export function Ph2FloatingFilterStack({
  filter,
  extras,
  children,
}: {
  filter: React.ReactNode;
  extras?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={PH2_LIST_STACK_CLASS}>
      <div className={PH2_TOOLBAR_ROW_CLASS}>{filter}</div>
      {extras}
      {children}
    </div>
  );
}

type Ph2ModulePageLayoutProps = {
  title: string;
  /** Icon inside the gradient tile (already sized, e.g. `<Briefcase className="h-5 w-5" />`). */
  icon: React.ReactNode;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  /** Portals/drawers that should live inside `<main>` after the scroll region. */
  belowScroll?: React.ReactNode;
};

/**
 * Shared shell for CRM modules: Leads-style aurora header, glass toolbar,
 * and a table that scrolls inside its card.
 */
export function Ph2ModulePageLayout({
  title,
  icon,
  subtitle,
  actions,
  children,
  belowScroll,
}: Ph2ModulePageLayoutProps) {
  return (
    <div className="ph2-page-shell flex h-[calc(100dvh-3.5rem)] w-full min-w-0 max-w-full flex-col overflow-hidden text-slate-900">
      <main className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="hry-aurora" aria-hidden />
        <header className={PH2_PAGE_HEADER_CLASS}>
          <div className={PH2_PAGE_HEADER_BRAND_CLASS}>
            <div className={PH2_PAGE_HEADER_ICON_TILE_CLASS}>{icon}</div>
            <div>
              <h1 className={PH2_PAGE_HEADER_TITLE_CLASS}>{title}</h1>
              {subtitle ? (
                <p className="mt-1 hidden text-xs font-medium text-slate-500 sm:block">{subtitle}</p>
              ) : null}
            </div>
          </div>
          {actions ? <div className="flex min-w-0 shrink-0 flex-nowrap items-center gap-1.5 overflow-x-auto sm:gap-2">{actions}</div> : null}
        </header>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-2 py-1.5 sm:px-3 sm:py-2 lg:px-4">
          {children}
        </div>
        {belowScroll}
      </main>
    </div>
  );
}
