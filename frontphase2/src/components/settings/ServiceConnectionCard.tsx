'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';

export type ServiceConnectionCardProps = {
  serviceName: string;
  icon: React.ReactNode;
  iconBgClass: string;
  description: string;
  connected: boolean;
  connectedEmail?: string;
  onConnect: () => void | Promise<void>;
  onDisconnect: () => void | Promise<void>;
  connecting: boolean;
  scopes: string[];
};

export function ServiceConnectionCard({
  serviceName,
  icon,
  iconBgClass,
  description,
  connected,
  connectedEmail,
  onConnect,
  onDisconnect,
  connecting,
  scopes,
}: ServiceConnectionCardProps) {
  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconBgClass}`}
          >
            {icon}
          </div>
          <div className="min-w-0">
            <h4 className="font-semibold text-slate-900">{serviceName}</h4>
            <p className="mt-0.5 text-sm text-slate-500">{description}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {connected ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-green-100 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
              Connected ✓
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
              Not connected
            </span>
          )}
          {connected && connectedEmail ? (
            <span className="max-w-[220px] truncate text-xs text-slate-500">{connectedEmail}</span>
          ) : null}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          Scopes / access
        </p>
        <div className="flex flex-wrap gap-1.5">
          {scopes.map((scope) => (
            <span
              key={scope}
              className="rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600"
            >
              {scope}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        {connected ? (
          <button
            type="button"
            onClick={() => void onDisconnect()}
            disabled={connecting}
            className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            Disconnect
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void onConnect()}
            disabled={connecting}
            className="inline-flex items-center gap-2 rounded-lg bg-[#2b7fff] px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-60"
          >
            {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {connecting ? 'Connecting...' : `Connect ${serviceName}`}
          </button>
        )}
      </div>
    </div>
  );
}
