'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Briefcase, Loader2, RefreshCcw, Save } from 'lucide-react';
import {
  HqModulePageLayout,
  HQ_TABLE_BODY_SCROLL_CLASS,
  HQ_TABLE_CARD_CLASS,
  HQ_TABLE_CLASS,
  HQ_TOOLBAR_ROW_CLASS,
} from '@/components/hq/HqModulePageLayout';
import { HqPrimaryButton, HqSecondaryButton } from '@/components/hq/hqUi';
import {
  apiHqListFreeJobTenants,
  apiHqSetFreeJobTenantQuota,
  type HqFreeJobTenantRow,
} from '@/lib/api';
import { formatDateDMY } from '@/utils/dateDisplay';

type DraftQuota = {
  monthlyLimit: string;
  tier: 'free' | 'premium';
  premiumUntilDays: string;
  note: string;
};

function emptyDraft(row?: HqFreeJobTenantRow): DraftQuota {
  const q = row?.jobPostingQuota;
  return {
    monthlyLimit: String(q?.limit ?? 10),
    tier: q?.tier === 'premium' ? 'premium' : 'free',
    premiumUntilDays: '30',
    note: '',
  };
}

export default function HqFreeJobsPage() {
  const [tenants, setTenants] = useState<HqFreeJobTenantRow[]>([]);
  const [stats, setStats] = useState({ total: 0, agency: 0, standalone: 0, withDb: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [busyEmail, setBusyEmail] = useState('');
  const [drafts, setDrafts] = useState<Record<string, DraftQuota>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiHqListFreeJobTenants();
      const rows = res.data?.tenants || [];
      setTenants(rows);
      setStats(res.data?.stats || { total: 0, agency: 0, standalone: 0, withDb: 0 });
      setDrafts((prev) => {
        const next: Record<string, DraftQuota> = { ...prev };
        for (const row of rows) {
          if (!next[row.email]) next[row.email] = emptyDraft(row);
          else {
            // Keep draft edits; refresh limit display baseline when idle
            if (busyEmail !== row.email && row.jobPostingQuota) {
              next[row.email] = {
                ...next[row.email],
                monthlyLimit: String(row.jobPostingQuota.limit),
                tier: row.jobPostingQuota.tier === 'premium' ? 'premium' : 'free',
              };
            }
          }
        }
        return next;
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load Free Jobs tenants');
      setTenants([]);
    } finally {
      setLoading(false);
    }
  }, [busyEmail]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tenants;
    return tenants.filter((t) => {
      const hay = [
        t.email,
        t.loginId,
        t.name,
        t.organizationName,
        t.tenantDbName,
        t.signupSource,
      ]
        .map((v) => String(v || '').toLowerCase())
        .join(' ');
      return hay.includes(q);
    });
  }, [tenants, query]);

  const saveQuota = async (row: HqFreeJobTenantRow) => {
    const draft = drafts[row.email] || emptyDraft(row);
    const monthlyLimit = Math.max(1, Math.floor(Number(draft.monthlyLimit) || 0));
    if (!monthlyLimit) {
      setError('Monthly limit must be at least 1');
      return;
    }
    setBusyEmail(row.email);
    setError('');
    setStatus('');
    try {
      const res = await apiHqSetFreeJobTenantQuota({
        email: row.email,
        monthlyLimit,
        tier: draft.tier,
        premiumUntilDays: Math.max(1, Math.floor(Number(draft.premiumUntilDays) || 30)),
        note: draft.note || undefined,
      });
      const nextQuota = res.data?.jobPostingQuota;
      setTenants((prev) =>
        prev.map((t) => (t.email === row.email ? { ...t, jobPostingQuota: nextQuota || t.jobPostingQuota } : t)),
      );
      setDrafts((prev) => ({
        ...prev,
        [row.email]: emptyDraft({ ...row, jobPostingQuota: nextQuota }),
      }));
      setStatus(
        `Updated ${row.organizationName || row.email}: ${monthlyLimit}/month (${draft.tier}).`,
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update quota');
    } finally {
      setBusyEmail('');
    }
  };

  return (
    <HqModulePageLayout
      title="Free Jobs"
      description="Landing Free Jobs / try-free tenants. Raise monthly publish limits so they can post more jobs."
      icon={<Briefcase className="h-5 w-5" />}
    >
      <div className={HQ_TOOLBAR_ROW_CLASS}>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-800">
            {stats.total} tenants
          </span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium">{stats.withDb} with DB</span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium">{stats.agency} agency</span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium">
            {stats.standalone} standalone
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search email, org, DB…"
            className="h-9 w-56 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          />
          <HqSecondaryButton type="button" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            Refresh
          </HqSecondaryButton>
        </div>
      </div>

      {error ? (
        <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}
      {status ? (
        <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {status}
        </div>
      ) : null}

      <div className={HQ_TABLE_CARD_CLASS}>
        <div className={HQ_TABLE_BODY_SCROLL_CLASS}>
          <table className={HQ_TABLE_CLASS}>
            <thead>
              <tr>
                <th>Tenant</th>
                <th>Workspace</th>
                <th>Usage</th>
                <th>Raise limit</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-500">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-500">
                    No Free Jobs tenants yet. They appear after signup on /free-jobs.
                  </td>
                </tr>
              ) : (
                filtered.map((row) => {
                  const draft = drafts[row.email] || emptyDraft(row);
                  const q = row.jobPostingQuota;
                  const busy = busyEmail === row.email;
                  return (
                    <tr key={row.email}>
                      <td>
                        <div className="font-semibold text-slate-900">
                          {row.organizationName || row.name || '—'}
                        </div>
                        <div className="text-xs text-slate-500">{row.email}</div>
                        {row.loginId ? (
                          <div className="text-[11px] text-slate-400">Login: {row.loginId}</div>
                        ) : null}
                      </td>
                      <td>
                        <div className="text-xs font-medium capitalize text-slate-700">
                          {row.organizationType || '—'}
                        </div>
                        <div className="font-mono text-[11px] text-slate-500">
                          {row.tenantDbName || 'DB pending'}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {row.signupSource || 'trial'}
                          {row.subscriptionPlan?.planEndDate
                            ? ` · ends ${formatDateDMY(row.subscriptionPlan.planEndDate)}`
                            : ''}
                        </div>
                      </td>
                      <td>
                        {q ? (
                          <div className="text-sm">
                            <span className="font-semibold text-slate-900">
                              {q.used} / {q.limit}
                            </span>
                            <span className="ml-1 text-xs capitalize text-slate-500">
                              · {q.tier}
                            </span>
                            <div className="text-[11px] text-slate-400">{q.monthKey}</div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">No quota yet</span>
                        )}
                      </td>
                      <td>
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="number"
                            min={1}
                            value={draft.monthlyLimit}
                            onChange={(e) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [row.email]: { ...draft, monthlyLimit: e.target.value },
                              }))
                            }
                            className="h-8 w-20 rounded-lg border border-slate-200 px-2 text-sm"
                            title="Monthly publish limit"
                          />
                          <select
                            value={draft.tier}
                            onChange={(e) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [row.email]: {
                                  ...draft,
                                  tier: e.target.value === 'premium' ? 'premium' : 'free',
                                },
                              }))
                            }
                            className="h-8 rounded-lg border border-slate-200 px-2 text-xs"
                          >
                            <option value="free">Free</option>
                            <option value="premium">Premium</option>
                          </select>
                          {draft.tier === 'premium' ? (
                            <input
                              type="number"
                              min={1}
                              value={draft.premiumUntilDays}
                              onChange={(e) =>
                                setDrafts((prev) => ({
                                  ...prev,
                                  [row.email]: { ...draft, premiumUntilDays: e.target.value },
                                }))
                              }
                              className="h-8 w-16 rounded-lg border border-slate-200 px-2 text-xs"
                              title="Premium days"
                            />
                          ) : null}
                        </div>
                      </td>
                      <td className="text-right">
                        <HqPrimaryButton
                          type="button"
                          disabled={busy || !row.tenantDbName}
                          onClick={() => void saveQuota(row)}
                          className="!h-8 !px-3 !text-xs"
                        >
                          {busy ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Save className="h-3.5 w-3.5" />
                          )}
                          Save
                        </HqPrimaryButton>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </HqModulePageLayout>
  );
}
