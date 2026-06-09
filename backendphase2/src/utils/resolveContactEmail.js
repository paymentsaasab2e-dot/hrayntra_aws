import { randomUUID } from 'node:crypto';

/**
 * Contact.email is required and unique. When the UI omits email (e.g. team member
 * with only a name), generate a stable placeholder address scoped to the client.
 */
export function resolveContactCreateEmail(data = {}) {
  const normalized = String(data.email || '').trim().toLowerCase();
  if (normalized) return normalized;

  const companyId = data.companyId ? String(data.companyId) : 'no-company';
  const tags = Array.isArray(data.tags) ? data.tags : [];
  const roleTag = tags.includes('TEAM_MEMBER') ? 'team' : 'director';
  const nameSlug =
    [data.firstName, data.lastName]
      .map((part) => String(part || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'))
      .filter(Boolean)
      .join('-') || 'contact';

  return `client-${companyId}-${roleTag}-${nameSlug}-${randomUUID().slice(0, 8)}@placeholder.local`;
}
