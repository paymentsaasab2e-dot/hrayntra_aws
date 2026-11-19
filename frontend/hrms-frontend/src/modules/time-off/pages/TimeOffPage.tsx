"use client"

import * as React from 'react'
import { Button, SectionCard, DataTable, MetricStatCard } from '@hryantra/ui'
import { useStore } from '@/store/StoreProvider'
import { CalendarRange, MapPin, Plus, Trash2, Copy } from 'lucide-react'
import { CopyHolidayCalendarModal } from '../components/CopyHolidayCalendarModal'

export function TimeOffPage() {
  const { holidays, addHoliday, deleteHoliday, refreshHolidays, hasAction, hasTab } = useStore()
  const canManageHolidays = hasAction('holidays_manage')
  const [isHolidayModalOpen, setIsHolidayModalOpen] = React.useState(false)
  const [isCopyModalOpen, setIsCopyModalOpen] = React.useState(false)
  const [holidayForm, setHolidayForm] = React.useState({
    name: '',
    date: '',
    type: 'Public Holiday',
    description: '',
  })
  const [holidayError, setHolidayError] = React.useState<string | null>(null)

  React.useEffect(() => {
    refreshHolidays()
  }, [refreshHolidays])

  const publicHolidays = React.useMemo(() => {
    return (holidays || []).map((holiday: { id: string; name: string; date: string; type?: string }) => ({
      id: holiday.id,
      name: holiday.name,
      date: holiday.date,
      type: holiday.type || 'Public Holiday',
    }))
  }, [holidays])

  const upcomingHoliday = React.useMemo(() => {
    const today = new Date()
    return publicHolidays
      .filter(holiday => new Date(holiday.date) >= today)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0]
  }, [publicHolidays])

  const handleHolidaySave = async () => {
    if (!holidayForm.name || !holidayForm.date) {
      setHolidayError('Holiday name and date are required.')
      return
    }
    setHolidayError(null)
    try {
      await addHoliday({
        name: holidayForm.name,
        date: holidayForm.date,
        type: holidayForm.type || undefined,
        description: holidayForm.description || undefined,
      })
      setHolidayForm({ name: '', date: '', type: 'Public Holiday', description: '' })
      setIsHolidayModalOpen(false)
    } catch (err) {
      setHolidayError(err instanceof Error ? err.message : 'Failed to save holiday')
    }
  }

  const handleHolidayDelete = async (id: string) => {
    if (!window.confirm('Delete this public holiday?')) return
    try {
      await deleteHoliday(id)
    } catch (err) {
      setHolidayError(err instanceof Error ? err.message : 'Failed to delete holiday')
    }
  }

  if (!hasTab('timeOff')) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center max-w-lg mx-auto">
        <CalendarRange className="size-12 text-ds-neutral-300 mb-4" />
        <h2 className="text-lg font-semibold text-ds-brand-navy">Holidays not available</h2>
        <p className="text-sm text-ds-neutral-500 mt-2">You do not have access to configure company holidays.</p>
      </div>
    )
  }

  const dateEyebrow = React.useMemo(
    () =>
      new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }).toUpperCase(),
    []
  )

  return (
    <div className="flex flex-col min-h-0 space-y-5 max-w-7xl mx-auto w-full p-6">
      {/* ── Executive Action Bar: Context on Left, Actions on Right ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/90 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Company Statutory & Observed Holidays ({publicHolidays.length})
          </span>
        </div>

        {canManageHolidays && (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsCopyModalOpen(true)}>
              <Copy className="size-3.5 mr-1.5" />
              Copy From Last Year
            </Button>
            <Button variant="default" size="sm" onClick={() => setIsHolidayModalOpen(true)}>
              <Plus className="size-3.5 mr-1.5" />
              Add Holiday
            </Button>
          </div>
        )}
      </div>

      {/* ── Gradient Highlight Stat Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MetricStatCard
          label="Next Holiday"
          value={upcomingHoliday ? upcomingHoliday.name : 'None Scheduled'}
          subtitle={
            upcomingHoliday
              ? new Date(upcomingHoliday.date).toLocaleDateString('en-GB', {
                  weekday: 'long',
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })
              : 'All configured holidays passed'
          }
          tone="indigo"
          icon={MapPin}
        />

        <MetricStatCard
          label="Total Configured"
          value={`${publicHolidays.length} holiday${publicHolidays.length === 1 ? '' : 's'}`}
          subtitle="Annual calendar roster"
          tone="mint"
          icon={CalendarRange}
        />
      </div>

      <SectionCard title="Public Holidays Calendar" className="flex flex-col">
        <DataTable
          data={publicHolidays}
          columns={[
            { id: 'name', accessorKey: 'name', header: 'Holiday Name', sortable: true },
            {
              id: 'date',
              accessorKey: 'date',
              header: 'Date',
              sortable: true,
              cell: ({ row }) =>
                new Date(row.date).toLocaleDateString('en-GB', {
                  weekday: 'short',
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                }),
            },
            { id: 'type', accessorKey: 'type', header: 'Type' },
            ...(canManageHolidays
              ? [{
                  id: 'actions',
                  header: '',
                  cell: ({ row }: { row: { id: string } }) => (
                    <Button variant="destructive-outline" size="sm" onClick={() => handleHolidayDelete(row.id)}>
                      <Trash2 className="size-4" />
                      Delete
                    </Button>
                  ),
                }]
              : []),
          ]}
          keyExtractor={(r) => r.id}
          emptyTitle="No holidays configured"
          emptyDescription="Add public holidays so they appear across the organization calendar."
        />
      </SectionCard>

      {!canManageHolidays && (
        <p className="text-sm text-ds-neutral-500 text-center">
          View-only access. Contact HR to add or update holidays.
        </p>
      )}

      {isHolidayModalOpen && canManageHolidays && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-xl border border-ds-neutral-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-ds-neutral-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-ds-brand-navy">Add Public Holiday</h3>
              <button
                type="button"
                onClick={() => setIsHolidayModalOpen(false)}
                className="text-sm font-medium text-ds-neutral-500 hover:text-ds-brand-navy"
              >
                Close
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              <input
                type="text"
                placeholder="Holiday name"
                value={holidayForm.name}
                onChange={(e) => setHolidayForm(prev => ({ ...prev, name: e.target.value }))}
                className="w-full rounded-md border border-ds-neutral-300 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ds-brand-green"
              />
              <input
                type="date"
                value={holidayForm.date}
                onChange={(e) => setHolidayForm(prev => ({ ...prev, date: e.target.value }))}
                className="w-full rounded-md border border-ds-neutral-300 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ds-brand-green"
              />
              <input
                type="text"
                placeholder="Type (e.g. Public Holiday)"
                value={holidayForm.type}
                onChange={(e) => setHolidayForm(prev => ({ ...prev, type: e.target.value }))}
                className="w-full rounded-md border border-ds-neutral-300 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ds-brand-green"
              />
              <input
                type="text"
                placeholder="Description (optional)"
                value={holidayForm.description}
                onChange={(e) => setHolidayForm(prev => ({ ...prev, description: e.target.value }))}
                className="w-full rounded-md border border-ds-neutral-300 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ds-brand-green"
              />

              {holidayError && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {holidayError}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsHolidayModalOpen(false)}>Cancel</Button>
                <Button variant="default" onClick={handleHolidaySave}>Save Holiday</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {canManageHolidays && (
        <CopyHolidayCalendarModal
          isOpen={isCopyModalOpen}
          onClose={() => setIsCopyModalOpen(false)}
          onSuccess={() => {
            refreshHolidays()
          }}
        />
      )}
    </div>
  )
}
