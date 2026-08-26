'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, Plus, Trash2, X } from 'lucide-react';
import type {
  BillingSettingsSnapshot,
  InvoiceCustomColumn,
  InvoiceTemplate,
  RecruitmentInvoiceData,
} from '../../types/recruitmentInvoice';
import { RecruitmentInvoicePreview } from './RecruitmentInvoicePreview';
import {
  createBlankTemplate,
  deleteTemplate,
  formulaLabel,
  getActiveTemplate,
  newColumnId,
  normalizeInvoiceTemplates,
  settingsFromTemplate,
  upsertTemplate,
} from '../../lib/invoiceTemplates';

type Props = {
  settings: BillingSettingsSnapshot;
  onChange: (next: BillingSettingsSnapshot) => void;
  /** Sticky persist control at the bottom of the left editor (always visible). */
  persistAction?: {
    label: string;
    savingLabel?: string;
    onSave: () => void | Promise<void>;
    saving?: boolean;
  };
};

const A4_WIDTH_PX = 794;

function readImageAsDataUrl(file: File, onDone: (url: string) => void) {
  const reader = new FileReader();
  reader.onload = () => {
    if (typeof reader.result === 'string') onDone(reader.result);
  };
  reader.readAsDataURL(file);
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
      />
    </div>
  );
}

function ImageField({
  label,
  value,
  onChange,
  onClear,
}: {
  label: string;
  value?: string;
  onChange: (url: string) => void;
  onClear: () => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
        {label}
      </label>
      {value ? (
        <img
          src={value}
          alt={label}
          className="mb-2 max-h-16 rounded-lg border border-slate-200 bg-white object-contain p-2"
        />
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="file"
          accept="image/*"
          className="text-sm"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) readImageAsDataUrl(file, onChange);
          }}
        />
        {value ? (
          <button
            type="button"
            onClick={onClear}
            className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
          >
            Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}

function buildSampleInvoice(settings: BillingSettingsSnapshot): RecruitmentInvoiceData {
  const today = new Date().toISOString().slice(0, 10);
  const fee = 862;
  const company = String(settings.companyName || '').trim() || 'Your Company L.L.C';
  const active = getActiveTemplate(settings);
  return {
    invoiceNo: `${settings.invoicePrefix || 'INV'}/SAMPLE/001`,
    invoiceDate: today,
    dueDate: today,
    placementId: 'sample',
    currency: settings.defaultCurrency || 'USD',
    status: 'DRAFT',
    seller: { name: company, address: settings.companyFooterLine || '' },
    buyer: { name: 'Sample Client Group', address: 'Client address line\nCity, Country' },
    lineItems: [
      {
        name: 'Recruitment Fee for- Mr. Sample Candidate, Branch Manager- DOJ- 06/04/2026',
        quantity: 1,
        price: fee,
        total: fee,
        monthlySalary: fee,
        ratePercent: 8.33,
      },
    ],
    additionalCharges: [],
    taxRate: settings.taxRate || 0,
    subtotal: fee,
    taxAmount: 0,
    total: fee,
    notes: '',
    termsAndConditions: settings.defaultTermsAndConditions || '',
    sellerBank: {
      bankName: settings.bankName || 'Emirates NBD',
      accountHolderName: settings.accountHolderName || company,
      accountNumber: settings.accountNumber || '0000000000',
      iban: settings.iban || '',
      swiftCode: settings.swiftCode || 'EBILAEAD',
    },
    agencySignatory: {
      label: 'Agency',
      name: settings.authorizedSignatoryName || 'Authorized Signatory',
      designation: settings.authorizedSignatoryDesignation || '',
      signatureImageUrl: settings.agencySignatureUrl || undefined,
    },
    templateId: active?.id,
    customColumns: active?.customColumns || [],
  };
}

function ScaledInvoicePreview({
  invoice,
  settings,
}: {
  invoice: RecruitmentInvoiceData;
  settings: BillingSettingsSnapshot;
}) {
  const shellRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.55);
  const [pageHeight, setPageHeight] = useState(1100);

  useEffect(() => {
    const el = shellRef.current;
    if (!el) return;
    const update = () => {
      const width = el.clientWidth || A4_WIDTH_PX;
      setScale(Math.min(1, Math.max(0.35, (width - 8) / A4_WIDTH_PX)));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={shellRef} className="h-full min-h-[420px] w-full overflow-auto rounded-xl border border-slate-200 bg-slate-200/80 p-3">
      <div className="mx-auto origin-top" style={{ width: A4_WIDTH_PX * scale, height: pageHeight * scale }}>
        <div
          className="bg-white shadow-md"
          style={{ width: A4_WIDTH_PX, transform: `scale(${scale})`, transformOrigin: 'top left' }}
          ref={(node) => {
            if (node) setPageHeight(Math.max(node.scrollHeight, 1000));
          }}
        >
          <RecruitmentInvoicePreview invoice={invoice} settings={settings} />
        </div>
      </div>
    </div>
  );
}

function FullscreenInvoicePreview({
  invoice,
  settings,
  onClose,
}: {
  invoice: RecruitmentInvoiceData;
  settings: BillingSettingsSnapshot;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-slate-900/70 backdrop-blur-sm">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-slate-950/80 px-4 py-3 text-white">
        <p className="text-sm font-semibold">Invoice template preview</p>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-sm font-medium hover:bg-white/20"
        >
          <X size={16} /> Close
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-8">
        <div className="mx-auto bg-white shadow-2xl" style={{ width: A4_WIDTH_PX, maxWidth: '100%' }}>
          <RecruitmentInvoicePreview invoice={invoice} settings={settings} />
        </div>
      </div>
    </div>
  );
}

/**
 * Named invoice templates: scrollable left editor, live A4 preview, custom columns.
 */
export function InvoiceTemplateSettingsPanel({ settings, onChange, persistAction }: Props) {
  const normalized = useMemo(() => normalizeInvoiceTemplates(settings), [settings]);
  const templates = normalized.invoiceTemplates || [];
  const active = getActiveTemplate(normalized);
  const [draftName, setDraftName] = useState(active?.name || 'Default template');
  const [fullscreen, setFullscreen] = useState(false);
  const sample = useMemo(() => buildSampleInvoice(normalized), [normalized]);

  useEffect(() => {
    setDraftName(active?.name || 'Default template');
  }, [active?.id, active?.name]);

  const patchActive = (patch: Partial<InvoiceTemplate>) => {
    if (!active) return;
    const nextTpl: InvoiceTemplate = { ...active, ...patch, name: draftName.trim() || active.name };
    onChange(upsertTemplate(normalized, nextTpl));
  };

  const selectTemplate = (id: string) => {
    const tpl = templates.find((t) => t.id === id);
    if (!tpl) return;
    onChange({
      ...settingsFromTemplate(normalized, tpl),
      invoiceTemplates: templates,
      activeInvoiceTemplateId: tpl.id,
    });
  };

  const saveNamed = () => {
    if (!active) return;
    const name = draftName.trim() || 'Untitled template';
    onChange(upsertTemplate(normalized, { ...active, name }));
  };

  const saveAsNew = () => {
    const name = draftName.trim() || `Template ${templates.length + 1}`;
    const created = createBlankTemplate(name, { ...normalized, ...active });
    created.customColumns = [...(active?.customColumns || [])];
    onChange(upsertTemplate(normalized, created));
  };

  const addColumn = () => {
    const col: InvoiceCustomColumn = {
      id: newColumnId(),
      name: 'New column',
      formula: 'percent_fee',
      defaultValue: 5,
    };
    patchActive({ customColumns: [...(active?.customColumns || []), col] });
  };

  const updateColumn = (id: string, patch: Partial<InvoiceCustomColumn>) => {
    const cols = (active?.customColumns || []).map((c) => (c.id === id ? { ...c, ...patch } : c));
    patchActive({ customColumns: cols });
  };

  const removeColumn = (id: string) => {
    patchActive({ customColumns: (active?.customColumns || []).filter((c) => c.id !== id) });
  };

  const editorHeightClass =
    'xl:h-[min(calc(100dvh-11rem),900px)] max-xl:min-h-0';

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-bold text-slate-900">Invoice templates</h3>
        <p className="mt-1 text-sm text-slate-600">
          Name and save multiple templates. When creating an invoice, pick which template to use.
          Add extra columns with fixed amounts or % of salary / fee.
        </p>
      </div>

      <div className={`grid gap-4 xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] xl:items-stretch ${editorHeightClass}`}>
        {/* Left editor: viewport-height on desktop, sticky Save — no empty gap below */}
        <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm max-xl:max-h-[min(70vh,720px)] xl:h-full">
          <div className="shrink-0 space-y-3 border-b border-slate-100 p-4">
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Saved templates
              </label>
              <select
                value={active?.id || ''}
                onChange={(e) => selectTemplate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <Field
              label="Template name"
              value={draftName}
              onChange={setDraftName}
              placeholder="e.g. ATEKA standard, UAE recruitment"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={saveNamed}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
              >
                Rename / apply name
              </button>
              <button
                type="button"
                onClick={saveAsNew}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
              >
                Save as new
              </button>
              {templates.length > 1 ? (
                <button
                  type="button"
                  onClick={() => active && onChange(deleteTemplate(normalized, active.id))}
                  className="rounded-lg border border-rose-200 px-3 py-1.5 text-[12px] font-semibold text-rose-700 hover:bg-rose-50"
                >
                  Delete
                </button>
              ) : null}
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4">
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Template style
              </label>
              <select
                value={normalized.invoiceTemplateStyle || 'saasa'}
                onChange={(e) =>
                  patchActive({
                    invoiceTemplateStyle: e.target.value === 'classic' ? 'classic' : 'saasa',
                  })
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="saasa">Professional (logo / stamp)</option>
                <option value="classic">Classic simple</option>
              </select>
            </div>

            <Field
              label="Company / agency name"
              value={String(normalized.companyName || '')}
              onChange={(v) => patchActive({ companyName: v })}
              placeholder="e.g. ATEKA LOGISTICS L.L.C"
            />
            <Field
              label="Invoice prefix"
              value={String(normalized.invoicePrefix || '')}
              onChange={(v) => patchActive({ invoicePrefix: v })}
            />

            <ImageField
              label="Company logo"
              value={normalized.agencyLogoUrl}
              onChange={(url) => patchActive({ agencyLogoUrl: url })}
              onClear={() => patchActive({ agencyLogoUrl: '' })}
            />
            <ImageField
              label="Company stamp"
              value={normalized.agencyStampUrl}
              onChange={(url) => patchActive({ agencyStampUrl: url })}
              onClear={() => patchActive({ agencyStampUrl: '' })}
            />
            <ImageField
              label="Authorized signature"
              value={normalized.agencySignatureUrl}
              onChange={(url) => patchActive({ agencySignatureUrl: url })}
              onClear={() => patchActive({ agencySignatureUrl: '' })}
            />

            <div className="flex flex-wrap gap-3 text-sm text-slate-700">
              {(
                [
                  ['showLogo', 'Show logo'],
                  ['showStamp', 'Show stamp'],
                  ['showSignature', 'Show signature'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={normalized[key] !== false}
                    onChange={(e) => patchActive({ [key]: e.target.checked })}
                  />
                  {label}
                </label>
              ))}
            </div>

            <Field
              label="Logo tagline"
              value={String(normalized.companyTagline || '')}
              onChange={(v) => patchActive({ companyTagline: v })}
            />
            <Field
              label="Location under logo"
              value={String(normalized.companyLocationLine || '')}
              onChange={(v) => patchActive({ companyLocationLine: v })}
              placeholder="Dubai, UAE"
            />
            <Field
              label="Website"
              value={String(normalized.companyWebsite || '')}
              onChange={(v) => patchActive({ companyWebsite: v })}
            />
            <Field
              label="Footer line"
              value={String(normalized.companyFooterLine || '')}
              onChange={(v) => patchActive({ companyFooterLine: v })}
            />
            <Field
              label="Authorized signatory"
              value={String(normalized.authorizedSignatoryName || '')}
              onChange={(v) => patchActive({ authorizedSignatoryName: v })}
            />
            <Field
              label="Signatory designation"
              value={String(normalized.authorizedSignatoryDesignation || '')}
              onChange={(v) => patchActive({ authorizedSignatoryDesignation: v })}
            />

            <div className="border-t border-slate-100 pt-3">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Bank details
              </p>
              <div className="space-y-3">
                <Field label="Bank name" value={String(normalized.bankName || '')} onChange={(v) => patchActive({ bankName: v })} />
                <Field label="Account name" value={String(normalized.accountHolderName || '')} onChange={(v) => patchActive({ accountHolderName: v })} />
                <Field label="Account number" value={String(normalized.accountNumber || '')} onChange={(v) => patchActive({ accountNumber: v })} />
                <Field label="IBAN" value={String(normalized.iban || '')} onChange={(v) => patchActive({ iban: v })} />
                <Field label="BIC / SWIFT" value={String(normalized.swiftCode || '')} onChange={(v) => patchActive({ swiftCode: v })} />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Default terms &amp; conditions
              </label>
              <textarea
                value={normalized.defaultTermsAndConditions || ''}
                onChange={(e) => patchActive({ defaultTermsAndConditions: e.target.value })}
                className="min-h-[88px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>

            <div className="border-t border-slate-100 pt-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Extra table columns
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Name + formula (fixed number, % of salary, % of fee, manual, text)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addColumn}
                  className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-800"
                >
                  <Plus size={12} /> Add column
                </button>
              </div>
              <div className="space-y-2">
                {(active?.customColumns || []).length === 0 ? (
                  <p className="text-xs text-slate-400">No extra columns — table uses Description, Qty, Salary, Rate, Total.</p>
                ) : (
                  (active?.customColumns || []).map((col) => (
                    <div key={col.id} className="rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 space-y-2">
                      <div className="flex gap-2">
                        <input
                          className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                          value={col.name}
                          onChange={(e) => updateColumn(col.id, { name: e.target.value })}
                          placeholder="Column name"
                        />
                        <button
                          type="button"
                          onClick={() => removeColumn(col.id)}
                          className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                          value={col.formula}
                          onChange={(e) =>
                            updateColumn(col.id, {
                              formula: e.target.value as InvoiceCustomColumn['formula'],
                            })
                          }
                        >
                          <option value="fixed">{formulaLabel('fixed')}</option>
                          <option value="percent_salary">{formulaLabel('percent_salary')}</option>
                          <option value="percent_fee">{formulaLabel('percent_fee')}</option>
                          <option value="manual">{formulaLabel('manual')}</option>
                          <option value="text">{formulaLabel('text')}</option>
                        </select>
                        <input
                          className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                          value={col.defaultValue ?? ''}
                          onChange={(e) => {
                            const raw = e.target.value;
                            if (col.formula === 'text') updateColumn(col.id, { defaultValue: raw });
                            else updateColumn(col.id, { defaultValue: raw === '' ? 0 : Number(raw) });
                          }}
                          placeholder={col.formula === 'text' ? 'Text' : col.formula.startsWith('percent') ? '%' : 'Amount'}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {persistAction ? (
            <div className="shrink-0 border-t border-slate-200 bg-white p-3">
              <button
                type="button"
                disabled={persistAction.saving}
                onClick={() => void persistAction.onSave()}
                className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
              >
                {persistAction.saving
                  ? persistAction.savingLabel || 'Saving…'
                  : persistAction.label}
              </button>
            </div>
          ) : null}
        </div>

        <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
          <div className="mb-2 flex shrink-0 flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Live preview · {active?.name || 'Template'}
            </p>
            <button
              type="button"
              onClick={() => setFullscreen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Maximize2 size={14} /> Open fullscreen
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <ScaledInvoicePreview invoice={sample} settings={normalized} />
          </div>
        </div>
      </div>

      {fullscreen ? (
        <FullscreenInvoicePreview
          invoice={sample}
          settings={normalized}
          onClose={() => setFullscreen(false)}
        />
      ) : null}
    </div>
  );
}
