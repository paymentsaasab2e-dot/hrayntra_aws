import type { BackendClient, BackendContact, CreateContactData, UpdateClientData } from './api';
import { directorFromOtherDetails } from './clientDirectorDetails';
import { directorNameFromContact, resolveDirectorBackendContact } from './clientContactRoles';
import { formatDateDMY } from '../utils/dateDisplay';
import { visibleContactEmail } from './contactEmail';

export interface SubmitToClientClientContactForm {
  id: string;
  firstName: string;
  lastName: string;
  designation: string;
  department: string;
  email: string;
  phone: string;
  lastContacted: string;
}

/** Mirrors the Client drawer's "Client Information" overview fields. */
export interface SubmitToClientClientFormState {
  /** Id of the primary director contact (for persisting name/email/phone edits). */
  directorContactId: string;
  companyName: string;
  /** One link per line — first non-LinkedIn link becomes `website`, LinkedIn link becomes `linkedin`. */
  companyLinks: string;
  directorName: string;
  directorEmail: string;
  directorPhone: string;
  location: string;
  city: string;
  state: string;
  country: string;
  timezone: string;
  industry: string;
  /** Client status label (Active / On Hold / …) — stored on Client.leadStatus. */
  leadStatus: string;
  /** Interest level, stored on Client.priority. */
  priority: string;
  servicesNeeded: string;
  expectedBusinessValue: string;
}

export const emptySubmitToClientClientForm = (): SubmitToClientClientFormState => ({
  directorContactId: '',
  companyName: '',
  companyLinks: '',
  directorName: '',
  directorEmail: '',
  directorPhone: '',
  location: '',
  city: '',
  state: '',
  country: '',
  timezone: '',
  industry: '',
  leadStatus: '',
  priority: '',
  servicesNeeded: '',
  expectedBusinessValue: '',
});

function isLinkedInCompanyUrl(url: string): boolean {
  return /linkedin\.com/i.test(String(url || '').trim());
}

function splitLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function resolveCityStateCountry(source: {
  city?: string | null;
  state?: string | null;
  country?: string | null;
  hiringLocations?: string | null;
  location?: string | null;
}): { city: string; state: string; country: string } {
  const city = String(source.city || '').trim();
  const state = String(source.state || '').trim();
  const country = String(source.country || '').trim();
  if (city || state || country) {
    return { city, state, country };
  }
  const locationSource = String(source.hiringLocations || source.location || '').trim();
  const parts = locationSource.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 3) return { city: parts[0], state: parts[1], country: parts[parts.length - 1] };
  if (parts.length === 2) return { city: parts[0], state: '', country: parts[1] };
  if (parts.length === 1) return { city: parts[0], state: '', country: '' };
  return { city: '', state: '', country: '' };
}

function cleanContactEmail(email?: string | null): string {
  return visibleContactEmail(email);
}

export function clientToSubmitForm(
  client: BackendClient,
  contacts: BackendContact[] = [],
): SubmitToClientClientFormState {
  const links = [client.website, client.linkedin]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  const director = resolveDirectorBackendContact(contacts);
  const storedDirector = directorFromOtherDetails(client.otherDetails);
  const locationFields = resolveCityStateCountry(client);

  const directorEmail =
    cleanContactEmail(director?.email) ||
    (client.emails || []).map((value) => String(value || '').trim()).find(Boolean) ||
    cleanContactEmail(client.teamMemberEmail) ||
    '';
  const directorPhone =
    String(director?.phone || '').trim() ||
    (client.phones || []).map((value) => String(value || '').trim()).find(Boolean) ||
    String(client.teamMemberPhone || '').trim() ||
    '';

  return {
    directorContactId: director?.id || '',
    companyName: client.companyName || '',
    companyLinks: links.join('\n'),
    directorName: directorNameFromContact(director) || storedDirector.directorName || '',
    directorEmail,
    directorPhone,
    location: client.location || '',
    city: locationFields.city,
    state: locationFields.state,
    country: locationFields.country,
    timezone: client.timezone || '',
    industry: client.industry || '',
    leadStatus: client.leadStatus || '',
    priority: client.priority || '',
    servicesNeeded: client.servicesNeeded || '',
    expectedBusinessValue: client.expectedBusinessValue || '',
  };
}

export function contactsToSubmitForm(
  contacts: BackendContact[] | BackendClient['contacts'],
): SubmitToClientClientContactForm[] {
  return (contacts || []).map((contact) => ({
    id: contact.id,
    firstName: contact.firstName || '',
    lastName: contact.lastName || '',
    designation: contact.designation || '',
    department: contact.department || '',
    email: contact.email || '',
    phone: contact.phone || '',
    lastContacted: contact.lastContacted ? formatDateDMY(contact.lastContacted) : '',
  }));
}

export function submitFormToUpdatePayload(form: SubmitToClientClientFormState): UpdateClientData {
  const links = splitLines(form.companyLinks);
  const linkedin = links.find(isLinkedInCompanyUrl);
  const website = links.find((link) => !isLinkedInCompanyUrl(link)) || links[0];

  return {
    companyName: form.companyName.trim(),
    website: website || undefined,
    linkedin: linkedin || undefined,
    location: form.location.trim() || undefined,
    city: form.city.trim() || undefined,
    state: form.state.trim() || undefined,
    country: form.country.trim() || undefined,
    timezone: form.timezone.trim() || undefined,
    industry: form.industry.trim() || undefined,
    leadStatus: form.leadStatus.trim() || undefined,
    priority: form.priority.trim() || undefined,
    servicesNeeded: form.servicesNeeded.trim() || undefined,
    expectedBusinessValue: form.expectedBusinessValue.trim() || undefined,
    emails: form.directorEmail.trim() ? [form.directorEmail.trim()] : undefined,
    phones: form.directorPhone.trim() ? [form.directorPhone.trim()] : undefined,
  };
}

/** Patch for the primary director contact so name/email/phone edits persist on the contact row. */
export function submitFormToDirectorContactPatch(
  form: SubmitToClientClientFormState,
): Partial<CreateContactData> | null {
  const name = form.directorName.trim();
  const email = form.directorEmail.trim();
  const phone = form.directorPhone.trim();
  if (!name && !email && !phone) return null;
  const [firstName = '', ...lastParts] = name.split(/\s+/).filter(Boolean);
  const patch: Partial<CreateContactData> = {};
  if (name) {
    patch.firstName = firstName;
    patch.lastName = lastParts.join(' ');
  }
  if (email) patch.email = email;
  if (phone) patch.phone = phone;
  return patch;
}
