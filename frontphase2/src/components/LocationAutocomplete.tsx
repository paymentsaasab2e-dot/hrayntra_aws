'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Loader2, MapPin, Search } from 'lucide-react';
import { useLocationSearch } from '../hooks/useLocationSearch';
import type { NominatimSuggestion } from '../lib/nominatim';

/** Subset of fields autofilled when the user picks a suggestion. */
export interface LocationSelection {
  /** The full display name from Nominatim — populates the Location field. */
  location: string;
  city: string;
  state: string;
  country: string;
  latitude: number;
  longitude: number;
  countryCode?: string;
}

export interface LocationAutocompleteProps {
  /** Current location value (controlled). */
  value: string;
  /** Free-text changes (typing) — never includes the autofilled metadata. */
  onChange: (next: string) => void;
  /**
   * Fired when the user picks a suggestion. Use this to autofill city, state,
   * country, latitude, longitude on the parent form.
   */
  onSelect: (selection: LocationSelection) => void;
  /** Disable the input. */
  disabled?: boolean;
  /** Placeholder text. */
  placeholder?: string;
  /** Optional class on the wrapper. */
  className?: string;
  /** Optional class on the `<input>` — defaults to the existing form styling. */
  inputClassName?: string;
  /** Hide the magnifier icon (e.g. inside dense layouts). */
  hideIcon?: boolean;
  /** Accessible label for screen readers. */
  ariaLabel?: string;
  /** Optional `name` on the input. */
  name?: string;
  /** Debounce delay; default 500ms. */
  debounceMs?: number;
  /** Minimum characters before searching; default 2. */
  minQueryLength?: number;
}

const DEFAULT_INPUT_CLASS =
  'w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 ' +
  'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';

/**
 * Smart, free-tier location input powered by OpenStreetMap / Nominatim.
 *
 * Usage:
 *   <LocationAutocomplete
 *     value={form.location}
 *     onChange={(v) => setForm((p) => ({ ...p, location: v }))}
 *     onSelect={(s) => setForm((p) => ({
 *       ...p,
 *       location: s.location,
 *       city: s.city,
 *       country: s.country,
 *       state: s.state,
 *       latitude: s.latitude,
 *       longitude: s.longitude,
 *     }))}
 *   />
 *
 * Behaviour:
 *  - Suggestions are fetched lazily after a 500ms debounce.
 *  - Previous in-flight requests are aborted when the query changes.
 *  - Keyboard support: ArrowDown / ArrowUp / Enter / Escape.
 *  - Click-away closes the dropdown.
 *  - The user can still type freely and ignore the suggestions.
 */
export function LocationAutocomplete({
  value,
  onChange,
  onSelect,
  disabled,
  placeholder = 'Start typing a city or address…',
  className = '',
  inputClassName = DEFAULT_INPUT_CLASS,
  hideIcon,
  ariaLabel = 'Location',
  name,
  debounceMs = 500,
  minQueryLength = 2,
}: LocationAutocompleteProps) {
  // We only search when the input is focused; this keeps the dropdown closed
  // when the field is hydrated with an existing value from the backend.
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [open, setOpen] = useState(false);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  const { suggestions, loading, error, hasSearched } = useLocationSearch(
    focused ? value : '',
    { debounceMs, minQueryLength },
  );

  // Re-open the dropdown whenever new suggestions arrive while focused.
  useEffect(() => {
    if (focused && value.trim().length >= minQueryLength) setOpen(true);
  }, [focused, suggestions, value, minQueryLength]);

  // Reset highlight when the list changes.
  useEffect(() => {
    setActiveIndex(-1);
  }, [suggestions]);

  // Close on outside click.
  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const commitSelection = useCallback(
    (suggestion: NominatimSuggestion) => {
      onSelect({
        location: suggestion.displayName,
        city: suggestion.city,
        state: suggestion.state,
        country: suggestion.country,
        latitude: suggestion.latitude,
        longitude: suggestion.longitude,
        countryCode: suggestion.countryCode,
      });
      setOpen(false);
      // Move focus back to the input so the user can continue editing.
      requestAnimationFrame(() => inputRef.current?.blur());
    },
    [onSelect],
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) {
      if (event.key === 'ArrowDown' && suggestions.length > 0) {
        setOpen(true);
        setActiveIndex(0);
        event.preventDefault();
      }
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((idx) => (idx + 1) % Math.max(suggestions.length, 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((idx) => (idx <= 0 ? suggestions.length - 1 : idx - 1));
    } else if (event.key === 'Enter') {
      const target = suggestions[activeIndex];
      if (target) {
        event.preventDefault();
        commitSelection(target);
      }
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  const trimmed = value.trim();
  const showEmpty =
    open && !loading && hasSearched && suggestions.length === 0 && trimmed.length >= minQueryLength;
  const showError = open && !loading && Boolean(error);

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <div className="relative">
        {!hideIcon && (
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
        )}
        <input
          ref={inputRef}
          type="text"
          name={name}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          aria-label={ariaLabel}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={
            activeIndex >= 0 && suggestions[activeIndex] ? `${listboxId}-${suggestions[activeIndex].id}` : undefined
          }
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => {
            setFocused(true);
            if (trimmed.length >= minQueryLength) setOpen(true);
          }}
          onBlur={() => {
            // Slight delay so onMouseDown on options can fire before close.
            window.setTimeout(() => setFocused(false), 100);
          }}
          onKeyDown={handleKeyDown}
          className={`${inputClassName} ${hideIcon ? '' : 'pl-9'}`}
          autoComplete="off"
        />
        {loading && (
          <Loader2
            size={16}
            className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400"
            aria-hidden
          />
        )}
      </div>

      {open && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-30 mt-1 w-full max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl"
        >
          {loading && !hasSearched && (
            <li className="px-4 py-3 text-xs text-slate-500 flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" />
              Searching locations…
            </li>
          )}
          {!loading && showError && (
            <li className="px-4 py-3 text-xs text-rose-600">
              {error || 'Unable to load locations right now.'}
            </li>
          )}
          {!loading && showEmpty && (
            <li className="px-4 py-3 text-xs text-slate-500">No locations found.</li>
          )}
          {suggestions.map((suggestion, index) => {
            const active = index === activeIndex;
            const secondary = [suggestion.city, suggestion.state, suggestion.country].filter(Boolean).join(', ');
            return (
              <li
                key={suggestion.id}
                id={`${listboxId}-${suggestion.id}`}
                role="option"
                aria-selected={active}
              >
                <button
                  type="button"
                  // onMouseDown so it fires BEFORE the input's blur closes the list.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    commitSelection(suggestion);
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`w-full text-left px-3 py-2.5 flex items-start gap-2 text-sm hover:bg-slate-50 ${
                    active ? 'bg-blue-50/60' : ''
                  }`}
                >
                  <MapPin size={15} className="mt-0.5 shrink-0 text-blue-500" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block text-slate-900 leading-snug">
                      {suggestion.displayName}
                    </span>
                    {secondary && (
                      <span className="block text-[11px] text-slate-500 leading-snug truncate">
                        {secondary}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
