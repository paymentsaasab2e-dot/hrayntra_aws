"use client"

import * as React from 'react'
import { PageHeroBanner } from '@hryantra/ui'
import { RosterGridPlanner } from '@/modules/leave/components/RosterGridPlanner'
import { WorkWeekRosterPanel } from '@/modules/leave/components/WorkWeekRosterPanel'
import { ShiftManagementPanel } from '../components/ShiftManagementPanel'
import { useStore } from '@/store/StoreProvider'
import {
  Grid,
  Clock,
  CalendarDays,
} from 'lucide-react'

export function RosterPage() {
  const { employees, activeEmployeeId } = useStore()
  const [activeTab, setActiveTab] = React.useState<'grid' | 'shifts' | 'policy'>('grid')

  const currentUser = employees.find((e) => e.id === activeEmployeeId)
  const firstName = currentUser?.name?.split(' ')[0] || 'Team'

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
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5 px-6 py-6">
      {/* ── 3 Clean Segmented Navigation Tabs ── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200/90 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('grid')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'grid'
              ? 'bg-emerald-700 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Grid className="size-3.5" />
          <span>Weekly & Monthly Roster Grid</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('shifts')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'shifts'
              ? 'bg-indigo-700 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Clock className="size-3.5" />
          <span>Shift Timings & Creation</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('policy')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'policy'
              ? 'bg-slate-800 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <CalendarDays className="size-3.5" />
          <span>Weekend & Saturday Policy</span>
        </button>
      </div>

      {/* ── Tab Content Views ── */}
      {activeTab === 'grid' ? (
        <RosterGridPlanner onNavigateToShifts={() => setActiveTab('shifts')} />
      ) : activeTab === 'shifts' ? (
        <ShiftManagementPanel />
      ) : (
        <WorkWeekRosterPanel />
      )}
    </div>
  )
}
