'use client';

import React, { useLayoutEffect, type RefObject } from 'react';
import { RefreshCcw } from 'lucide-react';

/** Compact cells + CSS row height from `useFitVisibleTableRows`. */
export const PH2_FIT_ROW_TABLE_CLASS =
  '[&_th]:!px-2 [&_th]:!py-1 [&_td]:!px-2 [&_td]:!py-0 [&_td]:overflow-hidden [&_th]:first:!pl-3 [&_td]:first:!pl-3 [&_tr]:h-[var(--ph2-row-h,2.15rem)]';

/** Compact density on short/narrow panes: about 10 rows visible. */
export const PH2_DENSE_ROW_FIT = { targetRows: 10, minRowPx: 26, maxRowPx: 36 } as const;
const PH2_WIDE_MAX_ROW_PX = 58;
const PH2_WIDE_MQ = '(min-width: 1280px)';

/**
 * Fit about 10 data rows in the current table scroller (including 125% zoom).
 * Wide screens grow row height into leftover pane space; smaller screens stay dense.
 */
export function useFitVisibleTableRows(
  tableRef: RefObject<HTMLTableElement | null>,
  enabled = true,
  extraKey?: string | number,
  options?: { targetRows?: number; minRowPx?: number; maxRowPx?: number },
) {
  const targetRows = options?.targetRows ?? PH2_DENSE_ROW_FIT.targetRows;
  const minRowPx = options?.minRowPx ?? PH2_DENSE_ROW_FIT.minRowPx;
  const maxRowPx = options?.maxRowPx ?? PH2_DENSE_ROW_FIT.maxRowPx;
  useLayoutEffect(() => {
    if (!enabled) return;
    const table = tableRef.current;
    if (!table) return;
    const scroller =
      (table.closest('.ph2-table-body-scroll') as HTMLElement | null) || table.parentElement;
    if (!scroller) return;
    const apply = () => {
      const theadH = table.querySelector('thead')?.getBoundingClientRect().height || 28;
      const available = scroller.clientHeight - theadH;
      if (available < 120) return;
      const wide = window.matchMedia(PH2_WIDE_MQ).matches;
      const cap = wide
        ? Math.max(maxRowPx, PH2_WIDE_MAX_ROW_PX)
        : Math.min(maxRowPx, PH2_DENSE_ROW_FIT.maxRowPx);
      const rowH = Math.max(minRowPx, Math.min(cap, Math.floor(available / targetRows)));
      table.style.setProperty('--ph2-row-h', `${rowH}px`);
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(scroller);
    const mq = window.matchMedia(PH2_WIDE_MQ);
    mq.addEventListener('change', apply);
    return () => {
      observer.disconnect();
      mq.removeEventListener('change', apply);
    };
  }, [enabled, extraKey, maxRowPx, minRowPx, tableRef, targetRows]);
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
