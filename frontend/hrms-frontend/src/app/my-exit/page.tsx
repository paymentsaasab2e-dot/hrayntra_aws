"use client"

import * as React from 'react'
import {
  PageHeroBanner,
  SectionCard,
  Button,
  Input,
  Textarea,
  MetricStatCard,
  DrawerWrapper,
  StatusBadge,
} from '@hryantra/ui'
import { api } from '@/shared/api'
import {
  LogOut,
  Clock,
  CheckCircle2,
  CalendarDays,
  ClipboardList,
  FileText,
} from 'lucide-react'

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted — awaiting manager',
  MANAGER_APPROVED: 'Manager approved — awaiting HR',
  ACCEPTED: 'Accepted',
  IN_NOTICE: 'Serving notice period',
  CLEARANCE_PENDING: 'Clearance in progress',
  COMPLETED: 'Exit completed',
  REJECTED: 'Rejected',
  WITHDRAWN: 'Withdrawn',
}

function statusBadge(status: string): 'Pending' | 'Approved' | 'Rejected' | 'Draft' {
  if (status === 'COMPLETED' || status === 'ACCEPTED' || status === 'IN_NOTICE') return 'Approved'
  if (status === 'REJECTED') return 'Rejected'
  if (status === 'DRAFT' || status === 'WITHDRAWN') return 'Draft'
  return 'Pending'
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatProbationMonths(months?: number) {
  if (!months) return '—'
  return months === 1 ? '1 month' : `${months} months`
}

function isOnProbation(probationEndDate?: string | null) {
  if (!probationEndDate) return false
  return new Date(probationEndDate) > new Date()
}

export default function MyExitPage() {
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)
  const [policy, setPolicy] = React.useState<any>(null)
  const [separation, setSeparation] = React.useState<any>(null)
  const [employee, setEmployee] = React.useState<any>(null)
  const [onboarding, setOnboarding] = React.useState<any>(null)
  const [reason, setReason] = React.useState('')
  const [requestedLWD, setRequestedLWD] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [drawerOpen, setDrawerOpen] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const [policyRes, mineRes] = await Promise.all([
        api.separation.getPolicy(),
        api.separation.getMine(),
      ])
      setPolicy(policyRes?.data)
      setSeparation(mineRes?.data?.separation || null)
      setEmployee(mineRes?.data?.employee || null)
      setOnboarding(mineRes?.data?.onboarding || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load exit info')
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    load()
  }, [load])

  const dateEyebrow = React.useMemo(
    () =>
      new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }).toUpperCase(),
    []
  )

  const checklist = (separation?.checklist as { label: string; done: boolean }[]) || []
  const checklistDone = checklist.filter((item) => item.done).length

  const hasActiveSeparation =
    separation && !['WITHDRAWN', 'REJECTED', 'COMPLETED'].includes(separation.status)

  const canSubmitNew =
    !separation || ['WITHDRAWN', 'REJECTED', 'COMPLETED'].includes(separation.status)

  const joinDate = onboarding?.joinDate || employee?.joiningDate
  const onProbation = isOnProbation(employee?.probationEndDate)
  const probationMonths = policy?.probationMonths ?? 3

  const openSubmitDrawer = () => {
    setReason('')
    setRequestedLWD('')
    setError(null)
    setDrawerOpen(true)
  }

  const handleSubmit = async () => {
    if (!reason.trim() || !requestedLWD) {
      setError('Reason and requested last working day are required')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await api.separation.submit({ reason: reason.trim(), requestedLWD, submit: true })
      setSuccess('Resignation submitted. Your manager and HR will review it.')
      setDrawerOpen(false)
      setReason('')
      setRequestedLWD('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed')
    } finally {
      setSubmitting(false)
    }
  }

  const handleWithdraw = async () => {
    if (!separation?.id) return
    if (!confirm('Withdraw your resignation request?')) return
    try {
      await api.separation.withdraw(separation.id)
      setSuccess('Resignation withdrawn.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Withdraw failed')
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-6 py-6 pb-10">
      <section className="flex flex-col gap-4">
        <PageHeroBanner
          compact
          eyebrow={dateEyebrow}
          title="My Exit"
          description="Submit resignation, track your notice period, and complete the exit checklist."
          actions={
            canSubmitNew ? (
              <Button variant="default" onClick={openSubmitDrawer}>
                <LogOut className="size-4" />
                Submit resignation
              </Button>
            ) : hasActiveSeparation && ['SUBMITTED', 'DRAFT'].includes(separation.status) ? (
              <Button variant="outline" onClick={handleWithdraw}>
                Withdraw request
              </Button>
            ) : undefined
          }
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricStatCard
            label="Exit status"
            value={
              loading
                ? '—'
                : separation
                  ? STATUS_LABELS[separation.status]?.split('—')[0].trim() || separation.status
                  : 'Not submitted'
            }
            subtitle={hasActiveSeparation ? 'Request in progress' : 'Your resignation state'}
            tone="blue"
            icon={FileText}
          />
          <MetricStatCard
            label="Standard notice"
            value={policy ? `${policy.standardNoticeDays} days` : '—'}
            subtitle={
              policy ? `Probation: ${policy.probationNoticeDays} days` : 'Company policy'
            }
            tone="amber"
            icon={Clock}
          />
          <MetricStatCard
            label="Checklist progress"
            value={checklist.length ? `${checklistDone}/${checklist.length}` : '—'}
            subtitle="Exit tasks completed"
            tone="mint"
            icon={ClipboardList}
          />
          <MetricStatCard
            label="Last working day"
            value={formatDate(separation?.approvedLWD || separation?.requestedLWD)}
            subtitle={separation?.approvedLWD ? 'Approved date' : 'Requested date'}
            tone="lavender"
            icon={CalendarDays}
          />
        </div>
      </section>

      {success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {success}
        </div>
      )}
      {error && !drawerOpen && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <SectionCard title="Exit overview">
          <p className="text-sm text-ds-neutral-500 py-8 text-center">Loading your exit information...</p>
        </SectionCard>
      ) : hasActiveSeparation ? (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <SectionCard title="Resignation details">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <StatusBadge status={statusBadge(separation.status)} withDot />
                <span className="text-sm font-medium text-slate-600">
                  {STATUS_LABELS[separation.status] || separation.status}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <DetailItem label="Reason" value={separation.reason} />
                <DetailItem label="Notice period" value={`${separation.noticePeriodDays} days`} />
                <DetailItem label="Requested LWD" value={formatDate(separation.requestedLWD)} />
                <DetailItem label="Approved LWD" value={formatDate(separation.approvedLWD)} />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Exit checklist"
            titleAction={
              checklist.length > 0 ? (
                <span className="text-xs font-medium text-slate-500">
                  {checklistDone} of {checklist.length} done
                </span>
              ) : undefined
            }
          >
            {checklist.length === 0 ? (
              <p className="text-sm text-slate-500">No checklist items assigned yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {checklist.map((item) => (
                  <li
                    key={item.label}
                    className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${
                      item.done
                        ? 'border-emerald-200 bg-emerald-50/60 text-emerald-900'
                        : 'border-slate-200 bg-slate-50/60 text-slate-700'
                    }`}
                  >
                    <CheckCircle2
                      className={`size-4 shrink-0 ${item.done ? 'text-emerald-600' : 'text-slate-300'}`}
                    />
                    <span className={item.done ? 'font-medium' : ''}>{item.label}</span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      ) : separation?.status === 'COMPLETED' ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-900">
          <span className="font-medium">Exit completed.</span> Your separation process is finished.
        </div>
      ) : canSubmitNew ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
          <span className="font-medium text-slate-900">No active resignation.</span>{' '}
          Submit from the button above when you are ready to leave.
        </div>
      ) : null}

      {policy && (
        <SectionCard title="Company notice policy">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <PolicyChip label="Standard notice" value={`${policy.standardNoticeDays} days`} />
            <PolicyChip label="Probation notice" value={`${policy.probationNoticeDays} days`} />
            <PolicyChip
              label="Probation period"
              value={formatProbationMonths(probationMonths)}
              hint="For new joiners"
            />
            <PolicyChip
              label="Your join date"
              value={formatDate(joinDate)}
              hint={
                onboarding?.status
                  ? `Onboarding: ${onboarding.status}`
                  : onProbation
                    ? `On probation until ${formatDate(employee?.probationEndDate)}`
                    : employee?.probationEndDate
                      ? 'Probation completed'
                      : undefined
              }
            />
          </div>
        </SectionCard>
      )}

      <DrawerWrapper
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Submit resignation"
        subtitle="Provide your reason and requested last working day. HR and your manager will review."
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setDrawerOpen(false)} className="mr-auto" disabled={submitting}>
              Cancel
            </Button>
            <Button variant="default" onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit resignation'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          {error && drawerOpen && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {policy && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm text-amber-900">
              Notice policy: <strong>{policy.standardNoticeDays} days</strong> standard
              {onProbation ? (
                <>
                  {' '}
                  · <strong>{policy.probationNoticeDays} days</strong> (you are on probation)
                </>
              ) : (
                <> · {formatProbationMonths(probationMonths)} probation for new joiners</>
              )}
            </div>
          )}

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1 block">
              Reason for leaving
            </label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              placeholder="Brief reason for resignation..."
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1 block">
              Requested last working day
            </label>
            <Input type="date" value={requestedLWD} onChange={(e) => setRequestedLWD(e.target.value)} />
          </div>
        </div>
      </DrawerWrapper>
    </div>
  )
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200/90 bg-slate-50/50 px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value || '—'}</p>
    </div>
  )
}

function PolicyChip({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-base font-bold text-slate-900">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p>}
    </div>
  )
}
