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
      className={`inline-flex h-8 w-8 sm:h-9 sm:w-auto shrink-0 items-center justify-center gap-1.5 rounded-full px-0 sm:px-3.5 text-xs font-semibold transition-all active:scale-[0.98] ${
        open
          ? 'hry-btn-primary text-white'
          : 'hry-btn-glass text-slate-700'
      }`}
      title={open ? 'Hide summary cards' : 'Show summary cards'}
    >
      <LayoutGrid size={16} className={open ? 'text-white' : 'text-indigo-600'} strokeWidth={2.25} />
      <span className="hidden sm:inline">{open ? 'Hide cards' : 'Show cards'}</span>
    </button>
  );
}
