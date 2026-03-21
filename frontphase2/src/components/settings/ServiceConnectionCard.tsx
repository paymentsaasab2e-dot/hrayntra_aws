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
    <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex gap-3 min-w-0">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${iconBgClass}`}
          >
            {icon}
          </div>
          <div className="min-w-0">
            <h4 className="font-semibold text-slate-900">{serviceName}</h4>
            <p className="text-sm text-slate-500 mt-0.5">{description}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {connected ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-100">
              Connected ✓
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
              Not connected
            </span>
          )}
          {connected && connectedEmail ? (
            <span className="text-xs text-slate-500 truncate max-w-[220px]">{connectedEmail}</span>
          ) : null}
        </div>
      </div>
      <div>
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
          Scopes / access
        </p>
        <div className="flex flex-wrap gap-1.5">
          {scopes.map((s) => (
            <span
              key={s}
              className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200"
            >
              {s}
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
            className="px-4 py-2 rounded-lg text-sm font-medium border border-red-200 text-red-700 bg-white hover:bg-red-50 disabled:opacity-50"
          >
            Disconnect
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void onConnect()}
            disabled={connecting}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#2b7fff] hover:bg-blue-600 disabled:opacity-60 inline-flex items-center gap-2"
          >
            {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {connecting ? 'Connecting…' : `Connect ${serviceName}`}
          </button>
        )}
      </div>
    </div>
  );
}
