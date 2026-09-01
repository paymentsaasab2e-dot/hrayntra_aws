import { prisma, getActiveTenantDbName } from '../../config/prisma.js';
import {
  DEFAULT_PERMISSIONS,
  DEFAULT_PERMISSION_NAMES,
  DEFAULT_ROLE_PERMISSION_PRESETS,
  DEFAULT_SYSTEM_ROLES,
  DEFAULT_EVERYONE_PERMISSIONS,
} from './default-permissions.js';

const SYNC_TTL_MS = 5 * 60 * 1000;
const lastPermissionSyncAt = new Map();

function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

export async function syncDefaultPermissions() {
  const tenant = getActiveTenantDbName() || 'default';
  const now = Date.now();
  const lastRun = lastPermissionSyncAt.get(tenant) || 0;
  if (now - lastRun < SYNC_TTL_MS) return;

  const desiredNames = unique(DEFAULT_PERMISSION_NAMES);
  const desiredNameSet = new Set(desiredNames);

  const existingRows = await prisma.permission.findMany({
    select: { id: true, permissionName: true, module: true, description: true },
  });
  const existingByName = new Map(existingRows.map((row) => [row.permissionName, row]));

  const creates = [];
  const updates = [];

  for (const permission of DEFAULT_PERMISSIONS) {
    const current = existingByName.get(permission.permissionName);
    if (!current) {
      creates.push({
        permissionName: permission.permissionName,
        module: permission.module,
        description: permission.description || null,
      });
      continue;
    }
    const nextDescription = permission.description || null;
    if (current.module !== permission.module || current.description !== nextDescription) {
      updates.push({
        id: current.id,
        module: permission.module,
        description: nextDescription,
      });
    }
  }

  if (creates.length) {
    await prisma.permission.createMany({ data: creates });
  }
  for (const row of updates) {
    await prisma.permission.update({
      where: { id: row.id },
      data: { module: row.module, description: row.description },
    });
  }

  const stalePermissionIds = existingRows
    .filter((permission) => !desiredNameSet.has(permission.permissionName))
    .map((permission) => permission.id);

  if (stalePermissionIds.length > 0) {
    await prisma.rolePermission.deleteMany({
      where: { permissionId: { in: stalePermissionIds } },
    });
    await prisma.permission.deleteMany({
      where: { id: { in: stalePermissionIds } },
    });
  }

  lastPermissionSyncAt.set(tenant, now);
}

export async function ensureSuperAdminHasAllPermissions() {
  const superAdminRole = await prisma.systemRole.findUnique({
    where: { roleName: 'Super Admin' },
    select: { id: true },
  });
  if (!superAdminRole?.id) return;

  const permissions = await prisma.permission.findMany({
    select: { id: true },
  });
  if (!permissions.length) return;

  const existing = await prisma.rolePermission.findMany({
    where: {
      roleId: superAdminRole.id,
      permissionId: { in: permissions.map((permission) => permission.id) },
    },
    select: { permissionId: true },
  });
  const existingIds = new Set(existing.map((row) => row.permissionId));
  const missing = permissions
    .map((permission) => permission.id)
    .filter((permissionId) => !existingIds.has(permissionId));

  if (!missing.length) return;

  await prisma.rolePermission.createMany({
    data: missing.map((permissionId) => ({
      roleId: superAdminRole.id,
      permissionId,
    })),
  });
}

async function resolvePermissionIdsByNames(names = []) {
  const uniqueNames = [...new Set(names.map((n) => String(n).trim()).filter(Boolean))];
  if (!uniqueNames.length) return [];
  const rows = await prisma.permission.findMany({
    where: { permissionName: { in: uniqueNames } },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

/** Apply preset permissions to default system roles (does not touch Super Admin). */
export async function ensureDefaultSystemRoles() {
  const existingRoles = await prisma.systemRole.findMany({
    select: { roleName: true },
  });
  const existingNames = new Set(existingRoles.map((role) => role.roleName));
  const missingRoles = DEFAULT_SYSTEM_ROLES.filter((role) => !existingNames.has(role.roleName));
  if (missingRoles.length > 0) {
    await prisma.systemRole.createMany({
      data: missingRoles,
    });
  }
}

export async function syncDefaultRolePresets() {
  for (const roleDef of DEFAULT_SYSTEM_ROLES) {
    if (roleDef.roleName === 'Super Admin') continue;

    const preset = DEFAULT_ROLE_PERMISSION_PRESETS[roleDef.roleName];
    if (!preset?.length) continue;

    const role = await prisma.systemRole.findUnique({
      where: { roleName: roleDef.roleName },
      select: { id: true },
    });
    if (!role?.id) continue;

    const existingCount = await prisma.rolePermission.count({ where: { roleId: role.id } });
    if (existingCount > 0) continue;

    const permissionIds = await resolvePermissionIdsByNames(preset);
    if (!permissionIds.length) continue;

    await prisma.rolePermission.createMany({
      data: permissionIds.map((permissionId) => ({ roleId: role.id, permissionId })),
    });
  }
}

/** Backfill any preset permissions that were added after a role was first seeded. */
export async function syncMissingRolePresetPermissions() {
  for (const roleDef of DEFAULT_SYSTEM_ROLES) {
    if (roleDef.roleName === 'Super Admin') continue;

    const preset = DEFAULT_ROLE_PERMISSION_PRESETS[roleDef.roleName];
    if (!preset?.length) continue;

    const role = await prisma.systemRole.findUnique({
      where: { roleName: roleDef.roleName },
      select: { id: true },
    });
    if (!role?.id) continue;

    const desiredIds = await resolvePermissionIdsByNames(preset);
    if (!desiredIds.length) continue;

    const existing = await prisma.rolePermission.findMany({
      where: { roleId: role.id, permissionId: { in: desiredIds } },
      select: { permissionId: true },
    });
    const existingIds = new Set(existing.map((row) => row.permissionId));
    const missingIds = desiredIds.filter((permissionId) => !existingIds.has(permissionId));
    if (!missingIds.length) continue;

    await prisma.rolePermission.createMany({
      data: missingIds.map((permissionId) => ({ roleId: role.id, permissionId })),
    });
  }
}

/** Agency custom roles: ensure Sales Head / Sales HOD roles can hand off clients. */
export async function syncAgencySalesHeadHandoffPermissions() {
  const [handoffId] = await resolvePermissionIdsByNames(['clients_handoff']);
  if (!handoffId) return;

  const roles = await prisma.systemRole.findMany({
    select: { id: true, roleName: true },
  });

  const isSalesHeadRole = (name) => /sales\s*(hod|head)/i.test(String(name || '').trim());

  for (const role of roles) {
    if (!isSalesHeadRole(role.roleName)) continue;

    const exists = await prisma.rolePermission.findFirst({
      where: { roleId: role.id, permissionId: handoffId },
      select: { id: true },
    });
    if (exists) continue;

    await prisma.rolePermission.create({
      data: { roleId: role.id, permissionId: handoffId },
    });
  }
}

/** Grant Communication & Integrations (and any other everyone-defaults) to every role. */
export async function syncEveryoneDefaultPermissions() {
  const permissionIds = await resolvePermissionIdsByNames(DEFAULT_EVERYONE_PERMISSIONS);
  if (!permissionIds.length) return;

  const roles = await prisma.systemRole.findMany({
    select: { id: true },
  });

  for (const role of roles) {
    const existing = await prisma.rolePermission.findMany({
      where: { roleId: role.id, permissionId: { in: permissionIds } },
      select: { permissionId: true },
    });
    const existingIds = new Set(existing.map((row) => row.permissionId));
    const missingIds = permissionIds.filter((permissionId) => !existingIds.has(permissionId));
    if (!missingIds.length) continue;

    await prisma.rolePermission.createMany({
      data: missingIds.map((permissionId) => ({ roleId: role.id, permissionId })),
    });
  }
}
