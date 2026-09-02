'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search } from 'lucide-react';
import { useDrawerPortalDropdownPosition } from '../drawers/drawerFormUi';
import { PH2_TOOLBAR_SELECT_CLASS } from '../layout/Ph2ModulePageLayout';
import { dedupeByCompanyName } from '../../lib/companyNameKey';

export type SearchableToolbarFilterOption = {
  value: string;
  label: string;
  searchText?: string;
};

type SearchableToolbarFilterSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: SearchableToolbarFilterOption[];
  placeholder: string;
  allLabel: string;
  /** Width / layout only — do not pass border/padding classes here. */
  className?: string;
  ariaLabel: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  /** Collapse punctuation variants of the same company name in the menu. */
  dedupeNormalizedLabels?: boolean;
};

const SEARCH_HEADER_HEIGHT = 52;
const DROPDOWN_MIN_LIST_HEIGHT = 120;
const DROPDOWN_MAX_LIST_HEIGHT = 208;

function resolveListMaxHeight(
  menuPosition: {
    placement: 'top' | 'bottom';
    top?: number;
    bottom?: number;
  } | null,
): number {
  if (!menuPosition || typeof window === 'undefined') return DROPDOWN_MAX_LIST_HEIGHT;

  const viewportPadding = 12;
  const available =
    menuPosition.placement === 'bottom'
      ? window.innerHeight - (menuPosition.top ?? 0) - viewportPadding - SEARCH_HEADER_HEIGHT
      : window.innerHeight - (menuPosition.bottom ?? 0) - viewportPadding - SEARCH_HEADER_HEIGHT;

  return Math.max(
    DROPDOWN_MIN_LIST_HEIGHT,
    Math.min(DROPDOWN_MAX_LIST_HEIGHT, available),
  );
}

export function SearchableToolbarFilterSelect({
  value,
  onChange,
  options,
  placeholder,
  allLabel,
  className = '',
  ariaLabel,
  searchPlaceholder = 'Search…',
  emptyMessage = 'No matches',
  dedupeNormalizedLabels = false,
}: SearchableToolbarFilterSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const closeMenu = useCallback(() => {
    setOpen(false);
    setQuery('');
  }, []);

  const { triggerRef, menuRef, menuPosition } = useDrawerPortalDropdownPosition(
    open,
    false,
    closeMenu,
  );

  const uniqueOptions = useMemo(
    () =>
      dedupeNormalizedLabels
        ? dedupeByCompanyName(options, (option) => option.label)
        : options,
    [dedupeNormalizedLabels, options],
  );

  const selectedLabel = useMemo(() => {
    if (!value) return allLabel;
    return uniqueOptions.find((option) => option.value === value)?.label
      || options.find((option) => option.value === value)?.label
      || value;
  }, [allLabel, options, uniqueOptions, value]);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return uniqueOptions;
    return uniqueOptions.filter((option) => {
      const haystack = `${option.label} ${option.searchText || ''}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [uniqueOptions, query]);

  const listMaxHeight = useMemo(() => resolveListMaxHeight(menuPosition), [menuPosition]);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      const input = menuRef.current?.querySelector('input');
      if (input instanceof HTMLInputElement) input.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, menuRef]);

  const handleSelect = (nextValue: string) => {
    onChange(nextValue);
    closeMenu();
  };

  const menu =
    open && menuPosition && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            className="ph2-portal-popover fixed z-[2000] flex min-w-[14rem] flex-col overflow-hidden rounded-xl border border-slate-200 shadow-lg"
            style={{
              left: menuPosition.left,
              width: Math.max(menuPosition.width, 224),
              ...(menuPosition.placement === 'top'
                ? { bottom: menuPosition.bottom }
                : { top: menuPosition.top }),
              backgroundColor: '#ffffff',
            }}
          >
            <div className="shrink-0 border-b border-slate-100 bg-white p-2">
              <div className="relative">
                <Search
                  size={14}
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onClick={(event) => event.stopPropagation()}
                  placeholder={searchPlaceholder}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-2.5 text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>
            <ul
              className="ph2-invisible-scrollbar min-h-0 overflow-y-auto overscroll-contain bg-white py-1 pr-0.5"
              style={{ maxHeight: listMaxHeight }}
            >
              <li>
                <button
                  type="button"
                  onClick={() => handleSelect('')}
                  className={`w-full px-3 py-2 text-left text-xs hover:bg-slate-50 ${
                    !value ? 'bg-indigo-50 font-semibold text-indigo-700' : 'text-slate-800'
                  }`}
                >
                  {allLabel}
                </button>
              </li>
              {filteredOptions.length === 0 ? (
                <li className="px-3 py-2 text-xs text-slate-500">{emptyMessage}</li>
              ) : (
                filteredOptions.map((option) => (
                  <li key={option.value}>
                    <button
                      type="button"
                      onClick={() => handleSelect(option.value)}
                      className={`w-full px-3 py-2 text-left text-xs hover:bg-slate-50 ${
                        value === option.value
                          ? 'bg-indigo-50 font-semibold text-indigo-700'
                          : 'text-slate-800'
                      }`}
                    >
                      {option.label}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className={`relative shrink-0 ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`${PH2_TOOLBAR_SELECT_CLASS} flex h-9 w-full min-w-0 items-center justify-between gap-1.5 text-left`}
        aria-label={ariaLabel}
        aria-expanded={open}
        title={selectedLabel}
      >
        <span className="min-w-0 truncate">{selectedLabel || placeholder}</span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-slate-500 transition-transform ${
            open && menuPosition?.placement === 'top' ? 'rotate-180' : ''
          }`}
        />
      </button>
      {menu}
    </div>
  );
}
