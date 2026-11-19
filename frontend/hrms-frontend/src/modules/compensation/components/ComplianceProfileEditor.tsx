"use client"

import * as React from 'react'
import { Button, FormField, FormFieldInput, Input, Select, SectionCard } from '@hryantra/ui'
import { Plus, Trash2, Save, HelpCircle } from 'lucide-react'
import { api } from '@/shared/api'

const SECTION_OPTIONS = [
  { value: 'EARNING', label: 'Earning', hint: 'Adds to employee salary' },
  { value: 'DEDUCTION', label: 'Deduction', hint: 'Taken from employee pay' },
  { value: 'EMPLOYER_CONTRIBUTION', label: 'Employer cost', hint: 'Company pays (part of CTC)' },
]

const CALC_OPTIONS = [
  { value: 'PERCENT_OF_ANCHOR', label: '% of CTC offer', hint: 'Percentage of the main CTC number HR enters' },
  { value: 'PERCENT_OF_COMPONENT', label: '% of another line', hint: 'Percentage of a component you pick in "Based on"' },
  { value: 'PERCENT_OF_GROSS', label: '% of gross salary', hint: 'Percentage of total earnings' },
  { value: 'FIXED', label: 'Fixed monthly amount', hint: 'Same amount every month (not %)' },
  { value: 'BALANCE_OF_GROSS', label: 'Remaining balance', hint: 'Fills leftover amount (e.g. special allowance)' },
]

const ANCHOR_OPTIONS = [
  { value: 'ANNUAL_CTC', label: 'Annual CTC (yearly offer)' },
  { value: 'MONTHLY_CTC', label: 'Monthly CTC' },
  { value: 'MONTHLY_GROSS', label: 'Monthly gross salary' },
]

const BASE_REF_OPTIONS = [
  { value: 'ANCHOR', label: 'CTC offer (main number)' },
  { value: 'GROSS', label: 'Gross salary (all earnings)' },
]

type ComponentRule = {
  code: string
  name: string
  section: string
  calcType: string
  value: number
  baseRef?: string
  cap?: number
  order: number
}

function valueHint(calcType: string) {
  if (calcType === 'FIXED') return 'Monthly ₹/$'
  if (calcType === 'BALANCE_OF_GROSS') return 'Usually 0'
  return 'Percent %'
}

function needsBaseRef(calcType: string) {
  return calcType === 'PERCENT_OF_COMPONENT' || calcType === 'PERCENT_OF_ANCHOR'
}

export function ComplianceProfileEditor() {
  const [profiles, setProfiles] = React.useState<any[]>([])
  const [selectedId, setSelectedId] = React.useState('')
  const [form, setForm] = React.useState({
    name: '',
    country: 'India',
    region: '',
    city: '',
    locality: '',
    currencyCode: 'INR',
    anchorType: 'ANNUAL_CTC',
    isDefault: false,
    components: [] as ComponentRule[],
  })
  const [saving, setSaving] = React.useState(false)
  const [message, setMessage] = React.useState('')

  const load = React.useCallback(async () => {
    const res = await api.compensation.listProfiles()
    const list = res?.data || []
    setProfiles(list)
    if (!selectedId && list[0]) {
      setSelectedId(list[0].id)
      setForm({
        name: list[0].name,
        country: list[0].country,
        region: list[0].region || '',
        city: list[0].city || '',
        locality: list[0].locality || '',
        currencyCode: list[0].currencyCode,
        anchorType: list[0].anchorType,
        isDefault: list[0].isDefault,
        components: list[0].components || [],
      })
    }
  }, [selectedId])

  React.useEffect(() => {
    load().catch(() => undefined)
  }, [load])

  const selectProfile = (id: string) => {
    setSelectedId(id)
    const p = profiles.find((row) => row.id === id)
    if (!p) return
    setForm({
      name: p.name,
      country: p.country,
      region: p.region || '',
      city: p.city || '',
      locality: p.locality || '',
      currencyCode: p.currencyCode,
      anchorType: p.anchorType,
      isDefault: p.isDefault,
      components: p.components || [],
    })
  }

  const updateComponent = (index: number, key: string, value: any) => {
    setForm((prev) => ({
      ...prev,
      components: prev.components.map((c, i) => (i === index ? { ...c, [key]: value } : c)),
    }))
  }

  const addComponent = () => {
    setForm((prev) => ({
      ...prev,
      components: [
        ...prev.components,
        {
          code: `COMP_${prev.components.length + 1}`,
          name: 'New Component',
          section: 'EARNING',
          calcType: 'PERCENT_OF_ANCHOR',
          value: 0,
          baseRef: 'ANCHOR',
          order: prev.components.length + 1,
        },
      ],
    }))
  }

  const removeComponent = (index: number) => {
    setForm((prev) => ({
      ...prev,
      components: prev.components.filter((_, i) => i !== index),
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage('')
    try {
      if (selectedId) {
        await api.compensation.updateProfile(selectedId, form)
        setMessage('Template saved')
      } else {
        const res = await api.compensation.createProfile(form)
        setSelectedId(res?.data?.id || '')
        setMessage('Template created')
      }
      await load()
    } catch (e: any) {
      setMessage(e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleNew = () => {
    setSelectedId('')
    setForm({
      name: 'New salary template',
      country: 'India',
      region: '',
      city: '',
      locality: '',
      currencyCode: 'INR',
      anchorType: 'ANNUAL_CTC',
      isDefault: false,
      components: [],
    })
  }

  const componentCodes = form.components.map((c) => c.code).filter(Boolean)

  return (
    <div className="space-y-4">
      {message && <div className="rounded-lg bg-ds-neutral-50 text-ds-brand-navy text-sm p-3">{message}</div>}

      <div className="flex flex-wrap gap-2">
        <Select value={selectedId} onChange={(e) => selectProfile(e.target.value)} className="min-w-[240px]">
          <option value="">New template</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </Select>
        <Button variant="outline" onClick={handleNew}>New template</Button>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="size-4 mr-2" />
          {saving ? 'Saving...' : 'Save template'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Template name">
          <FormFieldInput><Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} /></FormFieldInput>
        </FormField>
        <FormField label="Country">
          <FormFieldInput><Input value={form.country} onChange={(e) => setForm((p) => ({ ...p, country: e.target.value }))} /></FormFieldInput>
        </FormField>
        <FormField label="Region / state">
          <FormFieldInput><Input value={form.region} onChange={(e) => setForm((p) => ({ ...p, region: e.target.value }))} /></FormFieldInput>
        </FormField>
        <FormField label="City">
          <FormFieldInput><Input value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} /></FormFieldInput>
        </FormField>
        <FormField label="Locality">
          <FormFieldInput><Input value={form.locality} onChange={(e) => setForm((p) => ({ ...p, locality: e.target.value }))} /></FormFieldInput>
        </FormField>
        <FormField label="Currency">
          <FormFieldInput><Input value={form.currencyCode} onChange={(e) => setForm((p) => ({ ...p, currencyCode: e.target.value }))} /></FormFieldInput>
        </FormField>
        <FormField label="What HR enters at onboarding">
          <Select value={form.anchorType} onChange={(e) => setForm((p) => ({ ...p, anchorType: e.target.value }))}>
            {ANCHOR_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </Select>
        </FormField>
        <label className="flex items-center gap-2 text-ds-body-sm mt-6">
          <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm((p) => ({ ...p, isDefault: e.target.checked }))} />
          Default template for this country
        </label>
      </div>

      <SectionCard title="Salary component rules" className="p-0" noPadding>
        <div className="px-4 py-3 border-b border-ds-neutral-100 bg-ds-neutral-50/80">
          <p className="text-ds-body-sm text-ds-neutral-600 leading-relaxed">
            Each row is one part of the salary (Basic, HRA, PF, etc.). When HR enters a CTC at onboarding, these rules calculate the full breakdown automatically.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-ds-body-sm border-collapse">
            <thead>
              <tr className="bg-ds-neutral-50 border-b border-ds-neutral-200 text-left">
                <th className="px-3 py-3 font-bold text-ds-neutral-600 text-[11px] uppercase tracking-wide w-10">#</th>
                <th className="px-3 py-3 font-bold text-ds-neutral-600 text-[11px] uppercase tracking-wide w-24">
                  <span className="block">Code</span>
                  <span className="font-normal normal-case text-ds-neutral-400 text-[10px]">Short ID</span>
                </th>
                <th className="px-3 py-3 font-bold text-ds-neutral-600 text-[11px] uppercase tracking-wide min-w-[140px]">
                  <span className="block">Component name</span>
                  <span className="font-normal normal-case text-ds-neutral-400 text-[10px]">Shown on payslip</span>
                </th>
                <th className="px-3 py-3 font-bold text-ds-neutral-600 text-[11px] uppercase tracking-wide min-w-[130px]">
                  <span className="block">Type</span>
                  <span className="font-normal normal-case text-ds-neutral-400 text-[10px]">Earning / deduction</span>
                </th>
                <th className="px-3 py-3 font-bold text-ds-neutral-600 text-[11px] uppercase tracking-wide min-w-[160px]">
                  <span className="block">How to calculate</span>
                  <span className="font-normal normal-case text-ds-neutral-400 text-[10px]">Formula method</span>
                </th>
                <th className="px-3 py-3 font-bold text-ds-neutral-600 text-[11px] uppercase tracking-wide w-24">
                  <span className="block">Amount</span>
                  <span className="font-normal normal-case text-ds-neutral-400 text-[10px]">% or monthly</span>
                </th>
                <th className="px-3 py-3 font-bold text-ds-neutral-600 text-[11px] uppercase tracking-wide min-w-[140px]">
                  <span className="block">Based on</span>
                  <span className="font-normal normal-case text-ds-neutral-400 text-[10px]">Reference line</span>
                </th>
                <th className="px-3 py-3 w-12" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {form.components.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-ds-neutral-500">
                    No components yet. Click &quot;Add component&quot; to define Basic, HRA, PF, etc.
                  </td>
                </tr>
              ) : (
                form.components.map((comp, index) => (
                  <tr key={`${comp.code}-${index}`} className="border-b border-ds-neutral-100 hover:bg-ds-neutral-50/50 align-top">
                    <td className="px-3 py-3 text-ds-neutral-400 font-mono text-xs">{index + 1}</td>
                    <td className="px-3 py-3">
                      <Input
                        value={comp.code}
                        onChange={(e) => updateComponent(index, 'code', e.target.value.toUpperCase())}
                        placeholder="BASIC"
                        className="text-xs font-mono"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <Input
                        value={comp.name}
                        onChange={(e) => updateComponent(index, 'name', e.target.value)}
                        placeholder="Basic Salary"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <Select value={comp.section} onChange={(e) => updateComponent(index, 'section', e.target.value)} className="text-xs">
                        {SECTION_OPTIONS.map((s) => (
                          <option key={s.value} value={s.value} title={s.hint}>{s.label}</option>
                        ))}
                      </Select>
                    </td>
                    <td className="px-3 py-3">
                      <Select value={comp.calcType} onChange={(e) => updateComponent(index, 'calcType', e.target.value)} className="text-xs">
                        {CALC_OPTIONS.map((t) => (
                          <option key={t.value} value={t.value} title={t.hint}>{t.label}</option>
                        ))}
                      </Select>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          step="0.01"
                          value={comp.value}
                          onChange={(e) => updateComponent(index, 'value', Number(e.target.value))}
                          className="w-20"
                        />
                        <span className="text-[10px] text-ds-neutral-400 whitespace-nowrap">{valueHint(comp.calcType)}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      {needsBaseRef(comp.calcType) || comp.calcType === 'PERCENT_OF_GROSS' ? (
                        <Select
                          value={comp.baseRef || 'ANCHOR'}
                          onChange={(e) => updateComponent(index, 'baseRef', e.target.value)}
                          className="text-xs"
                          disabled={comp.calcType === 'PERCENT_OF_ANCHOR'}
                        >
                          {comp.calcType === 'PERCENT_OF_ANCHOR' && (
                            <option value="ANCHOR">CTC offer (main number)</option>
                          )}
                          {comp.calcType === 'PERCENT_OF_GROSS' && (
                            <option value="GROSS">Gross salary (all earnings)</option>
                          )}
                          {comp.calcType === 'PERCENT_OF_COMPONENT' && (
                            <>
                              {BASE_REF_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                              {componentCodes
                                .filter((code) => code !== comp.code)
                                .map((code) => (
                                  <option key={code} value={code}>Line: {code}</option>
                                ))}
                            </>
                          )}
                        </Select>
                      ) : (
                        <span className="text-xs text-ds-neutral-400 px-1">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => removeComponent(index)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                        title="Remove row"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t border-ds-neutral-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-2 text-ds-caption text-ds-neutral-500 max-w-xl">
            <HelpCircle className="size-4 shrink-0 mt-0.5" />
            <span>
              <strong>Example:</strong> Basic = 40% of CTC, HRA = 40% of Basic, PF = 12% of Basic.
              Rows are processed top to bottom.
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={addComponent}>
            <Plus className="size-4 mr-1.5" /> Add component
          </Button>
        </div>
      </SectionCard>
    </div>
  )
}
