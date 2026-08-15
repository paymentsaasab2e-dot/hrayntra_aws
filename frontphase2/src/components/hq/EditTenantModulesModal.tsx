'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { LayoutGrid, Loader2 } from 'lucide-react';
import { apiHqUpdateTenantModules, type HqTenantRow } from '@/lib/api';
import {
  ALL_TENANT_MODULES,
  defaultModulesForProductLine,
  type TenantProductLine,
} from '@/lib/tenantModuleCatalog';
import { HqPrimaryButton, HqSecondaryButton } from './hqUi';
import { DrawerCloseButton } from '../drawers/DrawerCloseButton';
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
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

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

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, saving, onClose]);

  const catalog = useMemo(() => ALL_TENANT_MODULES, []);

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
    if (!tenant) return;
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
      void requestSuccess('Tenant tabs updated and synced to Phase 2. Ask the tenant to refresh or re-open Phase 2.');
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update modules');
    } finally {
      setSaving(false);
    }
  };

  if (!portalReady || typeof document === 'undefined') return null;

  const drawerTree = (
    <AnimatePresence>
      {open && tenant ? (
        <>
          <motion.div
            key="edit-tenant-modules-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              if (!saving) onClose();
            }}
            className="fixed inset-0 z-[500] bg-slate-900/45 backdrop-blur-[2px] pointer-events-auto"
            data-drawer-skip-dirty="true"
          />
          <div className="pointer-events-none fixed inset-0 z-[501] flex items-center justify-center p-4 sm:p-6">
            <motion.div
              key="edit-tenant-modules-panel"
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="edit-tenant-modules-title"
              className="pointer-events-auto relative flex h-[min(92vh,880px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl ring-1 ring-slate-900/5"
            >
              <div className="shrink-0 border-b border-blue-100/70 bg-gradient-to-r from-blue-50/95 via-indigo-50/50 to-white px-5 py-4 sm:px-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                      <LayoutGrid size={18} />
                    </div>
                    <div className="min-w-0">
                      <h2
                        id="edit-tenant-modules-title"
                        className="text-lg font-bold tracking-tight text-slate-900"
                      >
                        Tenant modules &amp; tabs
                      </h2>
                      <p className="mt-0.5 truncate text-sm font-medium text-slate-600">
                        {tenant.name} · {tenant.email}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-500">
                        Enable or disable Phase 2 sidenav tabs anytime. Changes are written to the
                        tenant database immediately — users see them after refresh or re-login.
                      </p>
                    </div>
                  </div>
                  <DrawerCloseButton onClick={onClose} disabled={saving} />
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
                <section className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4">
                  <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Product line
                  </p>
                  <div
                    role="group"
                    aria-label="Product line presets"
                    className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-slate-200/90 bg-white p-1 shadow-sm"
                  >
                    {(['crm', 'recruitment'] as TenantProductLine[]).map((line) => (
                      <button
                        key={line}
                        type="button"
                        onClick={() => selectLineDefaults(line)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                          productLine === line
                            ? line === 'recruitment'
                              ? 'bg-amber-600 text-white shadow-sm'
                              : 'bg-blue-600 text-white shadow-sm'
                            : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {line === 'recruitment' ? 'Recruitment defaults' : 'CRM defaults'}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={selectAll}
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      Enable all
                    </button>
                    <button
                      type="button"
                      onClick={clearAll}
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                    >
                      Clear
                    </button>
                  </div>
                </section>

                <section>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Tabs
                    </p>
                    <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700 ring-1 ring-blue-100">
                      {enabledModules.length} enabled
                    </span>
                  </div>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {catalog.map((mod) => {
                      const on = enabledModules.includes(mod.id);
                      const Icon = mod.icon;
                      return (
                        <button
                          key={mod.id}
                          type="button"
                          onClick={() => toggle(mod.id)}
                          className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition ${
                            on
                              ? 'border-blue-300 bg-blue-50/80 shadow-sm ring-1 ring-blue-200/80'
                              : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80'
                          }`}
                        >
                          <span
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                              on ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold text-slate-900">
                              {mod.label}
                            </span>
                            <span className="block truncate text-[10px] text-slate-400">{mod.id}</span>
                          </span>
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                              on
                                ? 'border-blue-600 bg-blue-600'
                                : 'border-slate-300 bg-white'
                            }`}
                            aria-hidden
                          >
                            {on ? (
                              <span className="h-1.5 w-1.5 rounded-full bg-white" />
                            ) : null}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>

                {error ? (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700">
                    {error}
                  </div>
                ) : null}
              </div>

              <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/80 px-5 py-3.5 sm:px-6">
                <HqSecondaryButton type="button" onClick={onClose} disabled={saving}>
                  Cancel
                </HqSecondaryButton>
                <HqPrimaryButton type="button" onClick={() => void handleSave()} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Save tabs
                </HqPrimaryButton>
              </div>
            </motion.div>
          </div>
        </>
      ) : null}
    </AnimatePresence>
  );

  return createPortal(drawerTree, document.body);
}
