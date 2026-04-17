import { getActiveTenantDbName } from '../config/prisma.js';
import { prisma } from '../config/prisma.js';
import logger from './logger.js';

export function isTenantAuditLogEnabled() {
  const v = process.env.TENANT_AUDIT_LOG;
  if (v === 'false' || v === '0') return false;
  return true;
}

function actorLabel(user) {
  if (!user) return 'System';
  const fromParts = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  if (fromParts) return fromParts;
  const n = String(user.name || '').trim();
  if (n) return n;
  if (user.email) return user.email;
  return user.id || 'Unknown';
}

function roleLabel(user) {
  if (!user) return '—';
  const sr = user.systemRole?.roleName;
  if (sr) return sr;
  if (user.role) return String(user.role);
  return '—';
}

/**
 * Print a tenant-scoped audit line to the terminal (and structured logger).
 * Use when the Activity row already includes performedBy (+ systemRole).
 */
export function emitTenantActionFromActivity(activity) {
  if (!isTenantAuditLogEnabled() || !activity) return;

  const tenant = getActiveTenantDbName() || '(default)';
  const user = activity.performedBy;
  const actor = actorLabel(user);
  const role = roleLabel(user);

  console.log('\n======== Tenant audit (activity) ========');
  console.log(`Tenant DB: ${tenant}`);
  console.log(`User: ${actor}`);
  console.log(`Role: ${role}`);
  console.log(`Action: ${activity.action}`);
  if (activity.description) console.log(`Detail: ${activity.description}`);
  if (activity.entityType) {
    console.log(`Entity: ${activity.entityType}${activity.entityId ? ` | id: ${activity.entityId}` : ''}`);
  }
  if (activity.category) console.log(`Category: ${activity.category}`);
  console.log('=========================================\n');

  logger.info({
    evt: 'tenant_audit',
    tenant,
    user: actor,
    role,
    action: activity.action,
    entityType: activity.entityType,
    entityId: activity.entityId,
  });
}

/**
 * Same as emitTenantActionFromActivity but loads the user when performedBy was not included.
 */
export async function emitTenantActionFromIds({
  performedById,
  action,
  description,
  entityType,
  entityId,
  category,
}) {
  if (!isTenantAuditLogEnabled()) return;

  const tenant = getActiveTenantDbName() || '(default)';
  let user = null;
  if (performedById) {
    try {
      user = await prisma.user.findUnique({
        where: { id: performedById },
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          systemRole: { select: { roleName: true } },
        },
      });
    } catch {
      user = null;
    }
  }

  const actor = actorLabel(user);
  const role = roleLabel(user);

  console.log('\n======== Tenant audit (activity) ========');
  console.log(`Tenant DB: ${tenant}`);
  console.log(`User: ${actor}`);
  console.log(`Role: ${role}`);
  console.log(`Action: ${action}`);
  if (description) console.log(`Detail: ${description}`);
  if (entityType) console.log(`Entity: ${entityType}${entityId ? ` | id: ${entityId}` : ''}`);
  if (category) console.log(`Category: ${category}`);
  console.log('=========================================\n');

  logger.info({
    evt: 'tenant_audit',
    tenant,
    user: actor,
    role,
    action,
    entityType,
    entityId,
  });
}
