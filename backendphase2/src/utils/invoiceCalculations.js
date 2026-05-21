/** Server-side invoice line/total math (matches frontphase2/src/lib/invoiceCalculations.ts). */

export function recalcLineItem(item = {}) {
  const quantity = Math.max(Number(item.quantity) || 0, 0);
  const price = Math.max(Number(item.price) || 0, 0);
  return {
    ...item,
    name: String(item.name || '').trim(),
    quantity,
    price,
    total: quantity * price,
  };
}

export function recalcInvoiceTotals(lineItems = [], additionalCharges = [], taxRate = 0) {
  const items = (Array.isArray(lineItems) ? lineItems : []).map(recalcLineItem);
  const charges = Array.isArray(additionalCharges) ? additionalCharges : [];

  const itemsSubtotal = items.reduce((sum, item) => sum + item.total, 0);
  const chargesSubtotal = charges.reduce(
    (sum, charge) => sum + Math.max(Number(charge.amount) || 0, 0),
    0,
  );
  const subtotal = itemsSubtotal + chargesSubtotal;
  const rate = Math.max(Number(taxRate) || 0, 0);
  const taxAmount = (subtotal * rate) / 100;
  const total = subtotal + taxAmount;

  return { lineItems: items, subtotal, taxAmount, total };
}
