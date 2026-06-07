'use client';

import React from 'react';
import { ArrowUp, Sparkles, X } from 'lucide-react';
import type { SmartSearchExample, SmartSearchKeywordChip } from '../../lib/smart-search/types';
import { keywordChipClass } from '../../lib/smart-search/core';

type SmartSearchToolbarProps = {
  open: boolean;
  onToggle: () => void;
  prompt: string;
  onPromptChange: (value: string) => void;
  onApply: () => void;
  previewKeywords: SmartSearchKeywordChip[];
  examples: readonly SmartSearchExample[];
  onExampleClick: (query: string) => void;
  entityLabel?: string;
  applying?: boolean;
};

export function SmartSearchToggleButton({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-all active:scale-[0.98] ${
        open
          ? 'border-violet-300 bg-violet-50 text-violet-800 shadow-sm'
          : 'border-indigo-100/90 bg-white/95 text-indigo-900 shadow-sm hover:border-violet-200 hover:bg-violet-50/60'
      }`}
      title="Search with a natural-language prompt"
    >
      <Sparkles size={14} className={open ? 'text-violet-600' : 'text-indigo-600'} strokeWidth={2.25} />
      Smart Search
    </button>
  );
}

export function SmartSearchPromptPanel({
  prompt,
  onPromptChange,
  onApply,
  previewKeywords,
  examples,
  onExampleClick,
  entityLabel = 'records',
  placeholder,
  applying = false,
}: Omit<SmartSearchToolbarProps, 'open' | 'onToggle'> & { placeholder?: string }) {
  return (
    <div className="space-y-2 border-b border-indigo-100/50 bg-gradient-to-r from-violet-50/50 via-white to-indigo-50/30 px-3 py-2.5 sm:px-4">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <label htmlFor="smart-search-prompt" className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-violet-700/80">
            Search prompt
          </label>
          <textarea
            id="smart-search-prompt"
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onApply();
              }
            }}
            rows={2}
            placeholder={
              placeholder ||
              `Describe the ${entityLabel} you want — status, client, recruiter, location…`
            }
            className="min-h-[52px] w-full resize-none rounded-xl border border-violet-200/90 bg-white px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/25"
          />
        </div>
        <button
          type="button"
          onClick={onApply}
          disabled={applying}
          className="mt-5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60"
          aria-label="Apply smart search prompt"
          title={applying ? 'Parsing with AI…' : 'Apply prompt (Enter)'}
        >
          <ArrowUp size={16} strokeWidth={2.25} className={applying ? 'animate-pulse' : undefined} />
        </button>
      </div>

      <div className="rounded-lg border border-violet-100/80 bg-white/80 px-2.5 py-2">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Keywords found</p>
        {prompt.trim() ? (
          previewKeywords.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {previewKeywords.map((keyword) => (
                <span
                  key={keyword.id}
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${keywordChipClass(keyword.kind)}`}
                >
                  {keyword.label}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-600">No keywords detected — matching full prompt text.</p>
          )
        ) : (
          <p className="text-xs text-slate-500">Type a prompt — keywords appear here, then press Enter.</p>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {examples.map((example) => (
          <button
            key={example.label}
            type="button"
            onClick={() => onExampleClick(example.query)}
            className="rounded-full border border-violet-200/90 bg-white px-2.5 py-1 text-[11px] font-medium text-violet-800 transition-colors hover:border-violet-300 hover:bg-violet-50"
          >
            {example.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SmartSearchActiveKeywordsBar({
  chips,
  onClearAll,
  resultCount,
  showResultCount = true,
}: {
  chips: Array<{ id: string; label: string; kind: SmartSearchKeywordChip['kind']; onRemove: () => void }>;
  onClearAll: () => void;
  resultCount?: number;
  showResultCount?: boolean;
}) {
  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-indigo-100/40 bg-slate-50/60 px-3 py-2 sm:px-4">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Active keywords</span>
      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          onClick={chip.onRemove}
          className={`inline-flex items-center gap-1 rounded-full border pl-2.5 pr-1.5 py-0.5 text-[11px] font-medium shadow-sm transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-800 ${keywordChipClass(chip.kind)}`}
          title={`Remove ${chip.label}`}
        >
          <span className="max-w-[200px] truncate">{chip.label}</span>
          <X size={12} strokeWidth={2.5} className="shrink-0 opacity-60" />
        </button>
      ))}
      <button type="button" onClick={onClearAll} className="text-[11px] font-semibold text-rose-600 hover:text-rose-700">
        Clear all
      </button>
      {showResultCount && resultCount !== undefined ? (
        <span className="ml-auto text-[11px] font-medium text-slate-500">
          {resultCount} on this page
        </span>
      ) : null}
    </div>
  );
}
