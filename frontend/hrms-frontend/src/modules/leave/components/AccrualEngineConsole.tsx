"use client"

import * as React from 'react'
import { createPortal } from 'react-dom'
import { Button, SectionCard, Spinner } from '@hryantra/ui'
import { api } from '@/shared/api'
import { useStore } from '@/store/StoreProvider'
import {
  Zap,
  CalendarCheck,
  RotateCcw,
  Banknote,
  History,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  X,
  Layers,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Sliders,
  Users,
  Shield,
  FileSpreadsheet,
  Edit2,
  Check,
  Trash2,
  AlertCircle,
  Sparkles,
} from 'lucide-react'

export const QUICK_PLAN_PRESETS = [
  {
    label: '⚡ Standard Corporate (24d)',
    name: 'Standard Corporate Leave Plan',
    codePrefix: 'LV-STD',
    frequency: 'MONTHLY' as const,
    annualCasual: 6,
    annualSick: 6,
    annualEarned: 12,
    carryForwardLimit: 15,
    maxEncashmentDays: 10,
    minBalanceRetention: 15,
    enableEncashment: true,
    enableProRata: true,
    targetDepartments: [],
    targetGrades: ['All Levels'],
  },
  {
    label: '⚡ Engineering & Tech (30d)',
    name: 'Engineering & Technology Leave Plan',
    codePrefix: 'LV-ENG',
    frequency: 'MONTHLY' as const,
    annualCasual: 6,
    annualSick: 8,
    annualEarned: 16,
    carryForwardLimit: 20,
    maxEncashmentDays: 12,
    minBalanceRetention: 15,
    enableEncashment: true,
    enableProRata: true,
    targetDepartments: ['Engineering', 'Product', 'QA'],
    targetGrades: ['SDE-1', 'SDE-2', 'Senior SDE', 'Staff Engineer'],
  },
  {
    label: '⚡ Executive & Leadership (38d)',
    name: 'Executive & Senior Leadership Plan',
    codePrefix: 'LV-EXEC',
    frequency: 'MONTHLY' as const,
    annualCasual: 8,
    annualSick: 10,
    annualEarned: 20,
    carryForwardLimit: 30,
    maxEncashmentDays: 15,
    minBalanceRetention: 20,
    enableEncashment: true,
    enableProRata: true,
    targetDepartments: [],
    targetGrades: ['Executive', 'VP', 'Director'],
  },
  {
    label: '⚡ Sales & Operations (26d)',
    name: 'Sales & Field Operations Plan',
    codePrefix: 'LV-SALES',
    frequency: 'MONTHLY' as const,
    annualCasual: 8,
    annualSick: 6,
    annualEarned: 12,
    carryForwardLimit: 15,
    maxEncashmentDays: 10,
    minBalanceRetention: 15,
    enableEncashment: true,
    enableProRata: true,
    targetDepartments: ['Sales', 'Operations', 'Field'],
    targetGrades: [],
  },
]

export interface AccrualPlan {
  id?: string
  code: string
  name: string
  frequency: 'MONTHLY' | 'QUARTERLY' | 'YEARLY'
  annualCasual: number
  annualSick: number
  annualEarned: number
  carryForwardLimit: number
  lapseUnusedCasual: boolean
  lapseUnusedSick: boolean
  enableEncashment: boolean
  maxEncashmentDays: number
  minBalanceRetention: number
  isDefault: boolean
  targetLocationIds: string[]
  targetGrades: string[]
  targetDepartments: string[]
  enableProRata: boolean
  proRataRounding?: string
  isActive?: boolean
  createdAt?: string
  updatedAt?: string

  // Compatibility aliases
  annualQuota?: number
  monthlyCredit?: number
  maxCarryForward?: number
  prorateForJoiners?: boolean
  targetLocations?: string[]
  encashmentAllowed?: boolean
  minRetentionForEncashment?: number
  maxEncashmentPerYear?: number
}

export interface LedgerEntry {
  id: string
  tenantId?: string
  employeeId: string
  employee?: {
    id?: string
    employeeId?: string
    firstName?: string
    lastName?: string
    name?: string
    designation?: string
    department?: string
  }
  leaveType: string
  transactionType?: string
  type?: string
  amount: number
  openingBalance: number
  closingBalance: number
  effectiveDate?: string
  createdAt?: string
  description?: string
  notes?: string
  batchId?: string
  cycleMonth?: number
  cycleYear?: number
}

function getPlanTotalAnnual(p: AccrualPlan): number {
  if (p.annualCasual !== undefined || p.annualSick !== undefined || p.annualEarned !== undefined) {
    return (Number(p.annualCasual) || 0) + (Number(p.annualSick) || 0) + (Number(p.annualEarned) || 0)
  }
  return Number(p.annualQuota) || 18
}

function getPlanMonthlyCredit(p: AccrualPlan): number {
  const total = getPlanTotalAnnual(p)
  return Number((total / 12).toFixed(1))
}

function getPlanCarryLimit(p: AccrualPlan): number {
  return Number(p.carryForwardLimit ?? p.maxCarryForward ?? 15)
}

function getPlanEncashAllowed(p: AccrualPlan): boolean {
  return p.enableEncashment !== undefined ? Boolean(p.enableEncashment) : (p.encashmentAllowed !== undefined ? Boolean(p.encashmentAllowed) : true)
}

function getPlanProRata(p: AccrualPlan): boolean {
  return p.enableProRata !== undefined ? Boolean(p.enableProRata) : (p.prorateForJoiners !== undefined ? Boolean(p.prorateForJoiners) : true)
}

export function AccrualEngineConsole() {
  const { employees } = useStore()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const [plans, setPlans] = React.useState<AccrualPlan[]>([])
  const [ledger, setLedger] = React.useState<LedgerEntry[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [selectedSubTab, setSelectedSubTab] = React.useState<'plans' | 'ledger' | 'opening-balances' | 'lop-reversals'>('plans')

  // Feedback banner
  const [feedback, setFeedback] = React.useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Opening Balance Import State
  const [obMode, setObMode] = React.useState<'table' | 'csv'>('table')
  const [obRows, setObRows] = React.useState<Array<{
    id: string
    employeeCode: string
    casualBalance: number
    sickBalance: number
    earnedBalance: number
    notes: string
  }>>([
    { id: 'row-1', employeeCode: 'EMP-001', casualBalance: 6, sickBalance: 6, earnedBalance: 12, notes: 'FY2026 Opening Balance' },
    { id: 'row-2', employeeCode: 'EMP-002', casualBalance: 6, sickBalance: 6, earnedBalance: 12, notes: 'FY2026 Opening Balance' },
    { id: 'row-3', employeeCode: 'EMP-003', casualBalance: 6, sickBalance: 6, earnedBalance: 12, notes: 'FY2026 Opening Balance' },
    { id: 'row-4', employeeCode: 'EMP-004', casualBalance: 6, sickBalance: 6, earnedBalance: 12, notes: 'FY2026 Opening Balance' },
    { id: 'row-5', employeeCode: 'EMP-005', casualBalance: 6, sickBalance: 6, earnedBalance: 12, notes: 'FY2026 Opening Balance' },
  ])
  const [obCsv, setObCsv] = React.useState(
    `employeeCode,casualBalance,sickBalance,earnedBalance,notes\nEMP-001,6,6,12,FY2026 Opening Balance\nEMP-002,6,6,12,FY2026 Opening Balance\nEMP-003,6,6,12,FY2026 Opening Balance\nEMP-004,6,6,12,FY2026 Opening Balance\nEMP-005,6,6,12,FY2026 Opening Balance`
  )
  const [isImportingOb, setIsImportingOb] = React.useState(false)
  const [obResult, setObResult] = React.useState<any>(null)

  // LOP Reversals State
  const [lopReversals, setLopReversals] = React.useState<any[]>([])
  const [isLoadingLop, setIsLoadingLop] = React.useState(false)
  const [lopFilter, setLopFilter] = React.useState<string>('ALL')

  // Accrual Run Modal
  const [isAccrualRunOpen, setIsAccrualRunOpen] = React.useState(false)
  const [accrualDate, setAccrualDate] = React.useState(new Date().toISOString().slice(0, 10))
  const [selectedRunPlanId, setSelectedRunPlanId] = React.useState<string>('')
  const [selectedRunDepartment, setSelectedRunDepartment] = React.useState<string>('')
  const [selectedEmployeeForRun, setSelectedEmployeeForRun] = React.useState<string>('')
  const [accrualPreviewData, setAccrualPreviewData] = React.useState<any>(null)
  const [isLoadingPreview, setIsLoadingPreview] = React.useState(false)
  const [isExecutingAccrual, setIsExecutingAccrual] = React.useState(false)

  // Year End Job Modal
  const [isYearEndOpen, setIsYearEndOpen] = React.useState(false)
  const [yearEndCycleYear, setYearEndCycleYear] = React.useState(new Date().getFullYear())
  const [selectedYearEndPlanId, setSelectedYearEndPlanId] = React.useState<string>('')
  const [selectedYearEndDepartment, setSelectedYearEndDepartment] = React.useState<string>('')
  const [yearEndPreviewData, setYearEndPreviewData] = React.useState<any>(null)
  const [isLoadingYearEndPreview, setIsLoadingYearEndPreview] = React.useState(false)
  const [isExecutingYearEnd, setIsExecutingYearEnd] = React.useState(false)

  // Encashment Modal
  const [isEncashmentOpen, setIsEncashmentOpen] = React.useState(false)
  const [encashEmployeeId, setEncashEmployeeId] = React.useState<string>(employees[0]?.id || '')
  const [encashPlanId, setEncashPlanId] = React.useState<string>('')
  const [encashDays, setEncashDays] = React.useState<number>(5)
  const [encashRate, setEncashRate] = React.useState<number>(1200)
  const [encashReason, setEncashReason] = React.useState<string>('Year-end privilege leave encashment')
  const [isSubmittingEncash, setIsSubmittingEncash] = React.useState(false)

  // Add/Edit Plan Modal
  const [isPlanModalOpen, setIsPlanModalOpen] = React.useState(false)
  const [isSavingPlan, setIsSavingPlan] = React.useState(false)
  const [isDeletingPlan, setIsDeletingPlan] = React.useState(false)
  const [planModalError, setPlanModalError] = React.useState<string | null>(null)
  const [deptInput, setDeptInput] = React.useState('')
  const [gradeInput, setGradeInput] = React.useState('')
  const [editingPlan, setEditingPlan] = React.useState<Partial<AccrualPlan>>({
    code: '',
    name: '',
    frequency: 'MONTHLY',
    annualCasual: 6,
    annualSick: 6,
    annualEarned: 12,
    carryForwardLimit: 15,
    lapseUnusedCasual: true,
    lapseUnusedSick: true,
    enableEncashment: true,
    maxEncashmentDays: 10,
    minBalanceRetention: 15,
    isDefault: false,
    enableProRata: true,
    targetGrades: [],
    targetDepartments: [],
    targetLocationIds: [],
  })

  const applyPreset = (preset: typeof QUICK_PLAN_PRESETS[0]) => {
    setEditingPlan((prev) => ({
      ...prev,
      code: `${preset.codePrefix}-${Date.now().toString(36).slice(-3).toUpperCase()}`,
      name: preset.name,
      frequency: preset.frequency,
      annualCasual: preset.annualCasual,
      annualSick: preset.annualSick,
      annualEarned: preset.annualEarned,
      carryForwardLimit: preset.carryForwardLimit,
      maxEncashmentDays: preset.maxEncashmentDays,
      minBalanceRetention: preset.minBalanceRetention,
      enableEncashment: preset.enableEncashment,
      enableProRata: preset.enableProRata,
      targetDepartments: preset.targetDepartments,
      targetGrades: preset.targetGrades,
    }))
    setDeptInput(preset.targetDepartments.join(', '))
    setGradeInput(preset.targetGrades.join(', '))
    setPlanModalError(null)
  }

  // Distinct Departments across employees and plans
  const distinctDepartments = React.useMemo(() => {
    const set = new Set<string>()
    employees.forEach((e: any) => {
      if (e.department && typeof e.department === 'string') set.add(e.department.trim())
    })
    plans.forEach((p: any) => {
      p.targetDepartments?.forEach((d: string) => {
        if (d && d !== 'All Departments') set.add(d.trim())
      })
    })
    return Array.from(set).sort()
  }, [employees, plans])

  // Scoped employees for Run Accrual
  const scopedRunEmployees = React.useMemo(() => {
    if (!selectedRunDepartment) return employees
    return employees.filter(
      (e) => (e.department || '').toLowerCase() === selectedRunDepartment.toLowerCase()
    )
  }, [employees, selectedRunDepartment])

  // Selected plan objects for summary banners
  const selectedRunPlan = React.useMemo(() => {
    if (!selectedRunPlanId) return null
    return plans.find((p) => p.id === selectedRunPlanId || p.code === selectedRunPlanId) || null
  }, [plans, selectedRunPlanId])

  const selectedYearEndPlan = React.useMemo(() => {
    if (!selectedYearEndPlanId) return null
    return plans.find((p) => p.id === selectedYearEndPlanId || p.code === selectedYearEndPlanId) || null
  }, [plans, selectedYearEndPlanId])

  const selectedEncashEmp = React.useMemo(() => {
    return employees.find(
      (e) => e.id === encashEmployeeId || (e as any).employeeId === encashEmployeeId
    )
  }, [employees, encashEmployeeId])

  // Resolve active plan for encashment modal
  const resolvedEncashPlan = React.useMemo(() => {
    if (encashPlanId) {
      const found = plans.find((p) => p.id === encashPlanId || p.code === encashPlanId)
      if (found) return found
    }
    if (!selectedEncashEmp) return plans[0] || null

    let best = plans.find((p) => p.isDefault) || plans[0]
    let highestScore = 0
    for (const plan of plans) {
      let score = 0
      if (
        selectedEncashEmp.department &&
        plan.targetDepartments?.some(
          (d) => d.toLowerCase() === selectedEncashEmp.department.toLowerCase()
        )
      ) {
        score += 1
      }
      if (
        selectedEncashEmp.designation &&
        plan.targetGrades?.some(
          (g) => g.toLowerCase() === selectedEncashEmp.designation.toLowerCase()
        )
      ) {
        score += 2
      }
      if (score > highestScore) {
        highestScore = score
        best = plan
      }
    }
    return best
  }, [plans, encashPlanId, selectedEncashEmp])

  const encashCurrentBal = Number((selectedEncashEmp as any)?.totalLeaves ?? 0)
  const encashMinRetention = Number(resolvedEncashPlan?.minBalanceRetention ?? 15)
  const encashMaxLimit = Number(resolvedEncashPlan?.maxEncashmentDays ?? 10)
  const encashMaxEligible = Math.max(0, Math.min(encashCurrentBal - encashMinRetention, encashMaxLimit))
  const isEncashExceeded = encashDays > encashMaxEligible

  // Ledger Filter
  const [ledgerEmployeeFilter, setLedgerEmployeeFilter] = React.useState<string>('')
  const [ledgerTypeFilter, setLedgerTypeFilter] = React.useState<string>('')

  const loadData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const [plansRes, ledgerRes] = await Promise.all([
        api.leaves.accrual.listPlans().catch(() => ({ data: [] })),
        api.leaves.accrual.getLedger().catch(() => ({ data: [] })),
      ])
      setPlans(Array.isArray(plansRes.data) ? plansRes.data : [])
      setLedger(Array.isArray(ledgerRes.data) ? ledgerRes.data : [])
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load accrual data' })
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadData()
  }, [loadData])

  React.useEffect(() => {
    if (employees.length > 0 && !encashEmployeeId) {
      setEncashEmployeeId(employees[0].id)
    }
  }, [employees, encashEmployeeId])

  const fetchLopReversals = React.useCallback(async () => {
    try {
      setIsLoadingLop(true)
      const res = await api.leaves.accrual.listLopReversals({
        status: lopFilter !== 'ALL' ? lopFilter : undefined,
      })
      if (res?.success) {
        setLopReversals(res.data || [])
      }
    } catch (err: any) {
      console.error('Failed to load LOP reversals:', err)
    } finally {
      setIsLoadingLop(false)
    }
  }, [lopFilter])

  React.useEffect(() => {
    if (selectedSubTab === 'lop-reversals') {
      fetchLopReversals()
    }
  }, [selectedSubTab, fetchLopReversals])

  const handleAddObRow = () => {
    const existing = new Set(obRows.map((r) => r.employeeCode))
    const unusedEmp = employees.find((e) => !existing.has((e as any).employeeId || e.id)) || employees[0]
    const defaultCode = (unusedEmp as any)?.employeeId || unusedEmp?.id || `EMP-00${obRows.length + 1}`
    setObRows((prev) => [
      ...prev,
      {
        id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        employeeCode: defaultCode,
        casualBalance: 6,
        sickBalance: 6,
        earnedBalance: 12,
        notes: 'FY2026 Opening Balance',
      },
    ])
  }

  const handleRemoveObRow = (id: string) => {
    setObRows((prev) => prev.filter((r) => r.id !== id))
  }

  const handleUpdateObRow = (id: string, field: string, val: any) => {
    setObRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: val } : r))
    )
  }

  const handlePopulateAllEmployees = () => {
    if (!employees || employees.length === 0) {
      setFeedback({ type: 'error', message: 'No active employees found to populate.' })
      return
    }
    const populated = employees.map((e, idx) => ({
      id: `row-emp-${e.id || idx}`,
      employeeCode: (e as any).employeeId || e.id,
      casualBalance: 6,
      sickBalance: 6,
      earnedBalance: 12,
      notes: 'FY2026 Opening Balance',
    }))
    setObRows(populated)
    setObCsv(
      `employeeCode,casualBalance,sickBalance,earnedBalance,notes\n${populated
        .map((r) => `${r.employeeCode},${r.casualBalance},${r.sickBalance},${r.earnedBalance},${r.notes}`)
        .join('\n')}`
    )
    setFeedback({
      type: 'success',
      message: `Populated ${populated.length} employees with standard opening balances!`,
    })
  }

  const handleApplyPresetToAll = (cl: number, sl: number, el: number) => {
    setObRows((prev) =>
      prev.map((r) => ({
        ...r,
        casualBalance: cl,
        sickBalance: sl,
        earnedBalance: el,
      }))
    )
  }

  const handleImportOpeningBalances = async () => {
    try {
      setIsImportingOb(true)
      setObResult(null)
      let rowsToSubmit: any[] = []

      if (obMode === 'table') {
        if (obRows.length === 0) {
          throw new Error('Please add at least one employee row to import opening balances.')
        }
        rowsToSubmit = obRows.map((r) => ({
          employeeCode: r.employeeCode,
          casualBalance: Number(r.casualBalance) || 0,
          sickBalance: Number(r.sickBalance) || 0,
          earnedBalance: Number(r.earnedBalance) || 0,
          notes: r.notes?.trim() || 'Opening Balance Import',
        }))
      } else {
        const lines = obCsv.split(/\r?\n/).filter((l) => l.trim().length > 0)
        if (lines.length < 2) throw new Error('At least one header row and one data row required')

        const header = lines[0].split(',').map((h) => h.trim().toLowerCase())
        const codeIdx = header.findIndex((h) => h.includes('code') || h.includes('employee') || h.includes('id'))
        const casualIdx = header.findIndex((h) => h.includes('casual') || h.includes('cl'))
        const sickIdx = header.findIndex((h) => h.includes('sick') || h.includes('sl'))
        const earnedIdx = header.findIndex((h) => h.includes('earned') || h.includes('el'))
        const notesIdx = header.findIndex((h) => h.includes('notes') || h.includes('reason'))

        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].split(',').map((p) => p.trim())
          if (parts.length <= 1 && !parts[0]) continue
          rowsToSubmit.push({
            employeeCode: codeIdx >= 0 ? parts[codeIdx] : parts[0],
            casualBalance: casualIdx >= 0 ? parseFloat(parts[casualIdx]) || 0 : 0,
            sickBalance: sickIdx >= 0 ? parseFloat(parts[sickIdx]) || 0 : 0,
            earnedBalance: earnedIdx >= 0 ? parseFloat(parts[earnedIdx]) || 0 : 0,
            notes: notesIdx >= 0 ? parts[notesIdx] : 'Opening Balance Import',
          })
        }
      }

      const res = await api.leaves.accrual.importOpeningBalances(rowsToSubmit)
      if (res?.success) {
        setObResult(res.data)
        setFeedback({
          type: 'success',
          message: res.message || `Successfully imported opening balances for ${res.data?.successCount || rowsToSubmit.length} employees!`,
        })
        await loadData()
      } else {
        throw new Error(res?.message || 'Opening balance import failed')
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error importing opening balances' })
    } finally {
      setIsImportingOb(false)
    }
  }

  const handleMarkLopRefunded = async (id: string) => {
    try {
      const res = await api.leaves.accrual.markLopRefunded(id)
      if (res?.success) {
        setFeedback({ type: 'success', message: res.message || 'LOP adjustment marked as refunded in cycle' })
        fetchLopReversals()
      } else {
        throw new Error(res?.message || 'Failed to mark LOP adjustment as refunded')
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error updating LOP record' })
    }
  }

  // Accrual Preview
  const handleFetchAccrualPreview = async () => {
    setIsLoadingPreview(true)
    setFeedback(null)
    try {
      const res = await api.leaves.accrual.previewAccrual({
        asOfDate: accrualDate,
        employeeId: selectedEmployeeForRun || undefined,
        planId: selectedRunPlanId || undefined,
        department: selectedRunDepartment || undefined,
      })
      setAccrualPreviewData(res.data)
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to generate accrual preview' })
    } finally {
      setIsLoadingPreview(false)
    }
  }

  // Execute Accrual Commit
  const handleExecuteAccrual = async () => {
    setIsExecutingAccrual(true)
    setFeedback(null)
    try {
      const res = await api.leaves.accrual.runAccrualNow({
        asOfDate: accrualDate,
        employeeId: selectedEmployeeForRun || undefined,
        planId: selectedRunPlanId || undefined,
        department: selectedRunDepartment || undefined,
        force: true,
      })
      setFeedback({
        type: 'success',
        message: res.message || 'Accrual successfully executed and recorded to ledger!',
      })
      setIsAccrualRunOpen(false)
      setAccrualPreviewData(null)
      await loadData()
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to execute accrual' })
    } finally {
      setIsExecutingAccrual(false)
    }
  }

  // Year End Preview
  const handleFetchYearEndPreview = async () => {
    setIsLoadingYearEndPreview(true)
    setFeedback(null)
    try {
      const res = await api.leaves.accrual.previewYearEnd({
        cycleYear: yearEndCycleYear,
        planId: selectedYearEndPlanId || undefined,
        department: selectedYearEndDepartment || undefined,
      })
      setYearEndPreviewData(res.data)
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to preview year-end reconciliation' })
    } finally {
      setIsLoadingYearEndPreview(false)
    }
  }

  // Execute Year End Job
  const handleExecuteYearEnd = async () => {
    setIsExecutingYearEnd(true)
    setFeedback(null)
    try {
      const res = await api.leaves.accrual.executeYearEnd({
        cycleYear: yearEndCycleYear,
        planId: selectedYearEndPlanId || undefined,
        department: selectedYearEndDepartment || undefined,
      })
      setFeedback({
        type: 'success',
        message: res.message || 'Year-end reconciliation executed and balances adjusted!',
      })
      setIsYearEndOpen(false)
      setYearEndPreviewData(null)
      await loadData()
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to execute year-end job' })
    } finally {
      setIsExecutingYearEnd(false)
    }
  }

  // Submit Encashment
  const handleEncashSubmit = async () => {
    if (!encashEmployeeId || encashDays <= 0) {
      setFeedback({ type: 'error', message: 'Employee and valid positive days are required' })
      return
    }
    if (isEncashExceeded) {
      setFeedback({
        type: 'error',
        message: `Requested ${encashDays} days exceeds maximum allowable ${encashMaxEligible} days under this policy`,
      })
      return
    }
    setIsSubmittingEncash(true)
    setFeedback(null)
    try {
      const res = await api.leaves.accrual.requestEncashment({
        employeeId: encashEmployeeId,
        daysToEncash: encashDays,
        planId: encashPlanId || undefined,
        ratePerDay: encashRate,
        reason: encashReason,
      })
      setFeedback({
        type: 'success',
        message: res.message || 'Leave encashment recorded and debited from balance!',
      })
      setIsEncashmentOpen(false)
      await loadData()
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Encashment failed' })
    } finally {
      setIsSubmittingEncash(false)
    }
  }

  // Save Accrual Plan
  const handleSavePlan = async () => {
    setPlanModalError(null)

    const code = String(editingPlan.code || '').toUpperCase().trim()
    const name = String(editingPlan.name || '').trim()

    if (!code) {
      setPlanModalError('Plan Code is required (e.g. LV-ENG-TECH)')
      return
    }
    if (!name) {
      setPlanModalError('Plan Name is required (e.g. Engineering & Technology Leave Plan)')
      return
    }

    const annualCasual = Number(editingPlan.annualCasual ?? 6)
    const annualSick = Number(editingPlan.annualSick ?? 6)
    const annualEarned = Number(editingPlan.annualEarned ?? 12)
    const totalDays = annualCasual + annualSick + annualEarned

    if (totalDays <= 0) {
      setPlanModalError('Total annual leave quota must be at least 1 day across Casual, Sick, or Earned categories.')
      return
    }

    // Parse departments and grades
    const targetDepartments = deptInput
      ? deptInput.split(',').map((s) => s.trim()).filter(Boolean)
      : (editingPlan.targetDepartments || [])

    const targetGrades = gradeInput
      ? gradeInput.split(',').map((s) => s.trim()).filter(Boolean)
      : (editingPlan.targetGrades || [])

    const payload = {
      id: editingPlan.id,
      code,
      name,
      frequency: editingPlan.frequency || 'MONTHLY',
      annualCasual,
      annualSick,
      annualEarned,
      carryForwardLimit: Number(editingPlan.carryForwardLimit ?? 15),
      lapseUnusedCasual: editingPlan.lapseUnusedCasual !== undefined ? Boolean(editingPlan.lapseUnusedCasual) : true,
      lapseUnusedSick: editingPlan.lapseUnusedSick !== undefined ? Boolean(editingPlan.lapseUnusedSick) : true,
      enableEncashment: editingPlan.enableEncashment !== undefined ? Boolean(editingPlan.enableEncashment) : true,
      maxEncashmentDays: Number(editingPlan.maxEncashmentDays ?? 10),
      minBalanceRetention: Number(editingPlan.minBalanceRetention ?? 15),
      isDefault: Boolean(editingPlan.isDefault),
      enableProRata: editingPlan.enableProRata !== undefined ? Boolean(editingPlan.enableProRata) : true,
      targetLocationIds: editingPlan.targetLocationIds || [],
      targetGrades,
      targetDepartments,
    }

    setIsSavingPlan(true)
    try {
      await api.leaves.accrual.upsertPlan(payload)
      setFeedback({ type: 'success', message: `Accrual plan "${payload.name}" saved successfully!` })
      setIsPlanModalOpen(false)
      await loadData()
    } catch (err: any) {
      setPlanModalError(err.message || 'Failed to save accrual plan')
      setFeedback({ type: 'error', message: err.message || 'Failed to save accrual plan' })
    } finally {
      setIsSavingPlan(false)
    }
  }

  const handleDeletePlan = async (plan: AccrualPlan) => {
    if (!plan.id) return
    if (plan.isDefault) {
      setPlanModalError('The tenant default leave plan cannot be deleted.')
      return
    }
    if (!window.confirm(`Are you sure you want to delete leave plan "${plan.name}"?`)) {
      return
    }

    setIsDeletingPlan(true)
    try {
      await api.leaves.accrual.deletePlan(plan.id)
      setFeedback({ type: 'success', message: `Leave plan "${plan.name}" deleted successfully!` })
      setIsPlanModalOpen(false)
      await loadData()
    } catch (err: any) {
      setPlanModalError(err.message || 'Failed to delete leave plan')
      setFeedback({ type: 'error', message: err.message || 'Failed to delete leave plan' })
    } finally {
      setIsDeletingPlan(false)
    }
  }

  // Filtered Ledger
  const filteredLedger = React.useMemo(() => {
    return ledger.filter((entry) => {
      const matchEmp =
        !ledgerEmployeeFilter ||
        entry.employeeId === ledgerEmployeeFilter ||
        entry.employee?.id === ledgerEmployeeFilter ||
        entry.employee?.employeeId === ledgerEmployeeFilter
      const typeStr = entry.transactionType || entry.type || ''
      const matchType = !ledgerTypeFilter || typeStr === ledgerTypeFilter
      return matchEmp && matchType
    })
  }, [ledger, ledgerEmployeeFilter, ledgerTypeFilter])

  return (
    <div className="flex flex-col gap-5 w-full">
      {/* Header Banner & Quick Triggers */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-2xl border border-slate-200/80 bg-linear-to-r from-teal-50/50 via-white to-indigo-50/40 shadow-2xs">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-600 text-white shadow-xs">
            <Zap className="size-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">
                Leave Accrual & Entitlement Engine
              </h2>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200">
                {plans.length} Active Plans
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Scheduled periodic accruals, joiner pro-rata math, grade/location policies, year-end carry-forward caps, and encashments.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Run Accrual Now */}
          <button
            type="button"
            onClick={() => {
              setIsAccrualRunOpen(true)
              setAccrualPreviewData(null)
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-teal-600 bg-teal-600 hover:bg-teal-700 text-white shadow-xs font-semibold h-8 px-3 text-xs transition-all cursor-pointer"
          >
            <Zap className="size-3.5" />
            Run Accrual Now
          </button>

          {/* Year-End Reconciliation */}
          <button
            type="button"
            onClick={() => {
              setIsYearEndOpen(true)
              setYearEndPreviewData(null)
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-amber-300 text-amber-900 bg-amber-50 hover:bg-amber-100 font-semibold h-8 px-3 text-xs transition-all cursor-pointer shadow-2xs"
          >
            <CalendarCheck className="size-3.5 text-amber-600" />
            Year-End Carry/Lapse
          </button>

          {/* Encashment Action */}
          <button
            type="button"
            onClick={() => setIsEncashmentOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 text-emerald-900 bg-emerald-50 hover:bg-emerald-100 font-semibold h-8 px-3 text-xs transition-all cursor-pointer shadow-2xs"
          >
            <Banknote className="size-3.5 text-emerald-600" />
            Encash Leaves
          </button>
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
            <span className="font-medium">{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Sub Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedSubTab('plans')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedSubTab === 'plans'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <Layers className="size-3.5 text-teal-400" />
            <span>Group Leave Plans ({plans.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedSubTab('ledger')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedSubTab === 'ledger'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <History className="size-3.5 text-indigo-400" />
            <span>Accrual Audit Ledger ({ledger.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedSubTab('opening-balances')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedSubTab === 'opening-balances'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <FileSpreadsheet className="size-3.5 text-emerald-400" />
            <span>Opening Balance Import</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedSubTab('lop-reversals')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedSubTab === 'lop-reversals'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <RotateCcw className="size-3.5 text-amber-400" />
            <span>LOP Reversals ({lopReversals.length})</span>
          </button>
        </div>

        {selectedSubTab === 'plans' && (
          <button
            type="button"
            onClick={() => {
              setEditingPlan({
                code: `LV-GRP-${Date.now().toString(36).slice(-4).toUpperCase()}`,
                name: '',
                frequency: 'MONTHLY',
                annualCasual: 6,
                annualSick: 6,
                annualEarned: 12,
                carryForwardLimit: 15,
                lapseUnusedCasual: true,
                lapseUnusedSick: true,
                enableEncashment: true,
                maxEncashmentDays: 10,
                minBalanceRetention: 15,
                isDefault: false,
                enableProRata: true,
                targetGrades: [],
                targetDepartments: [],
                targetLocationIds: [],
              })
              setDeptInput('')
              setGradeInput('')
              setPlanModalError(null)
              setIsPlanModalOpen(true)
            }}
            className="inline-flex items-center gap-1.5 text-xs h-8 px-3 rounded-lg border border-teal-300 text-teal-800 bg-teal-50 hover:bg-teal-100 font-semibold transition-all cursor-pointer shadow-2xs"
          >
            <Plus className="size-3.5" />
            Create Leave Plan
          </button>
        )}
      </div>

      {/* Sub-tab 1: Group Leave Plans */}
      {selectedSubTab === 'plans' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {plans.map((p) => {
              const totalAnnual = getPlanTotalAnnual(p)
              const monthlyRate = getPlanMonthlyCredit(p)
              const carryLimit = getPlanCarryLimit(p)
              const encashAllowed = getPlanEncashAllowed(p)
              const proRataAllowed = getPlanProRata(p)
              const depts = p.targetDepartments?.length ? p.targetDepartments.join(', ') : 'All Departments'
              const grades = p.targetGrades?.length ? p.targetGrades.join(', ') : 'All Levels / Grades'
              const locations = p.targetLocationIds?.length ? p.targetLocationIds.join(', ') : (p.targetLocations?.length ? p.targetLocations.join(', ') : 'All Locations')

              return (
                <div
                  key={p.id || p.code}
                  className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs hover:shadow-md transition-all relative overflow-hidden"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200/80">
                        {p.frequency || 'MONTHLY'} ACCRUAL
                      </span>
                      {p.isDefault && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                          Tenant Default
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm font-bold text-slate-900">{p.name}</h3>
                    <div className="text-[11px] font-mono text-slate-400 mt-0.5">{p.code}</div>

                    {/* Accrual rate stats */}
                    <div className="grid grid-cols-2 gap-2 mt-3 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">
                          Annual Total
                        </span>
                        <span className="font-bold text-teal-800 text-base">{totalAnnual} days</span>
                        <span className="text-[10px] text-slate-400 block mt-0.5 font-medium">
                          CL: {p.annualCasual ?? 6} · SL: {p.annualSick ?? 6} · EL: {p.annualEarned ?? 12}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">
                          Monthly Accrual
                        </span>
                        <span className="font-bold text-teal-800 text-base">+{monthlyRate} d/mo</span>
                        <span className="text-[10px] text-teal-600 block mt-0.5 font-medium">
                          {proRataAllowed ? 'Pro-rata joiners' : 'Standard flat'}
                        </span>
                      </div>
                    </div>

                    {/* Criteria badges */}
                    <div className="mt-3.5 space-y-1.5 text-xs text-slate-600">
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <span className="font-bold text-slate-500">Departments:</span>
                        <span className="truncate">{depts}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <span className="font-bold text-slate-500">Grades:</span>
                        <span className="truncate">{grades}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <span className="font-bold text-slate-500">Locations:</span>
                        <span className="truncate">{locations}</span>
                      </div>
                    </div>

                    {/* Policy rules summary */}
                    <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500 space-y-1">
                      <div>
                        • Carry-Forward Cap: <strong className="text-slate-800">{carryLimit} days</strong> (Excess lapses at year-end)
                      </div>
                      <div>
                        • Encashment: <strong className="text-slate-800">{encashAllowed ? `Allowed (retain ≥ ${p.minBalanceRetention ?? 15}d, max ${p.maxEncashmentDays ?? 10}d)` : 'Disabled'}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      {!p.isDefault && p.id && (
                        <button
                          type="button"
                          onClick={() => handleDeletePlan(p)}
                          className="size-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Delete this leave plan"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedRunPlanId(p.id || p.code)
                          setIsAccrualRunOpen(true)
                          setAccrualPreviewData(null)
                        }}
                        className="inline-flex items-center gap-1 h-7 text-xs px-2.5 rounded-lg border border-teal-600 bg-teal-600 hover:bg-teal-700 text-white font-semibold transition-all cursor-pointer shadow-2xs"
                        title="Execute monthly accrual for this package"
                      >
                        <Zap className="size-3" />
                        Run Package
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingPlan({
                            ...p,
                            annualCasual: p.annualCasual ?? 6,
                            annualSick: p.annualSick ?? 6,
                            annualEarned: p.annualEarned ?? 12,
                            carryForwardLimit: carryLimit,
                            enableEncashment: encashAllowed,
                            maxEncashmentDays: p.maxEncashmentDays ?? 10,
                            minBalanceRetention: p.minBalanceRetention ?? 15,
                            enableProRata: proRataAllowed,
                          })
                          setDeptInput(p.targetDepartments?.join(', ') || '')
                          setGradeInput(p.targetGrades?.join(', ') || '')
                          setPlanModalError(null)
                          setIsPlanModalOpen(true)
                        }}
                        className="inline-flex items-center gap-1.5 h-7 text-xs px-2.5 rounded-lg border border-teal-200 text-teal-800 bg-teal-50 hover:bg-teal-100 font-semibold transition-all cursor-pointer shadow-2xs"
                      >
                        <Edit2 className="size-3 text-teal-600" />
                        Edit Plan
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Sub-tab 2: Accrual Audit Ledger */}
      {selectedSubTab === 'ledger' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-200/80 bg-white shadow-2xs">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600">Employee:</span>
                <select
                  value={ledgerEmployeeFilter}
                  onChange={(e) => setLedgerEmployeeFilter(e.target.value)}
                  className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs bg-white focus:outline-none"
                >
                  <option value="">All Employees ({employees.length})</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.department || 'N/A'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600">Txn Type:</span>
                <select
                  value={ledgerTypeFilter}
                  onChange={(e) => setLedgerTypeFilter(e.target.value)}
                  className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs bg-white focus:outline-none"
                >
                  <option value="">All Transaction Types</option>
                  <option value="SCHEDULED_ACCRUAL">Scheduled Accrual</option>
                  <option value="PRORATA_JOINER_CREDIT">Prorata Joiner Credit</option>
                  <option value="OPENING_BALANCE">Opening Balance</option>
                  <option value="LEAVE_DEBIT">Leave Debit</option>
                  <option value="CARRY_FORWARD">Carry Forward</option>
                  <option value="LAPSE">Lapse (Expired)</option>
                  <option value="ENCASHMENT">Encashment</option>
                  <option value="MANUAL_ADJUSTMENT">Manual Adjustment</option>
                </select>
              </div>
            </div>

            <div className="text-xs text-slate-500 font-medium">
              Showing <strong>{filteredLedger.length}</strong> ledger audit entries
            </div>
          </div>

          {/* Ledger Table */}
          <div className="rounded-xl border border-slate-200/80 bg-white overflow-hidden shadow-2xs">
            <div className="max-h-[500px] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200 z-10 backdrop-blur-xs">
                  <tr>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Employee</th>
                    <th className="py-2.5 px-3">Leave Type</th>
                    <th className="py-2.5 px-3">Transaction</th>
                    <th className="py-2.5 px-3 text-right">Opening</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                    <th className="py-2.5 px-3 text-right">Closing</th>
                    <th className="py-2.5 px-3">Audit Details & Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLedger.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        No accrual ledger transactions found matching filters.
                      </td>
                    </tr>
                  ) : (
                    filteredLedger.map((entry) => {
                      const isCredit = entry.amount > 0
                      const typeStr = entry.transactionType || entry.type || 'SCHEDULED_ACCRUAL'
                      const isLapse = typeStr === 'LAPSE'
                      const isEncash = typeStr === 'ENCASHMENT'
                      const empName =
                        entry.employee?.firstName && entry.employee?.lastName
                          ? `${entry.employee.firstName} ${entry.employee.lastName}`
                          : (entry.employee?.name || employees.find((e) => e.id === entry.employeeId || (e as any).recordId === entry.employeeId)?.name || entry.employeeId)

                      const dateVal = entry.effectiveDate || entry.createdAt || new Date().toISOString()

                      return (
                        <tr key={entry.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap font-mono text-[11px]">
                            {new Date(dateVal).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-900">
                            {empName}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                              {entry.leaveType || 'ALL'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                                typeStr === 'SCHEDULED_ACCRUAL' || typeStr === 'PRORATA_JOINER_CREDIT'
                                  ? 'bg-teal-50 text-teal-800 border border-teal-200'
                                  : isLapse
                                  ? 'bg-rose-50 text-rose-800 border border-rose-200'
                                  : isEncash
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  : typeStr === 'OPENING_BALANCE'
                                  ? 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                                  : 'bg-blue-50 text-blue-800 border border-blue-200'
                              }`}
                            >
                              {typeStr}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-500 font-mono">
                            {entry.openingBalance}d
                          </td>
                          <td
                            className={`py-2.5 px-3 text-right font-bold font-mono ${
                              isCredit
                                ? 'text-teal-700'
                                : isLapse
                                ? 'text-rose-700'
                                : 'text-amber-700'
                            }`}
                          >
                            {isCredit ? `+${entry.amount}` : entry.amount}d
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900 font-mono">
                            {entry.closingBalance}d
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 max-w-sm">
                            <div className="truncate">{entry.description || entry.notes || '—'}</div>
                            {entry.batchId && (
                              <div className="text-[10px] text-slate-400 font-mono">
                                Batch: {entry.batchId}
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SubTab 3: Opening Balances Import */}
      {selectedSubTab === 'opening-balances' && (
        <div className="flex flex-col gap-5 p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
          {/* Header row */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="size-4.5 text-teal-600" />
                <h3 className="text-sm font-bold text-slate-900">Opening Leave Balance Manager</h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Directly input or bulk credit initial Casual (CL), Sick (SL), and Earned (EL) balances to the employee audit ledger.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Mode switch */}
              <div className="flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => setObMode('table')}
                  className={`px-3 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                    obMode === 'table' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Interactive Table ({obRows.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setObCsv(
                      `employeeCode,casualBalance,sickBalance,earnedBalance,notes\n${obRows
                        .map((r) => `${r.employeeCode},${r.casualBalance},${r.sickBalance},${r.earnedBalance},${r.notes}`)
                        .join('\n')}`
                    )
                    setObMode('csv')
                  }}
                  className={`px-3 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                    obMode === 'csv' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Raw CSV
                </button>
              </div>

              <button
                type="button"
                onClick={handlePopulateAllEmployees}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-teal-200 text-teal-800 bg-teal-50 hover:bg-teal-100 text-xs font-semibold transition-all cursor-pointer shadow-2xs"
              >
                <Users className="size-3.5 text-teal-600" />
                Populate All Employees ({employees.length})
              </button>

              {obMode === 'table' && (
                <button
                  type="button"
                  onClick={handleAddObRow}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                >
                  <Plus className="size-3.5" />
                  + Add Employee Row
                </button>
              )}
            </div>
          </div>

          {/* Table Mode */}
          {obMode === 'table' ? (
            <div className="space-y-4">
              {/* Presets and summary toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50/80 rounded-xl border border-slate-200/80 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-slate-600 text-[11px] uppercase tracking-wider">Quick Presets:</span>
                  <button
                    type="button"
                    onClick={() => handleApplyPresetToAll(6, 6, 12)}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold cursor-pointer shadow-2xs"
                  >
                    Standard (6 CL, 6 SL, 12 EL)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPresetToAll(6, 8, 16)}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold cursor-pointer shadow-2xs"
                  >
                    Engineering (6 CL, 8 SL, 16 EL)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPresetToAll(8, 10, 20)}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold cursor-pointer shadow-2xs"
                  >
                    Executive (8 CL, 10 SL, 20 EL)
                  </button>
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-600 font-medium">
                  <span>Rows: <strong className="text-slate-900">{obRows.length}</strong></span>
                  <span>•</span>
                  <span>Total Allocated: <strong className="text-teal-700 font-mono">{obRows.reduce((acc, r) => acc + (Number(r.casualBalance) || 0) + (Number(r.sickBalance) || 0) + (Number(r.earnedBalance) || 0), 0)} days</strong></span>
                  {obRows.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setObRows([])}
                      className="text-xs text-rose-600 hover:text-rose-800 font-semibold cursor-pointer ml-2"
                    >
                      Clear All
                    </button>
                  )}
                </div>
              </div>

              {/* Table grid */}
              <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-2xs">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 uppercase font-bold text-[10px] tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3 w-12 text-center">#</th>
                      <th className="py-2.5 px-3 min-w-[220px]">Employee</th>
                      <th className="py-2.5 px-3 w-28 text-center">Casual (CL)</th>
                      <th className="py-2.5 px-3 w-28 text-center">Sick (SL)</th>
                      <th className="py-2.5 px-3 w-28 text-center">Earned (EL)</th>
                      <th className="py-2.5 px-3 w-24 text-center">Total</th>
                      <th className="py-2.5 px-3 min-w-[200px]">Notes / Batch Tag</th>
                      <th className="py-2.5 px-3 w-16 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {obRows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400">
                          <p className="font-semibold text-slate-600 mb-1">No employee rows added yet</p>
                          <p className="text-xs text-slate-400 mb-3">Click "+ Add Employee Row" or "Populate All Employees" to begin.</p>
                          <button
                            type="button"
                            onClick={handleAddObRow}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-teal-300 bg-teal-50 text-teal-800 text-xs font-bold hover:bg-teal-100 cursor-pointer"
                          >
                            <Plus className="size-3.5" />
                            Add First Row
                          </button>
                        </td>
                      </tr>
                    ) : (
                      obRows.map((row, idx) => {
                        const rowTotal = (Number(row.casualBalance) || 0) + (Number(row.sickBalance) || 0) + (Number(row.earnedBalance) || 0)

                        return (
                          <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px]">
                              {idx + 1}
                            </td>
                            <td className="py-2 px-3">
                              <select
                                value={row.employeeCode}
                                onChange={(e) => handleUpdateObRow(row.id, 'employeeCode', e.target.value)}
                                className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs bg-white font-medium focus:ring-1 focus:ring-teal-500"
                              >
                                {employees.map((e) => {
                                  const code = (e as any).employeeId || e.id
                                  return (
                                    <option key={e.id} value={code}>
                                      {code} — {e.name} ({e.department || 'General'})
                                    </option>
                                  )
                                })}
                              </select>
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                step={0.5}
                                value={row.casualBalance}
                                onChange={(e) => handleUpdateObRow(row.id, 'casualBalance', parseFloat(e.target.value) || 0)}
                                className="w-full text-center rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-bold bg-white focus:ring-1 focus:ring-teal-500"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                step={0.5}
                                value={row.sickBalance}
                                onChange={(e) => handleUpdateObRow(row.id, 'sickBalance', parseFloat(e.target.value) || 0)}
                                className="w-full text-center rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-bold bg-white focus:ring-1 focus:ring-teal-500"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                step={0.5}
                                value={row.earnedBalance}
                                onChange={(e) => handleUpdateObRow(row.id, 'earnedBalance', parseFloat(e.target.value) || 0)}
                                className="w-full text-center rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-bold bg-white focus:ring-1 focus:ring-teal-500"
                              />
                            </td>
                            <td className="py-2 px-3 text-center">
                              <span className="font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-md font-mono text-[11px] border border-teal-200/80">
                                {rowTotal}d
                              </span>
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                value={row.notes}
                                onChange={(e) => handleUpdateObRow(row.id, 'notes', e.target.value)}
                                placeholder="e.g. FY2026 Opening Balance"
                                className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs bg-white focus:ring-1 focus:ring-teal-500"
                              />
                            </td>
                            <td className="py-2 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveObRow(row.id)}
                                className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors"
                                title="Remove row"
                              >
                                <Trash2 className="size-4" />
                              </button>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Add row bottom action button */}
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={handleAddObRow}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-700 hover:text-teal-900 bg-teal-50/80 hover:bg-teal-100 border border-teal-300 px-3 py-1.5 rounded-lg cursor-pointer transition-all shadow-2xs"
                >
                  <Plus className="size-3.5" />
                  + Add Employee Row
                </button>

                <Button
                  variant="default"
                  size="sm"
                  onClick={handleImportOpeningBalances}
                  disabled={isImportingOb || obRows.length === 0}
                  className="gap-2 bg-teal-600 hover:bg-teal-700 text-white font-bold h-9 px-4 text-xs shadow-xs cursor-pointer"
                >
                  {isImportingOb ? (
                    <>
                      <RefreshCw className="size-4 animate-spin" />
                      Importing Opening Balances...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="size-4" />
                      Import Opening Balances ({obRows.length} Rows)
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            /* CSV Mode */
            <div className="space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">CSV Input Data (Employee Code, CL, SL, EL, Notes):</label>
                  <span className="text-[11px] text-slate-400 font-mono">Format: code,cl,sl,el,notes</span>
                </div>
                <textarea
                  rows={8}
                  value={obCsv}
                  onChange={(e) => setObCsv(e.target.value)}
                  className="w-full font-mono text-xs p-3.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50/50"
                  placeholder="employeeCode,casualBalance,sickBalance,earnedBalance,notes"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-500">
                  Each line credits the ledger with transaction type <strong>OPENING_BALANCE</strong>.
                </span>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleImportOpeningBalances}
                  disabled={isImportingOb || !obCsv.trim()}
                  className="gap-2 bg-teal-600 hover:bg-teal-700 text-white font-bold h-9 px-4 text-xs shadow-xs cursor-pointer"
                >
                  {isImportingOb ? (
                    <>
                      <RefreshCw className="size-4 animate-spin" />
                      Importing Balances...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="size-4" />
                      Import Opening Balances (CSV)
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {obResult && (
            <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/70 space-y-2">
              <div className="font-bold text-xs text-emerald-900 flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-emerald-600" />
                Batch #{obResult.batchId} Import Completed
              </div>
              <p className="text-xs text-emerald-800">
                Successfully processed <strong>{obResult.successCount}</strong> employees (
                <strong>{obResult.createdTransactionsCount}</strong> ledger transactions created).
              </p>
              {obResult.errors?.length > 0 && (
                <div className="mt-2 text-xs text-rose-700 space-y-1">
                  <p className="font-bold">Errors encountered:</p>
                  {obResult.errors.map((err: any, idx: number) => (
                    <p key={idx}>
                      • Row {err.row} ({err.employeeCode}): {err.message}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* SubTab 4: Loss of Pay (LOP) Reversals */}
      {selectedSubTab === 'lop-reversals' && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white rounded-xl border border-slate-200">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Loss of Pay (LOP) Reversals</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                When employees submit leaves for past absent days and get approved post-payroll, automated LOP reversal refunds are generated here.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={lopFilter}
                onChange={(e) => setLopFilter(e.target.value)}
                className="h-8 px-3 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING_PAYROLL">Pending Payroll Refund</option>
                <option value="REFUNDED">Refunded in Cycle</option>
              </select>
              <Button variant="outline" size="sm" onClick={fetchLopReversals} className="h-8 text-xs gap-1 border-slate-200">
                <RefreshCw className={`size-3.5 ${isLoadingLop ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-white overflow-hidden shadow-2xs">
            <div className="max-h-[500px] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-100 text-slate-700 font-bold border-b border-slate-200 z-10">
                  <tr>
                    <th className="py-2.5 px-3">Created</th>
                    <th className="py-2.5 px-3">Employee</th>
                    <th className="py-2.5 px-3">Reversed Days</th>
                    <th className="py-2.5 px-3">Dates Affected</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Payroll Cycle</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lopReversals.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No LOP reversal adjustments found. When a retrospective leave covers absent days, adjustments appear here.
                      </td>
                    </tr>
                  ) : (
                    lopReversals.map((adj) => (
                      <tr key={adj.id} className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                          {new Date(adj.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-2.5 px-3">
                          <p className="font-bold text-slate-900">{adj.employeeName}</p>
                          <p className="text-[10px] text-slate-500">
                            {adj.employeeCode} · {adj.department}
                          </p>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-emerald-700">
                          +{adj.reversedDays} Day{adj.reversedDays !== 1 ? 's' : ''}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {adj.datesAffected?.map((dStr: string) => (
                              <span key={dStr} className="bg-slate-100 px-1.5 py-0.2 rounded text-[10px] font-mono">
                                {dStr}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                              adj.status === 'REFUNDED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {adj.status === 'REFUNDED' ? 'Refunded' : 'Pending Payroll Credit'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                          {adj.creditedInCycle ? `Cycle: ${adj.creditedInCycle}` : `Month: ${adj.payrollMonth}`}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {adj.status !== 'REFUNDED' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleMarkLopRefunded(adj.id)}
                              className="text-[11px] h-7 px-2.5 border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                            >
                              Settle / Refund
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Portaled Modals */}
      {mounted && typeof document !== 'undefined' && createPortal(
        <>
          {/* Modal 1: Run Accrual Now */}
          {isAccrualRunOpen && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="flex flex-col w-full max-w-3xl max-h-[88vh] rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100 text-teal-800">
                  <Zap className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Execute Leave Accrual Engine
                  </h3>
                  <p className="text-xs text-slate-500">
                    Apply monthly accrual packages, target by department, and calculate pro-rata joiner credits
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAccrualRunOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Controls */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 p-4 rounded-xl border border-slate-200 bg-slate-50/60">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Accrual As-Of Date
                  </label>
                  <input
                    type="date"
                    value={accrualDate}
                    onChange={(e) => setAccrualDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:ring-1 focus:ring-teal-500 bg-white"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Determines monthly cycle and joiner pro-rata math
                  </span>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Leave Plan Package to Apply
                  </label>
                  <select
                    value={selectedRunPlanId}
                    onChange={(e) => setSelectedRunPlanId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs bg-white focus:ring-1 focus:ring-teal-500 font-medium"
                  >
                    <option value="">⚡ Auto-Match by Profile (Dynamic Dept & Grade)</option>
                    {plans.map((p) => (
                      <option key={p.id || p.code} value={p.id || p.code}>
                        {p.name} ({p.code} · {getPlanTotalAnnual(p)}d/yr · +{getPlanMonthlyCredit(p)}d/mo)
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Enforces this package's credit rate or auto-matches by profile
                  </span>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Department Scope
                  </label>
                  <select
                    value={selectedRunDepartment}
                    onChange={(e) => setSelectedRunDepartment(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs bg-white focus:ring-1 focus:ring-teal-500"
                  >
                    <option value="">All Departments ({employees.length} employees)</option>
                    {distinctDepartments.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Target Employee Scope
                  </label>
                  <select
                    value={selectedEmployeeForRun}
                    onChange={(e) => setSelectedEmployeeForRun(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs bg-white focus:ring-1 focus:ring-teal-500"
                  >
                    <option value="">All Employees in Scope ({scopedRunEmployees.length})</option>
                    {scopedRunEmployees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name} ({e.designation || 'Staff'} · {e.department || 'General'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Package Details Banner */}
              {selectedRunPlan && (
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-teal-50 border border-teal-200 text-xs">
                  <div className="flex items-center gap-2.5">
                    <Sparkles className="size-4 text-teal-600 shrink-0" />
                    <div>
                      <span className="font-bold text-teal-950">Active Package: {selectedRunPlan.name}</span>
                      <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-teal-200/70 text-teal-900 border border-teal-300 ml-2">
                        {selectedRunPlan.code}
                      </span>
                      <div className="text-[11px] text-teal-800 mt-1 font-medium">
                        Annual Total: <strong>{getPlanTotalAnnual(selectedRunPlan)} days</strong> (+{getPlanMonthlyCredit(selectedRunPlan)} d/mo) · CL: {selectedRunPlan.annualCasual ?? 6}, SL: {selectedRunPlan.annualSick ?? 6}, EL: {selectedRunPlan.annualEarned ?? 12} · Carry Cap: {getPlanCarryLimit(selectedRunPlan)}d
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-teal-200/80 text-teal-950 shrink-0">
                    Package Override
                  </span>
                </div>
              )}

              <div className="flex justify-start">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleFetchAccrualPreview}
                  disabled={isLoadingPreview}
                  className="gap-2 border-teal-300 text-teal-800 bg-teal-50/50 hover:bg-teal-100 font-semibold text-xs h-8"
                >
                  <RefreshCw className={`size-3.5 ${isLoadingPreview ? 'animate-spin' : ''}`} />
                  {isLoadingPreview ? 'Calculating...' : 'Preview Accrual Calculations'}
                </Button>
              </div>

              {/* Preview Table */}
              {accrualPreviewData && (() => {
                const previewItems = accrualPreviewData.items || accrualPreviewData.evaluations || []
                const totalCredits = accrualPreviewData.stats?.totalCreditsApplied ?? previewItems.reduce((acc: number, i: any) => acc + (i.totalCredit ?? i.creditApplied ?? 0), 0)

                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-900 bg-teal-50/70 p-3 rounded-xl border border-teal-200">
                      <span>
                        Preview: {previewItems.length} employees evaluated
                      </span>
                      <span className="text-teal-800 font-bold">
                        Total Accrual Credits: +{totalCredits} days
                      </span>
                    </div>

                    <div className="rounded-xl border border-slate-200 overflow-hidden max-h-60 overflow-y-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0">
                          <tr>
                            <th className="py-2 px-3">Employee</th>
                            <th className="py-2 px-3">Department</th>
                            <th className="py-2 px-3">Applied Package</th>
                            <th className="py-2 px-3">Policy Note</th>
                            <th className="py-2 px-3 text-right">Current</th>
                            <th className="py-2 px-3 text-right">Accrual Credit</th>
                            <th className="py-2 px-3 text-right">New Balance</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {previewItems.map((ev: any, idx: number) => {
                            const empName = ev.name || ev.employeeName || 'Employee'
                            const planCode = ev.planCode || ev.matchedPlanCode || ev.planName || 'LV-DEF'
                            const note = ev.prorataNote || ev.prorationReason || 'Regular accrual'
                            const current = ev.openingBalance ?? 0
                            const credit = ev.totalCredit ?? ev.creditApplied ?? 0
                            const closing = ev.projectedClosingBalance ?? ev.closingBalance ?? (current + credit)

                            return (
                              <tr key={idx} className="hover:bg-slate-50/60">
                                <td className="py-2 px-3 font-semibold text-slate-900">
                                  {empName}
                                  {ev.employeeCode && (
                                    <span className="text-[10px] text-slate-400 font-mono block">
                                      {ev.employeeCode}
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-3 text-slate-600 text-[11px]">
                                  {ev.department || 'General'}
                                </td>
                                <td className="py-2 px-3 font-mono text-[11px]">
                                  <span className="px-1.5 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200 font-bold">
                                    {planCode}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-[11px] text-teal-800 font-medium">
                                  {note}
                                </td>
                                <td className="py-2 px-3 text-right text-slate-500 font-mono">
                                  {current}d
                                </td>
                                <td className="py-2 px-3 text-right font-bold text-teal-700 font-mono">
                                  +{credit}d
                                  {ev.casualCredit !== undefined && (
                                    <span className="text-[10px] text-slate-400 block font-normal">
                                      CL:{ev.casualCredit} SL:{ev.sickCredit} EL:{ev.earnedCredit}
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-3 text-right font-bold text-slate-900 font-mono">
                                  {closing}d
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })()}
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 px-6 py-3.5 bg-slate-50">
              <span className="text-xs text-slate-500">
                Balances and ledger entries will be instantly updated in MongoDB.
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAccrualRunOpen(false)}
                  disabled={isExecutingAccrual}
                  className="h-8 text-xs border-slate-200"
                >
                  Cancel
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleExecuteAccrual}
                  disabled={isExecutingAccrual}
                  className="bg-teal-600 hover:bg-teal-700 text-white gap-2 h-8 text-xs font-bold"
                >
                  {isExecutingAccrual ? (
                    <>
                      <RefreshCw className="size-3.5 animate-spin" />
                      Applying Accrual...
                    </>
                  ) : (
                    <>
                      <Zap className="size-3.5" />
                      Apply Accrual Now
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Year-End Carry-Forward & Lapse Job */}
      {isYearEndOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="flex flex-col w-full max-w-3xl max-h-[88vh] rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
                  <CalendarCheck className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Year-End Leave Reconciliation Job
                  </h3>
                  <p className="text-xs text-slate-500">
                    Applies carry-forward limits per plan package, lapses excess balances, and records audit entries
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsYearEndOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 p-4 rounded-xl border border-slate-200 bg-slate-50/60">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Reconciliation Year</label>
                  <input
                    type="number"
                    value={yearEndCycleYear}
                    onChange={(e) => setYearEndCycleYear(parseInt(e.target.value, 10) || 2026)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold bg-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Leave Plan Package</label>
                  <select
                    value={selectedYearEndPlanId}
                    onChange={(e) => setSelectedYearEndPlanId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs bg-white focus:ring-1 focus:ring-amber-500 font-medium"
                  >
                    <option value="">⚡ Auto-Match All Plans (Default)</option>
                    {plans.map((p) => (
                      <option key={p.id || p.code} value={p.id || p.code}>
                        {p.name} (Cap: {getPlanCarryLimit(p)}d · {p.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Department Filter</label>
                  <select
                    value={selectedYearEndDepartment}
                    onChange={(e) => setSelectedYearEndDepartment(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs bg-white focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="">All Departments</option>
                    {distinctDepartments.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedYearEndPlan && (
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                  <div>
                    Enforcing Policy: <strong>{selectedYearEndPlan.name}</strong> · Carry-Forward Cap: <strong>{getPlanCarryLimit(selectedYearEndPlan)} days</strong>. Unused balances exceeding this cap will be recorded as LAPSED in the ledger.
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-200 text-amber-950 font-mono shrink-0">
                    {selectedYearEndPlan.code}
                  </span>
                </div>
              )}

              <div className="flex justify-start">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleFetchYearEndPreview}
                  disabled={isLoadingYearEndPreview}
                  className="gap-2 border-amber-300 text-amber-900 bg-amber-50 hover:bg-amber-100 h-8 text-xs font-semibold"
                >
                  <RefreshCw className={`size-3.5 ${isLoadingYearEndPreview ? 'animate-spin' : ''}`} />
                  {isLoadingYearEndPreview ? 'Evaluating...' : 'Preview Carry & Lapse'}
                </Button>
              </div>

              {yearEndPreviewData && (() => {
                const yearEndItems = yearEndPreviewData.items || yearEndPreviewData.records || []
                const totalCarried = yearEndPreviewData.stats?.totalCarried ?? yearEndItems.reduce((acc: number, r: any) => acc + (r.carriedForward ?? r.carriedDays ?? 0), 0)
                const totalLapsed = yearEndPreviewData.stats?.totalLapsed ?? yearEndItems.reduce((acc: number, r: any) => acc + (r.lapsedAmount ?? r.lapsedDays ?? 0), 0)

                return (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-amber-700 block tracking-wider">
                          Total Days Carried Forward
                        </span>
                        <span className="text-lg font-bold text-amber-900">
                          {totalCarried} days
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-rose-700 block tracking-wider">
                          Total Excess Days Lapsed
                        </span>
                        <span className="text-lg font-bold text-rose-900">
                          {totalLapsed} days
                        </span>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 overflow-hidden max-h-56 overflow-y-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0">
                          <tr>
                            <th className="py-2 px-3">Employee</th>
                            <th className="py-2 px-3">Plan Package</th>
                            <th className="py-2 px-3 text-right">Balance</th>
                            <th className="py-2 px-3 text-right">Carry Cap</th>
                            <th className="py-2 px-3 text-right">Carried</th>
                            <th className="py-2 px-3 text-right">Lapsed</th>
                            <th className="py-2 px-3 text-right">Next Year Balance</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {yearEndItems.map((rec: any, idx: number) => {
                            const empName = rec.name || rec.employeeName || 'Staff'
                            const current = rec.currentBalance ?? rec.openingBalance ?? 0
                            const cap = rec.carryForwardLimit ?? rec.carryForwardCap ?? 15
                            const carried = rec.carriedForward ?? rec.carriedDays ?? Math.min(current, cap)
                            const lapsed = rec.lapsedAmount ?? rec.lapsedDays ?? Math.max(0, current - cap)
                            const nextBal = rec.newOpeningBalance ?? rec.newClosingBalance ?? carried
                            const planLabel = rec.planName || 'Standard'

                            return (
                              <tr key={idx} className="hover:bg-slate-50/60">
                                <td className="py-2 px-3 font-semibold text-slate-900">
                                  {empName}
                                  {rec.employeeCode && (
                                    <span className="text-[10px] text-slate-400 font-mono block">
                                      {rec.employeeCode} · {rec.department || 'General'}
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-3 text-[11px] text-slate-600 font-medium">
                                  {planLabel}
                                </td>
                                <td className="py-2 px-3 text-right font-mono">{current}d</td>
                                <td className="py-2 px-3 text-right font-mono text-slate-500">
                                  {cap}d
                                </td>
                                <td className="py-2 px-3 text-right font-bold text-teal-700 font-mono">
                                  {carried}d
                                </td>
                                <td className="py-2 px-3 text-right font-bold text-rose-700 font-mono">
                                  {lapsed > 0 ? `-${lapsed}d` : '0d'}
                                </td>
                                <td className="py-2 px-3 text-right font-bold text-slate-900 font-mono">
                                  {nextBal}d
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })()}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-6 py-3.5 bg-slate-50">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsYearEndOpen(false)}
                disabled={isExecutingYearEnd}
                className="h-8 text-xs border-slate-200"
              >
                Cancel
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleExecuteYearEnd}
                disabled={isExecutingYearEnd}
                className="bg-amber-600 hover:bg-amber-700 text-white gap-2 h-8 text-xs font-bold"
              >
                {isExecutingYearEnd ? 'Executing Reconciliation...' : 'Commit Year-End Reconciliation'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Encash Leaves Modal */}
      {isEncashmentOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="flex flex-col w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
                  <Banknote className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Encash Earned Leaves</h3>
                  <p className="text-xs text-slate-500">
                    Disburse monetary value for accumulated earned leave balance per plan policy
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEncashmentOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Select Employee</label>
                <select
                  value={encashEmployeeId}
                  onChange={(e) => setEncashEmployeeId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs bg-white focus:ring-1 focus:ring-teal-500"
                >
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} (Balance: {(e as any).totalLeaves || 0}d) · {e.department || 'General'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Leave Plan Policy Package</label>
                <select
                  value={encashPlanId}
                  onChange={(e) => setEncashPlanId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs bg-white focus:ring-1 focus:ring-emerald-500 font-medium"
                >
                  <option value="">⚡ Auto-Detect Plan ({resolvedEncashPlan?.name || 'Default'})</option>
                  {plans.map((p) => (
                    <option key={p.id || p.code} value={p.id || p.code}>
                      {p.name} ({p.code} · Max Encash: {p.maxEncashmentDays ?? 10}d · Retain: {p.minBalanceRetention ?? 15}d)
                    </option>
                  ))}
                </select>
              </div>

              {/* Policy Compliance Dashboard Card */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800">
                    Policy: {resolvedEncashPlan?.name || 'Standard Plan'}
                  </span>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                    {resolvedEncashPlan?.code || 'LV-STD'}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2 pt-1 text-center">
                  <div className="p-2 rounded-lg bg-white border border-slate-100">
                    <span className="text-[9px] uppercase font-bold text-slate-400 block">Current Bal</span>
                    <span className="text-xs font-bold text-slate-900 font-mono">{encashCurrentBal}d</span>
                  </div>
                  <div className="p-2 rounded-lg bg-white border border-slate-100">
                    <span className="text-[9px] uppercase font-bold text-slate-400 block">Must Retain</span>
                    <span className="text-xs font-bold text-slate-700 font-mono">{encashMinRetention}d</span>
                  </div>
                  <div className="p-2 rounded-lg bg-white border border-slate-100">
                    <span className="text-[9px] uppercase font-bold text-slate-400 block">Max Limit</span>
                    <span className="text-xs font-bold text-slate-700 font-mono">{encashMaxLimit}d</span>
                  </div>
                  <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200">
                    <span className="text-[9px] uppercase font-bold text-emerald-700 block">Eligible Now</span>
                    <span className="text-xs font-bold text-emerald-900 font-mono">{encashMaxEligible}d</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">Days to Encash</label>
                    <span className="text-[10px] text-slate-400">Max: {encashMaxEligible}d</span>
                  </div>
                  <input
                    type="number"
                    min={1}
                    max={Math.max(1, encashMaxEligible)}
                    value={encashDays}
                    onChange={(e) => setEncashDays(parseInt(e.target.value, 10) || 0)}
                    className={`w-full rounded-xl border px-3 py-2 text-xs font-bold ${
                      isEncashExceeded ? 'border-rose-400 ring-1 ring-rose-400 bg-rose-50/30' : 'border-slate-300'
                    }`}
                  />
                  {/* Preset Pills */}
                  <div className="flex items-center gap-1.5 mt-1.5">
                    {[1, 3, 5, encashMaxEligible].filter((v, i, a) => v > 0 && a.indexOf(v) === i).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setEncashDays(v)}
                        className={`text-[10px] px-2 py-0.5 rounded-md font-semibold cursor-pointer transition-colors ${
                          encashDays === v
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {v === encashMaxEligible ? `Max (${v}d)` : `${v}d`}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Rate per Day (₹)</label>
                  <input
                    type="number"
                    value={encashRate}
                    onChange={(e) => setEncashRate(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-mono"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Calculated from CTC or manual wage
                  </span>
                </div>
              </div>

              {isEncashExceeded && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
                  <AlertCircle className="size-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Exceeds Policy Limits:</strong> Requested {encashDays} days exceeds maximum allowable {encashMaxEligible} days under policy &ldquo;{resolvedEncashPlan?.name}&rdquo; (must retain {encashMinRetention}d balance, max {encashMaxLimit}d encashable per year).
                  </div>
                </div>
              )}

              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 font-medium flex items-center justify-between">
                <span>Estimated Payout Amount:</span>
                <strong className="text-base text-emerald-950 font-bold">
                  ₹{(encashDays * encashRate).toLocaleString()}
                </strong>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Reason / Approval Note
                </label>
                <input
                  type="text"
                  value={encashReason}
                  onChange={(e) => setEncashReason(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:ring-1 focus:ring-teal-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-3.5 bg-slate-50 border-t border-slate-200">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEncashmentOpen(false)}
                disabled={isSubmittingEncash}
                className="h-8 text-xs border-slate-200"
              >
                Cancel
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleEncashSubmit}
                disabled={isSubmittingEncash || encashDays <= 0 || isEncashExceeded}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 h-8 text-xs font-bold"
              >
                {isSubmittingEncash ? 'Processing...' : 'Approve & Encash'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Add / Edit Group Plan Modal */}
      {isPlanModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="flex flex-col w-full max-w-xl max-h-[90vh] rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-linear-to-r from-slate-50 via-white to-teal-50/30">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">
                    {editingPlan.id ? 'Edit Leave Accrual Plan' : 'Create New Leave Accrual Plan'}
                  </h3>
                  {editingPlan.code && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-teal-100 text-teal-800 border border-teal-200">
                      {editingPlan.code}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Define annual quotas, accrual schedule, carry-forward caps, and eligibility criteria
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPlanModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Inline Error Banner */}
              {planModalError && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800">
                  <AlertCircle className="size-4 shrink-0 text-rose-600" />
                  <span>{planModalError}</span>
                </div>
              )}

              {/* 1-Click Quick Presets for New Plans */}
              {!editingPlan.id && (
                <div className="p-3.5 rounded-xl bg-teal-50/60 border border-teal-200/80 space-y-2">
                  <span className="text-[11px] font-bold text-teal-900 block uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="size-3.5 text-teal-600" />
                    1-Click Quick Presets:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_PLAN_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => applyPreset(preset)}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white border border-teal-200 text-teal-800 hover:bg-teal-100 transition-colors shadow-2xs cursor-pointer"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Plan Code *</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      placeholder="e.g. LV-ENG-TECH"
                      value={editingPlan.code || ''}
                      onChange={(e) => setEditingPlan((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-mono font-bold uppercase"
                    />
                    {!editingPlan.id && (
                      <button
                        type="button"
                        onClick={() => setEditingPlan((prev) => ({ ...prev, code: `LV-GRP-${Date.now().toString(36).slice(-4).toUpperCase()}` }))}
                        className="px-2.5 py-2 rounded-xl border border-slate-200 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 shrink-0 cursor-pointer"
                        title="Auto-generate plan code"
                      >
                        Auto
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Plan Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Engineering & Technology Plan"
                    value={editingPlan.name || ''}
                    onChange={(e) => setEditingPlan((prev) => ({ ...prev, name: e.target.value }))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Accrual Frequency</label>
                <select
                  value={editingPlan.frequency || 'MONTHLY'}
                  onChange={(e) => setEditingPlan((prev) => ({ ...prev, frequency: e.target.value as any }))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs bg-white"
                >
                  <option value="MONTHLY">Monthly (12 periodic credits/year)</option>
                  <option value="QUARTERLY">Quarterly (4 periodic credits/year)</option>
                  <option value="YEARLY">Yearly (Lump-sum upfront credit)</option>
                </select>
              </div>

              {/* Leave Type Quota Breakdown */}
              <div className="p-3.5 rounded-xl border border-teal-200 bg-teal-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-teal-900">Annual Quota Allocation (Days)</span>
                  <span className="text-xs font-bold text-teal-800 font-mono">
                    Total: {Number(editingPlan.annualCasual || 0) + Number(editingPlan.annualSick || 0) + Number(editingPlan.annualEarned || 0)} days/yr
                    {' '}(~{((Number(editingPlan.annualCasual || 0) + Number(editingPlan.annualSick || 0) + Number(editingPlan.annualEarned || 0)) / 12).toFixed(1)} d/mo)
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">Casual (CL)</label>
                    <input
                      type="number"
                      min={0}
                      value={editingPlan.annualCasual ?? 6}
                      onChange={(e) => setEditingPlan((prev) => ({ ...prev, annualCasual: parseFloat(e.target.value) || 0 }))}
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs bg-white font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">Sick / Medical (SL)</label>
                    <input
                      type="number"
                      min={0}
                      value={editingPlan.annualSick ?? 6}
                      onChange={(e) => setEditingPlan((prev) => ({ ...prev, annualSick: parseFloat(e.target.value) || 0 }))}
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs bg-white font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">Earned / Privilege (EL)</label>
                    <input
                      type="number"
                      min={0}
                      value={editingPlan.annualEarned ?? 12}
                      onChange={(e) => setEditingPlan((prev) => ({ ...prev, annualEarned: parseFloat(e.target.value) || 0 }))}
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs bg-white font-bold"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Max Carry-Forward Cap</label>
                  <input
                    type="number"
                    min={0}
                    value={editingPlan.carryForwardLimit ?? 15}
                    onChange={(e) => setEditingPlan((prev) => ({ ...prev, carryForwardLimit: parseInt(e.target.value, 10) || 0 }))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Excess beyond cap lapses at year-end</span>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Min Retention for Encashment</label>
                  <input
                    type="number"
                    min={0}
                    value={editingPlan.minBalanceRetention ?? 15}
                    onChange={(e) => setEditingPlan((prev) => ({ ...prev, minBalanceRetention: parseInt(e.target.value, 10) || 0 }))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Must retain this balance before encashing</span>
                </div>
              </div>

              {/* Department Targeting */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Target Departments (Comma-separated, blank for all)
                  </label>
                  <span className="text-[10px] text-slate-400">Click tag to add</span>
                </div>
                <input
                  type="text"
                  placeholder="e.g. Engineering, Product, Sales"
                  value={deptInput}
                  onChange={(e) => setDeptInput(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                />
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {['Engineering', 'Product', 'Design', 'Sales', 'Marketing', 'HR', 'Operations', 'Finance'].map((dept) => (
                    <button
                      key={dept}
                      type="button"
                      onClick={() => {
                        const current = deptInput.split(',').map((s) => s.trim()).filter(Boolean)
                        if (!current.includes(dept)) {
                          setDeptInput([...current, dept].join(', '))
                        }
                      }}
                      className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium cursor-pointer"
                    >
                      +{dept}
                    </button>
                  ))}
                </div>
              </div>

              {/* Grades Targeting */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Target Grades / Designations (Comma-separated, blank for all)
                  </label>
                  <span className="text-[10px] text-slate-400">Click tag to add</span>
                </div>
                <input
                  type="text"
                  placeholder="e.g. Executive, Lead Engineer, VP"
                  value={gradeInput}
                  onChange={(e) => setGradeInput(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                />
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {['Executive', 'Director', 'Lead', 'Senior', 'Mid-Level', 'Junior', 'Intern'].map((grd) => (
                    <button
                      key={grd}
                      type="button"
                      onClick={() => {
                        const current = gradeInput.split(',').map((s) => s.trim()).filter(Boolean)
                        if (!current.includes(grd)) {
                          setGradeInput([...current, grd].join(', '))
                        }
                      }}
                      className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium cursor-pointer"
                    >
                      +{grd}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-slate-100">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingPlan.enableProRata ?? true}
                    onChange={(e) => setEditingPlan((prev) => ({ ...prev, enableProRata: e.target.checked }))}
                    className="rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
                  />
                  <span>Prorate for mid-month joiners</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingPlan.enableEncashment ?? true}
                    onChange={(e) => setEditingPlan((prev) => ({ ...prev, enableEncashment: e.target.checked }))}
                    className="rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
                  />
                  <span>Allow Leave Encashment</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingPlan.isDefault ?? false}
                    onChange={(e) => setEditingPlan((prev) => ({ ...prev, isDefault: e.target.checked }))}
                    className="rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
                  />
                  <span>Tenant Default Plan</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 px-6 py-3.5 bg-slate-50">
              <div>
                {editingPlan.id && !editingPlan.isDefault && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeletePlan(editingPlan as AccrualPlan)}
                    disabled={isDeletingPlan || isSavingPlan}
                    className="h-8 text-xs border-rose-200 text-rose-700 hover:bg-rose-50 font-semibold"
                  >
                    <Trash2 className="size-3.5 mr-1" />
                    {isDeletingPlan ? 'Deleting...' : 'Delete Plan'}
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsPlanModalOpen(false)}
                  disabled={isSavingPlan}
                  className="h-8 text-xs border-slate-200"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={handleSavePlan}
                  disabled={isSavingPlan}
                  className="bg-teal-600 hover:bg-teal-700 text-white h-8 text-xs font-bold shadow-xs min-w-[125px]"
                >
                  {isSavingPlan ? (
                    <>
                      <Spinner className="size-3.5 mr-1.5" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="size-3.5 mr-1.5" />
                      Save Leave Plan
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
        </>,
        document.body
      )}
    </div>
  )
}
