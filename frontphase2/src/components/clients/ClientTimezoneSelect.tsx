'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';
import {
  buildClientTimezoneSelectOptions,
  buildIanaTimezoneSelectOptions,
  resolveIanaFromTimezoneValue,
} from '../../utils/inferTimezone';
import { useDrawerPortalDropdownPosition } from '../drawers/drawerFormUi';

const TRIGGER_CLASS =
  'flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-left text-sm text-slate-900 ' +
  'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';

type ClientTimezoneSelectProps = {
  value: string;
  onChange: (value: string) => void;
  onManualChange?: () => void;
  className?: string;
  placeholder?: string;
  /** When true, option values are IANA ids (for interview scheduling). */
  valueAsIana?: boolean;
  /** Prefer opening the menu above the field (rare; default auto). */
  preferUpward?: boolean;
};

export function ClientTimezoneSelect({
  value,
  onChange,
  onManualChange,
  className,
  placeholder = 'Select timezone…',
  valueAsIana = false,
  preferUpward = false,
}: ClientTimezoneSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const closeMenu = useCallback(() => {
    setOpen(false);
    setQuery('');
  }, []);
  const { triggerRef, menuRef, menuPosition } = useDrawerPortalDropdownPosition(
    open,
    preferUpward,
    closeMenu,
  );

  const options = useMemo(
    () => (valueAsIana ? buildIanaTimezoneSelectOptions(value) : buildClientTimezoneSelectOptions(value)),
    [value, valueAsIana],
  );
  const selectValue = valueAsIana ? resolveIanaFromTimezoneValue(value, '') : value;
  const selectedLabel =
    options.find((opt) => opt.value === selectValue)?.label ||
    (selectValue ? selectValue : '') ||
    placeholder;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        opt.value.toLowerCase().includes(q) ||
        opt.value.replace(/_/g, ' ').toLowerCase().includes(q),
    );
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const input = menuRef.current?.querySelector<HTMLInputElement>('input[data-tz-search]');
    input?.focus();
  }, [open, menuRef]);

  const menu =
    open && menuPosition && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            className="fixed z-[1300] flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
            style={{
              left: menuPosition.left,
              width: Math.max(menuPosition.width, 280),
              maxHeight: menuPosition.maxHeight,
              ...(menuPosition.placement === 'top'
                ? { bottom: menuPosition.bottom }
                : { top: menuPosition.top }),
            }}
          >
            <div className="shrink-0 border-b border-slate-100 p-2">
              <div className="relative">
                <Search
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  data-tz-search
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search city or timezone…"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <p className="px-3 py-3 text-sm text-slate-500">No timezones match.</p>
              ) : (
                filtered.map((opt) => {
                  const isActive = opt.value === selectValue;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        onManualChange?.();
                        onChange(opt.value);
                        closeMenu();
                      }}
                      className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm ${
                        isActive ? 'bg-blue-50 font-medium text-blue-700' : 'text-slate-800 hover:bg-slate-50'
                      }`}
                    >
                      <span className="min-w-0 truncate">{opt.label}</span>
                      {isActive ? <Check size={15} className="shrink-0 text-blue-600" /> : null}
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={
          className
            ? `flex items-center justify-between gap-2 text-left ${className}`
            : TRIGGER_CLASS
        }
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={`min-w-0 truncate ${selectValue ? 'text-slate-700' : 'text-slate-400'}`}>
          {selectedLabel}
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {menu}
    </div>
  );
}
