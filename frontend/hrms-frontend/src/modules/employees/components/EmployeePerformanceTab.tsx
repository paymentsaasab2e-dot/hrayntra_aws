import * as React from 'react'
import { useParams } from 'next/navigation'
import { useStore, CURRENT_USER_ID } from '@/store/StoreProvider'
import { SectionCard, StatusBadge, Button } from '@hryantra/ui'
import { Target, Clock, CalendarDays, TrendingUp, CheckCircle, AlertTriangle } from 'lucide-react'
import { PerformanceBreakdownPanel } from '@/modules/performance/components/PerformanceBreakdownPanel'

export function EmployeePerformanceTab() {
  const params = useParams()
  const employeeId = params.id as string
  const { performanceReviews, submitSelfReview, submitManagerReview, refreshPerformanceReview } = useStore()

  const reviews = performanceReviews.filter(pr => pr.employeeId === employeeId)
  const isManagerView = employeeId !== CURRENT_USER_ID
  
  if (reviews.length === 0) {
    return (
      <SectionCard>
        <div className="py-12 flex flex-col items-center justify-center text-center">
          <Target className="size-12 text-ds-neutral-300 mb-4" />
          <h3 className="text-ds-heading-sm text-ds-brand-navy mb-1">No Performance Data</h3>
          <p className="text-ds-body text-ds-neutral-500">There are no performance reviews generated for this employee yet.</p>
        </div>
      </SectionCard>
    )
  }

  // Just showing the most recent cycle for simplicity
  const currentReview = reviews[0]

  return (
    <div className="space-y-6">
      <SectionCard>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-ds-heading text-ds-brand-navy">Cycle: {currentReview.cycle}</h3>
            <p className="text-ds-body text-ds-neutral-500">Performance Type: {currentReview.cycleType}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={currentReview.status === 'Completed' ? 'Approved' : 'Pending'} />
            <Button variant="outline" size="sm" onClick={() => refreshPerformanceReview(currentReview.id)}>
              Refresh Scores
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-ds-brand-navy-light/5 border border-ds-neutral-200 rounded-lg p-4 flex flex-col justify-between">
            <span className="text-ds-label text-ds-neutral-500 flex items-center gap-2"><Target className="size-4" /> Tasks & Delivery (40%)</span>
            <span className="text-3xl font-bold text-ds-brand-navy mt-2">{currentReview.metrics.taskScore}</span>
          </div>
          <div className="bg-ds-brand-navy-light/5 border border-ds-neutral-200 rounded-lg p-4 flex flex-col justify-between">
            <span className="text-ds-label text-ds-neutral-500 flex items-center gap-2"><Clock className="size-4" /> Attendance (20%)</span>
            <span className="text-3xl font-bold text-ds-brand-navy mt-2">{currentReview.metrics.attendanceScore}</span>
          </div>
          <div className="bg-ds-brand-navy-light/5 border border-ds-neutral-200 rounded-lg p-4 flex flex-col justify-between">
            <span className="text-ds-label text-ds-neutral-500 flex items-center gap-2"><CalendarDays className="size-4" /> Leave Behavior (20%)</span>
            <span className="text-ds-3xl font-bold text-ds-brand-navy mt-2 text-3xl">{currentReview.metrics.leaveScore}</span>
          </div>
          <div className="bg-ds-brand-navy-light/5 border border-ds-neutral-200 rounded-lg p-4 flex flex-col justify-between">
            <span className="text-ds-label text-ds-neutral-500 flex items-center gap-2"><TrendingUp className="size-4" /> Final Score</span>
            <div className="flex flex-col mt-2">
              <span className="text-3xl font-bold text-ds-brand-green">{currentReview.metrics.finalScore}</span>
              <span className="text-ds-caption font-semibold text-ds-brand-green">{currentReview.metrics.category}</span>
            </div>
          </div>
        </div>

        <div className="mb-8">
          <h4 className="text-ds-heading-sm mb-3 text-ds-brand-navy">Detailed Breakdown</h4>
          <PerformanceBreakdownPanel metrics={currentReview.metrics} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border border-ds-neutral-200 rounded-lg p-5">
            <h4 className="text-ds-heading-sm mb-4 border-b pb-2">AI Insights</h4>
            <div className="space-y-4">
              <div>
                <span className="text-ds-label-upper text-ds-success-dark flex items-center gap-2 mb-2"><CheckCircle className="size-4" /> Strengths</span>
                <ul className="list-disc pl-5 text-ds-body-sm space-y-1">
                  {currentReview.insights.strengths.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
              <div>
                <span className="text-ds-label-upper text-ds-danger-dark flex items-center gap-2 mb-2"><AlertTriangle className="size-4" /> Areas for Improvement</span>
                <ul className="list-disc pl-5 text-ds-body-sm space-y-1">
                  {currentReview.insights.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            </div>
          </div>

          <div className="border border-ds-neutral-200 rounded-lg p-5 flex flex-col h-full">
            <h4 className="text-ds-heading-sm mb-4 border-b pb-2">Evaluations</h4>
            
            <div className="space-y-4 flex-1">
              {currentReview.selfAssessment ? (
                <div className="bg-ds-neutral-50 p-3 rounded border border-ds-neutral-100">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-ds-label font-semibold">Self Review</span>
                    <span className="text-ds-caption bg-white px-2 py-0.5 rounded border">Rating: {currentReview.selfAssessment.rating}/5</span>
                  </div>
                  <p className="text-ds-body-sm text-ds-neutral-600">"{currentReview.selfAssessment.comments}"</p>
                </div>
              ) : (
                <div className="bg-amber-50 p-3 rounded border border-amber-100 flex flex-col gap-2">
                  <span className="text-ds-label text-amber-800">Pending Self Review</span>
                  {!isManagerView && (
                    <Button size="sm" onClick={() => submitSelfReview(currentReview.id, 4, "I did my best this cycle.")}>Submit Review (Demo)</Button>
                  )}
                </div>
              )}

              {currentReview.managerAssessment ? (
                <div className="bg-ds-neutral-50 p-3 rounded border border-ds-neutral-100">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-ds-label font-semibold">Manager Review</span>
                    <span className="text-ds-caption bg-white px-2 py-0.5 rounded border">Rating: {currentReview.managerAssessment.rating}/5</span>
                  </div>
                  <p className="text-ds-body-sm text-ds-neutral-600">"{currentReview.managerAssessment.feedback}"</p>
                </div>
              ) : (
                <div className="bg-amber-50 p-3 rounded border border-amber-100 flex flex-col gap-2">
                  <span className="text-ds-label text-amber-800">Pending Manager Review</span>
                  {isManagerView && currentReview.status === 'Pending Manager Review' && (
                    <Button size="sm" variant="default" onClick={() => submitManagerReview(currentReview.id, 4, "Solid performance, keep it up.")}>Submit Manager Score (Demo)</Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  )
}
