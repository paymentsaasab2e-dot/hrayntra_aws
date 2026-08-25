'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Loader2, MapPin, Search } from 'lucide-react';
import { useLocationSearch, type NominatimSuggestion } from '../hooks/useLocationSearch';
import { apiResolveLocation } from '../lib/location-api';

/** Subset of fields autofilled when the user picks a suggestion or blurs after typing. */
export interface LocationSelection {
  location: string;
  city: string;
  state: string;
  country: string;
  latitude: number;
  longitude: number;
  countryCode?: string;
}

export interface LocationAutocompleteProps {
  value: string;
  onChange: (next: string) => void;
  onSelect: (selection: LocationSelection) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  hideIcon?: boolean;
  ariaLabel?: string;
  name?: string;
  debounceMs?: number;
  minQueryLength?: number;
  /** When true (default), blur runs OpenAI → Mistral → Nominatim resolve if user did not pick a suggestion. */
  autoResolveOnBlur?: boolean;
}

const DEFAULT_INPUT_CLASS =
  'w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 ' +
  'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';

function toSelection(resolved: {
  location: string;
  city: string;
  state: string;
  country: string;
  latitude: number;
  longitude: number;
  countryCode?: string;
}): LocationSelection {
  return {
    location: resolved.location,
    city: resolved.city,
    state: resolved.state,
    country: resolved.country,
    latitude: resolved.latitude,
    longitude: resolved.longitude,
    countryCode: resolved.countryCode,
  };
}

/**
 * Location input: backend Nominatim suggestions + OpenAI/Mistral/Nominatim resolve on blur.
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
  autoResolveOnBlur = true,
}: LocationAutocompleteProps) {
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [open, setOpen] = useState(false);
  const [resolving, setResolving] = useState(false);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();
  const pickedFromListRef = useRef(false);
  const resolveGenerationRef = useRef(0);

  const { suggestions, loading, error, hasSearched } = useLocationSearch(
    focused ? value : '',
    { debounceMs, minQueryLength },
  );

  useEffect(() => {
    if (focused && value.trim().length >= minQueryLength) setOpen(true);
  }, [focused, suggestions, value, minQueryLength]);

  useEffect(() => {
    setActiveIndex(-1);
  }, [suggestions]);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const commitSelection = useCallback(
    (suggestion: NominatimSuggestion) => {
      pickedFromListRef.current = true;
      onChange(suggestion.displayName);
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
      requestAnimationFrame(() => inputRef.current?.blur());
    },
    [onChange, onSelect],
  );

  const runAutoResolve = useCallback(
    async (query: string) => {
      const trimmed = query.trim();
      if (trimmed.length < minQueryLength || pickedFromListRef.current) return;

      const generation = ++resolveGenerationRef.current;
      setResolving(true);
      try {
        const resolved = await apiResolveLocation(trimmed);
        if (generation !== resolveGenerationRef.current) return;
        if (pickedFromListRef.current) return;
        pickedFromListRef.current = true;
        onChange(trimmed);
        onSelect({
          ...toSelection(resolved),
          location: trimmed,
        });
      } catch {
        // User can still fill city/country manually.
      } finally {
        if (generation === resolveGenerationRef.current) {
          setResolving(false);
        }
      }
    },
    [minQueryLength, onChange, onSelect],
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
      } else if (autoResolveOnBlur && trimmed.length >= minQueryLength) {
        event.preventDefault();
        void runAutoResolve(trimmed);
      }
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  const trimmed = value.trim();
  const showEmpty =
    open && !loading && hasSearched && suggestions.length === 0 && trimmed.length >= minQueryLength;
  const showError = open && !loading && Boolean(error);
  const showSpinner = loading || resolving;

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
            activeIndex >= 0 && suggestions[activeIndex]
              ? `${listboxId}-${suggestions[activeIndex].id}`
              : undefined
          }
          onChange={(e) => {
            pickedFromListRef.current = false;
            onChange(e.target.value);
          }}
          onFocus={() => {
            setFocused(true);
            if (trimmed.length >= minQueryLength) setOpen(true);
          }}
          onBlur={() => {
            window.setTimeout(() => {
              setFocused(false);
              if (autoResolveOnBlur && !pickedFromListRef.current) {
                void runAutoResolve(value);
              }
            }, 120);
          }}
          onKeyDown={handleKeyDown}
          className={`${inputClassName} ${hideIcon ? '' : 'pl-9'}`}
          autoComplete="off"
        />
        {showSpinner && (
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
                    <span className="block text-slate-900 leading-snug">{suggestion.displayName}</span>
                    {secondary && (
                      <span className="block text-[11px] text-slate-500 leading-snug truncate">{secondary}</span>
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
