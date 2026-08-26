import type {
  BillingSettingsSnapshot,
  InvoiceCustomColumn,
  InvoiceLineItem,
  InvoiceTemplate,
  InvoiceTemplateBranding,
} from '../types/recruitmentInvoice';

const BRANDING_KEYS: (keyof InvoiceTemplateBranding)[] = [
  'companyName',
  'accountHolderName',
  'iban',
  'bankAddress',
  'bankName',
  'accountNumber',
  'swiftCode',
  'authorizedSignatoryName',
  'authorizedSignatoryDesignation',
  'agencySignatureUrl',
  'agencyLogoUrl',
  'agencyStampUrl',
  'companyTagline',
  'companyLocationLine',
  'companyFooterLine',
  'companyWebsite',
  'showLogo',
  'showStamp',
  'showSignature',
  'defaultTermsAndConditions',
  'invoiceTemplateStyle',
  'invoicePrefix',
  'defaultCurrency',
  'defaultPaymentTerms',
  'taxLabel',
  'taxRate',
  'customColumns',
];

export function newTemplateId() {
  return `tpl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function newColumnId() {
  return `col_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function brandingFromSettings(settings: BillingSettingsSnapshot): InvoiceTemplateBranding {
  const out: InvoiceTemplateBranding = {};
  for (const key of BRANDING_KEYS) {
    if (key === 'customColumns') continue;
    const value = settings[key as keyof BillingSettingsSnapshot];
    if (value !== undefined) (out as Record<string, unknown>)[key] = value;
  }
  return out;
}

export function settingsFromTemplate(
  base: BillingSettingsSnapshot,
  template: InvoiceTemplate | null | undefined,
): BillingSettingsSnapshot {
  if (!template) return base;
  return {
    ...base,
    ...brandingFromSettings(template as BillingSettingsSnapshot),
    companyName: template.companyName ?? base.companyName,
    accountHolderName: template.accountHolderName ?? base.accountHolderName,
    iban: template.iban ?? base.iban,
    bankAddress: template.bankAddress ?? base.bankAddress,
    bankName: template.bankName ?? base.bankName,
    accountNumber: template.accountNumber ?? base.accountNumber,
    swiftCode: template.swiftCode ?? base.swiftCode,
    authorizedSignatoryName: template.authorizedSignatoryName ?? base.authorizedSignatoryName,
    authorizedSignatoryDesignation:
      template.authorizedSignatoryDesignation ?? base.authorizedSignatoryDesignation,
    agencySignatureUrl: template.agencySignatureUrl ?? base.agencySignatureUrl,
    agencyLogoUrl: template.agencyLogoUrl ?? base.agencyLogoUrl,
    agencyStampUrl: template.agencyStampUrl ?? base.agencyStampUrl,
    companyTagline: template.companyTagline ?? base.companyTagline,
    companyLocationLine: template.companyLocationLine ?? base.companyLocationLine,
    companyFooterLine: template.companyFooterLine ?? base.companyFooterLine,
    companyWebsite: template.companyWebsite ?? base.companyWebsite,
    showLogo: template.showLogo ?? base.showLogo,
    showStamp: template.showStamp ?? base.showStamp,
    showSignature: template.showSignature ?? base.showSignature,
    defaultTermsAndConditions:
      template.defaultTermsAndConditions ?? base.defaultTermsAndConditions,
    invoiceTemplateStyle: template.invoiceTemplateStyle ?? base.invoiceTemplateStyle,
    invoicePrefix: template.invoicePrefix ?? base.invoicePrefix,
    defaultCurrency: template.defaultCurrency ?? base.defaultCurrency,
    defaultPaymentTerms: template.defaultPaymentTerms ?? base.defaultPaymentTerms,
    taxLabel: template.taxLabel ?? base.taxLabel,
    taxRate: template.taxRate ?? base.taxRate,
    activeInvoiceTemplateId: template.id,
    invoiceTemplates: base.invoiceTemplates,
  };
}

export function createBlankTemplate(
  name: string,
  from?: BillingSettingsSnapshot | InvoiceTemplateBranding,
): InvoiceTemplate {
  const branding = from ? brandingFromSettings(from as BillingSettingsSnapshot) : {};
  return {
    id: newTemplateId(),
    name: name.trim() || 'Untitled template',
    ...branding,
    customColumns: Array.isArray((from as InvoiceTemplate)?.customColumns)
      ? [...((from as InvoiceTemplate).customColumns || [])]
      : [],
    updatedAt: new Date().toISOString(),
  };
}

/** Ensure settings always expose at least one named template built from current branding. */
export function normalizeInvoiceTemplates(settings: BillingSettingsSnapshot): BillingSettingsSnapshot {
  const existing = Array.isArray(settings.invoiceTemplates) ? settings.invoiceTemplates : [];
  if (existing.length) {
    const activeId =
      settings.activeInvoiceTemplateId &&
      existing.some((t) => t.id === settings.activeInvoiceTemplateId)
        ? settings.activeInvoiceTemplateId
        : existing[0].id;
    return { ...settings, invoiceTemplates: existing, activeInvoiceTemplateId: activeId };
  }
  const seeded = createBlankTemplate(settings.companyName || 'Default template', settings);
  return {
    ...settings,
    invoiceTemplates: [seeded],
    activeInvoiceTemplateId: seeded.id,
  };
}

export function getActiveTemplate(settings: BillingSettingsSnapshot): InvoiceTemplate | null {
  const normalized = normalizeInvoiceTemplates(settings);
  return (
    normalized.invoiceTemplates?.find((t) => t.id === normalized.activeInvoiceTemplateId) ||
    normalized.invoiceTemplates?.[0] ||
    null
  );
}

export function upsertTemplate(
  settings: BillingSettingsSnapshot,
  template: InvoiceTemplate,
): BillingSettingsSnapshot {
  const normalized = normalizeInvoiceTemplates(settings);
  const list = [...(normalized.invoiceTemplates || [])];
  const idx = list.findIndex((t) => t.id === template.id);
  const next = { ...template, updatedAt: new Date().toISOString() };
  if (idx >= 0) list[idx] = next;
  else list.push(next);
  return {
    ...normalized,
    ...settingsFromTemplate(normalized, next),
    invoiceTemplates: list,
    activeInvoiceTemplateId: next.id,
  };
}

export function deleteTemplate(
  settings: BillingSettingsSnapshot,
  templateId: string,
): BillingSettingsSnapshot {
  const normalized = normalizeInvoiceTemplates(settings);
  const list = (normalized.invoiceTemplates || []).filter((t) => t.id !== templateId);
  if (!list.length) {
    const seeded = createBlankTemplate('Default template', normalized);
    return {
      ...normalized,
      ...settingsFromTemplate(normalized, seeded),
      invoiceTemplates: [seeded],
      activeInvoiceTemplateId: seeded.id,
    };
  }
  const activeId =
    normalized.activeInvoiceTemplateId === templateId ? list[0].id : normalized.activeInvoiceTemplateId;
  const active = list.find((t) => t.id === activeId) || list[0];
  return {
    ...normalized,
    ...settingsFromTemplate(normalized, active),
    invoiceTemplates: list,
    activeInvoiceTemplateId: active.id,
  };
}

export function formulaLabel(formula: InvoiceCustomColumn['formula']): string {
  switch (formula) {
    case 'fixed':
      return 'Fixed number';
    case 'percent_salary':
      return '% of monthly salary';
    case 'percent_fee':
      return '% of line fee / total';
    case 'manual':
      return 'Manual number';
    case 'text':
      return 'Text';
    default:
      return formula;
  }
}

/** Resolve a custom column cell for one line item. */
export function resolveCustomColumnValue(
  column: InvoiceCustomColumn,
  item: InvoiceLineItem,
  override?: number | string | null,
): { display: string; numeric: number | null } {
  if (override != null && override !== '') {
    if (column.formula === 'text') {
      return { display: String(override), numeric: null };
    }
    const n = Number(override);
    if (Number.isFinite(n)) {
      return {
        display: column.formula.startsWith('percent') ? `${n}` : String(n),
        numeric: n,
      };
    }
    return { display: String(override), numeric: null };
  }

  const pct = Number(column.defaultValue);
  const salary = Number(item.monthlySalary || 0);
  const fee = Number(item.total || item.price || 0);

  switch (column.formula) {
    case 'fixed': {
      const n = Number.isFinite(pct) ? pct : 0;
      return { display: String(n), numeric: n };
    }
    case 'percent_salary': {
      const rate = Number.isFinite(pct) ? pct : 0;
      const n = (salary * rate) / 100;
      return { display: n ? n.toFixed(2) : '0', numeric: n };
    }
    case 'percent_fee': {
      const rate = Number.isFinite(pct) ? pct : 0;
      const n = (fee * rate) / 100;
      return { display: n ? n.toFixed(2) : '0', numeric: n };
    }
    case 'manual':
      return { display: '—', numeric: null };
    case 'text':
      return { display: String(column.defaultValue ?? ''), numeric: null };
    default:
      return { display: '—', numeric: null };
  }
}

export const DEFAULT_CUSTOM_COLUMN_PRESETS: Array<Omit<InvoiceCustomColumn, 'id'>> = [
  { name: 'VAT', formula: 'percent_fee', defaultValue: 5 },
  { name: 'Advance', formula: 'percent_fee', defaultValue: 50 },
  { name: 'Extra fee', formula: 'fixed', defaultValue: 0 },
  { name: 'Note', formula: 'text', defaultValue: '' },
];
