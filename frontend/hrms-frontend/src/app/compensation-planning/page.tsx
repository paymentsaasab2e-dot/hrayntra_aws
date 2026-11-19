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
  Coins,
  TrendingUp,
  PieChart,
  Users,
  CheckCircle2,
  AlertCircle,
  Plus,
  RefreshCw,
  Search,
  Sliders,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Building2,
  Target,
} from 'lucide-react'

export default function CompensationPlanningPage() {
  const [loading, setLoading] = React.useState(true)
  const [cycles, setCycles] = React.useState<any[]>([])
  const [selectedCycleId, setSelectedCycleId] = React.useState<string>('')
  const [dashboard, setDashboard] = React.useState<any>(null)
  const [activeTab, setActiveTab] = React.useState<'worksheet' | 'pools' | 'rules'>('worksheet')

  // Modals
  const [createModalOpen, setCreateModalOpen] = React.useState(false)
  const [newCycleName, setNewCycleName] = React.useState('Annual Appraisal FY2026-27')
  const [newCycleCode, setNewCycleCode] = React.useState('INC-2026-ANNUAL')
  const [newCycleFiscal, setNewCycleFiscal] = React.useState('FY2026-27')
  const [newCycleBudget, setNewCycleBudget] = React.useState('5000000')
  const [newCycleEffective, setNewCycleEffective] = React.useState('2026-04-01')
  const [creatingCycle, setCreatingCycle] = React.useState(false)

  // Recommendation Edit Modal
  const [editModalOpen, setEditModalOpen] = React.useState(false)
  const [editingRec, setEditingRec] = React.useState<any>(null)
  const [editPercent, setEditPercent] = React.useState<number>(10)
  const [editNotes, setEditNotes] = React.useState<string>('')
  const [savingRec, setSavingRec] = React.useState(false)

  // Notification message
  const [msg, setMsg] = React.useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [searchTerm, setSearchTerm] = React.useState('')

  const loadData = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.compensationPlanning.listCycles()
      if (res?.data) {
        setCycles(res.data)
        const targetId = selectedCycleId || (res.data[0] ? res.data[0].id : '')
        if (targetId) {
          setSelectedCycleId(targetId)
          const dash = await api.compensationPlanning.getCycleDashboard(targetId)
          if (dash?.data) setDashboard(dash.data)
        }
      }
    } catch (err: any) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [selectedCycleId])

  React.useEffect(() => {
    loadData()
  }, [loadData])

  const handleSelectCycle = async (id: string) => {
    setSelectedCycleId(id)
    setLoading(true)
    try {
      const dash = await api.compensationPlanning.getCycleDashboard(id)
      if (dash?.data) setDashboard(dash.data)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateCycle = async () => {
    setCreatingCycle(true)
    setMsg(null)
    try {
      const res = await api.compensationPlanning.createCycle({
        name: newCycleName,
        code: newCycleCode,
        fiscalYear: newCycleFiscal,
        totalBudgetAmount: parseFloat(newCycleBudget) || 5000000,
        effectiveDate: newCycleEffective,
      })
      setMsg({ text: `Created cycle ${res.data.name}`, type: 'success' })
      setCreateModalOpen(false)
      setSelectedCycleId(res.data.id)
      loadData()
    } catch (err: any) {
      setMsg({ text: err.message || 'Failed to create cycle', type: 'error' })
    } finally {
      setCreatingCycle(false)
    }
  }

  const handleGenerateRecommendations = async () => {
    if (!selectedCycleId) return
    setLoading(true)
    setMsg(null)
    try {
      const res = await api.compensationPlanning.generateRecommendations(selectedCycleId)
      setMsg({
        text: `Generated ${res.data.totalRecommendations} recommendations using rating matrix & compa-ratio bands!`,
        type: 'success',
      })
      handleSelectCycle(selectedCycleId)
    } catch (err: any) {
      setMsg({ text: err.message || 'Failed to generate recommendations', type: 'error' })
      setLoading(false)
    }
  }

  const handleApplyCycle = async () => {
    if (!selectedCycleId) return
    if (!confirm('Are you sure you want to approve and apply this compensation cycle to employee payroll?')) return
    setLoading(true)
    setMsg(null)
    try {
      const res = await api.compensationPlanning.applyCycle(selectedCycleId)
      setMsg({
        text: `Successfully applied salary increments to ${res.data.appliedCount} employees effective ${new Date(res.data.effectiveDate).toLocaleDateString()}!`,
        type: 'success',
      })
      handleSelectCycle(selectedCycleId)
    } catch (err: any) {
      setMsg({ text: err.message || 'Failed to apply cycle', type: 'error' })
      setLoading(false)
    }
  }

  const handleSaveRecommendation = async () => {
    if (!editingRec) return
    setSavingRec(true)
    try {
      await api.compensationPlanning.updateRecommendation(editingRec.id, {
        recommendedPercent: editPercent,
        managerNotes: editNotes,
      })
      setEditModalOpen(false)
      handleSelectCycle(selectedCycleId)
    } catch (err: any) {
      alert(err.message || 'Failed to save')
    } finally {
      setSavingRec(false)
    }
  }

  const recommendations = dashboard?.recommendations || []
  const filteredRecs = recommendations.filter((r: any) => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      const name = `${r.employee?.firstName || ''} ${r.employee?.lastName || ''}`.toLowerCase()
      const dept = (r.employee?.department || '').toLowerCase()
      return name.includes(term) || dept.includes(term)
    }
    return true
  })

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <PageHeroBanner
        eyebrow="Total Rewards & Comp Planning"
        title="Compensation Planning & Increment Cycles"
        description="Merit matrix recommendations aligned with compa-ratio benchmarks, departmental budget pools, and automated payroll updates."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
              <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>
            <Button variant="default" size="sm" onClick={() => setCreateModalOpen(true)}>
              <Plus className="size-3.5" />
              <span>New Increment Cycle</span>
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
            <AlertCircle className="size-4 text-rose-600" />
          )}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Cycle Header & Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-700">Active Cycle:</span>
          <select
            value={selectedCycleId}
            onChange={(e) => handleSelectCycle(e.target.value)}
            className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-none"
          >
            {cycles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.fiscalYear}) — {c.status}
              </option>
            ))}
          </select>
          {dashboard?.cycle && (
            <StatusBadge status={dashboard.cycle.status === 'APPLIED' ? 'Active' : 'Pending'} withDot />
          )}
        </div>

        <div className="flex items-center gap-2">
          {dashboard?.cycle && dashboard.cycle.status !== 'APPLIED' && (
            <>
              <Button variant="outline" size="sm" onClick={handleGenerateRecommendations}>
                <Sparkles className="size-3.5" />
                <span>Auto-Calculate Merit Grid</span>
              </Button>
              <Button variant="default" size="sm" onClick={handleApplyCycle}>
                <ShieldCheck className="size-3.5" />
                <span>Approve & Apply to Payroll</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_16px_rgba(0,0,0,0.02)]">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Budget Allocated</div>
          <div className="mt-2 text-2xl font-black text-slate-900 tracking-tight">
            ₹{(dashboard?.cycle?.totalBudgetAmount || 0).toLocaleString('en-IN')}
          </div>
          <div className="mt-1 text-xs text-slate-400">Total company increment pool</div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_16px_rgba(0,0,0,0.02)]">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Hike Committed</div>
          <div className="mt-2 text-2xl font-black text-indigo-600 tracking-tight">
            ₹{(dashboard?.metrics?.totalHikeCommitted || 0).toLocaleString('en-IN')}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {dashboard?.metrics?.budgetUtilizationPercent || 0}% budget utilized
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_16px_rgba(0,0,0,0.02)]">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Average Increment</div>
          <div className="mt-2 text-2xl font-black text-emerald-600 tracking-tight">
            {dashboard?.metrics?.averageHikePercent || 0}%
          </div>
          <div className="mt-1 text-xs text-slate-400">Across {dashboard?.metrics?.eligibleEmployees || 0} employees</div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_16px_rgba(0,0,0,0.02)]">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Compa-Ratio Distribution</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xs text-rose-600 font-bold">{dashboard?.compaRatioDistribution?.belowMarketCount || 0} Low</span>
            <span className="text-xs text-emerald-600 font-bold">· {dashboard?.compaRatioDistribution?.targetBandCount || 0} Mid</span>
            <span className="text-xs text-indigo-600 font-bold">· {dashboard?.compaRatioDistribution?.aboveMarketCount || 0} High</span>
          </div>
          <div className="mt-1 text-xs text-slate-400">Market benchmark placement</div>
        </div>
      </div>

      {/* ── Segmented Tab Switcher ── */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('worksheet')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'worksheet'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Users className="size-3.5" />
          Employee Worksheet ({filteredRecs.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('pools')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'pools'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Building2 className="size-3.5" />
          Department Pools ({(dashboard?.departmentPools || []).length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('rules')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'rules'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Target className="size-3.5" />
          Merit Matrix Benchmark Rules
        </button>
      </div>

      {/* TAB 1: Employee Worksheet */}
      {activeTab === 'worksheet' && (
        <SectionCard title="Employee Increment Worksheet & Compa-Ratio Alignment">
          <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-72">
              <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-slate-400" />
              <Input
                placeholder="Search employee or department..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 text-xs"
              />
            </div>
            <div className="text-xs font-medium text-slate-500">
              Showing {filteredRecs.length} employee recommendations in review
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Employee</th>
                  <th className="py-2.5 px-3">Current Annual CTC</th>
                  <th className="py-2.5 px-3">Compa-Ratio</th>
                  <th className="py-2.5 px-3">Perf Rating</th>
                  <th className="py-2.5 px-3">Recommended %</th>
                  <th className="py-2.5 px-3">Hike Amount</th>
                  <th className="py-2.5 px-3">New Proposed CTC</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecs.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      No recommendations found. Click &quot;Auto-Calculate Merit Grid&quot; to populate.
                    </td>
                  </tr>
                ) : (
                  filteredRecs.map((rec: any) => {
                    const empName = `${rec.employee?.firstName || ''} ${rec.employee?.lastName || ''}`
                    const ratio = rec.compaRatio || 100
                    return (
                      <tr key={rec.id} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-slate-900">{empName}</div>
                          <div className="text-slate-500 text-[11px]">{rec.employee?.department} · {rec.employee?.designation}</div>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-800">
                          ₹{rec.currentCtc.toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`font-mono px-2 py-0.5 rounded text-[11px] font-semibold ${
                              ratio < 85
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : ratio > 115
                                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            {ratio}%
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                          ⭐ {rec.performanceRating || 3.8}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-indigo-600">
                          +{rec.recommendedPercent}%
                        </td>
                        <td className="py-2.5 px-3 font-mono text-emerald-700 font-semibold">
                          +₹{rec.recommendedHikeAmount.toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                          ₹{rec.newProposedCtc.toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 px-3">
                          <StatusBadge status={rec.status === 'APPLIED' ? 'Active' : 'Pending'} />
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingRec(rec)
                              setEditPercent(rec.recommendedPercent)
                              setEditNotes(rec.managerNotes || '')
                              setEditModalOpen(true)
                            }}
                          >
                            <Sliders className="size-3.5" />
                            <span>Adjust</span>
                          </Button>
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

      {/* TAB 2: Department Pools */}
      {activeTab === 'pools' && (
        <SectionCard title="Department Budget Pools & Utilization">
          <div className="p-4 border-b border-slate-100 text-xs text-slate-500">
            Departmental budget pools with real-time allocation tracking and eligible headcount counts.
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Department</th>
                  <th className="py-2.5 px-3">Eligible Headcount</th>
                  <th className="py-2.5 px-3">Allocated Pool (₹)</th>
                  <th className="py-2.5 px-3">Spent Amount (₹)</th>
                  <th className="py-2.5 px-3">Average Hike %</th>
                  <th className="py-2.5 px-3">Budget Utilization</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(dashboard?.departmentPools || []).map((pool: any) => {
                  const util = pool.allocatedBudget > 0
                    ? Math.round((pool.spentBudget / pool.allocatedBudget) * 100)
                    : 0
                  return (
                    <tr key={pool.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-3 font-bold text-slate-800">{pool.department}</td>
                      <td className="py-2.5 px-3 text-slate-600">{pool.eligibleHeadcount}</td>
                      <td className="py-2.5 px-3 font-mono">₹{pool.allocatedBudget.toLocaleString('en-IN')}</td>
                      <td className="py-2.5 px-3 font-mono font-semibold text-slate-900">
                        ₹{pool.spentBudget.toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-indigo-600 font-semibold">
                        {pool.averageHikePercent}%
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={`h-full ${util > 100 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                              style={{ width: `${Math.min(util, 100)}%` }}
                            />
                          </div>
                          <span className="font-mono text-[11px] text-slate-500">{util}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* TAB 3: Merit Matrix Grid Rules */}
      {activeTab === 'rules' && (
        <SectionCard title="Merit Increment Matrix (Performance Rating × Compa-Ratio Band)">
          <div className="p-4 border-b border-slate-100 text-xs text-slate-500">
            Guideline increment grid used to auto-calculate recommended hike percentages based on market positioning.
          </div>
          <div className="p-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Performance Rating</th>
                  <th className="py-2.5 px-3">Compa-Ratio &lt; 85% (Below Market)</th>
                  <th className="py-2.5 px-3">Compa-Ratio 85%–115% (Target Band)</th>
                  <th className="py-2.5 px-3">Compa-Ratio &gt; 115% (Above Market)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-bold text-slate-900">5.0 (Outstanding)</td>
                  <td className="py-2.5 px-3 font-mono font-bold text-emerald-600">+20.0%</td>
                  <td className="py-2.5 px-3 font-mono font-bold text-indigo-600">+15.0%</td>
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-700">+12.0%</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-bold text-slate-900">4.0 (Exceeds Expectations)</td>
                  <td className="py-2.5 px-3 font-mono font-bold text-emerald-600">+15.0%</td>
                  <td className="py-2.5 px-3 font-mono font-bold text-indigo-600">+11.0%</td>
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-700">+9.0%</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-bold text-slate-900">3.0 (Meets Expectations)</td>
                  <td className="py-2.5 px-3 font-mono font-bold text-emerald-600">+10.0%</td>
                  <td className="py-2.5 px-3 font-mono font-bold text-indigo-600">+8.0%</td>
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-700">+6.0%</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-bold text-slate-900">2.0 (Needs Improvement)</td>
                  <td className="py-2.5 px-3 font-mono font-bold text-amber-600">+4.0%</td>
                  <td className="py-2.5 px-3 font-mono font-bold text-amber-600">+2.0%</td>
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-400">0.0%</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-bold text-slate-900">1.0 (Unsatisfactory)</td>
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-400">0.0%</td>
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-400">0.0%</td>
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-400">0.0%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* Create Cycle Modal */}
      <ModalWrapper
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create Compensation Increment Cycle"
        subtitle={<span className="text-xs text-purple-700">Annual appraisal cycle setup</span>}
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setCreateModalOpen(false)} disabled={creatingCycle}>
              Cancel
            </Button>
            <Button variant="default" size="sm" onClick={handleCreateCycle} disabled={creatingCycle}>
              {creatingCycle ? 'Creating...' : 'Create Increment Cycle'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Cycle Name</label>
            <Input value={newCycleName} onChange={(e) => setNewCycleName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Code</label>
              <Input value={newCycleCode} onChange={(e) => setNewCycleCode(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Fiscal Year</label>
              <Input value={newCycleFiscal} onChange={(e) => setNewCycleFiscal(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Total Pool Budget (₹)</label>
              <Input
                type="number"
                value={newCycleBudget}
                onChange={(e) => setNewCycleBudget(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Effective Date</label>
              <Input
                type="date"
                value={newCycleEffective}
                onChange={(e) => setNewCycleEffective(e.target.value)}
              />
            </div>
          </div>
        </div>
      </ModalWrapper>

      {/* Adjust Recommendation Modal */}
      {editingRec && (
        <ModalWrapper
          open={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          title={`Adjust Increment: ${editingRec.employee?.firstName} ${editingRec.employee?.lastName}`}
          subtitle={<span className="text-xs text-slate-500">{editingRec.employee?.department}</span>}
          size="md"
          footer={
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditModalOpen(false)} disabled={savingRec}>
                Cancel
              </Button>
              <Button variant="default" size="sm" onClick={handleSaveRecommendation} disabled={savingRec}>
                {savingRec ? 'Saving...' : 'Save Recommendation'}
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 border border-slate-200 text-xs">
              <div>
                <span className="text-slate-500">Current CTC:</span>
                <p className="font-mono font-bold text-slate-800">₹{editingRec.currentCtc.toLocaleString('en-IN')}</p>
              </div>
              <div>
                <span className="text-slate-500">Compa-Ratio:</span>
                <p className="font-mono font-bold text-purple-700">{editingRec.compaRatio || 100}%</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Recommended Increment %
              </label>
              <Input
                type="number"
                step="0.5"
                value={editPercent}
                onChange={(e) => setEditPercent(parseFloat(e.target.value) || 0)}
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Calculated hike: +₹{Math.round((editingRec.currentCtc * editPercent) / 100).toLocaleString('en-IN')} $\to$ New CTC: ₹{Math.round(editingRec.currentCtc * (1 + editPercent / 100)).toLocaleString('en-IN')}
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Manager Justification / Notes</label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-800 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-none"
                placeholder="Rationale for adjustment..."
              />
            </div>
          </div>
        </ModalWrapper>
      )}
    </div>
  )
}
