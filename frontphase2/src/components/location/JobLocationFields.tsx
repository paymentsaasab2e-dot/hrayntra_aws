'use client';

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Loader2, MapPin, Search } from 'lucide-react';
import type { LocationSelection } from '../LocationAutocomplete';
import {
  cityToLocationSelection,
  countryToLocationSelection,
  findCityRecord,
  findStateByNameOrIso,
  getCountryByCodeOrName,
  getCscCityOptions,
  getCscCountryOptions,
  getCscStateOptions,
  loadCitySearchIndex,
  searchCscCities,
  stateToLocationSelection,
  type CscCitySearchHit,
} from '../../lib/cscData';

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export interface JobLocationFieldsProps {
  country: string;
  state: string;
  city: string;
  onChange: (patch: { country?: string; state?: string; city?: string }) => void;
  disabled?: boolean;
  labelClass?: string;
  inputClass?: string;
}

export function JobLocationFields({
  country,
  state,
  city,
  onChange,
  disabled,
  labelClass = 'block text-sm font-medium text-slate-700 mb-2',
  inputClass =
    'w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500',
}: JobLocationFieldsProps) {
  const countries = useMemo(() => getCscCountryOptions(), []);
  const resolvedCountry = useMemo(() => getCountryByCodeOrName('', country), [country]);
  const activeCountryCode = resolvedCountry?.isoCode ?? '';

  const stateOptions = useMemo(
    () => (activeCountryCode ? getCscStateOptions(activeCountryCode) : []),
    [activeCountryCode],
  );

  const resolvedState = useMemo(
    () => (activeCountryCode ? findStateByNameOrIso(activeCountryCode, state) : undefined),
    [activeCountryCode, state],
  );

  const cityOptions = useMemo(() => {
    if (!activeCountryCode) return [];
    if (stateOptions.length > 0 && !resolvedState?.isoCode) return [];
    return getCscCityOptions(activeCountryCode, resolvedState?.isoCode);
  }, [activeCountryCode, resolvedState?.isoCode, stateOptions.length]);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchHits, setSearchHits] = useState<CscCitySearchHit[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debouncedQuery = useDebouncedValue(searchQuery.trim(), 300);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  useEffect(() => {
    if (!searchFocused || debouncedQuery.length < 2) {
      setSearchHits([]);
      setSearchLoading(false);
      return;
    }

    let cancelled = false;
    setSearchLoading(true);
    void loadCitySearchIndex().then(() => {
      if (cancelled) return;
      setSearchHits(searchCscCities(debouncedQuery, 20));
      setSearchLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, searchFocused]);

  useEffect(() => {
    setActiveIndex(-1);
  }, [searchHits]);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const applySelection = useCallback(
    (selection: LocationSelection) => {
      onChange({
        country: selection.country,
        state: selection.state,
        city: selection.city,
      });
      setSearchQuery(selection.location || [selection.city, selection.state, selection.country].filter(Boolean).join(', '));
      setSearchOpen(false);
    },
    [onChange],
  );

  const commitSearchHit = useCallback(
    (hit: CscCitySearchHit) => {
      applySelection(cityToLocationSelection(hit.city));
    },
    [applySelection],
  );

  const handleCountryChange = (iso: string) => {
    const record = getCountryByCodeOrName(iso);
    if (!record) return;
    applySelection(countryToLocationSelection(record));
  };

  const handleStateChange = (stateIso: string) => {
    if (!resolvedCountry) return;
    const nextState = stateOptions.find((s) => s.value === stateIso);
    if (!nextState) return;
    const stateRecord = findStateByNameOrIso(resolvedCountry.isoCode, nextState.name);
    if (!stateRecord) return;
    applySelection(stateToLocationSelection(resolvedCountry, stateRecord, city));
  };

  const handleCityChange = (cityName: string) => {
    if (!resolvedCountry) {
      onChange({ city: cityName });
      return;
    }
    const cityRecord = findCityRecord(resolvedCountry.isoCode, cityName, resolvedState?.isoCode);
    if (cityRecord) {
      applySelection(cityToLocationSelection(cityRecord));
      return;
    }
    if (resolvedState) {
      applySelection(stateToLocationSelection(resolvedCountry, resolvedState, cityName));
      return;
    }
    applySelection(countryToLocationSelection(resolvedCountry, { state, city: cityName }));
  };

  const showSearchDropdown = searchOpen && searchFocused && searchQuery.trim().length >= 2;
  const searchInputClass = `${inputClass} pl-9`;

  return (
    <div className="space-y-4">
      <div className="relative" ref={wrapperRef}>
        <label className={labelClass}>Search location (optional)</label>
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            type="text"
            value={searchQuery}
            disabled={disabled}
            placeholder="Type a city or region to autofill below…"
            aria-label="Search location"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={showSearchDropdown}
            aria-controls={listboxId}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (e.target.value.trim().length >= 2) setSearchOpen(true);
            }}
            onFocus={() => {
              setSearchFocused(true);
              if (searchQuery.trim().length >= 2) setSearchOpen(true);
            }}
            onBlur={() => {
              window.setTimeout(() => {
                setSearchFocused(false);
                setSearchOpen(false);
              }, 120);
            }}
            onKeyDown={(event) => {
              if (!showSearchDropdown) return;
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActiveIndex((idx) => (idx + 1) % Math.max(searchHits.length, 1));
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActiveIndex((idx) => (idx <= 0 ? searchHits.length - 1 : idx - 1));
              } else if (event.key === 'Enter' && searchHits[activeIndex]) {
                event.preventDefault();
                commitSearchHit(searchHits[activeIndex]);
              } else if (event.key === 'Escape') {
                setSearchOpen(false);
              }
            }}
            className={searchInputClass}
            autoComplete="off"
          />
          {searchLoading ? (
            <Loader2
              size={16}
              className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400"
              aria-hidden
            />
          ) : null}
        </div>

        {showSearchDropdown ? (
          <ul
            id={listboxId}
            role="listbox"
            className="absolute z-30 mt-1 w-full max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl"
          >
            {!searchLoading && searchHits.length === 0 ? (
              <li className="px-4 py-3 text-xs text-slate-500">No locations found.</li>
            ) : null}
            {searchHits.map((hit, index) => {
              const active = index === activeIndex;
              return (
                <li
                  key={`${hit.city.countryCode}-${hit.city.stateCode}-${hit.city.name}-${index}`}
                  role="option"
                  aria-selected={active}
                >
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      commitSearchHit(hit);
                    }}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={`flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm hover:bg-slate-50 ${
                      active ? 'bg-blue-50/60' : ''
                    }`}
                  >
                    <MapPin size={15} className="mt-0.5 shrink-0 text-blue-500" aria-hidden />
                    <span className="min-w-0 flex-1 text-slate-900 leading-snug">{hit.displayName}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className={labelClass}>
            Country <span className="text-red-500">*</span>
          </label>
          <select
            value={activeCountryCode}
            disabled={disabled}
            onChange={(e) => handleCountryChange(e.target.value)}
            className={inputClass}
          >
            <option value="">Select country…</option>
            {countries.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>State (optional)</label>
          {stateOptions.length > 0 ? (
            <select
              value={resolvedState?.isoCode ?? ''}
              disabled={disabled || !activeCountryCode}
              onChange={(e) => handleStateChange(e.target.value)}
              className={inputClass}
            >
              <option value="">Select state…</option>
              {stateOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={state}
              disabled={disabled}
              onChange={(e) => {
                if (!resolvedCountry) {
                  onChange({ state: e.target.value });
                  return;
                }
                applySelection(
                  countryToLocationSelection(resolvedCountry, { state: e.target.value, city }),
                );
              }}
              placeholder="Karnataka"
              className={inputClass}
            />
          )}
        </div>

        <div>
          <label className={labelClass}>City (optional)</label>
          {cityOptions.length > 0 ? (
            <select
              value={city}
              disabled={disabled || !activeCountryCode}
              onChange={(e) => handleCityChange(e.target.value)}
              className={inputClass}
            >
              <option value="">Select city…</option>
              {cityOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={city}
              disabled={disabled}
              onChange={(e) => handleCityChange(e.target.value)}
              placeholder="Bengaluru"
              className={inputClass}
            />
          )}
        </div>
      </div>
    </div>
  );
}
