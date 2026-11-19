"use client"

import * as React from 'react'
import { Button, FormField, Select, SectionCard } from '@hryantra/ui'
import { Save } from 'lucide-react'
import { api } from '@/shared/api'
import { CtcCalculator } from '@/modules/compensation/components/CtcCalculator'

type Props = {
  employeeId: string
  canEdit?: boolean
}

export function EmployeeCompensationTab({ employeeId, canEdit = true }: Props) {
  const [profiles, setProfiles] = React.useState<any[]>([])
  const [profile, setProfile] = React.useState<any | null>(null)
  const [anchorValue, setAnchorValue] = React.useState(0)
  const [overrides, setOverrides] = React.useState<Record<string, number>>({})
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [message, setMessage] = React.useState('')

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const [profileRes, compRes] = await Promise.all([
        api.compensation.listProfiles(),
        api.compensation.getEmployee(employeeId),
      ])
      const list = profileRes?.data || []
      setProfiles(list)
      const comp = compRes?.data
      if (comp) {
        setAnchorValue(comp.anchorValue || 0)
        setOverrides(comp.componentOverrides || {})
        const matched = list.find((p: any) => p.id === comp.complianceProfileId) || comp.complianceProfile
        setProfile(matched || list[0] || null)
      } else {
        setProfile(list[0] || null)
        setAnchorValue(1200000)
        setOverrides({})
      }
    } catch {
      setProfiles([])
    } finally {
      setLoading(false)
    }
  }, [employeeId])

  React.useEffect(() => {
    load()
  }, [load])

  const handleSave = async () => {
    if (!profile) return
    setSaving(true)
    setMessage('')
    try {
      await api.compensation.updateEmployee(employeeId, {
        complianceProfileId: profile.id,
        anchorType: profile.anchorType,
        anchorValue,
        componentOverrides: overrides,
      })
      setMessage('Compensation updated')
      await load()
    } catch (e: any) {
      setMessage(e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-ds-caption text-ds-neutral-500 p-4">Loading compensation...</p>
  }

  return (
    <div className="space-y-4">
      {message && (
        <div className="rounded-lg bg-ds-neutral-50 text-ds-brand-navy text-sm p-3">{message}</div>
      )}

      <SectionCard title="Salary Structure" className="p-4">
        <FormField label="Salary template">
          <Select
            value={profile?.id || ''}
            onChange={(e) => setProfile(profiles.find((p) => p.id === e.target.value) || null)}
            disabled={!canEdit}
          >
            <option value="">Select profile</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.country})</option>
            ))}
          </Select>
        </FormField>

        <div className="mt-4">
          <CtcCalculator
            profile={profile}
            anchorValue={anchorValue}
            componentOverrides={overrides}
            onAnchorChange={setAnchorValue}
            onOverrideChange={(code, value) => setOverrides((prev) => ({ ...prev, [code]: value }))}
            readOnly={!canEdit}
          />
        </div>

        {canEdit && (
          <div className="mt-4 flex justify-end">
            <Button onClick={handleSave} disabled={saving || !profile}>
              <Save className="size-4 mr-2" />
              {saving ? 'Saving...' : 'Save Compensation'}
            </Button>
          </div>
        )}
      </SectionCard>
    </div>
  )
}
