'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, Link2Off, Loader2, ShieldCheck } from 'lucide-react';

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
  consentSummary?: string;
  accentClass?: string;
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
  consentSummary,
  accentClass = 'from-indigo-500/15 via-transparent to-transparent',
}: ServiceConnectionCardProps) {
  const [consentAccepted, setConsentAccepted] = useState(false);

  useEffect(() => {
    if (connected) {
      setConsentAccepted(false);
    }
  }, [connected, serviceName]);

  return (
    <article
      className={[
        'group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-white transition-all duration-200',
        connected
          ? 'border-emerald-200/80 shadow-[0_10px_30px_-18px_rgba(16,185,129,0.55)]'
          : 'border-indigo-100/70 shadow-[0_12px_28px_-20px_rgba(59,130,246,0.22)] hover:border-indigo-200 hover:shadow-[0_16px_36px_-20px_rgba(79,70,229,0.2)]',
      ].join(' ')}
    >
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b ${accentClass}`}
        aria-hidden
      />

      <div className="relative flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className={[
                'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1 ring-black/5',
                iconBgClass,
              ].join(' ')}
            >
              {icon}
            </div>
            <div className="min-w-0 pt-0.5">
              <h4 className="text-[15px] font-semibold tracking-tight text-slate-900">
                {serviceName}
              </h4>
              <p className="mt-1 text-sm leading-5 text-slate-500">{description}</p>
            </div>
          </div>

          {connected ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200/80">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Connected
            </span>
          ) : (
            <span className="inline-flex shrink-0 items-center rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-500 ring-1 ring-slate-200">
              Not connected
            </span>
          )}
        </div>

        {connected && connectedEmail ? (
          <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700/80">
              Account
            </p>
            <p className="mt-0.5 truncate text-sm font-medium text-emerald-950">{connectedEmail}</p>
          </div>
        ) : null}

        <div className="mt-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Permissions
          </p>
          <div className="flex flex-wrap gap-1.5">
            {scopes.map((scope) => (
              <span
                key={scope}
                className="rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200/80"
              >
                {scope}
              </span>
            ))}
          </div>
        </div>

        {!connected ? (
          <div className="mt-4 rounded-xl border border-amber-200/80 bg-gradient-to-br from-amber-50 to-orange-50/40 p-3.5">
            <div className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
              <div>
                <p className="text-xs font-semibold text-amber-900">Consent required</p>
                <p className="mt-1 text-sm leading-5 text-amber-950/80">
                  {consentSummary ||
                    'Review the requested access above, then confirm that you want to continue to the provider consent screen.'}
                </p>
              </div>
            </div>
            <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-lg bg-white/70 px-2.5 py-2 text-sm text-amber-950 ring-1 ring-amber-200/60">
              <input
                type="checkbox"
                checked={consentAccepted}
                onChange={(event) => setConsentAccepted(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-amber-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="leading-5">
                I understand this will open the provider OAuth screen and grant these permissions if
                I approve.
              </span>
            </label>
          </div>
        ) : null}

        <div className="mt-auto flex flex-wrap gap-2 pt-5">
          {connected ? (
            <button
              type="button"
              onClick={() => void onDisconnect()}
              disabled={connecting}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3.5 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
            >
              {connecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Link2Off className="h-4 w-4" />
              )}
              Disconnect
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void onConnect()}
              disabled={connecting || !consentAccepted}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {connecting
                ? 'Connecting…'
                : consentAccepted
                  ? `Connect ${serviceName}`
                  : 'Consent first'}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
