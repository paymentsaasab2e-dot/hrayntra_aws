/** Normalize Agreements & Terms commercial fields from API payloads. */

function normalizeNullableString(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed === '' ? null : trimmed;
}

function normalizePercentString(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).replace(/%/g, '').trim();
  return trimmed === '' ? null : trimmed;
}

function normalizeReplacementValue(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number.parseInt(String(value), 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function normalizeReplacementUnit(value) {
  const unit = String(value || '').trim().toUpperCase();
  return unit === 'MONTHS' || unit === 'DAYS' ? unit : null;
}

function pickPaymentTermsFromPayload(data = {}) {
  return normalizeNullableString(data.agreementTimePeriod ?? data.agreementPaymentTerms);
}

export function buildAgreementTermsCreateFields(data = {}) {
  const freeReplacementValue = normalizeReplacementValue(data.agreementFreeReplacementValue);
  const freeReplacementUnit = normalizeReplacementUnit(data.agreementFreeReplacementUnit);

  return {
    agreementTotalPayment: null,
    agreementLevel: normalizeNullableString(data.agreementLevel),
    agreementServiceChargePercent: normalizePercentString(data.agreementServiceChargePercent),
    agreementTimePeriod: pickPaymentTermsFromPayload(data),
    agreementAdvancePaymentPercent: normalizePercentString(data.agreementAdvancePaymentPercent),
    agreementFreeReplacementValue: freeReplacementValue,
    agreementFreeReplacementUnit:
      freeReplacementValue != null ? freeReplacementUnit || 'MONTHS' : null,
  };
}

export function applyAgreementTermsUpdateFields(data, updateData) {
  if (data.agreementTotalPayment !== undefined || data.agreementProfessionalFees !== undefined) {
    updateData.agreementTotalPayment = null;
  }
  if (data.agreementLevel !== undefined) {
    updateData.agreementLevel = normalizeNullableString(data.agreementLevel);
  }
  if (data.agreementServiceChargePercent !== undefined) {
    updateData.agreementServiceChargePercent = normalizePercentString(data.agreementServiceChargePercent);
  }
  if (data.agreementTimePeriod !== undefined || data.agreementPaymentTerms !== undefined) {
    updateData.agreementTimePeriod = pickPaymentTermsFromPayload(data);
  }
  if (data.agreementAdvancePaymentPercent !== undefined) {
    updateData.agreementAdvancePaymentPercent = normalizePercentString(data.agreementAdvancePaymentPercent);
  }
  if (data.agreementFreeReplacementValue !== undefined) {
    updateData.agreementFreeReplacementValue = normalizeReplacementValue(data.agreementFreeReplacementValue);
  }
  if (data.agreementFreeReplacementUnit !== undefined) {
    updateData.agreementFreeReplacementUnit = normalizeReplacementUnit(data.agreementFreeReplacementUnit);
  }
  if (
    data.agreementFreeReplacementValue !== undefined ||
    data.agreementFreeReplacementUnit !== undefined
  ) {
    const value =
      data.agreementFreeReplacementValue !== undefined
        ? updateData.agreementFreeReplacementValue
        : undefined;
    if (value === null && data.agreementFreeReplacementValue !== undefined) {
      updateData.agreementFreeReplacementUnit = null;
    } else if (value != null && !updateData.agreementFreeReplacementUnit) {
      updateData.agreementFreeReplacementUnit = 'MONTHS';
    }
  }
}
