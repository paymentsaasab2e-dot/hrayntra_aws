"use client"

import * as React from 'react'
import Link from 'next/link'
import {
  PageHeroBanner,
  SectionCard,
  Button,
  MetricStatCard,
  EmptyState,
  StatusBadge,
  Input,
  DrawerWrapper,
  FormField,
  FormFieldInput,
} from '@hryantra/ui'
import { useStore } from '@/store/StoreProvider'
import { api } from '@/shared/api'
import { getCurrentPosition } from '@/shared/geolocation'
import { LocationMapPreview } from '@/modules/locations/components/LocationMapPreview'
import { FieldVisitsLiveMap, type MapMarker } from '../components/FieldVisitsLiveMap'
import {
  Navigation,
  MapPin,
  CheckCircle2,
  Radio,
  Route,
  ExternalLink,
} from 'lucide-react'

type TabId = 'mine' | 'roster' | 'locations' | 'live'

const STATUS_BADGE: Record<string, 'Pending' | 'Approved' | 'Rejected' | 'Draft'> = {
  PENDING: 'Pending',
  VERIFIED: 'Approved',
  MISSED: 'Rejected',
  SKIPPED: 'Draft',
}

function todayKey() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function locFromAssignment(item: any) {
  return item.location || item.stop
}

export function FieldVisitsPage() {
  const { hasAction, hasTab } = useStore()
  const canManage = hasAction('field_visits_manage')
  const canManageLocations = hasTab('locations')

  const [tab, setTab] = React.useState<TabId>(canManage ? 'roster' : 'mine')
  const [dateKey, setDateKey] = React.useState(todayKey())
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)

  const [visitLocations, setVisitLocations] = React.useState<any[]>([])
  const [employees, setEmployees] = React.useState<any[]>([])
  const [roster, setRoster] = React.useState<any[]>([])
  const [mineData, setMineData] = React.useState<any>(null)
  const [liveData, setLiveData] = React.useState<any[]>([])

  const [rosterDrawerOpen, setRosterDrawerOpen] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [verifyingId, setVerifyingId] = React.useState<string | null>(null)
  const [sharingLive, setSharingLive] = React.useState(false)

  const [rosterForm, setRosterForm] = React.useState({
    employeeId: '',
    locationIds: [] as string[],
  })

  const dateEyebrow = React.useMemo(
    () =>
      new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }).toUpperCase(),
    []
  )

  const loadVisitLocations = React.useCallback(async () => {
    const res = await api.fieldVisits.listLocations(true)
    setVisitLocations(Array.isArray(res?.data) ? res.data : [])
  }, [])

  const loadRoster = React.useCallback(async () => {
    const res = await api.fieldVisits.listRoster(dateKey)
    setRoster(Array.isArray(res?.data) ? res.data : [])
  }, [dateKey])

  const loadMine = React.useCallback(async () => {
    const res = await api.fieldVisits.getMineToday()
    setMineData(res?.data || null)
  }, [])

  const loadLive = React.useCallback(async () => {
    const res = await api.fieldVisits.getLive(dateKey)
    setLiveData(Array.isArray(res?.data) ? res.data : [])
  }, [dateKey])

  const loadAll = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const tasks: Promise<void>[] = [loadVisitLocations(), loadMine()]
      if (canManage) {
        tasks.push(
          loadRoster(),
          loadLive(),
          api.employees.getAll().then((res) => setEmployees(Array.isArray(res?.data) ? res.data : []))
        )
      }
      await Promise.all(tasks)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tracking')
    } finally {
      setLoading(false)
    }
  }, [canManage, loadVisitLocations, loadMine, loadRoster, loadLive])

  React.useEffect(() => {
    loadAll()
  }, [loadAll])

  React.useEffect(() => {
    if (canManage && tab === 'roster') loadRoster()
    if (canManage && tab === 'live') loadLive()
    if (tab === 'mine') loadMine()
    if (tab === 'locations') loadVisitLocations()
  }, [tab, dateKey, canManage, loadRoster, loadLive, loadMine, loadVisitLocations])

  const stats = React.useMemo(() => {
    const verified = roster.filter((r) => r.status === 'VERIFIED').length
    const pending = roster.filter((r) => r.status === 'PENDING').length
    const onLive = liveData.filter((row) => row.lastPing).length
    return { locations: visitLocations.length, verified, pending, onLive }
  }, [visitLocations, roster, liveData])

  const liveMarkers = React.useMemo((): MapMarker[] => {
    const markers: MapMarker[] = []
    for (const row of liveData) {
      if (row.lastPing) {
        markers.push({
          id: `emp-${row.employee.id}`,
          lat: row.lastPing.lat,
          lng: row.lastPing.lng,
          label: `${row.employee.firstName} ${row.employee.lastName}`,
          kind: 'employee',
          status: 'Last ping',
        })
      }
      for (const a of row.assignments || []) {
        const loc = locFromAssignment(a)
        if (loc) {
          markers.push({
            id: `loc-${a.id}`,
            lat: loc.lat,
            lng: loc.lng,
            label: loc.name,
            kind: 'stop',
            status: a.status,
          })
        }
      }
    }
    return markers
  }, [liveData])

  const handleAssignRoster = async () => {
    if (!rosterForm.employeeId || rosterForm.locationIds.length === 0) {
      setError('Select employee and at least one location')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await api.fieldVisits.assignRoster({
        dateKey,
        employeeId: rosterForm.employeeId,
        locationIds: rosterForm.locationIds,
      })
      setRosterDrawerOpen(false)
      setRosterForm({ employeeId: '', locationIds: [] })
      await loadRoster()
      await loadLive()
      setSuccess('Daily roster assigned')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assign failed')
    } finally {
      setSaving(false)
    }
  }

  const handleVerify = async (assignmentId: string) => {
    setVerifyingId(assignmentId)
    setError(null)
    try {
      const coords = await getCurrentPosition()
      await api.fieldVisits.verifyVisit(assignmentId, coords.lat, coords.lng)
      setSuccess('Arrival verified at this location')
      await loadMine()
      if (canManage) await loadRoster()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed')
    } finally {
      setVerifyingId(null)
    }
  }

  const handleShareLive = async () => {
    setSharingLive(true)
    setError(null)
    try {
      const coords = await getCurrentPosition()
      await api.fieldVisits.recordPing(coords.lat, coords.lng)
      setSuccess('Live location shared')
      await loadMine()
      if (canManage) await loadLive()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not share location')
    } finally {
      setSharingLive(false)
    }
  }

  const toggleLocationSelection = (locationId: string) => {
    setRosterForm((prev) => ({
      ...prev,
      locationIds: prev.locationIds.includes(locationId)
        ? prev.locationIds.filter((id) => id !== locationId)
        : [...prev.locationIds, locationId],
    }))
  }

  const rosterByEmployee = React.useMemo(() => {
    const map = new Map<string, { employee: any; items: any[] }>()
    for (const row of roster) {
      const key = row.employeeId
      if (!map.has(key)) map.set(key, { employee: row.employee, items: [] })
      map.get(key)!.items.push(row)
    }
    return Array.from(map.values())
  }, [roster])

  const tabs: { id: TabId; label: string; show: boolean }[] = [
    { id: 'mine', label: 'My visits', show: true },
    { id: 'roster', label: 'Daily roster', show: canManage },
    { id: 'locations', label: 'Locations', show: canManage },
    { id: 'live', label: 'Live map', show: canManage },
  ]

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5 px-6 py-6 pb-10">
      {/* ── Executive Action Bar: Tabs on Left, Actions on Right ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/90 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          {tabs.filter((t) => t.show).map((t) => (
            <Button
              key={t.id}
              variant={tab === t.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </Button>
          ))}
          {canManage && (tab === 'roster' || tab === 'live') && (
            <Input
              type="date"
              value={dateKey}
              onChange={(e) => setDateKey(e.target.value)}
              className="w-40 h-8 text-xs"
            />
          )}
        </div>

        {canManage ? (
          <Button variant="default" size="sm" onClick={() => setRosterDrawerOpen(true)}>
            <Route className="size-4 mr-1.5" />
            Assign roster
          </Button>
        ) : (
          <Button variant="default" size="sm" onClick={handleShareLive} disabled={sharingLive}>
            <Radio className="size-4 mr-1.5" />
            {sharingLive ? 'Sharing...' : 'Share live location'}
          </Button>
        )}
      </div>

      {/* ── Metric Stat Cards (gradient highlight) ── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricStatCard label="Locations" value={stats.locations} subtitle="Enabled for visits" tone="blue" icon={MapPin} />
        <MetricStatCard label="Verified today" value={stats.verified} subtitle="Completed visits" tone="mint" icon={CheckCircle2} />
        <MetricStatCard label="Pending" value={stats.pending} subtitle="Awaiting check-in" tone="amber" icon={Navigation} />
        <MetricStatCard label="Live tracked" value={stats.onLive} subtitle="Employees with ping" tone="lavender" icon={Radio} />
      </div>

      {success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <SectionCard title="Loading">
          <p className="py-8 text-center text-sm text-slate-500">Loading tracking...</p>
        </SectionCard>
      ) : tab === 'mine' ? (
        <SectionCard
          title="Today's visit plan"
          titleAction={
            <Button variant="outline" size="sm" onClick={handleShareLive} disabled={sharingLive}>
              <Radio className="size-3.5" />
              Share location
            </Button>
          }
        >
          {!mineData?.assignments?.length ? (
            <EmptyState size="sm" title="No visits scheduled" description="Your manager has not assigned locations for today." />
          ) : (
            <ul className="flex flex-col gap-3">
              {mineData.assignments.map((item: any, index: number) => {
                const loc = locFromAssignment(item)
                return (
                  <li
                    key={item.id}
                    className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex gap-3">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-600">
                        {index + 1}
                      </span>
                      <div>
                        <p className="font-semibold text-slate-900">{loc?.name}</p>
                        <p className="text-xs text-slate-500">
                          {loc?.address || `${loc?.lat?.toFixed(4)}, ${loc?.lng?.toFixed(4)}`}
                          {' · '}
                          {loc?.radiusMeters}m geofence
                        </p>
                        <div className="mt-1 flex items-center gap-2">
                          <StatusBadge status={STATUS_BADGE[item.status] || 'Pending'} withDot />
                          {item.verifiedAt && (
                            <span className="text-xs text-slate-500">
                              Verified {new Date(item.verifiedAt).toLocaleTimeString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {item.status === 'PENDING' && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleVerify(item.id)}
                        disabled={verifyingId === item.id}
                      >
                        {verifyingId === item.id ? 'Checking GPS...' : 'Verify arrival'}
                      </Button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </SectionCard>
      ) : tab === 'roster' && canManage ? (
        <SectionCard title={`Roster · ${dateKey}`}>
          {rosterByEmployee.length === 0 ? (
            <EmptyState
              size="sm"
              title="No roster for this date"
              description="Assign locations to employees for the day."
              action={
                <Button variant="default" size="sm" onClick={() => setRosterDrawerOpen(true)}>
                  Assign roster
                </Button>
              }
            />
          ) : (
            <div className="flex flex-col gap-4">
              {rosterByEmployee.map(({ employee, items }) => (
                <div key={employee.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {employee.firstName} {employee.lastName}
                      </p>
                      <p className="text-xs text-slate-500">
                        {employee.employeeId} · {employee.department}
                      </p>
                    </div>
                    <span className="text-xs font-medium text-slate-500">
                      {items.filter((i) => i.status === 'VERIFIED').length}/{items.length} verified
                    </span>
                  </div>
                  <ul className="flex flex-col gap-2">
                    {items.map((item: any, idx: number) => (
                      <li key={item.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                        <span>
                          {idx + 1}. {locFromAssignment(item)?.name}
                        </span>
                        <StatusBadge status={STATUS_BADGE[item.status] || 'Pending'} withDot />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      ) : tab === 'locations' && canManage ? (
        <SectionCard
          title="Locations for tracking"
          titleAction={
            canManageLocations ? (
              <Link href="/locations">
                <Button variant="outline" size="sm">
                  <ExternalLink className="size-3.5" />
                  Manage locations
                </Button>
              </Link>
            ) : undefined
          }
        >
          <p className="mb-4 text-sm text-slate-500">
            Same geofenced locations used for attendance auto-punch.
            {canManageLocations ? (
              <>
                {' '}
                Enable tracking when adding a site under{' '}
                <Link href="/locations" className="font-medium text-slate-700 underline">
                  Locations
                </Link>
                .
              </>
            ) : (
              <> Ask HR to add or update locations in the Locations tab.</>
            )}
          </p>
          {visitLocations.length === 0 ? (
            <EmptyState
              size="sm"
              title="No visit-enabled locations"
              description='Add a location with "Auto punch + tracking" or "Tracking only".'
              action={
                canManageLocations ? (
                  <Link href="/locations">
                    <Button variant="default" size="sm">Go to Locations</Button>
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {visitLocations.map((loc) => (
                <div key={loc.id} className="flex gap-3 rounded-xl border border-slate-200 p-3">
                  <LocationMapPreview lat={loc.lat} lng={loc.lng} radiusMeters={loc.radiusMeters} height={112} className="w-[132px] shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">{loc.name}</p>
                    <p className="text-xs text-slate-500">{loc.address || `${loc.radiusMeters}m geofence`}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      ) : tab === 'live' && canManage ? (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <SectionCard title="Live map">
            <FieldVisitsLiveMap markers={liveMarkers} height={400} />
            <p className="mt-2 text-xs text-slate-500">
              Blue = employee last ping · Gray/green = scheduled locations
            </p>
          </SectionCard>
          <SectionCard title="Field staff status">
            {liveData.length === 0 ? (
              <EmptyState size="sm" title="No employees" description="No roster or pings for this date." />
            ) : (
              <ul className="flex flex-col gap-3">
                {liveData.map((row) => (
                  <li key={row.employee.id} className="rounded-xl border border-slate-200 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {row.employee.firstName} {row.employee.lastName}
                        </p>
                        <p className="text-xs text-slate-500">{row.employee.department}</p>
                      </div>
                      <span className="text-xs font-medium text-slate-600">
                        {row.progress.verified}/{row.progress.total} visits
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {row.lastPing
                        ? `Last ping ${new Date(row.lastPing.recordedAt).toLocaleTimeString()}`
                        : 'No live ping yet'}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      ) : null}

      <DrawerWrapper
        open={rosterDrawerOpen}
        onClose={() => setRosterDrawerOpen(false)}
        title="Assign daily roster"
        subtitle="Select employee and locations they must visit today."
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setRosterDrawerOpen(false)} className="mr-auto" disabled={saving}>
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={handleAssignRoster}
              disabled={saving || !rosterForm.employeeId || rosterForm.locationIds.length === 0}
            >
              {saving ? 'Assigning...' : 'Assign roster'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          <FormField label="Date" labelVariant="default">
            <FormFieldInput>
              <Input type="date" value={dateKey} onChange={(e) => setDateKey(e.target.value)} />
            </FormFieldInput>
          </FormField>
          <FormField label="Employee" labelVariant="default">
            <FormFieldInput>
              <select
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={rosterForm.employeeId}
                onChange={(e) => setRosterForm((p) => ({ ...p, employeeId: e.target.value }))}
              >
                <option value="">Select employee...</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.firstName} {emp.lastName} ({emp.employeeId})
                  </option>
                ))}
              </select>
            </FormFieldInput>
          </FormField>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Locations (in order)</p>
            {visitLocations.length === 0 ? (
              <p className="text-sm text-slate-500">
                No visit-enabled locations.
                {canManageLocations ? (
                  <>
                    {' '}
                    <Link href="/locations" className="font-medium underline">
                      Add under Locations
                    </Link>
                    .
                  </>
                ) : (
                  <> Ask HR to enable locations for tracking.</>
                )}
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {visitLocations.map((loc) => (
                  <li key={loc.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={rosterForm.locationIds.includes(loc.id)}
                        onChange={() => toggleLocationSelection(loc.id)}
                      />
                      {loc.name}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </DrawerWrapper>
    </div>
  )
}
