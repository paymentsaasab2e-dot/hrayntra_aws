'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, MapPin, X } from 'lucide-react';
import { useLocationSearch } from '../../hooks/useLocationSearch';

export interface LocationMultiSelectProps {
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

function normalizeList(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const label = String(raw || '').trim().replace(/\s+/g, ' ');
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
  }
  return out;
}

/** Chip multi-select for locations with Nominatim typeahead. */
export function LocationMultiSelect({
  value,
  onChange,
  disabled = false,
  placeholder = 'Type a city or location…',
  className = '',
}: LocationMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(() => normalizeList(value), [value]);
  const { suggestions, loading, hasSearched } = useLocationSearch(open ? query : '', {
    debounceMs: 400,
    minQueryLength: 2,
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const addLocation = (label: string) => {
    if (disabled) return;
    const next = normalizeList([...selected, label]);
    onChange(next);
    setQuery('');
    setOpen(true);
    inputRef.current?.focus();
  };

  const removeLocation = (label: string) => {
    if (disabled) return;
    onChange(selected.filter((s) => s.toLowerCase() !== label.toLowerCase()));
  };

  const trimmed = query.trim();
  const alreadySelected = selected.some((s) => s.toLowerCase() === trimmed.toLowerCase());
  const showAddCustom =
    trimmed.length >= 2 &&
    !alreadySelected &&
    !suggestions.some((s) => s.displayName.toLowerCase() === trimmed.toLowerCase());

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div
        className={`flex min-h-[42px] w-full flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 transition-colors focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-500/20 ${
          disabled ? 'cursor-not-allowed opacity-60' : ''
        }`}
        onClick={() => {
          if (!disabled) {
            setOpen(true);
            inputRef.current?.focus();
          }
        }}
      >
        {selected.map((loc) => (
          <span
            key={loc}
            className="inline-flex max-w-full items-center gap-1 rounded-md border border-sky-100 bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-800"
          >
            <MapPin size={10} className="shrink-0" />
            <span className="truncate">{loc}</span>
            {!disabled ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeLocation(loc);
                }}
                className="shrink-0 rounded p-0.5 text-sky-600 hover:bg-sky-100"
                aria-label={`Remove ${loc}`}
              >
                <X size={11} />
              </button>
            ) : null}
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          disabled={disabled}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (suggestions[0]) addLocation(suggestions[0].displayName);
              else if (trimmed.length >= 2) addLocation(trimmed);
            }
            if (e.key === 'Backspace' && !query && selected.length > 0) {
              removeLocation(selected[selected.length - 1]);
            }
          }}
          placeholder={selected.length ? 'Add another location…' : placeholder}
          className="min-w-[8rem] flex-1 border-0 bg-transparent py-0.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0"
          autoComplete="off"
        />
      </div>

      {open && !disabled ? (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {loading ? (
              <span className="inline-flex items-center gap-1">
                <Loader2 size={11} className="animate-spin text-sky-500" />
                Searching…
              </span>
            ) : (
              'Location suggestions'
            )}
          </div>
          <ul className="max-h-52 overflow-y-auto py-1">
            {!loading && hasSearched && suggestions.length === 0 && !showAddCustom ? (
              <li className="px-4 py-2.5 text-sm text-slate-500">
                {trimmed.length < 2 ? 'Type at least 2 characters' : 'No matches — press Enter to add'}
              </li>
            ) : null}
            {suggestions.map((item) => (
              <li key={`${item.latitude}-${item.longitude}-${item.displayName}`}>
                <button
                  type="button"
                  className="flex w-full items-start gap-2 px-4 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => addLocation(item.displayName)}
                >
                  <MapPin size={14} className="mt-0.5 shrink-0 text-sky-500" />
                  <span>{item.displayName}</span>
                </button>
              </li>
            ))}
            {showAddCustom ? (
              <li>
                <button
                  type="button"
                  className="w-full px-4 py-2.5 text-left text-sm font-medium text-sky-700 hover:bg-sky-50"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => addLocation(trimmed)}
                >
                  {`Add “${trimmed}” as location`}
                </button>
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
