import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';

const MAX_ROWS = 80;
const DEFAULT_ROWS = 28;
const MAX_JSON_CHARS = 16000;

/**
 * When `ASSISTANT_FULL_DB_ACCESS=true`, any authenticated user can read all rows (single-tenant / demo only).
 * Otherwise: SUPER_ADMIN & ADMIN see org-wide data; other roles see records they own, are assigned to, or created.
 */
export function userHasFullDbAccess(user) {
  if (env.ASSISTANT_FULL_DB_ACCESS === 'true') return true;
  const r = user?.role;
  return r === 'SUPER_ADMIN' || r === 'ADMIN' || r === 'MANAGER';
}

function limitRows(n) {
  const x = parseInt(String(n), 10);
  if (Number.isNaN(x)) return DEFAULT_ROWS;
  return Math.min(Math.max(x, 1), MAX_ROWS);
}

export function safeSerialize(obj) {
  const str = JSON.stringify(obj, (_, v) => (v instanceof Date ? v.toISOString() : v));
  if (str.length <= MAX_JSON_CHARS) return str;
  return `${str.slice(0, MAX_JSON_CHARS)}\n...[truncated ${str.length - MAX_JSON_CHARS} chars]`;
}

function mergeScope(scope, extra) {
  if (!extra || Object.keys(extra).length === 0) return scope || {};
  if (!scope || Object.keys(scope).length === 0) return extra;
  return { AND: [scope, extra] };
}

function candidateScope(user) {
  if (userHasFullDbAccess(user)) return {};
  const uid = user?.id;
  if (!uid) return { id: '__none__' };
  return { OR: [{ assignedToId: uid }, { createdById: uid }] };
}

function jobScope(user) {
  if (userHasFullDbAccess(user)) return {};
  const uid = user?.id;
  if (!uid) return { id: '__none__' };
  return { OR: [{ createdById: uid }, { assignedToId: uid }] };
}

function clientScope(user) {
  if (userHasFullDbAccess(user)) return {};
  const uid = user?.id;
  if (!uid) return { id: '__none__' };
  return { assignedToId: uid };
}

function leadScope(user) {
  if (userHasFullDbAccess(user)) return {};
  const uid = user?.id;
  if (!uid) return { id: '__none__' };
  return { assignedToId: uid };
}

function placementScope(user) {
  if (userHasFullDbAccess(user)) return {};
  const uid = user?.id;
  if (!uid) return { id: '__none__' };
  return {
    OR: [
      { recruiterId: uid },
      { job: { OR: [{ createdById: uid }, { assignedToId: uid }] } },
      { candidate: { OR: [{ assignedToId: uid }, { createdById: uid }] } },
    ],
  };
}

function interviewScope(user) {
  if (userHasFullDbAccess(user)) return {};
  const uid = user?.id;
  if (!uid) return { id: '__none__' };
  return {
    OR: [{ createdById: uid }, { interviewerId: uid }, { panelIds: { has: uid } }],
  };
}

function taskScope(user) {
  if (userHasFullDbAccess(user)) return {};
  const uid = user?.id;
  if (!uid) return { id: '__none__' };
  return { OR: [{ assignedToId: uid }, { createdById: uid }] };
}

function textOr(fields, term) {
  if (!term || !String(term).trim()) return {};
  const q = String(term).trim();
  return {
    OR: fields.map((field) => ({
      [field]: { contains: q },
    })),
  };
}

/**
 * @param {import('@prisma/client').User | any} user - req.user from auth middleware
 * @param {object} rawArgs - parsed function arguments from OpenAI
 */
export async function executeAssistantDataTool(user, rawArgs) {
  let args = rawArgs;
  if (typeof args === 'string') {
    try {
      args = JSON.parse(args);
    } catch {
      return { ok: false, error: 'Invalid tool arguments JSON' };
    }
  }

  const queryType = args?.query_type;
  const search = args?.search;
  const recordId = args?.record_id;
  const lim = limitRows(args?.limit);

  try {
    switch (queryType) {
      case 'counts': {
        const [candidates, jobs, clients, leads, placements, interviews, tasks, users] = await Promise.all([
          prisma.candidate.count({ where: candidateScope(user) }),
          prisma.job.count({ where: jobScope(user) }),
          prisma.client.count({ where: clientScope(user) }),
          prisma.lead.count({ where: leadScope(user) }),
          prisma.placement.count({
            where: mergeScope(placementScope(user), { deletedAt: null }),
          }),
          prisma.interview.count({ where: interviewScope(user) }),
          prisma.task.count({ where: taskScope(user) }),
          userHasFullDbAccess(user)
            ? prisma.user.count({ where: { isActive: true } })
            : prisma.user.count({ where: { id: user.id } }),
        ]);
        return {
          ok: true,
          scope: userHasFullDbAccess(user) ? 'organization' : 'assigned_or_created',
          data: {
            candidates,
            jobs,
            clients,
            leads,
            placements,
            interviews,
            tasks,
            activeUsers: users,
          },
        };
      }

      case 'candidates': {
        const where = mergeScope(candidateScope(user), textOr(['firstName', 'lastName', 'email', 'currentTitle'], search));
        const rows = await prisma.candidate.findMany({
          where,
          take: lim,
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            status: true,
            stage: true,
            currentTitle: true,
            location: true,
            assignedToId: true,
            createdById: true,
            createdAt: true,
            updatedAt: true,
          },
        });
        return { ok: true, count: rows.length, data: rows };
      }

      case 'jobs': {
        const where = mergeScope(jobScope(user), textOr(['title', 'department', 'location'], search));
        const rows = await prisma.job.findMany({
          where,
          take: lim,
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            title: true,
            status: true,
            type: true,
            location: true,
            clientId: true,
            assignedToId: true,
            createdById: true,
            openings: true,
            createdAt: true,
            updatedAt: true,
            client: { select: { companyName: true } },
          },
        });
        return { ok: true, count: rows.length, data: rows };
      }

      case 'clients': {
        const where = mergeScope(clientScope(user), textOr(['companyName', 'industry', 'location'], search));
        const rows = await prisma.client.findMany({
          where,
          take: lim,
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            companyName: true,
            status: true,
            industry: true,
            location: true,
            assignedToId: true,
            website: true,
            createdAt: true,
            updatedAt: true,
          },
        });
        return { ok: true, count: rows.length, data: rows };
      }

      case 'leads': {
        const where = mergeScope(
          leadScope(user),
          textOr(['companyName', 'contactPerson', 'email', 'phone'], search)
        );
        const rows = await prisma.lead.findMany({
          where,
          take: lim,
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            companyName: true,
            contactPerson: true,
            email: true,
            phone: true,
            status: true,
            source: true,
            type: true,
            priority: true,
            assignedToId: true,
            lastFollowUp: true,
            nextFollowUp: true,
            createdAt: true,
            updatedAt: true,
          },
        });
        return { ok: true, count: rows.length, data: rows };
      }

      case 'placements': {
        const where = mergeScope(placementScope(user), { deletedAt: null });
        const rows = await prisma.placement.findMany({
          where,
          take: lim,
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            status: true,
            offerDate: true,
            joiningDate: true,
            salary: true,
            fee: true,
            revenue: true,
            recruiterId: true,
            candidate: { select: { firstName: true, lastName: true, email: true } },
            job: { select: { title: true } },
            client: { select: { companyName: true } },
            createdAt: true,
            updatedAt: true,
          },
        });
        return { ok: true, count: rows.length, data: rows };
      }

      case 'interviews': {
        const where = mergeScope(interviewScope(user), {});
        const rows = await prisma.interview.findMany({
          where,
          take: lim,
          orderBy: { scheduledAt: 'desc' },
          select: {
            id: true,
            status: true,
            type: true,
            mode: true,
            round: true,
            scheduledAt: true,
            duration: true,
            meetingLink: true,
            createdById: true,
            candidate: { select: { firstName: true, lastName: true, email: true } },
            job: { select: { title: true } },
            client: { select: { companyName: true } },
          },
        });
        return { ok: true, count: rows.length, data: rows };
      }

      case 'tasks': {
        const where = mergeScope(taskScope(user), textOr(['title', 'description'], search));
        const rows = await prisma.task.findMany({
          where,
          take: lim,
          orderBy: { dueDate: 'asc' },
          select: {
            id: true,
            title: true,
            description: true,
            status: true,
            priority: true,
            dueDate: true,
            taskType: true,
            assignedToId: true,
            createdById: true,
            linkedEntityType: true,
            linkedEntityId: true,
            createdAt: true,
          },
        });
        return { ok: true, count: rows.length, data: rows };
      }

      case 'team_users': {
        if (userHasFullDbAccess(user)) {
          const rows = await prisma.user.findMany({
            take: lim,
            where: { isActive: true },
            orderBy: { name: 'asc' },
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              department: true,
              designation: true,
              isActive: true,
            },
          });
          return { ok: true, count: rows.length, data: rows };
        }
        const selfUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            department: true,
            designation: true,
            isActive: true,
          },
        });
        return { ok: true, count: 1, data: selfUser ? [selfUser] : [], note: 'Non-admin: only your profile is listed.' };
      }

      case 'candidate_by_id': {
        if (!recordId) return { ok: false, error: 'record_id required' };
        const row = await prisma.candidate.findFirst({
          where: mergeScope(candidateScope(user), { id: recordId }),
          include: {
            assignedTo: { select: { id: true, name: true, email: true } },
            createdBy: { select: { id: true, name: true, email: true } },
          },
        });
        return row ? { ok: true, data: row } : { ok: false, error: 'Candidate not found or not accessible' };
      }

      case 'job_by_id': {
        if (!recordId) return { ok: false, error: 'record_id required' };
        const row = await prisma.job.findFirst({
          where: mergeScope(jobScope(user), { id: recordId }),
          include: {
            client: { select: { id: true, companyName: true, status: true } },
            assignedTo: { select: { id: true, name: true, email: true } },
            createdBy: { select: { id: true, name: true, email: true } },
          },
        });
        return row ? { ok: true, data: row } : { ok: false, error: 'Job not found or not accessible' };
      }

      case 'client_by_id': {
        if (!recordId) return { ok: false, error: 'record_id required' };
        const row = await prisma.client.findFirst({
          where: mergeScope(clientScope(user), { id: recordId }),
          include: {
            assignedTo: { select: { id: true, name: true, email: true } },
          },
        });
        return row ? { ok: true, data: row } : { ok: false, error: 'Client not found or not accessible' };
      }

      case 'lead_by_id': {
        if (!recordId) return { ok: false, error: 'record_id required' };
        const row = await prisma.lead.findFirst({
          where: mergeScope(leadScope(user), { id: recordId }),
          include: {
            assignedTo: { select: { id: true, name: true, email: true } },
          },
        });
        return row ? { ok: true, data: row } : { ok: false, error: 'Lead not found or not accessible' };
      }

      case 'placement_by_id': {
        if (!recordId) return { ok: false, error: 'record_id required' };
        const row = await prisma.placement.findFirst({
          where: mergeScope(placementScope(user), { id: recordId, deletedAt: null }),
          include: {
            candidate: true,
            job: { select: { id: true, title: true, status: true } },
            client: { select: { id: true, companyName: true } },
            recruiter: { select: { id: true, name: true, email: true } },
          },
        });
        return row ? { ok: true, data: row } : { ok: false, error: 'Placement not found or not accessible' };
      }

      default:
        return {
          ok: false,
          error: `Unknown query_type: ${queryType}. Use counts, candidates, jobs, clients, leads, placements, interviews, tasks, team_users, or *_by_id variants.`,
        };
    }
  } catch (e) {
    console.error('[executeAssistantDataTool]', queryType, e);
    return { ok: false, error: e.message || 'Database query failed' };
  }
}
