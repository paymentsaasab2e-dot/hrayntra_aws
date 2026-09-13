'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { X, type LucideIcon } from 'lucide-react';
import {
  DRAWER_FORM_CONTENT_CLASS,
  DRAWER_FORM_FOOTER_CLASS,
  DRAWER_FORM_HEADER_CLASS,
  DRAWER_FORM_PANEL_CLASS,
} from './drawerFormUi';
import { useDrawerUnsavedGuard } from '../../hooks/useDrawerUnsavedGuard';

const DrawerFormRequestCloseContext = createContext<(() => Promise<boolean>) | null>(null);

/** Use inside DrawerFormShell footer/content for Cancel that respects unsaved guard. */
export function useDrawerFormRequestClose(): (() => Promise<boolean>) | null {
  return useContext(DrawerFormRequestCloseContext);
}

type DrawerFormCancelButtonProps = {
  children?: React.ReactNode;
  className?: string;
};

/** Footer Cancel that prompts only when the drawer form was edited. */
export function DrawerFormCancelButton({
  children = 'Cancel',
  className = 'rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50',
}: DrawerFormCancelButtonProps) {
  const requestClose = useDrawerFormRequestClose();
  return (
    <button
      type="button"
      onClick={() => void requestClose?.()}
      className={className}
      data-drawer-skip-dirty="true"
    >
      {children}
    </button>
  );
}

type DrawerFormShellProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  headerIcon?: LucideIcon;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Extra classes merged onto the centered modal panel (prefer max-w-* only). */
  panelClassName?: string;
  contentClassName?: string;
  backdropClassName?: string;
  zBackdrop?: number;
  zPanel?: number;
  /** Prompt before close when fields were edited. Default true. */
  guardUnsaved?: boolean;
  /** Optional explicit dirty state from parent form. */
  isDirty?: boolean;
};

function sanitizePanelClassName(panelClassName?: string): string {
  if (!panelClassName) return '';
  // Drop legacy side-slide positioning so callers don't fight the centered layout.
  return panelClassName
    .replace(/\bfixed\b/g, '')
    .replace(/\bright-0\b/g, '')
    .replace(/\btop-0\b/g, '')
    .replace(/\binset-y-0\b/g, '')
    .replace(/\bh-full\b/g, '')
    .replace(/\bborder-l\b/g, '')
    .replace(/\bz-\[\d+\]\b/g, '')
    .replace(/\bz-\d+\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

export function DrawerFormShell({
  isOpen,
  onClose,
  title,
  subtitle,
  headerIcon: HeaderIcon,
  children,
  footer,
  panelClassName,
  contentClassName,
  backdropClassName = 'absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]',
  zBackdrop = 60,
  zPanel = 70,
  guardUnsaved = true,
  isDirty,
}: DrawerFormShellProps) {
  const { panelRef, requestClose } = useDrawerUnsavedGuard<HTMLElement>({
    isOpen,
    onClose,
    enabled: guardUnsaved,
    isDirty,
  });

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Ignore the same click that opened the modal (mouseup/click landing on backdrop).
  const allowBackdropCloseRef = useRef(false);
  useEffect(() => {
    if (!isOpen) {
      allowBackdropCloseRef.current = false;
      return;
    }
    allowBackdropCloseRef.current = false;
    const timer = window.setTimeout(() => {
      allowBackdropCloseRef.current = true;
    }, 350);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  const cleanedPanelClass = sanitizePanelClassName(panelClassName);
  const overlayZ = Math.max(zBackdrop, zPanel);

  const handleBackdropClose = () => {
    if (!allowBackdropCloseRef.current) return;
    void requestClose();
  };

  const overlay = (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          key="drawer-form-overlay"
          className="fixed inset-0"
          style={{ zIndex: overlayZ }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: EASE_OUT }}
        >
          <div
            className={`${backdropClassName} pointer-events-auto`}
            onClick={handleBackdropClose}
            data-drawer-skip-dirty="true"
            aria-hidden
          />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4 sm:p-6">
            <motion.aside
              ref={panelRef}
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 8 }}
              transition={{ duration: 0.2, ease: EASE_OUT }}
              className={`${DRAWER_FORM_PANEL_CLASS} ${cleanedPanelClass}`.trim()}
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <DrawerFormRequestCloseContext.Provider value={requestClose}>
                <div className={DRAWER_FORM_HEADER_CLASS}>
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    {HeaderIcon ? (
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25">
                        <HeaderIcon size={20} />
                      </div>
                    ) : null}
                    <div className="min-w-0">
                      <h2 className="text-lg font-bold tracking-tight text-slate-900">{title}</h2>
                      {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void requestClose()}
                    className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                    aria-label="Close drawer"
                    data-drawer-skip-dirty="true"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className={contentClassName || DRAWER_FORM_CONTENT_CLASS}>
                  <div className="space-y-5 px-6 py-5">{children}</div>
                </div>

                {footer ? <div className={DRAWER_FORM_FOOTER_CLASS}>{footer}</div> : null}
              </DrawerFormRequestCloseContext.Provider>
            </motion.aside>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );

  if (!mounted || typeof document === 'undefined') return null;
  return createPortal(overlay, document.body);
}
