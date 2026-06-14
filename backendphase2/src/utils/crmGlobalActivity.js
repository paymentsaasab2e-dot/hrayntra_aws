import { prisma } from '../config/prisma.js';
import { emitTenantActionFromActivity } from '../utils/tenantAuditLog.js';

/**
 * Write a global CRM Activity row (activity feed / audit).
 */
export async function logCrmGlobalActivity({
  performedById,
  action,
  description,
  entityType,
  entityId,
  category,
  relatedType,
  relatedLabel,
  relatedId,
  metadata,
  clientId,
}) {
  if (!performedById || !action) return null;

  const activity = await prisma.activity.create({
    data: {
      action: String(action),
      description: description != null ? String(description) : undefined,
      performedById: String(performedById),
      entityType: entityType ? String(entityType).toUpperCase() : undefined,
      entityId: entityId ? String(entityId) : undefined,
      category: category ? String(category) : undefined,
      relatedType: relatedType ? String(relatedType) : undefined,
      relatedLabel: relatedLabel ? String(relatedLabel) : undefined,
      relatedId: relatedId ? String(relatedId) : undefined,
      metadata: metadata && typeof metadata === 'object' ? metadata : undefined,
      clientId: clientId ? String(clientId) : undefined,
    },
  });

  try {
    emitTenantActionFromActivity(activity);
  } catch {
    /* non-fatal */
  }

  return activity;
}
