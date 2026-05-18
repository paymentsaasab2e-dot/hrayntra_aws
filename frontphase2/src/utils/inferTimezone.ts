/**
 * Infer a display timezone label from location fields (country / coordinates).
 * Primary source: country-state-city. Fallback: manual maps + coordinates.
 * Stored client timezone values use labels like "IST (UTC+5:30)" or "PST (UTC-8)".
 */

import { inferIanaFromCountryStateCity } from '../lib/cscTimezone';

export type LocationTimezoneInput = {
  country?: string;
  countryCode?: string;
  state?: string;
  city?: string;
  latitude?: number | null;
  longitude?: number | null;
};

/** ISO 3166-1 alpha-2 → primary IANA timezone (single-zone countries). */
const COUNTRY_PRIMARY_TIMEZONE: Record<string, string> = {
  AD: 'Europe/Andorra',
  AE: 'Asia/Dubai',
  AF: 'Asia/Kabul',
  AL: 'Europe/Tirane',
  AM: 'Asia/Yerevan',
  AR: 'America/Argentina/Buenos_Aires',
  AT: 'Europe/Vienna',
  AU: 'Australia/Sydney',
  AZ: 'Asia/Baku',
  BA: 'Europe/Sarajevo',
  BD: 'Asia/Dhaka',
  BE: 'Europe/Brussels',
  BG: 'Europe/Sofia',
  BH: 'Asia/Bahrain',
  BN: 'Asia/Brunei',
  BO: 'America/La_Paz',
  BR: 'America/Sao_Paulo',
  BT: 'Asia/Thimphu',
  BY: 'Europe/Minsk',
  BZ: 'America/Belize',
  CA: 'America/Toronto',
  CH: 'Europe/Zurich',
  CL: 'America/Santiago',
  CN: 'Asia/Shanghai',
  CO: 'America/Bogota',
  CR: 'America/Costa_Rica',
  CU: 'America/Havana',
  CY: 'Asia/Nicosia',
  CZ: 'Europe/Prague',
  DE: 'Europe/Berlin',
  DK: 'Europe/Copenhagen',
  DO: 'America/Santo_Domingo',
  DZ: 'Africa/Algiers',
  EC: 'America/Guayaquil',
  EE: 'Europe/Tallinn',
  EG: 'Africa/Cairo',
  ES: 'Europe/Madrid',
  ET: 'Africa/Addis_Ababa',
  FI: 'Europe/Helsinki',
  FR: 'Europe/Paris',
  GB: 'Europe/London',
  GE: 'Asia/Tbilisi',
  GH: 'Africa/Accra',
  GR: 'Europe/Athens',
  GT: 'America/Guatemala',
  HK: 'Asia/Hong_Kong',
  HN: 'America/Tegucigalpa',
  HR: 'Europe/Zagreb',
  HU: 'Europe/Budapest',
  ID: 'Asia/Jakarta',
  IE: 'Europe/Dublin',
  IL: 'Asia/Jerusalem',
  IN: 'Asia/Kolkata',
  IQ: 'Asia/Baghdad',
  IR: 'Asia/Tehran',
  IS: 'Atlantic/Reykjavik',
  IT: 'Europe/Rome',
  JM: 'America/Jamaica',
  JO: 'Asia/Amman',
  JP: 'Asia/Tokyo',
  KE: 'Africa/Nairobi',
  KG: 'Asia/Bishkek',
  KH: 'Asia/Phnom_Penh',
  KR: 'Asia/Seoul',
  KW: 'Asia/Kuwait',
  KZ: 'Asia/Almaty',
  LA: 'Asia/Vientiane',
  LB: 'Asia/Beirut',
  LK: 'Asia/Colombo',
  LT: 'Europe/Vilnius',
  LU: 'Europe/Luxembourg',
  LV: 'Europe/Riga',
  LY: 'Africa/Tripoli',
  MA: 'Africa/Casablanca',
  MD: 'Europe/Chisinau',
  ME: 'Europe/Podgorica',
  MK: 'Europe/Skopje',
  MM: 'Asia/Yangon',
  MN: 'Asia/Ulaanbaatar',
  MO: 'Asia/Macau',
  MT: 'Europe/Malta',
  MU: 'Indian/Mauritius',
  MV: 'Indian/Maldives',
  MX: 'America/Mexico_City',
  MY: 'Asia/Kuala_Lumpur',
  MZ: 'Africa/Maputo',
  NA: 'Africa/Windhoek',
  NG: 'Africa/Lagos',
  NI: 'America/Managua',
  NL: 'Europe/Amsterdam',
  NO: 'Europe/Oslo',
  NP: 'Asia/Kathmandu',
  NZ: 'Pacific/Auckland',
  OM: 'Asia/Muscat',
  PA: 'America/Panama',
  PE: 'America/Lima',
  PH: 'Asia/Manila',
  PK: 'Asia/Karachi',
  PL: 'Europe/Warsaw',
  PR: 'America/Puerto_Rico',
  PT: 'Europe/Lisbon',
  PY: 'America/Asuncion',
  QA: 'Asia/Qatar',
  RO: 'Europe/Bucharest',
  RS: 'Europe/Belgrade',
  RU: 'Europe/Moscow',
  RW: 'Africa/Kigali',
  SA: 'Asia/Riyadh',
  SE: 'Europe/Stockholm',
  SG: 'Asia/Singapore',
  SI: 'Europe/Ljubljana',
  SK: 'Europe/Bratislava',
  SN: 'Africa/Dakar',
  SV: 'America/El_Salvador',
  TH: 'Asia/Bangkok',
  TN: 'Africa/Tunis',
  TR: 'Europe/Istanbul',
  TW: 'Asia/Taipei',
  TZ: 'Africa/Dar_es_Salaam',
  UA: 'Europe/Kyiv',
  UG: 'Africa/Kampala',
  US: 'America/New_York',
  UY: 'America/Montevideo',
  UZ: 'Asia/Tashkent',
  VE: 'America/Caracas',
  VN: 'Asia/Ho_Chi_Minh',
  YE: 'Asia/Aden',
  ZA: 'Africa/Johannesburg',
  ZM: 'Africa/Lusaka',
  ZW: 'Africa/Harare',
  CD: 'Africa/Kinshasa',
  CG: 'Africa/Brazzaville',
  CM: 'Africa/Douala',
  AO: 'Africa/Luanda',
  MG: 'Indian/Antananarivo',
  SD: 'Africa/Khartoum',
  SS: 'Africa/Juba',
  CI: 'Africa/Abidjan',
  ML: 'Africa/Bamako',
  BF: 'Africa/Ouagadougou',
  NE: 'Africa/Niamey',
  TD: 'Africa/Ndjamena',
  CF: 'Africa/Bangui',
  GA: 'Africa/Libreville',
  GQ: 'Africa/Malabo',
  MW: 'Africa/Blantyre',
};

const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  india: 'IN',
  'united states': 'US',
  'united states of america': 'US',
  usa: 'US',
  'u.s.a.': 'US',
  'united kingdom': 'GB',
  uk: 'GB',
  'great britain': 'GB',
  england: 'GB',
  scotland: 'GB',
  wales: 'GB',
  canada: 'CA',
  australia: 'AU',
  germany: 'DE',
  france: 'FR',
  japan: 'JP',
  china: 'CN',
  brazil: 'BR',
  mexico: 'MX',
  spain: 'ES',
  italy: 'IT',
  netherlands: 'NL',
  singapore: 'SG',
  'south korea': 'KR',
  korea: 'KR',
  'united arab emirates': 'AE',
  uae: 'AE',
  'saudi arabia': 'SA',
  'south africa': 'ZA',
  'new zealand': 'NZ',
  ireland: 'IE',
  switzerland: 'CH',
  sweden: 'SE',
  norway: 'NO',
  denmark: 'DK',
  finland: 'FI',
  poland: 'PL',
  portugal: 'PT',
  belgium: 'BE',
  austria: 'AT',
  israel: 'IL',
  turkey: 'TR',
  indonesia: 'ID',
  malaysia: 'MY',
  thailand: 'TH',
  vietnam: 'VN',
  philippines: 'PH',
  pakistan: 'PK',
  bangladesh: 'BD',
  'sri lanka': 'LK',
  nepal: 'NP',
  russia: 'RU',
  ukraine: 'UA',
  argentina: 'AR',
  chile: 'CL',
  colombia: 'CO',
  peru: 'PE',
  egypt: 'EG',
  nigeria: 'NG',
  kenya: 'KE',
  ghana: 'GH',
  'democratic republic of the congo': 'CD',
  'democratic republic of congo': 'CD',
  'dr congo': 'CD',
  drc: 'CD',
  'congo (kinshasa)': 'CD',
  'republic of the congo': 'CG',
  'congo (brazzaville)': 'CG',
  congo: 'CG',
  tanzania: 'TZ',
  uganda: 'UG',
  ethiopia: 'ET',
  morocco: 'MA',
  algeria: 'DZ',
  tunisia: 'TN',
  libya: 'LY',
  angola: 'AO',
  mozambique: 'MZ',
  zambia: 'ZM',
  zimbabwe: 'ZW',
  cameroon: 'CM',
  'ivory coast': 'CI',
  "côte d'ivoire": 'CI',
  senegal: 'SN',
};

const US_STATE_TIMEZONE: Record<string, string> = {
  al: 'America/Chicago',
  alabama: 'America/Chicago',
  ak: 'America/Anchorage',
  alaska: 'America/Anchorage',
  az: 'America/Phoenix',
  arizona: 'America/Phoenix',
  ar: 'America/Chicago',
  arkansas: 'America/Chicago',
  ca: 'America/Los_Angeles',
  california: 'America/Los_Angeles',
  co: 'America/Denver',
  colorado: 'America/Denver',
  ct: 'America/New_York',
  connecticut: 'America/New_York',
  de: 'America/New_York',
  delaware: 'America/New_York',
  dc: 'America/New_York',
  fl: 'America/New_York',
  florida: 'America/New_York',
  ga: 'America/New_York',
  georgia: 'America/New_York',
  hi: 'Pacific/Honolulu',
  hawaii: 'Pacific/Honolulu',
  id: 'America/Boise',
  idaho: 'America/Boise',
  il: 'America/Chicago',
  illinois: 'America/Chicago',
  in: 'America/Indiana/Indianapolis',
  indiana: 'America/Indiana/Indianapolis',
  ia: 'America/Chicago',
  iowa: 'America/Chicago',
  ks: 'America/Chicago',
  kansas: 'America/Chicago',
  ky: 'America/New_York',
  kentucky: 'America/New_York',
  la: 'America/Chicago',
  louisiana: 'America/Chicago',
  me: 'America/New_York',
  maine: 'America/New_York',
  md: 'America/New_York',
  maryland: 'America/New_York',
  ma: 'America/New_York',
  massachusetts: 'America/New_York',
  mi: 'America/Detroit',
  michigan: 'America/Detroit',
  mn: 'America/Chicago',
  minnesota: 'America/Chicago',
  ms: 'America/Chicago',
  mississippi: 'America/Chicago',
  mo: 'America/Chicago',
  missouri: 'America/Chicago',
  mt: 'America/Denver',
  montana: 'America/Denver',
  ne: 'America/Chicago',
  nebraska: 'America/Chicago',
  nv: 'America/Los_Angeles',
  nevada: 'America/Los_Angeles',
  nh: 'America/New_York',
  'new hampshire': 'America/New_York',
  nj: 'America/New_York',
  'new jersey': 'America/New_York',
  nm: 'America/Denver',
  'new mexico': 'America/Denver',
  ny: 'America/New_York',
  'new york': 'America/New_York',
  nc: 'America/New_York',
  'north carolina': 'America/New_York',
  nd: 'America/Chicago',
  'north dakota': 'America/Chicago',
  oh: 'America/New_York',
  ohio: 'America/New_York',
  ok: 'America/Chicago',
  oklahoma: 'America/Chicago',
  or: 'America/Los_Angeles',
  oregon: 'America/Los_Angeles',
  pa: 'America/New_York',
  pennsylvania: 'America/New_York',
  ri: 'America/New_York',
  'rhode island': 'America/New_York',
  sc: 'America/New_York',
  'south carolina': 'America/New_York',
  sd: 'America/Chicago',
  'south dakota': 'America/Chicago',
  tn: 'America/Chicago',
  tennessee: 'America/Chicago',
  tx: 'America/Chicago',
  texas: 'America/Chicago',
  ut: 'America/Denver',
  utah: 'America/Denver',
  vt: 'America/New_York',
  vermont: 'America/New_York',
  va: 'America/New_York',
  virginia: 'America/New_York',
  wa: 'America/Los_Angeles',
  washington: 'America/Los_Angeles',
  wv: 'America/New_York',
  'west virginia': 'America/New_York',
  wi: 'America/Chicago',
  wisconsin: 'America/Chicago',
  wy: 'America/Denver',
  wyoming: 'America/Denver',
};

const CA_PROVINCE_TIMEZONE: Record<string, string> = {
  ab: 'America/Edmonton',
  alberta: 'America/Edmonton',
  bc: 'America/Vancouver',
  'british columbia': 'America/Vancouver',
  mb: 'America/Winnipeg',
  manitoba: 'America/Winnipeg',
  nb: 'America/Moncton',
  'new brunswick': 'America/Moncton',
  nl: 'America/St_Johns',
  'newfoundland and labrador': 'America/St_Johns',
  ns: 'America/Halifax',
  'nova scotia': 'America/Halifax',
  nt: 'America/Yellowknife',
  nu: 'America/Iqaluit',
  on: 'America/Toronto',
  ontario: 'America/Toronto',
  pe: 'America/Halifax',
  'prince edward island': 'America/Halifax',
  qc: 'America/Toronto',
  quebec: 'America/Toronto',
  sk: 'America/Regina',
  saskatchewan: 'America/Regina',
  yt: 'America/Whitehorse',
  yukon: 'America/Whitehorse',
};

const AU_STATE_TIMEZONE: Record<string, string> = {
  act: 'Australia/Sydney',
  nsw: 'Australia/Sydney',
  'new south wales': 'Australia/Sydney',
  nt: 'Australia/Darwin',
  'northern territory': 'Australia/Darwin',
  qld: 'Australia/Brisbane',
  queensland: 'Australia/Brisbane',
  sa: 'Australia/Adelaide',
  'south australia': 'Australia/Adelaide',
  tas: 'Australia/Hobart',
  tasmania: 'Australia/Hobart',
  vic: 'Australia/Melbourne',
  victoria: 'Australia/Melbourne',
  wa: 'Australia/Perth',
  'western australia': 'Australia/Perth',
};

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\./g, '');
}

export function resolveCountryCode(country?: string, countryCode?: string): string {
  const code = String(countryCode || '')
    .trim()
    .toUpperCase();
  if (code.length === 2) return code;

  const nameKey = normalizeKey(country || '');
  if (nameKey && COUNTRY_NAME_TO_CODE[nameKey]) return COUNTRY_NAME_TO_CODE[nameKey];

  if (nameKey.length >= 3) {
    const direct = Object.entries(COUNTRY_NAME_TO_CODE).find(([k]) => k === nameKey);
    if (direct) return direct[1];
    if (nameKey.includes('democratic republic') && nameKey.includes('congo')) return 'CD';
    if (nameKey.includes('dr congo') || nameKey === 'drc') return 'CD';
    if (nameKey.includes('republic of the congo') || (nameKey.includes('congo') && !nameKey.includes('democratic')))
      return 'CG';
  }
  return '';
}

function resolveRegionalTimezone(
  countryCode: string,
  state?: string,
): string {
  const stateKey = normalizeKey(state || '');
  if (!stateKey) return '';

  if (countryCode === 'US') return US_STATE_TIMEZONE[stateKey] || '';
  if (countryCode === 'CA') return CA_PROVINCE_TIMEZONE[stateKey] || '';
  if (countryCode === 'AU') return AU_STATE_TIMEZONE[stateKey] || '';
  return '';
}

/** Rough bounding-box fallback when only coordinates are known. */
function inferTimezoneFromCoordinates(lat: number, lng: number): string {
  if (lat >= 24 && lat <= 37 && lng >= 68 && lng <= 98) return 'Asia/Kolkata';
  if (lat >= 35 && lat <= 72 && lng >= -10 && lng <= 40) return 'Europe/London';
  if (lat >= 25 && lat <= 50 && lng >= -125 && lng <= -65) return 'America/New_York';
  if (lat >= -45 && lat <= -10 && lng >= 110 && lng <= 155) return 'Australia/Sydney';
  if (lat >= 30 && lat <= 46 && lng >= 125 && lng <= 146) return 'Asia/Tokyo';
  if (lat >= 18 && lat <= 54 && lng >= 73 && lng <= 135) return 'Asia/Shanghai';
  if (lat >= -35 && lat <= 5 && lng >= -75 && lng <= -34) return 'America/Sao_Paulo';
  if (lat >= 10 && lat <= 30 && lng >= 95 && lng <= 110) return 'Asia/Bangkok';
  if (lat >= -5 && lat <= 8 && lng >= 95 && lng <= 141) return 'Asia/Jakarta';
  if (lat >= 4 && lat <= 14 && lng >= 115 && lng <= 127) return 'Asia/Manila';
  if (lat >= 24 && lat <= 32 && lng >= 34 && lng <= 56) return 'Asia/Dubai';
  if (lat >= -35 && lat <= -22 && lng >= 16 && lng <= 33) return 'Africa/Johannesburg';
  // Central / eastern Africa (DRC, Tanzania, Zambia, Malawi, etc.)
  if (lat >= -14 && lat <= 6 && lng >= 12 && lng <= 42) {
    if (lng >= 28) return 'Africa/Nairobi';
    if (lng >= 24) return 'Africa/Lubumbashi';
    return 'Africa/Kinshasa';
  }
  if (lat >= -12 && lat <= 5 && lng >= 28 && lng <= 42) return 'Africa/Nairobi';
  return '';
}

export function inferIanaTimezone(input: LocationTimezoneInput): string {
  const fromCsc = inferIanaFromCountryStateCity(input);
  if (fromCsc) return fromCsc;

  const countryCode = resolveCountryCode(input.country, input.countryCode);
  if (countryCode) {
    const regional = resolveRegionalTimezone(countryCode, input.state);
    if (regional) return regional;
    if (COUNTRY_PRIMARY_TIMEZONE[countryCode]) return COUNTRY_PRIMARY_TIMEZONE[countryCode];
  }

  if (typeof input.latitude === 'number' && typeof input.longitude === 'number') {
    const fromCoords = inferTimezoneFromCoordinates(input.latitude, input.longitude);
    if (fromCoords) return fromCoords;
  }

  return '';
}

/** Human-readable label for client timezone field (e.g. "IST (UTC+5:30)"). */
export function formatTimezoneDisplay(ianaTimeZone: string): string {
  const iana = String(ianaTimeZone || '').trim();
  if (!iana) return '';

  try {
    const now = new Date();
    const short =
      new Intl.DateTimeFormat('en-US', { timeZone: iana, timeZoneName: 'short' })
        .formatToParts(now)
        .find((p) => p.type === 'timeZoneName')?.value ?? '';
    const offset =
      new Intl.DateTimeFormat('en-US', { timeZone: iana, timeZoneName: 'longOffset' })
        .formatToParts(now)
        .find((p) => p.type === 'timeZoneName')?.value ?? '';

    const friendlyShort =
      short && !/^gmt/i.test(short) ? short : iana.split('/').pop()?.replace(/_/g, ' ') ?? iana;
    const offsetLabel = offset ? offset.replace(/^GMT/i, 'UTC') : '';
    return offsetLabel ? `${friendlyShort} (${offsetLabel})` : friendlyShort;
  } catch {
    return iana;
  }
}

export function inferTimezoneDisplay(input: LocationTimezoneInput): string {
  const iana = inferIanaTimezone(input);
  return iana ? formatTimezoneDisplay(iana) : '';
}

export type TimezoneSelectOption = { label: string; value: string };

/** Curated IANA zones for manual client timezone selection. */
const CLIENT_TIMEZONE_IANA: string[] = [
  'UTC',
  'Asia/Kolkata',
  'Asia/Dubai',
  'Asia/Karachi',
  'Asia/Dhaka',
  'Asia/Colombo',
  'Asia/Kathmandu',
  'Asia/Singapore',
  'Asia/Bangkok',
  'Asia/Jakarta',
  'Asia/Manila',
  'Asia/Hong_Kong',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Asia/Jerusalem',
  'Asia/Riyadh',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Amsterdam',
  'Europe/Madrid',
  'Europe/Rome',
  'Europe/Zurich',
  'Europe/Stockholm',
  'Europe/Warsaw',
  'Europe/Istanbul',
  'Europe/Moscow',
  'Africa/Cairo',
  'Africa/Johannesburg',
  'Africa/Kinshasa',
  'Africa/Lubumbashi',
  'Africa/Brazzaville',
  'Africa/Lagos',
  'Africa/Nairobi',
  'Africa/Lusaka',
  'Africa/Maputo',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Phoenix',
  'America/Los_Angeles',
  'America/Toronto',
  'America/Vancouver',
  'America/Mexico_City',
  'America/Sao_Paulo',
  'America/Buenos_Aires',
  'America/Bogota',
  'Pacific/Auckland',
  'Australia/Sydney',
  'Australia/Melbourne',
  'Australia/Brisbane',
  'Australia/Perth',
];

export const CLIENT_TIMEZONE_OPTIONS: TimezoneSelectOption[] = CLIENT_TIMEZONE_IANA.map((iana) => {
  const label = formatTimezoneDisplay(iana);
  return { label, value: label };
})
  .filter((opt, index, list) => list.findIndex((o) => o.value === opt.value) === index)
  .sort((a, b) => a.label.localeCompare(b.label));

/** Options for timezone select — includes legacy/custom value when not in the curated list. */
export function buildClientTimezoneSelectOptions(currentValue?: string): TimezoneSelectOption[] {
  const current = String(currentValue || '').trim();
  if (current && !CLIENT_TIMEZONE_OPTIONS.some((o) => o.value === current)) {
    return [{ label: current, value: current }, ...CLIENT_TIMEZONE_OPTIONS];
  }
  return CLIENT_TIMEZONE_OPTIONS;
}
