import { Resend } from 'resend';
import { logger } from '../logger';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const RESEND_FROM_EMAIL = formatFromEmail(
  process.env.RESEND_FROM_EMAIL || 'HRMS Yantra <onboarding@resend.dev>'
);
const RESEND_TEMPLATE_AUTH_OTP = process.env.RESEND_TEMPLATE_AUTH_OTP || '';
const HRMS_APP_URL = process.env.HRMS_APP_URL || process.env.FRONTEND_URL || 'http://localhost:3000';

function formatFromEmail(raw: string) {
  const trimmed = raw.trim();
  if (trimmed.includes('<') && trimmed.includes('>')) return trimmed;
  return `HRMS Yantra <${trimmed}>`;
}

let resendClient: Resend | null = null;

function getClient(): Resend | null {
  if (!RESEND_API_KEY) return null;
  if (!resendClient) {
    resendClient = new Resend(RESEND_API_KEY);
  }
  return resendClient;
}

export function isResendConfigured() {
  return Boolean(RESEND_API_KEY);
}

/** Reserved for future login OTP flow (mobile / 2FA). */
export function isOtpTemplateConfigured() {
  return Boolean(RESEND_API_KEY && RESEND_TEMPLATE_AUTH_OTP);
}

export type WelcomeEmailPayload = {
  to: string;
  displayName: string;
  email: string;
  password: string;
  role: string;
  employeeId?: string | null;
};

function buildWelcomeHtml(payload: WelcomeEmailPayload) {
  const loginUrl = HRMS_APP_URL.replace(/\/$/, '');
  return `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1e293b;">
      <h2 style="color: #0f3d4c;">Welcome to HRMS Yantra</h2>
      <p>Hi ${payload.displayName},</p>
      <p>Your HRMS account has been created. Use the details below to sign in:</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr><td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold;">Login email</td><td style="padding: 8px; border: 1px solid #e2e8f0;">${payload.email}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold;">Password</td><td style="padding: 8px; border: 1px solid #e2e8f0;">${payload.password}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold;">Role</td><td style="padding: 8px; border: 1px solid #e2e8f0;">${payload.role}</td></tr>
        ${payload.employeeId ? `<tr><td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold;">Employee ID</td><td style="padding: 8px; border: 1px solid #e2e8f0;">${payload.employeeId}</td></tr>` : ''}
      </table>
      <p>
        <a href="${loginUrl}" style="display: inline-block; background: #7cb342; color: #0f3d4c; padding: 10px 18px; border-radius: 6px; text-decoration: none; font-weight: bold;">
          Open HRMS Login
        </a>
      </p>
      <p style="font-size: 12px; color: #64748b;">For security, change your password after first login. Do not share this email.</p>
    </div>
  `;
}

export type TenantAdminWelcomePayload = WelcomeEmailPayload & {
  tenantName: string;
};

function buildTenantAdminWelcomeHtml(payload: TenantAdminWelcomePayload) {
  const loginUrl = HRMS_APP_URL.replace(/\/$/, '');
  return `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1e293b;">
      <h2 style="color: #0f3d4c;">Welcome to HRMS Yantra</h2>
      <p>Hi ${payload.displayName},</p>
      <p>Your organization <strong>${payload.tenantName}</strong> has been provisioned on HRMS Yantra. Use the credentials below to sign in as tenant administrator:</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr><td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold;">Organization</td><td style="padding: 8px; border: 1px solid #e2e8f0;">${payload.tenantName}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold;">User ID</td><td style="padding: 8px; border: 1px solid #e2e8f0;">${payload.email}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold;">Password</td><td style="padding: 8px; border: 1px solid #e2e8f0;">${payload.password}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold;">Role</td><td style="padding: 8px; border: 1px solid #e2e8f0;">${payload.role}</td></tr>
      </table>
      <p>
        <a href="${loginUrl}" style="display: inline-block; background: #7cb342; color: #0f3d4c; padding: 10px 18px; border-radius: 6px; text-decoration: none; font-weight: bold;">
          Open HRMS Login
        </a>
      </p>
      <p style="font-size: 12px; color: #64748b;">For security, change your password after first login. Do not share this email.</p>
    </div>
  `;
}

export async function sendTenantAdminWelcomeEmail(payload: TenantAdminWelcomePayload) {
  const client = getClient();
  if (!client) {
    logger.warn('email.resend.skipped', { reason: 'RESEND_API_KEY not configured', context: 'tenant_admin' });
    return { sent: false, skipped: true, message: 'Email service not configured (missing RESEND_API_KEY)' };
  }

  try {
    const result = await client.emails.send({
      from: RESEND_FROM_EMAIL,
      to: [payload.to],
      subject: `Your ${payload.tenantName} HRMS admin account`,
      html: buildTenantAdminWelcomeHtml(payload),
      text: [
        `Welcome to HRMS Yantra, ${payload.displayName}.`,
        '',
        `Organization: ${payload.tenantName}`,
        `User ID: ${payload.email}`,
        `Password: ${payload.password}`,
        `Role: ${payload.role}`,
        '',
        `Login: ${HRMS_APP_URL}`,
      ].join('\n'),
    });

    if (result.error) {
      logger.error('email.resend.failed', { to: payload.to, context: 'tenant_admin', error: result.error.message });
      return { sent: false, skipped: false, message: result.error.message };
    }

    logger.info('email.resend.sent', { to: payload.to, context: 'tenant_admin', id: result.data?.id });
    return { sent: true, skipped: false, message: 'Tenant admin welcome email sent', id: result.data?.id };
  } catch (error: any) {
    logger.error('email.resend.exception', { to: payload.to, context: 'tenant_admin', error: error?.message });
    return { sent: false, skipped: false, message: error?.message || 'Failed to send email' };
  }
}

export async function sendWelcomeUserEmail(payload: WelcomeEmailPayload) {
  const client = getClient();
  if (!client) {
    logger.warn('email.resend.skipped', { reason: 'RESEND_API_KEY not configured' });
    return { sent: false, skipped: true, message: 'Email service not configured (missing RESEND_API_KEY)' };
  }

  try {
    const result = await client.emails.send({
      from: RESEND_FROM_EMAIL,
      to: [payload.to],
      subject: 'Your HRMS Yantra account details',
      html: buildWelcomeHtml(payload),
      text: [
        `Welcome to HRMS Yantra, ${payload.displayName}.`,
        '',
        `Login email: ${payload.email}`,
        `Password: ${payload.password}`,
        `Role: ${payload.role}`,
        payload.employeeId ? `Employee ID: ${payload.employeeId}` : '',
        '',
        `Login: ${HRMS_APP_URL}`,
      ].filter(Boolean).join('\n'),
    });

    if (result.error) {
      logger.error('email.resend.failed', { to: payload.to, error: result.error.message });
      return { sent: false, skipped: false, message: result.error.message };
    }

    logger.info('email.resend.sent', { to: payload.to, id: result.data?.id });
    return { sent: true, skipped: false, message: 'Welcome email sent', id: result.data?.id };
  } catch (error: any) {
    logger.error('email.resend.exception', { to: payload.to, error: error?.message });
    return { sent: false, skipped: false, message: error?.message || 'Failed to send email' };
  }
}
