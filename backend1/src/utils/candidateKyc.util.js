/**
 * Phase 1 interviewer KYC = identity fields on Candidate Profile
 * (Basic Info: name, DOB, phone, passport/ID, photo).
 */

function hasText(value) {
  return String(value || '').trim().length > 0;
}

function evaluateCandidateKyc({ candidate, profile } = {}) {
  const missing = [];
  const fullName =
    profile?.fullName ||
    [candidate?.firstName, candidate?.lastName].filter(Boolean).join(' ');
  if (!hasText(fullName)) missing.push('Full name');
  if (!profile?.dateOfBirth) missing.push('Date of birth');
  const phone = profile?.phoneNumber || candidate?.phone || candidate?.whatsappNumber;
  if (!hasText(phone)) missing.push('Phone number');
  if (!hasText(profile?.passportNumber)) missing.push('Passport / ID number');
  if (!hasText(profile?.profilePhotoUrl) && !hasText(candidate?.avatar)) {
    missing.push('Profile photo');
  }

  return {
    kycVerified: missing.length === 0,
    missing,
  };
}

module.exports = {
  evaluateCandidateKyc,
};
