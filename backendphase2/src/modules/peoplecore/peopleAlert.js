/**
 * Short WhatsApp alerts for leave decisions and overtime punches.
 * Sending is skipped unless TWILIO_WHATSAPP_FROM and a phone are present.
 */

export function leaveDecisionMessage({ employeeName, status, startDate, endDate }) {
  const name = String(employeeName || 'there').trim() || 'there';
  const when = startDate && endDate ? ` (${startDate} to ${endDate})` : '';
  return `HRYantra leave: ${name}, your leave${when} is ${String(status || '').toLowerCase()}.`;
}

export function overtimeMessage({ employeeName, localWorkDate, overtimeMinutes }) {
  const name = String(employeeName || 'there').trim() || 'there';
  const hours = Math.round((Number(overtimeMinutes) || 0) / 6) / 10;
  return `HRYantra attendance: ${name}, ${hours} overtime hour(s) recorded for ${localWorkDate}.`;
}

export async function notifyEmployeeWhatsApp(employee, body) {
  const phone = String(employee?.phone || '').trim();
  const from = String(process.env.TWILIO_WHATSAPP_FROM || '').trim();
  if (!phone || !from || !body) return { sent: false, reason: 'not_configured' };
  try {
    const twilio = (await import('twilio')).default;
    const sid = String(process.env.TWILIO_ACCOUNT_SID || '').trim();
    const token = String(process.env.TWILIO_AUTH_TOKEN || '').trim();
    if (!sid || !token) return { sent: false, reason: 'not_configured' };
    const client = twilio(sid, token);
    await client.messages.create({
      from: from.startsWith('whatsapp:') ? from : `whatsapp:${from}`,
      to: phone.startsWith('whatsapp:') ? phone : `whatsapp:${phone}`,
      body: String(body).slice(0, 500),
    });
    return { sent: true };
  } catch (error) {
    return { sent: false, reason: error?.message || 'send_failed' };
  }
}
