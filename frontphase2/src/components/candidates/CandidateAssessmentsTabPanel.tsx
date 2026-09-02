'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardList, Loader2 } from 'lucide-react';
import { getCandidateAssessmentResults } from '@/lib/api';
import { startAsyncLoad } from '@/lib/asyncLoadGuard';
import {
  AssessmentReviewRow,
  type AssessmentResult,
} from '../jobs/ApplicationAssessmentResults';
import { DrawerSectionCard } from '../drawers/drawerFormUi';

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

    const session = startAsyncLoad(setLoading);
    setError(null);
    try {
      const res = await getCandidateAssessmentResults(id, preferredJobId || undefined);
      if (!session.isActive()) return;
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
      if (!session.isActive()) return;
      setError(e instanceof Error ? e.message : 'Could not load assessment results');
      setGroups([]);
    } finally {
      session.finish();
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
      <DrawerSectionCard title="Assessments" subtitle="Loading results…" icon={ClipboardList} accent="violet">
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
          <Loader2 className="size-4 animate-spin" />
          Loading assessment results…
        </div>
      </DrawerSectionCard>
    );
  }

  if (error) {
    return (
      <DrawerSectionCard title="Assessments" subtitle="Could not load results" icon={ClipboardList} accent="violet">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
      </DrawerSectionCard>
    );
  }

  if (!totalAssessments) {
    return (
      <DrawerSectionCard
        title="Assessments"
        subtitle="Pre-screen tests and review controls"
        icon={ClipboardList}
        accent="violet"
      >
        <p className="text-sm font-medium text-slate-700">No assessments submitted yet</p>
        <p className="mt-1 text-xs text-slate-500">
          Pre-screen tests completed by this candidate will appear here with scores, answers, and review
          controls.
        </p>
      </DrawerSectionCard>
    );
  }

  return (
    <div className="space-y-5">
      {visibleGroups.map((group) => (
        <DrawerSectionCard
          key={group.jobId || group.jobTitle}
          title={group.jobTitle}
          subtitle={`${group.results.length} assessment${group.results.length === 1 ? '' : 's'} submitted`}
          icon={ClipboardList}
          accent="violet"
        >
          <ul className="space-y-2">
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
        </DrawerSectionCard>
      ))}
    </div>
  );
}
