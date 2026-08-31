/**
 * Timezone resolution via country-state-city (countries, states, cities, lat/lng, timezones).
 */

import { City, Country, State } from 'country-state-city';
import type { ICity, ICountry, IState } from 'country-state-city';

export type CscLocationInput = {
  country?: string;
  countryCode?: string;
  state?: string;
  city?: string;
  latitude?: number | null;
  longitude?: number | null;
};

function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ');
}

function parseCoord(value?: string | number | null): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value == null || value === '') return undefined;
  const n = Number.parseFloat(String(value));
  return Number.isFinite(n) ? n : undefined;
}

function findCountry(country?: string, countryCode?: string): ICountry | undefined {
  const code = String(countryCode || '')
    .trim()
    .toUpperCase();
  if (code.length === 2) {
    try {
      const byCode = Country?.getCountryByCode?.(code);
      if (byCode) return byCode;
    } catch {
      /* ignore broken country-state-city export */
    }
  }

  const key = normalizeKey(country || '');
  if (!key) return undefined;

  const all = Array.isArray(Country?.getAllCountries?.()) ? Country.getAllCountries() : [];
  const exact = all.find((c) => normalizeKey(c.name) === key);
  if (exact) return exact;

  const candidates = all.filter((c) => {
    const name = normalizeKey(c.name);
    return key.includes(name) || name.includes(key);
  });
  if (candidates.length === 0) return undefined;

  // Prefer the most specific name (e.g. DRC over "Republic of the Congo").
  return candidates.sort(
    (a, b) => normalizeKey(b.name).length - normalizeKey(a.name).length,
  )[0];
}

function findState(states: IState[], stateName?: string): IState | undefined {
  const key = normalizeKey(stateName || '');
  if (!key) return undefined;

  return states.find((s) => {
    const name = normalizeKey(s.name);
    const iso = s.isoCode.toLowerCase();
    return name === key || name.includes(key) || key.includes(name) || key === iso;
  });
}

function findCity(cities: ICity[], cityName?: string): ICity | undefined {
  const key = normalizeKey(cityName || '');
  if (!key) return undefined;

  return cities.find((c) => {
    const name = normalizeKey(c.name);
    return name === key || name.includes(key) || key.includes(name);
  });
}

/** Pick one IANA zone when a country has multiple entries in CSC. */
function pickTimezoneZone(
  zoneNames: string[],
  countryCode: string,
  options: {
    lat?: number;
    lng?: number;
    city?: string;
    state?: string;
    stateIso?: string;
  },
): string {
  if (zoneNames.length === 0) return '';
  if (zoneNames.length === 1) return zoneNames[0];

  const cityKey = normalizeKey(options.city || '');
  if (cityKey) {
    const byCity = zoneNames.find((zone) => {
      const tail = zone.split('/').pop()?.replace(/_/g, ' ').toLowerCase() || '';
      return tail && (cityKey.includes(tail) || tail.includes(cityKey));
    });
    if (byCity) return byCity;
  }

  const stateKey = normalizeKey(options.state || '');
  if (stateKey) {
    const byState = zoneNames.find((zone) => {
      const tail = zone.split('/').pop()?.replace(/_/g, ' ').toLowerCase() || '';
      return tail && (stateKey.includes(tail) || tail.includes(stateKey.split(' ')[0]));
    });
    if (byState) return byState;
  }

  const lng = options.lng;
  const lat = options.lat;

  if (countryCode === 'CD' && typeof lng === 'number') {
    const lub = zoneNames.find((z) => z.includes('Lubumbashi'));
    const kin = zoneNames.find((z) => z.includes('Kinshasa'));
    if (lng >= 24.5 && lub) return lub;
    if (kin) return kin;
  }

  if (countryCode === 'US' && options.stateIso) {
    const stateZones = zoneNames.filter((z) =>
      z.startsWith('America/') && !z.includes('Argentina'),
    );
    if (stateZones.length === 1) return stateZones[0];
  }

  if (typeof lat === 'number' && typeof lng === 'number') {
    if (countryCode === 'CD') {
      return lng >= 24.5
        ? zoneNames.find((z) => z.includes('Lubumbashi')) || zoneNames[0]
        : zoneNames.find((z) => z.includes('Kinshasa')) || zoneNames[0];
    }
    if (countryCode === 'RU' && lng >= 60) {
      const east = zoneNames.filter((z) => z.startsWith('Asia/'));
      if (east.length) return east[0];
    }
  }

  return zoneNames[0];
}

/**
 * Resolve IANA timezone using country-state-city data (primary source).
 */
export function inferIanaFromCountryStateCity(input: CscLocationInput): string {
  const country = findCountry(input.country, input.countryCode);
  if (!country?.isoCode) return '';

  const states = State.getStatesOfCountry(country.isoCode);
  const state = findState(states, input.state);

  let city: ICity | undefined;
  if (state?.isoCode && input.city) {
    city = findCity(City.getCitiesOfState(country.isoCode, state.isoCode), input.city);
  } else if (input.city) {
    city = findCity(City.getCitiesOfCountry(country.isoCode), input.city);
  }

  const lat =
    parseCoord(city?.latitude) ??
    parseCoord(state?.latitude) ??
    parseCoord(country.latitude) ??
    input.latitude ??
    undefined;

  const lng =
    parseCoord(city?.longitude) ??
    parseCoord(state?.longitude) ??
    parseCoord(country.longitude) ??
    input.longitude ??
    undefined;

  const zoneNames = (country.timezones ?? [])
    .map((tz) => tz.zoneName)
    .filter((z): z is string => Boolean(z && z.trim()));

  return pickTimezoneZone(zoneNames, country.isoCode, {
    lat,
    lng,
    city: input.city,
    state: input.state ?? state?.name,
    stateIso: state?.isoCode,
  });
}

export { getCscCountryOptions } from './cscData';
