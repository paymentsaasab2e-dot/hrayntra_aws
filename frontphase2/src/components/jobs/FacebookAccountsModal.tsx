'use client';

import React from 'react';
import { Facebook, X } from 'lucide-react';
import {
  SocialAccountPicker,
  type SocialAccountOption,
} from '../SocialAccountPicker';

export type FacebookAccountsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  accounts: SocialAccountOption[];
  selectedKeys: string[];
  onSelectionChange: (keys: string[]) => void;
  onConnect: () => void;
  onDisconnect: (accountId: string) => void;
  connecting?: boolean;
  disconnectingId?: string | null;
  loading?: boolean;
  onDone?: () => void;
};

export function FacebookAccountsModal({
  isOpen,
  onClose,
  accounts,
  selectedKeys,
  onSelectionChange,
  onConnect,
  onDisconnect,
  connecting = false,
  disconnectingId = null,
  loading = false,
  onDone,
}: FacebookAccountsModalProps) {
  if (!isOpen) return null;

  const pages = accounts.filter(
    (account) =>
      account.connected !== false &&
      (account.type === 'page' || String(account.key || '').startsWith('page:')),
  );
  const others = accounts.filter(
    (account) =>
      account.connected !== false &&
      !(account.type === 'page' || String(account.key || '').startsWith('page:')),
  );

  return (
    <div className="fixed inset-0 z-[1400] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
      <div
        className="flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="facebook-accounts-title"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1877F2]/10 text-[#1877F2]">
              <Facebook size={20} />
            </span>
            <div>
              <h3 id="facebook-accounts-title" className="text-base font-semibold text-slate-900">
                Facebook Pages
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Jobs post to Facebook Pages you manage. Personal profiles are not supported by Meta.
              </p>
              <p className="mt-1 text-[11px] font-medium text-slate-400">
                {pages.length} page{pages.length === 1 ? '' : 's'} connected
                {others.length ? ` · ${others.length} other account${others.length === 1 ? '' : 's'}` : ''}
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

        <div className="max-h-[min(60vh,420px)] overflow-auto px-5 py-4">
          <SocialAccountPicker
            provider="facebook"
            accounts={accounts}
            selectedKeys={selectedKeys}
            onSelectionChange={onSelectionChange}
            onConnect={onConnect}
            onDisconnect={onDisconnect}
            connecting={connecting}
            disconnectingId={disconnectingId}
            loading={loading}
          />
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onDone?.();
              onClose();
            }}
            className="rounded-lg bg-[#1877F2] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#166FE5]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
