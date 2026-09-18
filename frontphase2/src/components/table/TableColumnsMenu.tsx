'use client';

import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Columns3 } from 'lucide-react';
import { PH2_TOOLBAR_SELECT_CLASS } from '../layout/Ph2ModulePageLayout';
import type { TableColumnDef } from '../../hooks/usePersistedColumnVisibility';
import {
  isTableLocationDisplayMode,
  tableLocationModeLabel,
  type TableLocationDisplayMode,
} from '../../lib/formatTableLocation';
import { LOCATION_DISPLAY_COLUMN_PREFIX } from '../../lib/tableColumns/moduleTableColumns';
import { useTableLocationDisplayMode } from '../../lib/useTableLocationDisplayMode';

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

function isLocationDisplayChild(id: string): boolean {
  return id.startsWith(LOCATION_DISPLAY_COLUMN_PREFIX);
}

function locationDisplayModeFromChildId(id: string): TableLocationDisplayMode | null {
  const mode = id.slice(LOCATION_DISPLAY_COLUMN_PREFIX.length);
  return isTableLocationDisplayMode(mode) ? mode : null;
}

function LocationDisplayNested({
  children,
  parentEnabled,
}: {
  children: TableColumnDef[];
  parentEnabled: boolean;
}) {
  const { mode, setMode } = useTableLocationDisplayMode();
  return (
    <div className="ml-6 space-y-1.5 border-l border-indigo-100 pl-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        Show as
      </p>
      {children.map((child) => {
        const childMode = locationDisplayModeFromChildId(child.id);
        const active = Boolean(parentEnabled && childMode && childMode === mode);
        return (
          <label
            key={child.id}
            className={`flex items-start gap-2 text-xs sm:items-center ${
              !parentEnabled
                ? 'cursor-default text-slate-400'
                : active
                  ? 'cursor-pointer font-semibold text-indigo-700'
                  : 'cursor-pointer text-slate-600'
            }`}
          >
            {/* Checkbox look (tick) — exclusive like a radio so it matches Pipeline stages. */}
            <input
              type="checkbox"
              checked={active}
              disabled={!parentEnabled || !childMode}
              onChange={() => {
                if (childMode) setMode(childMode);
              }}
              className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-indigo-200 text-indigo-600 focus:ring-indigo-500/30 disabled:opacity-50 sm:mt-0"
            />
            <span className="min-w-0 break-words leading-snug">{child.label}</span>
          </label>
        );
      })}
    </div>
  );
}

function ColumnChecklist({
  columns,
  isVisible,
  onToggle,
}: {
  columns: TableColumnDef[];
  isVisible: (id: string) => boolean;
  onToggle: (id: string) => void;
}) {
  const nestedIds = useMemo(
    () =>
      columns
        .filter((col) => Array.isArray(col.children) && col.children.length > 0)
        .map((col) => col.id),
    [columns],
  );
  const [expandedIds, setExpandedIds] = useState<string[]>(() => nestedIds);
  const { mode: locationDisplayMode } = useTableLocationDisplayMode();

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  return (
    <div className="space-y-2">
      {columns.map((col) => {
        const checked = isVisible(col.id);
        const children = Array.isArray(col.children) ? col.children : [];
        const hasChildren = children.length > 0;
        const isLocationDisplayNest =
          hasChildren && children.every((child) => isLocationDisplayChild(child.id));
        const expanded = hasChildren && expandedIds.includes(col.id);
        const enabledChildCount = isLocationDisplayNest
          ? 0
          : children.filter((child) => isVisible(child.id)).length;

        return (
          <div key={col.id} className="space-y-1.5">
            <div className="flex items-start gap-1 sm:items-center">
              <label
                className={`flex min-w-0 flex-1 items-start gap-2 text-xs sm:items-center sm:text-xs ${
                  col.locked ? 'cursor-default text-slate-400' : 'cursor-pointer text-slate-700'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={Boolean(col.locked)}
                  onChange={() => onToggle(col.id)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-indigo-200 text-indigo-600 focus:ring-indigo-500/30 disabled:opacity-60 sm:mt-0 sm:h-3.5 sm:w-3.5"
                />
                <span className="min-w-0 break-words leading-snug">
                  {col.label}
                  {col.locked ? (
                    <span className="ml-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                      required
                    </span>
                  ) : null}
                  {isLocationDisplayNest && checked ? (
                    <span className="ml-1 text-[10px] font-medium text-slate-400">
                      ({tableLocationModeLabel(locationDisplayMode)})
                    </span>
                  ) : null}
                  {!isLocationDisplayNest && hasChildren && enabledChildCount > 0 ? (
                    <span className="ml-1 text-[10px] font-medium text-slate-400">
                      ({enabledChildCount})
                    </span>
                  ) : null}
                </span>
              </label>
              {hasChildren ? (
                <button
                  type="button"
                  onClick={() => toggleExpanded(col.id)}
                  className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 sm:mt-0"
                  aria-expanded={expanded}
                  aria-label={
                    expanded
                      ? `Collapse ${col.label} options`
                      : `Expand ${col.label} options`
                  }
                >
                  <ChevronDown
                    size={14}
                    className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
                  />
                </button>
              ) : null}
            </div>

            {hasChildren && expanded ? (
              isLocationDisplayNest ? (
                <LocationDisplayNested children={children} parentEnabled={checked} />
              ) : (
                <div className="ml-6 space-y-1.5 border-l border-indigo-100 pl-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Pipeline stages
                  </p>
                  {children.map((child) => {
                    const childChecked = isVisible(child.id);
                    return (
                      <label
                        key={child.id}
                        className={`flex items-start gap-2 text-xs sm:items-center ${
                          child.locked
                            ? 'cursor-default text-slate-400'
                            : 'cursor-pointer text-slate-600'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={childChecked}
                          disabled={Boolean(child.locked) || !checked}
                          onChange={() => onToggle(child.id)}
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-indigo-200 text-indigo-600 focus:ring-indigo-500/30 disabled:opacity-50 sm:mt-0"
                        />
                        <span className="min-w-0 break-words leading-snug">{child.label}</span>
                      </label>
                    );
                  })}
                </div>
              )
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

const VIEWPORT_PAD = 12;
const MENU_GAP = 8;
const PREFERRED_WIDTH = 288;
const COMPACT_BREAKPOINT = 640;
const PREFERRED_MAX_HEIGHT = 480;
const MIN_MENU_HEIGHT = 140;

type MenuPosition = {
  left: number;
  width: number;
  top: number;
  maxHeight: number;
};

function getViewportBox() {
  const vv = typeof window !== 'undefined' ? window.visualViewport : null;
  if (vv) {
    return {
      left: vv.offsetLeft,
      top: vv.offsetTop,
      width: vv.width,
      height: vv.height,
      right: vv.offsetLeft + vv.width,
      bottom: vv.offsetTop + vv.height,
    };
  }
  return {
    left: 0,
    top: 0,
    width: window.innerWidth,
    height: window.innerHeight,
    right: window.innerWidth,
    bottom: window.innerHeight,
  };
}

function computeMenuPosition(trigger: DOMRect): MenuPosition {
  const box = getViewportBox();
  const safeLeft = box.left + VIEWPORT_PAD;
  const safeRight = box.right - VIEWPORT_PAD;
  const safeTop = box.top + VIEWPORT_PAD;
  const safeBottom = box.bottom - VIEWPORT_PAD;
  const availableWidth = Math.max(0, safeRight - safeLeft);
  const availableHeight = Math.max(0, safeBottom - safeTop);

  const isCompact = box.width < COMPACT_BREAKPOINT;
  const width = isCompact ? availableWidth : Math.min(PREFERRED_WIDTH, availableWidth);

  let left = isCompact ? safeLeft : trigger.right - width;
  if (left < safeLeft) left = safeLeft;
  if (left + width > safeRight) left = Math.max(safeLeft, safeRight - width);

  const spaceBelow = safeBottom - (trigger.bottom + MENU_GAP);
  const spaceAbove = trigger.top - MENU_GAP - safeTop;
  const openDown = spaceBelow >= spaceAbove;

  if (openDown && spaceBelow >= MIN_MENU_HEIGHT) {
    const top = Math.min(trigger.bottom + MENU_GAP, safeBottom);
    return {
      left,
      width,
      top,
      maxHeight: Math.min(PREFERRED_MAX_HEIGHT, Math.max(0, safeBottom - top)),
    };
  }

  if (!openDown && spaceAbove >= MIN_MENU_HEIGHT) {
    const maxHeight = Math.min(PREFERRED_MAX_HEIGHT, spaceAbove);
    const top = Math.max(safeTop, trigger.top - MENU_GAP - maxHeight);
    return {
      left,
      width,
      top,
      maxHeight,
    };
  }

  return {
    left,
    width,
    top: safeTop,
    maxHeight: Math.min(PREFERRED_MAX_HEIGHT, availableHeight),
  };
}

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
    setMenuPosition(computeMenuPosition(trigger.getBoundingClientRect()));
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setMenuPosition(null);
      return;
    }
    updatePosition();
    const onReposition = () => updatePosition();
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    window.visualViewport?.addEventListener('resize', onReposition);
    window.visualViewport?.addEventListener('scroll', onReposition);
    return () => {
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
      window.visualViewport?.removeEventListener('resize', onReposition);
      window.visualViewport?.removeEventListener('scroll', onReposition);
    };
  }, [open, updatePosition]);

  useLayoutEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onEscape);
    };
  }, [open]);

  const count =
    typeof unlockedVisibleCount === 'number'
      ? unlockedVisibleCount
      : columns.filter(
          (col) => !col.locked && !col.excludeFromBadgeCount && isVisible(col.id),
        ).length;
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
            className="ph2-portal-popover fixed z-[2000] flex flex-col overflow-hidden rounded-xl border border-indigo-100 shadow-2xl"
            style={{
              left: menuPosition.left,
              top: menuPosition.top,
              width: menuPosition.width,
              maxHeight: menuPosition.maxHeight,
              backgroundColor: '#ffffff',
            }}
          >
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 bg-white px-3 pb-2 pt-3">
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

            <div
              className="ph2-invisible-scrollbar min-h-0 overflow-x-hidden overflow-y-auto overscroll-contain bg-white px-3 py-2"
              style={{ maxHeight: Math.max(96, menuPosition.maxHeight - 48) }}
            >
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
                          className="flex cursor-pointer items-start gap-2 text-xs text-slate-700 sm:items-center"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => dynamicSection.onToggleLabel(label)}
                            className="mt-0.5 h-4 w-4 shrink-0 rounded border-indigo-200 text-indigo-600 focus:ring-indigo-500/30 sm:mt-0 sm:h-3.5 sm:w-3.5"
                          />
                          <span className="min-w-0 break-words leading-snug">{label}</span>
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
        className={`${summaryClassName} inline-flex items-center gap-1.5 whitespace-nowrap`}
      >
        <Columns3 className="h-3.5 w-3.5 text-indigo-600" strokeWidth={2.25} />
        Columns
        {badgeCount > 0 ? ` (${badgeCount})` : ''}
      </button>
      {menuPanel}
    </div>
  );
}
