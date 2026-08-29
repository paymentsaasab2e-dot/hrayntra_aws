import { prisma, getActiveTenantDbName } from '../../config/prisma.js';
import { getOrganizationName } from './recruitmentMode.service.js';

function formatUserName(user) {
  const first = String(user?.firstName || '').trim();
  const last = String(user?.lastName || '').trim();
  const joined = [first, last].filter(Boolean).join(' ');
  return String(user?.name || '').trim() || joined || String(user?.email || '').trim();
}

export async function findWorkspaceClient() {
  const tenantDbName = String(getActiveTenantDbName() || '').trim();
  if (!tenantDbName) return null;

  const byWebsite = await prisma.client.findFirst({
    where: {
      isDeleted: { not: true },
      website: `tenant://${tenantDbName}`,
    },
    orderBy: { createdAt: 'asc' },
  });
  if (byWebsite) return byWebsite;

  const byTenantName = await prisma.client.findFirst({
    where: {
      isDeleted: { not: true },
      companyName: `${tenantDbName} Workspace`,
    },
    orderBy: { createdAt: 'asc' },
  });
  if (byTenantName) return byTenantName;

  return prisma.client.findFirst({
    where: {
      isDeleted: { not: true },
      industry: 'Workspace',
      companyName: { endsWith: ' Workspace' },
    },
    orderBy: { createdAt: 'asc' },
  });
}

/** Internal company record for jobs hired under this tenant (own company). */
export async function getOrCreateWorkspaceClient(user) {
  const tenantDbName = String(getActiveTenantDbName() || '').trim();
  if (!tenantDbName) return null;

  const existing = await findWorkspaceClient();
  if (existing) {
    const orgName = await getOrganizationName();
    const currentName = String(existing.companyName || '').trim();
    if (orgName && currentName !== orgName) {
      return prisma.client.update({
        where: { id: existing.id },
        data: { companyName: orgName },
      });
    }
    return existing;
  }

  const orgName = await getOrganizationName();
  const ownerName = formatUserName(user);
  const companyName = orgName || (ownerName ? `${ownerName} Workspace` : `${tenantDbName} Workspace`);

  return prisma.client.create({
    data: {
      companyName,
      industry: 'Workspace',
      website: `tenant://${tenantDbName}`,
      status: 'ACTIVE',
      assignedToId: user?.id || null,
      createdById: user?.id || null,
    },
  });
}
