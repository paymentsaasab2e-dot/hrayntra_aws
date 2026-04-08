import { prisma } from '../config/prisma.js';
import { isSuperAdminUser } from '../utils/superAdminScope.js';

const DEFAULT_ROLES = [
  { roleName: 'Super Admin', description: 'Full system access', color: 'red' },
  { roleName: 'Admin', description: 'Administrative access', color: 'blue' },
  { roleName: 'Senior Recruiter', description: 'Senior recruitment role', color: 'teal' },
  { roleName: 'Recruiter', description: 'Recruitment operations access', color: 'green' },
  { roleName: 'Account Manager', description: 'Client account management', color: 'amber' },
  { roleName: 'Finance', description: 'Finance and billing access', color: 'orange' },
  { roleName: 'Viewer', description: 'Read-only access', color: 'gray' },
  { roleName: 'Manager', description: 'Team management access', color: 'purple' },
];

async function ensureCommonDefaultRoles() {
  await Promise.all(
    DEFAULT_ROLES.map((role) =>
      prisma.systemRole.upsert({
        where: { roleName: role.roleName },
        update: {
          description: role.description,
          color: role.color,
        },
        create: role,
      })
    )
  );
}

/**
 * Get all roles with permissions and user counts
 * GET /api/roles
 */
export async function getAllRoles(req, res) {
  try {
    await ensureCommonDefaultRoles();

    const roles = await prisma.systemRole.findMany({
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
        _count: {
          select: {
            users: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

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

      return res.status(200).json({
        success: true,
        data: roles.map((role) => ({
          ...role,
          _count: {
            ...(role._count || {}),
            users: countByRoleId[role.id] || 0,
          },
        })),
      });
    }

    return res.status(200).json({
      success: true,
      data: roles,
    });
  } catch (error) {
    console.error('Error fetching roles:', error);
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

    return res.status(200).json({
      success: true,
      data: role,
    });
  } catch (error) {
    console.error('Error fetching role:', error);
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
      await prisma.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({
          roleId: role.id,
          permissionId,
        })),
        skipDuplicates: true,
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

    return res.status(201).json({
      success: true,
      data: createdRole,
      message: 'Role created',
    });
  } catch (error) {
    console.error('Error creating role:', error);
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
    const { id } = req.params;
    const { roleName, description, color, permissionIds } = req.body;

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
        await prisma.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({
            roleId: id,
            permissionId,
          })),
          skipDuplicates: true,
        });
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

    return res.status(200).json({
      success: true,
      data: updatedRole,
    });
  } catch (error) {
    console.error('Error updating role:', error);
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

    // Delete the role
    await prisma.systemRole.delete({
      where: { id },
    });

    return res.status(200).json({
      success: true,
      message: 'Role deleted',
    });
  } catch (error) {
    console.error('Error deleting role:', error);
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

    // Group by module
    const grouped = {};
    permissions.forEach((perm) => {
      if (!grouped[perm.module]) {
        grouped[perm.module] = [];
      }
      grouped[perm.module].push(perm);
    });

    return res.status(200).json({
      success: true,
      data: grouped,
    });
  } catch (error) {
    console.error('Error fetching permissions:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch permissions',
    });
  }
}
