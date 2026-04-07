import bcrypt from 'bcryptjs';
import { prisma } from '../../config/prisma.js';
import { generateOtp, hashOtp, compareOtp } from '../../utils/otp.js';
import { signToken, signRefreshToken, verifyRefreshToken } from '../../utils/jwt.js';
import { sendOtpEmail, sendWelcomeEmail } from '../../emails/email.service.js';
import { headquartersAuthService } from './headquarters-auth.service.js';

const DIRECT_SUPER_ADMIN_LOGIN_ID = 'super.admin@saasa';
const DIRECT_SUPER_ADMIN_PASSWORD = 'UjvnE3WctAVa';

async function ensureLocalSuperAdminFromHeadquarters(hqUser) {
  const existing = await prisma.user.findUnique({
    where: { email: hqUser.email },
  });

  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        name: hqUser.name || existing.name || hqUser.email,
        role: 'SUPER_ADMIN',
        isActive: true,
      },
    });
  }

  const placeholderHash = await bcrypt.hash(`headquarters:${hqUser.id}:${Date.now()}`, 10);
  return prisma.user.create({
    data: {
      name: hqUser.name || hqUser.email,
      email: hqUser.email,
      passwordHash: placeholderHash,
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  });
}

async function ensureDirectSuperAdminAccount() {
  const allPermissions = await prisma.permission.findMany({
    select: { id: true, permissionName: true },
  });

  const superAdminRole = await prisma.systemRole.upsert({
    where: { roleName: 'Super Admin' },
    update: {
      description: 'Full system access',
      color: 'red',
    },
    create: {
      roleName: 'Super Admin',
      description: 'Full system access',
      color: 'red',
    },
  });

  if (allPermissions.length > 0) {
    await prisma.rolePermission.deleteMany({
      where: { roleId: superAdminRole.id },
    });

    await prisma.rolePermission.createMany({
      data: allPermissions.map((permission) => ({
        roleId: superAdminRole.id,
        permissionId: permission.id,
      })),
    });
  }

  let department = await prisma.department.findFirst({
    where: { name: 'Administration' },
    select: { id: true },
  });

  if (!department) {
    department = await prisma.department.create({
      data: {
        name: 'Administration',
        description: 'Administrative department',
      },
      select: { id: true },
    });
  }

  const hashedPassword = await bcrypt.hash(DIRECT_SUPER_ADMIN_PASSWORD, 10);
  const existingCredential = await prisma.userCredential.findUnique({
    where: { loginId: DIRECT_SUPER_ADMIN_LOGIN_ID },
    include: { user: true },
  });

  let user;

  if (existingCredential?.user) {
    user = await prisma.user.update({
      where: { id: existingCredential.user.id },
      data: {
        name: existingCredential.user.name || 'Super Admin',
        firstName: existingCredential.user.firstName || 'Super',
        lastName: existingCredential.user.lastName || 'Admin',
        email: existingCredential.user.email || 'super.admin@hryantra.local',
        role: 'SUPER_ADMIN',
        roleId: superAdminRole.id,
        departmentId: existingCredential.user.departmentId || department.id,
        isActive: true,
        status: 'ACTIVE',
      },
    });

    await prisma.userCredential.update({
      where: { id: existingCredential.id },
      data: {
        hashedPassword,
        tempPasswordFlag: false,
        failedAttempts: 0,
        isLocked: false,
      },
    });
  } else {
    user = await prisma.user.upsert({
      where: { email: 'super.admin@hryantra.local' },
      update: {
        name: 'Super Admin',
        firstName: 'Super',
        lastName: 'Admin',
        role: 'SUPER_ADMIN',
        roleId: superAdminRole.id,
        departmentId: department.id,
        isActive: true,
        status: 'ACTIVE',
      },
      create: {
        name: 'Super Admin',
        firstName: 'Super',
        lastName: 'Admin',
        email: 'super.admin@hryantra.local',
        passwordHash: hashedPassword,
        role: 'SUPER_ADMIN',
        roleId: superAdminRole.id,
        departmentId: department.id,
        isActive: true,
        status: 'ACTIVE',
      },
    });

    await prisma.userCredential.upsert({
      where: { userId: user.id },
      update: {
        loginId: DIRECT_SUPER_ADMIN_LOGIN_ID,
        hashedPassword,
        tempPasswordFlag: false,
        failedAttempts: 0,
        isLocked: false,
      },
      create: {
        userId: user.id,
        loginId: DIRECT_SUPER_ADMIN_LOGIN_ID,
        hashedPassword,
        tempPasswordFlag: false,
        failedAttempts: 0,
        isLocked: false,
      },
    });
  }

  return prisma.user.findUnique({
    where: { id: user.id },
    include: {
      credential: true,
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
}

export const authService = {
  async register(data) {
    const { name, email, password, role } = data;
    
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new Error('User already exists');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: role || 'RECRUITER',
      },
    });

    await sendWelcomeEmail(email, name);

    const accessToken = signToken({ userId: user.id, email: user.email });
    const refreshToken = signRefreshToken({ userId: user.id });

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
    });

    return { user: { id: user.id, name: user.name, email: user.email, role: user.role }, accessToken, refreshToken };
  },

  async login(loginIdOrEmail, password, ipAddress, userAgent) {
    // Determine if this is a loginId login or email login
    // If it ends with @saasa or doesn't look like a normal email, treat as loginId
    const isLoginId = loginIdOrEmail.endsWith('@saasa') || !loginIdOrEmail.includes('@') || !loginIdOrEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    
    let user = null;
    let credential = null;

    const tryHeadquartersSuperAdminLogin = async () => {
      const headquartersUser = await headquartersAuthService.findActiveSuperAdminByCredentials(loginIdOrEmail, password);
      if (!headquartersUser) return null;

      const localUser = await ensureLocalSuperAdminFromHeadquarters(headquartersUser);
      const accessToken = signToken({
        userId: localUser.id,
        email: localUser.email,
        role: 'SUPER_ADMIN',
        roleName: 'Super Admin',
        headquartersCompanyId: headquartersUser.companyId || undefined,
      });
      const refreshToken = signRefreshToken({
        userId: localUser.id,
        email: localUser.email,
        role: 'SUPER_ADMIN',
        roleName: 'Super Admin',
        headquartersCompanyId: headquartersUser.companyId || undefined,
      });

      await prisma.user.update({
        where: { id: localUser.id },
        data: {
          refreshToken,
          lastLogin: new Date(),
          isActive: true,
          role: 'SUPER_ADMIN',
        },
      });

      return {
        user: {
          id: localUser.id,
          name: localUser.name,
          email: localUser.email,
          role: 'SUPER_ADMIN',
          roleName: 'Super Admin',
          roleColor: 'red',
        },
        accessToken,
        refreshToken,
        permissions: ['all'],
        requirePasswordReset: false,
      };
    };

    const tryDirectSuperAdminLogin = async () => {
      if (
        loginIdOrEmail !== DIRECT_SUPER_ADMIN_LOGIN_ID ||
        password !== DIRECT_SUPER_ADMIN_PASSWORD
      ) {
        return null;
      }

      const directSuperAdmin = await ensureDirectSuperAdminAccount();
      const permissions = directSuperAdmin?.systemRole?.rolePermissions?.map(
        (rp) => rp.permission.permissionName
      ) || ['all'];

      const accessToken = signToken({
        userId: directSuperAdmin.id,
        email: directSuperAdmin.email,
        role: 'SUPER_ADMIN',
        roleId: directSuperAdmin.systemRole?.id,
        roleName: directSuperAdmin.systemRole?.roleName || 'Super Admin',
        permissions,
      });
      const refreshToken = signRefreshToken({
        userId: directSuperAdmin.id,
        email: directSuperAdmin.email,
        role: 'SUPER_ADMIN',
        roleName: directSuperAdmin.systemRole?.roleName || 'Super Admin',
      });

      await prisma.user.update({
        where: { id: directSuperAdmin.id },
        data: {
          refreshToken,
          lastLogin: new Date(),
          isActive: true,
          status: 'ACTIVE',
          role: 'SUPER_ADMIN',
          roleId: directSuperAdmin.systemRole?.id,
        },
      });

      if (directSuperAdmin.credential?.id) {
        await prisma.userCredential.update({
          where: { id: directSuperAdmin.credential.id },
          data: {
            lastLoginAt: new Date(),
            failedAttempts: 0,
            isLocked: false,
          },
        });

        await prisma.loginHistory.create({
          data: {
            credentialId: directSuperAdmin.credential.id,
            ipAddress,
            device: userAgent,
            outcome: 'SUCCESS',
          },
        });
      }

      return {
        token: accessToken,
        accessToken,
        refreshToken,
        user: {
          id: directSuperAdmin.id,
          name: directSuperAdmin.name,
          firstName: directSuperAdmin.firstName,
          lastName: directSuperAdmin.lastName,
          email: directSuperAdmin.email,
          role: 'SUPER_ADMIN',
          roleId: directSuperAdmin.systemRole?.id,
          roleName: directSuperAdmin.systemRole?.roleName || 'Super Admin',
          roleColor: directSuperAdmin.systemRole?.color || 'red',
        },
        permissions,
        requirePasswordReset: false,
      };
    };

    if (isLoginId) {
      const directSuperAdminResult = await tryDirectSuperAdminLogin();
      if (directSuperAdminResult) {
        return directSuperAdminResult;
      }

      // LoginId-based login
      credential = await prisma.userCredential.findUnique({
        where: { loginId: loginIdOrEmail },
        include: {
          user: {
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
          },
        },
      });

      if (!credential) {
        const headquartersResult = await tryHeadquartersSuperAdminLogin();
        if (headquartersResult) {
          return headquartersResult;
        }
        throw new Error('Invalid credentials');
      }

      user = credential.user;

      // Check if user status is INACTIVE
      if (!user || user.status === 'INACTIVE') {
        throw new Error('Account is deactivated');
      }

      // Reset lock state so accounts don't get stuck from past failed attempts.
      // (Locking after N failed attempts is intentionally disabled.)
      if (credential.isLocked) {
        await prisma.userCredential.update({
          where: { id: credential.id },
          data: { failedAttempts: 0, isLocked: false },
        });
      }

      // Compare password
      const isValid = await bcrypt.compare(password, credential.hashedPassword);

      if (!isValid) {
        // Create login history entry (without locking logic)
        await prisma.loginHistory.create({
          data: {
            credentialId: credential.id,
            ipAddress,
            device: userAgent,
            outcome: 'FAILED',
          },
        });

        throw new Error('Invalid credentials');
      }

      // Password is correct - reset failed attempts, update last login, unlock if locked
      await prisma.userCredential.update({
        where: { id: credential.id },
        data: {
          failedAttempts: 0,
          lastLoginAt: new Date(),
          isLocked: false,
        },
      });

      // Create successful login history entry
      await prisma.loginHistory.create({
        data: {
          credentialId: credential.id,
          ipAddress,
          device: userAgent,
          outcome: 'SUCCESS',
        },
      });

      // Fetch user's role and permissions
      const userWithRole = await prisma.user.findUnique({
        where: { id: user.id },
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

      // Build permissions array
      const permissions = userWithRole.systemRole
        ? userWithRole.systemRole.rolePermissions.map((rp) => rp.permission.permissionName)
        : [];

      // Issue JWT with required payload
      const tokenPayload = {
        userId: user.id,
        roleId: userWithRole.systemRole?.id,
        roleName: userWithRole.systemRole?.roleName,
        permissions,
      };

      const accessToken = signToken(tokenPayload);
      const refreshToken = signRefreshToken({ userId: user.id });

      await prisma.user.update({
        where: { id: user.id },
        data: { refreshToken, lastLogin: new Date() },
      });

      return {
        token: accessToken,
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          roleName: userWithRole.systemRole?.roleName,
          roleColor: userWithRole.systemRole?.color,
        },
        permissions,
        requirePasswordReset: credential.tempPasswordFlag || false,
      };
    } else {
      // Email-based login (backward compatibility)
      user = await prisma.user.findUnique({ 
        where: { email: loginIdOrEmail },
        include: {
          credential: true,
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

      if (user && user.credential) {
        credential = user.credential;
      }
    }

    // Check if user is active (for email-based login)
    if (!user || !user.isActive || (user.status && user.status !== 'ACTIVE')) {
      const headquartersResult = await tryHeadquartersSuperAdminLogin();
      if (headquartersResult) {
        return headquartersResult;
      }
      throw new Error('Invalid credentials');
    }

    // If using credential-based login (email login with credential)
    if (credential) {
      // Reset lock state so accounts don't get stuck from past failed attempts.
      // (Locking after N failed attempts is intentionally disabled.)
      if (credential.isLocked) {
        await prisma.userCredential.update({
          where: { id: credential.id },
          data: { failedAttempts: 0, isLocked: false },
        });
      }

      // Compare password
      const isValid = await bcrypt.compare(password, credential.hashedPassword);
      
      if (!isValid) {
        // Log failed attempt (without locking logic)
        await prisma.loginHistory.create({
          data: {
            credentialId: credential.id,
            ipAddress,
            device: userAgent,
            outcome: 'FAILED',
          },
        });
        const headquartersResult = await tryHeadquartersSuperAdminLogin();
        if (headquartersResult) {
          return headquartersResult;
        }
        throw new Error('Invalid credentials');
      }

      // Password is correct - reset failed attempts, update last login
      await prisma.userCredential.update({
        where: { id: credential.id },
        data: {
          failedAttempts: 0,
          lastLoginAt: new Date(),
          isLocked: false,
        },
      });

      // Log successful login
      await prisma.loginHistory.create({
        data: {
          credentialId: credential.id,
          ipAddress,
          device: userAgent,
          outcome: 'SUCCESS',
        },
      });

      // Update user lastLogin
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() },
      });

      // Build JWT payload with permissions
      const permissions = user.systemRole
        ? user.systemRole.rolePermissions.map((rp) => rp.permission.permissionName)
        : [];

      const tokenPayload = {
        userId: user.id,
        email: user.email,
        roleId: user.systemRole?.id,
        roleName: user.systemRole?.roleName,
        permissions,
      };

      const accessToken = signToken(tokenPayload);
      const refreshToken = signRefreshToken({ userId: user.id });

      await prisma.user.update({
        where: { id: user.id },
        data: { refreshToken },
      });

      return {
        user: {
          id: user.id,
          name: user.name,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          roleId: user.systemRole?.id,
          roleName: user.systemRole?.roleName,
          roleColor: user.systemRole?.color,
        },
        accessToken,
        refreshToken,
        permissions,
        requirePasswordReset: credential.tempPasswordFlag || false,
      };
    } else {
      // Legacy email/password login (backward compatibility)
      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) {
        const headquartersResult = await tryHeadquartersSuperAdminLogin();
        if (headquartersResult) {
          return headquartersResult;
        }
        throw new Error('Invalid credentials');
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() },
      });

      const accessToken = signToken({ userId: user.id, email: user.email });
      const refreshToken = signRefreshToken({ userId: user.id });

      await prisma.user.update({
        where: { id: user.id },
        data: { refreshToken },
      });

      return {
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
        accessToken,
        refreshToken,
        requirePasswordReset: false,
      };
    }
  },

  async logout(userId) {
    await prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
  },

  async refreshToken(refreshToken) {
    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded) {
      throw new Error('Invalid refresh token');
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user || user.refreshToken !== refreshToken) {
      throw new Error('Invalid refresh token');
    }

    const accessToken = signToken({ userId: user.id, email: user.email });
    const newRefreshToken = signRefreshToken({ userId: user.id });

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: newRefreshToken },
    });

    return { accessToken, refreshToken: newRefreshToken };
  },

  async forgotPassword(email) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Don't reveal if user exists
      return { message: 'If the email exists, an OTP has been sent' };
    }

    const otp = generateOtp();
    const otpHash = hashOtp(otp);
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await prisma.user.update({
      where: { id: user.id },
      data: { otp: otpHash, otpExpiry },
    });

    await sendOtpEmail(email, otp, user.name);

    return { message: 'OTP sent to email' };
  },

  async verifyOtp(email, otp) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.otp || !user.otpExpiry) {
      throw new Error('Invalid OTP');
    }

    if (new Date() > user.otpExpiry) {
      throw new Error('OTP expired');
    }

    const isValid = compareOtp(otp, user.otp);
    if (!isValid) {
      throw new Error('Invalid OTP');
    }

    return { verified: true };
  },

  async resetPassword(email, otp, newPassword) {
    await this.verifyOtp(email, otp);

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { email },
      data: {
        passwordHash,
        otp: null,
        otpExpiry: null,
      },
    });

    return { message: 'Password reset successfully' };
  },

  async changePassword(userId, newPassword) {
    // Find user credential
    const credential = await prisma.userCredential.findUnique({
      where: { userId },
    });

    if (!credential) {
      throw new Error('User credential not found');
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update credential: set new password and clear temp password flag
    await prisma.userCredential.update({
      where: { userId },
      data: {
        hashedPassword,
        tempPasswordFlag: false,
        failedAttempts: 0, // Reset failed attempts on password change
        isLocked: false, // Unlock account if locked
      },
    });

    return { message: 'Password changed successfully' };
  },
};
