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

      // If user has no role assigned, deny access
      if (!user.systemRole) {
        return sendError(res, 403, `Access denied: requires ${permissionName}`);
      }

      // Check if the role has the required permission
      const hasPermission = user.systemRole.rolePermissions.some(
        (rp) => rp.permission.permissionName === permissionName
      );

      if (!hasPermission) {
        return sendError(res, 403, `Access denied: requires ${permissionName}`);
      }

      // Attach user with permissions to request for use in controllers
      req.userWithPermissions = {
        ...user,
        permissions: user.systemRole.rolePermissions.map(
          (rp) => rp.permission.permissionName
        ),
      };

      next();
    } catch (error) {
      console.error('Permission middleware error:', error);
      return sendError(res, 500, 'Permission check failed', error);
    }
  };
}
