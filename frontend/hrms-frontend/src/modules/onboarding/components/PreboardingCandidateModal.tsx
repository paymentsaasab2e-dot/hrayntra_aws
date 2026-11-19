"use client"

import * as React from 'react'
import { createPortal } from 'react-dom'
import { Button, Input, Select } from '@hryantra/ui'
import {
  X,
  Sparkles,
  UserPlus,
  CheckCircle2,
  Clock,
  ShieldCheck,
  FileCheck,
  Building2,
  CreditCard,
  Briefcase,
  AlertCircle,
  FileText,
  Zap,
  ArrowRight,
  ExternalLink,
  GraduationCap,
  ChevronRight,
} from 'lucide-react'

export type VerificationState = 'VERIFIED' | 'IN_PROGRESS' | 'NOT_INITIATED' | 'FAILED'

export type DiscussionStage =
  | 'SALARY_DISCUSSION' // CTC negotiation
  | 'OFFER_RELEASED'    // Offer Letter Issued
  | 'OFFER_ACCEPTED'    // Offer Accepted (Serving Notice)
  | 'DOCS_COLLECTION'   // Preboarding Docs Verification
  | 'READY_TO_JOIN'     // BGV Cleared · Day-1 Ready

export interface PreboardingCandidateData {
  id?: string
  name: string
  email: string
  phone: string
  role: string
  department: string
  source: string
  atsCandidateId?: string
  stage: DiscussionStage
  stageLabel: string
  offerPackage: string
  annualCtc: number
  country: string
  city: string
  targetJoinDate: string
  noticePeriodDays: number
  discussionNotes: string

  // India Compliance & BGV Verification Stages
  bgvStatus: VerificationState
  panAadhaarStatus: VerificationState
  panNumber?: string
  relievingLetterStatus: VerificationState
  uanNumber?: string
  educationStatus: VerificationState
  bankDetailsStatus: VerificationState
  docsSubmitted: number
  docsTotal: number
}

interface Props {
  open: boolean
  onClose: () => void
  onAdd: (candidate: PreboardingCandidateData) => void
}

const ATS_SOURCES = [
  'Greenhouse ATS',
  'Lever ATS Sync',
  'Ashby Recruiting API',
  'Workday Recruiter',
  'LinkedIn Recruiter',
  'Internal Referral',
  'Direct Sourcing',
]

const DISCUSSION_STAGES: { value: DiscussionStage; label: string; desc: string }[] = [
  { value: 'OFFER_ACCEPTED', label: 'Offer Accepted · Serving Notice', desc: 'Candidate accepted offer letter, serving notice period' },
  { value: 'OFFER_RELEASED', label: 'Offer Letter Released', desc: 'Formal offer issued via ATS, awaiting candidate signature' },
  { value: 'SALARY_DISCUSSION', label: 'Salary & Package Negotiation', desc: 'Active compensation & band discussion' },
  { value: 'DOCS_COLLECTION', label: 'Preboarding Docs In-Review', desc: 'Collecting PAN, Aadhaar, previous payslips & relieving letters' },
  { value: 'READY_TO_JOIN', label: 'BGV Cleared · Ready to Join', desc: 'All statutory checks verified, day-1 induction ready' },
]

const QUICK_PRESETS = [
  {
    label: '⚡ Senior SDE · ₹28 LPA (India IT · BGV Verified)',
    data: {
      name: 'Aditya Verma',
      email: 'aditya.verma@outlook.com',
      phone: '+91 98450 11982',
      role: 'Senior Staff SDE',
      department: 'Engineering',
      source: 'Greenhouse ATS',
      atsCandidateId: 'GH-8942',
      stage: 'READY_TO_JOIN' as DiscussionStage,
      offerPackage: '₹28,00,000 Annual CTC (28 LPA)',
      annualCtc: 2800000,
      country: 'India',
      city: 'Bengaluru',
      targetJoinDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      noticePeriodDays: 30,
      panAadhaarStatus: 'VERIFIED' as VerificationState,
      panNumber: 'ABCDE1234F',
      relievingLetterStatus: 'VERIFIED' as VerificationState,
      uanNumber: '100982341234',
      educationStatus: 'VERIFIED' as VerificationState,
      bankDetailsStatus: 'VERIFIED' as VerificationState,
      bgvStatus: 'VERIFIED' as VerificationState,
      discussionNotes: 'Offer signed and accepted. Relieving letter & Form 16 verified. BGV cleared by AuthBridge. Mac M3 provisioned.',
    },
  },
  {
    label: '⚡ Lead Product Designer · ₹24 LPA (Notice Period)',
    data: {
      name: 'Rhea Sengupta',
      email: 'rhea.sengupta@gmail.com',
      phone: '+91 99104 77312',
      role: 'Lead Product Designer',
      department: 'Product',
      source: 'Lever ATS Sync',
      atsCandidateId: 'LEV-502',
      stage: 'OFFER_ACCEPTED' as DiscussionStage,
      offerPackage: '₹24,00,000 Annual CTC (24 LPA)',
      annualCtc: 2400000,
      country: 'India',
      city: 'Mumbai',
      targetJoinDate: new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10),
      noticePeriodDays: 30,
      panAadhaarStatus: 'VERIFIED' as VerificationState,
      panNumber: 'BNMKL9876Q',
      relievingLetterStatus: 'IN_PROGRESS' as VerificationState,
      uanNumber: '101238992111',
      educationStatus: 'VERIFIED' as VerificationState,
      bankDetailsStatus: 'IN_PROGRESS' as VerificationState,
      bgvStatus: 'IN_PROGRESS' as VerificationState,
      discussionNotes: 'Offer accepted. Serving 30 days notice with current employer. Awaiting relieving letter and cancelled cheque.',
    },
  },
  {
    label: '⚡ Finance Specialist · ₹12 LPA (Immediate Joiner)',
    data: {
      name: 'Karan Mehra',
      email: 'karan.mehra@fintech.io',
      phone: '+91 98201 66299',
      role: 'Senior Finance Analyst',
      department: 'Finance',
      source: 'Internal Referral',
      atsCandidateId: 'REF-109',
      stage: 'DOCS_COLLECTION' as DiscussionStage,
      offerPackage: '₹12,00,000 Annual CTC (12 LPA)',
      annualCtc: 1200000,
      country: 'India',
      city: 'Pune',
      targetJoinDate: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
      noticePeriodDays: 15,
      panAadhaarStatus: 'VERIFIED' as VerificationState,
      panNumber: 'CVBNM4321P',
      relievingLetterStatus: 'VERIFIED' as VerificationState,
      uanNumber: '100456123789',
      educationStatus: 'VERIFIED' as VerificationState,
      bankDetailsStatus: 'VERIFIED' as VerificationState,
      bgvStatus: 'VERIFIED' as VerificationState,
      discussionNotes: 'Immediate joiner with completed relieving formalities. Ready for day-1 orientation.',
    },
  },
]

export function PreboardingCandidateModal({ open, onClose, onAdd }: Props) {
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const [activeStep, setActiveStep] = React.useState<1 | 2 | 3>(1)
  const [form, setForm] = React.useState<Partial<PreboardingCandidateData>>({
    name: '',
    email: '',
    phone: '',
    role: '',
    department: 'Engineering',
    source: 'Greenhouse ATS',
    atsCandidateId: `GH-${Math.floor(1000 + Math.random() * 9000)}`,
    stage: 'OFFER_ACCEPTED',
    offerPackage: '₹24,00,000 Annual CTC (24 LPA)',
    annualCtc: 2400000,
    country: 'India',
    city: 'Bengaluru',
    targetJoinDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    noticePeriodDays: 30,
    panAadhaarStatus: 'VERIFIED',
    panNumber: 'ABCDE1234F',
    relievingLetterStatus: 'IN_PROGRESS',
    uanNumber: '100982341234',
    educationStatus: 'VERIFIED',
    bankDetailsStatus: 'IN_PROGRESS',
    bgvStatus: 'IN_PROGRESS',
    discussionNotes: 'Candidate in active pre-boarding verification and notice period tracking.',
  })
  const [error, setError] = React.useState('')

  if (!open) return null

  const applyPreset = (preset: typeof QUICK_PRESETS[0]) => {
    setForm({ ...preset.data })
    setError('')
  }

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!form.name?.trim() || !form.email?.trim() || !form.role?.trim()) {
      setError('Candidate Name, Email, and Role are required')
      setActiveStep(1)
      return
    }

    const stageObj = DISCUSSION_STAGES.find((s) => s.value === form.stage) || DISCUSSION_STAGES[0]
    const stageLabel = `${stageObj.label.split('·')[0].trim()} · ${form.offerPackage}`

    // Calculate verified docs count (out of 4)
    const docStatuses = [
      form.panAadhaarStatus,
      form.relievingLetterStatus,
      form.educationStatus,
      form.bankDetailsStatus,
    ]
    const verifiedCount = docStatuses.filter((s) => s === 'VERIFIED').length

    const newCandidate: PreboardingCandidateData = {
      id: `pre_${Date.now()}`,
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone?.trim() || '+91 98000 00000',
      role: form.role.trim(),
      department: form.department || 'Engineering',
      source: form.source || 'Greenhouse ATS',
      atsCandidateId: form.atsCandidateId || `ATS-${Math.floor(1000 + Math.random() * 9000)}`,
      stage: form.stage || 'OFFER_ACCEPTED',
      stageLabel,
      offerPackage: form.offerPackage || '₹24,00,000 Annual CTC',
      annualCtc: Number(form.annualCtc) || 2400000,
      country: form.country || 'India',
      city: form.city || 'Bengaluru',
      targetJoinDate: form.targetJoinDate || new Date().toISOString().slice(0, 10),
      noticePeriodDays: Number(form.noticePeriodDays) || 30,
      panAadhaarStatus: form.panAadhaarStatus || 'VERIFIED',
      panNumber: form.panNumber || 'ABCDE1234F',
      relievingLetterStatus: form.relievingLetterStatus || 'IN_PROGRESS',
      uanNumber: form.uanNumber || '100982341234',
      educationStatus: form.educationStatus || 'VERIFIED',
      bankDetailsStatus: form.bankDetailsStatus || 'IN_PROGRESS',
      bgvStatus: form.bgvStatus || 'IN_PROGRESS',
      docsSubmitted: verifiedCount,
      docsTotal: 4,
      discussionNotes: form.discussionNotes?.trim() || 'Candidate profile entered into preboarding track.',
    }

    onAdd(newCandidate)
    onClose()
  }

  if (!open || !mounted) return null

  return typeof document !== 'undefined'
    ? createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-950/45 backdrop-blur-xs transition-opacity" onClick={onClose} />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-cyan-100 text-cyan-800 flex items-center justify-center font-bold shadow-2xs">
              <Sparkles className="size-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Add Preboarding Candidate (India Track)</h3>
              <p className="text-[11px] text-slate-500">Record ATS candidate, discussion status, BGV checks & statutory upload stages</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="size-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 flex items-center justify-center cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* 1-Click Fast-Fill Presets Bar */}
        <div className="px-6 py-2.5 bg-cyan-50/60 border-b border-cyan-100/80 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold text-cyan-900 flex items-center gap-1">
            <Zap className="size-3 text-amber-500" />
            1-Click Quick Presets:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_PRESETS.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => applyPreset(p)}
                className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-white text-cyan-900 border border-cyan-200/80 hover:bg-cyan-100/70 transition-all shadow-2xs cursor-pointer"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Step Indicator Tabs */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 bg-slate-50/50">
          <button
            type="button"
            onClick={() => setActiveStep(1)}
            className={`flex items-center gap-2 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeStep === 1
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span className={`size-5 rounded-full text-[10px] flex items-center justify-center ${activeStep === 1 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'}`}>1</span>
            <span>Role & Offer Package</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveStep(2)}
            className={`flex items-center gap-2 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeStep === 2
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span className={`size-5 rounded-full text-[10px] flex items-center justify-center ${activeStep === 2 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'}`}>2</span>
            <span>Discussion & Notice Period</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveStep(3)}
            className={`flex items-center gap-2 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeStep === 3
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span className={`size-5 rounded-full text-[10px] flex items-center justify-center ${activeStep === 3 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'}`}>3</span>
            <span>India BGV & Statutory Docs</span>
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-700 flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* ── STEP 1: Candidate & Offer Information ── */}
          {activeStep === 1 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Candidate Full Name *</label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Aditya Verma"
                    className="h-8.5 rounded-xl text-xs"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Work / Personal Email *</label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="aditya.verma@outlook.com"
                    className="h-8.5 rounded-xl text-xs"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Designation / Role *</label>
                  <Input
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                    placeholder="e.g. Senior Staff SDE"
                    className="h-8.5 rounded-xl text-xs"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Department</label>
                  <Select
                    value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                    className="h-8.5 rounded-xl text-xs bg-white"
                  >
                    <option value="Engineering">Engineering</option>
                    <option value="Product">Product</option>
                    <option value="Design">Design</option>
                    <option value="Sales">Sales</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Finance">Finance</option>
                    <option value="Human Resources">Human Resources</option>
                    <option value="Operations">Operations</option>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Phone (+91 India)</label>
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+91 98450 11982"
                    className="h-8.5 rounded-xl text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Location / City</label>
                  <Input
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    placeholder="e.g. Bengaluru / Mumbai / Remote"
                    className="h-8.5 rounded-xl text-xs"
                  />
                </div>
              </div>

              {/* ATS Linkage Box */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/90 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Building2 className="size-3.5 text-indigo-600" />
                    ATS Sourcing & Candidate Linkage
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">Syncs with Greenhouse/Lever</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 uppercase">Sourcing Channel</label>
                    <Select
                      value={form.source}
                      onChange={(e) => setForm({ ...form, source: e.target.value })}
                      className="h-8 rounded-lg text-xs bg-white mt-1"
                    >
                      {ATS_SOURCES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 uppercase">ATS Candidate ID / Code</label>
                    <Input
                      value={form.atsCandidateId}
                      onChange={(e) => setForm({ ...form, atsCandidateId: e.target.value })}
                      placeholder="e.g. GH-8942"
                      className="h-8 rounded-lg text-xs font-mono font-bold mt-1"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 2: Discussion State, Package & Notice Period ── */}
          {activeStep === 2 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Current State of Discussion</label>
                <div className="grid grid-cols-1 gap-2">
                  {DISCUSSION_STAGES.map((s) => (
                    <label
                      key={s.value}
                      className={`flex items-start gap-3 p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                        form.stage === s.value
                          ? 'border-indigo-500 bg-indigo-50/70 text-indigo-900 shadow-2xs font-semibold'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="stage"
                        value={s.value}
                        checked={form.stage === s.value}
                        onChange={() => setForm({ ...form, stage: s.value })}
                        className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="font-bold block text-slate-900">{s.label}</span>
                        <span className="text-[11px] text-slate-500 font-normal">{s.desc}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Offered Annual CTC (₹)</label>
                  <Input
                    value={form.offerPackage}
                    onChange={(e) => {
                      const val = e.target.value
                      const digits = val.replace(/[^0-9]/g, '')
                      setForm({ ...form, offerPackage: val, annualCtc: digits ? Number(digits) * 100000 : 2400000 })
                    }}
                    placeholder="e.g. ₹28,00,000 Annual CTC"
                    className="h-8.5 rounded-xl text-xs font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Notice Period (Days)</label>
                  <Select
                    value={form.noticePeriodDays}
                    onChange={(e) => setForm({ ...form, noticePeriodDays: parseInt(e.target.value, 10) || 30 })}
                    className="h-8.5 rounded-xl text-xs bg-white"
                  >
                    <option value={0}>Immediate Joiner (0 Days)</option>
                    <option value={15}>15 Days Notice</option>
                    <option value={30}>30 Days Notice (Standard)</option>
                    <option value={60}>60 Days Notice</option>
                    <option value={90}>90 Days Notice (Senior / Lead)</option>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Target Joining Date</label>
                  <Input
                    type="date"
                    value={form.targetJoinDate}
                    onChange={(e) => setForm({ ...form, targetJoinDate: e.target.value })}
                    className="h-8.5 rounded-xl text-xs font-semibold bg-white"
                  />
                </div>
              </div>

              <div className="space-y-1 pt-1">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Discussion & Recruiter Notes</label>
                <textarea
                  value={form.discussionNotes}
                  onChange={(e) => setForm({ ...form, discussionNotes: e.target.value })}
                  placeholder="e.g. Verbal acceptance confirmed. Serving notice period with previous tech employer; hardware dispatch scheduled."
                  rows={2}
                  className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>
          )}

          {/* ── STEP 3: India Statutory Compliance & BGV Stages ── */}
          {activeStep === 3 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80 flex items-start gap-2.5">
                <ShieldCheck className="size-4 text-amber-700 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900">
                  <span className="font-bold block">India Statutory Compliance Verification</span>
                  <span className="text-[11px] text-amber-800">
                    Track the 4 statutory stages mandated for India payroll, EPF, and IT Act compliance. Click status badges to update.
                  </span>
                </div>
              </div>

              {/* 4 Compliance Stages */}
              <div className="space-y-2.5">
                {/* 1. Identity & Tax (PAN & Aadhaar) */}
                <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white shadow-2xs">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                      <CreditCard className="size-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">1. Identity & Tax (PAN & Aadhaar)</span>
                      <span className="text-[10px] text-slate-500 font-mono">PAN: {form.panNumber || 'ABCDE1234F'} · Aadhaar Linked</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {(['VERIFIED', 'IN_PROGRESS', 'NOT_INITIATED'] as VerificationState[]).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setForm({ ...form, panAadhaarStatus: st })}
                        className={`px-2 py-0.8 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                          form.panAadhaarStatus === st
                            ? st === 'VERIFIED'
                              ? 'bg-emerald-600 text-white'
                              : st === 'IN_PROGRESS'
                              ? 'bg-amber-500 text-white'
                              : 'bg-slate-700 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {st === 'VERIFIED' ? 'Verified' : st === 'IN_PROGRESS' ? 'In-Progress' : 'Not Initiated'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Previous Employment & Relieving Letter */}
                <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white shadow-2xs">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
                      <Briefcase className="size-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">2. Past Employment & Relieving Check</span>
                      <span className="text-[10px] text-slate-500 font-mono">UAN: {form.uanNumber || '100982341234'} · Relieving Letter</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {(['VERIFIED', 'IN_PROGRESS', 'NOT_INITIATED'] as VerificationState[]).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setForm({ ...form, relievingLetterStatus: st })}
                        className={`px-2 py-0.8 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                          form.relievingLetterStatus === st
                            ? st === 'VERIFIED'
                              ? 'bg-emerald-600 text-white'
                              : st === 'IN_PROGRESS'
                              ? 'bg-amber-500 text-white'
                              : 'bg-slate-700 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {st === 'VERIFIED' ? 'Verified' : st === 'IN_PROGRESS' ? 'In-Progress' : 'Not Initiated'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Education Credentials Check */}
                <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white shadow-2xs">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
                      <GraduationCap className="size-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">3. Education & Degree Verification</span>
                      <span className="text-[10px] text-slate-500">Highest qualification certificate verified</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {(['VERIFIED', 'IN_PROGRESS', 'NOT_INITIATED'] as VerificationState[]).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setForm({ ...form, educationStatus: st })}
                        className={`px-2 py-0.8 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                          form.educationStatus === st
                            ? st === 'VERIFIED'
                              ? 'bg-emerald-600 text-white'
                              : st === 'IN_PROGRESS'
                              ? 'bg-amber-500 text-white'
                              : 'bg-slate-700 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {st === 'VERIFIED' ? 'Verified' : st === 'IN_PROGRESS' ? 'In-Progress' : 'Not Initiated'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 4. Bank Account & Cancelled Cheque */}
                <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white shadow-2xs">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                      <FileCheck className="size-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">4. Bank Account & Cancelled Cheque</span>
                      <span className="text-[10px] text-slate-500">Salary direct deposit & IFSC validation</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {(['VERIFIED', 'IN_PROGRESS', 'NOT_INITIATED'] as VerificationState[]).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setForm({ ...form, bankDetailsStatus: st })}
                        className={`px-2 py-0.8 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                          form.bankDetailsStatus === st
                            ? st === 'VERIFIED'
                              ? 'bg-emerald-600 text-white'
                              : st === 'IN_PROGRESS'
                              ? 'bg-amber-500 text-white'
                              : 'bg-slate-700 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {st === 'VERIFIED' ? 'Verified' : st === 'IN_PROGRESS' ? 'In-Progress' : 'Not Initiated'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Overall BGV Status Selector */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Overall BGV Clearance Status</span>
                  <span className="text-[10px] text-slate-500">Agency check (AuthBridge / SpringVerify)</span>
                </div>
                <Select
                  value={form.bgvStatus}
                  onChange={(e) => setForm({ ...form, bgvStatus: e.target.value as VerificationState })}
                  className="h-8 rounded-lg text-xs bg-white font-bold w-40"
                >
                  <option value="VERIFIED">✅ BGV Verified</option>
                  <option value="IN_PROGRESS">⏳ In-Progress</option>
                  <option value="NOT_INITIATED">⚪ Not Initiated</option>
                  <option value="FAILED">❌ Discrepancy / Review</option>
                </Select>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-slate-50 border-t border-slate-200">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="h-8 text-xs font-semibold border-slate-200 text-slate-700"
          >
            Cancel
          </Button>

          <div className="flex items-center gap-2">
            {activeStep > 1 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setActiveStep((prev) => (prev - 1) as any)}
                className="h-8 text-xs border-slate-200"
              >
                Back
              </Button>
            )}

            {activeStep < 3 ? (
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={() => {
                  if (!form.name?.trim() || !form.email?.trim() || !form.role?.trim()) {
                    setError('Candidate Name, Email, and Role are required')
                    return
                  }
                  setError('')
                  setActiveStep((prev) => (prev + 1) as any)
                }}
                className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold gap-1.5"
              >
                <span>Continue</span>
                <ChevronRight className="size-3.5" />
              </Button>
            ) : (
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={() => handleSubmit()}
                className="h-8 text-xs bg-cyan-600 hover:bg-cyan-700 text-white font-bold shadow-xs gap-1.5"
              >
                <UserPlus className="size-3.5" />
                <span>Save to Preboarding Pipeline</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  ) : null
}
