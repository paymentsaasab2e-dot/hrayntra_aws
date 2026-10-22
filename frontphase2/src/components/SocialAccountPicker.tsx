'use client';

import React from 'react';
import { Check, Linkedin, Loader2, Plus, Trash2, Twitter } from 'lucide-react';
import { requestConfirm } from '../lib/appDialog';

export type SocialAccountOption = {
  id: string;
  key: string;
  name: string;
  type?: 'personal' | 'page';
  picture?: string | null;
  accountEmail?: string | null;
  connected?: boolean;
  expired?: boolean;
  ownerUserId?: string | null;
  ownerName?: string | null;
  isOwn?: boolean;
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

function SocialAccountAvatar({
  picture,
  name,
  provider,
}: {
  picture?: string | null;
  name: string;
  provider: 'linkedin' | 'twitter';
}) {
  const src = String(picture || '').trim();
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => {
    setFailed(false);
  }, [src]);

  const showImage = /^https?:\/\//i.test(src) && !failed;
  if (!showImage) {
    return (
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          provider === 'linkedin' ? 'bg-[#0077b5]' : 'bg-slate-900'
        }`}
        aria-hidden
      >
        {provider === 'linkedin' ? (
          <Linkedin size={16} className="text-white" />
        ) : (
          <Twitter size={16} className="text-white" />
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="h-8 w-8 shrink-0 rounded-full bg-slate-100 object-cover"
    />
  );
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
              const canRemove = account.isOwn !== false;
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
                  <SocialAccountAvatar
                    picture={account.picture}
                    name={account.name}
                    provider={provider}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-slate-900 truncate">
                        {account.type === 'page' ? account.name : accountLabel(account, provider)}
                      </span>
                      {account.type === 'page' ? (
                        <span className="inline-flex items-center px-2 py-0.5 bg-sky-100 text-sky-800 rounded text-[10px] font-semibold uppercase tracking-wide shrink-0">
                          Company Page
                        </span>
                      ) : null}
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium shrink-0">
                        <Check size={12} />
                        Connected
                      </span>
                    </div>
                    {account.accountEmail ? (
                      <p className="text-xs text-slate-500 truncate">{account.accountEmail}</p>
                    ) : null}
                    {account.ownerName ? (
                      <p className="text-[11px] text-slate-400 truncate">
                        {account.isOwn === false
                          ? `Connected by ${account.ownerName}`
                          : `Connected by you`}
                      </p>
                    ) : null}
                  </div>
                  {canRemove ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void (async () => {
                          const label = account.type === 'page' ? `${account.name} company page` : account.name;
                          const confirmed = await requestConfirm(
                            `Remove ${label}? This disconnects it for publishing.`,
                            { confirmLabel: 'Remove', tone: 'warning' },
                          );
                          if (!confirmed) return;
                          onDisconnect(account.id);
                        })();
                      }}
                      disabled={disconnectingId === account.id}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                      title={`Remove ${account.name}`}
                    >
                      {disconnectingId === account.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Trash2 size={12} />
                      )}
                      Remove
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

      {provider === 'linkedin' &&
      connectedAccounts.length > 0 &&
      !connectedAccounts.some((account) => account.type === 'page') ? (
        <p className="text-[11px] text-slate-500">
          Company Pages are not connected yet. Click <span className="font-medium text-slate-700">Add another LinkedIn account</span> and approve access as a Page admin.
        </p>
      ) : null}

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
