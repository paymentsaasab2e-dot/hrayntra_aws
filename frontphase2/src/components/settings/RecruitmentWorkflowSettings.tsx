'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Eye, EyeOff, GitBranch, Coins, LayoutList } from 'lucide-react';
import { toast } from 'sonner';
import {
  apiFetch,
  syncOrgRecruitmentSummaryFromApi,
  apiApplyPipelineTemplateToEmptyJobs,
  apiGetOrgDefaultCurrency,
  apiSetOrgDefaultCurrency,
  apiGetClientPageFieldVisibility,
  apiSetClientPageFieldVisibility,
} from '../../lib/api';
import { usePermissions } from '../../hooks/usePermissions';
import {
  DEFAULT_CLIENT_PAGE_FIELD_VISIBILITY,
  type ClientPageFieldVisibility,
} from '../../lib/clientPageFieldVisibility';
import { SettingsPageHero, SettingsPanel } from './SettingsPageHero';

type TemplateStage = {
  name: string;
  order: number;
  color?: string;
  systemRole?: string | null;
};

const SYSTEM_ROLE_OPTIONS = [
  { value: '', label: '(none)' },
  { value: 'APPLIED', label: 'Applied' },
  { value: 'SCREENING', label: 'Screening' },
  { value: 'INTERVIEW', label: 'Interview' },
  { value: 'OFFER', label: 'Offer' },
  { value: 'HIRED', label: 'Hired' },
  { value: 'REJECTED', label: 'Rejected' },
];

export function RecruitmentWorkflowSettings() {
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('manage_settings');

  const [loading, setLoading] = useState(true);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [applyingTemplate, setApplyingTemplate] = useState(false);
  const [stages, setStages] = useState<TemplateStage[]>([]);
  const [currency, setCurrency] = useState<string>('USD');
  const [supportedCurrencies, setSupportedCurrencies] = useState<string[]>([
    'USD', 'EUR', 'GBP', 'INR', 'AED', 'SGD', 'AUD', 'CAD', 'JPY', 'CNY',
  ]);
  const [savingCurrency, setSavingCurrency] = useState(false);
  const [clientPageFields, setClientPageFields] = useState<ClientPageFieldVisibility>({
    ...DEFAULT_CLIENT_PAGE_FIELD_VISIBILITY,
  });
  const [draftClientPageFields, setDraftClientPageFields] = useState<ClientPageFieldVisibility>({
    ...DEFAULT_CLIENT_PAGE_FIELD_VISIBILITY,
  });
  const [savingClientPageFields, setSavingClientPageFields] = useState(false);

  const load = useCallback(async () => {
    if (!canManage) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [tplRes, currencyRes, clientFieldsRes] = await Promise.all([
        apiFetch<{ stages: TemplateStage[] }>('/settings/org/pipeline-template', { auth: true }),
        apiGetOrgDefaultCurrency(),
        apiGetClientPageFieldVisibility(),
      ]);
      const list = Array.isArray(tplRes.data?.stages) ? tplRes.data!.stages : [];
      setStages(
        list.map((s, i) => ({
          name: String(s?.name || '').trim() || `Stage ${i + 1}`,
          order: typeof s?.order === 'number' ? s.order : i + 1,
          color: typeof s?.color === 'string' ? s.color : '#64748b',
          systemRole: s?.systemRole ? String(s.systemRole) : '',
        }))
      );
      const code = String(currencyRes.data?.code || '').trim().toUpperCase();
      if (code) setCurrency(code);
      if (Array.isArray(currencyRes.data?.supportedCurrencies) && currencyRes.data!.supportedCurrencies.length > 0) {
        setSupportedCurrencies(currencyRes.data!.supportedCurrencies);
      }
      const fields = clientFieldsRes.data?.clientPageFieldVisibility ?? DEFAULT_CLIENT_PAGE_FIELD_VISIBILITY;
      setClientPageFields(fields);
      setDraftClientPageFields(fields);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load recruitment settings');
    } finally {
      setLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveClientPageFields = async () => {
    setSavingClientPageFields(true);
    try {
      const res = await apiSetClientPageFieldVisibility(draftClientPageFields);
      const saved = res.data?.clientPageFieldVisibility ?? draftClientPageFields;
      setClientPageFields(saved);
      setDraftClientPageFields(saved);
      await syncOrgRecruitmentSummaryFromApi();
      toast.success('Client page field visibility saved');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save client page fields');
    } finally {
      setSavingClientPageFields(false);
    }
  };

  const clientPageFieldsDirty =
    draftClientPageFields.interestLevel !== clientPageFields.interestLevel ||
    draftClientPageFields.status !== clientPageFields.status ||
    draftClientPageFields.assignedTo !== clientPageFields.assignedTo;

  const saveTemplate = async () => {
    if (stages.length === 0) {
      toast.error('Add at least one pipeline stage');
      return;
    }
    if (stages.some((s) => !String(s.name || '').trim())) {
      toast.error('Each stage needs a name');
      return;
    }
    setSavingTemplate(true);
    try {
      const payload = stages.map((s, index) => ({
        name: String(s.name).trim(),
        order: index + 1,
        color: s.color || '#64748b',
        systemRole: s.systemRole || undefined,
      }));
      await apiFetch('/settings/org/pipeline-template', {
        method: 'PUT',
        auth: true,
        body: { stages: payload },
      });
      toast.success('Default pipeline template saved');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save template');
    } finally {
      setSavingTemplate(false);
    }
  };

  const updateStage = (index: number, patch: Partial<TemplateStage>) => {
    setStages((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const applyTemplateToEmptyJobs = async () => {
    setApplyingTemplate(true);
    try {
      const res = await apiApplyPipelineTemplateToEmptyJobs();
      const d = res.data as {
        updatedJobs?: number;
        emptySeeded?: number;
        legacyReseeded?: number;
        removedStages?: number;
      };
      const u = d?.updatedJobs ?? 0;
      const leg = d?.legacyReseeded ?? 0;
      const rm = d?.removedStages ?? 0;
      const parts = [
        u > 0 ? `${u} job pipeline(s) updated` : null,
        leg > 0 ? `${leg} legacy 4-stage job(s) reseeded` : null,
        rm > 0 ? `${rm} duplicate “Apply” stage(s) removed` : null,
      ].filter(Boolean);
      toast.success(
        parts.length > 0
          ? parts.join(' · ')
          : 'Nothing to change — pipelines already match your template'
      );
    } catch (e: any) {
      toast.error(e?.message || 'Failed to apply template');
    } finally {
      setApplyingTemplate(false);
    }
  };

  const saveCurrency = async (code: string) => {
    if (!code || code === currency) return;
    setSavingCurrency(true);
    try {
      const res = await apiSetOrgDefaultCurrency(code);
      const next = String(res.data?.code || code).trim().toUpperCase();
      setCurrency(next);
      await syncOrgRecruitmentSummaryFromApi();
      toast.success(`Default currency set to ${next}`);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save currency');
    } finally {
      setSavingCurrency(false);
    }
  };

  if (!canManage) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
        You need permission to manage settings to change organization workflow or the default pipeline
        template.
      </div>
    );
  }

  if (loading) {
    return <div className="h-72 animate-pulse rounded-3xl border border-slate-200 bg-slate-100" />;
  }

  return (
    <div className="space-y-6">
      <SettingsPageHero
        eyebrow="Recruitment"
        title="Hiring workflow defaults"
        description="Set the org pipeline template, client list fields, and default currency used across jobs and billing."
        icon={<GitBranch className="h-3.5 w-3.5 text-indigo-200" />}
        stats={
          <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-600">
            {stages.length} pipeline stage{stages.length === 1 ? '' : 's'}
          </div>
        }
      />

      <SettingsPanel
        title="Default pipeline template"
        description="Used for new jobs unless a job already has custom stages. System roles map lifecycle events to the right stage."
        icon={<GitBranch className="h-4 w-4 text-indigo-600" />}
        actions={
          <button
            type="button"
            onClick={() => void saveTemplate()}
            disabled={savingTemplate}
            className="shrink-0 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-4 py-2 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
          >
            {savingTemplate ? 'Saving…' : 'Save template'}
          </button>
        }
      >
        <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200">
          {stages.map((stage, index) => (
            <div
              key={`${index}-${stage.order}`}
              className="flex flex-wrap items-center gap-3 bg-white p-4"
            >
              <span className="w-6 text-xs font-bold text-slate-400">{index + 1}</span>
              <input
                type="text"
                value={stage.name}
                onChange={(e) => updateStage(index, { name: e.target.value })}
                className="min-w-[140px] flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Stage name"
              />
              <input
                type="text"
                value={stage.color || ''}
                onChange={(e) => updateStage(index, { color: e.target.value })}
                className="w-28 rounded-xl border border-slate-200 px-2 py-2 font-mono text-xs"
                placeholder="#hex"
                title="Color (hex)"
              />
              <select
                value={stage.systemRole || ''}
                onChange={(e) => updateStage(index, { systemRole: e.target.value })}
                className="min-w-[140px] rounded-xl border border-slate-200 px-2 py-2 text-xs text-slate-800"
              >
                {SYSTEM_ROLE_OPTIONS.map((o) => (
                  <option key={o.value || 'none'} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="text-xs font-semibold text-indigo-700 hover:underline"
            onClick={() =>
              setStages((prev) => [
                ...prev,
                { name: 'New stage', order: prev.length + 1, color: '#64748b', systemRole: '' },
              ])
            }
          >
            + Add stage
          </button>
          <button
            type="button"
            onClick={() => void applyTemplateToEmptyJobs()}
            disabled={applyingTemplate}
            className="ml-auto rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700 hover:bg-amber-100 disabled:opacity-50"
            title="Backfill the saved template into any job that currently has no pipeline. Customized jobs are left untouched."
          >
            {applyingTemplate ? 'Applying…' : 'Apply to jobs without a pipeline'}
          </button>
        </div>
      </SettingsPanel>

      <SettingsPanel
        title="Client page fields"
        description="Control which client fields appear on the Clients list and drawer. Turn on only what your team needs."
        icon={<LayoutList className="h-4 w-4 text-indigo-600" />}
        actions={
          <button
            type="button"
            onClick={() => void saveClientPageFields()}
            disabled={savingClientPageFields || !clientPageFieldsDirty}
            className="shrink-0 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-500/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {savingClientPageFields ? 'Saving…' : 'Save fields'}
          </button>
        }
      >
        <div className="grid gap-3 md:grid-cols-3">
          {(
            [
              { key: 'interestLevel' as const, label: 'Interest level', hint: 'Priority / hot clients' },
              { key: 'status' as const, label: 'Status', hint: 'Active, on hold, inactive' },
              { key: 'assignedTo' as const, label: 'Assigned to', hint: 'Account owner / recruiter' },
            ] as const
          ).map((field) => {
            const visible = draftClientPageFields[field.key];
            return (
              <div
                key={field.key}
                className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">{field.label}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{field.hint}</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setDraftClientPageFields((prev) => ({
                      ...prev,
                      [field.key]: !prev[field.key],
                    }))
                  }
                  className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                    visible
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {visible ? <Eye size={14} /> : <EyeOff size={14} />}
                  {visible ? 'Visible' : 'Hidden'}
                </button>
              </div>
            );
          })}
        </div>
        {clientPageFieldsDirty ? (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
            You have unsaved changes to client page field visibility.
          </p>
        ) : null}
      </SettingsPanel>

      <SettingsPanel
        title="Default currency"
        description="Portal-wide default for invoices, placements, pay expectations, and charts. Per-row invoice overrides still work."
        icon={<Coins className="h-4 w-4 text-indigo-600" />}
      >
        <div className="flex flex-wrap gap-2">
          {supportedCurrencies.map((code) => {
            const active = currency === code;
            return (
              <button
                key={code}
                type="button"
                onClick={() => void saveCurrency(code)}
                disabled={savingCurrency}
                className={`rounded-xl border px-3.5 py-2 text-xs font-bold transition-colors ${
                  active
                    ? 'border-indigo-500 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white shadow-sm shadow-indigo-500/25'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                } disabled:opacity-50`}
              >
                {code}
                {active ? ' · Active' : ''}
              </button>
            );
          })}
        </div>
      </SettingsPanel>
    </div>
  );
}
