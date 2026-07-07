'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Brain, ChevronDown, ChevronRight, ExternalLink, Loader2, Mail, RefreshCw, Sparkles } from 'lucide-react';
import {
  apiGenerateWorkspaceBrief,
  apiGetWorkspaceBrief,
  WORKSPACE_BRIEF_UPDATED_EVENT,
  type AiWorkspaceBrief,
} from '@/lib/apiAiWorkspaceBrief';
import { PH2_TABLE_CARD_CLASS, PH2_TABLE_CARD_FOOTER_CLASS } from '@/components/layout/Ph2ModulePageLayout';
import { formatDateTimeDMY } from '@/utils/dateDisplay';
import { toast } from 'sonner';

const TABLE_HEAD_ROW =
  'border-b border-indigo-100/50 bg-gradient-to-r from-slate-50/90 via-indigo-50/30 to-violet-50/20 text-[10px] font-bold uppercase tracking-wider text-slate-500';

const SIGNAL_LABELS: Record<string, string> = {
  overdueTasks: 'Overdue tasks',
  dueTodayTasks: 'Tasks due today',
  overdueLeads: 'Overdue leads',
  dueTodayLeads: 'Leads due today',
  overdueClients: 'Overdue clients',
  interviewsToday: 'Interviews today',
  jobsLowApplicants: 'Jobs needing applicants',
  pendingTeamRequests: 'Pending team requests',
  overduePipelineFollowUps: 'Overdue pipeline follow-ups',
  overduePlacements: 'Overdue placements',
  activityLast7Days: 'Activity (7 days)',
};

function priorityTone(priority?: string) {
  switch (String(priority || '').toUpperCase()) {
    case 'HIGH':
      return 'bg-rose-50 text-rose-700 ring-rose-100';
    case 'LOW':
      return 'bg-slate-50 text-slate-600 ring-slate-100';
    default:
      return 'bg-amber-50 text-amber-700 ring-amber-100';
  }
}

function SignalCountsTable({ counts }: { counts: Record<string, number> }) {
  const rows = Object.entries(counts).filter(([, value]) => Number(value) > 0);
  if (!rows.length) return null;

  return (
    <div className="overflow-x-auto border-b border-indigo-100/40">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className={TABLE_HEAD_ROW}>
            <th className="px-4 py-2.5">Signal</th>
            <th className="px-4 py-2.5 text-right">Count</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map(([key, value]) => (
            <tr key={key} className="hover:bg-indigo-50/20">
              <td className="px-4 py-2.5 text-xs text-slate-700">{SIGNAL_LABELS[key] || key}</td>
              <td className="px-4 py-2.5 text-right text-xs font-semibold text-slate-900">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AiWorkspaceBriefPanel() {
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [brief, setBrief] = useState<AiWorkspaceBrief | null>(null);
  const [collapsed, setCollapsed] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGetWorkspaceBrief();
      setBrief(res.data?.brief ?? null);
      setConfigured(Boolean(res.data?.configured));
    } catch {
      setBrief(null);
      setConfigured(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onGenerate = async (force = false) => {
    setGenerating(true);
    try {
      const res = await apiGenerateWorkspaceBrief({ force, sendEmail: true });
      setBrief(res.data?.brief ?? null);
      window.dispatchEvent(new CustomEvent(WORKSPACE_BRIEF_UPDATED_EVENT));
      toast.success('AI workspace brief updated — check notifications and email');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate AI brief');
    } finally {
      setGenerating(false);
    }
  };

  const hasAlerts = (brief?.alerts?.length ?? 0) > 0;
  const hasRecommendations = (brief?.recommendations?.length ?? 0) > 0;

  const signalCounts = useMemo(
    () => (brief?.signalCounts && typeof brief.signalCounts === 'object' ? brief.signalCounts : {}),
    [brief?.signalCounts],
  );

  return (
    <section>
      <div className={PH2_TABLE_CARD_CLASS}>
        <div
          className={`flex flex-col gap-3 bg-gradient-to-r from-slate-50/90 via-indigo-50/30 to-violet-50/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
            collapsed ? '' : 'border-b border-indigo-100/50'
          }`}
        >
          <button
            type="button"
            onClick={() => setCollapsed((prev) => !prev)}
            aria-expanded={!collapsed}
            className="flex flex-1 items-start gap-3 text-left"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
                AI Workspace Brief
                <Sparkles className="h-4 w-4 text-indigo-500" />
                <span className="text-slate-400">
                  {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </span>
              </h2>
              <p className="mt-0.5 max-w-2xl text-sm text-slate-600">
                AI scans your workspace and lists priority alerts and next steps in a table you can act on quickly.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setCollapsed(false);
              void onGenerate(true);
            }}
            disabled={!configured || generating}
            title={configured ? 'Run AI analysis' : 'Configure OPENAI_API_KEY on the server'}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {generating ? 'Analyzing…' : 'Analyze now'}
          </button>
        </div>

        {collapsed ? null : (
        <>
        {loading ? (
          <div className="flex items-center justify-center gap-2 px-4 py-12 text-sm text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading AI brief…
          </div>
        ) : !configured ? (
          <div className="px-4 py-6 text-sm text-amber-800">
            AI brief needs <code className="text-xs">OPENAI_API_KEY</code> (or Mistral fallback) on the backend.
          </div>
        ) : !brief ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm text-slate-600">No AI brief yet. Run analysis to populate the table below.</p>
            <button
              type="button"
              onClick={() => void onGenerate(true)}
              disabled={generating}
              className="mt-3 text-sm font-semibold text-indigo-600 hover:text-indigo-800"
            >
              Run first analysis
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto border-b border-indigo-100/40">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className={TABLE_HEAD_ROW}>
                    <th className="px-4 py-3 whitespace-nowrap">Generated</th>
                    <th className="px-4 py-3 whitespace-nowrap">Priority</th>
                    <th className="px-4 py-3 whitespace-nowrap">Scope</th>
                    <th className="px-4 py-3 whitespace-nowrap">Email</th>
                    <th className="px-4 py-3 min-w-[200px]">Headline</th>
                    <th className="px-4 py-3 min-w-[280px]">Summary</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="align-top hover:bg-indigo-50/20">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                      {brief.createdAt ? formatDateTimeDMY(brief.createdAt) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${priorityTone(brief.priority)}`}
                      >
                        {brief.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs capitalize text-slate-600">{brief.scope || 'personal'}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {brief.emailSent ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700">
                          <Mail className="h-3.5 w-3.5" />
                          Sent
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-900">{brief.headline}</td>
                    <td className="px-4 py-3 text-xs leading-5 text-slate-600">{brief.summary}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <SignalCountsTable counts={signalCounts} />

            {hasAlerts ? (
              <div className="overflow-x-auto border-b border-indigo-100/40">
                <div className="border-b border-indigo-50/80 bg-indigo-50/30 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                  Priority alerts
                </div>
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className={TABLE_HEAD_ROW}>
                      <th className="px-4 py-2.5 whitespace-nowrap">Priority</th>
                      <th className="px-4 py-2.5 whitespace-nowrap">Area</th>
                      <th className="px-4 py-2.5 min-w-[140px]">Entity</th>
                      <th className="px-4 py-2.5 min-w-[160px]">Alert</th>
                      <th className="px-4 py-2.5 min-w-[240px]">Details</th>
                      <th className="px-4 py-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {brief.alerts.map((alert, index) => (
                      <tr key={`${alert.title}-${index}`} className="align-top hover:bg-indigo-50/20">
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${priorityTone(alert.priority)}`}
                          >
                            {alert.priority || 'MEDIUM'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs font-medium text-slate-700">{alert.area || 'General'}</td>
                        <td className="px-4 py-3 text-xs text-slate-700">
                          {alert.entityLabel ? (
                            <span className="font-semibold text-slate-900">{alert.entityLabel}</span>
                          ) : alert.entityType ? (
                            <span className="capitalize text-slate-600">{alert.entityType.toLowerCase()}</span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs font-semibold text-slate-900">{alert.title}</td>
                        <td className="px-4 py-3 text-xs leading-5 text-slate-600">{alert.detail || '—'}</td>
                        <td className="px-4 py-3 text-right">
                          {alert.actionPath ? (
                            <Link
                              href={alert.actionPath}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                            >
                              Open
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {hasRecommendations ? (
              <div className="overflow-x-auto">
                <div className="border-b border-indigo-50/80 bg-violet-50/30 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-violet-700">
                  Recommended next steps
                </div>
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className={TABLE_HEAD_ROW}>
                      <th className="px-4 py-2.5 w-12">#</th>
                      <th className="px-4 py-2.5 min-w-[180px]">Action</th>
                      <th className="px-4 py-2.5 min-w-[280px]">Details</th>
                      <th className="px-4 py-2.5 whitespace-nowrap text-right">Due in</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {brief.recommendations.map((item, index) => (
                      <tr key={`${item.title}-${index}`} className="align-top hover:bg-indigo-50/20">
                        <td className="px-4 py-3 text-xs font-semibold text-slate-500">{index + 1}</td>
                        <td className="px-4 py-3 text-xs font-semibold text-slate-900">{item.title}</td>
                        <td className="px-4 py-3 text-xs leading-5 text-slate-600">{item.detail || '—'}</td>
                        <td className="px-4 py-3 text-right text-xs text-slate-600">
                          {item.dueInDays != null ? `${item.dueInDays} day${item.dueInDays === 1 ? '' : 's'}` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {!hasAlerts && !hasRecommendations ? (
              <div className="px-4 py-6 text-center text-sm text-slate-500">
                No alerts or recommendations in this brief. Run analysis again after new activity.
              </div>
            ) : null}
          </>
        )}

        <div className={`${PH2_TABLE_CARD_FOOTER_CLASS} flex flex-wrap items-center gap-4 text-xs`}>
          <Link href="/activity-feed" className="font-semibold text-indigo-600 hover:text-indigo-800">
            Activity log
          </Link>
          <Link href="/setting?section=alerts-management" className="font-semibold text-indigo-600 hover:text-indigo-800">
            AI alert settings
          </Link>
          {brief ? (
            <span className="text-slate-400">
              Last run: {brief.createdAt ? formatDateTimeDMY(brief.createdAt) : '—'}
            </span>
          ) : null}
        </div>
        </>
        )}
      </div>
    </section>
  );
}
