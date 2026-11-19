'use client'
import * as React from 'react'
import { Asset, AssetAllocation, AssetCondition } from '../types'
import { useStore, CURRENT_USER_ID } from '@/store/StoreProvider'
import { Button, SectionCard } from '@hryantra/ui'
import {
  X, Laptop, Monitor, Headphones, Smartphone, CreditCard, Keyboard,
  Package, FileText, RotateCcw, User, Calendar, Hash, Wrench, ShieldCheck, ClipboardList, Download
} from 'lucide-react'

const ASSET_ICONS: Record<string, React.ElementType> = {
  'Laptop': Laptop, 'Monitor': Monitor, 'Headset': Headphones,
  'Mobile Phone': Smartphone, 'Access Card': CreditCard,
  'Keyboard & Mouse': Keyboard, 'Software License': FileText,
  'SIM Card': Smartphone, 'Other': Package,
}

const STATUS_STYLES: Record<string, string> = {
  'Available':  'bg-ds-success-light text-ds-success-text border-ds-success-border',
  'Assigned':   'bg-ds-info-light text-ds-info-text border-ds-info-border',
  'In Repair':  'bg-ds-warning-light text-ds-warning-text border-ds-warning-border',
  'Retired':    'bg-ds-neutral-100 text-ds-neutral-600 border-ds-neutral-200',
  'Active':     'bg-ds-info-light text-ds-info-text border-ds-info-border',
  'Returned':   'bg-ds-neutral-100 text-ds-neutral-600 border-ds-neutral-200',
}

const CONDITION_STYLES: Record<string, string> = {
  'New':     'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Good':    'bg-blue-50 text-blue-700 border-blue-200',
  'Fair':    'bg-amber-50 text-amber-700 border-amber-200',
  'Damaged': 'bg-red-50 text-red-700 border-red-200',
}

function StatusPill({ label, map }: { label: string; map: Record<string, string> }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${map[label] ?? 'bg-ds-neutral-100 text-ds-neutral-600'}`}>
      {label}
    </span>
  )
}

interface Props {
  asset: Asset
  allocations: AssetAllocation[]
  onClose: () => void
  onAssign?: () => void
}

export function AssetDetailDrawer({ asset, allocations, onClose, onAssign }: Props) {
  const { employees, returnAsset } = useStore()
  const IconComp = ASSET_ICONS[asset.type] ?? Package

  const activeAlloc = allocations.find(a => a.assetId === asset.id && a.status === 'Active')
  const history = allocations.filter(a => a.assetId === asset.id).sort(
    (a, b) => new Date(b.issuedOn).getTime() - new Date(a.issuedOn).getTime()
  )

  const [showReturnModal, setShowReturnModal] = React.useState(false)
  const [returnCondition, setReturnCondition] = React.useState<AssetCondition>('Good')
  const [returnNotes, setReturnNotes] = React.useState('')

  const handleReturn = () => {
    if (!activeAlloc) return
    returnAsset(activeAlloc.id, returnCondition, returnNotes)
    setShowReturnModal(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ds-brand-navy/30 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-ds-neutral-200 bg-ds-neutral-50">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-ds-brand-navy flex items-center justify-center text-white shrink-0">
              <IconComp className="size-5" />
            </div>
            <div>
              <h3 className="text-ds-heading-sm font-bold text-ds-brand-navy">{asset.name}</h3>
              <p className="text-ds-caption text-ds-neutral-500">{asset.brand} · {asset.model}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-ds-neutral-100 text-ds-neutral-400 hover:text-ds-brand-navy transition-colors">
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Status Strip */}
          <div className="flex items-center gap-3 flex-wrap">
            <StatusPill label={asset.status} map={STATUS_STYLES} />
            <StatusPill label={asset.condition} map={CONDITION_STYLES} />
            <span className="text-ds-caption text-ds-neutral-400 ml-auto">{asset.id}</span>
          </div>

          {/* Core Details */}
          <SectionCard title="Asset Details">
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              {[
                { icon: Hash, label: 'Serial Number', val: asset.serialNumber },
                { icon: Package, label: 'Type', val: asset.type },
                { icon: Calendar, label: 'Purchased On', val: asset.purchasedOn },
                { icon: ShieldCheck, label: 'Warranty Until', val: asset.warrantyUntil ?? 'N/A' },
              ].map(({ icon: Icon, label, val }) => (
                <div key={label} className="flex flex-col gap-0.5">
                  <span className="text-ds-caption text-ds-neutral-500 flex items-center gap-1"><Icon className="size-3" /> {label}</span>
                  <span className="text-ds-body-sm font-medium text-ds-brand-navy">{val}</span>
                </div>
              ))}
            </div>
            {asset.notes && (
              <div className="mt-4 pt-4 border-t border-ds-neutral-100">
                <span className="text-ds-caption text-ds-neutral-500">Notes</span>
                <p className="text-ds-body-sm text-ds-neutral-700 mt-1 italic">"{asset.notes}"</p>
              </div>
            )}
          </SectionCard>

          {/* Currently Assigned To */}
          {activeAlloc && (() => {
            const emp = employees.find(e => e.id === activeAlloc.employeeId)
            return (
              <SectionCard title="Currently Assigned To">
                <div className="flex items-center gap-4 mb-4">
                  <div className="size-10 rounded-full bg-ds-brand-navy text-white flex items-center justify-center font-bold shrink-0">
                    {emp?.name.split(' ').map(n => n[0]).join('') ?? '?'}
                  </div>
                  <div>
                    <p className="text-ds-body font-semibold text-ds-brand-navy">{emp?.name ?? activeAlloc.employeeId}</p>
                    <p className="text-ds-caption text-ds-neutral-500">{emp?.designation} · {emp?.department}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-ds-body-sm">
                  <div>
                    <span className="text-ds-caption text-ds-neutral-500 block">Issued On</span>
                    <span className="font-medium">{activeAlloc.issuedOn}</span>
                  </div>
                  {activeAlloc.expectedReturn && (
                    <div>
                      <span className="text-ds-caption text-ds-neutral-500 block">Expected Return</span>
                      <span className="font-medium">{activeAlloc.expectedReturn}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-ds-caption text-ds-neutral-500 block">Condition at Issue</span>
                    <StatusPill label={activeAlloc.conditionOnIssue} map={CONDITION_STYLES} />
                  </div>
                </div>
                {activeAlloc.notes && (
                  <p className="text-ds-body-sm text-ds-neutral-600 italic mt-3 pt-3 border-t border-ds-neutral-100">"{activeAlloc.notes}"</p>
                )}
              </SectionCard>
            )
          })()}

          {/* Allocation History */}
          <SectionCard title="Allocation History">
            {history.length === 0 ? (
              <p className="text-ds-body-sm text-ds-neutral-400 py-4 text-center">No allocation history yet.</p>
            ) : (
              <div className="relative pl-4">
                <div className="absolute left-0 top-2 bottom-2 w-px bg-ds-neutral-200" />
                {history.map((alloc) => {
                  const emp = employees.find(e => e.id === alloc.employeeId)
                  return (
                    <div key={alloc.id} className="relative flex flex-col gap-1 mb-5 pl-5">
                      <div className="absolute -left-[9px] top-1 size-4 rounded-full border-2 border-ds-brand-navy bg-white" />
                      <div className="flex items-center justify-between">
                        <span className="text-ds-body-sm font-semibold text-ds-brand-navy">{emp?.name ?? alloc.employeeId}</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_STYLES[alloc.status]}`}>
                          {alloc.status}
                        </span>
                      </div>
                      <span className="text-ds-caption text-ds-neutral-500">
                        {alloc.issuedOn}
                        {alloc.returnedOn ? ` → ${alloc.returnedOn}` : ' → Present'}
                      </span>
                      {alloc.conditionOnReturn && (
                        <span className="text-ds-caption text-ds-neutral-500 flex items-center gap-1.5 mt-1">
                          Returned in: <StatusPill label={alloc.conditionOnReturn} map={CONDITION_STYLES} />
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </SectionCard>

          {/* Related Documents */}
          {(() => {
            const assetDocs = useStore().documents.filter(d => 
              d.category === 'Asset Receipt' && 
              (d.name.includes(asset.id) || d.name.includes(asset.serialNumber) || (d.tags && d.tags.includes(asset.id)))
            )
            
            return (
              <SectionCard title="Related Documents">
                {assetDocs.length === 0 ? (
                  <p className="text-ds-body-sm text-ds-neutral-400 py-4 text-center">No linked documents found.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {assetDocs.map(doc => (
                      <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border border-ds-neutral-100 bg-ds-neutral-50/50 hover:bg-ds-neutral-50 transition-colors group">
                        <div className="flex items-center gap-3">
                           <FileText className="size-4 text-ds-neutral-400" />
                           <div className="flex flex-col">
                              <span className="text-ds-body-sm font-medium text-ds-brand-navy">{doc.name}</span>
                              <span className="text-[10px] text-ds-neutral-500 uppercase tracking-tight">{doc.uploadedAt.split('T')[0]} • {doc.size}</span>
                           </div>
                        </div>
                        <button
                          type="button"
                          className="rounded-md border border-ds-neutral-200 bg-white p-1.5 text-ds-neutral-500 shadow-sm transition-all hover:border-ds-neutral-300 hover:bg-ds-neutral-50 hover:text-ds-brand-navy"
                          aria-label={`Download ${doc.name}`}
                        >
                          <Download className="size-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            )
          })()}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-ds-neutral-200 bg-ds-neutral-50 flex gap-3">
          {asset.status === 'Available' && (
            <Button variant="default" className="flex-1" onClick={onAssign}>
              Assign to Employee
            </Button>
          )}
          {asset.status === 'Assigned' && activeAlloc && !showReturnModal && (
            <Button variant="outline" className="flex-1 text-amber-700 border-amber-300 hover:bg-amber-50" onClick={() => setShowReturnModal(true)}>
              <RotateCcw className="size-4 mr-2" /> Process Return
            </Button>
          )}
          {showReturnModal && (
            <div className="flex-1 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <label className="text-ds-body-sm font-medium text-ds-neutral-700 w-32 shrink-0">Return Condition</label>
                <select
                  className="flex-1 text-ds-body-sm border border-ds-neutral-300 rounded-md px-3 py-1.5 bg-white outline-none"
                  value={returnCondition}
                  onChange={e => setReturnCondition(e.target.value as AssetCondition)}
                >
                  {(['Good', 'Fair', 'Damaged'] as AssetCondition[]).map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <input
                className="text-ds-body-sm border border-ds-neutral-300 rounded-md px-3 py-2 outline-none w-full"
                placeholder="Return notes (optional)"
                value={returnNotes}
                onChange={e => setReturnNotes(e.target.value)}
              />
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowReturnModal(false)}>Cancel</Button>
                <Button variant="default" size="sm" className="flex-1" onClick={handleReturn}>Confirm Return</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
