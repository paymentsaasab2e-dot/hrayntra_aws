"use client"

import * as React from 'react'
import { ModalWrapper, Button, StatusBadge } from '@hryantra/ui'
import { api } from '@/shared/api'
import { ShieldCheck, FileText, CheckCircle2, Clock } from 'lucide-react'

export function TermsAcceptanceModal() {
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [submitting, setSubmitting] = React.useState(false)
  const [pendingDocs, setPendingDocs] = React.useState<any[]>([])
  const [selectedIndex, setSelectedIndex] = React.useState(0)
  const [agreed, setAgreed] = React.useState(false)
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null)

  const checkPending = React.useCallback(async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      if (!token) {
        setOpen(false)
        return
      }

      const res = await api.compliance.getPending()
      if (res?.success && Array.isArray(res.data) && res.data.length > 0) {
        setPendingDocs(res.data)
        setSelectedIndex(0)
        setAgreed(false)
        setOpen(true)
      } else {
        setPendingDocs([])
        setOpen(false)
      }
    } catch {
      // Ignored if user not logged in or endpoint unseeded yet
      setOpen(false)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    checkPending()
    const onFocus = () => checkPending()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [checkPending])

  const currentDoc = pendingDocs[selectedIndex] || pendingDocs[0]

  const handleAcceptCurrent = async () => {
    if (!currentDoc || !agreed) return
    setSubmitting(true)
    setSuccessMsg(null)
    try {
      await api.compliance.accept(currentDoc.id, {
        promptSource: 'MANDATORY_TERMS_INTERCEPTOR_MODAL',
      })
      const remaining = pendingDocs.filter((d) => d.id !== currentDoc.id)
      setPendingDocs(remaining)
      setAgreed(false)
      if (remaining.length === 0) {
        setSuccessMsg('All mandatory terms have been successfully accepted and logged!')
        setTimeout(() => {
          setOpen(false)
        }, 1200)
      } else {
        setSelectedIndex(0)
      }
    } catch (err: any) {
      alert(err.message || 'Failed to record acceptance')
    } finally {
      setSubmitting(false)
    }
  }

  const handleAcceptAll = async () => {
    if (!agreed) return
    setSubmitting(true)
    setSuccessMsg(null)
    try {
      await api.compliance.acceptAll()
      setSuccessMsg('All agreements accepted and verified!')
      setPendingDocs([])
      setTimeout(() => {
        setOpen(false)
      }, 1000)
    } catch (err: any) {
      alert(err.message || 'Failed to accept documents')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading || !open || pendingDocs.length === 0) {
    return null
  }

  return (
    <ModalWrapper
      open={open}
      onClose={() => {
        if (pendingDocs.some((d) => d.isMandatory)) {
          alert('You must accept the mandatory legal terms to continue.')
          return
        }
        setOpen(false)
      }}
      title={
        <div className="flex items-center gap-2 text-base font-bold text-slate-900">
          <ShieldCheck className="size-5 text-[#9333ea]" />
          <span>Statutory Terms & Privacy Acceptance Required</span>
        </div>
      }
      subtitle={
        <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
          {pendingDocs.length} agreement{pendingDocs.length > 1 ? 's' : ''} pending review
        </span>
      }
      size="xl"
      disableBackdropClose={true}
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Clock className="size-3.5 text-slate-400" />
            <span>Audit trail will record: Timestamp, User ID, Client IP & Version.</span>
          </div>
          <div className="flex items-center gap-2">
            {pendingDocs.length > 1 && (
              <Button
                variant="outline"
                size="sm"
                disabled={!agreed || submitting}
                onClick={handleAcceptAll}
              >
                Accept All ({pendingDocs.length})
              </Button>
            )}
            <Button
              variant="default"
              size="sm"
              disabled={!agreed || submitting}
              onClick={handleAcceptCurrent}
            >
              {submitting ? 'Recording...' : `Accept & Continue (${selectedIndex + 1}/${pendingDocs.length})`}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {successMsg && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Tab switcher if multiple pending */}
        {pendingDocs.length > 1 && (
          <div className="flex items-center gap-1.5 border-b border-slate-200 pb-2 overflow-x-auto">
            {pendingDocs.map((doc, idx) => (
              <button
                key={doc.id}
                onClick={() => {
                  setSelectedIndex(idx)
                  setAgreed(false)
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  selectedIndex === idx
                    ? 'bg-[#9333ea] text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <FileText className="size-3.5" />
                <span>{doc.type}</span>
                <span className="opacity-80">v{doc.version}</span>
              </button>
            ))}
          </div>
        )}

        {/* Document Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-3 border border-slate-200/80">
          <div>
            <h3 className="text-sm font-bold text-slate-900">{currentDoc.title}</h3>
            <p className="text-xs text-slate-500 mt-0.5">{currentDoc.summary || 'Mandatory compliance agreement'}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded">
              Version {currentDoc.version}
            </span>
            <StatusBadge status="Action Required" />
          </div>
        </div>

        {/* Scrollable Document Reader */}
        <div className="max-h-[320px] overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 font-mono text-xs leading-relaxed text-slate-700 whitespace-pre-wrap select-text">
          {currentDoc.content}
        </div>

        {/* Acceptance Checkbox & Compliance Notice */}
        <div className="rounded-xl border border-purple-200 bg-purple-50/70 p-3.5 space-y-2">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 size-4 rounded border-slate-300 text-[#9333ea] focus:ring-[#9333ea]"
            />
            <div className="text-xs text-slate-800">
              <span className="font-semibold">
                I have read, understood, and accept the terms of {currentDoc.title} (v{currentDoc.version}).
              </span>
              <p className="text-slate-500 text-[11px] mt-0.5">
                Pursuant to Section 65B of the Indian Evidence Act and IT Act 2000, your acceptance timestamp, IP address, and authenticated user credentials will be permanently bound into the corporate compliance ledger.
              </p>
            </div>
          </label>
        </div>
      </div>
    </ModalWrapper>
  )
}
