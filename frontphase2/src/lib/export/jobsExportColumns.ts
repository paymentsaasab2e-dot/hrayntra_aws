import { csvDate } from '../../utils/csv';
import { buildExportCsvColumns, type ExportColumnDef } from './buildExportCsvColumns';

/** Row shape used by the jobs list export (matches jobs page list fields). */
export type JobExportRow = {
  title: string;
  client: string;
  location: string;
  jobLocationType?: string;
  status: string;
  openings?: number;
  applied?: number;
  interviewed?: number;
  offered?: number;
  joined?: number;
  owner: string;
  createdDate: string;
  hot?: boolean;
  aiMatch?: boolean;
  noCandidates?: boolean;
  slaRisk?: boolean;
};

export const JOBS_EXPORT_COLUMNS: ExportColumnDef<JobExportRow>[] = [
  { id: 'title', label: 'Title', accessor: (j) => j.title },
  { id: 'client', label: 'Client', accessor: (j) => j.client },
  { id: 'location', label: 'Location', accessor: (j) => j.location },
  { id: 'jobLocationType', label: 'Location Type', accessor: (j) => j.jobLocationType || '' },
  { id: 'status', label: 'Status', accessor: (j) => j.status },
  { id: 'openings', label: 'Openings', accessor: (j) => j.openings ?? 0 },
  { id: 'applied', label: 'Applied', accessor: (j) => j.applied ?? 0 },
  { id: 'interviewed', label: 'Interviewed', accessor: (j) => j.interviewed ?? 0 },
  { id: 'offered', label: 'Offered', accessor: (j) => j.offered ?? 0 },
  { id: 'joined', label: 'Joined', accessor: (j) => j.joined ?? 0 },
  { id: 'owner', label: 'Owner', accessor: (j) => j.owner },
  { id: 'createdDate', label: 'Created Date', accessor: (j) => csvDate(j.createdDate) },
  { id: 'hot', label: 'Hot', accessor: (j) => (j.hot ? 'true' : 'false') },
  { id: 'aiMatch', label: 'AI Match', accessor: (j) => (j.aiMatch ? 'true' : 'false') },
  { id: 'noCandidates', label: 'No Candidates', accessor: (j) => (j.noCandidates ? 'true' : 'false') },
  { id: 'slaRisk', label: 'SLA Risk', accessor: (j) => (j.slaRisk ? 'true' : 'false') },
];

export function buildJobsCsvColumns(selectedIds: string[]) {
  return buildExportCsvColumns(JOBS_EXPORT_COLUMNS, selectedIds);
}
