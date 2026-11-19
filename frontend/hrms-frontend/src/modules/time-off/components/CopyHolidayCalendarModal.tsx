"use client"

import * as React from 'react'
import { Button } from '@hryantra/ui'
import { api } from '@/shared/api'
import {
  CalendarRange,
  Copy,
  AlertTriangle,
  CheckCircle2,
  X,
  RefreshCw,
  ArrowRight,
  Calendar,
  Check,
} from 'lucide-react'

interface CopyHolidayCalendarModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

interface HolidayPreviewItem {
  name: string
  originalDate: string
  originalDayOfWeek: string
  projectedDate: string
  projectedDayOfWeek: string
  type: string
  description?: string
  isWeekendConflict: boolean
  alreadyExistsInTarget: boolean
  selected: boolean
  adjustedDate: string
}

export function CopyHolidayCalendarModal({
  isOpen,
  onClose,
  onSuccess,
}: CopyHolidayCalendarModalProps) {
  const currentYear = new Date().getFullYear()
  const [fromYear, setFromYear] = React.useState<number>(currentYear - 1)
  const [toYear, setToYear] = React.useState<number>(currentYear)
  const [isLoadingPreview, setIsLoadingPreview] = React.useState(false)
  const [isExecuting, setIsExecuting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [previewList, setPreviewList] = React.useState<HolidayPreviewItem[]>([])
  const [previewFetched, setPreviewFetched] = React.useState(false)
  const [resultMessage, setResultMessage] = React.useState<string | null>(null)

  const handleFetchPreview = async () => {
    if (fromYear === toYear) {
      setError('Source year and target year cannot be identical.')
      return
    }
    setError(null)
    setResultMessage(null)
    setIsLoadingPreview(true)
    try {
      const res = await api.holidays.previewCopy(fromYear, toYear)
      if (res.success && Array.isArray(res.data?.preview)) {
        const items: HolidayPreviewItem[] = res.data.preview.map((p: any) => ({
          name: p.name,
          originalDate: p.originalDate,
          originalDayOfWeek: p.originalDayOfWeek,
          projectedDate: p.projectedDate,
          projectedDayOfWeek: p.projectedDayOfWeek,
          type: p.type || 'Public Holiday',
          description: p.description || '',
          isWeekendConflict: Boolean(p.isWeekendConflict),
          alreadyExistsInTarget: Boolean(p.alreadyExistsInTarget),
          selected: !p.alreadyExistsInTarget,
          adjustedDate: p.projectedDate,
        }))
        setPreviewList(items)
        setPreviewFetched(true)
      } else {
        setPreviewList([])
        setPreviewFetched(true)
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch holiday preview')
    } finally {
      setIsLoadingPreview(false)
    }
  }

  // Trigger preview on modal open if not yet fetched
  React.useEffect(() => {
    if (isOpen && !previewFetched) {
      handleFetchPreview()
    }
  }, [isOpen])

  const toggleSelectAll = () => {
    const selectable = previewList.filter((item) => !item.alreadyExistsInTarget)
    const allSelected = selectable.every((item) => item.selected)
    setPreviewList((prev) =>
      prev.map((item) =>
        item.alreadyExistsInTarget ? item : { ...item, selected: !allSelected }
      )
    )
  }

  const toggleItem = (index: number) => {
    setPreviewList((prev) =>
      prev.map((item, idx) =>
        idx === index ? { ...item, selected: !item.selected } : item
      )
    )
  }

  const updateAdjustedDate = (index: number, newDate: string) => {
    setPreviewList((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item
        const dayOfWeek = new Date(newDate).toLocaleDateString('en-US', { weekday: 'long' })
        const isWeekend = dayOfWeek === 'Saturday' || dayOfWeek === 'Sunday'
        return {
          ...item,
          adjustedDate: newDate,
          projectedDayOfWeek: dayOfWeek,
          isWeekendConflict: isWeekend,
        }
      })
    )
  }

  const handleExecuteCopy = async () => {
    const selectedItems = previewList.filter((item) => item.selected)
    if (selectedItems.length === 0) {
      setError('Please select at least one holiday to copy.')
      return
    }

    setIsExecuting(true)
    setError(null)
    try {
      const selections = selectedItems.map((item) => ({
        name: item.name,
        date: item.adjustedDate,
        type: item.type,
        description: item.description,
      }))

      const res = await api.holidays.executeCopy({
        fromYear,
        toYear,
        selections,
      })

      setResultMessage(res.message || `Successfully copied ${res.data?.copiedCount || selectedItems.length} holidays to ${toYear}`)
      setTimeout(() => {
        onSuccess()
        onClose()
      }, 1200)
    } catch (err: any) {
      setError(err?.message || 'Failed to copy holidays')
    } finally {
      setIsExecuting(false)
    }
  }

  if (!isOpen) return null

  const selectedCount = previewList.filter((i) => i.selected).length
  const conflictCount = previewList.filter((i) => i.isWeekendConflict && !i.alreadyExistsInTarget).length
  const existingCount = previewList.filter((i) => i.alreadyExistsInTarget).length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
      <div className="flex flex-col w-full max-w-4xl max-h-[90vh] rounded-2xl border border-ds-neutral-200 bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-ds-neutral-200 px-6 py-4 bg-ds-neutral-50/60">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100 text-teal-700">
              <Copy className="size-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-ds-brand-navy">
                Copy Holiday Calendar
              </h3>
              <p className="text-xs text-ds-neutral-500">
                Project previous year's holiday dates into target year with smart weekend conflict detection
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-ds-neutral-400 hover:bg-ds-neutral-100 hover:text-ds-brand-navy transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Controls: Year Pickers & Preview Action */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border border-ds-neutral-200 bg-ds-neutral-50/40">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-ds-neutral-600 uppercase tracking-wider">
                  Source Year
                </label>
                <input
                  type="number"
                  min="2020"
                  max="2035"
                  value={fromYear}
                  onChange={(e) => setFromYear(parseInt(e.target.value, 10) || currentYear - 1)}
                  className="w-28 rounded-lg border border-ds-neutral-300 px-3 py-1.5 text-xs font-semibold text-ds-brand-navy focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="pt-5 text-ds-neutral-400">
                <ArrowRight className="size-4" />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-ds-neutral-600 uppercase tracking-wider">
                  Target Year
                </label>
                <input
                  type="number"
                  min="2020"
                  max="2035"
                  value={toYear}
                  onChange={(e) => setToYear(parseInt(e.target.value, 10) || currentYear)}
                  className="w-28 rounded-lg border border-ds-neutral-300 px-3 py-1.5 text-xs font-semibold text-ds-brand-navy focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="pt-5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleFetchPreview}
                  disabled={isLoadingPreview}
                  className="gap-2"
                >
                  <RefreshCw className={`size-3.5 ${isLoadingPreview ? 'animate-spin' : ''}`} />
                  {isLoadingPreview ? 'Projecting...' : 'Fetch Preview'}
                </Button>
              </div>
            </div>

            {/* Quick Stats Pill */}
            {previewFetched && (
              <div className="flex items-center gap-2 text-xs">
                <span className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 font-medium">
                  {previewList.length} Source Holidays
                </span>
                {conflictCount > 0 && (
                  <span className="px-2.5 py-1 rounded-md bg-amber-50 text-amber-800 font-semibold flex items-center gap-1 border border-amber-200">
                    <AlertTriangle className="size-3.5 text-amber-600" />
                    {conflictCount} Weekend Conflicts
                  </span>
                )}
                {existingCount > 0 && (
                  <span className="px-2.5 py-1 rounded-md bg-neutral-100 text-neutral-600 font-medium">
                    {existingCount} Already Exist
                  </span>
                )}
              </div>
            )}
          </div>

          {error && (
            <div className="p-3 text-xs rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2">
              <AlertTriangle className="size-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {resultMessage && (
            <div className="p-3 text-xs rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
              <span>{resultMessage}</span>
            </div>
          )}

          {/* Table Container */}
          {previewFetched && (
            <div className="rounded-xl border border-ds-neutral-200 overflow-hidden">
              <div className="max-h-[380px] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-ds-neutral-100 text-ds-neutral-600 font-bold border-b border-ds-neutral-200 z-10">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={
                            previewList.filter((i) => !i.alreadyExistsInTarget).length > 0 &&
                            previewList
                              .filter((i) => !i.alreadyExistsInTarget)
                              .every((i) => i.selected)
                          }
                          onChange={toggleSelectAll}
                          className="rounded border-ds-neutral-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                        />
                      </th>
                      <th className="py-2.5 px-3">Holiday Name</th>
                      <th className="py-2.5 px-3">Source ({fromYear})</th>
                      <th className="py-2.5 px-3">Projected Target ({toYear})</th>
                      <th className="py-2.5 px-3">Adjust Date</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ds-neutral-200">
                    {previewList.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-ds-neutral-400">
                          No holidays found in year {fromYear} to copy from.
                        </td>
                      </tr>
                    ) : (
                      previewList.map((item, idx) => (
                        <tr
                          key={`${item.name}-${idx}`}
                          className={`hover:bg-ds-neutral-50/70 transition-colors ${
                            item.alreadyExistsInTarget
                              ? 'bg-neutral-50/60 opacity-60'
                              : item.selected
                              ? 'bg-teal-50/30'
                              : ''
                          }`}
                        >
                          <td className="py-2 px-3 text-center">
                            <input
                              type="checkbox"
                              disabled={item.alreadyExistsInTarget}
                              checked={item.selected}
                              onChange={() => toggleItem(idx)}
                              className="rounded border-ds-neutral-300 text-teal-600 focus:ring-teal-500 cursor-pointer disabled:cursor-not-allowed"
                            />
                          </td>
                          <td className="py-2 px-3 font-semibold text-ds-brand-navy">
                            <div>{item.name}</div>
                            {item.description && (
                              <div className="text-[10px] text-ds-neutral-400 font-normal truncate max-w-xs">
                                {item.description}
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-3 text-ds-neutral-600">
                            <div>{new Date(item.originalDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</div>
                            <div className="text-[10px] text-ds-neutral-400">{item.originalDayOfWeek}</div>
                          </td>
                          <td className="py-2 px-3 font-medium">
                            <div className="flex items-center gap-1.5">
                              <span>
                                {new Date(item.adjustedDate).toLocaleDateString('en-GB', {
                                  day: '2-digit',
                                  month: 'short',
                                })}
                              </span>
                              <span className="text-[10px] text-ds-neutral-500">
                                ({item.projectedDayOfWeek})
                              </span>
                            </div>
                            {item.isWeekendConflict && !item.alreadyExistsInTarget && (
                              <div className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-amber-700 bg-amber-100/70 px-1.5 py-0.5 rounded font-medium">
                                <AlertTriangle className="size-3 text-amber-600" />
                                <span>Falls on Weekend</span>
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="date"
                              disabled={item.alreadyExistsInTarget || !item.selected}
                              value={item.adjustedDate}
                              onChange={(e) => updateAdjustedDate(idx, e.target.value)}
                              className="rounded border border-ds-neutral-300 px-2 py-1 text-xs text-ds-neutral-700 focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:bg-neutral-100 disabled:text-neutral-400"
                            />
                          </td>
                          <td className="py-2 px-3">
                            {item.alreadyExistsInTarget ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-neutral-600 bg-neutral-200 px-2 py-0.5 rounded">
                                Already Exists
                              </span>
                            ) : item.selected ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-teal-800 bg-teal-100 px-2 py-0.5 rounded">
                                <Check className="size-3 text-teal-700" />
                                Selected
                              </span>
                            ) : (
                              <span className="text-[10px] text-ds-neutral-400">
                                Excluded
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-ds-neutral-200 px-6 py-3.5 bg-ds-neutral-50/50">
          <div className="text-xs text-ds-neutral-500">
            {previewFetched && (
              <span>
                <strong>{selectedCount}</strong> holidays selected to copy into <strong>{toYear}</strong>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={isExecuting}>
              Cancel
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleExecuteCopy}
              disabled={isExecuting || selectedCount === 0}
              className="gap-2 bg-teal-600 hover:bg-teal-700 text-white"
            >
              {isExecuting ? (
                <>
                  <RefreshCw className="size-3.5 animate-spin" />
                  Copying...
                </>
              ) : (
                <>
                  <Copy className="size-3.5" />
                  Copy {selectedCount > 0 ? `${selectedCount} Holidays` : 'Calendar'}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

