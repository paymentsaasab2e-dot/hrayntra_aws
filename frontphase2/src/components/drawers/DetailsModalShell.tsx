'use client';

import React from 'react';
import { motion, type Variants } from 'motion/react';

export type DetailsModalSize = 'sm' | 'md' | 'lg';

const SIZE_MAX_WIDTH: Record<DetailsModalSize, string> = {
  sm: 'max-w-xl',
  md: 'max-w-4xl',
  lg: 'max-w-6xl',
};

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/** Parent orchestrates nested exit so panel transform runs with backdrop fade. */
const shellVariants: Variants = {
  hidden: {
    transition: { when: 'afterChildren', duration: 0.01 },
  },
  visible: {
    transition: { when: 'beforeChildren', staggerChildren: 0 },
  },
};

const backdropVariants: Variants = {
  hidden: { opacity: 0, transition: { duration: 0.16, ease: EASE_OUT } },
  visible: { opacity: 1, transition: { duration: 0.16, ease: EASE_OUT } },
};

const mainPanelVariants: Variants = {
  hidden: { x: 22, transition: { duration: 0.18, ease: EASE_OUT } },
  visible: { x: 0, transition: { duration: 0.2, ease: EASE_OUT } },
};

const centeredPanelVariants: Variants = {
  hidden: { scale: 0.98, y: 10, transition: { duration: 0.16, ease: EASE_OUT } },
  visible: { scale: 1, y: 0, transition: { duration: 0.2, ease: EASE_OUT } },
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
 * Centered / main-workspace shell matching Lead / Client detail drawers.
 * Single motion root so AnimatePresence can run enter/exit without a remount flash.
 * Panel never fades opacity (only transforms) — opacity fades cause a white flash.
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
      <motion.div
        key={dialogTitleId || 'details-main-shell'}
        className="pointer-events-none fixed inset-0 z-[36]"
        variants={shellVariants}
        initial="hidden"
        animate="visible"
        exit="hidden"
        data-app-page-drawer="shell"
      >
        <motion.div
          variants={backdropVariants}
          onClick={onBackdropClick}
          className={`pointer-events-auto absolute bg-slate-900/25 md:bg-transparent ${backdropClassName}`.trim()}
          style={mainInset}
          data-drawer-skip-dirty="true"
        />
        <motion.div
          ref={panelRef as React.Ref<HTMLDivElement>}
          variants={mainPanelVariants}
          role="dialog"
          aria-modal="true"
          aria-labelledby={dialogTitleId}
          onClick={(e) => e.stopPropagation()}
          data-app-page-drawer="panel"
          className={`pointer-events-auto absolute flex min-h-0 flex-col overflow-hidden border-l border-indigo-100/70 bg-white shadow-[-18px_0_40px_-24px_rgba(15,23,42,0.28)] ${panelClassName}`.trim()}
          style={mainInset}
        >
          {children}
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div
      key={dialogTitleId || 'details-centered-shell'}
      className={`pointer-events-none fixed inset-0 ${zIndexClass} flex items-center justify-center p-2 sm:p-6`}
      variants={shellVariants}
      initial="hidden"
      animate="visible"
      exit="hidden"
      data-app-page-drawer="shell"
    >
      <motion.div
        variants={backdropVariants}
        onClick={onBackdropClick}
        className={`absolute inset-0 bg-slate-900/50 backdrop-blur-[3px] pointer-events-auto ${backdropClassName}`.trim()}
        data-drawer-skip-dirty="true"
      />
      <motion.div
        ref={panelRef as React.Ref<HTMLDivElement>}
        variants={centeredPanelVariants}
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogTitleId}
        onClick={(e) => e.stopPropagation()}
        data-app-page-drawer="panel"
        className={`pointer-events-auto relative flex h-[min(100dvh-16px,920px)] w-full ${maxWidth} flex-col overflow-hidden rounded-2xl border border-indigo-100/70 bg-white shadow-[0_24px_64px_-20px_rgba(79,70,229,0.35)] ring-1 ring-indigo-500/10 sm:h-[min(92vh,920px)] sm:rounded-[1.35rem] ${panelClassName}`.trim()}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
