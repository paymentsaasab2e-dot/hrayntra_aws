"use client"
import * as React from 'react'
import { PageHeroBanner, SectionCard, StatusBadge, Button, MetricStatCard, Input, Select } from '@hryantra/ui'
import { useStore } from '@/store/StoreProvider'
import { Target, TrendingUp, CheckCircle, AlertTriangle, RefreshCw, BarChart3 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { PerformanceCycle, PerformanceReview } from '@/modules/performance/types'
import { PerformanceBreakdownPanel } from '@/modules/performance/components/PerformanceBreakdownPanel'
import { api } from '@/shared/api'

function currentQuarterCycle() {
  const now = new Date()
  const quarter = Math.floor(now.getMonth() / 3) + 1
  return `${now.getFullYear()}-Q${quarter}`
}

export default function PerformanceDashboardPage() {
  const {
    performanceReviews,
    employees,
    addPerformanceReview,
    updatePerformanceReview,
    refreshPerformanceReview,
    deletePerformanceReview,
  } = useStore()
  const router = useRouter()

  const [selectedCycle, setSelectedCycle] = React.useState(currentQuarterCycle())
  const [cycleType, setCycleType] = React.useState<PerformanceCycle>('quarterly')
  const [analytics, setAnalytics] = React.useState<any>(null)
  const [loadingAnalytics, setLoadingAnalytics] = React.useState(false)
  const [isFormOpen, setIsFormOpen] = React.useState(false)
  const [breakdownReview, setBreakdownReview] = React.useState<PerformanceReview | null>(null)
  const [editingReview, setEditingReview] = React.useState<PerformanceReview | null>(null)
  const [formState, setFormState] = React.useState({
    employeeId: '',
    cycle: currentQuarterCycle(),
    cycleType: 'quarterly' as PerformanceCycle,
    managerScore: 4,
    comments: '',
  })

  const cycleReviews = performanceReviews.filter(
    (r) => r.cycle === selectedCycle && r.cycleType === cycleType
  )
  const completedReviews = cycleReviews.filter((r) => r.status === 'Completed')
  const pendingReviews = cycleReviews.filter((r) => r.status !== 'Completed')

  const avgScore =
    cycleReviews.length > 0
      ? Math.round(
          cycleReviews.reduce(
            (sum, r) =>
              sum +
              (r.metrics.breakdown?.provisionalScore || r.metrics.finalScore || 0),
            0
          ) / cycleReviews.length
        )
      : 0

  const loadAnalytics = React.useCallback(async () => {
    setLoadingAnalytics(true)
    try {
      const res = await api.performance.getAnalytics(selectedCycle, cycleType)
      setAnalytics(res?.data || res)
    } catch (err) {
      console.error(err)
      setAnalytics(null)
    } finally {
      setLoadingAnalytics(false)
    }
  }, [selectedCycle, cycleType])

  React.useEffect(() => {
    loadAnalytics()
  }, [loadAnalytics])

  const openCreateForm = () => {
    setEditingReview(null)
    setFormState({
      employeeId: employees[0]?.id || '',
      cycle: selectedCycle,
      cycleType,
      managerScore: 4,
      comments: '',
    })
    setIsFormOpen(true)
  }

  const openEditForm = (review: PerformanceReview) => {
    setEditingReview(review)
    setFormState({
      employeeId: review.employeeId,
      cycle: review.cycle,
      cycleType: review.cycleType,
      managerScore:
        review.managerAssessment?.rating ||
        Math.max(1, Math.round((review.metrics.managerScore || 0) / 20)),
      comments: review.managerAssessment?.feedback || '',
    })
    setIsFormOpen(true)
  }

  const submitForm = (event: React.FormEvent) => {
    event.preventDefault()
    if (!formState.employeeId) return
    if (editingReview) {
      updatePerformanceReview(editingReview.id, {
        managerScore: formState.managerScore,
        comments: formState.comments,
      })
    } else {
      addPerformanceReview({
        employeeId: formState.employeeId,
        cycle: formState.cycle,
        cycleType: formState.cycleType,
      })
    }
    setIsFormOpen(false)
  }

  const dateEyebrow = React.useMemo(
    () =>
      new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }).toUpperCase(),
    []
  )

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-6 py-6 pb-10">
      <section className="flex flex-col gap-4">
        <PageHeroBanner
          compact
          eyebrow={dateEyebrow}
          title="Performance Management"
          description="Auto-scored reviews from tasks, attendance, and leave behavior."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={loadAnalytics} disabled={loadingAnalytics}>
                <RefreshCw className={`size-4 ${loadingAnalytics ? 'animate-spin' : ''}`} />
                Refresh Analytics
              </Button>
              <Button variant="default" onClick={openCreateForm}>
                Start Review Cycle
              </Button>
            </div>
          }
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MetricStatCard
            label="Avg Score"
            value={avgScore}
            subtitle="Out of 100"
            tone="blue"
            icon={TrendingUp}
          />
          <MetricStatCard
            label="Completed"
            value={completedReviews.length}
            subtitle="Finalized reviews"
            tone="mint"
            icon={CheckCircle}
          />
          <MetricStatCard
            label="Pending"
            value={pendingReviews.length}
            subtitle="Awaiting completion"
            tone="amber"
            icon={Target}
          />
          <MetricStatCard
            label="On-time Rate"
            value={analytics?.summary?.avgOnTimeRate != null ? `${analytics.summary.avgOnTimeRate}%` : '—'}
            subtitle="Task delivery"
            tone="indigo"
            icon={BarChart3}
          />
          <MetricStatCard
            label="At Risk"
            value={analytics?.summary?.atRiskCount ?? 0}
            subtitle="Needs attention"
            tone="rose"
            icon={AlertTriangle}
          />
        </div>
      </section>

      <SectionCard title="Review cycle">
        <div className="flex flex-col gap-4 md:flex-row md:items-end">
          <div className="flex-1 max-w-xs">
            <label className="text-xs font-semibold text-ds-neutral-500 uppercase tracking-wide mb-1 block">
              Review cycle
            </label>
            <Input
              value={selectedCycle}
              onChange={(e) => setSelectedCycle(e.target.value)}
              placeholder="e.g. 2026-Q2"
            />
          </div>
          <div className="w-full md:w-44">
            <label className="text-xs font-semibold text-ds-neutral-500 uppercase tracking-wide mb-1 block">
              Cycle type
            </label>
            <Select value={cycleType} onChange={(e) => setCycleType(e.target.value as PerformanceCycle)}>
              {(['monthly', 'quarterly', 'annual'] as PerformanceCycle[]).map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
          </div>
          <p className="text-xs text-ds-neutral-500 md:pb-2">
            {cycleReviews.length} review{cycleReviews.length === 1 ? '' : 's'} in this cycle
          </p>
        </div>
      </SectionCard>

      <SectionCard title="Team performance overview">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-ds-neutral-200 text-ds-label text-ds-neutral-500">
                <th className="py-3 px-4 font-semibold uppercase">Employee</th>
                <th className="py-3 px-4 font-semibold uppercase">Status</th>
                <th className="py-3 px-4 font-semibold uppercase text-center">Task</th>
                <th className="py-3 px-4 font-semibold uppercase text-center">Attendance</th>
                <th className="py-3 px-4 font-semibold uppercase text-center">Leave</th>
                <th className="py-3 px-4 font-semibold uppercase text-right">Score</th>
                <th className="py-3 px-4 font-semibold uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {cycleReviews.map((review) => {
                const emp = employees.find((e) => e.id === review.employeeId)
                if (!emp) return null
                const displayScore =
                  review.status === 'Completed'
                    ? review.metrics.finalScore
                    : review.metrics.breakdown?.provisionalScore || review.metrics.finalScore
                return (
                  <tr
                    key={review.id}
                    className="border-b border-ds-neutral-100 hover:bg-ds-neutral-50 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded-full bg-ds-brand-navy text-white flex items-center justify-center font-bold text-xs">
                          {emp.name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-ds-body-sm font-semibold text-ds-brand-navy">
                            {emp.name}
                          </span>
                          <span className="text-ds-caption text-ds-neutral-500">{emp.id}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge
                        status={review.status === 'Completed' ? 'Approved' : 'Pending'}
                      />
                      <div className="text-[10px] text-ds-neutral-500 mt-1">{review.status}</div>
                    </td>
                    <td className="py-3 px-4 text-center font-semibold">
                      {review.metrics.taskScore}
                    </td>
                    <td className="py-3 px-4 text-center font-semibold">
                      {review.metrics.attendanceScore}
                    </td>
                    <td className="py-3 px-4 text-center font-semibold">
                      {review.metrics.leaveScore}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex flex-col items-end">
                        <span className="text-ds-body font-bold text-ds-brand-green">
                          {displayScore}
                        </span>
                        <span className="text-[10px] text-ds-neutral-500 font-medium">
                          {review.metrics.category}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2 flex-wrap">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setBreakdownReview(review)}
                        >
                          Breakdown
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => refreshPerformanceReview(review.id)}
                        >
                          Refresh
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/employees/${emp.id}?tab=performance`)}
                        >
                          Profile
                        </Button>
                        {review.status !== 'Completed' && (
                          <Button variant="outline" size="sm" onClick={() => openEditForm(review)}>
                            Manager Review
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => deletePerformanceReview(review.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {cycleReviews.length === 0 && (
            <div className="py-8 text-center text-ds-body text-ds-neutral-500">
              No reviews for {selectedCycle}. Start a review cycle to auto-compute scores.
            </div>
          )}
        </div>
      </SectionCard>

      {isFormOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-ds-brand-navy/40 backdrop-blur-sm"
          onClick={() => setIsFormOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-xl mx-4 p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-ds-heading-sm font-bold text-ds-brand-navy mb-4">
              {editingReview ? 'Submit Manager Review' : 'Start Review Cycle'}
            </h3>
            <form onSubmit={submitForm} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {!editingReview && (
                <>
                  <select
                    className="border border-ds-neutral-300 rounded-lg px-3 py-2 md:col-span-2"
                    value={formState.employeeId}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, employeeId: e.target.value }))
                    }
                  >
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name} ({employee.id})
                      </option>
                    ))}
                  </select>
                  <input
                    required
                    className="border border-ds-neutral-300 rounded-lg px-3 py-2"
                    value={formState.cycle}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, cycle: e.target.value }))
                    }
                    placeholder="Cycle (e.g. 2026-Q2)"
                  />
                  <select
                    className="border border-ds-neutral-300 rounded-lg px-3 py-2"
                    value={formState.cycleType}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        cycleType: e.target.value as PerformanceCycle,
                      }))
                    }
                  >
                    {(['monthly', 'quarterly', 'annual'] as PerformanceCycle[]).map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </>
              )}
              {editingReview && (
                <>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    className="border border-ds-neutral-300 rounded-lg px-3 py-2"
                    value={formState.managerScore}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        managerScore: Number(e.target.value),
                      }))
                    }
                  />
                  <textarea
                    className="md:col-span-2 border border-ds-neutral-300 rounded-lg px-3 py-2"
                    rows={3}
                    value={formState.comments}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, comments: e.target.value }))
                    }
                    placeholder="Manager feedback"
                  />
                </>
              )}
              <div className="md:col-span-2 flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="default">
                  {editingReview ? 'Submit Review' : 'Create & Auto-Score'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {breakdownReview && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-ds-brand-navy/40 backdrop-blur-sm"
          onClick={() => setBreakdownReview(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-4xl mx-4 p-6 max-h-[90vh] overflow-y-auto"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-ds-heading-sm font-bold text-ds-brand-navy">
                Score Breakdown — {breakdownReview.cycle}
              </h3>
              <Button variant="outline" size="sm" onClick={() => setBreakdownReview(null)}>
                Close
              </Button>
            </div>
            <PerformanceBreakdownPanel metrics={breakdownReview.metrics} />
            {breakdownReview.insights && (
              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <InsightList title="Strengths" items={breakdownReview.insights.strengths} />
                <InsightList title="Weaknesses" items={breakdownReview.insights.weaknesses} />
                <InsightList
                  title="Recommendations"
                  items={breakdownReview.insights.recommendations}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function InsightList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="border border-ds-neutral-200 rounded-lg p-4">
      <h4 className="text-ds-label font-semibold text-ds-brand-navy mb-2">{title}</h4>
      <ul className="list-disc pl-5 text-ds-body-sm space-y-1">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  )
}
