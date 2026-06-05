'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { BellRing, Mail, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  apiGetNotificationTriggerSettings,
  apiUpdateNotificationTriggerSettings,
  apiGetNotificationTriggerTemplatesEffective,
  apiPatchNotificationTriggerTemplatesOverrides,
  type NotificationTriggerEffectiveTemplate,
  type NotificationTriggerSettingsPayload,
} from '@/lib/api';
import { NotificationTriggerTemplatePanel } from './NotificationTriggerTemplatePanel';

type TriggerDefinition = {
  id: string;
  label: string;
  description: string;
};

const ACTIVE_TRIGGERS: TriggerDefinition[] = [
  {
    id: 'auth.welcome_email',
    label: 'Welcome Email',
    description: 'Send after successful new account registration.',
  },
  {
    id: 'auth.otp_verification',
    label: 'OTP Verification',
    description: 'Send OTP when password reset / verification is requested.',
  },
  {
    id: 'team.invite_email',
    label: 'Team Invite',
    description: 'Send when a team member invite/credential email is issued.',
  },
  {
    id: 'lead.assignment_email',
    label: 'Lead Assignment',
    description: 'Send when a lead is assigned to a recruiter.',
  },
  {
    id: 'lead.followup_email',
    label: 'Lead Follow-up Reminder',
    description: 'Send follow-up notifications for lead schedules.',
  },
  {
    id: 'client.assignment_email',
    label: 'Client Assignment',
    description: 'Send when a client is assigned to a recruiter.',
  },
  {
    id: 'job.assignment_email',
    label: 'Job Assignment',
    description: 'Send when a job requisition is assigned.',
  },
  {
    id: 'candidate.assignment_email',
    label: 'Candidate Assignment',
    description: 'Send when a candidate ownership/assignment changes.',
  },
  {
    id: 'interview.candidate_scheduled',
    label: 'Candidate Interview Scheduled',
    description: 'Send interview confirmation to candidate.',
  },
  {
    id: 'interview.panel_scheduled',
    label: 'Interview Panel Scheduled',
    description: 'Send interview schedule to panel/recruiter.',
  },
  {
    id: 'match.submission_email',
    label: 'Match Submission to Client',
    description: 'Send candidate shortlist submission email to client.',
  },
  {
    id: 'placement.confirmed_email',
    label: 'Placement Confirmation',
    description: 'Send placement confirmation email on successful placement.',
  },
  {
    id: 'billing.invoice_email',
    label: 'Placement Invoice Email',
    description: 'Send invoice email after placement billing generation.',
  },
];

const SUGGESTED_ADDITIONAL_TRIGGERS: TriggerDefinition[] = [
  {
    id: 'offer.released_email',
    label: 'Offer Released',
    description: 'Send when an offer letter is released to a candidate.',
  },
  {
    id: 'candidate.rejected_email',
    label: 'Candidate Rejected',
    description: 'Send when a candidate is rejected from a hiring stage.',
  },
  {
    id: 'candidate.hired_email',
    label: 'Candidate Hired',
    description: 'Send when a candidate is marked as hired.',
  },
  {
    id: 'job.closed_email',
    label: 'Job Closed',
    description: 'Send when a job requisition is closed.',
  },
  {
    id: 'client.followup_email',
    label: 'Client Follow-up Reminder',
    description: 'Send reminders for pending client follow-ups.',
  },
];

const DEFAULT_ACTIVE_STATE: Record<string, boolean> = Object.fromEntries(
  ACTIVE_TRIGGERS.map((trigger) => [trigger.id, true]),
);

function TriggerToggleRow({
  trigger,
  checked,
  onChange,
  rightSlot,
}: {
  trigger: TriggerDefinition;
  checked: boolean;
  onChange: (next: boolean) => void;
  rightSlot?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900">{trigger.label}</p>
        <p className="mt-1 text-xs text-slate-500">{trigger.description}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {rightSlot}
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={() => onChange(!checked)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            checked ? 'bg-blue-600' : 'bg-slate-300'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
              checked ? 'translate-x-5' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
    </div>
  );
}

export function NotificationTriggerSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeStates, setActiveStates] = useState<Record<string, boolean>>(DEFAULT_ACTIVE_STATE);
  const [additional, setAdditional] = useState<Array<{ id: string; label: string; enabled: boolean }>>([]);
  const [templateEffective, setTemplateEffective] = useState<
    Record<string, NotificationTriggerEffectiveTemplate>
  >({});
  const [templateExpanded, setTemplateExpanded] = useState<Record<string, boolean>>({});
  const [templateSaving, setTemplateSaving] = useState(false);

  const enabledAdditional = useMemo(
    () => additional.filter((item) => item.enabled),
    [additional],
  );

  const additionalLookup = useMemo(() => {
    const set = new Set<string>();
    for (const item of additional) {
      if (item.id) set.add(item.id.trim().toLowerCase());
      if (item.label) set.add(item.label.trim().toLowerCase());
    }
    return set;
  }, [additional]);

  const suggestedAvailable = useMemo(
    () =>
      SUGGESTED_ADDITIONAL_TRIGGERS.filter((trigger) => {
        const idKey = trigger.id.trim().toLowerCase();
        const labelKey = trigger.label.trim().toLowerCase();
        return !additionalLookup.has(idKey) && !additionalLookup.has(labelKey);
      }),
    [additionalLookup],
  );

  const payload = useMemo<NotificationTriggerSettingsPayload>(
    () => ({
      active: activeStates,
      additional,
    }),
    [activeStates, additional],
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await apiGetNotificationTriggerSettings();
        const data = res.data;
        if (!mounted) return;
        const mergedActive = { ...DEFAULT_ACTIVE_STATE, ...(data?.active || {}) };
        setActiveStates(mergedActive);
        setAdditional(Array.isArray(data?.additional) ? data.additional : []);
      } catch {
        if (mounted) {
          setActiveStates(DEFAULT_ACTIVE_STATE);
          setAdditional([]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const templateIdsToFetch = useMemo(() => {
    const ids = [
      ...ACTIVE_TRIGGERS.map((t) => t.id),
      ...additional
        .filter((t) => t.enabled)
        .map((t) => t.id)
        .filter(Boolean),
    ];
    return Array.from(new Set(ids.map((id) => String(id || '').trim()).filter(Boolean)));
  }, [additional]);

  const refreshTemplates = async (ids: string[]) => {
    if (!ids.length) return;
    try {
      const res = await apiGetNotificationTriggerTemplatesEffective(ids);
      setTemplateEffective(res.data?.effective || {});
    } catch (e) {
      // Templates can always fall back to system defaults in the editor.
      console.error('Failed to load notification trigger templates:', e);
    }
  };

  useEffect(() => {
    if (!templateIdsToFetch.length) return;
    void refreshTemplates(templateIdsToFetch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateIdsToFetch.join('|')]);

  const handleSaveTemplate = async (triggerId: string, subject: string, bodyHtml: string) => {
    try {
      setTemplateSaving(true);
      const res = await apiPatchNotificationTriggerTemplatesOverrides({
        [triggerId]: { subject, bodyHtml, customized: true },
      });
      setTemplateEffective(res.data?.effective || {});
      toast.success('Template saved.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save template');
    } finally {
      setTemplateSaving(false);
    }
  };

  const handleResetTemplate = async (triggerId: string) => {
    try {
      setTemplateSaving(true);
      const res = await apiPatchNotificationTriggerTemplatesOverrides({
        [triggerId]: { customized: false },
      });
      setTemplateEffective(res.data?.effective || {});
      toast.success('Template reset to system default.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to reset template');
    } finally {
      setTemplateSaving(false);
    }
  };

  const persist = async (next: NotificationTriggerSettingsPayload) => {
    try {
      setSaving(true);
      await apiUpdateNotificationTriggerSettings(next);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save notification trigger settings.');
    } finally {
      setSaving(false);
    }
  };

  const updateActive = (triggerId: string, value: boolean) => {
    const nextActive = { ...activeStates, [triggerId]: value };
    setActiveStates(nextActive);
    void persist({ ...payload, active: nextActive });
  };

  const updateAdditional = (nextAdditional: Array<{ id: string; label: string; enabled: boolean }>) => {
    setAdditional(nextAdditional);
    void persist({ ...payload, additional: nextAdditional });
  };

  const enableSuggestedTrigger = (trigger: TriggerDefinition) => {
    updateAdditional([
      ...additional,
      {
        id: trigger.id,
        label: trigger.label,
        enabled: true,
      },
    ]);
  };

  if (loading) {
    return <div className="h-72 animate-pulse rounded-3xl border border-slate-200 bg-slate-100" />;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-600">
              Notifications Trigger Points
            </p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">Control email trigger points</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Toggle email trigger events used in Phase 2. Active triggers are built-in system events.
              Additional triggers are custom events your team can define.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            {saving ? 'Saving…' : 'Saved'}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <BellRing className="h-4 w-4 text-blue-600" />
          <h3 className="text-lg font-semibold text-slate-900">Active</h3>
        </div>
        <div className="space-y-3">
          {ACTIVE_TRIGGERS.map((trigger) => (
            <div key={trigger.id}>
              <TriggerToggleRow
                trigger={trigger}
                checked={Boolean(activeStates[trigger.id])}
                onChange={(next) => updateActive(trigger.id, next)}
              />
              <NotificationTriggerTemplatePanel
                triggerId={trigger.id}
                expanded={Boolean(templateExpanded[trigger.id])}
                onToggle={() =>
                  setTemplateExpanded((prev) => ({
                    ...prev,
                    [trigger.id]: !prev[trigger.id],
                  }))
                }
                effective={templateEffective[trigger.id]}
                onSave={(subject, bodyHtml) => {
                  void handleSaveTemplate(trigger.id, subject, bodyHtml);
                }}
                onReset={() => {
                  void handleResetTemplate(trigger.id);
                }}
                saving={templateSaving}
              />
            </div>
          ))}
          {enabledAdditional.map((item) => (
            <div key={item.id}>
              <TriggerToggleRow
                trigger={{
                  id: item.id,
                  label: item.label,
                  description: 'Enabled additional trigger selected from suggestions/custom list.',
                }}
                checked={item.enabled}
                onChange={(next) =>
                  updateAdditional(
                    additional.map((current) =>
                      current.id === item.id ? { ...current, enabled: next } : current,
                    ),
                  )
                }
                rightSlot={
                  <span className="rounded-full bg-indigo-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-indigo-600">
                    Additional
                  </span>
                }
              />
              <NotificationTriggerTemplatePanel
                triggerId={item.id}
                expanded={Boolean(templateExpanded[item.id])}
                onToggle={() =>
                  setTemplateExpanded((prev) => ({
                    ...prev,
                    [item.id]: !prev[item.id],
                  }))
                }
                effective={templateEffective[item.id]}
                onSave={(subject, bodyHtml) => {
                  void handleSaveTemplate(item.id, subject, bodyHtml);
                }}
                onReset={() => {
                  void handleResetTemplate(item.id);
                }}
                saving={templateSaving}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Mail className="h-4 w-4 text-indigo-600" />
          <h3 className="text-lg font-semibold text-slate-900">Additional</h3>
        </div>
        <p className="mb-4 text-sm text-slate-600">
          Enable suggested trigger points or add your own. Once enabled, additional triggers appear in Active.
        </p>

        <div className="mb-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Suggested trigger points
          </p>
          {suggestedAvailable.length === 0 ? (
            <p className="text-xs text-slate-500">All suggested triggers are already configured.</p>
          ) : (
            <div className="space-y-3">
              {suggestedAvailable.map((trigger) => (
                <div
                  key={trigger.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{trigger.label}</p>
                    <p className="mt-1 text-xs text-slate-500">{trigger.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => enableSuggestedTrigger(trigger)}
                    className="shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
                  >
                    Turn On
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {additional.filter((item) => !item.enabled).length > 0 && (
          <div className="space-y-3">
            {additional
              .filter((item) => !item.enabled)
              .map((item) => (
              <TriggerToggleRow
                key={item.id}
                trigger={{
                  id: item.id,
                  label: item.label,
                  description: 'Custom additional trigger configured by your team.',
                }}
                checked={item.enabled}
                onChange={(next) =>
                  updateAdditional(
                    additional.map((current) =>
                      current.id === item.id ? { ...current, enabled: next } : current,
                    ),
                  )
                }
                rightSlot={
                  <button
                    type="button"
                    onClick={() =>
                      updateAdditional(additional.filter((current) => current.id !== item.id))
                    }
                    className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    aria-label="Remove trigger"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                }
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

