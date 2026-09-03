/** Reject incomplete / typo addresses before we try to send (avoids Gmail bounce-backs). */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;
const TYPED_PROVIDER_HOSTS = new Set([
  'gmail.co',
  'gmail.con',
  'gmail.cm',
  'gmail.om',
  'gmail.cmo',
  'googlemail.co',
  'yahoo.co',
  'hotmail.co',
  'outlook.co',
]);

export function isDeliverableEmail(value) {
  const email = String(value || '').trim();
  if (!email || !EMAIL_RE.test(email)) return false;
  if (/@placeholder\.local$/i.test(email)) return false;
  const host = email.split('@')[1]?.toLowerCase() || '';
  if (TYPED_PROVIDER_HOSTS.has(host)) return false;
  return true;
}

export function sanitizeEmailSubject(subject) {
  return String(subject || '')
    .replace(/[\u2013\u2014\u2015\u2212]/g, '-')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Gmail raw RFC-822 headers are not UTF-8 by default — encode non-ASCII subjects. */
export function encodeRfc2047Subject(subject) {
  const value = sanitizeEmailSubject(subject);
  if (!value) return '';
  if (/^[\x20-\x7E]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}
