'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';

export type SuggestSource = 'history' | 'catalog' | 'ai';

export interface SuggestItem {
  label: string;
  source: SuggestSource;
}

const SOURCE_HINT: Record<SuggestSource, string> = {
  history: 'Used before',
  catalog: 'Common',
  ai: 'AI suggestion',
};

export interface SuggestTypeaheadProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  fetchSuggestions: (query: string) => Promise<{ suggestions: SuggestItem[]; aiEnabled?: boolean }>;
  emptyHint?: string;
  typeHint?: string;
}

export function SuggestTypeahead({
  value,
  onChange,
  disabled = false,
  placeholder = 'Type to search…',
  className = '',
  inputClassName = '',
  fetchSuggestions,
  emptyHint = 'Type to search',
  typeHint = 'Suggestions',
}: SuggestTypeaheadProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<SuggestItem[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  const loadSuggestions = useCallback(
    async (q: string) => {
      const reqId = ++requestIdRef.current;
      setLoadingSuggestions(true);
      try {
        const res = await fetchSuggestions(q.trim());
        if (reqId !== requestIdRef.current) return;
        setSuggestions(res.suggestions ?? []);
        setAiEnabled(Boolean(res.aiEnabled));
      } catch {
        if (reqId !== requestIdRef.current) return;
        setSuggestions([]);
      } finally {
        if (reqId === requestIdRef.current) setLoadingSuggestions(false);
      }
    },
    [fetchSuggestions],
  );

  useEffect(() => {
    if (!open || disabled) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void loadSuggestions(query);
    }, 320);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open, disabled, loadSuggestions]);

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
  const showAddCustom = trimmedQuery.length > 0 && !exactMatch;

  const pick = (label: string) => {
    if (disabled) return;
    const next = label.trim();
    onChange(next);
    setQuery(next);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (trimmedQuery) {
        if (suggestionLabels.length > 0) pick(suggestionLabels[0]);
        else pick(trimmedQuery);
      }
    }
  };

  const showDropdown = open && !disabled;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <input
        type="text"
        disabled={disabled}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={inputClassName}
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={showDropdown}
      />

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
                  {trimmedQuery ? `${typeHint} for “${trimmedQuery}”` : typeHint}
                  {!loadingSuggestions && aiEnabled ? '' : ''}
                </>
              )}
            </p>
          </div>
          <ul className="max-h-48 overflow-y-auto py-1" role="listbox">
            {!loadingSuggestions && suggestions.length === 0 && !showAddCustom && (
              <li className="px-4 py-2.5 text-sm text-slate-500">{emptyHint}</li>
            )}
            {suggestions.map((item) => (
              <li key={`${item.source}-${item.label}`}>
                <button
                  type="button"
                  role="option"
                  className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(item.label)}
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
                  onClick={() => pick(trimmedQuery)}
                >
                  {`Use “${trimmedQuery}”`}
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
