import { prisma } from '../../config/prisma.js';
import { getPaginationParams, formatPaginationResponse } from '../../utils/pagination.js';
import {
  excludeHqPlatformUsers,
  hqPlatformUserEmailNotClause,
} from '../../utils/hqPlatformUser.js';
import { listCrmAssigneeCandidates } from '../../services/crmAssignmentScope.service.js';
import { resolveTenantOrganizationName } from '../setting/recruitmentMode.service.js';

const JOB_VISIBILITY_DEFAULTS_KEY = 'jobPublicVisibilityDefaults';
const JOB_VISIBILITY_FIELDS = [
  'nationality',
  'jobTitle',
  'client',
  'contactPerson',
  'openings',
  'location',
  'industryType',
  'employmentType',
  'targetHireDate',
  'experience',
  'salary',
  'languages',
  'keyResponsibilities',
  'qualifications',
  'candidateRequirements',
  'skills',
  'jobDescription',
  'videoMediaLink',
  'forecastRevenue',
  'priority',
  'aboutCompany',
  'recruiterProfile',
];

function emptyJobVisibilityDefaults() {
  const publicFieldVisibility = Object.fromEntries(JOB_VISIBILITY_FIELDS.map((key) => [key, true]));
  return {
    publicFieldVisibility,
    showClientNamePublicly: true,
    updatedAt: null,
  };
}

function normalizeJobVisibilityDefaults(raw) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const nested =
    source.publicFieldVisibility && typeof source.publicFieldVisibility === 'object'
      ? source.publicFieldVisibility
      : source;
  const publicFieldVisibility = {};
  for (const key of JOB_VISIBILITY_FIELDS) {
    publicFieldVisibility[key] = nested[key] !== false;
  }
  const showClientNamePublicly =
    source.showClientNamePublicly === false || publicFieldVisibility.client === false ? false : true;
  publicFieldVisibility.client = showClientNamePublicly;
  return {
    publicFieldVisibility,
    showClientNamePublicly,
    updatedAt: typeof source.updatedAt === 'string' && source.updatedAt.trim() ? source.updatedAt : null,
  };
}

async function withOrganizationName(profile) {
  if (!profile) return profile;
  const organizationName = await resolveTenantOrganizationName({
    email: profile.email,
  });
  return {
    ...profile,
    organizationName: organizationName || '',
    companyName: organizationName || '',
  };
}

export const userService = {
  async getAll(req) {
    const { page, limit, skip } = getPaginationParams(req);
    const { role, isActive, search } = req.query;
    // Assign/recruiter pickers: tenant team only (never HQ platform accounts).
    const assignableOnly =
      String(req.query.assignable || req.query.forAssign || '').toLowerCase() === 'true' ||
      String(req.query.assignable || req.query.forAssign || '') === '1';

    if (assignableOnly && req.user?.id) {
      const candidates = await listCrmAssigneeCandidates(req.user.id, { req });
      let filtered = candidates;
      if (search) {
        const q = String(search).trim().toLowerCase();
        filtered = filtered.filter((u) => {
          const name = `${u.firstName || ''} ${u.lastName || ''} ${u.name || ''} ${u.email || ''}`.toLowerCase();
          return name.includes(q);
        });
      }
      // Legacy `role=RECRUITER` enum is ignored for assignable pickers — tenants use
      // custom system roles. All non-HQ tenant members from the assignment scope are returned.
      const total = filtered.length;
      const pageRows = filtered.slice(skip, skip + limit).map((u) => ({
        id: u.id,
        name: u.name,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        role: u.role?.roleName || '',
        department: u.department?.name || null,
        orgUnit: u.orgUnit || null,
        isActive: String(u.status || '').toUpperCase() !== 'INACTIVE',
        status: u.status,
      }));
      return formatPaginationResponse(pageRows, page, limit, total);
    }

    const where = {
      ...hqPlatformUserEmailNotClause(),
    };
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
        take: Math.min(Math.max(limit * 2, limit), 500),
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
          systemRole: { select: { roleName: true } },
          credential: { select: { loginId: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    const sanitized = excludeHqPlatformUsers(users).slice(0, limit).map((user) => {
      const { systemRole, credential, ...rest } = user;
      return rest;
    });

    // total may slightly over-count when HQ rows exist; assignable path is exact.
    return formatPaginationResponse(sanitized, page, limit, Math.max(0, total - (users.length - sanitized.length)));
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
    return withOrganizationName({
      ...profile,
      loginId: credential?.loginId || null,
    });
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

    const updated = await prisma.user.update({
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
    return withOrganizationName(updated);
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

  async getJobVisibilityDefaults(userId) {
    if (!userId) return emptyJobVisibilityDefaults();
    const row = await prisma.setting.findUnique({
      where: {
        userId_key_scope: {
          userId,
          key: JOB_VISIBILITY_DEFAULTS_KEY,
          scope: 'USER',
        },
      },
    });
    if (!row?.value) return emptyJobVisibilityDefaults();
    return normalizeJobVisibilityDefaults(row.value);
  },

  async saveJobVisibilityDefaults(userId, raw) {
    if (!userId) {
      const err = new Error('User is required');
      err.statusCode = 401;
      throw err;
    }
    const value = {
      ...normalizeJobVisibilityDefaults(raw),
      updatedAt: new Date().toISOString(),
    };
    await prisma.setting.upsert({
      where: {
        userId_key_scope: {
          userId,
          key: JOB_VISIBILITY_DEFAULTS_KEY,
          scope: 'USER',
        },
      },
      update: { value },
      create: {
        userId,
        key: JOB_VISIBILITY_DEFAULTS_KEY,
        value,
        scope: 'USER',
      },
    });
    return value;
  },
};
