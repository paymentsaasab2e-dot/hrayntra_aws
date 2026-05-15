/**
 * Backend-proxied location search + resolve (OpenAI → Mistral → Nominatim).
 */

import { apiFetch } from './api';

export interface LocationSuggestionDto {
  id: string;
  displayName: string;
  latitude: number;
  longitude: number;
  city: string;
  state: string;
  country: string;
  countryCode?: string;
  category?: string;
  type?: string;
}

export interface ResolvedLocationDto {
  location: string;
  city: string;
  state: string;
  country: string;
  latitude: number;
  longitude: number;
  countryCode?: string;
  provider?: string;
}

export async function apiSearchLocations(
  query: string,
  options?: { limit?: number; signal?: AbortSignal },
): Promise<LocationSuggestionDto[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const params = new URLSearchParams({ q: trimmed });
  if (options?.limit) params.set('limit', String(options.limit));

  const res = await apiFetch<{ suggestions: LocationSuggestionDto[] }>(
    `/ai/location/search?${params.toString()}`,
    { method: 'GET', auth: true, signal: options?.signal },
  );
  return Array.isArray(res.data?.suggestions) ? res.data.suggestions : [];
}

export async function apiResolveLocation(query: string): Promise<ResolvedLocationDto> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    throw new Error('Location must be at least 2 characters');
  }
  const res = await apiFetch<ResolvedLocationDto>('/ai/location/resolve', {
    method: 'POST',
    auth: true,
    body: { query: trimmed },
  });
  return res.data;
}
