'use client';

import React from 'react';
import { X } from 'lucide-react';

export type DrawerCloseButtonProps = {
  onClick: () => void;
  className?: string;
  iconSize?: number;
  disabled?: boolean;
  'aria-label'?: string;
  title?: string;
};

const BASE_CLASS =
  'p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors shrink-0';

/** Standard X control for right-side drawer headers. */
export function DrawerCloseButton({
  onClick,
  className = '',
  iconSize = 20,
  disabled,
  'aria-label': ariaLabel = 'Close',
  title = 'Close',
}: DrawerCloseButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${BASE_CLASS} ${className}`.trim()}
      aria-label={ariaLabel}
      title={title}
    >
      <X size={iconSize} />
    </button>
  );
}
