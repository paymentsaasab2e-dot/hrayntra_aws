import { prisma, runWithTenantContext } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { headquartersAuthService } from '../auth/headquarters-auth.service.js';
import { authService } from '../auth/auth.service.js';
import { generateTempPassword } from '../../utils/credentialGenerator.js';
import { sendCredentialInvite } from '../../utils/emailService.js';
import { hqTicketsService } from './hq-tickets.service.js';
import { hqHelpTicketsService } from './hq-help-tickets.service.js';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizePublicUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return raw.replace(/\/$/, '');
}

function buildCrmLoginUrl(tenantDbName) {
  const base =
    normalizePublicUrl(env.FRONTEND_URL || env.CLIENT_URL || process.env.NEXT_PUBLIC_APP_URL) ||
    'http://localhost:3001';
  const tenantQ = tenantDbName
    ? `?tenantDbName=${encodeURIComponent(String(tenantDbName).trim())}`
    : '';
  return `${base}/login${tenantQ}`;
}

function phase1ApiBase() {
  return String(env.JOB_PORTAL_API_URL || process.env.JOB_PORTAL_API_URL || 'http://localhost:5000')
    .trim()
    .replace(/\/+$/, '');
}

function phase1InternalAdminKey() {
  return String(
    process.env.SYSTEM_AUDIT_ADMIN_KEY ||
      process.env.INTERVIEW_ADMIN_KEY ||
      process.env.INTERNAL_API_KEY ||
      '',
  ).trim();
}

function phase1FrontendBase() {
  return (
    normalizePublicUrl(
      process.env.PHASE1_FRONTEND_URL ||
        process.env.JOB_PORTAL_FRONTEND_URL ||
        process.env.NEXT_PUBLIC_PHASE1_FRONTEND_URL ||
        process.env.NEXT_PUBLIC_JOB_PORTAL_URL ||
        '',
    ) || 'http://localhost:3000'
  );
}

async function resolveWorkspace({ email, tenantDbName, customerId, q }) {
  const query = String(q || '').trim();
  const emailLookup = normalizeEmail(email) || (query.includes('@') ? normalizeEmail(query) : '');
  const dbLookup =
    String(tenantDbName || customerId || '').trim() ||
    (!emailLookup && query ? query : '');

  let workspace = null;
  if (emailLookup) {
    workspace = await headquartersAuthService.findWorkspaceUserByEmail(emailLookup);
  }
  if (!workspace && dbLookup) {
    workspace = await headquartersAuthService.findTenantByDbName(dbLookup);
  }
  if (!workspace && query && !emailLookup) {
    const tenants = await headquartersAuthService.listTenants();
    const needle = query.toLowerCase();
    workspace =
      tenants.find(
        (t) =>
          String(t.loginId || '').toLowerCase() === needle ||
          String(t.companyId || '').toLowerCase() === needle ||
          String(t.tenantDbName || '').toLowerCase() === needle ||
          String(t.email || '').toLowerCase() === needle,
      ) || null;
  }
  return workspace;
}

async function resolvePortalCandidate({ email, candidateId, q }) {
  const query = String(q || '').trim();
  const emailLookup = normalizeEmail(email) || (query.includes('@') ? normalizeEmail(query) : '');
  const idLookup = String(candidateId || (!emailLookup && query ? query : '')).trim();
  if (!emailLookup && !idLookup) return null;

  const base = phase1ApiBase();
  const key = phase1InternalAdminKey();
  const headers = { 'Content-Type': 'application/json' };
  if (key) headers['x-internal-admin-key'] = key;

  try {
    const response = await fetch(`${base}/api/hq/candidate-lookup`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email: emailLookup || undefined,
        candidateId: idLookup || undefined,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.success || !payload?.data) return null;
    const data = payload.data;
    return {
      exists: true,
      accountKind: 'employee',
      candidateId: data.candidateId,
      email: normalizeEmail(data.email) || emailLookup || null,
      name: data.name || data.email || 'Candidate',
      status: data.status || null,
      isVerified: Boolean(data.isVerified),
      passwordGenerated: Boolean(data.passwordGenerated),
      hasLoggedInToPortal: Boolean(data.hasLoggedInToPortal),
      lastLoginAt: data.lastLoginAt || null,
      createdAt: data.createdAt || null,
      portalFrontendUrl: phase1FrontendBase(),
    };
  } catch (err) {
    console.warn('[hq-account-support] portal candidate lookup failed:', err?.message || err);
    return null;
  }
}

async function loadTenantLoginStatus(workspace) {
  const tenantDbName = String(workspace?.tenantDbName || '').trim();
  const email = normalizeEmail(workspace?.email);
  if (!tenantDbName) {
    return {
      crmUserExists: false,
      passwordGenerated: Boolean(String(workspace?.password || '').trim()),
      tempPasswordFlag: null,
      hasLoggedInToCrm: false,
      lastLoginAt: null,
      inviteSentAt: null,
      loginId: workspace?.loginId || email || null,
    };
  }

  try {
    return await runWithTenantContext(tenantDbName, async () => {
      const user =
        (email
          ? await prisma.user.findFirst({ where: { email } })
          : null) ||
        (await prisma.user.findFirst({
          where: { role: 'SUPER_ADMIN', isActive: true },
          orderBy: { createdAt: 'asc' },
        }));

      if (!user) {
        return {
          crmUserExists: false,
          passwordGenerated: Boolean(String(workspace?.password || '').trim()),
          tempPasswordFlag: null,
          hasLoggedInToCrm: false,
          lastLoginAt: null,
          inviteSentAt: null,
          loginId: workspace?.loginId || email || null,
        };
      }

      const credential = await prisma.userCredential.findUnique({
        where: { userId: user.id },
      });

      const lastLoginAt =
        (credential?.lastLoginAt && new Date(credential.lastLoginAt).toISOString()) ||
        (user.lastLogin && new Date(user.lastLogin).toISOString()) ||
        null;

      return {
        crmUserExists: true,
        passwordGenerated: Boolean(
          String(workspace?.password || '').trim() ||
            String(credential?.hashedPassword || '').trim() ||
            String(user.passwordHash || '').trim(),
        ),
        tempPasswordFlag: credential ? Boolean(credential.tempPasswordFlag) : null,
        hasLoggedInToCrm: Boolean(lastLoginAt),
        lastLoginAt,
        inviteSentAt: credential?.inviteSentAt
          ? new Date(credential.inviteSentAt).toISOString()
          : null,
        loginId: credential?.loginId || workspace?.loginId || email || null,
        userId: user.id,
      };
    });
  } catch (err) {
    console.warn('[hq-account-support] tenant login status failed:', err?.message || err);
    return {
      crmUserExists: false,
      passwordGenerated: Boolean(String(workspace?.password || '').trim()),
      tempPasswordFlag: null,
      hasLoggedInToCrm: false,
      lastLoginAt: null,
      inviteSentAt: null,
      loginId: workspace?.loginId || email || null,
      tenantStatusError: err?.message || 'Could not read CRM login status',
    };
  }
}

async function loadRelatedEmployerTickets(workspace) {
  const email = normalizeEmail(workspace?.email);
  const tenantDbName = String(workspace?.tenantDbName || '').trim();
  try {
    const { tickets } = await hqTicketsService.listTickets(
      tenantDbName ? { tenantDbName } : {},
    );
    return (tickets || [])
      .filter((ticket) => {
        const raised = normalizeEmail(ticket.raisedByEmail);
        const ticketTenant = String(ticket.tenantDbName || '').trim();
        if (email && raised === email) return true;
        if (tenantDbName && ticketTenant === tenantDbName) return true;
        return false;
      })
      .slice(0, 25)
      .map((ticket) => ({
        id: ticket.id,
        subject: ticket.subject,
        status: ticket.status,
        priority: ticket.priority,
        raisedByEmail: ticket.raisedByEmail,
        tenantDbName: ticket.tenantDbName,
        createdAt: ticket.createdAt,
        audience: 'employer',
      }));
  } catch (err) {
    console.warn('[hq-account-support] related employer tickets failed:', err?.message || err);
    return [];
  }
}

async function loadRelatedEmployeeTickets(employee) {
  const email = normalizeEmail(employee?.email);
  const candidateId = String(employee?.candidateId || '').trim();
  if (!email && !candidateId) return [];
  try {
    const { tickets } = await hqHelpTicketsService.listTickets({});
    return (tickets || [])
      .filter((ticket) => {
        const raised = normalizeEmail(ticket.email);
        const userId = String(ticket.userId || '').trim();
        if (email && raised === email) return true;
        if (candidateId && userId === candidateId) return true;
        return false;
      })
      .slice(0, 25)
      .map((ticket) => ({
        id: ticket.id,
        subject: ticket.subject,
        status: ticket.status,
        raisedByEmail: ticket.email,
        createdAt: ticket.createdAt,
        audience: 'employee',
      }));
  } catch (err) {
    console.warn('[hq-account-support] related employee tickets failed:', err?.message || err);
    return [];
  }
}

function mapEmployerResult(workspace, loginStatus, relatedTickets) {
  const tenantDbName = String(workspace.tenantDbName || '').trim();
  return {
    exists: true,
    accountKind: 'employer',
    email: normalizeEmail(workspace.email),
    loginId: loginStatus.loginId || workspace.loginId || workspace.email,
    name: workspace.name || null,
    organizationName: workspace.organizationName || null,
    customerId: workspace.companyId || tenantDbName || null,
    tenantDbName: tenantDbName || null,
    status: workspace.status || 'ACTIVE',
    signupSource: workspace.signupSource || null,
    createdAt: workspace.createdAt ? new Date(workspace.createdAt).toISOString() : null,
    accountExists: true,
    passwordGenerated: Boolean(loginStatus.passwordGenerated),
    tempPasswordPending: loginStatus.tempPasswordFlag === true,
    hasLoggedInToCrm: Boolean(loginStatus.hasLoggedInToCrm),
    lastLoginAt: loginStatus.lastLoginAt,
    inviteSentAt: loginStatus.inviteSentAt,
    crmUserExists: Boolean(loginStatus.crmUserExists),
    loginUrl: buildCrmLoginUrl(tenantDbName),
    relatedTickets,
    ticketCount: relatedTickets.length,
    tenantStatusError: loginStatus.tenantStatusError || null,
  };
}

export const hqAccountSupportService = {
  async lookup(query = {}) {
    const workspace = await resolveWorkspace(query);
    const employee = await resolvePortalCandidate(query);

    let employer = null;
    if (workspace) {
      const loginStatus = await loadTenantLoginStatus(workspace);
      const relatedTickets = await loadRelatedEmployerTickets(workspace);
      employer = mapEmployerResult(workspace, loginStatus, relatedTickets);
    }

    let employeeResult = employee;
    if (employeeResult) {
      const relatedTickets = await loadRelatedEmployeeTickets(employeeResult);
      employeeResult = {
        ...employeeResult,
        relatedTickets,
        ticketCount: relatedTickets.length,
      };
    }

    const exists = Boolean(employer || employeeResult);
    if (!exists) {
      return {
        exists: false,
        employer: null,
        employee: null,
        query: {
          email: normalizeEmail(query.email) || null,
          customerId: String(query.customerId || query.tenantDbName || query.q || '').trim() || null,
        },
      };
    }

    // Keep top-level employer fields for the original UI shape when employer exists.
    const top = employer
      ? { ...employer, exists: true, employer, employee: employeeResult }
      : {
          exists: true,
          accountKind: 'employee',
          email: employeeResult.email,
          name: employeeResult.name,
          accountExists: true,
          passwordGenerated: employeeResult.passwordGenerated,
          hasLoggedInToCrm: false,
          hasLoggedInToPortal: employeeResult.hasLoggedInToPortal,
          lastLoginAt: employeeResult.lastLoginAt,
          relatedTickets: employeeResult.relatedTickets,
          ticketCount: employeeResult.ticketCount,
          employer: null,
          employee: employeeResult,
        };

    return top;
  },

  async regeneratePassword({ email, customerId, tenantDbName, audit } = {}) {
    const workspace = await resolveWorkspace({ email, customerId, tenantDbName });
    if (!workspace) {
      throw Object.assign(new Error('Entrepreneur account not found for that email or customer ID'), {
        statusCode: 404,
      });
    }
    if (workspace.isDeleted) {
      throw new Error('Account is in recycle bin — restore it before regenerating password');
    }

    const resolvedEmail = normalizeEmail(workspace.email);
    const resolvedTenantDb = String(workspace.tenantDbName || '').trim();
    if (!resolvedEmail) throw new Error('Account has no email');
    if (!resolvedTenantDb) {
      throw new Error('Tenant database is not provisioned yet — finish provisioning first');
    }

    const password = generateTempPassword();
    const loginId = String(workspace.loginId || resolvedEmail).trim();

    await headquartersAuthService.updateWorkspacePasswordForEmail(resolvedEmail, password);
    await authService.updateHeadquartersAdminCredentials(
      { ...workspace, email: resolvedEmail, loginId, tenantDbName: resolvedTenantDb },
      password,
      audit,
    );

    let credentialEmailSent = false;
    let credentialEmailError = null;
    try {
      await sendCredentialInvite({
        email: resolvedEmail,
        loginId,
        tempPassword: password,
        roleName: 'Workspace Admin',
        inviteToken: password,
        tenantDbName: resolvedTenantDb,
        loginBaseUrl: buildCrmLoginUrl(resolvedTenantDb),
      });
      credentialEmailSent = true;

      try {
        await runWithTenantContext(resolvedTenantDb, async () => {
          const user = await prisma.user.findFirst({ where: { email: resolvedEmail } });
          if (!user) return;
          await prisma.userCredential.updateMany({
            where: { userId: user.id },
            data: { inviteSentAt: new Date(), tempPasswordFlag: true },
          });
        });
      } catch {
        // Non-fatal: invite email already sent.
      }
    } catch (err) {
      credentialEmailError = err?.message || 'Failed to send password email';
      console.warn('[hq-account-support] credential email failed:', credentialEmailError);
    }

    return {
      email: resolvedEmail,
      loginId,
      tenantDbName: resolvedTenantDb,
      customerId: workspace.companyId || resolvedTenantDb,
      credentialEmailSent,
      credentialEmailError,
      loginUrl: buildCrmLoginUrl(resolvedTenantDb),
      passwordEmailed: credentialEmailSent,
    };
  },

  /**
   * Hidden HQ tool: open entrepreneur CRM as that workspace admin (same as Users → Open account).
   */
  async impersonateEmployer({ email, customerId, tenantDbName } = {}, reqUser) {
    const workspace = await resolveWorkspace({ email, customerId, tenantDbName });
    if (!workspace?.email) {
      throw Object.assign(new Error('Entrepreneur account not found'), { statusCode: 404 });
    }
    // Reuse the existing HQ impersonation pipeline via hq.service caller.
    return {
      email: normalizeEmail(workspace.email),
      tenantDbName: String(workspace.tenantDbName || '').trim() || null,
      loginId: workspace.loginId || workspace.email,
      hqActorEmail: normalizeEmail(reqUser?.email),
    };
  },

  /**
   * Hidden HQ tool: open job-portal candidate / employee account.
   */
  async impersonateEmployee({ email, candidateId, q } = {}) {
    const employee = await resolvePortalCandidate({ email, candidateId, q });
    if (!employee?.candidateId) {
      throw Object.assign(new Error('Job portal candidate not found'), { statusCode: 404 });
    }

    const base = phase1ApiBase();
    const key = phase1InternalAdminKey();
    const headers = { 'Content-Type': 'application/json' };
    if (key) headers['x-internal-admin-key'] = key;

    const response = await fetch(`${base}/api/hq/impersonate-candidate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email: employee.email,
        candidateId: employee.candidateId,
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.success) {
      throw Object.assign(
        new Error(payload?.message || 'Could not create candidate login session'),
        { statusCode: response.status || 400 },
      );
    }

    const data = payload.data || {};
    const loginUrl =
      data.loginUrl ||
      `${phase1FrontendBase()}/candidate-dashboard#hqCandidateLogin=${encodeURIComponent(data.token || '')}`;

    return {
      candidateId: data.candidateId || employee.candidateId,
      email: data.email || employee.email,
      name: data.name || employee.name,
      loginUrl,
      token: data.token || null,
      expiresIn: data.expiresIn || '2h',
    };
  },
};
