'use client';

import type { JobApplicationSubmission } from '../drawers/JobDetailsDrawer';
import { ApplicationAssessmentResults } from './ApplicationAssessmentResults';

function candidateLabel(app: JobApplicationSubmission): string {
  const c = app.candidate;
  const name = `${c?.firstName || ''} ${c?.lastName || ''}`.trim();
  return name || c?.email || app.candidateId || 'Candidate';
}

export function JobApplicationsAssessmentPanel({
  applications,
}: {
  applications?: JobApplicationSubmission[];
}) {
  const rows = (() => {
    const list = Array.isArray(applications) ? applications.filter((a) => a?.id) : [];
    const byCandidateJob = new Map<string, (typeof list)[number]>();
    for (const app of list) {
      const candId = String(app.candidateId || app.candidate?.id || '').trim();
      const jobId = String((app as { jobId?: string }).jobId || '').trim();
      const key = candId && jobId ? `${candId}:${jobId}` : app.id;
      if (!byCandidateJob.has(key)) {
        byCandidateJob.set(key, app);
      }
    }
    return Array.from(byCandidateJob.values());
  })();
  if (!rows.length) return null;

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Application assessments
      </p>
      <ul className="mt-3 divide-y divide-slate-100">
        {rows.map((app) => (
          <li key={app.id} className="py-2.5 first:pt-0 last:pb-0">
            <p className="text-sm font-medium text-slate-800">{candidateLabel(app)}</p>
            <ApplicationAssessmentResults applicationId={app.id} />
          </li>
        ))}
      </ul>
    </div>
  );
}
