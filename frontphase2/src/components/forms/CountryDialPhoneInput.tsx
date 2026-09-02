'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search } from 'lucide-react';
import { useDrawerPortalDropdownPosition } from '../drawers/drawerFormUi';
import {
  composeInternationalPhone,
  digitsOnly,
  extractNationalNumber,
  getPhoneCountryRule,
  getPhoneDialOptions,
  inferPhoneCountryFromNumber,
} from '../../lib/phoneByCountry';

export type CountryDialPhoneInputProps = {
  value: string;
  onChange: (fullPhone: string) => void;
  countryCode?: string;
  countryName?: string;
  error?: boolean;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
};

const MENU_WIDTH = 288;
const SEARCH_HEADER_HEIGHT = 48;
const DROPDOWN_MAX_LIST_HEIGHT = 240;
const DROPDOWN_MIN_LIST_HEIGHT = 120;

function locationIsoCode(countryCode?: string, countryName?: string): string {
  return getPhoneCountryRule(countryCode, countryName)?.isoCode || '';
}

export function CountryDialPhoneInput({
  value,
  onChange,
  countryCode = '',
  countryName = '',
  error = false,
  className = '',
  inputClassName = '',
  disabled = false,
  id,
  'aria-label': ariaLabel = 'Mobile number',
}: CountryDialPhoneInputProps) {
  const options = useMemo(() => getPhoneDialOptions(), []);
  const [selectedIso, setSelectedIso] = useState(() =>
    inferPhoneCountryFromNumber(value, locationIsoCode(countryCode, countryName)),
  );
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const userPickedRef = useRef(false);

  const closeMenu = useCallback(() => {
    setOpen(false);
    setQuery('');
  }, []);

  const { triggerRef, menuRef, menuPosition } = useDrawerPortalDropdownPosition(
    open,
    false,
    closeMenu,
  );

  useEffect(() => {
    if (userPickedRef.current) return;
    if (digitsOnly(value)) {
      const fromNumber = inferPhoneCountryFromNumber(value, '');
      if (fromNumber) setSelectedIso(fromNumber);
      return;
    }
    const next = locationIsoCode(countryCode, countryName);
    if (next) setSelectedIso(next);
  }, [countryCode, countryName, value]);

  const rule = getPhoneCountryRule(selectedIso, '') || getPhoneCountryRule(countryCode, countryName);
  const dialCode = rule?.dialCode || '';
  const nationalNumber = extractNationalNumber(value, dialCode);
  const maxLength = rule?.nationalLength ?? 15;

  const applyCountry = (iso: string) => {
    userPickedRef.current = true;
    setSelectedIso(iso);
    const nextRule = getPhoneCountryRule(iso, '');
    onChange(composeInternationalPhone(nextRule?.dialCode || '', nationalNumber));
    closeMenu();
  };

  const handleNationalChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, maxLength);
    onChange(composeInternationalPhone(dialCode, digits));
  };

  const filteredOptions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((option) => {
      const haystack = `${option.countryName} ${option.dialCode} ${option.isoCode}`.toLowerCase();
      return haystack.includes(needle.replace(/^\+/, ''));
    });
  }, [options, query]);

  const listMaxHeight = useMemo(() => {
    if (!menuPosition || typeof window === 'undefined') return DROPDOWN_MAX_LIST_HEIGHT;
    const viewportPadding = 12;
    const available =
      menuPosition.placement === 'bottom'
        ? window.innerHeight - (menuPosition.top ?? 0) - viewportPadding - SEARCH_HEADER_HEIGHT
        : window.innerHeight - (menuPosition.bottom ?? 0) - viewportPadding - SEARCH_HEADER_HEIGHT;
    return Math.max(DROPDOWN_MIN_LIST_HEIGHT, Math.min(DROPDOWN_MAX_LIST_HEIGHT, available));
  }, [menuPosition]);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      const input = menuRef.current?.querySelector('input');
      if (input instanceof HTMLInputElement) input.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, menuRef]);

  const menuLeft = useMemo(() => {
    if (!menuPosition || typeof window === 'undefined') return 0;
    return Math.max(8, Math.min(menuPosition.left, window.innerWidth - MENU_WIDTH - 8));
  }, [menuPosition]);

  const menu =
    open && menuPosition && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            className="ph2-portal-popover fixed z-[2000] flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
            style={{
              left: menuLeft,
              width: MENU_WIDTH,
              ...(menuPosition.placement === 'top'
                ? { bottom: menuPosition.bottom }
                : { top: menuPosition.top }),
            }}
          >
            <div className="shrink-0 border-b border-slate-100 p-2">
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
                  placeholder="Search country or code"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-2.5 text-xs text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>
            <ul
              role="listbox"
              className="ph2-invisible-scrollbar min-h-0 overflow-y-auto py-1"
              style={{ maxHeight: listMaxHeight }}
            >
              {filteredOptions.length === 0 ? (
                <li className="px-3 py-2 text-xs text-slate-500">No matching country</li>
              ) : (
                filteredOptions.map((option) => {
                  const active = option.isoCode === selectedIso;
                  return (
                    <li key={option.isoCode}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={active}
                        onClick={() => applyCountry(option.isoCode)}
                        className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                          active ? 'bg-blue-50 font-semibold text-blue-700' : 'text-slate-800'
                        }`}
                      >
                        <span className="min-w-0 truncate">{option.countryName}</span>
                        <span className="shrink-0 tabular-nums text-slate-500">{option.dialCode}</span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>,
          document.body,
        )
      : null;

  return (
    <div
      className={`flex min-w-0 w-full items-stretch overflow-visible rounded-xl border bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 ${
        error ? 'border-red-300' : 'border-slate-200'
      } ${className}`}
    >
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((prev) => !prev);
        }}
        aria-label="Country code"
        aria-haspopup="listbox"
        aria-expanded={open}
        title={rule ? `${rule.countryName} (${rule.dialCode})` : 'Choose country code'}
        className="inline-flex w-[4.75rem] shrink-0 items-center justify-center gap-0.5 rounded-l-xl border-r border-slate-200 bg-slate-50 px-1.5 text-sm font-semibold tabular-nums text-slate-700 outline-none hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="min-w-0 truncate">{dialCode || '+'}</span>
        <ChevronDown size={14} className={`shrink-0 text-slate-400 ${open ? 'rotate-180' : ''}`} />
      </button>
      <input
        id={id}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        disabled={disabled}
        value={nationalNumber}
        onChange={(e) => handleNationalChange(e.target.value)}
        maxLength={maxLength}
        placeholder="Mobile number"
        aria-label={ariaLabel}
        className={`min-w-0 flex-1 rounded-r-xl border-0 bg-transparent px-3 py-2.5 text-sm text-slate-900 outline-none focus:ring-0 ${inputClassName}`}
        size={1}
      />
      {menu}
    </div>
  );
}
