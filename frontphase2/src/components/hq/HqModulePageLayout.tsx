'use client';

import React from 'react';
import {
  PH2_PAGE_HEADER_BRAND_CLASS,
  PH2_PAGE_HEADER_ICON_TILE_CLASS,
  PH2_PAGE_HEADER_TITLE_CLASS,
  PH2_TABLE_BODY_SCROLL_CLASS,
  PH2_TABLE_CARD_CLASS,
  PH2_TABLE_CARD_FOOTER_CLASS,
  PH2_TOOLBAR_ROW_CLASS,
  PH2_TOOLBAR_SELECT_CLASS,
} from '@/components/layout/Ph2ModulePageLayout';

/** Re-export Phase 2 surface tokens so HQ pages share the same chrome. */
export {
  PH2_TOOLBAR_SELECT_CLASS as HQ_TOOLBAR_SELECT_CLASS,
  PH2_TABLE_CARD_CLASS as HQ_TABLE_CARD_CLASS,
  PH2_TOOLBAR_ROW_CLASS as HQ_TOOLBAR_ROW_CLASS,
  PH2_TABLE_CARD_FOOTER_CLASS as HQ_TABLE_CARD_FOOTER_CLASS,
  PH2_TABLE_BODY_SCROLL_CLASS as HQ_TABLE_BODY_SCROLL_CLASS,
  PH2_PAGE_HEADER_BRAND_CLASS as HQ_PAGE_HEADER_BRAND_CLASS,
  PH2_PAGE_HEADER_ICON_TILE_CLASS as HQ_PAGE_HEADER_ICON_TILE_CLASS,
  PH2_PAGE_HEADER_TITLE_CLASS as HQ_PAGE_HEADER_TITLE_CLASS,
};

export const HQ_PRIMARY_BUTTON_CLASS =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:brightness-105 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50';

export const HQ_SECONDARY_BUTTON_CLASS =
  'inline-flex items-center gap-2 rounded-xl border border-indigo-100/90 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50';

type HqModulePageLayoutProps = {
  title: string;
  /** Icon inside the gradient tile (e.g. `<UsersRound className="h-5 w-5" />`). */
  icon: React.ReactNode;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  /** Drawers/portals rendered after the scroll region. */
  belowScroll?: React.ReactNode;
  /** When false, content area scrolls (dashboards). Default true = viewport-locked list. */
  locked?: boolean;
};

/**
 * HQ page chrome mirrored from Phase 2 `Ph2ModulePageLayout`:
 * frosted header → content column → SummaryCards → table card.
 * Height is `100dvh` (HQ has no tenant top bar).
 */
export function HqModulePageLayout({
  title,
  icon,
  subtitle,
  actions,
  children,
  belowScroll,
  locked = true,
}: HqModulePageLayoutProps) {
  return (
    <div
      className={`ph2-page-shell flex w-full flex-col overflow-hidden text-slate-900 ${
        locked ? 'h-[100dvh]' : 'min-h-[100dvh]'
      }`}
    >
      <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="flex min-h-[4.5rem] shrink-0 flex-wrap items-center justify-between gap-3 border-b border-indigo-100/50 bg-white/80 px-4 py-3 shadow-[inset_0_-1px_0_0_rgba(99,102,241,0.08)] backdrop-blur-md sm:px-6">
          <div className={PH2_PAGE_HEADER_BRAND_CLASS}>
            <div className={PH2_PAGE_HEADER_ICON_TILE_CLASS}>{icon}</div>
            <div className="min-w-0">
              <h1 className={PH2_PAGE_HEADER_TITLE_CLASS}>{title}</h1>
              {subtitle ? (
                <p className="mt-1 max-w-2xl text-xs font-medium leading-snug text-slate-500 sm:text-[13px]">
                  {subtitle}
                </p>
              ) : null}
            </div>
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </header>
        <div
          className={`flex min-h-0 flex-1 flex-col px-3 py-4 sm:px-5 sm:py-6 lg:px-6 ${
            locked ? 'overflow-hidden' : 'overflow-y-auto'
          }`}
        >
          <div className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col">
            {children}
          </div>
        </div>
        {belowScroll}
      </main>
    </div>
  );
}
