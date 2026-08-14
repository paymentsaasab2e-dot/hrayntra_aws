import type { TenantBehaviorEngineReport, TenantEngineUserRow } from './types';

export type EngineRecAudience = 'user' | 'tenant_admin' | 'hq_sales';

export type PeoplePerfProduct = 'crm' | 'recruitment';

export type EngineRec = {
  id: string;
  audience: EngineRecAudience;
  title: string;
  why: string;
  action: string;
};

const REC_PRODUCTS: Record<string, PeoplePerfProduct[]> = {
  user_leads_no_progress: ['crm'],
  user_task_backlog: ['crm'],
  admin_unassigned_leads: ['crm'],
  admin_overdue_tasks: ['crm'],
  sales_stuck_crm: ['crm'],
  user_jobs_no_candidates: ['recruitment'],
  user_interview_no_placement: ['recruitment'],
  admin_jobs_thin_pipeline: ['recruitment'],
  sales_expansion: ['recruitment'],
};

export function recsForProduct(recs: EngineRec[], product: PeoplePerfProduct) {
  return recs.filter((r) => (REC_PRODUCTS[r.id] || (['crm', 'recruitment'] as PeoplePerfProduct[])).includes(product));
}

function topCat(map: Record<string, number> | undefined) {
  let best = '';
  let n = 0;
  for (const [k, v] of Object.entries(map || {})) {
    if ((v || 0) > n) {
      n = v || 0;
      best = k;
    }
  }
  return { key: best, count: n };
}

/** Recs from activity + assigned/open/done counts (no names). */
export function buildEngineRecommendations(
  report: TenantBehaviorEngineReport | null,
  user?: TenantEngineUserRow,
): EngineRec[] {
  if (!report) return [];
  const tw = report.tenantWide;
  const recs: EngineRec[] = [];

  if (user) {
    const a = user.activity;
    const w = user.workload;
    const top = topCat(a.pageVisitsByCategory);
    const leadOpen = w.leads.open;
    const leadDone = w.leads.done;
    const jobOpen = w.jobs.open;
    const candOpen = w.candidates.open;
    const taskOpen = w.tasks.open;
    const taskOverdue = w.tasks.overdue;

    if (leadOpen >= 8 && leadDone === 0 && a.actions <= 3) {
      recs.push({
        id: 'user_leads_no_progress',
        audience: 'user',
        title: 'Move 1–2 leads forward',
        why: `${leadOpen} open leads assigned, ${leadDone} converted, ${a.actions} CRM actions this period.`,
        action: 'Open Leads, pick the oldest 2, schedule follow-up or convert.',
      });
    }

    if (jobOpen >= 1 && candOpen === 0 && (a.pageVisitsByCategory.jobs || 0) >= 4) {
      recs.push({
        id: 'user_jobs_no_candidates',
        audience: 'user',
        title: 'Add candidates to open jobs',
        why: `${jobOpen} open jobs, 0 assigned candidates in pipeline counts.`,
        action: 'Source 2 profiles and submit them to an open job.',
      });
    }

    if (a.entityViews >= 8 && a.actions <= 2) {
      recs.push({
        id: 'user_browse_no_action',
        audience: 'user',
        title: 'Finish the next step on a record',
        why: `${a.entityViews} record opens vs ${a.actions} saves/updates.`,
        action: 'Update stage, assign a task, or schedule an interview on one open record.',
      });
    }

    if (taskOverdue >= 1 || (taskOpen >= 5 && w.tasks.done === 0)) {
      recs.push({
        id: 'user_task_backlog',
        audience: 'user',
        title: 'Clear task backlog',
        why: `${taskOpen} open tasks, ${taskOverdue} overdue, ${w.tasks.done} done.`,
        action: 'Complete or reschedule overdue tasks first.',
      });
    }

    if (top.key === 'reports' && a.actions <= 2) {
      recs.push({
        id: 'user_reports_only',
        audience: 'user',
        title: 'Leave reports and work the funnel',
        why: 'Most visits are in reports with few CRM writes.',
        action: 'Go to Candidates or Interviews and complete one action.',
      });
    }

    if ((a.pageVisitsByCategory.interviews || 0) >= 5 && w.placements.open + w.placements.done === 0) {
      recs.push({
        id: 'user_interview_no_placement',
        audience: 'user',
        title: 'Move interviews to offer',
        why: 'Interview activity is up; placements still at 0.',
        action: 'Open completed interviews and log offer / placement.',
      });
    }

    const idleAssigned = leadOpen + jobOpen + candOpen;
    if (idleAssigned >= 10 && a.activeMs < 10 * 60 * 1000) {
      recs.push({
        id: 'admin_idle_assignee',
        audience: 'tenant_admin',
        title: 'Rebalance this assignee',
        why: `${idleAssigned} open records assigned, under 10m active this period.`,
        action: 'Reassign stale leads/jobs or check if this seat is unused.',
      });
    }

    if (a.actions >= 15 && w.leads.assigned === 0 && w.jobs.assigned === 0) {
      recs.push({
        id: 'admin_helper_unassigned',
        audience: 'tenant_admin',
        title: 'Active user with almost no ownership',
        why: `${a.actions} actions but 0 assigned leads/jobs.`,
        action: 'Give this user a named book of work so progress is measurable.',
      });
    }

    if (a.workflowScore >= 65 && a.actions >= 8) {
      recs.push({
        id: 'admin_power_user',
        audience: 'tenant_admin',
        title: 'Strong operator',
        why: `Workflow ${a.workflowScore}/100 with ${a.actions} actions.`,
        action: 'Use as coach / template for the rest of the team.',
      });
    }
  }

  const unassignedLeads = tw.workload.leads.unassigned;
  const assignedLeads = tw.workload.leads.assigned;
  const openJobs = tw.workload.jobs.open;
  const teamActions = tw.activity.actions;
  const activeUsers = tw.activity.activeUsers;
  const tracked = tw.activity.trackedUsers;
  const overdue = tw.workload.tasks.overdue;

  if (unassignedLeads >= 5) {
    recs.push({
      id: 'admin_unassigned_leads',
      audience: 'tenant_admin',
      title: 'Assign ownerless leads',
      why: `${unassignedLeads} unassigned vs ${assignedLeads} assigned.`,
      action: 'Bulk-assign owners so follow-ups have an accountable user.',
    });
  }

  if (openJobs >= 3 && tw.workload.candidates.open < 3) {
    recs.push({
      id: 'admin_jobs_thin_pipeline',
      audience: 'tenant_admin',
      title: 'Jobs without a candidate bench',
      why: `${openJobs} open jobs, ${tw.workload.candidates.open} open candidates.`,
      action: 'Set a sourcing SLA: N candidates per open job this week.',
    });
  }

  if (overdue >= 3) {
    recs.push({
      id: 'admin_overdue_tasks',
      audience: 'tenant_admin',
      title: 'Team overdue tasks',
      why: `${overdue} overdue tasks across the tenant.`,
      action: 'Daily standup: clear overdue before new work.',
    });
  }

  if (tracked >= 3 && activeUsers <= 1 && teamActions <= 5) {
    recs.push({
      id: 'sales_idle_seats',
      audience: 'hq_sales',
      title: 'Low seat utilization',
      why: `${activeUsers} of ${tracked} tracked users active, ${teamActions} team actions.`,
      action: 'CS/sales: adoption call, training, or seat cleanup before renewal.',
    });
  }

  if (tw.workload.leads.open >= 15 && tw.workload.clients.open <= 2 && teamActions <= 8) {
    recs.push({
      id: 'sales_stuck_crm',
      audience: 'hq_sales',
      title: 'CRM loaded, conversion weak',
      why: `${tw.workload.leads.open} open leads vs ${tw.workload.clients.open} clients, low actions.`,
      action: 'Offer playbook / onboarding; not an upsell until they convert.',
    });
  }

  if (
    tw.activity.visits >= 40 &&
    teamActions >= 20 &&
    tw.workload.jobs.open >= 2 &&
    tw.workload.interviews.open + tw.workload.placements.open >= 1
  ) {
    recs.push({
      id: 'sales_expansion',
      audience: 'hq_sales',
      title: 'Healthy funnel — expansion window',
      why: 'Team is using jobs + interviews/placements with real actions.',
      action: 'Pitch AI matching, extra seats, or higher plan when they hit limits.',
    });
  }

  if (tracked >= 1 && teamActions === 0 && tw.activity.visits >= 20) {
    recs.push({
      id: 'sales_browse_only_tenant',
      audience: 'hq_sales',
      title: 'Browsing tenant, no writes',
      why: `${tw.activity.visits} visits, 0 CRM actions.`,
      action: 'Sales follow-up: blocked setup, missing training, or tyre-kicker.',
    });
  }

  const order: Record<EngineRecAudience, number> = { user: 0, tenant_admin: 1, hq_sales: 2 };
  return recs.sort((a, b) => order[a.audience] - order[b.audience]);
}
