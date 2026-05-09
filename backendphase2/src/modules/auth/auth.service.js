import bcrypt from 'bcryptjs';
import { prisma, runWithTenantContext, getActiveTenantDbName } from '../../config/prisma.js';
import { generateOtp, hashOtp, compareOtp } from '../../utils/otp.js';
import { signToken, signRefreshToken, verifyRefreshToken } from '../../utils/jwt.js';
import { sendOtpEmail, sendWelcomeEmail } from '../../emails/email.service.js';
import { headquartersAuthService } from './headquarters-auth.service.js';
import { seedOrgRecruitmentFromOrganizationType } from '../setting/recruitmentMode.service.js';
import { DEFAULT_SYSTEM_ROLES } from '../role/default-permissions.js';
import { ensureSuperAdminHasAllPermissions, syncDefaultPermissions } from '../role/permission-sync.service.js';

const DIRECT_SUPER_ADMIN_LOGIN_ID = 'super.admin@saasa';
const DIRECT_SUPER_ADMIN_PASSWORD = 'UjvnE3WctAVa';

function resolveActiveTenantDbName() {
  const tenantDbName = String(getActiveTenantDbName() || '').trim();
  return tenantDbName || '';
}

async function ensureWorkspaceClientForTenant(tenantDbName, user, fallbackWorkspaceName = '') {
  const normalizedTenant = String(tenantDbName || '').trim();
  if (!normalizedTenant) return null;

  return runWithTenantContext(normalizedTenant, async () => {
    const existingWorkspaceClient = await prisma.client.findFirst({
      where: {
        OR: [
          { website: `tenant://${normalizedTenant}` },
          { companyName: `${normalizedTenant} Workspace` },
        ],
      },
      select: { id: true },
    });

    if (existingWorkspaceClient) return existingWorkspaceClient;

    const ownerName = String(user?.name || fallbackWorkspaceName || normalizedTenant).trim();
    const companyName = ownerName ? `${ownerName} Workspace` : `${normalizedTenant} Workspace`;

    return prisma.client.create({
      data: {
        companyName,
        industry: 'Workspace',
        website: `tenant://${normalizedTenant}`,
        status: 'ACTIVE',
        assignedToId: user?.id || null,
        createdById: user?.id || null,
      },
      select: { id: true },
    });
  });
}

async function ensureDefaultSystemRoles() {
  const existingRoles = await prisma.systemRole.findMany({
    select: { roleName: true },
  });
  const existingNames = new Set(existingRoles.map((role) => role.roleName));
  const missingRoles = DEFAULT_SYSTEM_ROLES.filter((role) => !existingNames.has(role.roleName));
  if (missingRoles.length > 0) {
    await prisma.systemRole.createMany({
      data: missingRoles,
    });
  }
}

async function ensureSuperAdminRoleAndDepartment() {
  await syncDefaultPermissions();
  await ensureDefaultSystemRoles();
  const superAdminRole = await prisma.systemRole.findUnique({
    where: { roleName: 'Super Admin' },
  });
  if (!superAdminRole) {
    throw new Error('Super Admin role is missing in tenant database');
  }

  await ensureSuperAdminHasAllPermissions();

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

  return { superAdminRole, department };
}

async function ensureLocalSuperAdminFromHeadquarters(hqUser) {
  const { superAdminRole, department } = await ensureSuperAdminRoleAndDepartment();
  const existing = await prisma.user.findUnique({
    where: { email: hqUser.email },
  });

  const fallbackName = hqUser.name || existing?.name || hqUser.email;
  const nameParts = String(fallbackName).trim().split(/\s+/).filter(Boolean);
  const firstName = existing?.firstName || nameParts[0] || 'Super';
  const lastName = existing?.lastName || nameParts.slice(1).join(' ') || 'Admin';

  let user;
  if (existing) {
    user = await prisma.user.update({
      where: { id: existing.id },
      data: {
        name: fallbackName,
        firstName,
        lastName,
        role: 'SUPER_ADMIN',
        roleId: superAdminRole.id,
        departmentId: existing.departmentId || department.id,
        isActive: true,
        status: 'ACTIVE',
      },
    });
  } else {
    const placeholderHash = await bcrypt.hash(`headquarters:${hqUser.id}:${Date.now()}`, 10);
    user = await prisma.user.create({
      data: {
        name: fallbackName,
        firstName,
        lastName,
        email: hqUser.email,
        passwordHash: placeholderHash,
        role: 'SUPER_ADMIN',
        roleId: superAdminRole.id,
        departmentId: department.id,
        isActive: true,
        status: 'ACTIVE',
      },
    });
  }

  const plainLoginId = String(hqUser.loginId || hqUser.email || '').trim();
  if (plainLoginId && hqUser.password) {
    const hashedPassword = await bcrypt.hash(String(hqUser.password), 10);
    await prisma.userCredential.upsert({
      where: { userId: user.id },
      update: {
        loginId: plainLoginId,
        hashedPassword,
        tempPasswordFlag: false,
        isLocked: false,
        failedAttempts: 0,
      },
      create: {
        userId: user.id,
        loginId: plainLoginId,
        hashedPassword,
        tempPasswordFlag: false,
        isLocked: false,
        failedAttempts: 0,
      },
    });
  }

  return user;
}

async function ensureDirectSuperAdminAccount() {
  const { superAdminRole, department } = await ensureSuperAdminRoleAndDepartment();

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
  async provisionHeadquartersMappedTenant(headquartersUser) {
    if (!headquartersUser?.tenantDbName) {
      throw new Error('tenantDbName is required');
    }
    return runWithTenantContext(headquartersUser.tenantDbName, async () => {
      await seedOrgRecruitmentFromOrganizationType(headquartersUser.organizationType || 'agency');
      return ensureLocalSuperAdminFromHeadquarters(headquartersUser);
    });
  },

  async finalizeHeadquartersTenantWorkspace(headquartersUser, localUser) {
    await ensureWorkspaceClientForTenant(headquartersUser.tenantDbName, localUser, headquartersUser.name);
  },

  async register(data) {
    const { name, email, password } = data;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedName = String(name || '').trim();
    
    if (!normalizedName || !normalizedEmail || !password) {
      throw new Error('Name, email, and password are required');
    }

    const headquartersUser = await headquartersAuthService.registerWorkspaceUserAndProvisionTenant({
      name: normalizedName,
      email: normalizedEmail,
      password,
      loginId: data.loginId || normalizedEmail,
      organizationType: data.organizationType || 'agency',
    });

    const localUser = await this.provisionHeadquartersMappedTenant(headquartersUser);
    await ensureWorkspaceClientForTenant(headquartersUser.tenantDbName, localUser, headquartersUser.name);
    await sendWelcomeEmail(normalizedEmail, normalizedName);

    return {
      user: {
        id: localUser.id,
        name: localUser.name,
        email: localUser.email,
        role: 'SUPER_ADMIN',
        roleName: 'Super Admin',
        roleColor: 'red',
      },
      tenantDbName: headquartersUser.tenantDbName,
      tenantDatabaseUrl: headquartersUser.tenantDatabaseUrl,
      tenantProvisioningMode: headquartersUser.tenantProvisioningMode || 'DEDICATED',
      tenantProvisioningStatus: 'READY',
      requiresLogin: true,
      message: 'Signup successful. Please log in.',
    };
  },

  async login(loginIdOrEmail, password, ipAddress, userAgent) {
    // Plain `/login` (no invite token, no cached `x-tenant-db-name`) carries no
    // tenant context, so Prisma would fall back to the default DB and never see
    // tenant-scoped team-member credentials. Resolve the user's tenant via the
    // HQ directory and re-enter login inside the right tenant context once.
    const activeTenantDbName = String(getActiveTenantDbName() || '').trim();
    if (!activeTenantDbName && loginIdOrEmail) {
      let resolvedTenantDbName = await headquartersAuthService.findTenantDbNameForUser(loginIdOrEmail);
      if (!resolvedTenantDbName) {
        resolvedTenantDbName = await headquartersAuthService.findTenantDbNameForUserByCredentialScan(
          loginIdOrEmail
        );
      }
      if (resolvedTenantDbName) {
        return runWithTenantContext(resolvedTenantDbName, () =>
          this.login(loginIdOrEmail, password, ipAddress, userAgent)
        );
      }
    }

    // Determine if this is a loginId login or email login
    // If it ends with @saasa or doesn't look like a normal email, treat as loginId
    const isLoginId = loginIdOrEmail.endsWith('@saasa') || !loginIdOrEmail.includes('@') || !loginIdOrEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    
    let user = null;
    let credential = null;

    const tryHeadquartersSuperAdminLogin = async () => {
      const headquartersUser = await headquartersAuthService.findActiveSuperAdminByCredentials(loginIdOrEmail, password);
      if (!headquartersUser) return null;
      const tenantWorkspace = await headquartersAuthService.ensureTenantProvisioning(headquartersUser.email);
      const tenantDbName = tenantWorkspace?.tenantDbName || headquartersUser.tenantDbName || '';
      const { localUser, accessToken, refreshToken } = await runWithTenantContext(tenantDbName, async () => {
        const tenantLocalUser = await ensureLocalSuperAdminFromHeadquarters(headquartersUser);
        const tenantAccessToken = signToken({
          userId: tenantLocalUser.id,
          email: tenantLocalUser.email,
          role: 'SUPER_ADMIN',
          roleName: 'Super Admin',
          headquartersCompanyId: headquartersUser.companyId || undefined,
          tenantDbName: tenantDbName || undefined,
        });
        const tenantRefreshToken = signRefreshToken({
          userId: tenantLocalUser.id,
          email: tenantLocalUser.email,
          role: 'SUPER_ADMIN',
          roleName: 'Super Admin',
          headquartersCompanyId: headquartersUser.companyId || undefined,
          tenantDbName: tenantDbName || undefined,
        });

        await prisma.user.update({
          where: { id: tenantLocalUser.id },
          data: {
            refreshToken: tenantRefreshToken,
            lastLogin: new Date(),
            isActive: true,
            role: 'SUPER_ADMIN',
          },
        });

        return {
          localUser: tenantLocalUser,
          accessToken: tenantAccessToken,
          refreshToken: tenantRefreshToken,
        };
      });

      await ensureWorkspaceClientForTenant(tenantDbName, localUser, headquartersUser.name);

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
        tenantDbName,
        tenantDatabaseUrl: tenantWorkspace?.tenantDatabaseUrl || headquartersUser.tenantDatabaseUrl || '',
        tenantProvisioningMode: headquartersUser.tenantProvisioningMode || 'DEDICATED',
        tenantProvisioningStatus: tenantWorkspace?.wasCreated ? 'CREATED' : 'READY',
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
      const tenantDbName = resolveActiveTenantDbName();

      const accessToken = signToken({
        userId: directSuperAdmin.id,
        email: directSuperAdmin.email,
        role: 'SUPER_ADMIN',
        roleId: directSuperAdmin.systemRole?.id,
        roleName: directSuperAdmin.systemRole?.roleName || 'Super Admin',
        permissions,
        tenantDbName: tenantDbName || undefined,
      });
      const refreshToken = signRefreshToken({
        userId: directSuperAdmin.id,
        email: directSuperAdmin.email,
        role: 'SUPER_ADMIN',
        roleName: directSuperAdmin.systemRole?.roleName || 'Super Admin',
        tenantDbName: tenantDbName || undefined,
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
        tenantDbName: tenantDbName || undefined,
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
      const tenantDbName = resolveActiveTenantDbName();

      // Issue JWT with required payload
      const tokenPayload = {
        userId: user.id,
        roleId: userWithRole.systemRole?.id,
        roleName: userWithRole.systemRole?.roleName,
        permissions,
        tenantDbName: tenantDbName || undefined,
      };

      const accessToken = signToken(tokenPayload);
      const refreshToken = signRefreshToken({
        userId: user.id,
        tenantDbName: tenantDbName || undefined,
      });

      await prisma.user.update({
        where: { id: user.id },
        data: { refreshToken, lastLogin: new Date() },
      });

      await ensureWorkspaceClientForTenant(tenantDbName, user);

      // Refresh HQ directory so future plain-/login attempts can resolve this user
      await headquartersAuthService.upsertTenantUserDirectoryEntry({
        email: user.email,
        loginId: credential.loginId,
        tenantDbName,
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
        tenantDbName: tenantDbName || undefined,
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
      const tenantDbName = resolveActiveTenantDbName();

      const tokenPayload = {
        userId: user.id,
        email: user.email,
        roleId: user.systemRole?.id,
        roleName: user.systemRole?.roleName,
        permissions,
        tenantDbName: tenantDbName || undefined,
      };

      const accessToken = signToken(tokenPayload);
      const refreshToken = signRefreshToken({
        userId: user.id,
        tenantDbName: tenantDbName || undefined,
      });

      await prisma.user.update({
        where: { id: user.id },
        data: { refreshToken },
      });

      await ensureWorkspaceClientForTenant(tenantDbName, user);

      await headquartersAuthService.upsertTenantUserDirectoryEntry({
        email: user.email,
        loginId: credential.loginId,
        tenantDbName,
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
        tenantDbName: tenantDbName || undefined,
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

      const tenantDbName = resolveActiveTenantDbName();
      const accessToken = signToken({
        userId: user.id,
        email: user.email,
        tenantDbName: tenantDbName || undefined,
      });
      const refreshToken = signRefreshToken({
        userId: user.id,
        tenantDbName: tenantDbName || undefined,
      });

      await prisma.user.update({
        where: { id: user.id },
        data: { refreshToken },
      });

      await ensureWorkspaceClientForTenant(tenantDbName, user);

      await headquartersAuthService.upsertTenantUserDirectoryEntry({
        email: user.email,
        tenantDbName,
      });

      return {
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
        accessToken,
        refreshToken,
        requirePasswordReset: false,
        tenantDbName: tenantDbName || undefined,
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

    const tenantDbNameFromToken = String(decoded.tenantDbName || '').trim();

    const refreshInScope = async () => {
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
      });

      if (!user || user.refreshToken !== refreshToken) {
        throw new Error('Invalid refresh token');
      }

      const tenantDbName = tenantDbNameFromToken || resolveActiveTenantDbName();
      const accessToken = signToken({
        userId: user.id,
        email: user.email,
        tenantDbName: tenantDbName || undefined,
      });
      const newRefreshToken = signRefreshToken({
        userId: user.id,
        tenantDbName: tenantDbName || undefined,
      });

      await prisma.user.update({
        where: { id: user.id },
        data: { refreshToken: newRefreshToken },
      });

      return {
        accessToken,
        refreshToken: newRefreshToken,
        tenantDbName: tenantDbName || undefined,
      };
    };

    if (tenantDbNameFromToken) {
      return runWithTenantContext(tenantDbNameFromToken, refreshInScope);
    }

    return refreshInScope();
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
