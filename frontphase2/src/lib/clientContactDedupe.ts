import { isPlaceholderContactEmail, visibleContactEmail } from './contactEmail';

const GENERIC_NAMES = new Set(['unknown', 'contact', 'director', 'n/a', 'na', 'none', 'test']);

export function normalizeVisibleContactName(value?: string | null): string {
  return String(value || '')
    .replace(/^(mr|mrs|ms|dr|prof)\.?\s+/i, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function normalizeVisibleContactPhone(value?: string | null): string {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}

type DedupeableContact = {
  id: string;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  designation?: string | null;
  isPrimary?: boolean | null;
  companyId?: string | null;
  company?: { id?: string | null } | null;
};

function contactDisplayName(contact: DedupeableContact): string {
  const joined = [contact.firstName, contact.lastName].filter(Boolean).join(' ').trim();
  return joined || String(contact.name || '').trim();
}

function contactsLookLikeSamePerson(left: DedupeableContact, right: DedupeableContact): boolean {
  if (left.id && right.id && left.id === right.id) return true;

  const emailA = visibleContactEmail(left.email);
  const emailB = visibleContactEmail(right.email);
  if (emailA && emailB && emailA.toLowerCase() === emailB.toLowerCase()) return true;

  const nameA = normalizeVisibleContactName(contactDisplayName(left));
  const nameB = normalizeVisibleContactName(contactDisplayName(right));
  if (!nameA || !nameB || nameA !== nameB) return false;

  const phoneA = normalizeVisibleContactPhone(left.phone);
  const phoneB = normalizeVisibleContactPhone(right.phone);
  if (phoneA && phoneB && phoneA === phoneB) {
    if (emailA && emailB && emailA.toLowerCase() !== emailB.toLowerCase()) return false;
    return true;
  }

  if (GENERIC_NAMES.has(nameA)) return false;

  const bothDirectors =
    String(left.designation || '').trim().toLowerCase() === 'director' &&
    String(right.designation || '').trim().toLowerCase() === 'director';
  if (
    bothDirectors &&
    (isPlaceholderContactEmail(left.email) || isPlaceholderContactEmail(right.email)) &&
    (!phoneA || !phoneB || phoneA === phoneB)
  ) {
    return true;
  }

  return false;
}

function scoreVisibleContact(contact: DedupeableContact): number {
  let score = 0;
  if (visibleContactEmail(contact.email)) score += 8;
  if (contact.isPrimary) score += 4;
  if (String(contact.designation || '').trim().toLowerCase() === 'director') score += 2;
  if (normalizeVisibleContactPhone(contact.phone)) score += 1;
  return score;
}

/** Collapse repeated director/contact rows that were saved more than once for the same person. */
export function dedupeVisibleContacts<T extends DedupeableContact>(contacts: T[]): T[] {
  const result: T[] = [];

  for (const contact of contacts) {
    const existingIndex = result.findIndex((kept) => contactsLookLikeSamePerson(kept, contact));
    if (existingIndex < 0) {
      result.push(contact);
      continue;
    }

    const kept = result[existingIndex];
    result[existingIndex] = scoreVisibleContact(contact) > scoreVisibleContact(kept)
      ? {
          ...contact,
          email: visibleContactEmail(contact.email) || visibleContactEmail(kept.email),
          phone: contact.phone || kept.phone,
          designation: contact.designation && contact.designation !== 'Not specified'
            ? contact.designation
            : kept.designation,
          isPrimary: Boolean(contact.isPrimary || kept.isPrimary),
        }
      : {
          ...kept,
          email: visibleContactEmail(kept.email) || visibleContactEmail(contact.email),
          phone: kept.phone || contact.phone,
          designation: kept.designation && kept.designation !== 'Not specified'
            ? kept.designation
            : contact.designation,
          isPrimary: Boolean(kept.isPrimary || contact.isPrimary),
        };
  }

  return result;
}

export function dedupeContactsByCompany<T extends DedupeableContact>(contacts: T[]): T[] {
  const groups = new Map<string, T[]>();
  const unmatched: T[] = [];
  for (const contact of contacts) {
    const companyId = String(contact.companyId || contact.company?.id || '').trim();
    if (!companyId) {
      unmatched.push(contact);
      continue;
    }
    const list = groups.get(companyId) || [];
    list.push(contact);
    groups.set(companyId, list);
  }
  const out: T[] = [...dedupeVisibleContacts(unmatched)];
  for (const rows of groups.values()) {
    out.push(...dedupeVisibleContacts(rows));
  }
  return out;
}

export function dedupeContactsPayload<T>(payload: T): T {
  if (Array.isArray(payload)) {
    return dedupeContactsByCompany(payload as DedupeableContact[]) as T;
  }
  if (!payload || typeof payload !== 'object') return payload;
  const source = payload as Record<string, unknown>;
  const next: Record<string, unknown> = { ...source };
  if (Array.isArray(next.data)) next.data = dedupeContactsByCompany(next.data as DedupeableContact[]);
  else if (next.data && typeof next.data === 'object') {
    next.data = dedupeContactsPayload(next.data);
  }
  if (Array.isArray(next.items)) next.items = dedupeContactsByCompany(next.items as DedupeableContact[]);
  return next as T;
}
