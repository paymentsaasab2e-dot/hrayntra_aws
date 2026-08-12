'use client';

import React, { useState } from 'react';
import { Globe2, MapPin, Search } from 'lucide-react';
import { LocationAutocomplete, type LocationSelection } from '../LocationAutocomplete';
import { CscLocationFields } from './CscLocationFields';
import { LocationMapPicker, type DeviceLocationMode } from './LocationMapPicker';

export type LeadLocationInputMode = 'search' | 'picker';

export interface LeadLocationFieldsProps {
  location: string;
  city: string;
  state: string;
  country: string;
  countryCode: string;
  latitude: number | null;
  longitude: number | null;
  onLocationChange: (location: string) => void;
  onSelect: (selection: LocationSelection) => void;
  disabled?: boolean;
  countryError?: string;
  stateError?: string;
  showDetectedHint?: boolean;
  /** Initial tab when the field mounts. */
  defaultMode?: LeadLocationInputMode;
  /** Map geolocation behavior — use `country-preview` on Add Lead to avoid form autofill. */
  deviceLocationMode?: DeviceLocationMode;
}

export function LeadLocationFields({
  defaultMode = 'search',
  deviceLocationMode,
  ...props
}: LeadLocationFieldsProps) {
  const [mode, setMode] = useState<LeadLocationInputMode>(defaultMode);

  const hasBreakdown = Boolean(
    props.country?.trim() || props.state?.trim() || props.city?.trim(),
  );

  return (
    <div className="space-y-3">
      <div
        role="tablist"
        aria-label="Location input method"
        className="inline-flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'search'}
          onClick={() => setMode('search')}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
            mode === 'search'
              ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Search size={14} />
          Search address
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'picker'}
          onClick={() => setMode('picker')}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
            mode === 'picker'
              ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Globe2 size={14} />
          Country / State / City
        </button>
      </div>

      {mode === 'search' ? (
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Search location{' '}
              <span className="font-medium normal-case tracking-normal text-slate-400">
                (optional)
              </span>
            </label>
            <LocationAutocomplete
              value={props.location}
              onChange={props.onLocationChange}
              onSelect={props.onSelect}
              disabled={props.disabled}
              placeholder="Start typing an address or city…"
              ariaLabel="Search lead location"
            />
            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
              Pick a suggestion to autofill country, state, and city below — same order as Google
              Maps.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Country
              </p>
              <p className="mt-1 text-sm text-slate-900">{props.country?.trim() || '—'}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">State</p>
              <p className="mt-1 text-sm text-slate-900">{props.state?.trim() || '—'}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">City</p>
              <p className="mt-1 text-sm text-slate-900">{props.city?.trim() || '—'}</p>
            </div>
          </div>

          {hasBreakdown &&
          typeof props.latitude === 'number' &&
          typeof props.longitude === 'number' ? (
            <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <MapPin size={12} className="text-emerald-600" />
              <span className="font-semibold text-emerald-600">Detected</span>
              {props.latitude.toFixed(4)}, {props.longitude.toFixed(4)}
            </p>
          ) : null}
        </div>
      ) : (
        <CscLocationFields
          {...props}
          requireCountryState={false}
          locationPlaceholder="Type a city or region to autofill country and state…"
        />
      )}

      {!props.disabled ? (
        <LocationMapPicker
          latitude={props.latitude}
          longitude={props.longitude}
          onSelect={props.onSelect}
          disabled={props.disabled}
          layoutKey={mode}
          deviceLocationMode={deviceLocationMode}
        />
      ) : null}
    </div>
  );
}
