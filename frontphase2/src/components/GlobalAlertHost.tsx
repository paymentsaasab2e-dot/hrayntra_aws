'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import {
  APP_DIALOG_EVENT,
  type AppDialogKind,
  type AppDialogTone,
  type AppDialogRequestDetail,
  requestAlert,
} from '../lib/appDialog';

type DialogRequest = {
  kind: AppDialogKind;
  message: string;
  tone: AppDialogTone;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  resolve: (result: boolean) => void;
};

export function GlobalAlertHost() {
  const [queue, setQueue] = useState<DialogRequest[]>([]);
  const activeRequest = useMemo(() => queue[0] || null, [queue]);

  const closeCurrent = useCallback((result: boolean) => {
    setQueue((prev) => {
      if (prev.length === 0) return prev;
      const [head, ...rest] = prev;
      head.resolve(result);
      return rest;
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const originalAlert = window.alert;
    window.alert = (message?: unknown) => {
      void requestAlert(message);
    };

    const handleRequest = (event: Event) => {
      const customEvent = event as CustomEvent<AppDialogRequestDetail>;
      const detail = customEvent.detail;
      if (!detail) return;
      setQueue((prev) => [
        ...prev,
        {
          kind: detail.kind,
          message: detail.message,
          tone: detail.tone,
          title: detail.title,
          confirmLabel: detail.confirmLabel,
          cancelLabel: detail.cancelLabel,
          resolve: detail.resolve,
        },
      ]);
    };

    window.addEventListener(APP_DIALOG_EVENT, handleRequest as EventListener);

    return () => {
      window.alert = originalAlert;
      window.removeEventListener(APP_DIALOG_EVENT, handleRequest as EventListener);
    };
  }, []);

  if (!activeRequest) return null;

  const isConfirm = activeRequest.kind === 'confirm';

  const toneStyles: Record<AppDialogTone, { iconBg: string; iconText: string; button: string; title: string }> = {
    info: {
      iconBg: 'bg-blue-50',
      iconText: 'text-blue-600',
      button: 'bg-blue-600 hover:bg-blue-700',
      title: 'Notice',
    },
    success: {
      iconBg: 'bg-emerald-50',
      iconText: 'text-emerald-600',
      button: 'bg-emerald-600 hover:bg-emerald-700',
      title: 'Success',
    },
    warning: {
      iconBg: 'bg-amber-50',
      iconText: 'text-amber-600',
      button: 'bg-amber-600 hover:bg-amber-700',
      title: 'Warning',
    },
    error: {
      iconBg: 'bg-rose-50',
      iconText: 'text-rose-600',
      button: 'bg-rose-600 hover:bg-rose-700',
      title: 'Error',
    },
  };

  const iconMap: Record<AppDialogTone, React.ComponentType<{ className?: string }>> = {
    info: Info,
    success: CheckCircle2,
    warning: AlertTriangle,
    error: AlertCircle,
  };

  const style = toneStyles[activeRequest.tone || 'info'];
  const Icon = iconMap[activeRequest.tone || 'info'];
  const title = activeRequest.title || (isConfirm ? 'Please Confirm' : style.title);
  const confirmLabel = activeRequest.confirmLabel || (isConfirm ? 'Confirm' : 'OK');
  const cancelLabel = activeRequest.cancelLabel || 'Cancel';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 rounded-full p-2 ${style.iconBg} ${style.iconText}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{activeRequest.message}</p>
          </div>
        </div>
        <div className="mt-6 flex items-center justify-end gap-3">
          {isConfirm && (
            <button
              type="button"
              onClick={() => closeCurrent(false)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              {cancelLabel}
            </button>
          )}
          <button
            type="button"
            onClick={() => closeCurrent(true)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold text-white transition-colors ${style.button}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
