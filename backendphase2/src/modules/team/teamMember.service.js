import { prisma, getActiveTenantDbName } from '../../config/prisma.js';
import { getPaginationParams, formatPaginationResponse } from '../../utils/pagination.js';
import {
  generateLoginId,
  generateTempPassword,
  hashPassword,
  generateInviteToken,
  calculateInviteExpiry,
} from '../../utils/credentialGenerator.js';
import { sendCredentialInvite, sendPasswordResetEmail } from '../../utils/emailService.js';
import { isSuperAdminUser } from '../../utils/superAdminScope.js';
import { headquartersAuthService } from '../auth/headquarters-auth.service.js';
import { sessionService } from '../session/session.service.js';
import { userService } from '../user/user.service.js';
import { assertCanCreateUser } from '../setting/planAccess.service.js';
import {
  mergeOrgCompanyUserScope,
  resolveWriteOrgUnitId,
} from '../../services/orgListScope.service.js';

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
    console.warn('[teamMember] tenant-user directory upsert failed:', error?.message || error);
  }
}

export const teamMemberService = {
  async getAll(req) {
    if (!prisma) {
      console.error('Prisma client is not initialized in teamMemberService');
      throw new Error('Database connection not initialized. Please check server logs.');
    }

    const { page, limit, skip } = getPaginationParams(req);
    const { department, role, status, manager, search } = req.query;

    const andFilters = [];

    if (department) {
      andFilters.push({ departmentId: department });
    }
    
    if (role) {
      // Find role by roleName
      const roleRecord = await prisma.systemRole.findUnique({
        where: { roleName: role },
      });
      if (roleRecord) {
        andFilters.push({ roleId: roleRecord.id });
      }
    }
    
    if (status) {
      andFilters.push({ status });
    }
    
    if (manager) {
      andFilters.push({ managerId: manager });
    }
    
    if (search) {
      // Prisma-compatible case-insensitive search for MongoDB
      // Note: MongoDB with Prisma uses contains with mode: 'insensitive'
      andFilters.push({
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    const baseWhere = andFilters.length ? { AND: andFilters } : {};
    // Team follows the company selector: users are filtered by the same
    // orgUnitId that CRM/recruitment rows use.
    const where = await mergeOrgCompanyUserScope(baseWhere, req);

    const [members, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
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
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          orgUnitId: true,
          hierarchyPurpose: true,
          departmentRelation: {
            select: { id: true, name: true },
          },
          systemRole: {
            select: { 
              id: true, 
              roleName: true,
              rolePermissions: {
                select: {
                  permission: {
                    select: { permissionName: true },
                  },
                },
              },
            },
          },
          managerRelation: {
            select: { id: true, name: true, firstName: true, lastName: true },
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
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    const unitIds = [...new Set(members.map((m) => m.orgUnitId).filter(Boolean).map(String))];
    const unitNameById = new Map();
    if (unitIds.length) {
      const units = await prisma.orgUnit.findMany({
        where: { id: { in: unitIds } },
        select: { id: true, name: true, isLeaf: true },
      });
      for (const unit of units) unitNameById.set(String(unit.id), unit);
    }

    // Format response
    const formatted = members.map((member) => {
      const unit = member.orgUnitId ? unitNameById.get(String(member.orgUnitId)) : null;
      const fallbackName = typeof member.name === 'string' ? member.name.trim() : '';
      const fallbackParts = fallbackName ? fallbackName.split(/\s+/) : [];

      return {
      id: member.id,
      firstName: member.firstName || fallbackParts[0] || '',
      lastName: member.lastName || fallbackParts.slice(1).join(' ') || '',
      email: member.email,
      phone: member.phone,
      designation: member.designation,
      location: member.location,
      status: member.status || (member.isActive ? 'ACTIVE' : 'INACTIVE'),
      role: member.systemRole
        ? {
            id: member.systemRole.id,
            roleName: member.systemRole.roleName,
            color: member.systemRole.color || 'gray',
          }
        : null,
      department: member.departmentRelation
        ? {
            id: member.departmentRelation.id,
            name: member.departmentRelation.name,
          }
        : null,
      manager: member.managerRelation
        ? {
            id: member.managerRelation.id,
            name: member.managerRelation.name || `${member.managerRelation.firstName || ''} ${member.managerRelation.lastName || ''}`.trim(),
          }
        : null,
      credential: member.credential
        ? {
            loginId: member.credential.loginId,
            isLocked: member.credential.isLocked,
            lastLoginAt: member.credential.lastLoginAt,
            tempPasswordFlag: member.credential.tempPasswordFlag,
          }
        : null,
      _count: {
        tasks: member._count?.tasks || 0,
        assignedLeads: member.assignedJobs || 0,
      },
      taskCount: member._count?.tasks || 0,
      assignedJobs: member.assignedJobs || 0,
      placements: member.placements || 0,
      revenueGenerated: member.revenueGenerated || 0,
      orgUnitId: member.orgUnitId ? String(member.orgUnitId) : null,
      hierarchyPurpose: member.hierarchyPurpose || 'member',
      orgUnit: unit
        ? { id: String(unit.id), name: unit.name, kind: unit.isLeaf ? 'branch' : 'company' }
        : null,
      createdAt: member.createdAt,
      updatedAt: member.updatedAt,
    };
    });

    return formatPaginationResponse(formatted, page, limit, total);
  },

  async getById(id, reqUser) {
    const member = await prisma.user.findUnique({
      where: { id },
      include: {
        departmentRelation: true,
        systemRole: {
          include: {
            rolePermissions: {
              include: {
                permission: true,
              },
            },
          },
        },
        managerRelation: {
          select: { id: true, name: true, firstName: true, lastName: true, email: true },
        },
        subordinates: {
          select: { id: true, name: true, firstName: true, lastName: true, email: true },
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
      return null;
    }

    return {
      ...member,
      role: member.systemRole
        ? {
            ...member.systemRole,
            permissions: member.systemRole.rolePermissions.map(
              (rp) => rp.permission
            ),
          }
        : null,
    };
  },

  async create(data, createdById, req = null) {
    await assertCanCreateUser();

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
      loginIdOption,
      customLoginId,
    } = data;

    // Check for duplicate email
    const existing = await prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      throw new Error('User with this email already exists');
    }

    // New users belong to the company/branch the creator is currently operating in,
    // so the Team tab stays segregated the same way CRM data is.
    let orgUnitId = data?.orgUnitId ? String(data.orgUnitId) : null;
    if (!orgUnitId && req) {
      orgUnitId = await resolveWriteOrgUnitId(req);
    }

    // Create user - passwordHash is required, use a placeholder if no credentials
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
        managerId,
        status: status || 'ACTIVE',
        isActive: status !== 'INACTIVE',
        passwordHash: 'PLACEHOLDER', // Will be set if credentials generated, or user can set later
      },
    });

    let credentialData = null;

    // Generate credentials if requested
    if (generateCredentials) {
      let loginId;
      if (loginIdOption === 'email') {
        loginId = email;
      } else if (loginIdOption === 'custom' && customLoginId) {
        loginId = customLoginId;
      } else {
        // Auto-generate
        loginId = await generateLoginId(firstName, lastName);
      }
      
      const tempPassword = generateTempPassword();
      const hashedPassword = await hashPassword(tempPassword);
      const inviteToken = generateInviteToken();
      const inviteExpiresAt = calculateInviteExpiry();

      const credential = await prisma.userCredential.create({
        data: {
          userId: user.id,
          loginId,
          hashedPassword,
          tempPasswordFlag: true,
          inviteToken,
          inviteExpiresAt,
          inviteSentAt: sendInvite ? new Date() : null,
          createdBy: createdById,
        },
      });

      await recordTenantUserDirectoryEntry({ email: user.email, loginId });

      credentialData = {
        loginId,
        tempPassword, // Only returned once
      };

      // Send invite email if requested
      if (sendInvite) {
        const role = await prisma.systemRole.findUnique({
          where: { id: roleId },
          select: { roleName: true },
        });

        try {
          await sendCredentialInvite({
            email,
            loginId,
            tempPassword,
            roleName: role?.roleName || 'Team Member',
            inviteToken,
            tenantDbName: getActiveTenantDbName() || undefined,
          });
        } catch (emailError) {
          console.error('Failed to send invite email:', emailError);
          // Don't fail the user creation if email fails
        }
      }
    }

    // Log activity
    await prisma.userActivity.create({
      data: {
        userId: user.id,
        action: 'Team member created',
        module: 'Team',
        metadata: {
          createdBy: createdById,
          hasCredentials: generateCredentials,
        },
      },
    });

    const fullUser = await this.getById(user.id);

    return {
      ...fullUser,
      credentialData, // Only if credentials were generated
    };
  },

  async update(id, data) {
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
    } = data;

    // Check email uniqueness if email is being changed
    if (email) {
      const existing = await prisma.user.findFirst({
        where: {
          email,
          id: { not: id },
        },
      });

      if (existing) {
        throw new Error('User with this email already exists');
      }
    }

    const updateData = {};
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (firstName || lastName) {
      updateData.name = `${firstName || ''} ${lastName || ''}`.trim();
    }
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (designation !== undefined) updateData.designation = designation;
    if (location !== undefined) updateData.location = location;
    if (departmentId !== undefined) updateData.departmentId = departmentId;
    if (roleId !== undefined) updateData.roleId = roleId;
    if (managerId !== undefined) updateData.managerId = managerId;
    if (status !== undefined) {
      updateData.status = status;
      updateData.isActive = status !== 'INACTIVE';
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      include: {
        departmentRelation: {
          select: { id: true, name: true },
        },
        systemRole: {
          select: { id: true, roleName: true },
        },
        managerRelation: {
          select: { id: true, name: true, firstName: true, lastName: true },
        },
      },
    });

    // Log activity
    await prisma.userActivity.create({
      data: {
        userId: id,
        action: 'Team member updated',
        module: 'Team',
        metadata: { changes: Object.keys(updateData) },
      },
    });

    return updated;
  },

  async delete(id) {
    const member = await prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!member) {
      return { message: 'Team member deleted successfully.' };
    }

    // Remove dependent records first so the member can be permanently deleted.
    await prisma.userCredential.deleteMany({ where: { userId: id } });
    await prisma.userActivity.deleteMany({ where: { userId: id } });
    await prisma.teamTask.deleteMany({ where: { userId: id } });
    await prisma.teamTarget.deleteMany({ where: { userId: id } });
    await prisma.commission.deleteMany({ where: { userId: id } });
    await prisma.task.deleteMany({ where: { assignedToId: id } });
    await prisma.task.deleteMany({ where: { createdById: id } });
    await prisma.user.updateMany({ where: { managerId: id }, data: { managerId: null } });
    await prisma.client.updateMany({ where: { assignedToId: id }, data: { assignedToId: null } });
    await prisma.candidate.updateMany({ where: { assignedToId: id }, data: { assignedToId: null } });
    await prisma.job.updateMany({ where: { assignedToId: id }, data: { assignedToId: null } });
    await prisma.lead.updateMany({ where: { assignedToId: id }, data: { assignedToId: null } });
    await prisma.contact.updateMany({ where: { ownerId: id }, data: { ownerId: null } });
    await prisma.clientNote.deleteMany({ where: { createdById: id } });
    await prisma.interview.updateMany({ where: { interviewerId: id }, data: { interviewerId: null } });
    await prisma.interview.updateMany({ where: { createdById: id }, data: { createdById: null } });
    await prisma.interviewFeedback.deleteMany({ where: { interviewerId: id } });
    await prisma.interviewNote.deleteMany({ where: { authorId: id } });
    await prisma.interviewActivityLog.deleteMany({ where: { userId: id } });
    await prisma.placement.updateMany({ where: { recruiterId: id }, data: { recruiterId: null } });
    await prisma.placementCommission.deleteMany({ where: { recruiterId: id } });
    try {
      await prisma.placementDocument.updateMany({ where: { uploadedBy: id }, data: { uploadedBy: null } });
    } catch {
      await prisma.placementDocument.deleteMany({ where: { uploadedBy: id } });
    }
    await prisma.placementActivityLog.deleteMany({ where: { performedBy: id } });
    await prisma.pipelineEntry.updateMany({ where: { movedById: id }, data: { movedById: null } });
    await prisma.match.updateMany({ where: { createdById: id }, data: { createdById: null } });

    await prisma.user.delete({ where: { id } });

    return { message: 'Team member deleted successfully.' };
  },

  async generateCredentials(userId, loginIdOption, sendInvite, createdById, customLoginId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        systemRole: {
          select: { roleName: true },
        },
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    let loginId;
    if (loginIdOption === 'email') {
      loginId = user.email;
    } else if (loginIdOption === 'custom' && customLoginId) {
      loginId = customLoginId;
    } else {
      // Auto-generate
      loginId = await generateLoginId(
        user.firstName || user.name.split(' ')[0] || '',
        user.lastName || user.name.split(' ').slice(1).join(' ') || ''
      );
    }

    // Check if loginId already exists
    const existingCredential = await prisma.userCredential.findUnique({
      where: { loginId },
    });

    if (existingCredential && existingCredential.userId !== userId) {
      throw new Error('Login ID already exists');
    }

    const tempPassword = generateTempPassword();
    const hashedPassword = await hashPassword(tempPassword);
    const inviteToken = generateInviteToken();
    const inviteExpiresAt = calculateInviteExpiry();

    // Update or create credential
    const credential = await prisma.userCredential.upsert({
      where: { userId },
      update: {
        loginId,
        hashedPassword,
        tempPasswordFlag: true,
        inviteToken,
        inviteExpiresAt,
        inviteSentAt: sendInvite ? new Date() : null,
        failedAttempts: 0,
        isLocked: false,
      },
      create: {
        userId,
        loginId,
        hashedPassword,
        tempPasswordFlag: true,
        inviteToken,
        inviteExpiresAt,
        inviteSentAt: sendInvite ? new Date() : null,
        createdBy: createdById,
        failedAttempts: 0,
        isLocked: false,
      },
    });

    await recordTenantUserDirectoryEntry({ email: user.email, loginId });

    // Send invite email if requested
    if (sendInvite) {
      try {
        await sendCredentialInvite({
          email: user.email,
          loginId,
          tempPassword,
          roleName: user.systemRole?.roleName || 'Team Member',
          inviteToken,
          tenantDbName: getActiveTenantDbName() || undefined,
        });
      } catch (emailError) {
        console.error('Failed to send invite email:', emailError);
        // Don't fail the operation if email fails
      }
    }

    // Log activity
    await prisma.userActivity.create({
      data: {
        userId,
        action: 'Credentials generated',
        module: 'Team',
        metadata: { loginId },
      },
    });

    return {
      loginId,
      tempPassword, // Only returned once
    };
  },

  async resetPassword(userId, actorUser) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        credential: true,
        systemRole: {
          select: { roleName: true },
        },
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (!user.credential) {
      throw new Error('User has no credentials. Generate credentials first.');
    }

    const tempPassword = generateTempPassword();
    const hashedPassword = await hashPassword(tempPassword);
    const inviteToken = generateInviteToken();
    const inviteExpiresAt = calculateInviteExpiry();

    await prisma.userCredential.update({
      where: { userId },
      data: {
        hashedPassword,
        tempPasswordFlag: true,
        inviteToken,
        inviteExpiresAt,
        failedAttempts: 0,
        isLocked: false,
      },
    });

    await recordTenantUserDirectoryEntry({
      email: user.email,
      loginId: user.credential?.loginId,
    });

    // Send password reset email (Super Admin can still complete reset if email fails)
    try {
      await sendPasswordResetEmail({
        email: user.email,
        tempPassword,
        inviteToken,
        tenantDbName: getActiveTenantDbName() || undefined,
      });
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError);
      if (!isSuperAdminUser({ user: actorUser })) {
        throw new Error('Failed to send password reset email');
      }
    }

    // Log activity
    await prisma.userActivity.create({
      data: {
        userId,
        action: 'Password reset',
        module: 'Team',
      },
    });

    return {
      message: 'Password reset successfully. Email sent to user.',
      tempPassword,
      loginId: user.credential.loginId,
    };
  },

  /**
   * Super Admin only: set a member's login password to an explicit value.
   * Existing passwords cannot be read back (one-way hash).
   */
  async setPassword(userId, newPassword, actorUser) {
    if (!isSuperAdminUser({ user: actorUser })) {
      throw new Error('Only Super Admins can set a member password directly.');
    }

    const pwd = typeof newPassword === 'string' ? newPassword.trim() : '';
    if (pwd.length < 8) {
      throw new Error('Password must be at least 8 characters.');
    }
    if (pwd.length > 128) {
      throw new Error('Password is too long.');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { credential: true },
    });

    if (!user) {
      throw new Error('User not found');
    }
    if (!user.credential) {
      throw new Error('User has no credentials. Generate credentials first.');
    }

    const hashedPassword = await hashPassword(pwd);

    await prisma.userCredential.update({
      where: { userId },
      data: {
        hashedPassword,
        tempPasswordFlag: false,
        failedAttempts: 0,
        isLocked: false,
      },
    });

    await prisma.userActivity.create({
      data: {
        userId,
        action: 'Password set by Super Admin',
        module: 'Team',
        metadata: { performedBy: actorUser?.id || null },
      },
    });

    return {
      message: 'Password updated successfully.',
      loginId: user.credential.loginId,
    };
  },

  async resendInvite(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        credential: true,
        systemRole: {
          select: { roleName: true },
        },
      },
    });

    if (!user || !user.credential) {
      throw new Error('User has no credentials. Generate credentials first.');
    }

    const tempPassword = generateTempPassword();
    const hashedPassword = await hashPassword(tempPassword);
    const inviteToken = generateInviteToken();
    const inviteExpiresAt = calculateInviteExpiry();

    await prisma.userCredential.update({
      where: { userId },
      data: {
        hashedPassword,
        tempPasswordFlag: true,
        inviteToken,
        inviteExpiresAt,
        inviteSentAt: new Date(),
        failedAttempts: 0,
        isLocked: false,
      },
    });

    await recordTenantUserDirectoryEntry({
      email: user.email,
      loginId: user.credential.loginId,
    });

    // Send invite email
    try {
      await sendCredentialInvite({
        email: user.email,
        loginId: user.credential.loginId,
        tempPassword,
        roleName: user.systemRole?.roleName || 'Team Member',
        inviteToken,
        tenantDbName: getActiveTenantDbName() || undefined,
      });
    } catch (emailError) {
      console.error('Failed to send invite email:', emailError);
      throw new Error('Failed to send invite email');
    }

    // Log activity
    await prisma.userActivity.create({
      data: {
        userId,
        action: 'Invite resent',
        module: 'Team',
      },
    });

    return { message: 'Invite email sent successfully.' };
  },

  async lockAccount(userId) {
    const credential = await prisma.userCredential.findUnique({
      where: { userId },
    });

    if (!credential) {
      throw new Error('User has no credentials');
    }

    await prisma.userCredential.update({
      where: { userId },
      data: { isLocked: true },
    });

    // Log activity
    await prisma.userActivity.create({
      data: {
        userId,
        action: 'Account locked',
        module: 'Team',
      },
    });

    return { message: 'Account locked successfully' };
  },

  async unlockAccount(userId) {
    const credential = await prisma.userCredential.findUnique({
      where: { userId },
    });

    if (!credential) {
      throw new Error('User has no credentials');
    }

    await prisma.userCredential.update({
      where: { userId },
      data: {
        isLocked: false,
        failedAttempts: 0,
      },
    });

    // Log activity
    await prisma.userActivity.create({
      data: {
        userId,
        action: 'Account unlocked',
        module: 'Team',
      },
    });

    return { message: 'Account unlocked successfully' };
  },

  async getLoginHistory(userId) {
    const credential = await prisma.userCredential.findUnique({
      where: { userId },
    });

    if (!credential) {
      return [];
    }

    const history = await prisma.loginHistory.findMany({
      where: { credentialId: credential.id },
      orderBy: { timestamp: 'desc' },
      take: 50,
    });

    return history;
  },

  async getActivity(userId) {
    const activities = await prisma.userActivity.findMany({
      where: { userId },
      orderBy: { timestamp: 'desc' },
      take: 50,
    });

    return activities;
  },

  async getTargets(userId) {
    return prisma.teamTarget.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  },

  async saveTargets(userId, targets) {
    if (!Array.isArray(targets)) {
      throw new Error('targets must be an array');
    }

    await prisma.teamTarget.deleteMany({
      where: { userId },
    });

    if (targets.length > 0) {
      await prisma.teamTarget.createMany({
        data: targets.map((target) => ({
          userId,
          targetType: String(target.targetType || '').trim(),
          targetValue: Number(target.targetValue || 0),
          period: String(target.period || 'monthly').trim(),
        })),
      });
    }

    return prisma.teamTarget.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  },

  /**
   * Tenant Super Admin opens a team member account without logging them out
   * or replacing their active session.
   */
  async impersonateMember(memberId, actorUser) {
    if (!isSuperAdminUser({ user: actorUser }) && !actorUser?.hqImpersonation) {
      const err = new Error('Only the company Super Admin can open a team member account.');
      err.statusCode = 403;
      throw err;
    }
    if (actorUser?.tenantImpersonation) {
      const err = new Error('Leave the current member account before opening another.');
      err.statusCode = 400;
      throw err;
    }
    if (String(actorUser?.id || '') === String(memberId || '')) {
      const err = new Error('You are already in this account.');
      err.statusCode = 400;
      throw err;
    }

    const member = await prisma.user.findUnique({
      where: { id: memberId },
      include: {
        credential: true,
        systemRole: { select: { roleName: true, color: true } },
      },
    });
    if (!member) {
      const err = new Error('Team member not found');
      err.statusCode = 404;
      throw err;
    }
    if (member.isActive === false || String(member.status || '').toUpperCase() === 'INACTIVE') {
      const err = new Error('This team member is inactive.');
      err.statusCode = 400;
      throw err;
    }

    const tenantDbName = String(getActiveTenantDbName() || actorUser?.tenantDbName || '').trim();
    const permissionsPayload = await userService.getEffectivePermissions(member.id);
    const roleName =
      permissionsPayload?.roleName ||
      member.systemRole?.roleName ||
      member.role ||
      'Member';
    const memberName =
      String(member.name || `${member.firstName || ''} ${member.lastName || ''}`).trim() ||
      member.email;

    const tokenResult = await sessionService.issueHqImpersonationTokens({
      userId: member.id,
      tokenPayload: {
        userId: member.id,
        email: member.email,
        role: member.role,
        roleName,
        tenantDbName: tenantDbName || undefined,
        tenantImpersonation: true,
        impersonatedByUserId: actorUser.id,
        impersonatedByEmail: actorUser.email,
      },
      refreshPayload: {
        userId: member.id,
        email: member.email,
        role: member.role,
        roleName,
        tenantDbName: tenantDbName || undefined,
        tenantImpersonation: true,
        impersonatedByUserId: actorUser.id,
      },
      deviceMeta: {
        browserInfo: 'Tenant Super Admin access',
        deviceType: 'admin-impersonation',
        operatingSystem: '',
        deviceId: `impersonate:${actorUser.id}`,
        location: '',
      },
      hqActorEmail: actorUser.email,
      auditAction: 'TENANT_IMPERSONATION_LOGIN',
    });

    await prisma.userActivity.create({
      data: {
        userId: actorUser.id,
        action: `Opened ${memberName}'s account`,
        module: 'Team',
        metadata: { memberId: member.id, impersonation: true },
      },
    }).catch(() => null);

    return {
      accessToken: tokenResult.accessToken,
      refreshToken: tokenResult.refreshToken,
      tenantDbName,
      user: {
        id: member.id,
        name: memberName,
        firstName: member.firstName,
        lastName: member.lastName,
        email: member.email,
        role: member.role,
        roleName,
        roleColor: member.systemRole?.color || '',
        loginId: member.credential?.loginId || member.email,
        designation: member.designation || '',
        avatar: member.avatar || null,
      },
      permissions: permissionsPayload?.permissions || [],
      impersonation: {
        memberId: member.id,
        memberName,
        memberEmail: member.email,
        actorId: actorUser.id,
        actorName: String(actorUser.name || actorUser.email || 'Super Admin'),
      },
    };
  },
};
