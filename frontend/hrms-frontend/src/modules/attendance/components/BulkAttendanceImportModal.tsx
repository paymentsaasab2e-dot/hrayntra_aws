"use client"

import * as React from 'react'
import { Button, DrawerWrapper, StatusBadge } from '@hryantra/ui'
import { api } from '@/shared/api'
import {
  Upload,
  Download,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Clock,
  ArrowRight,
  Database,
  XCircle,
} from 'lucide-react'

interface BulkAttendanceImportModalProps {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function BulkAttendanceImportModal({ open, onClose, onSuccess }: BulkAttendanceImportModalProps) {
  const [activeTab, setActiveTab] = React.useState<'paste' | 'file'>('paste')
  const [csvContent, setCsvContent] = React.useState(
    `employeeCode,date,checkIn,checkOut,status,reason\nEMP-001,2026-11-10,09:00,18:00,PRESENT,Regularization\nEMP-002,2026-11-10,09:30,13:30,HALFDAY,Doctor appointment\nEMP-003,2026-11-10,09:00,17:30,PRESENT,Punch machine sync issue`
  )
  const [fileName, setFileName] = React.useState('attendance_corrections.csv')
  const [isValidating, setIsValidating] = React.useState(false)
  const [validationResult, setValidationResult] = React.useState<any>(null)
  const [isCommitting, setIsCommitting] = React.useState(false)
  const [commitResult, setCommitResult] = React.useState<any>(null)
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)

  const handleDownloadTemplate = async () => {
    try {
      const res = await api.attendance.bulkImport.getTemplate()
      if (res?.data?.csv) {
        const blob = new Blob([res.data.csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = res.data.fileName || 'attendance_import_template.csv'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to download template')
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      setCsvContent(text)
    }
    reader.readAsText(file)
  }

  const parseCsvToRows = (rawText: string) => {
    const lines = rawText.split(/\r?\n/).filter((l) => l.trim().length > 0)
    if (lines.length < 2) return []

    const header = lines[0].split(',').map((h) => h.trim().toLowerCase())
    const codeIdx = header.findIndex((h) => h.includes('code') || h.includes('employee') || h.includes('id'))
    const dateIdx = header.findIndex((h) => h.includes('date'))
    const inIdx = header.findIndex((h) => h.includes('in') || h.includes('checkin') || h.includes('start'))
    const outIdx = header.findIndex((h) => h.includes('out') || h.includes('checkout') || h.includes('end'))
    const statusIdx = header.findIndex((h) => h.includes('status'))
    const reasonIdx = header.findIndex((h) => h.includes('reason') || h.includes('notes') || h.includes('remark'))

    const rows: any[] = []
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map((p) => p.trim())
      if (parts.length <= 1 && !parts[0]) continue

      rows.push({
        employeeCode: codeIdx >= 0 ? parts[codeIdx] : parts[0],
        date: dateIdx >= 0 ? parts[dateIdx] : parts[1],
        checkIn: inIdx >= 0 ? parts[inIdx] : parts[2],
        checkOut: outIdx >= 0 ? parts[outIdx] : parts[3],
        status: statusIdx >= 0 ? parts[statusIdx] : undefined,
        reason: reasonIdx >= 0 ? parts[reasonIdx] : 'Correction upload',
      })
    }
    return rows
  }

  const handleValidate = async () => {
    try {
      setErrorMsg(null)
      setValidationResult(null)
      setCommitResult(null)
      setIsValidating(true)

      const parsedRows = parseCsvToRows(csvContent)
      if (parsedRows.length === 0) {
        throw new Error('No valid CSV rows parsed. Please provide at least one header row and one data row.')
      }

      const res = await api.attendance.bulkImport.validate({
        fileName,
        rows: parsedRows,
      })

      if (res?.success) {
        setValidationResult(res.data)
      } else {
        throw new Error(res?.message || 'Validation failed')
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error validating CSV rows')
    } finally {
      setIsValidating(false)
    }
  }

  const handleCommit = async () => {
    try {
      if (!validationResult || !validationResult.validRows || validationResult.validRows.length === 0) {
        throw new Error('No valid rows available to commit')
      }

      setErrorMsg(null)
      setIsCommitting(true)

      const res = await api.attendance.bulkImport.commit({
        fileName,
        rows: validationResult.validRows,
      })

      if (res?.success) {
        setCommitResult(res.data)
        if (onSuccess) onSuccess()
      } else {
        throw new Error(res?.message || 'Commit failed')
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error applying attendance corrections')
    } finally {
      setIsCommitting(false)
    }
  }

  return (
    <DrawerWrapper
      open={open}
      onClose={onClose}
      title="Bulk Attendance Import & Corrections"
      size="xl"
    >
      <div className="flex flex-col gap-6 text-sm text-ds-neutral-800">
        {/* Top Header Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-ds-neutral-50 rounded-xl border border-ds-neutral-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700">
              <FileSpreadsheet className="size-5" />
            </div>
            <div>
              <p className="font-bold text-ds-brand-navy">Attendance Correction File</p>
              <p className="text-xs text-ds-neutral-500">Supports standard CSV with Employee Code, Date, Check-In, Check-Out</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="gap-2">
            <Download className="size-4" />
            Download Sample CSV
          </Button>
        </div>

        {errorMsg && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2.5 text-xs">
            <AlertCircle className="size-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {commitResult && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl space-y-2">
            <div className="flex items-center gap-2 font-bold text-emerald-800">
              <CheckCircle2 className="size-5 text-emerald-600" />
              Batch #{commitResult.batchId} Committed Successfully!
            </div>
            <p className="text-xs text-emerald-800">
              Applied <strong>{commitResult.successCount}</strong> attendance corrections across{' '}
              <strong>{commitResult.totalRows}</strong> evaluated rows.
            </p>
          </div>
        )}

        {/* Mode Selector */}
        <div className="flex items-center gap-2 border-b border-ds-neutral-200 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('paste')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'paste'
                ? 'bg-ds-brand-navy text-white shadow-2xs'
                : 'bg-white text-ds-neutral-600 hover:bg-ds-neutral-100 border border-ds-neutral-200'
            }`}
          >
            Direct CSV Paste / Edit
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('file')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'file'
                ? 'bg-ds-brand-navy text-white shadow-2xs'
                : 'bg-white text-ds-neutral-600 hover:bg-ds-neutral-100 border border-ds-neutral-200'
            }`}
          >
            Upload File (.csv)
          </button>
        </div>

        {activeTab === 'file' ? (
          <div className="border-2 border-dashed border-ds-neutral-300 rounded-xl p-8 flex flex-col items-center justify-center text-center bg-ds-neutral-50/50 hover:bg-ds-neutral-50 transition-all">
            <Upload className="size-8 text-ds-neutral-400 mb-2" />
            <p className="font-semibold text-ds-brand-navy">Choose a CSV file to upload</p>
            <p className="text-xs text-ds-neutral-500 mt-1 mb-4">Max file size 5MB · Standard UTF-8 encoded CSV</p>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
            />
          </div>
        ) : (
          <div className="space-y-2">
            <label className="text-xs font-bold text-ds-neutral-700">Paste or edit CSV rows directly:</label>
            <textarea
              rows={6}
              value={csvContent}
              onChange={(e) => setCsvContent(e.target.value)}
              className="w-full font-mono text-xs p-3 rounded-xl border border-ds-neutral-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-ds-neutral-50/30"
              placeholder="employeeCode,date,checkIn,checkOut,status,reason"
            />
          </div>
        )}

        {/* Validation Trigger Button */}
        <div>
          <Button
            variant="default"
            size="sm"
            onClick={handleValidate}
            disabled={isValidating || !csvContent.trim()}
            className="gap-2 bg-indigo-700 hover:bg-indigo-800 text-white"
          >
            {isValidating ? (
              <>
                <RefreshCw className="size-4 animate-spin" />
                Validating Rows & Checking Sanity...
              </>
            ) : (
              <>
                <CheckCircle2 className="size-4" />
                Validate Rows & Preview Diffs
              </>
            )}
          </Button>
        </div>

        {/* Validation Results Overview */}
        {validationResult && (
          <div className="space-y-4 pt-2 border-t border-ds-neutral-200">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[11px] font-bold text-slate-500 uppercase">Total Rows</span>
                <p className="text-lg font-black text-slate-900 mt-0.5">{validationResult.stats.totalRows}</p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                <span className="text-[11px] font-bold text-emerald-600 uppercase">Sanity Valid</span>
                <p className="text-lg font-black text-emerald-950 mt-0.5">{validationResult.stats.validRows}</p>
              </div>
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                <span className="text-[11px] font-bold text-amber-600 uppercase">Corrections (Existing)</span>
                <p className="text-lg font-black text-amber-950 mt-0.5">{validationResult.stats.correctionRows}</p>
              </div>
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200">
                <span className="text-[11px] font-bold text-rose-600 uppercase">Invalid / Errors</span>
                <p className="text-lg font-black text-rose-950 mt-0.5">{validationResult.stats.invalidRows}</p>
              </div>
            </div>

            {/* Rows Table */}
            <div className="rounded-xl border border-ds-neutral-200 overflow-hidden shadow-2xs">
              <div className="max-h-72 overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-ds-neutral-100 text-ds-neutral-700 font-bold sticky top-0 border-b border-ds-neutral-200">
                    <tr>
                      <th className="px-3 py-2">Row</th>
                      <th className="px-3 py-2">Employee</th>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Check-In / Out</th>
                      <th className="px-3 py-2">Duration</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Type / Diff</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ds-neutral-100">
                    {validationResult.rowPreviews?.map((r: any) => (
                      <tr key={r.row} className={r.isValid ? 'hover:bg-slate-50/60' : 'bg-rose-50/40'}>
                        <td className="px-3 py-2.5 font-mono text-[11px] font-bold text-slate-500">#{r.row}</td>
                        <td className="px-3 py-2.5">
                          <p className="font-bold text-ds-brand-navy">{r.employeeCode}</p>
                          <p className="text-[10px] text-slate-500">{r.employeeName || 'Unknown Employee'}</p>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap font-mono text-[11px]">{r.date}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap font-mono text-[11px]">
                          {r.checkIn || '--:--'} → {r.checkOut || '--:--'}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap font-semibold">
                          {r.durationHours > 0 ? `${r.durationHours.toFixed(1)} hrs` : '--'}
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                              r.computedStatus === 'PRESENT'
                                ? 'bg-emerald-100 text-emerald-800'
                                : r.computedStatus === 'HALFDAY'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {r.computedStatus}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          {!r.isValid ? (
                            <span className="text-rose-700 font-bold flex items-center gap-1 text-[11px]">
                              <XCircle className="size-3.5 shrink-0" />
                              {r.errorMessage}
                            </span>
                          ) : r.isCorrection ? (
                            <span className="text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded text-[10px] font-bold">
                              Update Existing Record
                            </span>
                          ) : (
                            <span className="text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded text-[10px] font-bold">
                              New Record
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Commit Section */}
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200 mt-3">
              <div>
                <p className="font-bold text-slate-900 text-xs">Ready to commit validated corrections?</p>
                <p className="text-[11px] text-slate-500">
                  {validationResult.stats.validRows} rows will be updated in the database with audit tracking.
                </p>
              </div>
              <Button
                variant="default"
                size="sm"
                onClick={handleCommit}
                disabled={isCommitting || validationResult.stats.validRows === 0}
                className="gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold"
              >
                {isCommitting ? (
                  <>
                    <RefreshCw className="size-4 animate-spin" />
                    Committing Batch...
                  </>
                ) : (
                  <>
                    <Database className="size-4" />
                    Commit {validationResult.stats.validRows} Records
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </DrawerWrapper>
  )
}
