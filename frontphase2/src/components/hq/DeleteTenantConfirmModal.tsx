'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, Database, Trash2, UserX } from 'lucide-react';
import { DrawerCloseButton } from '../drawers/DrawerCloseButton';
import { HqPrimaryButton, HqSecondaryButton } from './hqUi';

export type DeleteTenantTarget = {
  email: string;
  dbName: string;
  name?: string;
};

type Props = {
  open: boolean;
  tenant: DeleteTenantTarget | null;
  deleting?: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function DeleteTenantConfirmModal({
  open,
  tenant,
  deleting = false,
  onClose,
  onConfirm,
}: Props) {
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !deleting) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, deleting, onClose]);

  if (!portalReady || typeof document === 'undefined') return null;

  const dbLabel = tenant?.dbName?.trim() || '(unknown)';

  const drawerTree = (
    <AnimatePresence>
      {open && tenant ? (
        <>
          <motion.div
            key="delete-tenant-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              if (!deleting) onClose();
            }}
            className="fixed inset-0 z-[500] bg-slate-900/45 backdrop-blur-[2px] pointer-events-auto"
            data-drawer-skip-dirty="true"
          />
          <div className="pointer-events-none fixed inset-0 z-[501] flex items-center justify-center p-4 sm:p-6">
            <motion.div
              key="delete-tenant-panel"
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              onClick={(e) => e.stopPropagation()}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="delete-tenant-title"
              className="pointer-events-auto relative flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl ring-1 ring-slate-900/5"
            >
              <div className="shrink-0 border-b border-rose-100/80 bg-gradient-to-r from-rose-50/95 via-orange-50/40 to-white px-5 py-4 sm:px-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-600 text-white shadow-sm">
                      <AlertTriangle size={18} />
                    </div>
                    <div className="min-w-0">
                      <h2
                        id="delete-tenant-title"
                        className="text-lg font-bold tracking-tight text-slate-900"
                      >
                        Delete tenant
                      </h2>
                      <p className="mt-0.5 truncate text-sm font-medium text-slate-600">
                        {tenant.name ? `${tenant.name} · ` : ''}
                        {tenant.email}
                      </p>
                    </div>
                  </div>
                  <DrawerCloseButton onClick={onClose} disabled={deleting} />
                </div>
              </div>

              <div className="space-y-4 px-5 py-5 sm:px-6">
                <p className="text-sm leading-relaxed text-slate-600">
                  Permanently delete{' '}
                  <span className="font-semibold text-slate-900">{tenant.email}</span>? This will:
                </p>
                <ul className="space-y-2.5 rounded-2xl border border-rose-100 bg-rose-50/50 p-4">
                  <li className="flex items-start gap-2.5 text-sm text-slate-700">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-rose-600 ring-1 ring-rose-100">
                      <UserX size={14} />
                    </span>
                    <span>Remove the HQ workspace user record</span>
                  </li>
                  <li className="flex items-start gap-2.5 text-sm text-slate-700">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-rose-600 ring-1 ring-rose-100">
                      <Database size={14} />
                    </span>
                    <span>
                      Drop the tenant database{' '}
                      <span className="font-mono text-xs font-semibold text-slate-900">
                        {dbLabel}
                      </span>
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5 text-sm text-slate-700">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-rose-600 ring-1 ring-rose-100">
                      <Trash2 size={14} />
                    </span>
                    <span>Clear the directory mapping</span>
                  </li>
                </ul>
                <p className="text-xs font-semibold text-rose-700">
                  This action cannot be undone.
                </p>
              </div>

              <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/80 px-5 py-3.5 sm:px-6">
                <HqSecondaryButton type="button" onClick={onClose} disabled={deleting}>
                  Cancel
                </HqSecondaryButton>
                <HqPrimaryButton
                  type="button"
                  onClick={onConfirm}
                  disabled={deleting}
                  loading={deleting}
                  className="!bg-rose-600 hover:!bg-rose-700"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete tenant
                </HqPrimaryButton>
              </div>
            </motion.div>
          </div>
        </>
      ) : null}
    </AnimatePresence>
  );

  return createPortal(drawerTree, document.body);
}
