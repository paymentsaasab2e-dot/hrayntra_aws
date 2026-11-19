"use client"
import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PageHeroBanner, SectionCard, DataTable, Button, StatusBadge, EmptyState, MetricStatCard } from '@hryantra/ui'
import { useStore } from '@/store/StoreProvider'
import {
  UserPlus,
  Clock,
  Briefcase,
  Upload,
  Link2,
  Settings2,
  FileSpreadsheet,
  Plug,
  KeyRound,
  GraduationCap,
  Sparkles,
  Search,
  MapPin,
  Layers,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Coins,
  Building2,
  ExternalLink,
  Calculator,
  Globe,
  Check,
  Plus,
  SlidersHorizontal,
  Eye,
  Pencil,
  UserCheck
} from 'lucide-react'
import { api } from '@/shared/api'
import { OnboardingDrawer } from '@/modules/onboarding/components/OnboardingDrawer'
import { BulkImportModal } from '@/modules/onboarding/components/BulkImportModal'
import { GraduationConfirmModal } from '@/modules/onboarding/components/GraduationConfirmModal'
import { GraduationSuccessModal } from '@/modules/onboarding/components/GraduationSuccessModal'
import { CtcSimulatorModal } from '@/modules/onboarding/components/CtcSimulatorModal'
import { SalaryTemplateDetailDrawer } from '@/modules/onboarding/components/SalaryTemplateDetailDrawer'
import { PreboardingCandidateModal, type PreboardingCandidateData } from '@/modules/onboarding/components/PreboardingCandidateModal'
import { UpdatePreboardingModal } from '@/modules/onboarding/components/UpdatePreboardingModal'

const SOURCE_LABELS: Record<string, string> = {
  MANUAL: 'Manual',
  BULK_IMPORT: 'Bulk Import',
  EXTERNAL_ATS: 'External ATS',
}

function getInitials(name: string) {
  if (!name) return 'NH'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// Fallback template data if backend is starting
const DEFAULT_TEMPLATES = [
  {
    id: 'tpl_india_std',
    name: 'India — Standard CTC',
    country: 'India',
    flag: '🇮🇳',
    currencyCode: 'INR',
    anchorType: 'ANNUAL_CTC',
    isDefault: true,
    earningsSummary: 'Basic 40% · HRA 40% of Basic · Conveyance ₹1,600 · Special Allowance (Balancing)',
    statutorySummary: 'EPF 12% EE / 12% ER (capped ₹1,800) · TDS 10% (Est.) · Gratuity Accrual',
    autoMatchRule: 'Auto-applied when candidate country is India',
    components: [
      { code: 'BASIC', name: 'Basic Salary', section: 'EARNING', calcType: 'PERCENT_OF_ANCHOR', value: 40, order: 1 },
      { code: 'HRA', name: 'House Rent Allowance', section: 'EARNING', calcType: 'PERCENT_OF_COMPONENT', value: 40, baseRef: 'BASIC', order: 2 },
      { code: 'CONVEYANCE', name: 'Conveyance', section: 'EARNING', calcType: 'FIXED', value: 1600, order: 3 },
      { code: 'SPECIAL', name: 'Special Allowance', section: 'EARNING', calcType: 'BALANCE_OF_GROSS', value: 0, order: 4 },
      { code: 'PF_EE', name: 'Employee PF', section: 'DEDUCTION', calcType: 'PERCENT_OF_COMPONENT', value: 12, baseRef: 'BASIC', cap: 1800, order: 5 },
      { code: 'PF_ER', name: 'Employer PF', section: 'EMPLOYER_CONTRIBUTION', calcType: 'PERCENT_OF_COMPONENT', value: 12, baseRef: 'BASIC', cap: 1800, order: 6 },
      { code: 'TDS', name: 'TDS (estimated)', section: 'DEDUCTION', calcType: 'PERCENT_OF_GROSS', value: 10, order: 7 }
    ]
  },
  {
    id: 'tpl_uae_std',
    name: 'UAE — Standard Package',
    country: 'UAE',
    flag: '🇦🇪',
    currencyCode: 'AED',
    anchorType: 'ANNUAL_CTC',
    isDefault: true,
    earningsSummary: 'Basic 60% · Housing 25% of Basic · Other Allowance (Balancing)',
    statutorySummary: 'GPSSA 5% EE / 12.5% ER (GCC Nationals) · End of Service Gratuity',
    autoMatchRule: 'Auto-applied when candidate country is UAE',
    components: [
      { code: 'BASIC', name: 'Basic Salary', section: 'EARNING', calcType: 'PERCENT_OF_ANCHOR', value: 60, order: 1 },
      { code: 'HOUSING', name: 'Housing Allowance', section: 'EARNING', calcType: 'PERCENT_OF_COMPONENT', value: 25, baseRef: 'BASIC', order: 2 },
      { code: 'SPECIAL', name: 'Other Allowance', section: 'EARNING', calcType: 'BALANCE_OF_GROSS', value: 0, order: 3 },
      { code: 'GPSSA_EE', name: 'GPSSA Employee', section: 'DEDUCTION', calcType: 'PERCENT_OF_COMPONENT', value: 5, baseRef: 'BASIC', order: 4 },
      { code: 'GPSSA_ER', name: 'GPSSA Employer', section: 'EMPLOYER_CONTRIBUTION', calcType: 'PERCENT_OF_COMPONENT', value: 12.5, baseRef: 'BASIC', order: 5 }
    ]
  },
  {
    id: 'tpl_na_std',
    name: 'North America / US Standard',
    country: 'United States',
    flag: '🇺🇸',
    currencyCode: 'USD',
    anchorType: 'ANNUAL_CTC',
    isDefault: false,
    earningsSummary: 'Base Salary 85% · Healthcare & Dental 10% · 401(k) Match 5%',
    statutorySummary: 'Federal & State W-4 Withholding · FICA · 401(k) Matching',
    autoMatchRule: 'Auto-applied when candidate country is United States / Canada',
    components: [
      { code: 'BASIC', name: 'Base Salary', section: 'EARNING', calcType: 'PERCENT_OF_ANCHOR', value: 85, order: 1 },
      { code: 'HEALTH', name: 'Healthcare & Dental', section: 'EARNING', calcType: 'PERCENT_OF_ANCHOR', value: 10, order: 2 },
      { code: 'MATCH401K', name: '401(k) Employer Match', section: 'EMPLOYER_CONTRIBUTION', calcType: 'PERCENT_OF_ANCHOR', value: 5, order: 3 }
    ]
  },
  {
    id: 'tpl_global_contr',
    name: 'Global Remote Contractor',
    country: 'Global',
    flag: '🌐',
    currencyCode: 'USD',
    anchorType: 'ANNUAL_CTC',
    isDefault: false,
    earningsSummary: 'Direct Professional Fee 100% · Flat Monthly Net-15 Invoicing',
    statutorySummary: 'Zero Local Withholding (Self-filed via W-8BEN / W-9)',
    autoMatchRule: 'Applied for International remote contractors & freelancers',
    components: [
      { code: 'FEE', name: 'Gross Professional Fee', section: 'EARNING', calcType: 'PERCENT_OF_ANCHOR', value: 100, order: 1 }
    ]
  }
]

// Standard Ingestion Sources Matrix
const INTAKE_CHANNELS = [
  {
    id: 'manual',
    name: 'Manual Candidate Intake',
    type: 'Native HR Intake Form',
    icon: UserPlus,
    iconColor: 'text-indigo-600 bg-indigo-50 border-indigo-200/80',
    schema: 'Full Demographics, Role, Dept, Contact, Country, City, CTC',
    automation: 'Direct 1-Click Graduation into Users + Employee master roster',
    status: 'Active (Default)',
    actionLabel: 'Initiate Candidate',
    actionType: 'open_new',
  },
  {
    id: 'bulk_csv',
    name: 'Bulk CSV / Excel Batch Importer',
    type: 'Spreadsheet Batch Inflow',
    icon: FileSpreadsheet,
    iconColor: 'text-blue-600 bg-blue-50 border-blue-200/80',
    schema: 'name, email, role, department, country, city, CTC, joindate',
    automation: 'Bulk pipeline ingestion with automatic regional CTC matching',
    status: 'Batch File Ready',
    actionLabel: 'Launch CSV Importer',
    actionType: 'open_bulk',
  },
  {
    id: 'greenhouse',
    name: 'Greenhouse ATS Sync',
    type: 'REST Webhook Endpoint',
    icon: Plug,
    iconColor: 'text-emerald-600 bg-emerald-50 border-emerald-200/80',
    schema: 'candidate_hired webhook payload with offer package details',
    automation: 'Instant pipeline creation when recruiter marks candidate "Hired"',
    status: 'Webhook Ready',
    actionLabel: 'Configure Webhooks',
    actionType: 'settings',
  },
  {
    id: 'lever',
    name: 'Lever Candidate Sync',
    type: 'REST Webhook Endpoint',
    icon: Plug,
    iconColor: 'text-purple-600 bg-purple-50 border-purple-200/80',
    schema: 'candidate_stage_change webhook with mapped compensation',
    automation: 'Auto-sync hired candidates and auto-assign onboarding checklist',
    status: 'Webhook Ready',
    actionLabel: 'Configure Webhooks',
    actionType: 'settings',
  },
  {
    id: 'ashby',
    name: 'Ashby Recruiting API',
    type: 'Direct API Sync',
    icon: Globe,
    iconColor: 'text-cyan-600 bg-cyan-50 border-cyan-200/80',
    schema: 'Hired offer API payload with custom department & start date',
    automation: 'Two-way status sync: candidate graduation reported back to Ashby',
    status: 'API Ready',
    actionLabel: 'View API Specs',
    actionType: 'settings',
  },
  {
    id: 'workday',
    name: 'Workday Recruiter Connector',
    type: 'Enterprise Connector',
    icon: Building2,
    iconColor: 'text-amber-600 bg-amber-50 border-amber-200/80',
    schema: 'Enterprise XML / JSON Staffing Event stream',
    automation: 'Scheduled background roster synchronization & audit reconciliation',
    status: 'Enterprise Ready',
    actionLabel: 'Connector Settings',
    actionType: 'settings',
  }
]

export default function OnboardingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { currentUserRole, refreshEmployees, employees } = useStore()
  const [onboardingHires, setOnboardingHires] = React.useState<any[]>([])
  const [drawerOpen, setDrawerOpen] = React.useState(false)
  const [bulkOpen, setBulkOpen] = React.useState(false)
  const [addPreboardingOpen, setAddPreboardingOpen] = React.useState(false)
  const [selectedHire, setSelectedHire] = React.useState<any | null>(null)
  const [graduationConfirmHire, setGraduationConfirmHire] = React.useState<any | null>(null)
  const [graduationSuccessData, setGraduationSuccessData] = React.useState<any | null>(null)

  // View state & filters
  const [activeTab, setActiveTab] = React.useState<'pipelines' | 'preboarding' | 'templates' | 'sources'>('preboarding')
  const [searchQuery, setSearchQuery] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'in_progress' | 'graduated'>('all')
  const [feedback, setFeedback] = React.useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [editingCandidate, setEditingCandidate] = React.useState<PreboardingCandidateData | null>(null)

  // Auto-switch to tab if query parameter is provided (e.g. /onboarding?tab=preboarding)
  React.useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam === 'preboarding' || tabParam === 'templates' || tabParam === 'sources' || tabParam === 'pipelines') {
      setActiveTab(tabParam)
    }
  }, [searchParams])

  // Preboarding & ATS Discussions Pipeline (India Policies & Statutory BGV)
  const [preboardingList, setPreboardingList] = React.useState<PreboardingCandidateData[]>([
    {
      id: 'pre_01',
      name: 'Rohan Deshmukh',
      email: 'rohan.deshmukh@gmail.com',
      phone: '+91 98201 44521',
      role: 'Staff DevOps & Cloud Engineer',
      department: 'Engineering',
      source: 'Greenhouse ATS',
      atsCandidateId: 'GH-8942',
      stage: 'READY_TO_JOIN',
      stageLabel: 'Ready to Join · ₹26 LPA',
      offerPackage: '₹26,00,000 Annual CTC (26 LPA)',
      annualCtc: 2600000,
      country: 'India',
      city: 'Bengaluru',
      targetJoinDate: '2026-12-01',
      noticePeriodDays: 30,
      panAadhaarStatus: 'VERIFIED',
      panNumber: 'ABCDE1234F',
      relievingLetterStatus: 'VERIFIED',
      uanNumber: '100982341234',
      educationStatus: 'VERIFIED',
      bankDetailsStatus: 'VERIFIED',
      bgvStatus: 'VERIFIED',
      docsSubmitted: 4,
      docsTotal: 4,
      discussionNotes: 'Accepted formal offer letter. Relieving notice expires Nov 28. Hardware setup ready.',
    },
    {
      id: 'pre_02',
      name: 'Ananya Roy',
      email: 'ananya.roy@outlook.com',
      phone: '+91 99104 88219',
      role: 'Lead Product Designer',
      department: 'Product',
      source: 'Lever ATS Sync',
      atsCandidateId: 'LEV-502',
      stage: 'DOCS_COLLECTION',
      stageLabel: 'Docs In-Review · ₹21 LPA',
      offerPackage: '₹21,00,000 Annual CTC (21 LPA)',
      annualCtc: 2100000,
      country: 'India',
      city: 'Mumbai',
      targetJoinDate: '2026-12-10',
      noticePeriodDays: 30,
      panAadhaarStatus: 'VERIFIED',
      panNumber: 'BNMKL9876Q',
      relievingLetterStatus: 'IN_PROGRESS',
      uanNumber: '101238992111',
      educationStatus: 'VERIFIED',
      bankDetailsStatus: 'IN_PROGRESS',
      bgvStatus: 'IN_PROGRESS',
      docsSubmitted: 2,
      docsTotal: 4,
      discussionNotes: 'CTC negotiation completed at ₹21L. Pending verification of previous payslips and cancelled cheque.',
    },
    {
      id: 'pre_03',
      name: 'Pooja Kulkarni',
      email: 'pooja.kulkarni@techcorp.in',
      phone: '+91 98451 99012',
      role: 'Senior QA Automation Engineer',
      department: 'Engineering',
      source: 'Ashby Recruiting API',
      atsCandidateId: 'ASH-309',
      stage: 'OFFER_ACCEPTED',
      stageLabel: 'Offer Accepted · 30d Notice',
      offerPackage: '₹18,50,000 Annual CTC (18.5 LPA)',
      annualCtc: 1850000,
      country: 'India',
      city: 'Pune',
      targetJoinDate: '2026-12-05',
      noticePeriodDays: 30,
      panAadhaarStatus: 'VERIFIED',
      panNumber: 'PLKJH6543M',
      relievingLetterStatus: 'IN_PROGRESS',
      uanNumber: '100456123789',
      educationStatus: 'VERIFIED',
      bankDetailsStatus: 'VERIFIED',
      bgvStatus: 'IN_PROGRESS',
      docsSubmitted: 3,
      docsTotal: 4,
      discussionNotes: 'Offer accepted. Serving 30-day notice. Relieving letter to be submitted on last working day.',
    },
    {
      id: 'pre_04',
      name: 'Vikramaditya Rao',
      email: 'vikram.rao@enterprise.com',
      phone: '+91 98110 33445',
      role: 'Director of Enterprise Sales',
      department: 'Sales',
      source: 'Internal Referral',
      atsCandidateId: 'REF-204',
      stage: 'OFFER_RELEASED',
      stageLabel: 'Offer Letter Released · ₹35 LPA',
      offerPackage: '₹35,00,000 Annual CTC (35 LPA)',
      annualCtc: 3500000,
      country: 'India',
      city: 'Gurugram',
      targetJoinDate: '2026-12-20',
      noticePeriodDays: 60,
      panAadhaarStatus: 'VERIFIED',
      panNumber: 'ZXCVB9012R',
      relievingLetterStatus: 'NOT_INITIATED',
      uanNumber: '100889977665',
      educationStatus: 'VERIFIED',
      bankDetailsStatus: 'NOT_INITIATED',
      bgvStatus: 'IN_PROGRESS',
      docsSubmitted: 2,
      docsTotal: 4,
      discussionNotes: 'Offer letter dispatched via Greenhouse. Awaiting counter-signature and notice buy-out confirmation.',
    },
  ])
  const [promotingId, setPromotingId] = React.useState<string | null>(null)

  // Live salary profiles from backend
  const [salaryProfiles, setSalaryProfiles] = React.useState<any[]>([])
  const [simulatingProfile, setSimulatingProfile] = React.useState<any | null>(null)
  const [inspectingTemplate, setInspectingTemplate] = React.useState<any | null>(null)

  const loadOnboarding = React.useCallback(async () => {
    try {
      const res = await api.onboarding.getAll()
      const data = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []
      setOnboardingHires(data)
    } catch (error) {
      console.error(error)
      setOnboardingHires([])
    }
  }, [])

  const loadProfiles = React.useCallback(async () => {
    try {
      const res = await api.compensation.listProfiles()
      const data = Array.isArray(res?.data) ? res.data : []
      if (data.length > 0) {
        setSalaryProfiles(data)
      } else {
        setSalaryProfiles(DEFAULT_TEMPLATES)
      }
    } catch {
      setSalaryProfiles(DEFAULT_TEMPLATES)
    }
  }, [])

  React.useEffect(() => {
    loadOnboarding()
    loadProfiles()
  }, [loadOnboarding, loadProfiles])

  const handleSaved = async () => {
    await loadOnboarding()
    await refreshEmployees()
  }

  const handlePromoteCandidate = async (candidate: PreboardingCandidateData) => {
    setPromotingId(candidate.id || '')
    try {
      await api.onboarding.create({
        name: candidate.name,
        email: candidate.email,
        phone: candidate.phone,
        role: candidate.role,
        department: candidate.department,
        country: candidate.country || 'India',
        city: candidate.city || 'Bengaluru',
        joinDate: candidate.targetJoinDate,
        source: 'PREBOARDING',
        compensation: {
          anchorValue: candidate.annualCtc,
        },
      })
      setPreboardingList((prev) => prev.filter((c) => c.id !== candidate.id))
      await loadOnboarding()
      setFeedback({
        type: 'success',
        message: `${candidate.name} promoted to active Day-1 Onboarding with agreed CTC of ₹${(candidate.annualCtc / 100000).toFixed(1)} LPA!`,
      })
      setActiveTab('pipelines')
    } catch (err: any) {
      console.error('Failed to promote candidate:', err)
      setFeedback({ type: 'error', message: err.message || 'Failed to promote candidate' })
    } finally {
      setPromotingId(null)
    }
  }

  const handleAddPreboardingCandidate = (candidate: PreboardingCandidateData) => {
    setPreboardingList((prev) => [candidate, ...prev])
    setFeedback({
      type: 'success',
      message: `${candidate.name} added to Preboarding Track with verified statutory checks!`,
    })
    setActiveTab('preboarding')
  }

  const handleCopyUploadLink = (candidate: PreboardingCandidateData) => {
    if (typeof window !== 'undefined') {
      const url = `${window.location.origin}/portal/preboard/${candidate.id || 'candidate'}`
      navigator.clipboard?.writeText(url)
      setFeedback({
        type: 'success',
        message: `Candidate self-service document upload link copied for ${candidate.name}!`,
      })
    }
  }

  const handleSaveUpdatedCandidate = (updated: PreboardingCandidateData) => {
    const docStatuses = [
      updated.panAadhaarStatus,
      updated.relievingLetterStatus,
      updated.educationStatus,
      updated.bankDetailsStatus,
    ]
    const docsSubmitted = docStatuses.filter((s) => s === 'VERIFIED').length
    const merged = { ...updated, docsSubmitted }

    setPreboardingList((prev) => prev.map((c) => (c.id === merged.id ? merged : c)))
    setEditingCandidate(null)
    setFeedback({
      type: 'success',
      message: `Statutory verification & BGV updated for ${merged.name}!`,
    })
  }

  const openNew = () => {
    setSelectedHire(null)
    setDrawerOpen(true)
  }

  const goCreateLogin = React.useCallback(
    (employeeRecordId: string) => {
      router.push(`/users?create=1&linkEmployee=${encodeURIComponent(employeeRecordId)}`)
    },
    [router]
  )

  const resolveEmployeeCode = React.useCallback(
    (employeeRecordId: string) => {
      const emp = employees.find((e) => e.recordId === employeeRecordId)
      return emp?.id || null
    },
    [employees]
  )

  const needsLogin = React.useCallback(
    (employeeRecordId: string) => {
      const emp = employees.find((e) => e.recordId === employeeRecordId)
      return emp ? !emp.hasLogin : true
    },
    [employees]
  )

  const dateEyebrow = React.useMemo(
    () =>
      new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }).toUpperCase(),
    []
  )

  if (currentUserRole !== 'HR' && currentUserRole !== 'Superadmin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-6">
        <Briefcase className="size-16 text-slate-300 mb-4" />
        <h3 className="text-lg font-bold text-slate-900">Onboarding Restricted</h3>
        <p className="text-sm text-slate-500 max-w-md mt-1">The onboarding management module is only accessible to HR and Administrators.</p>
      </div>
    )
  }

  const handleConfirmGraduation = async (options: {
    createLogin: boolean
    password: string
    role: string
    sendWelcomeEmail: boolean
  }) => {
    if (!graduationConfirmHire?.id) return
    const res = await api.onboarding.complete(graduationConfirmHire.id, options)
    await loadOnboarding()
    await refreshEmployees()
    setGraduationConfirmHire(null)
    setGraduationSuccessData(res?.graduation || res)
  }

  const inProgressCount = onboardingHires.filter(h => (h.status || '').toLowerCase().includes('progress')).length
  const completedCount = onboardingHires.filter(h => (h.status || '').toLowerCase() === 'completed' || (h.employeeId && h.userId)).length
  const readyCount = onboardingHires.filter(h => h.progress === 100 && !(h.status === 'Completed' || (h.employeeId && h.userId))).length

  // Filtered dataset for pipelines
  const filteredHires = React.useMemo(() => {
    return onboardingHires.filter((hire) => {
      const matchesSearch =
        searchQuery === '' ||
        (hire.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (hire.role || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (hire.department || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (hire.email || '').toLowerCase().includes(searchQuery.toLowerCase())

      if (!matchesSearch) return false

      const isGraduated = hire.status === 'Completed' || (hire.employeeId && hire.userId)
      if (statusFilter === 'in_progress') return !isGraduated
      if (statusFilter === 'graduated') return isGraduated
      return true
    })
  }, [onboardingHires, searchQuery, statusFilter])

  // Filtered salary profiles
  const displayProfiles = React.useMemo(() => {
    const list = salaryProfiles.length > 0 ? salaryProfiles : DEFAULT_TEMPLATES
    return list.map(p => {
      const def = DEFAULT_TEMPLATES.find(d => d.country === p.country || d.name === p.name)
      return {
        ...def,
        ...p,
        flag: def?.flag || (p.country === 'India' ? '🇮🇳' : p.country === 'UAE' ? '🇦🇪' : '🌐'),
        earningsSummary: def?.earningsSummary || 'Basic 40% · HRA 40% · Conveyance ₹1,600 · Special Allowance',
        statutorySummary: def?.statutorySummary || 'Statutory EPF / GPSSA & Withholding Deductions',
        autoMatchRule: def?.autoMatchRule || `Auto-applied when candidate country is ${p.country}`,
      }
    })
  }, [salaryProfiles])

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 px-4 py-4 md:px-6 md:py-5 pb-12">
      {/* Executive Action Header (No redundant title) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-slate-200/80">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <span className="size-2 rounded-full bg-emerald-500" />
          <span>Unified Onboarding & Preboarding Engine · India Statutory Compliance</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setActiveTab('templates')}
            className={`text-xs h-8 border-slate-200 transition-colors ${activeTab === 'templates'
              ? 'bg-slate-100 text-slate-900 font-bold border-slate-300'
              : 'text-slate-700 hover:text-slate-900 bg-white'
              }`}
          >
            <Settings2 className="size-3.5 mr-1 text-slate-500" />
            Salary Templates
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAddPreboardingOpen(true)}
            className="text-xs h-8 text-cyan-800 bg-cyan-50/80 border-cyan-200 hover:bg-cyan-100 font-semibold"
          >
            <Plus className="size-3.5 mr-1 text-cyan-600" />
            Add to Preboarding
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setBulkOpen(true)}
            className="text-xs h-8 text-slate-700 hover:text-slate-900 border-slate-200"
          >
            <Upload className="size-3.5 mr-1 text-indigo-600" />
            Bulk Import CSV
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={openNew}
            className="text-xs h-8 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-xs"
          >
            <UserPlus className="size-3.5 mr-1" />
            Initiate Onboarding
          </Button>
        </div>
      </div>

      {/* Toast Feedback Notification */}
      {feedback && (
        <div
          className={`flex items-center justify-between p-3 rounded-xl border text-xs font-medium animate-in fade-in duration-150 ${feedback.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
        >
          <div className="flex items-center gap-2">
            <span
              className={`size-2 rounded-full ${feedback.type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'
                }`}
            />
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-700 text-xs px-1.5 py-0.5"
          >
            ✕
          </button>
        </div>
      )}

      {/* Modern High-Density KPI Ribbon */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <MetricStatCard
          label="Day-1 Pipelines"
          value={onboardingHires.length}
          subtitle="Active checklist hires"
          tone="blue"
          icon={UserPlus}
          active={statusFilter === 'all' && activeTab === 'pipelines'}
          onClick={() => { setActiveTab('pipelines'); setStatusFilter('all') }}
        />
        <MetricStatCard
          label="Preboarding (ATS)"
          value={preboardingList.length}
          subtitle="Offer & Notice track"
          tone="indigo"
          icon={Sparkles}
          active={activeTab === 'preboarding'}
          onClick={() => setActiveTab('preboarding')}
        />
        <MetricStatCard
          label="Statutory & BGV Cleared"
          value={preboardingList.filter(c => c.bgvStatus === 'VERIFIED').length}
          subtitle="Ready for Day-1 conversion"
          tone="mint"
          icon={ShieldCheck}
          active={activeTab === 'preboarding'}
          onClick={() => setActiveTab('preboarding')}
        />
        <MetricStatCard
          label="Graduated Workforce"
          value={completedCount}
          subtitle="Active roster accounts"
          tone="indigo"
          icon={GraduationCap}
          active={statusFilter === 'graduated' && activeTab === 'pipelines'}
          onClick={() => { setActiveTab('pipelines'); setStatusFilter('graduated') }}
        />
      </div>

      {/* Segmented Workspace Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/90 pb-2.5">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-xl border border-slate-200/80 text-xs font-semibold w-fit shadow-2xs">
          <button
            onClick={() => setActiveTab('pipelines')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-all ${activeTab === 'pipelines'
              ? 'bg-white text-slate-900 shadow-xs font-bold border border-slate-200/70'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
          >
            <Layers className="size-3.5 text-indigo-600" />
            <span>Active Pipelines</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-50 text-indigo-700 font-bold border border-indigo-200/70 font-mono">
              {onboardingHires.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('preboarding')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-all ${activeTab === 'preboarding'
              ? 'bg-white text-slate-900 shadow-xs font-bold border border-slate-200/70'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
          >
            <Sparkles className="size-3.5 text-cyan-600" />
            <span>Preboarding & ATS Track</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-cyan-50 text-cyan-700 font-bold border border-cyan-200/70 font-mono">
              {preboardingList.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-all ${activeTab === 'templates'
              ? 'bg-white text-slate-900 shadow-xs font-bold border border-slate-200/70'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
          >
            <Coins className="size-3.5 text-amber-600" />
            <span>Salary & CTC Templates</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-50 text-amber-700 font-bold border border-amber-200/70 font-mono">
              {displayProfiles.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('sources')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-all ${activeTab === 'sources'
              ? 'bg-white text-slate-900 shadow-xs font-bold border border-slate-200/70'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
          >
            <Plug className="size-3.5 text-emerald-600" />
            <span>Sources & ATS Integrations</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-50 text-emerald-700 font-bold border border-emerald-200/70 font-mono">
              {INTAKE_CHANNELS.length}
            </span>
          </button>
        </div>

        {activeTab === 'pipelines' && (
          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by name, role..."
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="flex items-center gap-1 bg-slate-100/70 p-0.5 rounded-lg border border-slate-200/60 text-[11px] font-semibold text-slate-600">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-2 py-1 rounded-md transition-all ${statusFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'}`}
              >
                All
              </button>
              <button
                onClick={() => setStatusFilter('in_progress')}
                className={`px-2 py-1 rounded-md transition-all ${statusFilter === 'in_progress' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'}`}
              >
                Active
              </button>
              <button
                onClick={() => setStatusFilter('graduated')}
                className={`px-2 py-1 rounded-md transition-all ${statusFilter === 'graduated' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'}`}
              >
                Graduated
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── TAB 1: ACTIVE CANDIDATE PIPELINES (TABULAR) ── */}
      {activeTab === 'pipelines' && (
        <SectionCard noPadding className="w-full overflow-hidden">
          {filteredHires.length === 0 ? (
            <EmptyState
              size="md"
              icon={<UserPlus className="size-8 text-slate-400" />}
              title={onboardingHires.length === 0 ? "No onboarding pipelines yet" : "No matching candidates"}
              description={
                onboardingHires.length === 0
                  ? "Start by adding a single candidate or importing a CSV roster. CTC and salary breakdowns will automatically resolve via your regional templates."
                  : "Try adjusting your search query or status filter to see other candidate records."
              }
              action={
                onboardingHires.length === 0 ? (
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <Button variant="default" size="sm" onClick={openNew}>
                      <UserPlus className="size-4 mr-1.5" /> Initiate Onboarding
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setBulkOpen(true)}>
                      <Upload className="size-4 mr-1.5" /> Bulk Import CSV
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => { setSearchQuery(''); setStatusFilter('all') }}>
                    Clear Filters
                  </Button>
                )
              }
              className="py-12 md:py-16"
            />
          ) : (
            <div className="w-full overflow-x-auto">
              <DataTable
                className="w-full min-w-full"
                data={filteredHires}
                columns={[
                  {
                    id: 'select',
                    header: (
                      <input
                        type="checkbox"
                        aria-label="Select all candidates"
                        className="size-4 rounded border-slate-300 text-indigo-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                      />
                    ),
                    className: 'w-10 pr-0',
                    headerClassName: 'w-10 pr-0',
                    cell: () => (
                      <input
                        type="checkbox"
                        aria-label="Select candidate"
                        className="size-4 rounded border-slate-300 text-indigo-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                      />
                    ),
                  },
                  {
                    id: 'candidate',
                    header: 'Candidate',
                    cell: ({ row }) => (
                      <div className="flex items-center gap-2.5">
                        <div className="size-7 rounded-full bg-indigo-50 border border-indigo-200/70 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0">
                          {getInitials(row.name)}
                        </div>
                        <span className="text-[13px] font-semibold text-slate-800 leading-tight truncate">
                          {row.name}
                        </span>
                      </div>
                    ),
                  },
                  {
                    id: 'role',
                    header: 'Role',
                    cell: ({ row }) => (
                      <span className="text-[13px] text-slate-700 font-medium truncate">
                        {row.role}
                      </span>
                    ),
                  },
                  {
                    id: 'department',
                    header: 'Department',
                    cell: ({ row }) => (
                      <span className="text-[13px] text-slate-600 font-normal">
                        {row.department || '—'}
                      </span>
                    ),
                  },
                  {
                    id: 'status',
                    header: 'Status',
                    cell: ({ row }) => {
                      const isGraduated = row.status === 'Completed' || (row.employeeId && row.userId)
                      if (isGraduated) {
                        return (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60 whitespace-nowrap">
                            <Sparkles className="size-3 text-indigo-600" /> Graduated
                          </span>
                        )
                      }
                      return (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 whitespace-nowrap">
                          <span className="size-1.5 rounded-full bg-emerald-500" /> Active
                        </span>
                      )
                    },
                  },
                  {
                    id: 'location',
                    header: 'Location',
                    cell: ({ row }) => (
                      <span className="text-[13px] text-slate-600 font-normal whitespace-nowrap">
                        {[row.city, row.country].filter(Boolean).join(', ') || '—'}
                      </span>
                    ),
                  },
                  {
                    id: 'joinDate',
                    header: 'Join Date',
                    cell: ({ row }) => (
                      <span className="text-[13px] text-slate-600 font-normal whitespace-nowrap" suppressHydrationWarning>
                        {row.joinDate || '—'}
                      </span>
                    ),
                  },
                  {
                    id: 'progress',
                    header: 'Progress',
                    cell: ({ row }) => (
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/40">
                          <div
                            className={`h-full transition-all duration-300 ${row.progress === 100 ? 'bg-emerald-500' : 'bg-indigo-600'
                              }`}
                            style={{ width: `${row.progress || 0}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-slate-600 font-mono w-7 text-right">
                          {row.progress || 0}%
                        </span>
                      </div>
                    ),
                  },
                  {
                    id: 'actions',
                    header: 'Actions',
                    headerClassName: 'text-right',
                    cell: ({ row }) => {
                      const isGraduated = row.status === 'Completed' || (row.employeeId && row.userId)
                      return (
                        <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                          {!isGraduated && (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => setGraduationConfirmHire(row)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-7 px-2.5 rounded-lg shadow-2xs"
                            >
                              <GraduationCap className="size-3.5 mr-1" /> 1-Click Graduate
                            </Button>
                          )}
                          {row.employeeId && needsLogin(row.employeeId) && !isGraduated && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => goCreateLogin(row.employeeId)}
                              className="text-xs h-7 px-2 border-amber-300 bg-amber-50/50 text-amber-800 hover:bg-amber-100 rounded-lg"
                            >
                              <KeyRound className="size-3 mr-1 text-amber-600" /> Create Login
                            </Button>
                          )}
                          {row.employeeId && resolveEmployeeCode(row.employeeId) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const code = resolveEmployeeCode(row.employeeId)
                                if (code) router.push(`/employees/${code}`)
                              }}
                              className="text-xs h-7 px-2 text-slate-700 border-slate-200 hover:bg-slate-50 rounded-lg"
                            >
                              <Link2 className="size-3 mr-1 text-emerald-600" />
                              {resolveEmployeeCode(row.employeeId)}
                            </Button>
                          )}
                          <button
                            onClick={() => {
                              setSelectedHire(row)
                              setDrawerOpen(true)
                            }}
                            className="size-8 rounded-lg flex items-center justify-center text-amber-600 hover:bg-amber-50 border border-amber-200/50 hover:border-amber-300 transition-colors shadow-2xs"
                            title="Manage Checklist & Documents"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                        </div>
                      )
                    },
                  },
                ]}
                keyExtractor={(r) => r.id || r.email || ''}
              />
            </div>
          )}
        </SectionCard>
      )}

      {/* ── TAB 2: CANDIDATE PREBOARDING & ATS DISCUSSIONS ── */}
      {activeTab === 'preboarding' && (
        <SectionCard noPadding className="w-full overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-b border-slate-100 bg-slate-50/60">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">Candidate Preboarding & ATS Discussion Track</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-50 text-cyan-700 border border-cyan-200">
                  {preboardingList.length} Active in ATS Track
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Review candidates undergoing offer discussions, compensation negotiation, and statutory document collection prior to active workspace onboarding.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={() => setAddPreboardingOpen(true)}
                className="text-xs h-8 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold shadow-2xs rounded-lg"
              >
                <Plus className="size-3.5 mr-1" />
                Add Candidate
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveTab('sources')}
                className="text-xs h-8 text-slate-700 border-slate-200 hover:bg-slate-100"
              >
                <Plug className="size-3.5 mr-1.5 text-slate-500" />
                ATS Endpoints
              </Button>
            </div>
          </div>

          {preboardingList.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-500">
              <Sparkles className="size-8 mx-auto text-cyan-400 mb-2" />
              <p className="font-semibold text-slate-800">All preboarding candidates have been promoted to active pipelines</p>
              <p className="text-slate-400 mt-0.5">Sync new candidates from Greenhouse, Lever, Ashby, or add via manual intake.</p>
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <DataTable
                className="w-full min-w-full"
                data={preboardingList}
                columns={[
                  {
                    id: 'select',
                    header: (
                      <input
                        type="checkbox"
                        aria-label="Select all candidates"
                        className="size-4 rounded border-slate-300 text-indigo-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                      />
                    ),
                    className: 'w-10 pr-0',
                    headerClassName: 'w-10 pr-0',
                    cell: () => (
                      <input
                        type="checkbox"
                        aria-label="Select candidate"
                        className="size-4 rounded border-slate-300 text-indigo-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                      />
                    ),
                  },
                  {
                    id: 'candidate',
                    header: 'Candidate',
                    cell: ({ row }) => (
                      <div className="flex items-center gap-2.5">
                        <div className="size-8 rounded-full bg-gradient-to-tr from-cyan-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                          {getInitials(row.name)}
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-slate-900 block truncate">
                            {row.name}
                          </span>
                          <span className="text-[11px] text-slate-500 block truncate font-medium">
                            {row.email} · {row.phone}
                          </span>
                        </div>
                      </div>
                    ),
                  },
                  {
                    id: 'role',
                    header: 'Target Role & ATS Channel',
                    cell: ({ row }) => (
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-bold text-slate-800 block truncate">
                          {row.role}
                        </span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] text-slate-500 font-medium">
                            {row.department} · {row.city}
                          </span>
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            {row.atsCandidateId || 'ATS-LINK'}
                          </span>
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-cyan-50 text-cyan-700 border border-cyan-200">
                            {row.source}
                          </span>
                        </div>
                      </div>
                    ),
                  },
                  {
                    id: 'stage',
                    header: 'Discussion Stage & Agreed Package',
                    cell: ({ row }) => {
                      const isReady = row.stage === 'READY_TO_JOIN'
                      const isOfferAccepted = row.stage === 'OFFER_ACCEPTED'
                      const isOfferReleased = row.stage === 'OFFER_RELEASED'
                      const isDocs = row.stage === 'DOCS_COLLECTION'

                      const badgeClass = isReady
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : isOfferAccepted
                          ? 'bg-cyan-50 text-cyan-800 border-cyan-200'
                          : isOfferReleased
                            ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                            : isDocs
                              ? 'bg-purple-50 text-purple-800 border-purple-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'

                      return (
                        <div className="flex flex-col gap-1">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${badgeClass} w-fit`}>
                            {row.stageLabel || row.stage}
                          </span>
                          <span className="text-xs font-bold font-mono text-slate-800">
                            ₹{(row.annualCtc / 100000).toFixed(1)} LPA
                            <span className="text-[10px] font-normal text-slate-400 ml-1">
                              (₹{row.annualCtc?.toLocaleString('en-IN')})
                            </span>
                          </span>
                        </div>
                      )
                    },
                  },
                  {
                    id: 'compliance',
                    header: 'India Statutory Compliance',
                    cell: ({ row }) => {
                      const stages = [
                        { label: 'PAN', status: row.panAadhaarStatus, title: `PAN & Aadhaar: ${row.panAadhaarStatus}` },
                        { label: 'REL', status: row.relievingLetterStatus, title: `Relieving & UAN: ${row.relievingLetterStatus}` },
                        { label: 'EDU', status: row.educationStatus, title: `Degree: ${row.educationStatus}` },
                        { label: 'BNK', status: row.bankDetailsStatus, title: `Bank Cheque: ${row.bankDetailsStatus}` },
                      ]

                      return (
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1">
                            {stages.map((st) => {
                              const isVer = st.status === 'VERIFIED'
                              const isInProg = st.status === 'IN_PROGRESS'
                              const cls = isVer
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                : isInProg
                                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                                  : 'bg-slate-100 text-slate-500 border-slate-200'
                              return (
                                <span
                                  key={st.label}
                                  title={st.title}
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold border font-mono ${cls}`}
                                >
                                  {st.label}
                                </span>
                              )
                            })}
                          </div>
                          <span className="text-[10px] text-slate-500 font-medium">
                            {row.docsSubmitted || 0}/4 Stages Verified
                          </span>
                        </div>
                      )
                    },
                  },
                  {
                    id: 'bgv',
                    header: 'BGV Clearance',
                    cell: ({ row }) => {
                      const isCleared = row.bgvStatus === 'VERIFIED'
                      const isInProg = row.bgvStatus === 'IN_PROGRESS'
                      const isFailed = row.bgvStatus === 'FAILED'

                      const cls = isCleared
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : isInProg
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : isFailed
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-slate-50 text-slate-600 border-slate-200'

                      const text = isCleared
                        ? '✅ BGV Cleared'
                        : isInProg
                          ? '⏳ In-Progress'
                          : isFailed
                            ? '❌ Review Needed'
                            : '⚪ Not Initiated'

                      return (
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border whitespace-nowrap ${cls}`}>
                          {text}
                        </span>
                      )
                    },
                  },
                  {
                    id: 'joinDate',
                    header: 'Target Joining',
                    className: 'whitespace-nowrap',
                    headerClassName: 'whitespace-nowrap',
                    cell: ({ row }) => (
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-semibold text-slate-800 whitespace-nowrap">
                          {new Date(row.targetJoinDate).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium">
                          {row.noticePeriodDays > 0 ? `${row.noticePeriodDays}d Notice Remaining` : 'Immediate Joining'}
                        </span>
                      </div>
                    ),
                  },
                  {
                    id: 'actions',
                    header: <span className="text-right block w-full">Actions</span>,
                    className: 'text-right whitespace-nowrap',
                    headerClassName: 'text-right whitespace-nowrap',
                    cell: ({ row }) => (
                      <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handlePromoteCandidate(row)}
                          disabled={promotingId === row.id}
                          className="text-xs h-7 px-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-2xs rounded-lg"
                          title="Convert directly to Active Onboarding Hire with CTC & PAN mapped"
                        >
                          {promotingId === row.id ? (
                            'Converting...'
                          ) : (
                            <>
                              <UserCheck className="size-3.5 mr-1" />
                              <span>Convert to Hire</span>
                            </>
                          )}
                        </Button>
                        <button
                          type="button"
                          onClick={() => setEditingCandidate(row)}
                          className="size-7 rounded-lg flex items-center justify-center text-slate-600 hover:text-cyan-700 hover:bg-cyan-50 border border-slate-200 transition-colors shadow-2xs"
                          title="Update India Statutory Compliance & BGV Status"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopyUploadLink(row)}
                          className="size-7 rounded-lg flex items-center justify-center text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 transition-colors shadow-2xs"
                          title="Copy Candidate Self-Service Upload Portal Link"
                        >
                          <Link2 className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const match = salaryProfiles.find(p => p.country === row.country) || salaryProfiles[0] || DEFAULT_TEMPLATES[0]
                            setSimulatingProfile(match)
                          }}
                          className="size-7 rounded-lg flex items-center justify-center text-slate-600 hover:text-amber-700 hover:bg-amber-50 border border-slate-200 transition-colors shadow-2xs"
                          title="Simulate CTC & Take-Home Breakdown"
                        >
                          <Calculator className="size-3.5" />
                        </button>
                      </div>
                    ),
                  },
                ]}
                keyExtractor={(r) => r.id || r.email || ''}
              />
            </div>
          )}
        </SectionCard>
      )}

      {/* ── TAB 3: SALARY & CTC TEMPLATES (TABULAR MATRIX) ── */}
      {activeTab === 'templates' && (
        <SectionCard noPadding className="w-full overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-b border-slate-100 bg-slate-50/60">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Statutory & Corporate Salary Profiles</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Pre-configured formula engines that automatically map candidate location to statutory earnings, allowances, and tax withholdings.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.href = '/settings?tab=salary'}
                className="text-xs h-8 text-slate-700 border-slate-200 hover:bg-slate-100"
              >
                <Settings2 className="size-3.5 mr-1.5 text-slate-500" />
                Configure Slabs in Settings
              </Button>
            </div>
          </div>

          <div className="w-full overflow-x-auto">
            <DataTable
              className="w-full min-w-full"
              data={displayProfiles}
              columns={[
                {
                  id: 'select',
                  header: (
                    <input
                      type="checkbox"
                      aria-label="Select all templates"
                      className="size-4 rounded border-slate-300 text-indigo-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                    />
                  ),
                  className: 'w-10 pr-0',
                  headerClassName: 'w-10 pr-0',
                  cell: () => (
                    <input
                      type="checkbox"
                      aria-label="Select template"
                      className="size-4 rounded border-slate-300 text-indigo-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                    />
                  ),
                },
                {
                  id: 'profile',
                  header: 'Template Name',
                  cell: ({ row }) => {
                    const code = row.country === 'India' ? 'IN' : row.country === 'UAE' ? 'AE' : row.country === 'United States' ? 'US' : 'GL'
                    return (
                      <div
                        className="flex items-center gap-2 cursor-pointer group"
                        onClick={() => setInspectingTemplate(row)}
                      >
                        <div className="size-6 rounded bg-slate-100 border border-slate-200/80 text-slate-600 font-bold text-[10px] font-mono flex items-center justify-center shrink-0 group-hover:bg-indigo-50 group-hover:border-indigo-200 group-hover:text-indigo-700 transition-colors">
                          {code}
                        </div>
                        <span className="text-[13px] font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors">
                          {row.name}
                        </span>
                        {row.isDefault && (
                          <span className="ml-1 inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 bg-slate-100 border border-slate-200/80 px-1.5 py-0.5 rounded-full">
                            Default
                          </span>
                        )}
                      </div>
                    )
                  }
                },
                {
                  id: 'currency',
                  header: 'Currency',
                  cell: ({ row }) => (
                    <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200/70 px-2 py-0.5 rounded">
                      {row.currencyCode} ({row.currencyCode === 'INR' ? '₹' : row.currencyCode === 'AED' ? 'د.إ' : '$'})
                    </span>
                  )
                },
                {
                  id: 'status',
                  header: 'Status',
                  cell: () => (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 whitespace-nowrap">
                      <span className="size-1.5 rounded-full bg-emerald-500" /> Active
                    </span>
                  )
                },
                {
                  id: 'earnings',
                  header: 'Earnings Formula',
                  cell: ({ row }) => (
                    <span className="text-[13px] text-slate-600 font-normal">
                      {row.country === 'India'
                        ? 'Basic 40% · HRA 40% · Conveyance'
                        : row.country === 'UAE'
                          ? 'Basic 60% · Housing 25% · Utility'
                          : row.country === 'United States'
                            ? 'Base 85% · Healthcare 10%'
                            : '100% Direct Retainer'}
                    </span>
                  )
                },
                {
                  id: 'statutory',
                  header: 'Statutory Rules',
                  cell: ({ row }) => (
                    <span className="text-[13px] text-slate-600 font-normal">
                      {row.country === 'India'
                        ? 'EPF 12% · Gratuity · TDS'
                        : row.country === 'UAE'
                          ? 'GPSSA 5% EE / 12.5% ER · EOSB'
                          : row.country === 'United States'
                            ? 'FICA 7.65% · W-4'
                            : 'W-8BEN Compliant (0% Local)'}
                    </span>
                  )
                },
                {
                  id: 'actions',
                  header: 'Actions',
                  headerClassName: 'text-right',
                  className: 'text-right',
                  cell: ({ row }) => (
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => setInspectingTemplate(row)}
                        title="View Breakdown & Components"
                        className="size-8 rounded-lg flex items-center justify-center text-amber-600 hover:bg-amber-50 border border-amber-200/60 hover:border-amber-300 transition-colors shadow-2xs"
                      >
                        <Eye className="size-4" />
                      </button>
                      <button
                        onClick={() => setSimulatingProfile(row)}
                        title="Simulate CTC"
                        className="size-8 rounded-lg flex items-center justify-center text-teal-600 hover:bg-teal-50 border border-teal-200/60 hover:border-teal-300 transition-colors shadow-2xs"
                      >
                        <Calculator className="size-4" />
                      </button>
                      <button
                        onClick={() => window.location.href = '/settings?tab=salary'}
                        title="Configure Slabs in Settings"
                        className="size-8 rounded-lg flex items-center justify-center text-rose-500 hover:bg-rose-50 border border-rose-200/60 hover:border-rose-300 transition-colors shadow-2xs"
                      >
                        <Settings2 className="size-4" />
                      </button>
                    </div>
                  )
                }
              ]}
              keyExtractor={(r) => r.id}
            />
          </div>
        </SectionCard>
      )}

      {/* ── TAB 3: SOURCES & ATS INTEGRATIONS (TABULAR MATRIX) ── */}
      {activeTab === 'sources' && (
        <SectionCard noPadding className="w-full overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-b border-slate-100 bg-slate-50/60">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Candidate Inflow Channels & ATS Connectors</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Supported candidate ingestion pipelines with automated profile normalization, checklist assignment, and CTC mapping.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.href = '/settings?tab=integrations'}
              className="text-xs h-8 text-slate-700 border-slate-200 hover:bg-slate-100"
            >
              <Plug className="size-3.5 mr-1.5 text-indigo-600" />
              Manage API Keys & Webhooks
            </Button>
          </div>

          <div className="w-full overflow-x-auto">
            <DataTable
              className="w-full min-w-full"
              data={INTAKE_CHANNELS}
              columns={[
                {
                  id: 'select',
                  header: (
                    <input
                      type="checkbox"
                      aria-label="Select all channels"
                      className="size-4 rounded border-slate-300 text-indigo-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                    />
                  ),
                  className: 'w-10 pr-0',
                  headerClassName: 'w-10 pr-0',
                  cell: () => (
                    <input
                      type="checkbox"
                      aria-label="Select channel"
                      className="size-4 rounded border-slate-300 text-indigo-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                    />
                  ),
                },
                {
                  id: 'channel',
                  header: 'Channel & Protocol',
                  cell: ({ row }) => {
                    const Icon = row.icon
                    return (
                      <div className="flex items-center gap-2.5">
                        <div className={`size-7 rounded-lg border flex items-center justify-center shrink-0 ${row.iconColor}`}>
                          <Icon className="size-3.5" />
                        </div>
                        <span className="text-[13px] font-semibold text-slate-800 leading-tight">
                          {row.name}
                        </span>
                      </div>
                    )
                  }
                },
                {
                  id: 'type',
                  header: 'Protocol Type',
                  cell: ({ row }) => (
                    <span className="text-[13px] text-slate-600 font-normal">
                      {row.type}
                    </span>
                  )
                },
                {
                  id: 'status',
                  header: 'Status',
                  cell: ({ row }) => (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 whitespace-nowrap">
                      <span className="size-1.5 rounded-full bg-emerald-500" />
                      {row.status}
                    </span>
                  )
                },
                {
                  id: 'schema',
                  header: 'Schema Fields',
                  cell: ({ row }) => (
                    <span className="font-mono text-xs text-slate-600 bg-slate-50 border border-slate-200/60 px-2 py-0.5 rounded block max-w-[220px] truncate">
                      {row.schema}
                    </span>
                  )
                },
                {
                  id: 'automation',
                  header: 'Automation Pipeline',
                  cell: ({ row }) => (
                    <span className="text-[13px] text-slate-600 font-normal block max-w-[280px] truncate">
                      {row.automation}
                    </span>
                  )
                },
                {
                  id: 'actions',
                  header: 'Actions',
                  headerClassName: 'text-right',
                  className: 'text-right',
                  cell: ({ row }) => (
                    <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                      {row.actionType === 'open_new' && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={openNew}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs h-7 px-2.5 rounded-lg shadow-2xs"
                        >
                          <UserPlus className="size-3.5 mr-1" /> {row.actionLabel}
                        </Button>
                      )}
                      {row.actionType === 'open_bulk' && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => setBulkOpen(true)}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs h-7 px-2.5 rounded-lg shadow-2xs"
                        >
                          <Upload className="size-3.5 mr-1" /> {row.actionLabel}
                        </Button>
                      )}
                      {row.actionType === 'settings' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.location.href = '/settings?tab=integrations'}
                          className="text-xs h-7 px-2.5 text-slate-700 border-slate-200 hover:bg-slate-50 rounded-lg shadow-2xs"
                        >
                          <Plug className="size-3 mr-1 text-slate-500" /> {row.actionLabel}
                        </Button>
                      )}
                    </div>
                  )
                }
              ]}
              keyExtractor={(r) => r.id}
            />
          </div>
        </SectionCard>
      )}

      {/* Modals & Drawers */}
      <SalaryTemplateDetailDrawer
        open={Boolean(inspectingTemplate)}
        template={inspectingTemplate}
        onClose={() => setInspectingTemplate(null)}
        onOpenSimulator={(tpl) => setSimulatingProfile(tpl)}
      />
      <OnboardingDrawer
        open={drawerOpen}
        hire={selectedHire}
        preboardingCandidates={preboardingList}
        onClose={() => setDrawerOpen(false)}
        onSaved={handleSaved}
        onCompleted={goCreateLogin}
        onGraduated={(data) => setGraduationSuccessData(data)}
      />
      <PreboardingCandidateModal
        open={addPreboardingOpen}
        onClose={() => setAddPreboardingOpen(false)}
        onAdd={handleAddPreboardingCandidate}
      />
      <UpdatePreboardingModal
        open={Boolean(editingCandidate)}
        candidate={editingCandidate}
        onClose={() => setEditingCandidate(null)}
        onSave={handleSaveUpdatedCandidate}
        onCopyUploadLink={handleCopyUploadLink}
      />
      <BulkImportModal open={bulkOpen} onClose={() => setBulkOpen(false)} onImported={handleSaved} />
      <GraduationConfirmModal
        open={Boolean(graduationConfirmHire)}
        hire={graduationConfirmHire}
        onClose={() => setGraduationConfirmHire(null)}
        onConfirm={handleConfirmGraduation}
      />
      <GraduationSuccessModal
        open={Boolean(graduationSuccessData)}
        data={graduationSuccessData}
        onClose={() => setGraduationSuccessData(null)}
        onViewEmployee={(code) => router.push(`/employees/${code}`)}
        onViewUser={() => router.push('/users')}
      />
      <CtcSimulatorModal
        open={Boolean(simulatingProfile)}
        profile={simulatingProfile}
        onClose={() => setSimulatingProfile(null)}
        onApply={(profileId, anchorValue) => {
          setSelectedHire((prev: any) => ({
            ...prev,
            compensation: {
              complianceProfileId: profileId,
              anchorValue: anchorValue,
            }
          }))
          setDrawerOpen(true)
        }}
      />
    </div>
  )
}
