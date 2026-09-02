'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, ClipboardList, Loader2 } from 'lucide-react';
import { getApplicationAssessmentResults } from '../../lib/api';
import { startAsyncLoad } from '../../lib/asyncLoadGuard';
import type { JobApplicationSubmission, JobForDrawer } from '../drawers/JobDetailsDrawer';
import {
  DrawerSectionCard,
  DRAWER_TABLE_BODY,
  DRAWER_TABLE_HEAD_ROW,
  DRAWER_TABLE_SCROLL,
  DRAWER_TABLE_SHELL,
  DRAWER_TABLE_TD,
  DRAWER_TABLE_TH,
  DRAWER_TABLE_TR,
} from '../drawers/drawerFormUi';
import {
  AssessmentReviewRow,
  AssessmentStatusSummary,
  type AssessmentResult,
} from './ApplicationAssessmentResults';

type AssessmentColumn = {
  key: string;
  jobAssessmentId?: string;
  assessmentId?: string;
  title: string;
  type?: string;
};

function candidateLabel(app: JobApplicationSubmission): string {
  const c = app.candidate;
  const name = `${c?.firstName || ''} ${c?.lastName || ''}`.trim();
  return name || c?.email || app.candidateId || 'Candidate';
}

function dedupeApplications(applications?: JobApplicationSubmission[]) {
  const list = Array.isArray(applications) ? applications.filter((a) => a?.id) : [];
  const byCandidateJob = new Map<string, JobApplicationSubmission>();
  for (const app of list) {
    const candId = String(app.candidateId || app.candidate?.id || '').trim();
    const jobId = String((app as { jobId?: string }).jobId || '').trim();
    const key = candId && jobId ? `${candId}:${jobId}` : app.id;
    if (!byCandidateJob.has(key)) {
      byCandidateJob.set(key, app);
    }
  }
  return Array.from(byCandidateJob.values());
}

function buildColumns(job: JobForDrawer): AssessmentColumn[] {
  const links = Array.isArray(job.preScreenAssessments) ? job.preScreenAssessments : [];
  return links.map((link, index) => {
    const jobAssessmentId = String(link.id || '').trim() || undefined;
    const assessmentId = String(link.assessmentId || link.assessment?.id || '').trim() || undefined;
    const title = String(link.assessment?.title || 'Assessment').trim();
    return {
      key: jobAssessmentId || assessmentId || `assessment-${index}`,
      jobAssessmentId,
      assessmentId,
      title,
      type: link.assessment?.type,
    };
  });
}

function matchResultToColumn(result: AssessmentResult, col: AssessmentColumn): boolean {
  if (col.jobAssessmentId && result.jobAssessmentId === col.jobAssessmentId) return true;
  if (col.assessmentId && result.assessmentId === col.assessmentId) return true;
  if (col.title && result.title === col.title) return true;
  return false;
}

export function JobAssessmentsTabContent({ job }: { job: JobForDrawer }) {
  const columns = useMemo(() => buildColumns(job), [job.preScreenAssessments]);
  const candidates = useMemo(() => dedupeApplications(job.applications), [job.applications]);
  const [loading, setLoading] = useState(true);
  const [resultsByApp, setResultsByApp] = useState<Record<string, AssessmentResult[]>>({});
  const [expanded, setExpanded] = useState<{ applicationId: string; columnKey: string } | null>(null);

  const loadAll = useCallback(async () => {
    if (!candidates.length) {
      setResultsByApp({});
      setLoading(false);
      return;
    }
    const load = startAsyncLoad(setLoading);
    try {
      const entries = await Promise.all(
        candidates.map(async (app) => {
          try {
            const res = await getApplicationAssessmentResults(app.id);
            const rows = Array.isArray(res?.data) ? (res.data as AssessmentResult[]) : [];
            return [app.id, rows] as const;
          } catch {
            return [app.id, []] as const;
          }
        }),
      );
      if (load.isActive()) setResultsByApp(Object.fromEntries(entries));
    } finally {
      load.finish();
    }
  }, [candidates]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const toggleCell = (applicationId: string, columnKey: string, result: AssessmentResult | null) => {
    if (!result) return;
    setExpanded((prev) =>
      prev?.applicationId === applicationId && prev?.columnKey === columnKey
        ? null
        : { applicationId, columnKey },
    );
  };

  if (!columns.length) {
    return (
      <DrawerSectionCard
        title="Assessments"
        subtitle="Pre-screen test results"
        icon={ClipboardList}
        accent="violet"
      >
        <p className="text-sm text-slate-600">No pre-screen assessments are attached to this job.</p>
        <p className="mt-1 text-xs text-slate-500">Add tests in the job editor under Application form.</p>
      </DrawerSectionCard>
    );
  }

  return (
    <DrawerSectionCard
      title="Assessments"
      subtitle="Per-candidate scores and manual review for coding, essay, and video tests"
      icon={ClipboardList}
      accent="violet"
    >
      {loading ? (
        <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-500">
          <Loader2 className="size-4 animate-spin" /> Loading assessment results…
        </div>
      ) : candidates.length === 0 ? (
        <div className="p-8 text-center text-sm text-slate-500">No applications yet.</div>
      ) : (
        <div className={DRAWER_TABLE_SHELL}>
          <div className={DRAWER_TABLE_SCROLL}>
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className={DRAWER_TABLE_HEAD_ROW}>
                  <th className={`${DRAWER_TABLE_TH} first:pl-4 sm:first:pl-5`}>Candidate</th>
                  {columns.map((col) => (
                    <th key={col.key} className={DRAWER_TABLE_TH}>
                      <span className="block">{col.title}</span>
                      {col.type ? (
                        <span className="mt-0.5 block font-normal normal-case tracking-normal text-indigo-900/40">
                          {col.type}
                        </span>
                      ) : null}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className={DRAWER_TABLE_BODY}>
                {candidates.map((app) => {
                  const appResults = resultsByApp[app.id] || [];
                  const isRowExpanded =
                    expanded?.applicationId === app.id &&
                    columns.some((c) => c.key === expanded.columnKey);
                  const expandedCol = columns.find((c) => c.key === expanded?.columnKey);
                  const expandedResult =
                    expandedCol && expanded?.applicationId === app.id
                      ? appResults.find((r) => matchResultToColumn(r, expandedCol)) || null
                      : null;

                  return (
                    <Fragment key={app.id}>
                      <tr className={DRAWER_TABLE_TR}>
                        <td
                          className={`${DRAWER_TABLE_TD} first:pl-4 font-medium text-slate-800 sm:first:pl-5`}
                        >
                          {candidateLabel(app)}
                        </td>
                        {columns.map((col) => {
                          const result = appResults.find((r) => matchResultToColumn(r, col)) || null;
                          const isActive =
                            expanded?.applicationId === app.id && expanded?.columnKey === col.key;
                          return (
                            <td key={col.key} className={`${DRAWER_TABLE_TD} align-top`}>
                              <button
                                type="button"
                                disabled={!result}
                                onClick={() => toggleCell(app.id, col.key, result)}
                                className={`flex w-full items-start gap-1 text-left text-xs ${
                                  result ? 'cursor-pointer hover:text-violet-800' : 'cursor-default'
                                } ${isActive ? 'text-violet-800' : 'text-slate-700'}`}
                              >
                                {result ? (
                                  isActive ? (
                                    <ChevronDown className="mt-0.5 size-3.5 shrink-0" />
                                  ) : (
                                    <ChevronRight className="mt-0.5 size-3.5 shrink-0" />
                                  )
                                ) : null}
                                <AssessmentStatusSummary row={result} />
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                      {isRowExpanded && expandedResult ? (
                        <tr className="bg-violet-50/40">
                          <td colSpan={columns.length + 1} className={`${DRAWER_TABLE_TD} sm:px-5`}>
                            <p className="mb-2 text-xs font-semibold text-slate-700">
                              {candidateLabel(app)} — {expandedCol?.title}
                            </p>
                            <ul className="space-y-1.5">
                              <AssessmentReviewRow
                                row={expandedResult}
                                onGraded={(updated) => {
                                  setResultsByApp((prev) => ({
                                    ...prev,
                                    [app.id]: (prev[app.id] || []).map((r) =>
                                      r.sessionId === updated.sessionId ? { ...r, ...updated } : r,
                                    ),
                                  }));
                                }}
                              />
                            </ul>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </DrawerSectionCard>
  );
}
