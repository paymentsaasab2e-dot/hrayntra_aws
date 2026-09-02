'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { apiFetch } from '../../lib/api';
import type { BillingSettingsSnapshot } from '../../types/recruitmentInvoice';
import { InvoiceTemplateSettingsPanel } from '../billing/InvoiceTemplateSettingsPanel';
import { normalizeInvoiceTemplates } from '../../lib/invoiceTemplates';

const EMPTY: BillingSettingsSnapshot = {
  invoicePrefix: 'INV',
  defaultCurrency: 'USD',
  defaultPaymentTerms: 'Net 30 Days',
  bankName: '',
  accountNumber: '',
  swiftCode: '',
  taxLabel: 'Tax',
  taxRate: 0,
  companyName: '',
  showLogo: true,
  showStamp: true,
  showSignature: true,
  invoiceTemplateStyle: 'saasa',
  invoiceTemplates: [],
  activeInvoiceTemplateId: null,
  defaultTermsAndConditions:
    '1. Payment to be made within 30 days from DOJ.\n2. Payment to be made through bank transfer only.',
};

export function InvoiceTemplateSettings() {
  const [settings, setSettings] = useState<BillingSettingsSnapshot>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiFetch<BillingSettingsSnapshot>('/billing/settings', { auth: true });
        if (!cancelled && res.data) {
          setSettings(normalizeInvoiceTemplates({ ...EMPTY, ...res.data }));
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to load invoice template');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      setLoading(false);
    };
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const payload = normalizeInvoiceTemplates(settings);
      const res = await apiFetch<BillingSettingsSnapshot>('/billing/settings', {
        auth: true,
        method: 'PUT',
        body: payload,
      });
      if (res.data) setSettings(normalizeInvoiceTemplates({ ...EMPTY, ...res.data }));
      toast.success('Invoice templates saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-500">Loading invoice templates…</p>;
  }

  return (
    <div className="space-y-3 pb-2">
      <div className="rounded-xl border border-sky-100 bg-sky-50/80 px-4 py-2.5 text-sm text-sky-950">
        Create named templates (logo, stamp, firm text, extra columns). When you generate an invoice,
        choose which saved template to use. Bank defaults also live under{' '}
        <Link href="/billing?tab=billing-settings" className="font-semibold underline">
          Billing → Billing Settings
        </Link>
        . Use <span className="font-semibold">Save</span> at the bottom of the left panel — it stays
        visible while you scroll.
      </div>

      <InvoiceTemplateSettingsPanel
        settings={settings}
        onChange={setSettings}
        persistAction={{
          label: 'Save',
          savingLabel: 'Saving…',
          onSave: save,
          saving,
        }}
      />
    </div>
  );
}
