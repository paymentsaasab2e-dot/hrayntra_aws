'use client';

import { JobAssessmentsTabContent } from '../../jobs/JobAssessmentsTabContent';
import type { JobForDrawer } from '../JobDetailsDrawer';

export function AssessmentsTab({ job }: { job: JobForDrawer }) {
  return <JobAssessmentsTabContent job={job} />;
}
