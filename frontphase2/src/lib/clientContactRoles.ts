import type { BackendContact } from './api';

const CLIENT_TEAM_MEMBER_TAG = 'TEAM_MEMBER';

export function isClientTeamMemberContact(contact: BackendContact): boolean {
  return (
    !contact.isPrimary &&
    (
      (Array.isArray(contact.tags) && contact.tags.includes(CLIENT_TEAM_MEMBER_TAG)) ||
      String(contact.notesText || '').includes('Team:')
    )
  );
}

export function isDirectorBackendContact(contact: BackendContact): boolean {
  if (isClientTeamMemberContact(contact)) return false;
  return (
    Boolean(contact.isPrimary) ||
    String(contact.designation || '').trim().toLowerCase() === 'director'
  );
}

/** Primary director contact — never a tagged team-member row. */
export function resolveDirectorBackendContact(
  contacts: BackendContact[],
): BackendContact | null {
  const eligible = contacts.filter((contact) => !isClientTeamMemberContact(contact));
  return (
    eligible.find((contact) => contact.isPrimary && isDirectorBackendContact(contact)) ||
    eligible.find((contact) => String(contact.designation || '').trim().toLowerCase() === 'director') ||
    eligible.find((contact) => contact.isPrimary) ||
    eligible[0] ||
    null
  );
}

export function directorNameFromContact(contact: BackendContact | null | undefined): string {
  if (!contact) return '';
  return [contact.firstName, contact.lastName].filter(Boolean).join(' ').trim();
}
