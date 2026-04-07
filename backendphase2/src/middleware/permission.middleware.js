import { prisma } from '../config/prisma.js';
import { sendError } from '../utils/response.js';

/**
 * Middleware to require a specific permission
 * Usage: requirePermission('view_jobs')
 */
export function requirePermission(permissionName) {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return sendError(res, 401, 'Authentication required');
      }

      // Check if prisma is initialized
      if (!prisma) {
        console.error('Prisma client is not initialized');
        return sendError(res, 500, 'Database connection error');
      }

      // Fetch user with role and permissions
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: {
          systemRole: {
            include: {
              rolePermissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
        },
      });

      if (!user) {
        return sendError(res, 401, 'User not found');
      }

      const isSuperAdmin =
        user.role === 'SUPER_ADMIN' ||
        user.systemRole?.roleName === 'Super Admin';

      if (isSuperAdmin) {
        req.userWithPermissions = {
          ...user,
          permissions: ['all'],
        };
        return next();
      }

      // If user has no role assigned, deny access
      if (!user.systemRole) {
        return sendError(res, 403, `Access denied: requires ${permissionName}. User has no role assigned.`);
      }

      // Check if the role has the required permission
      const hasPermission = user.systemRole.rolePermissions.some(
        (rp) => rp.permission && rp.permission.permissionName === permissionName
      );

      if (!hasPermission) {
        return sendError(res, 403, `Access denied: requires ${permissionName}. Your role (${user.systemRole.roleName}) does not have this permission.`);
      }

      // Attach user with permissions to request for use in controllers
      req.userWithPermissions = {
        ...user,
        permissions: user.systemRole.rolePermissions
          .filter((rp) => rp.permission)
          .map((rp) => rp.permission.permissionName),
      };

      next();
    } catch (error) {
      console.error('Permission middleware error:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        userId: req.user?.id,
        permissionName,
      });
      
      // Provide more specific error messages
      if (error.message && error.message.includes('findUnique')) {
        return sendError(res, 500, 'Database query failed. Please check database connection.', error);
      }
      
      return sendError(res, 500, `Permission check failed: ${error.message || 'Unknown error'}`, error);
    }
  };
}
