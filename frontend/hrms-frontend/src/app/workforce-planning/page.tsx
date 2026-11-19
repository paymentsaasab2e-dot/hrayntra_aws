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
  Briefcase,
  Users,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  Layers,
  FileCheck,
  Building2,
} from 'lucide-react'

export default function WorkforcePlanningPage() {
  const [loading, setLoading] = React.useState(true)
  const [budgetVsActual, setBudgetVsActual] = React.useState<any>(null)
  const [requisitions, setRequisitions] = React.useState<any[]>([])
  const [selectedFiscalYear, setSelectedFiscalYear] = React.useState('FY2026-27')
  const [activeTab, setActiveTab] = React.useState<'variance' | 'requisitions'>('variance')

  // Create Requisition Modal
  const [reqModalOpen, setReqModalOpen] = React.useState(false)
  const [newTitle, setNewTitle] = React.useState('Senior Full-Stack Engineer')
  const [newDept, setNewDept] = React.useState('Engineering')
  const [newOpenings, setNewOpenings] = React.useState(1)
  const [newMinCtc, setNewMinCtc] = React.useState('1200000')
  const [newMaxCtc, setNewMaxCtc] = React.useState('1800000')
  const [newJustification, setNewJustification] = React.useState('Expansion of cloud services')
  const [creatingReq, setCreatingReq] = React.useState(false)

  // Edit Headcount Plan Modal
  const [planModalOpen, setPlanModalOpen] = React.useState(false)
  const [editingPlan, setEditingPlan] = React.useState<any>(null)
  const [editHeadcount, setEditHeadcount] = React.useState(20)
  const [savingPlan, setSavingPlan] = React.useState(false)

  const [msg, setMsg] = React.useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [searchTerm, setSearchTerm] = React.useState('')

  const loadData = React.useCallback(async () => {
    setLoading(true)
    try {
      const [analysisRes, reqsRes] = await Promise.all([
        api.workforce.getBudgetVsActual(selectedFiscalYear).catch(() => ({ data: null })),
        api.workforce.listRequisitions().catch(() => ({ data: [] })),
      ])

      if (analysisRes?.data) setBudgetVsActual(analysisRes.data)
      if (reqsRes?.data) setRequisitions(reqsRes.data)
    } catch (err: any) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [selectedFiscalYear])

  React.useEffect(() => {
    loadData()
  }, [loadData])

  const handleSeedStandards = async () => {
    try {
      setMsg(null)
      await api.workforce.seedHeadcountPlans(selectedFiscalYear)
      setMsg({ text: 'Seeded standard approved departmental headcount budgets', type: 'success' })
      loadData()
    } catch (err: any) {
      setMsg({ text: err.message || 'Failed to seed plans', type: 'error' })
    }
  }

  const handleCreateRequisition = async () => {
    setCreatingReq(true)
    setMsg(null)
    try {
      const res = await api.workforce.createRequisition({
        title: newTitle,
        department: newDept,
        numberOfOpenings: newOpenings,
        budgetedMinCtc: parseFloat(newMinCtc),
        budgetedMaxCtc: parseFloat(newMaxCtc),
        justification: newJustification,
        fiscalYear: selectedFiscalYear,
      })

      const g = res.data.governanceCheck
      if (g.isBudgetExceeded) {
        setMsg({
          text: `Requisition ${res.data.requisition.requisitionNumber} created with status BUDGET_EXCEPTION_REQUIRED: Requested openings (${newOpenings}) exceed authorized capacity (${g.approvedBudget}). Requires CFO exception approval.`,
          type: 'error',
        })
      } else {
        setMsg({
          text: `Requisition ${res.data.requisition.requisitionNumber} authorized and approved within headcount budget.`,
          type: 'success',
        })
      }

      setReqModalOpen(false)
      loadData()
    } catch (err: any) {
      setMsg({ text: err.message || 'Failed to create requisition', type: 'error' })
    } finally {
      setCreatingReq(false)
    }
  }

  const handleApproveException = async (reqId: string) => {
    try {
      setMsg(null)
      await api.workforce.approveRequisition(reqId, 'Budget exception authorized by Leadership')
      setMsg({ text: 'Requisition exception successfully approved!', type: 'success' })
      loadData()
    } catch (err: any) {
      setMsg({ text: err.message || 'Failed to approve exception', type: 'error' })
    }
  }

  const handleSaveHeadcountPlan = async () => {
    if (!editingPlan) return
    setSavingPlan(true)
    try {
      await api.workforce.setHeadcountPlan({
        fiscalYear: selectedFiscalYear,
        department: editingPlan.department,
        approvedHeadcount: editHeadcount,
      })
      setPlanModalOpen(false)
      loadData()
    } catch (err: any) {
      alert(err.message || 'Failed to save headcount plan')
    } finally {
      setSavingPlan(false)
    }
  }

  const summary = budgetVsActual?.summary
  const departments = budgetVsActual?.departments || []

  const filteredReqs = requisitions.filter((r) => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      return (
        r.requisitionNumber.toLowerCase().includes(term) ||
        r.title.toLowerCase().includes(term) ||
        r.department.toLowerCase().includes(term)
      )
    }
    return true
  })

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <PageHeroBanner
        eyebrow="Talent Acquisition & Capacity Planning"
        title="Workforce Planning (Headcount Budget vs Actual)"
        description="Enforce strict organizational headcount governance: open hiring requisitions are bounded by authorized budget caps with automated exception alerts."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
              <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>
            {departments.length === 0 && (
              <Button variant="outline" size="sm" onClick={handleSeedStandards}>
                <Sparkles className="size-3.5" />
                <span>Seed Headcount Budgets</span>
              </Button>
            )}
            <Button variant="default" size="sm" onClick={() => setReqModalOpen(true)}>
              <Plus className="size-3.5" />
              <span>Raise Job Requisition</span>
            </Button>
          </div>
        }
      />

      {msg && (
        <div
          className={`flex items-center gap-2 rounded-xl p-3.5 text-sm ${
            msg.type === 'success'
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          {msg.type === 'success' ? (
            <CheckCircle2 className="size-4 text-emerald-600" />
          ) : (
            <AlertTriangle className="size-4 text-rose-600" />
          )}
          <span>{msg.text}</span>
        </div>
      )}

      {/* ── KPI Overview ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_16px_rgba(0,0,0,0.02)]">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Approved Headcount</div>
          <div className="mt-2 text-2xl font-black text-slate-900 tracking-tight">
            {summary?.totalApprovedHeadcount || 0}
          </div>
          <div className="mt-1 text-xs text-slate-400">Authorized corporate headcount cap</div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_16px_rgba(0,0,0,0.02)]">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Actual Active Staff</div>
          <div className="mt-2 text-2xl font-black text-indigo-600 tracking-tight">
            {summary?.totalActualHeadcount || 0}
          </div>
          <div className="mt-1 text-xs text-slate-400">Filled active employee positions</div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_16px_rgba(0,0,0,0.02)]">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Open Requisitions</div>
          <div className="mt-2 text-2xl font-black text-amber-600 tracking-tight">
            {summary?.totalInFlightRequisitions || 0}
          </div>
          <div className="mt-1 text-xs text-slate-400">Hiring vacancies actively in recruitment</div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_16px_rgba(0,0,0,0.02)]">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Remaining Capacity</div>
          <div className="mt-2 text-2xl font-black text-emerald-600 tracking-tight">
            {summary?.totalRemainingCapacity || 0}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {summary?.overallUtilizationPercent || 0}% overall capacity filled
          </div>
        </div>
      </div>

      {/* ── Segmented Workspace Switcher ── */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('variance')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'variance'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Building2 className="size-3.5" />
          Department Capacity & Ceilings ({departments.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('requisitions')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'requisitions'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Briefcase className="size-3.5" />
          Hiring Requisitions & Governance ({filteredReqs.length})
        </button>
      </div>

      {/* TAB 1: Headcount Budget vs Actual Breakdown */}
      {activeTab === 'variance' && (
        <SectionCard title="Departmental Headcount Budget vs Actual Variance">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Tracking active staff + in-flight requisitions against board-approved headcount ceilings.</span>
            <span className="font-mono font-semibold text-slate-700">Fiscal Period: {selectedFiscalYear}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Department</th>
                  <th className="py-2.5 px-3">Approved Budget Cap</th>
                  <th className="py-2.5 px-3">Actual Headcount</th>
                  <th className="py-2.5 px-3">In-Flight Requisitions</th>
                  <th className="py-2.5 px-3">Total Committed</th>
                  <th className="py-2.5 px-3">Remaining Capacity</th>
                  <th className="py-2.5 px-3">Capacity Utilization</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {departments.map((d: any) => (
                  <tr key={d.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3">
                      <span className="font-bold text-slate-900">{d.department}</span>
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                      {d.approvedHeadcount} positions
                    </td>
                    <td className="py-2.5 px-3 font-mono text-indigo-600 font-semibold">
                      {d.actualHeadcount}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-amber-700 font-semibold">
                      +{d.inFlightRequisitions}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                      {d.totalCommitted}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`font-mono font-bold px-2 py-0.5 rounded ${
                          d.isOverBudget
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {d.isOverBudget ? `Exceeded (${d.variance})` : `${d.remainingVacancies} available`}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full ${d.isOverBudget ? 'bg-rose-500' : 'bg-indigo-600'}`}
                            style={{ width: `${Math.min(d.utilizationPercent, 100)}%` }}
                          />
                        </div>
                        <span className="font-mono text-[11px] text-slate-500">{d.utilizationPercent}%</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingPlan(d)
                          setEditHeadcount(d.approvedHeadcount)
                          setPlanModalOpen(true)
                        }}
                      >
                        Edit Cap
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* TAB 2: Job Requisitions Ledger */}
      {activeTab === 'requisitions' && (
        <SectionCard title="Job Requisitions Governance Ledger (Headcount Bounded)">
          <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-72">
              <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-slate-400" />
              <Input
                placeholder="Search requisition # or title..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 text-xs"
              />
            </div>
            <div className="text-xs font-medium text-slate-500">
              Showing {filteredReqs.length} job requisitions
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Req #</th>
                  <th className="py-2.5 px-3">Job Title</th>
                  <th className="py-2.5 px-3">Department</th>
                  <th className="py-2.5 px-3">Openings</th>
                  <th className="py-2.5 px-3">Budget Range (₹)</th>
                  <th className="py-2.5 px-3">Headcount Governance Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReqs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No job requisitions created yet.
                    </td>
                  </tr>
                ) : (
                  filteredReqs.map((r) => {
                    const isExceeded = r.status === 'BUDGET_EXCEPTION_REQUIRED'
                    return (
                      <tr key={r.id} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-3 font-mono font-bold text-indigo-600">
                          {r.requisitionNumber}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-slate-900">{r.title}</div>
                          <div className="text-[11px] text-slate-500">{r.employmentType}</div>
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">{r.department}</td>
                        <td className="py-2.5 px-3 font-mono">{r.numberOfOpenings}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-700">
                          ₹{(r.budgetedMinCtc / 100000).toFixed(1)}L - ₹{(r.budgetedMaxCtc / 100000).toFixed(1)}L
                        </td>
                        <td className="py-2.5 px-3">
                          {isExceeded ? (
                            <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                              <ShieldAlert className="size-3" />
                              <span>Budget Exceeded (Exception Req)</span>
                            </span>
                          ) : (
                            <StatusBadge status="Active" withDot />
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {isExceeded && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleApproveException(r.id)}
                            >
                              Authorize Exception
                            </Button>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* Raise Requisition Modal */}
      <ModalWrapper
        open={reqModalOpen}
        onClose={() => setReqModalOpen(false)}
        title="Raise Job Requisition"
        subtitle={<span className="text-xs text-indigo-600 font-semibold">Headcount compliance check applied</span>}
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setReqModalOpen(false)} disabled={creatingReq}>
              Cancel
            </Button>
            <Button variant="default" size="sm" onClick={handleCreateRequisition} disabled={creatingReq}>
              {creatingReq ? 'Validating...' : 'Submit Requisition'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Job Title</label>
            <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
              <select
                value={newDept}
                onChange={(e) => setNewDept(e.target.value)}
                className="w-full rounded-xl border border-slate-300 p-2 text-xs text-slate-800 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-none"
              >
                <option value="Engineering">Engineering</option>
                <option value="Sales">Sales</option>
                <option value="Marketing">Marketing</option>
                <option value="Human Resources">Human Resources</option>
                <option value="Finance">Finance</option>
                <option value="Operations">Operations</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Openings Count</label>
              <Input
                type="number"
                min={1}
                value={newOpenings}
                onChange={(e) => setNewOpenings(parseInt(e.target.value, 10) || 1)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Min Annual CTC (₹)</label>
              <Input
                type="number"
                value={newMinCtc}
                onChange={(e) => setNewMinCtc(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Max Annual CTC (₹)</label>
              <Input
                type="number"
                value={newMaxCtc}
                onChange={(e) => setNewMaxCtc(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Business Justification</label>
            <textarea
              value={newJustification}
              onChange={(e) => setNewJustification(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-800 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-none"
              placeholder="Why this role is needed within the authorized headcount plan..."
            />
          </div>
        </div>
      </ModalWrapper>

      {/* Edit Headcount Plan Modal */}
      {editingPlan && (
        <ModalWrapper
          open={planModalOpen}
          onClose={() => setPlanModalOpen(false)}
          title={`Adjust Approved Headcount: ${editingPlan.department}`}
          subtitle={<span className="text-xs text-purple-700">{selectedFiscalYear}</span>}
          size="sm"
          footer={
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setPlanModalOpen(false)} disabled={savingPlan}>
                Cancel
              </Button>
              <Button variant="default" size="sm" onClick={handleSaveHeadcountPlan} disabled={savingPlan}>
                {savingPlan ? 'Saving...' : 'Update Budget Cap'}
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Approved Headcount Positions
              </label>
              <Input
                type="number"
                min={1}
                value={editHeadcount}
                onChange={(e) => setEditHeadcount(parseInt(e.target.value, 10) || 1)}
              />
            </div>
          </div>
        </ModalWrapper>
      )}
    </div>
  )
}
