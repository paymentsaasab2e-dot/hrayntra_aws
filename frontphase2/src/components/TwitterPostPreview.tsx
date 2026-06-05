'use client';

import React from 'react';
import { Twitter } from 'lucide-react';

interface TwitterPostPreviewProps {
  accountName?: string;
  postText: string;
}

export function TwitterPostPreview({ accountName, postText }: TwitterPostPreviewProps) {
  const handle = accountName ? `@${accountName.replace(/^@/, '')}` : '@your_account';

  return (
    <div className="border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden">
      <div className="p-4">
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center shrink-0">
            <Twitter size={18} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 text-sm">
              <span className="font-bold text-slate-900 truncate">{accountName || 'Your account'}</span>
              <span className="text-slate-500 truncate">{handle}</span>
              <span className="text-slate-500">·</span>
              <span className="text-slate-500">now</span>
            </div>
            <div className="mt-2 text-sm text-slate-900 whitespace-pre-wrap break-words leading-relaxed">
              {postText || 'Tweet preview will appear here once job details are filled in.'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
