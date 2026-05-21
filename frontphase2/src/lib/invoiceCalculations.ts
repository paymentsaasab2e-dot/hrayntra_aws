import type {
  InvoiceAdditionalCharge,
  InvoiceLineItem,
  RecruitmentInvoiceData,
} from '../types/recruitmentInvoice';

export function recalcLineItem(item: InvoiceLineItem): InvoiceLineItem {
  const quantity = Math.max(Number(item.quantity) || 0, 0);
  const price = Math.max(Number(item.price) || 0, 0);
  return {
    ...item,
    quantity,
    price,
    total: quantity * price,
  };
}

export function recalcInvoiceTotals(
  lineItems: InvoiceLineItem[],
  additionalCharges: InvoiceAdditionalCharge[],
  taxRate: number,
): Pick<RecruitmentInvoiceData, 'subtotal' | 'taxAmount' | 'total'> {
  const itemsSubtotal = lineItems.reduce((sum, item) => sum + recalcLineItem(item).total, 0);
  const chargesSubtotal = additionalCharges.reduce(
    (sum, charge) => sum + Math.max(Number(charge.amount) || 0, 0),
    0,
  );
  const subtotal = itemsSubtotal + chargesSubtotal;
  const rate = Math.max(Number(taxRate) || 0, 0);
  const taxAmount = (subtotal * rate) / 100;
  const total = subtotal + taxAmount;
  return { subtotal, taxAmount, total };
}

export function addDaysIso(days: number, from = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
