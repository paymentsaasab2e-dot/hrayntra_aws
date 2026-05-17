function trimNullable(value) {
  const normalized = value == null ? '' : String(value).trim();
  return normalized || null;
}

export function normalizeContactChannels(data = {}) {
  const emails = (Array.isArray(data.emails) ? data.emails : [])
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean);
  const phones = (Array.isArray(data.phones) ? data.phones : [])
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  const legacyEmail = trimNullable(data.email)?.toLowerCase();
  const legacyPhone = trimNullable(data.phone);
  const mergedEmails = emails.length ? [...new Set(emails)] : legacyEmail ? [legacyEmail] : [];
  const mergedPhones = phones.length ? [...new Set(phones)] : legacyPhone ? [legacyPhone] : [];
  return {
    emails: mergedEmails,
    phones: mergedPhones,
    email: mergedEmails[0] || legacyEmail || null,
    phone: mergedPhones[0] || legacyPhone || null,
  };
}
