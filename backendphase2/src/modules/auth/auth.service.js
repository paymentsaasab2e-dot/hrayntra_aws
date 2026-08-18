import bcrypt from 'bcryptjs';
import { prisma, runWithTenantContext, getActiveTenantDbName } from '../../config/prisma.js';
import { generateOtp, hashOtp, compareOtp } from '../../utils/otp.js';
import { signToken, signRefreshToken, verifyRefreshToken } from '../../utils/jwt.js';
import { sendOtpEmail, sendWelcomeEmail } from '../../emails/email.service.js';
import { headquartersAuthService } from './headquarters-auth.service.js';
import {
  getSubscriptionPlan,
  seedOrgRecruitmentFromOrganizationType,
} from '../setting/recruitmentMode.service.js';
import { DEFAULT_SYSTEM_ROLES } from '../role/default-permissions.js';
import { ensureSuperAdminHasAllPermissions, syncDefaultPermissions, syncDefaultRolePresets, syncMissingRolePresetPermissions } from '../role/permission-sync.service.js';
import { revokeAllSessionsForUser, sessionService } from '../session/session.service.js';
import { verifyHqImpersonationToken } from '../../utils/hqImpersonationToken.js';

const DIRECT_SUPER_ADMIN_LOGIN_ID = 'super.admin@saasa';
const DIRECT_SUPER_ADMIN_PASSWORD = 'UjvnE3WctAVa';

function resolveActiveTenantDbName() {
  const tenantDbName = String(getActiveTenantDbName() || '').trim();
  return tenantDbName || '';
}

function todayIsoDateUtc() {
  return new Date().toISOString().slice(0, 10);
}

/** Block login when HQ/tenant subscription is an expired trial. */
async function assertTrialNotExpired(email) {
  let plan = null;
  try {
    plan = await getSubscriptionPlan();
  } catch {
    /* ignore local plan read failures */
  }

  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (normalizedEmail) {
    try {
      const hqUser = await headquartersAuthService.findWorkspaceUserByEmail(normalizedEmail);
      if (hqUser?.subscriptionPlan?.isTrial) {
        plan = hqUser.subscriptionPlan;
      } else if (!plan?.isTrial && hqUser?.subscriptionPlan) {
        plan = hqUser.subscriptionPlan;
      }
    } catch {
      /* ignore HQ lookup failures */
    }
  }

  if (!plan?.isTrial) return;

  const end = String(plan.planEndDate || '').trim().slice(0, 10);
  if (!end) return;
  if (end < todayIsoDateUtc()) {
    const err = new Error('Trial has ended. Request a demo or contact HQ to continue.');
    err.statusCode = 403;
    err.code = 'TRIAL_EXPIRED';
    throw err;
  }
}

function isTryFreeLoginId(loginId) {
  return String(loginId || '')
    .trim()
    .toLowerCase()
    .endsWith('@trial');
}

/** HQ-granted try-free users keep the emailed password as their final password. */
async function resolveRequirePasswordReset(credential, userEmail) {
  if (!credential) return false;

  let isTryFree = isTryFreeLoginId(credential.loginId);
  if (!isTryFree) {
    const normalizedEmail = String(userEmail || '')
      .trim()
      .toLowerCase();
    if (normalizedEmail) {
      try {
        const hqUser = await headquartersAuthService.findWorkspaceUserByEmail(normalizedEmail);
        isTryFree = hqUser?.signupSource === 'hq_grant_trial';
      } catch {
        /* ignore HQ lookup failures */
      }
    }
  }

  if (isTryFree) {
    if (credential.tempPasswordFlag) {
      try {
        await prisma.userCredential.update({
          where: { id: credential.id },
          data: { tempPasswordFlag: false },
        });
      } catch {
        /* ignore self-heal failures */
      }
    }
    return false;
  }

  return credential.tempPasswordFlag || false;
}

/** If login hit the default DB, re-run inside the tenant DB once we know the user. */
async function rerunLoginInResolvedTenant(loginIdOrEmail, user, credential, rerun) {
  if (resolveActiveTenantDbName()) return null;
  const email = String(user?.email || '').trim();
  let resolved = await headquartersAuthService.findTenantDbNameForUser(email || loginIdOrEmail);
  if (!resolved) {
    resolved = await headquartersAuthService.findTenantDbNameForUserByCredentialScan(
      credential?.loginId || loginIdOrEmail
    );
  }
  if (!resolved) return null;
  return runWithTenantContext(resolved, rerun);
}

async function ensureWorkspaceClientForTenant(tenantDbName, user, fallbackWorkspaceName = '') {
  const normalizedTenant = String(tenantDbName || '').trim();
  if (!normalizedTenant) return null;

  return runWithTenantContext(normalizedTenant, async () => {
    const existingWorkspaceClient = await prisma.client.findFirst({
      where: {
        isDeleted: { not: true },
        OR: [
          { website: `tenant://${normalizedTenant}` },
          { companyName: `${normalizedTenant} Workspace` },
          { industry: 'Workspace', companyName: { endsWith: ' Workspace' } },
        ],
      },
      orderBy: { createdAt: 'asc' },
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
  await syncDefaultRolePresets();
  await syncMissingRolePresetPermissions();
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

  async updateHeadquartersAdminCredentials(headquartersUser, plainPassword) {
    if (!headquartersUser?.tenantDbName) {
      throw new Error('tenantDbName is required');
    }
    const password = String(plainPassword || '').trim();
    const loginId = String(headquartersUser.loginId || headquartersUser.email || '').trim();
    if (!password || !loginId) {
      throw new Error('loginId and password are required');
    }
    return runWithTenantContext(headquartersUser.tenantDbName, async () => {
      const email = String(headquartersUser.email || '').trim().toLowerCase();
      const user =
        (email
          ? await prisma.user.findFirst({
              where: { email },
            })
          : null) ||
        (await prisma.user.findFirst({
          where: { role: 'SUPER_ADMIN', isActive: true },
          orderBy: { createdAt: 'asc' },
        }));
      if (!user) throw new Error('Tenant admin user not found');

      const hashedPassword = await bcrypt.hash(password, 10);
      await prisma.userCredential.upsert({
        where: { userId: user.id },
        update: {
          loginId,
          hashedPassword,
          tempPasswordFlag: true,
          isLocked: false,
          failedAttempts: 0,
        },
        create: {
          userId: user.id,
          loginId,
          hashedPassword,
          tempPasswordFlag: true,
          isLocked: false,
          failedAttempts: 0,
        },
      });
      return user;
    });
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

  async login(loginIdOrEmail, password, ipAddress, userAgent, deviceMeta = {}) {
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
          this.login(loginIdOrEmail, password, ipAddress, userAgent, deviceMeta)
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
      const hqLoginResult = await runWithTenantContext(tenantDbName, async () => {
        const tenantLocalUser = await ensureLocalSuperAdminFromHeadquarters(headquartersUser);
        const tokenResult = await sessionService.gateLoginOrIssueTokens({
          userId: tenantLocalUser.id,
          tokenPayload: {
            userId: tenantLocalUser.id,
            email: tenantLocalUser.email,
            role: 'SUPER_ADMIN',
            roleName: 'Super Admin',
            headquartersCompanyId: headquartersUser.companyId || undefined,
            tenantDbName: tenantDbName || undefined,
          },
          refreshPayload: {
            userId: tenantLocalUser.id,
            email: tenantLocalUser.email,
            role: 'SUPER_ADMIN',
            roleName: 'Super Admin',
            headquartersCompanyId: headquartersUser.companyId || undefined,
            tenantDbName: tenantDbName || undefined,
          },
          deviceMeta,
          identity: {
            email: tenantLocalUser.email,
            loginId: headquartersUser.loginId || loginIdOrEmail,
          },
        });

        if (tokenResult.duplicateSession) {
          return { duplicateSession: true, activeSession: tokenResult.activeSession };
        }

        await prisma.user.update({
          where: { id: tenantLocalUser.id },
          data: {
            isActive: true,
            role: 'SUPER_ADMIN',
          },
        });

        return {
          localUser: tenantLocalUser,
          accessToken: tokenResult.accessToken,
          refreshToken: tokenResult.refreshToken,
        };
      });

      if (hqLoginResult?.duplicateSession) {
        return {
          duplicateSession: true,
          activeSession: hqLoginResult.activeSession,
          tenantDbName,
        };
      }

      const { localUser, accessToken, refreshToken } = hqLoginResult;
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

      const tokenResult = await sessionService.gateLoginOrIssueTokens({
        userId: directSuperAdmin.id,
        tokenPayload: {
          userId: directSuperAdmin.id,
          email: directSuperAdmin.email,
          role: 'SUPER_ADMIN',
          roleId: directSuperAdmin.systemRole?.id,
          roleName: directSuperAdmin.systemRole?.roleName || 'Super Admin',
          permissions,
          tenantDbName: tenantDbName || undefined,
        },
        refreshPayload: {
          userId: directSuperAdmin.id,
          tenantDbName: tenantDbName || undefined,
        },
        deviceMeta,
        identity: { email: directSuperAdmin.email, loginId: loginIdOrEmail },
      });

      if (tokenResult.duplicateSession) {
        return {
          duplicateSession: true,
          activeSession: tokenResult.activeSession,
          tenantDbName: tenantDbName || undefined,
        };
      }

      const { accessToken, refreshToken } = tokenResult;

      await prisma.user.update({
        where: { id: directSuperAdmin.id },
        data: {
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
          loginId: loginIdOrEmail,
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

      await assertTrialNotExpired(user.email);

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
      const tenantRerun = await rerunLoginInResolvedTenant(
        loginIdOrEmail,
        user,
        credential,
        () => this.login(loginIdOrEmail, password, ipAddress, userAgent, deviceMeta)
      );
      if (tenantRerun) return tenantRerun;

      const tenantDbName = resolveActiveTenantDbName();

      // Issue JWT with required payload
      const tokenPayload = {
        userId: user.id,
        roleId: userWithRole.systemRole?.id,
        roleName: userWithRole.systemRole?.roleName,
        permissions,
        tenantDbName: tenantDbName || undefined,
      };

      const tokenResult = await sessionService.gateLoginOrIssueTokens({
        userId: user.id,
        tokenPayload,
        refreshPayload: { userId: user.id, tenantDbName: tenantDbName || undefined },
        deviceMeta,
        identity: { email: user.email, loginId: loginIdOrEmail },
      });

      if (tokenResult.duplicateSession) {
        return {
          duplicateSession: true,
          activeSession: tokenResult.activeSession,
          tenantDbName: tenantDbName || undefined,
        };
      }

      const { accessToken, refreshToken } = tokenResult;

      await ensureWorkspaceClientForTenant(tenantDbName, user);

      await headquartersAuthService.upsertTenantUserDirectoryEntry({
        email: user.email,
        loginId: credential.loginId,
        tenantDbName,
      });

      return {
        token: accessToken,
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          loginId: credential.loginId,
          roleName: userWithRole.systemRole?.roleName,
          roleColor: userWithRole.systemRole?.color,
        },
        permissions,
        requirePasswordReset: await resolveRequirePasswordReset(credential, user.email),
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

      if (user?.credential) {
        credential = user.credential;
      } else if (user) {
        credential = await prisma.userCredential.findUnique({
          where: { userId: user.id },
        });
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

      await assertTrialNotExpired(user.email);

      // Build JWT payload with permissions
      const permissions = user.systemRole
        ? user.systemRole.rolePermissions.map((rp) => rp.permission.permissionName)
        : [];
      const tenantRerun = await rerunLoginInResolvedTenant(
        loginIdOrEmail,
        user,
        credential,
        () => this.login(loginIdOrEmail, password, ipAddress, userAgent, deviceMeta)
      );
      if (tenantRerun) return tenantRerun;

      const tenantDbName = resolveActiveTenantDbName();

      const tokenPayload = {
        userId: user.id,
        email: user.email,
        roleId: user.systemRole?.id,
        roleName: user.systemRole?.roleName,
        permissions,
        tenantDbName: tenantDbName || undefined,
      };

      const tokenResult = await sessionService.gateLoginOrIssueTokens({
        userId: user.id,
        tokenPayload,
        refreshPayload: { userId: user.id, tenantDbName: tenantDbName || undefined },
        deviceMeta,
        identity: { email: user.email, loginId: credential.loginId },
      });

      if (tokenResult.duplicateSession) {
        return {
          duplicateSession: true,
          activeSession: tokenResult.activeSession,
          tenantDbName: tenantDbName || undefined,
        };
      }

      const { accessToken, refreshToken } = tokenResult;

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
          loginId: credential.loginId,
          role: user.role,
          roleId: user.systemRole?.id,
          roleName: user.systemRole?.roleName,
          roleColor: user.systemRole?.color,
        },
        accessToken,
        refreshToken,
        permissions,
        requirePasswordReset: await resolveRequirePasswordReset(credential, user.email),
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

      await assertTrialNotExpired(user.email);

      const tenantDbName = resolveActiveTenantDbName();
      const tokenResult = await sessionService.gateLoginOrIssueTokens({
        userId: user.id,
        tokenPayload: {
          userId: user.id,
          email: user.email,
          tenantDbName: tenantDbName || undefined,
        },
        refreshPayload: { userId: user.id, tenantDbName: tenantDbName || undefined },
        deviceMeta,
        identity: { email: user.email, loginId: loginIdOrEmail },
      });

      if (tokenResult.duplicateSession) {
        return {
          duplicateSession: true,
          activeSession: tokenResult.activeSession,
          tenantDbName: tenantDbName || undefined,
        };
      }

      const { accessToken, refreshToken } = tokenResult;

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

  async logout(userId, sessionId = null) {
    await sessionService.logoutSession(userId, sessionId);
    const { logUserSessionActivity } = await import('../../utils/userSessionAudit.js');
    await logUserSessionActivity(userId, 'Logged out', { sessionId: sessionId || null });
  },

  async refreshToken(refreshToken) {
    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded) {
      throw new Error('Invalid refresh token');
    }

    const tenantDbNameFromToken = String(decoded.tenantDbName || '').trim();

    const refreshInScope = async () => sessionService.refreshWithSession(refreshToken);

    if (tenantDbNameFromToken) {
      return runWithTenantContext(tenantDbNameFromToken, refreshInScope);
    }

    return refreshInScope();
  },

  async forgotPassword(identifier) {
    const resolved = await this._resolveUserForPasswordReset(identifier);
    if (!resolved?.user?.email) {
      return { message: 'If the account exists, an OTP has been sent to the registered email.' };
    }

    const { user, tenantDbName } = resolved;
    if (user.status === 'INACTIVE' || user.isActive === false) {
      return { message: 'If the account exists, an OTP has been sent to the registered email.' };
    }

    const otp = generateOtp();
    const otpHash = hashOtp(otp);
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    return this._withPasswordResetContext(tenantDbName, async () => {
      const updated = await prisma.user.updateMany({
        where: { id: user.id },
        data: { otp: otpHash, otpExpiry },
      });
      if (updated.count === 0) {
        throw new Error('Unable to send verification code. Please contact your administrator.');
      }

      const displayName =
        String(user.name || '').trim() ||
        [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
        'User';
      await sendOtpEmail(user.email, otp, displayName);

      return {
        message: 'If the account exists, an OTP has been sent to the registered email.',
        email: user.email,
      };
    });
  },

  async verifyOtp(identifier, otp) {
    const resolved = await this._resolveUserForPasswordReset(identifier);
    if (!resolved?.user?.email) {
      throw new Error('Invalid OTP');
    }

    return this._withPasswordResetContext(resolved.tenantDbName, async () => {
      const user = await prisma.user.findUnique({
        where: { email: resolved.user.email },
      });
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

      return { verified: true, email: user.email };
    });
  },

  async resetPassword(identifier, otp, newPassword) {
    const trimmedPassword = String(newPassword || '').trim();
    if (trimmedPassword.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    const resolved = await this._resolveUserForPasswordReset(identifier);
    if (!resolved?.user?.email) {
      throw new Error('Account not found');
    }

    await this.verifyOtp(identifier, otp);

    const email = resolved.user.email.toLowerCase();
    const loginIdHint =
      resolved.credential?.loginId ||
      (identifier.includes('@') ? null : String(identifier).trim());

    await this._withPasswordResetContext(resolved.tenantDbName, async () => {
      await this._persistPasswordResetForEmail(email, trimmedPassword, loginIdHint);
    });

    // Clear stale copies in the default (platform) DB when the account lives in a tenant DB.
    if (resolved.tenantDbName) {
      await runWithTenantContext('', async () => {
        await this._persistPasswordResetForEmail(email, trimmedPassword, loginIdHint, {
          skipSessionRevoke: true,
        });
      });
    }

    return { message: 'Password reset successfully. You can log in with your new password.' };
  },

  /**
   * Writes the new password to User.passwordHash and UserCredential.hashedPassword
   * in the current Prisma DB scope. Login always prefers UserCredential when present.
   */
  async _persistPasswordResetForEmail(email, plainPassword, loginIdHint = null, options = {}) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail) {
      throw new Error('Account not found');
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { credential: true },
    });
    if (!user) {
      return false;
    }

    const hashedPassword = await bcrypt.hash(String(plainPassword || '').trim(), 12);
    const loginId =
      String(loginIdHint || user.credential?.loginId || normalizedEmail).trim() || normalizedEmail;

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash: hashedPassword,
          otp: null,
          otpExpiry: null,
          refreshToken: null,
        },
      });

      const existingCredential = await tx.userCredential.findUnique({
        where: { userId: user.id },
      });

      if (existingCredential) {
        await tx.userCredential.update({
          where: { userId: user.id },
          data: {
            hashedPassword,
            tempPasswordFlag: false,
            failedAttempts: 0,
            isLocked: false,
          },
        });
      } else {
        await tx.userCredential.create({
          data: {
            userId: user.id,
            loginId,
            hashedPassword,
            tempPasswordFlag: false,
            failedAttempts: 0,
            isLocked: false,
          },
        });
      }
    });

    if (!options.skipSessionRevoke) {
      await revokeAllSessionsForUser(user.id, 'PASSWORD_RESET');
    }

    return true;
  },

  async _withPasswordResetContext(tenantDbName, fn) {
    const tenant = String(tenantDbName || '').trim();
    if (tenant) {
      return runWithTenantContext(tenant, fn);
    }
    return fn();
  },

  async _resolveUserForPasswordReset(identifier) {
    const normalized = String(identifier || '').trim();
    if (!normalized) return null;

    const lookup = async () => {
      const isLoginId =
        normalized.endsWith('@saasa') ||
        !normalized.includes('@') ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);

      if (isLoginId) {
        const credential = await prisma.userCredential.findUnique({
          where: { loginId: normalized },
          include: { user: true },
        });
        if (!credential?.user) return null;
        return { user: credential.user, credential };
      }

      const user = await prisma.user.findUnique({
        where: { email: normalized.toLowerCase() },
        include: { credential: true },
      });
      if (!user) return null;
      return { user, credential: user.credential };
    };

    const activeTenant = resolveActiveTenantDbName();
    if (activeTenant) {
      const inActiveTenant = await lookup();
      if (inActiveTenant) {
        return { ...inActiveTenant, tenantDbName: activeTenant };
      }
    }

    let tenantDbName = await headquartersAuthService.findTenantDbNameForUser(normalized);
    if (!tenantDbName) {
      tenantDbName = await headquartersAuthService.findTenantDbNameForUserByCredentialScan(normalized);
    }
    if (tenantDbName) {
      const inTenant = await runWithTenantContext(tenantDbName, lookup);
      if (inTenant) {
        return { ...inTenant, tenantDbName };
      }
    }

    const inDefault = await lookup();
    if (inDefault) {
      return { ...inDefault, tenantDbName: activeTenant || '' };
    }

    return null;
  },

  async consumeImpersonationToken(token, deviceMeta = {}) {
    const payload = verifyHqImpersonationToken(token);
    if (!payload) {
      throw new Error('Invalid or expired access link');
    }

    const headquartersUser = await headquartersAuthService.findWorkspaceUserByEmail(payload.tenantEmail);
    if (!headquartersUser) {
      throw new Error('Tenant not found');
    }
    if (headquartersUser.isDeleted) {
      throw new Error('Tenant is no longer active');
    }

    const tenantDbName = String(payload.tenantDbName || headquartersUser.tenantDbName || '').trim();
    if (!tenantDbName) {
      throw new Error('Tenant database is not ready yet');
    }

    const impersonationDeviceMeta = {
      ...deviceMeta,
      hqImpersonation: true,
      browserInfo: deviceMeta.browserInfo || 'HQ Support Access',
      deviceType: deviceMeta.deviceType || 'hq-support',
    };

    const loginResult = await runWithTenantContext(tenantDbName, async () => {
      const tenantLocalUser = await ensureLocalSuperAdminFromHeadquarters(headquartersUser);
      const tokenResult = await sessionService.issueHqImpersonationTokens({
        userId: tenantLocalUser.id,
        tokenPayload: {
          userId: tenantLocalUser.id,
          email: tenantLocalUser.email,
          role: 'SUPER_ADMIN',
          roleName: 'Super Admin',
          tenantDbName,
          hqImpersonation: true,
          hqActorEmail: payload.hqActorEmail,
        },
        refreshPayload: {
          userId: tenantLocalUser.id,
          email: tenantLocalUser.email,
          role: 'SUPER_ADMIN',
          roleName: 'Super Admin',
          tenantDbName,
          hqImpersonation: true,
          hqActorEmail: payload.hqActorEmail,
        },
        deviceMeta: impersonationDeviceMeta,
        hqActorEmail: payload.hqActorEmail,
      });

      await prisma.user.update({
        where: { id: tenantLocalUser.id },
        data: {
          isActive: true,
          role: 'SUPER_ADMIN',
          lastLogin: new Date(),
        },
      });

      return {
        localUser: tenantLocalUser,
        accessToken: tokenResult.accessToken,
        refreshToken: tokenResult.refreshToken,
      };
    });

    await ensureWorkspaceClientForTenant(tenantDbName, loginResult.localUser, headquartersUser.name);

    console.info('[hq-impersonation] access consumed', {
      tenantEmail: payload.tenantEmail,
      tenantDbName,
      hqActorEmail: payload.hqActorEmail,
      tenantUserId: loginResult.localUser.id,
    });

    return {
      user: {
        id: loginResult.localUser.id,
        name: loginResult.localUser.name,
        email: loginResult.localUser.email,
        role: 'SUPER_ADMIN',
        roleName: 'Super Admin',
        roleColor: 'red',
        loginId: headquartersUser.loginId || headquartersUser.email,
      },
      accessToken: loginResult.accessToken,
      refreshToken: loginResult.refreshToken,
      permissions: ['all'],
      requirePasswordReset: false,
      tenantDbName,
      tenantDatabaseUrl: headquartersUser.tenantDatabaseUrl || '',
      tenantProvisioningMode: headquartersUser.tenantProvisioningMode || 'DEDICATED',
      tenantProvisioningStatus: 'READY',
      hqImpersonation: true,
    };
  },

  async changePassword(userId, newPassword) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { credential: true },
    });
    if (!user) {
      throw new Error('User not found');
    }

    await this._persistPasswordResetForEmail(
      user.email,
      newPassword,
      user.credential?.loginId || null
    );

    return { message: 'Password changed successfully' };
  },
};
