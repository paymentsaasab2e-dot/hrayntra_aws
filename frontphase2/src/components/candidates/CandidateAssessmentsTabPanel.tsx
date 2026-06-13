'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { getCandidateAssessmentResults } from '@/lib/api';
import {
  AssessmentReviewRow,
  type AssessmentResult,
} from '../jobs/ApplicationAssessmentResults';

type JobAssessmentGroup = {
  jobId: string;
  jobTitle: string;
  applicationId?: string | null;
  results: AssessmentResult[];
};

export function CandidateAssessmentsTabPanel({
  candidateId,
  preferredJobId,
  enabled = true,
}: {
  candidateId: string;
  preferredJobId?: string | null;
  enabled?: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<JobAssessmentGroup[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const id = String(candidateId || '').trim();
    if (!id || !enabled) {
      setGroups([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await getCandidateAssessmentResults(id, preferredJobId || undefined);
      const rows = Array.isArray(res?.data) ? (res.data as JobAssessmentGroup[]) : [];
      setGroups(
        rows.map((group) => ({
          jobId: String(group.jobId || ''),
          jobTitle: String(group.jobTitle || 'Untitled job'),
          applicationId: group.applicationId || null,
          results: Array.isArray(group.results) ? (group.results as AssessmentResult[]) : [],
        })),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load assessment results');
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, [candidateId, enabled, preferredJobId]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleGroups = useMemo(() => {
    const scopedJobId = String(preferredJobId || '').trim();
    if (!scopedJobId) return groups;
    const match = groups.filter((group) => group.jobId === scopedJobId);
    return match.length ? match : groups;
  }, [groups, preferredJobId]);

  const totalAssessments = visibleGroups.reduce((sum, group) => sum + group.results.length, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-10 text-sm text-slate-500">
        <Loader2 className="size-4 animate-spin" />
        Loading assessment results…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
        {error}
      </div>
    );
  }

  if (!totalAssessments) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-sm font-medium text-slate-700">No assessments submitted yet</p>
        <p className="mt-1 text-xs text-slate-500">
          Pre-screen tests completed by this candidate will appear here with scores, answers, and
          review controls.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {visibleGroups.map((group) => (
        <section
          key={group.jobId || group.jobTitle}
          className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
        >
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">{group.jobTitle}</p>
            <p className="mt-0.5 text-xs text-slate-500">
              {group.results.length} assessment{group.results.length === 1 ? '' : 's'} submitted
            </p>
          </div>

          <ul className="space-y-2 p-4">
            {group.results.map((row) => (
              <AssessmentReviewRow
                key={row.sessionId || `${group.jobId}-${row.title}`}
                row={row}
                onGraded={(updated) => {
                  setGroups((prev) =>
                    prev.map((entry) =>
                      entry.jobId !== group.jobId
                        ? entry
                        : {
                            ...entry,
                            results: entry.results.map((item) =>
                              item.sessionId === updated.sessionId ? { ...item, ...updated } : item,
                            ),
                          },
                    ),
                  );
                }}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
