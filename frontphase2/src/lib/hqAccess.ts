/**
 * Headquarters Console (`/hq`) — platform operators and provisioned HQ team members.
 * Platform operator allowlist must stay in sync with backend `HRAYNTRA_PLATFORM_PROVISION_EMAILS`.
 */

export const HQ_PLATFORM_EMAIL = 'admin@gmail.com';

/** @deprecated Use HQ_PLATFORM_EMAIL */
export const DEFAULT_HQ_PLATFORM_EMAIL = HQ_PLATFORM_EMAIL;

export function parseHqAllowedEmails(): string[] {
  const raw = process.env.NEXT_PUBLIC_HQ_ALLOWED_EMAILS?.trim();
  if (raw) {
    return raw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  }
  return [HQ_PLATFORM_EMAIL.toLowerCase()];
}

export function isHqTeamMemberSession(email?: string | null): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.localStorage.getItem('currentUser');
    if (!raw) return false;
    const u = JSON.parse(raw) as { email?: string; hqTeamMemberId?: string; isHqTeamMember?: boolean };
    if (!u?.hqTeamMemberId && !u?.isHqTeamMember) return false;
    const sessionEmail = String(u?.email || '').trim().toLowerCase();
    if (email && sessionEmail !== String(email).trim().toLowerCase()) return false;
    return true;
  } catch {
    return false;
  }
}

export function isEmailAllowedForHq(email: string | undefined | null): boolean {
  const e = String(email || '').trim().toLowerCase();
  if (!e) return false;
  if (parseHqAllowedEmails().includes(e)) return true;
  return isHqTeamMemberSession(e);
}

export function isHqPlatformLoginEmail(email: string | undefined | null): boolean {
  return String(email || '').trim().toLowerCase() === HQ_PLATFORM_EMAIL.toLowerCase();
}
