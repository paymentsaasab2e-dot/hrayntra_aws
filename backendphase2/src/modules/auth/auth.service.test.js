import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { authService } from './auth.service.js';
import { prisma } from '../../config/prisma.js';
import { headquartersAuthService } from './headquarters-auth.service.js';
import { sessionService } from '../session/session.service.js';
import bcrypt from 'bcryptjs';

function makeCredential() {
  return {
    id: 'cred-1',
    loginId: 'user@saasa',
    hashedPassword: 'hashed',
    user: {
      id: 'u-1',
      email: 'user@hryantra.local',
      name: 'Test User',
      firstName: 'Test',
      lastName: 'User',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      systemRole: { id: 'r-1', roleName: 'Super Admin', color: 'red' },
    },
  };
}

function makeUserWithRole() {
  return {
    id: 'u-1',
    email: 'user@hryantra.local',
    role: 'SUPER_ADMIN',
    roleId: 'r-1',
    systemRole: { id: 'r-1', roleName: 'Super Admin', color: 'red' },
  };
}

describe('authService.login — W1 directory-first tenancy', () => {
  beforeEach(() => {
    // Fail closed for HQ paths so regular tenant login is exercised.
    headquartersAuthService.findActiveSuperAdminByCredentials = async () => null;
    headquartersAuthService.findWorkspaceUserByEmail = async () => null;
    headquartersAuthService.findTenantDbNameForUser = async () => '';

    prisma.userCredential.findFirst = async () => null;
    prisma.userCredential.update = async () => ({});
    prisma.loginHistory.create = async () => ({});
    prisma.user.findUnique = async () => null;
    prisma.user.update = async () => ({});

    sessionService.gateLoginOrIssueTokens = async () => ({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });

    bcrypt.compare = async () => true;
  });

  it('good user + correct tenant logs in successfully', async () => {
    headquartersAuthService.findTenantDbNameForUser = async () => 'tenantA';
    prisma.userCredential.findFirst = async () => makeCredential();
    prisma.user.findUnique = async () => makeUserWithRole();

    const result = await authService.login('user@saasa', 'password', '127.0.0.1', 'agent', {});

    assert.strictEqual(result.tenantDbName, 'tenantA');
    assert.strictEqual(result.user.email, 'user@hryantra.local');
    assert.ok(result.accessToken);
  });

  it('good user + wrong tenant fails without leaking account details', async () => {
    headquartersAuthService.findTenantDbNameForUser = async () => 'wrongTenant';
    prisma.userCredential.findFirst = async () => null;

    await assert.rejects(
      () => authService.login('user@saasa', 'password', '127.0.0.1', 'agent', {}),
      { message: 'Invalid credentials' }
    );
  });

  it('missing tenant directory mapping returns explicit TENANT_NOT_FOUND', async () => {
    headquartersAuthService.findActiveSuperAdminByCredentials = async () => null;

    await assert.rejects(
      () => authService.login('unknown@saasa', 'password', '127.0.0.1', 'agent', {}),
      (err) => {
        assert.strictEqual(err.code, 'TENANT_NOT_FOUND');
        assert.ok(err.message.includes('Tenant not recognized'));
        return true;
      }
    );
  });

  it('password reset does not look up the default DB when directory has no mapping', async () => {
    let defaultLookup = false;
    prisma.userCredential.findUnique = async () => {
      defaultLookup = true;
      return makeCredential();
    };
    prisma.user.findUnique = async () => makeUserWithRole();

    const resolved = await authService._resolveUserForPasswordReset('nobody@saasa');
    assert.strictEqual(resolved, null);
    assert.strictEqual(defaultLookup, false);
  });
});
