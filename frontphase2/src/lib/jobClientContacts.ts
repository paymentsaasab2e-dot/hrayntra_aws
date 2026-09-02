import type { BackendClient, BackendContact } from './api';
import { formatDirectorDisplay } from '../constants/salutations';
import { dedupeVisibleContacts } from './clientContactDedupe';
import {
  mergeTeamMembersWithContacts,
  normalizeTeamMemberList,
  teamMemberHasAnyValue,
  teamMembersFromOtherDetails,
  type TeamMemberListItem,
} from './teamMemberFormDetails';

const CLIENT_TEAM_MEMBER_TAG = 'TEAM_MEMBER';
const SYNTHETIC_ID_PREFIX = 'job-synthetic:';

export type JobContactPersonRole = 'Director' | 'Team Member' | 'Contact';

export type JobContactPersonOption = {
  id: string;
  name: string;
  role: JobContactPersonRole;
};

function normalizeEmail(email?: string | null): string {
  return String(email || '').trim().toLowerCase();
}

function normalizePersonName(name?: string | null): string {
  return String(name || '')
    .replace(/^(mr|mrs|ms|dr|prof)\.?\s+/i, '')
    .trim()
    .toLowerCase();
}

function buildDirectorIdentity(
  contacts: BackendContact[],
  client?: BackendClient | null,
): { emails: Set<string>; names: Set<string>; contactIds: Set<string> } {
  const emails = new Set<string>();
  const names = new Set<string>();
  const contactIds = new Set<string>();

  for (const contact of contacts) {
    if (!isDirectorContact(contact)) continue;
    const id = String(contact.id || '').trim();
    if (id) contactIds.add(id);
    const email = normalizeEmail(contact.email);
    if (email) emails.add(email);
    for (const label of [
      directorDisplayName(contact, client),
      contactDisplayNameFromContact(contact),
      [contact.firstName, contact.lastName].filter(Boolean).join(' '),
      String(contact.designation || ''),
    ]) {
      const normalized = normalizePersonName(label);
      if (normalized) names.add(normalized);
    }
  }

  return { emails, names, contactIds };
}

function teamMemberMatchesDirector(
  member: TeamMemberListItem,
  directorIdentity: ReturnType<typeof buildDirectorIdentity>,
  client?: BackendClient | null,
  matchedContact?: BackendContact,
): boolean {
  const memberEmail = normalizeEmail(member.teamMemberEmail);
  if (memberEmail && directorIdentity.emails.has(memberEmail)) return true;

  if (matchedContact?.id && directorIdentity.contactIds.has(String(matchedContact.id))) {
    return true;
  }

  const memberLabels = [
    teamMemberDisplayName(member, matchedContact),
    member.teamMemberName,
    matchedContact ? contactDisplayNameFromContact(matchedContact) : '',
  ];
  for (const label of memberLabels) {
    const normalized = normalizePersonName(label);
    if (normalized && directorIdentity.names.has(normalized)) return true;
  }

  if (matchedContact) {
    const contactEmail = normalizeEmail(matchedContact.email);
    if (contactEmail && directorIdentity.emails.has(contactEmail)) return true;
    if (matchedContact.id && directorIdentity.contactIds.has(String(matchedContact.id))) {
      return true;
    }
  }

  return false;
}

function contactMatchesDirector(
  contact: BackendContact,
  directorIdentity: ReturnType<typeof buildDirectorIdentity>,
  client?: BackendClient | null,
): boolean {
  if (isDirectorContact(contact)) return true;
  const id = String(contact.id || '').trim();
  if (id && directorIdentity.contactIds.has(id)) return true;
  const email = normalizeEmail(contact.email);
  if (email && directorIdentity.emails.has(email)) return true;
  const normalized = normalizePersonName(contactDisplayNameFromContact(contact));
  return Boolean(normalized && directorIdentity.names.has(normalized));
}

export function isClientTeamMemberContact(contact: BackendContact): boolean {
  return (
    !contact.isPrimary &&
    (
      (Array.isArray(contact.tags) && contact.tags.includes(CLIENT_TEAM_MEMBER_TAG)) ||
      String(contact.notesText || '').includes('Team:')
    )
  );
}

function isDirectorContact(contact: BackendContact): boolean {
  if (isClientTeamMemberContact(contact)) return false;
  return (
    Boolean(contact.isPrimary) ||
    String(contact.designation || '').trim().toLowerCase() === 'director'
  );
}

function contactDisplayNameFromContact(contact: BackendContact): string {
  const parts = [contact.salutation, contact.firstName, contact.lastName]
    .map((part) => String(part || '').trim())
    .filter(Boolean);
  const joined = parts.join(' ').replace(/\s+/g, ' ').trim();
  if (joined && joined !== 'Team Member') return joined;
  const designation = String(contact.designation || '').trim();
  if (designation && designation !== 'Team Member') return designation;
  return joined || 'Contact';
}

function extractTeamMembersFromContacts(contacts: BackendContact[]): TeamMemberListItem[] {
  const members = contacts
    .filter(isClientTeamMemberContact)
    .map((contact) => {
      const joinedName = [contact.firstName, contact.lastName].filter(Boolean).join(' ').trim();
      const designation = String(contact.designation || '').trim();
      const looksLikeGeneratedName =
        /^Member\s+\d+$/i.test(String(contact.lastName || '').trim()) &&
        !String(contact.firstName || '').trim();

      let memberName = joinedName;
      if (looksLikeGeneratedName) {
        memberName = designation && designation !== 'Team Member' ? designation : joinedName || designation;
      } else if (!memberName || memberName === 'Team Member') {
        memberName = designation && designation !== 'Team Member' ? designation : memberName || designation || '';
      }

      return {
        id: contact.id,
        teamMemberSalutation: contact.salutation || '',
        teamMemberName: memberName,
        teamMemberDesignation: designation || memberName,
        teamMemberEmail: contact.email || '',
        teamMemberPhone: contact.phone || '',
      };
    });

  return normalizeTeamMemberList(members);
}

function directorDisplayName(contact: BackendContact, client?: BackendClient | null): string {
  let name = contactDisplayNameFromContact(contact);
  if (client?.directorSalutation && !String(contact.salutation || '').trim()) {
    const baseName = [contact.firstName, contact.lastName].filter(Boolean).join(' ').trim() || name;
    name = formatDirectorDisplay(client.directorSalutation, baseName) || name;
  }
  return name;
}

function teamMemberDisplayName(member: TeamMemberListItem, fallbackContact?: BackendContact): string {
  const fromMember =
    formatDirectorDisplay(member.teamMemberSalutation, member.teamMemberName) ||
    String(member.teamMemberName || '').trim();
  if (fromMember) return fromMember;
  return fallbackContact ? contactDisplayNameFromContact(fallbackContact) : '';
}

export function isSyntheticJobContactId(id: string): boolean {
  return id.startsWith(SYNTHETIC_ID_PREFIX);
}

/** Director first, then team members, then any other client contacts. */
export function buildJobContactPersonOptions(
  contacts: BackendContact[],
  client?: BackendClient | null,
): JobContactPersonOption[] {
  const uniqueContacts = dedupeVisibleContacts(contacts);
  const directors: JobContactPersonOption[] = [];
  const teamMembers: JobContactPersonOption[] = [];
  const others: JobContactPersonOption[] = [];
  const usedIds = new Set<string>();
  const directorIdentity = buildDirectorIdentity(uniqueContacts, client);

  for (const contact of uniqueContacts) {
    const id = String(contact.id || '').trim();
    if (!id || !isDirectorContact(contact)) continue;
    directors.push({
      id,
      name: directorDisplayName(contact, client),
      role: 'Director',
    });
    usedIds.add(id);
  }

  const teamContacts = uniqueContacts
    .filter(isClientTeamMemberContact)
    .filter((contact) => !contactMatchesDirector(contact, directorIdentity, client));

  const storedTeamMembers = (client ? teamMembersFromOtherDetails(client.otherDetails) : [])
    .filter((member) => !teamMemberMatchesDirector(member, directorIdentity, client));

  const mergedTeamMembers = mergeTeamMembersWithContacts(
    extractTeamMembersFromContacts(teamContacts),
    storedTeamMembers,
  );

  for (const member of mergedTeamMembers) {
    if (!teamMemberHasAnyValue(member)) continue;

    const email = normalizeEmail(member.teamMemberEmail);
    const matchedContact = teamContacts.find((contact) => {
      const contactId = String(contact.id || '');
      if (member.id && member.id === contactId) return true;
      return Boolean(email && normalizeEmail(contact.email) === email);
    });

    if (teamMemberMatchesDirector(member, directorIdentity, client, matchedContact)) continue;

    const name = teamMemberDisplayName(member, matchedContact);
    if (!name) continue;
    if (teamMemberMatchesDirector({ ...member, teamMemberName: name }, directorIdentity, client, matchedContact)) {
      continue;
    }

    if (matchedContact?.id) {
      const id = String(matchedContact.id);
      if (usedIds.has(id)) continue;
      teamMembers.push({ id, name, role: 'Team Member' });
      usedIds.add(id);
      continue;
    }

    const synthId = `${SYNTHETIC_ID_PREFIX}${email || normalizePersonName(name)}`;
    if (usedIds.has(synthId)) continue;
    teamMembers.push({ id: synthId, name, role: 'Team Member' });
    usedIds.add(synthId);
  }

  for (const contact of uniqueContacts) {
    const id = String(contact.id || '').trim();
    if (!id || usedIds.has(id)) continue;
    if (isDirectorContact(contact) || isClientTeamMemberContact(contact)) continue;
    others.push({
      id,
      name: contactDisplayNameFromContact(contact),
      role: 'Contact',
    });
    usedIds.add(id);
  }

  return [...directors, ...teamMembers, ...others];
}
