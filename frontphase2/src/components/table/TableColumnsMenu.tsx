'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Columns3 } from 'lucide-react';
import { PH2_TOOLBAR_SELECT_CLASS } from '../layout/Ph2ModulePageLayout';
import type { TableColumnDef } from '../../hooks/usePersistedColumnVisibility';

export type TableColumnsMenuProps = {
  columns: TableColumnDef[];
  isVisible: (id: string) => boolean;
  onToggle: (id: string) => void;
  onReset?: () => void;
  unlockedVisibleCount?: number;
  /** Optional second section (e.g. Leads/Clients custom/dynamic fields). */
  dynamicSection?: {
    title?: string;
    labels: string[];
    selectedLabels: string[];
    onToggleLabel: (label: string) => void;
  };
  className?: string;
  summaryClassName?: string;
};

function ColumnChecklist({
  columns,
  isVisible,
  onToggle,
}: {
  columns: TableColumnDef[];
  isVisible: (id: string) => boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      {columns.map((col) => {
        const checked = isVisible(col.id);
        return (
          <label
            key={col.id}
            className={`flex items-center gap-2 text-xs ${
              col.locked ? 'cursor-default text-slate-400' : 'cursor-pointer text-slate-700'
            }`}
          >
            <input
              type="checkbox"
              checked={checked}
              disabled={Boolean(col.locked)}
              onChange={() => onToggle(col.id)}
              className="h-3.5 w-3.5 shrink-0 rounded border-indigo-200 text-indigo-600 focus:ring-indigo-500/30 disabled:opacity-60"
            />
            <span className="min-w-0 truncate">
              {col.label}
              {col.locked ? (
                <span className="ml-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                  required
                </span>
              ) : null}
            </span>
          </label>
        );
      })}
    </div>
  );
}

const MENU_WIDTH = 288; // w-72
const MENU_GAP = 8;
const MENU_MAX_HEIGHT = 360;

type MenuPosition = {
  left: number;
  top?: number;
  bottom?: number;
  placement: 'top' | 'bottom';
};

export function TableColumnsMenu({
  columns,
  isVisible,
  onToggle,
  onReset,
  unlockedVisibleCount,
  dynamicSection,
  className = '',
  summaryClassName = PH2_TOOLBAR_SELECT_CLASS,
}: TableColumnsMenuProps) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    // Prefer upward so the panel sits above the table instead of under sticky headers.
    const openUpward =
      spaceAbove >= Math.min(MENU_MAX_HEIGHT, spaceBelow) ||
      spaceBelow < MENU_MAX_HEIGHT + MENU_GAP;

    const left = Math.min(
      Math.max(8, rect.right - MENU_WIDTH),
      window.innerWidth - MENU_WIDTH - 8,
    );

    if (openUpward) {
      setMenuPosition({
        left,
        placement: 'top',
        bottom: window.innerHeight - rect.top + MENU_GAP,
      });
      return;
    }

    setMenuPosition({
      left,
      placement: 'bottom',
      top: rect.bottom + MENU_GAP,
    });
  }, []);

  useEffect(() => {
    if (!open) {
      setMenuPosition(null);
      return;
    }
    updatePosition();
    const onReposition = () => updatePosition();
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onDocumentMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocumentMouseDown);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onDocumentMouseDown);
      document.removeEventListener('keydown', onEscape);
    };
  }, [open]);

  const count =
    typeof unlockedVisibleCount === 'number'
      ? unlockedVisibleCount
      : columns.filter((col) => !col.locked && isVisible(col.id)).length;
  const dynamicSelected = dynamicSection?.selectedLabels.length ?? 0;
  const badgeCount = count + dynamicSelected;

  const primaryColumns = columns.filter((col) => col.defaultVisible !== false);
  const moreColumns = columns.filter((col) => col.defaultVisible === false);

  const menuPanel =
    open && menuPosition && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label="Table columns"
            className="fixed z-[1200] flex w-72 flex-col overflow-hidden rounded-xl border border-indigo-100/90 bg-white shadow-2xl"
            style={{
              left: menuPosition.left,
              ...(menuPosition.placement === 'top'
                ? { bottom: menuPosition.bottom }
                : { top: menuPosition.top }),
              maxHeight: MENU_MAX_HEIGHT,
            }}
          >
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 px-3 pb-2 pt-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Show in table
              </p>
              {onReset ? (
                <button
                  type="button"
                  onClick={onReset}
                  className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  Reset
                </button>
              ) : null}
            </div>

            <div className="ph2-invisible-scrollbar min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-3 py-2">
              <ColumnChecklist
                columns={primaryColumns}
                isVisible={isVisible}
                onToggle={onToggle}
              />

              {moreColumns.length > 0 ? (
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    More fields
                  </p>
                  <ColumnChecklist
                    columns={moreColumns}
                    isVisible={isVisible}
                    onToggle={onToggle}
                  />
                </div>
              ) : null}

              {dynamicSection && dynamicSection.labels.length > 0 ? (
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    {dynamicSection.title || 'Custom fields'}
                  </p>
                  <div className="space-y-2">
                    {dynamicSection.labels.map((label) => {
                      const checked = dynamicSection.selectedLabels.some(
                        (item) => item.toLowerCase() === label.toLowerCase(),
                      );
                      return (
                        <label
                          key={label}
                          className="flex cursor-pointer items-center gap-2 text-xs text-slate-700"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => dynamicSection.onToggleLabel(label)}
                            className="h-3.5 w-3.5 shrink-0 rounded border-indigo-200 text-indigo-600 focus:ring-indigo-500/30"
                          />
                          <span className="min-w-0 truncate">{label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className={`relative shrink-0 ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className={`${summaryClassName} inline-flex items-center gap-1.5`}
      >
        <Columns3 className="h-3.5 w-3.5 text-indigo-600" strokeWidth={2.25} />
        Columns
        {badgeCount > 0 ? ` (${badgeCount})` : ''}
      </button>
      {menuPanel}
    </div>
  );
}
