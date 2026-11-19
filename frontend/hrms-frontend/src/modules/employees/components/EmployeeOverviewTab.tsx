"use client"

import * as React from 'react'
import { SectionCard, StatusBadge, Button } from '@hryantra/ui'
import { Employee, CustomFieldDefinitionItem, CustomFieldSection } from '../types'
import {
  Building2,
  Mail,
  MapPin,
  Network,
  UserRound,
  BadgeCheck,
  Laptop,
  CheckCircle2,
  SlidersHorizontal,
  HeartPulse,
  CreditCard,
  Shirt,
  Calendar,
  Layers,
  Sparkles,
  Tag,
  Check,
  X,
  Briefcase,
  HelpCircle,
  Phone,
  ShieldCheck,
  HeartHandshake,
  Star,
  ArrowRight,
  AlertTriangle,
  Users,
  Copy,
  ExternalLink,
  ChevronRight
} from 'lucide-react'
import { api } from '@/shared/api'
import { useStore } from '@/store/StoreProvider'

interface EmployeeOverviewTabProps {
  employee: Employee
  onOpenEdit?: () => void
  onOpenChangeRequest?: () => void
  onNavigateTab?: (tab: any) => void
}

function AttributeRow({
  icon: Icon,
  label,
  value,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-slate-50 transition-colors">
      <div className="flex items-center gap-2.5 min-w-0 pr-3">
        <div className="size-7 rounded-lg bg-slate-100/90 border border-slate-200/60 flex items-center justify-center text-slate-500 shrink-0">
          <Icon className="size-3.5" />
        </div>
        <span className="text-xs font-semibold text-slate-600 truncate">{label}</span>
      </div>
      <div className="text-xs font-bold text-slate-900 shrink-0 text-right">
        {children ?? (value || '—')}
      </div>
    </div>
  )
}

function getFieldIcon(key: string, section: CustomFieldSection) {
  if (key.includes('blood')) return HeartPulse
  if (key.includes('card') || key.includes('badge') || key.includes('rfid')) return CreditCard
  if (key.includes('tshirt') || key.includes('size')) return Shirt
  if (key.includes('seat') || key.includes('desk')) return Building2
  if (key.includes('date') || key.includes('expiry') || key.includes('passport')) return Calendar
  if (key.includes('skill')) return Briefcase
  if (section === 'PERSONAL') return UserRound
  if (section === 'WORK_DETAILS') return Layers
  if (section === 'COMPLIANCE_KYC') return BadgeCheck
  return Tag
}

const SECTION_CONFIG: Record<CustomFieldSection, { title: string; shortTitle: string; subtitle: string; badgeColor: string }> = {
  PERSONAL: {
    title: 'Personal & Medical Attributes',
    shortTitle: 'Personal',
    subtitle: 'Emergency vitals, medical records, and merchandise sizing',
    badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  WORK_DETAILS: {
    title: 'Workplace & Facilities Attributes',
    shortTitle: 'Workplace',
    subtitle: 'Desk seating allocations, security access badges, and cost centers',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  COMPLIANCE_KYC: {
    title: 'Compliance & Statutory Attributes',
    shortTitle: 'Compliance',
    subtitle: 'International passport validity and regulatory credentials',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  OTHER: {
    title: 'Additional Attributes',
    shortTitle: 'General',
    subtitle: 'Company-specific metadata and custom parameters',
    badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
  },
}

export function EmployeeOverviewTab({ employee, onOpenEdit, onOpenChangeRequest, onNavigateTab }: EmployeeOverviewTabProps) {
  const { currentUserRole, hasAction } = useStore()
  const canEdit = currentUserRole === 'HR' || currentUserRole === 'Superadmin' || currentUserRole === 'Manager' || hasAction('employees_edit')

  const [webPunchAllowed, setWebPunchAllowed] = React.useState<boolean>(true)
  const [loadingPunch, setLoadingPunch] = React.useState<boolean>(true)
  const [updatingPunch, setUpdatingPunch] = React.useState<boolean>(false)
  const [feedback, setFeedback] = React.useState<string | null>(null)

  // Custom Fields Schema & Values
  const [customFieldDefs, setCustomFieldDefs] = React.useState<CustomFieldDefinitionItem[]>([])
  const [loadingFields, setLoadingFields] = React.useState<boolean>(true)
  const [attrFilter, setAttrFilter] = React.useState<'ALL' | CustomFieldSection>('ALL')

  // Beneficiary, Emergency Contact & Statutory Health Snapshot
  const [snapshot, setSnapshot] = React.useState<any>(null)
  const [loadingSnapshot, setLoadingSnapshot] = React.useState<boolean>(true)

  React.useEffect(() => {
    let mounted = true
    api.attendance.getWebPunchPermission(employee.id)
      .then((res: any) => {
        if (mounted && res?.data) {
          setWebPunchAllowed(Boolean(res.data.allowed))
        }
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoadingPunch(false)
      })

    // Load active custom field definitions
    api.customFields.list(false)
      .then((res: any) => {
        if (mounted && Array.isArray(res?.data)) {
          setCustomFieldDefs(res.data)
        }
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoadingFields(false)
      })

    // Load Beneficiaries, Dependents & Emergency Contacts
    const empDbId = employee.recordId || employee.id
    api.employees.beneficiaries.getSnapshot(empDbId)
      .then((res: any) => {
        if (mounted && res?.data) {
          setSnapshot(res.data)
        }
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoadingSnapshot(false)
      })

    return () => {
      mounted = false
    }
  }, [employee.id, employee.recordId])

  const handleToggleWebPunch = async () => {
    if (!canEdit || updatingPunch) return
    const nextState = !webPunchAllowed
    setWebPunchAllowed(nextState)
    setUpdatingPunch(true)
    setFeedback(null)

    try {
      await api.attendance.setWebPunchPermission({
        employeeId: employee.id,
        allowed: nextState,
      })
      setFeedback(nextState ? 'Web clock-in enabled' : 'Web clock-in restricted')
      setTimeout(() => setFeedback(null), 3000)
    } catch {
      // Revert on error
      setWebPunchAllowed(!nextState)
      setFeedback('Failed to update permission')
      setTimeout(() => setFeedback(null), 3000)
    } finally {
      setUpdatingPunch(false)
    }
  }

  // Custom field values dictionary from employee
  const employeeCustomFields = (employee.customFields as Record<string, any>) || {}

  const formatFieldValue = (def: CustomFieldDefinitionItem, rawVal: any) => {
    if (rawVal === undefined || rawVal === null || rawVal === '') {
      return null
    }

    if (def.type === 'BOOLEAN') {
      const isTrue = rawVal === true || rawVal === 'true' || rawVal === 1
      return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold border ${
          isTrue
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : 'bg-slate-100 text-slate-700 border-slate-200'
        }`}>
          {isTrue ? <Check className="size-3 text-emerald-600" /> : <X className="size-3 text-slate-400" />}
          {isTrue ? 'Yes' : 'No'}
        </span>
      )
    }

    if (def.type === 'DATE' && rawVal) {
      try {
        const d = new Date(rawVal)
        if (!isNaN(d.getTime())) {
          return (
            <span className="font-bold text-slate-900 text-xs">
              {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          )
        }
      } catch {}
    }

    if (def.key === 'blood_group') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700 border border-rose-200">
          <HeartPulse className="size-3 text-rose-600" />
          {String(rawVal)}
        </span>
      )
    }

    return <span className="font-bold text-slate-900 text-xs">{String(rawVal)}</span>
  }

  const filteredCustomFields = React.useMemo(() => {
    if (attrFilter === 'ALL') return customFieldDefs
    return customFieldDefs.filter(d => d.section === attrFilter)
  }, [customFieldDefs, attrFilter])

  const countsBySection = React.useMemo(() => {
    const c = { ALL: customFieldDefs.length, WORK_DETAILS: 0, PERSONAL: 0, COMPLIANCE_KYC: 0, OTHER: 0 }
    customFieldDefs.forEach(d => {
      if (d.section in c) c[d.section as keyof typeof c] += 1
    })
    return c
  }, [customFieldDefs])

  return (
    <div className="flex flex-col gap-5">
      {/* ── 1. Balanced Top Section: Organization Profile & Digital Workplace ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Card 1: Organization & Role Hierarchy */}
        <SectionCard 
          title="Organization & Position" 
          titleAction={
            <span className="text-[11px] font-semibold text-slate-400">
              Department Structure
            </span>
          }
        >
          <div className="flex flex-col divide-y divide-slate-100">
            <AttributeRow icon={BadgeCheck} label="Employee ID">
              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 text-[11px] font-mono font-bold">
                {employee.id}
              </span>
            </AttributeRow>

            <AttributeRow icon={UserRound} label="Designation">
              <span className="text-xs font-bold text-slate-900">{employee.designation || 'Specialist'}</span>
            </AttributeRow>

            <AttributeRow icon={Building2} label="Department">
              <span className="text-xs font-bold text-slate-900">{employee.department}</span>
            </AttributeRow>

            <AttributeRow icon={Network} label="Reporting Manager">
              <span className="text-xs font-bold text-indigo-700 bg-indigo-50/70 border border-indigo-200/60 px-2 py-0.5 rounded-md">
                {employee.manager || 'Unassigned'}
              </span>
            </AttributeRow>

            <AttributeRow icon={Layers} label="Organization Unit">
              <span className="text-xs font-semibold text-slate-700">{employee.orgUnitName || 'Corporate HQ'}</span>
            </AttributeRow>

            <AttributeRow icon={MapPin} label="Work Location">
              <span className="text-xs font-semibold text-slate-700">{employee.locationName || 'Main Office'}</span>
            </AttributeRow>
          </div>
        </SectionCard>

        {/* Card 2: Security & Digital Workplace Controls */}
        <SectionCard 
          title="Security & Digital Access"
          titleAction={
            <span className="text-[11px] font-semibold text-slate-400">
              Identity & Self-Service
            </span>
          }
        >
          <div className="flex flex-col divide-y divide-slate-100">
            <AttributeRow icon={Mail} label="Work Email">
              <a href={`mailto:${employee.email}`} className="text-xs font-bold text-indigo-600 hover:underline">
                {employee.email}
              </a>
            </AttributeRow>

            <AttributeRow icon={ShieldCheck} label="Employment Status">
              <StatusBadge status={employee.status} withDot />
            </AttributeRow>

            <AttributeRow icon={UserRound} label="HRMS Login Account">
              {employee.hasLogin ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="size-1.5 rounded-full bg-emerald-500" /> Active Portal Account
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                  <span className="size-1.5 rounded-full bg-amber-500" /> Pending Provisioning
                </span>
              )}
            </AttributeRow>

            <AttributeRow icon={Laptop} label="Browser Clock-In Permission">
              <div className="flex items-center gap-2.5">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  webPunchAllowed
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-slate-100 text-slate-700 border-slate-200'
                }`}>
                  <span className={`size-1.5 rounded-full ${webPunchAllowed ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                  {loadingPunch ? 'Checking...' : webPunchAllowed ? 'Allowed' : 'Restricted'}
                </span>

                {feedback && (
                  <span className="text-[10px] font-bold text-indigo-600 animate-in fade-in">
                    {feedback}
                  </span>
                )}

                {canEdit && (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={webPunchAllowed}
                    disabled={updatingPunch || loadingPunch}
                    onClick={handleToggleWebPunch}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden disabled:opacity-50 ${
                      webPunchAllowed ? 'bg-indigo-600' : 'bg-slate-300'
                    }`}
                    title={`Click to ${webPunchAllowed ? 'restrict' : 'enable'} browser clock-in for this employee`}
                  >
                    <span
                      className={`pointer-events-none inline-block size-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                        webPunchAllowed ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                )}
              </div>
            </AttributeRow>
          </div>
        </SectionCard>
      </div>

      {/* ── 2. Workplace Safety & Statutory Compliance (Balanced Row) ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Workplace Emergency Contact */}
        <SectionCard
          title="Workplace Emergency Contact"
          titleAction={
            onNavigateTab ? (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => onNavigateTab('beneficiaries')}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 p-0 h-auto"
              >
                Manage Contacts <ChevronRight className="size-3 ml-0.5" />
              </Button>
            ) : undefined
          }
        >
          {loadingSnapshot ? (
            <p className="text-xs text-slate-400 py-4 text-center">Loading emergency contact...</p>
          ) : (() => {
            const contacts = snapshot?.emergencyContacts || []
            const primary = contacts.find((c: any) => c.isPrimary) || contacts[0]

            if (!primary) {
              return (
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-amber-50/60 border border-amber-200/80">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                      <AlertTriangle className="size-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-amber-900">No emergency contact registered</p>
                      <p className="text-[11px] text-amber-700">Required for escalation and medical emergency safety.</p>
                    </div>
                  </div>
                  {onNavigateTab && (
                    <Button
                      size="xs"
                      onClick={() => onNavigateTab('beneficiaries')}
                      className="bg-amber-600 hover:bg-amber-700 text-white text-[11px] h-7 px-2.5 rounded-lg shrink-0"
                    >
                      <Phone className="size-3 mr-1" /> Add Contact
                    </Button>
                  )}
                </div>
              )
            }

            return (
              <div className="flex items-center justify-between p-3 rounded-xl bg-purple-50/50 border border-purple-100">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                    <Star className="size-3.5 fill-purple-600 text-purple-600" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 truncate">{primary.name}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200">
                        {primary.relationship} · Primary
                      </span>
                    </div>
                    <a
                      href={`tel:${primary.primaryPhone}`}
                      className="text-xs font-semibold text-purple-700 hover:text-purple-900 flex items-center gap-1.5 mt-0.5"
                    >
                      <Phone className="size-3" /> {primary.primaryPhone}
                    </a>
                  </div>
                </div>
                <span className="text-[10px] font-semibold text-slate-400 shrink-0">
                  {contacts.length} {contacts.length === 1 ? 'Contact' : 'Contacts'}
                </span>
              </div>
            )
          })()}
        </SectionCard>

        {/* Statutory Benefits & Insurance Health */}
        <SectionCard
          title="Statutory Benefits & Insurance (PF / Gratuity / GMC)"
          titleAction={
            onNavigateTab ? (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => onNavigateTab('beneficiaries')}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 p-0 h-auto"
              >
                View Details <ChevronRight className="size-3 ml-0.5" />
              </Button>
            ) : undefined
          }
        >
          {loadingSnapshot ? (
            <p className="text-xs text-slate-400 py-4 text-center">Loading statutory status...</p>
          ) : (() => {
            const summaries = snapshot?.statutorySummary || []
            const gratuity = summaries.find((s: any) => s.scheme === 'GRATUITY')
            const pf = summaries.find((s: any) => s.scheme === 'PF_EPF')
            const dependents = snapshot?.dependents || []
            const gmcDeps = dependents.filter((d: any) => d.isCoveredUnderGmc)

            return (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between p-2 rounded-xl border border-slate-100 bg-slate-50/60">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="size-3.5 text-purple-600 shrink-0" />
                    <span className="text-xs font-bold text-slate-800 truncate">Payment of Gratuity Act 1972</span>
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                    gratuity?.status === 'COMPLIANT'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-amber-50 text-amber-800 border-amber-200'
                  }`}>
                    {gratuity?.status === 'COMPLIANT' ? '100% Compliant' : `${gratuity?.totalAllocated || 0}% Allocated`}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-xl border border-slate-100 bg-slate-50/60">
                  <div className="flex items-center gap-2">
                    <HeartHandshake className="size-3.5 text-blue-600 shrink-0" />
                    <span className="text-xs font-bold text-slate-800 truncate">Provident Fund & Pension (EPFO)</span>
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                    pf?.status === 'COMPLIANT'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-amber-50 text-amber-800 border-amber-200'
                  }`}>
                    {pf?.status === 'COMPLIANT' ? '100% Compliant' : `${pf?.totalAllocated || 0}% Allocated`}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-xl border border-slate-100 bg-slate-50/60">
                  <div className="flex items-center gap-2">
                    <Users className="size-3.5 text-emerald-600 shrink-0" />
                    <span className="text-xs font-bold text-slate-800 truncate">Group Health Insurance (GMC)</span>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                    {gmcDeps.length} Enrolled
                  </span>
                </div>
              </div>
            )
          })()}
        </SectionCard>
      </div>

      {/* ── 3. Unified Custom Profile Attributes & Facilities (Clean Segmented Tile Grid) ── */}
      {customFieldDefs.length > 0 && (
        <SectionCard
          title="Custom Profile Attributes & Facilities"
          titleAction={
            <div className="flex items-center gap-2">
              {onOpenChangeRequest && (
                <Button
                  variant="outline"
                  size="xs"
                  onClick={onOpenChangeRequest}
                  className="text-[11px] h-7 px-2.5 border-purple-200 text-purple-700 hover:bg-purple-50 font-semibold"
                >
                  <Sparkles className="size-3 mr-1 text-purple-600" />
                  Request Update
                </Button>
              )}
              {canEdit && onOpenEdit && (
                <Button
                  variant="outline"
                  size="xs"
                  onClick={onOpenEdit}
                  className="text-[11px] h-7 px-2.5 border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold"
                >
                  Edit Attributes
                </Button>
              )}
            </div>
          }
        >
          <div className="flex flex-col gap-4">
            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 flex-wrap border-b border-slate-100 pb-3">
              <button
                type="button"
                onClick={() => setAttrFilter('ALL')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  attrFilter === 'ALL'
                    ? 'bg-slate-900 text-white shadow-2xs font-bold'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                All Attributes ({countsBySection.ALL})
              </button>

              <button
                type="button"
                onClick={() => setAttrFilter('WORK_DETAILS')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  attrFilter === 'WORK_DETAILS'
                    ? 'bg-blue-600 text-white shadow-2xs font-bold'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                Workplace & Facilities ({countsBySection.WORK_DETAILS})
              </button>

              <button
                type="button"
                onClick={() => setAttrFilter('PERSONAL')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  attrFilter === 'PERSONAL'
                    ? 'bg-rose-600 text-white shadow-2xs font-bold'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                Personal & Medical ({countsBySection.PERSONAL})
              </button>

              <button
                type="button"
                onClick={() => setAttrFilter('COMPLIANCE_KYC')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  attrFilter === 'COMPLIANCE_KYC'
                    ? 'bg-amber-600 text-white shadow-2xs font-bold'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                Compliance & Statutory ({countsBySection.COMPLIANCE_KYC})
              </button>
            </div>

            {/* Clean Grid of Attribute Tiles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {filteredCustomFields.map((def) => {
                const Icon = getFieldIcon(def.key, def.section)
                const val = employeeCustomFields[def.key]
                const formatted = formatFieldValue(def, val)
                const meta = SECTION_CONFIG[def.section]

                return (
                  <div
                    key={def.id}
                    className="rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-white hover:border-indigo-200/90 p-3 flex flex-col justify-between gap-2.5 shadow-2xs hover:shadow-xs transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="size-7 rounded-lg bg-white border border-slate-200 text-slate-600 flex items-center justify-center shrink-0 shadow-2xs">
                          <Icon className="size-3.5" />
                        </div>
                        <span className="text-xs font-bold text-slate-900 truncate" title={def.label}>
                          {def.label}
                        </span>
                      </div>
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border shrink-0 ${meta.badgeColor}`}>
                        {meta.shortTitle}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                      <span className="text-[10px] text-slate-400 font-medium">Record</span>
                      <div className="text-right">
                        {formatted || <span className="text-[11px] italic text-slate-400">Not recorded</span>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </SectionCard>
      )}
    </div>
  )
}
