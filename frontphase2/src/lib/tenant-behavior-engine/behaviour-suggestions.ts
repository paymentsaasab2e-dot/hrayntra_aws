/**
 * Map tenant behaviour triggers → plain-language CRM task suggestions.
 * Ported from Phase 1 behaviour-user-suggestions.ts, adapted for CRM modules.
 */

import type { TenantBehaviourSuggestion, TenantBehaviourTrigger } from './types';

type CopyCtx = {
  topModule?: string;
  topEntity?: string;
  openLeads?: number;
  openJobs?: number;
  overdueFollowUps?: number;
};

export function suggestionFromTenantTrigger(
  trigger: TenantBehaviourTrigger,
  ctx: CopyCtx = {},
): TenantBehaviourSuggestion | null {
  const audience = trigger.audience || 'both';
  if (audience === 'hq') return null;

  switch (trigger.id) {
    case 'tenant_lead_convert_gap':
      return {
        triggerId: trigger.id,
        slotId: 'leads',
        kind: 'leads',
        title: 'Convert leads to clients',
        text: ctx.openLeads
          ? `You have ${ctx.openLeads} open leads but little client activity. Open Leads, pick the top 3, and schedule follow-up calls today.`
          : 'You spend time in Leads but rarely move to Clients. Open your lead list and convert at least one lead this week.',
        actionUrl: '/leads',
        priority: 88,
      };
    case 'tenant_job_pipeline_gap':
      return {
        triggerId: trigger.id,
        slotId: 'candidates',
        kind: 'candidates',
        title: 'Add candidates to open jobs',
        text: ctx.openJobs
          ? `${ctx.openJobs} open jobs need candidates. Go to Candidates, source 2–3 profiles, and submit them to matching jobs.`
          : 'Jobs module is active but candidate pipeline is lagging. Open Candidates and submit profiles to open requisitions.',
        actionUrl: '/candidates',
        priority: 86,
      };
    case 'tenant_browse_no_followthrough':
      return {
        triggerId: trigger.id,
        slotId: 'pipeline',
        kind: 'pipeline',
        title: 'Complete your next CRM action',
        text: ctx.topEntity
          ? `You keep opening "${ctx.topEntity}" but haven't taken action. Update the stage, assign a task, or schedule a follow-up now.`
          : 'You open many CRM records but rarely save or move pipeline. Pick one record and complete the next step.',
        actionUrl: '/pipeline',
        priority: 90,
      };
    case 'tenant_overdue_meetings_nudge':
      return {
        triggerId: trigger.id,
        slotId: 'leads',
        kind: 'leads',
        title: 'Clear overdue follow-ups',
        text: ctx.overdueFollowUps
          ? `${ctx.overdueFollowUps} overdue follow-up${ctx.overdueFollowUps === 1 ? '' : 's'} detected. Open Leads/Clients and complete or reschedule them now.`
          : 'Overdue meetings are blocking pipeline progress. Open your calendar and clear pending follow-ups.',
        actionUrl: '/leads',
        priority: 94,
      };
    case 'tenant_incomplete_records_nudge':
      return {
        triggerId: trigger.id,
        slotId: 'leads',
        kind: 'leads',
        title: 'Fill missing CRM fields',
        text: 'Some lead/client records have incomplete mandatory fields. Open the incomplete records and fill company, contact, and phone/email.',
        actionUrl: '/leads',
        priority: 87,
      };
    case 'tenant_entity_stuck':
      return {
        triggerId: trigger.id,
        slotId: 'pipeline',
        kind: 'pipeline',
        title: ctx.topEntity ? `Unblock: ${ctx.topEntity}` : 'Unblock stuck record',
        text: ctx.topEntity
          ? `You revisit "${ctx.topEntity}" often without action. Check if info is missing, approval is pending, or client feedback is needed.`
          : 'A record keeps getting reopened without progress. Check what is blocking the next step.',
        actionUrl: '/pipeline',
        priority: 82,
      };
    case 'tenant_ai_ops_combo':
      return {
        triggerId: trigger.id,
        slotId: 'ai',
        kind: 'ai',
        title: 'Convert AI research into actions',
        text: 'You use AI and Jobs modules but few operational actions follow. Try AI bulk CV match or AI job creation, then submit candidates.',
        actionUrl: '/brain',
        priority: 80,
      };
    case 'tenant_analytics_only':
      return {
        triggerId: trigger.id,
        slotId: 'candidates',
        kind: 'candidates',
        title: 'Move from reports to action',
        text: 'Most of your time is in Reports. Switch to Candidates or Interviews and complete at least one operational task today.',
        actionUrl: '/candidates',
        priority: 75,
      };
    case 'tenant_onboarding_struggle':
      return {
        triggerId: trigger.id,
        slotId: 'settings',
        kind: 'settings',
        title: 'Complete CRM setup',
        text: 'High activity but low pipeline progression suggests setup gaps. Review team settings, enable modules, and walk through the recruitment funnel.',
        actionUrl: '/settings',
        priority: 85,
      };
    case 'tenant_placement_gap':
      return {
        triggerId: trigger.id,
        slotId: 'placements',
        kind: 'placements',
        title: 'Close the placement loop',
        text: 'Interviews are happening but placements are lagging. Open Placements and move completed interviews to offer/placement stage.',
        actionUrl: '/placements',
        priority: 83,
      };
    case 'tenant_strong_operator':
      return {
        triggerId: trigger.id,
        slotId: 'ai',
        kind: 'ai',
        title: 'Try advanced automation',
        text: 'Strong end-to-end workflow detected. Explore AI bulk matching, automated pipeline rules, or team lead responsibilities.',
        actionUrl: '/brain',
        priority: 70,
      };
    default:
      return null;
  }
}

export function buildTenantBehaviourSuggestions(input: {
  triggers: TenantBehaviourTrigger[];
  topModule?: string;
  topEntity?: string;
  crmSnapshot?: {
    openLeads?: number | null;
    openJobs?: number | null;
    overdueFollowUps?: number | null;
  } | null;
}): TenantBehaviourSuggestion[] {
  if (!input.triggers?.length) return [];

  const ctx: CopyCtx = {
    topModule: input.topModule,
    topEntity: input.topEntity,
    openLeads: Number(input.crmSnapshot?.openLeads || 0) || undefined,
    openJobs: Number(input.crmSnapshot?.openJobs || 0) || undefined,
    overdueFollowUps: Number(input.crmSnapshot?.overdueFollowUps || 0) || undefined,
  };

  const out: TenantBehaviourSuggestion[] = [];
  const seen = new Set<string>();

  for (const trigger of input.triggers) {
    const suggestion = suggestionFromTenantTrigger(trigger, ctx);
    if (!suggestion || seen.has(suggestion.triggerId)) continue;
    seen.add(suggestion.triggerId);
    out.push(suggestion);
  }

  return out.sort((a, b) => b.priority - a.priority);
}

export function suggestionForSlot(
  slotId: string,
  suggestions: TenantBehaviourSuggestion[],
): TenantBehaviourSuggestion | undefined {
  return suggestions.find((s) => s.slotId === slotId);
}
