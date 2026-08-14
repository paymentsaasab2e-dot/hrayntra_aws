'use client';

import React, { useState } from 'react';
import { toast } from 'sonner';
import { apiHqAddLeadRemark, type HqLeadRemark } from '@/lib/api';

export function HqLeadRemarksPanel({
  leadId,
  remarks,
  onUpdated,
}: {
  leadId: string;
  remarks: HqLeadRemark[];
  onUpdated?: () => void;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const sorted = [...remarks].sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
  );

  const submit = async () => {
    const value = text.trim();
    if (!value) return;
    setBusy(true);
    try {
      await apiHqAddLeadRemark(leadId, { text: value });
      setText('');
      toast.success('Remark added');
      onUpdated?.();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to add remark');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="Add a remark…"
          className="flex-1 resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-100"
        />
        <button
          type="button"
          disabled={busy || !text.trim()}
          onClick={() => void submit()}
          className="h-10 self-end rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-4 text-sm font-semibold text-white shadow-sm hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Add'}
        </button>
      </div>
      {sorted.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">No remarks yet</p>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {sorted.map((remark) => (
            <li key={remark.id} className="px-4 py-3">
              <p className="text-sm text-slate-800">{remark.text}</p>
              <p className="mt-1 text-xs text-slate-400">
                {remark.createdByEmail || 'HQ'}
                {remark.createdAt
                  ? ` · ${new Date(remark.createdAt).toLocaleString()}`
                  : ''}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
