function formatMoney(amount, currency = 'USD') {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(amount) || 0);
  } catch {
    return `${currency || 'USD'} ${(Number(amount) || 0).toFixed(2)}`;
  }
}

function formatDateDisplay(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * HTML body for placement invoice emails (sent via Resend / connected Gmail).
 */
export function buildPlacementInvoiceEmailHtml({
  invoiceNumber,
  invoiceDate,
  dueDate,
  currency = 'USD',
  status = 'SENT',
  seller = {},
  buyer = {},
  lineItems = [],
  additionalCharges = [],
  subtotal = 0,
  taxRate = 0,
  taxAmount = 0,
  total = 0,
  notes = '',
  placementSummary = null,
  settings = {},
}) {
  const taxLabel = settings.taxLabel || 'Tax';
  const paymentTerms = settings.defaultPaymentTerms || '';
  const sellerName = escapeHtml(seller.name || 'Your agency');
  const buyerName = escapeHtml(buyer.name || 'Client');
  const buyerEmail = escapeHtml(buyer.email || '');
  const lineRows = lineItems
    .map(
      (item) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">${escapeHtml(item.name)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${escapeHtml(item.quantity)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatMoney(item.price, currency)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;">${formatMoney(item.total, currency)}</td>
      </tr>`,
    )
    .join('');

  const chargeRows = (additionalCharges || [])
    .filter((c) => c?.name && Number(c.amount) > 0)
    .map(
      (c) => `
      <tr>
        <td colspan="3" style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#64748b;">${escapeHtml(c.name)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:right;">${formatMoney(c.amount, currency)}</td>
      </tr>`,
    )
    .join('');

  const placementBlock = placementSummary
    ? `
      <div style="margin-top:20px;padding:14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
        <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;">Placement</p>
        ${
          placementSummary.candidateName
            ? `<p style="margin:4px 0;font-size:13px;color:#334155;"><strong>Candidate:</strong> ${escapeHtml(placementSummary.candidateName)}</p>`
            : ''
        }
        ${
          placementSummary.jobTitle
            ? `<p style="margin:4px 0;font-size:13px;color:#334155;"><strong>Role:</strong> ${escapeHtml(placementSummary.jobTitle)}</p>`
            : ''
        }
      </div>`
    : '';

  return `
    <div style="background:#f1f5f9;padding:24px 12px;font-family:Arial,sans-serif;color:#0f172a;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
        <div style="padding:28px 28px 20px;border-bottom:1px solid #e2e8f0;">
          <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#94a3b8;">Recruitment invoice</p>
          <h1 style="margin:8px 0 0;font-size:22px;color:#0f172a;">${sellerName}</h1>
          <p style="margin:12px 0 0;font-size:14px;color:#475569;">Invoice <strong>${escapeHtml(invoiceNumber)}</strong> · ${escapeHtml(status)}</p>
        </div>
        <div style="padding:24px 28px;">
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">
            Dear ${buyerName}${buyerEmail ? ` (${buyerEmail})` : ''},
          </p>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#334155;">
            Please find your placement invoice below. Payment is due by <strong>${formatDateDisplay(dueDate)}</strong>.
          </p>
          <table style="width:100%;margin-bottom:16px;font-size:13px;color:#64748b;">
            <tr>
              <td>Invoice date</td>
              <td style="text-align:right;color:#0f172a;font-weight:600;">${formatDateDisplay(invoiceDate)}</td>
            </tr>
            <tr>
              <td>Due date</td>
              <td style="text-align:right;color:#0f172a;font-weight:600;">${formatDateDisplay(dueDate)}</td>
            </tr>
            ${
              paymentTerms
                ? `<tr><td>Terms</td><td style="text-align:right;color:#0f172a;">${escapeHtml(paymentTerms)}</td></tr>`
                : ''
            }
          </table>
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead>
              <tr style="background:#f8fafc;">
                <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#64748b;">Description</th>
                <th style="padding:10px 12px;text-align:center;font-size:11px;text-transform:uppercase;color:#64748b;">Qty</th>
                <th style="padding:10px 12px;text-align:right;font-size:11px;text-transform:uppercase;color:#64748b;">Rate</th>
                <th style="padding:10px 12px;text-align:right;font-size:11px;text-transform:uppercase;color:#64748b;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${lineRows || '<tr><td colspan="4" style="padding:12px;color:#94a3b8;">No line items</td></tr>'}
              ${chargeRows}
            </tbody>
          </table>
          <table style="width:100%;margin-top:12px;font-size:13px;">
            <tr>
              <td style="padding:6px 0;color:#64748b;">Subtotal</td>
              <td style="padding:6px 0;text-align:right;">${formatMoney(subtotal, currency)}</td>
            </tr>
            ${
              taxAmount > 0
                ? `<tr>
              <td style="padding:6px 0;color:#64748b;">${escapeHtml(taxLabel)} (${Number(taxRate) || 0}%)</td>
              <td style="padding:6px 0;text-align:right;">${formatMoney(taxAmount, currency)}</td>
            </tr>`
                : ''
            }
            <tr>
              <td style="padding:10px 0 0;font-size:15px;font-weight:700;color:#0f172a;">Total due</td>
              <td style="padding:10px 0 0;text-align:right;font-size:16px;font-weight:700;color:#0f172a;">${formatMoney(total, currency)}</td>
            </tr>
          </table>
          ${placementBlock}
          ${
            notes
              ? `<p style="margin:20px 0 0;font-size:13px;color:#475569;line-height:1.5;"><strong>Notes:</strong> ${escapeHtml(notes)}</p>`
              : ''
          }
          ${
            settings.bankName || settings.accountNumber
              ? `<div style="margin-top:20px;padding:14px;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;font-size:13px;color:#78350f;">
              <p style="margin:0 0 6px;font-weight:700;">Payment details</p>
              ${settings.bankName ? `<p style="margin:2px 0;">Bank: ${escapeHtml(settings.bankName)}</p>` : ''}
              ${settings.accountNumber ? `<p style="margin:2px 0;">Account: ${escapeHtml(settings.accountNumber)}</p>` : ''}
              ${settings.swiftCode ? `<p style="margin:2px 0;">SWIFT: ${escapeHtml(settings.swiftCode)}</p>` : ''}
            </div>`
              : ''
          }
        </div>
        <div style="padding:16px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;">
          This message was sent from your recruitment billing workspace. Please reply to your recruiter if you have questions.
        </div>
      </div>
    </div>
  `;
}
