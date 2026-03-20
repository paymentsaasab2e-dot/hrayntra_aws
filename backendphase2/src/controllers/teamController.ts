import { prisma } from '../config/prisma.js';
import {
  generateLoginId,
  generateTempPassword,
  hashPassword,
  generateInviteToken,
  getInviteExpiry,
} from '../utils/credentialGenerator.js';
import { sendInviteEmail, sendPasswordResetEmail } from '../services/emailService.js';

/**
 * Get all team members with filters
 * GET /api/team
 */
export async function getAllTeamMembers(req: any, res: any) {
  try {
    const { search, departmentId, roleName, status, managerId } = req.query;

    const where: any = {};

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

    // Fetch members with includes
    const members = await prisma.user.findMany({
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
          },
        },
        _count: {
          select: {
            tasks: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({
      success: true,
      data: members,
    });
  } catch (error) {
    console.error('Error fetching team members:', error);
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
export async function getTeamMemberById(req: any, res: any) {
  try {
    const { id } = req.params;

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

    return res.status(200).json({
      success: true,
      data: member,
    });
  } catch (error) {
    console.error('Error fetching team member:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch team member',
    });
  }
}

/**
 * Create new team member
 * POST /api/team
 */
export async function createTeamMember(req: any, res: any) {
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

    // Validation
    const errors: any = {};
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

    // Create user
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
        passwordHash: 'PLACEHOLDER', // Will be set if credentials generated
      },
    });

    let credentialData = null;

    // Generate credentials if requested
    if (generateCredentials) {
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
          inviteSentAt: sendInvite ? new Date() : null,
          createdBy: req.user?.id || null,
        },
      });

      credentialData = {
        loginId,
        tempPassword,
      };

      // Send invite email if requested
      if (sendInvite) {
        const role = await prisma.systemRole.findUnique({
          where: { id: roleId },
          select: { roleName: true },
        });

        await sendInviteEmail({
          toEmail: email,
          toName: `${firstName} ${lastName}`,
          loginId,
          tempPassword,
          roleName: role?.roleName || 'Team Member',
          inviteToken,
        });
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

    return res.status(201).json({
      success: true,
      data: createdMember,
      message: 'Team member created successfully',
    });
  } catch (error) {
    console.error('Error creating team member:', error);
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
export async function updateTeamMember(req: any, res: any) {
  try {
    const { id } = req.params;
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
    const updateData: any = {};

    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (firstName !== undefined || lastName !== undefined) {
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

    // Check email uniqueness if email is being changed
    if (email) {
      const existing = await prisma.user.findFirst({
        where: {
          email,
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
      },
    });

    return res.status(200).json({
      success: true,
      data: updatedMember,
    });
  } catch (error) {
    console.error('Error updating team member:', error);
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
 * DELETE /api/team/:id
 */
export async function deactivateTeamMember(req: any, res: any) {
  try {
    const { id } = req.params;

    await prisma.user.update({
      where: { id },
      data: {
        status: 'INACTIVE',
        isActive: false,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Member deactivated. All historical data preserved.',
    });
  } catch (error) {
    console.error('Error deactivating team member:', error);
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
 * Activate team member
 * POST /api/team/:id/activate
 */
export async function activateTeamMember(req: any, res: any) {
  try {
    const { id } = req.params;

    await prisma.user.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        isActive: true,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Member activated.',
    });
  } catch (error) {
    console.error('Error activating team member:', error);
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
export async function generateMemberCredentials(req: any, res: any) {
  try {
    const { id } = req.params;
    const { customLoginId, sendInvite } = req.body;

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
    console.error('Error generating credentials:', error);
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
export async function resetMemberPassword(req: any, res: any) {
  try {
    const { id } = req.params;

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
    console.error('Error resetting password:', error);
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
export async function resendMemberInvite(req: any, res: any) {
  try {
    const { id } = req.params;

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

    // Send invite email
    await sendInviteEmail({
      toEmail: member.email,
      toName: `${member.firstName || ''} ${member.lastName || ''}`.trim() || member.name,
      loginId: member.credential.loginId,
      tempPassword,
      roleName: member.systemRole?.roleName || 'Team Member',
      inviteToken,
    });

    return res.status(200).json({
      success: true,
      message: 'Invite resent.',
    });
  } catch (error) {
    console.error('Error resending invite:', error);
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
export async function lockMemberAccount(req: any, res: any) {
  try {
    const { id } = req.params;

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
    console.error('Error locking account:', error);
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
export async function unlockMemberAccount(req: any, res: any) {
  try {
    const { id } = req.params;

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
    console.error('Error unlocking account:', error);
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
export async function getMemberLoginHistory(req: any, res: any) {
  try {
    const { id } = req.params;

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
      take: 50,
    });

    return res.status(200).json({
      success: true,
      data: loginHistory,
    });
  } catch (error) {
    console.error('Error fetching login history:', error);
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
export async function getMemberActivity(req: any, res: any) {
  try {
    const { id } = req.params;

    const activities = await prisma.userActivity.findMany({
      where: { userId: id },
      orderBy: { timestamp: 'desc' },
      take: 50,
    });

    return res.status(200).json({
      success: true,
      data: activities,
    });
  } catch (error) {
    console.error('Error fetching activity:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch activity',
    });
  }
}
