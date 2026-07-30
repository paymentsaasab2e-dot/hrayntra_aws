/**
 * Normalize phone numbers: WhatsApp signup stores full international on Candidate;
 * profile UI expects local digits in the phone field and dial code in countryCode.
 */

const ISO_TO_DIAL = require('./country-dial-codes');

function normalizeE164(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits ? `+${digits}` : '';
}

function resolveDialCode(countryCode, hintFullNumber) {
  const raw = String(countryCode || '').trim();
  if (raw.startsWith('+')) return raw;
  if (/^\d+$/.test(raw)) return `+${raw}`;
  if (/^[A-Za-z]{2}$/.test(raw)) {
    const iso = raw.toUpperCase();
    if (ISO_TO_DIAL[iso]) return ISO_TO_DIAL[iso];
  }
  const hint = normalizeE164(hintFullNumber);
  if (hint.startsWith('+91')) return '+91';
  if (hint.startsWith('+1')) return '+1';
  if (hint.startsWith('+44')) return '+44';
  return '+91';
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
  const dialCode = candidate?.countryCode || '+91';

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
  if (cvPhone) {
    return stripDialCodeFromPhone(cvPhone, candidate?.countryCode || '+91');
  }

  if (existingPhone) {
    return stripDialCodeFromPhone(existingPhone, candidate?.countryCode || '+91');
  }

  if (candidate?.whatsappNumber) {
    const fromWhatsApp = stripDialCodeFromPhone(
      candidate.whatsappNumber,
      candidate.countryCode || '+91',
    );
    if (fromWhatsApp) return fromWhatsApp;
  }

  return existingPhone || null;
}

module.exports = {
  normalizeE164,
  resolveDialCode,
  resolveWhatsAppLogin,
  whatsappNumbersMatch,
  stripDialCodeFromPhone,
  resolveCandidateLocalPhone,
  resolvePhoneNumberForCvSave,
};
