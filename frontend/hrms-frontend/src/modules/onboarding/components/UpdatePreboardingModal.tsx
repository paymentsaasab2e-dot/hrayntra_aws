"use client"

import * as React from 'react'
import { Button, Input, Select } from '@hryantra/ui'
import {
  X,
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Building2,
  CreditCard,
  Briefcase,
  GraduationCap,
  Copy,
  ExternalLink,
  Check,
} from 'lucide-react'
import {
  PreboardingCandidateData,
  VerificationState,
  DiscussionStage,
} from './PreboardingCandidateModal'

interface Props {
  open: boolean
  candidate: PreboardingCandidateData | null
  onClose: () => void
  onSave: (candidate: PreboardingCandidateData) => void
  onCopyUploadLink?: (candidate: PreboardingCandidateData) => void
}

const DISCUSSION_OPTIONS: { value: DiscussionStage; label: string }[] = [
  { value: 'OFFER_ACCEPTED', label: 'Offer Accepted · Serving Notice' },
  { value: 'OFFER_RELEASED', label: 'Offer Letter Released' },
  { value: 'SALARY_DISCUSSION', label: 'Salary & Package Negotiation' },
  { value: 'DOCS_COLLECTION', label: 'Preboarding Docs In-Review' },
  { value: 'READY_TO_JOIN', label: 'BGV Cleared · Ready to Join' },
]

export function UpdatePreboardingModal({ open, candidate, onClose, onSave, onCopyUploadLink }: Props) {
  const [form, setForm] = React.useState<PreboardingCandidateData | null>(null)
  const [copied, setCopied] = React.useState(false)

  React.useEffect(() => {
    if (candidate) {
      setForm({ ...candidate })
    }
  }, [candidate])

  if (!open || !form) return null

  const handleCopy = () => {
    if (onCopyUploadLink && form) {
      onCopyUploadLink(form)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleSave = () => {
    if (!form) return
    // Auto-calculate label
    const stageObj = DISCUSSION_OPTIONS.find((s) => s.value === form.stage)
    const stageLabel = stageObj?.label || form.stage

    // Recalculate docs submitted
    const docStatuses = [
      form.panAadhaarStatus,
      form.relievingLetterStatus,
      form.educationStatus,
      form.bankDetailsStatus,
    ]
    const docsSubmitted = docStatuses.filter((s) => s === 'VERIFIED').length

    onSave({
      ...form,
      stageLabel,
      docsSubmitted,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-cyan-50/30">
          <div>
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-cyan-500 animate-pulse" />
              <h3 className="text-base font-bold text-slate-900">
                Update BGV & Discussion State
              </h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-100 text-cyan-800 border border-cyan-200">
                {form.atsCandidateId || 'ATS-SYNC'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {form.name} · {form.role} ({form.department}) · {form.source}
            </p>
          </div>
          <button
            onClick={onClose}
            className="size-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          {/* Sourcing Channel & Fast Actions */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80">
            <div>
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">Candidate Upload Portal</span>
              <span className="text-xs text-slate-500">Provide direct document upload link to candidate</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="h-8 px-3 text-xs font-semibold bg-white border-slate-200 hover:bg-slate-100 text-slate-700 shadow-2xs"
            >
              {copied ? (
                <>
                  <Check className="size-3.5 mr-1.5 text-emerald-600" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="size-3.5 mr-1.5 text-slate-500" />
                  Copy Upload Link
                </>
              )}
            </Button>
          </div>

          {/* Section 1: Discussion State & Compensation */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Briefcase className="size-3.5 text-indigo-600" />
              Offer & Discussion Progress
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">Current State of Discussion</label>
                <select
                  value={form.stage}
                  onChange={(e) => setForm({ ...form, stage: e.target.value as DiscussionStage })}
                  className="w-full text-xs font-medium border border-slate-200 rounded-lg p-2 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                >
                  {DISCUSSION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">Agreed Annual CTC (₹ INR)</label>
                <input
                  type="number"
                  value={form.annualCtc}
                  onChange={(e) => {
                    const ctc = Number(e.target.value) || 0
                    setForm({
                      ...form,
                      annualCtc: ctc,
                      offerPackage: `₹${ctc.toLocaleString('en-IN')} Annual CTC (${(ctc / 100000).toFixed(1)} LPA)`,
                    })
                  }}
                  className="w-full text-xs border border-slate-200 rounded-lg p-2 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  placeholder="e.g. 2400000"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">Target Start Date</label>
                <input
                  type="date"
                  value={form.targetJoinDate}
                  onChange={(e) => setForm({ ...form, targetJoinDate: e.target.value })}
                  className="w-full text-xs border border-slate-200 rounded-lg p-2 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">Notice Period (Days Remaining)</label>
                <input
                  type="number"
                  value={form.noticePeriodDays}
                  onChange={(e) => setForm({ ...form, noticePeriodDays: Number(e.target.value) || 0 })}
                  className="w-full text-xs border border-slate-200 rounded-lg p-2 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  placeholder="e.g. 30"
                />
              </div>
            </div>
          </div>

          {/* Section 2: India Statutory Compliance & BGV */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 text-cyan-600" />
                India Statutory Compliance & Verification Stages
              </h4>
              <span className="text-[11px] font-bold text-slate-500">
                {[form.panAadhaarStatus, form.relievingLetterStatus, form.educationStatus, form.bankDetailsStatus].filter(s => s === 'VERIFIED').length}/4 Verified
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* PAN & Aadhaar */}
              <div className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <FileText className="size-3.5 text-indigo-600" />
                    PAN & Aadhaar Check
                  </span>
                  <select
                    value={form.panAadhaarStatus}
                    onChange={(e) => setForm({ ...form, panAadhaarStatus: e.target.value as VerificationState })}
                    className="text-[11px] font-bold border border-slate-200 rounded-md py-0.5 px-2 bg-white"
                  >
                    <option value="VERIFIED">✅ Verified</option>
                    <option value="IN_PROGRESS">⏳ In-Progress</option>
                    <option value="NOT_INITIATED">⚪ Not Initiated</option>
                  </select>
                </div>
                <input
                  type="text"
                  value={form.panNumber || ''}
                  onChange={(e) => setForm({ ...form, panNumber: e.target.value.toUpperCase() })}
                  placeholder="PAN Card No. (e.g. ABCDE1234F)"
                  className="w-full text-xs font-mono uppercase border border-slate-200 rounded-md p-1.5 bg-white text-slate-800"
                />
              </div>

              {/* Relieving Letter & UAN */}
              <div className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <Building2 className="size-3.5 text-amber-600" />
                    Relieving Letter & UAN
                  </span>
                  <select
                    value={form.relievingLetterStatus}
                    onChange={(e) => setForm({ ...form, relievingLetterStatus: e.target.value as VerificationState })}
                    className="text-[11px] font-bold border border-slate-200 rounded-md py-0.5 px-2 bg-white"
                  >
                    <option value="VERIFIED">✅ Verified</option>
                    <option value="IN_PROGRESS">⏳ In-Progress</option>
                    <option value="NOT_INITIATED">⚪ Not Initiated</option>
                  </select>
                </div>
                <input
                  type="text"
                  value={form.uanNumber || ''}
                  onChange={(e) => setForm({ ...form, uanNumber: e.target.value })}
                  placeholder="EPFO UAN (12 Digits)"
                  className="w-full text-xs font-mono border border-slate-200 rounded-md p-1.5 bg-white text-slate-800"
                />
              </div>

              {/* Education Degree */}
              <div className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <GraduationCap className="size-3.5 text-purple-600" />
                    Education Degree Certificate
                  </span>
                  <select
                    value={form.educationStatus}
                    onChange={(e) => setForm({ ...form, educationStatus: e.target.value as VerificationState })}
                    className="text-[11px] font-bold border border-slate-200 rounded-md py-0.5 px-2 bg-white"
                  >
                    <option value="VERIFIED">✅ Verified</option>
                    <option value="IN_PROGRESS">⏳ In-Progress</option>
                    <option value="NOT_INITIATED">⚪ Not Initiated</option>
                  </select>
                </div>
                <p className="text-[11px] text-slate-500">Highest qualification graduation degree & marksheets.</p>
              </div>

              {/* Bank Details & Cheque */}
              <div className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <CreditCard className="size-3.5 text-emerald-600" />
                    Bank Account & Cheque
                  </span>
                  <select
                    value={form.bankDetailsStatus}
                    onChange={(e) => setForm({ ...form, bankDetailsStatus: e.target.value as VerificationState })}
                    className="text-[11px] font-bold border border-slate-200 rounded-md py-0.5 px-2 bg-white"
                  >
                    <option value="VERIFIED">✅ Verified</option>
                    <option value="IN_PROGRESS">⏳ In-Progress</option>
                    <option value="NOT_INITIATED">⚪ Not Initiated</option>
                  </select>
                </div>
                <p className="text-[11px] text-slate-500">Cancelled cheque or bank passbook with IFSC code.</p>
              </div>
            </div>

            {/* Overall BGV Status */}
            <div className="p-3.5 rounded-xl border border-cyan-200 bg-cyan-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="font-bold text-slate-800 text-xs block">Overall BGV Clearance Status</span>
                <span className="text-[11px] text-slate-500">AuthBridge / SpringVerify external background verification agency</span>
              </div>
              <select
                value={form.bgvStatus}
                onChange={(e) => setForm({ ...form, bgvStatus: e.target.value as VerificationState })}
                className="text-xs font-bold border border-cyan-300 rounded-lg p-2 bg-white text-slate-800 shadow-2xs"
              >
                <option value="VERIFIED">✅ BGV Cleared</option>
                <option value="IN_PROGRESS">⏳ Agency Screening In-Progress</option>
                <option value="NOT_INITIATED">⚪ Pending Submission</option>
                <option value="FAILED">❌ Discrepancy / Review</option>
              </select>
            </div>
          </div>

          {/* Sourcing / Recruiter Notes */}
          <div className="space-y-1.5 pt-2 border-t border-slate-100">
            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
              Recruiter & ATS Discussion Notes
            </label>
            <textarea
              rows={3}
              value={form.discussionNotes || ''}
              onChange={(e) => setForm({ ...form, discussionNotes: e.target.value })}
              placeholder="e.g. Counter-offer accepted, buy-out approved, joining bonus payable on day 1..."
              className="w-full text-xs border border-slate-200 rounded-lg p-2.5 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-100 bg-slate-50/80">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs h-8 text-slate-600 border-slate-200 hover:bg-slate-100"
          >
            Cancel
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleSave}
            className="text-xs h-8 px-4 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold shadow-2xs rounded-lg"
          >
            <CheckCircle2 className="size-3.5 mr-1.5" />
            Save Verification & Status
          </Button>
        </div>
      </div>
    </div>
  )
}
