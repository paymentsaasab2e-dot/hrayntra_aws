'use client'
import * as React from 'react'
import { useParams } from 'next/navigation'
import { useStore } from '@/store/StoreProvider'
import { SectionCard, Button } from '@hryantra/ui'
import { AssetAllocation } from '@/modules/assets/types'
import { AssetDetailDrawer } from '@/modules/assets/components/AssetDetailDrawer'
import { AssetReceiptView } from '@/modules/assets/components/AssetReceiptView'
import {
  Laptop, Monitor, Headphones, Smartphone, CreditCard,
  Keyboard, Package, FileText, RotateCcw, Receipt
} from 'lucide-react'

const ASSET_ICONS: Record<string, React.ElementType> = {
  'Laptop': Laptop, 'Monitor': Monitor, 'Headset': Headphones,
  'Mobile Phone': Smartphone, 'Access Card': CreditCard,
  'Keyboard & Mouse': Keyboard, 'Software License': FileText,
  'SIM Card': Smartphone, 'Other': Package,
}

const STATUS_PILL: Record<string, string> = {
  'Active':   'bg-blue-50 text-blue-700 border border-blue-200',
  'Returned': 'bg-ds-neutral-100 text-ds-neutral-600 border border-ds-neutral-200',
}

const CONDITION_PILL: Record<string, string> = {
  'New':     'bg-emerald-50 text-emerald-700 border border-emerald-200',
  'Good':    'bg-blue-50 text-blue-700 border border-blue-200',
  'Fair':    'bg-amber-50 text-amber-700 border border-amber-200',
  'Damaged': 'bg-red-50 text-red-700 border border-red-200',
}

export function EmployeeAssetsTab() {
  const params = useParams()
  const employeeId = params.id as string
  const { assets, assetAllocations } = useStore()

  const [selectedAlloc, setSelectedAlloc] = React.useState<AssetAllocation | null>(null)
  const [receiptAlloc, setReceiptAlloc] = React.useState<AssetAllocation | null>(null)

  const empAllocations = assetAllocations
    .filter(a => a.employeeId === employeeId)
    .sort((a, b) => new Date(b.issuedOn).getTime() - new Date(a.issuedOn).getTime())

  const activeAllocations = empAllocations.filter(a => a.status === 'Active')
  const pastAllocations   = empAllocations.filter(a => a.status === 'Returned')

  const selectedAsset = selectedAlloc ? assets.find(a => a.id === selectedAlloc.assetId) : null
  const receiptAsset  = receiptAlloc  ? assets.find(a => a.id === receiptAlloc.assetId)  : null

  if (empAllocations.length === 0) {
    return (
      <SectionCard>
        <div className="py-14 flex flex-col items-center justify-center text-center">
          <Package className="size-14 text-ds-neutral-200 mb-4" />
          <h3 className="text-ds-heading-sm text-ds-brand-navy mb-1">No Assets Assigned</h3>
          <p className="text-ds-body text-ds-neutral-500">This employee has no company assets on record.</p>
        </div>
      </SectionCard>
    )
  }

  function AllocRow({ alloc }: { alloc: AssetAllocation }) {
    const asset = assets.find(a => a.id === alloc.assetId)
    if (!asset) return null
    const IconComp = ASSET_ICONS[asset.type] ?? Package
    const isActive = alloc.status === 'Active'

    return (
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border border-ds-neutral-200 rounded-xl hover:border-ds-brand-green/40 hover:bg-ds-neutral-50 transition-all cursor-pointer group"
        onClick={() => setSelectedAlloc(alloc)}
      >
        <div className="flex items-center gap-4">
          <div className={`size-11 rounded-xl flex items-center justify-center text-white shrink-0 ${isActive ? 'bg-ds-brand-navy' : 'bg-ds-neutral-400'}`}>
            <IconComp className="size-5" />
          </div>
          <div>
            <p className="text-ds-body font-semibold text-ds-brand-navy">{asset.name}</p>
            <p className="text-ds-caption text-ds-neutral-500">{asset.brand} · {asset.type}</p>
            <p className="text-ds-caption text-ds-neutral-400 font-mono mt-0.5">{asset.serialNumber}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:justify-end">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${CONDITION_PILL[alloc.conditionOnIssue]}`}>
            {alloc.conditionOnIssue}
          </span>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_PILL[alloc.status]}`}>
            {alloc.status}
          </span>
          <div className="flex flex-col items-end text-ds-caption text-ds-neutral-500">
            <span>Issued: <strong>{alloc.issuedOn}</strong></span>
            {alloc.returnedOn && <span>Returned: <strong>{alloc.returnedOn}</strong></span>}
            {alloc.expectedReturn && isActive && <span>Due: <strong>{alloc.expectedReturn}</strong></span>}
          </div>
          <div className="flex gap-2" onClick={e => e.stopPropagation()}>
            <Button
              variant="outline" size="sm"
              className="text-ds-neutral-600"
              onClick={() => setReceiptAlloc(alloc)}
            >
              <Receipt className="size-3.5 mr-1" /> Receipt
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Assigned', value: empAllocations.length,  color: 'text-ds-brand-navy' },
          { label: 'Currently Held', value: activeAllocations.length, color: 'text-blue-600' },
          { label: 'Returned',       value: pastAllocations.length,   color: 'text-ds-neutral-500' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white border border-ds-neutral-200 rounded-xl p-4 shadow-sm">
            <p className="text-ds-label uppercase text-ds-neutral-500">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {activeAllocations.length > 0 && (
        <SectionCard title="Currently Assigned">
          <div className="flex flex-col gap-3">
            {activeAllocations.map(a => <AllocRow key={a.id} alloc={a} />)}
          </div>
        </SectionCard>
      )}

      {pastAllocations.length > 0 && (
        <SectionCard title="Return History">
          <div className="flex flex-col gap-3">
            {pastAllocations.map(a => <AllocRow key={a.id} alloc={a} />)}
          </div>
        </SectionCard>
      )}

      {selectedAlloc && selectedAsset && (
        <AssetDetailDrawer
          asset={selectedAsset}
          allocations={assetAllocations}
          onClose={() => setSelectedAlloc(null)}
        />
      )}

      {receiptAlloc && receiptAsset && (
        <AssetReceiptView
          asset={receiptAsset}
          allocation={receiptAlloc}
          onClose={() => setReceiptAlloc(null)}
        />
      )}
    </div>
  )
}
