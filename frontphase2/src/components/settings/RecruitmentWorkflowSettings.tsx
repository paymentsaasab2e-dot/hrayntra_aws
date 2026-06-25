'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Eye, EyeOff } from 'lucide-react';
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
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        You need permission to manage settings to change organization workflow or the default pipeline template.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        Loading organization recruitment settings…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Default pipeline template</h3>
            <p className="text-xs text-slate-500 mt-1">
              Used for all new jobs in your tenant (agency and standalone) unless that job already has custom pipeline stages. Customize per job from the job drawer with “Customize pipeline”. System roles map candidate lifecycle events to the right stage.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void saveTemplate()}
            disabled={savingTemplate}
            className="shrink-0 px-4 py-2 rounded-lg text-xs font-bold bg-emerald-600 text-white disabled:opacity-50 hover:bg-emerald-700"
          >
            {savingTemplate ? 'Saving…' : 'Save template'}
          </button>
        </div>
        <div className="divide-y divide-slate-100">
          {stages.map((stage, index) => (
            <div key={`${index}-${stage.order}`} className="p-4 flex flex-wrap items-center gap-3">
              <span className="text-xs font-bold text-slate-400 w-6">{index + 1}</span>
              <input
                type="text"
                value={stage.name}
                onChange={(e) => updateStage(index, { name: e.target.value })}
                className="flex-1 min-w-[140px] rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Stage name"
              />
              <input
                type="text"
                value={stage.color || ''}
                onChange={(e) => updateStage(index, { color: e.target.value })}
                className="w-28 rounded-lg border border-slate-200 px-2 py-2 text-xs font-mono"
                placeholder="#hex"
                title="Color (hex)"
              />
              <select
                value={stage.systemRole || ''}
                onChange={(e) => updateStage(index, { systemRole: e.target.value })}
                className="rounded-lg border border-slate-200 px-2 py-2 text-xs text-slate-800 min-w-[140px]"
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
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="text-xs font-semibold text-blue-600 hover:underline"
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
            className="ml-auto px-3 py-1.5 rounded-lg text-xs font-bold border border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 disabled:opacity-50"
            title="Backfill the saved template into any job that currently has no pipeline. Customized jobs are left untouched."
          >
            {applyingTemplate ? 'Applying…' : 'Apply to jobs without a pipeline'}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Client page fields</h3>
            <p className="text-xs text-slate-500 mt-1">
              Control which client fields appear on the Clients list and client drawer. Hidden by default — turn on only the fields your team needs.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void saveClientPageFields()}
            disabled={savingClientPageFields || !clientPageFieldsDirty}
            className="shrink-0 px-4 py-2 rounded-lg text-xs font-bold bg-[#2b7fff] text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-600"
          >
            {savingClientPageFields ? 'Saving…' : 'Save fields'}
          </button>
        </div>
        <div className="divide-y divide-slate-100">
          {(
            [
              { key: 'interestLevel' as const, label: 'Interest level', hint: 'Priority / hot clients' },
              { key: 'status' as const, label: 'Status', hint: 'Active, on hold, inactive' },
              { key: 'assignedTo' as const, label: 'Assigned to', hint: 'Account owner / recruiter' },
            ] as const
          ).map((field) => {
            const visible = draftClientPageFields[field.key];
            return (
              <div key={field.key} className="p-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{field.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{field.hint}</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setDraftClientPageFields((prev) => ({
                      ...prev,
                      [field.key]: !prev[field.key],
                    }))
                  }
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    visible
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {visible ? <Eye size={14} /> : <EyeOff size={14} />}
                  {visible ? 'Visible on client page' : 'Hidden on client page'}
                </button>
              </div>
            );
          })}
        </div>
        {clientPageFieldsDirty ? (
          <p className="px-5 py-3 text-[11px] text-amber-700 border-t border-slate-100 bg-amber-50/50">
            You have unsaved changes to client page field visibility.
          </p>
        ) : null}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">Default currency</h3>
          <p className="text-xs text-slate-500 mt-1">
            This is the portal-wide currency for invoices, placements, candidate pay expectations, and dashboard charts.
            Per-row overrides on invoices still work, but every new entry defaults to this code.
          </p>
        </div>
        <div className="p-5 flex flex-wrap items-center gap-2">
          {supportedCurrencies.map((code) => {
            const active = currency === code;
            return (
              <button
                key={code}
                type="button"
                onClick={() => void saveCurrency(code)}
                disabled={savingCurrency}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold border transition-colors ${
                  active
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:bg-emerald-50/40'
                } disabled:opacity-50`}
              >
                {code}
                {active ? ' • Active' : ''}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
