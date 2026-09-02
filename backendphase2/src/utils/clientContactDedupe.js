import { prisma, getActiveTenantDbName } from '../config/prisma.js';

const TEAM_MEMBER_TAG = 'TEAM_MEMBER';
const GENERIC_NAMES = new Set(['unknown', 'contact', 'director', 'n/a', 'na', 'none', 'test']);

export function isPlaceholderContactEmail(email) {
  const value = String(email || '').trim().toLowerCase();
  return !value || value.endsWith('@placeholder.local');
}

export function normalizeContactPersonName(firstName, lastName) {
  return `${firstName || ''} ${lastName || ''}`
    .replace(/^(mr|mrs|ms|dr|prof)\.?\s+/i, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function normalizeContactPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}

function isTeamMemberContact(contact) {
  return Array.isArray(contact?.tags) && contact.tags.includes(TEAM_MEMBER_TAG);
}

function isDirectorLikeContact(contact) {
  if (isTeamMemberContact(contact)) return false;
  const designation = String(contact?.designation || '').trim().toLowerCase();
  return !designation || designation === 'director';
}

export function contactsAreSamePerson(left, right) {
  if (!left || !right) return false;
  if (left.id && right.id && String(left.id) === String(right.id)) return true;

  const emailA = String(left.email || '').trim().toLowerCase();
  const emailB = String(right.email || '').trim().toLowerCase();
  const aPlaceholder = isPlaceholderContactEmail(emailA);
  const bPlaceholder = isPlaceholderContactEmail(emailB);
  if (emailA && emailB && !aPlaceholder && !bPlaceholder && emailA === emailB) {
    return true;
  }

  const nameA = normalizeContactPersonName(left.firstName, left.lastName);
  const nameB = normalizeContactPersonName(right.firstName, right.lastName);
  if (!nameA || !nameB || nameA !== nameB) return false;

  const phoneA = normalizeContactPhone(left.phone);
  const phoneB = normalizeContactPhone(right.phone);
  if (phoneA && phoneB && phoneA === phoneB) {
    if (!aPlaceholder && !bPlaceholder && emailA && emailB && emailA !== emailB) {
      return false;
    }
    return true;
  }

  if (GENERIC_NAMES.has(nameA)) return false;

  const bothDirectors = isDirectorLikeContact(left) && isDirectorLikeContact(right);
  if (bothDirectors && (aPlaceholder || bPlaceholder) && (!phoneA || !phoneB || phoneA === phoneB)) {
    return true;
  }

  return false;
}

export function pickKeeperContact(group = []) {
  return [...group].sort((a, b) => {
    const aReal = isPlaceholderContactEmail(a.email) ? 0 : 1;
    const bReal = isPlaceholderContactEmail(b.email) ? 0 : 1;
    if (bReal !== aReal) return bReal - aReal;

    const aTeam = isTeamMemberContact(a) ? 0 : 1;
    const bTeam = isTeamMemberContact(b) ? 0 : 1;
    if (bTeam !== aTeam) return bTeam - aTeam;

    const aDirector = String(a.designation || '').trim().toLowerCase() === 'director' ? 1 : 0;
    const bDirector = String(b.designation || '').trim().toLowerCase() === 'director' ? 1 : 0;
    if (bDirector !== aDirector) return bDirector - aDirector;

    const aPhone = normalizeContactPhone(a.phone) ? 1 : 0;
    const bPhone = normalizeContactPhone(b.phone) ? 1 : 0;
    if (bPhone !== aPhone) return bPhone - aPhone;

    return new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime();
  })[0];
}

export async function findReusableCompanyContact(companyId, incoming = {}) {
  if (!companyId) return null;
  const contacts = await prisma.contact.findMany({ where: { companyId } });
  if (!contacts.length) return null;

  const incomingEmail = String(incoming.email || '').trim().toLowerCase();
  if (incomingEmail && !isPlaceholderContactEmail(incomingEmail)) {
    const byEmail = contacts.find(
      (contact) => String(contact.email || '').trim().toLowerCase() === incomingEmail,
    );
    if (byEmail) return byEmail;
  }

  return contacts.find((contact) => contactsAreSamePerson(contact, incoming)) || null;
}

const collapsingByCompany = new Map();

async function mergeExtrasIntoKeeper(keeper, extras) {
  const patch = {};

  if (isPlaceholderContactEmail(keeper.email)) {
    const real = extras.find((extra) => !isPlaceholderContactEmail(extra.email));
    if (real?.email) patch.email = String(real.email).trim().toLowerCase();
  }
  if (!keeper.phone) {
    const withPhone = extras.find((extra) => extra.phone);
    if (withPhone?.phone) patch.phone = withPhone.phone;
  }
  if (!keeper.salutation) {
    const withSalutation = extras.find((extra) => extra.salutation);
    if (withSalutation?.salutation) patch.salutation = withSalutation.salutation;
  }
  if (!keeper.designation || String(keeper.designation).trim().toLowerCase() === 'team member') {
    const withDesignation = extras.find((extra) => extra.designation && extra.designation !== 'Team Member');
    if (withDesignation?.designation) patch.designation = withDesignation.designation;
  }
  if (!keeper.department) {
    const withDepartment = extras.find((extra) => extra.department);
    if (withDepartment?.department) patch.department = withDepartment.department;
  }
  if (!keeper.location) {
    const withLocation = extras.find((extra) => extra.location);
    if (withLocation?.location) patch.location = withLocation.location;
  }
  if (!keeper.linkedinUrl) {
    const withLinkedin = extras.find((extra) => extra.linkedinUrl);
    if (withLinkedin?.linkedinUrl) patch.linkedinUrl = withLinkedin.linkedinUrl;
  }
  if (!keeper.ownerId) {
    const withOwner = extras.find((extra) => extra.ownerId);
    if (withOwner?.ownerId) patch.ownerId = withOwner.ownerId;
  }

  const tags = new Set([...(keeper.tags || [])]);
  const jobIds = new Set([...(keeper.associatedJobIds || [])]);
  for (const extra of extras) {
    (extra.tags || []).forEach((tag) => tags.add(tag));
    (extra.associatedJobIds || []).forEach((id) => jobIds.add(id));
  }
  if (String(patch.designation || keeper.designation || '').trim().toLowerCase() === 'director') {
    tags.delete(TEAM_MEMBER_TAG);
  }
  patch.tags = [...tags];
  patch.associatedJobIds = [...jobIds];

  if (patch.email && patch.email !== String(keeper.email || '').trim().toLowerCase()) {
    const donor = extras.find(
      (extra) => String(extra.email || '').trim().toLowerCase() === patch.email,
    );
    if (donor) {
      try {
        await prisma.contact.update({
          where: { id: donor.id },
          data: { email: `merged-retired-${donor.id}@placeholder.local` },
        });
      } catch {
        /* already merged by a parallel request */
      }
    }
  }

  try {
    await prisma.contact.update({
      where: { id: keeper.id },
      data: patch,
    });
  } catch (error) {
    const gone =
      error?.code === 'P2025' ||
      String(error?.message || '').toLowerCase().includes('not found');
    if (!gone) throw error;
    return;
  }

  for (const extra of extras) {
    try {
      await prisma.contactNote.updateMany({
        where: { contactId: extra.id },
        data: { contactId: keeper.id },
      });
      await prisma.contactActivity.updateMany({
        where: { contactId: extra.id },
        data: { contactId: keeper.id },
      });
      await prisma.contactCommunication.updateMany({
        where: { contactId: extra.id },
        data: { contactId: keeper.id },
      });
      await prisma.contact.delete({ where: { id: extra.id } });
    } catch (error) {
      const gone =
        error?.code === 'P2025' ||
        String(error?.message || '').toLowerCase().includes('not found') ||
        String(error?.message || '').toLowerCase().includes('record to delete does not exist');
      if (!gone) throw error;
    }
  }
}

export async function collapseDuplicateContactsForCompany(companyId) {
  if (!companyId) return 0;
  const pending = collapsingByCompany.get(companyId);
  if (pending) return pending;

  const run = (async () => {
    const contacts = await prisma.contact.findMany({ where: { companyId } });
    if (contacts.length < 2) return 0;

    const used = new Set();
    let merged = 0;

    for (let index = 0; index < contacts.length; index += 1) {
      const current = contacts[index];
      if (used.has(current.id)) continue;

      const group = [current];
      for (let nextIndex = index + 1; nextIndex < contacts.length; nextIndex += 1) {
        const candidate = contacts[nextIndex];
        if (used.has(candidate.id)) continue;
        if (group.some((member) => contactsAreSamePerson(member, candidate))) {
          group.push(candidate);
        }
      }

      if (group.length < 2) continue;

      const keeper = pickKeeperContact(group);
      const extras = group.filter((contact) => contact.id !== keeper.id);
      await mergeExtrasIntoKeeper(keeper, extras);
      extras.forEach((extra) => used.add(extra.id));
      used.add(keeper.id);
      merged += extras.length;
    }

    return merged;
  })().finally(() => {
    collapsingByCompany.delete(companyId);
  });

  collapsingByCompany.set(companyId, run);
  return run;
}

const collapsedContactTenants = new Set();

export async function collapseDuplicateContactsForAllCompanies() {
  const tenant = String(getActiveTenantDbName() || 'default').trim();
  const key = `${tenant}:contacts-all-v1`;
  if (collapsedContactTenants.has(key)) return 0;

  const rows = await prisma.contact.findMany({ select: { companyId: true } });
  const companyIds = [...new Set(rows.map((row) => String(row.companyId || '').trim()).filter(Boolean))];
  let merged = 0;
  for (const companyId of companyIds) {
    merged += Number(await collapseDuplicateContactsForCompany(companyId)) || 0;
  }
  collapsedContactTenants.add(key);
  return merged;
}
