'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Sparkles, X } from 'lucide-react';
import {
  apiAppendCompanyService,
  apiSuggestCompanyServices,
  type CompanyServiceSuggestion,
} from '../../lib/api';
import { parseServicesNeeded, serializeServicesNeeded } from '../../lib/companyServices';

export interface ServicesNeededSelectProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  id?: string;
  /** Optional industry hint for AI suggestions (e.g. from lead/client form). */
  industry?: string;
}

const SOURCE_HINT: Record<CompanyServiceSuggestion['source'], string> = {
  history: 'Used before',
  catalog: 'Catalog',
  ai: 'AI suggestion',
};

/**
 * Type-to-search services field backed by `/company-services/suggest`.
 * Uses server OPENAI_API_KEY (or Mistral fallback) for open-ended queries — no huge static list in the browser.
 */
export function ServicesNeededSelect({
  value,
  onChange,
  disabled = false,
  placeholder = 'Type a service (e.g. software, placement, executive)',
  className = '',
  id,
  industry = '',
}: ServicesNeededSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<CompanyServiceSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [savingCustom, setSavingCustom] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  const selected = useMemo(() => parseServicesNeeded(value), [value]);

  const fetchSuggestions = useCallback(
    async (q: string) => {
      const reqId = ++requestIdRef.current;
      setLoadingSuggestions(true);
      try {
        const res = await apiSuggestCompanyServices({
          q,
          selected,
          limit: 10,
          industry: industry?.trim() || undefined,
        });
        if (reqId !== requestIdRef.current) return;
        setSuggestions(res.data?.suggestions ?? []);
        setAiEnabled(Boolean(res.data?.aiEnabled));
      } catch {
        if (reqId !== requestIdRef.current) return;
        setSuggestions([]);
      } finally {
        if (reqId === requestIdRef.current) setLoadingSuggestions(false);
      }
    },
    [selected, industry],
  );

  useEffect(() => {
    if (!open || disabled) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void fetchSuggestions(query.trim());
    }, 320);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open, disabled, fetchSuggestions]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', escHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', escHandler);
    };
  }, []);

  const trimmedQuery = query.trim();
  const suggestionLabels = suggestions.map((s) => s.label);
  const exactMatch = trimmedQuery
    ? suggestionLabels.some((s) => s.toLowerCase() === trimmedQuery.toLowerCase())
    : false;
  const alreadySelected = trimmedQuery
    ? selected.some((s) => s.toLowerCase() === trimmedQuery.toLowerCase())
    : false;
  const showAddCustom = trimmedQuery.length > 0 && !exactMatch && !alreadySelected;

  const addService = (label: string, clearQuery = true) => {
    if (disabled) return;
    const trimmed = label.trim();
    if (!trimmed) return;
    if (selected.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      if (clearQuery) setQuery('');
      return;
    }
    onChange(serializeServicesNeeded([...selected, trimmed]));
    if (clearQuery) setQuery('');
    setOpen(true);
    inputRef.current?.focus();
  };

  const removeService = (label: string) => {
    if (disabled) return;
    const next = selected.filter((s) => s.toLowerCase() !== label.toLowerCase());
    onChange(serializeServicesNeeded(next));
  };

  const addCustomService = async (label: string) => {
    const trimmed = label.trim();
    if (!trimmed || disabled || savingCustom) return;
    setSavingCustom(true);
    try {
      await apiAppendCompanyService(trimmed);
    } catch {
      /* still add to selection */
    } finally {
      setSavingCustom(false);
    }
    addService(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (trimmedQuery) {
        if (suggestionLabels.length > 0) addService(suggestionLabels[0]);
        else void addCustomService(trimmedQuery);
      }
      return;
    }
    if (e.key === 'Backspace' && !query && selected.length > 0) {
      removeService(selected[selected.length - 1]);
    }
  };

  const showDropdown = open && !disabled;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div
        className={`flex min-h-[42px] w-full flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 transition-colors focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 ${
          disabled ? 'cursor-not-allowed opacity-60' : ''
        }`}
        onClick={() => {
          if (!disabled) {
            setOpen(true);
            inputRef.current?.focus();
          }
        }}
      >
        {selected.map((service) => (
          <span
            key={service}
            className="inline-flex max-w-full items-center gap-1 rounded-md border border-blue-100 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-800"
          >
            <span className="truncate">{service}</span>
            {!disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeService(service);
                }}
                className="shrink-0 rounded p-0.5 text-blue-600 hover:bg-blue-100"
                aria-label={`Remove ${service}`}
              >
                <X size={11} />
              </button>
            )}
          </span>
        ))}
        <input
          ref={inputRef}
          id={id}
          type="text"
          disabled={disabled}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={selected.length ? 'Add another service…' : placeholder}
          className="min-w-[8rem] flex-1 border-0 bg-transparent py-0.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={showDropdown}
        />
      </div>

      {showDropdown && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 px-3 py-2">
            <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {loadingSuggestions ? (
                <>
                  <Loader2 size={11} className="animate-spin text-blue-500" />
                  Searching…
                </>
              ) : (
                <>
                  <Sparkles size={11} className="text-amber-500" />
                  {trimmedQuery
                    ? `Recommendations for “${trimmedQuery}”`
                    : aiEnabled
                      ? 'Recommended (AI-assisted)'
                      : 'Recommended'}
                </>
              )}
            </p>
          </div>
          <ul className="max-h-52 overflow-y-auto py-1" role="listbox">
            {!loadingSuggestions && suggestions.length === 0 && !showAddCustom && (
              <li className="px-4 py-2.5 text-sm text-slate-500">
                {trimmedQuery
                  ? aiEnabled
                    ? 'No matches — press Enter to add as custom service'
                    : 'No matches — add OPENAI_API_KEY on server for AI suggestions, or press Enter to add custom'
                  : 'Type to search (e.g. software, healthcare, executive)'}
              </li>
            )}
            {suggestions.map((item) => (
              <li key={`${item.source}-${item.label}`}>
                <button
                  type="button"
                  role="option"
                  className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => addService(item.label)}
                >
                  <span>{highlightMatch(item.label, trimmedQuery)}</span>
                  <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                    {SOURCE_HINT[item.source]}
                  </span>
                </button>
              </li>
            ))}
            {showAddCustom && (
              <li>
                <button
                  type="button"
                  className="w-full px-4 py-2.5 text-left text-sm font-medium text-blue-700 hover:bg-blue-50"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => void addCustomService(trimmedQuery)}
                  disabled={savingCustom}
                >
                  {savingCustom ? 'Adding…' : `Add “${trimmedQuery}” as service`}
                </button>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function highlightMatch(label: string, query: string) {
  if (!query.trim()) return label;
  const q = query.trim();
  const idx = label.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return label;
  return (
    <>
      {label.slice(0, idx)}
      <span className="font-semibold text-blue-700">{label.slice(idx, idx + q.length)}</span>
      {label.slice(idx + q.length)}
    </>
  );
}
