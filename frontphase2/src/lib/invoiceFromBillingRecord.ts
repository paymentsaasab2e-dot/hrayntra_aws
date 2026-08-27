import type { BillingSettingsSnapshot, RecruitmentInvoiceData } from '../types/recruitmentInvoice';
import { migrateLegacyInvoiceNotesToTerms } from './placementInvoiceClientContext';
import { resolveClientEmail } from './invoiceCurrency';
import { recalcInvoiceTotals, recalcLineItem } from './invoiceCalculations';

function toIsoDate(value: unknown): string {
  if (!value) return '';
  const parsed = new Date(value as string);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

export function invoiceFromBillingRecord(
  record: Record<string, any>,
  settings: BillingSettingsSnapshot,
): RecruitmentInvoiceData {
  const payload = (record.invoicePayload || {}) as Record<string, any>;
  const placement = record.placement;
  const candidateName = placement
    ? `${placement.candidate?.firstName || ''} ${placement.candidate?.lastName || ''}`.trim()
    : '';

  const lineItems = Array.isArray(payload.lineItems) && payload.lineItems.length
    ? payload.lineItems
    : [
        {
          name: `Placement fee — ${placement?.job?.title || 'Placement'}`,
          quantity: 1,
          price: Number(record.amount || 0),
          total: Number(record.amount || 0),
        },
      ];

  const additionalCharges = Array.isArray(payload.additionalCharges) ? payload.additionalCharges : [];
  const taxRate = Number(payload.taxRate ?? settings.taxRate ?? 0);
  const normalizedLineItems = lineItems.map((item) =>
    recalcLineItem({
      name: String(item?.name || '').trim() || 'Line item',
      quantity: Math.max(Number(item?.quantity) || 0, 0) || 1,
      price: Number(item?.price) || 0,
      total: Number(item?.total) || 0,
      monthlySalary:
        item?.monthlySalary == null || item?.monthlySalary === ''
          ? null
          : Number(item.monthlySalary),
      ratePercent:
        item?.ratePercent == null || item?.ratePercent === ''
          ? null
          : Number(item.ratePercent),
      extraValues:
        item?.extraValues && typeof item.extraValues === 'object' ? item.extraValues : undefined,
    }),
  );
  const totals = recalcInvoiceTotals(normalizedLineItems, additionalCharges, taxRate);

  const clientForBillTo = record.client || placement?.client;
  const payloadBuyer = payload.buyer as RecruitmentInvoiceData['buyer'] | undefined;
  const resolvedBuyerEmail =
    String(payloadBuyer?.email || '').trim() || resolveClientEmail(clientForBillTo);

  return migrateLegacyInvoiceNotesToTerms({
    invoiceNo: record.invoiceNumber || '',
    invoiceDate: toIsoDate(record.invoiceDate) || toIsoDate(record.createdAt),
    dueDate: toIsoDate(record.dueDate),
    placementId: record.placementId || '',
    currency: String(record.currency || settings.defaultCurrency || 'USD').toUpperCase(),
    status: record.status === 'SENT' ? 'SENT' : 'DRAFT',
    seller: (payload.seller as RecruitmentInvoiceData['seller']) || {
      name: settings.companyName || 'Your agency',
      email: '',
      phone: '',
      address: '',
    },
    buyer: {
      name:
        String(payloadBuyer?.name || '').trim() ||
        clientForBillTo?.companyName ||
        '',
      email: resolvedBuyerEmail,
      phone: String(payloadBuyer?.phone || '').trim(),
      address: String(payloadBuyer?.address || '').trim(),
    },
    lineItems: normalizedLineItems,
    additionalCharges,
    taxRate,
    subtotal: totals.subtotal,
    taxAmount: totals.taxAmount,
    total: totals.total,
    notes: record.notes || '',
    termsAndConditions: String(payload.termsAndConditions || ''),
    placementSummary: payload.placementSummary as RecruitmentInvoiceData['placementSummary'],
    legalTerms: payload.legalTerms as RecruitmentInvoiceData['legalTerms'],
    sellerBank: payload.sellerBank as RecruitmentInvoiceData['sellerBank'],
    buyerBank: payload.buyerBank as RecruitmentInvoiceData['buyerBank'],
    clientSignatory: payload.clientSignatory as RecruitmentInvoiceData['clientSignatory'],
    agencySignatory: payload.agencySignatory as RecruitmentInvoiceData['agencySignatory'],
    templateId: (payload.templateId as string | null | undefined) ?? null,
    customColumns: Array.isArray(payload.customColumns)
      ? (payload.customColumns as RecruitmentInvoiceData['customColumns'])
      : [],
  });
}
