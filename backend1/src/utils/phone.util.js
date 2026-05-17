/**
 * Normalize phone numbers: WhatsApp signup stores full international on Candidate;
 * profile UI expects local digits in the phone field and dial code in countryCode.
 */

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
  if (candidate?.whatsappNumber) {
    const fromWhatsApp = stripDialCodeFromPhone(
      candidate.whatsappNumber,
      candidate.countryCode || '+91',
    );
    if (fromWhatsApp) return fromWhatsApp;
    if (existingPhone) {
      return stripDialCodeFromPhone(existingPhone, candidate.countryCode || '+91');
    }
  }

  if (cvPhone) {
    return stripDialCodeFromPhone(cvPhone, candidate?.countryCode || '+91');
  }

  return existingPhone || null;
}

module.exports = {
  stripDialCodeFromPhone,
  resolveCandidateLocalPhone,
  resolvePhoneNumberForCvSave,
};
