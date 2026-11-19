"use client"

import * as React from 'react'
import { PageHeroBanner, SectionCard, Button, MetricStatCard, EmptyState } from '@hryantra/ui'
import { useStore } from '@/store/StoreProvider'
import { api } from '@/shared/api'
import { LocationMapPreview } from '../components/LocationMapPreview'
import { LocationFormDrawer, type LocationFormValues } from '../components/LocationFormDrawer'
import { Building2, MapPin, Plus, Trash2, Users, Pencil } from 'lucide-react'

type WorkLocation = {
  id: string
  name: string
  address?: string | null
  lat: number
  lng: number
  radiusMeters: number
  isActive: boolean
  usage?: 'ATTENDANCE' | 'VISITS' | 'BOTH'
  _count?: { employees: number }
}

const USAGE_LABELS: Record<string, string> = {
  ATTENDANCE: 'Auto punch',
  VISITS: 'Tracking only',
  BOTH: 'Auto punch + tracking',
}

export function WorkLocationsPage() {
  const { hasAction, hasTab } = useStore()
  const canView = hasTab('locations')
  const canManage = hasAction('locations_manage')

  const [locations, setLocations] = React.useState<WorkLocation[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [drawerOpen, setDrawerOpen] = React.useState(false)
  const [editingLocation, setEditingLocation] = React.useState<WorkLocation | null>(null)

  const dateEyebrow = React.useMemo(
    () =>
      new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }).toUpperCase(),
    []
  )

  const loadLocations = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.locations.getAll()
      setLocations(Array.isArray(res?.data) ? res.data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load locations')
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (canView) loadLocations()
  }, [canView, loadLocations])

  const stats = React.useMemo(() => {
    const totalEmployees = locations.reduce((sum, loc) => sum + (loc._count?.employees ?? 0), 0)
    const avgRadius = locations.length
      ? Math.round(locations.reduce((sum, loc) => sum + loc.radiusMeters, 0) / locations.length)
      : 0
    return { totalEmployees, avgRadius }
  }, [locations])

  const handleCreate = async (values: LocationFormValues) => {
    setSaving(true)
    setError(null)
    try {
      if (editingLocation) {
        await api.locations.update(editingLocation.id, values)
      } else {
        await api.locations.create(values)
      }
      setDrawerOpen(false)
      setEditingLocation(null)
      await loadLocations()
    } catch (err) {
      setError(err instanceof Error ? err.message : editingLocation ? 'Failed to update location' : 'Failed to create location')
    } finally {
      setSaving(false)
    }
  }

  const openCreate = () => {
    setEditingLocation(null)
    setDrawerOpen(true)
  }

  const openEdit = (loc: WorkLocation) => {
    setEditingLocation(loc)
    setDrawerOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this location?')) return
    try {
      await api.locations.delete(id)
      await loadLocations()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete location')
    }
  }

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <MapPin className="size-16 text-ds-neutral-200 mb-4" />
        <h3 className="text-ds-heading text-ds-brand-navy">Locations restricted</h3>
        <p className="text-ds-body text-ds-neutral-500 max-w-md">
          You do not have access to view geofenced locations.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-6 py-6 pb-10">
      <section className="flex flex-col gap-4">
        <PageHeroBanner
          compact
          eyebrow={dateEyebrow}
          title="Locations"
          description="Geofenced sites for attendance auto-punch, remote employees, and daily visit rosters."
          actions={
            canManage ? (
              <Button variant="default" onClick={openCreate}>
                <Plus className="size-4" />
                Add location
              </Button>
            ) : undefined
          }
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <MetricStatCard
            label="Total Locations"
            value={locations.length}
            subtitle="Geofenced sites"
            tone="blue"
            icon={Building2}
          />
          <MetricStatCard
            label="Employees Mapped"
            value={stats.totalEmployees}
            subtitle="Assigned to a site"
            tone="mint"
            icon={Users}
          />
          <MetricStatCard
            label="Avg Geofence"
            value={stats.avgRadius ? `${stats.avgRadius}m` : '—'}
            subtitle="Punch radius"
            tone="lavender"
            icon={MapPin}
          />
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <SectionCard
        title="All sites"
        titleAction={
          <span className="text-xs font-medium text-ds-neutral-500">
            {loading ? 'Loading…' : `${locations.length} location${locations.length === 1 ? '' : 's'}`}
          </span>
        }
      >
        {loading ? (
          <p className="text-sm text-ds-neutral-500 py-8 text-center">Loading locations...</p>
        ) : locations.length === 0 ? (
          <EmptyState
            icon={<MapPin className="size-10 text-ds-neutral-300" />}
            title="No locations yet"
            description="Add your first geofenced site for auto-punch, remote staff, or visit tracking."
            action={
              canManage ? (
                <Button variant="default" onClick={openCreate}>
                  <Plus className="size-4" />
                  Add location
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2 2xl:grid-cols-3">
            {locations.map((loc) => (
              <article
                key={loc.id}
                className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.06)] transition-shadow hover:shadow-[0_12px_32px_rgba(15,23,42,0.1)]"
              >
                <div className="flex gap-3 p-4">
                  <div className="min-w-0 flex-1 flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-ds-brand-navy truncate">{loc.name}</h3>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mt-0.5">
                          {USAGE_LABELS[loc.usage || 'BOTH']}
                        </p>
                        <p className="text-xs text-ds-neutral-500 mt-0.5 line-clamp-2 leading-relaxed">
                          {loc.address || 'No address on file'}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        {canManage && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-2.5"
                              onClick={() => openEdit(loc)}
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              variant="destructive-outline"
                              size="sm"
                              className="h-8 px-2.5"
                              onClick={() => handleDelete(loc.id)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-2">
                        <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Coordinates</p>
                        <p className="mt-0.5 text-[11px] font-semibold text-slate-800 leading-tight">
                          {loc.lat.toFixed(4)}
                          <br />
                          {loc.lng.toFixed(4)}
                        </p>
                      </div>
                      <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-2">
                        <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Radius</p>
                        <p className="mt-0.5 text-sm font-bold text-slate-800">{loc.radiusMeters}m</p>
                      </div>
                      <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-2">
                        <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Staff</p>
                        <p className="mt-0.5 text-sm font-bold text-slate-800">{loc._count?.employees ?? 0}</p>
                      </div>
                    </div>
                  </div>

                  <div className="w-[132px] shrink-0">
                    <LocationMapPreview
                      lat={loc.lat}
                      lng={loc.lng}
                      radiusMeters={loc.radiusMeters}
                      height={112}
                      className="rounded-xl border-slate-200"
                    />
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </SectionCard>

      <LocationFormDrawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false)
          setEditingLocation(null)
        }}
        onSubmit={handleCreate}
        saving={saving}
        mode={editingLocation ? 'edit' : 'create'}
        initialValues={
          editingLocation
            ? {
                name: editingLocation.name,
                address: editingLocation.address || '',
                lat: editingLocation.lat,
                lng: editingLocation.lng,
                radiusMeters: editingLocation.radiusMeters,
                usage: editingLocation.usage || 'BOTH',
              }
            : undefined
        }
      />
    </div>
  )
}
