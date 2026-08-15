import { prisma, getActiveTenantDbName } from '../../config/prisma.js';
import { listTenantBehaviorSnapshots } from './tenant-behavior.service.js';

const ID_CAP = 40;
const OPEN_TASK = new Set(['PENDING', 'IN_PROGRESS', 'AWAITING_APPROVAL']);
const DONE_TASK = new Set(['DONE']);
const CLOSED_LEAD = new Set(['CONVERTED', 'LOST', 'CLOSED', 'converted', 'lost', 'closed']);
const OPEN_JOB = new Set(['OPEN', 'DRAFT', 'ON_HOLD']);
const DONE_JOB = new Set(['FILLED', 'CLOSED']);
const OPEN_INTERVIEW = new Set([
  'SCHEDULED',
  'CONFIRMED',
  'IN_PROGRESS',
  'FEEDBACK_PENDING',
  'RESCHEDULED',
]);
const DONE_INTERVIEW = new Set(['COMPLETED', 'FEEDBACK_SUBMITTED']);
const OPEN_PLACEMENT = new Set([
  'PENDING',
  'ACTIVE',
  'OFFER_SENT',
  'OFFER_ACCEPTED',
  'JOINING_SCHEDULED',
]);
const DONE_PLACEMENT = new Set(['COMPLETED', 'JOINED']);

function idStr(v) {
  if (v == null) return '';
  return String(v);
}

function idList(ids) {
  const unique = [...new Set((ids || []).map(idStr).filter(Boolean))];
  return {
    count: unique.length,
    ids: unique.slice(0, ID_CAP),
    truncated: unique.length > ID_CAP,
  };
}

function emptyBucket() {
  return {
    assigned: 0,
    open: 0,
    done: 0,
    unassigned: 0,
    ids: { assigned: idList([]), open: idList([]), done: idList([]) },
  };
}

function ensureUser(map, userId) {
  const id = idStr(userId);
  if (!id) return null;
  if (!map.has(id)) {
    map.set(id, {
      userId: id,
      workload: {
        tasks: {
          assigned: 0,
          open: 0,
          done: 0,
          overdue: 0,
          ids: { open: [], done: [], overdue: [] },
          linkedEntityIds: {},
        },
        leads: emptyBucket(),
        jobs: emptyBucket(),
        candidates: emptyBucket(),
        clients: emptyBucket(),
        interviews: emptyBucket(),
        placements: emptyBucket(),
      },
    });
  }
  return map.get(id);
}

function pushBucket(bucket, { assigned, open, done, id }) {
  if (assigned) {
    bucket.assigned += 1;
    bucket.ids.assigned.ids.push(id);
  }
  if (open) {
    bucket.open += 1;
    bucket.ids.open.ids.push(id);
  }
  if (done) {
    bucket.done += 1;
    bucket.ids.done.ids.push(id);
  }
}

function finalizeBucket(bucket) {
  bucket.ids.assigned = idList(bucket.ids.assigned.ids || bucket.ids.assigned);
  bucket.ids.open = idList(bucket.ids.open.ids || bucket.ids.open);
  bucket.ids.done = idList(bucket.ids.done.ids || bucket.ids.done);
  return bucket;
}

function assigneeIdsForLead(row) {
  const ids = new Set();
  if (row.assignedToId) ids.add(idStr(row.assignedToId));
  for (const extra of row.assignedToIds || []) {
    if (extra) ids.add(idStr(extra));
  }
  return [...ids];
}

function pickRollup(payload, range) {
  if (range === 'today') return payload?.rollupToday || {};
  if (range === 'month') return payload?.rollupMonth || payload?.rollup7d || {};
  if (range === 'year') return payload?.rollupYear || payload?.rollupMonth || payload?.rollup7d || {};
  return payload?.rollup7d || {};
}

function slimActivityFromSnapshot(snap, range) {
  const payload = snap.payload || {};
  const rollup = pickRollup(payload, range);
  const entities = Array.isArray(rollup.topEntities) ? rollup.topEntities : [];
  const openedIds = entities
    .map((e) => ({
      entityType: e.entityType,
      entityId: e.entityId,
      category: e.category,
      views: Number(e.views || 0),
      clicks: Number(e.clicks || 0),
      actions: Number(e.actions || 0),
    }))
    .filter((e) => e.entityId);

  return {
    userId: snap.userId,
    lastActive: payload.activityStateUpdatedAt || snap.capturedAt,
    capturedAt: snap.capturedAt,
    visits: Number(rollup.visits || 0),
    activeMs: Number(rollup.activeMs || 0),
    actions: Number(rollup.actions || 0),
    apiMutations: Number(rollup.apiMutations || 0),
    entityViews: Number(rollup.entityViews || 0),
    entityClicks: Number(rollup.entityClicks || 0),
    searches: Number(rollup.searches || 0),
    logins: Number(rollup.logins || 0),
    sessions: Number(rollup.sessionCount || 0),
    daysActive: Number(rollup.daysActive || 0),
    workflowScore: Number(rollup.workflowScore || 0),
    topFirstOpen: rollup.topFirstOpen || null,
    pageVisitsByCategory: rollup.pageVisitsByCategory || {},
    activeMsByCategory: rollup.activeMsByCategory || {},
    actionsByCategory: rollup.actionsByCategory || {},
    actionBreakdown: rollup.actionBreakdown || {},
    openedEntityIds: openedIds,
    triggerFlags: (Array.isArray(payload.triggers) ? payload.triggers : [])
      .map((t) => t?.flag)
      .filter(Boolean),
    interestKeys: (Array.isArray(payload.interestTopics) ? payload.interestTopics : [])
      .filter((t) => Number(t?.score || 0) > 0)
      .map((t) => ({ key: t.key, score: Number(t.score || 0) })),
  };
}

async function loadCrmWorkload() {
  const now = new Date();
  const [
    leads,
    jobs,
    candidates,
    clients,
    tasks,
    interviews,
    placements,
  ] = await Promise.all([
    prisma.lead
      .findMany({
        where: { isDeleted: { not: true } },
        select: { id: true, assignedToId: true, assignedToIds: true, status: true },
      })
      .catch(() => []),
    prisma.job
      .findMany({
        where: { isDeleted: { not: true } },
        select: { id: true, assignedToId: true, status: true },
      })
      .catch(() => []),
    prisma.candidate
      .findMany({
        where: { isDeleted: { not: true } },
        select: { id: true, assignedToId: true, status: true },
      })
      .catch(() => []),
    prisma.client
      .findMany({
        where: { isDeleted: { not: true } },
        select: { id: true, assignedToId: true, status: true },
      })
      .catch(() => []),
    prisma.task
      .findMany({
        select: {
          id: true,
          assignedToId: true,
          status: true,
          dueDate: true,
          linkedEntityType: true,
          linkedEntityId: true,
        },
      })
      .catch(() => []),
    prisma.interview
      .findMany({
        select: { id: true, interviewerId: true, createdById: true, status: true },
      })
      .catch(() => []),
    prisma.placement
      .findMany({
        where: { deletedAt: null },
        select: { id: true, recruiterId: true, status: true },
      })
      .catch(() => []),
  ]);

  const byUser = new Map();
  const tenant = {
    leads: { total: leads.length, assigned: 0, unassigned: 0, open: 0, done: 0, unassignedIds: [] },
    jobs: { total: jobs.length, assigned: 0, unassigned: 0, open: 0, done: 0, unassignedIds: [] },
    candidates: { total: candidates.length, assigned: 0, unassigned: 0, open: 0, done: 0, unassignedIds: [] },
    clients: { total: clients.length, assigned: 0, unassigned: 0, open: 0, done: 0, unassignedIds: [] },
    interviews: { total: interviews.length, assigned: 0, unassigned: 0, open: 0, done: 0, unassignedIds: [] },
    placements: { total: placements.length, assigned: 0, unassigned: 0, open: 0, done: 0, unassignedIds: [] },
    tasks: { total: tasks.length, assigned: 0, open: 0, done: 0, overdue: 0 },
  };

  for (const row of leads) {
    const id = idStr(row.id);
    const owners = assigneeIdsForLead(row);
    const status = String(row.status || '');
    const done = CLOSED_LEAD.has(status);
    const open = !done;
    if (open) tenant.leads.open += 1;
    if (done) tenant.leads.done += 1;
    if (!owners.length) {
      tenant.leads.unassigned += 1;
      tenant.leads.unassignedIds.push(id);
    } else {
      tenant.leads.assigned += 1;
      for (const uid of owners) {
        const user = ensureUser(byUser, uid);
        pushBucket(user.workload.leads, { assigned: true, open, done, id });
      }
    }
  }

  const simpleAssign = (rows, tenantKey, userKey, getOwner, isOpen, isDone) => {
    for (const row of rows) {
      const id = idStr(row.id);
      const owner = getOwner(row);
      const open = isOpen(row);
      const done = isDone(row);
      if (open) tenant[tenantKey].open += 1;
      if (done) tenant[tenantKey].done += 1;
      if (!owner) {
        tenant[tenantKey].unassigned += 1;
        tenant[tenantKey].unassignedIds.push(id);
      } else {
        tenant[tenantKey].assigned += 1;
        const user = ensureUser(byUser, owner);
        pushBucket(user.workload[userKey], { assigned: true, open, done, id });
      }
    }
  };

  simpleAssign(
    jobs,
    'jobs',
    'jobs',
    (r) => r.assignedToId,
    (r) => OPEN_JOB.has(String(r.status || '')),
    (r) => DONE_JOB.has(String(r.status || '')),
  );
  simpleAssign(
    candidates,
    'candidates',
    'candidates',
    (r) => r.assignedToId,
    (r) => !['PLACED', 'INACTIVE', 'BLACKLISTED'].includes(String(r.status || '')),
    (r) => String(r.status || '') === 'PLACED',
  );
  simpleAssign(
    clients,
    'clients',
    'clients',
    (r) => r.assignedToId,
    (r) => ['ACTIVE', 'PROSPECT'].includes(String(r.status || '')),
    (r) => String(r.status || '') === 'INACTIVE',
  );
  simpleAssign(
    interviews,
    'interviews',
    'interviews',
    (r) => r.interviewerId || r.createdById,
    (r) => OPEN_INTERVIEW.has(String(r.status || '')),
    (r) => DONE_INTERVIEW.has(String(r.status || '')),
  );
  simpleAssign(
    placements,
    'placements',
    'placements',
    (r) => r.recruiterId,
    (r) => OPEN_PLACEMENT.has(String(r.status || '')),
    (r) => DONE_PLACEMENT.has(String(r.status || '')),
  );

  for (const row of tasks) {
    const id = idStr(row.id);
    const owner = row.assignedToId;
    const status = String(row.status || '');
    const open = OPEN_TASK.has(status);
    const done = DONE_TASK.has(status);
    const overdue = open && row.dueDate && new Date(row.dueDate) < now;
    if (open) tenant.tasks.open += 1;
    if (done) tenant.tasks.done += 1;
    if (overdue) tenant.tasks.overdue += 1;
    if (owner) {
      tenant.tasks.assigned += 1;
      const user = ensureUser(byUser, owner);
      user.workload.tasks.assigned += 1;
      if (open) {
        user.workload.tasks.open += 1;
        user.workload.tasks.ids.open.push(id);
      }
      if (done) {
        user.workload.tasks.done += 1;
        user.workload.tasks.ids.done.push(id);
      }
      if (overdue) {
        user.workload.tasks.overdue += 1;
        user.workload.tasks.ids.overdue.push(id);
      }
      const linkedType = String(row.linkedEntityType || '').toUpperCase();
      if (linkedType && row.linkedEntityId) {
        if (!user.workload.tasks.linkedEntityIds[linkedType]) {
          user.workload.tasks.linkedEntityIds[linkedType] = [];
        }
        user.workload.tasks.linkedEntityIds[linkedType].push(idStr(row.linkedEntityId));
      }
    }
  }

  for (const user of byUser.values()) {
    user.workload.leads = finalizeBucket(user.workload.leads);
    user.workload.jobs = finalizeBucket(user.workload.jobs);
    user.workload.candidates = finalizeBucket(user.workload.candidates);
    user.workload.clients = finalizeBucket(user.workload.clients);
    user.workload.interviews = finalizeBucket(user.workload.interviews);
    user.workload.placements = finalizeBucket(user.workload.placements);
    const linked = {};
    for (const [type, ids] of Object.entries(user.workload.tasks.linkedEntityIds || {})) {
      linked[type] = idList(ids);
    }
    user.workload.tasks.ids = {
      open: idList(user.workload.tasks.ids.open),
      done: idList(user.workload.tasks.ids.done),
      overdue: idList(user.workload.tasks.ids.overdue),
    };
    user.workload.tasks.linkedEntityIds = linked;
  }

  for (const key of ['leads', 'jobs', 'candidates', 'clients', 'interviews', 'placements']) {
    tenant[key].unassignedIds = idList(tenant[key].unassignedIds);
  }

  return { byUser, tenant };
}

function sumActivity(usersActivity) {
  const out = {
    visits: 0,
    activeMs: 0,
    actions: 0,
    apiMutations: 0,
    entityViews: 0,
    entityClicks: 0,
    searches: 0,
    logins: 0,
    sessions: 0,
    trackedUsers: usersActivity.length,
    activeUsers: 0,
  };
  for (const u of usersActivity) {
    out.visits += u.visits;
    out.activeMs += u.activeMs;
    out.actions += u.actions;
    out.apiMutations += u.apiMutations;
    out.entityViews += u.entityViews;
    out.entityClicks += u.entityClicks;
    out.searches += u.searches;
    out.logins += u.logins;
    out.sessions += u.sessions;
    if (u.visits > 0 || u.activeMs > 0 || u.actions > 0) out.activeUsers += 1;
  }
  return out;
}

/**
 * Stats + entity ids only (no duplicated names). Tenant-wide and per-user.
 */
export async function buildEmployerBehaviorEngineReport({ range = 'week', userId } = {}) {
  const normalizedRange = ['today', 'week', 'month', 'year'].includes(range) ? range : 'week';
  const [snapshots, workload] = await Promise.all([
    listTenantBehaviorSnapshots({ limit: 200 }),
    loadCrmWorkload(),
  ]);

  const activityByUser = new Map(
    snapshots.map((snap) => [snap.userId, slimActivityFromSnapshot(snap, normalizedRange)]),
  );

  const userIds = new Set([...activityByUser.keys(), ...workload.byUser.keys()]);
  if (userId) {
    const only = idStr(userId);
    userIds.clear();
    userIds.add(only);
  }

  const users = [...userIds].map((id) => {
    const activity = activityByUser.get(id) || {
      userId: id,
      lastActive: null,
      capturedAt: null,
      visits: 0,
      activeMs: 0,
      actions: 0,
      apiMutations: 0,
      entityViews: 0,
      entityClicks: 0,
      searches: 0,
      logins: 0,
      sessions: 0,
      daysActive: 0,
      workflowScore: 0,
      topFirstOpen: null,
      pageVisitsByCategory: {},
      activeMsByCategory: {},
      actionsByCategory: {},
      actionBreakdown: {},
      openedEntityIds: [],
      triggerFlags: [],
      interestKeys: [],
    };
    const work = workload.byUser.get(id)?.workload || {
      tasks: {
        assigned: 0,
        open: 0,
        done: 0,
        overdue: 0,
        ids: { open: idList([]), done: idList([]), overdue: idList([]) },
        linkedEntityIds: {},
      },
      leads: emptyBucket(),
      jobs: emptyBucket(),
      candidates: emptyBucket(),
      clients: emptyBucket(),
      interviews: emptyBucket(),
      placements: emptyBucket(),
    };
    return { userId: id, activity, workload: work };
  });

  users.sort(
    (a, b) =>
      b.activity.actions - a.activity.actions ||
      b.workload.tasks.open - a.workload.tasks.open ||
      b.activity.activeMs - a.activity.activeMs,
  );

  return {
    engine: 'employers-behavior-engine',
    serverTime: new Date().toISOString(),
    tenantDbName: getActiveTenantDbName() || null,
    range: normalizedRange,
    storageNote:
      'Counts and entity ids only. Names/labels are not stored. Resolve ids against CRM when needed.',
    tenantWide: {
      activity: sumActivity(users.map((u) => u.activity)),
      workload: workload.tenant,
    },
    userCount: users.length,
    users,
  };
}
