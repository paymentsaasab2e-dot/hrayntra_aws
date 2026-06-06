import { prisma } from '../../config/prisma.js';
import { hasAnyPermission } from '../../utils/permissionScope.js';
import { isSuperAdminUser } from '../../utils/superAdminScope.js';
import { jobService } from '../job/job.service.js';
import { clientService } from '../client/client.service.js';
import { analyzeDataset } from './datasetAnalyzer.js';
import { applyRowFilters, parseFilters } from './dashboard.filters.js';
import { DATASET_REGISTRY, DASHBOARD_MODULE_ORDER } from './dashboard.registry.js';

const LIST_TAKE = 800;

function formatPersonName(person) {
  if (!person) return '';
  if (person.name) return String(person.name).trim();
  return [person.firstName, person.lastName].filter(Boolean).join(' ').trim();
}

const LEGACY_DATASET_IDS = {
  tasks: 'tasks_and_activity',
  activities: 'tasks_and_activity',
};

function resolveDatasetId(datasetId) {
  return LEGACY_DATASET_IDS[datasetId] || datasetId;
}

function canAccessDataset(req, dataset) {
  if (isSuperAdminUser(req) || hasAnyPermission(req, ['all'])) return true;
  return hasAnyPermission(req, dataset.permissions);
}

function metricsToRows(metrics) {
  if (!metrics || typeof metrics !== 'object') return [];
  const rows = [];
  for (const [key, value] of Object.entries(metrics)) {
    if (value && typeof value === 'object' && ('value' in value || 'count' in value)) {
      rows.push({
        metric: key,
        value: Number(value.value ?? value.count ?? 0),
        trend: Number(value.trend ?? 0),
        trendUp: Boolean(value.trendUp),
      });
    } else if (typeof value === 'number') {
      rows.push({ metric: key, value });
    }
  }
  return rows;
}

async function buildJobPipelineCounts(jobIds) {
  const map = new Map();
  if (!Array.isArray(jobIds) || !jobIds.length) return map;

  const entries = await prisma.pipelineEntry.findMany({
    where: { jobId: { in: jobIds } },
    select: {
      jobId: true,
      candidateId: true,
      stage: { select: { name: true, systemRole: true } },
    },
  });

  const seenByJobBucket = new Map();

  for (const entry of entries) {
    if (!entry.jobId || !entry.candidateId) continue;
    const stageText = String(entry.stage?.systemRole || entry.stage?.name || '').toLowerCase();
    let bucket = 'applied';
    if (stageText.includes('interview')) bucket = 'interviewed';
    else if (stageText.includes('offer')) bucket = 'offered';
    else if (stageText.includes('join') || stageText.includes('hire') || stageText.includes('placed')) {
      bucket = 'joined';
    }

    const dedupeKey = `${entry.jobId}:${entry.candidateId}:${bucket}`;
    if (seenByJobBucket.has(dedupeKey)) continue;
    seenByJobBucket.set(dedupeKey, true);

    if (!map.has(entry.jobId)) {
      map.set(entry.jobId, { applied: 0, interviewed: 0, offered: 0, joined: 0 });
    }
    map.get(entry.jobId)[bucket] += 1;
  }

  return map;
}

async function fetchJobsList() {
  const jobs = await prisma.job.findMany({
    where: { isDeleted: { not: true } },
    take: LIST_TAKE,
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      title: true,
      status: true,
      openings: true,
      postedDate: true,
      createdAt: true,
      updatedAt: true,
      client: { select: { companyName: true } },
      _count: {
        select: { matches: true, interviews: true, placements: true },
      },
    },
  });

  const pipelineCountsByJob = await buildJobPipelineCounts(jobs.map((j) => j.id));

  return jobs.map((j) => {
    const pipeline = pipelineCountsByJob.get(j.id) || {
      applied: 0,
      interviewed: 0,
      offered: 0,
      joined: 0,
    };
    const hasPipeline = pipeline.applied + pipeline.interviewed + pipeline.offered + pipeline.joined > 0;

    return {
      id: j.id,
      title: j.title,
      status: j.status,
      openings: j.openings,
      applied: hasPipeline ? pipeline.applied : Number(j._count?.matches ?? 0),
      interviewed: hasPipeline ? pipeline.interviewed : Number(j._count?.interviews ?? 0),
      offered: hasPipeline ? pipeline.offered : Number(j._count?.placements ?? 0),
      joined: hasPipeline ? pipeline.joined : 0,
      client: j.client?.companyName || 'No client',
      postedDate: j.postedDate,
      createdAt: j.createdAt,
      updatedAt: j.updatedAt,
    };
  });
}

const CLIENT_STAGE_BY_STATUS = {
  ACTIVE: 'Active',
  PROSPECT: 'Active',
  ON_HOLD: 'On Hold',
  INACTIVE: 'Inactive',
};

/** Same list scope as GET /api/v1/clients (excludes deleted/system, respects RBAC). */
async function fetchClientsList(req) {
  const query = { ...(req.query || {}) };
  // Dashboard sends status=all for KPI filters; Prisma expects ClientStatus enum only.
  delete query.status;

  const listReq = {
    ...req,
    query: {
      ...query,
      page: '1',
      limit: String(LIST_TAKE),
      includeLeadFields: 'true',
    },
  };
  const paginated = await clientService.getAll(listReq);
  const clients = Array.isArray(paginated?.data) ? paginated.data : [];

  return clients.map((c) => ({
    id: c.id,
    name: c.companyName,
    companyName: c.companyName,
    status: c.status || 'UNKNOWN',
    leadStatus: c.leadStatus || '',
    stage: CLIENT_STAGE_BY_STATUS[c.status] || 'Active',
    priority: c.priority || '',
    industry: c.industry || '',
    location: c.location || c.hiringLocations || '',
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }));
}

async function fetchLeadCommunicationStats(leadIds) {
  const stats = new Map();
  if (!leadIds.length) return stats;

  for (const id of leadIds) {
    stats.set(id, {
      totalCalls: 0,
      totalEmails: 0,
      totalWhatsapp: 0,
      whatsappSender: '',
      latestActivityRemark: '',
    });
  }

  const activities = await prisma.activity.findMany({
    where: {
      entityType: 'LEAD',
      entityId: { in: leadIds },
    },
    select: {
      entityId: true,
      action: true,
      description: true,
      performedBy: {
        select: { name: true, firstName: true, lastName: true, email: true },
      },
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const classify = (action, description) => {
    const blob = `${action || ''} ${description || ''}`.toLowerCase();
    if (/\bcall\b|phone call|logged call|call log/.test(blob)) return 'call';
    if (/whatsapp|whats app|whats-app/.test(blob)) return 'whatsapp';
    if (/\bemail\b|e-mail|mail sent|sent email/.test(blob)) return 'email';
    return 'other';
  };

  for (const activity of activities) {
    const id = activity.entityId;
    if (!id || !stats.has(id)) continue;
    const entry = stats.get(id);
    const kind = classify(activity.action, activity.description);

    if (kind === 'call') entry.totalCalls += 1;
    else if (kind === 'email') entry.totalEmails += 1;
    else if (kind === 'whatsapp') {
      entry.totalWhatsapp += 1;
      if (!entry.whatsappSender) {
        entry.whatsappSender =
          formatPersonName(activity.performedBy) || activity.performedBy?.email || '';
      }
    }

    if (!entry.latestActivityRemark) {
      const remark = String(activity.description || activity.action || '').trim();
      if (remark) entry.latestActivityRemark = remark;
    }
  }

  return stats;
}

async function fetchLeadsList() {
  const leads = await prisma.lead.findMany({
    where: { isDeleted: { not: true } },
    take: LIST_TAKE,
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      companyName: true,
      contactPerson: true,
      email: true,
      phone: true,
      notes: true,
      status: true,
      source: true,
      location: true,
      lastFollowUp: true,
      nextFollowUp: true,
      createdAt: true,
      updatedAt: true,
      assignedTo: { select: { id: true, firstName: true, lastName: true, name: true, email: true } },
    },
  });

  const commStats = await fetchLeadCommunicationStats(leads.map((l) => l.id));

  return leads.map((lead) => {
    const assigneeName =
      [lead.assignedTo?.firstName, lead.assignedTo?.lastName].filter(Boolean).join(' ').trim() ||
      lead.assignedTo?.name ||
      lead.assignedTo?.email ||
      'Unassigned';

    const activityStats = commStats.get(lead.id) || {
      totalCalls: 0,
      totalEmails: 0,
      totalWhatsapp: 0,
      whatsappSender: '',
      latestActivityRemark: '',
    };

    return {
      id: lead.id,
      leadName: lead.companyName || lead.contactPerson || 'Unnamed lead',
      companyName: lead.companyName,
      contactPerson: lead.contactPerson,
      email: lead.email || '',
      phone: lead.phone || '',
      status: lead.status,
      source: lead.source,
      location: lead.location,
      assignedTo: assigneeName,
      remarks: lead.notes || '',
      totalCalls: activityStats.totalCalls,
      totalEmails: activityStats.totalEmails,
      totalWhatsapp: activityStats.totalWhatsapp,
      whatsappSender: activityStats.whatsappSender,
      latestActivityRemark: activityStats.latestActivityRemark,
      lastFollowUp: lead.lastFollowUp,
      nextFollowUp: lead.nextFollowUp,
      lastActivity: lead.updatedAt,
      alert:
        lead.nextFollowUp && new Date(lead.nextFollowUp) < new Date() ? 'Follow-up overdue' : '',
      createdAt: lead.createdAt,
      updatedAt: lead.updatedAt,
    };
  });
}

async function fetchCandidatesList() {
  const candidates = await prisma.candidate.findMany({
    take: LIST_TAKE,
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      status: true,
      source: true,
      location: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return candidates.map((c) => ({
    id: c.id,
    name: [c.firstName, c.lastName].filter(Boolean).join(' ').trim() || 'Unnamed',
    status: String(c.status || 'NEW'),
    source: c.source || '',
    location: c.location || '',
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }));
}

async function fetchInterviewsList() {
  const interviews = await prisma.interview.findMany({
    take: LIST_TAKE,
    orderBy: { scheduledAt: 'desc' },
    select: {
      id: true,
      status: true,
      round: true,
      scheduledAt: true,
      createdAt: true,
      candidate: { select: { firstName: true, lastName: true } },
      job: { select: { title: true } },
    },
  });
  return interviews.map((i) => ({
    id: i.id,
    status: i.status,
    round: i.round,
    scheduledAt: i.scheduledAt,
    createdAt: i.createdAt,
    candidate: formatPersonName(i.candidate) || 'Unnamed',
    job: i.job?.title,
  }));
}

async function fetchPlacementsList() {
  const placements = await prisma.placement.findMany({
    take: LIST_TAKE,
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      status: true,
      revenue: true,
      placementFee: true,
      offerDate: true,
      joiningDate: true,
      createdAt: true,
      updatedAt: true,
      candidate: { select: { firstName: true, lastName: true } },
      client: { select: { companyName: true } },
    },
  });
  return placements.map((p) => ({
    id: p.id,
    status: p.status,
    revenue: Number(p.revenue ?? p.placementFee ?? 0),
    offerDate: p.offerDate,
    joiningDate: p.joiningDate,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    candidate: formatPersonName(p.candidate) || 'Unnamed',
    client: p.client?.companyName,
  }));
}

async function fetchTasksAndActivity() {
  const [tasks, activities] = await Promise.all([
    prisma.teamTask.findMany({
      take: LIST_TAKE,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        taskTitle: true,
        description: true,
        status: true,
        dueDate: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.userActivity.findMany({
      take: LIST_TAKE,
      orderBy: { timestamp: 'desc' },
      select: {
        id: true,
        action: true,
        module: true,
        timestamp: true,
      },
    }),
  ]);

  const taskRows = tasks.map((t) => ({
    id: t.id,
    recordType: 'Task',
    title: t.taskTitle,
    taskTitle: t.taskTitle,
    status: t.status,
    module: 'Tasks',
    description: t.description || '',
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    dueDate: t.dueDate,
    timestamp: t.createdAt,
  }));

  const actRows = activities.map((a) => ({
    id: a.id,
    recordType: 'Activity',
    title: a.action,
    status: a.module,
    module: a.module || 'Activity',
    timestamp: a.timestamp,
    createdAt: a.timestamp,
    updatedAt: a.timestamp,
  }));

  return [...taskRows, ...actRows];
}

async function fetchTeamList() {
  const users = await prisma.user.findMany({
    take: LIST_TAKE,
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      name: true,
      email: true,
      status: true,
      department: true,
      departmentId: true,
      createdAt: true,
      updatedAt: true,
      departmentRelation: { select: { id: true, name: true } },
      systemRole: { select: { roleName: true } },
    },
  });

  return users.map((u) => {
    const fullName =
      [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.name || u.email;
    return {
      id: u.id,
      name: fullName,
      email: u.email,
      status: u.status || 'ACTIVE',
      department: u.departmentRelation?.name || u.department || 'Unassigned',
      departmentId: u.departmentId || u.departmentRelation?.id || '',
      role: u.systemRole?.roleName || 'No role',
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    };
  });
}

async function fetchDepartmentsList() {
  const departments = await prisma.department.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { users: true } } },
  });

  return departments.map((d) => ({
    id: d.id,
    name: d.name,
    description: d.description || '',
    memberCount: d._count.users,
    status: d._count.users > 0 ? 'Active' : 'Empty',
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  }));
}

async function fetchCandidatePipeline(req) {
  const { candidateService } = await import('../candidate/candidate.service.js');
  const stats = await candidateService.getStats(req, {});
  const data = stats?.data || stats || {};
  const stages = [
    { stage: 'Applied', count: Number(data.applied ?? 0) },
    { stage: 'Longlist', count: Number(data.longlist ?? 0) },
    { stage: 'Shortlist', count: Number(data.shortlist ?? 0) },
    { stage: 'Screening', count: Number(data.screening ?? 0) },
    { stage: 'Submitted', count: Number(data.submitted ?? 0) },
    { stage: 'Interviewing', count: Number(data.interviewing ?? 0) },
    { stage: 'Offered', count: Number(data.offered ?? 0) },
    { stage: 'Hired', count: Number(data.hired ?? 0) },
    { stage: 'Rejected', count: Number(data.rejected ?? 0) },
  ];
  const total = Number(data.all ?? 0) || stages.reduce((sum, s) => sum + s.count, 0);
  if (total === 0) {
    return [{ stage: 'No candidates', count: 0 }];
  }
  return stages;
}

function enrichSuggestedConfig(datasetId, analysis) {
  const suggested = { ...(analysis?.suggested || {}) };
  if (datasetId === 'candidates_pipeline') {
    suggested.categoryField = 'stage';
    suggested.valueField = 'count';
    if (!suggested.chartType || suggested.chartType === 'kpi') suggested.chartType = 'bar';
  } else if (
    datasetId === 'clients' ||
    datasetId === 'leads' ||
    datasetId === 'jobs' ||
    datasetId === 'candidates' ||
    datasetId === 'team' ||
    datasetId === 'departments'
  ) {
    suggested.categoryField = suggested.categoryField || (datasetId === 'departments' ? 'name' : 'status');
    suggested.valueField = datasetId === 'departments' ? 'memberCount' : null;
    if (suggested.chartType === 'kpi') suggested.chartType = 'pie';
    if (suggested.chartType === 'pie' || suggested.chartType === 'donut') {
      suggested.categoryField = suggested.categoryField || 'status';
    }
  } else if (datasetId === 'tasks_and_activity') {
    suggested.categoryField = suggested.categoryField || 'recordType';
    suggested.valueField = null;
    if (suggested.chartType === 'kpi') suggested.chartType = 'bar';
  } else if (datasetId.endsWith('_metrics') || datasetId.endsWith('_kpis') || datasetId.endsWith('_stats')) {
    suggested.categoryField = 'metric';
    suggested.valueField = 'value';
    if (suggested.chartType === 'pie' || suggested.chartType === 'kpi') suggested.chartType = 'bar';
  } else if (datasetId === 'placements') {
    suggested.categoryField = suggested.categoryField || 'status';
    suggested.valueField = suggested.valueField || 'revenue';
  }
  return suggested;
}

function getFilterOptions(datasetId, filters, rows) {
  const defs = [...(DATASET_REGISTRY.find((d) => d.id === datasetId)?.filters || [])];
  return defs.map((def) => {
    if (def.key !== 'status' || def.options?.length > 1) return def;
    const statuses = new Set();
    for (const row of rows) {
      const val = row.leadStatus || row.status || row.stage;
      if (val) statuses.add(String(val));
    }
    return {
      ...def,
      options: [
        { value: 'all', label: 'All Status' },
        ...[...statuses].sort().map((v) => ({ value: v, label: v })),
      ],
    };
  });
}

function sanitizeWidgetsToSinglePerModule(widgets = []) {
  if (!Array.isArray(widgets)) return [];
  const next = [];
  const seen = new Map();
  for (const widget of widgets) {
    if (!widget || typeof widget !== 'object') continue;
    const key = String(widget.module || widget.datasetId || '').trim().toLowerCase();
    if (!key) {
      next.push(widget);
      continue;
    }
    const existingIndex = seen.get(key);
    if (existingIndex === undefined) {
      seen.set(key, next.length);
      next.push(widget);
    } else {
      next[existingIndex] = widget;
    }
  }
  return next;
}

const LEGACY_MODULE_KEYS = {
  leads: 'leads',
  clients: 'clients',
  jobs: 'jobs',
  candidates: 'candidates',
  interviews: 'interviews',
  placements: 'placements',
  pipeline: 'pipeline',
  matches: 'matches',
  tasks: 'tasks',
  'task and activity': 'tasks',
  team: 'team',
  departments: 'departments',
};

function legacyWidgetsToModules(widgets) {
  const modules = {};
  for (const widget of sanitizeWidgetsToSinglePerModule(widgets)) {
    const key = LEGACY_MODULE_KEYS[String(widget.module || '').trim().toLowerCase()];
    if (!key) continue;
    modules[key] = { widgets: [widget], hiddenDefaultIds: [], dismissed: false };
  }
  return modules;
}

/** Accept legacy widget array or v2 `{ version: 2, modules }` command-center layout. */
function normalizeDashboardLayoutPayload(raw) {
  if (Array.isArray(raw)) {
    return { version: 2, modules: legacyWidgetsToModules(raw), hiddenTabs: [] };
  }
  if (raw && typeof raw === 'object' && raw.version === 2) {
    const modules = raw.modules && typeof raw.modules === 'object' ? raw.modules : {};
    const safe = {};
    for (const [key, mod] of Object.entries(modules)) {
      if (!mod || typeof mod !== 'object') continue;
      safe[key] = {
        widgets: Array.isArray(mod.widgets) ? mod.widgets : [],
        hiddenDefaultIds: Array.isArray(mod.hiddenDefaultIds) ? mod.hiddenDefaultIds : [],
        dismissed: Boolean(mod.dismissed),
        customized: Boolean(mod.customized),
      };
    }
    return {
      version: 2,
      modules: safe,
      hiddenTabs: Array.isArray(raw.hiddenTabs) ? raw.hiddenTabs : [],
    };
  }
  return { version: 2, modules: {}, hiddenTabs: [] };
}

async function fetchDatasetRows(datasetId, req, filters) {
  let rows;
  switch (datasetId) {
    case 'jobs':
      rows = await fetchJobsList();
      break;
    case 'jobs_metrics': {
      const metrics = await jobService.getMetrics(req);
      rows = metricsToRows(metrics);
      break;
    }
    case 'candidates':
      rows = await fetchCandidatesList();
      break;
    case 'candidates_pipeline':
      rows = await fetchCandidatePipeline(req);
      return rows;
    case 'clients':
      rows = await fetchClientsList(req);
      break;
    case 'clients_metrics': {
      const metrics = await clientService.getMetrics(req);
      rows = metricsToRows(metrics);
      break;
    }
    case 'leads':
      rows = await fetchLeadsList();
      break;
    case 'interviews':
      rows = await fetchInterviewsList();
      break;
    case 'interviews_kpis': {
      const { interviewService } = await import('../interview/interview.service.js');
      const kpis = await interviewService.getKpis(req);
      rows = metricsToRows(kpis?.data || kpis);
      break;
    }
    case 'placements':
      rows = await fetchPlacementsList();
      break;
    case 'placements_stats': {
      const { placementService } = await import('../placement/placement.service.js');
      const stats = await placementService.getStats(req);
      rows = metricsToRows(stats?.data || stats);
      break;
    }
    case 'tasks_and_activity':
      rows = await fetchTasksAndActivity();
      break;
    case 'team':
      rows = await fetchTeamList();
      break;
    case 'departments':
      rows = await fetchDepartmentsList();
      break;
    default:
      throw new Error('Unknown dataset');
  }

  const statusKey = datasetId === 'candidates_pipeline' ? 'stage' : 'status';
  return applyRowFilters(rows, filters, {
    statusKey,
    dateKeys: ['createdAt', 'timestamp', 'scheduledAt', 'updatedAt', 'dueDate', 'postedDate'],
  });
}

/**
 * Executive KPI strip — thin wrapper on reports summary (last 30 days default).
 */
async function getOverview(req) {
  const { reportService } = await import('../report/report.service.js');
  const summary = await reportService.getSummary(
    { dateRange: 'last_30_days', entities: 'leads,clients,jobs,candidates,interviews,placements,tasks,activities' },
    req.user,
  );

  const entityCounts = summary?.entityCounts || {};
  const rp = summary?.recruitmentPerformance?.kpis || {};
  const ap = summary?.activityProductivity?.kpis || {};
  const pr = summary?.placementsRevenue?.kpis || {};

  return {
    kpis: {
      leads: Number(entityCounts.leads ?? 0),
      clients: Number(entityCounts.clients ?? 0),
      activeJobs: Number(rp.totalOpenJobs ?? 0),
      candidates: Number(entityCounts.candidates ?? rp.activeCandidates ?? 0),
      interviews: Number(rp.interviews ?? entityCounts.interviews ?? 0),
      placements: Number(rp.placements ?? entityCounts.placements ?? 0),
      revenue: Number(pr.totalRevenue ?? 0),
      tasksDueToday: Number(ap.overdueTasks ?? 0),
      tasksCompleted: Number(ap.tasksCompleted ?? 0),
      callsMade: Number(ap.callsMade ?? 0),
      emailsSent: Number(ap.emailsSent ?? 0),
    },
    pipelineFunnel: summary?.pipelineFunnel?.funnel || [],
    teamLeaderboard: summary?.teamPerformance?.leaderboard || [],
    recruitmentTrend: summary?.recruitmentPerformance?.trend || [],
  };
}

export const dashboardService = {
  getOverview,

  listCatalog(req) {
    const datasets = DATASET_REGISTRY.filter((d) => canAccessDataset(req, d)).map(
      ({ permissions, ...rest }) => rest
    );
    const modules = DASHBOARD_MODULE_ORDER.map((name) => ({
      name,
      datasets: datasets.filter((d) => d.module === name),
    })).filter((m) => m.datasets.length > 0);
    return { datasets, modules };
  },

  async fetchDataset(datasetId, req) {
    const resolvedId = resolveDatasetId(datasetId);
    const dataset = DATASET_REGISTRY.find((d) => d.id === resolvedId);
    if (!dataset) throw new Error('Dataset not found');
    if (!canAccessDataset(req, dataset)) {
      throw new Error('You do not have permission to access this dataset');
    }

    const filters = parseFilters(req.query);
    const rows = await fetchDatasetRows(resolvedId, req, filters);
    const analysis = analyzeDataset(rows);
    const suggested = enrichSuggestedConfig(resolvedId, analysis);
    const filterDefinitions = getFilterOptions(resolvedId, filters, rows);

    return {
      dataset: { id: dataset.id, label: dataset.label, module: dataset.module, kind: dataset.kind },
      rows,
      rowCount: rows.length,
      filters: filterDefinitions,
      appliedFilters: filters,
      analysis: {
        ...analysis,
        suggested,
      },
    };
  },

  analyzeRows(rows) {
    return analyzeDataset(rows);
  },

  async getLayout(userId) {
    const layout = await prisma.userDashboardLayout.findUnique({ where: { userId } });
    const stored = normalizeDashboardLayoutPayload(layout?.widgets);
    return {
      layout: stored,
      widgets: stored,
      version: stored.version ?? 2,
      updatedAt: layout?.updatedAt ?? null,
    };
  },

  async saveLayout(userId, body = {}) {
    const stored = normalizeDashboardLayoutPayload(body.layout ?? body.widgets ?? body);
    const layout = await prisma.userDashboardLayout.upsert({
      where: { userId },
      create: { userId, widgets: stored, version: 2 },
      update: { widgets: stored, version: 2 },
    });
    const normalized = normalizeDashboardLayoutPayload(layout.widgets);
    return {
      layout: normalized,
      widgets: normalized,
      version: 2,
      updatedAt: layout.updatedAt,
    };
  },
};
