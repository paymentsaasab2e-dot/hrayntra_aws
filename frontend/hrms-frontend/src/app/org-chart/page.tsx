"use client"

import * as React from 'react'
import { PageHeroBanner } from '@hryantra/ui'
import { OrgChartView } from '@/modules/employees/components/OrgChartView'

export default function OrgChartPage() {
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
    <div className="mx-auto flex h-full w-full max-w-[1400px] flex-col gap-6 overflow-y-auto p-6">
      <PageHeroBanner
        compact
        eyebrow={dateEyebrow}
        title="Visual Org Chart"
        description="Interactive visual reporting hierarchy tree across departments, managers, and direct reports."
      />

      <OrgChartView />
    </div>
  )
}

