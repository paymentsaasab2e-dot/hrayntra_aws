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

  return prisma.client.findFirst({
    where: {
      OR: [
        { website: `tenant://${tenantDbName}` },
        { companyName: `${tenantDbName} Workspace` },
      ],
    },
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
