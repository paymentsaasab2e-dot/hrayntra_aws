export function buildUpiPayUri({
  merchantUpi,
  merchantName,
  amountInr,
  transactionNote,
  transactionRef,
}) {
  const pa = String(merchantUpi || '').trim();
  const am = Number(amountInr);
  if (!pa) throw new Error('Merchant UPI is required');
  if (!Number.isFinite(am) || am <= 0) throw new Error('Invalid payment amount');

  const params = new URLSearchParams();
  params.set('pa', pa);
  params.set('pn', String(merchantName || 'Hryantra SAASA').trim());
  params.set('am', am.toFixed(2));
  params.set('cu', 'INR');
  if (transactionNote) params.set('tn', String(transactionNote).slice(0, 80));
  if (transactionRef) params.set('tr', String(transactionRef).slice(0, 40));
  return `upi://pay?${params.toString()}`;
}
