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
  /**
   * `centered` — floating modal over the page.
   * `main` — fills the workspace to the right of the sidenav (below the top header).
   */
  variant?: 'centered' | 'main';
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
  variant = 'centered',
}: DetailsModalShellProps) {
  const maxWidth = SIZE_MAX_WIDTH[size];

  if (variant === 'main') {
    const mainInset = {
      top: 'calc(var(--ph2-header-h, 3.5rem) + var(--ph2-impersonation-banner-h, 0px))',
      left: 'var(--ph2-sidenav-w, 220px)',
      right: 0,
      bottom: 0,
    } as const;

    return (
      <>
        <motion.div
          key="details-main-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onBackdropClick}
          className={`fixed z-[35] bg-slate-900/25 md:bg-transparent pointer-events-auto ${backdropClassName}`.trim()}
          style={mainInset}
          data-drawer-skip-dirty="true"
        />
        <motion.div
          key="details-main-panel"
          ref={panelRef as React.Ref<HTMLDivElement>}
          initial={{ opacity: 0, x: 28 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 28 }}
          transition={{ type: 'spring', damping: 30, stiffness: 340 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby={dialogTitleId}
          onClick={(e) => e.stopPropagation()}
          className={`pointer-events-auto fixed z-[36] flex min-h-0 flex-col overflow-hidden border-l border-indigo-100/70 bg-white shadow-[-18px_0_40px_-24px_rgba(15,23,42,0.28)] ${panelClassName}`.trim()}
          style={mainInset}
        >
          {children}
        </motion.div>
      </>
    );
  }

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
        className={`pointer-events-none fixed inset-0 ${zIndexClass} flex items-center justify-center p-2 sm:p-6`}
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
          className={`pointer-events-auto relative flex h-[min(100dvh-16px,920px)] w-full ${maxWidth} flex-col overflow-hidden rounded-2xl border border-indigo-100/70 bg-white shadow-[0_24px_64px_-20px_rgba(79,70,229,0.35)] ring-1 ring-indigo-500/10 sm:h-[min(92vh,920px)] sm:rounded-[1.35rem] ${panelClassName}`.trim()}
        >
          {children}
        </motion.div>
      </div>
    </>
  );
}
