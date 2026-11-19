'use client'
import * as React from 'react'
import { Asset, AssetAllocation } from '../types'
import { useStore } from '@/store/StoreProvider'
import { Button } from '@hryantra/ui'
import { PrinterIcon, X } from 'lucide-react'

interface Props {
  asset: Asset
  allocation: AssetAllocation
  onClose: () => void
}

export function AssetReceiptView({ asset, allocation, onClose }: Props) {
  const { employees } = useStore()
  const emp = employees.find(e => e.id === allocation.employeeId)
  const issuer = employees.find(e => e.id === allocation.issuedBy)
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ds-brand-navy/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-ds-neutral-200">
          <h3 className="text-ds-heading-sm font-bold text-ds-brand-navy">Asset Issuance Receipt</h3>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <PrinterIcon className="size-4 mr-1.5" /> Print
            </Button>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-ds-neutral-100 text-ds-neutral-400 transition-colors">
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Printable Receipt */}
        <div id="asset-receipt" className="p-8 space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="size-7 bg-ds-brand-navy rounded flex items-center justify-center">
                  <span className="text-white text-xs font-black">Hr</span>
                </div>
                <span className="text-ds-heading-sm font-bold text-ds-brand-navy">Yantra HRMS</span>
              </div>
              <p className="text-ds-caption text-ds-neutral-500">Asset Issuance Certificate</p>
            </div>
            <div className="text-right">
              <p className="text-ds-caption text-ds-neutral-500">Receipt No.</p>
              <p className="text-ds-body-sm font-bold text-ds-brand-navy">{allocation.id}</p>
              <p className="text-ds-caption text-ds-neutral-400 mt-1">{today}</p>
            </div>
          </div>

          <div className="border-t border-dashed border-ds-neutral-300" />

          {/* Employee Info */}
          <div>
            <p className="text-ds-label-upper text-ds-neutral-400 mb-3">Issued To</p>
            <div className="grid grid-cols-2 gap-3 text-ds-body-sm">
              <div><span className="text-ds-neutral-500 block text-ds-caption">Name</span><strong>{emp?.name ?? allocation.employeeId}</strong></div>
              <div><span className="text-ds-neutral-500 block text-ds-caption">Employee ID</span><strong>{emp?.id}</strong></div>
              <div><span className="text-ds-neutral-500 block text-ds-caption">Designation</span><strong>{emp?.designation}</strong></div>
              <div><span className="text-ds-neutral-500 block text-ds-caption">Department</span><strong>{emp?.department}</strong></div>
            </div>
          </div>

          <div className="border-t border-dashed border-ds-neutral-300" />

          {/* Asset Info */}
          <div>
            <p className="text-ds-label-upper text-ds-neutral-400 mb-3">Asset Details</p>
            <div className="grid grid-cols-2 gap-3 text-ds-body-sm">
              <div><span className="text-ds-neutral-500 block text-ds-caption">Asset Name</span><strong>{asset.name}</strong></div>
              <div><span className="text-ds-neutral-500 block text-ds-caption">Asset ID</span><strong>{asset.id}</strong></div>
              <div><span className="text-ds-neutral-500 block text-ds-caption">Type</span><strong>{asset.type}</strong></div>
              <div><span className="text-ds-neutral-500 block text-ds-caption">Serial Number</span><strong>{asset.serialNumber}</strong></div>
              <div><span className="text-ds-neutral-500 block text-ds-caption">Brand / Model</span><strong>{asset.brand} {asset.model}</strong></div>
              <div><span className="text-ds-neutral-500 block text-ds-caption">Condition</span><strong>{allocation.conditionOnIssue}</strong></div>
              <div><span className="text-ds-neutral-500 block text-ds-caption">Issue Date</span><strong>{allocation.issuedOn}</strong></div>
              {allocation.expectedReturn && (
                <div><span className="text-ds-neutral-500 block text-ds-caption">Expected Return</span><strong>{allocation.expectedReturn}</strong></div>
              )}
            </div>
          </div>

          {allocation.notes && (
            <div className="bg-ds-neutral-50 border border-ds-neutral-200 rounded-lg p-3">
              <span className="text-ds-caption text-ds-neutral-500 block mb-1">Handover Notes</span>
              <p className="text-ds-body-sm italic">"{allocation.notes}"</p>
            </div>
          )}

          <div className="border-t border-dashed border-ds-neutral-300" />

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-8 pt-2">
            <div>
              <div className="h-10 border-b border-ds-neutral-400 mb-2" />
              <p className="text-ds-caption text-ds-neutral-500">Employee Signature</p>
              <p className="text-ds-body-sm font-medium">{emp?.name}</p>
            </div>
            <div>
              <div className="h-10 border-b border-ds-neutral-400 mb-2" />
              <p className="text-ds-caption text-ds-neutral-500">Issued By (HR/IT)</p>
              <p className="text-ds-body-sm font-medium">{issuer?.name ?? allocation.issuedBy}</p>
            </div>
          </div>

          <p className="text-[10px] text-ds-neutral-400 text-center border-t pt-4">
            This document serves as an official record of asset issuance. The recipient is responsible for the safekeeping of the assigned asset.
          </p>
        </div>
      </div>
    </div>
  )
}
