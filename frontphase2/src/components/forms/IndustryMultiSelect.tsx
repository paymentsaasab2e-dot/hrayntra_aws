'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Sparkles, X } from 'lucide-react';
import { apiSuggestIndustries, type IndustrySuggestion } from '../../lib/api';
import { parseIndustries, serializeIndustries } from '../../lib/industryOptions';

export interface IndustryMultiSelectProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  id?: string;
  companyName?: string;
}

const SOURCE_HINT: Record<IndustrySuggestion['source'], string> = {
  history: 'Used before',
  catalog: 'Common',
  ai: 'AI suggestion',
};

/**
 * Type-to-search industry multiselect backed by `/industries/suggest`.
 * Uses local history + catalog first; AI only when matches are sparse (low token use).
 */
export function IndustryMultiSelect({
  value,
  onChange,
  disabled = false,
  placeholder = 'Type an industry (e.g. technology, healthcare)',
  className = '',
  id,
  companyName = '',
}: IndustryMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<IndustrySuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  const selected = useMemo(() => parseIndustries(value), [value]);

  const fetchSuggestions = useCallback(
    async (q: string) => {
      const reqId = ++requestIdRef.current;
      setLoadingSuggestions(true);
      try {
        const res = await apiSuggestIndustries({
          q,
          selected,
          limit: 8,
          companyName: companyName?.trim() || undefined,
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
    [selected, companyName],
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

  const addIndustry = (label: string, clearQuery = true) => {
    if (disabled) return;
    const trimmed = label.trim();
    if (!trimmed) return;
    if (selected.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      if (clearQuery) setQuery('');
      return;
    }
    onChange(serializeIndustries([...selected, trimmed]));
    if (clearQuery) setQuery('');
    setOpen(true);
    inputRef.current?.focus();
  };

  const removeIndustry = (label: string) => {
    if (disabled) return;
    const next = selected.filter((s) => s.toLowerCase() !== label.toLowerCase());
    onChange(serializeIndustries(next));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (trimmedQuery) {
        if (suggestionLabels.length > 0) addIndustry(suggestionLabels[0]);
        else addIndustry(trimmedQuery);
      }
      return;
    }
    if (e.key === 'Backspace' && !query && selected.length > 0) {
      removeIndustry(selected[selected.length - 1]);
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
        {selected.map((industry) => (
          <span
            key={industry}
            className="inline-flex max-w-full items-center gap-1 rounded-md border border-violet-100 bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-800"
          >
            <span className="truncate">{industry}</span>
            {!disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeIndustry(industry);
                }}
                className="shrink-0 rounded p-0.5 text-violet-600 hover:bg-violet-100"
                aria-label={`Remove ${industry}`}
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
          placeholder={selected.length ? 'Add another industry…' : placeholder}
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
                    ? `Industries for “${trimmedQuery}”`
                    : aiEnabled
                      ? 'Suggested industries'
                      : 'Suggested industries'}
                </>
              )}
            </p>
          </div>
          <ul className="max-h-52 overflow-y-auto py-1" role="listbox">
            {!loadingSuggestions && suggestions.length === 0 && !showAddCustom && (
              <li className="px-4 py-2.5 text-sm text-slate-500">
                {trimmedQuery
                  ? 'No matches — press Enter to add as custom industry'
                  : 'Type to search (e.g. tech, healthcare, finance)'}
              </li>
            )}
            {suggestions.map((item) => (
              <li key={`${item.source}-${item.label}`}>
                <button
                  type="button"
                  role="option"
                  className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => addIndustry(item.label)}
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
                  className="w-full px-4 py-2.5 text-left text-sm font-medium text-violet-700 hover:bg-violet-50"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => addIndustry(trimmedQuery)}
                >
                  {`Add “${trimmedQuery}” as industry`}
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
      <span className="font-semibold text-violet-700">{label.slice(idx, idx + q.length)}</span>
      {label.slice(idx + q.length)}
    </>
  );
}
