'use client';

import React from 'react';
import { motion } from 'motion/react';

export type DetailsModalSize = 'sm' | 'md' | 'lg';

const SIZE_MAX_WIDTH: Record<DetailsModalSize, string> = {
  sm: 'max-w-xl',
  md: 'max-w-4xl',
  lg: 'max-w-6xl',
};

type DetailsModalShellProps = {
  children: React.ReactNode;
  panelRef?: React.RefObject<HTMLDivElement | null> | React.RefCallback<HTMLDivElement>;
  onBackdropClick?: () => void;
  size?: DetailsModalSize;
  /** Tailwind z-index class applied to backdrop + centering layer (e.g. z-50, z-[100]). */
  zIndexClass?: string;
  panelClassName?: string;
  backdropClassName?: string;
  dialogTitleId?: string;
};

/**
 * Centered popup shell matching Lead / Client detail drawers.
 * Use instead of right-side slide-out panels for entity detail UIs.
 */
export function DetailsModalShell({
  children,
  panelRef,
  onBackdropClick,
  size = 'lg',
  zIndexClass = 'z-50',
  panelClassName = '',
  backdropClassName = '',
  dialogTitleId,
}: DetailsModalShellProps) {
  const maxWidth = SIZE_MAX_WIDTH[size];

  return (
    <>
      <motion.div
        key="details-modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onBackdropClick}
        className={`fixed inset-0 ${zIndexClass} bg-slate-900/50 backdrop-blur-[3px] pointer-events-auto ${backdropClassName}`.trim()}
        data-drawer-skip-dirty="true"
      />
      <div
        className={`pointer-events-none fixed inset-0 ${zIndexClass} flex items-center justify-center p-3 sm:p-6`}
      >
        <motion.div
          key="details-modal-panel"
          ref={panelRef as React.Ref<HTMLDivElement>}
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby={dialogTitleId}
          onClick={(e) => e.stopPropagation()}
          className={`pointer-events-auto relative flex h-[min(92vh,920px)] w-full ${maxWidth} flex-col overflow-hidden rounded-[1.35rem] border border-indigo-100/70 bg-white shadow-[0_24px_64px_-20px_rgba(79,70,229,0.35)] ring-1 ring-indigo-500/10 ${panelClassName}`.trim()}
        >
          {children}
        </motion.div>
      </div>
    </>
  );
}
