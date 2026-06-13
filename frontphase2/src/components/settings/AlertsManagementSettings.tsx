'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { BellRing, Loader2, Mail, Send } from 'lucide-react';
import { toast } from 'sonner';
import {
  apiGetAlertManagement,
  apiTestAlertEmail,
  apiTestAlertPortal,
  apiUpdateAlertManagement,
  type AlertCatalogGroup,
  type AlertChannelSettings,
} from '@/lib/api';

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
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
        checked ? 'bg-blue-600' : 'bg-slate-300'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

function AlertRow({
  alertId,
  label,
  description,
  severity,
  channels,
  onChannelChange,
  testingEmail,
  testingPortal,
  onTestEmail,
  onTestPortal,
}: {
  alertId: string;
  label: string;
  description: string;
  severity?: string;
  channels: AlertChannelSettings;
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
    <tr className="border-b border-slate-100 last:border-0">
      <td className="px-4 py-4 align-top">
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
        <p className="mt-1 max-w-md text-xs leading-relaxed text-slate-500">{description}</p>
      </td>
      <td className="px-3 py-4 text-center align-middle">
        <Toggle
          checked={channels.email}
          onChange={(v) => onChannelChange('email', v)}
          label={`Email for ${label}`}
        />
      </td>
      <td className="px-3 py-4 text-center align-middle">
        <Toggle
          checked={channels.portal}
          onChange={(v) => onChannelChange('portal', v)}
          label={`Portal notification for ${label}`}
        />
      </td>
      <td className="px-3 py-4 text-center align-middle">
        <button
          type="button"
          onClick={onTestEmail}
          disabled={testingEmail}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
        >
          {testingEmail ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Mail className="h-3.5 w-3.5" />
          )}
          Test Email
        </button>
      </td>
      <td className="px-3 py-4 text-center align-middle">
        <button
          type="button"
          onClick={onTestPortal}
          disabled={testingPortal}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
        >
          {testingPortal ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <BellRing className="h-3.5 w-3.5" />
          )}
          Test Notification
        </button>
      </td>
    </tr>
  );
}

export function AlertsManagementSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [catalog, setCatalog] = useState<AlertCatalogGroup[]>([]);
  const [channels, setChannels] = useState<Record<string, AlertChannelSettings>>({});
  const [testingEmailId, setTestingEmailId] = useState<string | null>(null);
  const [testingPortalId, setTestingPortalId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiGetAlertManagement();
      const data = res.data;
      setCatalog(Array.isArray(data?.catalog) ? data.catalog : []);
      setChannels(data?.channels || {});
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
      const res = await apiUpdateAlertManagement(next);
      setChannels(res.data?.channels || next);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save alert settings');
      throw error;
    } finally {
      setSaving(false);
    }
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading alerts…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
        <div className="flex items-start gap-3">
          <Send className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
          <div>
            <p className="text-sm font-semibold text-blue-900">Alerts Management</p>
            <p className="mt-1 text-sm leading-relaxed text-blue-800/80">
              Control email and portal (bell) notifications per event. Alerts are sent to the
              assigned user when events occur. Use test buttons to preview delivery to your account.
            </p>
            {saving ? (
              <p className="mt-2 text-xs font-medium text-blue-600">Saving…</p>
            ) : null}
          </div>
        </div>
      </div>

      {catalog.map((group) => (
        <section key={group.module} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3">
            <h3 className="text-sm font-bold text-slate-900">{group.module}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3">Alert</th>
                  <th className="px-3 py-3 text-center">Email</th>
                  <th className="px-3 py-3 text-center">Portal Notification</th>
                  <th className="px-3 py-3 text-center">Test Email</th>
                  <th className="px-3 py-3 text-center">Test Notification</th>
                </tr>
              </thead>
              <tbody>
                {group.alerts.map((alert) => {
                  const ch = channels[alert.id] || {
                    email: alert.defaultEmail,
                    portal: alert.defaultPortal,
                  };
                  return (
                    <AlertRow
                      key={alert.id}
                      alertId={alert.id}
                      label={alert.label}
                      description={alert.description}
                      severity={alert.severity}
                      channels={ch}
                      onChannelChange={(field, value) =>
                        void handleChannelChange(alert.id, field, value)
                      }
                      testingEmail={testingEmailId === alert.id}
                      testingPortal={testingPortalId === alert.id}
                      onTestEmail={() => void handleTestEmail(alert.id)}
                      onTestPortal={() => void handleTestPortal(alert.id)}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
