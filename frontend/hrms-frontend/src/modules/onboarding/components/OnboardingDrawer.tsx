"use client"

import * as React from 'react'
import { Button, DrawerWrapper, Input, Select } from '@hryantra/ui'
import {
  Save,
  UserCheck,
  GraduationCap,
  Sparkles,
  CheckCircle2,
  User,
  Coins,
  CheckSquare,
  Building2,
  MapPin,
  Clock,
  Mail,
  Phone,
  Briefcase,
  Layers,
  Globe,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react'
import { api } from '@/shared/api'
import { CtcCalculator } from '@/modules/compensation/components/CtcCalculator'

type Hire = {
  id?: string
  name: string
  role: string
  department: string
  email?: string
  phone?: string
  country?: string
  region?: string
  city?: string
  locality?: string
  joinDate?: string
  source?: string
  tasks?: { label: string; done: boolean }[]
  employeeId?: string
  userId?: string
  status?: string
  compensation?: any
}

type Props = {
  open: boolean
  hire?: Hire | null
  preboardingCandidates?: any[]
  onClose: () => void
  onSaved: () => void
  /** Called after complete with Mongo employee record id for Users link flow */
  onCompleted?: (employeeRecordId: string) => void
  /** Called with full graduation result (employee, user, credentials) */
  onGraduated?: (graduationData: any) => void
}

const SOURCE_OPTIONS = [
  { value: 'MANUAL', label: 'Manual Entry' },
  { value: 'BULK_IMPORT', label: 'Bulk CSV Import' },
  { value: 'EXTERNAL_ATS', label: 'External ATS Sync (Greenhouse/Lever)' },
  { value: 'PREBOARDING', label: 'Preboarding Pipeline' },
]

export function OnboardingDrawer({ open, hire, preboardingCandidates = [], onClose, onSaved, onCompleted, onGraduated }: Props) {
  const [activeTab, setActiveTab] = React.useState<'details' | 'compensation' | 'checklist'>('details')
  const [selectedPreboardingId, setSelectedPreboardingId] = React.useState<string>('')
  const [form, setForm] = React.useState<Hire>({
    name: '',
    role: '',
    department: '',
    email: '',
    phone: '',
    country: 'India',
    region: '',
    city: '',
    locality: '',
    joinDate: new Date().toISOString().slice(0, 10),
    source: 'MANUAL',
  })
  const [profiles, setProfiles] = React.useState<any[]>([])
  const [profile, setProfile] = React.useState<any | null>(null)
  const [anchorValue, setAnchorValue] = React.useState(1200000)
  const [overrides, setOverrides] = React.useState<Record<string, number>>({})
  const [saving, setSaving] = React.useState(false)
  const [completing, setCompleting] = React.useState(false)
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    if (!open) return
    setActiveTab('details')
    api.compensation.listProfiles().then((res) => {
      const list = res?.data || []
      setProfiles(list)
    }).catch(() => setProfiles([]))
  }, [open])

  React.useEffect(() => {
    if (!open) return
    if (hire) {
      setForm({
        ...hire,
        joinDate: hire.joinDate || new Date().toISOString().slice(0, 10),
      })
      if (hire.compensation) {
        setAnchorValue(hire.compensation.anchorValue || 0)
        setOverrides(hire.compensation.componentOverrides || {})
        const matched = profiles.find((p) => p.id === hire.compensation?.complianceProfileId)
        if (matched) setProfile(matched)
      }
    } else {
      setForm({
        name: '',
        role: '',
        department: '',
        email: '',
        phone: '',
        country: 'India',
        region: '',
        city: '',
        locality: '',
        joinDate: new Date().toISOString().slice(0, 10),
        source: 'MANUAL',
      })
      setAnchorValue(1200000)
      setOverrides({})
      setProfile(null)
    }
    setError('')
  }, [open, hire, profiles])

  React.useEffect(() => {
    if (!open || !hire?.compensation?.complianceProfileId || profile) return
    const matched = profiles.find((p) => p.id === hire.compensation.complianceProfileId)
    if (matched) setProfile(matched)
  }, [open, hire, profiles, profile])

  React.useEffect(() => {
    if (!open || profile || !form.country || hire?.compensation) return
    api.compensation
      .matchProfile({ country: form.country, region: form.region, city: form.city, locality: form.locality })
      .then((res) => {
        if (res?.data) setProfile(res.data)
        else {
          const fallback = profiles.find((p) => p.country === form.country) || profiles[0]
          setProfile(fallback || null)
        }
      })
      .catch(() => undefined)
  }, [open, form.country, form.region, form.city, form.locality, profiles, profile, hire?.compensation])

  const patch = (key: keyof Hire, value: string) => setForm((prev) => ({ ...prev, [key]: value }))

  const handlePreboardingSelect = (candId: string) => {
    setSelectedPreboardingId(candId)
    if (!candId) {
      handleClearToBlank()
      return
    }
    const cand = preboardingCandidates?.find((c: any) => c.id === candId)
    if (cand) {
      setForm({
        name: cand.name,
        role: cand.role,
        department: cand.department,
        email: cand.email,
        phone: cand.phone,
        country: cand.country || 'India',
        region: '',
        city: cand.city || '',
        locality: '',
        joinDate: cand.targetJoinDate || new Date().toISOString().slice(0, 10),
        source: 'PREBOARDING',
      })
      if (cand.annualCtc) {
        setAnchorValue(cand.annualCtc)
      }
    }
  }

  const handleClearToBlank = () => {
    setSelectedPreboardingId('')
    setForm({
      name: '',
      role: '',
      department: '',
      email: '',
      phone: '',
      country: 'India',
      region: '',
      city: '',
      locality: '',
      joinDate: new Date().toISOString().slice(0, 10),
      source: 'MANUAL',
    })
  }

  const handleOverride = (code: string, value: number) => {
    setOverrides((prev) => ({ ...prev, [code]: value }))
  }

  const buildPayload = () => ({
    ...form,
    compensation: profile
      ? {
          complianceProfileId: profile.id,
          anchorType: profile.anchorType,
          anchorValue,
          componentOverrides: overrides,
        }
      : undefined,
  })

  const handleSave = async () => {
    if (!form.name || !form.role || !form.department) {
      setError('Full Name, Designation/Role, and Department are required')
      setActiveTab('details')
      return
    }
    setSaving(true)
    setError('')
    try {
      if (hire?.id) {
        await api.onboarding.update(hire.id, buildPayload())
      } else {
        await api.onboarding.create(buildPayload())
      }
      onSaved()
      onClose()
    } catch (e: any) {
      setError(e.message || 'Failed to save candidate')
    } finally {
      setSaving(false)
    }
  }

  const handleGraduate = async (customOptions?: any) => {
    if (!hire?.id) return
    setCompleting(true)
    setError('')
    try {
      await api.onboarding.update(hire.id, buildPayload())
      const res = await api.onboarding.complete(hire.id, customOptions || { createLogin: true, sendWelcomeEmail: true })
      await onSaved()
      onClose()
      if (res?.graduation && onGraduated) {
        onGraduated(res.graduation)
      } else if (res?.data?.employeeId && onCompleted) {
        onCompleted(res.data.employeeId)
      }
    } catch (e: any) {
      setError(e.message || 'Failed to complete graduation')
    } finally {
      setCompleting(false)
    }
  }

  const toggleTask = async (label: string, done: boolean) => {
    if (!hire?.id) return
    await api.onboarding.updateTask(hire.id, label, done)
    onSaved()
  }

  const handleNextToCompensation = () => {
    if (!form.name || !form.role || !form.department) {
      setError('Full Name, Designation/Role, and Department are required before proceeding.')
      return
    }
    setError('')
    setActiveTab('compensation')
  }

  const handleNextToChecklist = () => {
    setError('')
    setActiveTab('checklist')
  }

  const tasksCount = hire?.tasks?.length || 0
  const tasksDone = hire?.tasks?.filter(t => t.done).length || 0

  return (
    <DrawerWrapper
      open={open}
      onClose={onClose}
      size="xl"
      title={
        <div className="flex items-center gap-2.5">
          <span>{hire?.id ? 'Manage Candidate Pipeline' : 'Initiate Candidate Onboarding'}</span>
          {hire?.id && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              {hire.name}
            </span>
          )}
        </div>
      }
      subtitle="Complete candidate profile details, bind localized CTC formulas, and track task progression."
      headerExtra={
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-semibold w-fit">
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'details'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="flex size-4 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700">1</span>
            <span>Candidate Info</span>
          </button>
          <button
            type="button"
            onClick={handleNextToCompensation}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'compensation'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="flex size-4 items-center justify-center rounded-full bg-amber-100 text-[10px] font-bold text-amber-700">2</span>
            <span>Salary & CTC Structure</span>
          </button>
          <button
            type="button"
            onClick={handleNextToChecklist}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'checklist'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="flex size-4 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-700">3</span>
            <span>Checklist & Tasks</span>
            {tasksCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-bold font-mono">
                {tasksDone}/{tasksCount}
              </span>
            )}
          </button>
        </div>
      }
      footer={
        <div className="flex items-center justify-between w-full gap-2">
          {/* Left navigation / Cancel */}
          <div className="flex items-center gap-2">
            {activeTab === 'details' ? (
              <Button variant="outline" size="sm" onClick={onClose} className="text-xs h-8 px-3.5 border-slate-200 font-semibold cursor-pointer">
                Cancel
              </Button>
            ) : activeTab === 'compensation' ? (
              <Button variant="outline" size="sm" onClick={() => setActiveTab('details')} className="text-xs h-8 px-3.5 border-slate-200 font-semibold cursor-pointer gap-1">
                <ArrowLeft className="size-3.5" />
                <span>Candidate Info</span>
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setActiveTab('compensation')} className="text-xs h-8 px-3.5 border-slate-200 font-semibold cursor-pointer gap-1">
                <ArrowLeft className="size-3.5" />
                <span>Salary & CTC</span>
              </Button>
            )}
          </div>

          {/* Right actions: Save Draft + Step Navigation / Graduate */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="text-xs h-8 px-3 border-slate-200 font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              <Save className="size-3.5 mr-1" />
              {saving ? 'Saving…' : 'Save Draft'}
            </Button>

            {activeTab === 'details' && (
              <Button
                variant="default"
                size="sm"
                onClick={handleNextToCompensation}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs h-8 px-4 shadow-xs cursor-pointer gap-1.5"
              >
                <span>Next: Salary & CTC</span>
                <ChevronRight className="size-3.5" />
              </Button>
            )}

            {activeTab === 'compensation' && (
              <Button
                variant="default"
                size="sm"
                onClick={handleNextToChecklist}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs h-8 px-4 shadow-xs cursor-pointer gap-1.5"
              >
                <span>Next: Tasks & Checklist</span>
                <ChevronRight className="size-3.5" />
              </Button>
            )}

            {activeTab === 'checklist' && (
              <>
                {hire?.id && (!hire.employeeId || !hire.userId || hire.status !== 'Completed') && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleGraduate({ createLogin: true, sendWelcomeEmail: true })}
                    disabled={completing}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-8 px-3.5 shadow-xs cursor-pointer"
                  >
                    <GraduationCap className="size-3.5 mr-1" />
                    {completing ? 'Graduating…' : '1-Click Graduate to Employee'}
                  </Button>
                )}

                <Button
                  variant="default"
                  size="sm"
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs h-8 px-4 shadow-xs cursor-pointer"
                >
                  <CheckCircle2 className="size-3.5 mr-1.5" />
                  {saving ? 'Saving…' : 'Save Pipeline'}
                </Button>
              </>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-700">
            {error}
          </div>
        )}

        {/* Tab 1: Candidate Details */}
        {activeTab === 'details' && (
          <div className="space-y-4">
            {/* Quick Fast-Track: Select from Preboarding Track vs Add from Scratch */}
            {!hire?.id && (
              <div className="rounded-2xl border border-indigo-200/90 bg-gradient-to-r from-indigo-50/90 via-sky-50/50 to-white p-4 shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-4 text-indigo-600" />
                    <h4 className="text-xs font-bold text-slate-900">Utilize Candidate from Preboarding Track</h4>
                  </div>
                  {preboardingCandidates && preboardingCandidates.length > 0 && (
                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100/80 px-2 py-0.5 rounded-full">
                      {preboardingCandidates.length} in ATS Track
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Fast-track a candidate from recruitment discussions to auto-populate their role, contact, and agreed CTC formula — or leave blank to add a brand new candidate.
                </p>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                  <select
                    value={selectedPreboardingId}
                    onChange={(e) => handlePreboardingSelect(e.target.value)}
                    className="flex-1 h-8.5 rounded-xl border border-indigo-200 bg-white px-3 text-xs font-semibold text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="">— Pick a Preboarding Candidate to Auto-fill —</option>
                    {preboardingCandidates?.map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.name} — {c.role} ({c.stageLabel || c.offerPackage})
                      </option>
                    ))}
                  </select>
                  {selectedPreboardingId && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleClearToBlank}
                      className="h-8.5 text-xs border-slate-200 text-slate-600 hover:text-slate-900 bg-white font-semibold shrink-0"
                    >
                      Reset to Blank
                    </Button>
                  )}
                </div>

                {selectedPreboardingId && (
                  <div className="flex items-center gap-2 pt-1 text-[11px] font-semibold text-emerald-700">
                    <CheckCircle2 className="size-3.5 text-emerald-600" />
                    <span>Candidate profile & CTC formula loaded from Preboarding. Ready to save pipeline or 1-click graduate!</span>
                  </div>
                )}
              </div>
            )}

            {/* Section A: Demographics & Position */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-2xs space-y-3.5">
              <div className="border-b border-slate-100 pb-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Candidate Identity & Role</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Core demographics used to generate permanent employee code and workspace account.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Full Name *</label>
                  <Input
                    value={form.name}
                    onChange={(e) => patch('name', e.target.value)}
                    placeholder="e.g. Priya Sharma"
                    className="h-8.5 rounded-xl border-slate-200/90 bg-slate-50/50 text-xs font-medium text-slate-900 focus:bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Work Email *</label>
                  <Input
                    type="email"
                    value={form.email || ''}
                    onChange={(e) => patch('email', e.target.value)}
                    placeholder="priya@company.com"
                    className="h-8.5 rounded-xl border-slate-200/90 bg-slate-50/50 text-xs font-medium text-slate-900 focus:bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Designation / Role *</label>
                  <Input
                    value={form.role}
                    onChange={(e) => patch('role', e.target.value)}
                    placeholder="Senior Software Engineer"
                    className="h-8.5 rounded-xl border-slate-200/90 bg-slate-50/50 text-xs font-medium text-slate-900 focus:bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Department *</label>
                  <Input
                    value={form.department}
                    onChange={(e) => patch('department', e.target.value)}
                    placeholder="Engineering"
                    className="h-8.5 rounded-xl border-slate-200/90 bg-slate-50/50 text-xs font-medium text-slate-900 focus:bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Phone Number</label>
                  <Input
                    type="tel"
                    value={form.phone || ''}
                    onChange={(e) => patch('phone', e.target.value)}
                    placeholder="+91 98765 43210"
                    className="h-8.5 rounded-xl border-slate-200/90 bg-slate-50/50 text-xs font-medium text-slate-900 focus:bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Target Joining Date</label>
                  <Input
                    type="date"
                    value={form.joinDate || ''}
                    onChange={(e) => patch('joinDate', e.target.value)}
                    className="h-8.5 rounded-xl border-slate-200/90 bg-slate-50/50 text-xs font-medium text-slate-900 focus:bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Section B: Inflow Channel & Regional CTC Mapping */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-2xs space-y-3.5">
              <div className="border-b border-slate-100 pb-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Channel & Regional Tax Jurisdiction</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Determines automatic salary formulas, EPF/GPSSA caps, and statutory slabs.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Intake Channel / Stage</label>
                  <Select
                    value={form.source || 'MANUAL'}
                    onChange={(e) => patch('source', e.target.value)}
                    className="h-8.5 rounded-xl border-slate-200/90 bg-slate-50/50 text-xs font-semibold text-slate-700"
                  >
                    {SOURCE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Country (Auto-matches CTC)</label>
                  <Input
                    value={form.country || ''}
                    onChange={(e) => patch('country', e.target.value)}
                    placeholder="India"
                    className="h-8.5 rounded-xl border-slate-200/90 bg-slate-50/50 text-xs font-medium text-slate-900 focus:bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">State / Region</label>
                  <Input
                    value={form.region || ''}
                    onChange={(e) => patch('region', e.target.value)}
                    placeholder="Maharashtra"
                    className="h-8.5 rounded-xl border-slate-200/90 bg-slate-50/50 text-xs font-medium text-slate-900 focus:bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">City / Location</label>
                  <Input
                    value={form.city || ''}
                    onChange={(e) => patch('city', e.target.value)}
                    placeholder="Mumbai"
                    className="h-8.5 rounded-xl border-slate-200/90 bg-slate-50/50 text-xs font-medium text-slate-900 focus:bg-white"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Salary & CTC Structure */}
        {activeTab === 'compensation' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">Assigned Salary Template</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">Calculates earnings, statutory deductions, and net take-home.</p>
                </div>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 w-fit">
                  {profile ? profile.name : 'Select Profile'}
                </span>
              </div>
              <Select
                value={profile?.id || ''}
                onChange={(e) => setProfile(profiles.find((p) => p.id === e.target.value) || null)}
                className="h-8.5 text-xs rounded-xl"
              >
                <option value="">Select Salary Template Profile</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.country}) — {p.currencyCode}
                  </option>
                ))}
              </Select>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
              <CtcCalculator
                profile={profile}
                anchorValue={anchorValue}
                componentOverrides={overrides}
                onAnchorChange={setAnchorValue}
                onOverrideChange={handleOverride}
              />
            </div>
          </div>
        )}

        {/* Tab 3: Checklist & Tasks */}
        {activeTab === 'checklist' && (
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">Onboarding Milestones</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Track readiness before graduating candidate into permanent employee.</p>
              </div>
              <span className="text-xs font-bold text-slate-700 font-mono px-2 py-0.5 rounded-lg bg-slate-100 border border-slate-200">
                {tasksDone} of {tasksCount} Completed
              </span>
            </div>

            {hire?.tasks && hire.tasks.length > 0 ? (
              <div className="space-y-2">
                {hire.tasks.map((task) => (
                  <label
                    key={task.label}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 transition-colors ${
                      task.done
                        ? 'border-emerald-200 bg-emerald-50/50 text-emerald-900'
                        : 'border-slate-200/80 bg-slate-50/30 hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={task.done}
                      onChange={(e) => toggleTask(task.label, e.target.checked)}
                      className="size-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <span className={`text-xs font-semibold ${task.done ? 'line-through text-emerald-700' : 'text-slate-800'}`}>
                      {task.label}
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-xs text-slate-400">
                Default onboarding tasks will automatically populate once candidate profile is saved.
              </div>
            )}
          </div>
        )}
      </div>
    </DrawerWrapper>
  )
}
