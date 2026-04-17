import { prisma } from '../config/prisma.js';
import { isSuperAdminUser } from '../utils/superAdminScope.js';

async function buildAccessibleDepartmentWhere(req) {
  if (!isSuperAdminUser(req) || !req?.user?.id) {
    return {};
  }

  const ownerId = req.user.id;
  const activityRows = await prisma.userActivity.findMany({
    where: {
      userId: ownerId,
      module: 'Team',
      action: 'Department created',
    },
    select: { metadata: true },
    orderBy: { timestamp: 'desc' },
    take: 500,
  });

  const createdDepartmentIds = [
    ...new Set(
      activityRows
        .map((row) => row?.metadata?.departmentId)
        .filter((id) => typeof id === 'string' && id.length > 0)
    ),
  ];

  return {
    OR: [
      {
        users: {
          some: {
            OR: [
              { id: ownerId },
              { credential: { is: { createdBy: ownerId } } },
            ],
          },
        },
      },
      ...(createdDepartmentIds.length ? [{ id: { in: createdDepartmentIds } }] : []),
    ],
  };
}

/**
 * Get all departments with user counts and preview
 * GET /api/departments
 */
export async function getAllDepartments(req, res) {
  try {
    const scopedWhere = await buildAccessibleDepartmentWhere(req);
    const departments = await prisma.department.findMany({
      where: scopedWhere,
      include: {
        users: {
          where: {
            status: 'ACTIVE',
            ...(isSuperAdminUser(req) && req?.user?.id
              ? {
                  OR: [
                    { id: req.user.id },
                    { credential: { is: { createdBy: req.user.id } } },
                  ],
                }
              : {}),
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            designation: true,
            systemRole: {
              select: {
                color: true,
              },
            },
          },
          take: 4,
        },
        _count: {
          select: {
            users: {
              where: {
                status: 'ACTIVE',
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Format response - limit users to 4 for preview
    const formatted = departments.map((dept) => ({
      ...dept,
      users: dept.users.slice(0, 4), // Ensure max 4 users
    }));

    return res.status(200).json({
      success: true,
      data: formatted,
    });
  } catch (error) {
    console.error('Error fetching departments:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch departments',
    });
  }
}

/**
 * Get department by ID with full user list
 * GET /api/departments/:id
 */
export async function getDepartmentById(req, res) {
  try {
    const { id } = req.params;
    const scopedWhere = await buildAccessibleDepartmentWhere(req);

    const department = await prisma.department.findFirst({
      where: scopedWhere?.OR?.length
        ? { AND: [{ id }, scopedWhere] }
        : { id },
      include: {
        users: {
          where: isSuperAdminUser(req) && req?.user?.id
            ? {
                OR: [
                  { id: req.user.id },
                  { credential: { is: { createdBy: req.user.id } } },
                ],
              }
            : undefined,
          include: {
            systemRole: {
              select: {
                roleName: true,
                color: true,
              },
            },
          },
        },
      },
    });

    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: department,
    });
  } catch (error) {
    console.error('Error fetching department:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch department',
    });
  }
}

/**
 * Create new department
 * POST /api/departments
 */
export async function createDepartment(req, res) {
  try {
    const { name, description } = req.body;

    // Validation
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Department name is required',
      });
    }

    // Check if name already exists
    const existing = await prisma.department.findFirst({
      where: { name },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'A department with this name already exists',
      });
    }

    // Create department
    const department = await prisma.department.create({
      data: {
        name,
        description,
      },
    });

    if (req?.user?.id) {
      await prisma.userActivity.create({
        data: {
          userId: req.user.id,
          action: 'Department created',
          module: 'Team',
          metadata: {
            departmentId: department.id,
            departmentName: department.name,
          },
        },
      });
    }

    return res.status(201).json({
      success: true,
      data: department,
      message: 'Department created',
    });
  } catch (error) {
    console.error('Error creating department:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create department',
    });
  }
}

/**
 * Update department
 * PATCH /api/departments/:id
 */
export async function updateDepartment(req, res) {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    const scopedWhere = await buildAccessibleDepartmentWhere(req);
    if (scopedWhere?.OR?.length) {
      const existingScoped = await prisma.department.findFirst({
        where: {
          AND: [{ id }, scopedWhere],
        },
        select: { id: true },
      });
      if (!existingScoped) {
        return res.status(404).json({
          success: false,
          message: 'Department not found',
        });
      }
    }

    // Check if name is being changed and if it's unique
    if (name) {
      const existing = await prisma.department.findFirst({
        where: {
          name,
          id: { not: id },
        },
      });

      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'A department with this name already exists',
        });
      }
    }

    // Build update data
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;

    // Update department
    const updatedDept = await prisma.department.update({
      where: { id },
      data: updateData,
    });

    return res.status(200).json({
      success: true,
      data: updatedDept,
    });
  } catch (error) {
    console.error('Error updating department:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Department not found',
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to update department',
    });
  }
}

/**
 * Delete department
 * DELETE /api/departments/:id
 */
export async function deleteDepartment(req, res) {
  try {
    const { id } = req.params;
    const scopedWhere = await buildAccessibleDepartmentWhere(req);
    if (scopedWhere?.OR?.length) {
      const existingScoped = await prisma.department.findFirst({
        where: {
          AND: [{ id }, scopedWhere],
        },
        select: { id: true },
      });
      if (!existingScoped) {
        return res.status(404).json({
          success: false,
          message: 'Department not found',
        });
      }
    }

    // Count active users in this department
    const activeUserCount = await prisma.user.count({
      where: {
        departmentId: id,
        status: 'ACTIVE',
      },
    });

    if (activeUserCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete: ${activeUserCount} active member(s) are assigned to this department. Move them first.`,
      });
    }

    // Delete department
    await prisma.department.delete({
      where: { id },
    });

    return res.status(200).json({
      success: true,
      message: 'Department deleted',
    });
  } catch (error) {
    console.error('Error deleting department:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Department not found',
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to delete department',
    });
  }
}
