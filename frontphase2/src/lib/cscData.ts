/**
 * country-state-city helpers for location search and cascading country / state / city fields.
 */

import { City, Country, State } from 'country-state-city';
import type { ICity, ICountry, IState } from 'country-state-city';
import type { LocationSelection } from '../components/LocationAutocomplete';

function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ');
}

function safeGetAllCountries(): ICountry[] {
  try {
    const fn = Country?.getAllCountries;
    if (typeof fn !== 'function') return [];
    const all = fn.call(Country);
    return Array.isArray(all) ? all : [];
  } catch {
    return [];
  }
}

function safeGetStatesOfCountry(code: string): IState[] {
  try {
    const fn = State?.getStatesOfCountry;
    if (typeof fn !== 'function') return [];
    const all = fn.call(State, code);
    return Array.isArray(all) ? all : [];
  } catch {
    return [];
  }
}

function safeGetCitiesOfState(countryCode: string, stateIso: string): ICity[] {
  try {
    const fn = City?.getCitiesOfState;
    if (typeof fn !== 'function') return [];
    const all = fn.call(City, countryCode, stateIso);
    return Array.isArray(all) ? all : [];
  } catch {
    return [];
  }
}

function safeGetCitiesOfCountry(countryCode: string): ICity[] {
  try {
    const fn = City?.getCitiesOfCountry;
    if (typeof fn !== 'function') return [];
    const all = fn.call(City, countryCode);
    return Array.isArray(all) ? all : [];
  } catch {
    return [];
  }
}

function safeGetAllCities(): ICity[] {
  try {
    const fn = City?.getAllCities;
    if (typeof fn !== 'function') return [];
    const all = fn.call(City);
    return Array.isArray(all) ? all : [];
  } catch {
    return [];
  }
}

function safeGetCountryByCode(code: string): ICountry | undefined {
  try {
    const fn = Country?.getCountryByCode;
    if (typeof fn !== 'function') return undefined;
    return fn.call(Country, code) || undefined;
  } catch {
    return undefined;
  }
}

function parseCoord(value?: string | number | null): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value == null || value === '') return 0;
  const n = Number.parseFloat(String(value));
  return Number.isFinite(n) ? n : 0;
}

export type CscCountryOption = { label: string; value: string };
export type CscStateOption = { label: string; value: string; name: string };
export type CscCityOption = { label: string; value: string; name: string };

export function getCscCountryOptions(): CscCountryOption[] {
  return safeGetAllCountries()
    .map((c) => ({ label: c.name, value: c.isoCode }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function getCountryByCodeOrName(
  countryCode?: string,
  countryName?: string,
): ICountry | undefined {
  const code = String(countryCode || '')
    .trim()
    .toUpperCase();
  if (code.length === 2) {
    const byCode = safeGetCountryByCode(code);
    if (byCode) return byCode;
  }

  const key = normalizeKey(countryName || '');
  if (!key) return undefined;

  const all = safeGetAllCountries();
  const exact = all.find((c) => normalizeKey(c.name) === key);
  if (exact) return exact;

  const candidates = all.filter((c) => {
    const name = normalizeKey(c.name);
    return key.includes(name) || name.includes(key);
  });
  if (candidates.length === 0) return undefined;

  return candidates.sort(
    (a, b) => normalizeKey(b.name).length - normalizeKey(a.name).length,
  )[0];
}

export function getCscStateOptions(countryCode: string): CscStateOption[] {
  const code = countryCode.trim().toUpperCase();
  if (!code) return [];
  return safeGetStatesOfCountry(code)
    .map((s) => ({ label: s.name, value: s.isoCode, name: s.name }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function findStateByNameOrIso(
  countryCode: string,
  state?: string,
): IState | undefined {
  const key = normalizeKey(state || '');
  if (!key) return undefined;
  return safeGetStatesOfCountry(countryCode).find((s) => {
    const name = normalizeKey(s.name);
    const iso = s.isoCode.toLowerCase();
    return name === key || name.includes(key) || key.includes(name) || key === iso;
  });
}

export function getCscCityOptions(countryCode: string, stateIso?: string): CscCityOption[] {
  const code = countryCode.trim().toUpperCase();
  if (!code) return [];

  const cities = stateIso
    ? safeGetCitiesOfState(code, stateIso)
    : safeGetCitiesOfCountry(code);

  return cities
    .map((c) => ({ label: c.name, value: c.name, name: c.name }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function findCityRecord(
  countryCode: string,
  cityName?: string,
  stateIso?: string,
): ICity | undefined {
  const key = normalizeKey(cityName || '');
  if (!key) return undefined;

  const pool = stateIso
    ? safeGetCitiesOfState(countryCode, stateIso)
    : safeGetCitiesOfCountry(countryCode);

  return pool.find((c) => {
    const name = normalizeKey(c.name);
    return name === key || name.includes(key) || key.includes(name);
  });
}

export function cityToLocationSelection(city: ICity): LocationSelection {
  const country = safeGetCountryByCode(city.countryCode);
  const state = safeGetStatesOfCountry(city.countryCode).find((s) => s.isoCode === city.stateCode);
  const parts = [city.name, state?.name, country?.name].filter(Boolean);

  return {
    location: parts.join(', '),
    city: city.name,
    state: state?.name ?? '',
    country: country?.name ?? '',
    countryCode: city.countryCode,
    latitude: parseCoord(city.latitude),
    longitude: parseCoord(city.longitude),
  };
}

export function countryToLocationSelection(
  country: ICountry,
  partial?: { state?: string; city?: string },
): LocationSelection {
  const state = partial?.state ?? '';
  const city = partial?.city ?? '';
  const parts = [city, state, country.name].filter(Boolean);

  return {
    location: parts.join(', ') || country.name,
    city,
    state,
    country: country.name,
    countryCode: country.isoCode,
    latitude: parseCoord(country.latitude),
    longitude: parseCoord(country.longitude),
  };
}

export function stateToLocationSelection(
  country: ICountry,
  state: IState,
  cityName?: string,
): LocationSelection {
  const cityRecord = cityName
    ? findCityRecord(country.isoCode, cityName, state.isoCode)
    : undefined;

  if (cityRecord) return cityToLocationSelection(cityRecord);

  const parts = [cityName, state.name, country.name].filter(Boolean);
  return {
    location: parts.join(', '),
    city: cityName ?? '',
    state: state.name,
    country: country.name,
    countryCode: country.isoCode,
    latitude: parseCoord(state.latitude),
    longitude: parseCoord(state.longitude),
  };
}

let citySearchIndex: ICity[] | null = null;
let citySearchIndexPromise: Promise<ICity[]> | null = null;

export function loadCitySearchIndex(): Promise<ICity[]> {
  if (citySearchIndex) return Promise.resolve(citySearchIndex);
  if (!citySearchIndexPromise) {
    citySearchIndexPromise = Promise.resolve().then(() => {
      citySearchIndex = safeGetAllCities();
      return citySearchIndex;
    });
  }
  return citySearchIndexPromise;
}

function getCitySearchIndex(): ICity[] {
  if (!citySearchIndex) citySearchIndex = safeGetAllCities();
  return citySearchIndex;
}

export type CscCitySearchHit = {
  city: ICity;
  countryName: string;
  stateName: string;
  displayName: string;
};

/** Resolve city → state/country when only a city name is known (e.g. Hyderabad → Telangana, India). */
export function inferLocationFromCityName(
  cityName: string,
  hints?: { country?: string; countryCode?: string; state?: string },
): LocationSelection | null {
  const trimmed = cityName.trim();
  if (!trimmed) return null;

  const country = getCountryByCodeOrName(hints?.countryCode, hints?.country);
  if (country) {
    const stateRecord = hints?.state
      ? findStateByNameOrIso(country.isoCode, hints.state)
      : undefined;
    const cityRecord = findCityRecord(country.isoCode, trimmed, stateRecord?.isoCode);
    if (cityRecord) return cityToLocationSelection(cityRecord);
  }

  const key = normalizeKey(trimmed);
  const hits = searchCscCities(trimmed, 12);
  const exact = hits.find((h) => normalizeKey(h.city.name) === key);
  const hit = exact ?? hits[0];
  if (!hit) return null;
  return cityToLocationSelection(hit.city);
}

export function searchCscCities(query: string, limit = 25): CscCitySearchHit[] {
  const key = normalizeKey(query);
  if (key.length < 2) return [];

  const all = getCitySearchIndex();
  const prefixHits: CscCitySearchHit[] = [];
  const containsHits: CscCitySearchHit[] = [];

  for (const city of all) {
    const nameKey = normalizeKey(city.name);
    if (!nameKey.includes(key)) continue;

    const country = safeGetCountryByCode(city.countryCode);
    const state = safeGetStatesOfCountry(city.countryCode).find((s) => s.isoCode === city.stateCode);
    const hit: CscCitySearchHit = {
      city,
      countryName: country?.name ?? city.countryCode,
      stateName: state?.name ?? '',
      displayName: [city.name, state?.name, country?.name].filter(Boolean).join(', '),
    };

    if (nameKey.startsWith(key)) {
      prefixHits.push(hit);
      if (prefixHits.length >= limit) break;
    } else if (containsHits.length < limit) {
      containsHits.push(hit);
    }
  }

  const merged = [...prefixHits, ...containsHits];
  return merged.slice(0, limit);
}
