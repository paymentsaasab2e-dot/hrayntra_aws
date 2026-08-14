export { DrawerCloseButton } from './DrawerCloseButton';
export type { DrawerCloseButtonProps } from './DrawerCloseButton';
export { usePageDrawerLifecycle } from '../../lib/pageDrawerEvents';
export { DetailsModalShell } from './DetailsModalShell';
export type { DetailsModalSize } from './DetailsModalShell';
export { DrawerTabBar } from './DrawerTabBar';
export type { DrawerTabBarItem, DrawerTabIcon } from './DrawerTabBar';

/** Shared width for detail popups (matches Lead / Client drawers). */
export const DRAWER_PANEL_WIDTH_CLASS = 'w-full max-w-6xl';

/** @deprecated Prefer DetailsModalShell — kept for gradual migration. */
export const DRAWER_PANEL_BASE_CLASS = `fixed right-0 top-0 h-full ${DRAWER_PANEL_WIDTH_CLASS} bg-white shadow-2xl border-l border-slate-200 flex flex-col`;

/** Marker for page drawers — used by ARIA to roll aside when a drawer opens. */
export const DRAWER_PANEL_MARKER_ATTR = 'data-app-page-drawer="panel"';

/** Portal overlay: full viewport, panel slides in from the physical right. Set dir="ltr" on the element. */
export const RIGHT_DRAWER_OVERLAY_CLASS =
  'fixed inset-0 z-[90] flex flex-col justify-end sm:flex-row sm:justify-end';

export const RIGHT_DRAWER_BACKDROP_CLASS = 'absolute inset-0 bg-slate-900/50';

/** Centered modal panel classes (Lead / Client style). */
export const DETAILS_MODAL_PANEL_CLASS =
  'pointer-events-auto relative flex h-[min(92vh,920px)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl ring-1 ring-slate-900/5';

export const DETAILS_MODAL_CENTER_CLASS =
  'pointer-events-none fixed inset-0 flex items-center justify-center p-4 sm:p-6';

export const DETAILS_MODAL_BACKDROP_CLASS =
  'fixed inset-0 bg-slate-900/45 backdrop-blur-[2px] pointer-events-auto';

export function drawerPanelClassName(zIndex = 'z-50', extra = ''): string {
  const parts = [DRAWER_PANEL_BASE_CLASS, zIndex, extra].filter(Boolean);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}
