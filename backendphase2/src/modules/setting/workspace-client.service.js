import { prisma, getActiveTenantDbName } from '../../config/prisma.js';

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

/** Internal company record used by standalone tenants (no CRM clients module). */
export async function getOrCreateWorkspaceClient(user) {
  const tenantDbName = String(getActiveTenantDbName() || '').trim();
  if (!tenantDbName) return null;

  const existing = await findWorkspaceClient();
  if (existing) return existing;

  const ownerName = formatUserName(user);
  const companyName = ownerName ? `${ownerName} Workspace` : `${tenantDbName} Workspace`;

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
