"use client"

import * as React from 'react'
import {
  PageHeroBanner,
  SectionCard,
  Button,
  Input,
  StatusBadge,
  ModalWrapper,
} from '@hryantra/ui'
import { api } from '@/shared/api'
import {
  ShieldCheck,
  FileText,
  Clock,
  History,
  CheckCircle2,
  AlertCircle,
  Plus,
  RefreshCw,
  Search,
  Eye,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react'

export default function CompliancePage() {
  const [loading, setLoading] = React.useState(true)
  const [overview, setOverview] = React.useState<any>(null)
  const [documents, setDocuments] = React.useState<any[]>([])
  const [auditTrail, setAuditTrail] = React.useState<any[]>([])
  const [auditTotal, setAuditTotal] = React.useState(0)
  const [selectedDoc, setSelectedDoc] = React.useState<any>(null)
  const [viewModalOpen, setViewModalOpen] = React.useState(false)

  // Bump version state
  const [bumpModalOpen, setBumpModalOpen] = React.useState(false)
  const [bumpDoc, setBumpDoc] = React.useState<any>(null)
  const [newVersion, setNewVersion] = React.useState('')
  const [bumpSummary, setBumpSummary] = React.useState('')
  const [bumpContent, setBumpContent] = React.useState('')
  const [bumping, setBumping] = React.useState(false)

  // Filters
  const [searchTerm, setSearchTerm] = React.useState('')
  const [typeFilter, setTypeFilter] = React.useState<string>('ALL')
  const [actionMsg, setActionMsg] = React.useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const loadData = React.useCallback(async () => {
    setLoading(true)
    try {
      const [overviewRes, docsRes, auditRes] = await Promise.all([
        api.compliance.getOverview().catch(() => ({ data: null })),
        api.compliance.listDocuments().catch(() => ({ data: [] })),
        api.compliance.getAuditTrail({ limit: 50 }).catch(() => ({ data: { items: [], total: 0 } })),
      ])

      if (overviewRes?.data) setOverview(overviewRes.data)
      if (docsRes?.data) setDocuments(docsRes.data)
      if (auditRes?.data?.items) {
        setAuditTrail(auditRes.data.items)
        setAuditTotal(auditRes.data.total || 0)
      }
    } catch (err: any) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadData()
  }, [loadData])

  const handleSeedStandards = async () => {
    try {
      setActionMsg(null)
      const res = await api.compliance.seedStandards()
      setActionMsg({ text: res.message || 'Seeded standard legal documents', type: 'success' })
      loadData()
    } catch (err: any) {
      setActionMsg({ text: err.message || 'Failed to seed documents', type: 'error' })
    }
  }

  const handleOpenBump = (doc: any) => {
    setBumpDoc(doc)
    const currentVer = parseFloat(doc.version || '1.0')
    const nextVer = (currentVer + 1.0).toFixed(1)
    setNewVersion(nextVer)
    setBumpSummary(`Major update for compliance cycle 2026: revised statutory clauses.`)
    setBumpContent(doc.content)
    setBumpModalOpen(true)
  }

  const handlePublishNewVersion = async () => {
    if (!bumpDoc || !newVersion) return
    setBumping(true)
    setActionMsg(null)
    try {
      await api.compliance.publishNewVersion(bumpDoc.id, {
        newVersion,
        summary: bumpSummary,
        content: bumpContent,
      })
      setActionMsg({
        text: `Successfully published version ${newVersion} for ${bumpDoc.title}! Users will be prompted for re-acceptance.`,
        type: 'success',
      })
      setBumpModalOpen(false)
      loadData()
    } catch (err: any) {
      setActionMsg({ text: err.message || 'Failed to publish new version', type: 'error' })
    } finally {
      setBumping(false)
    }
  }

  const filteredAudit = auditTrail.filter((item) => {
    if (typeFilter !== 'ALL' && item.documentType !== typeFilter) return false
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      const empName = `${item.employee?.firstName || ''} ${item.employee?.lastName || ''}`.toLowerCase()
      const email = (item.user?.email || '').toLowerCase()
      const ip = (item.ipAddress || '').toLowerCase()
      const doc = (item.document?.title || '').toLowerCase()
      return empName.includes(term) || email.includes(term) || ip.includes(term) || doc.includes(term)
    }
    return true
  })

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <PageHeroBanner
        eyebrow="Compliance & Governance Engine"
        title="Terms, Privacy & Regulatory Acceptance Tracking"
        description="Versioned legal agreements (ToS, Privacy Policy, DPA, SLA) with Section 65B compliant audit logging of IP addresses, timestamps, and re-acceptance triggers."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
              <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>
            {documents.length === 0 && (
              <Button variant="default" size="sm" onClick={handleSeedStandards}>
                <Sparkles className="size-3.5" />
                <span>Seed Standard Legal Documents</span>
              </Button>
            )}
          </div>
        }
      />

      {actionMsg && (
        <div
          className={`flex items-center gap-2 rounded-xl p-3.5 text-sm ${
            actionMsg.type === 'success'
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          {actionMsg.type === 'success' ? (
            <CheckCircle2 className="size-4 text-emerald-600" />
          ) : (
            <AlertCircle className="size-4 text-rose-600" />
          )}
          <span>{actionMsg.text}</span>
        </div>
      )}

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50 via-white to-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-purple-700">Overall Compliance Rate</div>
          <div className="mt-2 text-3xl font-extrabold text-slate-900">
            {overview?.overallComplianceRatePercent ?? 100}%
          </div>
          <div className="mt-1 text-xs text-slate-500">Across active workforce</div>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 via-white to-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-blue-700">Active Legal Documents</div>
          <div className="mt-2 text-3xl font-extrabold text-slate-900">{documents.length}</div>
          <div className="mt-1 text-xs text-slate-500">ToS, Privacy Policy, DPA, SLA</div>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Total Acceptances Logged</div>
          <div className="mt-2 text-3xl font-extrabold text-slate-900">{auditTotal}</div>
          <div className="mt-1 text-xs text-slate-500">With IP address & timestamp</div>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-amber-700">Active Workforce Users</div>
          <div className="mt-2 text-3xl font-extrabold text-slate-900">{overview?.totalUsers ?? 0}</div>
          <div className="mt-1 text-xs text-slate-500">Tracked for compliance sign-off</div>
        </div>
      </div>

      {/* Document Catalog */}
      <SectionCard title="Versioned Statutory Agreements">
        <div className="p-4 border-b border-slate-100 text-xs text-slate-500">
          Active agreements governing platform usage, DPDP statutory notices, and enterprise service tiers.
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold text-slate-600">
              <tr>
                <th className="py-3 px-4">Document Type</th>
                <th className="py-3 px-4">Title</th>
                <th className="py-3 px-4">Version</th>
                <th className="py-3 px-4">Mandatory</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {documents.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-4">
                    <span className="font-mono text-xs font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-md border border-purple-200">
                      {doc.type}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-900">{doc.title}</div>
                    <div className="text-xs text-slate-500 max-w-md truncate">{doc.summary}</div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                      v{doc.version}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    {doc.isMandatory ? (
                      <StatusBadge status="Action Required" />
                    ) : (
                      <StatusBadge status="Draft" />
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {doc.isActive ? (
                      <StatusBadge status="Active" withDot />
                    ) : (
                      <StatusBadge status="Inactive" />
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedDoc(doc)
                          setViewModalOpen(true)
                        }}
                      >
                        <Eye className="size-3.5" />
                        <span>View</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenBump(doc)}
                      >
                        <ArrowUpRight className="size-3.5" />
                        <span>Bump Version</span>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Audit Trail Log */}
      <SectionCard title="Statutory Acceptance Audit Ledger (Section 65B Evidence)">
        <div className="p-4 border-b border-slate-100 text-xs text-slate-500">
          Immutable log of user acceptances with captured IP address, user agent, timestamp, and signed version.
        </div>
        {/* Filters */}
        <div className="p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="relative w-64">
              <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-slate-400" />
              <Input
                placeholder="Search user, IP, or title..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 text-xs"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 shadow-sm focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-none"
            >
              <option value="ALL">All Document Types</option>
              <option value="TOS">ToS</option>
              <option value="PRIVACY_POLICY">Privacy Policy</option>
              <option value="DPA">DPA</option>
              <option value="SLA">SLA</option>
            </select>
          </div>
          <div className="text-xs text-slate-500">
            Showing {filteredAudit.length} of {auditTotal} recorded events
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
              <tr>
                <th className="py-2.5 px-3">Timestamp (UTC / Local)</th>
                <th className="py-2.5 px-3">Employee / User</th>
                <th className="py-2.5 px-3">Document</th>
                <th className="py-2.5 px-3">Version</th>
                <th className="py-2.5 px-3">Client IP Address</th>
                <th className="py-2.5 px-3">Client Agent / Device</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAudit.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No acceptance records found matching query.
                  </td>
                </tr>
              ) : (
                filteredAudit.map((log) => {
                  const empName = log.employee
                    ? `${log.employee.firstName} ${log.employee.lastName}`
                    : log.user?.displayName || 'User'
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-3 font-mono text-slate-600">
                        {new Date(log.acceptedAt).toLocaleString('en-IN', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-900">{empName}</div>
                        <div className="text-slate-500 text-[11px]">{log.user?.email}</div>
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-800">
                        {log.document?.title || log.documentType}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-mono bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded text-[11px]">
                          v{log.versionAccepted}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-700">
                        {log.ipAddress || '127.0.0.1'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 max-w-xs truncate text-[11px]">
                        {log.userAgent || 'HRMS-Client'}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* View Document Modal */}
      {selectedDoc && (
        <ModalWrapper
          open={viewModalOpen}
          onClose={() => setViewModalOpen(false)}
          title={selectedDoc.title}
          subtitle={<span className="text-xs bg-slate-100 px-2 py-0.5 rounded font-mono">Version {selectedDoc.version}</span>}
          size="lg"
          footer={
            <Button variant="default" size="sm" onClick={() => setViewModalOpen(false)}>
              Close
            </Button>
          }
        >
          <div className="space-y-3">
            <div className="text-xs text-slate-500">{selectedDoc.summary}</div>
            <div className="max-h-[360px] overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-700 whitespace-pre-wrap select-text">
              {selectedDoc.content}
            </div>
          </div>
        </ModalWrapper>
      )}

      {/* Bump Version Modal */}
      {bumpDoc && (
        <ModalWrapper
          open={bumpModalOpen}
          onClose={() => setBumpModalOpen(false)}
          title={`Publish New Version for ${bumpDoc.title}`}
          subtitle={<span className="text-xs text-amber-700">Triggers re-acceptance for all users</span>}
          size="lg"
          footer={
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setBumpModalOpen(false)} disabled={bumping}>
                Cancel
              </Button>
              <Button variant="default" size="sm" onClick={handlePublishNewVersion} disabled={bumping || !newVersion}>
                {bumping ? 'Publishing...' : `Publish Version ${newVersion}`}
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <strong>Compliance Notice:</strong> Publishing a new version deactivates version {bumpDoc.version}.
              Active users will be intercepted by the mandatory acceptance modal upon their next interaction.
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">New Version Number</label>
              <Input
                value={newVersion}
                onChange={(e) => setNewVersion(e.target.value)}
                placeholder="e.g. 2.0"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Changelog Summary</label>
              <Input
                value={bumpSummary}
                onChange={(e) => setBumpSummary(e.target.value)}
                placeholder="Describe key statutory or policy updates..."
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Document Content</label>
              <textarea
                value={bumpContent}
                onChange={(e) => setBumpContent(e.target.value)}
                rows={8}
                className="w-full rounded-xl border border-slate-300 p-3 font-mono text-xs text-slate-800 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-none"
              />
            </div>
          </div>
        </ModalWrapper>
      )}
    </div>
  )
}
