/**
 * Location search (Nominatim) and resolve (OpenAI → Mistral → Nominatim fallback).
 * Used by Add Lead / client drawers for city + country autofill.
 */

import { env } from '../config/env.js';
import { chatCompletionWithFallback, hasLlmProvider } from './llmChatFallback.service.js';

const NOMINATIM_ENDPOINT = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_REVERSE_ENDPOINT = 'https://nominatim.openstreetmap.org/reverse';
const NOMINATIM_USER_AGENT =
  process.env.NOMINATIM_USER_AGENT ||
  'HrayntraCRM/1.0 (location-autocomplete; contact: support@hrayntra.com)';

function pickCity(addr) {
  if (!addr) return '';
  return (
    addr.city ||
    addr.town ||
    addr.village ||
    addr.hamlet ||
    addr.municipality ||
    addr.county ||
    ''
  ).trim();
}

function pickState(addr) {
  if (!addr) return '';
  return (addr.state || addr.state_district || addr.region || '').trim();
}

function parseNominatimItem(raw) {
  const lat = Number(raw?.lat);
  const lon = Number(raw?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const addr = raw.address || {};
  const city = pickCity(addr);
  const state = pickState(addr);
  const country = (addr.country || '').trim();
  const displayName = (raw.display_name || '').trim();
  return {
    id: String(raw.place_id),
    displayName,
    latitude: lat,
    longitude: lon,
    city: city || displayName.split(',')[0]?.trim() || '',
    state,
    country,
    countryCode: addr.country_code ? String(addr.country_code).toUpperCase() : undefined,
    category: raw.class,
    type: raw.type,
  };
}

function toResolvedPayload(suggestion, provider) {
  if (!suggestion) return null;
  return {
    location: suggestion.displayName,
    city: suggestion.city,
    state: suggestion.state,
    country: suggestion.country,
    latitude: suggestion.latitude,
    longitude: suggestion.longitude,
    countryCode: suggestion.countryCode,
    provider,
  };
}

async function fetchNominatimRaw(query, limit = 8, signal) {
  const trimmed = String(query || '').trim();
  if (!trimmed) return [];

  const params = new URLSearchParams({
    q: trimmed,
    format: 'json',
    addressdetails: '1',
    limit: String(Math.max(1, Math.min(limit, 20))),
  });

  const response = await fetch(`${NOMINATIM_ENDPOINT}?${params.toString()}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'en',
      'User-Agent': NOMINATIM_USER_AGENT,
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(`Nominatim request failed (${response.status})`);
  }

  const body = await response.json().catch(() => null);
  if (!Array.isArray(body)) return [];
  return body;
}

/**
 * @param {string} query
 * @param {{ limit?: number, signal?: AbortSignal }} [options]
 */
export async function searchLocations(query, options = {}) {
  const raw = await fetchNominatimRaw(query, options.limit ?? 8, options.signal);
  const suggestions = [];
  for (const item of raw) {
    const parsed = parseNominatimItem(item);
    if (parsed?.displayName) suggestions.push(parsed);
  }
  return suggestions;
}

function normalizeLlmLocation(parsed, originalQuery) {
  if (!parsed || typeof parsed !== 'object') return null;
  const city = String(parsed.city || '').trim();
  const state = String(parsed.state || '').trim();
  const country = String(parsed.country || '').trim();
  const location =
    String(parsed.location || '').trim() ||
    [city, state, country].filter(Boolean).join(', ') ||
    String(originalQuery).trim();

  if (!city && !country) return null;

  const lat = Number(parsed.latitude);
  const lon = Number(parsed.longitude);

  return {
    location,
    city,
    state,
    country,
    latitude: Number.isFinite(lat) ? lat : undefined,
    longitude: Number.isFinite(lon) ? lon : undefined,
    countryCode: parsed.countryCode ? String(parsed.countryCode).toUpperCase() : undefined,
    provider: 'llm',
  };
}

async function resolveWithLlm(query) {
  if (!hasLlmProvider()) return null;

  const completion = await chatCompletionWithFallback(
    {
      model: env.OPENAI_CHAT_MODEL,
      temperature: 0,
      max_tokens: 350,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: [
            'You resolve free-text place names into structured location fields for a CRM.',
            'Return JSON only with keys: location, city, state, country, latitude, longitude.',
            'Use full English country names (e.g. "India", "United States").',
            'city is the locality (city/town/village). state is region/state if known, else empty string.',
            'location is a human-readable label like "Panvel, Maharashtra, India".',
            'latitude/longitude are decimal degrees when you are confident, otherwise omit or null.',
            'If the input is ambiguous, pick the most likely major place.',
          ].join(' '),
        },
        {
          role: 'user',
          content: `Resolve this location for a business lead form: "${String(query).trim()}"`,
        },
      ],
    },
    'location-resolve',
    { quiet: true }
  );

  const raw = completion?.choices?.[0]?.message?.content?.trim();
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    const normalized = normalizeLlmLocation(parsed, query);
    if (normalized?.city && normalized?.country) return normalized;
    if (normalized?.country && normalized?.location) return normalized;
    return null;
  } catch {
    return null;
  }
}

/**
 * Resolve a location string: OpenAI gpt-4.1 → Nominatim top hit.
 * @param {string} query
 */
export async function resolveLocation(query) {
  const trimmed = String(query || '').trim();
  if (trimmed.length < 2) {
    const err = new Error('Location query must be at least 2 characters');
    err.code = 'VALIDATION';
    throw err;
  }

  if (hasLlmProvider()) {
    try {
      const llm = await resolveWithLlm(trimmed);
      if (llm?.country) {
        return {
          ...llm,
          latitude: llm.latitude ?? 0,
          longitude: llm.longitude ?? 0,
          provider: llm.provider || 'llm',
        };
      }
    } catch (err) {
      console.warn('[location-resolve] LLM failed, using Nominatim:', err?.message || err);
    }
  }

  const suggestions = await searchLocations(trimmed, { limit: 1 });
  const top = suggestions[0];
  const resolved = toResolvedPayload(top, 'nominatim');
  if (!resolved?.country) {
    const err = new Error('Could not resolve location');
    err.code = 'NOT_FOUND';
    throw err;
  }
  return resolved;
}

/**
 * Reverse geocode coordinates via Nominatim (lat/lng → structured address).
 * @param {number} latitude
 * @param {number} longitude
 */
export async function reverseGeocode(latitude, longitude) {
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    const err = new Error('Valid latitude and longitude are required');
    err.code = 'VALIDATION';
    throw err;
  }
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    const err = new Error('Latitude must be between -90 and 90, longitude between -180 and 180');
    err.code = 'VALIDATION';
    throw err;
  }

  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    format: 'json',
    addressdetails: '1',
    zoom: '18',
  });

  const response = await fetch(`${NOMINATIM_REVERSE_ENDPOINT}?${params.toString()}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'en',
      'User-Agent': NOMINATIM_USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error(`Nominatim reverse request failed (${response.status})`);
  }

  const raw = await response.json().catch(() => null);
  const parsed = parseNominatimItem(raw);
  const resolved = toResolvedPayload(parsed, 'nominatim-reverse');
  if (!resolved?.location) {
    const err = new Error('Could not resolve coordinates to an address');
    err.code = 'NOT_FOUND';
    throw err;
  }
  return resolved;
}
