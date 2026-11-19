'use client';

import React, { useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  apiCreatePeopleLocation,
  apiListLegalEmployers,
  apiListPeopleLocations,
  type LegalEmployer,
} from '../../../lib/api';
import {
  PeopleBanner,
  PeopleCard,
  PeopleFormRow,
  Ph2ModulePageLayout,
  PH2_HEADER_PILL_PRIMARY,
  fieldClass,
} from '../_components/PeopleModule';

export default function OrganisationPage() {
  const [employers, setEmployers] = useState<LegalEmployer[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [locationsReady, setLocationsReady] = useState(false);
  const [legalEmployerId, setLegalEmployerId] = useState('');
  const [name, setName] = useState('');
  const [radius, setRadius] = useState('100');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');

  const load = async () => {
    // Keep the current rows visible until the refreshed list arrives.
    try {
      const emp = await apiListLegalEmployers();
      const list = (emp.data as LegalEmployer[]) || [];
      setEmployers(list);
      const id = legalEmployerId || list[0]?.id || '';
      if (!legalEmployerId && id) setLegalEmployerId(id);
      if (id) {
        const loc = await apiListPeopleLocations(id);
        setLocations((loc.data as any[]) || []);
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to load locations');
    } finally {
      setLocationsReady(true);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legalEmployerId]);

  const create = async () => {
    try {
      await apiCreatePeopleLocation({
        legalEmployerId,
        name,
        geofenceRadiusM: Number(radius),
        latitude: lat ? Number(lat) : null,
        longitude: lng ? Number(lng) : null,
      });
      setName('');
      await load();
    } catch (error: any) {
      toast.error(error?.message || 'Could not save location');
    }
  };

  return (
    <Ph2ModulePageLayout title="Organisation" icon={<Building2 className="h-5 w-5" />} subtitle="Work locations and punch radius. Not the CRM sales OrgUnit tree.">
      <PeopleBanner text="Geofence radius is 50–1000 m. GPS is optional evidence — HR can still proxy-punch later." />
      <PeopleCard>
        <PeopleFormRow>
          <select className={fieldClass} value={legalEmployerId} onChange={(e) => setLegalEmployerId(e.target.value)}>
            {employers.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name} ({row.country})
              </option>
            ))}
          </select>
          <input className={fieldClass} placeholder="Location name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className={fieldClass} placeholder="Radius m" value={radius} onChange={(e) => setRadius(e.target.value)} />
          <input className={fieldClass} placeholder="Lat" value={lat} onChange={(e) => setLat(e.target.value)} />
          <input className={fieldClass} placeholder="Lng" value={lng} onChange={(e) => setLng(e.target.value)} />
          <button type="button" className={`${PH2_HEADER_PILL_PRIMARY} !w-auto !px-4`} onClick={() => void create()}>
            Add location
          </button>
        </PeopleFormRow>
        <ul className="mt-3 divide-y divide-slate-100 text-sm">
          {locations.map((row) => (
            <li key={row.id} className="py-2">
              {row.name} · {row.geofenceRadiusM} m · {row.timezone}
            </li>
          ))}
          {locationsReady && locations.length === 0 ? <li className="py-2 text-slate-500">No locations yet. Add a location.</li> : null}
        </ul>
      </PeopleCard>
    </Ph2ModulePageLayout>
  );
}
