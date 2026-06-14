'use client';

import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRightLeft, X } from 'lucide-react';
import { ClientHandoffForm } from './ClientHandoffForm';

type Props = {
  isOpen: boolean;
  clientId: string | null;
  clientName: string;
  onClose: () => void;
  onSent?: () => void;
};

export function ClientHandoffModal({ isOpen, clientId, clientName, onClose, onSent }: Props) {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const handleSent = () => {
    onSent?.();
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && clientId ? (
        <motion.div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label="Close handoff dialog"
            className="absolute inset-0 bg-slate-900/45"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="client-handoff-title"
            className="relative z-10 w-full max-w-lg rounded-2xl border border-violet-100 bg-white shadow-2xl"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div className="flex items-start gap-3 min-w-0">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                  <ArrowRightLeft className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <h2 id="client-handoff-title" className="text-base font-bold text-slate-900">
                    Hand off client
                  </h2>
                  <p className="mt-0.5 truncate text-sm text-slate-500">{clientName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-5 py-4">
              <ClientHandoffForm
                clientId={clientId}
                clientName={clientName}
                showHeader={false}
                onCancel={onClose}
                onSent={handleSent}
              />
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
