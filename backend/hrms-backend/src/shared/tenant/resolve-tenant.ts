import prisma from '../prisma';

/**
 * Resolve the caller's tenant. Never falls back to "first tenant in DB"
 * (that leaked Client A data to Client B).
 */
export async function resolveTenantId(user: {
  tenantId?: string | null;
  orgUnitId?: string | null;
  role?: string;
}): Promise<string | null> {
  if (user.role === 'PLATFORM_OWNER' && !user.tenantId) {
    return null;
  }

  if (user.tenantId) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { id: true },
    });
    return tenant?.id || null;
  }

  if (user.orgUnitId) {
    const ou = await prisma.orgUnit.findUnique({
      where: { id: user.orgUnitId },
      select: { tenantId: true },
    });
    if (ou?.tenantId) return ou.tenantId;
  }

  return null;
}
