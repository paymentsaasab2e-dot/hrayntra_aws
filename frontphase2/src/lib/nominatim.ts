/**
 * Thin client for the public OpenStreetMap / Nominatim search endpoint.
 *
 * Free-tier usage policy reminders:
 *  - No API key required.
 *  - Be polite: limit traffic, debounce input, cancel in-flight requests.
 *  - Respect the public usage policy: https://operations.osmfoundation.org/policies/nominatim/
 *
 * We deliberately keep this module dependency-free so it works on the server
 * (Next.js RSC / SSR) and the browser without polyfills.
 */

/** A single suggestion as exposed to the UI. */
export interface NominatimSuggestion {
  /** Stable identifier (Nominatim's `place_id`). */
  id: string;
  /** Human-readable summary (Nominatim's `display_name`). */
  displayName: string;
  /** Latitude in decimal degrees. */
  latitude: number;
  /** Longitude in decimal degrees. */
  longitude: number;
  /** Resolved city — falls back through town / village / county / municipality. */
  city: string;
  /** Resolved administrative state (or equivalent), if available. */
  state: string;
  /** Resolved country. */
  country: string;
  /** Two-letter country code, if present (uppercase). */
  countryCode?: string;
  /** Lightweight semantic class from Nominatim (e.g. "boundary", "place"). */
  category?: string;
  /** Sub-category from Nominatim (e.g. "city", "village"). */
  type?: string;
}

/** Raw Nominatim response item — only the fields we care about. */
interface NominatimRawItem {
  place_id: number | string;
  display_name?: string;
  lat?: string;
  lon?: string;
  class?: string;
  type?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    hamlet?: string;
    municipality?: string;
    county?: string;
    state?: string;
    state_district?: string;
    region?: string;
    country?: string;
    country_code?: string;
  };
}

const NOMINATIM_ENDPOINT = 'https://nominatim.openstreetmap.org/search';

/** Pick the best "city" candidate Nominatim returns for the requested place. */
function pickCity(addr: NominatimRawItem['address'] | undefined): string {
  if (!addr) return '';
  return (
    addr.city ||
    addr.town ||
    addr.village ||
    addr.hamlet ||
    addr.municipality ||
    addr.county ||
    ''
  );
}

/** Pick the best "state" candidate Nominatim returns. */
function pickState(addr: NominatimRawItem['address'] | undefined): string {
  if (!addr) return '';
  return addr.state || addr.state_district || addr.region || '';
}

function toSuggestion(raw: NominatimRawItem): NominatimSuggestion | null {
  const lat = Number(raw.lat);
  const lon = Number(raw.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return {
    id: String(raw.place_id),
    displayName: raw.display_name || '',
    latitude: lat,
    longitude: lon,
    city: pickCity(raw.address),
    state: pickState(raw.address),
    country: raw.address?.country || '',
    countryCode: raw.address?.country_code ? raw.address.country_code.toUpperCase() : undefined,
    category: raw.class,
    type: raw.type,
  };
}

export interface SearchLocationsOptions {
  /** Maximum number of suggestions to return. Defaults to 6. */
  limit?: number;
  /** Cancel signal for `fetch`. */
  signal?: AbortSignal;
  /** Optional language hint passed to Nominatim (defaults to browser/local). */
  acceptLanguage?: string;
}

/**
 * Search Nominatim for `query` and return parsed suggestions.
 *
 * @throws {Error} when the response is not OK or cannot be parsed as JSON.
 *                Aborts surface as `AbortError` and should be caught/ignored
 *                by callers.
 */
export async function searchLocations(
  query: string,
  options: SearchLocationsOptions = {},
): Promise<NominatimSuggestion[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const params = new URLSearchParams({
    q: trimmed,
    format: 'json',
    addressdetails: '1',
    limit: String(Math.max(1, Math.min(options.limit ?? 6, 20))),
  });

  const url = `${NOMINATIM_ENDPOINT}?${params.toString()}`;
  const headers: HeadersInit = {
    Accept: 'application/json',
  };
  const lang =
    options.acceptLanguage ||
    (typeof navigator !== 'undefined' && navigator.language ? navigator.language : '');
  if (lang) headers['Accept-Language'] = lang;

  const response = await fetch(url, {
    method: 'GET',
    headers,
    signal: options.signal,
    // Browsers ignore custom User-Agent, but a fresh request avoids cached errors.
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Nominatim request failed (${response.status})`);
  }

  const body: unknown = await response.json().catch(() => null);
  if (!Array.isArray(body)) return [];

  const suggestions: NominatimSuggestion[] = [];
  for (const item of body as NominatimRawItem[]) {
    const parsed = toSuggestion(item);
    if (parsed) suggestions.push(parsed);
  }
  return suggestions;
}
