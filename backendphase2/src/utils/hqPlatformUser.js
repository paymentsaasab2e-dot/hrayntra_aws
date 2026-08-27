import { env } from '../config/env.js';

/**
 * HQ / platform operator identities must never appear in tenant CRM
 * “Assigned to” / team-member pickers.
 */

export function getPlatformProvisionEmails() {
  return String(env.HRAYNTRA_PLATFORM_PROVISION_EMAILS || 'admin@gmail.com')
    .split(',')
    .map((email) => String(email || '').trim().toLowerCase())
    .filter(Boolean);
}

export function isHqPlatformRoleName(roleName) {
  const n = String(roleName || '').trim().toLowerCase();
  if (!n) return false;
  if (n === 'hq_team' || n === 'hq-team') return true;
  return n.startsWith('hq ') || n.includes('hq platform') || n.includes('hq team');
}

/**
 * @param {object | null | undefined} user
 *   Accepts User rows, assignable members, or HQ workspace rows.
 */
export function isHqPlatformUser(user) {
  if (!user || typeof user !== 'object') return false;

  const email = String(user.email || '').trim().toLowerCase();
  const loginId = String(
    user.loginId || user.credential?.loginId || user.login_id || '',
  )
    .trim()
    .toLowerCase();
  const name = String(
    user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || '',
  )
    .trim()
    .toLowerCase();
  const roleName = String(
    user.systemRole?.roleName || user.role?.roleName || user.roleName || user.role || '',
  ).trim();

  const provisionEmails = getPlatformProvisionEmails();
  if (email && provisionEmails.includes(email)) return true;
  if (email === 'admin@gmail.com') return true;

  if (loginId === 'hq_admin' || loginId.startsWith('hq_')) return true;

  if (
    name === 'hq platform admin' ||
    name.includes('hq setup') ||
    name.includes('hq-setup') ||
    (name.includes('hq platform') && name.includes('admin'))
  ) {
    return true;
  }

  if (isHqPlatformRoleName(roleName)) return true;

  return false;
}

export function excludeHqPlatformUsers(users) {
  if (!Array.isArray(users)) return [];
  return users.filter((user) => !isHqPlatformUser(user));
}

/** Prisma `where` fragment to drop known HQ provision emails at query time. */
export function hqPlatformUserEmailNotClause() {
  const emails = getPlatformProvisionEmails();
  if (!emails.length) return {};
  return { email: { notIn: emails } };
}
