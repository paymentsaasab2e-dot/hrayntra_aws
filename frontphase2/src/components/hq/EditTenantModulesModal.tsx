'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { apiHqUpdateTenantModules, type HqTenantRow } from '@/lib/api';
import {
  ALL_TENANT_MODULES,
  defaultModulesForProductLine,
  type TenantProductLine,
} from '@/lib/tenantModuleCatalog';
import { HqPrimaryButton, HqSecondaryButton } from './hqUi';
import { requestSuccess } from '@/lib/appDialog';

type Props = {
  open: boolean;
  tenant: HqTenantRow | null;
  onClose: () => void;
  onSaved: () => void;
};

export function EditTenantModulesModal({ open, tenant, onClose, onSaved }: Props) {
  const [productLine, setProductLine] = useState<TenantProductLine>('crm');
  const [enabledModules, setEnabledModules] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !tenant) return;
    const line: TenantProductLine =
      String(tenant.productLine || '').toLowerCase() === 'recruitment' ? 'recruitment' : 'crm';
    setProductLine(line);
    setEnabledModules(
      Array.isArray(tenant.enabledModules) && tenant.enabledModules.length > 0
        ? [...tenant.enabledModules]
        : defaultModulesForProductLine(line),
    );
    setError('');
    setSaving(false);
  }, [open, tenant]);

  const catalog = useMemo(() => ALL_TENANT_MODULES, []);

  if (!open || !tenant) return null;

  const toggle = (id: string) => {
    setEnabledModules((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id],
    );
  };

  const selectLineDefaults = (line: TenantProductLine) => {
    setProductLine(line);
    setEnabledModules(defaultModulesForProductLine(line));
  };

  const selectAll = () => setEnabledModules(catalog.map((m) => m.id));
  const clearAll = () => setEnabledModules([]);

  const handleSave = async () => {
    if (enabledModules.length === 0) {
      setError('Select at least one tab to keep enabled.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await apiHqUpdateTenantModules({
        email: tenant.email,
        productLine,
        enabledModules,
      });
      void requestSuccess('Tenant tabs updated. Phase 2 will apply them on the next sync.');
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update modules');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-tenant-modules-title"
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 id="edit-tenant-modules-title" className="text-lg font-bold text-slate-900">
              Tenant modules &amp; tabs
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {tenant.name} · {tenant.email}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Enable or disable Phase 2 sidenav tabs anytime — even after the tenant is created.
              Changes sync to the tenant DB and apply when users refresh or reopen Phase 2.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Product line
            </p>
            <div className="flex flex-wrap gap-2">
              {(['crm', 'recruitment'] as TenantProductLine[]).map((line) => (
                <button
                  key={line}
                  type="button"
                  onClick={() => selectLineDefaults(line)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition ${
                    productLine === line
                      ? line === 'recruitment'
                        ? 'bg-amber-50 text-amber-800 ring-amber-200'
                        : 'bg-sky-50 text-sky-800 ring-sky-200'
                      : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {line === 'recruitment' ? 'Recruitment defaults' : 'CRM defaults'}
                </button>
              ))}
              <button
                type="button"
                onClick={selectAll}
                className="rounded-full px-3 py-1.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
              >
                Enable all tabs
              </button>
              <button
                type="button"
                onClick={clearAll}
                className="rounded-full px-3 py-1.5 text-xs font-semibold text-rose-600 ring-1 ring-rose-200 hover:bg-rose-50"
              >
                Clear
              </button>
            </div>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Tabs ({enabledModules.length} enabled)
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {catalog.map((mod) => {
                const on = enabledModules.includes(mod.id);
                const Icon = mod.icon;
                return (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() => toggle(mod.id)}
                    className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition ${
                      on
                        ? 'border-sky-300 bg-sky-50/80 ring-1 ring-sky-200'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                        on ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-slate-900">{mod.label}</span>
                      <span className="block truncate text-[10px] text-slate-400">{mod.id}</span>
                    </span>
                    <span
                      className={`h-4 w-4 shrink-0 rounded-full border-2 ${
                        on ? 'border-sky-600 bg-sky-600' : 'border-slate-300 bg-white'
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {error}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <HqSecondaryButton type="button" onClick={onClose} disabled={saving}>
            Cancel
          </HqSecondaryButton>
          <HqPrimaryButton type="button" onClick={() => void handleSave()} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save tabs
          </HqPrimaryButton>
        </div>
      </div>
    </div>
  );
}
