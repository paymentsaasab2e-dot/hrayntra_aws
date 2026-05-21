/**
 * Resolve billing email for invoices from Client record + linked Contact rows.
 * Matches data entered on the Client form (emails[], teamMemberEmail) and Contact directory.
 */

function isUsableBillingEmail(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return false;
  if (trimmed.includes('@placeholder.local')) return false;
  return true;
}

function firstNonEmpty(values = []) {
  for (const value of values) {
    const trimmed = String(value || '').trim();
    if (isUsableBillingEmail(trimmed)) return trimmed;
  }
  return '';
}

export function resolveClientBillingEmail(client, contacts = []) {
  if (!client && (!contacts || contacts.length === 0)) return '';

  const fromEmails = Array.isArray(client?.emails)
    ? client.emails.map((e) => String(e || '').trim()).filter(Boolean)
    : [];

  const contactEmails = (Array.isArray(contacts) ? contacts : [])
    .map((c) => String(c?.email || '').trim())
    .filter(Boolean);

  return firstNonEmpty([
    ...fromEmails,
    client?.teamMemberEmail,
    ...contactEmails,
  ]);
}

/** Prisma client select fragment for placement/job includes. */
export const clientBillingEmailSelect = {
  id: true,
  companyName: true,
  emails: true,
  teamMemberEmail: true,
  contacts: {
    where: { status: 'ACTIVE' },
    orderBy: { updatedAt: 'desc' },
    take: 10,
    select: { email: true, contactType: true },
  },
};
