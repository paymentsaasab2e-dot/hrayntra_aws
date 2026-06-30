import { prisma } from '../../config/prisma.js';
import { getPaginationParams, formatPaginationResponse } from '../../utils/pagination.js';

export const userService = {
  async getAll(req) {
    const { page, limit, skip } = getPaginationParams(req);
    const { role, isActive, search } = req.query;

    const where = {};
    if (role) {
      // Normalize role to uppercase to match enum
      const roleUpper = role.toUpperCase();
      const validRoles = ['SUPER_ADMIN', 'ADMIN', 'RECRUITER', 'MANAGER', 'VIEWER'];
      if (validRoles.includes(roleUpper)) {
        where.role = roleUpper;
      }
    }
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          department: true,
          designation: true,
          location: true,
          status: true,
          phone: true,
          avatar: true,
          isActive: true,
          lastLogin: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    return formatPaginationResponse(users, page, limit, total);
  },

  async getById(id) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        department: true,
        designation: true,
        location: true,
        status: true,
        phone: true,
        avatar: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
        credential: {
          select: {
            loginId: true,
          },
        },
      },
    });

    if (!user) return null;

    const { credential, ...profile } = user;
    return {
      ...profile,
      loginId: credential?.loginId || null,
    };
  },

  async update(id, data) {
    // Whitelist of profile fields the user/admin can update via this service.
    // Important: only spread keys that the caller actually provided so we
    // never accidentally null out fields like `designation` on partial saves.
    const updatable = [
      'name',
      'firstName',
      'lastName',
      'email',
      'role',
      'department',
      'designation',
      'location',
      'status',
      'phone',
      'avatar',
      'isActive',
    ];
    const payload = {};
    for (const key of updatable) {
      if (Object.prototype.hasOwnProperty.call(data || {}, key)) {
        payload[key] = data[key];
      }
    }

    return prisma.user.update({
      where: { id },
      data: payload,
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        department: true,
        designation: true,
        location: true,
        status: true,
        phone: true,
        avatar: true,
        isActive: true,
      },
    });
  },

  async delete(id) {
    await prisma.user.delete({ where: { id } });
    return { message: 'User deleted successfully' };
  },

  /**
   * Resolve the live, effective permissions for the given user from the
   * database (so changes the admin makes in Teams/Roles propagate to active
   * sessions on the next refresh). Super admins always get the wildcard
   * `'all'` token; non-super users get the unique permission names attached
   * to their assigned role.
   */
  async getEffectivePermissions(id) {
    if (!id) return null;
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        role: true,
        roleId: true,
        isActive: true,
        systemRole: {
          select: {
            id: true,
            roleName: true,
            color: true,
            rolePermissions: {
              select: {
                permission: { select: { permissionName: true } },
              },
            },
          },
        },
      },
    });

    if (!user) return null;

    const roleName = user.systemRole?.roleName || '';
    const isSuperAdmin =
      user.role === 'SUPER_ADMIN' ||
      String(roleName).trim().toLowerCase().replace(/\s+/g, '_') === 'super_admin';

    const permissionNames = isSuperAdmin
      ? ['all']
      : Array.from(
          new Set(
            (user.systemRole?.rolePermissions || [])
              .map((rp) => rp.permission?.permissionName)
              .filter(Boolean)
          )
        );

    return {
      id: user.id,
      role: user.role || (isSuperAdmin ? 'SUPER_ADMIN' : ''),
      roleName,
      roleColor: user.systemRole?.color || '',
      isSuperAdmin,
      isActive: user.isActive,
      permissions: permissionNames,
    };
  },
};
