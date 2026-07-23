import { getCountryByCodeOrName } from './cscData';

/** Expected national (subscriber) digit length by ISO country code. */
const NATIONAL_LENGTH_BY_ISO: Record<string, number> = {
  IN: 10,
  US: 10,
  CA: 10,
  GB: 10,
  AU: 9,
  NZ: 8,
  SG: 8,
  AE: 9,
  SA: 9,
  PK: 10,
  BD: 10,
  LK: 9,
  NP: 10,
  DE: 11,
  FR: 9,
  IT: 10,
  ES: 9,
  NL: 9,
  BE: 9,
  CH: 9,
  SE: 9,
  NO: 8,
  DK: 8,
  FI: 9,
  IE: 9,
  PT: 9,
  PL: 9,
  BR: 11,
  MX: 10,
  ZA: 9,
  NG: 10,
  KE: 9,
  PH: 10,
  MY: 9,
  ID: 10,
  TH: 9,
  VN: 9,
  JP: 10,
  KR: 10,
  CN: 11,
  HK: 8,
};

export type PhoneCountryRule = {
  isoCode: string;
  countryName: string;
  dialCode: string; // e.g. "+91"
  nationalLength: number | null;
};

export function normalizeDialCode(raw?: string | null): string {
  const digits = String(raw || '').replace(/\D/g, '');
  return digits ? `+${digits}` : '';
}

export function getPhoneCountryRule(
  countryCode?: string | null,
  countryName?: string | null,
): PhoneCountryRule | null {
  const country = getCountryByCodeOrName(countryCode || undefined, countryName || undefined);
  if (!country) return null;
  const dialCode = normalizeDialCode(country.phonecode);
  if (!dialCode) return null;
  const iso = String(country.isoCode || '').toUpperCase();
  return {
    isoCode: iso,
    countryName: country.name,
    dialCode,
    nationalLength: NATIONAL_LENGTH_BY_ISO[iso] ?? null,
  };
}

export function digitsOnly(value: string): string {
  return String(value || '').replace(/\D/g, '');
}

/** Strip a known dial code (and optional leading 0) to get national digits. */
export function extractNationalNumber(
  phone: string,
  dialCode?: string | null,
): string {
  let digits = digitsOnly(phone);
  const dialDigits = digitsOnly(dialCode || '');
  if (dialDigits && digits.startsWith(dialDigits)) {
    digits = digits.slice(dialDigits.length);
  }
  // Drop trunk prefix 0 commonly typed after selecting a country.
  if (digits.startsWith('0')) {
    digits = digits.replace(/^0+/, '');
  }
  return digits;
}

export function composeInternationalPhone(
  dialCode: string | null | undefined,
  nationalNumber: string,
): string {
  const national = digitsOnly(nationalNumber).replace(/^0+/, '');
  const dial = normalizeDialCode(dialCode);
  if (!national) return '';
  if (!dial) return national;
  return `${dial}${national}`;
}

export function formatPhoneForDisplay(
  phone: string,
  countryCode?: string | null,
  countryName?: string | null,
): { dialCode: string; nationalNumber: string } {
  const rule = getPhoneCountryRule(countryCode, countryName);
  const dialCode = rule?.dialCode || '';
  return {
    dialCode,
    nationalNumber: extractNationalNumber(phone, dialCode),
  };
}

export function getPhonePlaceholder(
  countryCode?: string | null,
  countryName?: string | null,
): string {
  const rule = getPhoneCountryRule(countryCode, countryName);
  if (!rule) return 'Mobile number';
  if (rule.nationalLength) {
    return `${rule.nationalLength}-digit number`;
  }
  return 'Mobile number';
}

export function validatePhoneForCountry(
  phone: string | null | undefined,
  countryCode?: string | null,
  countryName?: string | null,
  options?: { required?: boolean },
): { valid: boolean; message?: string } {
  const required = Boolean(options?.required);
  const trimmed = String(phone || '').trim();
  if (!trimmed) {
    if (required) return { valid: false, message: 'Mobile number is required' };
    return { valid: true };
  }

  const rule = getPhoneCountryRule(countryCode, countryName);
  const national = extractNationalNumber(trimmed, rule?.dialCode);

  if (!national) {
    return { valid: false, message: 'Enter a valid mobile number' };
  }

  if (rule?.nationalLength != null) {
    if (national.length !== rule.nationalLength) {
      return {
        valid: false,
        message: `${rule.countryName} mobile numbers must be ${rule.nationalLength} digits`,
      };
    }
    return { valid: true };
  }

  if (national.length < 6 || national.length > 15) {
    return { valid: false, message: 'Enter a valid mobile number (6–15 digits)' };
  }
  return { valid: true };
}

/** Re-apply current country dial code to a list of stored phones. */
export function remapPhonesToCountry(
  phones: string[],
  countryCode?: string | null,
  countryName?: string | null,
): string[] {
  const rule = getPhoneCountryRule(countryCode, countryName);
  if (!rule) return phones;
  return phones.map((phone) => {
    const national = extractNationalNumber(phone, rule.dialCode);
    return composeInternationalPhone(rule.dialCode, national);
  });
}
