'use client';

import React from 'react';
import { LayoutGrid } from 'lucide-react';

type ShowSummaryCardsButtonProps = {
  open: boolean;
  onToggle: () => void;
};

/** Header control: summary cards stay hidden until the user opens them. */
export function ShowSummaryCardsButton({ open, onToggle }: ShowSummaryCardsButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={open}
      onClick={onToggle}
      className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition-all active:scale-[0.98] ${
        open
          ? 'border border-indigo-300 bg-indigo-600 text-white shadow-[0_8px_20px_-8px_rgba(79,70,229,0.55)] hover:bg-indigo-700'
          : 'border border-white/80 bg-white/95 text-slate-700 shadow-[0_8px_20px_-12px_rgba(15,23,42,0.28)] hover:border-indigo-200 hover:bg-white hover:text-indigo-800 hover:shadow-[0_10px_24px_-10px_rgba(99,102,241,0.35)]'
      }`}
      title={open ? 'Hide summary cards' : 'Show summary cards'}
    >
      <LayoutGrid size={16} className={open ? 'text-white' : 'text-indigo-600'} strokeWidth={2.25} />
      <span>{open ? 'Hide cards' : 'Show cards'}</span>
    </button>
  );
}
