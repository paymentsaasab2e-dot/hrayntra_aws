'use client';

import React from 'react';
import { Check, Linkedin, Loader2, Plus, Twitter, X } from 'lucide-react';

export type SocialAccountOption = {
  id: string;
  key: string;
  name: string;
  type?: 'personal' | 'page';
  picture?: string | null;
  accountEmail?: string | null;
  connected?: boolean;
  expired?: boolean;
};

type SocialAccountPickerProps = {
  provider: 'linkedin' | 'twitter';
  accounts: SocialAccountOption[];
  selectedKeys: string[];
  onSelectionChange: (keys: string[]) => void;
  onConnect: () => void;
  onDisconnect: (accountId: string) => void;
  connecting?: boolean;
  disconnectingId?: string | null;
  loading?: boolean;
};

function accountLabel(account: SocialAccountOption, provider: 'linkedin' | 'twitter') {
  if (provider === 'twitter' && account.name) {
    return account.name.startsWith('@') ? account.name : `@${account.name}`;
  }
  if (account.type === 'page') {
    return `${account.name} (Company Page)`;
  }
  return account.name;
}

export function SocialAccountPicker({
  provider,
  accounts,
  selectedKeys,
  onSelectionChange,
  onConnect,
  onDisconnect,
  connecting = false,
  disconnectingId = null,
  loading = false,
}: SocialAccountPickerProps) {
  const connectedAccounts = accounts.filter((account) => account.connected !== false);

  const toggleAccount = (key: string) => {
    if (selectedKeys.includes(key)) {
      onSelectionChange(selectedKeys.filter((item) => item !== key));
      return;
    }
    onSelectionChange([...selectedKeys, key]);
  };

  const ProviderIcon = provider === 'linkedin' ? Linkedin : Twitter;
  const providerLabel = provider === 'linkedin' ? 'LinkedIn' : 'X';

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
        <Loader2 size={16} className="animate-spin text-slate-400" />
        <span className="text-sm text-slate-500">Loading {providerLabel} accounts...</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {connectedAccounts.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">
            Select {providerLabel} accounts to publish
          </p>
          <div className="space-y-2">
            {connectedAccounts.map((account) => {
              const checked = selectedKeys.includes(account.key);
              return (
                <label
                  key={account.key}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    checked ? 'border-blue-300 bg-blue-50/60' : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleAccount(account.key)}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                  {account.picture ? (
                    <img src={account.picture} alt={account.name} className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        provider === 'linkedin' ? 'bg-blue-600' : 'bg-slate-900'
                      }`}
                    >
                      <ProviderIcon size={16} className="text-white" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-900 truncate">
                        {accountLabel(account, provider)}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium shrink-0">
                        <Check size={12} />
                        Connected
                      </span>
                    </div>
                    {account.accountEmail ? (
                      <p className="text-xs text-slate-500 truncate">{account.accountEmail}</p>
                    ) : null}
                  </div>
                  {account.type !== 'page' ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onDisconnect(account.id);
                      }}
                      disabled={disconnectingId === account.id}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                      title={`Disconnect ${account.name}`}
                    >
                      {disconnectingId === account.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <X size={14} />
                      )}
                    </button>
                  ) : null}
                </label>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-500">No {providerLabel} accounts connected yet.</p>
      )}

      <button
        type="button"
        onClick={onConnect}
        disabled={connecting}
        className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
          provider === 'linkedin'
            ? 'bg-[#0077b5] text-white hover:bg-[#006399]'
            : 'bg-slate-900 text-white hover:bg-slate-800'
        }`}
      >
        {connecting ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Connecting...
          </>
        ) : (
          <>
            <Plus size={16} />
            {connectedAccounts.length > 0 ? `Add another ${providerLabel} account` : `Connect ${providerLabel} account`}
          </>
        )}
      </button>
    </div>
  );
}
