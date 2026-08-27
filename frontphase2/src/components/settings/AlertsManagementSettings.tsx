'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BellRing,
  Brain,
  ChevronDown,
  ChevronRight,
  Clock,
  Eye,
  Loader2,
  Mail,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  apiGetAlertManagement,
  apiTestAlertEmail,
  apiTestAlertPortal,
  apiUpdateAlertManagement,
  type AlertCatalogGroup,
  type AlertChannelSettings,
  type AlertExamplePreview,
  type ScheduledAnalysisSettings,
} from '@/lib/api';
import { SettingsPageHero, SettingsPanel } from './SettingsPageHero';

const DEFAULT_SCHEDULED_ANALYSIS: ScheduledAnalysisSettings = {
  enabled: true,
  time: '10:00',
  timezone: 'Asia/Kolkata',
};

const TIMEZONE_OPTIONS = [
  'Asia/Kolkata',
  'Asia/Dubai',
  'Asia/Singapore',
  'Europe/London',
  'America/New_York',
  'America/Los_Angeles',
  'UTC',
];

function ScheduledAnalysisCard({
  schedule,
  saving,
  onChange,
}: {
  schedule: ScheduledAnalysisSettings;
  saving: boolean;
  onChange: (next: ScheduledAnalysisSettings) => void;
}) {
  return (
    <SettingsPanel
      title="Automatic daily Analyze"
      description="Runs Analyze once per day at the time you choose. Manual Analyze on the dashboard still works anytime."
      icon={<Clock className="h-4 w-4 text-indigo-600" />}
      actions={
        <label className="flex shrink-0 items-center gap-2 text-[11px] font-medium text-slate-600">
          Enabled
          <Toggle
            checked={schedule.enabled}
            onChange={(enabled) => onChange({ ...schedule, enabled })}
            label="Enable automatic daily Analyze"
          />
        </label>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Run at
          </span>
          <input
            type="time"
            value={schedule.time}
            disabled={!schedule.enabled || saving}
            onChange={(e) => onChange({ ...schedule, time: e.target.value })}
            className="mt-1.5 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </label>

        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Timezone
          </span>
          <select
            value={schedule.timezone}
            disabled={!schedule.enabled || saving}
            onChange={(e) => onChange({ ...schedule, timezone: e.target.value })}
            className="mt-1.5 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {TIMEZONE_OPTIONS.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
            {!TIMEZONE_OPTIONS.includes(schedule.timezone) ? (
              <option value={schedule.timezone}>{schedule.timezone}</option>
            ) : null}
          </select>
        </label>
      </div>
    </SettingsPanel>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
        checked ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600' : 'bg-slate-300'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

function AlertExampleBlock({ preview }: { preview: AlertExamplePreview }) {
  const hasPortal = preview.portalTitle && preview.portalTitle !== '—';
  return (
    <div className="mt-2 space-y-2 rounded-lg border border-slate-100 bg-slate-50/80 p-2.5">
      {hasPortal ? (
        <div className="flex items-start gap-2">
          <BellRing className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600" />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-slate-900">{preview.portalTitle}</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600">{preview.portalBody}</p>
          </div>
        </div>
      ) : null}
      <div className="flex items-start gap-2">
        <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
        <div className="min-w-0">
          <p className="text-[10px] font-medium text-slate-500">Email</p>
          <p className="text-[11px] font-semibold text-slate-900">{preview.emailSubject}</p>
        </div>
      </div>
      <p className="text-[10px] leading-relaxed text-slate-500">
        <span className="font-semibold text-slate-600">Shown in:</span> {preview.shownIn}
      </p>
    </div>
  );
}

function AlertRow({
  label,
  description,
  severity,
  examplePreview,
  channels,
  previewOpen,
  onTogglePreview,
  onChannelChange,
  testingEmail,
  testingPortal,
  onTestEmail,
  onTestPortal,
}: {
  label: string;
  description: string;
  severity?: string;
  examplePreview?: AlertExamplePreview | null;
  channels: AlertChannelSettings;
  previewOpen: boolean;
  onTogglePreview: () => void;
  onChannelChange: (field: 'email' | 'portal', value: boolean) => void;
  testingEmail: boolean;
  testingPortal: boolean;
  onTestEmail: () => void;
  onTestPortal: () => void;
}) {
  const severityClass =
    severity === 'critical'
      ? 'bg-red-50 text-red-700 ring-red-100'
      : severity === 'warning'
        ? 'bg-amber-50 text-amber-700 ring-amber-100'
        : 'bg-slate-50 text-slate-600 ring-slate-100';

  return (
    <div className="border-b border-slate-100/80 px-4 py-3 last:border-0 sm:px-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-slate-900">{label}</p>
            {severity ? (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${severityClass}`}
              >
                {severity}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">{description}</p>
          {examplePreview ? (
            <button
              type="button"
              onClick={onTogglePreview}
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800"
            >
              {previewOpen ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <Eye className="h-3.5 w-3.5" />
              )}
              {previewOpen ? 'Hide example' : 'Show example'}
            </button>
          ) : null}
          {previewOpen && examplePreview ? (
            <AlertExampleBlock preview={examplePreview} />
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-3 sm:gap-4">
          <label className="flex items-center gap-2 text-[11px] font-medium text-slate-600">
            <Mail className="h-3.5 w-3.5 text-slate-400" />
            Email
            <Toggle
              checked={channels.email}
              onChange={(v) => onChannelChange('email', v)}
              label={`Email for ${label}`}
            />
          </label>
          <label className="flex items-center gap-2 text-[11px] font-medium text-slate-600">
            <BellRing className="h-3.5 w-3.5 text-slate-400" />
            Portal
            <Toggle
              checked={channels.portal}
              onChange={(v) => onChannelChange('portal', v)}
              label={`Portal notification for ${label}`}
            />
          </label>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onTestEmail}
              disabled={testingEmail}
              title="Test email"
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              {testingEmail ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Mail className="h-3.5 w-3.5" />
              )}
            </button>
            <button
              type="button"
              onClick={onTestPortal}
              disabled={testingPortal}
              title="Test notification"
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              {testingPortal ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <BellRing className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AlertSection({
  group,
  channels,
  expanded,
  onToggle,
  expandedPreviews,
  onTogglePreview,
  testingEmailId,
  testingPortalId,
  onChannelChange,
  onTestEmail,
  onTestPortal,
}: {
  group: AlertCatalogGroup;
  channels: Record<string, AlertChannelSettings>;
  expanded: boolean;
  onToggle: () => void;
  expandedPreviews: Set<string>;
  onTogglePreview: (alertId: string) => void;
  testingEmailId: string | null;
  testingPortalId: string | null;
  onChannelChange: (alertId: string, field: 'email' | 'portal', value: boolean) => void;
  onTestEmail: (alertId: string) => void;
  onTestPortal: (alertId: string) => void;
}) {
  const isAi = group.module === 'AI Analysis';

  return (
    <section className="overflow-hidden rounded-xl border border-indigo-100/60 bg-white/80 shadow-[0_12px_40px_-18px_rgba(59,130,246,0.16)] backdrop-blur-sm">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className={`flex w-full items-start justify-between gap-3 border-b px-5 py-4 text-left transition-colors hover:bg-indigo-50/40 sm:px-6 ${
          expanded ? 'border-indigo-100/40' : 'border-transparent'
        } bg-gradient-to-br from-white via-indigo-50/20 to-violet-50/15`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {isAi ? <Brain className="h-4 w-4 shrink-0 text-indigo-600" /> : <BellRing className="h-4 w-4 shrink-0 text-indigo-600" />}
            <h3 className="text-base font-semibold tracking-tight text-slate-900">{group.module}</h3>
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500 ring-1 ring-slate-200">
              {group.alerts.length}
            </span>
          </div>
          {isAi ? (
            <p className="mt-1 text-sm text-slate-500">
              AI brief, tables, drawers, email, and portal alerts from Analyze now.
            </p>
          ) : (
            <p className="mt-1 text-sm text-slate-500">
              {group.module} event notifications
            </p>
          )}
        </div>
        <span className="mt-0.5 shrink-0 text-slate-400">
          {expanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
        </span>
      </button>

      {expanded ? (
        <div className="divide-y divide-slate-100/80">
          {group.alerts.map((alert) => {
            const ch = channels[alert.id] || {
              email: alert.defaultEmail,
              portal: alert.defaultPortal,
            };
            return (
              <AlertRow
                key={alert.id}
                label={alert.label}
                description={alert.description}
                examplePreview={alert.examplePreview}
                severity={alert.severity}
                channels={ch}
                previewOpen={expandedPreviews.has(alert.id)}
                onTogglePreview={() => onTogglePreview(alert.id)}
                onChannelChange={(field, value) => onChannelChange(alert.id, field, value)}
                testingEmail={testingEmailId === alert.id}
                testingPortal={testingPortalId === alert.id}
                onTestEmail={() => onTestEmail(alert.id)}
                onTestPortal={() => onTestPortal(alert.id)}
              />
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

export function AlertsManagementSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [catalog, setCatalog] = useState<AlertCatalogGroup[]>([]);
  const [channels, setChannels] = useState<Record<string, AlertChannelSettings>>({});
  const [scheduledAnalysis, setScheduledAnalysis] = useState<ScheduledAnalysisSettings>(
    DEFAULT_SCHEDULED_ANALYSIS,
  );
  const [testingEmailId, setTestingEmailId] = useState<string | null>(null);
  const [testingPortalId, setTestingPortalId] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => new Set());
  const [expandedPreviews, setExpandedPreviews] = useState<Set<string>>(() => new Set());

  const load = useCallback(async () => {
    try {
      const res = await apiGetAlertManagement();
      const data = res.data;
      setCatalog(Array.isArray(data?.catalog) ? data.catalog : []);
      setChannels(data?.channels || {});
      setScheduledAnalysis({
        ...DEFAULT_SCHEDULED_ANALYSIS,
        ...(data?.scheduledAnalysis || {}),
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load alerts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const persistChannels = async (next: Record<string, AlertChannelSettings>) => {
    try {
      setSaving(true);
      const res = await apiUpdateAlertManagement({ channels: next });
      setChannels(res.data?.channels || next);
      if (res.data?.scheduledAnalysis) {
        setScheduledAnalysis({ ...DEFAULT_SCHEDULED_ANALYSIS, ...res.data.scheduledAnalysis });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save alert settings');
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const persistSchedule = async (next: ScheduledAnalysisSettings) => {
    const prev = scheduledAnalysis;
    setScheduledAnalysis(next);
    try {
      setSaving(true);
      const res = await apiUpdateAlertManagement({ scheduledAnalysis: next });
      if (res.data?.scheduledAnalysis) {
        setScheduledAnalysis({ ...DEFAULT_SCHEDULED_ANALYSIS, ...res.data.scheduledAnalysis });
      }
      toast.success('Automatic Analyze schedule saved');
    } catch (error) {
      setScheduledAnalysis(prev);
      toast.error(error instanceof Error ? error.message : 'Failed to save schedule');
    } finally {
      setSaving(false);
    }
  };

  const handleScheduleChange = (next: ScheduledAnalysisSettings) => {
    void persistSchedule(next);
  };

  const handleChannelChange = async (
    alertId: string,
    field: 'email' | 'portal',
    value: boolean,
  ) => {
    const prev = channels;
    const next = {
      ...channels,
      [alertId]: {
        email: channels[alertId]?.email ?? true,
        portal: channels[alertId]?.portal ?? true,
        [field]: value,
      },
    };
    setChannels(next);
    try {
      await persistChannels(next);
    } catch {
      setChannels(prev);
    }
  };

  const handleTestEmail = async (alertId: string) => {
    try {
      setTestingEmailId(alertId);
      await apiTestAlertEmail(alertId);
      toast.success('Test email sent to your account');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send test email');
    } finally {
      setTestingEmailId(null);
    }
  };

  const handleTestPortal = async (alertId: string) => {
    try {
      setTestingPortalId(alertId);
      await apiTestAlertPortal(alertId);
      toast.success('Test notification created — check the bell icon');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create test notification');
    } finally {
      setTestingPortalId(null);
    }
  };

  const toggleSection = (module: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(module)) next.delete(module);
      else next.add(module);
      return next;
    });
  };

  const togglePreview = (alertId: string) => {
    setExpandedPreviews((prev) => {
      const next = new Set(prev);
      if (next.has(alertId)) next.delete(alertId);
      else next.add(alertId);
      return next;
    });
  };

  const sortedCatalog = useMemo(() => {
    const ai = catalog.filter((group) => group.module === 'AI Analysis');
    const rest = catalog.filter((group) => group.module !== 'AI Analysis');
    return [...ai, ...rest];
  }, [catalog]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading alerts…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SettingsPageHero
        eyebrow="Alerts"
        title="Alerts management"
        description="Choose which hiring alerts go to email and the portal. Schedule daily AI Analyze and preview each alert type."
        icon={<BellRing className="h-3.5 w-3.5 text-indigo-200" />}
        stats={
          saving ? (
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-medium text-indigo-700">
              Saving…
            </div>
          ) : null
        }
      />

      <ScheduledAnalysisCard
        schedule={scheduledAnalysis}
        saving={saving}
        onChange={handleScheduleChange}
      />

      {sortedCatalog.map((group) => (
        <AlertSection
          key={group.module}
          group={group}
          channels={channels}
          expanded={expandedSections.has(group.module)}
          onToggle={() => toggleSection(group.module)}
          expandedPreviews={expandedPreviews}
          onTogglePreview={togglePreview}
          testingEmailId={testingEmailId}
          testingPortalId={testingPortalId}
          onChannelChange={handleChannelChange}
          onTestEmail={handleTestEmail}
          onTestPortal={handleTestPortal}
        />
      ))}
    </div>
  );
}
