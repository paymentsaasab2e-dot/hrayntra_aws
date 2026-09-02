/**
 * Contact.email is required and unique. When the UI omits email (e.g. team member
 * with only a name), generate a stable placeholder address scoped to the client
 * so a second save updates the same row instead of creating another contact.
 */
export function resolveContactCreateEmail(data = {}) {
  const normalized = String(data.email || '').trim().toLowerCase();
  if (normalized) return normalized;

  const companyId = data.companyId ? String(data.companyId) : 'no-company';
  const tags = Array.isArray(data.tags) ? data.tags : [];
  const isTeam = tags.includes('TEAM_MEMBER');
  const nameSlug =
    [data.firstName, data.lastName]
      .map((part) => String(part || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'))
      .filter(Boolean)
      .join('-') || 'contact';

  if (isTeam) {
    return `client-${companyId}-team-${nameSlug}@placeholder.local`;
  }

  return `client-${companyId}-director@placeholder.local`;
}
