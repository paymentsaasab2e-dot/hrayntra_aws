import { prisma } from '../../config/prisma.js';
import { getPaginationParams, formatPaginationResponse } from '../../utils/pagination.js';
import {
  generateLoginId,
  generateTempPassword,
  hashPassword,
  generateInviteToken,
  calculateInviteExpiry,
} from '../../utils/credentialGenerator.js';
import { sendCredentialInvite, sendPasswordResetEmail } from '../../utils/emailService.js';

export const teamMemberService = {
  async getAll(req) {
    if (!prisma) {
      console.error('Prisma client is not initialized in teamMemberService');
      throw new Error('Database connection not initialized. Please check server logs.');
    }

    const { page, limit, skip } = getPaginationParams(req);
    const { department, role, status, manager, search } = req.query;

    const where = {};
    
    if (department) {
      where.departmentId = department;
    }
    
    if (role) {
      // Find role by roleName
      const roleRecord = await prisma.systemRole.findUnique({
        where: { roleName: role },
      });
      if (roleRecord) {
        where.roleId = roleRecord.id;
      }
    }
    
    if (status) {
      where.status = status;
    }
    
    if (manager) {
      where.managerId = manager;
    }
    
    if (search) {
      // Prisma-compatible case-insensitive search for MongoDB
      // Note: MongoDB with Prisma uses contains with mode: 'insensitive'
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

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

    // Format response
    const formatted = members.map((member) => {
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
      createdAt: member.createdAt,
      updatedAt: member.updatedAt,
    };
    });

    return formatPaginationResponse(formatted, page, limit, total);
  },

  async getById(id) {
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

  async create(data, createdById) {
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

    // Create user - passwordHash is required, use a placeholder if no credentials
    const user = await prisma.user.create({
      data: {
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
    // Soft delete - set status to INACTIVE
    const updated = await prisma.user.update({
      where: { id },
      data: {
        status: 'INACTIVE',
        isActive: false,
      },
    });

    // Log activity
    await prisma.userActivity.create({
      data: {
        userId: id,
        action: 'Team member deactivated',
        module: 'Team',
        metadata: { reason: 'Soft delete' },
      },
    });

    return { message: 'Team member deactivated successfully. Historical data is preserved.' };
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

    // Send invite email if requested
    if (sendInvite) {
      try {
        await sendCredentialInvite({
          email: user.email,
          loginId,
          tempPassword,
          roleName: user.systemRole?.roleName || 'Team Member',
          inviteToken,
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

  async resetPassword(userId) {
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

    // Send password reset email
    try {
      await sendPasswordResetEmail({
        email: user.email,
        tempPassword,
        inviteToken,
      });
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError);
      throw new Error('Failed to send password reset email');
    }

    // Log activity
    await prisma.userActivity.create({
      data: {
        userId,
        action: 'Password reset',
        module: 'Team',
      },
    });

    return { message: 'Password reset successfully. Email sent to user.' };
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

    // Send invite email
    try {
      await sendCredentialInvite({
        email: user.email,
        loginId: user.credential.loginId,
        tempPassword,
        roleName: user.systemRole?.roleName || 'Team Member',
        inviteToken,
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
};
