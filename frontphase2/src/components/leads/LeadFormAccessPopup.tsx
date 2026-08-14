'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, UserRound, Users, X } from 'lucide-react';
import { apiGetLeadPublicFormAccess } from '@/lib/api';

type MemberRow = {
  name?: string;
  email?: string;
  leadCount?: number;
};

type LeadFormAccessPopupProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function LeadFormAccessPopup({ isOpen, onClose }: LeadFormAccessPopupProps) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [accessCount, setAccessCount] = useState(0);
  const [leadsFilledCount, setLeadsFilledCount] = useState(0);
  const [members, setMembers] = useState<MemberRow[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    void apiGetLeadPublicFormAccess()
      .then((res) => {
        if (cancelled) return;
        const payload =
          (res as { data?: { accessCount?: number; leadsFilledCount?: number; members?: MemberRow[] } })?.data ??
          res;
        const data = payload as {
          accessCount?: number;
          leadsFilledCount?: number;
          members?: MemberRow[];
        };
        setAccessCount(Number(data.accessCount || 0));
        setLeadsFilledCount(Number(data.leadsFilledCount || 0));
        setMembers(Array.isArray(data.members) ? data.members : []);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load access details');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[12000] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">Lead form access</p>
            <p className="mt-0.5 text-xs text-slate-500">People invited to this link and leads they filled.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="ml-2 text-sm">Loading…</span>
            </div>
          ) : error ? (
            <p className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 px-3 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-500">People with access</p>
                  <p className="mt-1 text-2xl font-bold text-indigo-900">{accessCount}</p>
                </div>
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600">Leads filled</p>
                  <p className="mt-1 text-2xl font-bold text-emerald-900">{leadsFilledCount}</p>
                </div>
              </div>
              <div className="mt-4 max-h-64 space-y-2 overflow-y-auto">
                {members.length === 0 ? (
                  <p className="text-xs text-slate-500">No one has been invited yet.</p>
                ) : (
                  members.map((member) => (
                    <div
                      key={`${member.email || member.name}`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800">{member.name || member.email}</p>
                        {member.email ? (
                          <p className="truncate text-[11px] text-slate-500">{member.email}</p>
                        ) : null}
                      </div>
                      <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200">
                        {Number(member.leadCount || 0)} lead{Number(member.leadCount || 0) === 1 ? '' : 's'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 border-t border-slate-100 px-5 py-3 text-[11px] text-slate-500">
          <Users className="h-3.5 w-3.5 shrink-0 text-indigo-600" />
          Access is granted when you share this form link with a member.
        </div>
      </div>
    </div>,
    document.body
  );
}

export function LeadFormAccessButton({
  disabled,
}: {
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-blue-300 bg-white text-blue-800 hover:bg-blue-50 disabled:opacity-50"
        title="People with access"
        aria-label="People with access"
      >
        <UserRound size={14} />
      </button>
      <LeadFormAccessPopup isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}
