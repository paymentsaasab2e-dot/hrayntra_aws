import bcrypt from 'bcryptjs';
import { prisma } from '../../config/prisma.js';
import { generateOtp, hashOtp, compareOtp } from '../../utils/otp.js';
import { signToken, signRefreshToken, verifyRefreshToken } from '../../utils/jwt.js';
import { sendOtpEmail, sendWelcomeEmail } from '../../emails/email.service.js';

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

    if (isLoginId) {
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
        throw new Error('Invalid credentials');
      }

      user = credential.user;

      // Check if user status is INACTIVE
      if (!user || user.status === 'INACTIVE') {
        throw new Error('Account is deactivated');
      }

      // Check if account is locked
      if (credential.isLocked) {
        const error = new Error('Account is locked. Contact your administrator.');
        error.statusCode = 423;
        throw error;
      }

      // Compare password
      const isValid = await bcrypt.compare(password, credential.hashedPassword);

      if (!isValid) {
        // Increment failed attempts
        const newFailedAttempts = credential.failedAttempts + 1;
        const shouldLock = newFailedAttempts >= 5;

        await prisma.userCredential.update({
          where: { id: credential.id },
          data: {
            failedAttempts: newFailedAttempts,
            isLocked: shouldLock,
          },
        });

        // Create login history entry
        await prisma.loginHistory.create({
          data: {
            credentialId: credential.id,
            ipAddress,
            device: userAgent,
            outcome: shouldLock ? 'LOCKED' : 'FAILED',
          },
        });

        if (shouldLock) {
          throw new Error('Invalid credentials. Account has been locked after 5 failed attempts.');
        }

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
      throw new Error('Invalid credentials');
    }

    // If using credential-based login (email login with credential)
    if (credential) {
      // Check if account is locked
      if (credential.isLocked) {
        const error = new Error('Account is locked. Contact your administrator.');
        error.statusCode = 423;
        throw error;
      }

      // Compare password
      const isValid = await bcrypt.compare(password, credential.hashedPassword);
      
      if (!isValid) {
        // Increment failed attempts
        const newFailedAttempts = credential.failedAttempts + 1;
        const shouldLock = newFailedAttempts >= 5;

        await prisma.userCredential.update({
          where: { id: credential.id },
          data: {
            failedAttempts: newFailedAttempts,
            isLocked: shouldLock,
          },
        });

        // Log failed attempt
        await prisma.loginHistory.create({
          data: {
            credentialId: credential.id,
            ipAddress,
            device: userAgent,
            outcome: shouldLock ? 'LOCKED' : 'FAILED',
          },
        });

        if (shouldLock) {
          throw new Error('Account locked due to too many failed attempts');
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
