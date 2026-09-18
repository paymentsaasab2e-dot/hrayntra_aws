/**
 * Table Location column display — Country / State / City / Full address.
 * Forms and drawers keep the full stored location string.
 */

import { resolveCountryFilterLabel } from './cscData';

export type TableLocationInput = {
  location?: string | null;
  country?: string | null;
  city?: string | null;
  state?: string | null;
};

/** What the Location column shows when the header menu is used. */
export type TableLocationDisplayMode = 'country' | 'state' | 'city' | 'all';

export const TABLE_LOCATION_DISPLAY_OPTIONS: Array<{
  id: TableLocationDisplayMode;
  label: string;
  shortLabel: string;
}> = [
  { id: 'country', label: 'Country only', shortLabel: 'Country' },
  { id: 'state', label: 'State only', shortLabel: 'State' },
  { id: 'city', label: 'City only', shortLabel: 'City' },
  { id: 'all', label: 'Full address', shortLabel: 'Address' },
];

export const DEFAULT_TABLE_LOCATION_DISPLAY_MODE: TableLocationDisplayMode = 'country';

const EMPTY_MARKERS = new Set([
  '',
  '—',
  '-',
  '–',
  'not specified',
  'location unavailable',
  'not shared',
  'unknown',
]);

function isEmptyMarker(value: string): boolean {
  return EMPTY_MARKERS.has(value.trim().toLowerCase());
}

function clean(value?: string | null): string {
  const v = String(value || '').trim();
  return !v || isEmptyMarker(v) ? '' : v;
}

function locationParts(location?: string | null): string[] {
  return clean(location)
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part && !isEmptyMarker(part));
}

function resolveCountryValue(input: TableLocationInput): string {
  const country = clean(input.country);
  const location = clean(input.location);
  const hit = resolveCountryFilterLabel({
    country: country || null,
    location: location || null,
  });
  if (hit) return hit;

  const parts = locationParts(location);
  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    if (last.length <= 56) return last;
  }
  return country;
}

function resolveStateValue(input: TableLocationInput): string {
  const explicit = clean(input.state);
  if (explicit) return explicit;
  const parts = locationParts(input.location);
  // City, State, Country
  if (parts.length >= 3) return parts[parts.length - 2];
  return '';
}

function resolveCityValue(input: TableLocationInput): string {
  const explicit = clean(input.city);
  if (explicit) return explicit;
  const parts = locationParts(input.location);
  if (parts.length >= 2) return parts[0];
  // Single segment that is not a known country → treat as city
  if (parts.length === 1) {
    const asCountry = resolveCountryFilterLabel({ location: parts[0] });
    if (!asCountry) return parts[0];
  }
  return '';
}

function resolveFullAddress(input: TableLocationInput): string {
  const direct = clean(input.location);
  if (direct) return direct;
  const joined = [clean(input.city), clean(input.state), resolveCountryValue(input)]
    .filter(Boolean)
    .join(', ');
  return joined;
}

function normalizeInput(
  input?: TableLocationInput | string | null,
): TableLocationInput | null {
  if (input == null) return null;
  if (typeof input === 'string') {
    const raw = input.trim();
    if (!raw || isEmptyMarker(raw)) return null;
    return { location: raw };
  }
  return input;
}

/**
 * Prefer explicit `country`, else parse country from a combined `location` string.
 */
export function formatTableLocationCountry(
  input?: TableLocationInput | string | null,
  empty = '—',
): string {
  return formatTableLocation(input, 'country', empty);
}

/** Format location for table cells according to the selected display mode. */
export function formatTableLocation(
  input?: TableLocationInput | string | null,
  mode: TableLocationDisplayMode = DEFAULT_TABLE_LOCATION_DISPLAY_MODE,
  empty = '—',
): string {
  const normalized = normalizeInput(input);
  if (!normalized) return empty;

  if (mode === 'all') {
    return resolveFullAddress(normalized) || empty;
  }
  if (mode === 'state') {
    return resolveStateValue(normalized) || empty;
  }
  if (mode === 'city') {
    return resolveCityValue(normalized) || empty;
  }
  return resolveCountryValue(normalized) || empty;
}

export function tableLocationModeLabel(mode: TableLocationDisplayMode): string {
  return (
    TABLE_LOCATION_DISPLAY_OPTIONS.find((opt) => opt.id === mode)?.shortLabel || 'Country'
  );
}

export function isTableLocationDisplayMode(value: unknown): value is TableLocationDisplayMode {
  return value === 'country' || value === 'state' || value === 'city' || value === 'all';
}
