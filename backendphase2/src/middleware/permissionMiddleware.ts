import { Request, Response, NextFunction } from 'express';
import { prisma, getActiveTenantDbName } from '../config/prisma.js';
import { getCache, setCache } from '../cache/redis.js';
import logger from '../utils/logger.js';

function buildPermissionCacheKey(userId: string) {
  const tenant = getActiveTenantDbName() || 'default';
  return `permission:check:${tenant}:${userId}`;
}

/**
 * Middleware to require a specific permission
 * Usage: requirePermission('view_jobs')
 * 
 * The middleware reads the authenticated user's id from req.user.id
 * (set by authMiddleware) and checks if the user's role has the required permission.
 */
export function requirePermission(permissionName: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check if user is authenticated (set by authMiddleware)
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      // Check if prisma is initialized
      if (!prisma) {
        logger.error({ route: req.originalUrl || req.url, message: 'Prisma client is not initialized' });
        return res.status(500).json({
          success: false,
          message: 'Database connection error',
        });
      }

      const cacheKey = buildPermissionCacheKey(req.user.id);
      const cached = await getCache(cacheKey);

      let userAuthz: any;
      if (cached) {
        userAuthz = JSON.parse(cached);
      } else {
        const user = await prisma.user.findUnique({
          where: { id: req.user.id },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            roleId: true,
            isActive: true,
            systemRole: {
              select: { id: true, roleName: true, color: true },
            },
          },
        });

        if (!user) {
          return res.status(401).json({
            success: false,
            message: 'Unauthorized',
          });
        }

        const isSuperAdmin =
          user.role === 'SUPER_ADMIN' ||
          user.systemRole?.roleName === 'Super Admin';

        let permissions: string[] = [];
        if (!isSuperAdmin && user.roleId) {
          const rolePermissions = await prisma.rolePermission.findMany({
            where: { roleId: user.roleId },
            select: {
              permission: {
                select: {
                  permissionName: true,
                },
              },
            },
          });
          permissions = rolePermissions
            .map((rp) => rp.permission?.permissionName)
            .filter(Boolean) as string[];
        }

        userAuthz = {
          ...user,
          isSuperAdmin,
          permissions: isSuperAdmin ? ['all'] : permissions,
        };

        await setCache(cacheKey, JSON.stringify(userAuthz), 300);
      }

      // If user has no role assigned, deny access
      if (!userAuthz.systemRole) {
        return res.status(403).json({
          success: false,
          message: `Access denied: requires ${permissionName}`,
        });
      }

      // Check if the role has the required permission
      const hasPermission = Array.isArray(userAuthz.permissions) && userAuthz.permissions.includes(permissionName);

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: `Access denied: requires ${permissionName}`,
        });
      }

      // Permission granted, continue
      next();
    } catch (error: any) {
      logger.error({
        route: req.originalUrl || req.url,
        message: error?.message || 'Permission check failed',
        userId: req.user?.id,
        permissionName,
      });

      return res.status(500).json({
        success: false,
        message: 'Permission check failed',
      });
    }
  };
}
