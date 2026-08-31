import { prisma, getActiveTenantDbName } from '../config/prisma.js';
import { getCache, setCache, deleteCacheByPattern } from '../cache/redis.js';
import logger from '../utils/logger.js';
import {
  generateLoginId,
  generateTempPassword,
  hashPassword,
  generateInviteToken,
  getInviteExpiry,
} from '../utils/credentialGenerator.js';
import { sendInviteEmail, sendPasswordResetEmail } from '../services/emailService.js';
import { isSuperAdminUser } from '../utils/superAdminScope.js';
import { headquartersAuthService } from '../modules/auth/headquarters-auth.service.js';
import activityService from '../services/activityService.js';
import {
  assertRoleAllowedInDepartment,
  resolveDefaultManagerId,
  validateReportingManager,
  attachDepartmentRanksToMembers,
  attachDepartmentRankToMember,
} from '../services/departmentRole.service.js';
import { listCrmAssigneeCandidates } from '../services/crmAssignmentScope.service.js';
import {
  excludeHqPlatformUsers,
  hqPlatformUserEmailNotClause,
} from '../utils/hqPlatformUser.js';
import {
  applyOrgCompanyUserWhere,
  canViewCrossCompanyMembers,
  requestedAssignCompanyId,
  resolveWriteOrgUnitId,
} from '../services/orgListScope.service.js';

const EMPTY_OBJECT_ID = '000000000000000000000000';

/**
 * Best-effort: register the new credential's email/loginId in the HQ directory
 * so the user can later sign in via the plain `/login` URL (without the
 * invite-link `tenantDbName=` query param).
 */
async function recordTenantUserDirectoryEntry({ email, loginId }) {
  const tenantDbName = getActiveTenantDbName() || '';
  if (!tenantDbName) return;
  try {
    await headquartersAuthService.upsertTenantUserDirectoryEntry({
      email,
      loginId,
      tenantDbName,
    });
  } catch (error) {
    logger.warn({ message: 'tenant-user directory upsert failed', error: error?.message });
  }
}

function getTeamListCacheKey(req) {
  const tenant = getActiveTenantDbName() || 'default';
  const page = Math.max(Number.parseInt(String(req.query.page || '1'), 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(String(req.query.limit || '20'), 10) || 20, 1), 100);
  const assignableOnly = Boolean(req.teamListMode === 'assignable');
  const assignAcrossOrgs = Boolean(assignableOnly && canViewCrossCompanyMembers(req));
  const keyPayload = {
    search: req.query.search || '',
    departmentId: req.query.departmentId || '',
    roleName: req.query.roleName || '',
    status: req.query.status || '',
    managerId: req.query.managerId || '',
    superAdmin: Boolean(isSuperAdminUser(req)),
    userId: req.user?.id || '',
    assignableOnly,
    assignAcrossOrgs,
    hqExcluded: 2,
    orgUnitId: assignableOnly
      ? requestedAssignCompanyId(req)
      : String(req.query.orgUnitId || req.headers?.['x-org-unit-id'] || ''),
    page,
    limit,
  };
  return `team:list:${tenant}:${JSON.stringify(keyPayload)}`;
}

function getTeamListCachePattern() {
  const tenant = getActiveTenantDbName() || 'default';
  return `team:list:${tenant}:*`;
}

function getPermissionCachePattern() {
  const tenant = getActiveTenantDbName() || 'default';
  return `permission:check:${tenant}:*`;
}

async function findAccessibleMember(req, memberId) {
  const member = await prisma.user.findUnique({
    where: { id: memberId },
    select: {
      id: true,
      credential: { select: { createdBy: true } },
    },
  });

  if (!member) return null;
  return member;
}

/**
 * Get all team members with filters
 * GET /api/team
 */
export async function getAllTeamMembers(req, res) {
  try {
    const page = Math.max(Number.parseInt(String(req.query.page || '1'), 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(String(req.query.limit || '20'), 10) || 20, 1), 100);
    const skip = (page - 1) * limit;
    const { search, departmentId, roleName, status, managerId } = req.query;
    const cacheKey = getTeamListCacheKey(req);

    const cached = await getCache(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      res.setHeader('Cache-Control', 'private, no-store');
      return res.status(200).json(parsed);
    }

    const where = {
      ...hqPlatformUserEmailNotClause(),
    };

    // Search filter - match firstName, lastName, or email
    if (search && typeof search === 'string') {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Department filter
    if (departmentId) {
      where.departmentId = departmentId;
    }

    // Role filter - match through role relation
    if (roleName) {
      const role = await prisma.systemRole.findFirst({
        where: { roleName: roleName },
      });
      if (role) {
        where.roleId = role.id;
      }
    }

    // Status filter
    if (status) {
      where.status = status;
    }

    // Manager filter
    if (managerId) {
      where.managerId = managerId;
    }

    const isAssignableList = req.teamListMode === 'assignable';
    if (isAssignableList && req.user?.id) {
      const candidates = await listCrmAssigneeCandidates(req.user.id, { req });
      const allowedIds = candidates.map((member) => member.id).filter(Boolean);
      const existingAnd = Array.isArray(where.AND) ? where.AND : [];
      where.AND = [...existingAnd, { id: { in: allowedIds.length ? allowedIds : [EMPTY_OBJECT_ID] } }];
    }

    // Users follow their company. Assign pickers for Super Admin / cross-company
    // permission require companyId and return that company's members only.
    const orgUserWhere = await applyOrgCompanyUserWhere(req, { forAssign: isAssignableList });
    if (orgUserWhere) {
      const existingAnd = Array.isArray(where.AND) ? where.AND : [];
      where.AND = [...existingAnd, orgUserWhere];
    }

    const [members, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          name: true,
          email: true,
          phone: true,
          designation: true,
          location: true,
          status: true,
          departmentId: true,
          roleId: true,
          orgUnitId: true,
          hierarchyPurpose: true,
          createdAt: true,
          updatedAt: true,
          systemRole: {
            select: {
              id: true,
              roleName: true,
              color: true,
            },
          },
          departmentRelation: {
            select: {
              id: true,
              name: true,
            },
          },
          managerRelation: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          credential: {
            select: {
              loginId: true,
              isLocked: true,
              lastLoginAt: true,
              tempPasswordFlag: true,
              createdBy: true,
            },
          },
          _count: {
            select: {
              tasks: true,
              assignedLeads: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    const memberUnitIds = [
      ...new Set(members.map((m) => m.orgUnitId).filter(Boolean).map(String)),
    ];
    const unitById = new Map();
    if (memberUnitIds.length) {
      const units = await prisma.orgUnit.findMany({
        where: { id: { in: memberUnitIds } },
        select: { id: true, name: true, isLeaf: true },
      });
      for (const unit of units) {
        unitById.set(String(unit.id), {
          id: String(unit.id),
          name: unit.name,
          kind: unit.isLeaf ? 'branch' : 'company',
        });
      }
    }

    // Normalize the response to match frontend expectations
    const normalizedMembers = excludeHqPlatformUsers(
      members.map((member) => ({
        ...member,
        role: member.systemRole || null,
        department: member.departmentRelation || null,
        manager: member.managerRelation || null,
        orgUnit: member.orgUnitId ? unitById.get(String(member.orgUnitId)) || null : null,
        loginId: member.credential?.loginId,
      })),
    );

    const membersWithRanks = await attachDepartmentRanksToMembers(normalizedMembers);

    const responsePayload = {
      success: true,
      data: membersWithRanks,
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
    if (error?.statusCode === 403) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    logger.error({ route: req.originalUrl || req.url, message: error?.message || 'Failed to fetch team members' });
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch team members',
    });
  }
}

/**
 * Get team member by ID
 * GET /api/team/:id
 */
export async function getTeamMemberById(req, res) {
  try {
    const { id } = req.params;
    const accessible = await findAccessibleMember(req, id);
    if (!accessible) {
      return res.status(404).json({
        success: false,
        message: 'Team member not found',
      });
    }

    const member = await prisma.user.findUnique({
      where: { id },
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
        departmentRelation: true,
        managerRelation: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        subordinates: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            designation: true,
          },
        },
        credential: {
          include: {
            loginHistory: {
              orderBy: { timestamp: 'desc' },
              take: 10,
            },
          },
        },
        activities: {
          orderBy: { timestamp: 'desc' },
          take: 20,
        },
        tasks: {
          orderBy: { dueDate: 'asc' },
        },
        targets: {
          orderBy: { createdAt: 'desc' },
        },
        commissions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Team member not found',
      });
    }

    // Normalize the response to match frontend expectations
    const normalizedMember = {
      ...member,
      role: member.systemRole || null,
      department: member.departmentRelation || null,
      manager: member.managerRelation || null,
    };

    const memberWithRank = await attachDepartmentRankToMember(normalizedMember);

    return res.status(200).json({
      success: true,
      data: memberWithRank,
    });
  } catch (error) {
    logger.error({ route: req.originalUrl || req.url, message: error?.message || 'Failed to fetch team member' });
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch team member',
    });
  }
}

function normalizeTeamMemberForApi(member, credentialData = null) {
  if (!member) return null;
  return {
    id: member.id,
    firstName: member.firstName,
    lastName: member.lastName,
    name: member.name,
    email: member.email,
    phone: member.phone,
    designation: member.designation,
    location: member.location,
    status: member.status,
    isActive: member.isActive,
    departmentId: member.departmentId,
    roleId: member.roleId,
    managerId: member.managerId,
    createdAt: member.createdAt,
    updatedAt: member.updatedAt,
    role: member.systemRole
      ? {
          id: member.systemRole.id,
          roleName: member.systemRole.roleName,
          color: member.systemRole.color,
        }
      : null,
    department: member.departmentRelation
      ? { id: member.departmentRelation.id, name: member.departmentRelation.name }
      : null,
    manager: member.managerRelation
      ? {
          id: member.managerRelation.id,
          firstName: member.managerRelation.firstName,
          lastName: member.managerRelation.lastName,
        }
      : null,
    credentialData: credentialData || null,
  };
}

/**
 * Create new team member
 * POST /api/team
 */
export async function createTeamMember(req, res) {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      designation,
      location,
      departmentId,
      roleId,
      managerId,
      status,
      generateCredentials,
      sendInvite,
    } = req.body;
    const shouldGenerateCredentials = generateCredentials !== false;
    const shouldSendInvite = sendInvite !== false;

    // Validation
    const errors = {};
    if (!firstName) errors.firstName = 'First name is required';
    if (!lastName) errors.lastName = 'Last name is required';
    if (!email) errors.email = 'Email is required';
    if (!roleId) errors.roleId = 'Role is required';

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors,
      });
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'A member with this email already exists',
      });
    }

    if (departmentId && roleId) {
      try {
        await assertRoleAllowedInDepartment(departmentId, roleId);
        if (managerId) {
          await validateReportingManager(departmentId, roleId, managerId);
        }
      } catch (validationError) {
        return res.status(400).json({
          success: false,
          message: validationError?.message || 'Invalid department role assignment',
        });
      }
    }

    let resolvedManagerId = managerId || null;
    if (departmentId && roleId) {
      resolvedManagerId = await resolveDefaultManagerId(departmentId, roleId, managerId || null);
    }

    // New members join the company/branch the creator is operating in, so Team
    // stays segregated the same way leads, clients and jobs are.
    const orgUnitId =
      (req.body?.orgUnitId ? String(req.body.orgUnitId) : null) ||
      (await resolveWriteOrgUnitId(req));

    // Create user
    const user = await prisma.user.create({
      data: {
        ...(orgUnitId ? { orgUnitId } : {}),
        name: `${firstName} ${lastName}`.trim(),
        firstName,
        lastName,
        email,
        phone,
        designation,
        location,
        departmentId,
        roleId,
        managerId: resolvedManagerId,
        status: status || 'ACTIVE',
        isActive: status !== 'INACTIVE',
        passwordHash: 'PLACEHOLDER', // Will be set if credentials generated
      },
    });

    let credentialData = null;

    // Generate credentials if requested
    if (shouldGenerateCredentials) {
      const loginId = await generateLoginId(firstName, lastName);
      const tempPassword = generateTempPassword();
      const hashedPassword = await hashPassword(tempPassword);
      const inviteToken = generateInviteToken();
      const inviteExpiresAt = getInviteExpiry(48);

      await prisma.userCredential.create({
        data: {
          userId: user.id,
          loginId,
          hashedPassword,
          tempPasswordFlag: true,
          inviteToken,
          inviteExpiresAt,
          inviteSentAt: shouldSendInvite ? new Date() : null,
          createdBy: req.user?.id || null,
        },
      });

      await recordTenantUserDirectoryEntry({ email: user.email, loginId });

      credentialData = {
        loginId,
        tempPassword,
      };

      // Send invite email if requested
      if (shouldSendInvite) {
        const role = await prisma.systemRole.findUnique({
          where: { id: roleId },
          select: { roleName: true },
        });

        try {
          await sendInviteEmail({
            toEmail: email,
            toName: `${firstName} ${lastName}`,
            loginId,
            tempPassword,
            roleName: role?.roleName || 'Team Member',
            inviteToken,
            senderUserId: req.user?.id || null,
            tenantDbName: getActiveTenantDbName() || undefined,
          });
        } catch (emailError) {
          logger.error({
            route: req.originalUrl || req.url,
            message: `Team member created but invite email failed: ${emailError?.message || emailError}`,
          });
        }
      }
    }

    // Fetch created member with relations
    const createdMember = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        systemRole: {
          select: {
            id: true,
            roleName: true,
            color: true,
          },
        },
        departmentRelation: {
          select: {
            id: true,
            name: true,
          },
        },
        managerRelation: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    await deleteCacheByPattern(getTeamListCachePattern());

    if (req.user?.id && createdMember) {
      const memberName =
        `${createdMember.firstName || ''} ${createdMember.lastName || ''}`.trim() || createdMember.name || email;
      try {
        await activityService.logTeamActivity({
          entityId: createdMember.id,
          performedById: req.user.id,
          action: 'Team member added',
          description: `${memberName} was added to the team${createdMember.systemRole?.roleName ? ` as ${createdMember.systemRole.roleName}` : ''}.`,
          relatedLabel: memberName,
          metadata: {
            memberId: createdMember.id,
            email: createdMember.email,
            roleId: createdMember.roleId,
            roleName: createdMember.systemRole?.roleName,
          },
        });
      } catch (activityErr) {
        logger.warn({
          route: req.originalUrl || req.url,
          message: `Team member created but activity log failed: ${activityErr?.message || activityErr}`,
        });
      }
    }

    const normalizedMember = normalizeTeamMemberForApi(createdMember, credentialData);

    return res.status(201).json({
      success: true,
      data: normalizedMember,
      message: 'Team member created successfully',
    });
  } catch (error) {
    logger.error({ route: req.originalUrl || req.url, message: error?.message || 'Failed to create team member' });
    return res.status(500).json({
      success: false,
      message: 'Failed to create team member',
    });
  }
}

/**
 * Update team member
 * PATCH /api/team/:id
 */
export async function updateTeamMember(req, res) {
  try {
    const { id } = req.params;
    const accessible = await findAccessibleMember(req, id);
    if (!accessible) {
      return res.status(404).json({
        success: false,
        message: 'Team member not found',
      });
    }
    const {
      firstName,
      lastName,
      email,
      phone,
      designation,
      location,
      departmentId,
      roleId,
      managerId,
      status,
    } = req.body;

    // Build update data - only include fields that are present
    const updateData = {};

    if (firstName !== undefined && firstName !== null) {
      updateData.firstName = firstName.trim();
    }
    if (lastName !== undefined && lastName !== null) {
      updateData.lastName = lastName.trim();
    }
    if ((firstName !== undefined && firstName !== null) || (lastName !== undefined && lastName !== null)) {
      updateData.name = `${firstName || ''} ${lastName || ''}`.trim();
    }
    if (email !== undefined && email !== null) {
      updateData.email = email.trim();
    }
    if (phone !== undefined) {
      updateData.phone = phone && phone.trim() ? phone.trim() : null;
    }
    if (designation !== undefined) {
      updateData.designation = designation && designation.trim() ? designation.trim() : null;
    }
    if (location !== undefined) {
      updateData.location = location && location.trim() ? location.trim() : null;
    }
    if (departmentId !== undefined) {
      // Allow empty string to clear the department
      updateData.departmentId = (departmentId && departmentId.trim()) ? departmentId.trim() : null;
    }
    if (roleId !== undefined) {
      // Role is required, but allow empty string to be handled
      updateData.roleId = (roleId && roleId.trim()) ? roleId.trim() : null;
    }
    if (managerId !== undefined) {
      // Allow empty string to clear the manager
      updateData.managerId = (managerId && managerId.trim()) ? managerId.trim() : null;
    }
    if (status !== undefined) {
      updateData.status = status;
      updateData.isActive = status !== 'INACTIVE';
    }

    // Ensure we have at least one field to update
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update',
      });
    }

    const memberBefore = await prisma.user.findUnique({
      where: { id },
      select: {
        roleId: true,
        departmentId: true,
        managerId: true,
        firstName: true,
        lastName: true,
        name: true,
      },
    });

    // Check email uniqueness if email is being changed
    if (email && email.trim()) {
      const existing = await prisma.user.findFirst({
        where: {
          email: email.trim(),
          id: { not: id },
        },
      });

      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'A member with this email already exists',
        });
      }
    }

    const effectiveDepartmentId =
      updateData.departmentId !== undefined ? updateData.departmentId : memberBefore?.departmentId;
    const effectiveRoleId = updateData.roleId !== undefined ? updateData.roleId : memberBefore?.roleId;

    if (effectiveDepartmentId && effectiveRoleId) {
      try {
        await assertRoleAllowedInDepartment(effectiveDepartmentId, effectiveRoleId);
        const explicitManager =
          updateData.managerId !== undefined ? updateData.managerId : memberBefore?.managerId;
        if (explicitManager) {
          await validateReportingManager(effectiveDepartmentId, effectiveRoleId, explicitManager);
        } else if (updateData.managerId === null || updateData.managerId === '') {
          updateData.managerId = await resolveDefaultManagerId(
            effectiveDepartmentId,
            effectiveRoleId,
            null,
          );
        }
      } catch (validationError) {
        return res.status(400).json({
          success: false,
          message: validationError?.message || 'Invalid department role assignment',
        });
      }
    }

    if (effectiveDepartmentId && effectiveRoleId && updateData.managerId === undefined) {
      const currentManagerId = memberBefore?.managerId;
      if (!currentManagerId) {
        updateData.managerId = await resolveDefaultManagerId(
          effectiveDepartmentId,
          effectiveRoleId,
          null,
        );
      }
    }

    // Update user
    const updatedMember = await prisma.user.update({
      where: { id },
      data: updateData,
      include: {
        systemRole: {
          select: {
            id: true,
            roleName: true,
            color: true,
          },
        },
        departmentRelation: {
          select: {
            id: true,
            name: true,
          },
        },
        managerRelation: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        credential: {
          select: {
            loginId: true,
            isLocked: true,
            lastLoginAt: true,
            tempPasswordFlag: true,
          },
        },
        _count: {
          select: {
            tasks: true,
            assignedLeads: true,
          },
        },
      },
    });

    await deleteCacheByPattern(getTeamListCachePattern());
    if (updateData.roleId !== undefined) {
      await deleteCacheByPattern(getPermissionCachePattern());
    }

    if (req.user?.id) {
      const memberName =
        `${updatedMember.firstName || ''} ${updatedMember.lastName || ''}`.trim() || updatedMember.name || 'Member';
      const roleChanged =
        updateData.roleId !== undefined &&
        String(updateData.roleId || '') !== String(memberBefore?.roleId || '');
      await activityService.logTeamActivity({
        entityId: id,
        performedById: req.user.id,
        action: roleChanged ? 'Member role changed' : 'Team member updated',
        description: roleChanged
          ? `${memberName} role changed to ${updatedMember.systemRole?.roleName || '—'}.`
          : `${memberName} profile was updated.`,
        relatedLabel: memberName,
        metadata: {
          memberId: id,
          roleId: updatedMember.roleId,
          roleName: updatedMember.systemRole?.roleName,
          updatedFields: Object.keys(updateData),
        },
      });
    }

    // Normalize the response to match frontend expectations
    const normalizedMember = {
      ...updatedMember,
      role: updatedMember.systemRole || null,
      department: updatedMember.departmentRelation || null,
      manager: updatedMember.managerRelation || null,
    };

    return res.status(200).json({
      success: true,
      message: 'Team member updated successfully',
      data: normalizedMember,
    });
  } catch (error) {
    logger.error({ route: req.originalUrl || req.url, message: error?.message || 'Failed to update team member' });
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Team member not found',
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to update team member',
    });
  }
}

/**
 * Deactivate team member (soft delete)
 * POST /api/team/:id/deactivate
 */
export async function deactivateTeamMember(req, res) {
  try {
    const { id } = req.params;
    const accessible = await findAccessibleMember(req, id);
    if (!accessible) {
      return res.status(404).json({
        success: false,
        message: 'Team member not found',
      });
    }

    await prisma.user.update({
      where: { id },
      data: {
        status: 'INACTIVE',
        isActive: false,
      },
    });
    await deleteCacheByPattern(getTeamListCachePattern());

    return res.status(200).json({
      success: true,
      message: 'Member deactivated. All historical data preserved.',
    });
  } catch (error) {
    logger.error({ route: req.originalUrl || req.url, message: error?.message || 'Failed to deactivate team member' });
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Team member not found',
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to deactivate team member',
    });
  }
}

/**
 * Delete team member (hard delete)
 * DELETE /api/team/:id
 */
export async function deleteTeamMember(req, res) {
  try {
    const { id } = req.params;

    // Delete related records first (Prisma will handle cascading deletes based on schema)
    // Delete UserCredential and related LoginHistory
    await prisma.userCredential.deleteMany({
      where: { userId: id },
    });

    // Delete UserActivity
    await prisma.userActivity.deleteMany({
      where: { userId: id },
    });

    // Delete TeamTask
    await prisma.teamTask.deleteMany({
      where: { userId: id },
    });

    // Delete TeamTarget
    await prisma.teamTarget.deleteMany({
      where: { userId: id },
    });

    // Delete Commission
    await prisma.commission.deleteMany({
      where: { userId: id },
    });

    // Delete Tasks assigned to this user (required relation, must delete)
    await prisma.task.deleteMany({
      where: { assignedToId: id },
    });

    // Delete Tasks created by this user
    await prisma.task.deleteMany({
      where: { createdById: id },
    });

    // Update manager relations (set managerId to null for subordinates)
    await prisma.user.updateMany({
      where: { managerId: id },
      data: { managerId: null },
    });

    // Update other relations that reference this user (set to null where nullable)
    // Update Clients assigned to this user
    await prisma.client.updateMany({
      where: { assignedToId: id },
      data: { assignedToId: null },
    });

    // Update Candidates assigned to this user
    await prisma.candidate.updateMany({
      where: { assignedToId: id },
      data: { assignedToId: null },
    });

    // Update Jobs assigned to this user
    await prisma.job.updateMany({
      where: { assignedToId: id },
      data: { assignedToId: null },
    });

    // Update Leads assigned to this user
    await prisma.lead.updateMany({
      where: { assignedToId: id },
      data: { assignedToId: null },
    });

    // Update Contacts owned by this user
    await prisma.contact.updateMany({
      where: { ownerId: id },
      data: { ownerId: null },
    });

    // Delete notes created by this user (createdById/authorId are required fields)
    await prisma.clientNote.deleteMany({
      where: { createdById: id },
    });

    await prisma.contactNote.deleteMany({
      where: { authorId: id },
    });

    await prisma.jobNote.deleteMany({
      where: { createdById: id },
    });

    await prisma.leadNote.deleteMany({
      where: { createdById: id },
    });

    // Files uploaded by this user (required uploadedById — blocks user delete, e.g. ClientFileToUser)
    await prisma.clientFile.deleteMany({
      where: { uploadedById: id },
    });
    await prisma.jobFile.deleteMany({
      where: { uploadedById: id },
    });
    await prisma.leadFile.deleteMany({
      where: { uploadedById: id },
    });
    await prisma.candidateFile.deleteMany({
      where: { uploadedById: id },
    });
    await prisma.interviewFile.deleteMany({
      where: { uploadedById: id },
    });
    await prisma.taskFile.deleteMany({
      where: { uploadedById: id },
    });

    // Scheduled meetings (required scheduledById)
    await prisma.scheduledMeeting.updateMany({
      where: { cancelledBy: id },
      data: { cancelledBy: null },
    });
    await prisma.scheduledMeeting.deleteMany({
      where: { scheduledById: id },
    });

    // Inbox / messaging (senderId & participant userId are required)
    await prisma.message.deleteMany({
      where: { senderId: id },
    });
    await prisma.threadParticipant.deleteMany({
      where: { userId: id },
    });

    await prisma.assistantPageHistory.deleteMany({
      where: { userId: id },
    });
    await prisma.undo.deleteMany({
      where: { userId: id },
    });

    // Delete or update Interview-related records
    // Delete interview panels with this user
    await prisma.interviewPanel.deleteMany({
      where: { userId: id },
    });

    // Update interviews (set interviewerId and createdById to null if nullable, or delete if required)
    // Note: Check schema to see if these are nullable - if not, we may need to delete
    await prisma.interview.updateMany({
      where: { interviewerId: id },
      data: { interviewerId: null },
    });

    await prisma.interview.updateMany({
      where: { createdById: id },
      data: { createdById: null },
    });

    // Delete interview feedback
    await prisma.interviewFeedback.deleteMany({
      where: { interviewerId: id },
    });

    // Delete interview notes (authorId is required, cannot be null)
    await prisma.interviewNote.deleteMany({
      where: { authorId: id },
    });

    // Delete interview activity logs
    await prisma.interviewActivityLog.deleteMany({
      where: { userId: id },
    });

    // Update Placement-related records
    // Update placements (set recruiterId to null - it's nullable)
    await prisma.placement.updateMany({
      where: { recruiterId: id },
      data: { recruiterId: null },
    });

    // Delete placement commissions (recruiterId is required, cannot be null)
    await prisma.placementCommission.deleteMany({
      where: { recruiterId: id },
    });

    // Update placement documents (uploadedBy might be nullable, check schema)
    // If it's required, we'll need to delete instead
    try {
      await prisma.placementDocument.updateMany({
        where: { uploadedBy: id },
        data: { uploadedBy: null },
      });
    } catch (error) {
      // If update fails (field is required), delete instead
      await prisma.placementDocument.deleteMany({
        where: { uploadedBy: id },
      });
    }

    // Delete placement activity logs
    await prisma.placementActivityLog.deleteMany({
      where: { performedBy: id },
    });

    // Update other relations
    // Update pipeline entries
    await prisma.pipelineEntry.updateMany({
      where: { movedById: id },
      data: { movedById: null },
    });

    // Update matches
    await prisma.match.updateMany({
      where: { createdById: id },
      data: { createdById: null },
    });

    // CRM activity feed — performedById is required on Activity (blocks user delete if not removed)
    await prisma.activity.deleteMany({
      where: { performedById: id },
    });

    await prisma.contactActivity.deleteMany({
      where: { userId: id },
    });

    await prisma.report.deleteMany({
      where: { generatedById: id },
    });

    // Finally, delete the user
    await prisma.user.deleteMany({
      where: { id },
    });

    await Promise.all([
      deleteCacheByPattern(getTeamListCachePattern()),
      deleteCacheByPattern(getPermissionCachePattern()),
    ]);

    return res.status(200).json({
      success: true,
      message: 'Team member deleted successfully',
    });
  } catch (error) {
    logger.error({ route: req.originalUrl || req.url, message: error?.message || 'Failed to delete team member' });
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Team member not found',
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to delete team member',
    });
  }
}

/**
 * Activate team member
 * POST /api/team/:id/activate
 */
export async function activateTeamMember(req, res) {
  try {
    const { id } = req.params;
    const accessible = await findAccessibleMember(req, id);
    if (!accessible) {
      return res.status(404).json({
        success: false,
        message: 'Team member not found',
      });
    }

    await prisma.user.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        isActive: true,
      },
    });
    await deleteCacheByPattern(getTeamListCachePattern());

    return res.status(200).json({
      success: true,
      message: 'Member activated.',
    });
  } catch (error) {
    logger.error({ route: req.originalUrl || req.url, message: error?.message || 'Failed to activate team member' });
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Team member not found',
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to activate team member',
    });
  }
}

/**
 * Generate credentials for team member
 * POST /api/team/:id/credentials
 */
export async function generateMemberCredentials(req, res) {
  try {
    const { id } = req.params;
    const { customLoginId, sendInvite } = req.body;
    const accessible = await findAccessibleMember(req, id);
    if (!accessible) {
      return res.status(404).json({
        success: false,
        message: 'Team member not found',
      });
    }

    // Find member
    const member = await prisma.user.findUnique({
      where: { id },
      include: {
        systemRole: {
          select: { roleName: true },
        },
      },
    });

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Team member not found',
      });
    }

    let loginId;

    // Determine loginId
    if (customLoginId) {
      // Check if custom loginId is unique
      const existing = await prisma.userCredential.findUnique({
        where: { loginId: customLoginId },
      });

      if (existing && existing.userId !== id) {
        return res.status(400).json({
          success: false,
          message: 'This login ID is already taken',
        });
      }

      loginId = customLoginId;
    } else {
      // Auto-generate
      loginId = await generateLoginId(member.firstName || '', member.lastName || '');
    }

    // Generate credentials
    const tempPassword = generateTempPassword();
    const hashedPassword = await hashPassword(tempPassword);
    const inviteToken = generateInviteToken();
    const inviteExpiresAt = getInviteExpiry(48);

    // Check if credential already exists
    const existingCredential = await prisma.userCredential.findUnique({
      where: { userId: id },
    });

    if (existingCredential) {
      // Update existing credential
      await prisma.userCredential.update({
        where: { userId: id },
        data: {
          loginId,
          hashedPassword,
          tempPasswordFlag: true,
          inviteToken,
          inviteExpiresAt,
          isLocked: false,
          failedAttempts: 0,
          inviteSentAt: sendInvite ? new Date() : null,
        },
      });
    } else {
      // Create new credential
      await prisma.userCredential.create({
        data: {
          userId: id,
          loginId,
          hashedPassword,
          tempPasswordFlag: true,
          inviteToken,
          inviteExpiresAt,
          inviteSentAt: sendInvite ? new Date() : null,
          createdBy: req.user?.id || null,
        },
      });
    }

    await recordTenantUserDirectoryEntry({ email: member.email, loginId });

    // Send invite email if requested
    if (sendInvite) {
      await sendInviteEmail({
        toEmail: member.email,
        toName: `${member.firstName || ''} ${member.lastName || ''}`.trim() || member.name,
        loginId,
        tempPassword,
        roleName: member.systemRole?.roleName || 'Team Member',
        inviteToken,
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        loginId,
        tempPassword, // Only returned once - this is the only time
        inviteExpiresAt,
      },
      message: 'Credentials generated',
    });
  } catch (error) {
    logger.error({ route: req.originalUrl || req.url, message: error?.message || 'Failed to generate credentials' });
    return res.status(500).json({
      success: false,
      message: 'Failed to generate credentials',
    });
  }
}

/**
 * Reset member password
 * POST /api/team/:id/reset-password
 */
export async function resetMemberPassword(req, res) {
  try {
    const { id } = req.params;
    const accessible = await findAccessibleMember(req, id);
    if (!accessible) {
      return res.status(404).json({
        success: false,
        message: 'Team member or credentials not found',
      });
    }

    // Find member and credential
    const member = await prisma.user.findUnique({
      where: { id },
      include: {
        credential: true,
      },
    });

    if (!member || !member.credential) {
      return res.status(404).json({
        success: false,
        message: 'Team member or credentials not found',
      });
    }

    // Generate new password
    const newTempPassword = generateTempPassword();
    const hashedPassword = await hashPassword(newTempPassword);

    // Update credential
    await prisma.userCredential.update({
      where: { userId: id },
      data: {
        hashedPassword,
        tempPasswordFlag: true,
        failedAttempts: 0,
        isLocked: false,
      },
    });

    // Send password reset email
    await sendPasswordResetEmail({
      toEmail: member.email,
      toName: `${member.firstName || ''} ${member.lastName || ''}`.trim() || member.name,
      loginId: member.credential.loginId,
      newTempPassword,
    });

    return res.status(200).json({
      success: true,
      message: 'Password reset. Email sent.',
    });
  } catch (error) {
    logger.error({ route: req.originalUrl || req.url, message: error?.message || 'Failed to reset password' });
    return res.status(500).json({
      success: false,
      message: 'Failed to reset password',
    });
  }
}

/**
 * Resend invite to team member
 * POST /api/team/:id/resend-invite
 */
export async function resendMemberInvite(req, res) {
  try {
    const { id } = req.params;
    const accessible = await findAccessibleMember(req, id);
    if (!accessible) {
      return res.status(404).json({
        success: false,
        message: 'Team member or credentials not found',
      });
    }

    // Find member and credential
    const member = await prisma.user.findUnique({
      where: { id },
      include: {
        credential: true,
        systemRole: {
          select: { roleName: true },
        },
      },
    });

    if (!member || !member.credential) {
      return res.status(404).json({
        success: false,
        message: 'Team member or credentials not found',
      });
    }

    // Generate new credentials
    const tempPassword = generateTempPassword();
    const hashedPassword = await hashPassword(tempPassword);
    const inviteToken = generateInviteToken();
    const inviteExpiresAt = getInviteExpiry(48);

    // Update credential
    await prisma.userCredential.update({
      where: { userId: id },
      data: {
        hashedPassword,
        tempPasswordFlag: true,
        inviteToken,
        inviteExpiresAt,
        isLocked: false,
        failedAttempts: 0,
        inviteSentAt: new Date(),
      },
    });

    await recordTenantUserDirectoryEntry({
      email: member.email,
      loginId: member.credential.loginId,
    });

    // Send invite email
    await sendInviteEmail({
      toEmail: member.email,
      toName: `${member.firstName || ''} ${member.lastName || ''}`.trim() || member.name,
      loginId: member.credential.loginId,
      tempPassword,
      roleName: member.systemRole?.roleName || 'Team Member',
      inviteToken,
      tenantDbName: getActiveTenantDbName() || undefined,
    });

    return res.status(200).json({
      success: true,
      message: 'Invite resent.',
    });
  } catch (error) {
    logger.error({ route: req.originalUrl || req.url, message: error?.message || 'Failed to resend invite' });
    return res.status(500).json({
      success: false,
      message: 'Failed to resend invite',
    });
  }
}

/**
 * Lock member account
 * POST /api/team/:id/lock
 */
export async function lockMemberAccount(req, res) {
  try {
    const { id } = req.params;
    const accessible = await findAccessibleMember(req, id);
    if (!accessible) {
      return res.status(404).json({
        success: false,
        message: 'Credentials not found',
      });
    }

    await prisma.userCredential.update({
      where: { userId: id },
      data: {
        isLocked: true,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Account locked.',
    });
  } catch (error) {
    logger.error({ route: req.originalUrl || req.url, message: error?.message || 'Failed to lock account' });
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Credentials not found',
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to lock account',
    });
  }
}

/**
 * Unlock member account
 * POST /api/team/:id/unlock
 */
export async function unlockMemberAccount(req, res) {
  try {
    const { id } = req.params;
    const accessible = await findAccessibleMember(req, id);
    if (!accessible) {
      return res.status(404).json({
        success: false,
        message: 'Credentials not found',
      });
    }

    await prisma.userCredential.update({
      where: { userId: id },
      data: {
        isLocked: false,
        failedAttempts: 0,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Account unlocked.',
    });
  } catch (error) {
    logger.error({ route: req.originalUrl || req.url, message: error?.message || 'Failed to unlock account' });
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Credentials not found',
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to unlock account',
    });
  }
}

/**
 * Get member login history
 * GET /api/team/:id/login-history
 */
export async function getMemberLoginHistory(req, res) {
  try {
    const { id } = req.params;
    const limit = Math.min(Math.max(Number.parseInt(String(req.query.limit || '20'), 10) || 20, 1), 100);
    const accessible = await findAccessibleMember(req, id);
    if (!accessible) {
      return res.status(200).json({
        success: true,
        data: [],
      });
    }

    // Find credential
    const credential = await prisma.userCredential.findUnique({
      where: { userId: id },
    });

    if (!credential) {
      return res.status(200).json({
        success: true,
        data: [],
      });
    }

    // Get login history
    const loginHistory = await prisma.loginHistory.findMany({
      where: { credentialId: credential.id },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });

    return res.status(200).json({
      success: true,
      data: loginHistory,
    });
  } catch (error) {
    logger.error({ route: req.originalUrl || req.url, message: error?.message || 'Failed to fetch login history' });
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch login history',
    });
  }
}

/**
 * Get member activity
 * GET /api/team/:id/activity
 */
export async function getMemberActivity(req, res) {
  try {
    const { id } = req.params;
    const limit = Math.min(Math.max(Number.parseInt(String(req.query.limit || '20'), 10) || 20, 1), 100);
    const accessible = await findAccessibleMember(req, id);
    if (!accessible) {
      return res.status(200).json({
        success: true,
        data: [],
      });
    }

    const activities = await prisma.userActivity.findMany({
      where: { userId: id },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });

    return res.status(200).json({
      success: true,
      data: activities,
    });
  } catch (error) {
    logger.error({ route: req.originalUrl || req.url, message: error?.message || 'Failed to fetch activity' });
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch activity',
    });
  }
}

/**
 * Get member targets
 * GET /api/team/:id/targets
 */
export async function getMemberTargets(req, res) {
  try {
    const { id } = req.params;
    const limit = Math.min(Math.max(Number.parseInt(String(req.query.limit || '20'), 10) || 20, 1), 100);
    const accessible = await findAccessibleMember(req, id);
    if (!accessible) {
      return res.status(200).json({
        success: true,
        data: [],
      });
    }

    const targets = await prisma.teamTarget.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return res.status(200).json({
      success: true,
      data: targets,
    });
  } catch (error) {
    logger.error({ route: req.originalUrl || req.url, message: error?.message || 'Failed to fetch targets' });
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch targets',
    });
  }
}

/**
 * Save member targets
 * POST /api/team/:id/targets
 */
export async function saveMemberTargets(req, res) {
  try {
    const { id } = req.params;
    const { targets } = req.body || {};
    const accessible = await findAccessibleMember(req, id);

    if (!accessible) {
      return res.status(404).json({
        success: false,
        message: 'Team member not found',
      });
    }

    if (!Array.isArray(targets)) {
      return res.status(400).json({
        success: false,
        message: 'targets must be an array',
      });
    }

    await prisma.teamTarget.deleteMany({
      where: { userId: id },
    });

    if (targets.length > 0) {
      await prisma.teamTarget.createMany({
        data: targets.map((target) => ({
          userId: id,
          targetType: String(target.targetType || '').trim(),
          targetValue: Number(target.targetValue || 0),
          period: String(target.period || 'monthly').trim(),
        })),
      });
    }

    const savedTargets = await prisma.teamTarget.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return res.status(200).json({
      success: true,
      message: 'Targets saved successfully',
      data: savedTargets,
    });
  } catch (error) {
    logger.error({ route: req.originalUrl || req.url, message: error?.message || 'Failed to save targets' });
    return res.status(500).json({
      success: false,
      message: 'Failed to save targets',
    });
  }
}

export async function impersonateTeamMember(req, res) {
  try {
    const { teamMemberService } = await import('../modules/team/teamMember.service.js');
    const data = await teamMemberService.impersonateMember(req.params.id, req.user);
    return res.status(200).json({
      success: true,
      message: 'Opened team member account',
      data,
    });
  } catch (error) {
    logger.error({ route: req.originalUrl || req.url, message: error?.message || 'Failed to open member account' });
    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || 'Failed to open member account',
    });
  }
}
