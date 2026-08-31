'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Building2, Check, Loader2, Send, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  apiGetRecruitmentForwardTargets,
  apiSendClientToRecruitment,
  type RecruitmentForwardOrganization,
} from '@/lib/api';

type Props = {
  isOpen: boolean;
  clientId: string | null;
  clientName: string;
  onClose: () => void;
  onSent?: () => void;
};

export function SendToRecruitmentModal({ isOpen, clientId, clientName, onClose, onSent }: Props) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [organizations, setOrganizations] = useState<RecruitmentForwardOrganization[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose, submitting]);

  useEffect(() => {
    if (!isOpen) return;
    setSearch('');
    setLoading(true);
    void apiGetRecruitmentForwardTargets()
      .then((res) => {
        const data = (res as { data?: { companyName?: string; organizations?: RecruitmentForwardOrganization[] } })
          ?.data;
        const orgs = Array.isArray(data?.organizations) ? data.organizations : [];
        setCompanyName(String(data?.companyName || '').trim());
        setOrganizations(orgs);
        const selfIds = orgs.flatMap((org) => org.members.filter((member) => member.isSelf).map((member) => member.id));
        setSelectedIds(selfIds.length ? [...new Set(selfIds)] : []);
      })
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : 'Could not load team members.');
        setOrganizations([]);
      })
      .finally(() => setLoading(false));
  }, [isOpen]);

  const query = search.trim().toLowerCase();
  const visibleOrgs = useMemo(() => {
    if (!query) return organizations;
    return organizations
      .map((org) => ({
        ...org,
        members: org.members.filter((member) => {
          const haystack = `${member.name} ${member.email || ''} ${org.name}`.toLowerCase();
          return haystack.includes(query);
        }),
      }))
      .filter((org) => org.members.length > 0);
  }, [organizations, query]);

  const toggleMember = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const toggleOrg = (org: RecruitmentForwardOrganization) => {
    const ids = org.members.map((member) => member.id);
    const allSelected = ids.every((id) => selectedIds.includes(id));
    setSelectedIds((prev) =>
      allSelected ? prev.filter((id) => !ids.includes(id)) : [...new Set([...prev, ...ids])],
    );
  };

  const submit = async () => {
    if (!clientId) return;
    if (!selectedIds.length) {
      toast.error('Select yourself or another team member.');
      return;
    }
    setSubmitting(true);
    try {
      await apiSendClientToRecruitment(clientId, selectedIds);
      toast.success(`${clientName} was sent to Recruitment for the selected members.`);
      onSent?.();
      onClose();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Could not send this client to Recruitment.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!mounted || !isOpen || !clientId) return null;

  return createPortal(
    <div className="fixed inset-0 z-[220] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={() => {
          if (!submitting) onClose();
        }}
      />
      <div className="relative flex max-h-[min(36rem,90vh)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-amber-100 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <Send className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-900">Send to Recruitment</h2>
              <p className="mt-0.5 truncate text-sm font-medium text-slate-800">{clientName}</p>
              {companyName ? (
                <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-500">
                  <Building2 className="h-3.5 w-3.5 shrink-0" />
                  {companyName}
                </p>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <p className="mb-3 text-xs text-slate-500">
            Choose yourself and any team members who should see this client in Recruitment. You can send it to more
            members later.
          </p>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search members or organizations…"
            className="mb-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
          />
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading team members…
            </div>
          ) : visibleOrgs.length === 0 ? (
            <p className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
              No team members found.
            </p>
          ) : (
            <div className="space-y-3">
              {visibleOrgs.map((org) => {
                const allSelected =
                  org.members.length > 0 && org.members.every((member) => selectedIds.includes(member.id));
                return (
                  <div key={org.id} className="rounded-xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => toggleOrg(org)}
                      className="flex w-full items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5 text-left"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 ${
                            allSelected ? 'border-amber-600 bg-amber-600' : 'border-slate-300 bg-white'
                          }`}
                        >
                          {allSelected ? <Check className="h-3 w-3 text-white" strokeWidth={3} /> : null}
                        </span>
                        <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <span className="truncate text-sm font-semibold text-slate-800">{org.name}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-slate-500">
                        <Users className="h-3 w-3" />
                        {org.members.length}
                      </span>
                    </button>
                    <ul className="divide-y divide-slate-50">
                      {org.members.map((member) => {
                        const checked = selectedIds.includes(member.id);
                        return (
                          <li key={member.id}>
                            <button
                              type="button"
                              onClick={() => toggleMember(member.id)}
                              className={`flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-amber-50/50 ${
                                checked ? 'bg-amber-50/70' : ''
                              }`}
                            >
                              <span
                                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 ${
                                  checked ? 'border-amber-600 bg-amber-600' : 'border-slate-300 bg-white'
                                }`}
                              >
                                {checked ? <Check className="h-3 w-3 text-white" strokeWidth={3} /> : null}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium text-slate-800">
                                  {member.name}
                                  {member.isSelf ? (
                                    <span className="ml-1.5 rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-800">
                                      You
                                    </span>
                                  ) : null}
                                </span>
                                {member.email ? (
                                  <span className="block truncate text-xs text-slate-500">{member.email}</span>
                                ) : null}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-3">
          <p className="text-xs text-slate-500">
            {selectedIds.length} member{selectedIds.length === 1 ? '' : 's'} selected
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={submitting || loading || selectedIds.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
