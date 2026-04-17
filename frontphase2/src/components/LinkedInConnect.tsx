'use client';

import React from 'react';
import { Linkedin, Check, Loader2 } from 'lucide-react';
import { useLinkedIn } from '../hooks/useLinkedIn';

export function LinkedInConnect() {
  const { isConnected, linkedinUser, isLoading, error, connect, disconnect } = useLinkedIn();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
        <Loader2 size={16} className="animate-spin text-slate-400" />
        <span className="text-sm text-slate-500">Checking LinkedIn connection...</span>
      </div>
    );
  }

  if (isConnected && linkedinUser) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
          {linkedinUser.picture ? (
            <img
              src={linkedinUser.picture}
              alt={linkedinUser.name}
              className="w-8 h-8 rounded-full"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
              <Linkedin size={16} className="text-white" />
            </div>
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-900">{linkedinUser.name}</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
                <Check size={12} />
                Connected
              </span>
            </div>
          </div>
        </div>
        {error && (
          <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
            {error}
          </div>
        )}
        <button
          type="button"
          onClick={disconnect}
          className="text-xs text-slate-500 hover:text-slate-700 underline"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={connect}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#0077b5] text-white rounded-xl hover:bg-[#006399] transition-colors text-sm font-medium"
      >
        <Linkedin size={18} />
        Connect LinkedIn Account
      </button>
      {error && (
        <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
