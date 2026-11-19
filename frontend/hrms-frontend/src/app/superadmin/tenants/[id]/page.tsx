'use client'

import * as React from 'react'
import { ClientDetailPage } from '@/modules/platform/pages/ClientDetailPage'

export default function SuperadminTenantDetailPage() {
  return (
    <React.Suspense fallback={<div className="p-6 text-sm text-slate-500">Loading…</div>}>
      <ClientDetailPage />
    </React.Suspense>
  )
}
