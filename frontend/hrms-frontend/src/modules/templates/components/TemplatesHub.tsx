"use client"

import * as React from 'react'
import { Button, SectionCard } from '@hryantra/ui'
import { api } from '@/shared/api'
import { useStore } from '@/store/StoreProvider'
import {
  FileCode2,
  Plus,
  Sparkles,
  Search,
  Copy,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Send,
  Eye,
  Check,
  X,
  Layers,
  Banknote,
  CalendarDays,
  Clock,
  ListChecks,
  Tag,
  ArrowRight,
} from 'lucide-react'

type TemplateType =
  | 'ALL'
  | 'SALARY'
  | 'LEAVE_PLAN'
  | 'HOLIDAY_CALENDAR'
  | 'SHIFT'
  | 'CHECKLIST'

interface HrTemplate {
  id: string
  tenantId: string
  name: string
  code: string
  type: TemplateType
  description?: string
  version?: number
  isDefault: boolean
  tags?: string[]
  config?: any
  configPayload?: any
  createdAt: string
  updatedAt: string
}

const TYPE_CONFIG: Record<
  TemplateType,
  { label: string; icon: any; colorClass: string; badgeClass: string }
> = {
  ALL: {
    label: 'All Blueprints',
    icon: Layers,
    colorClass: 'text-ds-brand-navy',
    badgeClass: 'bg-neutral-100 text-neutral-800',
  },
  SALARY: {
    label: 'Salary (CTC)',
    icon: Banknote,
    colorClass: 'text-emerald-700',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  LEAVE_PLAN: {
    label: 'Leave Policy',
    icon: CalendarDays,
    colorClass: 'text-blue-700',
    badgeClass: 'bg-blue-50 text-blue-800 border-blue-200',
  },
  HOLIDAY_CALENDAR: {
    label: 'Holiday Calendar',
    icon: CalendarDays,
    colorClass: 'text-amber-700',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  SHIFT: {
    label: 'Shift & Roster',
    icon: Clock,
    colorClass: 'text-indigo-700',
    badgeClass: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  },
  CHECKLIST: {
    label: 'Checklist (Onboarding/Exit)',
    icon: ListChecks,
    colorClass: 'text-teal-700',
    badgeClass: 'bg-teal-50 text-teal-800 border-teal-200',
  },
}

export function TemplatesHub() {
  const { employees } = useStore()
  const [templates, setTemplates] = React.useState<HrTemplate[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [selectedType, setSelectedType] = React.useState<TemplateType>('ALL')
  const [searchQuery, setSearchQuery] = React.useState('')
  const [feedback, setFeedback] = React.useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Inspection modal
  const [inspectedTemplate, setInspectedTemplate] = React.useState<HrTemplate | null>(null)

  // Duplicate modal
  const [duplicatingTemplate, setDuplicatingTemplate] = React.useState<HrTemplate | null>(null)
  const [duplicateName, setDuplicateName] = React.useState('')
  const [duplicateCode, setDuplicateCode] = React.useState('')

  // Apply modal
  const [applyingTemplate, setApplyingTemplate] = React.useState<HrTemplate | null>(null)
  const [selectedEmployeeIds, setSelectedEmployeeIds] = React.useState<string[]>([])
  const [applyAllEmployees, setApplyAllEmployees] = React.useState(true)
  const [isApplying, setIsApplying] = React.useState(false)

  // Create modal
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [createForm, setCreateForm] = React.useState({
    name: '',
    code: '',
    type: 'SALARY' as TemplateType,
    description: '',
    tags: '',
    configPayloadJson: '{\n  "note": "Custom setup template payload"\n}',
  })

  const loadTemplates = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await api.templates.getAll()
      setTemplates(Array.isArray(res.data) ? res.data : [])
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load templates' })
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadTemplates()
  }, [loadTemplates])

  const handleSeedStandards = async () => {
    setIsLoading(true)
    setFeedback(null)
    try {
      const res = await api.templates.seedStandards()
      setFeedback({
        type: 'success',
        message: `Standard blueprints verified: ${res.data?.createdCount || 0} created, ${res.data?.totalStandardCount || 9} available.`,
      })
      await loadTemplates()
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to seed templates' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteTemplate = async (template: HrTemplate) => {
    if (!window.confirm(`Are you sure you want to delete template "${template.name}"?`)) return
    try {
      await api.templates.delete(template.id)
      setFeedback({ type: 'success', message: `Template "${template.name}" deleted successfully.` })
      setTemplates((prev) => prev.filter((t) => t.id !== template.id))
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to delete template' })
    }
  }

  const handleDuplicateSubmit = async () => {
    if (!duplicatingTemplate || !duplicateName || !duplicateCode) return
    try {
      const res = await api.templates.duplicate(duplicatingTemplate.id, {
        newName: duplicateName,
        newCode: duplicateCode,
      })
      setFeedback({ type: 'success', message: `Duplicated into "${res.data?.name || duplicateName}"` })
      setDuplicatingTemplate(null)
      await loadTemplates()
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to duplicate template' })
    }
  }

  const handleApplySubmit = async () => {
    if (!applyingTemplate) return
    setIsApplying(true)
    try {
      const targetEmployeeIds = applyAllEmployees
        ? employees.map((e) => e.id)
        : selectedEmployeeIds

      const res = await api.templates.apply(applyingTemplate.id, {
        employeeIds: targetEmployeeIds,
      })
      setFeedback({
        type: 'success',
        message: res.message || `Template applied to ${targetEmployeeIds.length} employees`,
      })
      setApplyingTemplate(null)
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to apply template' })
    } finally {
      setIsApplying(false)
    }
  }

  const handleCreateSubmit = async () => {
    if (!createForm.name || !createForm.code) {
      setFeedback({ type: 'error', message: 'Name and Code are required' })
      return
    }
    let parsedPayload: any
    try {
      parsedPayload = JSON.parse(createForm.configPayloadJson)
    } catch {
      setFeedback({ type: 'error', message: 'Configuration payload must be valid JSON' })
      return
    }

    try {
      await api.templates.create({
        name: createForm.name,
        code: createForm.code,
        type: createForm.type,
        description: createForm.description || undefined,
        tags: createForm.tags
          ? createForm.tags.split(',').map((t) => t.trim()).filter(Boolean)
          : [],
        configPayload: parsedPayload,
      })
      setFeedback({ type: 'success', message: `Template "${createForm.name}" created!` })
      setIsCreateOpen(false)
      setCreateForm({
        name: '',
        code: '',
        type: 'SALARY',
        description: '',
        tags: '',
        configPayloadJson: '{\n  "note": "Custom setup template payload"\n}',
      })
      await loadTemplates()
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to create template' })
    }
  }

  // Filter templates
  const filteredTemplates = React.useMemo(() => {
    return templates.filter((tpl) => {
      const matchesType = selectedType === 'ALL' || tpl.type === selectedType
      const matchesSearch =
        searchQuery.trim() === '' ||
        tpl.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tpl.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (tpl.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (tpl.tags || []).some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()))
      return matchesType && matchesSearch
    })
  }, [templates, selectedType, searchQuery])

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Top Banner / Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-2xl border border-ds-neutral-200 bg-linear-to-r from-ds-neutral-50 via-white to-blue-50/30">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ds-brand-navy text-white shadow-xs">
            <FileCode2 className="size-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-ds-brand-navy">
                HR Setup Templates & Blueprints
              </h2>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                {templates.length} Templates
              </span>
            </div>
            <p className="text-xs text-ds-neutral-500 mt-0.5">
              Reusable enterprise blueprints for Indian Salary CTC, Leave Plans, Holiday Calendars, Shift Rosters, and Onboarding/Exit Checklists.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSeedStandards}
            disabled={isLoading}
            className="gap-2 border-ds-neutral-300 text-ds-brand-navy hover:bg-ds-neutral-100"
          >
            <Sparkles className="size-4 text-amber-500" />
            Seed Standard Indian Templates
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            className="gap-2 bg-ds-brand-navy hover:bg-ds-brand-navy/90 text-white"
          >
            <Plus className="size-4" />
            Create Blueprint
          </Button>
        </div>
      </div>

      {feedback && (
        <div
          className={`flex items-center justify-between p-3.5 text-xs rounded-xl border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="size-4 text-rose-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-ds-neutral-400 hover:text-ds-neutral-600"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Type Filter Pills & Search */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1">
          {(Object.keys(TYPE_CONFIG) as TemplateType[]).map((typeKey) => {
            const conf = TYPE_CONFIG[typeKey]
            const Icon = conf.icon
            const isSelected = selectedType === typeKey
            const count =
              typeKey === 'ALL'
                ? templates.length
                : templates.filter((t) => t.type === typeKey).length

            return (
              <button
                key={typeKey}
                type="button"
                onClick={() => setSelectedType(typeKey)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  isSelected
                    ? 'bg-ds-brand-navy text-white shadow-2xs'
                    : 'bg-white border border-ds-neutral-200 text-ds-neutral-600 hover:bg-ds-neutral-50'
                }`}
              >
                <Icon className={`size-3.5 ${isSelected ? 'text-white' : conf.colorClass}`} />
                <span>{conf.label}</span>
                <span
                  className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-ds-neutral-100 text-ds-neutral-500'
                  }`}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        <div className="relative min-w-[240px]">
          <Search className="size-3.5 absolute left-3 top-2.5 text-ds-neutral-400" />
          <input
            type="text"
            placeholder="Search templates or tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-ds-neutral-300 bg-white pl-9 pr-3 py-1.5 text-xs text-ds-neutral-800 placeholder:text-ds-neutral-400 focus:outline-none focus:ring-1 focus:ring-ds-brand-navy"
          />
        </div>
      </div>

      {/* Template Cards Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 rounded-2xl border border-ds-neutral-200 bg-ds-neutral-50 animate-pulse" />
          ))}
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-ds-neutral-300 bg-white">
          <FileCode2 className="size-12 text-ds-neutral-300 mb-3" />
          <h4 className="text-sm font-bold text-ds-brand-navy">No templates found</h4>
          <p className="text-xs text-ds-neutral-500 mt-1 max-w-sm">
            {searchQuery
              ? 'Try modifying your search query or clear the filter.'
              : 'Click "Seed Standard Indian Templates" to generate out-of-the-box corporate blueprints for CTC, Leaves, Shifts, and Checklists.'}
          </p>
          {!searchQuery && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSeedStandards}
              className="mt-4 gap-2"
            >
              <Sparkles className="size-4 text-amber-500" />
              Seed Standard Indian Templates
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((tpl) => {
            const conf = TYPE_CONFIG[tpl.type] || TYPE_CONFIG.ALL
            const Icon = conf.icon
            return (
              <div
                key={tpl.id}
                className="flex flex-col justify-between rounded-2xl border border-ds-neutral-200 bg-white p-5 shadow-2xs hover:shadow-md transition-shadow relative overflow-hidden group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2.5">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${conf.badgeClass}`}
                    >
                      <Icon className="size-3" />
                      {conf.label}
                    </span>
                    <div className="flex items-center gap-1">
                      {tpl.isDefault && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Standard Default
                        </span>
                      )}
                      <span className="text-[10px] font-semibold text-ds-neutral-400">
                        v{tpl.version}
                      </span>
                    </div>
                  </div>

                  <h3 className="text-sm font-bold text-ds-brand-navy leading-snug">
                    {tpl.name}
                  </h3>
                  <div className="text-[10px] font-mono text-ds-neutral-400 mt-0.5">
                    {tpl.code}
                  </div>

                  <p className="text-xs text-ds-neutral-600 mt-2 line-clamp-2 leading-relaxed">
                    {tpl.description || 'No description provided.'}
                  </p>

                  {/* Tags */}
                  {Array.isArray(tpl.tags) && tpl.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {tpl.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-md bg-ds-neutral-100 text-ds-neutral-600"
                        >
                          <Tag className="size-2.5 text-ds-neutral-400" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Card Actions Footer */}
                <div className="pt-4 mt-4 border-t border-ds-neutral-100 flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setInspectedTemplate(tpl)}
                      className="h-7 text-[11px] px-2.5 gap-1 text-ds-neutral-700"
                    >
                      <Eye className="size-3" />
                      Inspect
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setDuplicatingTemplate(tpl)
                        setDuplicateName(`${tpl.name} (Copy)`)
                        setDuplicateCode(`${tpl.code}-COPY`)
                      }}
                      className="h-7 text-[11px] px-2.5 gap-1 text-ds-neutral-700"
                    >
                      <Copy className="size-3" />
                      Duplicate
                    </Button>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => {
                        setApplyingTemplate(tpl)
                        setApplyAllEmployees(true)
                        setSelectedEmployeeIds([])
                      }}
                      className="h-7 text-[11px] px-2.5 gap-1 bg-teal-600 hover:bg-teal-700 text-white"
                    >
                      <Send className="size-3" />
                      Apply
                    </Button>

                    {!tpl.isDefault && (
                      <button
                        type="button"
                        onClick={() => handleDeleteTemplate(tpl)}
                        className="p-1.5 rounded-lg text-ds-neutral-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title="Delete Template"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Inspect / Payload Preview Modal */}
      {inspectedTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="flex flex-col w-full max-w-2xl max-h-[85vh] rounded-2xl border border-ds-neutral-200 bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-ds-neutral-200 px-6 py-4 bg-ds-neutral-50/60">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700">
                  {inspectedTemplate.type}
                </span>
                <h3 className="text-base font-bold text-ds-brand-navy">
                  {inspectedTemplate.name}
                </h3>
                <p className="text-xs text-ds-neutral-500 font-mono">
                  Code: {inspectedTemplate.code} • v{inspectedTemplate.version}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectedTemplate(null)}
                className="p-1 rounded-lg text-ds-neutral-400 hover:bg-ds-neutral-100"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <h4 className="text-xs font-bold text-ds-neutral-700 uppercase tracking-wider mb-1">
                  Description
                </h4>
                <p className="text-xs text-ds-neutral-600">
                  {inspectedTemplate.description || 'No description.'}
                </p>
              </div>

              <div>
                <h4 className="text-xs font-bold text-ds-neutral-700 uppercase tracking-wider mb-2">
                  Configuration Payload (Blueprint Data)
                </h4>
                <div className="rounded-xl border border-ds-neutral-300 bg-ds-neutral-900 text-teal-300 p-4 font-mono text-xs overflow-x-auto max-h-[360px]">
                  <pre>{JSON.stringify(inspectedTemplate.config || inspectedTemplate.configPayload, null, 2)}</pre>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end border-t border-ds-neutral-200 px-6 py-3.5 bg-ds-neutral-50">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setInspectedTemplate(null)}
              >
                Close Preview
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Modal */}
      {duplicatingTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-ds-neutral-200 bg-white shadow-2xl p-6">
            <h3 className="text-base font-bold text-ds-brand-navy mb-1">
              Duplicate Blueprint
            </h3>
            <p className="text-xs text-ds-neutral-500 mb-4">
              Create a custom clone of <strong>{duplicatingTemplate.name}</strong> to adjust for specific grades or locations.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-ds-neutral-700 block mb-1">
                  New Template Name
                </label>
                <input
                  type="text"
                  value={duplicateName}
                  onChange={(e) => setDuplicateName(e.target.value)}
                  className="w-full rounded-xl border border-ds-neutral-300 px-3 py-2 text-xs text-ds-brand-navy focus:outline-none focus:ring-1 focus:ring-ds-brand-navy"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-ds-neutral-700 block mb-1">
                  New Unique Code
                </label>
                <input
                  type="text"
                  value={duplicateCode}
                  onChange={(e) => setDuplicateCode(e.target.value.toUpperCase())}
                  className="w-full rounded-xl border border-ds-neutral-300 px-3 py-2 text-xs font-mono text-ds-brand-navy focus:outline-none focus:ring-1 focus:ring-ds-brand-navy"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDuplicatingTemplate(null)}
              >
                Cancel
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleDuplicateSubmit}
                disabled={!duplicateName || !duplicateCode}
                className="bg-ds-brand-navy text-white"
              >
                Clone Template
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Apply to Employees Modal */}
      {applyingTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="flex flex-col w-full max-w-lg max-h-[85vh] rounded-2xl border border-ds-neutral-200 bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-ds-neutral-200 px-6 py-4 bg-ds-neutral-50/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-teal-100 text-teal-800">
                  <Send className="size-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-ds-brand-navy">
                    Apply Blueprint
                  </h3>
                  <p className="text-xs text-ds-neutral-500">
                    {applyingTemplate.name} ({applyingTemplate.type})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setApplyingTemplate(null)}
                className="p-1 rounded-lg text-ds-neutral-400 hover:bg-ds-neutral-100"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 leading-relaxed">
                Applying this template will associate its settings (such as salary components, leave quotas, or shift definitions) to the target employees.
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-ds-neutral-700 uppercase tracking-wider block">
                  Select Scope
                </label>
                <label className="flex items-center gap-2 p-2.5 rounded-xl border border-ds-neutral-200 bg-ds-neutral-50 cursor-pointer">
                  <input
                    type="radio"
                    name="applyScope"
                    checked={applyAllEmployees}
                    onChange={() => setApplyAllEmployees(true)}
                    className="text-teal-600 focus:ring-teal-500"
                  />
                  <span className="text-xs font-semibold text-ds-brand-navy">
                    All Active Employees ({employees.length} total)
                  </span>
                </label>

                <label className="flex items-center gap-2 p-2.5 rounded-xl border border-ds-neutral-200 bg-ds-neutral-50 cursor-pointer">
                  <input
                    type="radio"
                    name="applyScope"
                    checked={!applyAllEmployees}
                    onChange={() => setApplyAllEmployees(false)}
                    className="text-teal-600 focus:ring-teal-500"
                  />
                  <span className="text-xs font-semibold text-ds-brand-navy">
                    Selected Employees Only
                  </span>
                </label>
              </div>

              {!applyAllEmployees && (
                <div className="border border-ds-neutral-200 rounded-xl p-3 max-h-48 overflow-y-auto space-y-1.5">
                  {employees.map((emp) => {
                    const isChecked = selectedEmployeeIds.includes(emp.id)
                    return (
                      <label
                        key={emp.id}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-ds-neutral-50 cursor-pointer text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              setSelectedEmployeeIds((prev) =>
                                isChecked ? prev.filter((id) => id !== emp.id) : [...prev, emp.id]
                              )
                            }}
                            className="rounded border-ds-neutral-300 text-teal-600 focus:ring-teal-500"
                          />
                          <span className="font-semibold text-ds-brand-navy">{emp.name}</span>
                        </div>
                        <span className="text-[11px] text-ds-neutral-400">
                          {emp.designation || emp.department || emp.id}
                        </span>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-ds-neutral-200 px-6 py-3.5 bg-ds-neutral-50">
              <span className="text-xs text-ds-neutral-500">
                Target:{' '}
                <strong>
                  {applyAllEmployees ? employees.length : selectedEmployeeIds.length} employees
                </strong>
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setApplyingTemplate(null)}
                  disabled={isApplying}
                >
                  Cancel
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleApplySubmit}
                  disabled={isApplying || (!applyAllEmployees && selectedEmployeeIds.length === 0)}
                  className="bg-teal-600 hover:bg-teal-700 text-white gap-2"
                >
                  {isApplying ? 'Applying...' : 'Confirm & Apply'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Blueprint Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="flex flex-col w-full max-w-xl max-h-[85vh] rounded-2xl border border-ds-neutral-200 bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-ds-neutral-200 px-6 py-4 bg-ds-neutral-50/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-ds-brand-navy text-white">
                  <Plus className="size-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-ds-brand-navy">
                    Create Custom Blueprint
                  </h3>
                  <p className="text-xs text-ds-neutral-500">
                    Define a reusable configuration template
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="p-1 rounded-lg text-ds-neutral-400 hover:bg-ds-neutral-100"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-ds-neutral-700 block mb-1">
                    Template Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Executive Leave Plan"
                    value={createForm.name}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
                    className="w-full rounded-xl border border-ds-neutral-300 px-3 py-2 text-xs focus:ring-1 focus:ring-ds-brand-navy"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-ds-neutral-700 block mb-1">
                    Unique Code *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. LV-EXEC-2026"
                    value={createForm.code}
                    onChange={(e) =>
                      setCreateForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))
                    }
                    className="w-full rounded-xl border border-ds-neutral-300 px-3 py-2 text-xs font-mono focus:ring-1 focus:ring-ds-brand-navy"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-ds-neutral-700 block mb-1">
                    Template Type
                  </label>
                  <select
                    value={createForm.type}
                    onChange={(e) =>
                      setCreateForm((prev) => ({ ...prev, type: e.target.value as TemplateType }))
                    }
                    className="w-full rounded-xl border border-ds-neutral-300 px-3 py-2 text-xs bg-white focus:ring-1 focus:ring-ds-brand-navy"
                  >
                    <option value="SALARY">Salary Structure (CTC)</option>
                    <option value="LEAVE_PLAN">Leave Policy & Quotas</option>
                    <option value="HOLIDAY_CALENDAR">Holiday Calendar</option>
                    <option value="SHIFT">Shift & Roster</option>
                    <option value="CHECKLIST">Checklist (Onboarding/Exit)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-ds-neutral-700 block mb-1">
                    Tags (comma separated)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Sales, Bangalore, Executive"
                    value={createForm.tags}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, tags: e.target.value }))}
                    className="w-full rounded-xl border border-ds-neutral-300 px-3 py-2 text-xs focus:ring-1 focus:ring-ds-brand-navy"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-ds-neutral-700 block mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Summary of this blueprint..."
                  value={createForm.description}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  className="w-full rounded-xl border border-ds-neutral-300 px-3 py-2 text-xs focus:ring-1 focus:ring-ds-brand-navy"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-ds-neutral-700 block mb-1">
                  Configuration Payload (JSON)
                </label>
                <textarea
                  rows={7}
                  value={createForm.configPayloadJson}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, configPayloadJson: e.target.value }))
                  }
                  className="w-full rounded-xl border border-ds-neutral-300 bg-neutral-900 text-teal-300 font-mono p-3 text-xs focus:ring-1 focus:ring-teal-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-ds-neutral-200 px-6 py-3.5 bg-ds-neutral-50">
              <Button variant="outline" size="sm" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleCreateSubmit}
                className="bg-ds-brand-navy text-white"
              >
                Save Template
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

