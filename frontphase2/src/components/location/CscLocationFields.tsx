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
  inferLocationFromCityName,
  getCscCityOptions,
  getCscCountryOptions,
  getCscStateOptions,
  loadCitySearchIndex,
  searchCscCities,
  stateToLocationSelection,
  type CscCitySearchHit,
} from '../../lib/cscData';

const INPUT_CLASS =
  'w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 ' +
  'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white';

const SEARCH_INPUT_CLASS =
  'w-full rounded-xl border border-slate-200 px-4 py-2.5 pl-9 text-sm text-slate-900 ' +
  'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';

export interface CscLocationFieldsProps {
  location: string;
  city: string;
  state: string;
  country: string;
  countryCode: string;
  latitude: number | null;
  longitude: number | null;
  onLocationChange: (location: string) => void;
  onSelect: (selection: LocationSelection) => void;
  disabled?: boolean;
  locationPlaceholder?: string;
  showDetectedHint?: boolean;
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export function CscLocationFields({
  location,
  city,
  state,
  country,
  countryCode,
  latitude,
  longitude,
  onLocationChange,
  onSelect,
  disabled,
  locationPlaceholder = 'Start typing a city, region, or address…',
  showDetectedHint = true,
}: CscLocationFieldsProps) {
  const countries = useMemo(() => getCscCountryOptions(), []);
  const resolvedCountry = useMemo(
    () => getCountryByCodeOrName(countryCode, country),
    [countryCode, country],
  );
  const activeCountryCode = resolvedCountry?.isoCode ?? countryCode.trim().toUpperCase();

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

  const [searchFocused, setSearchFocused] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchHits, setSearchHits] = useState<CscCitySearchHit[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debouncedQuery = useDebouncedValue(location.trim(), 300);
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
      setSearchHits(searchCscCities(debouncedQuery, 25));
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

  const commitSearchHit = useCallback(
    (hit: CscCitySearchHit) => {
      onSelect(cityToLocationSelection(hit.city));
      setSearchOpen(false);
    },
    [onSelect],
  );

  const handleCountryChange = (iso: string) => {
    const nextCountry = countries.find((c) => c.value === iso);
    if (!nextCountry) return;
    const record = getCountryByCodeOrName(iso);
    if (!record) return;
    onSelect(countryToLocationSelection(record));
  };

  const handleStateChange = (stateIso: string) => {
    if (!resolvedCountry) return;
    const nextState = stateOptions.find((s) => s.value === stateIso);
    if (!nextState) return;
    const stateRecord = findStateByNameOrIso(resolvedCountry.isoCode, nextState.name);
    if (!stateRecord) return;
    onSelect(stateToLocationSelection(resolvedCountry, stateRecord, city));
  };

  const handleCityChange = (cityName: string) => {
    if (!resolvedCountry) {
      const inferred = inferLocationFromCityName(cityName);
      if (inferred) {
        onSelect(inferred);
        return;
      }
      onSelect({
        location: cityName,
        city: cityName,
        state: '',
        country: '',
        countryCode: '',
        latitude: 0,
        longitude: 0,
      });
      return;
    }
    const cityRecord = findCityRecord(
      resolvedCountry.isoCode,
      cityName,
      resolvedState?.isoCode,
    );
    if (cityRecord) {
      onSelect(cityToLocationSelection(cityRecord));
      return;
    }
    const inferred = inferLocationFromCityName(cityName, {
      country: resolvedCountry.name,
      countryCode: resolvedCountry.isoCode,
      state,
    });
    if (inferred) {
      onSelect(inferred);
      return;
    }
    if (resolvedState) {
      onSelect(stateToLocationSelection(resolvedCountry, resolvedState, cityName));
      return;
    }
    onSelect(countryToLocationSelection(resolvedCountry, { state, city: cityName }));
  };

  const showSearchDropdown =
    searchOpen && searchFocused && location.trim().length >= 2;

  return (
    <>
      <div className="sm:col-span-2 relative" ref={wrapperRef}>
        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
          Location
        </label>
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            type="text"
            value={location}
            disabled={disabled}
            placeholder={locationPlaceholder}
            aria-label="Location search"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={showSearchDropdown}
            aria-controls={listboxId}
            onChange={(e) => {
              onLocationChange(e.target.value);
              if (e.target.value.trim().length >= 2) setSearchOpen(true);
            }}
            onFocus={() => {
              setSearchFocused(true);
              if (location.trim().length >= 2) setSearchOpen(true);
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
                setActiveIndex((idx) =>
                  idx <= 0 ? searchHits.length - 1 : idx - 1,
                );
              } else if (event.key === 'Enter' && searchHits[activeIndex]) {
                event.preventDefault();
                commitSearchHit(searchHits[activeIndex]);
              } else if (event.key === 'Escape') {
                setSearchOpen(false);
              }
            }}
            className={SEARCH_INPUT_CLASS}
            autoComplete="off"
          />
          {searchLoading && (
            <Loader2
              size={16}
              className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400"
              aria-hidden
            />
          )}
        </div>

        {showSearchDropdown && (
          <ul
            id={listboxId}
            role="listbox"
            className="absolute z-30 mt-1 w-full max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl"
          >
            {!searchLoading && searchHits.length === 0 && (
              <li className="px-4 py-3 text-xs text-slate-500">No cities found.</li>
            )}
            {searchHits.map((hit, index) => {
              const active = index === activeIndex;
              return (
                <li key={`${hit.city.countryCode}-${hit.city.stateCode}-${hit.city.name}-${index}`} role="option" aria-selected={active}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      commitSearchHit(hit);
                    }}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={`w-full text-left px-3 py-2.5 flex items-start gap-2 text-sm hover:bg-slate-50 ${
                      active ? 'bg-blue-50/60' : ''
                    }`}
                  >
                    <MapPin size={15} className="mt-0.5 shrink-0 text-blue-500" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block text-slate-900 leading-snug">{hit.displayName}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {showDetectedHint && (state || typeof latitude === 'number') && (
          <p className="mt-1 text-[11px] text-slate-500">
            <span className="font-semibold text-emerald-600">Detected</span>{' '}
            {[
              state,
              typeof latitude === 'number' && typeof longitude === 'number'
                ? `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
                : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
      </div>

      <div>
        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
          City
        </label>
        {cityOptions.length > 0 ? (
          <select
            value={city}
            disabled={disabled || !activeCountryCode}
            onChange={(e) => handleCityChange(e.target.value)}
            className={INPUT_CLASS}
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
            className={INPUT_CLASS}
            placeholder="e.g. San Francisco"
          />
        )}
      </div>

      <div>
        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
          State
        </label>
        {stateOptions.length > 0 ? (
          <select
            value={resolvedState?.isoCode ?? ''}
            disabled={disabled || !activeCountryCode}
            onChange={(e) => handleStateChange(e.target.value)}
            className={INPUT_CLASS}
          >
            <option value="">Select state / region…</option>
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
              if (!resolvedCountry) return;
              onSelect(
                countryToLocationSelection(resolvedCountry, {
                  state: e.target.value,
                  city,
                }),
              );
            }}
            className={INPUT_CLASS}
            placeholder="e.g. California"
          />
        )}
      </div>

      <div>
        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
          Country
        </label>
        <select
          value={activeCountryCode}
          disabled={disabled}
          onChange={(e) => handleCountryChange(e.target.value)}
          className={INPUT_CLASS}
        >
          <option value="">Select country…</option>
          {countries.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}
