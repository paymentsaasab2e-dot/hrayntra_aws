"use client"

import * as React from 'react'
import {
  PageHeroBanner,
  SectionCard,
  Button,
  Input,
  FormGrid,
  FormField,
  FormFieldInput,
  MetricStatCard,
  StatusBadge,
} from '@hryantra/ui'
import { useStore } from '@/store/StoreProvider'
import { api } from '@/shared/api'
import {
  FileText,
  Shield,
  CheckCircle2,
  CalendarDays,
  Clock,
  LogOut,
  FileUp,
  ScrollText,
} from 'lucide-react'

type HrRules = {
  leave: Record<string, number>
  attendance: Record<string, number | string | boolean>
  exit: Record<string, number | boolean>
}

function PolicyRuleCard({
  title,
  icon: Icon,
  tone,
  children,
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  tone: 'mint' | 'blue' | 'lavender'
  children: React.ReactNode
}) {
  const tones = {
    mint: 'bg-white border-slate-200/80',
    blue: 'bg-white border-slate-200/80',
    lavender: 'bg-white border-slate-200/80',
  }
  const iconWrap = {
    mint: 'bg-emerald-50 text-emerald-600 border border-emerald-100',
    blue: 'bg-blue-50 text-blue-600 border border-blue-100',
    lavender: 'bg-indigo-50 text-indigo-600 border border-indigo-100',
  }

  return (
    <div
      className={`rounded-2xl border bg-gradient-to-br p-4 shadow-sm ${tones[tone]}`}
    >
      <div className="mb-3 flex items-center gap-2">
        <div className={`flex size-9 items-center justify-center rounded-xl ${iconWrap[tone]}`}>
          <Icon className="size-4" />
        </div>
        <h4 className="text-sm font-bold text-[#111827]">{title}</h4>
      </div>
      <div className="space-y-1.5 text-sm text-[#475569]">{children}</div>
    </div>
  )
}

function docStatusBadge(status: string) {
  const map: Record<string, 'Approved' | 'Pending' | 'Draft' | 'Rejected'> = {
    PUBLISHED: 'Approved',
    DRAFT: 'Draft',
    ARCHIVED: 'Rejected',
  }
  return map[status] || 'Pending'
}

export default function PoliciesPage() {
  const { hasTab, currentUserRole } = useStore()
  const canManage = currentUserRole === 'HR' || currentUserRole === 'Superadmin' || hasTab('settings')

  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)
  const [documents, setDocuments] = React.useState<any[]>([])
  const [active, setActive] = React.useState<{ rules: HrRules; version: any } | null>(null)
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [selectedDoc, setSelectedDoc] = React.useState<any>(null)
  const [rules, setRules] = React.useState<HrRules | null>(null)
  const [uploadTitle, setUploadTitle] = React.useState('Leave & Attendance Policy 2026')
  const [uploadFile, setUploadFile] = React.useState<File | null>(null)
  const [saving, setSaving] = React.useState(false)

  const dateEyebrow = React.useMemo(
    () =>
      new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }).toUpperCase(),
    []
  )

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [activeRes, listRes] = await Promise.all([
        api.policies.getActive(),
        canManage ? api.policies.list() : Promise.resolve({ data: [] }),
      ])
      setActive(activeRes?.data || null)
      setRules(activeRes?.data?.rules || null)
      setDocuments(Array.isArray(listRes?.data) ? listRes.data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load policies')
    } finally {
      setLoading(false)
    }
  }, [canManage])

  React.useEffect(() => {
    load()
  }, [load])

  const openDoc = async (id: string) => {
    try {
      const res = await api.policies.getById(id)
      setSelectedId(id)
      setSelectedDoc(res?.data)
      setRules(res?.data?.draftRules || active?.rules || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load document')
    }
  }

  const handleUpload = async () => {
    if (!uploadFile) {
      setError('Select a PDF or document file')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await api.policies.upload(uploadTitle, uploadFile)
      setSuccess('Policy uploaded — review rules and publish.')
      setUploadFile(null)
      await load()
      if (res?.data?.id) await openDoc(res.data.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setSaving(false)
    }
  }

  const handleCreateManual = async () => {
    setSaving(true)
    try {
      const res = await api.policies.createManual(uploadTitle)
      setSuccess('Draft policy created.')
      await load()
      if (res?.data?.id) await openDoc(res.data.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed')
    } finally {
      setSaving(false)
    }
  }

  const saveDraftRules = async () => {
    if (!selectedId || !rules) return
    setSaving(true)
    try {
      await api.policies.updateRules(selectedId, rules)
      setSuccess('Draft rules saved.')
      await openDoc(selectedId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const publish = async () => {
    if (!selectedId) return
    setSaving(true)
    try {
      await api.policies.publish(selectedId)
      setSuccess('Policy published and is now active for leave/attendance enforcement.')
      setSelectedId(null)
      setSelectedDoc(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish failed')
    } finally {
      setSaving(false)
    }
  }

  const updateRule = (section: keyof HrRules, key: string, value: string | number | boolean) => {
    if (!rules) return
    setRules({
      ...rules,
      [section]: { ...rules[section], [key]: value },
    })
  }

  const stats = React.useMemo(
    () => ({
      total: documents.length,
      published: documents.filter((d) => d.status === 'PUBLISHED').length,
      drafts: documents.filter((d) => d.status === 'DRAFT').length,
      active: active?.version ? 1 : 0,
    }),
    [documents, active]
  )

  if (!canManage && !hasTab('documents')) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center p-6 text-center">
        <Shield className="mb-4 size-12 text-[#cbd5e1]" />
        <p className="text-sm font-medium text-[#64748b]">You do not have access to policy management.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-6 py-6 pb-12">
      <section className="flex flex-col gap-4">
        <PageHeroBanner
          compact
          eyebrow={dateEyebrow}
          title="Policy Centre"
          description="Upload compliance documents, configure leave and attendance rules, and publish the active tenant policy."
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricStatCard label="Policy Documents" value={stats.total} subtitle="Uploaded files" tone="blue" icon={FileText} />
          <MetricStatCard label="Published" value={stats.published} subtitle="Live versions" tone="mint" icon={CheckCircle2} />
          <MetricStatCard label="Drafts" value={stats.drafts} subtitle="Awaiting review" tone="amber" icon={ScrollText} />
          <MetricStatCard label="Active Policy" value={stats.active} subtitle="Currently enforced" tone="indigo" icon={Shield} />
        </div>
      </section>

      {success && (
        <div className="rounded-xl border border-[#a7f3d0] bg-[#ecfdf5] px-4 py-3 text-sm font-medium text-[#047857]">
          {success}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-[#fecaca] bg-[#fff1f2] px-4 py-3 text-sm font-medium text-[#b91c1c]">
          {error}
        </div>
      )}

      {active?.rules && (
        <SectionCard
          title="Active published policy"
          titleAction={
            <span className="rounded-full bg-[#ecfdf5] px-3 py-1 text-xs font-bold text-[#047857]">
              Version {active.version?.version || '—'}
            </span>
          }
        >
          <p className="mb-4 text-sm font-medium text-[#64748b]">
            {active.version?.documentTitle || 'Tenant policy'} — enforced across leave, attendance, and exit workflows.
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            <PolicyRuleCard title="Leave" icon={CalendarDays} tone="mint">
              <p>
                <span className="font-semibold text-[#111827]">Advance notice:</span>{' '}
                {active.rules.leave?.leaveAdvanceNoticeDays} days
              </p>
              <p>
                <span className="font-semibold text-[#111827]">Max consecutive:</span>{' '}
                {active.rules.leave?.maxConsecutiveLeaveDays} days
              </p>
              <p>
                <span className="font-semibold text-[#111827]">Casual / Sick / Earned:</span>{' '}
                {active.rules.leave?.annualCasualLeave}/{active.rules.leave?.annualSickLeave}/
                {active.rules.leave?.annualEarnedLeave}
              </p>
            </PolicyRuleCard>
            <PolicyRuleCard title="Attendance" icon={Clock} tone="blue">
              <p>
                <span className="font-semibold text-[#111827]">Hours:</span>{' '}
                {active.rules.attendance?.workStartTime} – {active.rules.attendance?.workEndTime}
              </p>
              <p>
                <span className="font-semibold text-[#111827]">Grace period:</span>{' '}
                {active.rules.attendance?.gracePeriodMinutes} min
              </p>
              <p>
                <span className="font-semibold text-[#111827]">Remote punch:</span>{' '}
                {active.rules.attendance?.allowRemotePunch ? 'Allowed' : 'Not allowed'}
              </p>
            </PolicyRuleCard>
            <PolicyRuleCard title="Exit & notice" icon={LogOut} tone="lavender">
              <p>
                <span className="font-semibold text-[#111827]">Standard notice:</span>{' '}
                {active.rules.exit?.standardNoticeDays} days
              </p>
              <p>
                <span className="font-semibold text-[#111827]">Probation notice:</span>{' '}
                {active.rules.exit?.probationNoticeDays} days
              </p>
              <p>
                <span className="font-semibold text-[#111827]">Probation period:</span>{' '}
                {active.rules.exit?.probationMonths ?? 3} months
              </p>
              <p>
                <span className="font-semibold text-[#111827]">Leave in notice:</span>{' '}
                {active.rules.exit?.allowLeaveDuringNotice ? 'Allowed' : 'Blocked'}
              </p>
            </PolicyRuleCard>
          </div>
        </SectionCard>
      )}

      {canManage && (
        <>
          <SectionCard title="Upload policy document">
            <div className="rounded-2xl border border-[#bfdbfe] bg-gradient-to-br from-[#eff6ff] via-white to-white p-5">
              <FormGrid cols={2}>
                <FormField label="Policy title" labelVariant="default" className="md:col-span-2">
                  <FormFieldInput>
                    <Input value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} className="rounded-xl" />
                  </FormFieldInput>
                </FormField>
                <FormField label="Document (PDF recommended)" labelVariant="default" className="md:col-span-2">
                  <FormFieldInput>
                    <Input
                      type="file"
                      accept=".pdf,.doc,.docx,.txt"
                      onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                      className="rounded-xl"
                    />
                  </FormFieldInput>
                </FormField>
              </FormGrid>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={handleUpload} disabled={saving || !uploadFile}>
                  <FileUp className="size-4" />
                  Upload & extract text
                </Button>
                <Button variant="outline" onClick={handleCreateManual} disabled={saving}>
                  Create without file
                </Button>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Policy documents">
            {loading ? (
              <p className="text-sm text-[#64748b]">Loading documents…</p>
            ) : documents.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#cbd5e1] py-12 text-center">
                <FileText className="mb-3 size-10 text-[#cbd5e1]" />
                <p className="text-sm font-medium text-[#64748b]">No policy documents yet.</p>
                <p className="mt-1 text-xs text-[#94a3b8]">Upload a PDF or create a manual draft above.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {documents.map((d) => (
                  <div
                    key={d.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e2e8f0] bg-white px-4 py-3 transition-colors hover:border-[#cbd5e1] hover:bg-[#f8fafc]"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#eef2ff] text-[#4f46e5]">
                        <FileText className="size-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-[#111827]">{d.title}</p>
                        <p className="text-xs text-[#64748b]">{d.fileName || 'Manual entry'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={docStatusBadge(d.status)} />
                      <Button variant="outline" size="sm" onClick={() => openDoc(d.id)}>
                        Review
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </>
      )}

      {selectedDoc && rules && canManage && (
        <SectionCard
          title={`Review: ${selectedDoc.title}`}
          titleAction={
            <Button variant="ghost" size="sm" onClick={() => { setSelectedDoc(null); setSelectedId(null) }}>
              Close
            </Button>
          }
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
              <h4 className="mb-3 flex items-center gap-2 text-sm font-bold text-[#111827]">
                <ScrollText className="size-4 text-[#6366f1]" />
                Extracted document text
              </h4>
              <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-xl border border-[#e2e8f0] bg-white p-3 text-xs leading-relaxed text-[#475569]">
                {selectedDoc.extractedText || 'No text extracted — configure rules manually using the form.'}
              </pre>
            </div>

            <div className="rounded-2xl border border-[#e2e8f0] bg-white p-4">
              <h4 className="mb-4 text-sm font-bold text-[#111827]">Structured rules</h4>
              <FormGrid cols={2}>
                {[
                  ['leaveAdvanceNoticeDays', 'Leave advance notice (days)'],
                  ['maxConsecutiveLeaveDays', 'Max consecutive leave'],
                  ['annualCasualLeave', 'Annual casual leave'],
                  ['annualSickLeave', 'Annual sick leave'],
                  ['annualEarnedLeave', 'Annual earned leave'],
                ].map(([key, label]) => (
                  <FormField key={key} label={label} labelVariant="default">
                    <FormFieldInput>
                      <Input
                        type="number"
                        value={Number(rules.leave?.[key] ?? 0)}
                        onChange={(e) => updateRule('leave', key, Number(e.target.value))}
                        className="rounded-xl"
                      />
                    </FormFieldInput>
                  </FormField>
                ))}
                <FormField label="Work start" labelVariant="default">
                  <FormFieldInput>
                    <Input
                      value={String(rules.attendance?.workStartTime || '')}
                      onChange={(e) => updateRule('attendance', 'workStartTime', e.target.value)}
                      className="rounded-xl"
                    />
                  </FormFieldInput>
                </FormField>
                <FormField label="Work end" labelVariant="default">
                  <FormFieldInput>
                    <Input
                      value={String(rules.attendance?.workEndTime || '')}
                      onChange={(e) => updateRule('attendance', 'workEndTime', e.target.value)}
                      className="rounded-xl"
                    />
                  </FormFieldInput>
                </FormField>
                <FormField label="Grace period (min)" labelVariant="default">
                  <FormFieldInput>
                    <Input
                      type="number"
                      value={Number(rules.attendance?.gracePeriodMinutes ?? 0)}
                      onChange={(e) => updateRule('attendance', 'gracePeriodMinutes', Number(e.target.value))}
                      className="rounded-xl"
                    />
                  </FormFieldInput>
                </FormField>
                <FormField label="Standard notice (days)" labelVariant="default">
                  <FormFieldInput>
                    <Input
                      type="number"
                      value={Number(rules.exit?.standardNoticeDays ?? 0)}
                      onChange={(e) => updateRule('exit', 'standardNoticeDays', Number(e.target.value))}
                      className="rounded-xl"
                    />
                  </FormFieldInput>
                </FormField>
                <FormField label="Probation notice (days)" labelVariant="default">
                  <FormFieldInput>
                    <Input
                      type="number"
                      value={Number(rules.exit?.probationNoticeDays ?? 0)}
                      onChange={(e) => updateRule('exit', 'probationNoticeDays', Number(e.target.value))}
                      className="rounded-xl"
                    />
                  </FormFieldInput>
                </FormField>
                <FormField label="Probation period (months)" labelVariant="default">
                  <FormFieldInput>
                    <Input
                      type="number"
                      value={Number(rules.exit?.probationMonths ?? 3)}
                      onChange={(e) => updateRule('exit', 'probationMonths', Number(e.target.value))}
                      className="rounded-xl"
                    />
                  </FormFieldInput>
                </FormField>
              </FormGrid>
              <div className="mt-5 flex flex-wrap gap-2 border-t border-[#e2e8f0] pt-4">
                <Button variant="outline" onClick={saveDraftRules} disabled={saving}>
                  Save draft
                </Button>
                <Button onClick={publish} disabled={saving}>
                  <CheckCircle2 className="size-4" />
                  Publish as active
                </Button>
              </div>
            </div>
          </div>
        </SectionCard>
      )}
    </div>
  )
}
