/**
 * Normalize phone numbers: WhatsApp signup stores full international on Candidate;
 * profile UI expects local digits in the phone field and dial code in countryCode.
 */

const ISO_TO_DIAL = require('./country-dial-codes');

/** Unique dial digit strings, longest first (so +234 wins over +23, +91 over +9, etc.). */
const DIAL_DIGITS_LONGEST_FIRST = (() => {
  const unique = new Set();
  for (const dial of Object.values(ISO_TO_DIAL)) {
    const digits = String(dial || '').replace(/\D/g, '');
    if (digits) unique.add(digits);
  }
  return [...unique].sort((a, b) => b.length - a.length);
})();

function normalizeE164(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits ? `+${digits}` : '';
}

/**
 * Infer dial code from a full E.164 number using longest matching country dial prefix.
 */
function inferDialFromE164(fullNumber) {
  const digits = String(fullNumber || '').replace(/\D/g, '');
  if (!digits) return '';
  for (const dial of DIAL_DIGITS_LONGEST_FIRST) {
    if (digits.startsWith(dial) && digits.length > dial.length) {
      return `+${dial}`;
    }
  }
  return '';
}

function resolveDialCode(countryCode, hintFullNumber) {
  const hintDial = inferDialFromE164(hintFullNumber);
  const raw = String(countryCode || '').trim().split(/\s/)[0];
  let fromCode = '';

  if (raw.startsWith('+')) fromCode = raw;
  else if (/^\d+$/.test(raw)) fromCode = `+${raw}`;
  else if (/^[A-Za-z]{2}$/.test(raw) && ISO_TO_DIAL[raw.toUpperCase()]) {
    fromCode = ISO_TO_DIAL[raw.toUpperCase()];
  }

  // Prefer E.164 hint when UI dial conflicts (e.g. stored +91… but UI sends +234).
  if (hintDial && fromCode) {
    const hint = normalizeE164(hintFullNumber);
    if (hint.startsWith(hintDial) && !hint.startsWith(fromCode)) {
      return hintDial;
    }
  }

  if (fromCode) return fromCode;
  if (hintDial) return hintDial;
  return '+91';
}

/**
 * For already-verified accounts, keep the stored WhatsApp E.164 so a mismatched
 * login dial (browser geo → +234) cannot rewrite the same local digits.
 * New / unverified accounts still take the incoming number.
 */
function preferStableWhatsApp({
  existingFull,
  existingDial,
  incomingFull,
  incomingDial,
  isVerified,
  hasPassword,
}) {
  const existing = normalizeE164(existingFull);
  const incoming = normalizeE164(incomingFull);
  const preservePhone = Boolean(existing && (isVerified || hasPassword));

  if (preservePhone) {
    const dial =
      inferDialFromE164(existing) ||
      resolveDialCode(existingDial, existing) ||
      '+91';
    return { fullWhatsAppNumber: existing, countryCode: dial };
  }

  if (!incoming) {
    return {
      fullWhatsAppNumber: existing || '',
      countryCode: resolveDialCode(existingDial, existing) || '+91',
    };
  }

  return {
    fullWhatsAppNumber: incoming,
    countryCode: resolveDialCode(incomingDial, incoming),
  };
}

/**
 * Build canonical dial code, local digits, and full WhatsApp number for auth flows.
 * Handles legacy rows where countryCode was stored as ISO (e.g. "IN") instead of "+91".
 */
function resolveWhatsAppLogin({ countryCode, whatsappNumber, existingFullNumber }) {
  if (existingFullNumber) {
    const fullWhatsAppNumber = normalizeE164(existingFullNumber);
    const dialCode = resolveDialCode(countryCode, fullWhatsAppNumber);
    const localNumber = stripDialCodeFromPhone(fullWhatsAppNumber, dialCode);
    return { dialCode, localNumber, fullWhatsAppNumber };
  }

  const raw = String(whatsappNumber || '').trim();
  if (raw.startsWith('+')) {
    const fullWhatsAppNumber = normalizeE164(raw);
    const dialCode = resolveDialCode(countryCode, fullWhatsAppNumber);
    const localNumber = stripDialCodeFromPhone(fullWhatsAppNumber, dialCode);
    return { dialCode, localNumber, fullWhatsAppNumber };
  }

  const localNumber = raw.replace(/\D/g, '');
  const dialCode = resolveDialCode(countryCode);
  const fullWhatsAppNumber = `${dialCode}${localNumber}`;
  return { dialCode, localNumber, fullWhatsAppNumber };
}

/** Compare WhatsApp numbers stored in mixed legacy formats. */
function whatsappNumbersMatch(a, b) {
  const left = normalizeE164(a);
  const right = normalizeE164(b);
  return Boolean(left && right && left === right);
}

function stripDialCodeFromPhone(rawPhone, dialCode) {
  if (!rawPhone) return '';
  const normalizedDial = String(dialCode || '').trim();
  const dialDigits = normalizedDial.replace(/\D/g, '');
  let value = String(rawPhone).trim();

  if (normalizedDial && value.startsWith(normalizedDial)) {
    value = value.slice(normalizedDial.length);
  }

  let digits = value.replace(/\D/g, '');
  if (dialDigits && digits.startsWith(dialDigits)) {
    digits = digits.slice(dialDigits.length);
  }

  return digits;
}

function resolveCandidateLocalPhone(candidate) {
  const dialCode =
    inferDialFromE164(candidate?.whatsappNumber) ||
    candidate?.countryCode ||
    '+91';

  // Prefer profile phone saved via Basic Information over signup WhatsApp
  if (candidate?.profile?.phoneNumber) {
    const fromProfile = stripDialCodeFromPhone(candidate.profile.phoneNumber, dialCode);
    if (fromProfile) return fromProfile;
  }

  if (candidate?.whatsappNumber) {
    const fromWhatsApp = stripDialCodeFromPhone(candidate.whatsappNumber, dialCode);
    if (fromWhatsApp) return fromWhatsApp;
  }

  return '';
}

function resolvePhoneNumberForCvSave({ candidate, cvPhone, existingPhone }) {
  const dialCode =
    inferDialFromE164(candidate?.whatsappNumber) ||
    candidate?.countryCode ||
    '+91';

  if (cvPhone) {
    return stripDialCodeFromPhone(cvPhone, dialCode);
  }

  if (existingPhone) {
    return stripDialCodeFromPhone(existingPhone, dialCode);
  }

  if (candidate?.whatsappNumber) {
    const fromWhatsApp = stripDialCodeFromPhone(candidate.whatsappNumber, dialCode);
    if (fromWhatsApp) return fromWhatsApp;
  }

  return existingPhone || null;
}

module.exports = {
  normalizeE164,
  inferDialFromE164,
  resolveDialCode,
  preferStableWhatsApp,
  resolveWhatsAppLogin,
  whatsappNumbersMatch,
  stripDialCodeFromPhone,
  resolveCandidateLocalPhone,
  resolvePhoneNumberForCvSave,
};
