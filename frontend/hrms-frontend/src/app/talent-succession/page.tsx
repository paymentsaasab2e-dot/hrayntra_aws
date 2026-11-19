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
  Users,
  Award,
  TrendingUp,
  Target,
  Sparkles,
  RefreshCw,
  Plus,
  Search,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  Shield,
  Layers,
} from 'lucide-react'

export default function TalentSuccessionPage() {
  const [loading, setLoading] = React.useState(true)
  const [activeTab, setActiveTab] = React.useState<'ninebox' | 'skills' | 'succession'>('ninebox')

  // 9-Box Data
  const [nineBoxData, setNineBoxData] = React.useState<any>(null)
  const [employees, setEmployees] = React.useState<any[]>([])

  // Skills Data
  const [skills, setSkills] = React.useState<any[]>([])
  const [selectedEmpId, setSelectedEmpId] = React.useState<string>('')
  const [employeeSkills, setEmployeeSkills] = React.useState<any[]>([])

  // Succession Plans
  const [plans, setPlans] = React.useState<any[]>([])

  // Modals
  const [assessModalOpen, setAssessModalOpen] = React.useState(false)
  const [assessEmpId, setAssessEmpId] = React.useState('')
  const [assessPerf, setAssessPerf] = React.useState(3)
  const [assessPot, setAssessPot] = React.useState(3)
  const [flightRisk, setFlightRisk] = React.useState('LOW')
  const [impactOfLoss, setImpactOfLoss] = React.useState('HIGH')
  const [assessing, setAssessing] = React.useState(false)

  // Add Plan Modal
  const [planModalOpen, setPlanModalOpen] = React.useState(false)
  const [newPlanTitle, setNewPlanTitle] = React.useState('VP of Engineering')
  const [newPlanDept, setNewPlanDept] = React.useState('Engineering')
  const [newPlanIncumbent, setNewPlanIncumbent] = React.useState('')
  const [newPlanCriticality, setNewPlanCriticality] = React.useState('CRITICAL')
  const [creatingPlan, setCreatingPlan] = React.useState(false)

  // Add Candidate Modal
  const [candModalOpen, setCandModalOpen] = React.useState(false)
  const [selectedPlanId, setSelectedPlanId] = React.useState('')
  const [candEmpId, setCandEmpId] = React.useState('')
  const [candReadiness, setCandReadiness] = React.useState('READY_NOW')
  const [candRanking, setCandRanking] = React.useState(1)
  const [addingCand, setAddingCand] = React.useState(false)

  const [msg, setMsg] = React.useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const loadData = React.useCallback(async () => {
    setLoading(true)
    try {
      const [nineRes, empRes, skillsRes, plansRes] = await Promise.all([
        api.talentSuccession.getNineBoxMatrix('2026').catch(() => ({ data: null })),
        api.employees.getAll().catch(() => ({ data: [] })),
        api.talentSuccession.listSkills().catch(() => ({ data: [] })),
        api.talentSuccession.listPlans().catch(() => ({ data: [] })),
      ])

      if (nineRes?.data) setNineBoxData(nineRes.data)
      if (empRes?.data) {
        setEmployees(empRes.data)
        if (empRes.data.length > 0 && !selectedEmpId) {
          setSelectedEmpId(empRes.data[0].id)
          const sRes = await api.talentSuccession.getEmployeeSkillMatrix(empRes.data[0].id).catch(() => ({ data: [] }))
          if (sRes?.data) setEmployeeSkills(sRes.data)
        }
      }
      if (skillsRes?.data) setSkills(skillsRes.data)
      if (plansRes?.data) setPlans(plansRes.data)
    } catch (err: any) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [selectedEmpId])

  React.useEffect(() => {
    loadData()
  }, [loadData])

  const handleSelectEmployeeForSkills = async (empId: string) => {
    setSelectedEmpId(empId)
    const res = await api.talentSuccession.getEmployeeSkillMatrix(empId).catch(() => ({ data: [] }))
    if (res?.data) setEmployeeSkills(res.data)
  }

  const handleSeedSkills = async () => {
    try {
      setMsg(null)
      const res = await api.talentSuccession.seedSkills()
      setMsg({ text: `Seeded ${res.data.length} standard competencies`, type: 'success' })
      loadData()
    } catch (err: any) {
      setMsg({ text: err.message || 'Failed to seed skills', type: 'error' })
    }
  }

  const handleAssessTalent = async () => {
    if (!assessEmpId) return
    setAssessing(true)
    setMsg(null)
    try {
      const res = await api.talentSuccession.assessTalent(assessEmpId, {
        performanceLevel: assessPerf,
        potentialLevel: assessPot,
        flightRisk,
        impactOfLoss,
      })
      setMsg({
        text: `Assessed talent placement: ${res.data.nineBoxGrid} for employee!`,
        type: 'success',
      })
      setAssessModalOpen(false)
      loadData()
    } catch (err: any) {
      setMsg({ text: err.message || 'Failed to assess talent', type: 'error' })
    } finally {
      setAssessing(false)
    }
  }

  const handleCreatePlan = async () => {
    setCreatingPlan(true)
    setMsg(null)
    try {
      await api.talentSuccession.createPlan({
        positionTitle: newPlanTitle,
        department: newPlanDept,
        currentIncumbentId: newPlanIncumbent || undefined,
        criticality: newPlanCriticality,
      })
      setMsg({ text: `Succession plan for ${newPlanTitle} created successfully`, type: 'success' })
      setPlanModalOpen(false)
      loadData()
    } catch (err: any) {
      setMsg({ text: err.message || 'Failed to create plan', type: 'error' })
    } finally {
      setCreatingPlan(false)
    }
  }

  const handleAddCandidate = async () => {
    if (!selectedPlanId || !candEmpId) return
    setAddingCand(true)
    setMsg(null)
    try {
      await api.talentSuccession.addCandidate(selectedPlanId, {
        candidateEmployeeId: candEmpId,
        readiness: candReadiness,
        ranking: candRanking,
      })
      setMsg({ text: 'Added candidate to succession pipeline', type: 'success' })
      setCandModalOpen(false)
      loadData()
    } catch (err: any) {
      setMsg({ text: err.message || 'Failed to add candidate', type: 'error' })
    } finally {
      setAddingCand(false)
    }
  }

  const handleUpdateProficiency = async (skillId: string, level: number) => {
    if (!selectedEmpId) return
    try {
      await api.talentSuccession.recordSkillProficiency(selectedEmpId, skillId, level)
      handleSelectEmployeeForSkills(selectedEmpId)
    } catch (err: any) {
      alert(err.message || 'Failed to update skill')
    }
  }

  const grid = nineBoxData?.grid || {}

  // 9-Box layout coordinates: rows = Potential (High to Low: 3, 2, 1), columns = Performance (Low to High: 1, 2, 3)
  const rows = [
    [
      { id: '1_3', key: 'ROUGH_DIAMOND', title: 'Rough Diamond', color: 'bg-amber-50/70 border-amber-200' },
      { id: '2_3', key: 'RISING_STAR', title: 'Rising Star', color: 'bg-indigo-50/70 border-indigo-200' },
      { id: '3_3', key: 'STAR', title: 'Star (Top Executive)', color: 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500/20' },
    ],
    [
      { id: '1_2', key: 'INCONSISTENT', title: 'Inconsistent', color: 'bg-rose-50/50 border-rose-200' },
      { id: '2_2', key: 'CORE_PLAYER', title: 'Core Player', color: 'bg-blue-50/70 border-blue-200' },
      { id: '3_2', key: 'HIGH_PERFORMER', title: 'High Performer', color: 'bg-indigo-50/70 border-indigo-200' },
    ],
    [
      { id: '1_1', key: 'UNDERPERFORMER', title: 'Risk / Underperformer', color: 'bg-rose-100/60 border-rose-300' },
      { id: '2_1', key: 'EFFECTIVE_PERFORMER', title: 'Effective Performer', color: 'bg-slate-50 border-slate-200' },
      { id: '3_1', key: 'TRUSTED_PROFESSIONAL', title: 'Trusted Specialist', color: 'bg-blue-50/70 border-blue-200' },
    ],
  ]

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <PageHeroBanner
        eyebrow="Talent Architecture & Leadership Bench"
        title="Succession Planning, Skill Matrix & 9-Box"
        description="Comprehensive 9-Box talent categorization, competency framework with skill gap evaluations, and critical executive role succession benches."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
              <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>
            {skills.length === 0 && (
              <Button variant="outline" size="sm" onClick={handleSeedSkills}>
                <Sparkles className="size-3.5" />
                <span>Seed Competencies</span>
              </Button>
            )}
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                if (employees.length > 0) setAssessEmpId(employees[0].id)
                setAssessModalOpen(true)
              }}
            >
              <Award className="size-3.5" />
              <span>Assess Employee 9-Box</span>
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

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-6 text-sm font-semibold text-slate-600">
        <button
          onClick={() => setActiveTab('ninebox')}
          className={`pb-3 font-semibold transition-colors ${
            activeTab === 'ninebox'
              ? 'border-b-2 border-indigo-600 text-indigo-600'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          9-Box Talent Matrix ({nineBoxData?.totalAssessed || 0} Assessed)
        </button>
        <button
          onClick={() => setActiveTab('skills')}
          className={`pb-3 font-semibold transition-colors ${
            activeTab === 'skills'
              ? 'border-b-2 border-indigo-600 text-indigo-600'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          Competency Framework & Skill Matrix ({skills.length} Skills)
        </button>
        <button
          onClick={() => setActiveTab('succession')}
          className={`pb-3 font-semibold transition-colors ${
            activeTab === 'succession'
              ? 'border-b-2 border-indigo-600 text-indigo-600'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          Critical Roles & Succession Pipelines ({plans.length} Positions)
        </button>
      </div>

      {/* TAB 1: 9-Box Grid */}
      {activeTab === 'ninebox' && (
        <SectionCard title="Performance vs Potential (9-Box Grid Review)">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Y-Axis: Growth Potential (Low $\to$ High) · X-Axis: Performance Delivery (Low $\to$ High)</span>
            <div className="flex items-center gap-3">
              <span className="font-semibold text-purple-700">HiPos: {nineBoxData?.hiPoCount || 0}</span>
              <span className="font-semibold text-rose-600">Risks: {nineBoxData?.riskCount || 0}</span>
            </div>
          </div>

          <div className="p-5">
            <div className="grid grid-cols-3 gap-4">
              {rows.map((row, rowIdx) =>
                row.map((cell) => {
                  const box = grid[cell.key] || { employees: [] }
                  const emps = box.employees || []
                  return (
                    <div
                      key={cell.id}
                      className={`min-h-[180px] rounded-2xl border p-4 shadow-sm flex flex-col justify-between ${cell.color}`}
                    >
                      <div>
                        <div className="flex items-start justify-between">
                          <h4 className="text-xs font-bold text-slate-900">{cell.title}</h4>
                          <span className="font-mono text-xs font-extrabold bg-white/80 border px-2 py-0.5 rounded-full text-slate-800">
                            {emps.length}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500 leading-tight">
                          {box.definition?.category || 'Talent Pool'}
                        </p>
                      </div>

                      <div className="my-2 space-y-1.5 overflow-y-auto max-h-[110px]">
                        {emps.length === 0 ? (
                          <div className="text-[11px] text-slate-400 italic">No employees mapped</div>
                        ) : (
                          emps.map((empItem: any) => {
                            const emp = empItem.employee
                            return (
                              <div
                                key={empItem.id}
                                className="flex items-center justify-between rounded-lg bg-white/90 p-1.5 border border-slate-200/60 shadow-xs"
                              >
                                <div className="truncate">
                                  <div className="text-xs font-bold text-slate-900 truncate">
                                    {emp?.firstName} {emp?.lastName}
                                  </div>
                                  <div className="text-[10px] text-slate-500 truncate">{emp?.department}</div>
                                </div>
                                <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${
                                  empItem.flightRisk === 'HIGH' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {empItem.flightRisk}
                                </span>
                              </div>
                            )
                          })
                        )}
                      </div>

                      <div className="text-[10px] text-slate-500 truncate pt-1 border-t border-slate-200/40">
                        {box.definition?.actionGuidance || 'Develop & review'}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </SectionCard>
      )}

      {/* TAB 2: Competency Framework & Skill Matrix */}
      {activeTab === 'skills' && (
        <SectionCard title="Competency Framework & Employee Skill Gap Analysis">
          <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">Select Employee:</span>
              <select
                value={selectedEmpId}
                onChange={(e) => handleSelectEmployeeForSkills(e.target.value)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 shadow-sm focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-none"
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.firstName} {emp.lastName} ({emp.department})
                  </option>
                ))}
              </select>
            </div>
            <div className="text-xs text-slate-500">
              Proficiency Benchmark: 1 (Beginner) $\to$ 5 (Expert)
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Competency / Skill</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Benchmark Required Level</th>
                  <th className="py-2.5 px-3">Assessed Proficiency</th>
                  <th className="py-2.5 px-3">Gap Status</th>
                  <th className="py-2.5 px-3 text-right">Quick Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employeeSkills.map((s) => (
                  <tr key={s.skillId} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-900">{s.name}</div>
                      <div className="font-mono text-[11px] text-slate-400">{s.code}</div>
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-indigo-700">{s.category}</td>
                    <td className="py-2.5 px-3 font-mono font-semibold">Level {s.minRequiredLevel}/5</td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1 font-mono font-bold text-slate-900">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <span
                            key={i}
                            className={`size-2.5 rounded-full ${
                              i < s.currentProficiencyLevel ? 'bg-indigo-600' : 'bg-slate-200'
                            }`}
                          />
                        ))}
                        <span className="ml-1.5">Lvl {s.currentProficiencyLevel}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      {s.hasGap ? (
                        <span className="inline-flex items-center gap-1 font-mono text-[11px] text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                          Gap: -{s.skillGap} Level{s.skillGap > 1 ? 's' : ''}
                        </span>
                      ) : (
                        <StatusBadge status="Active" withDot />
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((lvl) => (
                          <button
                            key={lvl}
                            onClick={() => handleUpdateProficiency(s.skillId, lvl)}
                            className={`size-5 rounded text-[10px] font-mono font-bold transition-all ${
                              s.currentProficiencyLevel === lvl
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {lvl}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* TAB 3: Succession Planning & Critical Roles */}
      {activeTab === 'succession' && (
        <SectionCard title="Critical Role Succession Pipelines & Bench Strength">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Critical leadership positions mapped against candidate bench readiness.</span>
            <Button variant="default" size="sm" onClick={() => setPlanModalOpen(true)}>
              <Plus className="size-3.5" />
              <span>Create Succession Plan</span>
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
            {plans.map((p) => {
              const incumbent = p.currentIncumbent
              const incumbentName = incumbent
                ? `${incumbent.firstName} ${incumbent.lastName}`
                : 'Vacant / Position Open'
              const candidates = p.candidates || []
              return (
                <div key={p.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono text-xs font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                        {p.criticality} CRITICALITY
                      </span>
                      <h4 className="mt-2 text-base font-bold text-slate-900">{p.positionTitle}</h4>
                      <p className="text-xs text-slate-500">{p.department}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedPlanId(p.id)
                        if (employees.length > 0) setCandEmpId(employees[0].id)
                        setCandModalOpen(true)
                      }}
                    >
                      <Plus className="size-3" />
                      <span>Add Successor</span>
                    </Button>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-3 border border-slate-200/80 text-xs flex items-center justify-between">
                    <div>
                      <span className="text-slate-500 block text-[11px]">Current Incumbent:</span>
                      <span className="font-bold text-slate-900">{incumbentName}</span>
                    </div>
                    <StatusBadge status={incumbent ? 'Active' : 'Action Required'} />
                  </div>

                  {/* Candidate Bench */}
                  <div>
                    <h5 className="text-xs font-bold text-slate-700 mb-2">Succession Bench ({candidates.length})</h5>
                    {candidates.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
                        No successors nominated yet. Emergency risk high.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {candidates.map((cand: any) => {
                          const cEmp = cand.candidateEmployee
                          return (
                            <div
                              key={cand.id}
                              className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 p-2.5 text-xs"
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold text-slate-400">#{cand.ranking}</span>
                                <div>
                                  <div className="font-bold text-slate-900">{cEmp?.firstName} {cEmp?.lastName}</div>
                                  <div className="text-[11px] text-slate-500">{cEmp?.designation}</div>
                                </div>
                              </div>
                              <span
                                className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded ${
                                  cand.readiness === 'READY_NOW'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                                }`}
                              >
                                {cand.readiness.replace('_', ' ')}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </SectionCard>
      )}

      {/* Assess Talent Modal */}
      <ModalWrapper
        open={assessModalOpen}
        onClose={() => setAssessModalOpen(false)}
        title="Assess Employee for 9-Box Matrix"
        subtitle={<span className="text-xs text-purple-700">Talent calibration review</span>}
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setAssessModalOpen(false)} disabled={assessing}>
              Cancel
            </Button>
            <Button variant="default" size="sm" onClick={handleAssessTalent} disabled={assessing}>
              {assessing ? 'Evaluating...' : 'Confirm Assessment'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Employee</label>
            <select
              value={assessEmpId}
              onChange={(e) => setAssessEmpId(e.target.value)}
              className="w-full rounded-xl border border-slate-300 p-2 text-xs text-slate-800 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-none"
            >
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.firstName} {emp.lastName} ({emp.department})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Performance (Delivery)</label>
              <select
                value={assessPerf}
                onChange={(e) => setAssessPerf(parseInt(e.target.value, 10))}
                className="w-full rounded-xl border border-slate-300 p-2 text-xs text-slate-800 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-none"
              >
                <option value={3}>3 - High Performance</option>
                <option value={2}>2 - Medium Performance</option>
                <option value={1}>1 - Low Performance</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Potential (Growth/Leadership)</label>
              <select
                value={assessPot}
                onChange={(e) => setAssessPot(parseInt(e.target.value, 10))}
                className="w-full rounded-xl border border-slate-300 p-2 text-xs text-slate-800 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-none"
              >
                <option value={3}>3 - High Potential</option>
                <option value={2}>2 - Medium Potential</option>
                <option value={1}>1 - Low Potential</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Flight Risk</label>
              <select
                value={flightRisk}
                onChange={(e) => setFlightRisk(e.target.value)}
                className="w-full rounded-xl border border-slate-300 p-2 text-xs text-slate-800 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-none"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Impact of Loss</label>
              <select
                value={impactOfLoss}
                onChange={(e) => setImpactOfLoss(e.target.value)}
                className="w-full rounded-xl border border-slate-300 p-2 text-xs text-slate-800 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-none"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
          </div>
        </div>
      </ModalWrapper>

      {/* Create Succession Plan Modal */}
      <ModalWrapper
        open={planModalOpen}
        onClose={() => setPlanModalOpen(false)}
        title="Create Critical Position Succession Plan"
        subtitle={<span className="text-xs text-purple-700">Role continuity governance</span>}
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setPlanModalOpen(false)} disabled={creatingPlan}>
              Cancel
            </Button>
            <Button variant="default" size="sm" onClick={handleCreatePlan} disabled={creatingPlan}>
              {creatingPlan ? 'Creating...' : 'Create Plan'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Position Title</label>
            <Input value={newPlanTitle} onChange={(e) => setNewPlanTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
              <Input value={newPlanDept} onChange={(e) => setNewPlanDept(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Criticality</label>
              <select
                value={newPlanCriticality}
                onChange={(e) => setNewPlanCriticality(e.target.value)}
                className="w-full rounded-xl border border-slate-300 p-2 text-xs text-slate-800 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-none"
              >
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Current Incumbent</label>
            <select
              value={newPlanIncumbent}
              onChange={(e) => setNewPlanIncumbent(e.target.value)}
              className="w-full rounded-xl border border-slate-300 p-2 text-xs text-slate-800 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-none"
            >
              <option value="">-- None / Vacant --</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.firstName} {emp.lastName} ({emp.designation})
                </option>
              ))}
            </select>
          </div>
        </div>
      </ModalWrapper>

      {/* Add Successor Candidate Modal */}
      <ModalWrapper
        open={candModalOpen}
        onClose={() => setCandModalOpen(false)}
        title="Nominate Successor Candidate"
        subtitle={<span className="text-xs text-indigo-700 font-semibold">Bench addition</span>}
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setCandModalOpen(false)} disabled={addingCand}>
              Cancel
            </Button>
            <Button variant="default" size="sm" onClick={handleAddCandidate} disabled={addingCand}>
              {addingCand ? 'Adding...' : 'Nominate Successor'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Candidate Employee</label>
            <select
              value={candEmpId}
              onChange={(e) => setCandEmpId(e.target.value)}
              className="w-full rounded-xl border border-slate-300 p-2 text-xs text-slate-800 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-none"
            >
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.firstName} {emp.lastName} ({emp.department} · {emp.designation})
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Readiness Timeline</label>
              <select
                value={candReadiness}
                onChange={(e) => setCandReadiness(e.target.value)}
                className="w-full rounded-xl border border-slate-300 p-2 text-xs text-slate-800 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-none"
              >
                <option value="READY_NOW">Ready Now (&lt; 3 mos)</option>
                <option value="READY_1_YEAR">Ready in 1 Year</option>
                <option value="READY_2_YEARS">Ready in 2 Years</option>
                <option value="EMERGENCY_BACKUP">Emergency Backup</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Successor Rank</label>
              <Input
                type="number"
                min={1}
                max={5}
                value={candRanking}
                onChange={(e) => setCandRanking(parseInt(e.target.value, 10) || 1)}
              />
            </div>
          </div>
        </div>
      </ModalWrapper>
    </div>
  )
}
