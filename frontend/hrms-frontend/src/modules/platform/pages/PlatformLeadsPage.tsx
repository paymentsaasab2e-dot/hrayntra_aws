'use client'

import * as React from 'react'
import { PageHeroBanner, SectionCard } from '@hryantra/ui'
import { useStore } from '@/store/StoreProvider'

const DEMO_LEADS = [
  { company: 'Acme Health', contact: 'Riya Shah', email: 'riya@acmehealth.in', source: 'Inbound / website', stage: 'Demo booked' },
  { company: 'Nexus Logistics', contact: 'Amit Kulkarni', email: 'amit@nexuslog.in', source: 'Referral', stage: 'Proposal sent' },
  { company: 'Sunrise Pharma field force', contact: 'Neha Patel', email: 'neha@sunrisepharma.in', source: 'LinkedIn', stage: 'New lead' },
]

export function PlatformLeadsPage() {
  const { hasAction, currentUserRole } = useStore()
  const canManage = hasAction('platform_manage_tenants')

  if (currentUserRole !== 'PlatformOwner' && !canManage) {
    return <div className="p-6 text-sm text-ds-neutral-500">Platform owner access required.</div>
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-6 pb-12">
      <PageHeroBanner
        compact
        eyebrow="PLATFORM OWNER"
        title="Leads"
        description="Pipeline of companies you are selling to. Demo rows for now — we can wire CRM fields when you specify them."
      />

      <SectionCard title="Demo pipeline">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ds-neutral-500 border-b">
                <th className="py-2 pr-3">Company</th>
                <th className="py-2 pr-3">Contact</th>
                <th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3">Source</th>
                <th className="py-2">Stage</th>
              </tr>
            </thead>
            <tbody>
              {DEMO_LEADS.map((lead) => (
                <tr key={lead.email} className="border-b border-ds-neutral-100">
                  <td className="py-2 pr-3 font-medium">{lead.company}</td>
                  <td className="py-2 pr-3">{lead.contact}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{lead.email}</td>
                  <td className="py-2 pr-3">{lead.source}</td>
                  <td className="py-2">{lead.stage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  )
}
