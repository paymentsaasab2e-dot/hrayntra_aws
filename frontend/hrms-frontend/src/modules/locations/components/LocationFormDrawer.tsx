"use client"

import * as React from 'react'
import {
  DrawerWrapper,
  FormField,
  FormFieldInput,
  Input,
  Button,
  FormGrid,
} from '@hryantra/ui'
import { LocationMapPreview } from './LocationMapPreview'

export type LocationFormValues = {
  name: string
  address: string
  lat: number
  lng: number
  radiusMeters: number
  usage: 'ATTENDANCE' | 'VISITS' | 'BOTH'
}

type Props = {
  open: boolean
  onClose: () => void
  onSubmit: (values: LocationFormValues) => Promise<void>
  saving?: boolean
  initialValues?: Partial<LocationFormValues>
  mode?: 'create' | 'edit'
}

const DEFAULT_LAT = 18.5912
const DEFAULT_LNG = 73.7389

const emptyForm = (): LocationFormValues => ({
  name: '',
  address: '',
  lat: DEFAULT_LAT,
  lng: DEFAULT_LNG,
  radiusMeters: 100,
  usage: 'BOTH',
})

export function LocationFormDrawer({ open, onClose, onSubmit, saving = false, initialValues, mode = 'create' }: Props) {
  const [form, setForm] = React.useState<LocationFormValues>(emptyForm())

  React.useEffect(() => {
    if (open) {
      setForm({ ...emptyForm(), ...initialValues })
    }
  }, [open, initialValues])

  const handleMapPick = React.useCallback((nextLat: number, nextLng: number) => {
    setForm((prev) => ({
      ...prev,
      lat: Number(nextLat.toFixed(6)),
      lng: Number(nextLng.toFixed(6)),
    }))
  }, [])

  const handleSave = async () => {
    if (!form.name.trim()) return
    await onSubmit(form)
  }

  return (
    <DrawerWrapper
      open={open}
      onClose={onClose}
      title={mode === 'edit' ? 'Edit location' : 'Add location'}
      subtitle="Geofenced site for attendance auto-punch, remote staff, and field tracking."
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} className="mr-auto" disabled={saving}>
            Cancel
          </Button>
          <Button variant="default" onClick={handleSave} disabled={saving || !form.name.trim()}>
            {saving ? 'Saving...' : mode === 'edit' ? 'Update location' : 'Save location'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <FormField label="Location name" required>
          <FormFieldInput>
            <Input
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Yantra HQ — Pune"
            />
          </FormFieldInput>
        </FormField>

        <FormField label="Address">
          <FormFieldInput>
            <Input
              value={form.address}
              onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
              placeholder="Street, city, state"
            />
          </FormFieldInput>
        </FormField>

        <FormGrid cols={2}>
          <FormField label="Latitude">
            <FormFieldInput>
              <Input
                type="number"
                step="any"
                value={form.lat}
                onChange={(e) => setForm((p) => ({ ...p, lat: Number(e.target.value) }))}
              />
            </FormFieldInput>
          </FormField>
          <FormField label="Longitude">
            <FormFieldInput>
              <Input
                type="number"
                step="any"
                value={form.lng}
                onChange={(e) => setForm((p) => ({ ...p, lng: Number(e.target.value) }))}
              />
            </FormFieldInput>
          </FormField>
        </FormGrid>

        <FormField label="Used for" hint="Choose how this location is used across HRMS.">
          <FormFieldInput>
            <select
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={form.usage}
              onChange={(e) =>
                setForm((p) => ({ ...p, usage: e.target.value as LocationFormValues['usage'] }))
              }
            >
              <option value="BOTH">Auto punch + tracking</option>
              <option value="ATTENDANCE">Auto punch only</option>
              <option value="VISITS">Tracking only</option>
            </select>
          </FormFieldInput>
        </FormField>

        <FormField label="Geofence radius (meters)" hint="Must be within this distance to punch or verify a visit.">
          <FormFieldInput>
            <Input
              type="number"
              min={10}
              value={form.radiusMeters}
              onChange={(e) => setForm((p) => ({ ...p, radiusMeters: Number(e.target.value) || 100 }))}
            />
          </FormFieldInput>
        </FormField>

        <div>
          <p className="text-xs font-medium text-ds-neutral-500 mb-2">
            Click the map to place the pin. The green circle is the geofence area.
          </p>
          <LocationMapPreview
            lat={form.lat}
            lng={form.lng}
            radiusMeters={form.radiusMeters}
            height={320}
            interactive
            onPick={handleMapPick}
          />
        </div>
      </div>
    </DrawerWrapper>
  )
}
