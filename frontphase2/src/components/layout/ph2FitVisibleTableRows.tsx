'use client';

import React, { useLayoutEffect, type RefObject } from 'react';
import { RefreshCcw } from 'lucide-react';

/** Compact cells + CSS row height from `useFitVisibleTableRows`. */
export const PH2_FIT_ROW_TABLE_CLASS =
  '[&_th]:!px-2 [&_th]:!py-1 [&_td]:!px-2 [&_td]:!py-0 [&_td]:overflow-hidden [&_th]:first:!pl-3 [&_td]:first:!pl-3 [&_tr]:h-[var(--ph2-row-h,2.25rem)]';

/**
 * Fit about 10 data rows in the current table scroller (including 125% zoom).
 * Clamps row height so 100% zoom does not crush cells.
 */
export function useFitVisibleTableRows(
  tableRef: RefObject<HTMLTableElement | null>,
  enabled = true,
  extraKey?: string | number,
) {
  useLayoutEffect(() => {
    if (!enabled) return;
    const table = tableRef.current;
    if (!table) return;
    const scroller =
      (table.closest('.ph2-table-body-scroll') as HTMLElement | null) || table.parentElement;
    if (!scroller) return;
    const TARGET_VISIBLE_ROWS = 10;
    const apply = () => {
      const theadH = table.querySelector('thead')?.getBoundingClientRect().height || 28;
      const available = scroller.clientHeight - theadH;
      if (available < 120) return;
      const rowH = Math.max(28, Math.min(42, Math.floor(available / TARGET_VISIBLE_ROWS)));
      table.style.setProperty('--ph2-row-h', `${rowH}px`);
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, [enabled, extraKey, tableRef]);
}

/** Non-blocking refresh veil — clicks still reach the table underneath. */
export function Ph2TableRefreshingOverlay({
  show,
  label,
}: {
  show: boolean;
  label: string;
}) {
  if (!show) return null;
  return (
    <div
      className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-white/80 backdrop-blur-[1px]"
      role="status"
      aria-live="polite"
    >
      <RefreshCcw size={22} className="animate-spin text-indigo-500" strokeWidth={2.25} />
      <p className="text-sm font-medium text-indigo-800">{label}</p>
    </div>
  );
}
