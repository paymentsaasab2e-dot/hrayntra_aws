import { prisma } from '../config/prisma.js';
import { getActiveTenantDbName } from '../config/prisma.js';
import { getCache, setCache } from '../cache/redis.js';
import { sendError } from '../utils/response.js';
import logger from '../utils/logger.js';

function buildPermissionCacheKey(userId) {
  const tenant = getActiveTenantDbName() || 'default';
  return `permission:check:${tenant}:${userId}`;
}

function normalizePermissions(values = []) {
  return Array.isArray(values) ? values.filter(Boolean).map((value) => String(value)) : [];
}

function hasAnyPermission(userPermissions, requiredPermissions = []) {
  if (userPermissions.includes('all')) return true;
  return requiredPermissions.some((permission) => userPermissions.includes(permission));
}

/**
 * Middleware to require a specific permission
 * Usage: requirePermission('view_jobs')
 */
export function requirePermission(permissionName) {
  const requiredPermissions = normalizePermissions([permissionName]);
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return sendError(res, 401, 'Authentication required');
      }

      // Check if prisma is initialized
      if (!prisma) {
        logger.error({ route: req.originalUrl || req.url, message: 'Prisma client is not initialized' });
        return sendError(res, 500, 'Database connection error');
      }

      const { userAuthz, error } = await loadUserAuthz(req);
      if (error) return sendError(res, error.status, error.message);

      const isSuperAdmin = Boolean(userAuthz.isSuperAdmin);

      if (isSuperAdmin) {
        req.userWithPermissions = {
          ...userAuthz,
          permissions: ['all'],
        };
        return next();
      }

      if (!userAuthz.systemRole) {
        return sendError(res, 403, `Access denied: requires ${permissionName}. User has no role assigned.`);
      }

      const userPermissions = normalizePermissions(userAuthz.permissions);
      const hasPermission = hasAnyPermission(userPermissions, requiredPermissions);

      if (!hasPermission) {
        return sendError(res, 403, `Access denied: requires ${permissionName}. Your role (${userAuthz.systemRole.roleName}) does not have this permission.`);
      }

      req.userWithPermissions = {
        ...userAuthz,
        permissions: userPermissions,
      };

      next();
    } catch (error) {
      logger.error({
        route: req.originalUrl || req.url,
        message: error?.message || 'Permission check failed',
        userId: req.user?.id,
        permissionName,
      });
      return sendError(res, 500, `Permission check failed: ${error?.message || 'Unknown error'}`, error);
    }
  };
}

async function loadUserAuthz(req) {
  if (!req.user?.id) {
    return { error: { status: 401, message: 'Authentication required' } };
  }
  if (!prisma) {
    return { error: { status: 500, message: 'Database connection error' } };
  }

  const cacheKey = buildPermissionCacheKey(req.user.id);
  const cached = await getCache(cacheKey);
  if (cached) {
    return { userAuthz: JSON.parse(cached) };
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      roleId: true,
      systemRole: { select: { id: true, roleName: true, color: true } },
    },
  });

  if (!user) {
    return { error: { status: 401, message: 'User not found' } };
  }

  const isSuperAdmin = user.role === 'SUPER_ADMIN' || user.systemRole?.roleName === 'Super Admin';
  let permissions = [];
  if (!isSuperAdmin && user.roleId) {
    const rolePermissions = await prisma.rolePermission.findMany({
      where: { roleId: user.roleId },
      select: { permission: { select: { permissionName: true } } },
    });
    permissions = rolePermissions.map((rp) => rp.permission?.permissionName).filter(Boolean);
  }

  const userAuthz = {
    ...user,
    isSuperAdmin,
    permissions: isSuperAdmin ? ['all'] : permissions,
  };

  await setCache(cacheKey, JSON.stringify(userAuthz), 300);
  return { userAuthz };
}

/** Load role permissions onto req without requiring a specific permission. */
export async function attachUserPermissions(req, res, next) {
  try {
    const { userAuthz, error } = await loadUserAuthz(req);
    if (error) return sendError(res, error.status, error.message);
    req.userWithPermissions = {
      ...userAuthz,
      permissions: normalizePermissions(userAuthz.permissions),
    };
    return next();
  } catch (err) {
    return sendError(res, 500, `Permission load failed: ${err?.message || 'Unknown error'}`, err);
  }
}

export function requireAnyPermission(permissionNames = []) {
  const requiredPermissions = normalizePermissions(permissionNames);
  return async (req, res, next) => {
    try {
      if (!requiredPermissions.length) {
        return sendError(res, 500, 'Permission middleware misconfigured: no required permissions provided');
      }

      if (!req.user || !req.user.id) {
        return sendError(res, 401, 'Authentication required');
      }

      if (!prisma) {
        logger.error({ route: req.originalUrl || req.url, message: 'Prisma client is not initialized' });
        return sendError(res, 500, 'Database connection error');
      }

      const cacheKey = buildPermissionCacheKey(req.user.id);
      const cached = await getCache(cacheKey);

      let userAuthz;
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
            isActive: true,
            roleId: true,
            systemRole: {
              select: {
                id: true,
                roleName: true,
                color: true,
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

        let permissions = [];
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
            .filter(Boolean);
        }

        userAuthz = {
          ...user,
          isSuperAdmin,
          permissions: isSuperAdmin ? ['all'] : permissions,
        };

        await setCache(cacheKey, JSON.stringify(userAuthz), 300);
      }

      const userPermissions = normalizePermissions(userAuthz.permissions);
      const granted = hasAnyPermission(userPermissions, requiredPermissions);

      if (!granted) {
        const required = requiredPermissions.join(' OR ');
        return sendError(
          res,
          403,
          `Access denied: requires ${required}. Your role (${userAuthz.systemRole?.roleName || 'Unknown'}) does not have this permission.`
        );
      }

      req.userWithPermissions = {
        ...userAuthz,
        permissions: userPermissions,
      };

      next();
    } catch (error) {
      logger.error({
        route: req.originalUrl || req.url,
        message: error?.message || 'Permission check failed',
        userId: req.user?.id,
        permissionNames: requiredPermissions,
      });
      return sendError(res, 500, `Permission check failed: ${error?.message || 'Unknown error'}`, error);
    }
  };
}
