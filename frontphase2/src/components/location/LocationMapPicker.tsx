'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Loader2, MapPin, Navigation } from 'lucide-react';
import type { LocationSelection } from '../LocationAutocomplete';
import { apiReverseGeocode } from '../../lib/location-api';

export type DeviceLocationMode = 'off' | 'country-preview' | 'autofill';

export interface LocationMapPickerProps {
  latitude: number | null;
  longitude: number | null;
  onSelect: (selection: LocationSelection) => void;
  disabled?: boolean;
  className?: string;
  /** Change when surrounding layout changes (e.g. tab switch) so the map recalculates size. */
  layoutKey?: string | number;
  /**
   * @deprecated Prefer `deviceLocationMode`.
   * When true (default), reverse-geocodes device location into the form.
   */
  useDeviceLocationAsDefault?: boolean;
  /**
   * - `off`: no browser geolocation
   * - `country-preview`: center map on user's country only (no form autofill)
   * - `autofill`: pin + reverse-geocode into form (legacy default)
   */
  deviceLocationMode?: DeviceLocationMode;
}

const DEFAULT_CENTER = { lat: 20.5937, lng: 78.9629 };
const DEFAULT_ZOOM = 5;
const SELECTED_ZOOM = 14;
const DEVICE_LOCATION_ZOOM = 13;
const COUNTRY_PREVIEW_ZOOM = 5;

/** English-friendly basemap — avoids OSM default tiles mixing Latin, Arabic, Tifinagh, etc. */
const MAP_TILE_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
const MAP_TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

function resolveDeviceLocationMode(
  mode: DeviceLocationMode | undefined,
  useDeviceLocationAsDefault: boolean,
): DeviceLocationMode {
  if (mode) return mode;
  return useDeviceLocationAsDefault ? 'autofill' : 'off';
}

function toSelection(resolved: {
  location: string;
  city: string;
  state: string;
  country: string;
  latitude: number;
  longitude: number;
  countryCode?: string;
}): LocationSelection {
  return {
    location: resolved.location,
    city: resolved.city,
    state: resolved.state,
    country: resolved.country,
    latitude: resolved.latitude,
    longitude: resolved.longitude,
    countryCode: resolved.countryCode,
  };
}

/**
 * Interactive OpenStreetMap preview — click to pick a location (reverse geocoded via backend).
 */
export function LocationMapPicker({
  latitude,
  longitude,
  onSelect,
  disabled,
  className = '',
  layoutKey,
  useDeviceLocationAsDefault = true,
  deviceLocationMode,
}: LocationMapPickerProps) {
  const resolvedDeviceMode = resolveDeviceLocationMode(deviceLocationMode, useDeviceLocationAsDefault);
  const useGeolocation = resolvedDeviceMode !== 'off';
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('leaflet').Map | null>(null);
  const markerRef = useRef<import('leaflet').Marker | null>(null);
  const leafletRef = useRef<typeof import('leaflet') | null>(null);
  const reverseAbortRef = useRef<AbortController | null>(null);
  const reverseGenerationRef = useRef(0);
  const onSelectRef = useRef(onSelect);
  const disabledRef = useRef(disabled);
  const handleMapClickRef = useRef<(lat: number, lng: number) => Promise<void>>(async () => {});
  const didApplyDeviceLocationRef = useRef(false);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);

  const [ready, setReady] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [locatingDevice, setLocatingDevice] = useState(false);
  const [deviceLocation, setDeviceLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [previewCountry, setPreviewCountry] = useState<string | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  const hasCoords =
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude);

  handleMapClickRef.current = async (lat: number, lng: number) => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L || disabledRef.current) return;

    const latLng = { lat, lng };
    if (markerRef.current) {
      markerRef.current.setLatLng(latLng);
    } else {
      markerRef.current = L.marker(latLng).addTo(map);
    }

    reverseAbortRef.current?.abort();
    const controller = new AbortController();
    reverseAbortRef.current = controller;
    const generation = ++reverseGenerationRef.current;

    setResolving(true);
    try {
      const resolved = await apiReverseGeocode(lat, lng, { signal: controller.signal });
      if (generation !== reverseGenerationRef.current) return;
      onSelectRef.current(toSelection(resolved));
    } catch {
      if (controller.signal.aborted) return;
      onSelectRef.current({
        location: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        city: '',
        state: '',
        country: '',
        latitude: lat,
        longitude: lng,
      });
    } finally {
      if (generation === reverseGenerationRef.current) {
        setResolving(false);
      }
    }
  };

  // Request browser geolocation when preview/autofill is enabled and no coords yet.
  useEffect(() => {
    if (!useGeolocation || hasCoords || disabled) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;

    let cancelled = false;
    setLocatingDevice(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (cancelled) return;
        setDeviceLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocatingDevice(false);
      },
      () => {
        if (!cancelled) setLocatingDevice(false);
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 5 * 60 * 1000 },
    );

    return () => {
      cancelled = true;
    };
  }, [useGeolocation, hasCoords, disabled]);

  useEffect(() => {
    let cancelled = false;

    async function initMap() {
      if (!containerRef.current || mapRef.current) return;

      try {
        const L = await import('leaflet');
        await import('leaflet/dist/leaflet.css');

        if (cancelled || !containerRef.current) return;

        leafletRef.current = L;

        // Fix default marker icons in bundled Next.js builds.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl:
            'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
          shadowUrl:
            'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        });

        const initialCenter = hasCoords
          ? { lat: latitude as number, lng: longitude as number }
          : resolvedDeviceMode === 'autofill' && deviceLocation
            ? deviceLocation
            : DEFAULT_CENTER;
        const initialZoom = hasCoords
          ? SELECTED_ZOOM
          : resolvedDeviceMode === 'autofill' && deviceLocation
            ? DEVICE_LOCATION_ZOOM
            : DEFAULT_ZOOM;

        const map = L.map(containerRef.current, {
          center: initialCenter,
          zoom: initialZoom,
          scrollWheelZoom: !disabled,
          dragging: !disabled,
          doubleClickZoom: !disabled,
          touchZoom: !disabled,
        });

        L.tileLayer(MAP_TILE_URL, {
          attribution: MAP_TILE_ATTRIBUTION,
          subdomains: 'abcd',
          maxZoom: 20,
        }).addTo(map);

        if (hasCoords) {
          markerRef.current = L.marker(initialCenter).addTo(map);
        }

        map.on('click', (event) => {
          if (disabledRef.current) return;
          void handleMapClickRef.current(event.latlng.lat, event.latlng.lng);
        });

        mapRef.current = map;
        setReady(true);
      } catch (err) {
        if (!cancelled) {
          setMapError(err instanceof Error ? err.message : 'Failed to load map');
        }
      }
    }

    void initMap();

    return () => {
      cancelled = true;
      reverseAbortRef.current?.abort();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const timer = window.setTimeout(() => map.invalidateSize(), 150);
    return () => window.clearTimeout(timer);
  }, [ready, layoutKey]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    map.scrollWheelZoom[disabled ? 'disable' : 'enable']();
    if (disabled) {
      map.dragging.disable();
      map.doubleClickZoom.disable();
      map.touchZoom.disable();
    } else {
      map.dragging.enable();
      map.doubleClickZoom.enable();
      map.touchZoom.enable();
    }
  }, [disabled, ready]);

  // Apply selected coords, country-only preview, or device autofill.
  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L || !ready) return;

    if (hasCoords) {
      const latLng = { lat: latitude as number, lng: longitude as number };
      if (markerRef.current) {
        markerRef.current.setLatLng(latLng);
      } else {
        markerRef.current = L.marker(latLng).addTo(map);
      }
      map.setView(latLng, Math.max(map.getZoom(), SELECTED_ZOOM), { animate: true });
      return;
    }

    if (deviceLocation && resolvedDeviceMode === 'country-preview') {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      map.setView(deviceLocation, COUNTRY_PREVIEW_ZOOM, { animate: true });

      if (!didApplyDeviceLocationRef.current && !disabled) {
        didApplyDeviceLocationRef.current = true;
        reverseAbortRef.current?.abort();
        const controller = new AbortController();
        reverseAbortRef.current = controller;
        const generation = ++reverseGenerationRef.current;
        setResolving(true);
        void apiReverseGeocode(deviceLocation.lat, deviceLocation.lng, { signal: controller.signal })
          .then((resolved) => {
            if (generation !== reverseGenerationRef.current) return;
            const countryLabel = String(resolved.country || '').trim();
            if (countryLabel) setPreviewCountry(countryLabel);
            if (
              typeof resolved.latitude === 'number' &&
              typeof resolved.longitude === 'number' &&
              Number.isFinite(resolved.latitude) &&
              Number.isFinite(resolved.longitude)
            ) {
              map.setView(
                { lat: resolved.latitude, lng: resolved.longitude },
                COUNTRY_PREVIEW_ZOOM,
                { animate: true },
              );
            }
          })
          .catch(() => {
            /* keep coarse device center */
          })
          .finally(() => {
            if (generation === reverseGenerationRef.current) {
              setResolving(false);
            }
          });
      }
      return;
    }

    if (deviceLocation && resolvedDeviceMode === 'autofill') {
      if (markerRef.current) {
        markerRef.current.setLatLng(deviceLocation);
      } else {
        markerRef.current = L.marker(deviceLocation).addTo(map);
      }
      map.setView(deviceLocation, Math.max(map.getZoom(), DEVICE_LOCATION_ZOOM), { animate: true });

      if (!didApplyDeviceLocationRef.current && !disabled) {
        didApplyDeviceLocationRef.current = true;
        void handleMapClickRef.current(deviceLocation.lat, deviceLocation.lng);
      }
      return;
    }

    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
  }, [
    latitude,
    longitude,
    hasCoords,
    ready,
    deviceLocation,
    resolvedDeviceMode,
    disabled,
  ]);

  const statusLabel = (() => {
    if (resolving) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
          <Loader2 size={12} className="animate-spin" />
          Resolving address…
        </span>
      );
    }
    if (locatingDevice && !hasCoords) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
          <Loader2 size={12} className="animate-spin" />
          {resolvedDeviceMode === 'country-preview'
            ? 'Centering map on your country…'
            : 'Detecting your location…'}
        </span>
      );
    }
    if (!hasCoords && deviceLocation && resolvedDeviceMode === 'country-preview') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] text-sky-700">
          <Navigation size={12} />
          {previewCountry ? `Showing ${previewCountry}` : 'Centered on your country'}
        </span>
      );
    }
    if (!hasCoords && deviceLocation && resolvedDeviceMode === 'autofill') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600">
          <Navigation size={12} />
          Your current location
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
        <MapPin size={12} />
        Click map to pick location
      </span>
    );
  })();

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Map preview
        </p>
        {statusLabel}
      </div>

      <div
        className={`relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100 ${
          disabled ? 'opacity-60 pointer-events-none' : ''
        }`}
      >
        <div ref={containerRef} className="h-52 w-full sm:h-60" aria-label="Location map picker" />
        {!ready && !mapError && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-50/90">
            <Loader2 size={20} className="animate-spin text-slate-400" />
          </div>
        )}
        {mapError ? (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-50 px-4 text-center text-xs text-rose-600">
            {mapError}
          </div>
        ) : null}
      </div>
    </div>
  );
}
