import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma.js';

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
        console.error('Prisma client is not initialized');
        return res.status(500).json({
          success: false,
          message: 'Database connection error',
        });
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
        return res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      // If user has no role assigned, deny access
      if (!user.systemRole) {
        return res.status(403).json({
          success: false,
          message: `Access denied: requires ${permissionName}`,
        });
      }

      // Check if the role has the required permission
      const hasPermission = user.systemRole.rolePermissions.some(
        (rp) => rp.permission && rp.permission.permissionName === permissionName
      );

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: `Access denied: requires ${permissionName}`,
        });
      }

      // Permission granted, continue
      next();
    } catch (error: any) {
      console.error('Permission middleware error:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
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
