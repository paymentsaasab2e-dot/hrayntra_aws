'use client';

import { JobOverviewTabContent } from '../JobOverviewTabContent';
import { EntityWorkspaceAlertsPanel } from '../../ai/EntityWorkspaceAlertsPanel';
import type { JobForDrawer } from '../JobDetailsDrawer';

export function OverviewTab({ job }: { job: JobForDrawer }) {
  return (
    <div className="space-y-5">
      <EntityWorkspaceAlertsPanel
        entityType="JOB"
        entityId={job.id}
        entityLabel={job.title || 'Job'}
      />
      <JobOverviewTabContent job={job} />
    </div>
  );
}
