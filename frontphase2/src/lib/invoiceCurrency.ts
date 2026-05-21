import type { BillingSettingsSnapshot } from '../types/recruitmentInvoice';
import type { Placement } from '../types/placement';
import { getCachedOrgDefaultCurrency } from './api';

/** Org default — same source as Billing page (`getCachedOrgDefaultCurrency`). */
export function resolveOrgDefaultCurrency(settings?: BillingSettingsSnapshot | null): string {
  return (getCachedOrgDefaultCurrency() || settings?.defaultCurrency || 'USD').toUpperCase();
}

type ClientEmailSource = {
  email?: string | null;
  emails?: string[] | null;
  teamMemberEmail?: string | null;
  contacts?: Array<{ email?: string | null; contactType?: string | null }> | null;
} | null;

function isUsableBillingEmail(value: unknown): boolean {
  const email = String(value || '').trim();
  if (!email) return false;
  if (email.includes('@placeholder.local')) return false;
  return true;
}

/** Primary client email for invoice "Bill to" (Client form + Contact records). */
export function resolveClientEmail(client?: ClientEmailSource): string {
  if (!client) return '';

  const fromEmails = (Array.isArray(client.emails) ? client.emails : [])
    .map((e) => String(e || '').trim())
    .filter(isUsableBillingEmail);

  const contacts = Array.isArray(client.contacts) ? client.contacts : [];
  const primaryContactEmails = contacts
    .filter((c) => String(c?.contactType || '').toUpperCase() === 'PRIMARY')
    .map((c) => String(c?.email || '').trim())
    .filter(isUsableBillingEmail);
  const otherContactEmails = contacts
    .filter((c) => String(c?.contactType || '').toUpperCase() !== 'PRIMARY')
    .map((c) => String(c?.email || '').trim())
    .filter(isUsableBillingEmail);

  const candidates = [
    ...fromEmails,
    String(client.email || '').trim(),
    String(client.teamMemberEmail || '').trim(),
    ...primaryContactEmails,
    ...otherContactEmails,
  ];

  return candidates.find(isUsableBillingEmail) || '';
}

export function resolvePlacementInvoiceCurrency(
  placement?: Placement | null,
  settings?: BillingSettingsSnapshot | null,
): string {
  const fromBilling = placement?.billingRecords?.[0]?.currency;
  if (fromBilling && String(fromBilling).length === 3) {
    return String(fromBilling).toUpperCase();
  }
  return resolveOrgDefaultCurrency(settings);
}
