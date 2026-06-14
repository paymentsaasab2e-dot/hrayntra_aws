import { prisma, getActiveTenantDbName } from '../config/prisma.js';
import { isSuperAdminUser } from '../utils/superAdminScope.js';
import { getCache, setCache, deleteCacheByPattern } from '../cache/redis.js';
import logger from '../utils/logger.js';
import { DEFAULT_PERMISSIONS } from '../modules/role/default-permissions.js';
import {
  ensureSuperAdminHasAllPermissions,
  ensureDefaultSystemRoles,
  syncDefaultPermissions,
  syncDefaultRolePresets,
  syncMissingRolePresetPermissions,
  syncAgencySalesHeadHandoffPermissions,
} from '../modules/role/permission-sync.service.js';
import activityService from '../services/activityService.js';

function getRolesCacheKey(page = 1, limit = 20) {
  const tenant = getActiveTenantDbName() || 'default';
  return `roles:all:${tenant}:p${page}:l${limit}`;
}

function getRolesCachePattern() {
  const tenant = getActiveTenantDbName() || 'default';
  return `roles:all:${tenant}:*`;
}

function getPermissionCachePattern() {
  const tenant = getActiveTenantDbName() || 'default';
  return `permission:check:${tenant}:*`;
}

/**
 * Get all roles with permissions and user counts
 * GET /api/roles
 */
export async function getAllRoles(req, res) {
  try {
    await syncDefaultPermissions();
    await ensureSuperAdminHasAllPermissions();
    await ensureDefaultSystemRoles();
    await syncDefaultRolePresets();
    await syncMissingRolePresetPermissions();
    await syncAgencySalesHeadHandoffPermissions();
    await deleteCacheByPattern(getPermissionCachePattern());

    const page = Math.max(Number.parseInt(String(req.query.page || '1'), 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(String(req.query.limit || '20'), 10) || 20, 1), 100);
    const skip = (page - 1) * limit;

    const cacheKey = getRolesCacheKey(page, limit);
    const cached = await getCache(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      res.setHeader('Cache-Control', 'private, no-store');
      return res.status(200).json(parsed);
    }

    const [roles, total] = await Promise.all([
      prisma.systemRole.findMany({
        select: {
          id: true,
          roleName: true,
          description: true,
          color: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
      }),
      prisma.systemRole.count(),
    ]);

    const roleIds = roles.map((role) => role.id);
    const rolePermissions = roleIds.length
      ? await prisma.rolePermission.findMany({
          where: { roleId: { in: roleIds } },
          select: {
            roleId: true,
            permission: {
              select: {
                id: true,
                permissionName: true,
                module: true,
                description: true,
              },
            },
          },
        })
      : [];

    const permissionsByRole = rolePermissions.reduce((acc, item) => {
      if (!acc[item.roleId]) acc[item.roleId] = [];
      acc[item.roleId].push({
        permission: item.permission,
      });
      return acc;
    }, {});

    const userRows = roleIds.length
      ? await prisma.user.findMany({
          where: { roleId: { in: roleIds } },
          select: { roleId: true },
        })
      : [];

    const userCountByRole = userRows.reduce((acc, row) => {
      if (row.roleId) acc[row.roleId] = (acc[row.roleId] || 0) + 1;
      return acc;
    }, {});

    const rolesWithRelations = roles.map((role) => ({
      ...role,
      rolePermissions: permissionsByRole[role.id] || [],
      _count: {
        users: userCountByRole[role.id] || 0,
      },
    }));

    if (isSuperAdminUser(req) && req?.user?.id) {
      const visibleUsers = await prisma.user.findMany({
        where: {
          OR: [
            { id: req.user.id },
            { credential: { is: { createdBy: req.user.id } } },
          ],
        },
        select: { roleId: true },
      });

      const countByRoleId = visibleUsers.reduce((acc, user) => {
        if (!user.roleId) return acc;
        acc[user.roleId] = (acc[user.roleId] || 0) + 1;
        return acc;
      }, {});

      const responsePayload = {
        success: true,
        data: rolesWithRelations.map((role) => ({
          ...role,
          _count: {
            ...(role._count || {}),
            users: countByRoleId[role.id] || 0,
          },
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };

      await setCache(cacheKey, JSON.stringify(responsePayload), 300);
      res.setHeader('Cache-Control', 'private, no-store');
      return res.status(200).json(responsePayload);
    }

    const responsePayload = {
      success: true,
      data: rolesWithRelations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };

    await setCache(cacheKey, JSON.stringify(responsePayload), 300);
    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).json(responsePayload);
  } catch (error) {
    logger.error({ route: req.originalUrl || req.url, message: error?.message || 'Failed to fetch roles' });
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch roles',
    });
  }
}

/**
 * Get role by ID with full details
 * GET /api/roles/:id
 */
export async function getRoleById(req, res) {
  try {
    const { id } = req.params;

    const role = await prisma.systemRole.findUnique({
      where: { id },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
        users: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            designation: true,
            status: true,
          },
        },
      },
    });

    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found',
      });
    }

    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).json({
      success: true,
      data: role,
    });
  } catch (error) {
    logger.error({ route: req.originalUrl || req.url, message: error?.message || 'Failed to fetch role' });
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch role',
    });
  }
}

/**
 * Create new role
 * POST /api/roles
 */
export async function createRole(req, res) {
  try {
    await syncDefaultPermissions();

    const { roleName, description, color, permissionIds } = req.body;

    // Validation
    if (!roleName || !color) {
      return res.status(400).json({
        success: false,
        message: 'Role name and color are required',
      });
    }

    // Check if roleName already exists
    const existing = await prisma.systemRole.findUnique({
      where: { roleName },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'A role with this name already exists',
      });
    }

    // Create role
    const role = await prisma.systemRole.create({
      data: {
        roleName,
        description,
        color,
      },
    });

    // Create role-permission relationships if permissionIds provided
    if (permissionIds && Array.isArray(permissionIds) && permissionIds.length > 0) {
      const rawPermissionValues = [...new Set(permissionIds.map((id) => String(id).trim()).filter(Boolean))];
      const permissionRecords = await prisma.permission.findMany({
        where: {
          OR: [
            { id: { in: rawPermissionValues } },
            { permissionName: { in: rawPermissionValues } },
          ],
        },
        select: { id: true, permissionName: true },
      });
      const permissionById = new Map(permissionRecords.map((permission) => [permission.id, permission.id]));
      const permissionByName = new Map(permissionRecords.map((permission) => [permission.permissionName, permission.id]));
      const uniquePermissionIds = [
        ...new Set(
          rawPermissionValues
            .map((value) => permissionById.get(value) || permissionByName.get(value))
            .filter(Boolean),
        ),
      ];
      await prisma.rolePermission.createMany({
        data: uniquePermissionIds.map((permissionId) => ({
          roleId: role.id,
          permissionId,
        })),
      });
    }

    // Fetch created role with permissions
    const createdRole = await prisma.systemRole.findUnique({
      where: { id: role.id },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
    });
    await Promise.all([
      deleteCacheByPattern(getRolesCachePattern()),
      deleteCacheByPattern(getPermissionCachePattern()),
    ]);

    const tenantLabel = getActiveTenantDbName() || '(default)';
    const lines = (createdRole.rolePermissions || [])
      .map((rp) => rp.permission?.permissionName)
      .filter(Boolean);
    logger.info({
      evt: 'role_created',
      tenant: tenantLabel,
      roleId: createdRole.id,
      roleName: createdRole.roleName,
      permissions: lines,
    });
    // Plain terminal output for operators
    console.log('\n======== Role created (permissions) ========');
    console.log(`Tenant DB: ${tenantLabel}`);
    console.log(`Role: ${createdRole.roleName}`);
    lines.forEach((name) => console.log(`  - ${name}`));
    console.log('==============================================\n');

    if (req.user?.id) {
      await activityService.logTeamActivity({
        entityId: createdRole.id,
        performedById: req.user.id,
        action: 'Role created',
        description: `Role "${createdRole.roleName}" was created with ${lines.length} permission(s).`,
        relatedLabel: createdRole.roleName,
        metadata: { roleId: createdRole.id, permissions: lines },
      });
    }

    return res.status(201).json({
      success: true,
      data: createdRole,
      message: 'Role created',
    });
  } catch (error) {
    logger.error({ route: req.originalUrl || req.url, message: error?.message || 'Failed to create role' });
    return res.status(500).json({
      success: false,
      message: 'Failed to create role',
    });
  }
}

/**
 * Update role
 * PATCH /api/roles/:id
 */
export async function updateRole(req, res) {
  try {
    await syncDefaultPermissions();

    const { id } = req.params;
    const { roleName, description, color, permissionIds } = req.body;

    const existingRole = await prisma.systemRole.findUnique({
      where: { id },
      select: { id: true, roleName: true },
    });
    if (!existingRole) {
      return res.status(404).json({ success: false, message: 'Role not found' });
    }
    if (existingRole.roleName === 'Super Admin') {
      return res.status(403).json({
        success: false,
        message: 'The Super Admin role cannot be modified.',
      });
    }

    // Check if roleName is being changed and if it's unique
    if (roleName) {
      const existing = await prisma.systemRole.findFirst({
        where: {
          roleName,
          id: { not: id },
        },
      });

      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'A role with this name already exists',
        });
      }
    }

    // Build update data
    const updateData = {};
    if (roleName !== undefined) updateData.roleName = roleName;
    if (description !== undefined) updateData.description = description;
    if (color !== undefined) updateData.color = color;

    // Update role
    await prisma.systemRole.update({
      where: { id },
      data: updateData,
    });

    // Update permissions if permissionIds is provided (even if empty array)
    if (permissionIds !== undefined) {
      // Delete all existing role-permission relationships
      await prisma.rolePermission.deleteMany({
        where: { roleId: id },
      });

      // Create new relationships if permissionIds array is not empty
      if (Array.isArray(permissionIds) && permissionIds.length > 0) {
        const rawPermissionValues = [...new Set(permissionIds.map((v) => String(v).trim()).filter(Boolean))];
        const permissionRecords = await prisma.permission.findMany({
          where: {
            OR: [
              { id: { in: rawPermissionValues } },
              { permissionName: { in: rawPermissionValues } },
            ],
          },
          select: { id: true, permissionName: true },
        });
        const permissionById = new Map(permissionRecords.map((p) => [p.id, p.id]));
        const permissionByName = new Map(permissionRecords.map((p) => [p.permissionName, p.id]));
        const uniquePermissionIds = [
          ...new Set(
            rawPermissionValues
              .map((value) => permissionById.get(value) || permissionByName.get(value))
              .filter(Boolean),
          ),
        ];
        if (uniquePermissionIds.length) {
          await prisma.rolePermission.createMany({
            data: uniquePermissionIds.map((permissionId) => ({
              roleId: id,
              permissionId,
            })),
          });
        }
      }
    }

    // Fetch updated role with permissions
    const updatedRole = await prisma.systemRole.findUnique({
      where: { id },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
    });
    await Promise.all([
      deleteCacheByPattern(getRolesCachePattern()),
      deleteCacheByPattern(getPermissionCachePattern()),
    ]);

    const tenantLabel = getActiveTenantDbName() || '(default)';
    const permLines = (updatedRole.rolePermissions || [])
      .map((rp) => ({
        name: rp.permission?.permissionName,
        module: rp.permission?.module,
      }))
      .filter((row) => row.name);
    logger.info({
      evt: 'role_permissions_saved',
      tenant: tenantLabel,
      roleId: id,
      roleName: updatedRole.roleName,
      permissions: permLines.map((p) => p.name),
    });
    console.log('\n======== Role permissions saved ========');
    console.log(`Tenant DB: ${tenantLabel}`);
    console.log(`Role: ${updatedRole.roleName}`);
    console.log('Permissions assigned:');
    permLines.forEach((p) => console.log(`  - ${p.name}${p.module ? ` (${p.module})` : ''}`));
    console.log('========================================\n');

    if (req.user?.id) {
      await activityService.logTeamActivity({
        entityId: id,
        performedById: req.user.id,
        action: 'Role updated',
        description: `Role "${updatedRole.roleName}" was updated.`,
        relatedLabel: updatedRole.roleName,
        metadata: {
          roleId: id,
          permissions: permLines.map((p) => p.name),
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: updatedRole,
    });
  } catch (error) {
    logger.error({ route: req.originalUrl || req.url, message: error?.message || 'Failed to update role' });
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Role not found',
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to update role',
    });
  }
}

/**
 * Delete role
 * DELETE /api/roles/:id
 */
export async function deleteRole(req, res) {
  try {
    const { id } = req.params;

    // Check if this is the Super Admin role
    const role = await prisma.systemRole.findUnique({
      where: { id },
    });

    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found',
      });
    }

    if (role.roleName === 'Super Admin') {
      return res.status(400).json({
        success: false,
        message: 'The Super Admin role cannot be deleted.',
      });
    }

    // Count users with this role
    const userCount = await prisma.user.count({
      where: { roleId: id },
    });

    if (userCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete: ${userCount} member(s) are assigned to this role. Reassign them first.`,
      });
    }

    // Delete all role-permission relationships
    await prisma.rolePermission.deleteMany({
      where: { roleId: id },
    });

    if (req.user?.id) {
      await activityService.logTeamActivity({
        entityId: id,
        performedById: req.user.id,
        action: 'Role deleted',
        description: `Role "${role.roleName}" was deleted.`,
        relatedLabel: role.roleName,
        metadata: { roleId: id },
      });
    }

    // Delete the role
    await prisma.systemRole.delete({
      where: { id },
    });
    await Promise.all([
      deleteCacheByPattern(getRolesCachePattern()),
      deleteCacheByPattern(getPermissionCachePattern()),
    ]);

    return res.status(200).json({
      success: true,
      message: 'Role deleted',
    });
  } catch (error) {
    logger.error({ route: req.originalUrl || req.url, message: error?.message || 'Failed to delete role' });
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Role not found',
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to delete role',
    });
  }
}

/**
 * Get all permissions grouped by module
 * GET /api/permissions
 */
export async function getAllPermissions(req, res) {
  try {
    await syncDefaultPermissions();
    await ensureSuperAdminHasAllPermissions();
    await ensureDefaultSystemRoles();
    await syncDefaultRolePresets();
    await syncMissingRolePresetPermissions();
    await syncAgencySalesHeadHandoffPermissions();
    await deleteCacheByPattern(getPermissionCachePattern());

    const permissions = await prisma.permission.findMany({
      select: {
        id: true,
        permissionName: true,
        module: true,
        description: true,
      },
      orderBy: [
        { module: 'asc' },
        { permissionName: 'asc' },
      ],
    });

    if (!permissions.length) {
      const fallbackGrouped = DEFAULT_PERMISSIONS.reduce((acc, permission) => {
        if (!acc[permission.module]) {
          acc[permission.module] = [];
        }
        acc[permission.module].push({
          id: permission.permissionName,
          permissionName: permission.permissionName,
          module: permission.module,
          description: permission.description || null,
        });
        return acc;
      }, {});

      res.setHeader('Cache-Control', 'private, no-store');
      return res.status(200).json({
        success: true,
        data: fallbackGrouped,
      });
    }

    // Group by module
    const grouped = {};
    permissions.forEach((perm) => {
      if (!grouped[perm.module]) {
        grouped[perm.module] = [];
      }
      grouped[perm.module].push(perm);
    });

    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).json({
      success: true,
      data: grouped,
      meta: {
        total: permissions.length,
        catalogTotal: DEFAULT_PERMISSIONS.length,
        modules: Object.keys(grouped).length,
      },
    });
  } catch (error) {
    logger.error({ route: req.originalUrl || req.url, message: error?.message || 'Failed to fetch permissions' });
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch permissions',
    });
  }
}
