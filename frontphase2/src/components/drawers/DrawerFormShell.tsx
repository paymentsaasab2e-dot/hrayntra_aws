'use client';

import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X, type LucideIcon } from 'lucide-react';
import {
  DRAWER_FORM_CONTENT_CLASS,
  DRAWER_FORM_FOOTER_CLASS,
  DRAWER_FORM_HEADER_CLASS,
  DRAWER_FORM_PANEL_CLASS,
} from './drawerFormUi';

type DrawerFormShellProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  headerIcon?: LucideIcon;
  children: React.ReactNode;
  footer?: React.ReactNode;
  panelClassName?: string;
  contentClassName?: string;
  backdropClassName?: string;
  zBackdrop?: number;
  zPanel?: number;
};

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
  backdropClassName = 'fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-[2px]',
  zBackdrop = 60,
  zPanel = 70,
}: DrawerFormShellProps) {
  return (
    <AnimatePresence>
      {isOpen ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className={backdropClassName}
            style={{ zIndex: zBackdrop }}
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={panelClassName || DRAWER_FORM_PANEL_CLASS}
            style={{ zIndex: zPanel }}
          >
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
                onClick={onClose}
                className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close drawer"
              >
                <X size={18} />
              </button>
            </div>

            <div className={contentClassName || DRAWER_FORM_CONTENT_CLASS}>
              <div className="space-y-5 px-6 py-5">{children}</div>
            </div>

            {footer ? <div className={DRAWER_FORM_FOOTER_CLASS}>{footer}</div> : null}
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
