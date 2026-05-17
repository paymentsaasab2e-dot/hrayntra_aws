/** Normalize multi-value email/phone lists with optional legacy single field. */
export function normalizeContactList(values?: string[] | null, fallback?: string | null): string[] {
  const fromArray = Array.isArray(values)
    ? values.map((value) => String(value || '').trim()).filter(Boolean)
    : [];
  const single = String(fallback || '').trim();
  const merged = fromArray.length > 0 ? fromArray : single ? [single] : [];
  return [...new Set(merged)];
}

export function primaryContactValue(list: string[]): string {
  return list[0] || '';
}

export function formatContactListDisplay(list?: string[] | null, fallback?: string | null): string {
  const items = normalizeContactList(list, fallback);
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  return `${items[0]} (+${items.length - 1} more)`;
}

export function ensureMinContactRows(list: string[], min = 1): string[] {
  const normalized = [...list];
  while (normalized.length < min) normalized.push('');
  return normalized;
}

/** Form rows: at least one empty row, prefilled from arrays or legacy single value. */
export function contactListForForm(list?: string[] | null, fallback?: string | null): string[] {
  return ensureMinContactRows(normalizeContactList(list, fallback), 1);
}

export function formatContactListMultiline(list?: string[] | null, fallback?: string | null): string {
  return normalizeContactList(list, fallback).join('\n');
}

/** API payload: normalized arrays plus legacy `email` / `phone` from index 0. */
export function buildContactChannelsFromForm(
  emails?: string[] | null,
  phones?: string[] | null,
  legacyEmail?: string | null,
  legacyPhone?: string | null,
) {
  const normalizedEmails = normalizeContactList(emails, legacyEmail).map((value) => value.toLowerCase());
  const normalizedPhones = normalizeContactList(phones, legacyPhone);
  return {
    email: normalizedEmails[0] || undefined,
    phone: normalizedPhones[0] || undefined,
    emails: normalizedEmails,
    phones: normalizedPhones,
  };
}
