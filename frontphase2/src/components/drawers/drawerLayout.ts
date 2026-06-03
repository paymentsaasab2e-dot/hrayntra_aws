export { DrawerCloseButton } from './DrawerCloseButton';
export type { DrawerCloseButtonProps } from './DrawerCloseButton';

/** Shared width for right-side slide-out drawers (matches Job Details drawer). */
export const DRAWER_PANEL_WIDTH_CLASS = 'w-3/4 max-w-6xl';

export const DRAWER_PANEL_BASE_CLASS = `fixed right-0 top-0 h-full ${DRAWER_PANEL_WIDTH_CLASS} bg-white shadow-2xl border-l border-slate-200 flex flex-col`;

/** Portal overlay: full viewport, panel slides in from the physical right. Set dir="ltr" on the element. */
export const RIGHT_DRAWER_OVERLAY_CLASS =
  'fixed inset-0 z-[90] flex flex-col justify-end sm:flex-row sm:justify-end';

export const RIGHT_DRAWER_BACKDROP_CLASS = 'absolute inset-0 bg-slate-900/50';

export function drawerPanelClassName(zIndex = 'z-50', extra = ''): string {
  const parts = [DRAWER_PANEL_BASE_CLASS, zIndex, extra].filter(Boolean);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}
