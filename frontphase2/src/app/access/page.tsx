'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, Globe2, RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';
import {
  apiGetPortalAccessMembers,
  apiGetPortalAccessJobsForMember,
  apiSetJobsHryantraPortalAccess,
  type PortalAccessJobRow,
  type PortalAccessMember,
} from '../../lib/api';

export const dynamic = 'force-dynamic';

export default function AccessPage() {
  const [members, setMembers] = useState<PortalAccessMember[]>([]);
  const [memberQuery, setMemberQuery] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [jobs, setJobs] = useState<PortalAccessJobRow[]>([]);
  const [memberMeta, setMemberMeta] = useState<{ name: string; email: string; roleName: string } | null>(
    null,
  );
  const [busyJobId, setBusyJobId] = useState<string | null>(null);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [stats, setStats] = useState({ missingCount: 0, publishedCount: 0 });

  const loadMembers = useCallback(async () => {
    setLoadingMembers(true);
    try {
      const res = await apiGetPortalAccessMembers();
      setMembers(res.data || []);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to load members');
      setMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  }, []);

  const loadJobs = useCallback(async (userId: string) => {
    if (!userId) {
      setJobs([]);
      setMemberMeta(null);
      return;
    }
    setLoadingJobs(true);
    try {
      const res = await apiGetPortalAccessJobsForMember(userId);
      const data = res.data;
      setJobs(data?.jobs || []);
      setStats({
        missingCount: Number(data?.missingCount || 0),
        publishedCount: Number(data?.publishedCount || 0),
      });
      setMemberMeta(
        data?.member
          ? {
              name: data.member.name,
              email: data.member.email,
              roleName: data.member.roleName,
            }
          : null,
      );
    } catch (error: any) {
      toast.error(error?.message || 'Failed to load jobs');
      setJobs([]);
    } finally {
      setLoadingJobs(false);
    }
  }, []);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  useEffect(() => {
    void loadJobs(selectedMemberId);
  }, [selectedMemberId, loadJobs]);

  const filteredMembers = useMemo(() => {
    const q = memberQuery.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        (m.roleName || '').toLowerCase().includes(q),
    );
  }, [members, memberQuery]);

  const togglePortal = async (job: PortalAccessJobRow, enabled: boolean) => {
    const id = String(job.id);
    setBusyJobId(id);
    // Optimistic UI
    setJobs((prev) =>
      prev.map((row) => (String(row.id) === id ? { ...row, onHryantraPortal: enabled } : row)),
    );
    try {
      const res = await apiSetJobsHryantraPortalAccess({ jobIds: [id], enabled });
      if (!res.data?.updated) {
        throw new Error(res.data?.results?.[0]?.error || 'Update failed');
      }
      toast.success(enabled ? 'Shown on HRyantra portal' : 'Removed from HRyantra portal');
      setStats((prev) => ({
        publishedCount: Math.max(0, prev.publishedCount + (enabled ? 1 : -1)),
        missingCount: Math.max(0, prev.missingCount + (enabled ? -1 : 1)),
      }));
    } catch (error: any) {
      setJobs((prev) =>
        prev.map((row) =>
          String(row.id) === id ? { ...row, onHryantraPortal: !enabled } : row,
        ),
      );
      toast.error(error?.message || 'Failed to update portal access');
    } finally {
      setBusyJobId(null);
    }
  };

  return (
    <div className="ph2-page-shell flex h-[calc(100dvh-3.5rem)] w-full flex-col overflow-hidden text-slate-900">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-600 text-white shadow-sm">
            <Globe2 size={18} />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900">Access</h1>
            <p className="text-xs text-slate-500">
              Tick a job to show it on the HRyantra job portal — overrides create-time platform selection.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            void loadMembers();
            if (selectedMemberId) void loadJobs(selectedMemberId);
          }}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          <RefreshCcw size={14} />
          Refresh
        </button>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-[1400px] flex-1 gap-4 overflow-hidden p-4 sm:p-5">
        <aside className="flex w-full max-w-sm shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-3">
            <label className="relative block">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={memberQuery}
                onChange={(e) => setMemberQuery(e.target.value)}
                placeholder="Search members"
                className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-sky-400 focus:bg-white"
              />
            </label>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {loadingMembers ? (
              <p className="px-2 py-4 text-sm text-slate-500">Loading members…</p>
            ) : filteredMembers.length === 0 ? (
              <p className="px-2 py-4 text-sm text-slate-500">No members with jobs found.</p>
            ) : (
              <ul className="space-y-1">
                {filteredMembers.map((m) => {
                  const active = selectedMemberId === m.id;
                  return (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedMemberId(m.id)}
                        className={`w-full rounded-xl px-3 py-2.5 text-left transition ${
                          active ? 'bg-sky-50 ring-1 ring-sky-200' : 'hover:bg-slate-50'
                        }`}
                      >
                        <p className="truncate text-sm font-semibold text-slate-900">{m.name}</p>
                        <p className="truncate text-[11px] text-slate-500">
                          {m.roleName || 'Member'} · {m.jobsCreated} created
                          {m.jobsAssigned ? ` · ${m.jobsAssigned} assigned` : ''}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {!selectedMemberId ? (
            <div className="flex flex-1 items-center justify-center p-8 text-center">
              <div>
                <Globe2 className="mx-auto mb-3 text-slate-300" size={36} />
                <p className="text-sm font-semibold text-slate-800">Select a member</p>
                <p className="mt-1 max-w-sm text-xs text-slate-500">
                  Open their jobs and tick HRyantra portal to publish — no extra publish step.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="border-b border-slate-100 px-4 py-3">
                <h2 className="text-sm font-bold text-slate-900">{memberMeta?.name || 'Member'}</h2>
                <p className="text-[11px] text-slate-500">
                  {memberMeta?.email}
                  {memberMeta?.roleName ? ` · ${memberMeta.roleName}` : ''}
                  {` · ${stats.publishedCount} on portal · ${stats.missingCount} missing`}
                </p>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                {loadingJobs ? (
                  <p className="p-6 text-sm text-slate-500">Loading jobs…</p>
                ) : jobs.length === 0 ? (
                  <p className="p-6 text-sm text-slate-500">This member has no jobs.</p>
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="w-28 px-4 py-2">Portal</th>
                        <th className="px-3 py-2">Job</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jobs.map((job) => {
                        const id = String(job.id);
                        const busy = busyJobId === id;
                        return (
                          <tr key={id} className="border-t border-slate-100 hover:bg-slate-50/80">
                            <td className="px-4 py-3">
                              <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                                  checked={Boolean(job.onHryantraPortal)}
                                  disabled={busy}
                                  onChange={(e) => void togglePortal(job, e.target.checked)}
                                />
                                {job.onHryantraPortal ? 'On' : 'Off'}
                              </label>
                            </td>
                            <td className="px-3 py-3">
                              <p className="font-medium text-slate-900">{job.title}</p>
                              <p className="text-[11px] text-slate-500">
                                {[job.clientName, job.location].filter(Boolean).join(' · ') || '—'}
                                {job.createdByMe ? ' · created' : ''}
                                {job.assignedToMe ? ' · assigned' : ''}
                              </p>
                            </td>
                            <td className="px-3 py-3 text-xs text-slate-600">{job.status || '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
