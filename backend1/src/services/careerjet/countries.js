/**
 * Careerjet country names for XML <location><country>.
 * Official feed examples use full names (e.g. "United Kingdom"), not ISO codes.
 * https://www.careerjet.com/docs/feeds/xml
 */

const ISO_TO_NAME = Object.freeze({
  IN: 'India',
  US: 'United States',
  UK: 'United Kingdom',
  GB: 'United Kingdom',
  AU: 'Australia',
  CA: 'Canada',
  SG: 'Singapore',
  DE: 'Germany',
  FR: 'France',
  ES: 'Spain',
  IT: 'Italy',
  NL: 'Netherlands',
  NZ: 'New Zealand',
  ZA: 'South Africa',
  BR: 'Brazil',
  MX: 'Mexico',
  PL: 'Poland',
  AT: 'Austria',
  BE: 'Belgium',
  CH: 'Switzerland',
});

const NAME_TO_CANONICAL = Object.freeze({
  INDIA: 'India',
  'UNITED STATES': 'United States',
  USA: 'United States',
  AMERICA: 'United States',
  'UNITED KINGDOM': 'United Kingdom',
  'GREAT BRITAIN': 'United Kingdom',
  UK: 'United Kingdom',
  GB: 'United Kingdom',
  AUSTRALIA: 'Australia',
  CANADA: 'Canada',
  SINGAPORE: 'Singapore',
  GERMANY: 'Germany',
  FRANCE: 'France',
  SPAIN: 'Spain',
  ITALY: 'Italy',
  NETHERLANDS: 'Netherlands',
  'NEW ZEALAND': 'New Zealand',
  'SOUTH AFRICA': 'South Africa',
  BRAZIL: 'Brazil',
  MEXICO: 'Mexico',
  POLAND: 'Poland',
  AUSTRIA: 'Austria',
  BELGIUM: 'Belgium',
  SWITZERLAND: 'Switzerland',
});

function mapCountryName(raw) {
  const v = String(raw || '').trim();
  if (!v) return null;
  const upper = v.toUpperCase();
  if (ISO_TO_NAME[upper]) return ISO_TO_NAME[upper];
  if (NAME_TO_CANONICAL[upper]) return NAME_TO_CANONICAL[upper];
  if (v.length > 2 && v[0] === v[0].toUpperCase()) return v;
  return null;
}

function inferCountryFromLocation(location) {
  const haystack = String(location || '').toUpperCase();
  if (!haystack.trim()) return null;
  for (const [name, canonical] of Object.entries(NAME_TO_CANONICAL)) {
    if (haystack.includes(name)) return canonical;
  }
  return null;
}

function resolveCountryName(job) {
  return (
    mapCountryName(job?.country) ||
    inferCountryFromLocation(job?.location) ||
    inferCountryFromLocation(job?.city) ||
    inferCountryFromLocation(job?.state)
  );
}

module.exports = {
  ISO_TO_NAME,
  mapCountryName,
  inferCountryFromLocation,
  resolveCountryName,
};
