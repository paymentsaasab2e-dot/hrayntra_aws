'use client'
import * as React from 'react'
import { Button, MetricStatCard, PageHeroBanner, FilterDrawer, FilterTriggerButton, FilterField, FILTER_INPUT_CLASS, SectionCard, Input, Select, InputWrapper } from '@hryantra/ui'
import { useStore } from '@/store/StoreProvider'
import { AssetType, AssetStatus, Asset } from '@/modules/assets/types'
import { AssetDetailDrawer } from '@/modules/assets/components/AssetDetailDrawer'
import { AssignAssetModal } from '@/modules/assets/components/AssignAssetModal'
import {
  Laptop, Monitor, Headphones, Smartphone, CreditCard,
  Keyboard, Package, FileText, Plus, Search,
  CheckCircle2, Wrench, Archive, Laptop as LaptopIcon
} from 'lucide-react'

const ASSET_ICONS: Record<string, React.ElementType> = {
  'Laptop': Laptop, 'Monitor': Monitor, 'Headset': Headphones,
  'Mobile Phone': Smartphone, 'Access Card': CreditCard,
  'Keyboard & Mouse': Keyboard, 'Software License': FileText,
  'SIM Card': Smartphone, 'Other': Package,
}

const STATUS_CONFIG: Record<string, { icon: React.ElementType; pill: string }> = {
  'Available': { icon: CheckCircle2, pill: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  'Assigned':  { icon: Package,      pill: 'bg-blue-50 text-blue-700 border border-blue-200' },
  'Allocated': { icon: Package,      pill: 'bg-blue-50 text-blue-700 border border-blue-200' },
  'In Repair': { icon: Wrench,       pill: 'bg-amber-50 text-amber-700 border border-amber-200' },
  'Retired':   { icon: Archive,      pill: 'bg-ds-neutral-100 text-ds-neutral-600 border border-ds-neutral-200' },
}

const DEFAULT_STATUS_CONFIG = STATUS_CONFIG['Available']

const CONDITION_PILL: Record<string, string> = {
  'New':     'bg-emerald-50 text-emerald-700 border border-emerald-200',
  'Good':    'bg-blue-50 text-blue-700 border border-blue-200',
  'Fair':    'bg-amber-50 text-amber-700 border border-amber-200',
  'Damaged': 'bg-red-50 text-red-700 border border-red-200',
}

export default function AssetsRegistryPage() {
  const { assets, assetAllocations, employees, addAsset, updateAsset, deleteAsset } = useStore()

  const [search, setSearch] = React.useState('')
  const [filterStatus, setFilterStatus] = React.useState<AssetStatus | 'All'>('All')
  const [filterType, setFilterType] = React.useState<AssetType | 'All'>('All')
  const [selectedAsset, setSelectedAsset] = React.useState<Asset | null>(null)
  const [assignTarget, setAssignTarget] = React.useState<Asset | null>(null)
  const [isAssetFormOpen, setIsAssetFormOpen] = React.useState(false)
  const [editingAsset, setEditingAsset] = React.useState<Asset | null>(null)
  const [assetForm, setAssetForm] = React.useState({
    name: '',
    type: 'Laptop' as AssetType,
    serialNumber: '',
    brand: '',
    model: '',
    status: 'Available' as AssetStatus,
    condition: 'Good' as Asset['condition'],
    purchasedOn: new Date().toISOString().split('T')[0],
    warrantyUntil: '',
    notes: ''
  })

  const [isFilterOpen, setIsFilterOpen] = React.useState(false)
  const [draftSearch, setDraftSearch] = React.useState('')
  const [draftStatus, setDraftStatus] = React.useState<AssetStatus | 'All'>('All')
  const [draftType, setDraftType] = React.useState<AssetType | 'All'>('All')

  const activeFilterCount =
    (search.trim() ? 1 : 0) + (filterStatus !== 'All' ? 1 : 0) + (filterType !== 'All' ? 1 : 0)

  const openFilters = () => {
    setDraftSearch(search)
    setDraftStatus(filterStatus)
    setDraftType(filterType)
    setIsFilterOpen(true)
  }

  const applyFilters = () => {
    setSearch(draftSearch)
    setFilterStatus(draftStatus)
    setFilterType(draftType)
    setIsFilterOpen(false)
  }

  const clearFilters = () => {
    setDraftSearch('')
    setDraftStatus('All')
    setDraftType('All')
    setSearch('')
    setFilterStatus('All')
    setFilterType('All')
    setIsFilterOpen(false)
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

  const assetTypes = Array.from(new Set(assets.map((a) => a.type))) as AssetType[]

  const filtered = assets.filter(a => {
    const q = search.toLowerCase()
    const matchSearch = !q || a.name.toLowerCase().includes(q) || a.serialNumber.toLowerCase().includes(q) || a.brand.toLowerCase().includes(q)
    const matchStatus = filterStatus === 'All' || a.status === filterStatus
    const matchType = filterType === 'All' || a.type === filterType
    return matchSearch && matchStatus && matchType
  })

  // Summary counts
  const counts = {
    total: assets.length,
    available: assets.filter(a => a.status === 'Available').length,
    assigned: assets.filter(a => a.status === 'Assigned').length,
    repair: assets.filter(a => a.status === 'In Repair').length,
  }

  const getAssignedEmployee = (assetId: string) => {
    const alloc = assetAllocations.find(al => al.assetId === assetId && al.status === 'Active')
    if (!alloc) return null
    return employees.find(e => e.id === alloc.employeeId) ?? null
  }

  const resetForm = () => {
    setAssetForm({
      name: '',
      type: 'Laptop',
      serialNumber: '',
      brand: '',
      model: '',
      status: 'Available',
      condition: 'Good',
      purchasedOn: new Date().toISOString().split('T')[0],
      warrantyUntil: '',
      notes: ''
    })
    setEditingAsset(null)
  }

  const openCreateForm = () => {
    resetForm()
    setIsAssetFormOpen(true)
  }

  const openEditForm = (asset: Asset) => {
    setEditingAsset(asset)
    setAssetForm({
      name: asset.name,
      type: asset.type,
      serialNumber: asset.serialNumber,
      brand: asset.brand,
      model: asset.model,
      status: asset.status,
      condition: asset.condition,
      purchasedOn: asset.purchasedOn,
      warrantyUntil: asset.warrantyUntil || '',
      notes: asset.notes || ''
    })
    setIsAssetFormOpen(true)
  }

  const submitAssetForm = (event: React.FormEvent) => {
    event.preventDefault()
    const payload = {
      name: assetForm.name,
      type: assetForm.type,
      serialNumber: assetForm.serialNumber,
      brand: assetForm.brand,
      model: assetForm.model,
      status: assetForm.status,
      condition: assetForm.condition,
      purchasedOn: assetForm.purchasedOn,
      warrantyUntil: assetForm.warrantyUntil || undefined,
      notes: assetForm.notes || undefined
    }
    if (editingAsset) updateAsset(editingAsset.id, payload)
    else addAsset(payload)
    setIsAssetFormOpen(false)
    resetForm()
  }

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-6 py-6">
      <section className="flex flex-col gap-4">
        <PageHeroBanner
          compact
          eyebrow={dateEyebrow}
          title="Assets"
          description="Track hardware, assignments, and asset lifecycle across your organization."
          actions={
            <Button variant="default" onClick={openCreateForm}>
              <Plus className="size-4" />
              Add Asset
            </Button>
          }
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricStatCard label="Total Assets" value={counts.total} subtitle="Registered items" tone="blue" icon={Package} />
          <MetricStatCard label="Available" value={counts.available} subtitle="Ready to assign" tone="mint" icon={CheckCircle2} />
          <MetricStatCard label="Assigned" value={counts.assigned} subtitle="In employee use" tone="indigo" icon={LaptopIcon} />
          <MetricStatCard label="In Repair" value={counts.repair} subtitle="Under maintenance" tone="amber" icon={Wrench} />
        </div>
      </section>

      <section className="flex items-center justify-end rounded-2xl border border-[#e2e8f0] bg-white px-4 py-3 shadow-sm">
        <FilterTriggerButton activeCount={activeFilterCount} onClick={openFilters} />
      </section>

      <SectionCard
        title={`Asset registry (${filtered.length})`}
        className="flex-1 min-h-0"
        bodyClassName="p-0"
        noPadding
      >
        <div className="overflow-x-auto p-5">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-ds-neutral-200">
                {['Asset', 'Type', 'Serial No.', 'Condition', 'Status', 'Assigned To', 'Actions'].map(h => (
                  <th key={h} className="py-3 px-3 text-ds-label uppercase text-ds-neutral-500 font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(asset => {
                const IconComp = ASSET_ICONS[asset.type] ?? Package
                const sc = STATUS_CONFIG[asset.status] ?? DEFAULT_STATUS_CONFIG
                const StatusIcon = sc.icon
                const assignedEmp = getAssignedEmployee(asset.id)
                return (
                  <tr
                    key={asset.id}
                    className="border-b border-ds-neutral-100 hover:bg-ds-neutral-50 transition-colors cursor-pointer group"
                    onClick={() => setSelectedAsset(asset)}
                  >
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-3">
                        <div className="size-9 rounded-lg bg-ds-brand-navy flex items-center justify-center text-white shrink-0">
                          <IconComp className="size-4" />
                        </div>
                        <div>
                          <p className="text-ds-body-sm font-semibold text-ds-brand-navy">{asset.name}</p>
                          <p className="text-ds-caption text-ds-neutral-400">{asset.brand} · {asset.model}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-ds-body-sm text-ds-neutral-600 whitespace-nowrap">{asset.type}</td>
                    <td className="py-3 px-3">
                      <span className="text-ds-caption font-mono text-ds-neutral-600 bg-ds-neutral-100 px-2 py-0.5 rounded">{asset.serialNumber}</span>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${CONDITION_PILL[asset.condition]}`}>
                        {asset.condition}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${sc.pill}`}>
                        <StatusIcon className="size-3" /> {asset.status}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      {assignedEmp ? (
                        <div className="flex items-center gap-2">
                          <div className="size-6 rounded-full bg-ds-brand-navy/10 text-ds-brand-navy flex items-center justify-center text-[10px] font-bold shrink-0">
                            {assignedEmp.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <span className="text-ds-body-sm text-ds-neutral-700 whitespace-nowrap">{assignedEmp.name}</span>
                        </div>
                      ) : (
                        <span className="text-ds-caption text-ds-neutral-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div
                        className="flex items-center justify-end gap-1.5"
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}
                      >
                        {asset.status === 'Available' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setAssignTarget(asset)}
                          >
                            Assign
                          </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={() => openEditForm(asset)}>
                          Edit
                        </Button>
                        <Button
                          variant="destructive-outline"
                          size="sm"
                          onClick={() => deleteAsset(asset.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="py-16 flex flex-col items-center justify-center text-center">
              <Package className="size-14 text-ds-neutral-200 mb-4" />
              <p className="text-ds-body font-semibold text-ds-neutral-500">No assets found</p>
              <p className="text-ds-body-sm text-ds-neutral-400">Try adjusting your search or filters.</p>
            </div>
          )}
        </div>
      </SectionCard>

      {selectedAsset && (
        <AssetDetailDrawer
          asset={selectedAsset}
          allocations={assetAllocations}
          onClose={() => setSelectedAsset(null)}
          onAssign={() => { setAssignTarget(selectedAsset); setSelectedAsset(null) }}
        />
      )}

      {assignTarget && (
        <AssignAssetModal
          asset={assignTarget}
          onClose={() => setAssignTarget(null)}
        />
      )}

      {isAssetFormOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ds-brand-navy/40 backdrop-blur-sm" onClick={() => setIsAssetFormOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 p-6" onClick={(event) => event.stopPropagation()}>
            <h3 className="text-ds-heading-sm font-bold text-ds-brand-navy mb-4">{editingAsset ? 'Edit Asset' : 'Add Asset'}</h3>
            <form onSubmit={submitAssetForm} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input required className="border border-ds-neutral-300 rounded-lg px-3 py-2" placeholder="Asset name" value={assetForm.name} onChange={(e) => setAssetForm(prev => ({ ...prev, name: e.target.value }))} />
              <input required className="border border-ds-neutral-300 rounded-lg px-3 py-2" placeholder="Serial number" value={assetForm.serialNumber} onChange={(e) => setAssetForm(prev => ({ ...prev, serialNumber: e.target.value }))} />
              <select className="border border-ds-neutral-300 rounded-lg px-3 py-2" value={assetForm.type} onChange={(e) => setAssetForm(prev => ({ ...prev, type: e.target.value as AssetType }))}>
                {(['Laptop', 'Monitor', 'Keyboard & Mouse', 'Headset', 'Mobile Phone', 'Access Card', 'SIM Card', 'Software License', 'Other'] as AssetType[]).map(type => <option key={type} value={type}>{type}</option>)}
              </select>
              <select className="border border-ds-neutral-300 rounded-lg px-3 py-2" value={assetForm.status} onChange={(e) => setAssetForm(prev => ({ ...prev, status: e.target.value as AssetStatus }))}>
                {(['Available', 'Assigned', 'In Repair', 'Retired'] as AssetStatus[]).map(status => <option key={status} value={status}>{status}</option>)}
              </select>
              <input required className="border border-ds-neutral-300 rounded-lg px-3 py-2" placeholder="Brand" value={assetForm.brand} onChange={(e) => setAssetForm(prev => ({ ...prev, brand: e.target.value }))} />
              <input required className="border border-ds-neutral-300 rounded-lg px-3 py-2" placeholder="Model" value={assetForm.model} onChange={(e) => setAssetForm(prev => ({ ...prev, model: e.target.value }))} />
              <input type="date" required className="border border-ds-neutral-300 rounded-lg px-3 py-2" value={assetForm.purchasedOn} onChange={(e) => setAssetForm(prev => ({ ...prev, purchasedOn: e.target.value }))} />
              <input type="date" className="border border-ds-neutral-300 rounded-lg px-3 py-2" value={assetForm.warrantyUntil} onChange={(e) => setAssetForm(prev => ({ ...prev, warrantyUntil: e.target.value }))} />
              <textarea className="md:col-span-2 border border-ds-neutral-300 rounded-lg px-3 py-2" rows={3} placeholder="Notes" value={assetForm.notes} onChange={(e) => setAssetForm(prev => ({ ...prev, notes: e.target.value }))} />
              <div className="md:col-span-2 flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setIsAssetFormOpen(false)}>Cancel</Button>
                <Button type="submit" variant="default">{editingAsset ? 'Save Changes' : 'Add Asset'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <FilterDrawer
        open={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        onApply={applyFilters}
        onClear={clearFilters}
      >
        <FilterField label="Search" htmlFor="asset-filter-search">
          <InputWrapper leftIcon={<Search className="size-4" />}>
            <Input
              id="asset-filter-search"
              hasLeftIcon
              placeholder="Name, serial, brand…"
              value={draftSearch}
              onChange={(e) => setDraftSearch(e.target.value)}
              className={FILTER_INPUT_CLASS}
            />
          </InputWrapper>
        </FilterField>
        <FilterField label="Status" htmlFor="asset-filter-status">
          <Select
            id="asset-filter-status"
            className={FILTER_INPUT_CLASS}
            value={draftStatus}
            onChange={(e) => setDraftStatus(e.target.value as AssetStatus | 'All')}
          >
            <option value="All">All Statuses</option>
            {(['Available', 'Assigned', 'In Repair', 'Retired'] as AssetStatus[]).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Type" htmlFor="asset-filter-type">
          <Select
            id="asset-filter-type"
            className={FILTER_INPUT_CLASS}
            value={draftType}
            onChange={(e) => setDraftType(e.target.value as AssetType | 'All')}
          >
            <option value="All">All Types</option>
            {assetTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
        </FilterField>
      </FilterDrawer>
    </div>
  )
}
