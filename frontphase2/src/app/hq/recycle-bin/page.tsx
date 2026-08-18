'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, RotateCcw, Trash2 } from 'lucide-react';
import { HqModulePageLayout } from '@/components/hq/HqModulePageLayout';
import { HqPrimaryButton, HqSecondaryButton } from '@/components/hq/hqUi';
import {
  apiHqListRecycleBin,
  apiHqPurgeTenant,
  apiHqRestoreTenant,
  type HqTenantRow,
} from '@/lib/api';
import { formatDateDMY } from '@/utils/dateDisplay';

function tenantDisplayName(t: HqTenantRow) {
  return t.organizationName || t.name || t.email;
}

export default function HqRecycleBinPage() {
  const [items, setItems] = useState<HqTenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyEmail, setBusyEmail] = useState('');
  const [status, setStatus] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiHqListRecycleBin();
      setItems(res.data?.items || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load recycle bin');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const restore = async (email: string) => {
    setBusyEmail(email);
    setStatus('');
    try {
      await apiHqRestoreTenant(email);
      setStatus(`Restored ${email} back to Users.`);
      await load();
    } catch (err: any) {
      setError(err?.message || 'Failed to restore');
    } finally {
      setBusyEmail('');
    }
  };

  const purge = async (row: HqTenantRow) => {
    const ok = window.confirm(
      `Permanently delete ${row.email}? This cannot be undone${
        row.tenantDbName ? ` and will drop database ${row.tenantDbName}` : ''
      }.`,
    );
    if (!ok) return;
    setBusyEmail(row.email);
    setStatus('');
    try {
      await apiHqPurgeTenant(row.email, true);
      setStatus(`Permanently deleted ${row.email}.`);
      await load();
    } catch (err: any) {
      setError(err?.message || 'Failed to permanently delete');
    } finally {
      setBusyEmail('');
    }
  };

  return (
    <HqModulePageLayout
      title="Recycle Bin"
      subtitle="Soft-deleted HQ users and landing signups. Restore them to Users, or delete forever."
      icon={<Trash2 className="h-5 w-5" />}
      actions={
        <HqSecondaryButton type="button" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Refresh
        </HqSecondaryButton>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <p className="text-sm text-slate-600">
            {items.length} item{items.length === 1 ? '' : 's'} in recycle bin
          </p>
          <Link
            href="/hq?tab=tenants"
            className="text-sm font-semibold text-sky-700 hover:underline"
          >
            Back to Users
          </Link>
        </div>

        {status ? (
          <div className="mx-5 mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
            {status}
          </div>
        ) : null}
        {error ? (
          <div className="mx-5 mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800">
            {error}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-auto">
          {loading && items.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-500">Loading recycle bin…</p>
          ) : items.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-500">
              Recycle bin is empty. Deleted users from HQ Users will appear here.
            </p>
          ) : (
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-5 py-3">Name</th>
                  <th className="px-3 py-3">Email</th>
                  <th className="px-3 py-3">Deleted</th>
                  <th className="px-3 py-3">DB</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={`${row.email}-${row.id}`} className="border-t border-slate-100">
                    <td className="px-5 py-3">
                      <p className="font-semibold text-slate-900">{tenantDisplayName(row)}</p>
                      <p className="text-[11px] text-slate-500">
                        {row.isLandingSignupOnly ? 'Landing signup' : row.organizationType || 'tenant'}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-slate-600">{row.email}</td>
                    <td className="px-3 py-3 text-xs text-slate-500">
                      {formatDateDMY(row.deletedAt) || '—'}
                      {row.deletedBy ? (
                        <span className="mt-0.5 block text-[10px] text-slate-400">by {row.deletedBy}</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-slate-500">
                      {row.tenantDbName || '—'}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-2">
                        <HqSecondaryButton
                          type="button"
                          disabled={busyEmail === row.email}
                          onClick={() => void restore(row.email)}
                        >
                          {busyEmail === row.email ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RotateCcw className="h-4 w-4" />
                          )}
                          Restore
                        </HqSecondaryButton>
                        <HqPrimaryButton
                          type="button"
                          disabled={busyEmail === row.email}
                          onClick={() => void purge(row)}
                          className="!bg-rose-600 hover:!bg-rose-700"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete forever
                        </HqPrimaryButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </HqModulePageLayout>
  );
}
