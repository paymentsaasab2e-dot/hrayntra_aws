'use client';

import React from 'react';
import { Briefcase, Facebook, Loader2, MessageSquareShare, Users, X } from 'lucide-react';
import { CenteredPopup } from '@/components/ui/CenteredPopup';
import type { SocialPublishingAccount } from '@/lib/api';

export type TenantSocialProvider = 'linkedin' | 'twitter' | 'facebook';

export type TenantConnectedAccount = SocialPublishingAccount & {
  provider: TenantSocialProvider;
  providerLabel: string;
};

type TenantConnectedAccountsModalProps = {
  open: boolean;
  onClose: () => void;
  accounts: TenantConnectedAccount[];
  loading?: boolean;
  filter?: TenantSocialProvider | 'all';
};

const PROVIDER_META: Record<
  TenantSocialProvider,
  { label: string; icon: React.ReactNode; iconClass: string }
> = {
  linkedin: {
    label: 'LinkedIn',
    icon: <Briefcase className="h-4 w-4" />,
    iconClass: 'bg-blue-50 text-blue-700',
  },
  twitter: {
    label: 'X (Twitter)',
    icon: <MessageSquareShare className="h-4 w-4" />,
    iconClass: 'bg-slate-100 text-slate-700',
  },
  facebook: {
    label: 'Facebook',
    icon: <Facebook className="h-4 w-4" />,
    iconClass: 'bg-blue-50 text-blue-700',
  },
};

export function TenantConnectedAccountsModal({
  open,
  onClose,
  accounts,
  loading = false,
  filter = 'all',
}: TenantConnectedAccountsModalProps) {
  const visible = accounts.filter((account) => filter === 'all' || account.provider === filter);
  const title =
    filter === 'all' ? 'Connected accounts' : `${PROVIDER_META[filter].label} accounts`;

  const grouped = (Object.keys(PROVIDER_META) as TenantSocialProvider[])
    .filter((provider) => filter === 'all' || filter === provider)
    .map((provider) => {
      const rows = visible.filter((account) => account.provider === provider);
      const pages = rows.filter((account) => account.type === 'page');
      const personal = rows.filter((account) => account.type !== 'page');
      return {
        provider,
        rows: [...personal, ...pages],
        pageCount: pages.length,
      };
    });

  return (
    <CenteredPopup open={open} onClose={onClose} size="md" dialogTitleId="tenant-accounts-title">
      <div className="flex max-h-[min(80vh,640px)] flex-col overflow-hidden">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Users className="h-5 w-5" />
            </span>
            <div>
              <h3 id="tenant-accounts-title" className="text-base font-semibold text-slate-900">
                {title}
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Accounts connected in this tenant. Team members can use shared job-posting connections.
              </p>
              <p className="mt-1 text-[11px] font-medium text-slate-400">
                {loading ? 'Loading…' : `${visible.length} connected`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading tenant accounts…
            </div>
          ) : visible.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              No accounts are connected in this tenant yet.
            </p>
          ) : (
            <div className="space-y-5">
              {grouped.map(({ provider, rows, pageCount }) => {
                const meta = PROVIDER_META[provider];
                return (
                  <section key={provider} className="space-y-2">
                    {filter === 'all' ? (
                      <div className="flex items-center gap-2">
                        <span
                          className={`flex h-7 w-7 items-center justify-center rounded-lg ${meta.iconClass}`}
                        >
                          {meta.icon}
                        </span>
                        <h4 className="text-sm font-semibold text-slate-800">{meta.label}</h4>
                        <span className="text-[11px] font-medium text-slate-400">
                          {rows.length}
                          {pageCount > 0 ? ` · ${pageCount} company page${pageCount === 1 ? '' : 's'}` : ''}
                        </span>
                      </div>
                    ) : pageCount > 0 ? (
                      <p className="text-[11px] font-medium text-slate-400">
                        {pageCount} company page{pageCount === 1 ? '' : 's'}
                      </p>
                    ) : null}
                    {rows.length === 0 ? (
                      <p className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 text-xs text-slate-500">
                        No {meta.label} account connected.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {rows.map((account) => (
                          <li
                            key={`${account.provider}-${account.id || account.key}`}
                            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5"
                          >
                            <span
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${meta.iconClass}`}
                            >
                              {meta.icon}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-slate-900">
                                {account.name || account.accountEmail || 'Account'}
                                {account.type === 'page' ? (
                                  <span className="ml-1.5 rounded-full bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 ring-1 ring-sky-200">
                                    Company page
                                  </span>
                                ) : null}
                              </p>
                              {account.accountEmail ? (
                                <p className="truncate text-xs text-slate-500">{account.accountEmail}</p>
                              ) : null}
                              {account.ownerName ? (
                                <p className="mt-0.5 truncate text-[11px] text-slate-400">
                                  Connected by {account.ownerName}
                                  {account.isOwn ? ' (you)' : ''}
                                </p>
                              ) : account.isOwn ? (
                                <p className="mt-0.5 text-[11px] text-slate-400">Connected by you</p>
                              ) : null}
                            </div>
                            {account.expired ? (
                              <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-amber-200">
                                Expired
                              </span>
                            ) : (
                              <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                                Connected
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </CenteredPopup>
  );
}
