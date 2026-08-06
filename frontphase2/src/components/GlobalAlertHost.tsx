'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import {
  APP_DIALOG_EVENT,
  type AppDialogKind,
  type AppDialogPlacement,
  type AppDialogTone,
  type AppDialogRequestDetail,
  requestAlert,
  SYSTEM_ALERT_TITLE,
} from '../lib/appDialog';

type DialogRequest = {
  kind: AppDialogKind;
  message: string;
  tone: AppDialogTone;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  placement: AppDialogPlacement;
  autoCloseMs?: number;
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
          placement: detail.placement || 'modal',
          autoCloseMs: detail.autoCloseMs,
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

  // Auto-advance corner alerts (alert kind only)
  useEffect(() => {
    if (!activeRequest) return;
    if (activeRequest.placement !== 'corner') return;
    if (activeRequest.kind !== 'alert') return;
    const ms = activeRequest.autoCloseMs ?? 6500;
    if (!ms || ms <= 0) return;
    const id = window.setTimeout(() => closeCurrent(true), ms);
    return () => window.clearTimeout(id);
  }, [activeRequest, closeCurrent]);

  if (!activeRequest) return null;

  const isConfirm = activeRequest.kind === 'confirm';
  const isCorner = activeRequest.placement === 'corner';
  const remaining = Math.max(0, queue.length - 1);

  const toneStyles: Record<
    AppDialogTone,
    { iconBg: string; iconText: string; button: string; title: string; bar: string; ring: string }
  > = {
    info: {
      iconBg: 'bg-blue-50',
      iconText: 'text-blue-600',
      button: 'bg-blue-600 hover:bg-blue-700',
      title: 'Notice',
      bar: 'from-blue-500 to-sky-400',
      ring: 'ring-blue-100',
    },
    success: {
      iconBg: 'bg-emerald-50',
      iconText: 'text-emerald-600',
      button: 'bg-emerald-600 hover:bg-emerald-700',
      title: 'Success',
      bar: 'from-emerald-500 to-teal-400',
      ring: 'ring-emerald-100',
    },
    warning: {
      iconBg: 'bg-amber-50',
      iconText: 'text-amber-600',
      button: 'bg-amber-600 hover:bg-amber-700',
      title: 'Warning',
      bar: 'from-amber-500 to-orange-400',
      ring: 'ring-amber-100',
    },
    error: {
      iconBg: 'bg-rose-50',
      iconText: 'text-rose-600',
      button: 'bg-rose-600 hover:bg-rose-700',
      title: 'Error',
      bar: 'from-rose-500 to-pink-400',
      ring: 'ring-rose-100',
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
  const title = activeRequest.title || (isConfirm ? SYSTEM_ALERT_TITLE : style.title);
  const confirmLabel = activeRequest.confirmLabel || (isConfirm ? 'Confirm' : 'OK');
  const cancelLabel = activeRequest.cancelLabel || 'Dismiss';

  if (isCorner) {
    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[9999] flex justify-end p-4 sm:p-5">
        <div
          role="alertdialog"
          aria-modal="false"
          aria-label={title}
          className={`pointer-events-auto w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.18)] ring-1 ${style.ring}`}
        >
          <div className={`h-1 w-full bg-gradient-to-r ${style.bar}`} />
          <div className="flex items-start gap-3 p-4">
            <div className={`mt-0.5 shrink-0 rounded-xl p-2 ${style.iconBg} ${style.iconText}`}>
              <Icon className="h-[18px] w-[18px]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-bold tracking-tight text-slate-900">{title}</h3>
                <button
                  type="button"
                  onClick={() => closeCurrent(false)}
                  className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Dismiss"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed text-slate-600">
                {activeRequest.message}
              </p>
              {remaining > 0 ? (
                <p className="mt-2 text-[11px] font-medium text-slate-400">
                  {remaining} more alert{remaining === 1 ? '' : 's'} waiting
                </p>
              ) : null}
              <div className="mt-3 flex items-center justify-end gap-2">
                {isConfirm ? (
                  <>
                    <button
                      type="button"
                      onClick={() => closeCurrent(false)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      {cancelLabel}
                    </button>
                    <button
                      type="button"
                      onClick={() => closeCurrent(true)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white ${style.button}`}
                    >
                      {confirmLabel}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => closeCurrent(true)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white ${style.button}`}
                  >
                    {confirmLabel}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
