'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence } from 'motion/react';
import {
  DetailsModalShell,
  type DetailsModalSize,
} from '../drawers/DetailsModalShell';
import { useLockedBodyScroll } from '../../hooks/useLockedBodyScroll';

type CenteredPopupProps = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Disable backdrop / Escape close while submitting. */
  closeDisabled?: boolean;
  size?: DetailsModalSize;
  /** Prefer `content` for small feedback / confirm dialogs. */
  fit?: 'viewport' | 'content';
  zIndexClass?: string;
  panelClassName?: string;
  dialogTitleId?: string;
};

/**
 * Flicker-safe centered popup host for new dialogs.
 * - Portals to document.body
 * - Single AnimatePresence child (DetailsModalShell)
 * - Flex-centered from first paint
 * - Panel transforms only (no opacity flash)
 * - Scroll lock with scrollbar-gap compensation
 */
export function CenteredPopup({
  open,
  onClose,
  children,
  closeDisabled = false,
  size = 'sm',
  fit = 'content',
  zIndexClass = 'z-[220]',
  panelClassName = '',
  dialogTitleId,
}: CenteredPopupProps) {
  useLockedBodyScroll(open);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !closeDisabled) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose, closeDisabled]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <DetailsModalShell
          size={size}
          fit={fit}
          zIndexClass={zIndexClass}
          panelClassName={panelClassName}
          dialogTitleId={dialogTitleId}
          onBackdropClick={() => {
            if (!closeDisabled) onClose();
          }}
        >
          {children}
        </DetailsModalShell>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
