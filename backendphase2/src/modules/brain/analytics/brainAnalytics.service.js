/**
 * Brain analytics — live tenant metrics only (no fabrication).
 */

import {
  executeAssistantDataTool,
  safeSerialize,
} from '../../ai/assistantDataTools.js';
import { canAccessEntity } from '../permissions/brainPermissions.service.js';
import { logBrainAction } from '../monitoring/brainAudit.service.js';

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function buildTenantAnalyticsSnapshot(user) {
  const started = Date.now();
  const allowedCounts = canAccessEntity(user, 'lead') || canAccessEntity(user, 'job');

  if (!allowedCounts) {
    logBrainAction({
      user,
      action: 'analytics.snapshot',
      status: 'denied',
      outputSummary: 'No entity read permission',
      durationMs: Date.now() - started,
    });
    return {
      ok: false,
      error: 'Insufficient permissions for analytics',
      metrics: null,
    };
  }

  const counts = await executeAssistantDataTool(user, { query_type: 'counts' });
  const raw = counts?.data || counts || {};

  const metrics = {
    leads: num(raw.leads ?? raw.leadCount ?? raw.Leads),
    clients: num(raw.clients ?? raw.clientCount ?? raw.Clients),
    jobs: num(raw.jobs ?? raw.jobCount ?? raw.Jobs),
    candidates: num(raw.candidates ?? raw.candidateCount ?? raw.Candidates),
    interviews: num(raw.interviews ?? raw.interviewCount ?? raw.Interviews),
    placements: num(raw.placements ?? raw.placementCount ?? raw.Placements),
    tasks: num(raw.tasks ?? raw.taskCount ?? raw.Tasks),
    source: 'live_tenant_query',
    generatedAt: new Date().toISOString(),
  };

  // Normalize if counts tool returns nested shape
  if (raw && typeof raw === 'object') {
    for (const key of Object.keys(metrics)) {
      if (key === 'source' || key === 'generatedAt') continue;
      if (raw[key] != null && typeof raw[key] === 'object' && raw[key].total != null) {
        metrics[key] = num(raw[key].total);
      } else if (typeof raw[key] === 'number') {
        metrics[key] = raw[key];
      }
    }
  }

  logBrainAction({
    user,
    action: 'analytics.snapshot',
    status: 'ok',
    outputSummary: safeSerialize(metrics).slice(0, 400),
    durationMs: Date.now() - started,
  });

  return { ok: true, metrics, raw: counts };
}

export function summarizeBusinessPerformance(metrics) {
  if (!metrics) {
    return 'No live metrics available for your role.';
  }
  const lines = [
    '**Business performance (live tenant data)**',
    '',
    `• Leads: **${metrics.leads}**`,
    `• Clients: **${metrics.clients}**`,
    `• Jobs: **${metrics.jobs}**`,
    `• Candidates: **${metrics.candidates}**`,
    `• Interviews: **${metrics.interviews}**`,
    `• Placements: **${metrics.placements}**`,
    `• Tasks: **${metrics.tasks}**`,
    '',
    '_Source: authorized live queries — not estimates._',
  ];

  const recommendations = [];
  if (metrics.leads > 0 && metrics.clients === 0) {
    recommendations.push('Convert qualified leads into clients to open jobs.');
  }
  if (metrics.jobs > 0 && metrics.candidates === 0) {
    recommendations.push('Source candidates for open jobs.');
  }
  if (metrics.candidates > 0 && metrics.interviews === 0) {
    recommendations.push('Schedule interviews to move the pipeline forward.');
  }
  if (metrics.interviews > 0 && metrics.placements === 0) {
    recommendations.push('Close interview outcomes into placements where offers are accepted.');
  }
  if (recommendations.length) {
    lines.push('', '**Recommended actions**');
    recommendations.forEach((r, i) => lines.push(`${i + 1}. ${r}`));
  }
  return lines.join('\n');
}

export const brainAnalytics = {
  buildTenantAnalyticsSnapshot,
  summarizeBusinessPerformance,
};
