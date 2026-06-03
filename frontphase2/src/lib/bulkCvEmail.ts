/**
 * Legacy bulk "create anyway" stored mailbox variants like jane@gmail.com+bulkcv@gmail.com.
 * Display and cleanup use the plain address before +bulkcv.
 */

export function stripBulkCvEmailSuffix(email: string | null | undefined): string {
  const raw = String(email || '').trim();
  if (!raw || !/\+bulkcv/i.test(raw)) return raw;
  const lower = raw.toLowerCase();
  const match = lower.match(/^([^+@]+)\+bulkcv[^@]*@(.+)$/i);
  if (!match) return raw;
  return `${match[1]}@${match[2]}`;
}

export function hasBulkCvEmailSuffix(email: string | null | undefined): boolean {
  return /\+bulkcv/i.test(String(email || ''));
}

/** Email for UI lists/drawers: plain address on +bulkcv copy rows only. */
export function displayCandidateEmail(email: string | null | undefined): string {
  return stripBulkCvEmailSuffix(email);
}

/** "Copy 1" from "Smith copy 1" or full name ending in copy N. */
export function parseBulkCopyLabel(
  lastNameOrFullName: string | null | undefined
): string | null {
  const m = String(lastNameOrFullName || '').match(/\bcopy\s+(\d+)\s*$/i);
  return m ? `Copy ${m[1]}` : null;
}
