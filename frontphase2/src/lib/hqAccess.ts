/**
 * Headquarters Console (`/hq`) — only platform operators in this allowlist may open the UI.
 * Must stay in sync with backend `HRAYNTRA_PLATFORM_PROVISION_EMAILS`.
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

export function isEmailAllowedForHq(email: string | undefined | null): boolean {
  const e = String(email || '').trim().toLowerCase();
  if (!e) return false;
  return parseHqAllowedEmails().includes(e);
}

export function isHqPlatformLoginEmail(email: string | undefined | null): boolean {
  return String(email || '').trim().toLowerCase() === HQ_PLATFORM_EMAIL.toLowerCase();
}
