import { prisma } from '../config/prisma.js';

/** Minimal user fields for list audit columns. */
export const USER_BRIEF_SELECT = {
  id: true,
  name: true,
  email: true,
  avatar: true,
  firstName: true,
  lastName: true,
};

export function resolveUserDisplayName(user) {
  if (!user || typeof user !== 'object') return null;
  const fromParts = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return fromParts || user.name || user.email || null;
}

function toAuditUser(user) {
  if (!user || typeof user !== 'object') return null;
  const name = resolveUserDisplayName(user);
  if (!name && !user.email) return null;
  return {
    id: user.id ?? null,
    name: name || user.email || 'Unknown',
    email: user.email ?? null,
    avatar: user.avatar ?? null,
  };
}

/** Resolve creator from Prisma relation, legacy lead string id, or optional fallbacks on the row. */
export function resolveCreatedByUser(row) {
  if (!row || typeof row !== 'object') return null;
  if (row.createdBy && typeof row.createdBy === 'object') {
    return row.createdBy;
  }
  if (row._resolvedCreatedBy) {
    return row._resolvedCreatedBy;
  }
  if (row.recruiter && typeof row.recruiter === 'object') {
    return row.recruiter;
  }
  if (row.owner && typeof row.owner === 'object') {
    return row.owner;
  }
  return null;
}

export function buildAuditMeta(row) {
  const createdByUser = resolveCreatedByUser(row);
  const updatedByUser = row.lastUpdatedBy || null;
  return {
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null,
    createdBy: toAuditUser(createdByUser),
    updatedBy: toAuditUser(updatedByUser),
  };
}

function isPureCreateAction(action) {
  const text = String(action || '').trim();
  if (!text) return false;
  if (!/created/i.test(text)) return false;
  return !/updated|changed|deleted|assigned|status|field/i.test(text);
}

/**
 * Attach `lastUpdatedBy` from the latest non-create Activity row per entity.
 */
export async function enrichListWithLastUpdater(rows, entityType) {
  if (!Array.isArray(rows) || !rows.length || !entityType) return rows;
  const ids = [...new Set(rows.map((row) => row.id).filter(Boolean))];
  if (!ids.length) return rows;

  const activities = await prisma.activity.findMany({
    where: {
      entityType,
      entityId: { in: ids },
    },
    include: {
      performedBy: { select: USER_BRIEF_SELECT },
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(ids.length * 8, 800),
  });

  const lastByEntity = new Map();
  for (const activity of activities) {
    const entityId = activity.entityId;
    if (!entityId || lastByEntity.has(entityId)) continue;
    if (isPureCreateAction(activity.action)) continue;
    lastByEntity.set(entityId, activity.performedBy ?? null);
  }

  return rows.map((row) => ({
    ...row,
    lastUpdatedBy: lastByEntity.get(row.id) ?? row.lastUpdatedBy ?? null,
  }));
}

/** Lead.createdBy is a legacy string user id — resolve to a User object. */
export async function attachCreatedByUsersForLeads(leads) {
  if (!Array.isArray(leads) || !leads.length) return leads;
  const userIds = [
    ...new Set(
      leads
        .map((lead) => {
          const raw = lead.createdBy;
          return typeof raw === 'string' && /^[a-f\d]{24}$/i.test(raw.trim()) ? raw.trim() : null;
        })
        .filter(Boolean)
    ),
  ];
  if (!userIds.length) return leads;

  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: USER_BRIEF_SELECT,
  });
  const byId = new Map(users.map((user) => [user.id, user]));

  return leads.map((lead) => ({
    ...lead,
    _resolvedCreatedBy:
      typeof lead.createdBy === 'string' ? byId.get(lead.createdBy.trim()) ?? null : null,
  }));
}

/**
 * Enrich list rows with `auditMeta` for table columns (created / updated + who).
 */
export async function prepareListWithAuditMeta(rows, entityType, options = {}) {
  if (!Array.isArray(rows) || !rows.length) return rows;

  let result = rows;
  if (options.resolveLeadCreators) {
    result = await attachCreatedByUsersForLeads(result);
  }
  if (options.useRecruiterAsCreator) {
    result = result.map((row) => ({
      ...row,
      createdBy: row.createdBy || row.recruiter || null,
    }));
  }
  if (options.useOwnerAsCreator) {
    result = result.map((row) => ({
      ...row,
      createdBy: row.createdBy || row.owner || null,
    }));
  }

  result = await enrichListWithLastUpdater(result, entityType);

  return result.map((row) => ({
    ...row,
    auditMeta: buildAuditMeta(row),
  }));
}

export async function applyAuditMetaToPaginatedList(paginated, entityType, options = {}) {
  if (!paginated || !Array.isArray(paginated.data)) return paginated;
  paginated.data = await prepareListWithAuditMeta(paginated.data, entityType, options);
  return paginated;
}

/** Single-entity detail responses (drawers, getById). */
export async function attachAuditMetaToEntity(row, entityType, options = {}) {
  if (!row) return row;
  const [enriched] = await prepareListWithAuditMeta([row], entityType, options);
  return enriched;
}

/** Billing rows: match Activity by `relatedId` (invoice id) when present. */
export async function enrichBillingRecordsWithAudit(records) {
  if (!Array.isArray(records) || !records.length) return records;
  const ids = [...new Set(records.map((r) => r.id).filter(Boolean))];
  const activities = ids.length
    ? await prisma.activity.findMany({
        where: { relatedId: { in: ids } },
        include: { performedBy: { select: USER_BRIEF_SELECT } },
        orderBy: { createdAt: 'desc' },
        take: Math.min(ids.length * 6, 400),
      })
    : [];

  const lastByRelated = new Map();
  for (const activity of activities) {
    const key = activity.relatedId;
    if (!key || lastByRelated.has(key)) continue;
    if (isPureCreateAction(activity.action)) continue;
    lastByRelated.set(key, activity.performedBy ?? null);
  }

  return records.map((record) => {
    const withUpdater = {
      ...record,
      lastUpdatedBy: lastByRelated.get(record.id) ?? null,
    };
    return {
      ...withUpdater,
      auditMeta: buildAuditMeta(withUpdater),
    };
  });
}
