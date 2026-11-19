"use client"

import * as React from 'react'
import { SectionCard, Button, StatusBadge } from '@hryantra/ui'
import {
  HeartHandshake,
  Phone,
  Mail,
  MapPin,
  Plus,
  Pencil,
  Trash2,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Users,
  ShieldAlert,
  Printer,
  Sparkles,
  Calendar,
  X,
  Star,
  Building2,
  FileText,
  UserCheck,
  AlertCircle,
  Copy,
} from 'lucide-react'
import { api } from '@/shared/api'
import { useStore } from '@/store/StoreProvider'
import {
  Employee,
  EmployeeEmergencyContactItem,
  EmployeeDependentItem,
  EmployeeNomineeItem,
  FamilyRelationship,
  NomineeBenefitScheme,
  DependentGender,
  BeneficiarySnapshot,
  StatutorySchemeSummary,
} from '../types'

interface EmployeeBeneficiariesTabProps {
  employee: Employee
}

const RELATIONSHIP_LABELS: Record<FamilyRelationship, string> = {
  SPOUSE: 'Spouse',
  FATHER: 'Father',
  MOTHER: 'Mother',
  SON: 'Son',
  DAUGHTER: 'Daughter',
  BROTHER: 'Brother',
  SISTER: 'Sister',
  GUARDIAN: 'Guardian',
  OTHER: 'Other',
}

const SCHEME_DISPLAY: Record<NomineeBenefitScheme, { label: string; statutoryRef: string; color: string }> = {
  GRATUITY: {
    label: 'Gratuity Nomination',
    statutoryRef: 'Form F (Payment of Gratuity Act, 1972)',
    color: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  PF_EPF: {
    label: 'Provident Fund (EPF)',
    statutoryRef: 'EPFO Form 2 Part A (EPF Scheme, 1952)',
    color: 'bg-blue-50 text-blue-800 border-blue-200',
  },
  PF_EPS: {
    label: 'Family Pension (EPS)',
    statutoryRef: 'EPFO Form 2 Part B (Pension Scheme, 1995)',
    color: 'bg-purple-50 text-purple-800 border-purple-200',
  },
  INSURANCE_GTLI: {
    label: 'Group Term Life Insurance (GTLI)',
    statutoryRef: 'Corporate Life Cover Scheme',
    color: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  INSURANCE_GPA: {
    label: 'Group Personal Accident (GPA)',
    statutoryRef: 'Accidental Demise & Disability Cover',
    color: 'bg-rose-50 text-rose-800 border-rose-200',
  },
  GENERAL: {
    label: 'General Corporate Beneficiary',
    statutoryRef: 'Company Standard Nomination',
    color: 'bg-slate-100 text-slate-700 border-slate-200',
  },
}

function calculateAge(dobStr: string): number {
  if (!dobStr) return 0
  const dob = new Date(dobStr)
  if (isNaN(dob.getTime())) return 0
  const diffMs = Date.now() - dob.getTime()
  const ageDate = new Date(diffMs)
  return Math.abs(ageDate.getUTCFullYear() - 1970)
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return '—'
  }
}

export function EmployeeBeneficiariesTab({ employee }: EmployeeBeneficiariesTabProps) {
  const { currentUserRole, hasAction } = useStore()
  const canEdit = currentUserRole === 'HR' || currentUserRole === 'Superadmin' || currentUserRole === 'Manager' || hasAction('employees_edit')

  const [snapshot, setSnapshot] = React.useState<BeneficiarySnapshot | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null)

  // Active Nominee Filter
  const [nomineeFilter, setNomineeFilter] = React.useState<string>('ALL')

  // Modals
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = React.useState(false)
  const [editingEmergency, setEditingEmergency] = React.useState<EmployeeEmergencyContactItem | null>(null)

  const [isDependentModalOpen, setIsDependentModalOpen] = React.useState(false)
  const [editingDependent, setEditingDependent] = React.useState<EmployeeDependentItem | null>(null)

  const [isNomineeModalOpen, setIsNomineeModalOpen] = React.useState(false)
  const [editingNominee, setEditingNominee] = React.useState<EmployeeNomineeItem | null>(null)

  const [isAuditModalOpen, setIsAuditModalOpen] = React.useState(false)
  const [saving, setSaving] = React.useState(false)

  // ── Form States ──
  // Emergency Contact Form
  const [contactName, setContactName] = React.useState('')
  const [contactRelation, setContactRelation] = React.useState<FamilyRelationship>('SPOUSE')
  const [contactPhone, setContactPhone] = React.useState('')
  const [contactSecondaryPhone, setContactSecondaryPhone] = React.useState('')
  const [contactEmail, setContactEmail] = React.useState('')
  const [contactAddress, setContactAddress] = React.useState('')
  const [contactIsPrimary, setContactIsPrimary] = React.useState(false)

  // Dependent Form
  const [depName, setDepName] = React.useState('')
  const [depRelation, setDepRelation] = React.useState<FamilyRelationship>('SPOUSE')
  const [depGender, setDepGender] = React.useState<DependentGender>('FEMALE')
  const [depDob, setDepDob] = React.useState('')
  const [depGmc, setDepGmc] = React.useState(true)
  const [depNationalId, setDepNationalId] = React.useState('')
  const [depPreExisting, setDepPreExisting] = React.useState('')
  const [depDisabled, setDepDisabled] = React.useState(false)

  // Nominee Form
  const [nomName, setNomName] = React.useState('')
  const [nomRelation, setNomRelation] = React.useState<FamilyRelationship>('SPOUSE')
  const [nomDob, setNomDob] = React.useState('')
  const [nomScheme, setNomScheme] = React.useState<NomineeBenefitScheme>('GRATUITY')
  const [nomShare, setNomShare] = React.useState<number>(100)
  const [nomAddress, setNomAddress] = React.useState('')
  const [nomNationalId, setNomNationalId] = React.useState('')
  const [nomGuardianName, setNomGuardianName] = React.useState('')
  const [nomGuardianRelation, setNomGuardianRelation] = React.useState('')
  const [nomGuardianAge, setNomGuardianAge] = React.useState<string>('')
  const [nomGuardianAddress, setNomGuardianAddress] = React.useState('')

  const empDbId = employee.recordId || employee.id

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true)
      setErrorMsg(null)
      const res = await api.employees.beneficiaries.getSnapshot(empDbId)
      if (res?.data) {
        setSnapshot(res.data)
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to load family, dependent, and nominee details')
    } finally {
      setLoading(false)
    }
  }, [empDbId])

  React.useEffect(() => {
    loadData()
  }, [loadData])

  // ════════════════════════════════════════════════════════════════
  // Handlers: Emergency Contact
  // ════════════════════════════════════════════════════════════════
  const openAddEmergency = () => {
    setEditingEmergency(null)
    setContactName('')
    setContactRelation('SPOUSE')
    setContactPhone('')
    setContactSecondaryPhone('')
    setContactEmail('')
    setContactAddress('')
    setContactIsPrimary((snapshot?.emergencyContacts?.length || 0) === 0)
    setIsEmergencyModalOpen(true)
  }

  const openEditEmergency = (c: EmployeeEmergencyContactItem) => {
    setEditingEmergency(c)
    setContactName(c.name)
    setContactRelation(c.relationship)
    setContactPhone(c.primaryPhone)
    setContactSecondaryPhone(c.secondaryPhone || '')
    setContactEmail(c.email || '')
    setContactAddress(c.address || '')
    setContactIsPrimary(c.isPrimary)
    setIsEmergencyModalOpen(true)
  }

  const handleSaveEmergency = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setErrorMsg(null)
    try {
      if (editingEmergency) {
        await api.employees.beneficiaries.updateEmergencyContact(empDbId, editingEmergency.id, {
          name: contactName,
          relationship: contactRelation,
          primaryPhone: contactPhone,
          secondaryPhone: contactSecondaryPhone || undefined,
          email: contactEmail || undefined,
          address: contactAddress || undefined,
          isPrimary: contactIsPrimary,
        })
        setSuccessMsg(`Emergency contact "${contactName}" updated`)
      } else {
        await api.employees.beneficiaries.addEmergencyContact(empDbId, {
          name: contactName,
          relationship: contactRelation,
          primaryPhone: contactPhone,
          secondaryPhone: contactSecondaryPhone || undefined,
          email: contactEmail || undefined,
          address: contactAddress || undefined,
          isPrimary: contactIsPrimary,
        })
        setSuccessMsg(`Emergency contact "${contactName}" added`)
      }
      setIsEmergencyModalOpen(false)
      loadData()
      setTimeout(() => setSuccessMsg(null), 3000)
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save emergency contact')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteEmergency = async (id: string, name: string) => {
    if (!confirm(`Delete emergency contact "${name}"?`)) return
    try {
      await api.employees.beneficiaries.deleteEmergencyContact(empDbId, id)
      setSuccessMsg(`Deleted contact "${name}"`)
      loadData()
      setTimeout(() => setSuccessMsg(null), 3000)
    } catch (err: any) {
      alert(err?.message || 'Failed to delete emergency contact')
    }
  }

  // ════════════════════════════════════════════════════════════════
  // Handlers: Dependents
  // ════════════════════════════════════════════════════════════════
  const openAddDependent = () => {
    setEditingDependent(null)
    setDepName('')
    setDepRelation('SPOUSE')
    setDepGender('FEMALE')
    setDepDob('')
    setDepGmc(true)
    setDepNationalId('')
    setDepPreExisting('')
    setDepDisabled(false)
    setIsDependentModalOpen(true)
  }

  const openEditDependent = (d: EmployeeDependentItem) => {
    setEditingDependent(d)
    setDepName(d.fullName)
    setDepRelation(d.relationship)
    setDepGender(d.gender)
    setDepDob(d.dateOfBirth.slice(0, 10))
    setDepGmc(d.isCoveredUnderGmc)
    setDepNationalId(d.nationalIdNumber || '')
    setDepPreExisting(d.preExistingDisease || '')
    setDepDisabled(d.isDisabled)
    setIsDependentModalOpen(true)
  }

  const handleSaveDependent = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setErrorMsg(null)
    try {
      if (editingDependent) {
        await api.employees.beneficiaries.updateDependent(empDbId, editingDependent.id, {
          fullName: depName,
          relationship: depRelation,
          gender: depGender,
          dateOfBirth: depDob,
          isCoveredUnderGmc: depGmc,
          nationalIdNumber: depNationalId || undefined,
          preExistingDisease: depPreExisting || undefined,
          isDisabled: depDisabled,
        })
        setSuccessMsg(`Dependent "${depName}" updated`)
      } else {
        await api.employees.beneficiaries.addDependent(empDbId, {
          fullName: depName,
          relationship: depRelation,
          gender: depGender,
          dateOfBirth: depDob,
          isCoveredUnderGmc: depGmc,
          nationalIdNumber: depNationalId || undefined,
          preExistingDisease: depPreExisting || undefined,
          isDisabled: depDisabled,
        })
        setSuccessMsg(`Dependent "${depName}" added to insurance floater`)
      }
      setIsDependentModalOpen(false)
      loadData()
      setTimeout(() => setSuccessMsg(null), 3000)
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save dependent')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteDependent = async (id: string, name: string) => {
    if (!confirm(`Remove dependent "${name}" from family list and insurance policy?`)) return
    try {
      await api.employees.beneficiaries.deleteDependent(empDbId, id)
      setSuccessMsg(`Removed "${name}"`)
      loadData()
      setTimeout(() => setSuccessMsg(null), 3000)
    } catch (err: any) {
      alert(err?.message || 'Failed to delete dependent')
    }
  }

  // ════════════════════════════════════════════════════════════════
  // Handlers: Statutory Nominees
  // ════════════════════════════════════════════════════════════════
  const openAddNominee = (preselectedScheme?: NomineeBenefitScheme) => {
    setEditingNominee(null)
    setNomName('')
    setNomRelation('SPOUSE')
    setNomDob('')
    const targetScheme = preselectedScheme || (nomineeFilter !== 'ALL' ? (nomineeFilter as NomineeBenefitScheme) : 'GRATUITY')
    setNomScheme(targetScheme)

    // Calculate remaining share for target scheme
    const existingForScheme = (snapshot?.nominees || []).filter((n) => n.scheme === targetScheme)
    const currentAlloc = existingForScheme.reduce((acc, n) => acc + n.sharePercentage, 0)
    setNomShare(Math.max(1, 100 - currentAlloc))

    setNomAddress('')
    setNomNationalId('')
    setNomGuardianName('')
    setNomGuardianRelation('')
    setNomGuardianAge('')
    setNomGuardianAddress('')
    setIsNomineeModalOpen(true)
  }

  const openEditNominee = (n: EmployeeNomineeItem) => {
    setEditingNominee(n)
    setNomName(n.name)
    setNomRelation(n.relationship)
    setNomDob(n.dateOfBirth.slice(0, 10))
    setNomScheme(n.scheme)
    setNomShare(n.sharePercentage)
    setNomAddress(n.address || '')
    setNomNationalId(n.nationalIdNumber || '')
    setNomGuardianName(n.guardianName || '')
    setNomGuardianRelation(n.guardianRelation || '')
    setNomGuardianAge(n.guardianAge ? String(n.guardianAge) : '')
    setNomGuardianAddress(n.guardianAddress || '')
    setIsNomineeModalOpen(true)
  }

  const handleImportFromDependent = (dep: EmployeeDependentItem) => {
    setNomName(dep.fullName)
    setNomRelation(dep.relationship)
    setNomDob(dep.dateOfBirth.slice(0, 10))
    setNomNationalId(dep.nationalIdNumber || '')
  }

  const handleSaveNominee = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setErrorMsg(null)
    try {
      const payload: any = {
        name: nomName,
        relationship: nomRelation,
        dateOfBirth: nomDob,
        scheme: nomScheme,
        sharePercentage: Number(nomShare),
        address: nomAddress || undefined,
        nationalIdNumber: nomNationalId || undefined,
        guardianName: nomGuardianName || undefined,
        guardianRelation: nomGuardianRelation || undefined,
        guardianAge: nomGuardianAge ? Number(nomGuardianAge) : undefined,
        guardianAddress: nomGuardianAddress || undefined,
      }

      if (editingNominee) {
        await api.employees.beneficiaries.updateNominee(empDbId, editingNominee.id, payload)
        setSuccessMsg(`Nominee "${nomName}" updated`)
      } else {
        await api.employees.beneficiaries.addNominee(empDbId, payload)
        setSuccessMsg(`Nominee "${nomName}" allocated to ${SCHEME_DISPLAY[nomScheme].label}`)
      }
      setIsNomineeModalOpen(false)
      loadData()
      setTimeout(() => setSuccessMsg(null), 3000)
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save nominee')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteNominee = async (id: string, name: string) => {
    if (!confirm(`Remove nominee "${name}" from this statutory scheme?`)) return
    try {
      await api.employees.beneficiaries.deleteNominee(empDbId, id)
      setSuccessMsg(`Nominee removed`)
      loadData()
      setTimeout(() => setSuccessMsg(null), 3000)
    } catch (err: any) {
      alert(err?.message || 'Failed to delete nominee')
    }
  }

  // Nominee age check in modal
  const nomineeAge = calculateAge(nomDob)
  const isMinorNominee = nomDob ? nomineeAge < 18 : false

  const filteredNominees = React.useMemo(() => {
    const list = snapshot?.nominees || []
    if (nomineeFilter === 'ALL') return list
    return list.filter((n) => n.scheme === nomineeFilter)
  }, [snapshot?.nominees, nomineeFilter])

  return (
    <div className="flex flex-col gap-6">
      {/* Alert Banners */}
      {successMsg && (
        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800 animate-in fade-in">
          <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-800 animate-in fade-in">
          <AlertCircle className="size-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Hero Card: Statutory Allocation Health */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="size-5 text-purple-600" />
              Statutory Nomination & Compliance Health (PF, Gratuity & Insurance)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Labor compliance status for <strong>EPFO Form 2</strong>, <strong>Gratuity Act Form F</strong>, and Corporate Insurance coverage.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAuditModalOpen(true)}
              className="border-slate-200 text-slate-700 hover:bg-slate-100 text-xs"
            >
              <Printer className="size-3.5 mr-1.5 text-purple-600" />
              Statutory Audit Summary
            </Button>
          </div>
        </div>

        {/* Scheme Compliance Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5 mt-4">
          {(snapshot?.statutorySummary || []).map((s) => {
            const isCompliant = s.status === 'COMPLIANT'
            const isOver = s.status === 'OVER_ALLOCATED'

            return (
              <div
                key={s.scheme}
                className={`rounded-xl border p-3.5 flex flex-col justify-between transition-all ${
                  isCompliant
                    ? 'border-emerald-200 bg-emerald-50/40'
                    : isOver
                    ? 'border-rose-200 bg-rose-50/40'
                    : 'border-amber-200 bg-amber-50/40'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      {s.scheme === 'GRATUITY' ? 'Gratuity (Form F)' : s.scheme === 'PF_EPF' ? 'EPFO PF (Part A)' : s.scheme === 'PF_EPS' ? 'Family Pension' : 'Life Insurance'}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                        isCompliant
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : isOver
                          ? 'bg-rose-100 text-rose-800 border-rose-300'
                          : 'bg-amber-100 text-amber-800 border-amber-300'
                      }`}
                    >
                      {isCompliant ? '100% OK' : isOver ? 'Exceeds 100%' : `${s.totalAllocated}% Set`}
                    </span>
                  </div>

                  <p className="text-xl font-black text-slate-900 mt-2">
                    {s.totalAllocated}% <span className="text-xs font-normal text-slate-500">allocated</span>
                  </p>

                  {/* Visual Progress Bar */}
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-2">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isCompliant ? 'bg-emerald-500' : isOver ? 'bg-rose-500' : 'bg-amber-500'
                      }`}
                      style={{ width: `${Math.min(100, s.totalAllocated)}%` }}
                    />
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-200/50 flex items-center justify-between text-[11px] text-slate-500">
                  <span>{s.nomineeCount} {s.nomineeCount === 1 ? 'Nominee' : 'Nominees'}</span>
                  {s.minorCount > 0 && (
                    <span className="font-semibold text-purple-700">{s.minorCount} Minor</span>
                  )}
                  {canEdit && !isCompliant && (
                    <button
                      type="button"
                      onClick={() => openAddNominee(s.scheme)}
                      className="font-bold text-purple-700 hover:underline"
                    >
                      + Allocate
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Row 1: Workplace Emergency Contacts & Insurance Dependents */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* ── 1. Workplace Emergency Contacts ── */}
        <SectionCard
          title="Workplace Emergency Contacts"
          titleAction={
            canEdit ? (
              <Button
                size="sm"
                variant="outline"
                onClick={openAddEmergency}
                className="border-slate-200 text-slate-700 hover:bg-slate-100 text-xs h-7"
              >
                <Plus className="size-3.5 mr-1 text-purple-600" />
                Add Contact
              </Button>
            ) : undefined
          }
        >
          <div className="flex flex-col gap-3">
            {loading ? (
              <p className="text-xs text-slate-400 py-4 text-center">Loading emergency contacts...</p>
            ) : (snapshot?.emergencyContacts || []).length === 0 ? (
              <div className="p-6 text-center flex flex-col items-center">
                <AlertTriangle className="size-8 text-amber-400 mb-2" />
                <p className="text-xs font-bold text-slate-700">No emergency contacts listed</p>
                <p className="text-[11px] text-slate-400 max-w-xs mt-0.5 mb-3">
                  Crucial for workplace safety and emergency medical protocols.
                </p>
                {canEdit && (
                  <Button size="sm" onClick={openAddEmergency} className="bg-purple-600 text-white text-xs">
                    <Plus className="size-3.5 mr-1" /> Add Primary Contact
                  </Button>
                )}
              </div>
            ) : (
              (snapshot?.emergencyContacts || []).map((c) => (
                <div
                  key={c.id}
                  className={`rounded-xl border p-3.5 transition-colors ${
                    c.isPrimary
                      ? 'border-purple-200 bg-purple-50/30'
                      : 'border-slate-200/90 bg-slate-50/50 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{c.name}</span>
                      <span className="rounded-full bg-slate-200/70 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                        {RELATIONSHIP_LABELS[c.relationship] || c.relationship}
                      </span>
                      {c.isPrimary && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 border border-purple-200 px-2 py-0.5 text-[10px] font-black text-purple-800">
                          <Star className="size-2.5 fill-purple-700" /> PRIMARY
                        </span>
                      )}
                    </div>

                    {canEdit && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditEmergency(c)}
                          className="p-1 text-slate-400 hover:text-purple-700 rounded transition-colors"
                          title="Edit Contact"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteEmergency(c.id, c.name)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                          title="Delete Contact"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <Phone className="size-3 text-slate-400 shrink-0" />
                      <a href={`tel:${c.primaryPhone}`} className="font-semibold text-slate-900 hover:underline">
                        {c.primaryPhone}
                      </a>
                      {c.secondaryPhone && (
                        <span className="text-slate-400 text-[11px]">/ {c.secondaryPhone}</span>
                      )}
                    </div>

                    {c.email && (
                      <div className="flex items-center gap-1.5">
                        <Mail className="size-3 text-slate-400 shrink-0" />
                        <span className="truncate">{c.email}</span>
                      </div>
                    )}

                    {c.address && (
                      <div className="flex items-start gap-1.5 sm:col-span-2 text-[11px] text-slate-500">
                        <MapPin className="size-3 text-slate-400 shrink-0 mt-0.5" />
                        <span>{c.address}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </SectionCard>

        {/* ── 2. Insurance Dependents & Mediclaim Floater ── */}
        <SectionCard
          title="Family Dependents & Group Health Insurance (GMC)"
          titleAction={
            canEdit ? (
              <Button
                size="sm"
                variant="outline"
                onClick={openAddDependent}
                className="border-slate-200 text-slate-700 hover:bg-slate-100 text-xs h-7"
              >
                <Plus className="size-3.5 mr-1 text-purple-600" />
                Add Dependent
              </Button>
            ) : undefined
          }
        >
          <div className="flex flex-col gap-3">
            {loading ? (
              <p className="text-xs text-slate-400 py-4 text-center">Loading family dependents...</p>
            ) : (snapshot?.dependents || []).length === 0 ? (
              <div className="p-6 text-center flex flex-col items-center">
                <Users className="size-8 text-slate-300 mb-2" />
                <p className="text-xs font-bold text-slate-700">No family dependents enrolled</p>
                <p className="text-[11px] text-slate-400 max-w-xs mt-0.5 mb-3">
                  Enroll spouse, dependent children, or parents for corporate mediclaim policy coverage.
                </p>
                {canEdit && (
                  <Button size="sm" onClick={openAddDependent} className="bg-purple-600 text-white text-xs">
                    <Plus className="size-3.5 mr-1" /> Add Family Member
                  </Button>
                )}
              </div>
            ) : (
              (snapshot?.dependents || []).map((d) => {
                const age = calculateAge(d.dateOfBirth)

                return (
                  <div
                    key={d.id}
                    className="rounded-xl border border-slate-200/90 bg-slate-50/50 p-3.5 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{d.fullName}</span>
                        <span className="rounded-full bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 text-[10px] font-bold">
                          {RELATIONSHIP_LABELS[d.relationship] || d.relationship}
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium">
                          {d.gender} · {age} years ({formatDate(d.dateOfBirth)})
                        </span>
                      </div>

                      {canEdit && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditDependent(d)}
                            className="p-1 text-slate-400 hover:text-purple-700 rounded transition-colors"
                            title="Edit Dependent"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteDependent(d.id, d.fullName)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                            title="Delete Dependent"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        {d.isCoveredUnderGmc ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold">
                            <CheckCircle2 className="size-3 text-emerald-600" />
                            Covered under GMC Floater
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 text-[10px] font-medium">
                            Not covered in GMC
                          </span>
                        )}

                        {d.isDisabled && (
                          <span className="rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 text-[10px] font-bold">
                            Specially Abled
                          </span>
                        )}
                      </div>

                      {d.nationalIdNumber && (
                        <span className="font-mono text-[11px] text-slate-400">
                          ID: {d.nationalIdNumber}
                        </span>
                      )}
                    </div>

                    {d.preExistingDisease && (
                      <p className="mt-2 text-[11px] text-amber-700 bg-amber-50/70 border border-amber-100 rounded-lg px-2.5 py-1">
                        <strong>Pre-existing condition:</strong> {d.preExistingDisease}
                      </p>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </SectionCard>
      </div>

      {/* Row 2: Statutory Nominees (Stored for PF, Gratuity, Life Insurance) */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <HeartHandshake className="size-5 text-purple-600" />
              Statutory Beneficiary Nominations (PF, Gratuity & Term Insurance)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Legally binding benefit share allocations governed under EPFO Form 2 and the Payment of Gratuity Act, 1972.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Filter Tabs */}
            <select
              value={nomineeFilter}
              onChange={(e) => setNomineeFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
            >
              <option value="ALL">All Statutory Schemes</option>
              <option value="GRATUITY">Gratuity (Form F)</option>
              <option value="PF_EPF">EPFO PF (Part A)</option>
              <option value="PF_EPS">Family Pension (Part B)</option>
              <option value="INSURANCE_GTLI">Life Insurance (GTLI)</option>
            </select>

            {canEdit && (
              <Button
                size="sm"
                onClick={() => openAddNominee()}
                className="bg-purple-600 hover:bg-purple-700 text-white text-xs h-8 shadow-xs"
              >
                <Plus className="size-3.5 mr-1" /> Add Nominee
              </Button>
            )}
          </div>
        </div>

        {/* Nominees Grid / List */}
        <div className="mt-4 flex flex-col gap-3">
          {loading ? (
            <p className="text-xs text-slate-400 py-6 text-center">Loading statutory nominees...</p>
          ) : filteredNominees.length === 0 ? (
            <div className="p-8 text-center flex flex-col items-center">
              <HeartHandshake className="size-10 text-slate-300 mb-2" />
              <p className="text-xs font-bold text-slate-700">No statutory nominees recorded</p>
              <p className="text-[11px] text-slate-400 max-w-sm mt-0.5 mb-4">
                Under Indian labor compliance, failure to register PF (Form 2) or Gratuity (Form F) nominees leads to legal audit queries.
              </p>
              {canEdit && (
                <Button size="sm" onClick={() => openAddNominee()} className="bg-purple-600 text-white text-xs">
                  <Plus className="size-3.5 mr-1" /> Register First Nominee
                </Button>
              )}
            </div>
          ) : (
            filteredNominees.map((n) => {
              const schemeMeta = SCHEME_DISPLAY[n.scheme] || SCHEME_DISPLAY.GENERAL
              const age = calculateAge(n.dateOfBirth)

              return (
                <div
                  key={n.id}
                  className="rounded-xl border border-slate-200/90 bg-white p-4 hover:border-purple-300 transition-all flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{n.name}</span>
                      <span className="rounded-full bg-slate-100 text-slate-700 px-2 py-0.5 text-[10px] font-bold border border-slate-200">
                        {RELATIONSHIP_LABELS[n.relationship] || n.relationship}
                      </span>
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${schemeMeta.color}`}>
                        {schemeMeta.label}
                      </span>
                      {n.isMinor && (
                        <span className="rounded-full bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 text-[10px] font-bold">
                          Minor ({age} yrs)
                        </span>
                      )}
                    </div>

                    <div className="mt-2 text-xs text-slate-600 flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span>
                        DOB: <strong>{formatDate(n.dateOfBirth)}</strong>
                      </span>
                      {n.nationalIdNumber && (
                        <span>
                          Aadhaar/ID: <strong className="font-mono">{n.nationalIdNumber}</strong>
                        </span>
                      )}
                      {n.address && (
                        <span className="truncate max-w-md text-slate-500">
                          Address: {n.address}
                        </span>
                      )}
                    </div>

                    {/* Minor Guardian Notice */}
                    {n.isMinor && n.guardianName && (
                      <div className="mt-2 text-[11px] bg-purple-50 text-purple-900 border border-purple-100 rounded-lg p-2 flex items-center gap-2">
                        <ShieldAlert className="size-3.5 text-purple-600 shrink-0" />
                        <span>
                          <strong>Appointed Guardian:</strong> {n.guardianName} ({n.guardianRelation || 'Legal Guardian'})
                          {n.guardianAge ? `, Age ${n.guardianAge}` : ''}
                          {n.guardianAddress ? ` · ${n.guardianAddress}` : ''}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-4 shrink-0 sm:border-l sm:border-slate-100 sm:pl-4">
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Beneficiary Share</span>
                      <span className="text-lg font-black text-purple-700">{n.sharePercentage}%</span>
                    </div>

                    {canEdit && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditNominee(n)}
                          className="p-1.5 text-slate-400 hover:text-purple-700 rounded-lg hover:bg-purple-50 transition-colors"
                          title="Edit Nominee"
                        >
                          <Pencil className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteNominee(n.id, n.name)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                          title="Delete Nominee"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          MODALS
      ════════════════════════════════════════════════════════════════ */}

      {/* ── 1. Emergency Contact Modal ── */}
      {isEmergencyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Phone className="size-4 text-purple-600" />
                {editingEmergency ? 'Edit Emergency Contact' : 'Add Emergency Contact'}
              </h3>
              <button
                type="button"
                onClick={() => setIsEmergencyModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEmergency} className="p-6 flex flex-col gap-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block font-bold text-slate-800 mb-1">
                    Contact Full Name <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="e.g. Priya Sharma"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block font-bold text-slate-800 mb-1">Relationship</label>
                  <select
                    value={contactRelation}
                    onChange={(e) => setContactRelation(e.target.value as FamilyRelationship)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                  >
                    {Object.entries(RELATIONSHIP_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Primary Phone Number <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">Secondary Phone (Optional)</label>
                  <input
                    type="tel"
                    value={contactSecondaryPhone}
                    onChange={(e) => setContactSecondaryPhone(e.target.value)}
                    placeholder="+91 98765 00000"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">Email Address</label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="contact@gmail.com"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">Residential Address</label>
                <textarea
                  rows={2}
                  value={contactAddress}
                  onChange={(e) => setContactAddress(e.target.value)}
                  placeholder="City, State, Pin Code..."
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={contactIsPrimary}
                  onChange={(e) => setContactIsPrimary(e.target.checked)}
                  className="size-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                />
                <span className="font-bold text-slate-800">
                  Set as Primary Emergency Contact (Contacted First in Incident Escalation)
                </span>
              </label>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 mt-2">
                <Button type="button" variant="outline" onClick={() => setIsEmergencyModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving} className="bg-purple-600 text-white">
                  {saving ? 'Saving...' : editingEmergency ? 'Save Changes' : 'Add Contact'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── 2. Dependent Modal ── */}
      {isDependentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Users className="size-4 text-purple-600" />
                {editingDependent ? 'Edit Dependent' : 'Add Dependent (Family Member)'}
              </h3>
              <button
                type="button"
                onClick={() => setIsDependentModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDependent} className="p-6 flex flex-col gap-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block font-bold text-slate-800 mb-1">
                    Dependent Full Name <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={depName}
                    onChange={(e) => setDepName(e.target.value)}
                    placeholder="e.g. Aarav Sharma"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block font-bold text-slate-800 mb-1">Relationship</label>
                  <select
                    value={depRelation}
                    onChange={(e) => setDepRelation(e.target.value as FamilyRelationship)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                  >
                    {Object.entries(RELATIONSHIP_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">Gender</label>
                  <select
                    value={depGender}
                    onChange={(e) => setDepGender(e.target.value as DependentGender)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="FEMALE">Female</option>
                    <option value="MALE">Male</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Date of Birth <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={depDob}
                    onChange={(e) => setDepDob(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                  />
                  {depDob && (
                    <span className="text-[10px] text-purple-700 font-bold mt-0.5 block">
                      Age: {calculateAge(depDob)} years
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">National ID / Aadhaar Number</label>
                <input
                  type="text"
                  value={depNationalId}
                  onChange={(e) => setDepNationalId(e.target.value)}
                  placeholder="xxxx xxxx xxxx"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Pre-existing Illness / Medical History (for Insurance Underwriting)
                </label>
                <input
                  type="text"
                  value={depPreExisting}
                  onChange={(e) => setDepPreExisting(e.target.value)}
                  placeholder="e.g. Hypertension, Asthma, None..."
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="flex flex-col gap-2 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={depGmc}
                    onChange={(e) => setDepGmc(e.target.checked)}
                    className="size-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="font-bold text-slate-800">
                    Cover under Company Group Medical Insurance (GMC Floater)
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={depDisabled}
                    onChange={(e) => setDepDisabled(e.target.checked)}
                    className="size-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="font-medium text-slate-700">
                    Specially abled / certified disability dependent
                  </span>
                </label>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 mt-2">
                <Button type="button" variant="outline" onClick={() => setIsDependentModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving} className="bg-purple-600 text-white">
                  {saving ? 'Saving...' : editingDependent ? 'Save Changes' : 'Add Dependent'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── 3. Statutory Nominee Modal ── */}
      {isNomineeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-in fade-in">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <HeartHandshake className="size-4 text-purple-600" />
                  {editingNominee ? 'Edit Statutory Nominee' : 'Add Statutory Nominee'}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Compliant with EPFO Form 2 & Payment of Gratuity Act Form F.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsNomineeModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNominee} className="p-6 flex flex-col gap-4 text-xs overflow-y-auto">
              {/* Quick Import from Dependents */}
              {!editingNominee && (snapshot?.dependents || []).length > 0 && (
                <div className="rounded-xl border border-purple-200 bg-purple-50/40 p-3 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-purple-900 flex items-center gap-1.5">
                    <Sparkles className="size-3.5 text-purple-600" />
                    Quick autofill from enrolled family dependents:
                  </span>
                  <select
                    onChange={(e) => {
                      const found = snapshot?.dependents.find((d) => d.id === e.target.value)
                      if (found) handleImportFromDependent(found)
                    }}
                    defaultValue=""
                    className="rounded-lg border border-purple-200 bg-white px-2 py-1 text-xs font-bold text-purple-700"
                  >
                    <option value="" disabled>
                      Select family member...
                    </option>
                    {(snapshot?.dependents || []).map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.fullName} ({RELATIONSHIP_LABELS[d.relationship]})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Target Scheme */}
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Statutory Benefit Scheme <span className="text-rose-600">*</span>
                </label>
                <select
                  disabled={Boolean(editingNominee)}
                  value={nomScheme}
                  onChange={(e) => {
                    const target = e.target.value as NomineeBenefitScheme
                    setNomScheme(target)
                    const existingForScheme = (snapshot?.nominees || []).filter((n) => n.scheme === target)
                    const currentAlloc = existingForScheme.reduce((acc, n) => acc + n.sharePercentage, 0)
                    setNomShare(Math.max(1, 100 - currentAlloc))
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500 disabled:bg-slate-100"
                >
                  {Object.entries(SCHEME_DISPLAY).map(([k, meta]) => (
                    <option key={k} value={k}>
                      {meta.label} — {meta.statutoryRef}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block font-bold text-slate-800 mb-1">
                    Nominee Full Name <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={nomName}
                    onChange={(e) => setNomName(e.target.value)}
                    placeholder="e.g. Priya Sharma"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block font-bold text-slate-800 mb-1">Relationship to Employee</label>
                  <select
                    value={nomRelation}
                    onChange={(e) => setNomRelation(e.target.value as FamilyRelationship)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                  >
                    {Object.entries(RELATIONSHIP_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Date of Birth <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={nomDob}
                    onChange={(e) => setNomDob(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                  />
                  {nomDob && (
                    <span className="text-[10px] text-purple-700 font-bold mt-0.5 block">
                      Age: {nomineeAge} years {isMinorNominee ? '(MINOR — Guardian Required)' : '(Adult)'}
                    </span>
                  )}
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Allocated Share (%) <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    step="0.01"
                    required
                    value={nomShare}
                    onChange={(e) => setNomShare(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 font-bold text-purple-700 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">Total across scheme must equal 100%.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">Aadhaar / National ID</label>
                  <input
                    type="text"
                    value={nomNationalId}
                    onChange={(e) => setNomNationalId(e.target.value)}
                    placeholder="xxxx xxxx xxxx"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">Nominee Address</label>
                  <input
                    type="text"
                    value={nomAddress}
                    onChange={(e) => setNomAddress(e.target.value)}
                    placeholder="City, State, Pin Code..."
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              {/* ── Minor Guardian Section (Mandatory if Age < 18) ── */}
              {isMinorNominee && (
                <div className="rounded-xl border border-rose-200 bg-rose-50/30 p-4 space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-rose-800">
                    <ShieldAlert className="size-4 text-rose-600" />
                    Minor Guardian Details (Statutory Requirement under EPFO & Gratuity Act)
                  </div>
                  <p className="text-[11px] text-rose-700">
                    Because this nominee is under 18 years old, benefits in the event of demise are legally held in trust by an appointed adult Guardian until majority.
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-800 mb-1">
                        Guardian Full Name <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={nomGuardianName}
                        onChange={(e) => setNomGuardianName(e.target.value)}
                        placeholder="e.g. Priya Sharma"
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-800 mb-1">
                        Relationship to Minor <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={nomGuardianRelation}
                        onChange={(e) => setNomGuardianRelation(e.target.value)}
                        placeholder="e.g. Mother, Grandfather"
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-800 mb-1">Guardian Age</label>
                      <input
                        type="number"
                        min="18"
                        max="100"
                        value={nomGuardianAge}
                        onChange={(e) => setNomGuardianAge(e.target.value)}
                        placeholder="e.g. 35"
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-800 mb-1">Guardian Address</label>
                      <input
                        type="text"
                        value={nomGuardianAddress}
                        onChange={(e) => setNomGuardianAddress(e.target.value)}
                        placeholder="Same as nominee or residential address"
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 mt-2">
                <Button type="button" variant="outline" onClick={() => setIsNomineeModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving} className="bg-purple-600 text-white">
                  {saving ? 'Saving...' : editingNominee ? 'Save Changes' : 'Register Nominee'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── 4. Printable Statutory Compliance Summary Sheet Modal ── */}
      {isAuditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in">
          <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Printer className="size-4 text-purple-600" />
                  Statutory Nomination Audit Record (Form 2 & Form F Summary)
                </h3>
                <p className="text-xs text-slate-500">
                  Employee: <strong>{snapshot?.employee.name}</strong> ({snapshot?.employee.employeeId}) · {snapshot?.employee.designation}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => window.print()}
                  className="bg-purple-600 text-white text-xs"
                >
                  Print / Save PDF
                </Button>
                <button
                  type="button"
                  onClick={() => setIsAuditModalOpen(false)}
                  className="text-slate-400 hover:text-slate-700 p-1"
                >
                  <X className="size-5" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex flex-col gap-6 text-xs text-slate-800">
              {/* Employee Header */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Employee ID</span>
                  <span className="font-bold text-slate-900">{snapshot?.employee.employeeId}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Full Name</span>
                  <span className="font-bold text-slate-900">{snapshot?.employee.name}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Department</span>
                  <span className="font-bold text-slate-900">{snapshot?.employee.department}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Joining Date</span>
                  <span className="font-bold text-slate-900">{formatDate(snapshot?.employee.joiningDate)}</span>
                </div>
              </div>

              {/* Gratuity Form F Table */}
              <div>
                <h4 className="font-bold text-slate-900 text-sm mb-2 flex items-center justify-between">
                  <span>1. Payment of Gratuity Act, 1972 (Nomination Form F)</span>
                  <span className="text-xs text-purple-700 font-semibold">Statutory Compliance</span>
                </h4>
                <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
                  <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">Nominee Name</th>
                      <th className="py-2 px-3">Relationship</th>
                      <th className="py-2 px-3">Age / Status</th>
                      <th className="py-2 px-3">Appointed Guardian (if minor)</th>
                      <th className="py-2 px-3 text-right">Share %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(snapshot?.nominees || [])
                      .filter((n) => n.scheme === 'GRATUITY')
                      .map((n) => (
                        <tr key={n.id}>
                          <td className="py-2 px-3 font-semibold">{n.name}</td>
                          <td className="py-2 px-3">{RELATIONSHIP_LABELS[n.relationship]}</td>
                          <td className="py-2 px-3">
                            {calculateAge(n.dateOfBirth)} yrs {n.isMinor ? '(Minor)' : '(Adult)'}
                          </td>
                          <td className="py-2 px-3">
                            {n.isMinor ? `${n.guardianName} (${n.guardianRelation})` : '—'}
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-purple-700">
                            {n.sharePercentage}%
                          </td>
                        </tr>
                      ))}
                    {(snapshot?.nominees || []).filter((n) => n.scheme === 'GRATUITY').length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-3 px-3 text-center text-slate-400 italic">
                          No Gratuity nominees registered.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* EPFO Form 2 Table */}
              <div>
                <h4 className="font-bold text-slate-900 text-sm mb-2 flex items-center justify-between">
                  <span>2. EPFO Form 2 (Provident Fund & Pension Scheme)</span>
                  <span className="text-xs text-purple-700 font-semibold">Statutory Compliance</span>
                </h4>
                <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
                  <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">Nominee Name</th>
                      <th className="py-2 px-3">Section</th>
                      <th className="py-2 px-3">Relationship</th>
                      <th className="py-2 px-3">Guardian</th>
                      <th className="py-2 px-3 text-right">Share %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(snapshot?.nominees || [])
                      .filter((n) => n.scheme === 'PF_EPF' || n.scheme === 'PF_EPS')
                      .map((n) => (
                        <tr key={n.id}>
                          <td className="py-2 px-3 font-semibold">{n.name}</td>
                          <td className="py-2 px-3">{n.scheme === 'PF_EPF' ? 'Part A (EPF)' : 'Part B (EPS)'}</td>
                          <td className="py-2 px-3">{RELATIONSHIP_LABELS[n.relationship]}</td>
                          <td className="py-2 px-3">
                            {n.isMinor ? `${n.guardianName} (${n.guardianRelation})` : '—'}
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-purple-700">
                            {n.sharePercentage}%
                          </td>
                        </tr>
                      ))}
                    {(snapshot?.nominees || []).filter((n) => n.scheme === 'PF_EPF' || n.scheme === 'PF_EPS').length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-3 px-3 text-center text-slate-400 italic">
                          No EPFO Form 2 nominees registered.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
