/** Synthetic address stored when Contact.email is required/unique but the user left email blank. */
export function isPlaceholderContactEmail(email?: string | null): boolean {
  const value = String(email || '').trim().toLowerCase();
  if (!value) return true;
  return value.endsWith('@placeholder.local');
}

/** Real email for UI. Placeholder addresses are shown as empty. */
export function visibleContactEmail(email?: string | null, fallback = ''): string {
  if (isPlaceholderContactEmail(email)) return fallback;
  return String(email).trim();
}

const PREFERRED_CHANNELS = new Set(['email', 'phone', 'whatsapp']);

/** Preferred channel for UI. Junk / encoding garbage is treated as empty. */
export function visiblePreferredChannel(value?: string | null, fallback = ''): string {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  if (PREFERRED_CHANNELS.has(raw.toLowerCase())) return raw;
  return fallback;
}
