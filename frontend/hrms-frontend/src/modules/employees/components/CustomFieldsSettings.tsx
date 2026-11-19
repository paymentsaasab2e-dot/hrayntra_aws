"use client"

import * as React from 'react'
import { SectionCard, Button, StatusBadge } from '@hryantra/ui'
import {
  SlidersHorizontal,
  Plus,
  RotateCcw,
  Pencil,
  Trash2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Tag,
  ListFilter,
  Check,
  X,
  Layers,
  Sparkles,
} from 'lucide-react'
import { api } from '@/shared/api'
import { CustomFieldDefinitionItem, CustomFieldType, CustomFieldSection } from '../types'

const SECTION_LABELS: Record<CustomFieldSection, { label: string; color: string }> = {
  PERSONAL: { label: 'Personal & Health', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  WORK_DETAILS: { label: 'Workplace & Facilities', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  COMPLIANCE_KYC: { label: 'Compliance & Statutory', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  OTHER: { label: 'Other Attributes', color: 'bg-slate-100 text-slate-700 border-slate-200' },
}

const TYPE_LABELS: Record<CustomFieldType, { label: string; iconLabel: string }> = {
  TEXT: { label: 'Single Line Text', iconLabel: 'TXT' },
  NUMBER: { label: 'Number', iconLabel: '123' },
  DATE: { label: 'Date Picker', iconLabel: 'CAL' },
  SELECT: { label: 'Dropdown Select', iconLabel: 'LIST' },
  BOOLEAN: { label: 'Yes / No Toggle', iconLabel: 'Y/N' },
  TEXTAREA: { label: 'Multi-line Paragraph', iconLabel: 'PAR' },
}

export function CustomFieldsSettings() {
  const [fields, setFields] = React.useState<CustomFieldDefinitionItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)

  const [filterSection, setFilterSection] = React.useState<string>('ALL')
  const [isModalOpen, setIsModalOpen] = React.useState(false)
  const [editingField, setEditingField] = React.useState<CustomFieldDefinitionItem | null>(null)

  // Form State
  const [formLabel, setFormLabel] = React.useState('')
  const [formKey, setFormKey] = React.useState('')
  const [formType, setFormType] = React.useState<CustomFieldType>('TEXT')
  const [formSection, setFormSection] = React.useState<CustomFieldSection>('PERSONAL')
  const [formOptions, setFormOptions] = React.useState<string[]>([])
  const [newOptionInput, setNewOptionInput] = React.useState('')
  const [formPlaceholder, setFormPlaceholder] = React.useState('')
  const [formDescription, setFormDescription] = React.useState('')
  const [formRequired, setFormRequired] = React.useState(false)
  const [formActive, setFormActive] = React.useState(true)
  const [saving, setSaving] = React.useState(false)

  const loadFields = React.useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await api.customFields.list(true)
      const items = Array.isArray(res?.data) ? res.data : []
      setFields(items)
    } catch (err: any) {
      setError(err?.message || 'Failed to load custom fields')
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadFields()
  }, [loadFields])

  const openCreateModal = () => {
    setEditingField(null)
    setFormLabel('')
    setFormKey('')
    setFormType('TEXT')
    setFormSection('PERSONAL')
    setFormOptions([])
    setNewOptionInput('')
    setFormPlaceholder('')
    setFormDescription('')
    setFormRequired(false)
    setFormActive(true)
    setIsModalOpen(true)
  }

  const openEditModal = (field: CustomFieldDefinitionItem) => {
    setEditingField(field)
    setFormLabel(field.label)
    setFormKey(field.key)
    setFormType(field.type)
    setFormSection(field.section)
    setFormOptions([...(field.options || [])])
    setNewOptionInput('')
    setFormPlaceholder(field.placeholder || '')
    setFormDescription(field.description || '')
    setFormRequired(field.required)
    setFormActive(field.isActive)
    setIsModalOpen(true)
  }

  const handleLabelChange = (val: string) => {
    setFormLabel(val)
    if (!editingField) {
      const derivedKey = val
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9_]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
      setFormKey(derivedKey)
    }
  }

  const handleAddOption = () => {
    const trimmed = newOptionInput.trim()
    if (trimmed && !formOptions.includes(trimmed)) {
      setFormOptions([...formOptions, trimmed])
      setNewOptionInput('')
    }
  }

  const handleRemoveOption = (index: number) => {
    setFormOptions(formOptions.filter((_, i) => i !== index))
  }

  const handleSaveField = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formLabel.trim()) return

    setSaving(true)
    setError(null)
    try {
      if (editingField) {
        await api.customFields.update(editingField.id, {
          label: formLabel.trim(),
          section: formSection,
          options: formType === 'SELECT' ? formOptions : [],
          required: formRequired,
          placeholder: formPlaceholder.trim() || undefined,
          description: formDescription.trim() || undefined,
          isActive: formActive,
        })
        setSuccess(`Custom field "${formLabel}" updated successfully.`)
      } else {
        await api.customFields.create({
          key: formKey.trim() || undefined,
          label: formLabel.trim(),
          type: formType,
          section: formSection,
          options: formType === 'SELECT' ? formOptions : [],
          required: formRequired,
          placeholder: formPlaceholder.trim() || undefined,
          description: formDescription.trim() || undefined,
        })
        setSuccess(`Custom field "${formLabel}" created successfully.`)
      }

      setIsModalOpen(false)
      loadFields()
      setTimeout(() => setSuccess(null), 3500)
    } catch (err: any) {
      setError(err?.message || 'Failed to save custom field')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (field: CustomFieldDefinitionItem) => {
    try {
      await api.customFields.update(field.id, {
        isActive: !field.isActive,
      })
      setFields((prev) =>
        prev.map((f) => (f.id === field.id ? { ...f, isActive: !f.isActive } : f))
      )
    } catch (err: any) {
      alert(err?.message || 'Failed to toggle field status')
    }
  }

  const handleDelete = async (field: CustomFieldDefinitionItem) => {
    if (!confirm(`Are you sure you want to remove the custom field "${field.label}"? Existing profile data will remain in employee records.`)) {
      return
    }

    try {
      await api.customFields.delete(field.id)
      setFields((prev) => prev.filter((f) => f.id !== field.id))
      setSuccess(`Removed "${field.label}"`)
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      alert(err?.message || 'Failed to delete custom field')
    }
  }

  const handleSeedDefaults = async () => {
    if (!confirm('Would you like to seed the standard Indian enterprise custom field templates (Blood Group, Desk Location, Access Badge ID, T-Shirt Size, Emergency Relationship, etc.)?')) {
      return
    }

    try {
      setLoading(true)
      await api.customFields.seedDefaults()
      await loadFields()
      setSuccess('Enterprise default templates populated successfully.')
      setTimeout(() => setSuccess(null), 3500)
    } catch (err: any) {
      setError(err?.message || 'Failed to seed default templates')
    } finally {
      setLoading(false)
    }
  }

  const filteredFields = React.useMemo(() => {
    if (filterSection === 'ALL') return fields
    return fields.filter((f) => f.section === filterSection)
  }, [fields, filterSection])

  const stats = React.useMemo(() => {
    const total = fields.length
    const active = fields.filter((f) => f.isActive).length
    const personal = fields.filter((f) => f.section === 'PERSONAL').length
    const work = fields.filter((f) => f.section === 'WORK_DETAILS').length
    const compliance = fields.filter((f) => f.section === 'COMPLIANCE_KYC').length
    return { total, active, personal, work, compliance }
  }, [fields])

  return (
    <div className="flex flex-col gap-6">
      {/* Alert Banners */}
      {success && (
        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800 animate-in fade-in">
          <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-800 animate-in fade-in">
          <AlertCircle className="size-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Header Cards & Action Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <SlidersHorizontal className="size-5 text-purple-600" />
            Custom Fields & Profile Schema
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Configure dynamic, company-specific attributes collected on 360° employee profiles, self-service change requests, and onboarding records.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSeedDefaults}
            className="border-slate-200 text-slate-700 hover:bg-slate-100"
            title="Populate recommended enterprise Indian templates"
          >
            <Sparkles className="size-3.5 text-purple-600 mr-1.5" />
            Seed Enterprise Templates
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={openCreateModal}
            className="bg-purple-600 hover:bg-purple-700 text-white shadow-xs"
          >
            <Plus className="size-4 mr-1.5" />
            Add Custom Field
          </Button>
        </div>
      </div>

      {/* KPI Counters */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Fields</p>
          <p className="text-xl font-black text-slate-900 mt-1">{stats.total}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Active In Profiles</p>
          <p className="text-xl font-black text-emerald-700 mt-1">{stats.active}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600">Workplace & Facility</p>
          <p className="text-xl font-black text-blue-700 mt-1">{stats.work}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-rose-600">Personal & Health</p>
          <p className="text-xl font-black text-rose-700 mt-1">{stats.personal}</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 overflow-x-auto pb-1 text-xs font-semibold text-slate-500">
        <button
          type="button"
          onClick={() => setFilterSection('ALL')}
          className={`px-3.5 py-2 rounded-lg transition-colors ${
            filterSection === 'ALL'
              ? 'bg-purple-50 text-purple-700 font-bold'
              : 'hover:bg-slate-100 hover:text-slate-800'
          }`}
        >
          All Attributes ({stats.total})
        </button>
        <button
          type="button"
          onClick={() => setFilterSection('PERSONAL')}
          className={`px-3.5 py-2 rounded-lg transition-colors ${
            filterSection === 'PERSONAL'
              ? 'bg-purple-50 text-purple-700 font-bold'
              : 'hover:bg-slate-100 hover:text-slate-800'
          }`}
        >
          Personal & Health ({stats.personal})
        </button>
        <button
          type="button"
          onClick={() => setFilterSection('WORK_DETAILS')}
          className={`px-3.5 py-2 rounded-lg transition-colors ${
            filterSection === 'WORK_DETAILS'
              ? 'bg-purple-50 text-purple-700 font-bold'
              : 'hover:bg-slate-100 hover:text-slate-800'
          }`}
        >
          Workplace & Facilities ({stats.work})
        </button>
        <button
          type="button"
          onClick={() => setFilterSection('COMPLIANCE_KYC')}
          className={`px-3.5 py-2 rounded-lg transition-colors ${
            filterSection === 'COMPLIANCE_KYC'
              ? 'bg-purple-50 text-purple-700 font-bold'
              : 'hover:bg-slate-100 hover:text-slate-800'
          }`}
        >
          Compliance & Statutory ({stats.compliance})
        </button>
        <button
          type="button"
          onClick={() => setFilterSection('OTHER')}
          className={`px-3.5 py-2 rounded-lg transition-colors ${
            filterSection === 'OTHER'
              ? 'bg-purple-50 text-purple-700 font-bold'
              : 'hover:bg-slate-100 hover:text-slate-800'
          }`}
        >
          Other Attributes
        </button>
      </div>

      {/* Field Definitions Table / List */}
      <div className="rounded-2xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm font-medium text-slate-400">
            Loading custom field definitions...
          </div>
        ) : filteredFields.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <SlidersHorizontal className="size-10 text-slate-300 mb-3" />
            <h4 className="text-sm font-bold text-slate-800">No custom fields found</h4>
            <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4">
              {filterSection === 'ALL'
                ? 'No custom fields have been defined yet. You can add one or seed recommended enterprise templates.'
                : 'No custom fields exist in this category.'}
            </p>
            {filterSection === 'ALL' && (
              <Button size="sm" onClick={handleSeedDefaults} className="bg-purple-600 text-white">
                <Sparkles className="size-3.5 mr-1.5" />
                Seed Enterprise Templates
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Field Label & Key</th>
                  <th className="py-3.5 px-4">Category Section</th>
                  <th className="py-3.5 px-4">Data Type</th>
                  <th className="py-3.5 px-4">Mandatory</th>
                  <th className="py-3.5 px-4">Profile Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredFields.map((field) => {
                  const sectionMeta = SECTION_LABELS[field.section] || SECTION_LABELS.OTHER
                  const typeMeta = TYPE_LABELS[field.type] || TYPE_LABELS.TEXT

                  return (
                    <tr key={field.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 text-sm">{field.label}</span>
                          <span className="font-mono text-[11px] text-slate-400 mt-0.5">
                            {field.key}
                          </span>
                          {field.description && (
                            <span className="text-[11px] text-slate-500 mt-1 max-w-md line-clamp-1">
                              {field.description}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${sectionMeta.color}`}>
                          {sectionMeta.label}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1">
                          <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700">
                            <span className="rounded bg-slate-200/80 px-1 py-0.5 text-[9px] font-mono font-bold text-slate-700">
                              {typeMeta.iconLabel}
                            </span>
                            {typeMeta.label}
                          </span>
                          {field.type === 'SELECT' && field.options?.length > 0 && (
                            <span className="text-[10px] text-slate-400 line-clamp-1">
                              {field.options.length} options: {field.options.slice(0, 3).join(', ')}
                              {field.options.length > 3 ? '...' : ''}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        {field.required ? (
                          <span className="inline-flex items-center rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700 border border-rose-200">
                            Required
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Optional</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(field)}
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold border transition-colors ${
                            field.isActive
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                          }`}
                        >
                          <span className={`size-1.5 rounded-full ${field.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                          {field.isActive ? 'Active' : 'Hidden'}
                        </button>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditModal(field)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-purple-700 hover:bg-purple-50 transition-colors"
                            title="Edit Field Schema"
                          >
                            <Pencil className="size-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(field)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Delete Field"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-slate-200 flex flex-col overflow-hidden max-h-[90vh] animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50/50">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <SlidersHorizontal className="size-5 text-purple-600" />
                  {editingField ? 'Edit Custom Field' : 'Add Custom Field'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Define an attribute to be tracked across employee records and change requests.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveField} className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 text-xs">
              {/* Field Label */}
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Field Display Label <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formLabel}
                  onChange={(e) => handleLabelChange(e.target.value)}
                  placeholder="e.g. Blood Group, Emergency Contact, Parking Slot"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Field Key */}
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Unique Schema Key <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  disabled={Boolean(editingField)}
                  value={formKey}
                  onChange={(e) => setFormKey(e.target.value)}
                  placeholder="e.g. blood_group"
                  className="w-full font-mono rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500 disabled:bg-slate-100 disabled:text-slate-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Alphanumeric & underscores only. Used in backend JSON storage.
                </p>
              </div>

              {/* Data Type & Section */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">Field Type</label>
                  <select
                    disabled={Boolean(editingField)}
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as CustomFieldType)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500 disabled:bg-slate-100"
                  >
                    <option value="TEXT">Text (Single Line)</option>
                    <option value="NUMBER">Number</option>
                    <option value="DATE">Date</option>
                    <option value="SELECT">Select Dropdown</option>
                    <option value="BOOLEAN">Boolean Toggle (Yes / No)</option>
                    <option value="TEXTAREA">Paragraph / Long Text</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">Display Section</label>
                  <select
                    value={formSection}
                    onChange={(e) => setFormSection(e.target.value as CustomFieldSection)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="PERSONAL">Personal & Health</option>
                    <option value="WORK_DETAILS">Workplace & Facilities</option>
                    <option value="COMPLIANCE_KYC">Compliance & Statutory</option>
                    <option value="OTHER">Other Attributes</option>
                  </select>
                </div>
              </div>

              {/* Dropdown Options Builder (if SELECT) */}
              {formType === 'SELECT' && (
                <div className="rounded-xl border border-purple-200/80 bg-purple-50/30 p-4 flex flex-col gap-2.5">
                  <label className="block font-bold text-purple-900">
                    Dropdown Options List
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newOptionInput}
                      onChange={(e) => setNewOptionInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleAddOption()
                        }
                      }}
                      placeholder="Type option (e.g. O+, A+, XL) and press Enter"
                      className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAddOption}
                      className="bg-purple-600 text-white shrink-0"
                    >
                      Add
                    </Button>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {formOptions.map((opt, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-white px-2.5 py-1 text-xs font-semibold text-purple-800 shadow-2xs"
                      >
                        {opt}
                        <button
                          type="button"
                          onClick={() => handleRemoveOption(idx)}
                          className="text-purple-400 hover:text-rose-600 transition-colors ml-0.5"
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}
                    {formOptions.length === 0 && (
                      <p className="text-[11px] text-purple-600 italic">No options defined yet. Add at least one.</p>
                    )}
                  </div>
                </div>
              )}

              {/* Placeholder & Description */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">Input Placeholder</label>
                  <input
                    type="text"
                    value={formPlaceholder}
                    onChange={(e) => setFormPlaceholder(e.target.value)}
                    placeholder="e.g. Enter desk or badge number"
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">Help Description</label>
                  <input
                    type="text"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Tooltip or guide for the employee"
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              {/* Switches: Required and Active */}
              <div className="flex flex-wrap items-center gap-6 pt-2 border-t border-slate-100">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formRequired}
                    onChange={(e) => setFormRequired(e.target.checked)}
                    className="size-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="font-bold text-slate-800">Mandatory / Required Field</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formActive}
                    onChange={(e) => setFormActive(e.target.checked)}
                    className="size-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="font-bold text-slate-800">Active (Visible in Employee Profiles)</span>
                </label>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200 mt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={saving || !formLabel.trim() || !formKey.trim()}
                  className="bg-purple-600 hover:bg-purple-700 text-white min-w-[100px]"
                >
                  {saving ? 'Saving...' : editingField ? 'Save Changes' : 'Create Field'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
